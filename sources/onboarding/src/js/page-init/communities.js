export async function init() {
  if (!document.getElementById("communities")) {
    return;
  }

  if (document.getElementById("communities")) {
    await import("../communities/communities.js");
  }
}
