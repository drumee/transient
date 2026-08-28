import { initRive } from "../home/rive.js";

export async function init() {
  // const hasTrigger = document.querySelector(".tutorial-button");
  // const hasModal = document.getElementById("videoModal");

  // if (!hasTrigger || !hasModal) return;

  // const { initVideoModal } = await import("../home/tutorial-video.js");
  // initVideoModal();
  await initRive();
}
