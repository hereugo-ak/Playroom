# Playloom Atelier — Frontend Demo Store

A 1:1 static rebuild of the reference `playloom_atelier_signature.html`, reorganized into a clean, modular enhanced static app. Everything runs in the browser; there is no backend and nothing real is charged or shipped (clearly labelled everywhere in the UI).

**Full details:** see [`REFERENCE_AUDIT.md`](./REFERENCE_AUDIT.md) (structure, verified flows, route map, limitations).

## Quick start

```bash
cd playloom-atelier
python -m http.server 8199 --bind 127.0.0.1
# visit http://127.0.0.1:8199/index.html#/
```

ES modules need a real HTTP server — opening `index.html` via `file://` will not work.

## Highlights

- 110 products, 10 categories, editorial home page
- Filter/sort catalogue, product pages with gallery + PIN delivery estimate
- Cart drawer with free-delivery progress (free ≥ ₹1,499, else ₹99)
- Checkout with validation + demo promo code `PLAY10` (10% off)
- **Stripe-style demo gateway** (`js/gateway.js` + `js/checkout-gateway.js`): Card / UPI / NetBanking / Crypto tabs, random autofill of payer + payment fields, Elements-style live card formatting + brand detect, animated pay sequence (validating → bank → confirm → success + physics confetti), `pi_demo_*` txn ids
- **FedEx-style demo tracking**: 12-digit tracking numbers, Priority Overnight label card with barcode, purple/orange brand header, 7-scan timeline, `fedex.com?trknbr=` deep link
- **Photo-real invoice** on `#/order-confirmation` with bill/ship block, line table, totals, and print-to-PDF via `window.print()`
- **Spring-physics motion core** (`js/spring.js` + `js/motion.js`): dependency-free springs, magnetic buttons, 3D tilt cards, drawer/modal/toast springs, hero toy wake + parallax, confetti gravity — no animation library required
- Local demo orders + snapshot confirmation + simulated tracking timeline
- Wishlist, recently viewed, search overlay, gift-finder quiz, journal, compare dock
- Persistence via namespaced, versioned localStorage (`playloom-demo-v1-*`)

## Files

| Path | Purpose |
|---|---|
| `index.html` | Shell + all chrome (header/footer/drawers/search/modal/toasts) |
| `css/styles.css` | Reference stylesheet, verbatim |
| `js/app.js` | All page renderers and page-level wiring |
| `js/router.js` | Hash router |
| `js/store.js` | State, pricing rules, persistence, demo orders |
| `js/data.js` + `data-seeds.js` + `data-pools.js` | 1:1 catalogue data |
| `js/gateway.js`, `js/checkout-gateway.js` | Stripe-style demo gateway: 4 methods, random autofill, Elements-style card formatting, pay animation, FedEx label model |
| `js/spring.js`, `js/motion.js` | Dependency-free spring-physics motion core + site-wide orchestration (no animation lib) |
| `assets/img/` | 49 extracted photos (was base64 in the reference) |

## Scope note

This is a class-project concept storefront. Orders and accounts are stored locally; no real charge, email, inventory, or courier movement exists. The Stripe-style gateway and FedEx-style tracking are **demo/test-mode UI stand-ins** (random test data, simulated timelines) — fine print is surfaced in the checkout UI, tracking page, invoice, and footer.
