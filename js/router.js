// Hash router for the rebuilt static site — same route names as the reference (#/catalog, #/product/..., etc.)
import { $, $$ } from './dom.js';
import { state } from './store.js';

const routes = new Map();
let currentPath = '';

export const app = () => $('#app');

// ---- Every page opens at the top ----
// Reloads never restore the previous scroll position (history.scrollRestoration is
// set to 'manual' in index.html), and each route render jumps to the top instantly
// so a newly opened page never starts mid-scroll.
function jumpToTop() {
  const html = document.documentElement;
  const prev = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto'; // bypass css scroll-behavior:smooth for the jump
  window.__lenis?.scrollTo(0, { immediate: true, force: true });
  window.scrollTo(0, 0);
  html.style.scrollBehavior = prev;
}
let holdScroll = false;
// In-page controls (catalog filters, sorting) call this so a same-page update
// does not yank the visitor back to the top.
export function holdScrollOnce() { holdScroll = true; }

export function registerRoutes(map) {
  Object.entries(map).forEach(([k, fn]) => routes.set(k, fn));
}

export function route() {
  const h = location.hash || '#/';
  const raw = h.slice(2);
  const [path = '', query = ''] = raw.split('?');
  return { path: '/' + path.replace(/^\//, ''), params: new URLSearchParams(query) };
}

export function go(path) {
  const target = '#' + path;
  if (location.hash === target) jumpToTop();
  else location.hash = target;
  $('#mainNav')?.classList.remove('open');
}

let firstRender = true;
export function render() {
  const r = route();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Land at the top of the page — on reload, on link clicks, on every route.
  // (held back once for same-page filter tweaks)
  const keepScroll = holdScroll;
  holdScroll = false;
  if (!keepScroll) jumpToTop();
  let html = null;
  for (const [match, fn] of routes.entries()) {
    if (matchRoute(r.path, match)) { html = fn(r); break; }
  }
  const appEl = $('#app');
  appEl.innerHTML = html || notFoundPage();
  wireReveal();
  if (!firstRender) {
    app().classList.remove('route-arrive');
    if (!reduced) { void app().offsetWidth; app().classList.add('route-arrive'); }
  }
  firstRender = false;
  currentPath = r.path;
  syncNav();
}

// Reveal-on-scroll, as in the reference.
export function wireReveal() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduced) {
    $$('.reveal').forEach((e) => e.classList.add('visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
  }), { threshold: .08 });
  $$('.reveal:not(.visible)').forEach((e) => io.observe(e));
}

function syncNav() {
  const header = $('.header');
  if (!header) return;
  const path = route().path;
  header.querySelectorAll('.nav a').forEach((a) => {
    const href = (a.getAttribute('href') || '').replace(/^#/, '');
    let active = false;
    if (path === '/catalog') active = href.startsWith('/catalog');
    else if (path.startsWith('/product/')) active = href === '/catalog';
    else if (path === href && ['/gift-finder', '/journal', '/community'].includes(path)) active = true;
    else if (path.startsWith('/journal') && href === '/journal') active = true;
    else if (path.startsWith('/catalog') && href.includes('category=')) active = href === currentNavHref(path);
    a.classList.toggle('active', active);
  });
}
function currentNavHref(path) {
  const cat = route().params.get('category');
  return cat ? '/catalog?category=' + encodeURIComponent(cat) : '/catalog';
}


// Route key matching: exact for '/', exact-or-subpath for plain keys ('/journal'
// matches '/journal' and '/journal/x'), prefix for keys ending in '/' ('/product/').
function matchRoute(path, key) {
  if (key === '/') return path === '/';
  const base = key.endsWith('/') ? key.slice(0, -1) : key;
  return path === base || path.startsWith(base + '/');
}

// ---- injection points (wired by app.js at startup) ----
let notFoundPage = () => '<div>Not found</div>';
export function setNotFound(fn) { notFoundPage = fn; }


