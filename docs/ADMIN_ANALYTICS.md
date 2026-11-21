# Admin analytics

Secure admin-only analytics dashboard and low-level event tracking.

## Setup

1. In Supabase, create the Auth user:

```text
Authentication → Users → Add user
Email: playrooom.project@gmail.com
Password: choose a strong password in the Supabase dashboard
```

Do **not** put this password in the repo, frontend, email HTML, or a migration.

2. Run the migration:

```text
supabase/migrations/20261122140000_admin_analytics.sql
```

It creates the analytics tables and assigns the `admin` role to that email:

```sql
insert into public.user_roles (user_id, role)
select u.id, 'admin'
from auth.users u
where lower(u.email) = lower('playrooom.project@gmail.com')
on conflict (user_id) do update set role = 'admin';
```

If you created the user after running the migration, rerun the migration or that statement.

3. Sign in from:

```text
#/account/login?admin=1
```

The login page has a quiet **Admin access** link.

## Security

- The admin password is never stored in the repository.
- The frontend role check is only for routing.
- Every analytics/export endpoint verifies:
  - Supabase access token
  - user exists
  - `user_roles.role === 'admin'`
- Browser clients cannot read or write analytics tables directly.
- Events omit payment details, email addresses, phone numbers and addresses.

## Files

| File | Purpose |
| --- | --- |
| `api/admin/analytics.js` | Analytics data API |
| `api/admin/export.js` | CSV export API |
| `api/analytics/track.js` | Low-level event collector |
| `js/admin.js` | Dashboard UI |
| `css/admin-dashboard.css` | Premium editorial dashboard styling |
| `js/analytics.js` | Browser event beacon |
| `supabase/migrations/20261122140000_admin_analytics.sql` | Tables, views, RLS, admin role |

## Tracked events

Page and navigation:

- `page_view`
- `category_click`
- `filter_change`
- `sort_change`
- `search`

Product:

- `product_view`
- `quick_view`
- `compare_add`
- `wishlist_add`
- `wishlist_remove`
- `add_to_cart`
- `remove_from_cart`
- `qty_change`

Checkout and accounts:

- `checkout_start`
- `order_completed`
- `signup_start`
- `signup_complete`
- `login_start`
- `login_success`
- `login_failed`
- `logout`
- `otp_verify`
- `password_reset_request`

Support and membership:

- `membership_view`
- `membership_activate`
- `guide_download`
- `support_request`
- `chat_open`
- `audio_call_open`

Admin:

- `admin_view`
- `admin_export`
- `admin_refresh`

## Dashboard

Route:

```text
#/admin
```

Includes:

- revenue, orders, AOV and customers
- conversion proxy and cart-to-checkout rate
- Circle members, Circle revenue and MRR
- email delivery health
- support requests and returns
- revenue / orders / events / Circle trend charts
- checkout funnel
- payment method, payment status, delivery, city, device, browser, page and category breakdowns
- top products and top customers
- low-level event ledger
- recent orders
- 7 / 30 / 90 / 365-day ranges
- refresh and CSV export
- secure sign-out back to the admin login

## Testing checklist

1. Non-admin user cannot open `/admin`.
2. Admin login opens `/admin`.
3. Wrong password is rejected.
4. Dashboard loads after migration.
5. Range buttons update data.
6. Refresh works.
7. Event export downloads CSV.
8. Order export downloads CSV.
9. Sign out returns to login.
10. No password or sensitive field appears in event payloads.
