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

  // Individual Free->Pro hosted Checkout (P1). entity = this.uid.
  async checkout() {
    let stripe;
    try { stripe = this._stripe(); }
    catch (e) { return this.output.data({ status: 'STRIPE_NOT_CONFIGURED' }); }
    const plan = this.input.use('plan', 'pro');
    const period = this.input.need('period');           // 'month' | 'year'
    const seats = this.input.use('seats', 1);
    const plan_row = await this.yp.await_proc('payment_get_plan', plan, period, 'eur');
    if (!plan_row || !plan_row.stripe_price_id) {
      return this.output.data({ status: 'NO_PRICE' });
    }
    const payer = await this.yp.await_proc('payment_get_payer', this.uid);
    // ensure a Stripe customer keyed by metadata.id = uid (idempotent across checkouts)
    let customer_id = payer && payer.customer_id;
    if (!customer_id) {
      const found = await stripe.customers.search({ query: `metadata['id']:'${this.uid}'` });
      customer_id = (found.data[0] && found.data[0].id) || null;
    }
    if (!customer_id) {
      const created = await stripe.customers.create({
        email: payer && payer.email, name: payer && payer.fullname, metadata: { id: this.uid },
      });
      customer_id = created.id;
    }
    const success_url = this.input.servicepath({ service: 'callback.check_out_success' }) + '&session_id={CHECKOUT_SESSION_ID}';
    const cancel_url = this.input.servicepath({ service: 'callback.check_out_cancel' });
    const metadata = { entity_type: 'user', entity_id: this.uid, plan, period };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer_id,
      line_items: [{ price: plan_row.stripe_price_id, quantity: seats }],
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

  // P2 stub so the route/ACL exist now (Stripe Billing Portal lands in Phase 2).
  async portal() {
    this.output.data({ status: 'NOT_IMPLEMENTED' });
  }
}

module.exports = __private_payment;
