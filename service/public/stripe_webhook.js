// service/public/stripe_webhook.js
const { Entity } = require('@drumee/server-core');
const { stripeClient, endpointSecret } = require('../lib/stripe');

class __public_stripe_webhook extends Entity {
  // Classify subscription line items: the base plan item (quantity = seats) vs
  // storage add-on items (entity_type='addon' in yp.plan) — sum their disk *
  // quantity into extra_disk so the entitlement = base + add-ons (P4).
  async _itemsEntitlement(items) {
    let seats = 1, price = 0, extra_disk = 0;
    for (const it of (items || [])) {
      const pid = it && it.price && it.price.id;
      const ad = pid ? await this.yp.await_proc('payment_get_addon', pid) : null;
      if (ad && ad.disk) {
        extra_disk += Number(ad.disk) * (it.quantity || 1);
      } else {
        seats = it.quantity || 1;
        price = (it.price && it.price.unit_amount) || 0;
      }
    }
    return { seats, price, extra_disk };
  }

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
          if (entity_id) {
            // Mirror the live subscription for the status panel + Billing Portal.
            const customer_id = obj.customer || null;
            const subscription_id = obj.subscription || obj.id || null;
            const status = obj.status || 'active';
            const entity_type = md.entity_type || 'user';
            // Line items: the subscription object carries them; a checkout.session
            // does not, so retrieve the subscription to read base + add-ons.
            let items = (obj.items && obj.items.data) || null;
            let period_end = obj.current_period_end || (items && items[0] && items[0].current_period_end) || 0;
            if (!items && subscription_id) {
              try {
                const s = await stripe.subscriptions.retrieve(subscription_id);
                items = (s.items && s.items.data) || [];
                period_end = period_end || s.current_period_end || (items[0] && items[0].current_period_end) || 0;
              } catch (e3) { items = []; }
            }
            const { seats, price, extra_disk } = await this._itemsEntitlement(items);
            // 0, not null: await_proc maps null -> '' which a strict-mode INT param rejects.
            await this.yp.await_proc('subscription_update', entity_id, customer_id, subscription_id, plan, period, 1, price, 0, status);
            await this.yp.await_proc('payment_apply_entitlement', entity_id, plan, period_end, entity_type, seats, extra_disk);
            await this.notify_user(entity_id, { service: 'payment.plan_updated', plan, status: 'active' });
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const entity_id = md.entity_id;
          if (entity_id) {
            await this.yp.await_proc('subscription_remove', entity_id, obj.id || '');
            await this.yp.await_proc('payment_apply_entitlement', entity_id, 'free', 0, md.entity_type || 'user', 0, 0);
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
              const items = (sub && sub.items && sub.items.data) || [];
              const pend = (sub && sub.current_period_end) || (items[0] && items[0].current_period_end) || 0;
              const { seats, extra_disk } = await this._itemsEntitlement(items);
              await this.yp.await_proc('payment_apply_entitlement', eid, smd.plan || 'pro', pend, smd.entity_type || 'user', seats, extra_disk);
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
