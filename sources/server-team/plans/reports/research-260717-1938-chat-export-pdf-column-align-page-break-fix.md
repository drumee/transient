# Research: Fix cột chat-export PDF lệch ở trang 2+ (LibreOffice)

Date: 2026-07-17 | Scope: `offline/media/chat-export-html.js` + `chat-export.js` | Verified trên stage (soffice 25.2.3)

## TL;DR — CÓ cách sửa, đã kiểm chứng pixel

**Root cause thật:** không phải soffice yếu — mà là **HTML import dùng "Writer/Web" filter**, filter này KHÔNG có khái niệm "page" nên không giữ được table column-width qua page-break. Chuyển sang cho soffice một **Flat ODT (.fodt)** thay vì HTML → dùng "Writer" filter thật → column-width khóa tuyệt đối qua MỌI trang + header row tự lặp đầu trang.

**Bằng chứng (đo pixel, 60 rows / 3 trang trên stage):** cột Message bắt đầu ở x=320-321px trên cả 3 trang (**spread = 1px** = khớp hoàn hảo). So với HTML hiện tại: page 2 lệch ~25px.

## Các hướng đã cân nhắc

| Hướng | Kết quả | Ghi chú |
|---|---|---|
| **A. Sinh Flat ODT (.fodt) thay HTML** | ✅ **KHUYẾN NGHỊ** | soffice giữ `style:column-width` (cm) tuyệt đối qua page-break; `<table:table-header-rows>` lặp header. Verified spread=1px. Không cần cài gì thêm. |
| B. Đổi engine: wkhtmltopdf / weasyprint / chromium | ❌ loại | Stage KHÔNG có (chỉ soffice). Cài thêm = thay đổi hạ tầng, cần ops. weasyprint/wkhtml render CSS chuẩn nhưng out-of-scope. |
| C. Node PDF lib (pdfkit/puppeteer) | ❌ loại | node_modules không có; puppeteer cần chromium. |
| D. HTML `<thead>` lặp + table-layout:fixed | ⚠️ đã thử, KHÔNG đủ | Đã ship rồi vẫn lệch trang 2 — vì Web filter bỏ qua. |
| E. Chấp nhận / block-layout | ⚠️ fallback | block-layout hết lệch nhưng user chê xấu, đã revert. |

## Giải pháp A — chi tiết kỹ thuật

### Tại sao hoạt động
- HTML → soffice: filter `HTML (StarWriter)` = **Writer/Web** (web layout, no pages) → table columns co giãn theo nội dung mỗi page fragment.
- FODT → soffice: filter `OpenDocument Text` = **Writer** (page layout thật) → `<style:table-column-properties style:column-width="3cm">` là ràng buộc CỨNG, giữ nguyên mọi trang.
- Bonus: `<table:table-header-rows>` → header "Time/Author/Message" tự lặp đầu mỗi trang (HTML `<thead>` không làm được qua Web filter).

### FODT skeleton (đã test chạy)
```xml
<office:document office:mimetype="application/vnd.oasis.opendocument.text" ...>
 <office:automatic-styles>
  <style:style style:name="C1" style:family="table-column">
    <style:table-column-properties style:column-width="3cm"/></style:style>
  <!-- C2=3cm, C3=10cm → tỉ lệ ~1:1:3 -->
  <style:style style:name="Cell" style:family="table-cell">
    <style:table-cell-properties fo:padding="0.1cm" fo:border-bottom="0.02cm solid #e8e8e8"/></style:style>
 </office:automatic-styles>
 <office:body><office:text>
  <table:table table:name="Chat">
   <table:table-column table:style-name="C1"/> <!-- x3 -->
   <table:table-header-rows> <table:table-row>...Time/Author/Message...</table:table-row> </table:table-header-rows>
   <table:table-row><table:table-cell><text:p>...</text:p></table:table-cell>...</table:table-row>
  </table:table>
 </office:text></office:body>
</office:document>
```
Convert y hệt hiện tại: `soffice --headless --convert-to pdf file.fodt`.

### Việc phải làm để chuyển
1. **Viết lại `chat-export-html.js` → `chat-export-odt.js`** (hoặc giữ tên, đổi nội dung): sinh FODT XML thay HTML. Map lại:
   - Section title (colspan) → `table:number-columns-spanned="3"` cell, hoặc 1 paragraph heading giữa các bảng.
   - Rich text (bold author, màu, italic event) → `<text:span>` + `text:style-name` (định nghĩa trong automatic-styles). KHÁC HTML inline style — cần khai báo style trước.
   - Reply quote / attachment → paragraph con trong cell message với style riêng.
   - Mention flatten, esc XML (`&<>"`) giữ nguyên logic.
2. **`chat-export.js`**: đổi ext output `export.html` → `export.fodt`; soffice output vẫn ra `export.pdf`. Không đổi gì khác.
3. **Rich text formatting trong ODT phức tạp hơn HTML** — mọi màu/đậm/nghiêng phải là named style khai báo trước, không inline được như CSS. Đây là chi phí chính của việc chuyển.

## Ước lượng công sức
- Rewrite builder HTML→FODT: **trung bình** (2-3h). Logic gather/section/reply KHÔNG đổi, chỉ đổi lớp render markup.
- Rủi ro: ODT rich-text verbose; cần map cẩn thận bold/color/italic sang named styles. Table borders/padding cm thay vì px.
- Zero hạ tầng mới — cùng soffice, cùng flow spawn.

## Khuyến nghị
Nếu user cần cột thẳng tuyệt đối qua nhiều trang **và** giữ dạng bảng đẹp → **làm hướng A (FODT)**. Đây là cách đúng đắn duy nhất với hạ tầng hiện tại (chỉ soffice). Nếu chấp nhận lệch nhẹ trang 2 với chat dài → giữ HTML table hiện tại (đã revert về).

## Unresolved
1. User có muốn bỏ công rewrite sang FODT không, hay chấp nhận HTML table hiện tại (chat ngắn 1 trang là hoàn hảo)?
2. Nếu làm FODT: giữ per-section table riêng (mỗi section 1 `<table:table>` — header lặp per-section) hay 1 bảng chung? Với FODT nên mỗi section 1 bảng (header repeat đẹp hơn, không cần colspan title-row hack).
3. Có cần cài weasyprint/chromium lên stage để mở đường CSS-chuẩn về sau không (quyết định ops)?
