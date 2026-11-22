# Order confirmation email — setup

Premium transactional email for Playrooom orders, sent from Gmail SMTP with Nodemailer. Email is dispatched by a Vercel serverless function **after** the Supabase order has been committed. Nothing in the browser talks to SMTP.

## Files

- `api/orders.js` — trusted checkout endpoint + email dispatch
- `api/_lib/server.js` — Supabase admin client, pooled Nodemailer transport, helpers
- `emails/order-confirmation.js` — HTML + plain-text template
- `supabase/migrations/20261120120000_order_email_outbox.sql` — idempotency + outbox

## Database

Run the migrations in order:

1. `20261119090000_playrooom_accounts.sql`
2. `20261119110000_playrooom_orders.sql`
3. `20261120120000_order_email_outbox.sql`

The last migration adds:

- `orders.idempotency_key` and `orders.payment_status`
- `public.email_outbox` with status, provider message id, attempt count, last error and sent timestamp
- unique constraints for duplicate prevention

RLS stays enabled on the outbox and only the service role may write to it.

## Environment variables

Set these in **Vercel → Project Settings → Environment Variables** for Production (and Preview if you want to test there). Never use `VITE_` for server secrets.

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `playrooom.project@gmail.com` |
| `SMTP_PASS` | Gmail App Password |
| `SMTP_FROM` | `Playrooom <playrooom.project@gmail.com>` |
| `SITE_URL` | `https://playrooom.vercel.app/` (optional) |
| `SUPPORT_EMAIL` | `playrooom.project@gmail.com` (optional) |

Gmail needs 2-step verification and an **App Password**. Do not put the App Password in Supabase customer tables, the frontend, GitHub or email HTML.

## Checkout flow

Signed-in customers check out through `POST /api/orders`:

1. Browser sends product ids, quantities, personalisation, delivery choice, promo code, gift details, shipping fields and a client-generated idempotency key.
2. Function verifies the Supabase access token.
3. Function loads products from `js/data.js` and builds trusted price snapshots.
4. Function inserts the order into Supabase with the idempotency key.
5. Only after the insert succeeds does it create/claim an outbox row.
6. Nodemailer sends the branded confirmation.
7. Outbox status is updated to `sent` or `failed`.

Guest checkout continues with the existing localStorage demo flow and does not send email.

If the order insert succeeds but email sending fails, the API still returns the saved order with `email.status = 'failed'`. The order remains valid and can be retried without creating a duplicate.

## Idempotency

- The browser stores a checkout key in `sessionStorage` until the server accepts it.
- Repeats with the same key return the already-saved order.
- `email_outbox.idempotency_key` is unique, so a successful delivery is never repeated.
- Outbox rows are claimed with an atomic status update before sending.

## Template

`emails/order-confirmation.js` exports `renderOrderConfirmation(order, options)` returning `{ subject, html, text }`.

It uses:

- the official hosted Playrooom logo
- table-based email layout and inline CSS
- no JavaScript, no web fonts, no Grid/Flexbox
- a light-only colour scheme
- escaped user text and validated URLs
- real order values only

Subject lines:

- Confirmed/paid: `Your Playrooom order is on its way to becoming something wonderful — #[ORDER]`
- All other states: `Your Playrooom order is confirmed — #[ORDER]`

Payment status is never invented. The server accepts `cod` from the trusted payment-method label and otherwise records `demo_not_charged`; browser-supplied “paid” values are ignored.

## Playrooom Circle confirmation

`api/subscriptions/activate.js` uses the same transport and outbox pattern for
`subscription_confirmation` messages. The template is
`emails/subscription-confirmation.js`. It sends only after the subscription and
demo payment are committed to Supabase, and it clearly states that no real
payment was collected. Full details: [`CIRCLE.md`](./CIRCLE.md).

## Testing status

Completed locally:

- `npm run build` passes with the API, template and frontend changes.
- Template renderer was exercised with representative order data (single item, multiple items, discount, delivery fee, COD and prepaid states).
- No SMTP delivery has been verified yet: no SMTP credentials were available in this workspace.

Still required before production sign-off:

1. Send to an external inbox (not only the sending Gmail account).
2. Verify Gmail desktop and mobile rendering.
3. Verify Outlook and Apple Mail rendering.
4. Confirm SMTP auth failure writes `failed` to the outbox.
5. Confirm duplicate checkout requests produce one order and one email.
6. Confirm email failure after a committed order does not invalidate the order.

Do not treat this feature as delivery-verified until an external inbox has received the message.
