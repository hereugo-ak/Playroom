// Account + authentication page markup.
//
// Everything here uses the storefront's own type scale, palette and spacing
// (Fraunces / Manrope / DM Mono, oat, cocoa, rosewood, brass). The account area
// should read as another room in the same shop, not an embedded SaaS dashboard.
import { safe } from '../dom.js';
import { state } from '../store.js';
import { byId } from '../data.js';
import { productCard } from '../components.js';
import { authState, isEmailVerified, accountDisplayName, sanitizeNext, takeAuthFlash, ensureProfile } from './auth-store.js';
import { AUTH_CONFIGURED, AUTH_CONFIG_MESSAGE } from './config.js';

const ART = 'assets/img/hero.jpg';

const fmtDate = (value, opts = { day: 'numeric', month: 'long', year: 'numeric' }) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', opts);
};

const initials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PR';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

function flashHTML() {
  const flash = takeAuthFlash();
  if (!flash) return '';
  return `<div class="pl-form-message pl-form-message--${flash.tone === 'error' ? 'error' : flash.tone === 'success' ? 'success' : 'info'}" role="status">${safe(flash.message)}</div>`;
}

function configNotice() {
  if (AUTH_CONFIGURED) return '';
  return `<div class="pl-config-note" role="alert">
    <span class="mono">SETUP NEEDED</span>
    <b>Customer accounts are not connected yet.</b>
    <p>${safe(AUTH_CONFIG_MESSAGE)}</p>
  </div>`;
}

function googleButton(label) {
  return `<button class="pl-google" type="button" data-auth-google>
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/>
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"/>
      <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.07a10 10 0 0 0 0 9.02l3.34-2.59Z"/>
      <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"/>
    </svg>
    <span>${safe(label)}</span>
  </button>`;
}

function passwordField({ id, name, label, autocomplete = 'current-password', hint = '' }) {
  return `<div class="field pl-field">
    <div class="pl-label-row"><label for="${id}">${safe(label)}</label>${hint || ''}</div>
    <div class="pl-password">
      <input id="${id}" name="${name}" type="password" autocomplete="${autocomplete}" required minlength="8" aria-describedby="${id}-error">
      <button class="pl-password-toggle" type="button" data-password-toggle="${id}" aria-label="Show password" aria-pressed="false">Show</button>
    </div>
    <span class="field-error" id="${id}-error" data-error-for="${id}" role="alert"></span>
  </div>`;
}

function textField({ id, name, label, type = 'text', autocomplete = 'off', placeholder = '', value = '', required = true, inputmode = '' }) {
  return `<div class="field pl-field">
    <label for="${id}">${safe(label)}</label>
    <input id="${id}" name="${name}" type="${type}" autocomplete="${autocomplete}" placeholder="${safe(placeholder)}" value="${safe(value)}"${required ? ' required' : ''}${inputmode ? ` inputmode="${inputmode}"` : ''} aria-describedby="${id}-error">
    <span class="field-error" id="${id}-error" data-error-for="${id}" role="alert"></span>
  </div>`;
}

// ---------------------------------------------------------------------------
// Shells
// ---------------------------------------------------------------------------
function authShell({ page, kicker, title, intro, children, alt }) {
  return `<div class="route-enter pl-auth" data-auth-page="${page}">
    <div class="pl-auth-wrap wrap">
      <aside class="pl-auth-aside" aria-label="Playroom">
        <figure class="pl-auth-figure">
          <img src="${ART}" alt="Wooden toys on a warm playroom shelf" loading="eager" decoding="async">
          <figcaption class="pl-auth-figure-cap">
            <span class="mono">LITTLE HANDS · BIG WORLDS</span>
            <p>Toys chosen for the way children actually play — slowly, curiously, and all over the floor.</p>
          </figcaption>
        </figure>
        <div class="pl-auth-aside-note">
          <span class="pl-auth-aside-mark">✳</span>
          <p>Your saved things, orders and addresses stay together in one place.</p>
        </div>
      </aside>

      <section class="pl-auth-panel">
        <div class="pl-auth-brand">
          <a class="wordmark" href="#/" aria-label="Playroom home"><i class="mark"></i>playroom</a>
          <a class="pl-auth-back" href="#/">Back to the shop <span aria-hidden="true">↗</span></a>
        </div>
        <header class="pl-auth-head">
          <div class="mono">${safe(kicker)}</div>
          <h1>${title}</h1>
          <p>${intro}</p>
        </header>
        ${flashHTML()}
        ${configNotice()}
        ${children}
        ${alt ? `<div class="pl-auth-alt">${alt}</div>` : ''}
        <p class="pl-auth-fineprint">By continuing you agree to the <a href="#/privacy">privacy note and terms</a> of this concept store.</p>
      </section>
    </div>
  </div>`;
}

function accountShell({ page, active, title, intro, body, kicker = 'YOUR PLAYROOM ACCOUNT' }) {
  const user = authState.user;
  const profile = authState.profile;
  const name = accountDisplayName();
  const verified = isEmailVerified(user);
  return `<div class="route-enter pl-account" data-auth-page="${page}">
    <div class="wrap page-head">
      <div class="breadcrumbs"><a href="#/">Home</a><span> / </span><span>Your account</span></div>
      <div class="mono muted">${safe(kicker)}</div>
      <h1 class="page-title">${title}</h1>
      <p class="page-intro">${intro}</p>
    </div>
    <section class="section wrap pl-account-section">
      ${flashHTML()}
      <div class="pl-account-bar">
        <div class="pl-account-id">
          <span class="pl-account-avatar" aria-hidden="true"><span>${safe(initials(name))}</span></span>
          <div>
            <b>${safe(name)}</b>
            <span>${safe(user?.email || '')}</span>
          </div>
        </div>
        <nav class="pl-account-nav" aria-label="Account sections">
          <a href="#/account"${active === 'overview' ? ' aria-current="page"' : ''}>Overview</a>
          <a href="#/account/orders"${active === 'orders' ? ' aria-current="page"' : ''}>My orders</a>
          <a href="#/account/addresses"${active === 'addresses' ? ' aria-current="page"' : ''}>Addresses</a>
          <a href="#/account/wishlist"${active === 'wishlist' ? ' aria-current="page"' : ''}>Wish list</a>
        </nav>
        <button class="pl-signout" type="button" data-auth-logout>Sign out</button>
      </div>
      <div class="pl-account-main">
        ${body}
      </div>
    </section>
  </div>`;
}

function pageGuardCard(message, href = '#/account/login', label = 'Sign in') {
  return `<div class="route-enter pl-auth pl-auth--narrow"><div class="pl-auth-simple">
    <a class="wordmark" href="#/"><i class="mark"></i>playroom</a>
    <div class="mono">ACCOUNT</div>
    <h1>${safe(message)}</h1>
    <a class="btn" href="${href}">${safe(label)} <span class="arrow">↗</span></a>
  </div></div>`;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
export function renderLogin(r) {
  const next = sanitizeNext(r?.params?.get('next')) || '/account';
  const registerHref = `#/account/register${next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`;
  return authShell({
    page: 'login',
    kicker: 'WELCOME BACK',
    title: 'Back to<br><em>the playroom.</em>',
    intro: 'Sign in to find your saved things, addresses and orders exactly where you left them.',
    children: `<form class="pl-form" id="authLoginForm" novalidate data-next="${safe(next)}">
      ${textField({ id: 'loginEmail', name: 'email', label: 'Email address', type: 'email', autocomplete: 'email', placeholder: 'you@example.com' })}
      ${passwordField({
        id: 'loginPassword',
        name: 'password',
        label: 'Password',
        hint: '<a class="pl-label-link" href="#/account/forgot-password">Forgot password?</a>',
      })}
      <div class="pl-form-message" data-form-message role="alert" hidden></div>
      <button class="btn full pl-submit" type="submit"><span>Sign in</span> <span class="arrow" aria-hidden="true">↗</span></button>
    </form>
    <div class="pl-or"><span>or</span></div>
    ${googleButton('Continue with Google')}
    <div class="pl-form-message pl-form-message--error" data-auth-inline-error role="alert" hidden></div>`,
    alt: `<p>New to Playroom? <a href="${registerHref}">Create an account <span aria-hidden="true">↗</span></a></p>`,
  });
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------
export function renderRegister(r) {
  const next = sanitizeNext(r?.params?.get('next')) || '/account';
  const loginHref = `#/account/login${next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`;
  return authShell({
    page: 'register',
    kicker: 'A LITTLE CORNER OF YOUR OWN',
    title: 'Create<br><em>an account.</em>',
    intro: 'Save the things you love, keep your addresses close and make your next visit a little simpler.',
    children: `<form class="pl-form" id="authRegisterForm" novalidate data-next="${safe(next)}">
      ${textField({ id: 'registerName', name: 'fullName', label: 'Full name', autocomplete: 'name', placeholder: 'Your name' })}
      ${textField({ id: 'registerEmail', name: 'email', label: 'Email address', type: 'email', autocomplete: 'email', placeholder: 'you@example.com' })}
      ${passwordField({ id: 'registerPassword', name: 'password', label: 'Password', autocomplete: 'new-password', hint: '<span class="pl-hint">At least 8 characters</span>' })}
      ${passwordField({ id: 'registerConfirm', name: 'confirmPassword', label: 'Confirm password', autocomplete: 'new-password' })}
      <label class="pl-check">
        <input type="checkbox" name="terms" required>
        <span>I have read the <a href="#/privacy" target="_blank" rel="noopener">privacy note and terms</a>.</span>
      </label>
      <div class="pl-form-message" data-form-message role="alert" hidden></div>
      <button class="btn full pl-submit" type="submit"><span>Create account</span> <span class="arrow" aria-hidden="true">↗</span></button>
    </form>
    <div class="pl-or"><span>or</span></div>
    ${googleButton('Sign up with Google')}`,
    alt: `<p>Already have an account? <a href="${loginHref}">Sign in <span aria-hidden="true">↗</span></a></p>`,
  });
}

// ---------------------------------------------------------------------------
// Forgot password
// ---------------------------------------------------------------------------
export function renderForgotPassword() {
  return authShell({
    page: 'forgot',
    kicker: 'A SMALL RESET',
    title: 'Forgotten<br><em>password?</em>',
    intro: 'Tell us the email on your account and we will send a link to choose a new one. The link is valid for one use.',
    children: `<form class="pl-form" id="authForgotForm" novalidate>
      ${textField({ id: 'forgotEmail', name: 'email', label: 'Email address', type: 'email', autocomplete: 'email', placeholder: 'you@example.com' })}
      <div class="pl-form-message" data-form-message role="alert" hidden></div>
      <button class="btn full pl-submit" type="submit"><span>Send reset link</span> <span class="arrow" aria-hidden="true">↗</span></button>
    </form>
    <div class="pl-success" data-forgot-success hidden>
      <span class="pl-success-icon" aria-hidden="true">✳</span>
      <h2>Check your inbox.</h2>
      <p>If an account exists for that email, a reset link is on its way. Check the spam folder too — and give it a minute.</p>
    </div>`,
    alt: `<p>Remembered it? <a href="#/account/login">Back to sign in <span aria-hidden="true">↗</span></a></p>`,
  });
}

// ---------------------------------------------------------------------------
// Reset password
// ---------------------------------------------------------------------------
export function renderResetPassword() {
  if (!authState.session) {
    return authShell({
      page: 'reset',
      kicker: 'PASSWORD RESET',
      title: 'This link has<br><em>gone quiet.</em>',
      intro: 'Password reset links expire after a short while, or after they have been used once.',
      children: `<div class="pl-success pl-success--plain">
        <h2>Request a fresh link.</h2>
        <p>We will send a new link to your email. It only works once, so use it straight away.</p>
        <a class="btn full" href="#/account/forgot-password">Request a new link <span class="arrow" aria-hidden="true">↗</span></a>
      </div>`,
      alt: `<p>Or <a href="#/account/login">return to sign in <span aria-hidden="true">↗</span></a>.</p>`,
    });
  }

  return authShell({
    page: 'reset',
    kicker: 'A NEW PASSWORD',
    title: 'Choose something<br><em>new.</em>',
    intro: 'Use at least 8 characters. Once it is saved, you will be asked to sign in again.',
    children: `<form class="pl-form" id="authResetForm" novalidate>
      ${passwordField({ id: 'resetPassword', name: 'password', label: 'New password', autocomplete: 'new-password', hint: '<span class="pl-hint">At least 8 characters</span>' })}
      ${passwordField({ id: 'resetConfirm', name: 'confirmPassword', label: 'Confirm new password', autocomplete: 'new-password' })}
      <div class="pl-form-message" data-form-message role="alert" hidden></div>
      <button class="btn full pl-submit" type="submit"><span>Save new password</span> <span class="arrow" aria-hidden="true">↗</span></button>
    </form>`,
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function leavesCard() {
  const leaves = state.points.reduce((a, x) => a + (x.delta || 0), 0);
  const codes = Object.keys(state.redemptions || {});
  return `<div class="pl-card pl-leaves" id="leavesCard">
    <div class="pl-card-head"><div><span class="mono">PLAY LEAVES · DEMO</span><h2>Play leaves.</h2></div><span class="pl-leaf-balance"><b>${leaves}</b> leaves</span></div>
    <div class="leaves-progress"><i style="width:${Math.min(100, leaves / 400 * 100)}%"></i></div>
    <p>One leaf for every ₹50 spent on a demo order. Four hundred leaves become a <b>₹200 code</b> you can use at checkout.</p>
    <button class="btn small" id="redeemLeaves" type="button" ${leaves < 400 ? 'disabled' : ''}>Redeem 400 leaves <span class="arrow" aria-hidden="true">↗</span></button>
    ${codes.length ? `<div class="leaf-codes">${codes.map((c) => `<span class="leaf-code" title="Use at checkout">${safe(c)} · ₹${state.redemptions[c].fixed} off</span>`).join('')}</div>` : ''}
    <p class="pl-note">Demo loyalty is kept in this browser — it is not tied to your account yet.</p>
  </div>`;
}

function referralCard() {
  const code = state.referralCode || '';
  return `<div class="pl-card pl-referral">
    <div class="pl-card-head"><div><span class="mono">REFER A FRIEND · DEMO</span><h2>Refer a friend.</h2></div></div>
    <div class="referral-code"><b>${safe(code || 'PLAY-••••')}</b><button class="text-link" id="copyReferral" type="button">Copy</button></div>
    <p>In a live programme you would both receive 200 leaves. Here the code is a demonstration, kept in this browser.</p>
    <div class="referral-foot"><button class="text-link" id="copyShareLink" type="button">Copy wish-list share link <span aria-hidden="true">↗</span></button></div>
  </div>`;
}

export function renderDashboard() {
  if (!authState.session) return pageGuardCard('Please sign in to see your account.');
  const user = authState.user;
  const profile = authState.profile || {};
  const verified = isEmailVerified(user);
  const name = accountDisplayName();
  const firstName = String(name).split(/\s+/)[0] || 'there';

  const body = `
    ${authState.profileError ? `<div class="pl-form-message pl-form-message--error" role="alert">${safe(authState.profileError)}</div>` : ''}
    <div class="pl-greeting">
      <div><span class="mono">OVERVIEW</span><h2>Hello, <em>${safe(firstName)}.</em></h2></div>
      <p>Your name and phone number are saved securely to your account.</p>
    </div>

    <form class="pl-card" id="profileForm" novalidate>
      <div class="pl-card-head"><div><span class="mono">YOUR DETAILS</span><h2>Your details.</h2></div><span class="pl-card-aside">Only you can see these</span></div>
      <div class="form-grid">
        ${textField({ id: 'profileName', name: 'fullName', label: 'Full name', autocomplete: 'name', value: profile.full_name || '', placeholder: 'Your name' })}
        ${textField({ id: 'profilePhone', name: 'phone', label: 'Phone number', type: 'tel', autocomplete: 'tel', value: profile.phone || '', placeholder: '+91 98765 43210', required: false, inputmode: 'tel' })}
        <div class="field pl-field full">
          <label for="profileEmail">Email address</label>
          <input id="profileEmail" type="email" autocomplete="email" value="${safe(user?.email || '')}" readonly>
          <small class="pl-field-hint">Your sign-in email is managed by Playroom care. Ask us from the <a href="#/contact">contact page</a> to change it.</small>
        </div>
      </div>
      <div class="pl-form-actions">
        <button class="btn" type="submit"><span>Save changes</span> <span class="arrow" aria-hidden="true">↗</span></button>
        <span class="pl-inline-status" data-profile-status role="status"></span>
      </div>
    </form>

    <div class="pl-card">
      <div class="pl-card-head"><div><span class="mono">ACCOUNT</span><h2>Account details.</h2></div></div>
      <dl class="pl-detail-list">
        <div><dt>Member since</dt><dd>${safe(fmtDate(user?.created_at))}</dd></div>
        <div><dt>Email status</dt><dd><span class="pl-verify-pill ${verified ? 'is-ok' : 'is-pending'}"><i aria-hidden="true"></i>${verified ? 'Verified' : 'Not verified'}</span>${verified ? '' : ' <button class="text-link" type="button" data-resend-verification>Resend link</button>'}</dd></div>
        <div><dt>Account type</dt><dd>Customer${authState.role === 'admin' ? ' administrator' : ''}</dd></div>
        <div><dt>Wish list</dt><dd>${state.wishlist.length} saved ${state.wishlist.length === 1 ? 'thing' : 'things'} · <a href="#/account/wishlist">open the shelf</a></dd></div>
      </dl>
    </div>

    <div class="pl-account-pair">
      ${leavesCard()}
      ${referralCard()}
    </div>

    <div class="pl-signout-row">
      <div><b>Finished for now?</b><p>Signing out clears this account from this browser. Your bag stays exactly as you left it.</p></div>
      <button class="btn outline" type="button" data-auth-logout>Sign out <span class="arrow" aria-hidden="true">↗</span></button>
    </div>`;

  return accountShell({
    page: 'dashboard',
    active: 'overview',
    title: 'Your <em>account.</em>',
    intro: 'Manage your details, saved places and demo orders.',
    body,
  });
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export function renderAccountOrders() {
  if (!authState.session) return pageGuardCard('Please sign in to see your orders.');
  const body = `
    <div class="pl-greeting">
      <div><span class="mono">MY ORDERS</span><h2>No orders yet.</h2></div>
      <p>Complete a demo checkout and the receipt, tracking and returns will appear here.</p>
    </div>
    <div class="pl-card pl-empty-card">
      <span class="pl-empty-icon" aria-hidden="true">◇</span>
      <h2>Nothing saved yet.</h2>
      <p>Demo orders are saved to your account after checkout. Nothing is charged or shipped.</p>
      <div class="pl-empty-actions">
        <a class="btn" href="#/catalog">Explore the collection <span class="arrow" aria-hidden="true">↗</span></a>
        <a class="btn outline" href="#/orders">See demo orders on this device</a>
      </div>
    </div>`;
  return accountShell({
    page: 'orders',
    active: 'orders',
    title: 'Orders <em>& receipts.</em>',
    intro: 'Receipts, tracking and returns for demo orders saved to your account.',
    body,
  });
}

// ---------------------------------------------------------------------------
// Wish list (inside the account shell)
// ---------------------------------------------------------------------------
export function renderAccountWishlist() {
  if (!authState.session) return pageGuardCard('Please sign in to see your saved things.');
  const items = state.wishlist.map(byId).filter(Boolean);
  const body = `
    <div class="pl-greeting">
      <div><span class="mono">WISH LIST</span><h2>Saved things.</h2></div>
      <p>The toys you set aside, kept with your account.</p>
    </div>
    ${items.length
      ? `<div class="product-grid account-wishlist-grid">${items.map(productCard).join('')}</div>`
      : `<div class="pl-card pl-empty-card">
          <span class="pl-empty-icon" aria-hidden="true">♡</span>
          <h2>Nothing saved yet.</h2>
          <p>Tap the heart on anything that catches your eye and it will live here.</p>
          <div class="pl-empty-actions"><a class="btn" href="#/catalog">Explore the collection <span class="arrow" aria-hidden="true">↗</span></a></div>
        </div>`}
  `;
  return accountShell({
    page: 'wishlist',
    active: 'wishlist',
    title: 'Saved <em>things.</em>',
    intro: 'Your wish list, kept inside your account.',
    body,
  });
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------
function addressCard(a) {
  const lines = [
    a.address_line_1,
    a.address_line_2,
    [a.city, a.state].filter(Boolean).join(', '),
    [a.postal_code, a.country].filter(Boolean).join(' · '),
  ].filter(Boolean);
  return `<article class="pl-address${a.is_default ? ' is-default' : ''}" data-address-card="${safe(a.id)}">
    <header>
      <div><b>${safe(a.full_name)}</b>${a.phone ? `<span>${safe(a.phone)}</span>` : ''}</div>
      ${a.is_default ? '<span class="pl-default-pill">Default</span>' : ''}
    </header>
    <p>${lines.map((line) => safe(line)).join('<br>')}</p>
    <div class="pl-address-actions">
      <button class="text-link" type="button" data-address-edit="${safe(a.id)}">Edit</button>
      ${a.is_default ? '' : `<button class="text-link" type="button" data-address-default="${safe(a.id)}">Make default</button>`}
      <button class="text-link pl-danger" type="button" data-address-delete="${safe(a.id)}">Delete</button>
    </div>
  </article>`;
}

export function renderAddresses(addresses = []) {
  if (!authState.session) return pageGuardCard('Please sign in to manage your addresses.');
  const body = `
    <div class="pl-greeting">
      <div><span class="mono">SAVED ADDRESSES</span><h2>Your places.</h2></div>
      <p>Set a default so checkout starts where you usually order.</p>
    </div>
    ${authState.profileError ? `<div class="pl-form-message pl-form-message--error" role="alert">${safe(authState.profileError)}</div>` : ''}
    <div class="pl-address-list" data-address-list>
      ${addresses.length ? addresses.map(addressCard).join('') : `<div class="pl-card pl-empty-card pl-empty-card--small">
        <span class="pl-empty-icon" aria-hidden="true">◇</span>
        <h2>No addresses saved yet.</h2>
        <p>Add the first one below — it will be ready the next time you check out.</p>
      </div>`}
    </div>

    <form class="pl-card" id="addressForm" novalidate data-editing="">
      <div class="pl-card-head">
        <div><span class="mono" data-address-kicker>NEW ADDRESS</span><h2 data-address-heading>Add a place.</h2></div>
        <button class="text-link" type="button" data-address-cancel hidden>Cancel edit</button>
      </div>
      <div class="form-grid">
        ${textField({ id: 'addressName', name: 'fullName', label: 'Full name', autocomplete: 'name', placeholder: 'Who receives the parcel?' })}
        ${textField({ id: 'addressPhone', name: 'phone', label: 'Phone number', type: 'tel', autocomplete: 'tel', placeholder: '+91 98765 43210', required: false, inputmode: 'tel' })}
        ${textField({ id: 'addressLine1', name: 'addressLine1', label: 'Address line 1', autocomplete: 'address-line1', placeholder: 'House, street, area' })}
        ${textField({ id: 'addressLine2', name: 'addressLine2', label: 'Address line 2', autocomplete: 'address-line2', placeholder: 'Apartment, landmark (optional)', required: false })}
        ${textField({ id: 'addressCity', name: 'city', label: 'City', autocomplete: 'address-level2', placeholder: 'City' })}
        ${textField({ id: 'addressState', name: 'state', label: 'State / region', autocomplete: 'address-level1', placeholder: 'State', required: false })}
        ${textField({ id: 'addressPostal', name: 'postalCode', label: 'PIN / postal code', autocomplete: 'postal-code', placeholder: '560001', inputmode: 'numeric' })}
        ${textField({ id: 'addressCountry', name: 'country', label: 'Country', autocomplete: 'country-name', value: 'India', placeholder: 'India' })}
      </div>
      <label class="pl-check">
        <input type="checkbox" name="isDefault">
        <span>Use this as my default address</span>
      </label>
      <div class="pl-form-message" data-form-message role="alert" hidden></div>
      <div class="pl-form-actions">
        <button class="btn" type="submit"><span data-address-submit>Save address</span> <span class="arrow" aria-hidden="true">↗</span></button>
        <span class="pl-inline-status" data-address-status role="status"></span>
      </div>
    </form>`;
  return accountShell({
    page: 'addresses',
    active: 'addresses',
    title: 'Saved <em>addresses.</em>',
    intro: 'The places you order to, private to your account.',
    body,
  });
}

export { pageGuardCard, accountShell };
