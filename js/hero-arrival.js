// Playrooom Atelier — hero → shelf handoff.
//
// The hero is nothing but the photograph, so the scroll itself has to carry the
// story: as the picture leaves, it recedes under the cream shelf card with real
// spring dynamics instead of a linear scroll-scrub. Two springs run in parallel,
// both fed by the same scroll progress:
//
//   frame  — the picture itself: drifts up, settles to 0.945, softens
//   lens   — the photograph inside the frame: lags behind it, so the room has
//            depth while the card is arriving
//
// Lenis (see hero-scene.js) supplies the wheel inertia; this module adds the
// second layer of physics on top, so a flick of the wheel keeps travelling after
// the fingers stop. Under reduced motion nothing here runs at all.

import { Spring } from './spring.js';

const HEADER_FALLBACK = 154;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let state = null;

/** Tear the handoff down (route change, resize, replay). */
export function destroyHeroArrival() {
  if (!state) return;
  state.alive = false;
  state.frame.onUpdate = null;
  state.lens.onUpdate = null;
  state.frame.set(0);
  state.lens.set(0);
  if (state.unsubscribe) state.unsubscribe();
  const { art, img } = state;
  art.style.transform = '';
  art.style.opacity = '';
  img.style.transform = '';
  state = null;
}

/** Wire the hero handoff for the current route render. Safe to call repeatedly. */
export function initHeroArrival() {
  destroyHeroArrival();

  const hero = document.querySelector('.home-hero--art');
  const art = hero?.querySelector('[data-hero-art]');
  const img = art?.querySelector('img');
  const card = document.querySelector('.home-main');
  if (!hero || !art || !img || !card || reduced()) return;

  // A spring per layer. Stiffness/damping tuned so the picture is already
  // moving when the wheel stops — the lag is the whole point.
  const frame = new Spring({ stiffness: 130, damping: 27, mass: 1, precision: 0.0004 });
  const lens = new Spring({ stiffness: 90, damping: 22, mass: 1, precision: 0.0004 });

  state = { hero, art, img, card, frame, lens, alive: true };

  const paint = () => {
    const p = clamp(frame.x);             // 0 at the top, 1 once the hero is spent
    const q = clamp(lens.x);              // photograph lags the frame

    // frame: recede under the arriving card
    const scale = 1 - p * 0.055;
    const lift = -p * 26;
    art.style.transform = `translate3d(0,${lift.toFixed(2)}px,0) scale(${scale.toFixed(4)})`;
    art.style.opacity = (1 - p * 0.16).toFixed(3);

    // lens: the room drifts inside the frame, always slower than the frame.
    // At rest (q = 0) the picture is exactly 1:1 — the artwork is never
    // pre-cropped. The spread only builds as the hero starts to leave, and the
    // scale stays ahead of the drift so no edge of the frame is ever exposed.
    const inner = 1 + q * 0.045;
    img.style.transform = `translate3d(0,${(q * 1.6).toFixed(2)}%,0) scale(${inner.toFixed(4)})`;
  };

  frame.onUpdate = paint;
  lens.onUpdate = paint;

  const measure = () => {
    const r = hero.getBoundingClientRect();
    const travel = Math.max(1, r.height + (parseFloat(getComputedStyle(hero).marginBottom) || 0));
    // 0 while the picture fills the screen, 1 when its last pixel has left
    return clamp(-r.top / travel);
  };

  // Velocity-aware: the faster the wheel is thrown, the more the springs are
  // pre-loaded, which is what makes a flick feel like it has weight.
  let last = window.scrollY;
  let lastT = performance.now();

  const step = () => {
    if (!state?.alive) return;
    const now = performance.now();
    const dt = Math.max(8, now - lastT);
    lastT = now;
    const v = ((window.scrollY - last) / dt) * 1000;   // px per second
    last = window.scrollY;

    const target = measure();
    const kick = clamp(Math.abs(v) / 9000, 0, 0.06) * Math.sign(v || 0);
    frame.to(target, kick * 60);
    lens.to(target, kick * 34);
    if (!state.detachTicker) state.raf = requestAnimationFrame(step);
  };

  frame.set(measure());
  lens.set(measure());
  paint();

  // Lenis already runs a gsap ticker on this page; ride it rather than starting a
  // second frame loop. Fall back to a plain rAF when gsap is absent.
  const gsap = window.gsap;
  if (gsap?.ticker) {
    gsap.ticker.add(step);
    state.detachTicker = () => gsap.ticker.remove(step);
  } else {
    state.raf = requestAnimationFrame(step);
  }
  window.__heroArrival = { state, measure };  /* TEMP-DEBUG */

  // keep the geometry honest when the shelf grows/shrinks (fonts, images, cart)
  const onResize = () => {
    frame.set(measure());
    lens.set(measure());
    paint();
  };
  window.addEventListener('resize', onResize, { passive: true });
  state.unsubscribe = () => {
    window.removeEventListener('resize', onResize);
    state.detachTicker?.();
    if (state.raf) cancelAnimationFrame(state.raf);
  };
}
