/**
 * Amadeus holographic system.
 *
 * The palette is sampled from the logo's nucleus: a cube of foil that runs
 * cyan → magenta → gold, wrapped in a white wireframe hypercube.
 * Everything "alive" on the page (particles, the nucleus, active states)
 * draws its colour from `holoRGB`, so tilting the phone or moving the pointer
 * shifts every surface the way a real holographic sticker does.
 */

export const HOLO_STOPS: [number, number, number][] = [
  [61, 242, 255], // cyan    #3DF2FF
  [139, 123, 255], // violet #8B7BFF
  [255, 79, 216], // magenta #FF4FD8
  [255, 227, 110], // gold   #FFE36E
];

/** t in [0,1) (wraps) → iridescent rgb along the logo's foil spectrum. */
export function holoRGB(t: number): [number, number, number] {
  const n = HOLO_STOPS.length;
  const x = (((t % 1) + 1) % 1) * n;
  const i = Math.floor(x);
  const f = x - i;
  const a = HOLO_STOPS[i % n];
  const b = HOLO_STOPS[(i + 1) % n];
  // smoothstep for a softer, more foil-like blend
  const s = f * f * (3 - 2 * f);
  return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
}

export function holoCSS(t: number, alpha = 1, darken = 0): string {
  const [r, g, b] = holoRGB(t);
  const k = 1 - darken;
  return `rgba(${(r * k) | 0},${(g * k) | 0},${(b * k) | 0},${alpha})`;
}

/* ------------------------------------------------------------------ */
/* Shared input state — one set of listeners for the whole page.       */
/* ------------------------------------------------------------------ */

export interface HoloInput {
  /** pointer in viewport px, or null when no pointer is present */
  px: number;
  py: number;
  pointerActive: boolean;
  pointerDown: boolean;
  /** device tilt, normalised to roughly [-1, 1] */
  tiltX: number;
  tiltY: number;
  hasTilt: boolean;
  /** smoothed scroll velocity in px/frame */
  scrollV: number;
  reducedMotion: boolean;
}

export const holoInput: HoloInput = {
  px: -9999,
  py: -9999,
  pointerActive: false,
  pointerDown: false,
  tiltX: 0,
  tiltY: 0,
  hasTilt: false,
  scrollV: 0,
  reducedMotion: false,
};

let started = false;
let tiltPermissionAsked = false;

type OrientationCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/** iOS only grants gyroscope access from inside a user gesture. */
export function requestTiltPermission() {
  if (tiltPermissionAsked || typeof window === "undefined") return;
  tiltPermissionAsked = true;
  const DOE = (window as unknown as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === "function") {
    DOE.requestPermission().catch(() => {});
  }
}

export function startHoloRuntime() {
  if (started || typeof window === "undefined") return () => {};
  started = true;

  const root = document.documentElement;
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  holoInput.reducedMotion = mq.matches;
  const onMq = () => (holoInput.reducedMotion = mq.matches);
  mq.addEventListener?.("change", onMq);

  // CSS variables: --holo-x / --holo-y in [0,1] drive every foil surface.
  let cssX = 0.5;
  let cssY = 0.5;
  let targetX = 0.5;
  let targetY = 0.5;

  const onMove = (e: PointerEvent) => {
    holoInput.px = e.clientX;
    holoInput.py = e.clientY;
    holoInput.pointerActive = true;
    if (!holoInput.hasTilt) {
      targetX = e.clientX / window.innerWidth;
      targetY = e.clientY / window.innerHeight;
    }
    // Local sheen for the surface under the pointer.
    const el = (e.target as Element | null)?.closest?.(".holo-sheen") as HTMLElement | null;
    if (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--sx", `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty("--sy", `${((e.clientY - r.top) / r.height) * 100}%`);
    }
  };
  const onDown = (e: PointerEvent) => {
    holoInput.pointerDown = true;
    holoInput.px = e.clientX;
    holoInput.py = e.clientY;
    holoInput.pointerActive = true;
    requestTiltPermission();
  };
  const onUp = (e: PointerEvent) => {
    holoInput.pointerDown = false;
    // Touch has no hover — release the pointer so particles relax.
    if (e.pointerType !== "mouse") {
      holoInput.pointerActive = false;
      holoInput.px = -9999;
      holoInput.py = -9999;
    }
  };
  const onLeave = () => {
    holoInput.pointerActive = false;
    holoInput.px = -9999;
    holoInput.py = -9999;
  };

  const onOrient = (e: DeviceOrientationEvent) => {
    if (e.beta == null || e.gamma == null) return;
    holoInput.hasTilt = true;
    // Assume the phone is held ~40° from flat; clamp to ±35° of travel.
    const gx = Math.max(-35, Math.min(35, e.gamma)) / 35;
    const gy = Math.max(-35, Math.min(35, e.beta - 40)) / 35;
    holoInput.tiltX = gx;
    holoInput.tiltY = gy;
    targetX = 0.5 + gx * 0.5;
    targetY = 0.5 + gy * 0.5;
  };

  let lastScroll = window.scrollY;
  let raf = 0;
  const tick = () => {
    const y = window.scrollY;
    const v = y - lastScroll;
    lastScroll = y;
    holoInput.scrollV += (v - holoInput.scrollV) * 0.2;

    cssX += (targetX - cssX) * 0.08;
    cssY += (targetY - cssY) * 0.08;
    root.style.setProperty("--holo-x", cssX.toFixed(4));
    root.style.setProperty("--holo-y", cssY.toFixed(4));
    root.style.setProperty("--holo-angle", `${(cssX * 160 + cssY * 80 + y * 0.04) % 360}deg`);
    raf = requestAnimationFrame(tick);
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  window.addEventListener("blur", onLeave);
  window.addEventListener("deviceorientation", onOrient, { passive: true });
  raf = requestAnimationFrame(tick);

  return () => {
    started = false;
    cancelAnimationFrame(raf);
    mq.removeEventListener?.("change", onMq);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    document.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("blur", onLeave);
    window.removeEventListener("deviceorientation", onOrient);
  };
}
