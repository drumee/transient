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
  async catalog() {
    const rows = (await this.yp.await_proc('payment_get_catalog', 'eur', 'user')) || [];
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
    const success_url = this.input.servicepath({ service: 'callback.check_out_success' }) + '&session_id={CHECKOUT_SESSION_ID}';
    const cancel_url = this.input.servicepath({ service: 'callback.check_out_cancel' });
    const metadata = { entity_type, entity_id, plan, period };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer_id,
      line_items: [{ price: plan_row.stripe_price_id, quantity }],
      subscription_data: { metadata },
      metadata,
      success_url,
      cancel_url,
    });
    this.output.data({ url: session.url, id: session.id });
  }

  async subscription_status() {
    const row = await this.yp.await_proc('payment_get_subscription', this.uid);
    this.output.data(row || {});
  }

  // Stripe Billing Portal: one hosted surface for invoice history, cancel/resume,
  // card update + proration. Requires a Stripe customer (set by the webhook mirror).
  async portal() {
    let stripe;
    try { stripe = this._stripe(); }
    catch (e) { return this.output.data({ status: 'STRIPE_NOT_CONFIGURED' }); }
    const sub = await this.yp.await_proc('payment_get_subscription', this.uid);
    const customer_id = sub && sub.customer_id;
    if (!customer_id) return this.output.data({ status: 'NO_CUSTOMER' });
    const session = await stripe.billingPortal.sessions.create({
      customer: customer_id,
      return_url: this.input.homepath() + '#/desk/',
    });
    this.output.data({ url: session.url });
  }
}

module.exports = __private_payment;
