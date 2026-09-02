function loadBrowserScript(url, { document: documentRef = globalThis.document, XMLHttpRequest: Xhr = globalThis.XMLHttpRequest } = {}) {
  if (!documentRef || !Xhr) return Promise.reject(new Error("Browser script loading requires document and XMLHttpRequest"));
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
