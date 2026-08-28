import { initPage } from "../page-init/index.js";
import { initNavbar } from "../layout/navbar.js";
// import { initVideoModal } from "../layout/tutorial-video.js";

async function loadHtml(selector, url) {
  const el = document.querySelector(selector);
  if (!el) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load: ${url}`);
  el.innerHTML = await res.text();
}

document.addEventListener("DOMContentLoaded", async () => {
  const containerUrl =
    document.body.dataset.container || "/src/partials/container/home.html";
  const pageKey = document.body.dataset.page;

  try {
    await loadHtml("#app-navbar", "/src/partials/layout/navbar.html");
    await loadHtml("#app-container", containerUrl);
    await loadHtml("#app-footer", "/src/partials/layout/footer.html");

    initNavbar();
    // initVideoModal();

    await initPage(pageKey);
  } catch (err) {
    console.error(err);
  }
});
