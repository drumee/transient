/**
 * Drive API error classification + retry-with-backoff for the migration worker.
 *
 * Used by importer.js to wrap the list/meta/download HTTP calls. Once file-level
 * concurrency raises the request rate on a 10k-file import, Drive starts
 * returning 429 / 403-rateLimit / 5xx; without retry those become PERMANENT
 * per-file failures (the importer's per-file catch records IMPORT_FAILED and the
 * job still resolves 'completed' with files silently missing). This layer turns
 * transient errors into a short backoff + retry instead.
 *
 * Invariant note: capMs (20s) stays below the Bull lockRenewTime (30s) so a
 * single backoff sleep can never starve the job-lock renewal.
 */

const RATE_REASONS = ['userRateLimitExceeded', 'rateLimitExceeded', 'dailyLimitExceeded', 'backendError'];
const NET_CODES = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN', 'EPIPE', 'ENOTFOUND', 'ERR_STREAM_PREMATURE_CLOSE'];

/**
 * @returns {'retryable'|'auth'|'fatal_grant'|'fatal'}
 *  - retryable   : 429 / 500 / 502 / 503 / 504 / rate-limited-403 / network blip
 *  - auth        : 401 → refresh the token once, then retry
 *  - fatal_grant : 403 (non-rate reason) or 404 → the drive.file grant gap;
 *                  maps to NOT_GRANTED upstream — do NOT retry
 *  - fatal       : everything else, incl. NEEDS_RECONNECT / SA errors that carry
 *                  no `.response` (→ propagate to run(), which job.discard()s)
 */
function classifyDriveError(e) {
  const status = e && e.response && e.response.status;
  const errs = (e && e.response && e.response.data && e.response.data.error && e.response.data.error.errors) || [];
  const reasons = errs.map((x) => x && x.reason);
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) return 'retryable';
  if (status === 403 && reasons.some((r) => RATE_REASONS.includes(r))) return 'retryable';
  if (e && NET_CODES.includes(e.code)) return 'retryable';
  if (status === 401) return 'auth';
  if (status === 403 || status === 404) return 'fatal_grant';
  return 'fatal';
}

/**
 * Run fn() with exponential backoff + full jitter on retryable Drive errors.
 *
 * @param {() => Promise<any>} fn
 * @param {object} opts
 * @param {() => Promise<any>} [opts.onAuth]      called ONCE on a 401 to force a
 *        token refresh (e.g. clear the cache); then fn is retried immediately.
 * @param {() => Promise<boolean>} [opts.isCancelled] polled before each sleep; a
 *        truthy result rethrows the last error at once so cancellation stays
 *        responsive and the importer's loop terminates.
 * @param {number} [opts.maxAttempts=5]
 * @param {number} [opts.baseMs=1000]
 * @param {number} [opts.capMs=20000]  per-sleep ceiling (< lockRenewTime).
 */
async function withDriveRetry(fn, opts = {}) {
  const { onAuth, isCancelled, maxAttempts = 5, baseMs = 1000, capMs = 20000 } = opts;
  let authRetried = false;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      // Cancellation outranks any retry — bail immediately, no backoff.
      if (isCancelled && (await isCancelled())) throw e;
      const cls = classifyDriveError(e);
      if (cls === 'auth' && onAuth && !authRetried) {
        authRetried = true;
        await onAuth();
        continue; // immediate retry with a fresh token (no backoff slot)
      }
      if (cls !== 'retryable') throw e;
      if (attempt >= maxAttempts) throw e;
      // Honor a Retry-After header if Drive sent one, else exponential.
      const retryAfter = Number(e && e.response && e.response.headers && e.response.headers['retry-after']);
      const ceiling = retryAfter > 0
        ? Math.min(retryAfter * 1000, capMs)
        : Math.min(capMs, baseMs * 2 ** (attempt - 1));
      const delay = Math.random() * ceiling; // full jitter
      if (isCancelled && (await isCancelled())) throw e;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

module.exports = { classifyDriveError, withDriveRetry };
