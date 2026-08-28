// Map page keys to their corresponding page modules
const pages = {
  pricing: () => import("./pricing.js"),
  communities: () => import("./communities.js"),
  docs: () => import("./docs.js"),
  home: () => import("./home.js"),
};

/**
 * Initialize page-specific logic
 * @param {string} pageKey - value from data-page attribute in HTML
 *
 * NOTE:
 * If data-page is missing or invalid, no JS file will be imported.
 */
export async function initPage(pageKey) {
  if (!pageKey) return;

  const loader = pages[pageKey];
  if (!loader) return;

  const mod = await loader();
  if (mod?.init) await mod.init();
}
