---
title: "Message Reactions — Backend (channel + DM)"
description: "Emoji reactions on chat messages: metadata._reactions_ storage + toggle SP (hub & drumate) + channel.react/chat.react endpoints + real-time broadcast."
status: in-progress
priority: P2
branch: "aaron-boarding-new"
tags: [chat, reactions, websocket, mariadb]
blockedBy: []
blocks: []
created: "2026-06-20T19:43:19.323Z"
createdBy: "ck:plan"
source: skill
---

# Message Reactions — Backend (channel + DM)

## Overview

Backend foundation cho emoji reaction trên chat message. Lưu trong `messages.metadata._reactions_` (JSON `{emoji:[uid,...]}`) — lặp lại đúng cách read-receipt `_seen_` đang chạy, nên reaction về kèm message lúc load (KHÔNG sửa SP list ở repo schemas ngoài). Toggle qua 1 SP mới per DB class: **hub** (channel: team chat + folder window), **drumate** (P2P inbox DM). Endpoint `channel.react` + `chat.react` nhân theo tiền lệ `task.comment_react`; broadcast real-time tới member/peer.

Design doc nguồn: `../../ui-team/plans/reports/brainstorm-design-260621-0220-chat-message-reactions-report.md`

Tham chiếu tiền lệ: `service/private/task.js:490-503` (comment_react), `acl/task.json:454`, broadcast `channel.js:1083` (entity_sockets + RedisStore.sendData).

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [DB Reaction Toggle SP](./phase-01-db-reaction-toggle-sp.md) | Done (code, reviewed) |
| 2 | [Channel React Endpoint](./phase-02-channel-react-endpoint.md) | Done (code, reviewed) |
| 3 | [DM Chat React Endpoint](./phase-03-dm-chat-react-endpoint.md) | Done (code, reviewed) |
| 4 | [Verify And Apply Patch](./phase-04-verify-and-apply-patch.md) | Pending — gate (apply on stage) |

> Cook 2026-06-21: BE code (2 SP + channel.react/chat.react + ACL) viết xong, static code-review (DONE_WITH_CONCERNS) đã vá (JSON_SEARCH→loop, capped flag, emoji VARCHAR(64)), `node --check`+JSON valid. FE plan 5/5 phase code xong, build sạch. Chưa commit. Còn P4 = áp patch + restart + e2e trên remote stage.

## Dependencies

- **Blocks** (cross-repo, không ck-resolvable): ui-team plan `260621-0238-message-reactions-frontend`. FE phase 2+ cần `channel.react`/`chat.react` sống. Khi BE phase 2 xong → FE phase 2 unblock.

## Acceptance (whole plan)
- `channel.react` + `chat.react` toggle add/remove đúng; trả `{message_id, reactions}`.
- `_seen_` nguyên vẹn sau toggle (không clobber).
- Nhiều emoji/1 message; concurrent toggle không mất update.
- Broadcast real-time tới member khác / peer.
- Reaction về kèm message lúc load (không sửa SP list repo ngoài).
- Không vỡ post/acknowledge/typing/delete hiện có.

## Constraints
- Không raw SQL trong service code — qua stored procedure (CLAUDE.md). 1 routine/file.
- SP gốc ở schemas repo (`/home/somanos/...`, KHÔNG local) → tác giả SP bằng cách introspect runtime; áp qua `server-team/patches/` + `bin/patch-from-file`.
- `bin/patch-*` áp lên TẤT CẢ instance hub/drumate trên server → chỉ chạy dev/stage, KHÔNG prod.
- Conventional commits, không AI refs.

## Open questions (resolved in Validation Session 1)
1. ~~P2P 1-row vs 2-bản~~ → **RESOLVED**: single-write trong DB người gửi (`acl/chat.json:582`); react message do peer gửi route cross-DB qua `forward_proc` (`chat.js:60-65`). Phase 3 cập nhật.
2. Emoji JSON key (multibyte) → **DECIDED**: shape `_reactions_:{emoji:[uid]}`, emoji làm key (quote `'$._reactions_."👍"'`); fallback `[{e,u[]}]` nếu brittle. Phase 1.

## Validation Log

### Session 1 — 2026-06-21 (mode: prompt)
**Verification (Standard tier, 4 phases)** — claims ~12; Verified: `task.comment_react`(task.js:490)+`_broadcast`(task.js:53, task-local), channel inline broadcast `entity_sockets`+`RedisStore.sendData(this.payload)`(channel.js:137/1083), `channel.acknowledge`=read per-user-metadata precedent. **Failed: 1** → plan ghi `channel.react` permission=write; thực tế `channel.post`+`channel.acknowledge`=**read** → sửa thành read. **Resolved**: P2P single-write (acl/chat.json:582) + cross-DB `forward_proc` cho message peer-authored (chat.js:60-65).

**Decisions**:
- `channel.react` permission = **read** (khớp `channel.acknowledge`); `chat.react` = **write** (khớp `chat.post`).
- Emoji = **1 emoji hợp lệ bất kỳ** (validate format/length) + **cap distinct emoji/message (~50)** chặn metadata bloat; KHÔNG whitelist server (full picker cần tự do).
- Áp patch = **dev + stage** (KHÔNG prod).
- P2P: 1 SP tác động lên row ở DB của nó; service route own-DB vs peer-DB qua `forward_proc`.
- Shape `_reactions_:{emoji:[uid]}` (emoji = JSON key quoted); fallback `[{e,u[]}]`.

### Whole-Plan Consistency Sweep
Re-read plan.md + 4 phase sau propagate: permission read/write sửa ở phase-02/03; P2P single-write+forward_proc ở phase-03; emoji policy+cap ở phase-01; deploy dev+stage ở phase-04. Shape `_reactions_` khớp BE↔FE. SERVICE exposure (acl→`get_env` desk.js:205/`service/lib/env.js`) = verify lúc impl (phase 4). **Zero unresolved contradiction.**
