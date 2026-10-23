# Playloom Atelier — Rebuild Audit & Handoff

**Artifact:** `playloom-atelier/` (this folder) — enhanced static SPA rebuild of `playloom_atelier_signature.html`
**Reference source of truth:** `../playloom_atelier_signature.html` (607-line single file with embedded base64 photos)
**Brief:** `../PLAYLOOM_ATELIER_FRONTEND_SESSION_HANDOFF.md`

---

## 1. Status summary

| Area | Status |
|---|---|
| Route parity (all hash routes render their own page) | ✅ 14/14 automated browser checks pass, 0 console errors |
| Catalogue data 1:1 with reference | ✅ 110 products verbatim (names, prices, ages, categories, descriptions, includes, benefits) |
| Copy parity (headlines, hero, sections, footers) | ✅ Ported verbatim from reference render functions |
| CSS parity | ✅ Extracted verbatim into `css/styles.css` |
| Images | ✅ 49 photos extracted to `assets/img/` (hero.jpg + photo-00…photo-47.jpg) — identical pixels, no more base64 blobs |
| Cart / wishlist / newsletter persistence | ✅ localStorage, namespaced + versioned, defensive parse |
| Checkout → demo order snapshot | ✅ Validation + snapshot model per handoff §8.4 → upgraded to Stripe-style gateway (`gateway.js` + `checkout-gateway.js`): 4 methods, random autofill, Elements-style live formatting, pay animation + confetti |
| Order tracking (simulated timeline) | ✅ 7-scan FedEx-style timeline (`fedexTimeline` in `gateway.js`): 12-digit tracking no., Priority Overnight label + barcode, purple/orange brand header, fedex.com deep link |
| Order invoice | ✅ Photo-real print-ready invoice on `#/order-confirmation` (bill/ship, line table, totals, `window.print()` → PDF) |
| Console cleanliness | ✅ Zero uncaught exceptions across the whole route sweep |

## 2. Structure

```
playloom-atelier/
├── index.html          # Shell: header, footer, drawers, search panel, modal, toasts (markup 1:1 w/ reference)
├── css/styles.css      # Verbatim reference stylesheet
├── assets/img/         # hero.jpg + photo-00..47.jpg (extracted from base64), _extract.log
└── js/
    ├── app.js          # Route renderers, drawers, search, compare, modal, checkout, tracking UI
    ├── router.js       # Hash router (#/ prefix; prefix routes for /product/ and /journal/)
    ├── store.js        # State + persistence + pricing (free delivery ≥₹1,499 else ₹99; PLAY10 = 10%)
    ├── data.js         # Products built from seeds + deterministic photo allocation
    ├── data-seeds.js   # 110 seed rows verbatim from the reference
    ├── data-pools.js   # Photo pools, category pools, categories (verbatim)
    ├── components.js   # productCard / sectionHead + delegated actions (add/wish/compare)
    ├── dom.js          # safe(), $, $$, toast()
    └── tracking.js     # Simulated timeline generator (handoff §8.6)
```

## 3. Route map

| Hash | Page |
|---|---|
| `#/` | Editorial home (hero cinema, categories, manifesto, favourites, by-age, story tiles, gifting, journal teasers, last call) |
| `#/catalog` (+ `category`, `q`, `age`, `max`, `sale`, `sort` params) | Filterable/sortable catalogue with grid/list toggle |
| `#/product/<slug>` | PDP: gallery, qty, add-to-bag, PIN delivery estimate, accordions, reviews, related |
| `#/wishlist` | Saved things |
| `#/gift-finder` | 3-step gift quiz → filtered catalogue |
| `#/journal` and `#/journal/<slug>` | Journal index + 3 articles |
| `#/checkout` | Validated form + order summary + PLAY10 |
| `#/order-confirmation` | Snapshot of last local demo order |
| `#/track-order` (+ optional `?order=`) | Simulated timeline lookup by order number |
| `#/about` | Editorial "point of view" page |
| `#/help`, `#/shipping`, `#/privacy`, `#/contact`, `#/account` | Support/simple pages |

Unmatched routes render the playful 404 ("This path went off to play").

## 4. Interactions verified in a real browser

- Add to bag (card quick-add & PDP with quantity) → badge count updates
- Cart drawer: qty +/−, remove, subtotal, free-delivery progress bar, checkout routes
- Checkout: field validation (email/PIN/phone rules), PLAY10 promo (sessionStorage), order summary recalc, double-submit guard
- Order creation: saved **before** clearing cart; cart emptied; badge resets; toast shows ID
- Confirmation page renders from snapshot (name, address, lines, breakdown)
- Tracking: exact ID → 6-step simulated timeline; unknown ID → "No match yet" state
- Wishlist: hearts toggle anywhere, drawer + page views, badge count
- Search overlay: live results + submit routes to `#/catalog?q=`
- Gift finder → parameterized catalogue
- PIN checker on PDP (3–6 days estimate copy)
- PDP gallery thumbnail switching with fade
- State persists across full page reload (cart, wishlist, orders)
- Esc closes drawer/search/modal; Ctrl/Cmd-K opens search; back-to-top; cookie note

## 5. Demo limitations (by design, per handoff)

- No backend. Orders, reviews, newsletter, contact messages live only in this browser's localStorage.
- No real payment collection at any step; the Stripe-style gateway is a **test-mode stand-in** (random test cards/VPAs/banks/wallets, `pi_demo_*` ids) labelled "(demo)" — no Stripe.js, no charge.
- Tracking is a FedEx-style **demo stand-in** (random 12-digit numbers, simulated scans); nothing ships; no FedEx API is connected.
- Inventory is static demo stock; reviews are illustrative.

## 6. Known trivial deviations

- Images are served as files instead of inline base64 (better caching/size); pixel content is identical.
- Order IDs `PL-######` (6 digits) vs reference `PL-#####` (5) — collision-resistant choice; cosmetic only.
- `#/about` uses the full editorial renderer (restored after verifying against the reference layout).

## 7. How to run

```bash
cd playloom-atelier
python -m http.server 8199 --bind 127.0.0.1
# open http://127.0.0.1:8199/index.html#/
```

Any static file server works; ES modules require http(s), not `file://`.
