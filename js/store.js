// Playroom Atelier — store: cart, wishlist, recently viewed, demo orders,
// gift wrapping, leaves (loyalty), referral, returns and redeemed promo codes.
// Persistence uses namespaced, versioned localStorage keys with defensive
// parsing, per the session handoff brief (section 8.2). Orders are snapshots
// and are never recalculated from the catalogue after creation.

const NS = 'playroom-demo';
const VERSION = 1;
const key = (name) => `${NS}-v${VERSION}-${name}`;

// One-time continuity for the Playloom → Playroom rename: copy any legacy
// keys across before the store reads them, then remove the originals so stale
// state can never be resurrected after a user clears their demo data.
try {
  const legacy = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith('playloom')) legacy.push(k);
  }
  for (const k of legacy) {
    const next = `playroom${k.slice('playloom'.length)}`;
    if (localStorage.getItem(next) === null) localStorage.setItem(next, localStorage.getItem(k));
    localStorage.removeItem(k);
  }
} catch {
  /* storage unavailable — nothing to migrate */
}

export function read(name, fallback) {
  try {
    const raw = localStorage.getItem(key(name));
    const parsed = raw === null ? undefined : JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function write(name, value) {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    /* storage full or unavailable — demo continues in memory */
  }
}

export { key as storageKey };

// ---------- Pricing (single source of truth) ----------
export const FREE_DELIVERY_THRESHOLD = 1499; // from the reference announcement bar
export const DELIVERY_FEE = 99;
export const PROMO_CODES = { PLAY10: 0.10 }; // 10% off demo subtotal
export const GIFT_WRAP_ID = 'gift-wrap';
export const GIFT_WRAP_PRICE = 149;
export const PERSONALISE_FEE = 249;
export const LEAVES_PER_RUPEE = 50; // 1 leaf per ₹50 spent
export const LEAVES_TO_REDEEM = 400;
export const LEAF_REWARD_VALUE = 200; // ₹ off

export const discountAmount = (subtotal, code) => {
  if (!code) return 0;
  const key = String(code).trim().toUpperCase();
  const rule = PROMO_CODES[key] || state.redemptions[key];
  if (!rule) return 0;
  if (typeof rule === 'number') return Math.round(subtotal * rule);
  if (rule && typeof rule.fixed === 'number') return Math.min(rule.fixed, subtotal);
  return 0;
};

export const discountLabel = (code) => {
  if (!code) return '';
  const key = String(code).trim().toUpperCase();
  const rule = PROMO_CODES[key];
  if (rule) return `${Math.round(rule * 100)}% off`;
  const red = state.redemptions[key];
  if (red && red.fixed) return `₹${red.fixed} leaf reward`;
  return '';
};

export const deliveryFee = (subtotal = 0) =>
  subtotal >= FREE_DELIVERY_THRESHOLD || subtotal === 0 ? 0 : DELIVERY_FEE;

export const formatMoney = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

// ---------- State ----------
export const state = {
  cart: read('cart', []),
  wishlist: read('wishlist', []),
  recent: read('recent', []),
  newsletter: read('newsletter', []),
  orders: read('orders', []),
  lastOrderId: read('last-order', null),
  points: read('points', []),
  referralCode: read('referral', ''),
  redemptions: read('redemptions', {}),
  returns: read('returns', []),
};

export const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(state));

export function persist() {
  write('cart', state.cart);
  write('wishlist', state.wishlist);
  write('recent', state.recent);
  write('newsletter', state.newsletter);
  write('orders', state.orders);
  write('last-order', state.lastOrderId);
  write('points', state.points);
  write('referral', state.referralCode);
  write('redemptions', state.redemptions);
  write('returns', state.returns);
  emit();
}

// ---------- Cart domain ----------
export const lineKey = (item) => {
  if (item.special === 'gift-wrap' || item.productId === GIFT_WRAP_ID) return GIFT_WRAP_ID;
  const pers = item.personalisation ? `~${String(item.personalisation).trim().toLowerCase()}` : '';
  return `${item.productId}${pers}`;
};
const findLine = (k) => state.cart.find((x) => (x.key || x.productId) === k);

export function cartSubtotal() {
  return state.cart.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.qty, 0);
}

export function cartCount() {
  return state.cart.reduce((a, x) => a + x.qty, 0);
}

export function addToCart(item, qty = 1) {
  const k = item.key || lineKey(item);
  const existing = findLine(k);
  const max = item.special === 'gift-wrap' ? 1 : 20;
  if (existing) existing.qty = Math.min(max, existing.qty + qty);
  else state.cart.push({ ...item, key: k, qty: Math.min(max, qty) });
  persist();
}

export function hasGiftWrap() {
  return !!findLine(GIFT_WRAP_ID);
}

export function addGiftWrap() {
  if (hasGiftWrap()) return;
  state.cart.push({
    key: GIFT_WRAP_ID, productId: GIFT_WRAP_ID, special: 'gift-wrap',
    name: 'Gift wrapping', unitPrice: GIFT_WRAP_PRICE, image: '', qty: 1,
  });
  persist();
}

export function removeGiftWrap() {
  state.cart = state.cart.filter((x) => (x.key || x.productId) !== GIFT_WRAP_ID);
  persist();
}

export function changeQty(lineOrKey, delta) {
  const line = findLine(lineOrKey);
  if (!line) return;
  const max = line.special === 'gift-wrap' ? 1 : 20;
  line.qty += delta;
  if (line.qty < 1) state.cart = state.cart.filter((x) => x !== line);
  else line.qty = Math.min(max, line.qty);
  persist();
}

export function removeFromCart(lineOrKey) {
  state.cart = state.cart.filter((x) => (x.key || x.productId) !== lineOrKey);
  persist();
}

export function clearCart() {
  state.cart = [];
  persist();
}

// ---------- Wishlist ----------
export function toggleWishlist(productId) {
  const has = state.wishlist.includes(productId);
  state.wishlist = has
    ? state.wishlist.filter((id) => id !== productId)
    : [...state.wishlist, productId];
  persist();
  return !has;
}

// ---------- Leaves (demo loyalty) ----------
export function pointsBalance() {
  return state.points.reduce((a, x) => a + (x.delta || 0), 0);
}

export function pointsEarnedFor(total) {
  return Math.floor(total / LEAVES_PER_RUPEE);
}

export function addLeaves(delta, label, orderId = '') {
  state.points.unshift({ delta, label, at: new Date().toISOString(), orderId });
  persist();
}

/* Redeem 400 leaves for a ₹200 code that checkout accepts like any promo. */
export function redeemLeaves() {
  if (pointsBalance() < LEAVES_TO_REDEEM) return null;
  let code;
  do {
    code = 'LEAF' + Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (state.redemptions[code]);
  state.redemptions[code] = { fixed: LEAF_REWARD_VALUE, at: new Date().toISOString() };
  addLeaves(-LEAVES_TO_REDEEM, `Redeemed for ${code}`);
  persist();
  return code;
}

// ---------- Referral ----------
export function ensureReferral() {
  if (!state.referralCode) {
    state.referralCode = 'PLAY-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    persist();
  }
  return state.referralCode;
}

// ---------- Demo orders (snapshot model, handoff §8.4) ----------
export const DEMO_NOT_CHARGED = 'demo_not_charged';
export function createDemoOrder({ customer, lines, subtotal, discount, deliveryFee: fee, total, paymentMethod, gift = null, delivery = null }) {
  // collision-resistant, readable order ID
  let id;
  do {
    id = 'PL-' + (100000 + Math.floor(Math.random() * 899999));
  } while (state.orders.some((o) => o.id === id));

  const now = new Date();
  const order = {
    id,
    createdAt: now.toISOString(),
    createdAtLabel: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    customer,                       // full CustomerDetails snapshot
    email: customer.email,
    items: lines,                   // line snapshots incl. name/image/unitPrice/qty/lineTotal/personalisation
    currency: 'INR',
    subtotal, discount, deliveryFee: fee, total,
    paymentMethod,
    paymentStatus: DEMO_NOT_CHARGED,
    status: 'order_placed',
    statusLabel: 'Order received',
    gift: gift && (gift.wrap || gift.message || gift.from) ? gift : null,
    delivery: delivery || null,     // { id, label, dateLabel, fee }
    isDemo: true,
  };
  const earned = pointsEarnedFor(total);
  order.pointsEarned = earned;
  if (earned > 0) state.points.unshift({ delta: earned, label: `Order ${id}`, at: now.toISOString(), orderId: id });
  state.orders.unshift(order);
  state.lastOrderId = id;
  persist();
  return order;
}

export const getOrder = (id) =>
  state.orders.find((o) => o.id.toLowerCase() === String(id).trim().toLowerCase()) || null;

// ---------- Returns (demo, local) ----------
export function createReturn(order, { items, reason, mode }) {
  let id;
  do {
    id = 'RT-' + (1000 + Math.floor(Math.random() * 8999));
  } while (state.returns.some((r) => r.id === id));
  const now = new Date();
  const later = (days) => {
    const d = new Date(now); d.setDate(d.getDate() + days);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const ret = {
    id,
    orderId: order.id,
    createdAt: now.toISOString(),
    createdAtLabel: now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }),
    items,
    reason: reason || 'Changed my mind',
    mode: mode || 'refund',
    steps: [
      { k: 'Return requested', done: true, when: 'Just now' },
      { k: 'Pickup scheduled', done: true, when: `${later(1)}, 10:00–13:00` },
      { k: 'Picked up & in transit', done: false, when: 'after pickup' },
      { k: mode === 'exchange' ? 'Replacement dispatched' : 'Refund issued', done: false, when: '2 days after receipt' },
    ],
    isDemo: true,
  };
  state.returns.unshift(ret);
  persist();
  return ret;
}

export const returnsForOrder = (orderId) => state.returns.filter((r) => r.orderId === orderId);
export const getReturn = (id) => state.returns.find((r) => r.id === id) || null;
