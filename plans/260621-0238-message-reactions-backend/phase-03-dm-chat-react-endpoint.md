---
phase: 3
title: "DM Chat React Endpoint"
status: pending
effort: "M"
---

# Phase 3: DM Chat React Endpoint
<!-- Updated: Validation Session 1 - P2P single-write+forward_proc resolved; permission write (chat.post) -->

## Overview
Service `chat.react` cho inbox DM (P2P): scope hub, permission **write** (khớp `chat.post`); toggle qua SP drumate; thông báo peer real-time. P2P message lưu **1 row trong DB người gửi** (`drumate`).

## Requirements
- Functional: validate; toggle; trả `{message_id, reactions}`; push tới peer + self-sockets khác.
- Non-functional: reaction nhất quán cho cả 2 phía sau reload.

## Architecture
- Nhân `chat.js` post/acknowledge + notify-peer (`chat.js` user_sockets push).
- **P2P storage (RESOLVED, Validation S1)**: message lưu **1 row, single-write trong DB người gửi** (`acl/chat.json:582`). Khi caller react message **mình gửi** → row ở DB mình (`this.db`). Khi react message **peer gửi** → row ở DB peer → route cross-DB qua `forward_proc(peer_id, "p2p_message_reaction_toggle", ...)` — đúng pattern đọc P2P sẵn có (`chat.js:60-65`). KHÔNG dual-write.

## Related Code Files
- Modify: `server-team/acl/chat.json` (+ `react`)
- Modify: `server-team/service/private/chat.js` (+ `react()`)
- Reference: `chat.js:488` (notify peer), `chat.js:819` (p2p_list_messages), phase-02.

## Implementation Steps
1. `acl/chat.json`: thêm `react` { scope:"hub", permission:{src:"write"} (khớp `chat.post`), params: `message_id`, `emoji`, `entity_id`/peer_id, `socket_id` }.
2. `chat.js`: `async react()`: validate emoji (format + cap/message); thử `this.db.await_proc('p2p_message_reaction_toggle', message_id, this.uid, emoji)`; nếu rỗng (message do peer gửi) → cross-DB `this.yp.await_proc('forward_proc', peer_id, 'p2p_message_reaction_toggle', ...)` (pattern `chat.js:60-65`); broadcast tới peer sockets (`user_sockets(peer_id)`) + self-sockets khác qua `RedisStore.sendData(this.payload(data,{service:'chat.react'}))`; trả `{message_id, reactions}`.
3. SP `p2p_message_reaction_toggle` (drumate, phase 1) = single-row toggle (giống hub SP, không dual-write).

## Success Criteria
- [ ] React trong DM hiện cho CẢ 2 peer sau reload.
- [ ] Real-time: peer thấy ngay không reload.
- [ ] Toggle gỡ được ở cả 2 phía.
- [ ] `_seen_` P2P không đổi.

## Risk Assessment
- Cross-DB routing: react message peer-authored phải dùng `forward_proc` (row ở DB peer) — nếu chỉ gọi `this.db` sẽ không tìm thấy row. Mirror `chat.js:60-65`.
- Broadcast P2P khác channel: dùng `user_sockets(peer_id)` (không `entity_sockets`).
- permission write (chat.react) khác read (channel.react) — đúng ý đồ (P2P theo chat.post).
