// Authentication + customer-account state.
//
// This module owns the Supabase session lifecycle, the cached profile, and the
// customer data calls used by the account pages. It never stores tokens or
// passwords in app state beyond the Supabase client's own session, and it never
// trusts the frontend for authorisation — every table is protected by RLS.
import { supabase, isSupabaseConfigured } from './supabase.js';
import { buildAuthRedirect } from './config.js';
import { friendlyAuthError, authUrlErrorMessage } from './errors.js';

const FLASH_KEY = 'playroom-auth-flash';
const NEXT_KEY = 'playroom-auth-next';

export const authState = {
  ready: false,
  configured: isSupabaseConfigured,
  session: null,
  user: null,
  profile: null,
  role: 'customer',
  profileError: '',
  error: '',
  recovery: false,
  /** Auth tokens/errors found in the URL when the app started. */
  pendingAuth: { hasToken: false, type: '', error: '', errorDescription: '' },
};

const listeners = new Set();
let bootPromise = null;
let profilePromise = null;
let unsubscribe = null;

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) {
    try { fn(authState); } catch (err) { console.error('[Playroom auth] listener failed', err); }
  }
}

// ---------------------------------------------------------------------------
// Flash messages (survive the redirect back from Supabase)
// ---------------------------------------------------------------------------
export function setAuthFlash(message, tone = 'info') {
  if (!message) return;
  try { sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, tone })); } catch { /* private mode */ }
}

export function takeAuthFlash() {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(FLASH_KEY);
    const parsed = JSON.parse(raw);
    return parsed && parsed.message ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Intended destination
// ---------------------------------------------------------------------------
export function sanitizeNext(value, fallback = null) {
  if (value == null) return fallback;
  let next = String(value).trim();
  if (!next) return fallback;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(next) || next.startsWith('//')) {
      const url = new URL(next, window.location.origin);
      if (url.origin !== window.location.origin) return fallback;
      next = url.pathname + url.search + url.hash;
    }
  } catch {
    return fallback;
  }
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  // Never bounce back into the auth forms (prevents redirect loops).
  if (next.startsWith('/account/login') || next.startsWith('/account/register') || next.startsWith('/account/forgot-password')) {
    return '/account';
  }
  return next;
}

export function rememberDestination(path) {
  const next = sanitizeNext(path);
  if (!next) return;
  try { sessionStorage.setItem(NEXT_KEY, next); } catch { /* ignore */ }
}

export function takeDestination(fallback = '/account') {
  try {
    const next = sanitizeNext(sessionStorage.getItem(NEXT_KEY), fallback);
    sessionStorage.removeItem(NEXT_KEY);
    return next;
  } catch {
    return fallback;
  }
}

export function peekDestination(fallback = '/account') {
  try { return sanitizeNext(sessionStorage.getItem(NEXT_KEY), fallback); } catch { return fallback; }
}

// ---------------------------------------------------------------------------
// Session initialisation
// ---------------------------------------------------------------------------
function readAuthUrl() {
  const query = new URLSearchParams(window.location.search);
  const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  // Two shapes: a route hash ("/account") or an auth payload
  // ("access_token=…&type=recovery"). Parse only the latter as params.
  const hash = rawHash.startsWith('/') ? new URLSearchParams() : new URLSearchParams(rawHash);
  return {
    query,
    hash,
    hasToken: hash.has('access_token') || hash.has('refresh_token') || query.has('code') || query.has('token_hash'),
    type: hash.get('type') || '',
    error: hash.get('error') || query.get('error') || '',
    errorDescription: hash.get('error_description') || query.get('error_description') || '',
    recovery: query.get('recovery') === '1' || hash.get('type') === 'recovery',
    verified: query.get('verified') === '1',
  };
}

/** Start the auth client once and restore any persisted session. */
export function initAuth() {
  if (!bootPromise) bootPromise = boot();
  return bootPromise;
}

async function boot() {
  const url = readAuthUrl();
  authState.pendingAuth = url;
  authState.recovery = url.recovery;

  if (!isSupabaseConfigured) {
    authState.ready = true;
    emit();
    return authState;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    setSession(data.session);
    // Load the cached profile in the background so the storefront never waits on
    // a network round-trip before painting. Account pages await it explicitly.
    if (data.session?.user) ensureProfile().catch(() => {});
  } catch (error) {
    authState.error = friendlyAuthError(error, 'We could not restore your session. Please sign in again.');
  }

  authState.ready = true;
  emit();

  if (!unsubscribe) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const previousId = authState.user?.id || null;
      if (event === 'PASSWORD_RECOVERY') authState.recovery = true;
      if (event === 'SIGNED_OUT') {
        authState.session = null;
        authState.user = null;
        authState.profile = null;
        authState.role = 'customer';
        profilePromise = null;
      } else {
        setSession(session);
      }
      authState.error = '';
      emit();
      // Supabase warns against awaiting other auth calls inside this callback.
      if (session?.user && session.user.id !== previousId) {
        setTimeout(() => { ensureProfile(true).catch(() => {}); }, 0);
      }
    });
    unsubscribe = () => data.subscription.unsubscribe();
  }

  return authState;
}

function setSession(session) {
  authState.session = session || null;
  authState.user = session?.user || null;
  if (!session?.user) {
    authState.profile = null;
    authState.role = 'customer';
  }
}

export function disposeAuth() {
  unsubscribe?.();
  unsubscribe = null;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
const metadataName = (user) => String(
  user?.user_metadata?.full_name
  || user?.user_metadata?.name
  || user?.user_metadata?.display_name
  || '',
).trim();

function fallbackProfile(user) {
  if (!user) return null;
  const name = metadataName(user);
  return {
    id: user.id,
    full_name: name || (user.email ? user.email.split('@')[0] : ''),
    phone: user.phone || '',
    avatar_url: user.user_metadata?.avatar_url || '',
    created_at: user.created_at || null,
    updated_at: user.updated_at || null,
  };
}

export function ensureProfile(force = false) {
  if (!isSupabaseConfigured || !authState.user) return Promise.resolve(authState.profile);
  if (profilePromise && !force) return profilePromise;
  profilePromise = loadProfile(authState.user).finally(() => { profilePromise = null; });
  return profilePromise;
}

async function loadProfile(user) {
  const fallback = fallbackProfile(user);
  authState.profile = authState.profile || fallback;
  authState.profileError = '';

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, avatar_url, created_at, updated_at')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      authState.profile = data;
    } else {
      // Older accounts (created before the trigger) may not have a row yet.
      const { data: created, error: insertError } = await supabase
        .from('profiles')
        .insert({ id: user.id, full_name: fallback?.full_name || '', phone: user.phone || '' })
        .select('id, full_name, phone, avatar_url, created_at, updated_at')
        .maybeSingle();
      if (insertError) throw insertError;
      authState.profile = created || fallback;
    }
  } catch (error) {
    authState.profile = fallback;
    authState.profileError = friendlyAuthError(
      error,
      'Your profile could not be loaded. Some account details may be unavailable.',
    );
    console.warn('[Playroom auth] profile unavailable', error?.message || error);
  }

  try {
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    authState.role = roleRow?.role || 'customer';
  } catch {
    authState.role = 'customer';
  }

  emit();
  return authState.profile;
}

export async function updateProfile({ fullName, phone }) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
  const user = authState.user;
  if (!user) throw new Error('You need to be signed in to update your profile.');

  const patch = {
    full_name: String(fullName || '').trim(),
    phone: String(phone || '').trim(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('id, full_name, phone, avatar_url, created_at, updated_at')
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const { data: created, error: insertError } = await supabase
      .from('profiles')
      .insert({ id: user.id, ...patch })
      .select('id, full_name, phone, avatar_url, created_at, updated_at')
      .maybeSingle();
    if (insertError) throw insertError;
    authState.profile = created;
  } else {
    authState.profile = data;
  }

  // Keep auth metadata in sync so the name survives a profile-free render.
  const { error: metaError } = await supabase.auth.updateUser({ data: { full_name: patch.full_name } });
  if (metaError) console.warn('[Playroom auth] metadata update failed', metaError.message);

  emit();
  return authState.profile;
}

// ---------------------------------------------------------------------------
// Auth actions
// ---------------------------------------------------------------------------
export async function signUp({ fullName, email, password, next = '/account' }) {
  requireClient();
  const { data, error } = await supabase.auth.signUp({
    email: String(email || '').trim(),
    password,
    options: {
      data: { full_name: String(fullName || '').trim() },
      emailRedirectTo: buildAuthRedirect(next, { verified: true }),
    },
  });
  if (error) throw error;
  // Supabase intentionally returns an empty identities array for an email that
  // already exists (to prevent account enumeration).
  const alreadyRegistered = Array.isArray(data.user?.identities) && data.user.identities.length === 0;
  if (data.session) setSession(data.session);
  return { user: data.user, session: data.session, alreadyRegistered };
}

export async function signIn({ email, password }) {
  requireClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || '').trim(),
    password,
  });
  if (error) throw error;
  setSession(data.session);
  if (data.session?.user) await ensureProfile(true);
  return data;
}

export async function signInWithGoogle(next = '/account') {
  requireClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: buildAuthRedirect(next),
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  // The browser is redirected to Google; this return value is only useful to tests.
  return data;
}

export async function signOut() {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error && !/session missing|not signed in|auth session missing/i.test(error.message || '')) throw error;
  setSession(null);
  authState.recovery = false;
  emit();
}

export async function requestPasswordReset(email) {
  requireClient();
  const { error } = await supabase.auth.resetPasswordForEmail(String(email || '').trim(), {
    redirectTo: buildAuthRedirect('/account/reset-password', { recovery: true }),
  });
  if (error) throw error;
}

export async function updatePassword(password) {
  requireClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  authState.recovery = false;
  return data;
}

export async function resendVerification(email) {
  requireClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: String(email || '').trim(),
    options: { emailRedirectTo: buildAuthRedirect('/account', { verified: true }) },
  });
  if (error) throw error;
}

export function isEmailVerified(user = authState.user) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at);
}

export function accountDisplayName() {
  const profile = authState.profile;
  const name = profile?.full_name || metadataName(authState.user);
  return String(name || authState.user?.email || 'Your account').trim();
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------
const ADDRESS_COLUMNS = 'id, user_id, full_name, phone, address_line_1, address_line_2, city, state, postal_code, country, is_default, created_at';

export async function listAddresses() {
  requireUser();
  const { data, error } = await supabase
    .from('addresses')
    .select(ADDRESS_COLUMNS)
    .eq('user_id', authState.user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

function addressPayload(input) {
  return {
    full_name: String(input.fullName || '').trim(),
    phone: String(input.phone || '').trim() || null,
    address_line_1: String(input.addressLine1 || '').trim(),
    address_line_2: String(input.addressLine2 || '').trim() || null,
    city: String(input.city || '').trim(),
    state: String(input.state || '').trim() || null,
    postal_code: String(input.postalCode || '').trim(),
    country: String(input.country || 'India').trim() || 'India',
    is_default: Boolean(input.isDefault),
  };
}

async function clearOtherDefaults(exceptId = null) {
  let query = supabase.from('addresses').update({ is_default: false }).eq('user_id', authState.user.id);
  if (exceptId) query = query.neq('id', exceptId);
  const { error } = await query;
  if (error) throw error;
}

export async function createAddress(input) {
  requireUser();
  const payload = addressPayload(input);
  if (payload.is_default) await clearOtherDefaults();
  const { data, error } = await supabase
    .from('addresses')
    .insert({ ...payload, user_id: authState.user.id })
    .select(ADDRESS_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateAddress(id, input) {
  requireUser();
  const payload = addressPayload(input);
  if (payload.is_default) await clearOtherDefaults(id);
  const { data, error } = await supabase
    .from('addresses')
    .update(payload)
    .eq('id', id)
    .eq('user_id', authState.user.id)
    .select(ADDRESS_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteAddress(id) {
  requireUser();
  const { error } = await supabase.from('addresses').delete().eq('id', id).eq('user_id', authState.user.id);
  if (error) throw error;
}

export async function makeDefaultAddress(id) {
  requireUser();
  await clearOtherDefaults();
  const { error } = await supabase
    .from('addresses')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', authState.user.id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Orders & returns (database side; the local mirror lives in store.js)
// ---------------------------------------------------------------------------
// Checkout is still a demo — no payment, courier or email is involved — but the
// order snapshot is stored against the signed-in customer so it survives a new
// browser, a cleared localStorage and a sign-in on another device. The JSONB
// `data` column keeps the receipt exactly as the checkout created it; the typed
// columns are only for history, lookups and ownership checks.

const ORDER_COLUMNS = 'id, user_id, order_id, data, status, tracking_number, total, created_at';
const RETURN_COLUMNS = 'id, user_id, return_id, order_id, data, created_at';

const dateLabel = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
};

function rowToOrder(row) {
  const snapshot = row.data && typeof row.data === 'object' && !Array.isArray(row.data)
    ? row.data
    : {};
  return {
    ...snapshot,
    id: row.order_id || snapshot.id,
    createdAt: row.created_at || snapshot.createdAt,
    createdAtLabel: snapshot.createdAtLabel || dateLabel(row.created_at),
    status: row.status || snapshot.status || 'order_placed',
    statusLabel: snapshot.statusLabel || 'Order received',
    trackingNumber: row.tracking_number || snapshot.trackingNumber || '',
    total: Number(row.total ?? snapshot.total ?? 0),
    items: Array.isArray(snapshot.items) ? snapshot.items : [],
    isDemo: snapshot.isDemo !== false,
    remoteId: row.id,
  };
}

function rowToReturn(row) {
  const snapshot = row.data && typeof row.data === 'object' && !Array.isArray(row.data)
    ? row.data
    : {};
  return {
    ...snapshot,
    id: row.return_id || snapshot.id,
    orderId: row.order_id || snapshot.orderId,
    createdAt: row.created_at || snapshot.createdAt,
    createdAtLabel: snapshot.createdAtLabel || dateLabel(row.created_at),
    steps: Array.isArray(snapshot.steps) ? snapshot.steps : [],
    remoteId: row.id,
  };
}

function orderPayload(order) {
  if (!order?.id || !/^PL-[0-9]{6}$/.test(String(order.id))) {
    throw new Error('This order cannot be saved to an account.');
  }
  const snapshot = { ...order };
  delete snapshot.remoteId; // database row id is not part of the receipt
  return {
    user_id: authState.user.id,
    order_id: String(order.id),
    data: snapshot,
    status: String(order.status || 'order_placed'),
    tracking_number: order.trackingNumber || null,
    total: Number(order.total) || 0,
    created_at: order.createdAt || new Date().toISOString(),
  };
}

function returnPayload(ret) {
  if (!ret?.id || !/^RT-[0-9]{4}$/.test(String(ret.id))) {
    throw new Error('This return cannot be saved to an account.');
  }
  const snapshot = { ...ret };
  delete snapshot.remoteId;
  return {
    user_id: authState.user.id,
    return_id: String(ret.id),
    order_id: String(ret.orderId),
    data: snapshot,
    created_at: ret.createdAt || new Date().toISOString(),
  };
}

export async function listRemoteOrders() {
  requireUser();
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('user_id', authState.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToOrder);
}

export async function saveRemoteOrder(order) {
  requireUser();
  const { data, error } = await supabase
    .from('orders')
    .upsert(orderPayload(order), { onConflict: 'user_id,order_id', ignoreDuplicates: true })
    .select(ORDER_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToOrder(data) : rowToOrder({ order_id: order.id, data: order, created_at: order.createdAt });
}

export async function updateRemoteOrder(order) {
  requireUser();
  const payload = orderPayload(order);
  delete payload.user_id;
  delete payload.order_id;
  delete payload.created_at;
  const { data, error } = await supabase
    .from('orders')
    .update(payload)
    .eq('user_id', authState.user.id)
    .eq('order_id', String(order.id))
    .select(ORDER_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToOrder(data) : null;
}

export async function listRemoteReturns() {
  requireUser();
  const { data, error } = await supabase
    .from('returns')
    .select(RETURN_COLUMNS)
    .eq('user_id', authState.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(rowToReturn);
}

export async function saveRemoteReturn(ret) {
  requireUser();
  const { data, error } = await supabase
    .from('returns')
    .upsert(returnPayload(ret), { onConflict: 'user_id,return_id', ignoreDuplicates: true })
    .select(RETURN_COLUMNS)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToReturn(data) : rowToReturn({ return_id: ret.id, order_id: ret.orderId, data: ret, created_at: ret.createdAt });
}

// ---------------------------------------------------------------------------
// Wishlist (database side; the local mirror lives in store.js)
// ---------------------------------------------------------------------------
export function isValidProductId(id) {
  return typeof id === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id);
}

export async function fetchWishlistIds() {
  requireUser();
  const { data, error } = await supabase
    .from('wishlist')
    .select('product_id')
    .eq('user_id', authState.user.id);
  if (error) throw error;
  return (data || []).map((row) => row.product_id).filter(isValidProductId);
}

export async function addWishlistItem(productId) {
  if (!authState.user || !isValidProductId(productId)) return;
  const { error } = await supabase
    .from('wishlist')
    .upsert(
      { user_id: authState.user.id, product_id: productId },
      { onConflict: 'user_id,product_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function removeWishlistItem(productId) {
  if (!authState.user || !isValidProductId(productId)) return;
  const { error } = await supabase
    .from('wishlist')
    .delete()
    .eq('user_id', authState.user.id)
    .eq('product_id', productId);
  if (error) throw error;
}

export async function replaceRemoteWishlist(productIds) {
  requireUser();
  const ids = [...new Set((productIds || []).filter(isValidProductId))];
  const { error: deleteError } = await supabase.from('wishlist').delete().eq('user_id', authState.user.id);
  if (deleteError) throw deleteError;
  if (!ids.length) return;
  const { error } = await supabase.from('wishlist').insert(ids.map((product_id) => ({ user_id: authState.user.id, product_id })));
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// After an OAuth / email redirect
// ---------------------------------------------------------------------------
/**
 * Removes Supabase's callback parameters, decides where the visitor should land,
 * and stores a flash message. Returns { path } or null when this was a normal load.
 */
export function consumeAuthLanding() {
  const url = authState.pendingAuth || readAuthUrl();
  const query = new URLSearchParams(window.location.search);
  const next = sanitizeNext(query.get('next')) || '/account';
  const hasCallback = url.hasToken || Boolean(url.error) || Boolean(query.get('error')) || authState.recovery;

  if (!hasCallback) return null;

  // Clean tokens and callback parameters out of the address bar before routing.
  try { window.history.replaceState(null, '', window.location.pathname); } catch { /* ignore */ }

  const errorText = url.errorDescription || url.error || query.get('error_description') || query.get('error');
  if (errorText) {
    setAuthFlash(authUrlErrorMessage(new URLSearchParams({ error: url.error || query.get('error') || '', error_description: errorText })), 'error');
    return { path: '/account/login' };
  }

  if (authState.recovery || url.type === 'recovery') {
    setAuthFlash('Choose a new password for your Playroom account.', 'info');
    return { path: '/account/reset-password' };
  }

  if (authState.session) {
    const verified = url.verified || url.type === 'signup' || url.type === 'email_change';
    setAuthFlash(
      verified ? 'Your email is verified — welcome to Playroom.' : 'Signed in. Welcome back.',
      'success',
    );
    const target = next === '/account/reset-password' ? '/account' : next;
    return { path: target };
  }

  setAuthFlash('That link has expired or was already used. Sign in, or request a new one.', 'error');
  return { path: '/account/login' };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Add the project URL and anon/publishable key to .env.local.');
  }
}

function requireUser() {
  requireClient();
  if (!authState.user) throw new Error('Please sign in to continue.');
}
