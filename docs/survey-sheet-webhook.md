# PMF Survey → Google Sheet webhook

`service/private/survey.js submit()` broadcasts each survey response (one row
per user, upserted by UID) to the team's Google Sheet through a **Google Apps
Script Web App** bound to the sheet — no service-account share required.

Target sheet: <https://docs.google.com/spreadsheets/d/1_y0RZf2O3MzOwpMHjU9bpEeO-RL36KHM9SwUeL-16fQ/edit?gid=0>

## One-time setup (sheet owner)

1. Open the sheet → **Extensions → Apps Script**, delete the stub and paste
   the script below. Pick a secret and put the same value in step 3.
2. **Deploy → New deployment → Web app** — *Execute as:* **Me** · *Who has
   access:* **Anyone**. Authorize when prompted, copy the `…/exec` URL.
3. On the Drumee server create `/etc/drumee/credential/google/survey-webhook.json`:

   ```json
   { "url": "https://script.google.com/macros/s/DEPLOYMENT_ID/exec", "secret": "CHANGE_ME" }
   ```

4. Restart the endpoint service. Missing config = broadcast silently disabled
   (submit is never affected).

Re-deploying the script later? Use **Deploy → Manage deployments → Edit →
New version** so the URL stays stable.

## Apps Script (paste as-is, set SECRET)

```javascript
// PMF survey webhook — upserts one row per user (keyed by UID, column B).
// The Drumee server POSTs { secret, uid, header, row }.
const SECRET = 'CHANGE_ME';
const SHEET_NAME = 'Sheet1'; // tab name of gid=0

function doPost(e) {
  const out = (o) => ContentService
    .createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return out({ ok: false, error: 'bad json' });
  }
  if (!body || body.secret !== SECRET) return out({ ok: false, error: 'forbidden' });
  if (!body.uid || !Array.isArray(body.row)) return out({ ok: false, error: 'bad payload' });

  // Serialize concurrent posts — appendRow/setValues race otherwise.
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
      || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    // Ensure the header row.
    if (sheet.getLastRow() === 0 && Array.isArray(body.header)) {
      sheet.appendRow(body.header);
      sheet.getRange(1, 1, 1, body.header.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // Upsert by UID (column B).
    const last = sheet.getLastRow();
    let target = 0;
    if (last > 1) {
      const uids = sheet.getRange(2, 2, last - 1, 1).getValues();
      for (let i = 0; i < uids.length; i++) {
        if (String(uids[i][0]) === String(body.uid)) { target = i + 2; break; }
      }
    }
    if (target) {
      sheet.getRange(target, 1, 1, body.row.length).setValues([body.row]);
    } else {
      sheet.appendRow(body.row);
    }
    return out({ ok: true, updated: !!target });
  } finally {
    lock.releaseLock();
  }
}
```

## Payload contract

```json
{
  "secret": "…",
  "uid": "8200714b8200715f",
  "header": ["Timestamp", "UID", "Email", "Score", "Q1 Clarity", "…"],
  "row": ["2026-07-02T16:00:00.000Z", "8200714b8200715f", "user@x.y", 4, "…"]
}
```

19 columns (A–S): Timestamp · UID · Email · Score · Q1 · Q2 · Q2 Follow-up ·
Q3 · Q4 (Sean Ellis) · Q5 · Q6 · Q7 · Q8 · QB1 · QB1 Other · QB2 · QB3 ·
QB4 · QB5. Choice answers arrive as the verbatim English labels from
`Drumee_PMF_Program.md` (mapping lives in `service/lib/survey_sheet.js`);
Q7 multi-select is joined with `"; "`. A score-only submit produces a row
with empty answer columns; the later full submit updates the same row.
