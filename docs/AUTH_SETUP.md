# Authentication & account setup

This document covers everything that must happen outside the codebase for
customer accounts to work: the Supabase project, Google OAuth, email links and
the Vercel deployment.

> The storefront runs **without** Supabase — browsing, the bag and demo checkout
> all still work. Only the account area needs these settings, and it shows a
> plain “setup needed” note when the environment variables are missing.

---

## 1. Create the Supabase project

1. Create a project at <https://supabase.com/dashboard>.
2. Open **SQL Editor** and run the whole of
   [`supabase/migrations/20261119090000_playroom_accounts.sql`](../supabase/migrations/20261119090000_playroom_accounts.sql).
   It creates `profiles`, `addresses`, `wishlist`, `user_roles`, their triggers,
   indexes and Row Level Security policies. It is safe to run again.
3. Open **Project Settings → API** (newer dashboards call this **API Keys**) and
   copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) → `VITE_SUPABASE_ANON_KEY`
     (older projects show an **anon public** key — either works here).
   The green **Connect** button at the top of the project can also show both
   values; map them to the two `VITE_` names above.

Never copy the `service_role` / secret key into the frontend or into Vercel’s
public environment variables. The publishable key is designed to be public and
is limited by RLS.

## 2. Local environment

```bash
cp .env.example .env.local
# edit .env.local with the URL and key from step 1
npm install
npm run dev          # http://localhost:5173
```

Vite exposes only `VITE_*` variables to the browser. Restart `npm run dev`
after changing `.env.local`.

## 3. Auth URL configuration (Supabase dashboard)

Go to **Authentication → URL Configuration**.

| Setting | Value |
| --- | --- |
| Site URL | `https://playrooom.vercel.app` (your production URL) |
| Redirect URLs | `https://playrooom.vercel.app/**` and `http://localhost:5173/**` |

The app sends Supabase a redirect of the form
`https://playrooom.vercel.app/?next=%2Faccount&verified=1`, so the wildcard
entries above are required. If you use a different domain or preview URL, add
that origin too.

Under **Authentication → Providers → Email**, keep **Confirm email** on. That
is what produces the verification link the register flow waits for.

### Email templates

The default Supabase templates work. If you customise them, keep
`{{ .ConfirmationURL }}` (or `{{ .TokenHash }}`) intact — the app reads the
session tokens Supabase appends to that URL. The storefront deliberately uses
the **implicit** flow so a confirmation or reset link also works when it is
opened on a different device or browser; PKCE would fail in that case.

For a branded reset email, a link to `{{ .SiteURL }}/?recovery=1` is not enough
on its own — use the default `{{ .ConfirmationURL }}`, which already carries the
recovery token. The app detects `type=recovery` and routes to the reset form.

## 4. Google OAuth

### Google Cloud Console

1. <https://console.cloud.google.com/> → create (or choose) a project.
2. **APIs & Services → OAuth consent screen**: choose *External*, fill the app
   name (Playroom), support email and developer email. Add the scopes
   `email`, `profile`, `openid`. While the app is in *Testing*, add the Google
   accounts that should be able to sign in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `Playroom web`
   - **Authorised JavaScript origins**
     - `https://playrooom.vercel.app`
     - `http://localhost:5173`
   - **Authorised redirect URIs**
     - `https://<project-ref>.supabase.co/auth/v1/callback`

   The redirect URI points at Supabase, not at the storefront. Copy the client
   ID and client secret.

### Supabase dashboard

**Authentication → Providers → Google** → enable, paste the client ID and
secret, save. The callback shown in Supabase should match the redirect URI you
entered in Google.

### What the app does

`signInWithGoogle()` calls `supabase.auth.signInWithOAuth({ provider: 'google',
options: { redirectTo } })`, where `redirectTo` is the same `/?next=…` URL used
by email links. Google returns to Supabase, Supabase returns to the storefront
with a session in the URL fragment, and the app strips the tokens before the
hash router renders.

## 5. Vercel

The repository is already connected to Vercel. The build is a standard Vite
build:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |
| Node.js version | 22.x or newer (the Supabase client requires it) |

`vercel.json` records the same values, so the dashboard settings are optional
but recommended.

### Environment variables (Vercel → Settings → Environment Variables)

Add these for **Production**, **Preview** and **Development**:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable or anon key>
```

Redeploy after adding them — Vite inlines environment variables at build time,
so an old build will not pick them up.

### Routing

The site uses hash routing (`/#/account`), so no SPA rewrite is needed and
`vercel.json` intentionally contains no catch-all rewrite. Do not add one: it
would turn genuine 404s for missing assets into the HTML shell.

## 6. Checklist

- [ ] Migration run successfully; four tables visible in **Table Editor**
- [ ] RLS enabled on all four tables (**Authentication → Policies**)
- [ ] `.env.local` filled in; `npm run dev` shows no “Supabase is not configured” note
- [ ] Email confirmation enabled in Supabase
- [ ] Site URL + redirect URLs saved
- [ ] Google provider enabled with a matching redirect URI
- [ ] Vercel environment variables added for all environments
- [ ] Production redeployed after adding the variables
- [ ] Test: register → confirm email → sign in → edit profile → add address →
      save a wish-list item → sign out → sign back in

See [`TESTING.md`](TESTING.md) for results and the remaining manual checks.
