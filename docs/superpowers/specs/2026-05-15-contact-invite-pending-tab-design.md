# Contact Invite — Pending Tab Visibility Fix

**Date:** 2026-05-15
**Status:** Approved
**Repos affected:** `schemas`, `server-team`

## Problem

When User A sends a contact request to User B via "Add contacts", the request
does not appear in User B's Pending tab — not on a live update, and not even
after User B reopens the Contacts panel or clicks the Pending tab manually.

## Reproduction (verified live on drumee.in)

1. Signed in as Snake MX (`vudangnt@gmail.com`), sent a contact invite to
   `tranhoanghuan071003@gmail.com`. Server returned `status: "sent"` — success
   on the sender side.
2. Signed in as Tran (receiver), opened Contacts → Pending tab. The tab showed
   only invitations Tran had *sent*; Snake's incoming request was absent.
3. Called `contact.invite_get` directly (POST) → `data: []` (empty).
4. Called `activity.list` directly → **returned Snake's row** with
   `status: "received"`, `drumate_id: "181ffe62181ffe67"`,
   `email: "vudangnt@gmail.com"`.

The contact row IS created on the receiver's database with `status='received'`.
The activity feed's `notification_center_next` procedure returns it. The Pending
tab's `contact_notification_get` procedure does not.

## Root cause

Two independent bugs:

### Bug 1 — `contact_notification_get` returns nothing

`contact.invite_get` ([server-team/service/private/contact.js:1563](../../service/private/contact.js))
calls the `contact_notification_get` stored procedure. That procedure uses:

```sql
FROM contact ci
INNER JOIN yp.drumate d ON d.id = ci.entity
WHERE (ci.status="received") OR (ci.status="informed") OR (ci.status="invitation");
```

`notification_center_next` (which provably returns the same row for the
activity feed) uses the equivalent join plus an `ci.dismissed_at IS NULL`
filter. The Pending tab procedure returns empty in production despite the row
existing. The `INNER JOIN` on `d.id = ci.entity` is the fragile point: if a
row's `entity` column holds the inviter's **email** rather than their
drumate id (which happens when a prior "memory"-status row is upgraded in
`contact_invite_post`), the join silently drops the row.

### Bug 2 — WS broadcast to the receiver omits the service name

After the contact row is created, the server broadcasts a WebSocket
notification to the receiver's sockets at
[server-team/service/private/contact.js:1293](../../service/private/contact.js):

```js
await RedisStore.sendData(this.payload(data), sockets);
```

`this.payload(data)` is called with no `{ service }` option. The receiver's
address-book widget (`onWsMessage`) only refreshes the Pending list when the
incoming message's `service` equals `SERVICE.contact.invite`. Without an
explicit service name the message is ignored, so the Pending tab does not
auto-refresh. The correct pattern is already used elsewhere in the same file —
e.g. `invite_accept` at line 1532 passes `{ service: this.input.get(Attr.service) }`.

## Fix

### Fix 1 — `schemas/drumate/procedures/contact/contact_notification_get.sql`

Rewrite the procedure to be resilient to email-vs-id `entity` values and to
align dismissal semantics with the activity feed:

```sql
DELIMITER $

DROP PROCEDURE IF EXISTS `contact_notification_get`$
CREATE PROCEDURE `contact_notification_get`()
BEGIN
  SELECT
    COALESCE(d.id, dm.id) AS drumate_id,
    COALESCE(d.email, dm.email, ci.entity) AS email,
    IFNULL(ci.firstname, '') AS firstname,
    IFNULL(ci.lastname, '') AS lastname,
    ci.message AS message,
    ci.status AS status,
    CASE WHEN JSON_VALUE(ci.metadata, '$.is_auto') = 1
         THEN COALESCE(d.fullname, dm.fullname)
         ELSE RTRIM(LTRIM(CONCAT(IFNULL(ci.firstname, ''), ' ', IFNULL(ci.lastname, ''))))
    END AS fullname
  FROM contact ci
  LEFT JOIN yp.drumate d  ON d.id = ci.entity
  LEFT JOIN yp.drumate dm ON dm.email = ci.entity
  WHERE ci.status IN ('received', 'informed', 'invitation')
    AND ci.dismissed_at IS NULL
    AND COALESCE(d.id, dm.id) IS NOT NULL;
END$

DELIMITER ;
```

Changes from the existing procedure:
- `INNER JOIN yp.drumate d ON d.id = ci.entity` becomes two `LEFT JOIN`s — one
  on drumate id, one on email — so a row whose `entity` is an email still
  surfaces. `COALESCE(d.id, dm.id)` picks whichever join matched.
- `WHERE … COALESCE(d.id, dm.id) IS NOT NULL` keeps the "must resolve to a real
  drumate" guarantee the old `INNER JOIN` provided.
- Adds `ci.dismissed_at IS NULL` so a request the receiver already dismissed
  does not reappear — matches `notification_center.sql:41`.
- `metadata` is explicitly qualified as `ci.metadata`.
- The `DROP PROCEDURE … CREATE PROCEDURE` redeploy clears any stale cached plan.

### Fix 2 — `server-team/service/private/contact.js:1293`

Attach the request's service name to the broadcast payload:

```js
const service = this.input.get(Attr.service);   // "contact.invite"
await RedisStore.sendData(this.payload(data, { service }), sockets);
```

`this.input.get(Attr.service)` resolves to `contact.invite`, which is exactly
the value the receiver's `onWsMessage` switch matches against
(`SERVICE.contact.invite`).

## Data flow after the fix

1. Sender → `contact.invite` → server runs `contact_invite` → row inserted on
   the receiver's database with `status='received'`.
2. Server detects `after.status === 'received'`, broadcasts to the receiver's
   sockets **with `service: 'contact.invite'`**.
3. Receiver's address-book `onWsMessage` matches `SERVICE.contact.invite` →
   calls `_loadInvitations()` → `contact.invite_get` → `contact_notification_get`
   now returns the row → Pending tab updates live.
4. If the WS is missed (cold cache, disconnected client), the receiver clicking
   the Pending tab also calls `_loadInvitations()` and now sees the row.

## Testing

Manual verification on drumee.in after both fixes deploy:

1. Sign in as Snake, send an invite to Tran's email.
2. Sign in as Tran in a separate browser context → open Contacts → Pending tab
   shows Snake's request.
3. Repeat with Tran's Contacts panel already open during step 1 — the Pending
   count updates without a manual refresh.

## Out of scope

- No frontend (`ui-team`) changes. The address-book widget already re-fetches
  on tab click, panel mount, and the `SERVICE.contact.invite` WS event.
- No production data backfill. Receivers who already have rows the old
  procedure ignored will see those requests surface once the new procedure
  deploys — this is intended.
