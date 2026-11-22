// Keeps demo orders and returns attached to the signed-in customer.
//
// Guest behaviour: checkout writes to localStorage exactly as before.
// Sign-in:       the server history replaces the local mirror, and any orders
//                created in this browser first (or while offline) are uploaded.
// Checkout:      the new order is saved to the account immediately, so opening
//                the confirmation or tracking page after a reload still works.
// Sign-out:      the account mirror is removed and the guest mirror restored,
//                so the next person on this device cannot see those orders.
//
// The orders are still DEMO orders — nothing is charged or shipped. Supabase
// only stores the snapshot so the demo history survives across devices.
import { state, setOrders, setReturns, persist, storageKey } from '../store.js';
import {
  authState, onAuthChange,
  listRemoteOrders, saveRemoteOrder,
  listRemoteReturns, saveRemoteReturn,
} from './auth-store.js';

let started = false;
let hydratedFor = null;
let hydration = null;
let guestSnapshot = null;

const byNewest = (a, b) => {
  const ta = new Date(a?.createdAt || 0).getTime() || 0;
  const tb = new Date(b?.createdAt || 0).getTime() || 0;
  return tb - ta;
};

const GUEST_SNAPSHOT_KEY = storageKey('account-guest-snapshot');

const snapshotGuest = () => ({
  orders: [...state.orders],
  returns: [...state.returns],
  lastOrderId: state.lastOrderId,
});

function readGuestSnapshot() {
  try {
    const raw = localStorage.getItem(GUEST_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.orders) ? parsed : null;
  } catch {
    return null;
  }
}

function ensureGuestSnapshot() {
  if (guestSnapshot) return guestSnapshot;
  // A reload while still signed in must not treat the account's localStorage
  // mirror as "guest" data — the snapshot written at the first sign-in wins.
  guestSnapshot = readGuestSnapshot() || snapshotGuest();
  try { localStorage.setItem(GUEST_SNAPSHOT_KEY, JSON.stringify(guestSnapshot)); } catch { /* private mode */ }
  return guestSnapshot;
}

function restoreGuest() {
  // Prefer the snapshot saved before sign-in. If hydration never ran, clearing
  // the mirror is safer than handing another account the previous orders.
  const snap = readGuestSnapshot() || guestSnapshot || { orders: [], returns: [], lastOrderId: null };
  setOrders(snap.orders);
  setReturns(Array.isArray(snap.returns) ? snap.returns : []);
  state.lastOrderId = snap.lastOrderId || null;
  persist();
  guestSnapshot = null;
  try { localStorage.removeItem(GUEST_SNAPSHOT_KEY); } catch { /* private mode */ }
}

async function mergeLocalOrders(orders) {
  const known = new Set(orders.map((o) => String(o?.id || '').toLowerCase()));
  const locals = [...state.orders, ...(guestSnapshot?.orders || [])];
  for (const local of locals) {
    if (!local?.id || known.has(String(local.id).toLowerCase())) continue;
    try {
      const saved = await saveRemoteOrder(local);
      orders.push(saved || local);
    } catch (error) {
      // Offline / table not created yet: keep it visible locally and try again
      // on the next sign-in.
      console.warn('[Playrooom orders] could not upload a local order', error?.message || error);
      orders.push(local);
    }
    known.add(String(local.id).toLowerCase());
  }
  return orders.sort(byNewest);
}

async function mergeLocalReturns(returns) {
  const known = new Set(returns.map((r) => String(r?.id || '').toLowerCase()));
  const locals = [...state.returns, ...(guestSnapshot?.returns || [])];
  for (const local of locals) {
    if (!local?.id || known.has(String(local.id).toLowerCase())) continue;
    try {
      const saved = await saveRemoteReturn(local);
      returns.push(saved || local);
    } catch (error) {
      console.warn('[Playrooom orders] could not upload a local return', error?.message || error);
      returns.push(local);
    }
    known.add(String(local.id).toLowerCase());
  }
  return returns.sort(byNewest);
}

function hydrate(user) {
  if (!user) return Promise.resolve();
  if (hydration?.id === user.id) return hydration.promise;

  const promise = (async () => {
    ensureGuestSnapshot();

    let orders;
    try {
      orders = await listRemoteOrders();
    } catch (error) {
      // A missing table or a network hiccup must not blank the order history.
      console.warn('[Playrooom orders] history unavailable', error?.message || error);
      return;
    }
    const syncedOrders = await mergeLocalOrders(orders);

    let syncedReturns = [];
    try {
      syncedReturns = await mergeLocalReturns(await listRemoteReturns());
    } catch (error) {
      console.warn('[Playrooom returns] history unavailable', error?.message || error);
      syncedReturns = [...state.returns];
    }

    setOrders(syncedOrders);
    setReturns(syncedReturns);
    hydratedFor = user.id;
    // The first paint may have happened before a slow history request finished.
    window.dispatchEvent(new Event('playrooom:orders-updated'));
  })();

  hydration = { id: user.id, promise };
  return promise.finally(() => {
    if (hydration?.promise === promise) hydration = null;
  });
}

/** Await this after initAuth() so the first account render already has orders. */
export function hydrateOrders() {
  return hydrate(authState.user);
}

/** Save a freshly completed checkout order against the current account. */
export async function syncNewOrder(order) {
  if (!authState.user || !order) return false;
  const saved = await saveRemoteOrder(order);
  if (saved?.remoteId) order.remoteId = saved.remoteId;
  return true;
}

/** Save a newly started return against the current account. */
export async function syncNewReturn(ret) {
  if (!authState.user || !ret) return false;
  const saved = await saveRemoteReturn(ret);
  if (saved?.remoteId) ret.remoteId = saved.remoteId;
  return true;
}

export function startOrderSync() {
  if (started) return;
  started = true;

  onAuthChange((auth) => {
    if (auth.user) {
      if (hydratedFor !== auth.user.id) {
        hydratedFor = auth.user.id;
        hydrate(auth.user).catch(() => {});
      }
    } else if (hydratedFor) {
      hydratedFor = null;
      hydration = null;
      restoreGuest();
    }
  });
}
