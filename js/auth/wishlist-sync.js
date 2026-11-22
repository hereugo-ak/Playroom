// Keeps the local wish list and the signed-in customer's Supabase wish list in
// step without turning the storefront into a server-driven app.
//
// Guest behaviour: hearts are stored in localStorage exactly as before.
// Sign-in:      guest hearts are merged into the account's wishlist table, then
//               the local mirror is replaced by the server list.
// Sign-out:     account wish-list items are removed from the local mirror so the
//               next person on this device does not see them. The cart is never
//               touched.
import { state, persist, replaceWishlist, setWishlistSyncHandler } from '../store.js';
import { authState, onAuthChange, fetchWishlistIds, addWishlistItem, removeWishlistItem } from './auth-store.js';

let started = false;
let hydration = null;

async function hydrate() {
  if (!authState.user) return;
  if (hydration) return hydration;
  hydration = (async () => {
    try {
      const remote = new Set(await fetchWishlistIds());
      const guest = state.wishlist.filter((id) => !remote.has(id));
      // Merge guest hearts up to the account. Individual failures are ignored;
      // a later sign-in simply tries again.
      for (const id of guest) {
        try { await addWishlistItem(id); remote.add(id); } catch { /* keep local */ }
      }
      replaceWishlist([...remote]);
    } catch (error) {
      // Missing table / offline: keep the local list rather than blanking it.
      console.warn('[Playrooom wishlist] sync unavailable', error?.message || error);
    } finally {
      hydration = null;
    }
  })();
  return hydration;
}

export function startWishlistSync() {
  if (started) return;
  started = true;

  setWishlistSyncHandler(async (productId, added) => {
    if (!authState.user) return;
    try {
      if (added) await addWishlistItem(productId);
      else await removeWishlistItem(productId);
    } catch (error) {
      console.warn('[Playrooom wishlist] could not save change', error?.message || error);
    }
  });

  let hadAccount = Boolean(authState.user);
  let hydratedFor = authState.user?.id || null;
  onAuthChange((auth) => {
    if (auth.user) {
      hadAccount = true;
      // onAuthChange fires for profile/role updates too; only merge once per user.
      if (hydratedFor !== auth.user.id) {
        hydratedFor = auth.user.id;
        hydrate();
      }
    } else {
      hydratedFor = null;
      if (hadAccount && state.wishlist.length) {
        // Signed out — clear account data from the shared local mirror. Guests
        // who were never signed in keep their saved things.
        hadAccount = false;
        replaceWishlist([]);
      }
    }
  });
}

export { hydrate as hydrateWishlist };
