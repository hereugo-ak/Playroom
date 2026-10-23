// Playroom Atelier — physics motion core.
// A tiny, dependency-free spring physics engine used throughout the site:
// any DOM element can be animated to a target with real spring dynamics
// (stiffness/damping/mass), or "flicked" with a velocity impulse.
// Used by: buttons, cards, drawer, modal, toasts, compare dock, header,
// hero objects, checkout payment switcher, success animation.

// ---------------------------------------------------------------- spring ---
export class Spring {
  constructor({ stiffness = 170, damping = 22, mass = 1, precision = 0.1 } = {}) {
    this.k = stiffness; this.c = damping; this.m = mass; this.p = precision;
    this.x = 0; this.v = 0; this.target = 0;
    this.raf = 0; this.lastT = 0;
    this.onUpdate = null; this.onRest = null;
  }
  set(value) { this.x = value; this.v = 0; this.target = value; this.#emit(); }
  to(target, velocity = 0) { this.target = target; this.v = velocity; this.#wake(); }
  impulse(v) { this.v += v; this.#wake(); }
  #wake() { if (!this.raf) { this.lastT = performance.now(); this.raf = requestAnimationFrame(this.#step); } }
  #step = (t) => {
    const dt = Math.min(0.032, (t - this.lastT) / 1000); this.lastT = t;
    // semi-implicit Euler (stable for k/m up to ~400)
    const steps = 2; const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const F = -this.k * (this.x - this.target) - this.c * this.v;
      this.v += (F / this.m) * h;
      this.x += this.v * h;
    }
    this.#emit();
    const atTarget = Math.abs(this.x - this.target) < this.p;
    const slow = Math.abs(this.v) < this.p * 10;
    if (atTarget && slow) { this.x = this.target; this.v = 0; this.#emit(); this.raf = 0; this.onRest?.(this.x); return; }
    this.raf = requestAnimationFrame(this.#step);
  };
  #emit() { this.onUpdate?.(this.x, this.v); }
  destroy() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
}

// -------------------------------------------------------------- flingable ---
// Attach spring physics to an element's translate: UI code simply calls
// springEl(el, x, y) or fling(el, {vx, vy}). Integrated in one shared loop.
const registry = new Map();
function ensureEntry(el) {
  let e = registry.get(el);
  if (!e) {
    e = {
      sx: new Spring({ stiffness: 210, damping: 24 }),
      sy: new Spring({ stiffness: 210, damping: 24 }),
      ss: new Spring({ stiffness: 260, damping: 26 }),  // scale
      lastOutput: '',
    };
    e.sx.onUpdate = e.sy.onUpdate = e.ss.onUpdate = () => paint(e, el);
    registry.set(el, e);
  }
  return e;
}
function paint(e, el) {
  const x = e.sx.x, y = e.sy.x, s = e.ss.x;
  if (Math.abs(x) < .06 && Math.abs(y) < .06 && Math.abs(s - 1) < .0008) {
    if (e.lastOutput) { el.style.transform = ''; e.lastOutput = ''; }
    return;
  }
  const t = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${s.toFixed(4)})`;
  if (t !== e.lastOutput) { el.style.transform = t; e.lastOutput = t; }
}

export function springEl(el, { x = 0, y = 0, s = 1 } = {}) {
  const e = ensureEntry(el);
  e.sx.to(x); e.sy.to(y); e.ss.to(s);
}
export function fling(el, { vx = 0, vy = 0, s = 0 } = {}) {
  const e = ensureEntry(el);
  // Springs are born at 0 — seed the scale spring so a pure-translate fling
  // never paints the element at scale(0) (which would collapse it to 0×0).
  if (e.ss.x === 0 && e.ss.target === 0 && !e.ss.raf) e.ss.set(1);
  e.sx.impulse(vx); e.sy.impulse(vy); if (s) e.ss.impulse(s);
}
// Call after layout/pointer gestures: give real displaced position a spring target.
export function settle(el, currentX, currentY, s = 1) {
  const e = ensureEntry(el);
  e.sx.set(currentX); e.sy.set(currentY); e.ss.set(s);
  e.sx.to(0); e.sy.to(0); e.ss.to(1);
}

// Magnetic hover with physics (replaces transform-string pokes everywhere)
export function attachMagnet(el, { strength = 0.06, lift = 0.09 } = {}) {
  const move = (e) => {
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    springEl(el, { x: dx * strength, y: dy * lift });
  };
  const leave = () => springEl(el, { x: 0, y: 0 });
  el.addEventListener('pointermove', move, { passive: true });
  el.addEventListener('pointerleave', leave, { passive: true });
  return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
}

// 3D pointer tilt with spring (cards)
export function attachTilt(el, { max = 2.4 } = {}) {
  const move = (e) => {
    if (e.target.closest('button,a,input')) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5;
    const y = (e.clientY - r.top) / r.height - .5;
    el.style.transform = `perspective(900px) rotateX(${(-y * max * .9).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateY(-3px)`;
  };
  const leave = () => { el.style.transform = ''; };
  el.addEventListener('pointermove', move, { passive: true });
  el.addEventListener('pointerleave', leave, { passive: true });
}

// "Pop" — Newton's cradle style impulse used by toasts, badge, pay success
export function pop(el, { scale = 1.06, settle_ms = 500 } = {}) {
  el.style.transition = 'none';
  el.style.transform = `scale(${scale})`;
  requestAnimationFrame(() => {
    el.style.transition = `transform ${settle_ms}ms cubic-bezier(.2,1.4,.3,1)`;
    el.style.transform = 'scale(1)';
  });
}

// Gravity drop used when drawer toasts land
export function gravityDrop(el, { from = -18, g = 1400 } = {}) {
  const t0 = performance.now();
  const step = (t) => {
    const dt = (t - t0) / 1000;
    const y = Math.max(0, from + g * dt * dt * .5); // clamp at rest
    el.style.transform = `translateY(${y}px)`;
    if (y < -from) requestAnimationFrame(step);
    else el.style.transform = '';
  };
  requestAnimationFrame(step);
}

// reduced-motion respect
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
