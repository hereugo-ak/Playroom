# Playrooom Circle

Playrooom Circle is a system-level demo membership. It uses the existing Stripe-style demo payment UI, stores membership in Supabase, and activates benefits through server-side checks.

**No real payment provider is used.** No money is charged, no card details are stored, and no physical service is scheduled.

## Plans

| Plan | Code | Price |
| --- | --- | --- |
| Monthly Circle | `circle_monthly` | ₹499 / month |
| Yearly Circle | `circle_yearly` | ₹4,499 / year |

## Benefits and how they execute

| Benefit | Execution |
| --- | --- |
| Free next-day delivery | `/api/orders` sets the Express fee to ₹0 for active members |
| Gift wrapping on us | `/api/orders` sets the gift wrap line to ₹0 for active members |
| First look at new toys | Products with `circleEarly` are rejected at checkout for non-members; PDP/card shows a Circle badge |
| Priority care desk | Support requests from members are saved with `priority: true` via `/api/membership/requests` |
| Monthly play guide | `/api/membership/guide` checks active membership before serving the guide |
| Build with us | Member-only form saves a co-creation request in `member_requests` |
| Endless customisation | Members can enter up to 60 characters of personalisation and the fee is waived server-side |
| Lifetime repair desk | Member-only form saves a care/repair request linked to an account order |

## Routes

| Route | Purpose |
| --- | --- |
| `#/circle` | Benefits and pricing |
| `#/circle/checkout` | Demo payment checkout; guests see sign-in gate |
| `#/circle/success` | Post-activation success state |
| `#/account/membership` | Member dashboard, requests and payment history |

## Flow

1. Customer signs in.
2. Customer chooses a plan and approves the demo payment.
3. Browser calls `POST /api/subscriptions/activate` with an idempotency key.
4. Server verifies the Supabase token.
5. Server commits the subscription and demo payment.
6. Server writes an outbox row.
7. Premium confirmation email is sent after commit.
8. Browser refreshes membership state and opens the success screen.

Refreshing or retrying with the same idempotency key returns the existing membership and does not duplicate email.

## Database

Migration:

```text
supabase/migrations/20261120130000_playrooom_circle.sql
```

Tables:

- `subscription_plans`
- `subscriptions`
- `subscription_payments`
- `member_requests`

The migration also extends `email_outbox.email_type` with `subscription_confirmation`.

RLS allows customers to read their own membership, payments and requests. All writes happen server-side with the service role.

## Email

Template:

```text
emails/subscription-confirmation.js
```

Subject:

```text
Welcome to Playrooom Circle — your membership is active
```

The email includes:

- Original Playrooom logo
- Warm beige masthead
- Ivory body
- Rose italic accents
- Membership card
- Active benefits
- CTA to `#/account/membership`
- Plain-text fallback
- Clear demo disclaimer

It is sent by `api/subscriptions/activate.js` through the same pooled Nodemailer transport used for order confirmations.

## Environment

No new payment environment variables are required.

Required server variables remain:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
SITE_URL
```

## Local development

Vite serves the frontend at `http://localhost:5173/`, but it does not run Vercel serverless functions. The Circle UI can be previewed locally, but activation, request saving, guide downloads and email sending must be tested on a Vercel preview or production deployment. If you approve a demo payment on localhost, the form now shows a clear message explaining that the API step is only available on Vercel. This is not a Supabase migration error.

## Current verification

- `npm run build` passes with the Circle routes, UI and server files.
- The membership confirmation renderer was exercised locally with yearly data,
  escaped user text and the plain-text fallback.
- Vercel/SMTP delivery has not been verified here because no SMTP credentials
  were available in this workspace.

## Testing checklist

1. Guest opens `#/circle/checkout` and sees sign-in gate.
2. Monthly plan activates.
3. Yearly plan activates at ₹4,499.
4. Duplicate/retried request does not create a second membership or email.
5. Member checkout gets Express delivery at ₹0.
6. Member checkout gets gift wrapping at ₹0.
7. Non-member cannot check out with a Circle first-look toy.
8. Member gets longer personalisation and no personalisation fee.
9. Priority care form saves a request.
10. Build with us form saves a request.
11. Lifetime repair form saves a request linked to an order.
12. Play guide downloads only for active members.
13. Confirmation email is received in an external inbox.
14. Email failure after subscription commit does not invalidate membership.
