class Context {
  constructor(attributes = {}) {
    this.attributes = { ...attributes };
  }

  get(name) {
    return this.attributes[name];
  }

  set(name, value) {
    if (name && typeof name === "object") Object.assign(this.attributes, name);
    else this.attributes[name] = value;
    return this;
  }

  reset(attributes = {}) {
    this.attributes = { ...attributes };
    return this;
  }

  toJSON() {
    return { ...this.attributes };
  }
}

class Host extends Context {
  name() {
    return this.get("hostname") || this.get("domain") || this.get("name") || "";
  }

  domainName() {
    return this.get("domain") || this.get("hostname") || "";
  }

  makeUrl(path = "") {
    const protocol = this.get("protocol") || "https";
    const host = this.get("vhost") || this.domainName();
    return host ? `${protocol}://${host}/${String(path).replace(/^\/+/, "")}` : path;
  }
}

class Visitor extends Context {
  isSignedIn() {
    return Boolean(this.get("signed_in"));
  }

  isOnline() {
    return this.get("connection") === "online" || this.isSignedIn();
  }
}

class Organization extends Context {
  metadata() {
    const metadata = this.get("metadata");
    return metadata && typeof metadata === "object" ? metadata : {};
  }

  name() {
    return this.get("name") || this.get("domain") || "";
  }

  host() {
    return this.get("link") || this.get("domain") || "";
  }
}

module.exports = { Context, Host, Organization, Visitor };
