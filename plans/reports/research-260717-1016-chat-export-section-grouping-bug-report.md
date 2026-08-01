# Research Report: Chat export sai section — "This Folder Chat" gộp mọi folder, root card rỗng, tên = id

Date: 2026-07-17 | Branch: `test` | Hub kiểm chứng: `ca2375f3ca2375f8` (DB `d_ca2376d5ca2376d6`, stage)

## Executive Summary

Export chat hiện **hub-scoped** trong khi UI chat hiển thị **folder-scoped** (lọc `metadata._scope_nid` ở JS). Proc `channel_export_messages` chỉ lọc `file_thread_id IS NULL`, KHÔNG lọc/nhóm theo `_scope_nid` → mọi general chat của A, B, C, D đổ chung vào 1 section "This Folder Chat". Root card `file.thread` (message rỗng, `message_type='file.thread'`) cũng bị xuất ra thành message trống. `meta.hub_name` + tên file export dùng hub id thay vì tên workspace vì cột `hubname` trong `yp.hub` của hub này chứa chính id.

Xác minh bằng data thật trên stage (bảng dưới) — export JSON của user khớp 100% với dự đoán từ code.

## Data thật trên stage (đối chiếu)

Cấu trúc thư mục (`media`): root `cab853b7cab853bc` (=A, hub root, mimetype `special`) → `sub1`=`c924896fc9248973` (=C), `sub2`=`cc6f6d91cc6f6d95` (=B); `sub3`=`d11499c5d11499c8` (=D, con của sub1); 2 file trong D: `e7afc3c1e7afc3c5`, `e9566e24e9566e29` (2 file_thread active).

Bảng `channel` (12 rows):

| sys_id | message | file_thread_id | `_scope_nid` | Thuộc chat |
|---|---|---|---|---|
| 4,5,6 | hello / hi / mention | NULL | `cab853b7…` | **A** (root) |
| 7 | (rỗng — root card) | NULL | `d11499c5…` | card thread file 1 |
| 8,10 | hi / why so slow | `02ed640e…` | `d11499c5…` | thread file 1 |
| 11 | (rỗng — root card) | NULL | `d11499c5…` | card thread file 2 |
| 12,14 | hello sub 3 file 2 / oh hello… | `c8e302c8…` | `d11499c5…` | thread file 2 |
| 15 | sumoner thread | NULL | `d11499c5…` | **D** general |
| 16 | hello | NULL | `cc6f6d91…` | **B** general |
| 17 | from sub 1 general | NULL | `c924896f…` | **C** general |

Export JSON của user: section "This Folder Chat" chứa sys 4,5,6,**7**,**11**,15,16,17 — đúng như phân tích: trộn A+B+C+D + 2 root card rỗng (sys 7, 11 xuất hiện với `"text": ""`).

`yp.hub` row: `hubname='ca2375f3ca2375f8'` (= id!), `name='aaron-ws'` → `meta.hub_name` và filename `Drumee_Chat_ca2375f3ca2375f8_…` lấy nhầm id.

Lưu ý: 2 section file-thread có `name` = `Drumee_Chat_8e34ce93…` — đây LÀ `user_filename` thật của file (file test là file JSON export cũ nên tên trông như id). Logic resolve filename của thread đúng; vấn đề tên-id nằm ở hub_name.

## Root Causes

### RC1 — Export không nhóm theo folder (`_scope_nid`)
- `schemas/hub/procedures/channel/channel_export_messages.sql`: WHERE chỉ có `file_thread_id IS NULL` + delete_channel + date range. Không đọc `metadata._scope_nid`.
- Đối chiếu runtime: `service/private/channel.js` `messages()` (L107–122) lọc `meta._scope_nid === nid` per-folder ở JS. Export bỏ qua hoàn toàn chiều này.
- `channel_export_count` cùng lỗi → count trong modal (folder card "N messages") là count TOÀN HUB, không phải folder đang mở → đây chính là case "user mới chat/mới tải file thì info show không đúng": folder mới tinh vẫn hiện count/mtime của hub.

### RC2 — Root card `file.thread` bị xuất như message thường
- Row sys 7/11: `message=NULL`, `metadata.message_type='file.thread'`, `_file_thread_root=1`. `_gatherSections`/`_normalizeMessage` (channel.js L2801–2935) và worker `chat-export.js` không lọc `message_type` → JSON/PDF có message rỗng vô nghĩa.

### RC3 — hub_name = id
- `export()`/`export_scope()` dùng `this.hub.get(Attr.name) || this.hub.get("hubname") || id`; hub model phía server đang trả về giá trị = id (yp.hub.hubname=id do flow tạo workspace chỉ set `name`). UI đã workaround (`ui.mget(_a.name)` — comment "backend hub.name may resolve to the hub_id hash until export_scope is fixed" trong skeleton) nhưng backend meta + `_exportBasename` vẫn dính.

### RC4 — Nội dung message thô, khó đọc trong PDF
- Mention giữ nguyên markup `[@label](mention:hub:nid)` (sys 6).
- `reply_to` in ra message_id thô (`Reply to: f8388648…`) trong PDF thay vì author + trích đoạn.
- Fullname có trailing space (`"Huynh "`) do `CONCAT(firstname,' ',lastname)` khi lastname rỗng.

### RC5 — Scope UI hub-wide
- `channel_export_file_thread_list` liệt kê thread TOÀN hub (không lọc theo folder đang mở, media.parent_id) → mở export ở folder B vẫn thấy thread của D. Cùng gốc RC1: export chưa có khái niệm folder.

## Đề xuất cải thiện (thứ tự triển khai)

### P1 — Nhóm section theo folder (fix chính)
1. Proc mới hoặc sửa `channel_export_messages`: SELECT thêm `read_json_object(c.metadata,'_scope_nid') AS scope_nid`; vẫn trả phẳng, **JS nhóm** (giữ proc đơn giản, tránh GROUP BY JSON).
2. `_gatherSections` (+ bản clone trong `chat-export.js`): nhóm messages theo `scope_nid`; join tên folder qua proc nhẹ (`mfs_node_attr`/query media theo list nid — cần proc read-only `channel_export_folder_names(nids JSON)` trả `id,user_filename`).
3. Section đầu ra: `{type:'folder_chat', name:<folder path hoặc user_filename>, nid, messages}`; hub root đặt tên = workspace name + "(root)"; legacy message không có `_scope_nid` → section "General".
4. Sắp xếp section theo cây (A trước, rồi B, C, C/D) — dùng parent_id chain từ proc names ở bước 2.
5. File-thread section: gắn thêm `folder_nid`/`folder_name` (media.parent_id của file) để PDF in "D / file.pdf".

### P2 — Lọc/format root card
- Trong `_normalizeMessage`+`normalizeRow`: nếu `message_type==='file.thread'` (hoặc `metadata._file_thread_root`) → bỏ qua, HOẶC render thành event line "— started chat thread for <filename> —". Bỏ qua là đơn giản nhất (thread đã có section riêng).

### P3 — hub_name đúng
- `export_scope`/`export`: fallback chain đọc `yp.hub.name` khi giá trị hiện tại == hub_id (regex `^[0-9a-f]{16}$` và == id) — hoặc nhận `name` từ client như UI đang có. Sửa luôn `_exportBasename`.

### P4 — Count folder-scoped trong modal
- `channel_export_count` thêm param `_scope_nid` (NULL = toàn hub) để folder card hiện đúng số message của folder đang mở; UI truyền `nid` folder.

### P5 — Trau chuốt nội dung
- Render mention markup → `@label`; strip trailing space fullname (`TRIM(CONCAT_WS(' ',firstname,lastname))` trong proc); PDF `Reply to:` → resolve author + 40 ký tự đầu (lookup trong section đã gather, zero DB call).

## Files phải sửa

| Repo | File | Việc |
|---|---|---|
| schemas | `hub/procedures/channel/channel_export_messages.sql` | +`scope_nid` column, TRIM fullname |
| schemas | `hub/procedures/channel/channel_export_count.sql` | +param `_scope_nid` |
| schemas | mới `hub/procedures/channel/channel_export_folder_names.sql` | resolve nid→user_filename+parent_id |
| server-team | `service/private/channel.js` (`_gatherSections`, `_normalizeMessage`, `export_scope`, `export`) | nhóm folder, lọc root card, hub_name |
| server-team | `offline/media/chat-export.js` (clone gather) | đồng bộ y hệt (comment DRY INTENT L76–79) |
| server-team | `offline/media/chat-export-html.js` | render folder sections, reply_to resolve, mention |
| ui-team | `widget/chat-export/index.js` + `skeleton/index.js` | truyền `nid` folder cho export_scope/export; label section |

## Unresolved Questions
1. **Section per folder trong JSON**: đổi `type:'hub_chat'` → nhiều `folder_chat` là breaking change cho consumer JSON (nếu có tool ngoài đọc format cũ). Giữ thêm field `schema_version: 2`?
2. **Export tại folder con**: user mở export ở D thì xuất toàn hub (hiện tại) hay chỉ subtree D? Đề xuất: giữ toàn hub nhưng nhóm section; thêm option "This folder subtree only" sau.
3. Root card: bỏ hẳn hay render event line? (P2 đề xuất bỏ.)
4. `channel_export_file_thread_list` không lọc `m.status='active'` — file đã trash còn hiện trong scope list? Cần xác nhận hành vi mong muốn.
