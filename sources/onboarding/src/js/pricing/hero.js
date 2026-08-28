(async () => {
  const mount = document.getElementById("hero-pricing");
  if (!mount) return;

  const escapeHtml = (str = "") =>
    String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const toFeatureMap = (featuresArr) => {
    const map = new Map();
    (featuresArr || []).forEach((f) => {
      if (!f) return;
      map.set(f.key, f);
    });
    return map;
  };

  const normalizePlans = (plans) => {
    return (plans || []).map((p) => {
      const name = p?.name || "";
      const title = p?.title || "";
      const period = p?.period || "monthly";
      const isPopular = String(name).toLowerCase() === "pro";
      const note = p?.description || "";

      let ctaText = "Get started";
      let ctaVariant = "ghost";
      if (String(name).toLowerCase() === "pro") {
        ctaText = "Upgrade";
        ctaVariant = "primary";
      }
      if (String(name).toLowerCase() === "enterprise") {
        ctaText = "Contact sales";
        ctaVariant = "dark";
      }

      const featureOrder = [
        "storage",
        "editor-access",
        "admin-roles",
        "version-history",
        "permissions-roles",
        "guest-access",
        "activity-logs",
        "workspace-isolation",
        "priority-performance",
      ];

      const featureMap = toFeatureMap(p?.features);

      const features = featureOrder
        .map((key) => featureMap.get(key))
        .filter((f) => {
          if (!f) return false;
          if (typeof f.value === "boolean") return f.value === true;
          return true;
        });

      return {
        name,
        title,
        period,
        note,
        ctaText,
        ctaVariant,
        isPopular,
        features,
      };
    });
  };

  const getPriceText = (plan, billing) => {
    const t = plan?.title;
    if (t && typeof t === "object") {
      return t[billing] || t.monthly || t.yearly || "";
    }
    return t || "";
  };

  const render = (plans, billing = "monthly") => {
    const monthlyActive = billing === "monthly";
    const yearlyActive = billing === "yearly";

    const cards = (plans || [])
      .map((p) => {
        const popularBadge = p.isPopular
          ? `<span class="hero-pricing__badge">Most Popular</span>`
          : "";

        const note = p.note
          ? `<p class="hero-pricing__note">${escapeHtml(p.note)}</p>`
          : "";

        const btnClass =
          p.ctaVariant === "primary"
            ? "hero-pricing__btn hero-pricing__btn--primary"
            : p.ctaVariant === "dark"
              ? "hero-pricing__btn hero-pricing__btn--dark"
              : "hero-pricing__btn";

        const features = (p.features || [])
          .map((f) => {
            const value = f?.value;

            if (typeof value === "boolean") {
              return `
                <li class="hero-pricing__feature">
                  <span class="hero-pricing__check" aria-hidden="true">✓</span>
                  <span class="hero-pricing__feature-text">
                    <span class="hero-pricing__feature-name">${escapeHtml(
                      f.name,
                    )}</span>
                  </span>
                </li>
              `;
            }

            return `
              <li class="hero-pricing__feature">
                <span class="hero-pricing__check" aria-hidden="true">✓</span>
                <span class="hero-pricing__feature-text">
                  <span class="hero-pricing__feature-value">${escapeHtml(
                    value,
                  )}</span>
                  <span class="hero-pricing__feature-name">${escapeHtml(
                    f.name,
                  )}</span>
                </span>
              </li>
            `;
          })
          .join("");

        const priceText = getPriceText(p, billing);

        return `
          <article class="hero-pricing__card ${p.isPopular ? "is-popular" : ""}">
            ${popularBadge}
            <h3 class="hero-pricing__plan">${escapeHtml(p.name)}</h3>

            <div class="hero-pricing__price">
              <div class="hero-pricing__price-main">${escapeHtml(priceText)}</div>
            </div>

            ${note}

            <a href="https://drumee.org/-/#welcome/signup">
              <button class="${btnClass}" type="button">
                ${escapeHtml(p.ctaText)}
              </button>
            </a>

            <div class="hero-pricing__divider" aria-hidden="true"></div>

            <ul class="hero-pricing__features" aria-label="${escapeHtml(
              p.name,
            )} features">
              ${features}
            </ul>
          </article>
        `;
      })
      .join("");

    mount.innerHTML = `
      <div class="hero-pricing">
        <div class="hero-pricing__toggle" role="tablist" aria-label="Billing period">
          <button class="hero-pricing__tab ${monthlyActive ? "is-active" : ""}"
                  type="button" data-billing="monthly" role="tab"
                  aria-selected="${monthlyActive}">
            Monthly
          </button>
          <button class="hero-pricing__tab ${yearlyActive ? "is-active" : ""}"
                  type="button" data-billing="yearly" role="tab"
                  aria-selected="${yearlyActive}">
            Yearly <span class="hero-pricing__save">Save 15%</span>
          </button>
        </div>

        <div class="hero-pricing__grid">
          ${cards}
        </div>
      </div>
    `;
  };

  try {
    const res = await fetch("/src/data/pricing/plans.json");
    if (!res.ok) throw new Error(`Failed to load plans.json: ${res.status}`);

    const data = await res.json();
    const rawPlans = data?.plans || [];
    const plans = normalizePlans(rawPlans);

    let billing = "monthly";
    render(plans, billing);

    mount.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-billing]");
      if (!btn) return;

      const next = btn.getAttribute("data-billing");
      if (!next || next === billing) return;

      billing = next;
      render(plans, billing);
    });
  } catch (err) {
    console.error(err);
    mount.innerHTML = `<p style="padding:16px;color:#b91c1c;">Hero pricing failed to load. Check console.</p>`;
  }
})();
