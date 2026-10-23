// Playroom Atelier — application shell. Wires global chrome (header, drawer, search,
// modal, toasts, compare dock) and defines every route page, faithful to the reference.
import { $, $$, safe, toast } from './dom.js';
import {
  formatMoney, state, addToCart, changeQty, removeFromCart, clearCart,
  cartSubtotal, cartCount, deliveryFee, discountAmount, persist,
  createDemoOrder, getOrder, toggleWishlist, listeners,
  read as storageRead, write as storageWrite,
  PERSONALISE_FEE, GIFT_WRAP_ID, GIFT_WRAP_PRICE, addGiftWrap, hasGiftWrap, removeGiftWrap,
  pointsBalance, pointsEarnedFor, redeemLeaves, ensureReferral,
  createReturn, returnsForOrder,
} from './store.js';
import { products, byId, bySlug, categories, photos, heroPhoto, img, photo, SELLERS, fbtFor, stageProducts } from './data.js';
import { productCard, sectionHead, bindProductActions } from './components.js';
import {
  AGE_STAGES, stageById, ADVISORY_NOTE, ADVISORS, DESIGN_STANDARDS, MATERIALS_BY_KIND,
  SAFETY_DEMO_NOTE, SAFETY_NOTE_SMALL_PARTS, reviewsForProduct, reviewDistribution,
  QNA_GENERAL, QNA_BY_CATEGORY, PRESS_WALL, PRESS_AWARDS, PRESS_NOTE, QUICKVIEW_NOTE,
} from './premium-data.js';
import {
  promiseLine, fmtDay, fmtLongDay, standardDate, expressDate, deliveryOptions,
  chosenDelivery, setChosenDelivery, effectiveDeliveryFee, pickableDays, fromIsoDay,
  isoDay, DELIVERY_FEE_EXPRESS, DELIVERY_FEE_PICKDAY,
} from './delivery.js';
import { PAYMENT_METHODS, generatePayer, generatePayment, validatePayment, gatewayTxnId, CARRIER, fedexTrackingNumber, packageMeta, fedexTimeline, fedexStatus } from './gateway.js';
import { render, go, route, registerRoutes, setNotFound, holdScrollOnce } from './router.js';
import { initMotion, motionRefresh } from './motion.js';
import { initScrollExperience, refreshHeroScene } from './hero-scene.js';
import { initSupport } from './support.js?v=3';
import { initWelcome } from './welcome.js';
import { wireGateway, renderGatewayPanel, rewirePay, brandRowHTML, confettiBurst, completeOrder } from './checkout-gateway.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let mobileMenu = false;

// ------------------------------------------------------------------
// Drawer (cart / wishlist)
// ------------------------------------------------------------------
function openDrawer(type = 'cart') {
  $('#drawerOverlay').classList.add('open');
  document.body.classList.add('lock');
  $('#drawerTitle').textContent = type === 'wishlist' ? 'Saved things' : 'Your bag';
  renderDrawer(type);
}
function closeDrawer() {
  $('#drawerOverlay').classList.remove('open');
  document.body.classList.remove('lock');
}
const GIFT_BOW_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="9.5" width="17" height="10.5" rx="1"/><path d="M3.5 13.2h17M12 9.5V20M12 9.5C9.6 9.5 7 8.3 7 6.2 7 4.8 8.1 3.9 9.5 3.9c2 0 2.5 2.6 2.5 5.6Zm0 0c2.4 0 5-1.2 5-3.3 0-1.4-1.1-2.3-2.5-2.3-2 0-2.5 2.6-2.5 5.6Z"/></svg>';

// "Complete the gift" — wrap as a cart line, plus one thoughtful pairing.
function drawerGiftPanel() {
  if (!state.cart.length) return '';
  const wrap = hasGiftWrap();
  const inCart = new Set(state.cart.map((x) => x.productId));
  const anchor = state.cart.map((x) => byId(x.productId)).find(Boolean) || products[0];
  const mate = (fbtFor(anchor, 3) || []).slice(1).find((x) => x && !inCart.has(x.id))
    || products.find((x) => x.price <= 700 && !inCart.has(x.id));
  return `<div class="drawer-gift"><div class="drawer-gift-head"><span class="mono">COMPLETE THE GIFT</span><span class="mono muted">DEMO ADD-ONS</span></div><div class="drawer-gift-row"><button class="gift-add${wrap ? ' is-on' : ''}" type="button" data-gift-wrap${wrap ? ' disabled' : ''}><span class="gift-add-icon" aria-hidden="true">${GIFT_BOW_SVG}</span><span><b>Gift wrapping</b><small>Hand-tied ribbon · ${formatMoney(GIFT_WRAP_PRICE)}</small></span><i>${wrap ? '✓' : '+'}</i></button>${mate ? `<button class="gift-add" type="button" data-drawer-add="${mate.id}"><img src="${mate.image}" alt="" loading="lazy"><span><b>${safe(mate.name)}</b><small>${formatMoney(mate.price)} · often paired</small></span><i>+</i></button>` : ''}</div><p class="drawer-gift-note">Gift note, hidden prices and a chosen delivery day live at checkout.</p></div>`;
}

function renderDrawer(type) {
  type = type || ($('#drawerTitle').textContent === 'Saved things' ? 'wishlist' : 'cart');
  const body = $('#drawerBody'), foot = $('#drawerFoot');
  if (type === 'wishlist') {
    const items = state.wishlist.map(byId).filter(Boolean);
    body.innerHTML = items.length ? items.map((p) =>
      `<div class="cart-line"><a href="#/product/${p.slug}" onclick="window.__closeDrawer()"><img src="${p.image}" alt="${safe(p.name)}"></a><div><h4><a href="#/product/${p.slug}">${safe(p.name)}</a></h4><p>${formatMoney(p.price)}</p><button class="btn small" data-add="${p.id}">Add to bag</button></div><button class="remove-line" data-wish="${p.id}">Remove</button></div>`
    ).join('') : `<div class="empty-cart"><div class="empty-icon">♡</div><h3>Save it for later.</h3><p>Tap a heart anywhere in the shop and your saved finds will be waiting here.</p><button class="btn" id="drawerShop">Explore toys ↗</button></div>`;
    foot.innerHTML = `<button class="btn full" id="drawerContinue">Continue exploring <span class="arrow">↗</span></button>`;
    return;
  }
  const sub = cartSubtotal(), ship = deliveryFee(sub);
  if (!state.cart.length) {
    body.innerHTML = `<div class="empty-cart"><div class="empty-icon">✳</div><h3>Your bag is taking a breather.</h3><p>There are so many little worlds waiting to be discovered. Find something that feels right.</p><button class="btn" id="drawerShop">Explore toys ↗</button></div>`;
    foot.innerHTML = '';
    return;
  }
  body.innerHTML = `<div class="mono muted">${cartCount()} items · a good start</div>
<div class="progress-track"><i style="width:${Math.min(100, sub / 1499 * 100)}%"></i></div>
<p class="drawer-note">${sub >= 1499 ? 'You’ve unlocked complimentary delivery.' : `Add ${formatMoney(1499 - sub)} more for complimentary delivery.`}</p>
${state.cart.map((x) => {
    if (x.special === 'gift-wrap') return `<div class="cart-line cart-line--wrap"><span class="wrap-tile" aria-hidden="true">${GIFT_BOW_SVG}</span><div><h4>Gift wrapping</h4><p>Hand-tied ribbon, note-ready · demo add-on</p><button class="remove-line" data-remove="${x.key}">Remove</button></div><div class="cart-price">${formatMoney(x.unitPrice * x.qty)}</div></div>`;
    const p = byId(x.productId) || { slug: '', name: x.name, image: x.image, age: '', price: x.unitPrice };
    const href = p.slug ? '#/product/' + p.slug : '#/catalog';
    const pers = x.personalisation ? `<a class="pers-chip" href="${href}" onclick="window.__closeDrawer()" title="Change the name on the product page">${p.persKind === 'embroidery' ? 'Embroidered' : 'Engraved'} “${safe(x.personalisation)}” · edit</a>` : '';
    return `<div class="cart-line"><a href="${href}" onclick="window.__closeDrawer()"><img src="${x.image || p.image}" alt="${safe(p.name)}"></a><div><h4><a href="${href}">${safe(p.name)}</a></h4><p>${formatMoney(x.unitPrice)} · ${safe(p.age || '')}</p>${pers}<div class="qty"><button data-qty="${x.key}" data-delta="-1" aria-label="Decrease">−</button><span>${x.qty}</span><button data-qty="${x.key}" data-delta="1" aria-label="Increase">+</button></div><button class="remove-line" data-remove="${x.key}">Remove</button></div><div class="cart-price">${formatMoney(x.unitPrice * x.qty)}</div></div>`;
  }).join('')}${drawerGiftPanel()}`;
  const promise = promiseLine();
  foot.innerHTML = `<div class="subtotal-row"><span>Subtotal</span><span>${formatMoney(sub)}</span></div><div class="subtotal-row" style="font-size:11px;font-weight:400;color:var(--muted)"><span>Delivery</span><span>${ship ? formatMoney(ship) : 'Complimentary'}</span></div><p class="drawer-promise">Order within <b data-cd-time>${promise.within}</b> for delivery by <b data-cd-date>${promise.date}</b> · demo estimate</p><p class="drawer-note">Taxes included where applicable. Discount codes are applied at checkout. This is a demonstration store.</p><button class="btn full" id="drawerCheckout">Continue to checkout <span class="arrow">↗</span></button><button class="text-link" id="drawerContinue" style="display:block;margin:15px auto 0">Keep looking <span>↗</span></button>`;
  startPromiseTicker();
}
window.__closeDrawer = closeDrawer;

// ------------------------------------------------------------------
// Search overlay
// ------------------------------------------------------------------
function openSearch() {
  const panel = $('#searchPanel');
  panel.classList.add('open');
  document.body.classList.add('lock');
  $('#bigSearchInput').focus();
  renderSearchExtras();
  searchCatsHTML();
  updateSearchResults($('#bigSearchInput').value);
}
function closeSearch() {
  $('#searchPanel').classList.remove('open');
  document.body.classList.remove('lock');
}
function updateSearchResults(q) {
  const term = String(q).trim();
  const results = term
    ? products.filter((p) => `${p.name} ${p.category} ${p.desc} ${p.age} ${p.benefit}`.toLowerCase().includes(term.toLowerCase())).slice(0, 8)
    : [...products].sort((a, b) => b.reviews - a.reviews).slice(0, 4);
  $('#searchHint').innerHTML = term
    ? `${results.length} suggestion${results.length === 1 ? '' : 's'} for “${safe(term)}”<span class="search-hint-sub">${results.length >= 8 ? ' · showing the first eight' : ''}</span>`
    : 'Popular this month · or begin with a kind of play';
  const extras = $('#searchExtras'); if (extras) extras.hidden = !!term;
  const cats = $('#searchCats'); if (cats) cats.hidden = !!term;
  const seeAll = $('#searchSeeAll');
  if (seeAll) {
    seeAll.hidden = !term;
    if (term) { seeAll.setAttribute('href', '#/catalog?q=' + encodeURIComponent(term)); seeAll.innerHTML = `See every result for “${safe(term)}” <span>↗</span>`; }
  }
  $('#searchResults').innerHTML = results.map(productCard).join('') || `<div class="search-empty"><p>Nothing matched “${safe(term)}”. Try “wooden”, “puzzle” or “teddy”.</p><a class="text-link" href="#/catalog" data-close-search>Browse the whole toy box <span>↗</span></a></div>`;
}

// ------------------------------------------------------------------
// Modal (contact success, feedback, reviews, compare)
// ------------------------------------------------------------------
function openModal(title, html) {
  $('#modalTitle').textContent = title;
  $('#modalContent').innerHTML = html;
  $('#modalBackdrop').classList.add('open');
  document.body.classList.add('lock');
}
function closeModal() {
  $('#modalBackdrop').classList.remove('open');
  document.body.classList.remove('lock');
}

// ------------------------------------------------------------------
// Compare dock
// ------------------------------------------------------------------
function renderCompareDock() {
  const d = $('#compareDock');
  window.__compare = window.__compare || [];
  if (!window.__compare.length) { d.classList.remove('show'); return; }
  d.classList.add('show');
  d.innerHTML = `<span class="mono">Compare (${window.__compare.length}/3)</span>${window.__compare.map((id) => {
    const p = byId(id); return `<img class="compare-thumb" src="${p?.image || ''}" alt="${safe(p?.name || '')}">`;
  }).join('')}<button id="openCompare">Compare now ↗</button><button id="clearCompare" style="background:transparent;color:white">Clear</button>`;
}
function toggleCompare(id, on) {
  window.__compare = window.__compare || [];
  if (on) {
    if (window.__compare.length >= 3) { toast('Three is the limit.', 'Remove one first.'); const el = $(`[data-compare="${id}"]`); if (el) el.checked = false; return; }
    if (!window.__compare.includes(id)) window.__compare.push(id);
  } else window.__compare = window.__compare.filter((x) => x !== id);
  const card = $(`[data-compare="${id}"]`);
  if (card) card.checked = window.__compare.includes(id);
  renderCompareDock();
}
function showCompare() {
  if (!window.__compare.length) return;
  const ps = window.__compare.map(byId).filter(Boolean);
  openModal('A closer look', `<div class="compare-scroll"><table class="compare-table"><thead><tr><th>Details</th>${ps.map((p) => `<th><img src="${p.image}" alt="${safe(p.name)}"><br>${safe(p.name)}<br><b>${formatMoney(p.price)}</b></th>`).join('')}</tr></thead><tbody>${[['Age', (p) => p.age], ['Category', (p) => p.category], ['Rating', (p) => '★ ' + p.rating + ' / 5'], ['What’s included', (p) => p.detail], ['Play value', (p) => p.benefit], ['Availability', () => 'In stock (demo)']].map((row) => `<tr><td>${row[0]}</td>${ps.map((p) => `<td>${safe(row[1](p))}</td>`).join('')}</tr>`).join('')}<tr><td></td>${ps.map((p) => `<td><button data-add="${p.id}">Add to bag ↗</button><br><button data-compare-remove="${p.id}">Remove</button></td>`).join('')}</tr></tbody></table></div>`);
}

// ------------------------------------------------------------------
// Counts
// ------------------------------------------------------------------
function updateCounts() {
  $('#cartCount').textContent = cartCount();
  $('#wishCount').textContent = state.wishlist.length;
}
listeners.add(() => {
  updateCounts();
  renderCompareDock();
  if ($('#drawerOverlay').classList.contains('open')) renderDrawer();
  store_refreshHearts();
});
function store_refreshHearts() {
  $$('[data-wish]').forEach((b) => {
    const active = state.wishlist.includes(b.dataset.wish);
    if (b.classList.contains('heart')) {
      b.classList.toggle('active', active);
      b.setAttribute('aria-label', `${active ? 'Remove from' : 'Add to'} wishlist`);
    } else if (b.classList.contains('btn') && b.textContent.includes('♥') || b.textContent.trim() === '♥' || '$♥♡'.includes(b.textContent.trim())) {
      b.textContent = active ? '♥' : '♡';
    }
  });
}
window.__refreshHearts = store_refreshHearts;

// ------------------------------------------------------------------
// Cookie note + back-to-top
// ------------------------------------------------------------------
function initChrome() {
  if (!localStorage.getItem('playroom-cookie')) setTimeout(() => $('#cookieNote').classList.add('show'), 1800);
  $('#cookieOkay').addEventListener('click', () => { localStorage.setItem('playroom-cookie', '1'); $('#cookieNote').classList.remove('show'); });
  $('#cookieDismiss').addEventListener('click', () => $('#cookieNote').classList.remove('show'));
  $('#backTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));
  window.addEventListener('scroll', () => $('#backTop').classList.toggle('show', window.scrollY > 700), { passive: true });
  const header = $('.header');
  window.addEventListener('scroll', () => header.classList.toggle('is-scrolled', window.scrollY > 18), { passive: true });
}

// ------------------------------------------------------------------
// Sponsored picks — a swipeable, clearly-labelled band of partner
// products. Every slide carries the Sponsored chip; drag it, arrow
// through it, or tap the dots.
// ------------------------------------------------------------------
const SPONSORED_PICKS = [
  { slug: 'the-big-idea-marble-run', partner: 'Wonderworks', headline: 'Big ideas, <em>one marble at a time.</em>', blurb: 'Design a route, test a theory, then watch gravity do its thing. A 72-piece build that grows with them and gets rebuilt a hundred different ways.' },
  { slug: 'orbit-magnetic-building-tiles', partner: 'Meridian Playworks', headline: 'Towers, tunnels, <em>and all the ideas in between.</em>', blurb: 'Forty-two translucent tiles with magnets that hold real towers — and a finish that survives being a castle, a car park and a stage.' },
  { slug: 'little-architect-wooden-blocks', partner: 'Little Grove Atelier', headline: 'The first blocks that <em>last a childhood.</em>', blurb: 'Forty-eight hand-sanded beechwood blocks, finished with beeswax and quiet patience. The classic that gets handed down, not thrown out.' },
];
function sponsoredPicks() {
  return SPONSORED_PICKS.map((s) => ({ ...s, p: bySlug(s.slug) })).filter((s) => s.p);
}
function sponsoredSlide(s, i, n) {
  return `<article class="sponsored-slide" data-spslide="${i}" aria-hidden="${i !== 0}"><a class="sponsored-media" href="#/product/${s.p.slug}" aria-label="View ${safe(s.p.name)}" tabindex="${i === 0 ? 0 : -1}"><img src="${s.p.image}" alt="${safe(s.p.name)}" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" draggable="false"></a><div class="sponsored-copy"><div class="sponsored-flag"><span class="sponsored-chip">Sponsored</span><span class="mono">In partnership with ${safe(s.partner)}</span></div><div class="sponsored-name">${safe(s.p.name)} — with ${safe(s.partner)}</div><h2>${s.headline}</h2><p class="sponsored-blurb">${s.blurb}</p><div class="sponsored-meta"><span class="sponsored-price">${formatMoney(s.p.price)}</span><span class="sponsored-note"><span class="sponsored-stars" aria-hidden="true">★★★★★</span><b>${s.p.rating}</b> · ${s.p.reviews} notes</span></div><a class="btn" href="#/product/${s.p.slug}" tabindex="${i === 0 ? 0 : -1}">Shop the featured pick <span class="arrow">↗</span></a><p class="sponsored-fineprint">Sponsored placement — paid for by ${safe(s.partner)}, chosen and styled by Playroom. Our edit stays ours.</p></div></article>`;
}

// ------------------------------------------------------------------
// Pages
// ------------------------------------------------------------------
function renderHome() {
  const featured = products.filter((p) => p.featured).slice(0, 8);
  const picks = sponsoredPicks();
  const tone = ['#e7d7c5', '#dbe6d5', '#ead4cb', '#d5e2e8', '#eadfbd', '#d9d7c9', '#e6d8c8', '#dce5dd', '#e9d9b5', '#dce4e8'];
  const catImage = { 'Building & STEM': 0, 'Games & Puzzles': 8, 'Soft & Plush': 12, 'Vehicles & Adventures': 16, 'Art & Imagination': 20, 'Baby & Early Years': 28, 'Pretend & Role Play': 18, 'Outdoor & Active': 24, 'Science & Discovery': 26, 'Music & Movement': 22 };
  const ageCards = [
    { age: '0–2 years', label: 'First little discoveries', img: photos[28], note: 'Soft beginnings', href: '#/stage/first-discoveries' },
    { age: '3–5 years', label: 'Big imaginations', img: photos[18], note: 'Make-believe magic', href: '#/stage/big-imaginations' },
    { age: '6–8 years', label: 'Build, test, repeat', img: photos[1], note: 'Room to experiment', href: '#/stage/build-and-question' },
    { age: '9–12 years', label: 'Curiosity in motion', img: photos[26], note: 'For the why-askers', href: '#/stage/independent-minds' }];
  const storyTiles = [
    { n: '01', title: 'Open-ended play', sub: 'No single right way to play.', img: photos[1], href: '#/catalog?category=' + encodeURIComponent('Building & STEM') },
    { n: '02', title: 'Small-world stories', sub: 'Whole universes in miniature.', img: photos[18], href: '#/catalog?category=' + encodeURIComponent('Pretend & Role Play') },
    { n: '03', title: 'Hands-on discovery', sub: 'Curiosity you can hold.', img: photos[27], href: '#/catalog?category=' + encodeURIComponent('Science & Discovery') }];
  return `<div class="route-enter home-premium">
 <section class="home-hero home-hero--integrated"><div class="hero-cinema hero-cinema--warm" data-hero-scene>
  <div class="hero-cinema-media" aria-hidden="true">
    <div class="hero-cinema-parallax" data-hero-parallax>
      <img class="hero-cinema-image" data-hero-image src="assets/img/hero.jpg" alt="" width="1672" height="941" fetchpriority="high" decoding="async">
      <video class="hero-cinema-video" data-hero-video data-source="assets/img/hero.jpg" autoplay muted loop playsinline preload="auto" poster="assets/img/hero.jpg" aria-hidden="true">
        <source src="assets/video/playroom-living.mp4" type="video/mp4">
      </video>
      <span class="hero-cinema-glow" aria-hidden="true"></span>
    </div>
  </div>
  <div class="hero-cinema-shade" aria-hidden="true"></div>
  <button class="hero-video-play" data-hero-video-play type="button" aria-label="Play the playroom film" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.2v13.6L19 12 8 5.2Z"/></svg></button>
  <div class="hero-editorial">
    <div class="hero-editorial-inner">
      <h1><span>Little things.</span><br><em>Big worlds.</em></h1>
      <p>Thoughtfully chosen toys that invite curiosity, build confidence and leave plenty of room for imagination.</p>
      <div class="hero-actions"><a class="btn light" href="#/catalog">Explore the collection <span class="arrow">↗</span></a><a href="#/gift-finder" class="hero-secondary-link">Find their next favourite <span>↗</span></a></div>
    </div>
  </div>
  <div class="hero-scene-caption"><span>THE PLAYROOM, IN MOTION</span><i></i><span>SCROLL TO EXPLORE</span></div>
 </div></section>
 <div class="home-main" data-home-main>
 <section class="section wrap home-categories-section"><div class="home-section-top"><div><div class="mono muted">A PLACE TO BEGIN</div><h2>What kind of play<br><em>feels right today?</em></h2></div><div class="home-section-aside"><p>Follow their current obsession, make room for a new one, or find a toy that invites them to make the rules.</p><a class="text-link" href="#/catalog">Shop all 110+ toys <span>↗</span></a></div></div><div class="home-category-grid">${categories.map((c, i) => `<button class="home-category-card reveal" data-category="${safe(c[0])}" style="--card-tone:${tone[i]};--delay:${(i % 5) * 60}ms"><span class="home-category-num">${String(i + 1).padStart(2, '0')}</span><div class="home-category-image"><img src="${photos[catImage[c[0]]]}" alt="${safe(c[0])} collection" loading="lazy" decoding="async"><span class="home-category-arrow">↗</span></div><div class="home-category-title"><div><h3>${safe(c[0])}</h3><p>${safe(c[1])}</p></div><span class="home-category-count">${products.filter((p) => p.category === c[0]).length} ideas</span></div></button>`).join('')}</div></section>
 <section class="section wrap home-favorites"><div class="home-section-top"><div><div class="mono muted">THE ONES WORTH COMING BACK TO</div><h2>Small things.<br><em>Lasting favourites.</em></h2></div><div class="home-section-aside"><p>For the rainy afternoon that turns into a whole world, the birthday they’ve been counting down to, or a little surprise for no reason at all.</p><a class="text-link" href="#/catalog?sort=popular">Browse the favourites <span>↗</span></a></div></div><div class="product-grid">${featured.map((p, i) => productCard(p, i)).join('')}</div></section>
 <section class="section wrap home-sponsored"><div class="home-section-top sponsored-top"><div><div class="mono muted">SPONSORED PLACEMENTS · PAID FOR, CLEARLY LABELLED</div><h2>The partner shelf,<br><em>openly sponsored.</em></h2></div><div class="home-section-aside"><p>Three independent workshops paid for a spot in this band. We chose the pieces and styled them ourselves — and every slide names who it comes from.</p><span class="sponsored-swipe-hint" data-sphint><span class="sponsored-swipe-ico" aria-hidden="true">↔</span> Drag or swipe the shelf — or use the arrows</span></div></div><div class="sponsored-carousel reveal" data-sponsored><div class="sponsored-viewport" data-spviewport tabindex="0" role="region" aria-label="Sponsored picks — swipe or drag sideways, or use the arrows"><div class="sponsored-track" data-sptrack>${picks.map((s, i) => sponsoredSlide(s, i, picks.length)).join('')}</div></div><div class="sponsored-controls"><div class="sponsored-nav"><button class="sponsored-arrow" type="button" data-sparrow="-1" aria-label="Previous sponsored pick">←</button><button class="sponsored-arrow" type="button" data-sparrow="1" aria-label="Next sponsored pick">→</button></div><div class="sponsored-dots" data-spdots>${picks.map((s, i) => `<button class="sponsored-dot${i === 0 ? ' active' : ''}" type="button" data-spdot="${i}" aria-label="Sponsored pick ${i + 1}"></button>`).join('')}</div><span class="sponsored-count mono" data-spcount aria-live="polite">01 / ${String(picks.length).padStart(2, '0')}</span></div></div></section>
 <section class="home-by-age"><div class="wrap"><div class="home-age-heading"><div><div class="mono">A GOOD FIT, AT EVERY AGE</div><h2>Growing up is<br><em>its own adventure.</em></h2></div><p>Age is a starting point, not a rulebook. These little paths help you find something that feels just right.</p></div><div class="home-age-grid">${ageCards.map((a, i) => `<a class="home-age-card reveal" href="${a.href}" style="--age-tone:${tone[i + 1]}"><div class="home-age-image"><img src="${a.img}" alt="${a.label}" loading="lazy" decoding="async"><span>${a.note}</span></div><div class="home-age-copy"><div><span class="mono">${a.age}</span><h3>${a.label}</h3></div><span class="age-arrow">↗</span></div></a>`).join('')}</div></div></section>
 <section class="section wrap home-story-section"><div class="home-section-top"><div><div class="mono muted">A FEW WAYS INTO THE WONDER</div><h2>Follow the<br><em>what-if.</em></h2></div><div class="home-section-aside"><p>Some days call for building something tall. Some call for inventing a tiny café. Sometimes the whole afternoon disappears into one very good question.</p></div></div><div class="home-story-grid">${storyTiles.map((t, i) => `<a href="${t.href}" class="home-story-tile story-tile-${i + 1} reveal"><img src="${t.img}" alt="${t.title}" loading="lazy" decoding="async"><div class="story-tile-overlay"><span class="mono">${t.n} / THE PLAY EDIT</span><h3>${t.title}</h3><p>${t.sub}</p><span class="story-tile-arrow">↗</span></div></a>`).join('')}</div></section>
 <section class="home-gifting"><div class="wrap home-gifting-panel"><div class="gifting-copy"><span class="mono">THE GIFT, SORTED</span><h2>Know a little person<br>worth <em>surprising?</em></h2><p>Tell us their age, the kind of things they love, and a comfortable budget. We’ll help you find a thoughtful place to start.</p><a class="btn light" href="#/gift-finder">Find their kind of magic <span class="arrow">↗</span></a><span class="gifting-footnote">No guesswork. Just a better starting point.</span></div><div class="gifting-art"><img src="${photos[47]}" alt="A thoughtful assortment of wooden toys ready to be gifted" loading="lazy" decoding="async"><div class="gifting-sticker">WRAPPED<br>IN WONDER ✳</div><div class="gifting-note"><span>THE GOOD GIFT GUIDE</span><b>Something they'll<br>come back to.</b></div></div></div></section>
 ${pressStripHTML()}
 <section class="section wrap home-journal"><div class="home-journal-intro"><span class="mono muted">NOTES FROM THE PLAYROOM</span><h2>Good ideas for<br><em>growing minds.</em></h2><p>A little guidance for choosing well, gifting thoughtfully and making more room for play in ordinary days.</p><a class="text-link" href="#/journal">Read the play notes <span>↗</span></a></div><a href="#/journal/choosing-a-toy" class="home-journal-feature"><div class="journal-feature-art"><img src="${photos[6]}" alt="Wooden construction pieces arranged on a natural surface" loading="lazy" decoding="async"><span class="journal-feature-arrow">↗</span></div><div class="journal-feature-meta"><span class="mono">THE THOUGHTFUL TOY GUIDE</span><span>5 MIN READ</span></div><h3>Choosing a toy that leaves room for imagination</h3></a><a href="#/journal/gifting-by-age" class="home-journal-feature"><div class="journal-feature-art"><img src="${photos[31]}" alt="A gift assortment of wooden toys" loading="lazy" decoding="async"><span class="journal-feature-arrow">↗</span></div><div class="journal-feature-meta"><span class="mono">THE GIFTING NOTE</span><span>4 MIN READ</span></div><h3>A more thoughtful way to choose a gift</h3></a></section>
 </div>
 </div>`;
}

function renderCatalog(params = new URLSearchParams()) {
  const category = params.get('category') || '', search = params.get('q') || '', sale = params.get('sale') === '1', age = params.get('age') || '', max = params.get('max') || '', sort = params.get('sort') || 'featured', stage = params.get('stage') || '';
  let filtered = products.filter((p) => (!category || p.category === category) && (!search || `${p.name} ${p.category} ${p.desc} ${p.benefit}`.toLowerCase().includes(search.toLowerCase())) && (!sale || p.old > p.price) && (!age || p.age === age) && (!stage || p.stageId === stage) && (!max || p.price <= +max));
  if (sort === 'price-low') filtered = [...filtered].sort((a, b) => a.price - b.price);
  if (sort === 'price-high') filtered = [...filtered].sort((a, b) => b.price - a.price);
  if (sort === 'rating') filtered = [...filtered].sort((a, b) => b.rating - a.rating);
  if (sort === 'newest') filtered = [...filtered].sort((a, b) => Number(b.fresh) - Number(a.fresh));
  if (sort === 'popular') filtered = [...filtered].sort((a, b) => b.reviews - a.reviews);
  const stageObj = stage ? stageById(stage) : null;
  const title = category || (sale ? 'Little treats / sale' : search ? `Results for “${safe(search)}”` : stageObj ? `Playing at ${stageObj.label}` : 'The whole toy box');
  return `<div class="route-enter"><div class="wrap page-top page-head"><div class="breadcrumbs"><a href="#/">Home</a><span> / </span><span>Shop</span>${category ? `<span> / </span><span>${safe(category)}</span>` : ''}</div><div class="mono muted">A considered collection · ${filtered.length} little discoveries</div><h1 class="page-title">${title}</h1><p class="page-intro">Good toys give a child somewhere to go with their imagination. Explore by kind of play, age, or whatever has caught their attention today.</p></div><div class="wrap catalog-layout"><aside class="filters" id="catalogFilters"><div class="filter-block expanded"><button class="filter-title">Shop by kind</button><div class="filter-options">${categories.map((c) => `<label class="check-row"><input type="radio" name="catFilter" value="${safe(c[0])}" ${category === c[0] ? 'checked' : ''}> ${safe(c[0])}</label>`).join('')}<label class="check-row"><input type="radio" name="catFilter" value="" ${!category ? 'checked' : ''}> All toys</label></div></div><div class="filter-block expanded"><button class="filter-title">Shop by age</button><div class="filter-options">${[...new Set(products.map((p) => p.age))].map((a) => `<label class="check-row"><input type="radio" name="ageFilter" value="${safe(a)}" ${age === a ? 'checked' : ''}> ${safe(a)}</label>`).join('')}<label class="check-row"><input type="radio" name="ageFilter" value="" ${!age ? 'checked' : ''}> Any age</label></div></div><div class="filter-block expanded"><button class="filter-title">Shop by stage</button><div class="filter-options">${AGE_STAGES.map((s) => `<label class="check-row"><input type="radio" name="stageFilter" value="${s.id}" ${stage === s.id ? 'checked' : ''}> ${safe(s.name)} · ${safe(s.label)}</label>`).join('')}<label class="check-row"><input type="radio" name="stageFilter" value="" ${!stage ? 'checked' : ''}> Any stage</label></div></div><div class="filter-block expanded"><button class="filter-title">Price, in rupees</button><div class="filter-options"><label class="check-row"><input type="radio" name="priceFilter" value="500" ${max === '500' ? 'checked' : ''}> Under ₹500</label><label class="check-row"><input type="radio" name="priceFilter" value="1000" ${max === '1000' ? 'checked' : ''}> Under ₹1,000</label><label class="check-row"><input type="radio" name="priceFilter" value="1500" ${max === '1500' ? 'checked' : ''}> Under ₹1,500</label><label class="check-row"><input type="radio" name="priceFilter" value="" ${!max ? 'checked' : ''}> Any price</label></div></div><div class="filter-block expanded"><button class="filter-title">A little less</button><div class="filter-options"><label class="check-row"><input type="checkbox" id="saleFilter" ${sale ? 'checked' : ''}> Show offers only</label></div></div><button class="text-link" id="clearFilters" style="margin-top:17px">Clear all filters ↗</button></aside><div><div class="products-controls"><div class="control-group"><span class="mono muted" id="resultCount">${filtered.length} items</span><button class="filter-chip ${!sale && !search ? 'active' : ''}" data-fastfilter="all">All</button><button class="filter-chip ${sale ? 'active' : ''}" data-fastfilter="sale">Offers</button><button class="filter-chip" data-fastfilter="new">Just landed</button></div><div class="control-group"><label for="sortSelect" class="mono muted">Sort</label><select id="sortSelect" class="sort-select"><option value="featured" ${sort === 'featured' ? 'selected' : ''}>Curated</option><option value="popular" ${sort === 'popular' ? 'selected' : ''}>Most loved</option><option value="newest" ${sort === 'newest' ? 'selected' : ''}>Just landed</option><option value="price-low" ${sort === 'price-low' ? 'selected' : ''}>Price: low to high</option><option value="price-high" ${sort === 'price-high' ? 'selected' : ''}>Price: high to low</option><option value="rating" ${sort === 'rating' ? 'selected' : ''}>Highest rated</option></select><div class="view-toggle"><button class="active" data-view="grid" aria-label="Grid view">▦</button><button data-view="list" aria-label="List view">☷</button></div></div></div><div class="product-grid" id="catalogGrid">${filtered.length ? filtered.map(productCard).join('') : '<div class="empty-state"><div class="mono muted">Nothing in this corner just yet</div><h3>Try a different little path.</h3><p>Change a filter or see everything in the toy box.</p><a class="btn" href="#/catalog" id="emptyReset">Show all toys ↗</a></div>'}</div><div style="display:flex;justify-content:center;margin-top:40px"><button class="btn outline" id="loadMore">You’ve seen the collection <span class="arrow">↗</span></button></div></div></div></div>`;
}

// ------------------------------------------------------------------
// Sponsored carousel behaviour — drag to swipe, arrows, dots, keys.
// ------------------------------------------------------------------
function wireSponsored() {
  const root = $('[data-sponsored]');
  if (!root) return;
  const viewport = $('[data-spviewport]', root);
  const track = $('[data-sptrack]', root);
  const slides = $$('.sponsored-slide', root);
  const count = $('[data-spcount]', root);
  const dots = $$('[data-spdot]', root);
  const hint = $('[data-sphint]'); // lives in the section heading, outside the carousel
  if (!viewport || !track || !slides.length) return;
  let index = 0, dragging = false, startX = 0, dx = 0, moved = false;
  let samples = [], wheelAcc = 0, wheelLock = 0, wheelIdle = 0;
  const pad = (n) => String(n).padStart(2, '0');
  // rubber-band when dragging past the first or last slide
  const damp = (raw) => ((index === 0 && raw > 0) || (index === slides.length - 1 && raw < 0) ? raw * 0.32 : raw);
  const dismissHint = () => { if (hint) hint.classList.add('is-off'); };
  const apply = (animate = true) => {
    track.style.transition = animate ? '' : 'none';
    track.style.transform = `translateX(${-index * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
    if (count) count.textContent = `${pad(index + 1)} / ${pad(slides.length)}`;
    slides.forEach((s, i) => {
      s.setAttribute('aria-hidden', i === index ? 'false' : 'true');
      $$('a, button', s).forEach((el) => { el.tabIndex = i === index ? 0 : -1; });
    });
  };
  const go = (delta) => {
    const next = Math.max(0, Math.min(slides.length - 1, index + delta));
    if (next === index) return;
    index = next;
    apply();
  };
  const velocity = () => { // px per ms over the last few samples
    if (samples.length < 2) return 0;
    const a = samples[0], b = samples[samples.length - 1];
    return (b.x - a.x) / Math.max(1, b.t - a.t);
  };
  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true; moved = false; startX = e.clientX; dx = 0;
    samples = [{ x: e.clientX, t: e.timeStamp }];
    viewport.classList.add('is-pressed');
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    samples.push({ x: e.clientX, t: e.timeStamp });
    if (samples.length > 6) samples.shift();
    if (!moved) {
      if (Math.abs(dx) < 7) return; // a click, not a drag — let links behave
      moved = true;
      viewport.classList.remove('is-pressed');
      viewport.classList.add('dragging');
      try { viewport.setPointerCapture(e.pointerId); } catch (err) {}
    }
    track.style.transition = 'none';
    track.style.transform = `translateX(calc(${-index * 100}% + ${damp(dx)}px))`;
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove('dragging', 'is-pressed');
    if (moved) {
      const lastSample = samples[samples.length - 1];
      const stale = !lastSample || (e ? e.timeStamp : performance.now()) - lastSample.t > 140; // paused before release ≠ flick
      const vx = stale ? 0 : velocity();
      const flick = Math.abs(vx) > 0.45 && Math.abs(dx) >= 20; // a quick flick travels even when short
      if (dx <= -56 || (flick && vx < 0)) go(1);
      else if (dx >= 56 || (flick && vx > 0)) go(-1);
      else apply();
      dismissHint();
    }
    samples = [];
  };
  viewport.addEventListener('pointerup', end);
  viewport.addEventListener('pointercancel', end);
  viewport.addEventListener('click', (e) => {
    if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
  }, true);
  // horizontal trackpad / shift-wheel swipes advance the shelf
  viewport.addEventListener('wheel', (e) => {
    const { deltaX, deltaY } = e;
    if (Math.abs(deltaX) < 6 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return; // vertical scroll — leave it
    e.preventDefault();
    if (e.timeStamp < wheelLock) return;
    wheelAcc = (wheelAcc > 0) !== (deltaX > 0) ? deltaX : wheelAcc + deltaX;
    if (Math.abs(wheelAcc) >= 64) {
      go(wheelAcc > 0 ? 1 : -1);
      wheelAcc = 0; wheelLock = e.timeStamp + 480;
      dismissHint();
    } else {
      clearTimeout(wheelIdle);
      wheelIdle = setTimeout(() => { wheelAcc = 0; }, 180);
    }
  }, { passive: false });
  $$('[data-sparrow]', root).forEach((b) => b.addEventListener('click', () => {
    go(Number(b.dataset.sparrow));
    dismissHint();
  }));
  dots.forEach((d) => d.addEventListener('click', () => { index = Number(d.dataset.spdot); apply(); dismissHint(); }));
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { go(1); dismissHint(); }
    if (e.key === 'ArrowLeft') { go(-1); dismissHint(); }
  });
}

// ------------------------------------------------------------------
// Makers — the seller panel on every product page, and the full,
// openable maker profile (about, ratings, more from this maker).
// ------------------------------------------------------------------
function sellerCardHTML(s, productId) {
  return `<div class="pdp-seller"><div class="pdp-seller-head"><span class="seller-avatar" style="--av:${s.tone}">${s.initials}</span><div class="pdp-seller-who"><div class="mono muted">Sold by</div><b class="seller-name">${safe(s.name)}</b><div class="seller-line"><span class="seller-stars" aria-hidden="true">★★★★★</span><b>${s.rating}</b><span>· ${s.ratings.toLocaleString('en-IN')} ratings</span><span class="seller-inline-chip">${safe(s.badges[0])}</span></div></div><button class="btn outline small" type="button" data-seller-open="${s.id}" data-seller-for="${productId}">View maker profile <span class="arrow">↗</span></button></div><div class="seller-meta-row"><span>${safe(s.location)}</span><span>Maker since ${s.since}</span><span>${safe(s.dispatch)} dispatch</span><span>${s.response} response rate</span></div></div>`;
}
function sellerProfileHTML(s, currentId) {
  const others = products.filter((x) => x.seller && x.seller.id === s.id && x.id !== currentId).slice(0, 3);
  return `<div class="seller-profile">
    <div class="seller-hero"><span class="seller-avatar big" style="--av:${s.tone}">${s.initials}</span><div class="seller-hero-copy"><p class="seller-tagline">${safe(s.tagline)} · ${safe(s.location)}</p><div class="seller-badges">${s.badges.map((b) => `<span>${safe(b)}</span>`).join('')}</div></div><div class="seller-score"><b>${s.rating}</b><span class="seller-stars" aria-hidden="true">★★★★★</span><em>${s.ratings.toLocaleString('en-IN')} ratings</em></div></div>
    <div class="seller-actions"><button class="btn small" type="button" data-seller-follow="${s.id}">Follow this maker</button><button class="btn outline small" type="button" data-seller-msg>Message the maker</button></div>
    <div class="seller-msg" data-seller-msg-panel hidden><textarea placeholder="Ask about a piece, a delivery, or a custom order…" aria-label="Message the maker"></textarea><button class="btn small" type="button" data-seller-msg-send>Send note <span class="arrow">↗</span></button></div>
    <div class="seller-tabs"><button class="filter-chip active" type="button" data-stab="about">About</button><button class="filter-chip" type="button" data-stab="ratings">Ratings</button><button class="filter-chip" type="button" data-stab="shop">More from this maker</button></div>
    <div data-spanel="about"><p class="seller-about">${safe(s.about)}</p><div class="seller-stats"><div><b>${s.sold}</b><span>items sold</span></div><div><b>${s.response}</b><span>response rate</span></div><div><b>${safe(s.dispatch)}</b><span>dispatch time</span></div><div><b>${s.onTime}%</b><span>on-time delivery</span></div></div><div class="seller-tags">${s.specialties.map((t) => `<span>${safe(t)}</span>`).join('')}</div><div class="seller-policy"><span>Returns · 30 days, no questions</span><span>Ships from ${safe(s.location)}</span><span>Replies in under a day</span></div></div>
    <div data-spanel="ratings" hidden><div class="seller-rating-head"><b>${s.rating}</b><div><span class="seller-stars" aria-hidden="true">★★★★★</span><p>${s.ratings.toLocaleString('en-IN')} ratings from Playroom families</p></div></div><div class="seller-bars">${s.distribution.map((pct, i) => `<div class="bar-row"><span>${5 - i}★</span><div class="bar"><i style="width:${pct}%"></i></div><span>${pct}%</span></div>`).join('')}</div><div class="seller-reviews">${s.reviews.map((r) => `<div class="seller-review"><div class="seller-review-head"><span class="seller-avatar small" style="--av:${r.tone}">${r.initials}</span><b>${safe(r.name)}</b><span class="seller-review-tag">Verified buyer</span><time>${r.when}</time></div><p>${safe(r.text)}</p></div>`).join('')}</div></div>
    <div data-spanel="shop" hidden>${others.length ? `<div class="seller-mini-grid">${others.map((x) => `<a class="seller-mini" href="#/product/${x.slug}"><img src="${x.image}" alt="${safe(x.name)}" loading="lazy" decoding="async"><b>${safe(x.name)}</b><span>${formatMoney(x.price)} · ★ ${x.rating}</span></a>`).join('')}</div>` : '<p class="seller-empty">This maker has one piece in the shop right now — the one in your hands.</p>'}<p class="seller-mini-note">Every piece from ${safe(s.name)} is made in small batches. When a batch sells out, the next one takes about three weeks.</p></div>
  </div>`;
}
function openSellerProfile(id, currentId) {
  const s = SELLERS.find((x) => x.id === id);
  if (!s) return;
  openModal(s.name, sellerProfileHTML(s, currentId));
  const root = $('#modalContent');
  $$('[data-stab]', root).forEach((b) => b.addEventListener('click', () => {
    $$('[data-stab]', root).forEach((x) => x.classList.toggle('active', x === b));
    $$('[data-spanel]', root).forEach((p) => { p.hidden = p.dataset.spanel !== b.dataset.stab; });
  }));
  const follows = (() => { try { return JSON.parse(localStorage.getItem('playroom-follows')) || []; } catch (e) { return []; } })();
  const fbtn = $('[data-seller-follow]', root);
  if (fbtn) {
    const setLabel = () => { const on = follows.includes(s.id); fbtn.classList.toggle('active', on); fbtn.innerHTML = on ? 'Following ✓' : 'Follow this maker'; };
    setLabel();
    fbtn.addEventListener('click', () => {
      const i = follows.indexOf(s.id);
      if (i === -1) { follows.push(s.id); toast(`You are following ${s.name}.`, 'Their new batches will show up first.'); }
      else { follows.splice(i, 1); }
      try { localStorage.setItem('playroom-follows', JSON.stringify(follows)); } catch (e) {}
      setLabel();
    });
  }
  const msgPanel = $('[data-seller-msg-panel]', root);
  $('[data-seller-msg]', root)?.addEventListener('click', () => {
    msgPanel.hidden = !msgPanel.hidden;
    if (!msgPanel.hidden) $('textarea', msgPanel)?.focus();
  });
  $('[data-seller-msg-send]', root)?.addEventListener('click', () => {
    const ta = $('textarea', msgPanel);
    if (!ta || !ta.value.trim()) { toast('Write a short note first.'); return; }
    ta.value = '';
    msgPanel.hidden = true;
    toast(`Note sent to ${s.name}.`, 'A demo message — nothing leaves your browser.');
  });
  $$('.seller-mini', root).forEach((a) => a.addEventListener('click', () => closeModal()));
}

// ------------------------------------------------------------------
// The product page — depth pass. Everything a thoughtful parent asks
// before a toy earns a spot at home: what it's made of, how it gets
// played, whether the pieces survive a childhood, what other families
// said, and a live delivery promise. All demo layers are labelled.
// ------------------------------------------------------------------
function renderProduct(p) {
  state.recent = [p.id, ...state.recent.filter((id) => id !== p.id)].slice(0, 6);
  persist();
  const related = products.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4);
  const seller = p.seller;
  const sellerPanel = seller ? sellerCardHTML(seller, p.id) : '';
  return `<div class="route-enter"><div class="wrap product-page"><div class="breadcrumbs"><a href="#/">Home</a><span>/</span><a href="#/catalog">Shop</a><span>/</span><a href="#/catalog?category=${encodeURIComponent(p.category)}">${safe(p.category)}</a><span>/</span><span>${safe(p.name)}</span></div><div class="pdp-grid"><div class="gallery"><div class="thumbs">${p.images.map((im, i) => `<button class="thumb ${i === 0 ? 'active' : ''}" data-gallery="${i}" aria-label="Product photo ${i + 1}"><img src="${im}" alt="${safe(p.name)} view ${i + 1}" loading="eager" decoding="async"></button>`).join('')}</div><div class="main-photo"><img id="mainProductImage" src="${p.images[0]}" alt="${safe(p.name)}" fetchpriority="high" decoding="async"><span class="product-badge ${p.old > p.price ? 'sale' : ''}" style="top:15px;left:15px">${p.fresh ? 'Just landed' : p.old > p.price ? 'A little less' : 'Playroom pick'}</span><button class="zoom-hint" type="button" data-zoom aria-label="Open the photos full screen"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.6" cy="8.6" r="5.6"/><path d="m12.8 12.8 4 4M8.6 6v5.2M6 8.6h5.2"/></svg>Full screen</button></div></div><div class="pdp-copy"><div class="mono muted">${safe(p.category)} · ${safe(p.age)}</div><h1>${safe(p.name)}</h1><div class="pdp-rating">★★★★★ <span>${p.rating} / 5 · ${p.reviews} customer notes</span></div><div class="price-row" style="margin-top:17px"><span class="pdp-price">${formatMoney(p.price)}</span>${p.old > p.price ? `<span class="old-price">${formatMoney(p.old)}</span><span class="pill">Save ${Math.round((1 - p.price / p.old) * 100)}%</span>` : ''}</div><p class="pdp-description">${safe(p.desc)} Designed for open-ended play, this is the kind of find that gets brought back out again and again.</p>${pdpPromiseHTML(p)}<div class="pdp-divider"></div><div class="mono muted">Why it earns a place</div><p style="font-size:12px;line-height:1.8">${safe(p.benefit)} · ${safe(p.detail)} · A thoughtful choice for ${safe(p.age.toLowerCase())}.</p>${pdpSkillsHTML(p)}${pdpPersonaliseHTML(p)}<div class="qty-row"><div><span class="pdp-label">Quantity</span><div class="qty"><button id="pdpQtyMinus" aria-label="Decrease quantity">−</button><span id="pdpQty">1</span><button id="pdpQtyPlus" aria-label="Increase quantity">+</button></div></div><div style="padding-top:20px;font-size:10px;color:var(--muted)">Dispatches from the studio in 1–2 business days${p.stock <= 4 ? ` · ${p.stock} left of this run` : ''}</div></div><div class="pdp-actions"><button class="btn" id="pdpAdd">Add to bag — ${formatMoney(p.price)} <span class="arrow">↗</span></button><button class="btn outline" data-wish="${p.id}" aria-label="Save to wishlist">${state.wishlist.includes(p.id) ? '♥' : '♡'}</button></div><div class="delivery-check"><input id="pincode" inputmode="numeric" maxlength="6" placeholder="6-digit PIN code" aria-label="Delivery PIN code"><button id="checkDelivery">Check delivery</button></div><div class="delivery-result" id="deliveryResult">Enter your PIN code for a date-accurate estimate — standard lands ${fmtDay(standardDate())}, express ${fmtDay(expressDate())}.</div>${sellerPanel}<div class="pdp-divider"></div><div class="details-accordion"><details class="acc" open><summary>The little details</summary><div class="acc-content"><table class="spec-table"><tr><td>Recommended age</td><td>${safe(p.age)}</td></tr><tr><td>Category</td><td>${safe(p.category)}</td></tr><tr><td>What's included</td><td>${safe(p.detail)}</td></tr><tr><td>Play value</td><td>${safe(p.benefit)}</td></tr><tr><td>Made from</td><td>${safe(p.materials.made)}</td></tr><tr><td>Finish</td><td>${safe(p.materials.finish)}</td></tr><tr><td>Availability</td><td>${p.stock} in the studio (demo inventory)</td></tr></table></div></details><details class="acc"><summary>Delivery &amp; returns</summary><div class="acc-content">Complimentary standard delivery on orders above ₹1,499; express and pick-a-day options live at checkout. Thirty-day returns with free pickup — start one any time from your orders page. This prototype does not dispatch products; dates shown are demo estimates.</div></details><details class="acc"><summary>Gifting this piece</summary><div class="acc-content">Add gift wrapping (₹149), a handwritten note and hidden prices at checkout. The recipient sees the note, never the invoice — and the parcel arrives with the delivery promise you chose.</div></details></div><button class="text-link" style="margin-top:22px" data-compare-add="${p.id}">${window.__compare?.includes(p.id) ? 'Remove from comparison' : 'Compare this toy'} <span>↗</span></button></div></div></div>${p.video ? clipBandHTML(p) : ''}${howToPlayHTML(p)}${pdpSafetyHTML(p)}${fbtHTML(p)}<section class="section wrap">${sectionHead('Keep exploring', 'More from this corner', 'A few other ideas from the same kind of play.', '#/catalog?category=' + encodeURIComponent(p.category), 'Shop this category')}<div class="product-grid">${related.map((item, i) => productCard(item, i, true)).join('')}</div></section>${reviewsSectionHTML(p)}${qnaHTML(p)}${ugcHTML(p)}${lightboxHTML(p)}</div>`;
}

/* ---- buy-box helpers ------------------------------------------------ */

function pdpPromiseHTML(p) {
  const low = p.stock <= 4;
  const pl = promiseLine();
  return `<div class="pdp-promise" id="pdpPromise"><span class="pdp-stock ${low ? 'is-low' : ''}"><i aria-hidden="true"></i>${low ? (p.stock === 1 ? 'Last one on the shelf' : `Only ${p.stock} left · a small studio run`) : 'In stock · ready to ship'}</span><span class="pdp-countline">Order within <b data-cd-time>${pl.within}</b> for delivery by <b data-cd-date>${pl.date}</b></span><span class="pdp-promise-fine">Cut-off 3pm, Mon–Sat · demo estimate</span></div>`;
}

function pdpSkillsHTML(p) {
  if (!p.skills || !p.skills.length) return '';
  return `<div class="pdp-skills"><span class="mono">PRACTISING</span><div class="pdp-skillchips">${p.skills.map((s) => `<span class="pdp-skill">${safe(s)}</span>`).join('')}</div><p class="pdp-advisory">${ADVISORY_NOTE}</p></div>`;
}

function pdpPersonaliseHTML(p) {
  if (!p.persKind) return '';
  const engrave = p.persKind === 'engraving';
  return `<div class="pdp-pers" id="pdpPers"><div class="pdp-pers-top"><b>${engrave ? 'Add a name, engraved' : 'Add a name, embroidered'}</b><span class="pdp-pers-fee">+${formatMoney(PERSONALISE_FEE)}</span></div><p class="pdp-pers-sub">${engrave ? 'Laser-engraved in a clean serif on the base of the piece — up to ten characters.' : 'Hand-embroidered in cotton thread by the studio — up to ten characters.'} Personalised pieces are final sale, as they should be.</p><div class="pdp-pers-row"><input id="pdpPersInput" maxlength="10" placeholder="${engrave ? 'e.g. ARA' : 'e.g. MIRA'}" aria-label="Personalisation name" autocomplete="off"><button class="text-link" id="pdpPersClear" type="button">Clear</button></div><div class="pdp-pers-hint" id="pdpPersHint" hidden></div><p class="pdp-pers-fine">Demo service — in a live studio the name would be ${engrave ? 'cut into the wood' : 'stitched by hand'} before dispatch. Here it changes the bag, receipt and order to match.</p></div>`;
}

/* ---- clip band + player --------------------------------------------- */

function clipBandHTML(p) {
  return `<section class="section wrap pdp-section pdp-clipband"><div class="clip-card reveal"><button class="clip-open" type="button" data-clip="${p.id}" aria-label="Play the demo clip"><img src="${p.images[1] || p.images[0]}" alt="" loading="lazy" decoding="async"><span class="clip-play" aria-hidden="true"><svg viewBox="0 0 22 22"><path d="M8 5.5v11l9-5.5z"/></svg></span><span class="clip-open-label mono">WATCH THE CLIP · 0:12</span></button><div class="clip-copy"><div class="mono muted">SEE IT IN PLAY</div><h3>Twelve seconds of<br><em>the good part.</em></h3><p>Built, knocked down, rebuilt. A short loop of ${safe(p.name)} doing what it is actually for.</p><span class="clip-fine">Demo clip — generated from studio stills</span></div></div></section>`;
}

function clipHTML(p) {
  const frames = [p.images[0], p.images[1 % p.images.length] || p.images[0], p.images[2 % p.images.length] || p.images[0]];
  const captions = ['The set, laid out on the studio table', 'Rebuilt — second configuration of the day', 'Packed away, ready for tomorrow'];
  return `<div class="clip-stage"><div class="clip-veil" aria-hidden="true"></div>${frames.map((f, i) => `<img class="clip-frame clip-f${i}" src="${f}" alt="">`).join('')}<div class="clip-caps" aria-hidden="true">${captions.map((c, i) => `<span class="clip-cap clip-c${i}">${c}</span>`).join('')}</div><div class="clip-bar" aria-hidden="true"><i></i></div><span class="clip-badge mono">DEMO CLIP · 0:12</span></div><p class="clip-note">A demo clip generated by animating studio stills — a production store would show filmed play. Nothing here claims to be real footage.</p>`;
}

/* ---- how to play ----------------------------------------------------- */

function howToPlayHTML(p) {
  const st = p.playStages;
  if (!st) return '';
  const cards = [['01', 'First play', st.first], ['02', 'A little harder', st.next], ['03', 'Play together', st.together]];
  return `<section class="section wrap pdp-section pdp-how"><div class="pdp-sec-head"><div><div class="mono muted">HOW IT GETS PLAYED</div><h2>Three ways in,<br><em>one toy.</em></h2></div><p class="pdp-sec-aside">Staged ideas from the Playroom play desk. Follow the child, not the script — and stop while it is still fun.</p></div><div class="play-stage-grid">${cards.map(([n, k, c]) => `<article class="play-stage-card reveal"><span class="play-stage-num mono">${n} · ${k.toUpperCase()}</span><h3>${safe(c.t)}</h3><p>${safe(c.b.split('{name}').join(p.name))}</p></article>`).join('')}</div></section>`;
}

/* ---- safety, materials, spare parts --------------------------------- */

function pdpSafetyHTML(p) {
  const m = p.materials;
  const smallParts = p.minAge < 3;
  return `<section class="section wrap pdp-section pdp-safety"><div class="safety-grid"><div class="pdp-card safety-card reveal"><div class="mono muted">SAFETY &amp; MATERIALS</div><h3>Made to be mouthed, dropped<br>and handed down.</h3><table class="spec-table"><tr><td>Recommended age</td><td>${safe(p.age)}</td></tr><tr><td>Made from</td><td>${safe(m.made)}</td></tr><tr><td>Finish</td><td>${safe(m.finish)}</td></tr><tr><td>Care</td><td>${safe(m.care)}</td></tr></table><p class="${smallParts ? 'safety-warn' : 'safety-ok'}"><b>${smallParts ? 'Small parts notice ·' : 'No small parts by design ·'}</b> ${smallParts ? SAFETY_NOTE_SMALL_PARTS : `suitable from ${safe(p.age.toLowerCase())} under the usual supervision any toy deserves.`}</p><div class="cert-row">${DESIGN_STANDARDS.slice(0, 5).map((c) => `<span class="cert-chip" title="${safe(c.note)}"><b>${safe(c.mark)}</b>${safe(c.label)}</span>`).join('')}</div><p class="pdp-fine">${SAFETY_DEMO_NOTE}</p></div><div class="pdp-card parts-card reveal"><div class="mono muted">THE PART-PLEDGE</div><h3>Lost a piece?<br><em>We&rsquo;ll send it.</em></h3><p>Pieces go missing — under sofas, in coat pockets, to grandparents. Tell us which one and a replacement travels to you free, for the life of the toy.</p><ul class="parts-list">${p.spareParts.map((s) => `<li>${safe(s)}</li>`).join('')}</ul><button class="btn outline" type="button" data-parts="${p.id}">Request a spare part <span class="arrow">↗</span></button><p class="pdp-fine">Demo request flow — nothing is sent anywhere. In a live store this would open a support ticket against your order.</p></div></div></section>`;
}

function partsModalHTML(p) {
  const ref = state.lastOrderId || '';
  return `<form id="pdpPartsForm"><p class="modal-lede">Tell us what went missing and where to find you. In a real store, this posts against the order and a replacement ships within two days — on the house.</p><div class="field"><label>Which piece?</label><div class="selectwrap"><select name="part" aria-label="Which piece">${p.spareParts.map((s) => `<option>${safe(s)}</option>`).join('')}<option>Something else</option></select><svg class="chev" viewBox="0 0 16 16"><path d="M3.5 6 8 10.5 12.5 6"/></svg></div></div><div class="field" style="margin-top:14px"><label>Order ID <span class="muted">(optional)</span></label><input name="order" placeholder="${ref ? safe(ref) : 'e.g. PL-123456'}" value="${safe(ref)}"></div><div class="field" style="margin-top:14px"><label>What happened?</label><textarea name="note" placeholder="It vanished during a castle siege…" maxlength="220"></textarea></div><div class="field" style="margin-top:14px"><label>Where should it travel?</label><input name="where" placeholder="City or PIN code"></div><button class="btn" style="margin-top:18px" type="submit">Log the request ↗</button><p class="muted" style="font-size:10px;margin-top:10px">Demo — the request stays in this browser and is not sent to any maker.</p></form>`;
}

function openPartsModal(p) {
  openModal('Request a spare part', partsModalHTML(p));
  $('#pdpPartsForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    openModal('Spare part request logged', `<div class="success-panel"><div class="success-icon">✳</div><h2>Consider it found.</h2><p>The part would be picked, packed and posted within two working days — free, forever. In this prototype nothing ships, and no one is notified: the request exists only in this browser.</p><button class="btn" id="successClose" type="button">Back to the shelf ↗</button></div>`);
    toast('Request logged (demo).', 'No maker was actually notified.');
  });
}

/* ---- frequently bought together ------------------------------------- */

function fbtHTML(p) {
  const set = fbtFor(p, 2);
  const total = set.reduce((a, x) => a + x.price, 0);
  return `<section class="section wrap pdp-section pdp-fbt"><div class="pdp-sec-head"><div><div class="mono muted">BOUGHT TOGETHER, OFTEN</div><h2>The set,<br><em>put together.</em></h2></div><p class="pdp-sec-aside">One parcel, one delivery promise. Untick anything that isn&rsquo;t right — the total moves as you go.</p></div><div class="fbt-grid">${set.map((x, i) => `<label class="fbt-card${i === 0 ? ' is-current' : ''}"><input type="checkbox" data-fbt="${x.id}" ${i === 0 ? 'checked disabled' : 'checked'} aria-label="Include ${safe(x.name)}"><img src="${x.image}" alt="" loading="lazy"><div class="fbt-info"><b>${safe(x.name)}</b><span>${safe(x.category)} · ${safe(x.age)}</span><strong>${formatMoney(x.price)}</strong>${i === 0 ? '<em>This piece</em>' : ''}</div><span class="fbt-check" aria-hidden="true"></span></label>`).join('<span class="fbt-plus" aria-hidden="true">+</span>')}<div class="fbt-total"><span class="mono">TOTAL FOR THE SET</span><b data-fbt-total>${formatMoney(total)}</b><button class="btn" type="button" data-fbt-add>Add selected to bag <span class="arrow">↗</span></button><small>Everything lands in one demo order — nothing is really shipped.</small></div></div></section>`;
}

/* ---- reviews --------------------------------------------------------- */

function reviewCardHTML(r) {
  const stars = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
  return `<article class="review rev-card${r.mine ? ' is-mine' : ''}" data-stars="${r.stars}" data-photo="${r.photo ? 1 : 0}"><div class="rev-head"><span class="post-avatar" style="--av:${r.tone || '#8a6a3f'}">${r.initials || 'YU'}</span><div class="rev-who"><b>${safe(r.name)}</b>${r.verified ? '<span class="tag">Verified purchase · demo</span>' : ''}${r.mine ? '<span class="tag tag--you">Your note</span>' : ''}</div><time>${safe(r.when)}</time></div><div class="rev-stars" aria-label="${r.stars} out of 5">${stars}</div><h4>${safe(r.title)}</h4><p>${safe(r.body)}</p>${r.photo ? `<figure class="rev-photo"><img src="${r.photo}" alt="" loading="lazy"><figcaption>${safe(r.photoCaption || 'Customer photo')}</figcaption></figure>` : ''}<div class="rev-foot"><button class="rev-help" type="button" data-helpful>Helpful · <span>${r.helpful || 0}</span></button></div></article>`;
}

function allReviewsFor(p) {
  const idx = Math.max(0, products.indexOf(p));
  const seeded = reviewsForProduct(p, idx);
  const user = (storageRead('pdp-reviews', {})[p.id] || []);
  return { list: [...user, ...seeded], seeded };
}

function reviewsSectionHTML(p) {
  const { list, seeded } = allReviewsFor(p);
  const dist = reviewDistribution(p, seeded);
  const withPhotos = list.filter((r) => r.photo).length;
  const count = (n) => list.filter((r) => r.stars === n).length;
  return `<section class="section wrap pdp-section pdp-reviews" id="pdpReviews"><div class="pdp-sec-head"><div><div class="mono muted">CUSTOMER NOTES · DEMO REVIEWS</div><h2>A few words from<br><em>the playroom.</em></h2></div><div class="rev-summary"><div class="rev-score-wrap"><b>${p.rating}</b><div><span class="stars" aria-hidden="true">★★★★★</span><small>${p.reviews} notes · ${list.length} shown</small></div></div><div class="review-bars">${[5, 4, 3, 2, 1].map((n) => `<div class="bar-row" data-revbar="${n}" role="button" tabindex="0" aria-label="Filter ${n} star reviews"><span>${n}</span><div class="bar"><i style="width:${dist[n]}%"></i></div><span>${dist[n]}%</span></div>`).join('')}</div></div></div><div class="rev-toolbar"><div class="rev-filters"><button class="filter-chip active" type="button" data-revfilter="all">All (${list.length})</button><button class="filter-chip" type="button" data-revfilter="photos">With photos (${withPhotos})</button><button class="filter-chip" type="button" data-revfilter="5">5 ★ (${count(5)})</button><button class="filter-chip" type="button" data-revfilter="4">4 ★ (${count(4)})</button></div><button class="btn outline small" type="button" data-review="${p.id}">Write a note</button></div><div class="rev-grid" id="pdpReviewsList">${list.map(reviewCardHTML).join('')}</div><p class="pdp-fine">Reviews on this concept store are illustrative demo copy, stored in this browser. Photos are studio stills standing in for customer photos — nothing here is a real testimonial.</p></section>`;
}

function openReviewModal(p) {
  openModal('Leave a customer note', `<form id="pdpReviewForm"><p class="modal-lede">A note from the playroom — saved in this browser only and shown first, labelled as yours.</p><div class="field"><label>Your rating</label><div class="rev-starpick" id="revStarPick">${[5, 4, 3, 2, 1].map((n) => `<button type="button" class="${n === 5 ? 'active' : ''}" data-star="${n}" aria-label="${n} stars">★</button>`).join('')}</div></div><div class="field" style="margin-top:14px"><label>Headline</label><input name="headline" maxlength="60" required placeholder="Sum it up in a few words"></div><div class="field" style="margin-top:14px"><label>Your note</label><textarea name="body" maxlength="420" required placeholder="What did the child do with it? What surprised you?"></textarea></div><button class="btn" style="margin-top:18px" type="submit">Submit demo review ↗</button><p class="muted" style="font-size:10px;margin-top:10px">Demo review — not published anywhere but this browser. No photo upload in the prototype.</p></form>`);
  let stars = 5;
  $('#revStarPick')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-star]');
    if (!b) return;
    stars = +b.dataset.star;
    $$('#revStarPick [data-star]').forEach((x) => x.classList.toggle('active', +x.dataset.star <= stars));
  });
  $('#pdpReviewForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const title = f.querySelector('[name="headline"]').value.trim() || 'A lovely find';
    const body = f.querySelector('[name="body"]').value.trim();
    if (!body) { toast('Add a few words first.'); return; }
    const db = storageRead('pdp-reviews', {});
    db[p.id] = [{ name: 'You', initials: 'YU', tone: '#a56a76', stars, title, body, when: 'Just now', photo: null, verified: false, mine: true, helpful: 0 }, ...(db[p.id] || [])];
    storageWrite('pdp-reviews', db);
    closeModal();
    refreshReviewsList(p);
    toast('Thanks for the note. ✳', 'Saved in your browser — demo review.');
  });
}

function refreshReviewsList(p) {
  const host = $('#pdpReviewsList');
  if (!host) return;
  const { list } = allReviewsFor(p);
  host.innerHTML = list.map(reviewCardHTML).join('');
  const chip = $('[data-revfilter="all"]');
  if (chip) chip.textContent = `All (${list.length})`;
}

/* ---- Q&A ------------------------------------------------------------- */

function qnaItemHTML(x, seeded = false) {
  return `<details class="qna"><summary><span class="qna-q">${safe(x.q)}</span>${x.pending ? '<span class="qna-chip">Awaiting answer · demo</span>' : ''}</summary><div class="qna-a"><p>${safe(x.a || 'Thanks — a moderator would answer this within a day in a live store. In this prototype the question just sits here, comfortable and unanswered.')}</p><div class="qna-foot"><span class="mono muted">${x.pending ? 'Saved just now' : safe(x.by || 'Playroom team')}${seeded ? '' : ' · demo'}</span><button class="rev-help" type="button" data-helpful>Helpful · <span>${x.helpful || 0}</span></button></div></div></details>`;
}

function qnaHTML(p) {
  const user = (storageRead('pdp-qna', {})[p.id] || []);
  const seeded = [...(QNA_BY_CATEGORY[p.category] || []), ...QNA_GENERAL];
  return `<section class="section wrap pdp-section pdp-qna" id="pdpQna"><div class="pdp-sec-head"><div><div class="mono muted">QUESTIONS PARENTS ASK</div><h2>The things you<br><em>wanted to know.</em></h2></div><p class="pdp-sec-aside">Answered by the makers and the Playroom desk. Everything here is demo copy — honestly labelled as such.</p></div><div class="qna-list" id="qnaList">${user.map((x) => qnaItemHTML(x)).join('')}${seeded.map((x) => qnaItemHTML(x, true)).join('')}</div><form class="qna-form" id="qnaForm"><input name="q" maxlength="160" placeholder="Ask about delivery, safety, play…" aria-label="Ask a question" autocomplete="off"><button class="btn small" type="submit">Ask the desk ↗</button></form></section>`;
}

/* ---- community strip ------------------------------------------------- */

function ugcHTML(p) {
  const tiles = [
    [photos[3], 'Mia R.', 'The marble run came back out — rebuilt the whole spiral twice.'],
    [photos[10], 'Aisha N.', 'Apparently the box WAS the toy all along.'],
    [photos[30], 'Kenji M.', 'Three generations around the same puzzle this weekend.'],
  ];
  return `<section class="section wrap pdp-section pdp-ugc"><div class="pdp-sec-head"><div><div class="mono muted">FROM THE PLAYROOM · COMMUNITY PHOTOS (DEMO)</div><h2>Real play, shared<br><em>by the community.</em></h2></div><a class="text-link" href="#/community">Visit the community <span>↗</span></a></div><div class="ugc-row">${tiles.map((t) => `<a class="ugc-tile" href="#/community"><img src="${t[0]}" alt="Community photo" loading="lazy" decoding="async"><span><b>${t[1]}</b>${t[2]}<i>↗</i></span></a>`).join('')}</div></section>`;
}

/* ---- lightbox -------------------------------------------------------- */

function lightboxHTML(p) {
  return `<div class="pdp-lightbox" id="pdpLightbox" hidden role="dialog" aria-modal="true" aria-label="Product photos full screen"><button class="lb-close" type="button" data-lb-close aria-label="Close full screen"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button><button class="lb-nav lb-prev" type="button" data-lb-nav="-1" aria-label="Previous photo">←</button><div class="lb-stage" data-lb-stage><img id="lbImage" src="${p.images[0]}" alt="${safe(p.name)} full screen" draggable="false"></div><button class="lb-nav lb-next" type="button" data-lb-nav="1" aria-label="Next photo">→</button><div class="lb-foot"><span class="mono" id="lbCount">1 / ${p.images.length}</span><span class="lb-hint">Click the photo to zoom in · Esc to close</span></div></div>`;
}

let lbIndex = 0;
function openPdpLightbox(p, start = 0) {
  const box = $('#pdpLightbox');
  if (!box) return;
  lbIndex = start;
  paintLightbox(p);
  box.hidden = false;
  document.body.classList.add('lock');
}
function closePdpLightbox() {
  const box = $('#pdpLightbox');
  if (!box || box.hidden) return;
  box.hidden = true;
  box.querySelector('.lb-stage')?.classList.remove('is-zoomed');
  document.body.classList.remove('lock');
}
function paintLightbox(p) {
  const img = $('#lbImage');
  if (!img) return;
  img.src = p.images[lbIndex];
  const c = $('#lbCount');
  if (c) c.textContent = `${lbIndex + 1} / ${p.images.length}`;
}

/* ---- quick view ------------------------------------------------------ */

function quickViewHTML(p) {
  const low = p.stock <= 4;
  const pl = promiseLine();
  return `<div class="qv"><div class="qv-media"><img id="qvImage" src="${p.images[0]}" alt="${safe(p.name)}" decoding="async"><div class="qv-thumbs">${p.images.map((im, i) => `<button type="button" class="${i === 0 ? 'active' : ''}" data-qv-thumb="${i}" aria-label="Photo ${i + 1}"><img src="${im}" alt="" loading="lazy"></button>`).join('')}</div></div><div class="qv-copy"><div class="mono muted">${safe(p.category)} · ${safe(p.age)}</div><h3>${safe(p.name)}</h3><div class="rating"><span class="stars" aria-hidden="true">★★★★★</span><span class="rating-copy"><b>${p.rating}</b> · ${p.reviews} notes</span></div><div class="price-row" style="margin:10px 0 4px"><span class="price">${formatMoney(p.price)}</span>${p.old > p.price ? `<span class="old-price">${formatMoney(p.old)}</span>` : ''}</div><span class="pdp-stock ${low ? 'is-low' : ''}" style="margin:6px 0 2px"><i aria-hidden="true"></i>${low ? `Only ${p.stock} left` : 'In stock · ready to ship'}</span><p class="qv-line">${safe(p.benefit)} · ${safe(p.detail)}</p><p class="qv-promise">Order within <b data-cd-time>${pl.within}</b> for delivery by <b data-cd-date>${pl.date}</b></p><div class="qv-actions"><button class="btn" data-add="${p.id}">Add to bag — ${formatMoney(p.price)} <span class="arrow">↗</span></button><button class="btn outline" data-wish="${p.id}" aria-label="Save to wishlist">${state.wishlist.includes(p.id) ? '♥' : '♡'}</button></div><a class="text-link" href="#/product/${p.slug}" onclick="window.__closeModal&&window.__closeModal()">Full details — reviews, safety &amp; play guide <span>↗</span></a><p class="qv-note">${QUICKVIEW_NOTE}</p></div></div>`;
}

function openQuickView(id) {
  const p = byId(id);
  if (!p) return;
  openModal('Quick look', quickViewHTML(p));
  const m = $('#modal');
  if (m) m.dataset.qv = p.id;
  startPromiseTicker();
}

/* ---- PDP wiring ------------------------------------------------------- */

function wirePdp(p) {
  // gallery thumbs + main photo → lightbox
  $$('[data-gallery]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-gallery]').forEach((x) => x.classList.toggle('active', x === b));
    const im = p.images[+b.dataset.gallery];
    lbIndex = +b.dataset.gallery;
    if (im) {
      const main = $('#mainProductImage');
      main.style.opacity = 0;
      setTimeout(() => { main.src = im; main.style.opacity = 1; }, 130);
    }
  }));
  $('[data-zoom]')?.addEventListener('click', () => openPdpLightbox(p, lbIndex));
  $('#mainProductImage')?.addEventListener('click', () => openPdpLightbox(p, lbIndex));
  const lb = $('#pdpLightbox');
  if (lb) {
    lb.querySelector('[data-lb-close]')?.addEventListener('click', closePdpLightbox);
    lb.addEventListener('click', (e) => { if (e.target === lb) closePdpLightbox(); });
    $$('[data-lb-nav]', lb).forEach((b) => b.addEventListener('click', () => {
      lbIndex = (lbIndex + +b.dataset.lbNav + p.images.length) % p.images.length;
      paintLightbox(p);
      const stage = lb.querySelector('.lb-stage');
      stage?.classList.remove('is-zoomed');
    }));
    lb.querySelector('[data-lb-stage]')?.addEventListener('click', (e) => {
      const stage = e.currentTarget;
      if (stage.classList.contains('is-zoomed')) { stage.classList.remove('is-zoomed'); stage.style.transformOrigin = ''; return; }
      const rect = stage.getBoundingClientRect();
      stage.style.transformOrigin = `${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`;
      stage.classList.add('is-zoomed');
    });
  }

  // quantity + add to bag (with personalisation)
  let q = 1;
  const persOf = () => {
    const el = $('#pdpPersInput');
    const v = (el?.value || '').trim();
    return /^[A-Za-z][A-Za-z .'’-]{0,9}$/.test(v) ? v : '';
  };
  const paintPrice = () => {
    const btn = $('#pdpAdd');
    if (!btn) return;
    const extra = p.persKind && persOf() ? PERSONALISE_FEE : 0;
    btn.innerHTML = `Add to bag — ${formatMoney(p.price + extra)} <span class="arrow">↗</span>`;
  };
  $('#pdpQtyMinus')?.addEventListener('click', () => { $('#pdpQty').textContent = q = Math.max(1, q - 1); });
  $('#pdpQtyPlus')?.addEventListener('click', () => { $('#pdpQty').textContent = q = Math.min(Math.min(20, Math.max(1, p.stock)), q + 1); });
  $('#pdpAdd')?.addEventListener('click', () => {
    const pers = p.persKind ? persOf() : '';
    addToCart({ productId: p.id, unitPrice: p.price + (pers ? PERSONALISE_FEE : 0), name: p.name, image: p.image, personalisation: pers || undefined }, q);
    toast(pers ? `Added — engraved “${pers}”.` : 'Added to your bag.', pers ? 'Personalised pieces are final sale (demo).' : p.name);
  });
  if (p.persKind) {
    const input = $('#pdpPersInput');
    const hint = $('#pdpPersHint');
    const onInput = () => {
      const v = input.value.trim();
      if (!v) { hint.hidden = true; hint.className = 'pdp-pers-hint'; paintPrice(); return; }
      const ok = /^[A-Za-z][A-Za-z .'’-]{0,9}$/.test(v);
      hint.hidden = false;
      hint.className = `pdp-pers-hint ${ok ? 'is-ok' : 'is-err'}`;
      hint.innerHTML = ok
        ? `<span class="pers-chip">${p.persKind === 'engraving' ? 'Engraving' : 'Embroidery'}: <b>&lsquo;${safe(v.toUpperCase())}&rsquo;</b></span> <span>Looks good — it travels with the bag, receipt and order.</span>`
        : 'Letters only please — one name or word, up to ten characters.';
      paintPrice();
    };
    input?.addEventListener('input', onInput);
    $('#pdpPersClear')?.addEventListener('click', () => { input.value = ''; onInput(); input.focus(); });
  }

  // live delivery promise ticker (also feeds the drawer + quick view)
  startPromiseTicker();

  // clip player
  $('[data-clip]')?.addEventListener('click', () => openModal('See it in play — demo clip', clipHTML(p)));

  // spare parts
  $('[data-parts]')?.addEventListener('click', () => openPartsModal(p));

  // FBT
  const fbtTotal = () => {
    const t = $('[data-fbt-total]');
    if (!t) return;
    const sum = $$('[data-fbt]').filter((c) => c.checked).map((c) => byId(c.dataset.fbt)).filter(Boolean).reduce((a, x) => a + x.price, 0);
    t.textContent = formatMoney(sum);
  };
  $$('[data-fbt]').forEach((c) => c.addEventListener('change', fbtTotal));
  $('[data-fbt-add]')?.addEventListener('click', () => {
    const picked = $$('[data-fbt]').filter((c) => c.checked).map((c) => byId(c.dataset.fbt)).filter(Boolean);
    picked.forEach((x) => addToCart({ productId: x.id, unitPrice: x.price, name: x.name, image: x.image }));
    toast(picked.length > 1 ? `${picked.length} pieces added to your bag.` : 'Added to your bag.', 'One parcel, one delivery promise (demo).');
  });

  // reviews: filters, bars, helpful, write-a-note
  const reviewsRoot = $('#pdpReviews');
  if (reviewsRoot) {
    const applyFilter = (mode) => {
      $$('.rev-card', reviewsRoot).forEach((card) => {
        const show = mode === 'all' || (mode === 'photos' && card.dataset.photo === '1') || card.dataset.stars === mode;
        card.style.display = show ? '' : 'none';
      });
      $$('[data-revfilter]', reviewsRoot).forEach((c) => c.classList.toggle('active', c.dataset.revfilter === mode));
    };
    $$('[data-revfilter]', reviewsRoot).forEach((c) => c.addEventListener('click', () => applyFilter(c.dataset.revfilter)));
    $$('[data-revbar]', reviewsRoot).forEach((bar) => bar.addEventListener('click', () => applyFilter(bar.dataset.revbar)));
    reviewsRoot.addEventListener('click', (e) => {
      const help = e.target.closest('[data-helpful]');
      if (help) {
        const span = help.querySelector('span');
        const on = help.classList.toggle('is-on');
        span.textContent = String(Math.max(0, Number(span.textContent) + (on ? 1 : -1)));
      }
    });
    $('[data-review]', reviewsRoot)?.addEventListener('click', () => openReviewModal(p));
  }

  // Q&A
  $('#qnaForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const qText = input.value.trim();
    if (!qText) { toast('Write your question first.'); return; }
    const db = storageRead('pdp-qna', {});
    db[p.id] = [{ q: qText, a: null, pending: true, when: 'Just now' }, ...(db[p.id] || [])];
    storageWrite('pdp-qna', db);
    $('#qnaList')?.insertAdjacentHTML('afterbegin', qnaItemHTML({ q: qText, pending: true }));
    input.value = '';
    toast('Question saved. ✳', 'Demo — no moderator will actually reply.');
  });
  $('#pdpQna')?.addEventListener('click', (e) => {
    const help = e.target.closest('[data-helpful]');
    if (!help) return;
    const span = help.querySelector('span');
    const on = help.classList.toggle('is-on');
    span.textContent = String(Math.max(0, Number(span.textContent) + (on ? 1 : -1)));
  });

  // seller profile (per-product binds)
  $$('[data-seller-open]').forEach((b) => b.addEventListener('click', () => openSellerProfile(b.dataset.sellerOpen, b.dataset.sellerFor)));

  // PIN check with real date math
  $('#checkDelivery')?.addEventListener('click', () => {
    const pin = $('#pincode').value.trim();
    const el = $('#deliveryResult');
    if (!el) return;
    el.textContent = /^[1-9][0-9]{5}$/.test(pin)
      ? `Good news — standard delivery to ${pin} lands ${fmtDay(standardDate())}; express lands ${fmtDay(expressDate())}. (Demo estimate)`
      : 'Enter a valid 6-digit Indian PIN code.';
  });
}

function startPromiseTicker() {
  if (window.__pdpTick) { clearInterval(window.__pdpTick); window.__pdpTick = null; }
  if (!$('[data-cd-time]')) return;
  const paint = () => {
    const pl = promiseLine();
    $$('[data-cd-time]').forEach((el) => { el.textContent = pl.within; });
    $$('[data-cd-date]').forEach((el) => { el.textContent = pl.date; });
  };
  paint();
  window.__pdpTick = setInterval(paint, 30000);
}

// ------------------------------------------------------------------
// Discovery — stage hubs, the press wall and the richer search desk.
// Everything here is editorial scaffolding for the concept store: the
// stages mirror premium toy-retail thinking, and every invented claim
// carries an honesty label.
// ------------------------------------------------------------------

/* ---- age & stage hubs --------------------------------------------- */

function stageCardHTML(s, i) {
  return `<a class="stage-card reveal" href="#/stage/${s.id}" style="--stage-tone:${s.tone}"><div class="stage-card-art"><img src="${photos[s.img]}" alt="${safe(s.name)}" loading="lazy" decoding="async"><span class="mono">STAGE 0${i + 1} · ${s.label.toUpperCase()}</span></div><div class="stage-card-copy"><h3>${safe(s.name)}</h3><p>${s.skills.map((k) => safe(k.title)).join(' · ')}</p><span class="text-link">Explore this stage <span>↗</span></span></div></a>`;
}

function renderStagesIndex() {
  return `<div class="route-enter">
  ${svHead(`<a href="#/">Home</a><span> / </span><span>Play by stage</span>`, 'THE GROWING-UP EDIT', 'Every stage plays<br><em>differently.</em>', 'Toys change as children do. These four paths gather what tends to matter at each stage — and the thinking behind every pick.')}
  <section class="section wrap stage-index"><div class="stage-card-grid">${AGE_STAGES.map((s, i) => stageCardHTML(s, i)).join('')}</div>
  <div class="stage-index-foot"><div class="stage-index-note"><span class="mono muted">HOW TO USE THIS</span><p>Age bands are a starting point, never a rulebook. A five-year-old deep in marble runs may be perfectly at home on the “Build &amp; question” shelf. Follow the child.</p></div><div class="stage-index-advisors">${ADVISORS.map((a) => `<div class="advisor-chip"><span class="post-avatar" style="--av:${a.tone}">${a.initials}</span><div><b>${safe(a.name)}</b><span>${safe(a.role)}</span></div></div>`).join('')}<p class="pdp-fine">${ADVISORY_NOTE}</p></div></div></section></div>`;
}

function renderStagePage(id) {
  const s = stageById(id);
  const idx = AGE_STAGES.findIndex((x) => x.id === id);
  if (!s || idx < 0) return renderStagesIndex();
  const picks = stageProducts(s.id).slice(0, 8);
  const advisor = ADVISORS[idx % ADVISORS.length];
  return `<div class="route-enter">
  <section class="stage-hero" style="--stage-tone:${s.tone}"><div class="wrap stage-hero-grid">
    <div class="stage-hero-copy"><div class="breadcrumbs"><a href="#/">Home</a><span> / </span><a href="#/stage">Play by stage</a><span> / </span><span>${safe(s.label)}</span></div><div class="mono muted">${s.kicker}</div><h1>${s.headline}</h1><p>${safe(s.intro)}</p><div class="stage-skills">${s.skills.map((k) => `<div class="stage-skill"><b>${safe(k.title)}</b><span>${safe(k.body)}</span></div>`).join('')}</div><div class="hero-actions" style="margin-top:28px"><a class="btn" href="#/catalog?stage=${s.id}">Shop the ${safe(s.label)} shelf <span class="arrow">↗</span></a><a class="text-link" href="#/journal/${s.journal}">Read the play note <span>↗</span></a></div></div>
    <div class="stage-hero-art"><img src="${photos[s.img]}" alt="${safe(s.name)}" fetchpriority="high" decoding="async"><span class="stage-hero-stamp mono">${s.label.toUpperCase()}</span></div>
  </div></section>
  <section class="section wrap"><div class="pdp-sec-head"><div><div class="mono muted">THE PLAY DESK PICKS</div><h2>Chosen for these<br><em>exact years.</em></h2></div><p class="pdp-sec-aside">Not only because of the age on the box, but because of what children this age tend to do with them — and keep coming back to.</p></div><div class="product-grid">${picks.map((p, i) => productCard(p, i)).join('')}</div><div style="margin-top:30px"><a class="btn outline" href="#/catalog?stage=${s.id}">See every ${safe(s.label)} toy <span class="arrow">↗</span></a></div></section>
  <section class="section wrap"><div class="stage-advisor-card"><div class="mono muted">A NOTE FROM THE ADVISORY</div><div class="stage-advisor-row"><span class="post-avatar" style="--av:${advisor.tone}">${advisor.initials}</span><div><b>${safe(advisor.name)}</b><span>${safe(advisor.role)}</span><p>&ldquo;${safe(advisor.line)}&rdquo;</p></div></div><p class="pdp-fine">${ADVISORY_NOTE}</p></div>
  <div class="stage-links"><span class="mono muted">KEEP WALKING</span><div>${AGE_STAGES.filter((x) => x.id !== s.id).map((x) => `<a href="#/stage/${x.id}">${safe(x.name)} · ${safe(x.label)} <span>↗</span></a>`).join('')}</div></div></section></div>`;
}

/* ---- press & awards wall ------------------------------------------ */

function pressStripHTML() {
  return `<section class="press-strip"><div class="wrap"><div class="press-head"><div><div class="mono">KIND WORDS FROM THE FIELD</div><h2>Talked about in<br><em>good company.</em></h2></div><div class="press-awards">${PRESS_AWARDS.map((a) => `<span class="press-award"><i>${a.mark}</i><span><b>${safe(a.label)}</b><small>${safe(a.sub)}</small></span></span>`).join('')}</div></div><div class="press-row">${PRESS_WALL.map((q) => `<figure class="press-quote reveal"><blockquote>&ldquo;${safe(q.quote)}&rdquo;</blockquote><figcaption class="mono">— ${safe(q.outlet)}</figcaption></figure>`).join('')}</div><p class="press-note">${PRESS_NOTE}</p></div></section>`;
}

/* ---- the search desk ----------------------------------------------- */

const CAT_IMAGE = { 'Building & STEM': 0, 'Games & Puzzles': 8, 'Soft & Plush': 12, 'Vehicles & Adventures': 16, 'Art & Imagination': 20, 'Baby & Early Years': 28, 'Pretend & Role Play': 18, 'Outdoor & Active': 24, 'Science & Discovery': 26, 'Music & Movement': 22 };
const TRENDING_SEARCHES = ['magnetic tiles', 'marble run', 'wooden blocks', 'first teddy', 'puzzle for a five-year-old', 'gifts under ₹1,000'];
const SEARCH_RECENT_KEY = 'recent-searches';

function recentSearches() { return storageRead(SEARCH_RECENT_KEY, []); }
function rememberSearch(q) {
  const term = String(q).trim();
  if (term.length < 2) return;
  const list = [term, ...recentSearches().filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, 5);
  storageWrite(SEARCH_RECENT_KEY, list);
  renderSearchExtras();
}

function renderSearchExtras() {
  const host = $('#searchExtras');
  if (!host) return;
  const recent = recentSearches();
  host.innerHTML = `<div class="search-chiprow"><span class="mono muted">TRENDING</span><div>${TRENDING_SEARCHES.map((t) => `<button type="button" class="search-chip" data-trend="${safe(t)}">${safe(t)}</button>`).join('')}</div></div>${recent.length ? `<div class="search-chiprow"><span class="mono muted">RECENT</span><div>${recent.map((t) => `<button type="button" class="search-chip search-chip--recent" data-trend="${safe(t)}">${safe(t)}</button>`).join('')}</div></div>` : ''}`;
}

function searchCatsHTML() {
  const host = $('#searchCats');
  if (host) host.innerHTML = `<span class="mono muted">SHOP BY KIND</span><div class="search-cat-row">${categories.map((c) => `<a class="search-cat" href="#/catalog?category=${encodeURIComponent(c[0])}" data-close-search><img src="${photos[CAT_IMAGE[c[0]] ?? 0]}" alt="" loading="lazy" decoding="async"><b>${safe(c[0])}</b></a>`).join('')}</div>`;
}

function notFound() {
  return `<div class="route-enter">
  ${svHead(`<a href="#/">Home</a><span> / </span><span>404</span>`, '404 · A little detour', 'This path went<br>off to play.', 'We couldn’t find that page — it may have wandered off somewhere more interesting.')}
  <section class="sv-section wrap"><div class="sv-narrow sv-center">
    <div class="sv-band-actions" style="margin-top:0">
      <a class="btn" href="#/catalog">Explore the collection <span class="arrow">↗</span></a>
      <a class="btn outline" href="#/">Back to the beginning <span class="arrow">↗</span></a>
    </div>
  </div></section></div>`;
}

// ------------------------------------------------------------------
// Checkout (Stripe-style payment page + demo order snapshot, handoff §8.3–8.5)
// ------------------------------------------------------------------
// --- Stripe-Checkout-style payment page -----------------------------
const ST_STATES = ['Andaman & Nicobar', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra & Nagar Haveli & Daman & Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];
const GW_ICONS = {
  card: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/></svg>',
  upi: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.6 18.4h2.8"/><path d="M12 6.4v6m0 0 2.1-2.1M12 12.4l-2.1-2.1"/></svg>',
  netbanking: '<svg viewBox="0 0 24 24"><path d="M3.5 9.5 12 4l8.5 5.5"/><path d="M5.5 10.5v7M9.5 10.5v7M14.5 10.5v7M18.5 10.5v7M3.5 19.5h17"/></svg>',
  crypto: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.5 8.6h3.8a2 2 0 0 1 0 4H9.5m0 0h4.4a2 2 0 0 1 0 4H9.5M11 7v10.4"/></svg>',
};
const ST_STRIPE = '<svg viewBox="0 0 33 15" aria-hidden="true"><path d="M32.956 7.925c0-2.313-1.12-4.138-3.261-4.138-2.15 0-3.451 1.825-3.451 4.12 0 2.719 1.535 4.092 3.74 4.092 1.075 0 1.888-.244 2.502-.587V9.605c-.614.307-1.319.497-2.213.497-.876 0-1.653-.307-1.753-1.373h4.418c0-.118.018-.588.018-.804zm-4.463-.859c0-1.02.624-1.445 1.193-1.445.55 0 1.138.424 1.138 1.445h-2.33zm-5.737-3.279c-.885 0-1.454.415-1.77.704l-.118-.56H18.88v10.535l2.259-.48.009-2.556c.325.235.804.57 1.6.57 1.616 0 3.089-1.302 3.089-4.166-.01-2.62-1.5-4.047-3.08-4.047zm-.542 6.225c-.533 0-.85-.19-1.066-.425l-.009-3.352c.235-.262.56-.443 1.075-.443.822 0 1.391.922 1.391 2.105 0 1.211-.56 2.115-1.39 2.115zM18.04 2.766V.932l-2.268.479v1.843zM15.772 3.94h2.268v7.905h-2.268zm-2.43.669-.144-.669h-1.952v7.906h2.259V6.488c.533-.696 1.436-.57 1.716-.47V3.94c-.289-.108-1.346-.307-1.879.669zM8.825 1.98l-2.205.47-.009 7.236c0 1.337 1.003 2.322 2.34 2.322.741 0 1.283-.135 1.581-.298V9.876c-.289.117-1.716.533-1.716-.804V5.865h1.716V3.94H8.816l.009-1.96zM2.718 6.235c0-.352.289-.488.767-.488.687 0 1.554.208 2.241.578V4.202a5.958 5.958 0 0 0-2.24-.415c-1.835 0-3.054.957-3.054 2.557 0 2.493 3.433 2.096 3.433 3.17 0 .416-.361.552-.867.552-.75 0-1.708-.307-2.467-.723v2.15c.84.362 1.69.515 2.467.515 1.879 0 3.17-.93 3.17-2.548-.008-2.692-3.45-2.213-3.45-3.225z"/></svg>';
const ST_BACK = '<svg viewBox="0 0 24 24"><path d="M19 12H5m0 0 6-6m-6 6 6 6"/></svg>';

/* ---- checkout: the gift layer, delivery options and express wallets ---- */
const ST_CHECK = '<svg viewBox="0 0 10 8" aria-hidden="true"><path d="M1 4.2 3.8 7 9 1"/></svg>';
const WALLET_APPLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.4 12.6c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-2.9-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.8-.4 6.9 1.1 9.1.7 1.1 1.6 2.3 2.7 2.3 1.1 0 1.5-.7 2.8-.7s1.7.7 2.9.7c1.2 0 1.9-1.1 2.7-2.2.8-1.2 1.2-2.4 1.2-2.5 0 0-2.9-1.1-3.1-4.6Z"/><path d="M14.1 5.3c.6-.8 1-1.8 1-2.8-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-1 2.8 1 .1 2-.5 2.6-1.3Z"/></svg>';

const GIFT_KEY = 'pl-gift';
const readGiftState = () => { try { const raw = sessionStorage.getItem(GIFT_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } };
const writeGiftState = (g) => { try { g ? sessionStorage.setItem(GIFT_KEY, JSON.stringify(g)) : sessionStorage.removeItem(GIFT_KEY); } catch {} };

function checkoutItemHTML(x) {
  if (x.special === 'gift-wrap') return `<li class="st-item st-item--wrap"><span class="st-item-wrap" aria-hidden="true">${GIFT_BOW_SVG}</span><div><div class="st-item-name">Gift wrapping</div><div class="st-item-meta">Hand-tied ribbon, note-ready</div></div><span class="st-item-amt">${formatMoney(x.unitPrice * x.qty)}</span></li>`;
  const p = byId(x.productId) || x;
  const meta = [`Qty ${x.qty}`];
  if (x.personalisation) meta.push(`${p.persKind === 'embroidery' ? 'Embroidered' : 'Engraved'} “${safe(x.personalisation)}”`);
  return `<li class="st-item"><img class="st-item-img" src="${x.image || p.image}" alt=""><div><div class="st-item-name">${safe(x.name || p.name)}</div><div class="st-item-meta">${meta.join(' · ')}</div></div><span class="st-item-amt">${formatMoney(x.unitPrice * x.qty)}</span></li>`;
}

function refreshCheckoutItems() {
  const list = $('#stItemsList');
  if (!list) return;
  list.innerHTML = state.cart.map(checkoutItemHTML).join('');
  recalcSummary();
}

function deliveryBlockHTML(opts, selected) {
  return `<div class="st-field"><span class="st-label">Delivery</span><div class="st-delivery" id="stDelivery">${opts.map((o) => `<label class="st-delopt${o.id === selected ? ' active' : ''}" data-del="${o.id}"><input type="radio" name="delivery" value="${o.id}"${o.id === selected ? ' checked' : ''}><span class="st-delopt-body"><b>${o.label}</b><small>${o.desc}</small></span><span class="st-delopt-side"><b>${o.fee ? formatMoney(o.fee) : 'Free'}</b><small>${o.pickable ? 'Choose a weekday' : o.dateLabel}</small></span><span class="st-delopt-tick" aria-hidden="true">${ST_CHECK}</span></label>`).join('')}</div><div class="st-pickday" id="stPickDay" hidden><label class="st-label" for="stPickDate">Deliver on</label><div class="st-selectwrap"><select class="st-input st-select" id="stPickDate" name="pickDate">${pickableDays().map((d) => `<option value="${isoDay(d)}">${fmtLongDay(d)}</option>`).join('')}</select><svg class="st-chev" viewBox="0 0 16 16"><path d="M3.5 6 8 10.5 12.5 6"/></svg></div></div><p class="st-delivery-note">Order within <b data-cd-time>—</b> for the earliest dispatch · dates are demo estimates.</p></div>`;
}

function giftBlockHTML() {
  const g = readGiftState() || {};
  return `<div class="st-field st-gift" id="stGift"><label class="st-billrow st-gift-toggle"><input type="checkbox" id="stGiftToggle"${g.on ? ' checked' : ''}><span class="st-check">${ST_CHECK}</span><span>This order is a gift</span><span class="st-badge st-badge--soft">Wrap, note &amp; hidden prices</span></label><div class="st-gift-body" id="stGiftBody"${g.on ? '' : ' hidden'}><label class="st-billrow st-gift-wraprow"><input type="checkbox" id="stGiftWrap"${hasGiftWrap() ? ' checked' : ''}><span class="st-check">${ST_CHECK}</span><span>Add gift wrapping — <b>${formatMoney(GIFT_WRAP_PRICE)}</b></span></label><textarea class="st-input st-textarea" id="stGiftMessage" maxlength="140" rows="3" placeholder="A short note for the gift card… (140 characters)">${safe(g.message || '')}</textarea><div class="st-gift-from"><input class="st-input" id="stGiftFrom" maxlength="40" placeholder="From — who is it from?" value="${safe(g.from || '')}"></div><label class="st-billrow"><input type="checkbox" id="stGiftHide"${g.hidePrices !== false ? ' checked' : ''}><span class="st-check">${ST_CHECK}</span><span>Hide prices on the packing slip</span></label></div><p class="st-gift-foot">They’ll see your note and the toy — never an invoice. Pick a delivery day above to land it on the right date.</p></div>`;
}

function expressRowHTML() {
  return `<div class="st-express" id="stExpress"><button type="button" class="st-wallet st-wallet--apple" data-express="apple">${WALLET_APPLE}<span>Pay</span></button><button type="button" class="st-wallet st-wallet--google" data-express="google"><b class="wallet-g">G</b><span>Pay</span></button><button type="button" class="st-wallet st-wallet--link" data-express="link"><b>Link</b></button></div><p class="st-express-note">Express wallets are simulated in this prototype — no wallet, card or payment is real.</p>`;
}

// The express sheet: a wallet-style confirmation that skips the accordion
// and hands straight into the same order pipeline.
function openExpressSheet(kind) {
  if (!state.cart.length) return;
  const conf = {
    apple: { label: 'Apple Pay', glyph: WALLET_APPLE, hint: 'Double-click the side button — simulated' },
    google: { label: 'Google Pay', glyph: '<b class="wallet-g">G</b>', hint: 'Confirm with your screen lock — simulated' },
    link: { label: 'Link', glyph: '<b>Link</b>', hint: 'One-click checkout — simulated' },
  }[kind];
  if (!conf) return;
  const sub = cartSubtotal();
  const code = sessionStorage.getItem('pl-code') || '';
  const disc = discountAmount(sub, code);
  const fee = effectiveDeliveryFee(sub);
  const total = sub - disc + fee;
  const del = chosenDelivery() || deliveryOptions(sub)[0];
  openModal(`${conf.label} — express checkout`, `<div class="express-sheet" data-kind="${kind}"><div class="express-face"><span class="express-brand">${conf.glyph}</span><div class="express-amount">${formatMoney(total)}</div><div class="express-line"><span>Pay Playroom Atelier</span><b>Demo — test mode</b></div><div class="express-line"><span>Delivery</span><b>${safe(del.label)}${del.dateLabel ? ' · ' + safe(del.dateLabel) : ''}</b></div><div class="express-line"><span>Card</span><b>•••• 4242 · demo</b></div><div class="express-line"><span>Sheet</span><b>${conf.hint}</b></div></div><button class="st-paybtn express-confirm" id="expressConfirm" type="button">Double-click to pay · ${formatMoney(total)}</button><p class="express-note">${conf.label} is simulated — no wallet, card or payment is real. Shipping uses the details on this checkout, or a demo identity if left blank.</p></div>`);
  const btn = $('#expressConfirm');
  btn?.addEventListener('click', async () => {
    if (btn.dataset.busy) return;
    btn.dataset.busy = '1';
    btn.disabled = true;
    btn.innerHTML = 'Approving… <span class="st-spinwrap" aria-hidden="true"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5"/></svg></span>';
    await new Promise((r) => setTimeout(r, 900));
    const order = await completeOrder({ form: $('#checkoutForm'), methodLabel: `${conf.label} · express sheet (demo)`, extra: { expressWallet: kind } });
    closeModal();
    toast(`${conf.label} approved (demo).`, order.trackingNumber);
    location.hash = '#/order-confirmation?order=' + encodeURIComponent(order.id);
  });
}

function renderCheckout() {
  if (!state.cart.length) return `<div class="st-page"><div class="st-wrap"><div class="st-topbar"><a class="st-back" href="#/catalog">${ST_BACK}Back to the toy box</a></div><div class="st-empty"><div class="st-empty-card"><div class="st-brandrow" style="justify-content:center;margin-bottom:16px"><i class="mark st-mark" aria-hidden="true"></i><span>Pay Playroom</span></div><h2 class="st-h2" style="margin-bottom:8px">Your bag is taking a breather.</h2><p style="font-size:13px;color:var(--st-400);line-height:1.7;margin:0 0 22px">Add something lovely before you check out. This is a demo checkout — no real payment is ever collected.</p><a class="st-btn st-btn--primary" href="#/catalog">Explore the collection</a></div></div></div></div>`;
  const sub = cartSubtotal();
  const fee = effectiveDeliveryFee(sub);
  const code = sessionStorage.getItem('pl-code') || '';
  const disc = discountAmount(sub, code);
  const delOpts = deliveryOptions(sub);
  const delId = chosenDelivery()?.id || 'standard';
  const items = state.cart.map(checkoutItemHTML).join('');
  const gwTabs = PAYMENT_METHODS.map((m, i) => `<button type="button" role="tab" class="gw-tab${i === 0 ? ' active' : ''}" data-gw="${m.id}" aria-selected="${i === 0}" aria-controls="gwPanel"><span class="st-radio" aria-hidden="true"></span><span class="gw-tab-icon" aria-hidden="true">${GW_ICONS[m.id] || ''}</span><span class="gw-tab-label">${m.label}</span>${m.id === 'card' ? brandRowHTML('st-brands--row') : ''}</button>`).join('');
  return `<div class="st-page" id="checkoutPage">
  <div class="st-wrap">
    <div class="st-topbar"><a class="st-back" href="#/catalog">${ST_BACK}Back to the toy box</a><button class="st-ghostbtn" id="autofillBtn" type="button"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 1.5 3 9h4l-.5 5.5L13 7H9l.5-5.5Z"/></svg>Autofill demo data</button></div>
    <form id="checkoutForm" novalidate>
      <div class="st-cols" id="checkoutLayout">
        <aside class="st-summary" id="checkoutSummary">
          <button class="st-sumtoggle" id="stSummaryToggle" type="button" aria-expanded="false"><span>Show order summary</span><b id="stMobileTotal">${formatMoney(sub - disc + fee)}</b><svg viewBox="0 0 16 16"><path d="M3.5 6 8 10.5 12.5 6"/></svg></button>
          <div class="st-summary-inner" id="stSummaryInner">
            <div class="st-brandrow"><i class="mark st-mark" aria-hidden="true"></i><span>Pay Playroom</span></div>
            <ul class="st-items" id="stItemsList">${items}</ul>
            <div class="st-lines">
              <div class="st-line"><span>Subtotal</span><b id="stSubtotal">${formatMoney(sub)}</b></div>
              <div class="st-line" id="stDiscBlock" style="display:${disc ? '' : 'none'}"><span class="st-discleft"><span class="st-chip"><svg viewBox="0 0 24 24"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.8" cy="7.8" r="1.3"/></svg><span id="stChipCode">${safe(code || 'PLAY10')}</span></span><small class="st-discsub">10% off</small></span><b class="st-discamt" id="checkoutDiscount">${disc ? '−' + formatMoney(disc) : ''}</b></div>
              <div class="st-line"><span>Delivery</span><b id="stDeliveryFee">${fee ? formatMoney(fee) : 'Complimentary'}</b></div>
              <div class="st-line"><span>Tax<svg class="st-info" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.4"/><path d="M8 7.3v3.2M8 4.9v.2"/></svg></span><span class="st-muted" id="stTaxNote">Enter address to calculate</span></div>
              <div class="st-line st-line--total"><span>Total due</span><b id="checkoutTotal">${formatMoney(sub - disc + fee)}</b></div>
            </div>
            <div class="st-promo" id="stPromo">
              <button type="button" class="st-promo-toggle" id="promoToggle">+ Add promotion code</button>
              <div class="st-promo-row"><input id="checkoutCode" class="st-input" placeholder="Promotion code" aria-label="Promotion code"><button class="st-btn st-btn--secondary st-btn--sm" id="applyCode" type="button">Apply</button></div>
              <p class="st-promo-msg" id="codeMessage">Try PLAY10 for 10% off your demo subtotal.</p>
            </div>
          </div>
        </aside>
        <section class="st-form-card">
          <h2 class="st-h2">Shipping information</h2>
          <div class="st-field"><label class="st-label" for="ck-email">Email</label><input class="st-input" id="ck-email" name="email" type="email" required autocomplete="email" placeholder="email@example.com"><span class="st-error" data-error="email"></span></div>
          <div class="st-field"><label class="st-label" for="ck-phone">Phone number</label><input class="st-input" id="ck-phone" name="phone" type="tel" required autocomplete="tel" placeholder="+91 98765 43210"><span class="st-error" data-error="phone"></span></div>
          <div class="st-field"><span class="st-label">Shipping address</span>
            <div class="st-group" id="stAddrGroup">
              <div class="st-gc st-gc--top"><input class="st-input" name="fullName" required autocomplete="name" placeholder="Full name" aria-label="Full name"></div>
              <div class="st-gc st-gc--bt"><select class="st-input st-select" name="country" aria-label="Country or region"><option value="IN" selected>India</option><option value="US">United States</option><option value="GB">United Kingdom</option><option value="AE">United Arab Emirates</option><option value="SG">Singapore</option><option value="AU">Australia</option></select><svg class="st-chev" viewBox="0 0 16 16"><path d="M3.5 6 8 10.5 12.5 6"/></svg></div>
              <div class="st-gc st-gc--bt"><input class="st-input" name="address" required autocomplete="street-address" placeholder="Address" aria-label="Address"></div>
              <div class="st-gc st-gc--bt st-gc--opt"><input class="st-input" name="note" placeholder="Address line 2" aria-label="Address line 2 (optional)"><span class="st-badge">Optional</span></div>
              <div class="st-gc st-gc--bt st-gc--half"><input class="st-input" name="city" required autocomplete="address-level2" placeholder="City" aria-label="City"></div>
              <div class="st-gc st-gc--half st-gc--pairright"><input class="st-input" name="pincode" required inputmode="numeric" maxlength="6" autocomplete="postal-code" placeholder="PIN" aria-label="PIN code"></div>
              <div class="st-gc st-gc--bt" id="stStateRow"><select class="st-input st-select" name="state" aria-label="State"><option value="" selected>State</option>${ST_STATES.map((s) => `<option>${s}</option>`).join('')}</select><svg class="st-chev" viewBox="0 0 16 16"><path d="M3.5 6 8 10.5 12.5 6"/></svg></div>
            </div>
            <div class="st-error-list"><span class="st-error" data-error="fullName"></span><span class="st-error" data-error="address"></span><span class="st-error" data-error="city"></span><span class="st-error" data-error="pincode"></span><span class="st-error" data-error="state"></span></div>
          </div>
          ${deliveryBlockHTML(delOpts, delId)}
          ${giftBlockHTML()}
          <h2 class="st-h2 st-h2--pm">Payment <span class="st-testpill" title="Demo gateway — no real payment is taken"><i></i>Test mode</span></h2>
          ${expressRowHTML()}
          <div class="st-or"><span>or pay another way</span></div>
          <div class="st-acc" id="gwTabs" role="tablist" aria-label="Payment method">${gwTabs}<div class="gw-paypanel" id="gwPanel" role="tabpanel"></div></div>
          <div class="st-payrow"><button class="st-paybtn" id="payBtn" type="submit">Pay <span id="payAmountLabel">${formatMoney(sub - disc + fee)}</span></button></div>
          <p class="st-bnpl" id="stBnpl">or <b>3 interest-free parts of ${formatMoney(Math.round((sub - disc + fee) / 3))}</b> · demo — no credit check, nothing is charged</p>
          <p class="st-returns"><svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M13.5 8.7c0-2.7-1.8-4.6-4.9-4.6H4.3l-1.6.1 1.2-1 1.7-1.7c.1-.1.2-.3.2-.5 0-.4-.3-.7-.7-.7-.2 0-.4.1-.6.2L.7 4.3c-.2.1-.3.4-.3.6 0 .2.1.4.2.6l3.9 3.9c.2.1.4.2.6.2.4 0 .7-.3.7-.7 0-.2-.1-.4-.2-.5L3.9 6.5 2.7 5.5l1.6.1h4.3c2.2 0 3.4 1.2 3.4 3s-1.2 3.1-3.4 3.1H7c-.5 0-.8.3-.8.8 0 .4.3.8.8.8h1.7c3 0 4.8-1.8 4.8-4.6Z" fill="currentColor"/></svg> Free returns and exchanges</p>
          <div class="st-cardfoot"><span class="st-powered">Powered by ${ST_STRIPE}</span><a href="#/privacy">Terms</a><a href="#/privacy">Privacy</a><a href="#/help">Help</a></div>
        </section>
      </div>
    </form>
  </div>
</div>`;
}

function recalcSummary() {
  const sub = cartSubtotal();
  const code = sessionStorage.getItem('pl-code') || '';
  const disc = discountAmount(sub, code);
  const fee = effectiveDeliveryFee(sub);
  const total = sub - disc + fee;
  const set = (sel, text) => { const el = $(sel); if (el) el.textContent = text; };
  set('#checkoutTotal', formatMoney(total));
  set('#stMobileTotal', formatMoney(total));
  set('#stSubtotal', formatMoney(sub));
  set('#stDeliveryFee', fee ? formatMoney(fee) : 'Complimentary');
  set('#payAmountLabel', formatMoney(total));
  const bnpl = $('#stBnpl');
  if (bnpl) bnpl.innerHTML = `or <b>3 interest-free parts of ${formatMoney(Math.round(total / 3))}</b> · demo — no credit check, nothing is charged`;
}

function wireCheckout() {
  wireGateway();
  renderGatewayPanel();

  $('#promoToggle')?.addEventListener('click', () => {
    $('#stPromo')?.classList.add('open');
    const btn = $('#promoToggle');
    if (btn) btn.style.display = 'none';
    $('#checkoutCode')?.focus();
  });

  const setMsg = (text, kind) => {
    const m = $('#codeMessage');
    if (!m) return;
    m.textContent = text;
    m.classList.toggle('is-ok', kind === 'ok');
    m.classList.toggle('is-err', kind === 'err');
  };
  const refreshDiscount = () => {
    const sub = cartSubtotal();
    const code = sessionStorage.getItem('pl-code') || '';
    const disc = discountAmount(sub, code);
    const block = $('#stDiscBlock');
    if (block) block.style.display = disc ? '' : 'none';
    const amt = $('#checkoutDiscount');
    if (amt) amt.textContent = disc ? '−' + formatMoney(disc) : '';
    const chip = $('#stChipCode');
    if (chip && code) chip.textContent = code;
    recalcSummary();
  };
  if (sessionStorage.getItem('pl-code')) refreshDiscount();

  $('#applyCode')?.addEventListener('click', () => {
    const code = ($('#checkoutCode')?.value || '').trim().toUpperCase();
    if (code && discountAmount(cartSubtotal(), code)) {
      sessionStorage.setItem('pl-code', code);
      refreshDiscount();
      setMsg(code + ' applied — 10% off your demo subtotal.', 'ok');
      toast('Discount applied.', code);
    } else {
      sessionStorage.removeItem('pl-code');
      refreshDiscount();
      setMsg('That code didn’t match. Try PLAY10.', 'err');
    }
  });

  $('#stSummaryToggle')?.addEventListener('click', () => {
    const s = $('#checkoutSummary');
    const open = !!s?.classList.toggle('is-open');
    const btn = $('#stSummaryToggle');
    btn?.setAttribute('aria-expanded', String(open));
    const lbl = btn?.querySelector('span');
    if (lbl) lbl.textContent = open ? 'Hide order summary' : 'Show order summary';
  });

  const countrySel = document.querySelector('#checkoutForm [name="country"]');
  const stateRow = $('#stStateRow');
  const addrGroup = $('#stAddrGroup');
  const syncState = () => {
    const india = (countrySel?.value || 'IN') === 'IN';
    if (stateRow) stateRow.style.display = india ? '' : 'none';
    addrGroup?.classList.toggle('no-state', !india);
  };
  countrySel?.addEventListener('change', syncState);
  syncState();

  document.querySelector('#checkoutForm [name="pincode"]')?.addEventListener('input', (e) => {
    const t = $('#stTaxNote');
    if (t) t.textContent = /^[1-9][0-9]{5}$/.test(e.target.value.trim()) ? 'Included in total (demo)' : 'Enter address to calculate';
  });

  // Delivery options: live fees, pick-a-day reveal, promise ticker.
  // (wireCheckout runs on every page — these syncs must no-op off checkout.)
  const syncDelivery = () => {
    if (!$('#stDelivery')) return;
    const opts = deliveryOptions(cartSubtotal());
    const id = document.querySelector('#stDelivery input[name="delivery"]:checked')?.value || 'standard';
    const opt = opts.find((o) => o.id === id) || opts[0];
    document.querySelectorAll('#stDelivery .st-delopt').forEach((l) => l.classList.toggle('active', l.dataset.del === opt.id));
    const pick = $('#stPickDay');
    if (pick) pick.hidden = !opt.pickable;
    const chosen = { id: opt.id, label: opt.label, fee: opt.fee, date: opt.date, dateLabel: opt.dateLabel };
    if (opt.pickable) {
      const sel = $('#stPickDate');
      if (sel && !sel.value) sel.value = isoDay(pickableDays()[0]);
      const iso = sel?.value || isoDay(pickableDays()[0]);
      chosen.date = iso;
      chosen.dateLabel = fmtLongDay(fromIsoDay(iso));
    }
    setChosenDelivery(chosen);
    recalcSummary();
    startPromiseTicker();
  };
  $$('#stDelivery input[name="delivery"]').forEach((r) => r.addEventListener('change', syncDelivery));
  $('#stPickDate')?.addEventListener('change', syncDelivery);
  syncDelivery();

  // Gift layer: toggle, wrap ↔ cart line, note memory, hidden prices.
  const syncGift = () => {
    if (!$('#stGift')) return;
    const on = !!$('#stGiftToggle')?.checked;
    const body = $('#stGiftBody');
    if (body) body.hidden = !on;
    writeGiftState(on ? {
      on: true,
      wrap: hasGiftWrap(),
      message: ($('#stGiftMessage')?.value || '').trim(),
      from: ($('#stGiftFrom')?.value || '').trim(),
      hidePrices: $('#stGiftHide')?.checked !== false,
    } : null);
    const wrapBox = $('#stGiftWrap');
    if (wrapBox) wrapBox.checked = hasGiftWrap();
  };
  $('#stGiftToggle')?.addEventListener('change', () => {
    syncGift();
    toast($('#stGiftToggle')?.checked ? 'Gift mode on.' : 'Gift mode off.', $('#stGiftToggle')?.checked ? 'Wrap, note and hidden prices are at your service.' : '');
  });
  $('#stGiftMessage')?.addEventListener('input', syncGift);
  $('#stGiftFrom')?.addEventListener('input', syncGift);
  $('#stGiftHide')?.addEventListener('change', syncGift);
  $('#stGiftWrap')?.addEventListener('change', (e) => {
    if (e.target.checked) addGiftWrap(); else removeGiftWrap();
    syncGift();
    refreshCheckoutItems();
  });
  if (readGiftState() || hasGiftWrap()) syncGift();

  // Express wallets — the demo sheet sits above the accordion.
  $$('[data-express]').forEach((b) => b.addEventListener('click', () => openExpressSheet(b.dataset.express)));
}
// ------------------------------------------------------------------
// Order confirmation (Stripe-style success + receipt, handoff §8.5)
// ------------------------------------------------------------------
function invoiceHTML(order) {
  const pkg = order.package || { weight: '—', dims: '—', reference: order.id, service: order.carrierService || 'Priority Overnight' };
  const gift = order.gift || null;
  const hide = !!(gift && gift.hidePrices);
  const money = (n) => (hide ? '<span class="inv-hidden">•••</span>' : formatMoney(n));
  return `<div class="invoice-head"><div><div class="mono">${hide ? 'GIFT RECEIPT (DEMO)' : 'TAX INVOICE (DEMO)'} · ${safe(order.id)}</div><h2>Thank you, ${safe(order.customer.firstName)}!</h2><div style="font-size:11px;opacity:.8;margin-top:6px">Placed ${safe(order.createdAtLabel)} · ${safe(order.email)} · ${safe(order.paymentMethod)}${order.gatewayTxn ? ` · ${safe(order.gatewayTxn)}` : ''}</div></div><div style="text-align:right"><div class="mono">PLAYROOM ATELIER</div><div style="font-size:10px;opacity:.75;margin-top:6px">Concept storefront<br>demo receipt · not a tax document</div></div></div>
        <div class="invoice-meta"><div><h5>${gift ? 'SHIP TO (GIFT)' : 'BILL / SHIP TO'}</h5>${safe(order.customer.firstName)} ${safe(order.customer.lastName)}<br>${safe(order.customer.addressLine1)}<br>${safe(order.customer.city)}${order.customer.state ? ', ' + safe(order.customer.state) : ''} ${safe(order.customer.pincode)}<br>${safe(order.customer.phone)}${order.customer.deliveryNote ? `<br><span style="color:var(--muted)">Note: ${safe(order.customer.deliveryNote)}</span>` : ''}</div><div><h5>SHIPMENT (FEDEX DEMO)</h5>${safe(order.carrier || 'FedEx')} · ${safe(order.carrierService || 'Priority Overnight')}<br>Tracking: <b class="mono">${safe(order.trackingNumber || '—')}</b><br>Weight: ${safe(pkg.weight)} · ${safe(pkg.dims)}<br>Ref: <span class="mono">${safe(pkg.reference)}</span>${order.delivery ? `<br>Service: ${safe(order.delivery.label)}${order.delivery.dateLabel ? ' · ' + safe(order.delivery.dateLabel) : ''}` : ''}</div></div>
        ${gift && gift.message ? `<div class="invoice-giftnote"><span class="mono">GIFT NOTE ENCLOSED</span><p>“${safe(gift.message)}”</p>${gift.from ? `<span class="invoice-giftnote-from">— ${safe(gift.from)}</span>` : ''}${hide ? '<span class="invoice-giftnote-hide">Prices are hidden on this receipt.</span>' : ''}</div>` : ''}
        <table><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>
        ${order.items.map((x) => `<tr><td>${safe(x.name)}${x.personalisation ? `<br><span class="inv-sub">${x.persKind === 'embroidery' ? 'Embroidered' : 'Engraved'} “${safe(x.personalisation)}”</span>` : ''}${x.special === 'gift-wrap' ? '<br><span class="inv-sub">Hand-tied ribbon, note-ready</span>' : ''}</td><td class="num">${x.qty}</td><td class="num">${money(x.unitPrice)}</td><td class="num">${money(x.lineTotal)}</td></tr>`).join('')}
        </tbody></table>
        <div class="invoice-total"><div class="row"><span>Subtotal</span><span>${money(order.subtotal)}</span></div>
        ${order.discount ? `<div class="row"><span>Discount${order.promoCode ? ` (${safe(order.promoCode)})` : ''}</span><span>${hide ? '<span class="inv-hidden">•••</span>' : '−' + formatMoney(order.discount)}</span></div>` : ''}
        <div class="row"><span>Delivery${order.delivery ? ` · ${safe(order.delivery.label)}` : ''}</span><span>${hide ? '<span class="inv-hidden">•••</span>' : (order.deliveryFee ? formatMoney(order.deliveryFee) : 'Complimentary')}</span></div>
        <div class="row grand"><span>Total${hide ? ' (paid by sender)' : ''} (demo — no payment taken)</span><span>${hide ? '<span class="inv-hidden">•••</span>' : formatMoney(order.total)}</span></div></div>${order.pointsEarned ? `<p class="invoice-points">✳ ${order.pointsEarned} play leaves earned on this order (demo loyalty)</p>` : ''}`;
}

function renderConfirmation() {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const order = getOrder(params.get('order') || state.lastOrderId || '');
  if (!order) return `<div class="st-page"><div class="st-wrap"><div class="st-topbar"><a class="st-back" href="#/catalog">${ST_BACK}Back to the toy box</a></div><div class="st-empty"><div class="st-empty-card"><h2 class="st-h2" style="margin-bottom:8px">Nothing saved here yet.</h2><p style="font-size:13px;color:var(--st-400);line-height:1.7;margin:0 0 22px">This confirmation page shows demo orders created in this browser. Complete a demo checkout first, or head back to the toy box.</p><div class="st-success-actions"><a class="st-btn st-btn--primary" href="#/catalog">Explore the collection</a><a class="st-btn st-btn--secondary" href="#/track-order">Enter an order number</a></div></div></div></div></div>`;
  return `<div class="st-page" id="confirmPage">
  <div class="st-wrap">
    <div class="st-topbar"><a class="st-back" href="#/">${ST_BACK}Back to the store</a><a class="st-back" href="#/track-order?order=${encodeURIComponent(order.id)}">Track this order</a></div>
    <div class="st-success" id="successPanel">
      <div class="st-success-ring"><svg viewBox="0 0 24 24"><path d="M4.5 12.6 10 18 19.5 7.2"/></svg></div>
      <h1 class="st-success-h1">Payment successful</h1>
      <p class="st-success-paid">You paid <b>${formatMoney(order.total)}</b> — demo, nothing was charged.</p>
      <p class="st-success-sub">Order <b>${safe(order.id)}</b> is confirmed${order.email ? ` for <b>${safe(order.email)}</b>` : ''}. Nothing is emailed or shipped in this prototype — your receipt is stored in this browser only.</p>
      <div style="margin:2px 0 20px"><span class="st-trackpill">Tracking number <b>${safe(order.trackingNumber || '—')}</b></span></div>
      ${order.delivery ? `<p class="st-success-sub st-success-delivery">Arriving with <b>${safe(order.delivery.label)}</b>${order.delivery.dateLabel ? ` — promised <b>${safe(order.delivery.dateLabel)}</b>` : ''}. Demo estimate only.</p>` : ''}
      ${order.gift ? `<div class="st-giftcard"><span class="mono">✳ GIFT NOTE ENCLOSED</span><p>${order.gift.message ? `“${safe(order.gift.message)}”` : 'A hand-written card goes in the box.'}</p>${order.gift.from ? `<span class="st-giftcard-from">— ${safe(order.gift.from)}</span>` : ''}${order.gift.hidePrices ? '<span class="st-giftcard-note">Prices are hidden on the packing slip.</span>' : ''}</div>` : ''}
      ${order.pointsEarned ? `<p class="st-success-points">✳ <b>${order.pointsEarned} play leaves</b> added to your leaf bank (demo loyalty) — <a href="#/account">see your leaves</a>.</p>` : ''}
      <div class="st-success-actions"><a class="st-btn st-btn--primary" href="#/track-order?order=${encodeURIComponent(order.id)}">Track with ${safe(order.carrier || 'FedEx')}</a><a class="st-btn st-btn--secondary" href="#/orders">Orders &amp; returns</a><a class="st-btn st-btn--secondary" href="#/catalog">Keep shopping</a></div>
    </div>
  </div>
  <div class="st-wrap">
    <div class="st-receipt">
      <div class="st-receipt-head"><span class="st-receipt-title">Your demo receipt</span><button class="st-btn st-btn--secondary st-btn--sm" type="button" onclick="window.print()">Download / print</button></div>
      <div class="invoice${order.gift && order.gift.hidePrices ? ' invoice--gift' : ''}" id="invoiceDoc">${invoiceHTML(order)}</div>
      <p class="st-fineprint">Demo limitation: orders live only in this browser's storage. They are not sent to any shop or courier system, and no email is sent.</p>
    </div>
  </div>
</div>`;
}

// ------------------------------------------------------------------
// Tracking — a faithful, simulated FedEx-style tracker (handoff §8.6).
// Status hero + five-station journey, shipment facts, route cards and a
// full travel history. Everything stays labelled as a demo; nothing ships.
// ------------------------------------------------------------------
const FX_ICONS = {
  doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 2.5h7.4l4.6 4.6v14.4h-12z"/><path d="M13.9 2.5v4.6h4.6"/></svg>',
  box: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/></svg>',
  route: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="5.5" r="2"/><path d="M7.3 17.2c3.2-2.6 6.5-6.8 9.5-10.1"/></svg>',
  truck: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 5.5h12.5v10H1.5z"/><path d="M14 9h3.7l3.8 3.8v2.7H14z"/><circle cx="6" cy="17.8" r="2.2"/><circle cx="17" cy="17.8" r="2.2"/></svg>',
  done: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.2 12.4l2.6 2.6 5-5.4"/></svg>',
  bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.2v-5.4a6 6 0 0 1 12 0v5.4l1.5 2.3H4.5z"/><path d="M10.3 20.8a1.9 1.9 0 0 0 3.4 0"/></svg>',
  sign: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 19.5c3.3 0 4.5-3.2 5.8-7C10.4 9 11.1 4.5 13.2 4.5c1.7 0 2.3 1.5 2.3 3.2 0 2.4-1.1 4.3-1.1 5.8 0 .9.5 1.4 1.2 1.4 1 0 1.9-.8 2.8-1.9"/><path d="M4.5 19.5h15"/></svg>',
  copy: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.6" y="5.6" width="7.9" height="7.9" rx="1.5"/><path d="M10.4 3.6v-.5a1.5 1.5 0 0 0-1.5-1.5H4a1.5 1.5 0 0 0-1.5 1.5v4.9A1.5 1.5 0 0 0 4 9.5h.5"/></svg>',
  search: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.7" cy="8.7" r="5.7"/><path d="M17 17l-4.5-4.5"/></svg>',
};
const FX_STATION_ICONS = [FX_ICONS.doc, FX_ICONS.box, FX_ICONS.route, FX_ICONS.truck, FX_ICONS.done];

function fxEmptyHTML(lastId) {
  return `<div class="fx-empty"><span class="fx-empty-ico">${FX_ICONS.box}</span><b>No shipment loaded yet</b><p>${lastId ? 'Your last demo order is ready to track.' : 'Complete a demo checkout and the tracking number fills itself in here.'}</p>${lastId ? `<button class="fx-action fx-action--solid" type="button" data-fx-uselast="${safe(lastId)}">Track my last demo order</button>` : ''}</div>`;
}

function renderTrack() {
  const preset = new URLSearchParams(location.hash.split('?')[1] || '').get('order') || '';
  return `<div class="route-enter"><div class="wrap page-head"><div class="breadcrumbs"><a href="#/">Home</a> / Track a shipment</div><div class="mono muted">Carrier · ${CARRIER.name} (demo integration)</div><h1 class="page-title">Where's my<br>little parcel?</h1><p class="page-intro">Enter the tracking number shown after checkout. This store is a prototype — no real shipment exists. The tracker below is a faithful, simulated ${CARRIER.name}-style demo.</p></div><div class="wrap" style="padding:0 0 84px"><div class="fx-card" style="margin:28px auto 0">
  <div class="fx-top">
    <div class="fx-head"><div class="fx-brand"><div class="fx-logo"><span class="fx-fed">Fed</span><span class="fx-ex">Ex</span></div><div><b>Shipment tracking</b><br><span class="fx-sub">DEMO STAND-IN FOR ${CARRIER.product}</span></div></div><span class="fx-tag">Test environment</span></div>
    <div class="fx-trackbar"><form class="track-form" id="trackForm" novalidate>
      <label class="fx-field" for="trackInput"><span class="fx-field-ico" aria-hidden="true">${FX_ICONS.search}</span><input id="trackInput" placeholder="Tracking number, e.g. 794658202204" value="${safe(preset)}" aria-label="Tracking number" autocomplete="off" spellcheck="false"></label>
      <button class="fx-trackbtn" type="submit">Track</button>
      <button class="fx-usebtn" type="button" id="trackOrderNo">Use order ID</button>
    </form>
    <p class="fx-trackhint">Paste the 12-digit ${CARRIER.name}-style number from your demo receipt — or load your last demo order.</p></div>
  </div>
  <div class="fx-resultwrap" id="trackResult" aria-live="polite">${preset ? '' : fxEmptyHTML(state.lastOrderId)}</div></div></div></div>`;
}

function wireTrack() {
  const form = $('#trackForm');
  if (!form) return;
  const preset = new URLSearchParams(location.hash.split('?')[1] || '').get('order') || '';
  if (preset) fxShowResult(preset);
  form.addEventListener('submit', (e) => { e.preventDefault(); fxShowResult($('#trackInput').value.trim()); });
  $('#trackOrderNo')?.addEventListener('click', () => {
    const last = state.lastOrderId;
    if (last) { $('#trackInput').value = last; fxShowResult(last); }
    else toast('No demo order yet.', 'Checkout first, then come back.');
  });
  wireFxUseLast($('#trackResult'));
}

function wireFxUseLast(r) {
  r?.querySelector('[data-fx-uselast]')?.addEventListener('click', (e) => {
    const id = e.currentTarget.dataset.fxUselast;
    const input = $('#trackInput');
    if (input) input.value = id;
    fxShowResult(id);
  });
}

function fxShowResult(code) {
  const r = $('#trackResult');
  if (!r) return;
  r.innerHTML = '<div class="fx-scanning"><i></i><i></i><i></i><p>Scanning demo shipments…</p></div>';
  setTimeout(() => {
    const order = getOrder(code);
    if (!order) {
      r.innerHTML = `<div class="fx-empty fx-empty--miss"><span class="fx-empty-ico">${FX_ICONS.search}</span><b>No shipment matches “${safe(code)}”</b><p>Orders live only in this browser’s demo storage. Double-check the number on your receipt, or load your last demo order.</p>${state.lastOrderId ? `<button class="fx-action fx-action--solid" type="button" data-fx-uselast="${safe(state.lastOrderId)}">Track my last demo order</button>` : ''}</div>`;
      wireFxUseLast(r);
      return;
    }
    const st = fedexStatus(order);
    r.innerHTML = fxOrderHTML(order, st);
    wireFxResult(r, order, st);
  }, 480);
}

function fxOrderHTML(order, st) {
  const pkg = order.package || packageMeta(order.items, order.total);
  const qty = order.items.reduce((a, x) => a + x.qty, 0);
  const bars = String(order.trackingNumber || '000000000000').split('').map((d) => `<i style="width:${1 + (Number(d) % 3)}px"></i>`).join('');
  const scans = st.events.map((e, i) => ({ e, done: st.done[i], i })).reverse(); // newest first, like the real tracker
  const doneScans = scans.filter((s) => s.done);
  const projScans = scans.filter((s) => !s.done).reverse(); // projected steps read forwards
  const scanHTML = ({ e, done, i }, isLatest) => `<li class="fx-scan ${done ? 'is-done' : 'is-proj'}${isLatest ? ' is-latest' : ''}" style="--i:${Math.min(i, 7)}">
    <time class="fx-scan-time">${safe(e.label)}</time>
    <span class="fx-scan-dot" aria-hidden="true"></span>
    <div class="fx-scan-body"><div class="fx-scan-title"><b>${safe(e.code)}</b>${isLatest ? '<span class="fx-latest-chip">Latest</span>' : ''}${done ? '' : '<span class="fx-proj-chip">Projected</span>'}</div><p>${safe(e.desc)}</p><span class="fx-scan-loc">${safe(e.location)}</span></div>
  </li>`;
  const dest = `${order.customer.addressLine1}, ${order.customer.city} ${order.customer.pincode}`;
  const heroIco = FX_STATION_ICONS[st.all ? 4 : st.currentStation];
  return `
  <div class="fx-status-hd">
    <div class="fx-status-main"><span class="fx-status-ico${st.all ? ' is-delivered' : ''}">${heroIco}</span>
      <div><span class="fx-status-kicker">${st.all ? 'DELIVERY COMPLETE' : 'DELIVERY STATUS'} · SIMULATED</span><h3 class="fx-big${st.all ? ' is-delivered' : ''}">${safe(st.big)}</h3><p class="fx-subline">${safe(st.sub)}</p></div>
    </div>
    <div class="fx-idbox"><span class="fx-idlabel">TRACKING ID</span><b class="fx-idnum">${safe(order.trackingNumber)}</b><button class="fx-copybtn" type="button" data-fx-copy="${safe(order.trackingNumber)}">${FX_ICONS.copy}<span>Copy</span></button></div>
  </div>
  <div class="fx-actions">
    <button class="fx-action" type="button" data-fx-notify>${FX_ICONS.bell}<span>Get status notifications</span></button>
    <button class="fx-action" type="button" data-fx-proof>${FX_ICONS.sign}<span>Obtain proof of delivery</span></button>
  </div>
  <div class="fx-stepper"><div class="fx-stationwrap"><span class="fx-rail" aria-hidden="true"><i class="fx-rail-fill" style="width:0"></i></span><ol class="fx-stations">${st.stations.map((s, i) => `<li class="fx-station is-${s.state}"><span class="fx-station-ico">${FX_STATION_ICONS[i]}</span><b>${safe(s.label)}</b><span class="fx-station-date">${s.state === 'todo' ? 'est. ' + safe(s.date) : safe(s.date)}</span></li>`).join('')}</ol></div></div>
  <div class="fx-facts"><h4 class="fx-h4">Shipment facts</h4><dl class="fx-facts-grid">
    <div><dt>Tracking number</dt><dd class="mono">${safe(order.trackingNumber)}</dd></div>
    <div><dt>Service</dt><dd>${safe(order.carrierService || CARRIER.product)}</dd></div>
    <div><dt>Weight</dt><dd>${safe(pkg.weight)}</dd></div>
    <div><dt>Dimensions</dt><dd>${safe(pkg.dims)}</dd></div>
    <div><dt>Total pieces</dt><dd>${pkg.pieces || 1}</dd></div>
    <div><dt>Packaging</dt><dd>${safe(pkg.packaging || 'Playroom secure box')}</dd></div>
    <div><dt>Reference</dt><dd class="mono">${safe(pkg.reference || order.id)}</dd></div>
    <div><dt>Contents</dt><dd>${qty} item${qty > 1 ? 's' : ''} · ${safe(order.customer.city)}</dd></div>
  </dl></div>
  <div class="fx-route">
    <div class="fx-route-card"><span class="fx-route-k">FROM</span><b>Playroom Atelier</b><p>Mumbai hub, IN</p></div>
    <span class="fx-route-line" aria-hidden="true">${FX_ICONS.truck}</span>
    <div class="fx-route-card"><span class="fx-route-k">TO</span><b>${safe(order.customer.firstName)} ${safe(order.customer.lastName)}</b><p>${safe(dest)}</p></div>
  </div>
  <div class="fx-travel">
    <div class="fx-travel-head"><h4 class="fx-h4">Travel history</h4>${projScans.length ? `<button class="fx-toggle" type="button" data-fx-toggle aria-expanded="false">Show projected steps (${projScans.length})</button>` : ''}</div>
    <ol class="fx-scans">${doneScans.map((s, idx) => scanHTML(s, idx === 0)).join('')}</ol>
    ${projScans.length ? `<ol class="fx-scans fx-scans--proj" data-fxproj hidden>${projScans.map((s) => scanHTML(s, false)).join('')}</ol>` : ''}
  </div>
  <div class="fx-label"><span class="fx-label-k">DEMO SHIPPING LABEL</span>
    <div class="fx-label-row"><div class="fx-barcode"><small>TRACKING ${safe(order.trackingNumber)}</small>${safe(order.trackingNumber)}<span class="fx-barcode-bars">${bars}</span></div><div class="fx-label-meta">${qty} item${qty > 1 ? 's' : ''} · ${safe(pkg.weight)}<br>${safe(pkg.dims)}<br><span class="tag">${safe(order.statusLabel || 'Demo order')}</span></div></div>
  </div>
  <div class="fx-foot"><span class="gw-testmode" style="margin:0">DEMO — generated ${safe(order.createdAtLabel)} · order ${safe(order.id)} · freight, scans and delivery dates are simulated; nothing ships.</span><a href="${CARRIER.trackingUrlBase}${encodeURIComponent(order.trackingNumber)}" target="_blank" rel="noopener">Open on fedex.com ↗</a></div>`;
}

function wireFxResult(r, order, st) {
  const fill = r.querySelector('.fx-rail-fill');
  if (fill) setTimeout(() => { fill.style.width = st.pct + '%'; }, 80);
  r.querySelector('[data-fx-copy]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget, val = btn.dataset.fxCopy;
    try { await navigator.clipboard.writeText(val); }
    catch (err) {
      const t = document.createElement('textarea');
      t.value = val; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (err2) {}
      t.remove();
    }
    btn.classList.add('is-copied');
    const lbl = btn.querySelector('span'); if (lbl) lbl.textContent = 'Copied';
    toast('Tracking number copied.', val);
    setTimeout(() => { btn.classList.remove('is-copied'); if (lbl) lbl.textContent = 'Copy'; }, 1900);
  });
  r.querySelector('[data-fx-toggle]')?.addEventListener('click', (e) => {
    const btn = e.currentTarget, proj = r.querySelector('[data-fxproj]');
    if (!proj) return;
    const open = proj.hidden;
    proj.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? 'Hide projected steps' : `Show projected steps (${proj.children.length})`;
  });
  r.querySelector('[data-fx-notify]')?.addEventListener('click', () => toast('Notifications are demo-only.', `In a live shop, ${order.carrier || CARRIER.name} would text and email every scan.`));
  r.querySelector('[data-fx-proof]')?.addEventListener('click', () => {
    if (!st.all) { toast('Not delivered yet (demo).', 'Proof of delivery becomes available after the demo delivery lands.'); return; }
    openModal('Proof of delivery', fxProofHTML(order));
  });
  wireFxUseLast(r);
}

function fxProofHTML(order) {
  const delivered = new Date(new Date(order.createdAt).getTime() + 46 * 3600e3);
  const label = delivered.toLocaleString('en-IN', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
  return `<div class="fx-proof">
    <div class="fx-proof-stamp">${FX_ICONS.done}<span>Delivered · demo</span></div>
    <p class="fx-proof-line"><b>${safe(order.customer.firstName)} ${safe(order.customer.lastName)}</b><br>${safe(order.customer.addressLine1)}, ${safe(order.customer.city)} ${safe(order.customer.pincode)}</p>
    <div class="fx-proof-grid">
      <div><span>DELIVERED</span><b>${safe(label)}</b></div>
      <div><span>SIGNED FOR BY</span><b>Reception (simulated)</b></div>
      <div><span>TRACKING</span><b class="mono">${safe(order.trackingNumber)}</b></div>
      <div><span>SERVICE</span><b>${safe(order.carrierService || CARRIER.product)}</b></div>
    </div>
    <div class="fx-proof-sign"><svg viewBox="0 0 240 60" aria-hidden="true"><path d="M8 44c18-30 30-32 34-16 3 12-4 20-10 20-5 0-7-5-4-10 6-11 20-13 32-8 10 4 14 10 24 9 12-1 12-13 22-16 9-3 16 3 24 2 10-1 16-8 26-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M196 45c14 0 26-1 38-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><span>Recipient signature (simulated)</span></div>
    <p class="fx-proof-note">Demo document — part of the Playroom prototype. No real delivery took place and no signature was collected.</p>
  </div>`;
}

// ------------------------------------------------------------------
// Journal / simple pages (verbatim content from the reference)
// ------------------------------------------------------------------
const JOURNAL = {
  'choosing-a-toy': { title: 'Choosing a toy that leaves room for imagination', kicker: 'A better toy shelf · 4 min read', img: photo.blocks, body: ['A toy can be beautifully made and still leave very little for a child to do. The most interesting objects often have more than one possible ending. A block can become a bridge, a shop counter, a moon base or a tiny bed for an animal figurine.', 'When choosing a toy, look for invitations rather than instructions. Can the child change the rules? Can the toy be combined with something else? Will it still be interesting after the first reveal?', 'This is not a rule that every toy must be open-ended. Games with clear rules, books and toys that demonstrate a specific idea all have a place. The useful question is whether the toy fits the child and the kind of play you want to make room for.'] },
  'gifting-by-age': { title: 'A less stressful way to choose a gift', kicker: 'The gift note · 3 min read', img: photo.gift, body: ['Start with the child, not the shopping category. What do they return to: making, movement, stories, collecting, puzzles, pretend play? A gift that meets an existing interest is often more meaningful than the loudest box on the shelf.', 'Age guidance matters, especially for toys with small parts. Use it as a safety and suitability guide, then think about the child’s interests, the space available at home and whether an adult will be playing along.', 'When you are unsure, choose a shared activity, a good classic or a consumable creative kit. And if you can, include a small note explaining why you thought of them.'] },
  'screen-free-afternoons': { title: 'Five screen-free ideas for an ordinary afternoon', kicker: 'A little inspiration · 5 min read', img: photo.craft, body: ['Build the tallest tower that can survive a gentle table tap. Draw a map of an imaginary neighbourhood. Turn a cardboard box into a bus, a spaceship or a tiny shop. Hide five objects and write a clue for each. Make a story with three objects chosen at random.', 'The point is not to produce a perfect activity. It is to give play a small starting point and let the child take it somewhere unexpected.', 'Keep the materials simple and the invitation open. A few minutes of shared curiosity can be enough to change the shape of an afternoon.'] },
};

function renderJournal(path) {
  const key = path.split('/').pop();
  const a = JOURNAL[key];
  if (!a) return `<div class="route-enter"><div class="wrap page-head"><div class="breadcrumbs"><a href="#/">Home</a> / The play journal</div><div class="mono muted">The Playroom journal</div><h1 class="page-title">Notes on play.</h1><p class="page-intro">Thoughtful guides for choosing toys and making room for play.</p></div><div class="wrap" style="padding-bottom:70px"><div class="journal-grid" style="margin-top:40px">${Object.entries(JOURNAL).map(([k, j]) => `<a class="journal-card" href="#/journal/${k}"><div class="journal-image"><img src="${j.img}" alt="" loading="lazy"></div><h3>${j.title}</h3><p>${j.kicker}</p></a>`).join('')}</div></div></div>`;
  return `<div class="route-enter"><div class="wrap page-top page-head"><div class="breadcrumbs"><a href="#/">Home</a> / <a href="#/journal">The play journal</a> / Article</div><div class="mono muted">${a.kicker}</div><h1 class="page-title" style="max-width:900px">${a.title}</h1></div><article class="wrap" style="max-width:900px;padding-bottom:80px"><div class="story-art" style="aspect-ratio:1.8;margin-bottom:35px"><img src="${a.img}" alt="${safe(a.title)}" loading="lazy"></div><div class="policy-copy">${a.body.map((p) => `<p>${p}</p>`).join('')}<h2>One last thought</h2><p>There is no single right way to play. Start with curiosity, keep the invitation simple and let the child bring the rest.</p><a class="btn" href="#/catalog">Find something to play with <span class="arrow">↗</span></a></div></article></div>`;
}

// ------------------------------------------------------------------
// Sub-page system — centered editorial masthead + premium service pages.
// Every service route (help, contact, shipping, privacy, account) is built
// from the same masthead, cards and accordion language as the rest of the site.
// ------------------------------------------------------------------
const svHead = (crumb, kicker, title, intro) => `<div class="wrap page-head"><div class="breadcrumbs">${crumb}</div>${kicker ? `<div class="mono muted">${kicker}</div>` : ''}<h1 class="page-title">${title}</h1>${intro ? `<p class="page-intro">${intro}</p>` : ''}</div>`;

const HELP_FAQS = [
  ['Can I place a real order?', 'No \u2014 Playroom is a concept storefront for a class project. Checkout creates a local demo order stored only in this browser. No payment is taken and nothing is dispatched.'],
  ['How does delivery work?', 'Every product page has a PIN-code checker that shows a simulated delivery estimate. A live shop would connect that to a real logistics service; the dates here are illustrative.'],
  ['How do I track a parcel?', 'After a demo checkout you receive a FedEx-style tracking number. Paste it into Track an order to follow the simulated journey, milestone by milestone.'],
  ['Can I save products?', 'Yes \u2014 tap the heart on anything to keep it in your wish list. Your bag, wish list and demo orders live in this browser, so they are waiting whenever you return.'],
  ['What kind of returns can I expect?', 'The returns stories on this site describe how a real Playroom would work \u2014 unopened items, seven days, a pickup from your door. In this prototype nothing ships, so there is nothing to send back.'],
  ['How are payments handled?', 'Payments are demonstrated with a realistic gateway flow and a test card (4242 4242 4242 4242). No money moves, and card details never leave your browser.'],
  ['Is my information stored anywhere?', 'Only in your own browser \u2014 cart, wish list, demo orders and popup preferences. Clearing site data clears everything.'],
  ['Which toys suit which ages?', 'Every toy lists a recommended age band and a short note on its play value. The gift finder can narrow the collection by age, play style and budget in three taps.'],
];

function renderHelpPage() {
  return `<div class="route-enter">
  ${svHead(`<a href="#/">Home</a><span> / </span><span>Help &amp; FAQs</span>`, 'Playroom care', 'How can we help?', 'Answers to the questions we hear most \u2014 about orders, delivery, returns and the small details in between.')}
  <section class="sv-section wrap"><div class="sv-narrow">
    <div class="sv-grid-3">
      <a class="sv-topic" href="#/track-order"><span class="sv-topic-icon">\u2197</span><b>Track an order</b><small>Follow a demo parcel step by step, from dispatch to doorstep.</small><i>\u2197</i></a>
      <a class="sv-topic" href="#/shipping"><span class="sv-topic-icon">\u25ab</span><b>Shipping &amp; returns</b><small>Delivery windows, packaging and how a return would work.</small><i>\u2197</i></a>
      <a class="sv-topic" href="#/contact"><span class="sv-topic-icon">\u2709</span><b>Talk to us</b><small>A real form for questions, ideas and toy suggestions.</small><i>\u2197</i></a>
    </div>
    <div class="sv-faq">
      ${HELP_FAQS.map(([q, a], i) => `<details class="sv-q"${i === 0 ? ' open' : ''}><summary>${q}</summary><div class="sv-qa"><p>${a}</p></div></details>`).join('')}
    </div>
  </div></section>
  <section class="sv-band"><div class="wrap sv-band-inner">
    <div class="mono">Still wondering?</div>
    <h2>A real person is <em>one tap away.</em></h2>
    <p>Mira, our Playroom Care host, waits in the corner of every page \u2014 or send a note and we will reply within the story of this project.</p>
    <div class="sv-band-actions">
      <button class="btn" type="button" onclick="document.getElementById('plOpenChat').click()">Chat with us <span class="arrow">\u2197</span></button>
      <a class="btn outline" href="#/contact">Send a note <span class="arrow">\u2197</span></a>
    </div>
  </div></section></div>`;
}

function renderContactPage() {
  return `<div class="route-enter">
  ${svHead(`<a href="#/">Home</a><span> / </span><span>Talk to us</span>`, 'Playroom care', 'Talk to us.', 'A question, a suggestion, or a toy you think belongs here \u2014 everything that arrives is read.')}
  <section class="sv-section wrap">
    <div class="sv-contact">
      <form id="contactForm" class="sv-card sv-form">
        <div class="sv-card-head"><span class="mono">Send a note</span><h2>What\u2019s on your mind?</h2></div>
        <div class="form-grid">
          <div class="field"><label>Your name</label><input name="name" required></div>
          <div class="field"><label>Email address</label><input type="email" name="email" required></div>
          <div class="field full"><label>What would you like to tell us?</label><textarea name="message" required></textarea></div>
        </div>
        <div class="sv-form-foot">
          <button class="btn" type="submit">Send your note <span class="arrow">\u2197</span></button>
          <small>Demo form \u2014 your note is validated here and stays in this browser. Nothing is sent to a server.</small>
        </div>
      </form>
      <aside class="sv-side">
        <div class="sv-card">
          <div class="sv-card-head"><span class="mono">Other ways in</span><h2>Reach us without the form.</h2></div>
          <div class="sv-rows">
            <button type="button" class="sv-row" onclick="document.getElementById('plOpenChat').click()"><b>Chat with Mira</b><small>Playroom Care \u00b7 replies in moments</small><span>\u2197</span></button>
            <button type="button" class="sv-row" onclick="document.getElementById('plOpenCall').click()"><b>Audio call with Mira</b><small>A short recorded hello \u00b7 with live captions</small><span>\u2197</span></button>
            <a class="sv-row" href="#/track-order"><b>Track an order</b><small>FedEx-style demo tracking</small><span>\u2197</span></a>
            <a class="sv-row" href="#/help"><b>Help &amp; FAQs</b><small>Quick answers to common questions</small><span>\u2197</span></a>
          </div>
        </div>
        <div class="sv-card sv-card--tint">
          <div class="mono">Support hours</div>
          <div class="sv-hours"><span>Monday \u2013 Saturday</span><b>10:00 \u2013 18:00 IST</b></div>
          <div class="sv-hours"><span>Sunday</span><b>Notes only</b></div>
          <p class="sv-fineprint">In this concept store, replies are simulated. A live Playroom would answer within one working day.</p>
        </div>
      </aside>
    </div>
  </section></div>`;
}

function renderShippingPage() {
  return `<div class="route-enter">
  ${svHead(`<a href="#/">Home</a><span> / </span><span>Shipping &amp; returns</span>`, 'Delivery & returns', 'Getting things home.', 'How delivery, packaging and returns would work at a real Playroom \u2014 and what happens here instead.')}
  <section class="sv-section wrap"><div class="sv-narrow">
    <div class="sv-grid-3">
      <div class="sv-promise"><span class="mono">01</span><b>Complimentary delivery</b><p>Standard delivery is complimentary on orders over \u20b91,499 \u2014 the little threshold marked on every page.</p></div>
      <div class="sv-promise"><span class="mono">02</span><b>\u20b999 under that</b><p>Below \u20b91,499 a flat \u20b999 delivery fee applies, always shown clearly before you pay.</p></div>
      <div class="sv-promise"><span class="mono">03</span><b>Packed with care</b><p>In a real store: recycled boxes, no plastic filler, and a small note for the little one.</p></div>
    </div>
    <div class="sv-panel">
      <span class="mono">The dispatch, honestly</span>
      <div class="sv-line"><span>Dispatch window</span><b>Within 2\u20134 working days of a demo order</b></div>
      <div class="sv-line"><span>Delivery estimate</span><b>Usually 3\u20137 days after dispatch, depending on the PIN code</b></div>
      <div class="sv-line"><span>Serviceability</span><b>Check any product page \u2014 the PIN lookup is simulated</b></div>
      <div class="sv-line"><span>Courier</span><b>A FedEx-style demo integration, complete with a tracking timeline</b></div>
      <div class="sv-line"><span>Packaging</span><b>Designed to be opened slowly and reused or recycled</b></div>
    </div>
    <div class="mono sv-center" style="color:#9a6b55;margin:0 0 20px">How a return would work</div>
    <div class="sv-steps">
      <div class="sv-step"><i>STEP 01</i><b>Tell us what changed</b><p>One note with the order number is enough \u2014 no forms in triplicate, no interrogation.</p></div>
      <div class="sv-step"><i>STEP 02</i><b>We book the pickup</b><p>A courier collects from your door within 48 hours, in the same box if you kept it.</p></div>
      <div class="sv-step"><i>STEP 03</i><b>Refund in 3\u20135 days</b><p>Back to the original payment method, with a note when it is on its way.</p></div>
    </div>
    <p class="sv-note">This is a class-project prototype \u2014 nothing is dispatched, no real orders are accepted, and the returns story describes a live shop rather than this one.</p>
  </div></section></div>`;
}

function renderPrivacyPage() {
  const qs = [
    ['What exactly is stored?', 'Your cart, wish list, recently viewed toys, demo orders and a few preferences (like whether you have seen the welcome offer) are kept in your browser\u2019s local storage, under keys that start with \u201cplayroom\u201d.'],
    ['Payments & card details', 'This prototype demonstrates a realistic payment flow but never processes real payments. Test card details you type are validated in the page and never leave your browser \u2014 there is no server to receive them.'],
    ['The welcome offer & preferences', 'The one-time welcome popup remembers a simple \u201calready seen\u201d note so it does not reappear. Sharing an email in the demo form stores nothing beyond your own browser.'],
    ['The terms of this concept store', 'Playroom is a student-built concept storefront. Product names, prices, reviews and stock levels are illustrative. Nothing here constitutes a real offer of sale, and no goods or services are provided.'],
    ['Content, imagery & inspiration', 'Media used in this project is credited where possible and assembled for a class demonstration only. The design language takes cues from warm, editorial commerce experiences \u2014 with everything rebuilt from scratch.'],
  ];
  return `<div class="route-enter">
  ${svHead(`<a href="#/">Home</a><span> / </span><span>Privacy &amp; terms</span>`, 'Privacy & terms', 'The fine print, in plain words.', 'What this concept store keeps, where it keeps it, and the promises behind the demo.')}
  <section class="sv-section wrap"><div class="sv-narrow">
    <div class="sv-grid-3">
      <div class="sv-promise"><span class="mono">01</span><b>Stored on this device</b><p>Cart, wish list, demo orders and preferences live in your browser \u2014 not on a server.</p></div>
      <div class="sv-promise"><span class="mono">02</span><b>Nothing is transmitted</b><p>No real payments, no analytics, no accounts. Card details never leave the page.</p></div>
      <div class="sv-promise"><span class="mono">03</span><b>Yours to clear</b><p>Clearing site data resets everything instantly \u2014 no questions, no residue.</p></div>
    </div>
    <div class="sv-faq">
      ${qs.map(([q, a]) => `<details class="sv-q"><summary>${q}</summary><div class="sv-qa"><p>${a}</p></div></details>`).join('')}
    </div>
  </div></section></div>`;
}

function renderAccountPage() {
  const leaves = pointsBalance();
  const codes = Object.keys(state.redemptions || {});
  const referral = ensureReferral();
  return `<div class="route-enter" id="accountPage">
  ${svHead(`<a href="#/">Home</a><span> / </span><span>Account</span>`, 'YOUR CORNER · DEMO', 'Welcome back.', 'Sign-in is a demo feature — your saved things, bag, leaves and demo orders already live in this browser.')}
  <section class="sv-section wrap"><div class="sv-narrow">
    <div class="sv-stats">
      <div class="sv-stat"><b>${state.wishlist.length}</b><span>saved things</span></div>
      <div class="sv-stat"><b>${cartCount()}</b><span>in your bag</span></div>
      <div class="sv-stat"><b>${state.orders.length}</b><span>demo orders</span></div>
      <div class="sv-stat"><b>${leaves}</b><span>play leaves</span></div>
    </div>
    <div class="account-grid">
      <div class="account-card" id="leavesCard">
        <span class="mono muted">PLAY LEAVES · DEMO LOYALTY</span>
        <div class="leaves-balance"><b>${leaves}</b><span>leaves</span></div>
        <div class="leaves-progress"><i style="width:${Math.min(100, leaves / 400 * 100)}%"></i></div>
        <p>One leaf for every ₹50 spent. Four hundred leaves become a <b>₹200 code</b> you can use at checkout like any promotion code.</p>
        <button class="btn small" id="redeemLeaves" ${leaves < 400 ? 'disabled' : ''}>Redeem 400 leaves <span class="arrow">↗</span></button>
        ${codes.length ? `<div class="leaf-codes">${codes.map((c) => `<span class="leaf-code" title="Use at checkout">${safe(c)} · ₹${state.redemptions[c].fixed} off</span>`).join('')}</div>` : ''}
        <p class="account-note">Leaves are earned on demo orders and stored in this browser — nothing is tied to a real account.</p>
      </div>
      <div class="account-card">
        <span class="mono muted">REFER A FRIEND · DEMO</span>
        <div class="referral-code"><b>${safe(referral)}</b><button class="text-link" id="copyReferral" type="button">Copy</button></div>
        <p>Share your code — a real programme would credit you both 200 leaves. In this prototype the code exists, but no one is tracking anything.</p>
        <div class="referral-foot"><button class="text-link" id="copyShareLink" type="button">Copy wish-list share link <span>↗</span></button></div>
      </div>
    </div>
    <div class="sv-actions">
      <a class="sv-topic" href="#/orders"><span class="sv-topic-icon">✳</span><b>Orders &amp; returns</b><small>Receipts, buy-again and the demo returns desk${state.orders.length ? ` · ${state.orders.length} order${state.orders.length === 1 ? '' : 's'}` : ''}.</small><i>↗</i></a>
      <a class="sv-topic" href="#/wishlist"><span class="sv-topic-icon">♡</span><b>Your wish list</b><small>Everything you have set aside — ready to share.</small><i>↗</i></a>
      <button class="sv-topic" type="button" onclick="window.openDrawer('cart')"><span class="sv-topic-icon">✳</span><b>Open your bag</b><small>Continue where the last browse left off.</small><i>↗</i></button>
      <a class="sv-topic" href="#/safety"><span class="sv-topic-icon">◇</span><b>Safety &amp; materials</b><small>What everything is made of, plainly.</small><i>↗</i></a>
    </div>
    <p class="sv-note">Accounts are deliberately absent in this prototype: everything personal to you — cart, wish list, leaves, demo orders — stays in this browser and nowhere else.</p>
  </div></section></div>`;
}
function renderSimple(path) {
  const key = path.replace('/', '');
  if (key === 'contact') return renderContactPage();
  if (key === 'shipping') return renderShippingPage();
  if (key === 'privacy') return renderPrivacyPage();
  if (key === 'account') return renderAccountPage();
  return renderHelpPage();
}

function renderAbout() {
  return `<div class="route-enter"><div class="wrap page-top page-head"><div class="breadcrumbs"><a href="#/">Home</a> / Our point of view</div><div class="mono muted">A considered little toy shop</div><h1 class="page-title">Less noise.<br>More wonder.</h1><p class="page-intro">Playroom is a concept store built around one simple thought: the best toys make room for children to bring something of their own.</p></div><section class="section wrap"><div class="story-grid"><div class="story-art"><img src="${photo.wood}" alt="Thoughtful play materials" loading="lazy"></div><div class="story-copy"><div class="mono muted">What we look for</div><h2>Not more toys.<br>More possibility.</h2><p>We look for things that invite participation: a block that becomes a bridge, a card that starts a story, a puzzle that brings a family around the same table.</p><p>Our imagined collection is organised around kinds of play rather than trends alone. We want it to be easier to find something thoughtful and easier to understand why it might be right for a child.</p><p><b>Playroom is a student-built concept storefront.</b> Product descriptions, reviews, inventory and checkout are demonstration content—not claims of real stock or verified customer experiences.</p><a class="btn" href="#/catalog">Explore the collection <span class="arrow">↗</span></a></div></div></section>${advisoryStripHTML()}<section class="trust-strip"><div class="wrap trust-grid"><div class="trust-item"><div class="trust-icon">✳</div><div><b>Open-ended play</b><span>Room for a child's own ideas.</span></div></div><div class="trust-item"><div class="trust-icon">♡</div><div><b>Thoughtful gifting</b><span>Start with the person.</span></div></div><div class="trust-item"><div class="trust-icon">↗</div><div><b>Clear information</b><span>Age, contents and play value.</span></div></div><div class="trust-item"><div class="trust-icon">⌁</div><div><b>Curiosity first</b><span>Always another way to play.</span></div></div></div></section></div>`;
}

function renderGiftFinder() {
  return `<div class="route-enter"><div class="wrap page-top page-head"><div class="breadcrumbs"><a href="#/">Home</a> / Gift finder</div><div class="mono muted">A small shortcut to a good gift</div><h1 class="page-title">Let's find their<br>kind of wonder.</h1><p class="page-intro">A few quick choices, then we'll suggest toys that fit the age, the occasion and the kind of play they love.</p></div><section class="section wrap" style="padding-top:20px"><div class="gift-quiz"><div class="quiz-art"><img src="${photo.gift}" alt="A thoughtfully chosen gift" loading="lazy"></div><div class="quiz-copy"><div class="mono muted">The gift finder · 01 / 03</div><h2>A good gift starts with a little knowing.</h2><div class="quiz-step"><label>Who are we shopping for?</label><div class="choice-row" data-quiz-group="age"><button type="button" class="choice active" data-choice="age" data-value="3–7 years">Little explorer · 3–7</button><button type="button" class="choice" data-choice="age" data-value="8–12 years">Big thinker · 8–12</button><button type="button" class="choice" data-choice="age" data-value="0+ years">A tiny human · 0+</button></div></div><div class="quiz-step"><label>What kind of play lights them up?</label><div class="choice-row" data-quiz-group="kind"><button type="button" class="choice active" data-choice="kind" data-value="Building & STEM">Building</button><button type="button" class="choice" data-choice="kind" data-value="Games & Puzzles">Puzzles</button><button type="button" class="choice" data-choice="kind" data-value="Art & Imagination">Making</button><button type="button" class="choice" data-choice="kind" data-value="Soft & Plush">Cuddles</button><button type="button" class="choice" data-choice="kind" data-value="Science & Discovery">Discovering</button></div></div><div class="quiz-step"><label>What feels right for your budget?</label><div class="choice-row" data-quiz-group="budget"><button type="button" class="choice" data-choice="budget" data-value="500">Under ₹500</button><button type="button" class="choice active" data-choice="budget" data-value="1000">Under ₹1,000</button><button type="button" class="choice" data-choice="budget" data-value="2000">Under ₹2,000</button><button type="button" class="choice" data-choice="budget" data-value="5000">I'm flexible</button></div></div><button class="btn full" id="findGift">Find their kind of play <span class="arrow">↗</span></button></div></div></section></div>`;
}

function renderWishlist() {
  const list = state.wishlist.map(byId).filter(Boolean);
  return `<div class="route-enter"><div class="wrap page-top page-head"><div class="breadcrumbs"><a href="#/">Home</a> / Saved things</div><div class="mono muted">A shelf for later</div><h1 class="page-title">The wish list.</h1><p class="page-intro">Keep the good ideas in one place. A little shortlist for birthdays, surprises and future-you.</p></div><section class="section wrap" style="padding-top:20px">${list.length ? `<div class="wish-bar" id="wishBar"><div><span class="mono muted">${list.length} SAVED</span><p>Turn the shelf into a shareable list — name it, add a note, and send the link to grandparents and gift-givers.</p></div><div class="wish-bar-actions"><button class="btn small" id="shareWishlist" type="button">Share this list <span class="arrow">↗</span></button><a class="text-link" href="#/wish">Preview the shared view <span>↗</span></a></div></div>` : ''}<div class="product-grid">${list.length ? list.map(productCard).join('') : '<div class="empty-state"><div class="empty-icon">♡</div><h3>Nothing saved just yet.</h3><p>Tap the heart on anything that catches your eye and it will live here.</p><a class="btn" href="#/catalog">Find a favourite ↗</a></div>'}</div></section></div>`;
}
// ------------------------------------------------------------------
// Post-purchase — the orders & returns hub, play leaves & referrals,
// the shared wish list and the safety story. Everything here reads and
// writes this browser's localStorage only; nothing leaves the machine.
// ------------------------------------------------------------------

const repaintRoute = () => { render(); wirePage(); };

const ORDER_MODE_LABEL = { refund: 'Refund', exchange: 'Exchange' };

function orderCardHTML(order) {
  const rets = returnsForOrder(order.id);
  const gift = order.gift;
  const count = order.items.reduce((a, x) => a + x.qty, 0);
  return `<article class="order-card" data-order="${safe(order.id)}">
    <header class="order-card-head"><div><span class="mono muted">${safe(order.id)}</span><h3>${safe(order.createdAtLabel)} · ${formatMoney(order.total)}</h3><p>${count} item${count === 1 ? '' : 's'} · ${safe(order.paymentMethod)}${gift ? ' · gift order' : ''}${order.delivery ? ` · ${safe(order.delivery.label)}` : ''}</p></div><div class="order-card-side"><span class="post-pill">${safe(order.statusLabel || 'Order received')}</span>${order.pointsEarned ? `<span class="post-pill post-pill--leaf">✳ ${order.pointsEarned} leaves</span>` : ''}</div></header>
    <div class="order-items">${order.items.map((x) => `<span class="order-thumb" title="${safe(x.name)}">${x.image ? `<img src="${x.image}" alt="" loading="lazy">` : `<i aria-hidden="true">${GIFT_BOW_SVG}</i>`}<b>×${x.qty}</b></span>`).join('')}<span class="order-items-names">${safe(order.items.map((x) => x.name).join(' · '))}</span></div>
    <div class="order-actions"><button class="st-btn st-btn--secondary st-btn--sm" type="button" data-buy-again="${safe(order.id)}">Buy it again</button><button class="st-btn st-btn--secondary st-btn--sm" type="button" data-invoice="${safe(order.id)}">Invoice</button><a class="st-btn st-btn--secondary st-btn--sm" href="#/track-order?order=${encodeURIComponent(order.id)}">Track</a><button class="st-btn st-btn--secondary st-btn--sm" type="button" data-return="${safe(order.id)}">Return or exchange</button></div>
    ${rets.length ? `<div class="order-returns">${rets.map((r) => `<div class="order-return"><div class="order-return-head"><b>${safe(r.id)} · ${ORDER_MODE_LABEL[r.mode] || 'Return'}</b><span class="post-pill">${r.steps.filter((s) => s.done).length}/${r.steps.length} steps · demo</span></div><ol class="return-steps">${r.steps.map((s) => `<li class="${s.done ? 'done' : ''}"><i></i><span>${safe(s.k)}</span><small>${safe(s.when)}</small></li>`).join('')}</ol><p class="order-return-note">${safe(r.reason)} — a simulated desk; nothing is collected and no money moves.</p></div>`).join('')}</div>` : ''}
  </article>`;
}

function renderOrders() {
  const orders = state.orders;
  return `<div class="route-enter" id="ordersPage">
  ${svHead(`<a href="#/">Home</a><span> / </span><span>Orders & returns</span>`, 'YOUR DEMO HISTORY', 'Orders &<br><em>returns.</em>', 'Every checkout you complete in this browser lands here — receipts to download, a buy-again button and a returns desk that walks you through its steps.')}
  <section class="section wrap">
    <div class="post-stats"><div class="post-stat"><b>${orders.length}</b><span>demo orders</span></div><div class="post-stat"><b>${pointsBalance()}</b><span>play leaves</span></div><div class="post-stat"><b>${(state.returns || []).length}</b><span>returns & exchanges</span></div><div class="post-stat"><b>${state.wishlist.length}</b><span>saved things</span></div></div>
    ${orders.length ? orders.map(orderCardHTML).join('') : `<div class="empty-state"><div class="empty-icon">✳</div><h3>No demo orders yet.</h3><p>Complete a demo checkout and your receipt, tracking number and this returns desk all fill in.</p><a class="btn" href="#/catalog">Find something lovely ↗</a></div>`}
  </section></div>`;
}

function wireOrders() {
  const page = $('#ordersPage');
  if (!page) return;
  page.addEventListener('click', (e) => {
    const again = e.target.closest('[data-buy-again]');
    if (again) {
      const order = getOrder(again.dataset.buyAgain);
      if (!order) return;
      let added = 0;
      order.items.forEach((x) => {
        if (x.special === 'gift-wrap') return;
        const p = byId(x.productId);
        if (p) {
          addToCart({ productId: p.id, unitPrice: x.unitPrice, name: x.name, image: x.image, personalisation: x.personalisation || undefined }, 1);
          added++;
        }
      });
      toast(added ? 'Back in your bag.' : 'Nothing to add here.', added ? `${added} item${added > 1 ? 's' : ''} from ${order.id}` : '');
      return;
    }
    const inv = e.target.closest('[data-invoice]');
    if (inv) {
      const order = getOrder(inv.dataset.invoice);
      if (order) openModal(`Invoice · ${order.id}`, `<div class="invoice invoice--modal">${invoiceHTML(order)}</div><div class="invoice-modal-foot"><button class="st-btn st-btn--primary" type="button" onclick="window.print()">Download / print</button><p class="pdp-fine">Demo invoice — it lives only in this browser.</p></div>`);
      return;
    }
    const ret = e.target.closest('[data-return]');
    if (ret) openReturnSheet(getOrder(ret.dataset.return));
  });
}

function openReturnSheet(order) {
  if (!order) return;
  const items = order.items.filter((x) => x.special !== 'gift-wrap');
  openModal(`Return or exchange · ${order.id}`, `<div class="return-sheet">
    <p class="return-intro">Tell the desk what's coming back and why. This is a demo — nothing is collected, no money moves, and every step below is simulated.</p>
    <div class="return-items">${items.map((x, i) => `<label class="st-billrow return-item"><input type="checkbox" data-return-item="${i}" checked><span class="st-check">${ST_CHECK}</span><span>${safe(x.name)}${x.personalisation ? ` · personalised “${safe(x.personalisation)}”` : ''}</span></label>`).join('')}</div>
    <label class="st-label return-label" for="returnReason">Reason</label>
    <div class="st-selectwrap"><select class="st-input st-select" id="returnReason">${['Changed my mind', 'A part is missing', 'Not the right age for it', 'It arrived damaged', 'It was a duplicate gift'].map((r) => `<option>${r}</option>`).join('')}</select><svg class="st-chev" viewBox="0 0 16 16"><path d="M3.5 6 8 10.5 12.5 6"/></svg></div>
    <div class="return-modes"><label class="return-mode"><input type="radio" name="returnMode" value="refund" checked><span><b>Refund</b><small>To the original payment method (demo)</small></span></label><label class="return-mode"><input type="radio" name="returnMode" value="exchange"><span><b>Exchange</b><small>Swap for something else in the shop</small></span></label></div>
    <p class="pdp-fine">Personalised pieces can't be returned in a real shop — in this prototype everything is simulated anyway.</p>
    <button class="st-btn st-btn--primary return-submit" type="button" id="returnSubmit">Start this return (demo)</button>
  </div>`);
  $('#returnSubmit')?.addEventListener('click', () => {
    const picked = [...document.querySelectorAll('[data-return-item]:checked')].map((c) => items[+c.dataset.returnItem]).filter(Boolean);
    if (!picked.length) { toast('Pick at least one item.', 'The desk needs something to collect.'); return; }
    const reason = $('#returnReason')?.value || 'Changed my mind';
    const mode = document.querySelector('input[name="returnMode"]:checked')?.value || 'refund';
    const ret = createReturn(order, { items: picked.map((x) => ({ name: x.name, qty: x.qty })), reason, mode });
    closeModal();
    toast(`${ORDER_MODE_LABEL[mode]} ${ret.id} started.`, 'A simulated pickup is scheduled — watch the steps.');
    repaintRoute();
  });
}

/* ---- the shared wish list ------------------------------------------ */

function shareWishUrl() {
  return location.origin + location.pathname + '#/wish';
}

function openShareWishlist() {
  const s = storageRead('wish-share', {}) || {};
  openModal('Share the wish list', `<div class="share-sheet">
    <p class="return-intro">Give the shelf a name and a note. In a real shop the link would open this list anywhere; in this prototype it opens the saved list on this device only — there is no server behind it.</p>
    <label class="st-label return-label" for="shareFor">Whose list is this?</label>
    <input class="st-input" id="shareFor" maxlength="40" placeholder="Maya's 5th birthday" value="${safe(s.for || '')}">
    <label class="st-label return-label" for="shareNote">A note for gift-givers</label>
    <textarea class="st-input st-textarea" id="shareNote" maxlength="140" placeholder="Anything here would be adored. No rush at all.">${safe(s.note || '')}</textarea>
    <div class="share-link"><span class="mono">DEMO LINK</span><code>${safe(shareWishUrl())}</code></div>
    <div class="share-actions"><button class="st-btn st-btn--primary" type="button" id="shareSave">Save &amp; copy link</button><a class="st-btn st-btn--secondary" href="#/wish" id="sharePreview">Preview the shared view</a></div>
    <p class="pdp-fine">${state.wishlist.length} saved thing${state.wishlist.length === 1 ? '' : 's'} · a registry would normally live on a server; this one lives in your browser.</p>
  </div>`);
  $('#shareSave')?.addEventListener('click', async () => {
    storageWrite('wish-share', { for: ($('#shareFor')?.value || '').trim(), note: ($('#shareNote')?.value || '').trim(), at: new Date().toISOString() });
    try { await navigator.clipboard.writeText(shareWishUrl()); toast('Link copied.', 'It opens the shared view on this device (demo).'); }
    catch { toast('List saved.', 'Copy the link from the shared view.'); }
    closeModal();
  });
  $('#sharePreview')?.addEventListener('click', () => closeModal());
}

function wireWish() {
  const bar = $('#wishBar');
  if (!bar) return;
  bar.addEventListener('click', (e) => {
    if (!e.target.closest('#shareWishlist')) return;
    if (!state.wishlist.length) { toast('Nothing to share yet.', 'Save a few things first.'); return; }
    openShareWishlist();
  });
}

/* ---- account v2: leaves + referral ---------------------------------- */

function wireAccount() {
  const card = $('#leavesCard');
  if (!card) return;
  $('#redeemLeaves')?.addEventListener('click', () => {
    const code = redeemLeaves();
    if (!code) { toast('Not enough leaves yet.', '400 leaves become a ₹200 code.'); return; }
    toast(`Code ${code} is ready.`, 'Use it at checkout like any promotion code.');
    repaintRoute();
  });
  const copy = async (sel, get, msg) => {
    $(sel)?.addEventListener('click', async () => {
      const text = get();
      try { await navigator.clipboard.writeText(text); toast(msg, text); }
      catch { toast('Clipboard is blocked here.', text); }
    });
  };
  copy('#copyReferral', () => ensureReferral(), 'Referral code copied.');
  copy('#copyShareLink', () => shareWishUrl(), 'Share link copied.');
}

/* ---- the safety & materials story ----------------------------------- */

function advisoryStripHTML() {
  return `<section class="section wrap advisory-strip"><div class="advisory-head"><div><span class="mono muted">DESIGNED WITH EDUCATORS</span><h2>The thinking behind<br><em>the toy box.</em></h2></div><p>An advisory panel of early-years educators and play specialists frames the developmental notes across the shop. In this concept storefront the panel and its notes are illustrative — the reasoning follows real play research.</p></div><div class="advisory-row">${ADVISORS.map((a) => `<div class="advisor-chip advisor-chip--wide"><span class="post-avatar" style="--av:${a.tone}">${a.initials}</span><div><b>${safe(a.name)}</b><span>${safe(a.role)}</span><p>“${safe(a.line)}”</p></div></div>`).join('')}</div><p class="pdp-fine">${ADVISORY_NOTE}</p></section>`;
}

function renderSafetyPage() {
  const packaging = [
    { icon: '◇', title: 'Paper, not polybags', body: 'Demo parcels pack in recycled paper wrap with a paper tape seal. No plastic film, no polystyrene.' },
    { icon: '↻', title: 'Boxes that live twice', body: 'Cartons are sized to be kept as storage boxes first and recycled last, printed with soy-based inks.' },
    { icon: '✳', title: 'Nothing hidden', body: 'Every product page lists what a toy is made of, how it is finished and how to care for it.' },
  ];
  return `<div class="route-enter">
  ${svHead(`<a href="#/">Home</a><span> / </span><span>Safety & materials</span>`, 'WHAT THINGS ARE MADE OF', 'Kind to mouths,<br><em>hands and floors.</em>', 'Materials, certifications and packaging promises — written plainly, for the grown-ups doing the worrying.')}
  <section class="section wrap"><div class="safety-grid">
    <div class="safety-intro"><span class="mono muted">THE SHORT VERSION</span><p>Toys go in mouths, across floors and into little hands mid-tantrum. Every material in this catalogue was chosen with that reality in mind — and every claim on this page describes the design intent of a concept storefront, not a tested physical product.</p><p class="safety-note">${safe(SAFETY_NOTE_SMALL_PARTS)}</p></div>
    <div class="cert-grid">${DESIGN_STANDARDS.map((s) => `<div class="cert-chip"><b>${safe(s.mark)}</b><span>${safe(s.label)}</span><small>${safe(s.note)}</small></div>`).join('')}</div>
  </div></section>
  <section class="section wrap"><div class="pdp-sec-head"><div><div class="mono muted">MATERIALS, HONESTLY</div><h2>What each shelf<br><em>is made of.</em></h2></div><p class="pdp-sec-aside">The full material card lives on every product page. Here it is gathered in one place, from beechwood to recycled greyboard.</p></div>
    <div class="mat-grid">${Object.entries(MATERIALS_BY_KIND).map(([kind, m]) => `<div class="mat-card"><b>${safe(kind.charAt(0).toUpperCase() + kind.slice(1))}</b><dl><dt>Made</dt><dd>${safe(m.made)}</dd><dt>Finish</dt><dd>${safe(m.finish)}</dd><dt>Care</dt><dd>${safe(m.care)}</dd></dl></div>`).join('')}</div>
  </section>
  <section class="section wrap"><div class="pdp-sec-head"><div><div class="mono muted">PACKAGING PROMISES</div><h2>What arrives<br><em>at your door.</em></h2></div><p class="pdp-sec-aside">Three promises about the pile of paper that lands with every parcel.</p></div>
    <div class="pack-row">${packaging.map((x) => `<div class="pack-card"><span class="pack-icon">${x.icon}</span><b>${safe(x.title)}</b><p>${safe(x.body)}</p></div>`).join('')}</div>
    <div class="parts-promise"><div><span class="mono muted">THE REPLACEMENT-PARTS PROMISE</span><h3>Lost a piece? It happens.</h3><p>Every product page has a “request a part” desk — a single wheel, a missing puzzle piece, a new instruction card. Keep a toy whole instead of replacing it.</p></div><a class="btn outline" href="#/catalog">Open any toy's parts desk <span class="arrow">↗</span></a></div>
    <p class="pdp-fine">${safe(SAFETY_DEMO_NOTE)}</p>
  </section>
  ${advisoryStripHTML()}</div>`;
}

function renderWish() {
  const list = state.wishlist.map(byId).filter(Boolean);
  const s = storageRead('wish-share', null) || {};
  return `<div class="route-enter">
  ${svHead(`<a href="#/">Home</a><span> / </span><span>Shared list</span>`, 'SHARED VIEW · DEMO', s.for ? safe(s.for) : 'A shared little list', s.note ? safe(s.note) : 'Saved with love from the Playroom wish list. In a real shop this page would load the list from a share link; here it reads the saved shelf in this browser.')}
  <section class="section wrap" style="padding-top:22px">
    ${list.length ? `<div class="wish-shared-bar"><span class="mono muted">${list.length} GOOD IDEA${list.length === 1 ? '' : 'S'}</span><span class="post-pill post-pill--leaf">✳ Demo — links open on this device only</span></div><div class="product-grid">${list.map(productCard).join('')}</div>` : '<div class="empty-state"><div class="empty-icon">♡</div><h3>This shared list is empty.</h3><p>Save a few things first, then share the shelf.</p><a class="btn" href="#/catalog">Find a favourite ↗</a></div>'}
    <p class="pdp-fine">A real registry page would live on a server and open anywhere; this concept storefront keeps everything in your browser.</p>
  </section></div>`;
}

// ------------------------------------------------------------------
// Route registry
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// The community — the playroom. Members post, moderators reply.
// Fully interactive: posting, replying, hearts, filters and sorting
// all work, and everything you write is remembered in your browser.
// ------------------------------------------------------------------
const COMMUNITY_TOPICS = ['All', 'Builds', 'Crafts', 'Gifting wins', 'Questions'];
const COMMUNITY_STORE_KEY = 'playroom-community-v1';
const COMMUNITY_ME = { name: 'You', initials: 'YU', tone: '#a56a76', role: 'Playroom member' };
const COMMUNITY_POSTS = [
  {
    id: 'c1', topic: 'Builds', pinned: true, name: 'Priya · Playroom team', initials: 'PL', tone: '#4c3428',
    role: 'Community moderator', time: 'Yesterday', image: null, likes: 212,
    text: 'Welcome to the playroom — our little corner for show-and-tell. Post the towers, the paintings, the half-finished masterpieces. Be kind, credit the makers, and our mods will be around all week with tips and ideas. ✳',
    replies: [
      { name: 'Mia R.', initials: 'MR', tone: '#b56f7b', time: '18 h ago', text: 'Such a lovely idea. My two are already planning their entry for this week’s prompt…' },
      { mod: true, name: 'Dev · Playroom team', initials: 'PL', tone: '#8a6a3f', time: '12 h ago', text: 'We can’t wait to see it, Mia. Post it with #thisweeksprompt and we’ll pin our favourites on Friday.' },
    ],
  },
  {
    id: 'c2', topic: 'Builds', name: 'Mia R.', initials: 'MR', tone: '#b56f7b',
    role: 'Parent of two', time: '4 h ago', image: photos[3], likes: 48,
    text: 'Rainy Saturday = the marble run came back out. They rebuilt the whole spiral twice without a single “I’m bored”. I’m calling it a win.',
    replies: [
      { name: 'Jonas K.', initials: 'JK', tone: '#6f8a6a', time: '3 h ago', text: 'That spiral is serious engineering. How long did it stand before someone bumped the table?' },
      { mod: true, name: 'Priya · Playroom team', initials: 'PL', tone: '#4c3428', time: '2 h ago', text: 'The office record is 41 minutes. Consider this an official challenge — we’ll be watching for the rematch. ✳' },
    ],
  },
  {
    id: 'c3', topic: 'Crafts', name: 'Aisha N.', initials: 'AN', tone: '#c98a5b',
    role: 'Member since 2025', time: '6 h ago', image: photos[10], likes: 31,
    text: 'We painted the cardboard boxes instead of throwing them out — apparently the box WAS the toy all along. Saving this one for the scrapbook.',
    replies: [
      { mod: true, name: 'Priya · Playroom team', initials: 'PL', tone: '#4c3428', time: '5 h ago', text: 'Every play expert we’ve ever met says the same: the box is never just a box. Beautiful work, Aisha.' },
    ],
  },
  {
    id: 'c4', topic: 'Gifting wins', name: 'Jonas K.', initials: 'JK', tone: '#6f8a6a',
    role: 'Gift-finder regular', time: 'Yesterday', image: null, likes: 27,
    text: 'Used the gift finder for my niece’s fifth birthday — the flower-press kit was a hit with both the kid AND the parents. Sent the link to three other uncles already.',
    replies: [
      { name: 'Sofia T.', initials: 'ST', tone: '#a56a76', time: 'Yesterday', text: 'Good to know — my niece turns five next month. Adding it to the list right now.' },
    ],
  },
  {
    id: 'c5', topic: 'Questions', name: 'Sofia T.', initials: 'ST', tone: '#a56a76',
    role: 'New here', time: '2 d ago', image: photos[21], likes: 19,
    text: 'Honest question: how do you store the tiny pieces so they don’t migrate under the sofa? I need the system that actually survives a toddler.',
    replies: [
      { mod: true, name: 'Priya · Playroom team', initials: 'PL', tone: '#4c3428', time: '2 d ago', text: 'Our honest answer: clear zip pouches, one per set, tipped into a single deep basket. The toddler can’t resist the basket — but the pouches survive.' },
      { name: 'Mia R.', initials: 'MR', tone: '#b56f7b', time: '1 d ago', text: '+1 for the basket. Labels with a picture of the toy helped ours put things back at bedtime.' },
    ],
  },
  {
    id: 'c6', topic: 'Builds', name: 'Kenji M.', initials: 'KM', tone: '#7d6a9a',
    role: 'Grandparent duty', time: '2 d ago', image: photos[30], likes: 64,
    text: 'Three generations around the same puzzle this weekend. My mother claims she “just watched”. The photo says otherwise.',
    replies: [
      { mod: true, name: 'Dev · Playroom team', initials: 'PL', tone: '#8a6a3f', time: '1 d ago', text: 'This is the whole idea of Playroom in one photo, Kenji. Borrowing this for our wall of lovely things — with your permission. ✳' },
    ],
  },
];

function communityStore() {
  try {
    const raw = localStorage.getItem(COMMUNITY_STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { liked: s.liked || [], posts: s.posts || [], replies: s.replies || {} };
    }
  } catch (e) {}
  return { liked: [], posts: [], replies: {} };
}
function communityPersist(s) {
  try { localStorage.setItem(COMMUNITY_STORE_KEY, JSON.stringify(s)); } catch (e) {}
}
function communityReplyLabel(n) { return `${n} ${n === 1 ? 'reply' : 'replies'}`; }
function communityReply(r) {
  return `<div class="post-reply${r.mod ? ' mod' : ''}"><span class="post-avatar" style="--av:${r.tone}">${r.initials}</span><div class="post-reply-body"><div class="post-reply-head"><b>${r.name}</b>${r.mod ? '<span class="mod-chip">Mod</span>' : ''}<time>${r.time}</time></div><p>${r.text}</p></div></div>`;
}
function communityPostCard(p) {
  const liked = !!p.liked;
  const count = p.likes + (liked ? 1 : 0);
  return `<article class="post-card${p.pinned ? ' pinned' : ''}${p.fresh ? ' post-new' : ' reveal'}" data-topic="${p.topic}" data-id="${p.id}" data-idx="${p.idx}" data-likes="${count}">
    <header class="post-head"><span class="post-avatar" style="--av:${p.tone}">${p.initials}</span><div class="post-who"><b>${p.name}</b><span class="post-role">${p.role}</span></div>${p.pinned ? '<span class="pin-chip">Pinned by a mod</span>' : ''}<time>${p.time}</time></header>
    <div class="post-body"><p>${p.text}</p>${p.image ? `<img src="${p.image}" alt="Shared by ${p.name}" loading="lazy" decoding="async">` : ''}</div>
    <span class="post-tag">${p.topic}</span>
    <footer class="post-foot"><button class="post-like${liked ? ' liked' : ''}" data-like aria-label="Appreciate this post"><span class="post-like-icon" aria-hidden="true"></span><span data-like-count>${count}</span></button><button class="post-replies" data-thread="${p.id}" data-label="${communityReplyLabel(p.replies.length)}">${communityReplyLabel(p.replies.length)}</button></footer>
    <div class="post-thread" data-thread-body="${p.id}" hidden>${p.replies.map(communityReply).join('')}<form class="post-reply-form" data-reply-form="${p.id}"><input name="reply" placeholder="Add a reply…" autocomplete="off" aria-label="Add a reply"><button class="btn small" type="submit">Reply</button></form></div>
  </article>`;
}

function renderCommunity() {
  const cs = communityStore();
  const userPosts = cs.posts.map((p, i) => ({ ...p, replies: p.replies || [], liked: cs.liked.includes(p.id), idx: -1000 - i }));
  const seedPosts = COMMUNITY_POSTS.map((p, i) => ({ ...p, replies: [...p.replies, ...(cs.replies[p.id] || [])], liked: cs.liked.includes(p.id), idx: i }));
  const posts = [...userPosts, ...seedPosts];
  const postCount = 312 + cs.posts.length;
  return `<div class="route-enter"><div class="wrap page-top page-head"><div class="breadcrumbs"><a href="#/">Home</a> / The community</div><div class="mono muted">The playroom — open to everyone</div><h1 class="page-title">Made and loved by you.</h1><p class="page-intro">Show-and-tell for Playroom families: builds, crafts, gifting wins and honest questions. Moderators drop in daily with answers, tips and the occasional surprise.</p></div>
  <section class="section wrap" id="communityContent">
    <div class="community-top">
      <div class="community-prompt reveal"><div class="mono">This week’s prompt · closes Friday</div><h2>Show us <em>the build she’s proudest of.</em></h2><p>Post it with #thisweeksprompt. Our moderators pick their favourites every Friday, and the top three little makers get a small parcel on us.</p><button class="btn light" data-prompt-post>Post yours <span class="arrow">↗</span></button></div>
      <div class="community-stats">
        <div class="community-stat reveal"><b>4,208</b><span>Little makers this month</span></div>
        <div class="community-stat reveal"><b id="communityPostsStat" data-count="${postCount}">${postCount.toLocaleString('en-IN')}</b><span>Posts shared this month</span></div>
        <div class="community-stat reveal"><b>96%</b><span>Questions answered by a mod</span></div>
      </div>
    </div>
    <div class="community-layout">
      <div class="community-feed">
        <div class="community-filters"><div class="community-topic-filters">${COMMUNITY_TOPICS.map((t, i) => `<button class="filter-chip${i === 0 ? ' active' : ''}" data-ctopic="${t}">${t}</button>`).join('')}</div><div class="sort-toggle" role="group" aria-label="Sort posts"><button class="active" type="button" data-csort="recent">Recent</button><button type="button" data-csort="liked">Most loved</button></div></div>
        <form id="communityComposer" class="community-composer"><input name="post" placeholder="Share something with the playroom…" autocomplete="off" aria-label="Share something with the playroom"><select name="topic" aria-label="Choose a topic">${COMMUNITY_TOPICS.slice(1).map((t) => `<option>${t}</option>`).join('')}</select><button class="btn" type="submit">Post <span class="arrow">↗</span></button></form>
        <div id="communityFeed">${posts.map(communityPostCard).join('')}</div>
        <p class="community-footnote">Fully working and local — posts, replies and hearts are saved in your browser and never leave it.</p>
      </div>
      <aside class="community-side">
        <div class="side-card reveal"><h4>How the playroom works</h4><ul><li><i>✳</i>Be kind. Every maker here is still learning.</li><li><i>✳</i>Credit the makers — ask before reposting a photo.</li><li><i>✳</i>No selling, no spam, no grown-up arguments.</li><li><i>✳</i>A moderator reads every post within a day.</li></ul></div>
        <div class="side-card reveal"><h4>Top members this month</h4><div class="member-row"><span class="post-avatar" style="--av:#b56f7b">MR</span><b>Mia R.</b><span>18 posts</span></div><div class="member-row"><span class="post-avatar" style="--av:#c98a5b">AN</span><b>Aisha N.</b><span>14 posts</span></div><div class="member-row"><span class="post-avatar" style="--av:#6f8a6a">JK</span><b>Jonas K.</b><span>11 posts</span></div><div class="member-row"><span class="post-avatar" style="--av:#7d6a9a">KM</span><b>Kenji M.</b><span>9 posts</span></div></div>
        <div class="side-card reveal"><h4>Trending topics</h4><div class="trending-tags"><span>#thisweeksprompt</span><span>#marblewentwrong</span><span>#rainydayrescues</span><span>#giftingwins</span><span>#tidy-up-sos</span></div></div>
      </aside>
    </div>
  </section></div>`;
}

registerRoutes({
  '/': renderHome,
  '/catalog': (r) => renderCatalog(r.params),
  '/product/': (r) => { const p = bySlug(r.path.slice(9)); return p ? renderProduct(p) : notFound(); },
  '/wishlist': renderWishlist,
  '/wish': renderWish,
  '/orders': renderOrders,
  '/safety': renderSafetyPage,
  '/stage': (r) => (r.path === '/stage' ? renderStagesIndex() : renderStagePage(r.path.slice(7))),
  '/gift-finder': renderGiftFinder,
  '/journal': (r) => renderJournal(r.path),
  '/community': renderCommunity,
  '/checkout': renderCheckout,
  '/order-confirmation': renderConfirmation,
  '/track-order': renderTrack,
  '/about': renderAbout,
  '/help': () => renderSimple('/help'),
  '/shipping': () => renderSimple('/shipping'),
  '/privacy': () => renderSimple('/privacy'),
  '/contact': () => renderSimple('/contact'),
  '/account': () => renderSimple('/account'),
});
const renderNotFound = notFound;
window.renderNotFound = notFound;
setNotFound(notFound);

// ------------------------------------------------------------------
// Per-route wiring
// ------------------------------------------------------------------
function wirePage() {
  if ($('#successPanel') && !reduced) confettiBurst($('#successPanel'));
  // Catalog
  $$('.filter-title').forEach((b) => b.addEventListener('click', () => b.parentElement.classList.toggle('expanded')));
  $$('input[name="catFilter"]').forEach((i) => i.addEventListener('change', () => catalogFilter('category', i.value)));
  $$('input[name="ageFilter"]').forEach((i) => i.addEventListener('change', () => catalogFilter('age', i.value)));
  $$('input[name="stageFilter"]').forEach((i) => i.addEventListener('change', () => catalogFilter('stage', i.value)));
  $$('input[name="priceFilter"]').forEach((i) => i.addEventListener('change', () => catalogFilter('max', i.value)));
  $('#saleFilter')?.addEventListener('change', (e) => catalogFilter('sale', e.target.checked ? '1' : ''));
  $('#sortSelect')?.addEventListener('change', (e) => catalogFilter('sort', e.target.value));
  $('#clearFilters')?.addEventListener('click', () => { holdScrollOnce(); go('/catalog'); });
  $('#emptyReset')?.addEventListener('click', () => { holdScrollOnce(); go('/catalog'); });
  $('#loadMore')?.addEventListener('click', () => toast('You’ve reached the end.', 'That is the full demo collection.'));
  $$('[data-fastfilter]').forEach((b) => b.addEventListener('click', () => {
    const p = new URLSearchParams(route().params);
    p.delete('sale'); p.delete('sort');
    if (b.dataset.fastfilter === 'sale') p.set('sale', '1');
    if (b.dataset.fastfilter === 'new') p.set('sort', 'newest');
    holdScrollOnce();
    go('/catalog?' + p.toString());
  }));
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => {
    $$('[data-view]').forEach((x) => x.classList.toggle('active', x === b));
    $('#catalogGrid')?.classList.toggle('list-view', b.dataset.view === 'list');
  }));
  $$('[data-category]').forEach((b) => b.addEventListener('click', () => go('/catalog?category=' + encodeURIComponent(b.dataset.category))));

  // PDP — all depth wiring lives in wirePdp()
  const pdpProduct = route().path.startsWith('/product/') ? bySlug(route().path.slice(9)) : null;
  if (pdpProduct) wirePdp(pdpProduct);
  startPromiseTicker();
  $$('[data-compare-add]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.compareAdd;
    const on = !window.__compare.includes(id);
    toggleCompare(id, on);
    b.innerHTML = (on ? 'Remove from comparison' : 'Compare this toy') + ' <span>↗</span>';
  }));

  // Gift finder
  $$('[data-choice]').forEach((b) => b.addEventListener('click', () => {
    const group = b.dataset.choice;
    $$(`[data-choice="${group}"]`).forEach((x) => x.classList.toggle('active', x === b));
  }));
  $('#findGift')?.addEventListener('click', () => {
    const age = $('.choice.active[data-choice="age"]')?.dataset.value || '3–7 years';
    const kind = $('.choice.active[data-choice="kind"]')?.dataset.value || 'Building & STEM';
    const budget = +($('.choice.active[data-choice="budget"]')?.dataset.value || 1000);
    go('/catalog?category=' + encodeURIComponent(kind) + '&max=' + budget + '&age=' + encodeURIComponent(age));
  });

  // Newsletter / contact / track / checkout
  $('#newsletterForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#newsletterEmail').value.trim().toLowerCase();
    if (state.newsletter.includes(email)) { toast('You’re already on the list.'); return; }
    state.newsletter.push(email);
    import('./store.js').then((m) => m.persist());
    $('#newsletterForm').reset();
    toast('You’re on the list.', '(Demo signup — no real subscription)');
  });
  $('#contactForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    openModal('Your note is ready', `<div class="success-panel"><div class="success-icon">✓</div><h2>Thanks for the thought.</h2><p>Your message passed the demo form validation. It has not been sent to a server.</p><button class="btn" id="successClose">Back to Playroom ↗</button></div>`);
  });
  wireTrack();
  wireCheckout();
  wireOrders();
  wireWish();
  wireAccount();
  wireSponsored(); // home — swipeable sponsored picks

  // Community — the playroom (posts, replies, likes, filters, sorting)
  if ($('#communityContent')) {
    const feed = $('#communityFeed');
    const cs = communityStore();
    const applyFilter = () => {
      const t = $('[data-ctopic].active')?.dataset.ctopic || 'All';
      $$('.post-card', feed).forEach((card) => { card.style.display = (t === 'All' || card.dataset.topic === t) ? '' : 'none'; });
    };
    const applySort = () => {
      const mode = $('[data-csort].active')?.dataset.csort || 'recent';
      const cards = $$('.post-card', feed);
      cards.sort((a, b) => {
        if (mode === 'liked') return Number(b.dataset.likes) - Number(a.dataset.likes);
        return Number(a.dataset.idx) - Number(b.dataset.idx);
      });
      cards.forEach((c) => feed.appendChild(c));
    };
    $$('[data-ctopic]').forEach((chip) => chip.addEventListener('click', () => {
      $$('[data-ctopic]').forEach((c) => c.classList.toggle('active', c === chip));
      applyFilter();
    }));
    $$('[data-csort]').forEach((b) => b.addEventListener('click', () => {
      $$('[data-csort]').forEach((x) => x.classList.toggle('active', x === b));
      applySort();
    }));
    feed.addEventListener('click', (e) => {
      const like = e.target.closest('[data-like]');
      if (like) {
        const card = like.closest('.post-card');
        const on = like.classList.toggle('liked');
        const n = like.querySelector('[data-like-count]');
        const next = Math.max(0, Number(n.textContent) + (on ? 1 : -1));
        n.textContent = String(next);
        card.dataset.likes = String(next);
        cs.liked = on ? [...new Set([...cs.liked, card.dataset.id])] : cs.liked.filter((id) => id !== card.dataset.id);
        communityPersist(cs);
        return;
      }
      const tg = e.target.closest('[data-thread]');
      if (tg) {
        const body = $(`[data-thread-body="${tg.dataset.thread}"]`, feed);
        if (!body) return;
        const opening = body.hidden;
        body.hidden = !opening;
        tg.textContent = opening ? 'Hide replies' : tg.dataset.label;
        tg.classList.toggle('open', opening);
      }
    });
    feed.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-reply-form]');
      if (!form) return;
      e.preventDefault();
      const input = form.querySelector('input');
      const text = input.value.trim();
      if (!text) { toast('Write a little something first.'); return; }
      const id = form.dataset.replyForm;
      const safeText = safe(text);
      form.insertAdjacentHTML('beforebegin', communityReply({ ...COMMUNITY_ME, time: 'Just now', text: safeText }));
      const body = form.closest('.post-thread');
      body.hidden = false;
      const tg = $(`[data-thread="${id}"]`, feed);
      const n = body.querySelectorAll('.post-reply').length;
      if (tg) { tg.dataset.label = communityReplyLabel(n); tg.textContent = 'Hide replies'; tg.classList.add('open'); }
      const stored = { name: COMMUNITY_ME.name, initials: COMMUNITY_ME.initials, tone: COMMUNITY_ME.tone, time: 'Just now', text: safeText };
      if (id.startsWith('u')) {
        const post = cs.posts.find((x) => x.id === id);
        if (post) { (post.replies = post.replies || []).push(stored); communityPersist(cs); }
      } else {
        (cs.replies[id] = cs.replies[id] || []).push(stored);
        communityPersist(cs);
      }
      input.value = '';
      toast('Reply added. ✳', 'Saved in your browser — this playroom is a demo.');
    });
    $('#communityComposer')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = e.target.querySelector('input');
      const text = input.value.trim();
      if (!text) { toast('Write a little something first.'); return; }
      const topic = e.target.querySelector('select')?.value || 'Builds';
      const id = 'u' + Date.now();
      const post = { id, topic, name: COMMUNITY_ME.name, initials: COMMUNITY_ME.initials, tone: COMMUNITY_ME.tone, role: COMMUNITY_ME.role, time: 'Just now', image: null, likes: 0, replies: [], text: safe(text) };
      cs.posts.unshift(post);
      communityPersist(cs);
      feed.insertAdjacentHTML('afterbegin', communityPostCard({ ...post, idx: -1000 - cs.posts.length, liked: false, fresh: true }));
      e.target.reset();
      applyFilter();
      applySort();
      const stat = $('#communityPostsStat');
      if (stat) { const c = Number(stat.dataset.count || 0) + 1; stat.dataset.count = String(c); stat.textContent = c.toLocaleString('en-IN'); }
      toast('Posted to the playroom. ✳', 'Saved in your browser — this playroom is a demo.');
    });
    $('[data-prompt-post]')?.addEventListener('click', () => {
      $('#communityComposer input')?.focus();
      toast('This week’s prompt', 'Post it with #thisweeksprompt — mods pick favourites on Fridays.');
    });
  }

}

function catalogFilter(k, v) {
  holdScrollOnce(); // keep the visitor where they are while the grid re-filters
  const p = new URLSearchParams(route().params);
  if (v) p.set(k, v); else p.delete(k);
  go('/catalog?' + p.toString());
}
window.openDrawer = openDrawer;

// ------------------------------------------------------------------
// Global wiring
// ------------------------------------------------------------------
window.__compare = [];
function init() {
  $('#openCart').addEventListener('click', () => openDrawer('cart'));
  $('#openWishlist').addEventListener('click', () => openDrawer('wishlist'));
  $('#closeDrawer').addEventListener('click', closeDrawer);
  $('#drawerOverlay').addEventListener('click', (e) => { if (e.target === $('#drawerOverlay')) closeDrawer(); });
  $('#drawerBody').addEventListener('click', (e) => {
    const q = e.target.closest('[data-qty]');
    if (q) { changeQty(q.dataset.qty, +q.dataset.delta); return; }
    const rm = e.target.closest('[data-remove]');
    if (rm) { removeFromCart(rm.dataset.remove); return; }
    const shop = e.target.closest('#drawerShop');
    if (shop) { closeDrawer(); go('/catalog'); return; }
    const w = e.target.closest('[data-wish]');
    if (w) { toggleWishlist(w.dataset.wish); renderDrawer('wishlist'); return; }
    if (e.target.closest('[data-gift-wrap]')) {
      addGiftWrap();
      toast('Gift wrapping added.', 'Hand-tied ribbon, note-ready (demo).');
      return;
    }
    const sug = e.target.closest('[data-drawer-add]');
    if (sug) {
      const p = byId(sug.dataset.drawerAdd);
      if (p) {
        addToCart({ productId: p.id, unitPrice: p.price, name: p.name, image: p.image });
        toast('Added to your bag.', p.name);
      }
    }
  });
  $('#drawerFoot').addEventListener('click', (e) => {
    if (e.target.closest('#drawerCheckout')) { closeDrawer(); go('/checkout'); }
    if (e.target.closest('#drawerContinue')) closeDrawer();
  });
  $('#openSearch').addEventListener('click', openSearch);
  $('#closeSearch').addEventListener('click', closeSearch);
  $('#headerSearchInput').addEventListener('focus', openSearch);
  $('#bigSearchInput').addEventListener('input', (e) => updateSearchResults(e.target.value));
  $('#bigSearchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = $('#bigSearchInput').value.trim();
    rememberSearch(q);
    closeSearch();
    go('/catalog?q=' + encodeURIComponent(q));
  });
  // The search desk: trending chips, recent chips, category tiles, result clicks.
  $('#searchPanel').addEventListener('click', (e) => {
    const trend = e.target.closest('[data-trend]');
    if (trend) {
      const input = $('#bigSearchInput');
      input.value = trend.dataset.trend;
      updateSearchResults(trend.dataset.trend);
      input.focus();
      return;
    }
    if (e.target.closest('[data-close-search]')) { rememberSearch($('#bigSearchInput').value); closeSearch(); return; }
    if (e.target.closest('#searchResults a[href^="#/product"]')) { rememberSearch($('#bigSearchInput').value); closeSearch(); }
  });
  // The mega menu: hover on pointer devices (with intent delay), tap-toggle on
  // touch, Esc to close. The panel lives on <body> so no ancestor clips it.
  const navMega = $('#navMega');
  const megaPanel = $('#megaPanel');
  if (navMega && megaPanel) {
    if (megaPanel.parentElement !== document.body) document.body.appendChild(megaPanel);
    const megaTrigger = navMega.querySelector('.nav-mega-trigger');
    let megaTimer = null;
    const paintTop = () => {
      const h = document.querySelector('.header');
      document.documentElement.style.setProperty('--mega-top', (h ? Math.round(h.getBoundingClientRect().bottom) : 78) + 'px');
    };
    const setMega = (on) => {
      megaPanel.classList.toggle('open', on);
      navMega.classList.toggle('open', on);
      megaTrigger?.setAttribute('aria-expanded', String(on));
      if (on) paintTop();
    };
    const openSoon = () => { clearTimeout(megaTimer); setMega(true); };
    const closeSoon = () => { clearTimeout(megaTimer); megaTimer = setTimeout(() => setMega(false), 160); };
    navMega.addEventListener('mouseenter', openSoon);
    navMega.addEventListener('mouseleave', closeSoon);
    megaPanel.addEventListener('mouseenter', openSoon);
    megaPanel.addEventListener('mouseleave', closeSoon);
    navMega.addEventListener('focusin', openSoon);
    megaPanel.addEventListener('focusin', openSoon);
    megaPanel.addEventListener('focusout', (e) => { if (!megaPanel.contains(e.relatedTarget) && !navMega.contains(e.relatedTarget)) setMega(false); });
    megaTrigger?.addEventListener('click', (e) => {
      if (matchMedia('(hover: none)').matches) { e.preventDefault(); setMega(!megaPanel.classList.contains('open')); }
    });
    megaPanel.addEventListener('click', (e) => { if (e.target.closest('a')) setMega(false); });
    window.addEventListener('scroll', () => { if (megaPanel.classList.contains('open')) paintTop(); }, { passive: true });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMega(false); });
  }
  $('#closeModal').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', (e) => { if (e.target === $('#modalBackdrop')) closeModal(); });
  $('#modalContent').addEventListener('click', (e) => {
    if (e.target.closest('#successClose')) closeModal();
    if (e.target.closest('[data-compare-remove]')) {
      const id = e.target.closest('[data-compare-remove]').dataset.compareRemove;
      toggleCompare(id, false); showCompare();
    }
    const thumb = e.target.closest('[data-qv-thumb]');
    if (thumb) {
      const qvId = $('#modal').dataset.qv;
      const p = qvId ? byId(qvId) : null;
      if (p) {
        const imgEl = $('#qvImage');
        if (imgEl) imgEl.src = p.images[+thumb.dataset.qvThumb];
        $$('.qv-thumbs [data-qv-thumb]').forEach((b) => b.classList.toggle('active', b === thumb));
      }
    }
  });
  $('#modalContent').addEventListener('submit', (e) => {
    if (e.target.id === 'feedbackForm' || e.target.id === 'reviewForm') {
      e.preventDefault(); closeModal();
      toast(e.target.id === 'feedbackForm' ? 'Thanks for your feedback.' : 'Thanks for the note.', '(Demo only)');
    }
  });
  $('#searchResults').addEventListener('click', () => {}, { once: false });
  $('#compareDock').addEventListener('click', (e) => {
    if (e.target.closest('#openCompare')) showCompare();
    if (e.target.closest('#clearCompare')) { window.__compare = []; $$('[data-compare]').forEach((el) => { el.checked = false; }); renderCompareDock(); }
  });
  $('#menuToggle').addEventListener('click', () => $('#mainNav').classList.toggle('open'));
  $('#footerNewsletter')?.addEventListener('click', () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
    setTimeout(() => $('#newsletterEmail')?.focus(), 500);
  });
  $$('[data-toast]').forEach((b) => b.addEventListener('click', () => toast(b.dataset.toast)));
  $('#footerBackTop')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDrawer(); closeSearch(); closeModal(); closePdpLightbox(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  });
  bindProductActions(document);
  // Any product card's "Quick look" opens the modal — wired once, delegated.
  document.addEventListener('click', (e) => {
    const qv = e.target.closest('[data-quickview]');
    if (qv) { e.preventDefault(); e.stopPropagation(); openQuickView(qv.dataset.quickview); }
  });
  window.__closeModal = closeModal;
  window.__openQuickView = openQuickView;
  window.__wirePage = wirePage;
  window.__appToggleCompare = toggleCompare;
  initMotion();
  initSupport();
  initScrollExperience();
  initWelcome();
  render();
  motionRefresh();
  refreshHeroScene();
  window.addEventListener('hashchange', () => { render(); window.__wirePage(); motionRefresh(); refreshHeroScene(); });
  window.__wirePage();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
window.__updateCounts = updateCounts;
