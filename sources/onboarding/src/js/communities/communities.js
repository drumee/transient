(async () => {
  const mount = document.getElementById("communities");
  if (!mount) return;

  const escapeHtml = (str = "") =>
    String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const normalizeCommunities = (items) => {
    return (items || []).map((c) => ({
      imageUrl: c.imageUrl || "",
      name: c.name || "",
      features: Array.isArray(c.features) ? c.features.filter(Boolean) : [],
      buttonTitle: c.buttonTitle || "Learn more →",
      href: c.href || "#",
    }));
  };

  const render = (communities) => {
    const cards = communities
      .map((c) => {
        const featuresHtml = (c.features || [])
          .map(
            (t) => `
              <li class="communities__feature">
                <span class="communities__feature-text">${escapeHtml(t)}</span>
              </li>
            `
          )
          .join("");

        return `
          <article class="communities__card">
            <div class="communities__icon">
              <img src="${escapeHtml(c.imageUrl)}" alt="${escapeHtml(
          c.name
        )} icon" loading="lazy" />
            </div>

            <h3 class="communities__name">${escapeHtml(c.name)}</h3>

            <ul class="communities__features" aria-label="${escapeHtml(
              c.name
            )} features">
              ${featuresHtml}
            </ul>

            <a class="communities__btn" href="${escapeHtml(
              c.href
            )}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(c.buttonTitle)}
            </a>
          </article>
        `;
      })
      .join("");

    mount.innerHTML = `
      <div class="communities">
        <div class="communities__grid">
          ${cards}
        </div>
      </div>
    `;
  };

  try {
    const res = await fetch("/src/data/communities/communities.json");
    if (!res.ok) throw new Error(`Failed to load data.json: ${res.status}`);

    const data = await res.json();
    const raw = data.communities || [];
    const communities = normalizeCommunities(raw);

    render(communities);
  } catch (err) {
    console.error(err);
    mount.innerHTML = `<p style="padding:16px;color:#b91c1c;">Communities failed to load. Check console.</p>`;
  }
})();
