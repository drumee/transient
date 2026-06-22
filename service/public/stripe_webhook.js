// service/public/stripe_webhook.js
const { Entity } = require('@drumee/server-core');
const { stripeClient, endpointSecret } = require('../lib/stripe');

class __public_stripe_webhook extends Entity {
  async receive() {
    const stripe = stripeClient();
    const secret = endpointSecret();                 // NEVER console.log this
    const raw = this.input.rawString();              // STRING form — not this.input.raw() (an array)
    const sig = (this.input.headers() || {})['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(raw, sig, secret);
    } catch (err) {
      return this.exception.bad_request('_webhook_signature_invalid'); // HTTP 400, blocking
    }
    // Idempotency: UNIQUE(event_id). seen.duplicate==1 => already handled.
    const seen = await this.yp.await_proc('stripe_event_seen', event.id, event.type);
    if (seen && Number(seen.duplicate) === 1) {
      return this.output.data({ ok: 1, duplicate: 1 });
    }
    const obj = (event.data && event.data.object) || {};
    const md = obj.metadata || {};
    try {
      switch (event.type) {
        case 'checkout.session.completed':
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const entity_id = md.entity_id;
          const plan = md.plan || 'pro';
          const period_end = obj.current_period_end || null;
          if (entity_id) {
            await this.yp.await_proc('payment_apply_entitlement', entity_id, plan, period_end);
            await this.notify_user(entity_id, { service: 'payment.plan_updated', plan, status: 'active' });
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const entity_id = md.entity_id;
          if (entity_id) {
            await this.yp.await_proc('payment_apply_entitlement', entity_id, 'free', null);
            await this.notify_user(entity_id, { service: 'payment.plan_updated', plan: 'free', status: 'canceled' });
          }
          break;
        }
        default:
          break; // unhandled types are acknowledged (already deduped)
      }
    } catch (e) {
      this.error(`stripe reducer failed for ${event.id}: ${e.message}`); // message only, no secrets
    }
    await this.yp.await_proc('stripe_event_processed', event.id);
    this.output.data({ ok: 1 });
  }
}

module.exports = __public_stripe_webhook;
