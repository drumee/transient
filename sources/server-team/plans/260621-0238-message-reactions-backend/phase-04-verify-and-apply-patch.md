---
phase: 4
title: "Verify And Apply Patch"
status: pending
effort: "S"
---

# Phase 4: Verify And Apply Patch

## Overview
Verify end-to-end BE + áp patch lên dev; không regression post/seen/typing/delete.

## Requirements
- SP tồn tại + endpoint chạy; `_seen_` giữ; broadcast OK; server restart sạch; SERVICE expose.

## Related Code Files
- `server-team/patches/*.sql` (áp), `service/private/channel.js`, `service/private/chat.js`, `acl/channel.json`, `acl/chat.json`.

## Implementation Steps
> Chạy trên remote dev/stage server (máy local không có DB/mysql/bin). File .sql sync theo server-team (`npm run dev`). Endpoint code + ACL cũng cần server restart để nạp.
0. **PRE-VERIFY bảng P2P** (drumate): `SHOW CREATE TABLE p2p_channel\G` + `SHOW CREATE PROCEDURE p2p_get_message\G` trên 1 DB drumate (`9_*`) → xác nhận bảng `p2p_channel` có cột `message_id` + `metadata` (JSON). Nếu P2P thực sự nằm ở bảng `channel` → sửa 3 tên bảng trong `patches/p2p-message-reaction-toggle.sql` trước khi áp. (Giả định `p2p_channel` từ comment `chat.js:59` + fallback `p2p_get_message` — chưa verify được local.)
1. Áp patch **dev + stage** (KHÔNG prod — bin/patch hit MỌI instance của class): `bin/patch-from-file patches/message-reaction-toggle.sql hub` + `bin/patch-from-file patches/p2p-message-reaction-toggle.sql drumate`; confirm `SHOW PROCEDURE STATUS WHERE Name LIKE '%reaction_toggle%'` có cả 2.
1b. **DB spot-check** (1 hub DB, kiểm 1-react/user):
    - `CALL message_reaction_toggle('<msg>','<uid>','👍');` → có 👍:[uid]
    - `CALL message_reaction_toggle('<msg>','<uid>','❤️');` → **THAY THẾ**: 👍 mất, ❤️:[uid] (1 react/user)
    - `CALL message_reaction_toggle('<msg>','<uid>','❤️');` → gỡ (toggle off) → rỗng
    - `SELECT JSON_EXTRACT(metadata,'$._reactions_'), JSON_EXTRACT(metadata,'$._seen_') FROM channel WHERE message_id='<msg>';` → `_seen_` còn nguyên.
2. Restart server (watcher `npm run dev` / PM2 `aaron/service`) sạch; kiểm `/tmp/server-team-dev.log` không lỗi.
3. Manual channel: react add/remove + multi-emoji + `_seen_` intact + broadcast tới client thứ 2.
4. Manual DM: react hiện cả 2 peer + real-time.
5. Confirm `SERVICE.channel.react` + `SERVICE.chat.react` trong env (curl `yp.get_env` hoặc FE console).
6. Edge: xoá message đã react → reaction biến mất; react message không tồn tại → lỗi gracefully (không crash).

## Success Criteria
- [ ] **Load-path trả `metadata`**: `channel.messages`/`channel_get`/`p2p_get_message` có cột `metadata` trong projection → `_reactions_` load kèm message khi mở chat (nếu thiếu, reactions chỉ hiện realtime; phải sửa list SP ở schemas repo — ngoài scope repo này). [code-review MEDIUM]
- [ ] 2 SP áp thành công trên dev.
- [ ] Server restart không lỗi.
- [ ] channel + DM react/unreact + real-time OK.
- [ ] `_seen_` + post + typing + delete không regression.
- [ ] SERVICE.*.react có trong env.

## Risk Assessment
- `bin/patch` áp mọi instance hub/drumate trên server → chỉ dev/stage, KHÔNG prod.
- Lỗi permission thư mục stage (`offline/drumate/` — sự cố rsync trước) không liên quan; bỏ qua.
