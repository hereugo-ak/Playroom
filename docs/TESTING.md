# Testing & remaining manual steps

## Environment used

| Tool | Version / note |
| --- | --- |
| Node.js | v26.8.1 (npm 11.19.0) |
| Vite | 7.3.8 |
| `@supabase/supabase-js` | 2.119.1 |
| Browser | Headless Chromium 1254 via Playwright (Linux/WSL) |
| Supabase project | **none available during development** |

No Supabase URL, publishable key or Google OAuth client was supplied, so the
real hosted flows were **not** exercised. What was tested is listed honestly
below.

## What was verified automatically

### 1. Storefront + auth UI without Supabase configured — 38/38 checks

Run against `npm run dev` with no `.env.local`:

- Home still renders (hero, wordmark, header), catalogue still renders 110 products
- Header account button opens the guest menu; `Escape` closes it; ARIA state updates
- `/account/login`, `/account/register`, `/account/forgot-password` render
- “Setup needed” note appears when credentials are missing
- Google button present
- Empty login shows both field errors
- Invalid email is rejected
- Short password is rejected; confirmation mismatch is reported separately
- Password show/hide toggle works and updates `aria-pressed`
- Register validation: short name, malformed email, short password, mismatch
- Forgot-password submit reports the missing configuration rather than failing silently
- `/account`, `/account/orders`, `/account/addresses` redirect to
  `/account/login` when signed out; `?next=` is preserved
- `/account/reset-password` without a recovery session shows the “request a fresh link” state
- `/wishlist` and `/catalog` continue to work
- `sanitizeNext()` rejects external and protocol-relative URLs, prevents auth-page
  loops, and keeps internal destinations intact
- Mobile 375×760: account menu is visible, fits inside the viewport, and closes
  on an outside tap
- The floating customer-care bubble is hidden on auth/account screens and returns
  on shop pages (it otherwise covered the mobile submit button)
- No uncaught page errors or console errors in this run

### 2. Account UI against a mocked Supabase API — 45/45 checks

A local mock of `/auth/v1/*` and `/rest/v1/*` was used **only** to verify the
frontend contract: request shapes, ownership fields, rendering and state
transitions. This is not a substitute for testing the real project.

Verified:

- A persisted session is restored; header shows the first name and signed-in dot
- Dashboard greets the customer, shows email, verified state, profile name/phone
- Sign-in email is read-only
- `user_roles` is fetched and used for the account type
- Profile save sends `PATCH /rest/v1/profiles` with the right fields, scoped to
  the signed-in user id
- Addresses render; default is labelled; the card shows the saved address
- Address create sends `POST /rest/v1/addresses` **including `user_id`** and the
  entered fields
- Account orders shows the honest empty state (no fabricated orders)
- Wish-list add sends `POST /rest/v1/wishlist` with `user_id` + `product_id`;
  remove sends `DELETE` scoped to both
- A heart tapped while signed out stays local (no request); it renders filled
- A successful password sign-in reaches `/account`, shows the name, keeps the
  bag count unchanged, and merges the guest heart into the account with a single
  `POST /rest/v1/wishlist` carrying the signed-in `user_id`
- Invalid login is mapped to “That email and password don't match…” (no raw
  Supabase wording)
- Registration sends name metadata, password, and an `emailRedirectTo` containing
  `next=` and `verified=1`
- Forgot password sends `redirect_to` containing `reset-password` and `recovery=1`
- Google sign-in calls `/auth/v1/authorize` with `provider=google`,
  `prompt=select_account`, and a `redirect_to` carrying the intended destination
- No uncaught page or console errors other than the intentionally mocked HTTP 400

### 3. Auth callback landings against the mock — 17/17 checks

Supabase redirects back with tokens (or an error) in the URL fragment. These
paths were exercised directly with synthesised token URLs:

- A confirmation landing (`?next=/account/addresses&verified=1#access_token=…`)
  restores the session, removes the tokens and query string from the address
  bar, routes to the intended destination, shows the “email is verified” flash
  and renders the signed-in header
- The profile is fetched after the landing
- A signed-in visitor opening `#/account/login` is redirected to `#/account`
- An OAuth cancellation (`#error=access_denied&error_description=…`) lands on the
  sign-in screen with “Google sign-in was cancelled. Nothing was changed.” and
  no raw error text; the fragment is removed
- A recovery landing (`?recovery=1#…&type=recovery`) opens the reset form; the
  submit sends `PUT /auth/v1/user` with the new password, signs out, clears the
  stored session and lands on sign-in with “Password updated”
- No page or console errors in this run

### 4. Production build & built-site smoke test

- `npm run build` succeeds (73 modules transformed)
- `dist/` contains `index.html`, hashed JS/CSS in `dist/build/`, all **54**
  runtime images in `dist/assets/img/`, and the three classic vendor scripts in
  `dist/js/vendor/`
- Served with `vite preview`: home hero, account menu, login form, protected-route
  redirect and 110 catalogue cards all work
- No page errors and no HTTP responses ≥ 400 for the built site
- `node --check` passes for all auth modules and `js/app.js`

### 5. Not tested (requires real services)

These are **unverified** and must be checked manually after setup:

- Real sign-up against your Supabase project, including the confirmation email
- Confirmation link opened in the same browser **and** on a different device
- Real sign-in, session persistence across reloads and browser restarts
- Google OAuth round trip and account linking
- Password-recovery email and reset link expiry/one-use behaviour
- RLS isolation between two real customers
- Email deliverability / spam behaviour
- Vercel production deployment with environment variables
- Safari, Firefox and real iOS/Android devices (only headless Chromium was used)
- Screen-reader output (markup, labels, live regions and focus handling were
  written for it, but no AT was run)

## Manual acceptance checklist

After completing [`AUTH_SETUP.md`](AUTH_SETUP.md):

1. **Register** at `/account/register`. Expect the “One last little step” panel,
   not an immediate session.
2. Open the confirmation email on the **same device**. Expect to land on
   `/account` with “Your email is verified”.
3. Sign out, then sign in with email + password. Reload the page and confirm you
   are still signed in.
4. Open the confirmation link on a **second device/browser** and confirm it also
   establishes a session (this is why implicit flow was chosen).
5. Click **Continue with Google** on `/account/login`. Cancel once (expect a
   friendly error), then complete it. Confirm the profile name/avatar are filled
   from Google metadata.
6. Edit name/phone on `/account`; reload and confirm the values persist.
7. Add two addresses, set the second as default, edit one, delete one. Confirm
   only one is ever marked default.
8. Save a wish-list item while signed out, then sign in. Confirm guest items are
   merged, the heart stays filled, and the row exists in `wishlist`.
9. Remove a wish-list item and confirm the database row is deleted.
10. Add items to the bag, sign in, and confirm the bag is unchanged. Sign out and
    confirm the bag is still unchanged.
11. Try `/account`, `/account/orders` and `/account/addresses` while signed out;
    confirm the sign-in redirect returns you to the page you asked for.
12. Request a password reset, use the link, set a new password, and confirm you
    are asked to sign in with it. Try the same link again — it must fail.
13. Sign out and confirm the header returns to guest state and the wish list no
    longer shows account-only items.
14. In the Supabase SQL editor, confirm RLS is enabled on all four tables and
    test with two accounts that neither can read the other’s rows.
15. On a phone, check the account menu, forms, password toggle and error messages.
    Confirm the customer-care bubble does not cover the submit button.

## Known limitations

- **Orders are still local demo data.** The account orders page intentionally
  shows an empty state. Connecting checkout to an `orders` table was out of scope;
  the existing public `#/orders` demo page and browser-stored demo orders are
  unchanged.
- **Demo loyalty and referral codes remain browser-local** and are labelled as
  such. They are not tied to the Supabase account yet.
- **Email address changes** are not self-service. The UI points to customer care;
  Supabase’s secure email-change flow can be added later.
- The site uses Supabase’s **implicit** flow so email links work across devices.
  Tokens briefly travel in the URL fragment, are consumed before routing, and are
  removed with `history.replaceState`; they are never logged or rendered.
- No `service_role` key exists anywhere in the repository. Every table is
  protected by RLS and every client query is additionally scoped to the user id.
