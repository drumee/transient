/*
 * Non-MFS Backbone.Model extraction from ui-core's Host, Visitor and
 * Organization singletons. These are real Backbone contexts, not DTOs.
 */
const { Backbone } = require("./letc");

class Context extends Backbone.Model {}

class Host extends Context {
  // Derived from letc/host.js::{name,domain_name,makeUrl}. Browser title and
  // localStorage side effects are deliberately not bootstrap responsibilities.
  name() {
    return this.get("hostname") || this.get("domain") || this.get("name") || this.get("main_domain") || "";
  }

  domainName() {
    return this.get("domain") || this.get("hostname") || this.get("main_domain") || "";
  }

  domain_name() {
    return this.domainName();
  }

  makeUrl(path = "") {
    const protocol = this.get("protocol") || "https";
    const host = this.get("vhost") || this.domainName();
    return host ? `${protocol}://${host}/${String(path).replace(/^\/+/, "")}` : path;
  }

  settings() {
    const settings = this.get("settings");
    if (typeof settings === "string") {
      try {
        const parsed = JSON.parse(settings);
        this.set("settings", parsed);
        return parsed;
      } catch (_) { return {}; }
    }
    return settings || {};
  }

  data(name) {
    return this.settings()[name] || {};
  }
}

class Visitor extends Context {
  // Derived from letc/user.js. Generic identity/connection methods are kept;
  // profile media, quota, radio, routing and MFS methods are deferred.
  profile() {
    const profile = this.get("profile");
    if (typeof profile === "string") {
      try {
        const parsed = JSON.parse(profile);
        this.set("profile", parsed);
        return parsed;
      } catch (_) { return {}; }
    }
    return profile || this.get("user") || {};
  }

  isSignedIn() {
    return Boolean(this.get("signed_in"));
  }

  isOnline() {
    return this.get("connection") === "online" || this.isSignedIn();
  }

  fullname() {
    const profile = this.profile();
    if (profile.fullname) return profile.fullname;
    const full = `${profile.firstname || this.get("firstname") || ""} ${profile.lastname || this.get("lastname") || ""}`.trim();
    return full || profile.email || this.get("email") || "";
  }

  language() {
    const profile = this.profile();
    const language = String(profile.lang || this.get("lang") || "en").toLowerCase().split(/[-_.]/)[0];
    return ["en", "fr", "es", "km", "ru", "zh"].includes(language) ? language : "en";
  }
}

class Organization extends Context {
  // Derived from letc/organization.js::{metadata,host,name}. Wallpaper,
  // router and MFS image behaviour is intentionally deferred.
  metadata() {
    const metadata = this.get("metadata");
    if (typeof metadata === "string") {
      try {
        const parsed = JSON.parse(metadata);
        this.set("metadata", parsed);
        return parsed;
      } catch (_) { return {}; }
    }
    return metadata || {};
  }

  host() {
    return this.get("link") || this.get("domain") || "";
  }

  name() {
    return this.get("name") || this.get("org_name") || this.get("domain") || "";
  }
}

module.exports = { Context, Host, Organization, Visitor };
