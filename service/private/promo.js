// service/private/promo.js
//
// LAUNCH30 — "Start your 1-month Team Plan today". Design doc 2026-07-30:
// claimed with NO credit card and NO Stripe object whatsoever (no customer,
// no payment method, no subscription) — a raw yp.quota entitlement, separate
// from the Stripe-backed subscription system in payment.js/stripe_webhook.js.
//
// Eligibility is re-checked here on every call — the client's job is to
// render state and call claim, never to decide it (same rule as the promo
// design doc's API contract).
const { Entity } = require('@drumee/server-core');
const { isEmpty } = require('@drumee/server-essentials');

const TRIAL_DAYS = 30;

// Founder decision 2026-07-31: 30 days from launch, no cap extension.
// A fixed constant, not a stored setting — the design doc explicitly calls
// this out as a one-time business/budget call (D3), not something to make
// configurable. Noon UTC, not end-of-day: the FE formats this with the
// browser's LOCAL timezone (Dayjs has no UTC plugin loaded here) and a
// 23:59:59 UTC cutoff rolled over to "Aug 31" for any viewer east of UTC —
// noon keeps the displayed calendar date correct across every real-world
// timezone (UTC-11..+13), at the cost of a few hours of claim generosity.
const CAMPAIGN_ENDS_AT = 1788091200; // 2026-08-30T12:00:00Z

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// Product decision 2026-07-31 (D1): SEEDED position, not real inventory.
// "You're #67 to claim this offer" — stable per account, social proof
// without an invented "N spots left" claim (the doc's own D1 discussion
// flags a fabricated counter as a deceptive-practice risk under the EU UCP
// Directive for a brand sold on trust). Stable across reloads: seeded from
// uid, never random per render — a number that changes on refresh destroys
// the offer's credibility (doc's own edge-case table). Range 50-99, same
// shape as the design's own crc32(user_id)-based formula.
function seededPosition(uid) {
  let hash = 0;
  const s = String(uid || '');
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return 50 + (hash % 50);
}

class __private_promo extends Entity {
  // The caller's own LAUNCH30 state. Called on app boot (home) and on
  // Billing page mount — read-only, computes eligibility fresh every time
  // rather than trusting a cached client flag.
  async get_state() {
    const row = await this._row();
    if (row && row.status === 'claimed') {
      const expired = ~~row.trial_ends_at > 0 && ~~row.trial_ends_at < Math.floor(Date.now() / 1000);
      return this.output.data({
        state: expired ? 'claimed_expired' : 'claimed_active',
        trial_ends_at: row.trial_ends_at,
        home_seen_at: row.home_seen_at,
        billing_seen_at: row.billing_seen_at,
      });
    }
    if (row && row.status === 'expired') {
      return this.output.data({
        state: 'claimed_expired',
        trial_ends_at: row.trial_ends_at,
        home_seen_at: row.home_seen_at,
        billing_seen_at: row.billing_seen_at,
      });
    }

    const eligible = await this._isEligible();
    const seen = !!(row && (row.home_seen_at || row.billing_seen_at));
    return this.output.data({
      state: eligible ? (seen ? 'eligible_seen' : 'eligible_unseen') : 'ineligible',
      home_seen_at: row && row.home_seen_at,
      billing_seen_at: row && row.billing_seen_at,
      position: eligible ? seededPosition(this.uid) : undefined,
      campaign_ends_at: eligible ? CAMPAIGN_ENDS_AT : undefined,
    });
  }

  // Records that `surface` ('home' | 'billing') has shown Modal A to this
  // account, once, forever (server flag — see promo_launch30_mark_seen).
  async dismiss() {
    const surface = String(this.input.use('surface', '') || '');
    if (surface !== 'home' && surface !== 'billing') {
      return this.output.status('SURFACE_INVALID');
    }
    await this.yp.await_proc('promo_launch30_mark_seen', this.uid, surface);
    this.output.json({ status: 'OK' });
  }

  // Claim: bootstrap (or reuse) the caller's organisation, then grant the
  // Team entitlement for TRIAL_DAYS with no Stripe object anywhere.
  // Idempotent — a retried call after a partial failure (org created, grant
  // not yet written) completes rather than double-provisions or double-grants.
  async claim() {
    if (!(await this._isEligible())) {
      return this.output.status('NOT_ELIGIBLE');
    }
    const existing = await this._row();
    if (existing && existing.status !== 'unclaimed') {
      // Already claimed/expired by a previous call — return that state
      // rather than erroring; the source_surface param is telemetry only.
      return this.output.json({ status: 'OK', already: 1, ...existing });
    }

    const org = await this._provisionOrg();
    if (!org || org.error) {
      return this.output.status(org && org.error ? org.error : 'PROVISION_FAILED');
    }

    const res = await this.yp.await_proc(
      'promo_launch30_grant', this.uid, org.id, org.domain_id,
    );
    const row = Array.isArray(res) ? res[0] : res;

    // Same event the Stripe webhook emits on a real plan change — the
    // billing widget's existing onWsMessage('payment.plan_updated') handler
    // already calls Visitor.respawn + re-renders, so the claimant's already-
    // open session reflects Team live, no reload (mirrors the admin-access
    // grant fix 2026-07-30 — every entitlement change needs this, not just
    // the ones that happen to route through the webhook).
    try {
      let quota = await this.yp.await_func('get_quota', this.uid);
      if (typeof quota === 'string') { try { quota = JSON.parse(quota); } catch (e) { quota = undefined; } }
      await this.notify_user(this.uid, {
        service: 'payment.plan_updated',
        plan: 'team',
        status: 'trialing',
        period_end: row && row.trial_ends_at,
        quota,
      });
    } catch (e) { /* best-effort */ }

    this.output.json({
      status: 'OK',
      org_id: org.id,
      domain_id: org.domain_id,
      trial_ends_at: row && row.trial_ends_at,
    });
  }

  async _row() {
    const res = await this.yp.await_proc('promo_launch30_get_state', this.uid);
    return Array.isArray(res) ? res[0] : res;
  }

  // plan=free (never bought/traded up before), not already living in
  // someone else's org domain (same guard payment.js's org-bootstrap ident
  // validation uses — _validateOrgIdent: "a payer already inside another
  // domain cannot bootstrap a second organisation"), and the campaign is
  // still live.
  async _isEligible() {
    if (Math.floor(Date.now() / 1000) > CAMPAIGN_ENDS_AT) return false;
    if (~~this.user.domain_id() > 1) return false;
    try {
      let q = await this.yp.await_func('get_quota', this.uid);
      if (typeof q === 'string') { try { q = JSON.parse(q); } catch (e) { q = null; } }
      const plan = q && (q.plan || q.category);
      return !plan || plan === 'free';
    } catch (e) {
      return false;
    }
  }

  // Auto-generates an org name/ident — the whole point of LAUNCH30 is one
  // click, no form. Retries the ident on collision (ident_exists covers
  // entity + organisation + vhost/domain — see org_provision's own guard —
  // a race there still surfaces as org.error and the caller can retry).
  async _provisionOrg() {
    const fullname = this.user.get('fullname') || '';
    const email = this.user.get('email') || '';
    const localPart = email.split('@')[0] || 'team';
    const base = slugify(localPart) || 'team';
    const name = fullname ? `${fullname}'s Team` : 'My Team';

    let ident = base;
    for (let attempt = 0; attempt < 5; attempt++) {
      const taken = await this.yp.await_proc('ident_exists', ident);
      const isTaken = Array.isArray(taken) ? taken.length > 0 : !isEmpty(taken);
      if (!isTaken) break;
      ident = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const res = await this.yp.await_proc('org_provision', this.uid, name, ident);
    return Array.isArray(res) ? res[0] : res;
  }
}

module.exports = __private_promo;
