---
phase: 1
title: "DB Reaction Toggle SP"
status: pending
effort: "M"
---

# Phase 1: DB Reaction Toggle SP

## Overview
SP toggle per-user emoji nguyên tử trong `messages.metadata._reactions_`, **giữ nguyên `_seen_`**. 2 DB class: `hub` (channel message), `drumate` (P2P message).

## Requirements
- Functional: **1 react/user/message** (cập nhật 2026-06-21) — pick emoji mới → gỡ uid khỏi MỌI emoji rồi thêm vào emoji chọn (replace); pick lại chính emoji đang giữ → gỡ (toggle off); chuẩn hoá luôn legacy multi; mảng rỗng → bỏ key; trả `_reactions_` map + cờ `capped`.
- Non-functional: nguyên tử dưới đồng thời (transaction + row lock); idempotent (`DROP IF EXISTS` trước `CREATE`); không đụng `_seen_` hay key metadata khác.

## Architecture
- Storage: cột `metadata` (JSON) trên bảng message; `_reactions_ = {"👍":["u1","u2"]}`.
- SP `message_reaction_toggle(_message_id, _uid, _emoji)` (hub) + `p2p_message_reaction_toggle(...)` (drumate; có thể chung shape).
- Toggle: `SELECT metadata ... FOR UPDATE` → kiểm tra `_uid` trong `$._reactions_."<emoji>"` → `JSON_REMOVE`(theo path/idx; drop key nếu rỗng) hoặc init `[]` + `JSON_ARRAY_APPEND` → ghi lại bằng `JSON_SET(metadata,'$._reactions_', ...)` CHỈ subpath reactions.

## Related Code Files
- Create: `server-team/patches/message-reaction-toggle.sql` (hub class)
- Create: `server-team/patches/p2p-message-reaction-toggle.sql` (drumate class)
- Reference (introspect runtime): SP `channel_read_messages` (hub), SP P2P acknowledge (drumate) — để biết bảng + cột metadata + PK.

## Implementation Steps
1. **Introspect storage** (schemas repo không local): trên MariaDB dev chạy `SHOW CREATE PROCEDURE channel_read_messages` (hub) + SP P2P acknowledge (drumate) → lấy chính xác tên bảng message, cột metadata, cột PK (message_id). Ghi lại.
2. Viết SP hub `message_reaction_toggle`: transaction; `SELECT metadata FROM <msg_table> WHERE message_id=_message_id FOR UPDATE`; logic toggle (xem Architecture); `JSON_SET` subpath `$._reactions_`; `SELECT` trả `_reactions_` (hoặc JSON_OBJECTAGG emoji→count).
3. Viết SP drumate `p2p_message_reaction_toggle` tương tự (điều chỉnh bảng/đa-bản nếu P2P lưu khác — phối hợp phase 3).
4. Validate `_emoji` đầu SP (length cap ~16 byte; chặn rỗng) — defense-in-depth. **Service** validate 1-emoji format + **cap distinct emoji/message ~50** chặn bloat (Validation S1). P2P: SP single-row (không dual-write); caller route own-DB vs peer-DB qua `forward_proc` (phase 3).
5. Thêm 2 file vào `patches/`; áp dev: `bin/patch-from-file patches/message-reaction-toggle.sql hub` và `... p2p-message-reaction-toggle.sql drumate`.

## Success Criteria
- [ ] Toggle cùng uid+emoji 2 lần → add rồi remove (round-trip).
- [ ] Nhiều emoji/nhiều uid cùng tồn tại đúng.
- [ ] `_seen_` còn nguyên sau toggle.
- [ ] 2 session toggle đồng thời → không mất update (test tay).
- [ ] Trả `_reactions_` map (+ count).

## Risk Assessment
- Emoji-as-JSON-key multibyte → quote `'$._reactions_."👍"'`; nếu trục trặc, đổi shape `_reactions_:[{e,u[]}]`.
- Schemas repo vắng → introspect runtime (đã xử lý ở step 1).
- `bin/patch` áp mọi instance hub/drumate → chỉ dev/stage trước.
