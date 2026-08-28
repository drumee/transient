const RIVE_CDN = "https://unpkg.com/@rive-app/webgl2@2.31.5/rive.js";

async function ensureRiveRuntime(timeoutMs = 10000) {
  const getCtor = () => window.rive?.Rive || window.Rive || null;

  if (getCtor()) return getCtor();

  if (!document.querySelector('script[data-rive-runtime="1"]')) {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = RIVE_CDN;
      s.async = true;
      s.dataset.riveRuntime = "1";
      s.onload = resolve;
      s.onerror = () =>
        reject(new Error("Failed to load Rive runtime from CDN"));
      document.head.appendChild(s);
    });
  }

  const start = Date.now();
  while (!getCtor()) {
    if (Date.now() - start > timeoutMs) return null;
    await new Promise((r) => setTimeout(r, 50));
  }

  return getCtor();
}

export async function initRive() {
  const RiveCtor = await ensureRiveRuntime();
  if (!RiveCtor) {
    console.error(
      "Rive runtime not found / failed to load. Check CSP/Network for unpkg + rive.wasm."
    );
    return { instances: [] };
  }

  const canvases = document.querySelectorAll("canvas[data-riv]");
  if (!canvases.length) return { instances: [] };

  const instances = [];

  const setupCanvas = (canvas) => {
    const src = canvas.dataset.riv;
    if (!src) return;

    const smName = canvas.dataset.sm;
    const autoplay = canvas.dataset.autoplay !== "false";

    let inst = null;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      inst?.resizeDrawingSurfaceToCanvas?.();
    };

    inst = new RiveCtor({
      src,
      canvas,
      autoplay,
      ...(smName ? { stateMachines: smName } : {}),
      onLoad: () => {
        resize();

        if (!smName) {
          instances.push({ canvas, inst, resize });
          return;
        }

        const inputs = inst.stateMachineInputs(smName) || [];

        instances.push({ canvas, inst, resize, smName, inputs });
      },
    });

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    instances.push({ canvas, inst, resize, ro });
  };

  canvases.forEach(setupCanvas);

  window.addEventListener("resize", () => {
    instances.forEach(({ resize }) => resize?.());
  });

  return { instances };
}
