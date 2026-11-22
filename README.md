# Playrooom — Frontend Storefront with Customer Accounts

A static, modular storefront built from the Playrooom reference design. The shop
itself runs entirely in the browser; customer accounts (profile, addresses,
wish list, demo order history and the Playrooom Circle demo membership are
backed by Supabase when configured.
Checkout remains a clearly labelled demo and no real payment is charged or
shipped.

**Account setup:** [`docs/AUTH_SETUP.md`](./docs/AUTH_SETUP.md)
**Database & RLS:** [`docs/DATABASE.md`](./docs/DATABASE.md)
**Routes:** [`docs/ROUTES.md`](./docs/ROUTES.md)
**Order email setup:** [`docs/EMAIL_SETUP.md`](./docs/EMAIL_SETUP.md)
**Playrooom Circle:** [`docs/CIRCLE.md`](./docs/CIRCLE.md)
**3D product studio:** [`docs/3D_VIEWER.md`](./docs/3D_VIEWER.md)
**Admin analytics:** [`docs/ADMIN_ANALYTICS.md`](./docs/ADMIN_ANALYTICS.md)
**Testing & manual steps:** [`docs/TESTING.md`](./docs/TESTING.md)

## Quick start

```bash
cd playloom-atelier
npm install
cp .env.example .env.local     # optional — accounts only
npm run dev                    # http://localhost:5173
```

Without `.env.local` the shop works normally and the account pages show a plain
“setup needed” note. To enable accounts, follow
[`docs/AUTH_SETUP.md`](./docs/AUTH_SETUP.md), then restart the dev server.

A plain static server still works for browsing:

```bash
python -m http.server 8199 --bind 127.0.0.1
# http://127.0.0.1:8199/index.html#/
```

ES modules need a real HTTP server — opening `index.html` via `file://` will not
work. `npm run build` emits a Vercel-ready `dist/`; `npm run preview` serves it
locally.

## Accounts

| Feature | Route | Notes |
| --- | --- | --- |
| Register with email verification | `#/account/register` | Supabase confirmation email |
| Sign in | `#/account/login` | Email + password or Google |
| Google OAuth | `#/account/login` | `provider: 'google'` |
| Forgot / reset password | `#/account/forgot-password` | One-use recovery link |
| Overview & profile | `#/account` | Name and phone editable; email read-only |
| Orders | `#/account/orders` | Saved demo orders with receipts, tracking and returns |
| Saved addresses | `#/account/addresses` | Create / edit / delete / default |
| Wish list | `#/wishlist` / `#/account/wishlist` | Guest list in browser; account list inside the account area |

Protected routes remember the intended destination and return there after
sign-in. The bag is never cleared by signing in or out. Account data is read and
written with the publishable/anon key only; Row Level Security enforces ownership
in Postgres.

## Highlights

- 110 products, 10 categories, editorial home page
- Filter/sort catalogue, product pages with gallery + PIN delivery estimate
- Cart drawer with free-delivery progress (free ≥ ₹499, else ₹99)
- Checkout with validation + demo promo code `PLAY10` (10% off)
- **Stripe-style demo gateway**: Card / UPI / NetBanking / Crypto tabs, random
  autofill, Elements-style card formatting, animated pay sequence, `pi_demo_*`
  txn ids
- **FedEx-style demo tracking**: 12-digit tracking numbers, label, 7-scan
  timeline
- **Photo-real invoice** on `#/order-confirmation`, print-to-PDF
- Spring-physics motion, magnetic buttons, 3D tilt cards, hero parallax
- Wishlist, recently viewed, search overlay, gift-finder quiz, journal, compare

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Shell + chrome (header/footer/drawers/search/modal/toasts) |
| `css/styles.css` | Storefront stylesheet |
| `css/account.css` | Account & auth styles, built from the existing tokens |
| `js/app.js` | Page renderers and page-level wiring |
| `js/router.js` | Hash router |
| `js/store.js` | State, pricing rules, persistence, demo orders |
| `js/auth/` | Supabase client, session store, pages, UI wiring, wish-list sync |
| `js/data.js` + `data-seeds.js` + `data-pools.js` | Catalogue data |
| `js/gateway.js`, `js/checkout-gateway.js` | Demo gateway + tracking model |
| `js/spring.js`, `js/motion.js` | Dependency-free motion core + orchestration |
| `supabase/migrations/` | Tables, triggers, indexes, RLS policies |
| `assets/img/` | 54 runtime photos |
| `docs/` | Setup, schema/RLS, routes, testing |

## Scope note

This is a class-project concept storefront. **No real payment is taken.** If
Supabase is configured, the profile, saved addresses, wish list and demo order
/ return snapshots are stored in your Supabase project under Row Level
Security. Loyalty leaves and referral codes remain local demo data. The
Stripe-style gateway and FedEx-style tracking are
demo/test-mode UI stand-ins (random test data, simulated timelines) — fine print
is surfaced in the checkout UI, tracking page, invoice and footer. No real
charge, shipment or courier movement occurs.
