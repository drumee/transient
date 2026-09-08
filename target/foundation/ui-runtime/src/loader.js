function loadBrowserScript(url, { document: documentRef = globalThis.document, XMLHttpRequest: Xhr = globalThis.XMLHttpRequest } = {}) {
  if (!documentRef) return Promise.reject(new Error("Browser script loading requires document"));
  const pageOrigin = documentRef.location && documentRef.location.origin;
  let crossOrigin = false;
  try { crossOrigin = Boolean(pageOrigin && new URL(url, documentRef.location.href).origin !== pageOrigin); } catch (_) {}
  if (crossOrigin) {
    // The historical loader uses XHR for same-origin bundles. A classic script
    // tag is the browser-native cross-origin equivalent and avoids turning the
    // static plugin route into a credentialed CORS endpoint.
    return new Promise((resolve, reject) => {
      const script = documentRef.createElement("script");
      script.setAttribute("type", "text/javascript");
      script.setAttribute("charset", "utf-8");
      script.setAttribute("async", "");
      script.onload = () => resolve(script);
      script.onerror = () => reject(new Error(`Unable to load plugin script ${url}`));
      script.src = url;
      documentRef.head.appendChild(script);
    });
  }
  if (!Xhr) return Promise.reject(new Error("Browser script loading requires XMLHttpRequest"));
  return new Promise((resolve, reject) => {
    const request = new Xhr();
    request.open("GET", url, true);
    request.onload = () => {
      const script = documentRef.createElement("script");
      script.setAttribute("type", "text/javascript");
      script.setAttribute("charset", "utf-8");
      script.setAttribute("async", "");
      script.text = request.responseText;
      documentRef.head.appendChild(script);
      resolve(request);
    };
    request.onerror = () => reject(request);
    request.send();
  });
}

module.exports = { loadBrowserScript };
