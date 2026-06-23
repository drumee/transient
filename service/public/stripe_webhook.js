// service/public/stripe_webhook.js
const { Entity } = require('@drumee/server-core');
const { stripeClient, endpointSecret } = require('../lib/stripe');

class __public_stripe_webhook extends Entity {
  async receive() {
    let stripe, secret;
    try { stripe = stripeClient(); secret = endpointSecret(); }
    catch (e) { return this.exception.bad_request('_webhook_signature_invalid'); }
    if (!secret) return this.exception.bad_request('_webhook_signature_invalid');
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
          const period = md.period || 'month';
          const item = (obj.items && obj.items.data && obj.items.data[0]) || {};
          // 0, not null: await_proc maps null -> '' which a strict-mode INT param rejects.
          const period_end = obj.current_period_end || item.current_period_end || 0;
          if (entity_id) {
            // Mirror the live subscription (customer/sub id/status) for the status
            // panel + Billing Portal lookup. checkout.session carries obj.subscription
            // + obj.customer; subscription events carry obj.id + obj.status.
            const customer_id = obj.customer || null;
            const subscription_id = obj.subscription || obj.id || null;
            const status = obj.status || 'active';
            const price = (item.price && item.price.unit_amount) || 0;
            const entity_type = md.entity_type || 'user';
            const seats = (item.quantity != null ? item.quantity : (obj.quantity != null ? obj.quantity : 1));
            await this.yp.await_proc('subscription_update', entity_id, customer_id, subscription_id, plan, period, 1, price, 0, status);
            await this.yp.await_proc('payment_apply_entitlement', entity_id, plan, period_end, entity_type, seats);
            await this.notify_user(entity_id, { service: 'payment.plan_updated', plan, status: 'active' });
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const entity_id = md.entity_id;
          if (entity_id) {
            await this.yp.await_proc('subscription_remove', entity_id, obj.id || '');
            await this.yp.await_proc('payment_apply_entitlement', entity_id, 'free', 0, md.entity_type || 'user', 0);
            await this.notify_user(entity_id, { service: 'payment.plan_updated', plan: 'free', status: 'canceled' });
          }
          break;
        }
        case 'invoice.paid':
        case 'invoice.payment_failed': {
          // Invoices don't carry the subscription metadata directly — resolve it.
          const subId = obj.subscription
            || (obj.parent && obj.parent.subscription_details && obj.parent.subscription_details.subscription)
            || null;
          let sub = null;
          if (subId) { try { sub = await stripe.subscriptions.retrieve(subId); } catch (e2) {} }
          const smd = (sub && sub.metadata) || {};
          const eid = smd.entity_id;
          if (eid) {
            if (event.type === 'invoice.paid') {
              // Recurring renewal succeeded -> re-apply entitlement (bumps period_end).
              const sitem = sub && sub.items && sub.items.data && sub.items.data[0];
              const pend = (sub && sub.current_period_end) || (sitem && sitem.current_period_end) || 0;
              await this.yp.await_proc('payment_apply_entitlement', eid, smd.plan || 'pro', pend, smd.entity_type || 'user', (sitem && sitem.quantity) || 1);
              await this.notify_user(eid, { service: 'payment.plan_updated', plan: smd.plan, status: 'active' });
            } else {
              // Payment failed -> keep entitlement during Stripe's smart retries
              // (grace); final failure downgrades via customer.subscription.deleted.
              await this.notify_user(eid, { service: 'payment.payment_failed', plan: smd.plan, status: 'past_due' });
            }
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
