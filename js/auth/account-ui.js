// Account UI: header menu, route dispatch, form wiring and the protected-route
// guard. All handlers are delegated once on <body>/<document>, so they survive
// the hash router replacing #app on every navigation.
import { $, $$, safe, toast } from '../dom.js';
import { go, route } from '../router.js';
import { state } from '../store.js';
import {
  authState, onAuthChange, signIn, signUp, signInWithGoogle, signOut,
  requestPasswordReset, updatePassword, resendVerification, verifySignupOtp, updateProfile,
  listAddresses, createAddress, updateAddress, deleteAddress, makeDefaultAddress,
  accountDisplayName, isEmailVerified, sanitizeNext, rememberDestination,
  peekDestination, takeDestination, setAuthFlash,
} from './auth-store.js';
import { AUTH_CONFIGURED, AUTH_CONFIG_MESSAGE } from './config.js';
import { membershipState, onMembershipChange } from './membership.js';
import { friendlyAuthError } from './errors.js';
import { trackEvent } from '../analytics.js';
import {
  renderLogin, renderRegister, renderForgotPassword, renderResetPassword,
  renderDashboard, renderAccountOrders, renderAccountWishlist, renderAddresses, pageGuardCard,
} from './pages.js';

const PROTECTED = new Set(['/account', '/account/orders', '/account/addresses', '/account/wishlist', '/account/membership']);
const PUBLIC_AUTH = new Set(['/account/login', '/account/register', '/account/forgot-password']);

let addressCache = new Map();
let initialized = false;
// app.js registers the order-history renderer so this module never imports the
// whole storefront shell (that would be a circular import). Until then, the
// honest empty state below is used.
let accountOrdersRenderer = null;
export function registerAccountOrdersRenderer(fn) {
  accountOrdersRenderer = typeof fn === 'function' ? fn : null;
}

// ---------------------------------------------------------------------------
// Small form helpers
// ---------------------------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+()\-\s\d]{7,20}$/;

const valueOf = (form, name) => String(form.elements?.[name]?.value ?? '').trim();
const inputById = (id) => document.getElementById(id);

function setFieldError(input, message) {
  if (!input) return;
  const id = input.id;
  const slot = document.querySelector(`[data-error-for="${id}"]`);
  if (slot) slot.textContent = message || '';
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

function clearFieldErrors(form) {
  form.querySelectorAll('input, select, textarea').forEach((input) => setFieldError(input, ''));
}

function formMessage(form, message = '', tone = 'error') {
  const el = form.querySelector('[data-form-message]');
  if (!el) return;
  if (!message) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.className = `pl-form-message pl-form-message--${tone}`;
  el.textContent = message;
}

function validateEmail(input) {
  const value = String(input?.value || '').trim();
  if (!value) { setFieldError(input, 'Enter your email address.'); return false; }
  if (!EMAIL_RE.test(value)) { setFieldError(input, 'That email address does not look complete.'); return false; }
  setFieldError(input, '');
  return true;
}

function validatePassword(input, { confirm = null } = {}) {
  const value = String(input?.value || '');
  let ok = true;
  if (!value) { setFieldError(input, 'Enter a password.'); ok = false; }
  else if (value.length < 8) { setFieldError(input, 'Use at least 8 characters.'); ok = false; }
  else if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) { setFieldError(input, 'Include at least one letter and one number.'); ok = false; }
  else setFieldError(input, '');

  if (confirm) {
    if (!confirm.value) { setFieldError(confirm, 'Confirm your password.'); ok = false; }
    else if (confirm.value !== value) { setFieldError(confirm, 'The two passwords do not match.'); ok = false; }
    else setFieldError(confirm, '');
  }
  return ok;
}

function setBusy(form, busy, label) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  if (busy) {
    if (!button.dataset.idle) button.dataset.idle = button.innerHTML;
    form.dataset.busy = '1';
    form.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.innerHTML = `<span class="pl-spinner" aria-hidden="true"></span><span>${safe(label || 'One moment…')}</span>`;
  } else {
    delete form.dataset.busy;
    form.removeAttribute('aria-busy');
    button.disabled = false;
    if (button.dataset.idle) button.innerHTML = button.dataset.idle;
  }
}

const isBusy = (form) => form?.dataset?.busy === '1';

// ---------------------------------------------------------------------------
// Header account control
// ---------------------------------------------------------------------------
function accountMenuHTML() {
  if (authState.user) {
    const name = accountDisplayName();
    const parts = String(name).trim().split(/\s+/);
    const ini = ((parts[0]?.[0] || 'P') + (parts[1]?.[0] || '')).toUpperCase();
    return `<div class="account-menu-head">
        <span class="account-menu-avatar" aria-hidden="true">${safe(ini)}</span>
        <div><b>${safe(name)}</b><span>${safe(authState.user.email || '')}</span></div>
      </div>
      ${membershipState.active ? '<div class="account-menu-circle circle-member-badge"><i aria-hidden="true"></i>Circle member</div>' : ''}
      <nav class="account-menu-links" aria-label="Account">
        <a href="#/account" role="menuitem">My account</a>
        <a href="#/account/orders" role="menuitem">My orders</a>
        <a href="#/account/addresses" role="menuitem">Saved addresses</a>
        <a href="#/account/wishlist" role="menuitem">Wish list</a>
        <a href="#/account/membership" role="menuitem">Membership</a>
      </nav>
      <button class="account-menu-signout" type="button" role="menuitem" data-auth-logout>Sign out</button>`;
  }
  return `<div class="account-menu-head">
      <span class="account-menu-avatar account-menu-avatar--guest" aria-hidden="true"><i class="mark"></i></span>
      <div><b>Welcome back.</b><span>Sign in to keep your things together.</span></div>
    </div>
    <a class="btn full account-menu-cta" href="#/account/login" role="menuitem">Sign in</a>
    <a class="account-menu-create" href="#/account/register" role="menuitem">Create an account</a>
    <a class="account-menu-create" href="#/circle" role="menuitem">Explore Playrooom Circle</a>`;
}

export function refreshAccountHeader() {
  const button = $('#accountBtn');
  const menu = $('#accountMenu');
  if (!button || !menu) return;
  const name = authState.user ? accountDisplayName() : '';
  const firstName = name ? String(name).trim().split(/\s+/)[0] : '';
  const label = $('#accountName');
  if (label) label.textContent = firstName.length > 12 ? `${firstName.slice(0, 11)}…` : firstName;
  button.classList.toggle('is-signed-in', Boolean(authState.user));
  button.setAttribute('aria-label', authState.user ? `Account menu for ${name}` : 'Account — sign in or create an account');
  button.setAttribute('title', authState.user ? `Signed in as ${name}` : 'Sign in or create an account');
  const dot = $('#accountDot');
  if (dot) dot.hidden = !authState.user;
  menu.innerHTML = accountMenuHTML();
}

function closeAccountMenu({ restoreFocus = false } = {}) {
  const button = $('#accountBtn');
  const menu = $('#accountMenu');
  if (!button || !menu || menu.hidden) return;
  menu.hidden = true;
  button.setAttribute('aria-expanded', 'false');
  if (restoreFocus) button.focus();
}

function openAccountMenu() {
  const button = $('#accountBtn');
  const menu = $('#accountMenu');
  if (!button || !menu) return;
  refreshAccountHeader();
  menu.hidden = false;
  button.setAttribute('aria-expanded', 'true');
  const first = menu.querySelector('a, button');
  first?.focus({ preventScroll: true });
}

function wireHeader() {
  const button = $('#accountBtn');
  const menu = $('#accountMenu');
  if (!button || !menu) return;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (menu.hidden) openAccountMenu();
    else closeAccountMenu({ restoreFocus: true });
  });
  document.addEventListener('click', (event) => {
    if (menu.hidden) return;
    if (!menu.contains(event.target) && !button.contains(event.target)) closeAccountMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAccountMenu({ restoreFocus: true });
    // A tiny focus trap for keyboard users inside the popover.
    if (event.key === 'Tab' && !menu.hidden) {
      const items = $$('a[href], button:not([disabled])', menu);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  window.addEventListener('hashchange', () => closeAccountMenu());
}

// ---------------------------------------------------------------------------
// Route dispatch
// ---------------------------------------------------------------------------
function loadingScreen(label = 'Opening your account…') {
  return `<div class="route-enter pl-auth pl-auth--narrow"><div class="pl-auth-simple pl-auth-simple--loading">
    <a class="wordmark" href="#/"><i class="mark"></i>playrooom</a>
    <span class="pl-spinner pl-spinner--large" aria-hidden="true"></span>
    <p>${safe(label)}</p>
  </div></div>`;
}

export function renderAuthRoute(r) {
  const path = r.path;
  const queryString = r.params.toString();
  const fullPath = queryString ? `${path}?${queryString}` : path;

  if (PROTECTED.has(path) && !authState.session) {
    rememberDestination(fullPath);
    queueMicrotask(() => go(`/account/login${fullPath !== '/account' ? `?next=${encodeURIComponent(fullPath)}` : ''}`));
    return loadingScreen('Taking you to sign in…');
  }

  if (PUBLIC_AUTH.has(path) && authState.session && !authState.recovery) {
    const next = takeDestination(sanitizeNext(r.params.get('next')) || '/account');
    queueMicrotask(() => go(next));
    return loadingScreen('Already signed in — opening your account…');
  }

  switch (path) {
    case '/account/login': return renderLogin(r);
    case '/account/register': return renderRegister(r);
    case '/account/forgot-password': return renderForgotPassword();
    case '/account/reset-password': return renderResetPassword();
    case '/account/orders': return accountOrdersRenderer
      ? accountOrdersRenderer()
      : renderAccountOrders();
    case '/account/wishlist': return renderAccountWishlist();
    case '/account/addresses': return renderAddresses([...addressCache.values()]);
    case '/account': {
      if (!authState.session) return pageGuardCard('Please sign in to see your account.');
      return renderDashboard();
    }
    default:
      return pageGuardCard('This account page could not be found.', '#/account', 'Back to your account');
  }
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------
function addressPayloadFromForm(form) {
  const fd = new FormData(form);
  return {
    fullName: String(fd.get('fullName') || '').trim(),
    phone: String(fd.get('phone') || '').trim(),
    addressLine1: String(fd.get('addressLine1') || '').trim(),
    addressLine2: String(fd.get('addressLine2') || '').trim(),
    city: String(fd.get('city') || '').trim(),
    state: String(fd.get('state') || '').trim(),
    postalCode: String(fd.get('postalCode') || '').trim(),
    country: String(fd.get('country') || 'India').trim(),
    isDefault: Boolean(fd.get('isDefault')),
  };
}

function validateAddress(form) {
  let ok = true;
  const required = [
    ['addressName', 'Enter the recipient’s name.'],
    ['addressLine1', 'Enter the street address.'],
    ['addressCity', 'Enter the city.'],
    ['addressPostal', 'Enter the PIN or postal code.'],
    ['addressCountry', 'Enter the country.'],
  ];
  for (const [id, message] of required) {
    const input = inputById(id);
    if (!String(input?.value || '').trim()) { setFieldError(input, message); ok = false; }
    else setFieldError(input, '');
  }
  const phone = inputById('addressPhone');
  if (phone?.value.trim() && !PHONE_RE.test(phone.value.trim())) {
    setFieldError(phone, 'Use a phone number we can reach you on.');
    ok = false;
  } else setFieldError(phone, '');
  return ok;
}

function resetAddressForm() {
  const form = $('#addressForm');
  if (!form) return;
  form.reset();
  form.dataset.editing = '';
  inputById('addressCountry').value = 'India';
  const kicker = form.querySelector('[data-address-kicker]');
  const heading = form.querySelector('[data-address-heading]');
  const submit = form.querySelector('[data-address-submit]');
  const cancel = form.querySelector('[data-address-cancel]');
  if (kicker) kicker.textContent = 'NEW ADDRESS';
  if (heading) heading.textContent = 'Add a place.';
  if (submit) submit.textContent = 'Save address';
  if (cancel) cancel.hidden = true;
  clearFieldErrors(form);
  formMessage(form, '');
}

function fillAddressForm(address) {
  const form = $('#addressForm');
  if (!form || !address) return;
  const set = (id, value) => { const el = inputById(id); if (el) el.value = value ?? ''; };
  set('addressName', address.full_name);
  set('addressPhone', address.phone);
  set('addressLine1', address.address_line_1);
  set('addressLine2', address.address_line_2);
  set('addressCity', address.city);
  set('addressState', address.state);
  set('addressPostal', address.postal_code);
  set('addressCountry', address.country || 'India');
  const def = form.elements?.isDefault;
  if (def) def.checked = Boolean(address.is_default);
  form.dataset.editing = address.id;
  form.querySelector('[data-address-kicker]').textContent = 'EDIT ADDRESS';
  form.querySelector('[data-address-heading]').textContent = 'Adjust the details.';
  form.querySelector('[data-address-submit]').textContent = 'Save changes';
  form.querySelector('[data-address-cancel]').hidden = false;
  formMessage(form, '');
  clearFieldErrors(form);
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function addressCardFromRow(a) {
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

function paintAddressList(addresses) {
  const list = document.querySelector('[data-address-list]');
  if (!list) return;
  list.innerHTML = addresses.length
    ? addresses.map(addressCardFromRow).join('')
    : `<div class="pl-card pl-empty-card pl-empty-card--small">
        <span class="pl-empty-icon" aria-hidden="true">◇</span>
        <h2>No addresses saved yet.</h2>
        <p>Add the first one below — it will be ready the next time you check out.</p>
      </div>`;
}

async function loadAddresses() {
  if (!authState.session) return [];
  try {
    const rows = await listAddresses();
    addressCache = new Map(rows.map((row) => [row.id, row]));
    paintAddressList(rows);
    return rows;
  } catch (error) {
    const list = document.querySelector('[data-address-list]');
    if (list) {
      list.innerHTML = `<div class="pl-form-message pl-form-message--error" role="alert">${safe(
        AUTH_CONFIGURED
          ? 'Your addresses could not be loaded just now. Please refresh and try again.'
          : AUTH_CONFIG_MESSAGE,
      )}</div>`;
    }
    return [];
  }
}

function resetDeleteConfirm(button) {
  if (!button) return;
  button.dataset.confirming = '';
  button.textContent = 'Delete';
}

function wireDelegated() {
  // Show / hide password
  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-password-toggle]');
    if (!toggle) return;
    const input = document.getElementById(toggle.dataset.passwordToggle);
    if (!input) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    toggle.textContent = showing ? 'Show' : 'Hide';
    toggle.setAttribute('aria-pressed', String(!showing));
    toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    input.focus({ preventScroll: true });
  });

  // Google OAuth
  document.addEventListener('click', async (event) => {
    const google = event.target.closest('[data-auth-google]');
    if (!google) return;
    if (google.dataset.busy) return;
    if (!AUTH_CONFIGURED) {
      toast('Supabase is not configured.', 'See .env.example and docs/AUTH_SETUP.md.');
      return;
    }
    google.dataset.busy = '1';
    google.disabled = true;
    const original = google.innerHTML;
    google.innerHTML = `<span class="pl-spinner" aria-hidden="true"></span><span>Opening Google…</span>`;
    try {
      const next = takeDestination(sanitizeNext(route().params.get('next')) || '/account');
      await signInWithGoogle(next);
      // Redirecting; leave the button in its loading state.
    } catch (error) {
      google.disabled = false;
      google.dataset.busy = '';
      google.innerHTML = original;
      const inline = document.querySelector('[data-auth-inline-error]');
      if (inline) {
        inline.hidden = false;
        inline.textContent = friendlyAuthError(error, 'Google sign-in could not start. Please try again.');
      } else {
        toast('Google sign-in could not start.', 'Please try again in a moment.');
      }
    }
  });

  // Logout
  document.addEventListener('click', async (event) => {
    const logout = event.target.closest('[data-auth-logout]');
    if (!logout) return;
    if (logout.dataset.busy) return;
    logout.dataset.busy = '1';
    logout.disabled = true;
    try {
      await signOut();
      closeAccountMenu();
      addressCache = new Map();
      toast('Signed out.', 'Your bag is still waiting for you.');
      // On a public page the visitor simply stays put; the auth listener moves
      // protected account pages to sign-in.
      if (route().path.startsWith('/account')) go('/account/login');
    } catch (error) {
      toast('Could not sign out.', friendlyAuthError(error, 'Please try again.'));
    } finally {
      logout.dataset.busy = '';
      logout.disabled = false;
    }
  });

  // Resend verification link
  document.addEventListener('click', async (event) => {
    const resend = event.target.closest('[data-resend-verification]');
    if (!resend) return;
    if (resend.dataset.busy) return;
    resend.dataset.busy = '1';
    resend.textContent = 'Sending…';
    try {
      await resendVerification(authState.user?.email);
      toast('Verification email sent.', 'Check your inbox and spam folder.');
      resend.textContent = 'Sent ✓';
    } catch (error) {
      toast('Could not send the email.', friendlyAuthError(error, 'Please try again.'));
      resend.textContent = 'Resend link';
      resend.dataset.busy = '';
    }
  });

  // Address list actions
  document.addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-address-edit]');
    if (edit) {
      fillAddressForm(addressCache.get(edit.dataset.addressEdit));
      return;
    }
    const cancel = event.target.closest('[data-address-cancel]');
    if (cancel) {
      resetAddressForm();
      return;
    }
    const def = event.target.closest('[data-address-default]');
    if (def) {
      def.disabled = true;
      try {
        await makeDefaultAddress(def.dataset.addressDefault);
        await loadAddresses();
        toast('Default address updated.');
      } catch (error) {
        toast('Could not update the default.', friendlyAuthError(error, 'Please try again.'));
        def.disabled = false;
      }
      return;
    }
    const del = event.target.closest('[data-address-delete]');
    if (del) {
      if (del.dataset.confirming !== '1') {
        del.dataset.confirming = '1';
        del.textContent = 'Confirm delete';
        setTimeout(() => resetDeleteConfirm(del), 4500);
        return;
      }
      del.disabled = true;
      del.textContent = 'Deleting…';
      try {
        await deleteAddress(del.dataset.addressDelete);
        addressCache.delete(del.dataset.addressDelete);
        await loadAddresses();
        resetAddressForm();
        toast('Address removed.');
      } catch (error) {
        toast('Could not remove the address.', friendlyAuthError(error, 'Please try again.'));
        resetDeleteConfirm(del);
        del.disabled = false;
      }
    }
  });

  // Live-clear field errors as the visitor types.
  document.addEventListener('input', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.id) return;
    if (input.getAttribute('aria-invalid') === 'true') setFieldError(input, '');
  });

  // Forms
  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === 'authLoginForm') return handleLogin(form, event);
    if (form.id === 'authRegisterForm') return handleRegister(form, event);
    if (form.id === 'authForgotForm') return handleForgot(form, event);
    if (form.id === 'authResetForm') return handleReset(form, event);
    if (form.id === 'profileForm') return handleProfile(form, event);
    if (form.id === 'addressForm') return handleAddress(form, event);
  });
}

// ---------------------------------------------------------------------------
// Form handlers
// ---------------------------------------------------------------------------
async function handleLogin(form, event) {
  event.preventDefault();
  if (isBusy(form)) return;
  formMessage(form, '');
  clearFieldErrors(form);
  const email = inputById('loginEmail');
  const password = inputById('loginPassword');
  const emailOk = validateEmail(email);
  const passwordOk = password.value ? (setFieldError(password, ''), true) : (setFieldError(password, 'Enter your password.'), false);
  if (!emailOk || !passwordOk) return;

  const adminLogin = form.dataset.admin === '1';
  trackEvent('login_start', { admin: adminLogin });
  setBusy(form, true, adminLogin ? 'Opening control room…' : 'Signing in…');
  try {
    await signIn({ email: email.value.trim(), password: password.value });
    if (adminLogin && authState.role !== 'admin') {
      await signOut();
      throw new Error('This account does not have administrator access.');
    }
    const next = adminLogin ? '/admin' : takeDestination(sanitizeNext(form.dataset.next) || '/account');
    trackEvent('login_success', { admin: adminLogin });
    toast(adminLogin ? 'Control room opened.' : 'Welcome back.', 'You are signed in.');
    go(next);
  } catch (error) {
    trackEvent('login_failed', { admin: adminLogin });
    formMessage(form, friendlyAuthError(error, 'Sign-in failed. Please try again.'));
    if (/password/i.test(error?.message || '')) setFieldError(password, 'Check your password and try again.');
  } finally {
    setBusy(form, false);
  }
}

async function handleRegister(form, event) {
  event.preventDefault();
  if (isBusy(form)) return;
  formMessage(form, '');
  clearFieldErrors(form);

  const name = inputById('registerName');
  const email = inputById('registerEmail');
  const password = inputById('registerPassword');
  const confirm = inputById('registerConfirm');
  const terms = form.elements?.terms;
  let ok = true;
  if (!name.value.trim() || name.value.trim().length < 2) { setFieldError(name, 'Tell us the name for the account.'); ok = false; }
  else setFieldError(name, '');
  if (!validateEmail(email)) ok = false;
  if (!validatePassword(password, { confirm })) ok = false;
  if (!terms?.checked) { formMessage(form, 'Please acknowledge the privacy note and terms.'); ok = false; }
  if (!ok) return;

  trackEvent('signup_start');
  setBusy(form, true, 'Creating your account…');
  try {
    const result = await signUp({
      fullName: name.value.trim(),
      email: email.value.trim(),
      password: password.value,
      next: sanitizeNext(form.dataset.next) || '/account',
    });

    if (result.alreadyRegistered) {
      formMessage(form, 'If this email already has an account, please sign in or reset the password instead.');
      return;
    }

    if (result.session) {
      const next = takeDestination(sanitizeNext(form.dataset.next) || '/account');
      trackEvent('signup_complete', { verifiedImmediately: true });
      toast('Your account is ready.', 'Welcome to Playrooom.');
      go(next);
      return;
    }

    showOtpVerification(form, email.value.trim(), sanitizeNext(form.dataset.next) || '/account');
  } catch (error) {
    const message = friendlyAuthError(error, 'We could not create the account.');
    formMessage(form, message);
    if (/already exists/i.test(message)) setFieldError(email, 'This email is already registered.');
  } finally {
    setBusy(form, false);
  }
}

function showOtpVerification(form, email, next) {
  const panel = document.createElement('div');
  panel.className = 'pl-verify-panel';
  panel.innerHTML = `
    <div class="pl-verify-mark" aria-hidden="true">✳</div>
    <span class="mono">ONE LAST STEP</span>
    <h2>Enter your code.</h2>
    <p>We sent a verification code to <b>${safe(email)}</b>. Enter it below to finish creating your account.</p>
    <form class="pl-form pl-otp-form" id="authOtpForm" novalidate>
      <div class="field pl-field">
        <label for="otpCode">Verification code</label>
        <input id="otpCode" name="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" pattern="[0-9]*" placeholder="12345678" aria-describedby="otp-error" required>
        <span class="field-error" id="otp-error" data-error-for="otpCode" role="alert"></span>
      </div>
      <div class="pl-form-message" data-form-message role="alert" hidden></div>
      <button class="btn full pl-submit" type="submit"><span>Verify &amp; continue</span></button>
    </form>
    <button class="text-link" type="button" data-resend-signup>Resend the code</button>
    <p class="pl-verify-note">If your email contained a link instead, open it — that verifies the account too.</p>
    <a class="pl-success-alt" href="#/account/login">Back to sign in</a>`;
  form.replaceWith(panel);

  const otpForm = panel.querySelector('#authOtpForm');
  const input = panel.querySelector('#otpCode');
  input?.focus();

  otpForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (isBusy(otpForm)) return;
    formMessage(otpForm, '');
    setFieldError(input, '');
    const code = String(input?.value || '').trim();
    if (!/^\d{6,8}$/.test(code)) {
      setFieldError(input, 'Enter the 6–8 digit code from your email.');
      return;
    }

    setBusy(otpForm, true, 'Verifying…');
    try {
      const data = await verifySignupOtp(email, code);
      trackEvent('otp_verify', { success: true });
      if (data.session) {
        const target = takeDestination(next);
        trackEvent('signup_complete', { verifiedImmediately: false });
        toast('Your email is verified.', 'Welcome to Playrooom.');
        go(target);
        return;
      }
      setAuthFlash('Your email is verified. Sign in to continue.', 'success');
      go('/account/login');
    } catch (error) {
      const message = friendlyAuthError(error, 'That code could not be verified.');
      formMessage(otpForm, message);
      setFieldError(input, 'Check the code and try again.');
    } finally {
      setBusy(otpForm, false);
    }
  });

  panel.querySelector('[data-resend-signup]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      await resendVerification(email);
      button.textContent = 'Code sent — check your inbox';
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Resend the code';
      toast('Could not resend the code.', friendlyAuthError(error, 'Please try again.'));
    }
  });
}

async function handleForgot(form, event) {
  event.preventDefault();
  if (isBusy(form)) return;
  formMessage(form, '');
  clearFieldErrors(form);
  const email = inputById('forgotEmail');
  if (!validateEmail(email)) return;

  setBusy(form, true, 'Sending…');
  try {
    await requestPasswordReset(email.value.trim());
    form.hidden = true;
    const success = document.querySelector('[data-forgot-success]');
    if (success) success.hidden = false;
  } catch (error) {
    formMessage(form, friendlyAuthError(error, 'We could not send the link. Please try again.'));
  } finally {
    setBusy(form, false);
  }
}

async function handleReset(form, event) {
  event.preventDefault();
  if (isBusy(form)) return;
  formMessage(form, '');
  clearFieldErrors(form);
  const password = inputById('resetPassword');
  const confirm = inputById('resetConfirm');
  if (!validatePassword(password, { confirm })) return;

  setBusy(form, true, 'Saving…');
  try {
    await updatePassword(password.value);
    await signOut();
    setAuthFlash('Password updated. Sign in with your new password.', 'success');
    toast('Password updated.', 'Sign in with the new one.');
    go('/account/login');
  } catch (error) {
    formMessage(form, friendlyAuthError(error, 'We could not update the password. Please request a new link.'));
  } finally {
    setBusy(form, false);
  }
}

async function handleProfile(form, event) {
  event.preventDefault();
  if (isBusy(form)) return;
  clearFieldErrors(form);
  const status = form.querySelector('[data-profile-status]');
  const name = inputById('profileName');
  const phone = inputById('profilePhone');

  if (!name.value.trim() || name.value.trim().length < 2) {
    setFieldError(name, 'Enter the name for your account.');
    return;
  }
  if (phone.value.trim() && !PHONE_RE.test(phone.value.trim())) {
    setFieldError(phone, 'Use a phone number we can reach you on.');
    return;
  }

  setBusy(form, true, 'Saving…');
  try {
    await updateProfile({ fullName: name.value, phone: phone.value });
    refreshAccountHeader();
    if (status) status.textContent = 'Saved just now.';
    toast('Your details are saved.');
  } catch (error) {
    formMessage(form, friendlyAuthError(error, 'We could not save your details. Please try again.'));
  } finally {
    setBusy(form, false);
  }
}

async function handleAddress(form, event) {
  event.preventDefault();
  if (isBusy(form)) return;
  formMessage(form, '');
  if (!validateAddress(form)) return;
  const editing = form.dataset.editing || '';
  const payload = addressPayloadFromForm(form);

  setBusy(form, true, editing ? 'Saving changes…' : 'Saving address…');
  try {
    if (editing) await updateAddress(editing, payload);
    else await createAddress(payload);
    await loadAddresses();
    resetAddressForm();
    const status = form.querySelector('[data-address-status]');
    if (status) status.textContent = editing ? 'Address updated.' : 'Address saved.';
    toast(editing ? 'Address updated.' : 'Address saved.');
  } catch (error) {
    formMessage(form, friendlyAuthError(error, 'We could not save the address. Please try again.'));
  } finally {
    setBusy(form, false);
  }
}

// ---------------------------------------------------------------------------
// Page-level wiring after each render
// ---------------------------------------------------------------------------
export function wireAuthPage() {
  const page = document.querySelector('[data-auth-page]');
  if (page) closeAccountMenu();
  if (document.querySelector('[data-address-list]') && authState.session) loadAddresses();
  if (document.querySelector('#checkoutPage')) prefillCheckout();
}

async function prefillCheckout() {
  if (!authState.session) return;
  const form = document.querySelector('#checkoutForm');
  if (!form) return;
  const email = form.elements?.email;
  const phone = form.elements?.phone;
  const fullName = form.elements?.fullName;
  const profile = authState.profile;
  const name = accountDisplayName();
  if (email && !email.value) email.value = authState.user?.email || '';
  if (phone && !phone.value) phone.value = profile?.phone || '';
  if (fullName && !fullName.value && name && name !== 'Your account') fullName.value = name;

  try {
    const rows = await listAddresses();
    if (!rows.length) return;
    const address = rows.find((row) => row.is_default) || rows[0];
    const setIfEmpty = (input, value) => { if (input && !input.value && value) input.value = value; };
    setIfEmpty(form.elements?.address, address.address_line_1);
    setIfEmpty(form.elements?.note, address.address_line_2);
    setIfEmpty(form.elements?.city, address.city);
    setIfEmpty(form.elements?.pincode, address.postal_code);
    setIfEmpty(form.elements?.phone, address.phone);
    const stateSelect = form.elements?.state;
    if (stateSelect && !stateSelect.value && address.state) {
      const option = [...stateSelect.options].find((opt) => opt.value === address.state || opt.textContent === address.state);
      if (option) stateSelect.value = option.value;
    }
  } catch {
    // Checkout remains fully usable; prefill is a convenience only.
  }
}

// ---------------------------------------------------------------------------
// Initialise once
// ---------------------------------------------------------------------------
export function initAccountUI() {
  if (initialized) return;
  initialized = true;
  wireHeader();
  wireDelegated();
  onMembershipChange(() => refreshAccountHeader());
  onAuthChange((auth) => {
    refreshAccountHeader();
    if (!auth.user) addressCache = new Map();
    // If the user's session expires while on a protected page, move them out.
    const path = route().path;
    if (!auth.session && PROTECTED.has(path)) {
      rememberDestination(path);
      go(`/account/login?next=${encodeURIComponent(path)}`);
    }
  });
  refreshAccountHeader();
}

export { AUTH_CONFIGURED };
