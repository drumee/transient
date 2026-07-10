// service/private/payment.js
const { Entity } = require('@drumee/server-core');
const { stripeClient } = require('../lib/stripe');

class __private_payment extends Entity {
  // Lazy Stripe client. catalog()/subscription_status() are DB-only and MUST
  // work even when Stripe isn't configured yet (no stripe_skey in sys_conf).
  _stripe() {
    if (this.__stripe) return this.__stripe;
    this.__stripe = stripeClient(); // throws STRIPE_KEY_MISSING if unconfigured
    return this.__stripe;
  }

  // Priced catalog from yp.plan. Enriched with the live Stripe unit amount when
  // a price id + key exist, so the FE can display the authoritative price.
  // Returns ALL entity types (user plans + org/team + add-ons incl. pro_seat)
  // so every price the billing UI shows is catalog-driven, not hardcoded.
  async catalog() {
    const rows = (await this.yp.await_proc('payment_get_catalog', 'eur', '')) || [];
    const plans = Array.isArray(rows) ? rows : [rows];
    let stripe = null;
    try { stripe = this._stripe(); } catch (e) { stripe = null; }
    if (stripe) {
      for (const p of plans) {
        if (!p || !p.stripe_price_id) continue;
        try {
          const price = await stripe.prices.retrieve(p.stripe_price_id);
          p.amount = price.unit_amount;            // minor units (cents)
          p.currency = price.currency || p.currency;
        } catch (e) { /* leave amount unset on lookup failure */ }
      }
    }
    this.output.data({ plans });
  }

  // Hosted Checkout. entity_type 'user' (individual Free->Pro) or 'org' (team,
  // per-seat: Stripe quantity = seats, customer = the org the caller owns).
  async checkout() {
    let stripe;
    try { stripe = this._stripe(); }
    catch (e) { return this.output.data({ status: 'STRIPE_NOT_CONFIGURED' }); }
    const entity_type = this.input.use('entity_type', 'user');
    const period = this.input.need('period');           // 'month' | 'year'
    const seats = Math.max(1, ~~this.input.use('seats', 1));

    let plan, entity_id, email, name, existing_customer;
    if (entity_type === 'org') {
      plan = this.input.use('plan', 'team');
      const org = await this.yp.await_proc('payment_get_org', this.uid);
      if (!org || !org.id) return this.output.data({ status: 'NOT_ORG_OWNER' });
      entity_id = org.id; name = org.name; existing_customer = org.customer_id;
    } else {
      plan = this.input.use('plan', 'pro');
      entity_id = this.uid;
      const payer = await this.yp.await_proc('payment_get_payer', this.uid);
      email = payer && payer.email; name = payer && payer.fullname; existing_customer = payer && payer.customer_id;
    }

    const plan_row = await this.yp.await_proc('payment_get_plan', plan, period, 'eur');
    if (!plan_row || !plan_row.stripe_price_id) {
      return this.output.data({ status: 'NO_PRICE' });
    }
    // ensure a Stripe customer keyed by metadata.id = entity_id (idempotent)
    let customer_id = existing_customer;
    if (!customer_id) {
      const found = await stripe.customers.search({ query: `metadata['id']:'${entity_id}'` });
      customer_id = (found.data[0] && found.data[0].id) || null;
    }
    if (!customer_id) {
      const created = await stripe.customers.create({ email, name, metadata: { id: entity_id } });
      customer_id = created.id;
    }
    const quantity = entity_type === 'org' ? seats : 1;
    const line_items = [{ price: plan_row.stripe_price_id, quantity }];
    // C1 Pro per-seat: the plan includes quota.$.seat seats (Pro: 5); seats
    // beyond that are a recurring pro_seat add-on line (quantity = extra).
    if (entity_type !== 'org') {
      let included = 0;
      try { included = ~~JSON.parse(plan_row.quota || '{}').seat || 0; } catch (e) { included = 0; }
      const extra = seats - (included || 1);
      if (included > 0 && extra > 0) {
        const seat_addon = await this.yp.await_proc('payment_get_plan', 'pro_seat', period, 'eur');
        if (seat_addon && seat_addon.stripe_price_id) {
          line_items.push({ price: seat_addon.stripe_price_id, quantity: extra });
        }
      }
    }
    // Optional storage add-on (P4): a 2nd recurring line item for this period.
    const bundle = this.input.use('bundle', '');
    if (bundle) {
      const addon = await this.yp.await_proc('payment_get_plan', bundle, period, 'eur');
      if (addon && addon.stripe_price_id) line_items.push({ price: addon.stripe_price_id, quantity: 1 });
    }
    // Build the return URLs from homepath (host-derived, endpoint-aware).
    // servicepath() resolves the endpoint segment to 'undefined' on dev
    // endpoints (/-/undefined/svc/...), which broke the post-payment redirect.
    const svcbase = this.input.homepath().replace(/\/+$/, '') + '/svc/?service=';
    const success_url = `${svcbase}callback.check_out_success&session_id={CHECKOUT_SESSION_ID}`;
    const cancel_url = `${svcbase}callback.check_out_cancel`;
    const metadata = { entity_type, entity_id, plan, period };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer_id,
      line_items,
      subscription_data: { metadata },
      metadata,
      success_url,
      cancel_url,
    });
    this.output.data({ url: session.url, id: session.id });
  }

  // Subscription mirror row for the caller. The webhook keys org (team)
  // subscriptions by the ORGANISATION id, so when the personal row is empty
  // fall back to the org the caller owns — org owners see their team sub.
  async _subscription_row() {
    let row = await this.yp.await_proc('payment_get_subscription', this.uid);
    if (row && row.subscription_id) return row;
    const org = await this.yp.await_proc('payment_get_org', this.uid);
    if (org && org.id) {
      const orgRow = await this.yp.await_proc('payment_get_subscription', org.id);
      if (orgRow && orgRow.subscription_id) {
        orgRow.entity_type = 'org';
        orgRow.org_name = org.name;
        return orgRow;
      }
    }
    return row || {};
  }

  async subscription_status() {
    this.output.data(await this._subscription_row());
  }

  // Stripe Billing Portal: one hosted surface for invoice history, cancel/resume,
  // card update + proration. Requires a Stripe customer (set by the webhook mirror).
  async portal() {
    let stripe;
    try { stripe = this._stripe(); }
    catch (e) { return this.output.data({ status: 'STRIPE_NOT_CONFIGURED' }); }
    const sub = await this._subscription_row();
    const customer_id = sub && sub.customer_id;
    if (!customer_id) return this.output.data({ status: 'NO_CUSTOMER' });
    const session = await stripe.billingPortal.sessions.create({
      customer: customer_id,
      return_url: this.input.homepath() + '#/desk/',
    });
    this.output.data({ url: session.url });
  }

  // Post-Checkout receipt details for the success/failure modal: total paid,
  // invoice number, payment date and card brand/last4, straight from the
  // Checkout Session the browser was redirected back with.
  async checkout_result() {
    let stripe;
    try { stripe = this._stripe(); }
    catch (e) { return this.output.data({ status: 'STRIPE_NOT_CONFIGURED' }); }
    const session_id = this.input.need('session_id');
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ['invoice', 'subscription'],
      });
    } catch (e) {
      return this.output.data({ status: 'SESSION_NOT_FOUND' });
    }
    // The session must belong to the caller (their personal or org customer).
    const sub = await this._subscription_row();
    const md = session.metadata || {};
    const owns = (md.entity_id === this.uid) || (sub && sub.customer_id && sub.customer_id === session.customer);
    if (!owns) {
      const org = await this.yp.await_proc('payment_get_org', this.uid);
      if (!(org && org.id && md.entity_id === org.id)) {
        return this.output.data({ status: 'SESSION_NOT_FOUND' });
      }
    }
    const inv = (session.invoice && typeof session.invoice === 'object') ? session.invoice : null;
    let card_brand = null, card_last4 = null;
    try {
      const piId = inv && (typeof inv.payment_intent === 'string' ? inv.payment_intent : inv.payment_intent && inv.payment_intent.id);
      if (piId) {
        const pi = await stripe.paymentIntents.retrieve(piId, { expand: ['payment_method'] });
        const pm = pi && pi.payment_method;
        if (pm && pm.card) { card_brand = pm.card.brand; card_last4 = pm.card.last4; }
      }
    } catch (e) { /* card details are cosmetic — leave unset */ }
    this.output.data({
      status: session.status,                          // complete | open | expired
      payment_status: session.payment_status,          // paid | unpaid | no_payment_required
      plan: md.plan || null,
      period: md.period || null,
      entity_type: md.entity_type || 'user',
      amount_total: session.amount_total,              // minor units
      currency: session.currency,
      invoice_number: inv && inv.number,
      paid_at: (inv && inv.status_transitions && inv.status_transitions.paid_at) || session.created,
      card_brand,
      card_last4,
    });
  }
}

module.exports = __private_payment;
