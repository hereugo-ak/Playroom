// Playroom Circle UI — landing, demo payment checkout, success and membership.
// All membership status comes from Supabase; payment uses the existing demo UI.
import { $, $$, safe, toast } from './dom.js';
import { formatMoney, state } from './store.js';
import { authState, getAccessToken } from './auth/auth-store.js';
import { membershipState, loadMembership, onMembershipChange } from './auth/membership.js';
import { go, render, route } from './router.js';
import {
  PAYMENT_METHODS, generatePayment, validatePayment, gatewayTxnId,
} from './gateway.js';

const PLANS = {
  monthly: { code: 'circle_monthly', name: 'Monthly Circle', price: 499, interval: 'monthly' },
  yearly: { code: 'circle_yearly', name: 'Yearly Circle', price: 4499, interval: 'yearly' },
};

export const CIRCLE_BENEFITS = [
  {
    code: 'delivery',
    title: 'Free next-day delivery',
    copy: 'Express delivery is on us on every demo order while your Circle is active.',
    short: 'Express delivery at ₹0',
  },
  {
    code: 'gift',
    title: 'Gift wrapping, on us',
    copy: 'Add wrapping, a note and hidden prices to any order without paying extra.',
    short: 'Wrapping included',
  },
  {
    code: 'first',
    title: 'First look at new toys',
    copy: 'Selected new pieces open to Circle members before the wider shelf.',
    short: 'Circle-only early access',
  },
  {
    code: 'care',
    title: 'Priority care desk',
    copy: 'Your care requests are marked Priority in your account.',
    short: 'Priority support requests',
  },
  {
    code: 'guide',
    title: 'Monthly play guide',
    copy: 'A short, considered guide to slower and better everyday play.',
    short: 'Downloadable play guide',
  },
  {
    code: 'build',
    title: 'Build with us',
    copy: 'Share a toy idea with our demo co-creation desk and keep it in your account.',
    short: 'Co-creation request desk',
  },
  {
    code: 'custom',
    title: 'Endless customisation',
    copy: 'Longer names and custom notes on eligible toys, with the fee included.',
    short: 'Longer personalisation, included',
  },
  {
    code: 'repair',
    title: 'Lifetime repair desk',
    copy: 'Open a care request for any saved order and track it in your account.',
    short: 'Lifetime care requests',
  },
];

const ICONS = {
  card: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/></svg>',
  upi: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.6 18.4h2.8"/><path d="M12 6.4v6m0 0 2.1-2.1M12 12.4l-2.1-2.1"/></svg>',
  netbanking: '<svg viewBox="0 0 24 24"><path d="M3.5 9.5 12 4l8.5 5.5"/><path d="M5.5 10.5v7M9.5 10.5v7M14 10.5v7M18.5 10.5v7M3.5 19.5h17"/></svg>',
  crypto: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.5 8.6h3.8a2 2 0 0 1 0 4H9.5m0 0h4.4a2 2 0 0 1 0 4H9.5M11 7v10.4"/></svg>',
};

let selectedMethod = 'card';

function benefitRows(compact = false) {
  return CIRCLE_BENEFITS.map((b, i) => `
    <article class="circle-benefit">
      <span class="circle-benefit-no">${String(i + 1).padStart(2, '0')}</span>
      <div>
        <h3>${safe(b.title)}</h3>
        <p>${safe(compact ? b.short : b.copy)}</p>
      </div>
    </article>`).join('');
}

function signInGate(next = '/circle') {
  const encoded = encodeURIComponent(next);
  return `<div class="route-enter circle-gate">
    <div class="wrap page-head circle-head">
      <div class="breadcrumbs"><a href="#/">Home</a><span> / </span><span>Playroom Circle</span></div>
      <div class="mono muted">MEMBERSHIP</div>
      <h1 class="page-title">One step before <em>Circle.</em></h1>
      <p class="page-intro">Sign in to join Playroom Circle and keep your membership with your account.</p>
    </div>
    <section class="section wrap circle-section">
      <div class="circle-panel">
        <span class="circle-kicker">CUSTOMER ACCOUNT REQUIRED</span>
        <h2>Sign in to <em>continue.</em></h2>
        <p>Your plan choice is saved in the link. After signing in, we’ll bring you straight back to the Circle checkout.</p>
        <div class="circle-actions">
          <a class="btn" href="#/account/login?next=${encoded}">Sign in to continue <span class="arrow" aria-hidden="true">↗</span></a>
          <a class="text-link" href="#/circle">Back to Circle <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </section>
  </div>`;
}

export function renderCircleLanding() {
  const active = membershipState.active;
  return `<div class="route-enter circle-page">
    <div class="wrap page-head circle-head">
      <div class="breadcrumbs"><a href="#/">Home</a><span> / </span><span>Playroom Circle</span></div>
      <div class="mono muted">PLAYROOM CIRCLE</div>
      <h1 class="page-title">A little more room for <em>play.</em></h1>
      <p class="page-intro">A membership for the small things that make everyday play feel considered — better delivery, thoughtful extras and a closer connection to the studio.</p>
    </div>

    <section class="wrap circle-hero">
      <div class="circle-hero-copy">
        <span class="circle-kicker">A QUIETER KIND OF MEMBERSHIP</span>
        <h2>Everyday play,<br><em>thoughtfully looked after.</em></h2>
        <p>Circle is built around the useful extras — faster delivery, a wrapped gift, longer custom notes and a desk that remembers what you asked for.</p>
        <div class="circle-hero-meta">
          <span><b>08</b> included benefits</span>
          <span><b>₹499</b> monthly</span>
          <span><b>₹4,499</b> yearly</span>
        </div>
      </div>
      <div class="circle-hero-art">
        <figure class="circle-hero-main">
          <img src="assets/img/photo-06.jpg" alt="Wooden toys arranged as a thoughtful gift" loading="eager" decoding="async">
          <figcaption>THE EVERYDAY EDIT</figcaption>
        </figure>
        <figure class="circle-hero-inset">
          <img src="assets/img/photo-31.jpg" alt="A quiet playroom shelf with toys and books" loading="lazy" decoding="async">
        </figure>
        <div class="circle-hero-stamp"><span>PLAYROOM</span><b>Circle</b><small>LITTLE HANDS · BIG WORLDS</small></div>
      </div>
    </section>

    <section class="section wrap circle-section">
      <div class="circle-intro">
        <div>
          <span class="circle-kicker">WHAT MEMBERS GET</span>
          <h2>Good things,<br><em>already included.</em></h2>
        </div>
        <p>We kept the benefits practical. Every one is applied to your account or your demo orders — nothing here is decoration.</p>
      </div>
      <div class="circle-benefits">${benefitRows()}</div>

      <div class="circle-editorial">
        <div class="circle-editorial-art"><img src="assets/img/photo-13.jpg" alt="Soft toys and a warm playroom setting" loading="lazy" decoding="async"></div>
        <div class="circle-editorial-copy">
          <span class="circle-kicker">THE SMALL EXTRAS</span>
          <h2>Less checkout.<br><em>More play.</em></h2>
          <p>The best membership perks are the ones you stop noticing because they simply happen. Circle takes care of delivery, wrapping and the little notes before you have to think about them.</p>
          <span class="circle-editorial-foot">MADE FOR LITTLE BIG IMAGINATIONS.</span>
        </div>
      </div>

      <div class="circle-pricing" id="circlePlans">
        <article class="circle-plan">
          <div class="circle-plan-art"><img src="assets/img/photo-21.jpg" alt="A small collection of wooden play pieces" loading="lazy" decoding="async"></div>
          <span class="circle-plan-label">MONTHLY</span>
          <h3>Monthly Circle</h3>
          <div class="circle-price">${formatMoney(499)}<small>/ month</small></div>
          <p>Flexible, simple, and ready to use immediately.</p>
          ${active
            ? '<a class="btn outline" href="#/account/membership">Manage membership <span class="arrow" aria-hidden="true">↗</span></a>'
            : '<button class="btn outline" type="button" data-circle-plan="monthly">Choose monthly <span class="arrow" aria-hidden="true">↗</span></button>'}
        </article>
        <article class="circle-plan is-featured">
          <div class="circle-plan-art"><img src="assets/img/photo-39.jpg" alt="A warmly lit edit of children's toys" loading="lazy" decoding="async"></div>
          <span class="circle-plan-label">BEST VALUE · YEARLY</span>
          <h3>Yearly Circle</h3>
          <div class="circle-price">${formatMoney(4499)}<small>/ year</small></div>
          <p>Two months included. One thoughtful membership for the year.</p>
          ${active
            ? '<a class="btn" href="#/account/membership">Manage membership <span class="arrow" aria-hidden="true">↗</span></a>'
            : '<button class="btn" type="button" data-circle-plan="yearly">Choose yearly <span class="arrow" aria-hidden="true">↗</span></button>'}
        </article>
      </div>
      <p class="circle-fine">Demo membership: payment is handled by the existing Playroom demo gateway. No real money is collected and no physical service is scheduled.</p>
    </section>
  </div>`;
}

function paymentPanel(method) {
  if (method === 'card') {
    return `<div class="st-form-card">
      <div class="field st-field"><label for="circleCardNumber">Card number</label><input id="circleCardNumber" name="cardNumber" inputmode="numeric" autocomplete="off" placeholder="4242 4242 4242 4242" required></div>
      <div class="form-grid">
        <div class="field st-field"><label for="circleExpiry">Expiry</label><input id="circleExpiry" name="expiry" inputmode="numeric" autocomplete="off" placeholder="MM / YY" required></div>
        <div class="field st-field"><label for="circleCvc">CVC</label><input id="circleCvc" name="cvc" inputmode="numeric" autocomplete="off" placeholder="123" required></div>
      </div>
    </div>`;
  }
  if (method === 'upi') {
    return `<div class="st-form-card"><div class="field st-field"><label for="circleUpi">UPI ID</label><input id="circleUpi" name="upiId" autocomplete="off" placeholder="name@bank" required></div></div>`;
  }
  if (method === 'netbanking') {
    return `<div class="st-form-card"><div class="field st-field"><label for="circleBank">Bank</label><select id="circleBank" name="bank" required><option value="">Choose a bank</option><option>HDFC Bank</option><option>ICICI Bank</option><option>State Bank of India</option><option>Axis Bank</option><option>Kotak Mahindra</option></select></div></div>`;
  }
  return `<div class="st-form-card"><div class="field st-field"><label for="circleWallet">Wallet address</label><input id="circleWallet" name="wallet" autocomplete="off" placeholder="Demo wallet address" required></div></div>`;
}

export function renderCircleCheckout(r) {
  const next = `/circle/checkout?plan=${encodeURIComponent(r?.params?.get('plan') || 'yearly')}`;
  if (!authState.session || !authState.user) return signInGate(next);

  const planKey = PLANS[r?.params?.get('plan')] ? r.params.get('plan') : 'yearly';
  const plan = PLANS[planKey];
  selectedMethod = 'card';
  const methodTabs = PAYMENT_METHODS.map((m, i) => `
    <button type="button" class="circle-method${i === 0 ? ' active' : ''}" data-circle-method="${m.id}" aria-pressed="${i === 0}">
      <span class="circle-method-icon">${ICONS[m.id] || ''}</span>
      <span><b>${safe(m.label)}</b><small>${safe(m.sub)}</small></span>
    </button>`).join('');

  return `<div class="route-enter circle-page">
    <div class="wrap page-head circle-head">
      <div class="breadcrumbs"><a href="#/">Home</a><span> / </span><a href="#/circle">Playroom Circle</a><span> / </span><span>Checkout</span></div>
      <div class="mono muted">DEMO MEMBERSHIP CHECKOUT</div>
      <h1 class="page-title">Join the <em>Circle.</em></h1>
      <p class="page-intro">Review your plan and approve the demo payment. No real money is collected.</p>
    </div>
    <section class="section wrap circle-section">
      <div class="circle-checkout">
        <aside class="circle-order">
          <span class="circle-kicker">YOUR PLAN</span>
          <h2>${safe(plan.name)}</h2>
          <div class="circle-price">${formatMoney(plan.price)}<small>/ ${plan.interval === 'yearly' ? 'year' : 'month'}</small></div>
          <ul class="circle-order-list">
            ${CIRCLE_BENEFITS.map((b) => `<li>${safe(b.short)}</li>`).join('')}
          </ul>
          <p>Demo payment only. Card details are never stored or sent to a server.</p>
        </aside>
        <div class="circle-payment">
          <form id="circlePayForm" novalidate data-plan="${planKey}">
            <div class="circle-methods">${methodTabs}</div>
            <div id="circlePaymentPanel" class="circle-payment-panel">${paymentPanel('card')}</div>
            <button class="text-link circle-autofill" id="circleAutofill" type="button">Autofill demo details <span aria-hidden="true">↗</span></button>
            <div class="circle-form-message" data-circle-error role="alert" hidden></div>
            <button class="st-paybtn circle-pay" id="circlePayButton" type="submit">Approve demo payment · ${formatMoney(plan.price)}</button>
            <p class="circle-fine">This uses the same Playroom demo gateway as checkout. Nothing is charged.</p>
          </form>
        </div>
      </div>
    </section>
  </div>`;
}

export function renderCircleSuccess() {
  const active = membershipState.active;
  const subscription = membershipState.subscription;
  return `<div class="route-enter circle-page">
    <div class="wrap page-head circle-head">
      <div class="breadcrumbs"><a href="#/">Home</a><span> / </span><a href="#/circle">Playroom Circle</a><span> / </span><span>Welcome</span></div>
      <div class="mono muted">PLAYROOM CIRCLE</div>
      <h1 class="page-title">You're in. <em>Welcome.</em></h1>
      <p class="page-intro">Your demo membership is active and every Circle benefit is ready to use.</p>
    </div>
    <section class="section wrap circle-section">
      <div class="circle-panel circle-panel--success">
        <span class="circle-success-mark" aria-hidden="true">✓</span>
        <span class="circle-kicker">MEMBERSHIP ACTIVE · DEMO</span>
        <h2>Every little extra,<br><em>ready for you.</em></h2>
        <p>${active ? `Valid until ${safe(new Date(subscription.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }))}.` : 'Opening your membership details now…'}</p>
        <div class="circle-actions">
          <a class="btn" href="#/account/membership">Open my membership <span class="arrow" aria-hidden="true">↗</span></a>
          <a class="text-link" href="#/catalog">Shop with benefits <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </section>
  </div>`;
}

function requestCard(kind) {
  const isBuild = kind === 'build';
  const orders = state.orders || [];
  return `<form class="circle-request" data-circle-request="${kind}" novalidate>
    <div class="circle-request-head">
      <div><span class="mono">${isBuild ? 'BUILD WITH US' : 'LIFETIME REPAIR DESK'}</span><h3>${isBuild ? 'Share a toy idea.' : 'Open a care request.'}</h3></div>
    </div>
    <div class="form-grid">
      <div class="field pl-field"><label for="circle-${kind}-title">${isBuild ? 'Idea name' : 'Order'}</label>
        ${isBuild
          ? `<input id="circle-${kind}-title" name="title" placeholder="A wooden puzzle that grows with them" required>`
          : `<select id="circle-${kind}-title" name="orderId" required><option value="">Choose an order</option>${orders.map((o) => `<option value="${safe(o.id)}">${safe(o.id)} · ${safe(o.createdAtLabel || '')}</option>`).join('')}</select>`}
      </div>
      <div class="field pl-field full"><label for="circle-${kind}-details">Details</label><textarea id="circle-${kind}-details" name="details" rows="4" placeholder="${isBuild ? 'Age group, play type, materials, anything you have in mind…' : 'What happened, and what would you like us to look at?'}" required></textarea></div>
    </div>
    <div class="pl-form-message" data-circle-request-message role="alert" hidden></div>
    <button class="btn small" type="submit">${isBuild ? 'Save idea' : 'Save request'} <span class="arrow" aria-hidden="true">↗</span></button>
  </form>`;
}

function requestListHTML() {
  const requests = membershipState.requests || [];
  if (!requests.length) return '<p class="circle-muted">No requests yet. Your saved ideas and care requests will appear here.</p>';
  return `<div class="circle-requests">${requests.map((req) => `
    <article class="circle-request-item">
      <header><b>${safe(req.title)}</b><span>${safe(req.kind)} · ${safe(req.status)}</span></header>
      <p>${safe(req.details)}</p>
      ${req.priority ? '<span class="circle-priority">PRIORITY</span>' : ''}
      ${req.order_id ? `<small>${safe(req.order_id)}</small>` : ''}
    </article>`).join('')}</div>`;
}

export function renderCircleMembership() {
  if (!authState.session || !authState.user) return signInGate('/account/membership');
  if (!membershipState.active) {
    return `<div class="route-enter circle-page">
      <div class="wrap page-head circle-head">
        <div class="breadcrumbs"><a href="#/">Home</a><span> / </span><span>Your account</span></div>
        <div class="mono muted">PLAYROOM ACCOUNT</div>
        <h1 class="page-title">Your <em>membership.</em></h1>
        <p class="page-intro">Circle benefits, saved in one quiet place.</p>
      </div>
      <section class="section wrap circle-section">
        <div class="circle-panel">
          <span class="circle-kicker">NOT A MEMBER YET</span>
          <h2>Make everyday play <em>a little richer.</em></h2>
          <p>Join Playroom Circle to unlock free next-day delivery, gift wrapping, early access and the member service desk.</p>
          <div class="circle-actions"><a class="btn" href="#/circle">Explore Circle <span class="arrow" aria-hidden="true">↗</span></a></div>
        </div>
      </section>
    </div>`;
  }

  const sub = membershipState.subscription;
  const plan = membershipState.plan;
  const endDate = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  return `<div class="route-enter circle-page">
    <div class="wrap page-head circle-head">
      <div class="breadcrumbs"><a href="#/">Home</a><span> / </span><span>Your account</span></div>
      <div class="mono muted">PLAYROOM CIRCLE</div>
      <h1 class="page-title">Your <em>membership.</em></h1>
      <p class="page-intro">Active benefits, saved requests and member payment history.</p>
    </div>
    <section class="section wrap circle-section">
      <div class="circle-pass">
        <div><span class="circle-kicker">PLAYROOM CIRCLE · ACTIVE DEMO</span><h2>${safe(plan?.name || 'Playroom Circle')}</h2></div>
        <dl>
          <div><dt>Valid until</dt><dd>${safe(endDate)}</dd></div>
          <div><dt>Reference</dt><dd>${safe(sub?.provider_reference || '—')}</dd></div>
          <div><dt>Status</dt><dd>Active · demo</dd></div>
        </dl>
      </div>

      <div class="circle-member-grid">
        <div>
          <div class="circle-block-head"><span class="mono">YOUR BENEFITS</span><h2>Ready to use.</h2></div>
          <div class="circle-benefits circle-benefits--compact">${benefitRows(true)}</div>
        </div>
        <div>
          <div class="circle-block-head"><span class="mono">MEMBER TOOLS</span><h2>Make it yours.</h2></div>
          <button class="btn outline full" type="button" id="circleDownloadGuide">Download play guide <span class="arrow" aria-hidden="true">↗</span></button>
          <div class="circle-requests-wrap">${requestCard('build')}${requestCard('repair')}</div>
          <div class="circle-block-head"><span class="mono">SAVED REQUESTS</span><h2>Your desk.</h2></div>
          ${requestListHTML()}
        </div>
      </div>

      <div class="circle-history">
        <span class="mono">DEMO PAYMENTS</span>
        ${(membershipState.payments || []).length ? membershipState.payments.map((p) => `<div class="circle-history-row"><div><b>${safe(p.provider_reference)}</b><small>${safe(new Date(p.created_at).toLocaleDateString('en-IN'))} · ${safe(p.method)}</small></div><span>${formatMoney(p.amount)} · ${safe(p.status)}</span></div>`).join('') : '<p class="circle-muted">No demo payments recorded yet.</p>'}
      </div>
      <p class="circle-fine">Demo membership — no real payment was collected. Service requests are saved for demonstration and no physical work is scheduled.</p>
    </section>
  </div>`;
}

function setFormError(form, message) {
  const el = form?.querySelector('[data-circle-error], [data-circle-request-message]');
  if (!el) return;
  if (!message) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = message;
}

function setPayBusy(btn, busy) {
  if (!btn) return;
  if (busy) {
    btn.dataset.idle = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Approving demo payment…';
  } else {
    btn.disabled = false;
    if (btn.dataset.idle) btn.innerHTML = btn.dataset.idle;
  }
}

function circleKey(planCode) {
  const name = `pl-circle-key:${planCode}`;
  try {
    const saved = sessionStorage.getItem(name);
    if (saved) return saved;
  } catch { /* storage unavailable */ }
  const key = (globalThis.crypto?.randomUUID?.() || `circle-${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '');
  try { sessionStorage.setItem(name, key); } catch { /* ignore */ }
  return key;
}

async function wireCheckout() {
  const form = $('#circlePayForm');
  if (!form) return;

  $$('[data-circle-method]', form).forEach((button) => {
    button.addEventListener('click', () => {
      selectedMethod = button.dataset.circleMethod;
      $$('[data-circle-method]', form).forEach((b) => {
        const on = b === button;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      const panel = $('#circlePaymentPanel');
      if (panel) panel.innerHTML = paymentPanel(selectedMethod);
    });
  });

  $('#circleAutofill')?.addEventListener('click', () => {
    const data = generatePayment(selectedMethod);
    if (selectedMethod === 'card') {
      const n = $('#circleCardNumber'), e = $('#circleExpiry'), c = $('#circleCvc');
      if (n) n.value = data.cardNumber || '';
      if (e) e.value = data.expiry || '';
      if (c) c.value = data.cvc || '';
    } else if (selectedMethod === 'upi') {
      const u = $('#circleUpi'); if (u) u.value = data.upiId || '';
    } else if (selectedMethod === 'netbanking') {
      const b = $('#circleBank'); if (b) b.value = data.bank || '';
    } else {
      const w = $('#circleWallet'); if (w) w.value = data.wallet || '';
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.dataset.busy) return;
    setFormError(form, '');

    const fd = new FormData(form);
    const data = {
      cardNumber: fd.get('cardNumber') || '',
      expiry: fd.get('expiry') || '',
      cvc: fd.get('cvc') || '',
      upiId: fd.get('upiId') || '',
      bank: fd.get('bank') || '',
      wallet: fd.get('wallet') || '',
    };
    const errors = validatePayment(selectedMethod, data);
    const first = Object.values(errors)[0];
    if (first) { setFormError(form, first); return; }

    const btn = $('#circlePayButton');
    const planKey = form.dataset.plan || 'yearly';
    const plan = PLANS[planKey] || PLANS.yearly;
    setPayBusy(btn, true);
    form.dataset.busy = '1';

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please sign in again to continue.');
      const response = await fetch('/api/subscriptions/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          planCode: plan.code,
          paymentMethod: `${PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.label || 'Card'} · demo gateway`,
          idempotencyKey: circleKey(plan.code),
          demoTxn: gatewayTxnId(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'We could not activate your membership.');

      try { sessionStorage.removeItem(`pl-circle-key:${plan.code}`); } catch { /* ignore */ }
      await loadMembership(true);
      toast('Welcome to Playroom Circle.', 'Your demo benefits are active.');
      go('/circle/success');
    } catch (error) {
      setFormError(form, String(error?.message || error || 'Please try again.'));
      setPayBusy(btn, false);
      delete form.dataset.busy;
    }
  });
}

async function wireRequestForms() {
  const forms = $$('[data-circle-request]');
  if (!forms.length) return;

  forms.forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form.dataset.busy) return;
      setFormError(form, '');
      const fd = new FormData(form);
      const details = String(fd.get('details') || '').trim();
      if (details.length < 10) { setFormError(form, 'Add a little more detail so we can help.'); return; }

      const button = form.querySelector('button[type="submit"]');
      if (button) { button.disabled = true; button.textContent = 'Saving…'; }
      form.dataset.busy = '1';
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('Please sign in again.');
        const response = await fetch('/api/membership/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            kind: form.dataset.circleRequest,
            title: fd.get('title') || '',
            details,
            orderId: fd.get('orderId') || '',
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Could not save your request.');
        await loadMembership(true);
        toast('Request saved.', 'It is now in your Circle desk.');
        render();
        window.__wirePage?.();
      } catch (error) {
        setFormError(form, String(error?.message || error || 'Please try again.'));
        if (button) { button.disabled = false; button.innerHTML = 'Save request <span class="arrow" aria-hidden="true">↗</span>'; }
        delete form.dataset.busy;
      }
    });
  });
}

function wireGuide() {
  const button = $('#circleDownloadGuide');
  if (!button) return;
  button.addEventListener('click', async () => {
    if (button.dataset.busy) return;
    button.dataset.busy = '1';
    button.disabled = true;
    const text = button.innerHTML;
    button.textContent = 'Preparing guide…';
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please sign in again.');
      const month = new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date());
      const response = await fetch(`/api/membership/guide?month=${encodeURIComponent(month)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Could not open the guide.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'playroom-circle-play-guide.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Play guide downloaded.', 'A little something for the next play session.');
    } catch (error) {
      toast('Could not open the guide.', String(error?.message || error));
    } finally {
      button.dataset.busy = '';
      button.disabled = false;
      button.innerHTML = text;
    }
  });
}

function wireLanding() {
  $$('[data-circle-plan]').forEach((button) => {
    button.addEventListener('click', () => {
      const plan = button.dataset.circlePlan === 'monthly' ? 'monthly' : 'yearly';
      go(`/circle/checkout?plan=${plan}`);
    });
  });
}

export function wireCirclePage() {
  const path = route().path;
  if (path === '/circle') wireLanding();
  if (path === '/circle/checkout') wireCheckout();
  if (path === '/account/membership') { wireRequestForms(); wireGuide(); }
}

onMembershipChange(() => {
  if (!window.__appReady) return;
  const path = route().path;
  if (['/circle', '/circle/checkout', '/circle/success', '/account/membership'].includes(path)) {
    render();
    window.__wirePage?.();
  }
});
