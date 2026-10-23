// Playroom Atelier — premium motion orchestration.
// Ported 1:1 from the reference's three motion blocks:
//   1) reveal-on-scroll system (motion-ready + data-reveal)
//   2) atelier motion plus (progress bar, cursor glow, magnetic buttons,
//      pointer-tilt cards, route curtain)
//   3) header state, footer reveal, badge pulse
import { $, $$ } from './dom.js';
import { listeners } from './store.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

// ------------------------------------------------------------------
// 1. Scroll-reveal system (re-bound after every route render)
// ------------------------------------------------------------------
export function initReveal() {
  document.body.classList.add('motion-ready');
  const app = $('#app');
  if (!app) return;
  const targets = app.querySelectorAll(
    'h1,h2,h3,.section,.page-top,.page-intro,.product-card,.home-category-card,.home-age-card,.home-story-tile,.trust-item,.newsletter,.footer-grid,.stat-card,.feature-card'
  );
  targets.forEach((el, i) => {
    if (el.closest('.drawer,.modal,.search-panel,.hero-cinema')) return;
    if (!el.hasAttribute('data-reveal'))
      el.setAttribute('data-reveal', el.matches('.product-card,.home-category-card,.home-age-card,.home-story-tile') ? 'scale' : 'up');
    if (el.matches('.product-card,.home-category-card,.home-age-card,.home-story-tile'))
      el.style.setProperty('--reveal-delay', `${(i % 4) * 65}ms`);
  });
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
  }), { threshold: .08, rootMargin: '0px 0px -36px 0px' });
  targets.forEach((el) => { if (!el.classList.contains('is-visible')) io.observe(el); });
}

// ------------------------------------------------------------------
// 2. Spotlight surfaces (hero, large imagery)
// ------------------------------------------------------------------
function bindSpots(root = document) {
  root.querySelectorAll('[data-spotlight],.hero-cinema,.hero-visual,.manifesto-image').forEach((el) => {
    if (el.dataset.motionBound || reduced) return;
    el.dataset.motionBound = '1';
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--spot-x', `${e.clientX - r.left}px`);
      el.style.setProperty('--spot-y', `${e.clientY - r.top}px`);
    }, { passive: true });
  });
}

// ------------------------------------------------------------------
// 3. Progress bar + cursor glow
// ------------------------------------------------------------------
let progressBar = null;
function initProgress() {
  if (progressBar) return;
  progressBar = document.createElement('div');
  progressBar.id = 'atelier-progress';
  document.body.appendChild(progressBar);
  let ticking = false;
  const update = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      progressBar.style.width = (max > 0 ? scrollY / max * 100 : 0) + '%';
      ticking = false;
    });
  };
  addEventListener('scroll', update, { passive: true });
  update();
}

let cursorEl = null;
function initCursor() {
  if (reduced || !finePointer || cursorEl) return;
  cursorEl = document.createElement('div');
  cursorEl.id = 'atelier-cursor';
  document.body.appendChild(cursorEl);
  let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy, raf = 0;
  addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY;
    cursorEl.style.opacity = '1';
    if (!raf) raf = requestAnimationFrame(function draw() {
      cx += (tx - cx) * .28; cy += (ty - cy) * .28;
      cursorEl.style.left = cx + 'px'; cursorEl.style.top = cy + 'px';
      raf = 0;
      if (Math.abs(tx - cx) + Math.abs(ty - cy) > .5) raf = requestAnimationFrame(draw);
    });
  }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    if (e.target.closest?.('a,button,[role=button],.product-card')) cursorEl.classList.add('is-over');
    else cursorEl.classList.remove('is-over');
  });
}

// ------------------------------------------------------------------
// 4. Magnetic buttons + pointer-tilt cards
// ------------------------------------------------------------------
function bindInteractions(root = document) {
  if (!finePointer || reduced) return;
  root.querySelectorAll('button,.btn,[data-magnetic]').forEach((el) => {
    if (el.dataset.magneticBound) return;
    el.dataset.magneticBound = '1';
    el.dataset.magnetic = '';
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * .055}px,${dy * .09}px)`;
    }, { passive: true });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
  root.querySelectorAll('.home-category-card,.home-age-card,.home-story-tile,.journal-card').forEach((el) => {
    if (el.dataset.depthBound) return;
    el.dataset.depthBound = '1';
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (e.target.closest('button,a,input')) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      el.style.transform = `perspective(900px) rotateX(${-y * 2.1}deg) rotateY(${x * 2.4}deg) translateY(-3px)`;
    }, { passive: true });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

// ------------------------------------------------------------------
// 5. Route curtain (green wipe with "playroom." on hash change)
// ------------------------------------------------------------------
let curtain = null;
function initCurtain() {
  if (curtain) return;
  curtain = document.createElement('div');
  curtain.id = 'atelier-transition';
  document.body.appendChild(curtain);
  let lastHash = location.hash;
  addEventListener('hashchange', () => {
    if (reduced || location.hash === lastHash) return;
    lastHash = location.hash;
    curtain.classList.remove('leave');
    curtain.classList.add('active');
    setTimeout(() => {
      curtain.classList.remove('active');
      curtain.classList.add('leave');
      setTimeout(() => curtain.classList.remove('leave'), 700);
    }, 90);
  });
}

// ------------------------------------------------------------------
// 6. Direction-aware header chrome with a damped spring — ported 1:1
//    from the approved prototype: the announcement collapses, the two-
//    tier header becomes a single 57px line on scroll down and expands
//    again on scroll up; the shell fixes itself once scrolled.
// ------------------------------------------------------------------
function initHeader() {
  const shell = document.getElementById('siteChrome');
  const placeholder = document.getElementById('siteChromePlaceholder');
  if (!shell || !placeholder) return;
  const announcement = shell.querySelector('.announcement');
  const header = shell.querySelector('.header');
  const main = header?.querySelector('.head-main');
  const nav = header?.querySelector('.nav');
  if (!announcement || !header || !main || !nav) return;
  let lastY = scrollY, directionTravel = 0, target = 0, progress = 0, velocity = 0, raf = 0, lastTime = 0;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const mobile = () => matchMedia('(max-width:700px)').matches;
  const tight = () => matchMedia('(max-width:1100px)').matches;
  const clearNavLayout = () => ['position', 'top', 'left', 'right', 'width', 'max-width', 'max-height', 'flex-wrap', 'align-items', 'gap', 'z-index'].forEach((k) => nav.style.removeProperty(k));
  const apply = () => {
    const p = clamp(progress, 0, 1), isMobile = mobile(), isTight = tight(), compact = p > .78;
    const annH = (isMobile ? 29 : 32) * (1 - p);
    announcement.style.height = annH.toFixed(2) + 'px';
    announcement.style.opacity = (1 - p).toFixed(3);
    announcement.style.pointerEvents = p > .96 ? 'none' : 'auto';
    const baseMain = isMobile ? 67 : 78, compactMain = 57;
    main.style.height = (baseMain + (compactMain - baseMain) * p).toFixed(2) + 'px';
    main.style.minHeight = '0';
    const fontSize = (isMobile ? 23 : 25) - p * 2;
    const wordmark = header.querySelector('.wordmark');
    if (wordmark) wordmark.style.fontSize = fontSize.toFixed(2) + 'px';
    const mark = header.querySelector('.mark');
    if (mark) { const size = 23 - p * 2.5; mark.style.width = size.toFixed(2) + 'px'; mark.style.height = size.toFixed(2) + 'px'; }
    const search = header.querySelector('.head-search');
    if (search) search.style.width = `min(${(280 - 48 * p).toFixed(1)}px, 100%)`;
    const actions = header.querySelector('.head-actions');
    if (actions) actions.style.gap = (17 - 4 * p).toFixed(2) + 'px';
    main.style.gap = (20 - 5 * p).toFixed(2) + 'px';

    if (isMobile) {
      // Mobile stays a single row; the hamburger exposes every nav destination.
      clearNavLayout();
      ['display', 'height', 'opacity', 'overflow', 'transform', 'border-top-width', 'pointer-events'].forEach((k) => nav.style.removeProperty(k));
    } else if (compact && isTight) {
      // At tablet widths, preserve a clean single-row header and put every nav item in the menu.
      nav.style.display = nav.classList.contains('open') ? 'flex' : 'none';
      nav.style.position = 'absolute'; nav.style.top = '57px'; nav.style.left = '0'; nav.style.right = '0'; nav.style.width = 'auto';
      nav.style.maxWidth = 'none'; nav.style.maxHeight = 'calc(100vh - 70px)'; nav.style.height = 'auto'; nav.style.overflow = 'auto';
      nav.style.flexWrap = 'nowrap'; nav.style.alignItems = 'flex-start'; nav.style.gap = '18px'; nav.style.transform = 'none';
      nav.style.borderTopWidth = '1px'; nav.style.pointerEvents = 'auto'; nav.style.zIndex = '5';
    } else if (compact) {
      // Desktop compact layout: nav is overlaid in the same 57px band as logo and actions.
      nav.style.display = 'flex'; nav.style.position = 'absolute'; nav.style.top = '0'; nav.style.left = '50%'; nav.style.right = 'auto';
      nav.style.width = 'max-content'; nav.style.maxWidth = 'calc(100% - 390px)'; nav.style.maxHeight = 'none'; nav.style.height = '57px';
      nav.style.overflow = 'visible'; nav.style.flexWrap = 'nowrap'; nav.style.alignItems = 'center'; nav.style.gap = 'clamp(8px, 1vw, 15px)';
      nav.style.transform = 'translateX(-50%)'; nav.style.borderTopWidth = '0px'; nav.style.pointerEvents = 'auto'; nav.style.zIndex = '2';
    } else {
      // Restore the normal two-tier expanded header when scrolling upward.
      clearNavLayout();
      nav.style.display = 'flex'; nav.style.height = (43 - 6 * p).toFixed(2) + 'px'; nav.style.opacity = '1'; nav.style.overflow = 'visible';
      nav.style.transform = `translate3d(0,${(-1 * p).toFixed(2)}px,0)`; nav.style.borderTopWidth = '1px'; nav.style.pointerEvents = 'auto';
    }
    shell.style.width = '100%';
    shell.style.borderRadius = '0px';
    shell.style.background = '#f0e5d7';
    shell.style.boxShadow = `0 ${(.5 + 7 * p).toFixed(2)}px ${(3 + 18 * p).toFixed(2)}px rgba(72,45,27,${(.035 + .055 * p).toFixed(3)})`;
    shell.classList.toggle('is-compact', compact);
    if (scrollY > 10) shell.classList.add('is-fixed'); else shell.classList.remove('is-fixed');
  };
  const tick = (now) => {
    raf = 0;
    const dt = clamp(lastTime ? (now - lastTime) / 1000 : 1 / 60, 1 / 240, 1 / 30); lastTime = now;
    const acceleration = (target - progress) * 250 - velocity * 30;
    velocity += acceleration * dt; progress += velocity * dt;
    if (progress < 0) { progress = 0; if (target === 0) velocity = 0; }
    if (progress > 1) { progress = 1; if (target === 1) velocity = 0; }
    if (Math.abs(target - progress) < .0008 && Math.abs(velocity) < .008) { progress = target; velocity = 0; apply(); lastTime = 0; return; }
    apply(); raf = requestAnimationFrame(tick);
  };
  const requestSpring = () => { if (reduced) { progress = target; velocity = 0; apply(); return; } if (!raf) { lastTime = 0; raf = requestAnimationFrame(tick); } };
  const onScroll = () => {
    const y = scrollY, dy = y - lastY; lastY = y;
    if (y < 48) { target = 0; directionTravel = 0; }
    else if (Math.abs(dy) > .35) { directionTravel += dy; if (directionTravel > 5.5) { target = 1; directionTravel = 0; } else if (directionTravel < -5.5) { target = 0; directionTravel = 0; } }
    requestSpring();
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { placeholder.style.height = mobile() ? '96px' : '153px'; apply(); }, { passive: true });
  placeholder.style.height = mobile() ? '96px' : '153px'; apply();
}

// ------------------------------------------------------------------
// 7. Footer reveal + badge pulse helpers
// ------------------------------------------------------------------
export function initFooterReveal() {
  const targets = $$('.footer-cta,.footer-brand,.footer-col,.footer-trust,.footer-bottom');
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('footer-visible'));
    return;
  }
  targets.forEach((el, i) => {
    if (el.dataset.footerMotionBound) return;
    el.dataset.footerMotionBound = '1';
    el.setAttribute('data-footer-reveal', '');
    el.style.setProperty('--footer-delay', `${Math.min(i % 5, 3) * 70}ms`);
  });
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('footer-visible'); io.unobserve(e.target); }
  }), { threshold: .12, rootMargin: '0px 0px -26px 0px' });
  targets.forEach((el) => { if (!el.classList.contains('footer-visible')) io.observe(el); });
}

// badge pulse on cart/wishlist interactions (reference detail)
export function pulseBadge(which = '#openCart,#openWishlist') {
  document.addEventListener('click', (e) => {
    const count = e.target.closest(which);
    if (count && !reduced) {
      const badge = count.querySelector('.count');
      if (badge) {
        badge.classList.remove('pulse');
        void badge.offsetWidth;
        badge.classList.add('pulse');
      }
    }
  });
}


// ------------------------------------------------------------------
// Master refresh — call after every route render (app.js calls this).
// ------------------------------------------------------------------
export function motionRefresh() {
  initReveal();
  bindSpots();
  bindInteractions();
  initFooterReveal();
}

let inited = false;
export function initMotion() {
  if (inited) return;
  inited = true;
  initProgress();
  initCursor();
  initCurtain();
  initHeader();
  pulseBadge();
  motionRefresh();
  listeners.add(() => motionRefresh()); // state changes may re-render drawers/cards
}
