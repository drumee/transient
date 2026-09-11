/*
 * Minimal CommonJS service transport for independent LETC plugins.
 *
 * It selectively adapts ui-essentials/socket/{service,utils}.js: service
 * names remain logical `module.method` strings, responses retain Drumee's
 * `{ status, data }` envelope, and the browser remains the transport owner.
 * Session/Visitor headers, socket state and Team-specific error plumbing are
 * deliberately out of scope for the anonymous Phase 3 path.
 */

// The historical x-param bridge is transport-only. Keeping both it and the
// browser capability which emits it outside the ServiceClient object graph
// prevents a Widget/plugin that can reach runtime.serviceClient from reading
// the raw regsid or replacing the transport used for a credentialed request.
const transportStates = new WeakMap();

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

function normalizedSessionAuthorization(authorization) {
  if (!authorization) return null;
  const headers = sessionAuthorizationHeaders(authorization);
  return {
    keysel: headers["x-param-keysel"],
    sid: headers[`x-param-${headers["x-param-keysel"]}`]
  };
}

function updateSessionAuthorization(client, authorization) {
  const state = transportStates.get(client);
  if (!state) throw new Error("Service transport is not configured");
  state.authorization = normalizedSessionAuthorization(authorization);
  return client;
}

class ServiceClient {
  constructor({ baseUrl = "/-/svc/", fetch: fetchImpl = globalThis.fetch, credentials, sessionAuthorization } = {}) {
    this.baseUrl = baseUrl;
    transportStates.set(this, {
      fetch: fetchImpl,
      credentials,
      authorization: normalizedSessionAuthorization(sessionAuthorization)
    });
    // Keep the write-only rotation entrypoint itself non-replaceable. A plugin
    // must not wrap it and observe a future bridge supplied by the runtime
    // owner; it can only assign unrelated public properties such as `fetch`.
    Object.defineProperty(this, "setSessionAuthorization", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: (authorization) => updateSessionAuthorization(this, authorization)
    });
  }

  async request(method, service, payload) {
    const call = normalizePayload(service, payload);
    const state = transportStates.get(this);
    if (!state || typeof state.fetch !== "function") throw new Error("Browser fetch is not configured");
    let url = serviceUrl(this.baseUrl, call.service);
    const options = {
      method,
      headers: {
        Accept: "application/json",
        ...sessionAuthorizationHeaders(state.authorization)
      }
    };
    if (state.credentials) options.credentials = state.credentials;
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
    const response = await state.fetch(url, options);
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

module.exports = { ServiceClient, normalizePayload, normalizedSessionAuthorization, serviceUrl, sessionAuthorizationHeaders, updateSessionAuthorization };
