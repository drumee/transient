/*
 * Minimal CommonJS service transport for independent LETC plugins.
 *
 * It selectively adapts ui-essentials/socket/{service,utils}.js: service
 * names remain logical `module.method` strings, responses retain Drumee's
 * `{ status, data }` envelope, and the browser remains the transport owner.
 * Session/Visitor headers, socket state and Team-specific error plumbing are
 * deliberately out of scope for the anonymous Phase 3 path.
 */

function serviceUrl(baseUrl, service) {
  if (typeof service !== "string" || !/^[^.]+\.[^.]+$/.test(service)) {
    throw new Error("A service must be a module.method string");
  }
  const base = String(baseUrl || "/-/svc/").replace(/\/?$/, "/");
  return `${base}${service}`;
}

function normalizePayload(service, payload) {
  if (typeof service === "string") return { service, payload: payload || {} };
  if (!service || typeof service !== "object") throw new Error("A service call is required");
  const { service: name, ...rest } = service;
  return { service: name, payload: { ...rest, ...(payload || {}) } };
}

function sessionAuthorizationHeaders(authorization) {
  if (!authorization) return {};
  const keysel = authorization.keysel || "regsid";
  const sid = authorization.sid || authorization.id || authorization.sessionId;
  if (keysel !== "regsid" || typeof sid !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(sid)) {
    throw new Error("Session authorization requires a valid regsid selector and value");
  }
  // Exact historical ui-essentials/socket/utils.js::makeHeaders wire shape.
  return {
    "x-param-keysel": keysel,
    [`x-param-${keysel}`]: sid
  };
}

class ServiceClient {
  constructor({ baseUrl = "/-/svc/", fetch: fetchImpl = globalThis.fetch, credentials, sessionAuthorization } = {}) {
    this.baseUrl = baseUrl;
    this.fetch = fetchImpl;
    this.credentials = credentials;
    this.sessionAuthorization = sessionAuthorization;
  }

  async request(method, service, payload) {
    const call = normalizePayload(service, payload);
    if (typeof this.fetch !== "function") throw new Error("Browser fetch is not configured");
    let url = serviceUrl(this.baseUrl, call.service);
    const options = {
      method,
      headers: {
        Accept: "application/json",
        ...sessionAuthorizationHeaders(this.sessionAuthorization)
      }
    };
    if (this.credentials) options.credentials = this.credentials;
    if (method === "GET") {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(call.payload)) {
        if (value != null) query.set(key, typeof value === "string" ? value : JSON.stringify(value));
      }
      const suffix = query.toString();
      if (suffix) url = `${url}?${suffix}`;
    } else {
      options.headers["content-type"] = "application/json";
      options.body = JSON.stringify(call.payload);
      options.cache = "no-cache";
    }
    const response = await this.fetch(url, options);
    let envelope;
    try {
      envelope = await response.json();
    } catch (_) {
      envelope = null;
    }
    if (!response.ok || !envelope || envelope.status !== "ok") {
      const error = new Error((envelope && envelope.code) || `Service ${call.service} failed`);
      error.code = (envelope && envelope.code) || "SERVICE_FAILED";
      error.status = response.status;
      throw error;
    }
    return envelope.data;
  }

  fetchService(service, payload) {
    return this.request("GET", service, payload);
  }

  postService(service, payload) {
    return this.request("POST", service, payload);
  }
}

module.exports = { ServiceClient, normalizePayload, serviceUrl, sessionAuthorizationHeaders };
