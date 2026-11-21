# Routes & behaviour

The site is a hash router: every route is a fragment after `#/`. Account routes
are registered **before** the prefix route `/account` because the router matches
prefixes.

| Route | Access | What it does |
| --- | --- | --- |
| `#/` … `#/catalog`, `#/product/:slug` | Public | Existing storefront. Unchanged. |
| `#/wishlist` | Public | Guest wish list from `localStorage`. |
| `#/account/wishlist` | Protected | The signed-in customer's wish list, rendered inside the account shell. |
| `#/orders` | Public | Demo-order page: local orders for guests, the signed-in customer's saved orders when signed in. |
| `#/checkout` | Signed-in customers | Guests see a branded sign-in gate with `?next=/checkout`; their bag stays intact. All order creation goes through `POST /api/orders`. |
| `#/circle` | Public | Playroom Circle benefits and pricing. |
| `#/3d/:slug` | Public | Premium interactive 3D product studio. First enabled product: Little Architect Wooden Blocks. |
| `#/admin` | Admin only | Secure analytics control room with revenue, funnels, breakdowns, tables and low-level event ledger. |
| `#/account/login?admin=1` | Public | Admin sign-in mode; hides customer signup and opens analytics after an admin role check. |
| `#/circle/checkout` | Signed-in customers | Demo payment checkout using the existing Stripe-style UI; guests see a sign-in gate. |
| `#/circle/success` | Signed-in customers | Post-activation Circle welcome state. |
| `#/account/membership` | Protected | Active membership, benefits, demo payment history, play guide download and service requests. |
| `#/account/register` | Public (guests) | Create account: name, email, password + confirmation, terms. Then verify with the emailed OTP or confirmation link. |
| `#/account/login` | Public (guests) | Email + password, Google, link to reset. Honours `?next=`. |
| `#/account/forgot-password` | Public | Sends a one-use reset link. Always shows the same confirmation, so it cannot be used to discover which emails have accounts. |
| `#/account/reset-password` | Needs a recovery session | New password form. After saving, the session is ended and the visitor signs in again. |
| `#/account` | Protected | Dashboard: editable name/phone, member since, email verification, local demo leaves and referral code. |
| `#/account/orders` | Protected | The customer's saved demo orders: receipts, buy-again, FedEx-style tracking timeline and returns desk. |
| `#/account/addresses` | Protected | List, create, edit, delete and set-default addresses. |

## Guard behaviour

- A signed-out visitor opening `/account`, `/account/orders` or
  `/account/addresses` is remembered and sent to
  `/account/login?next=<original path>`. After signing in (password or Google)
  they land on the original page, never on a generic dashboard.
- `next` is sanitised: only same-origin paths are accepted, and the login /
  register / forgot-password pages are never valid destinations (no loops).
- A signed-in visitor opening login/register/forgot-password is redirected to
  their intended page or `/account`.
- Session expiry on a protected page moves the visitor to sign-in instead of
  leaving private content on screen.
- If Supabase is not configured, the auth pages render a clear setup note
  instead of failing silently. The rest of the shop is unaffected.

## URL handling after Supabase redirects

Email confirmation, password recovery and Google OAuth return to
`/?next=…` with either a query (`?error=…`) or a fragment
(`#access_token=…&type=recovery`). `initAuth()` consumes the session **before**
the router renders, then `history.replaceState` removes the tokens from the
address bar and sends the visitor to the right hash route. Tokens are never
logged, rendered, or stored anywhere except Supabase’s own session storage.

## Header account control

The account icon is a disclosure menu (`aria-haspopup`, `aria-expanded`,
`role="menu"`):

- signed out: “Sign in” and “New here? Create an account”
- signed in: name, email, verification state, links to account/orders/addresses/
  wish list, and Sign out

It closes on outside click, `Escape`, route change, and traps Tab focus while
open. On small screens it becomes a fixed panel below the header.
