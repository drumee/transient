---
phase: 2
title: "Channel React Endpoint"
status: pending
effort: "S"
---

# Phase 2: Channel React Endpoint
<!-- Updated: Validation Session 1 - permission write→read (khớp channel.acknowledge) -->

## Overview
Service `channel.react` (team chat + folder window): scope hub, permission **read** (khớp `channel.acknowledge`); toggle qua SP hub; broadcast `{message_id, reactions}` tới member.

## Requirements
- Functional: validate `message_id`+`emoji`; gọi SP; trả + broadcast `{message_id, reactions}`.
- Non-functional: chỉ member hub (ACL); loại self khỏi broadcast; emoji sanitize.

## Architecture
- Nhân `task.comment_react` (`task.js:490-503`) + broadcast kiểu `channel.js:1083` (`entity_sockets(hub_id)` trừ self → `RedisStore.sendData(this.payload(data,{service:"channel.react"}), recipients)`).

## Related Code Files
- Modify: `server-team/acl/channel.json` (+ `react`)
- Modify: `server-team/service/private/channel.js` (+ `react()`, bind trong constructor)
- Reference: `acl/task.json:454`, `service/private/task.js:490-503`, `channel.js` post/broadcast.

## Implementation Steps
1. `acl/channel.json`: thêm `"react": { scope:"hub", permission:{src:"read"}, params:{message_id:req, emoji:req, socket_id:req}, returns:{message_id, reactions} }`. (read = khớp `acknowledge`; bất kỳ member xem channel đều react được.)
2. `channel.js`: bind `this.react` trong ctor; `async react()`: `const message_id=this.input.need('message_id'); const emoji=this.input.need('emoji');` validate emoji (whitelist/length); `const reactions = await this.db.await_proc('message_reaction_toggle', message_id, this.uid, emoji);` build `data={message_id, reactions}`; broadcast tới `entity_sockets(hub_id)` trừ self qua `RedisStore.sendData(this.payload(data,{service:'channel.react'}), recipients)`; `this.output.data(data)`.
3. Confirm `SERVICE.channel.react` xuất hiện trong env FE đọc (`yp.get_env` merge) sau khi thêm ACL.

## Success Criteria
- [ ] React → list message thấy reaction; gọi lại → gỡ.
- [ ] Member khác nhận broadcast real-time (test 2 client).
- [ ] permission read enforce (anonymous bị từ chối; member chỉ-read react được — khớp acknowledge).
- [ ] Service cap distinct emoji/message (~50); reject emoji format lạ.
- [ ] `_seen_` không đổi.

## Risk Assessment
- `SERVICE.channel.react` chưa vào env tới khi reload → verify (phase 4).
- Emoji injection / metadata bloat → validate + (cân nhắc cap emoji distinct/message).
