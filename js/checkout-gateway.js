// Playroom Atelier — checkout gateway wiring (Stripe-Checkout-style).
// Owns: the payment-method accordion, per-method payment forms, autofill,
// validation, the pay-button state machine and the order hand-off.
import { $, $$, safe, toast } from './dom.js';
import { formatMoney, state, discountAmount, cartSubtotal, clearCart, createDemoOrder, persist } from './store.js';
import { byId } from './data.js';
import { effectiveDeliveryFee, chosenDelivery, setChosenDelivery } from './delivery.js';
import { fling } from './spring.js';
import {
  PAYMENT_METHODS, generatePayer, generatePayment, validatePayment,
  gatewayTxnId, CARRIER, fedexTrackingNumber, packageMeta,
  cardBrand, formatCardNumber, formatExpiry,
} from './gateway.js';

let method = 'card';
let payData = {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const CVC_ICON = '<svg width="30" height="20" viewBox="0 0 30 20" fill="currentColor" aria-hidden="true"><g opacity="0.74"><path fill-rule="evenodd" clip-rule="evenodd" d="M25.2061 0.00488281C27.3194 0.112115 29 1.85996 29 4V11.3291C28.5428 11.0304 28.0336 10.8304 27.5 10.7188V8H1.5V16C1.5 17.3807 2.61929 18.5 4 18.5H10.1104V20H4L3.79395 19.9951C1.7488 19.8913 0.108652 18.2512 0.00488281 16.2061L0 16V4C0 1.85996 1.68056 0.112115 3.79395 0.00488281L4 0H25L25.2061 0.00488281ZM4 1.5C2.61929 1.5 1.5 2.61929 1.5 4V5H27.5V4C27.5 2.61929 26.3807 1.5 25 1.5H4Z"></path><path d="M27.5 12.7988C28.3058 13.1128 28.7725 13.7946 28.7725 14.6406C28.7722 15.4002 28.2721 15.9399 27.6523 16.1699C28.1601 16.3319 28.6072 16.6732 28.8086 17.2207C28.3597 18.6222 27.1605 19.6862 25.6826 19.9404C24.8389 19.7707 24.1662 19.2842 23.834 18.5H25C25.0914 18.5 25.1816 18.4939 25.2705 18.4844C25.5434 18.7862 25.9284 18.9501 26.3623 18.9502C27.142 18.9501 27.6922 18.5297 27.6924 17.79C27.6923 17.4212 27.5473 17.1544 27.2998 16.9795C27.4281 16.6786 27.5 16.3478 27.5 16V15.0527C27.5397 14.9481 27.5625 14.8309 27.5625 14.7002C27.5625 14.5657 27.5399 14.4422 27.5 14.3311V12.7988Z"></path><path d="M15.2207 18.5V18.8301H16.8799V19.9004H12.1104V18.8301H13.9902V18.5H15.2207Z"></path><path d="M19.9307 18.5L19.5762 18.7803H22.8369V19.9004H17.8164V18.8604L18.2549 18.5H19.9307Z"></path></g><path d="M26.3822 20.01C24.9722 20.01 23.8522 19.25 23.6422 17.81L24.8722 17.58C24.9922 18.45 25.6022 18.95 26.3622 18.95C27.1422 18.95 27.6922 18.53 27.6922 17.79C27.6922 17.05 27.1122 16.72 26.2822 16.72H25.5722V15.67H26.3022C27.0622 15.67 27.5622 15.34 27.5622 14.7C27.5622 14.07 27.1022 13.68 26.3922 13.68C25.6422 13.68 25.1322 14.18 24.9822 14.92L23.8122 14.76C24.0022 13.55 24.9822 12.61 26.4322 12.61C27.8822 12.61 28.7722 13.47 28.7722 14.64C28.7722 15.4 28.2722 15.94 27.6522 16.17C28.3422 16.39 28.9222 16.94 28.9222 17.89C28.9222 19.04 27.9522 20.01 26.3822 20.01Z"></path><path d="M17.8161 18.86L19.6161 17.38C20.5961 16.58 21.4761 15.87 21.4761 14.97C21.4761 14.23 21.0161 13.7 20.2561 13.7C19.5061 13.7 19.0161 14.29 19.0161 15C19.0161 15.23 19.0561 15.46 19.1361 15.68H17.9461C17.8461 15.39 17.8161 15.2 17.8161 14.93C17.8161 13.58 18.9261 12.61 20.2861 12.61C21.7861 12.61 22.7461 13.54 22.7461 14.89C22.7461 16.16 21.7861 17.03 20.7761 17.83L19.5761 18.78H22.8361V19.9H17.8161V18.86Z"></path><path d="M14.25 12.67H15.22V18.83H16.88V19.9H12.11V18.83H13.99V14.92H12.15V13.99L12.88 13.93C13.78 13.86 14.18 13.58 14.25 12.67Z"></path></svg>';
const CHECK_ICON = '<svg viewBox="0 0 10 8" aria-hidden="true"><path d="M1 4.2 3.8 7 9 1"/></svg>';
const SPIN = '<span class="st-spinwrap" aria-hidden="true"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.5"/></svg></span> ';

const BRAND_BADGES = ['visa', 'mastercard', 'amex', 'rupay'];
const brandBadge = (b) => (b === 'rupay'
  ? '<span class="st-brand st-brand--text" data-brand="rupay">RuPay</span>'
  : `<img class="st-brand" data-brand="${b}" src="assets/img/cards/${b}.svg" alt="" loading="lazy">`);
export const brandRowHTML = (cls = '') => `<span class="st-brands${cls ? ' ' + cls : ''}">${BRAND_BADGES.map(brandBadge).join('')}</span>`;

// ------------------------------------------------------- panel render ----
export function renderGatewayPanel() {
  const panel = $('#gwPanel');
  if (!panel) return;
  payData = generatePayment(method);
  const sub = cartSubtotal();
  const amt = formatMoney(sub - discountAmount(sub, sessionStorage.getItem('pl-code') || '') + effectiveDeliveryFee(sub));
  const amtEl = $('#payAmountLabel');
  if (amtEl) amtEl.textContent = amt;

  if (method === 'card') panel.innerHTML = `
    <div class="st-field st-field--flush"><span class="st-label">Card information</span>
      <div class="st-group" id="gwCardGroup">
        <div class="st-gc st-gc--top"><input class="st-input st-input--card" name="cardNumber" inputmode="numeric" autocomplete="cc-number" placeholder="1234 1234 1234 1234" value="${safe(formatCardNumber(payData.cardNumber))}" aria-label="Card number">${brandRowHTML('st-brands--input')}</div>
        <div class="st-gc st-gc--bt st-gc--half"><input class="st-input" name="expiry" maxlength="7" placeholder="MM / YY" autocomplete="cc-exp" value="${safe(formatExpiry(payData.expiry))}" aria-label="Expiry date"><span class="st-tick" aria-hidden="true">${CHECK_ICON}</span></div>
        <div class="st-gc st-gc--bt st-gc--half st-gc--pairright"><input class="st-input" name="cvc" inputmode="numeric" maxlength="4" autocomplete="cc-csc" placeholder="CVC" value="${safe(payData.cvc)}" aria-label="Card security code"><span class="st-cvcicon">${CVC_ICON}</span><span class="st-tick" aria-hidden="true">${CHECK_ICON}</span></div>
      </div>
      <div class="st-error-list"><span class="st-error" data-error="cardNumber"></span><span class="st-error" data-error="expiry"></span><span class="st-error" data-error="cvc"></span></div></div>
    <label class="st-billrow"><input type="checkbox" checked><span class="st-check">${CHECK_ICON}</span><span>Billing info is same as shipping</span></label>`;
  else if (method === 'upi') panel.innerHTML = `
    <div class="st-field st-field--flush"><span class="st-label">UPI ID</span>
      <p class="st-method-note">Pay with any UPI app — GPay, PhonePe, Paytm or BHIM. Requests are simulated.</p>
      <input class="st-input" name="upiId" value="${safe(payData.upiId)}" aria-label="UPI ID" placeholder="name@bank">
      <div class="st-error-list"><span class="st-error" data-error="upiId"></span></div></div>`;
  else if (method === 'netbanking') panel.innerHTML = `
    <div class="st-field st-field--flush"><span class="st-label">Choose your bank</span>
      <div class="st-selectwrap"><select class="st-input st-select" name="bank" aria-label="Bank">${['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra', 'Punjab National Bank'].map((b) => `<option${b === payData.bank ? ' selected' : ''}>${b}</option>`).join('')}</select><svg class="st-chev" viewBox="0 0 16 16"><path d="M3.5 6 8 10.5 12.5 6"/></svg></div>
      <div class="st-error-list"><span class="st-error" data-error="bank"></span></div></div>`;
  else panel.innerHTML = `
    <div class="st-field st-field--flush"><span class="st-label">Wallet address</span>
      <p class="st-method-note">${safe(payData.coin)} network · test coins only, no real transfer.</p>
      <input class="st-input" name="wallet" value="${safe(payData.wallet)}" aria-label="Wallet address">
      <div class="st-error-list"><span class="st-error" data-error="wallet"></span></div></div>`;
  panel.dataset.method = method;
  panel.insertAdjacentHTML('beforeend', '<p class="st-testnote">Demo checkout — payment details are simulated; nothing is charged.</p>');
  bindElementsFormatting(panel);
  syncGwAccordion();
}

// Stripe Elements-style live formatting: card grouping, live brand badge,
// per-cell "valid" ticks and the "MM / YY" expiry format.
function bindElementsFormatting(panel) {
  const cardInput = panel.querySelector('input[name="cardNumber"]');
  const badges = panel.querySelectorAll('.st-brand');
  const paint = (value) => {
    const b = cardBrand(value);
    badges.forEach((el) => el.classList.toggle('is-on', el.dataset.brand === b));
  };
  const expInput = panel.querySelector('input[name="expiry"]');
  const cvcInput = panel.querySelector('input[name="cvc"]');
  const expOk = () => /^(0[1-9]|1[0-2]) \/ 2[7-9]$/.test((expInput?.value || '').trim());
  const cvcOk = () => /^[0-9]{3,4}$/.test((cvcInput?.value || '').trim());
  const mark = (input, ok) => { const cell = input?.closest('.st-gc'); if (cell) cell.classList.toggle('is-ok', ok); };
  if (cardInput) {
    paint(cardInput.value);
    cardInput.addEventListener('input', () => {
      cardInput.value = formatCardNumber(cardInput.value);
      paint(cardInput.value);
    });
  }
  if (expInput) {
    expInput.addEventListener('input', () => {
      expInput.value = formatExpiry(expInput.value);
      mark(expInput, expOk());
    });
    mark(expInput, expOk());
  }
  if (cvcInput) {
    cvcInput.addEventListener('input', () => {
      cvcInput.value = cvcInput.value.replace(/\D/g, '').slice(0, 4);
      mark(cvcInput, cvcOk());
    });
    mark(cvcInput, cvcOk());
  }
}

// ------- accordion: keep the open payment panel directly under its row ----
function syncGwAccordion() {
  const wrap = $('#gwTabs');
  const panel = $('#gwPanel');
  if (!wrap || !panel) return;
  const rows = [...wrap.querySelectorAll('.gw-tab')];
  const activeIdx = Math.max(0, rows.findIndex((t) => t.classList.contains('active')));
  rows.forEach((t, i) => { t.style.order = String(i * 2); t.classList.remove('is-last', 'has-panel'); });
  panel.style.order = String(activeIdx * 2 + 1);
  rows[activeIdx]?.classList.add('has-panel');
  const items = [...rows, panel].sort((a, b) => Number(a.style.order) - Number(b.style.order));
  items[items.length - 1].classList.add('is-last');
}

// ------------------------------------------------------- wiring ---------
export function wireGateway() {
  const tabs = $('#gwTabs');
  if (!tabs) return;
  // The fresh markup always opens with the first method active — keep module
  // state in step so a re-render never shows one row active and another's panel.
  method = tabs.querySelector('.gw-tab.active')?.dataset.gw || 'card';
  tabs.addEventListener('click', (e) => {
    const t = e.target.closest('.gw-tab');
    if (!t || t.classList.contains('active')) return;
    tabs.querySelectorAll('.gw-tab').forEach((x) => { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', String(x === t)); });
    method = t.dataset.gw || 'card';
    const panel = $('#gwPanel');
    if (panel && !reduced) { panel.style.transition = ''; panel.style.transform = 'translateY(10px)'; panel.style.opacity = '.35'; }
    renderGatewayPanel();
    const next = $('#gwPanel');
    if (next && !reduced) requestAnimationFrame(() => { next.style.transition = 'transform .5s cubic-bezier(.2,1.2,.3,1), opacity .35s ease'; next.style.transform = ''; next.style.opacity = '1'; });
  });
  $('#autofillBtn')?.addEventListener('click', () => {
    const f = $('#checkoutForm');
    if (!f) return;
    const p = generatePayer();
    const set = (n, v) => {
      const el = f.querySelector(`[name="${n}"]`);
      if (el) { el.value = v; el.classList.remove('field-pop'); void el.offsetWidth; el.classList.add('field-pop'); }
    };
    set('fullName', `${p.firstName} ${p.lastName}`);
    set('email', p.email);
    set('phone', p.phone);
    set('address', p.address);
    set('note', p.note);
    set('city', p.city);
    set('pincode', p.pincode);
    set('state', p.stateName || 'Maharashtra');
    const tax = $('#stTaxNote');
    if (tax) tax.textContent = 'Included in total (demo)';
    renderGatewayPanel();
    toast('Test payer ready.', 'Everything auto-filled');
  });
  rewirePay();
}

export function rewirePay() {
  const f = $('#checkoutForm');
  if (!f) return;
  f.onsubmit = (e) => {
    e.preventDefault();
    const errors = validateCheckout(f);
    $$('.st-error', f).forEach((s) => { s.textContent = ''; });
    f.querySelectorAll('.st-group').forEach((g) => g.classList.remove('st-invalid'));
    if (Object.keys(errors).length) {
      Object.entries(errors).forEach(([field, msg]) => {
        const span = f.querySelector(`[data-error="${field}"]`);
        if (span) span.textContent = msg;
      });
      const groups = { stAddrGroup: ['fullName', 'address', 'city', 'pincode', 'state'], gwCardGroup: ['cardNumber', 'expiry', 'cvc'] };
      Object.entries(groups).forEach(([gid, fields]) => {
        if (fields.some((n) => errors[n])) document.getElementById(gid)?.classList.add('st-invalid');
      });
      if (!reduced) fling(f, { vx: 240 });
      toast('A few details need a second look.', 'Check the highlighted fields.');
      return;
    }
    startPayAnimation(f);
  };
}

function validateCheckout(f) {
  const errors = {};
  const get = (n) => (f.querySelector(`[name="${n}"]`)?.value || '').trim();
  const email = get('email');
  if (!email) errors.email = 'An email address is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'That email doesn’t look complete.';
  const phone = get('phone').replace(/\D/g, '');
  if (!phone) errors.phone = 'A mobile number is required for delivery updates.';
  else if (phone.length < 10) errors.phone = 'That phone number looks short.';
  if (get('fullName').length < 2) errors.fullName = 'Add the name for this delivery.';
  if (get('address').length < 6) errors.address = 'Where should the parcel go?';
  if (get('city').length < 2) errors.city = 'City is required.';
  const pin = get('pincode');
  if (!pin) errors.pincode = 'A 6-digit PIN code is required.';
  else if (!/^[1-9][0-9]{5}$/.test(pin)) errors.pincode = 'Indian PIN codes are 6 digits starting 1–9.';
  if (get('country') === 'IN' && !get('state')) errors.state = 'Choose your state.';
  const pay = {};
  ['cardNumber', 'expiry', 'cvc', 'upiId', 'bank', 'wallet'].forEach((n) => {
    const el = f.querySelector(`[name="${n}"]`);
    if (el) pay[n] = el.value;
  });
  Object.assign(errors, validatePayment(method, pay));
  return errors;
}

// ------------------------------------------------------- pay flow -------
async function startPayAnimation(form) {
  if (form.dataset.submitting) return;
  form.dataset.submitting = '1';

  const btn = $('#payBtn');
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = SPIN + 'Processing…';
  }
  await wait(620);
  if (btn) btn.innerHTML = SPIN + 'Contacting gateway…';
  await wait(700);
  if (btn) btn.innerHTML = SPIN + 'Verifying (3-D Secure)…';
  await wait(640);
  if (btn) btn.innerHTML = SPIN + 'Approved — printing receipt…';
  await wait(430);

  const methodLabel = PAYMENT_METHODS.find((m) => m.id === method)?.label || 'Card';
  const order = await completeOrder({ form, methodLabel: `${methodLabel} · demo gateway` });

  if (!document.getElementById('checkoutPage')) return; // user navigated away mid-animation; the order is saved

  if (btn) {
    btn.classList.add('is-success');
    btn.removeAttribute('aria-busy');
    btn.innerHTML = '<svg class="st-btncheck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.6 4.6L19 7.4"/></svg>';
  }
  toast('Payment approved (demo).', order.trackingNumber);
  await wait(780);
  form.dataset.submitting = '';
  location.hash = '#/order-confirmation?order=' + encodeURIComponent(order.id);
}

// ------------------------------------------------- order hand-off --------
// Builds the customer + lines from the checkout form (or a demo identity),
// attaches the gift layer and chosen delivery option, then banks the demo
// order. Shared by the accordion pay flow and the express wallet sheet.
const readGift = () => {
  try { const raw = sessionStorage.getItem('pl-gift'); return raw ? JSON.parse(raw) : null; } catch { return null; }
};
export const clearGift = () => { try { sessionStorage.removeItem('pl-gift'); } catch {} };

export async function completeOrder({ form = null, methodLabel = 'Card · demo gateway', extra = {} } = {}) {
  const sub = cartSubtotal();
  const code = sessionStorage.getItem('pl-code') || '';
  const disc = discountAmount(sub, code);
  const fee = effectiveDeliveryFee(sub);
  const total = sub - disc + fee;

  const fd = form ? new FormData(form) : new FormData();
  const fb = generatePayer();
  const fullName = String(fd.get('fullName') || '').trim() || `${fb.firstName} ${fb.lastName}`;
  const nameParts = fullName.split(/\s+/);
  const customer = {
    firstName: nameParts[0] || fb.firstName,
    lastName: nameParts.slice(1).join(' ') || fb.lastName,
    email: String(fd.get('email') || fb.email).trim(),
    phone: String(fd.get('phone') || fb.phone).trim(),
    addressLine1: String(fd.get('address') || fb.address).trim(),
    city: String(fd.get('city') || fb.city).trim(),
    state: String(fd.get('state') || '').trim(),
    pincode: String(fd.get('pincode') || fb.pincode).trim(),
    deliveryNote: String(fd.get('note') || '').trim(),
  };
  const lines = state.cart.map((x) => {
    const p = byId(x.productId) || x;
    return {
      productId: x.productId, name: x.name || p.name, image: x.image || p.image,
      unitPrice: x.unitPrice, qty: x.qty, lineTotal: x.unitPrice * x.qty,
      personalisation: x.personalisation || null,
      persKind: p.persKind || null,
      special: x.special || null,
    };
  });
  const gift = readGift();
  const delivery = chosenDelivery();
  const order = createDemoOrder({ customer, lines, subtotal: sub, discount: disc, deliveryFee: fee, total, paymentMethod: methodLabel, gift, delivery });
  order.gatewayTxn = gatewayTxnId();
  order.trackingNumber = fedexTrackingNumber();
  order.carrier = CARRIER.name;
  order.carrierService = CARRIER.product;
  order.package = packageMeta(lines, order.total);
  if (code) order.promoCode = code;
  Object.assign(order, extra);
  persist();
  clearCart();
  sessionStorage.removeItem('pl-code');
  clearGift();
  setChosenDelivery(null);
  return order;
}

// Physics confetti: real impulse particles with gravity, no libs.
export function confettiBurst(host) {
  if (!host) return;
  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  host.appendChild(layer);
  const colors = ['#d7b56d', '#b56f7b', '#ead1d2', '#f0e5d7', '#4c3428'];
  const parts = Array.from({ length: 44 }, () => {
    const d = document.createElement('i');
    const size = 6 + Math.random() * 8;
    d.style.cssText = `width:${size}px;height:${size * (Math.random() > .5 ? 1 : .45)}px;background:${colors[Math.floor(Math.random() * colors.length)]};`;
    layer.appendChild(d);
    return { el: d, x: 0, y: 0, vx: (Math.random() - .5) * 520, vy: -(180 + Math.random() * 420), r: Math.random() * 360, vr: (Math.random() - .5) * 720 };
  });
  let last = performance.now();
  const step = (t) => {
    const dt = Math.min(.033, (t - last) / 1000); last = t;
    let alive = 0;
    parts.forEach((p) => {
      p.vy += 1050 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.y < 260) alive++;
      p.el.style.transform = `translate(${p.x}px,${p.y}px) rotate(${p.r}deg)`;
      p.el.style.opacity = p.y > 180 ? String(Math.max(0, 1 - (p.y - 180) / 90)) : '1';
    });
    if (alive) requestAnimationFrame(step);
    else layer.remove();
  };
  requestAnimationFrame(step);
}
