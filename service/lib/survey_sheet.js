// service/lib/survey_sheet.js
//
// Broadcast a PMF survey response to the team's Google Sheet through a
// Google Apps Script Web-App webhook bound to the sheet (no service-account
// share needed). The Apps Script (see docs/survey-sheet-webhook.md) upserts
// one row per user, keyed by UID.
//
// Config: /etc/drumee/credential/google/survey-webhook.json
//   { "url": "https://script.google.com/macros/s/…/exec", "secret": "…" }
// Absent/malformed config → pushSurveyRow() is a warn-once no-op, so the
// feature degrades silently and never affects survey.submit.

const { resolve } = require('path');
const { readFileSync } = require('jsonfile');
const { sysEnv } = require('@drumee/server-essentials');
const axios = require('axios');

// English option labels, verbatim from Drumee_PMF_Program.md — the sheet is
// the team's analysis surface, so indexes are resolved to readable text here.
const LABELS = {
  q2: [
    "Yes — it clicked clearly",
    "Somewhat — I saw the potential but wasn't fully convinced",
    "No — I'm still not sure what makes it different",
  ],
  q4: [
    'Very Disappointed — it would genuinely hurt my workflow',
    "Somewhat Disappointed — I'd miss it but could manage",
    'Not Disappointed — I can easily find an alternative',
  ],
  q7: [
    'I plan to keep using it regularly',
    "I've already recommended it to someone",
    'I want to self-host it on my own server',
    'I would pay for a pro/team plan',
    "I'm still evaluating — not committed yet",
    "I don't see myself using it going forward",
  ],
  qb1: [
    'Agency (design, marketing, creative, dev agency)',
    'Tech Team / Software Company',
    'Healthcare / Medical',
    'Legal / Compliance',
    'Freelancer / Independent',
    'Other (please specify)',
  ],
  qb2: [
    'Team file management + collaboration',
    'Client project workspace',
    'Internal knowledge base',
    'Secure data storage (compliance/sovereignty)',
    'Developer workflow / infrastructure',
    'Other',
  ],
  qb3: ['Just me (solo)', '2–5 people', '6–20 people', '21–50 people', '50+ people'],
};

const HEADER = [
  'Timestamp', 'UID', 'Email', 'Score',
  'Q1 Clarity', 'Q2 Activation', 'Q2 Follow-up', 'Q3 Need',
  'Q4 Sean Ellis', 'Q5 Value Best', 'Q6 Value Weakest', 'Q7 Retention Intent',
  'Q8 Wishlist', 'QB1 Segment', 'QB1 Other', 'QB2 Use Case',
  'QB3 Team Size', 'QB4 Alternative', 'QB5 Biggest Benefit',
];

let _cfg;
let _warned = false;

function config() {
  if (_cfg !== undefined) return _cfg;
  const { credential_dir } = sysEnv();
  try {
    const c = readFileSync(resolve(credential_dir, 'google/survey-webhook.json'));
    _cfg = c && c.url ? { url: c.url, secret: c.secret || '' } : null;
  } catch (e) {
    _cfg = null;
  }
  return _cfg;
}

const pick = (arr, idx) =>
  Number.isInteger(idx) && arr[idx] !== undefined ? arr[idx] : '';

/**
 * Build the sheet row from a survey_response payload.
 * @param {object} p { uid, email, score, answers } — answers = parsed JSON
 *                   object from the wizard ({ q1.., q2: idx, q7: [idx..] })
 *                   or null for a score-only submit.
 */
function buildRow(p) {
  const a = p.answers || {};
  return [
    new Date().toISOString(),
    p.uid,
    p.email || '',
    p.score || 0,
    a.q1 || '',
    pick(LABELS.q2, a.q2),
    a.q2_follow || '',
    a.q3 || '',
    pick(LABELS.q4, a.q4),
    a.q5 || '',
    a.q6 || '',
    Array.isArray(a.q7) ? a.q7.map((i) => pick(LABELS.q7, i)).filter(Boolean).join('; ') : '',
    a.q8 || '',
    pick(LABELS.qb1, a.qb1),
    a.qb1_follow || '',
    pick(LABELS.qb2, a.qb2),
    pick(LABELS.qb3, a.qb3),
    a.qb4 || '',
    a.qb5 || '',
  ];
}

/**
 * Best-effort broadcast — resolves true/false, NEVER throws. Callers fire and
 * forget; a sheet outage must not fail or slow down survey.submit.
 */
async function pushSurveyRow(payload) {
  const cfg = config();
  if (!cfg) {
    if (!_warned) {
      _warned = true;
      console.warn('[survey_sheet] google/survey-webhook.json absent — sheet broadcast disabled');
    }
    return false;
  }
  try {
    const res = await axios.post(cfg.url, {
      secret: cfg.secret,
      uid: payload.uid,
      header: HEADER,
      row: buildRow(payload),
    }, {
      timeout: 10000,
      // Apps Script replies through a 302 to script.googleusercontent.com.
      maxRedirects: 5,
      headers: { 'Content-Type': 'application/json' },
    });
    const ok = res && res.data && res.data.ok;
    if (!ok) console.warn('[survey_sheet] webhook replied not-ok:', res && res.data);
    return !!ok;
  } catch (e) {
    console.warn('[survey_sheet] webhook push failed:', e && e.message);
    return false;
  }
}

module.exports = { pushSurveyRow };
