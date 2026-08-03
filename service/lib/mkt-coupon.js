// Shared constants for MKT outreach coupons.
//
// These are consumed by BOTH service/private/payment.js (preview + the
// Stripe Checkout reserve) and service/private/promo.js (direct redeem).
// They live here rather than in either file because the two must agree:
// mkt_coupon_reserve RELEASES holds older than the TTL while
// mkt_coupon_validate/redeem IGNORE them, so if the callers passed
// different windows, Apply and Proceed would disagree about whether a code
// is already spent — the exact bug this constant was extracted to prevent.

// How long an unpaid coupon hold survives before it counts as abandoned.
const COUPON_HOLD_TTL_SEC = 86400;

module.exports = { COUPON_HOLD_TTL_SEC };
