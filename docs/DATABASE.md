# Database schema & Row Level Security

Migrations:

1. [`20261119090000_playroom_accounts.sql`](../supabase/migrations/20261119090000_playroom_accounts.sql)
2. [`20261119110000_playroom_orders.sql`](../supabase/migrations/20261119110000_playroom_orders.sql)

Checkout still creates a clearly-labelled **demo** order — no payment, courier
or email is involved — but the receipt snapshot is stored against the signed-in
customer. Guest orders stay in `playroom-demo-v1-orders` until the visitor signs
in, at which point they are uploaded to the account. Each customer sees only
their own orders, returns, tracking numbers and receipts.

## Tables

### `public.profiles`

One row per `auth.users` row, created automatically by a trigger.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `references auth.users(id) on delete cascade` |
| `full_name` | `text` | default `''`, max 120 chars |
| `phone` | `text` | nullable, max 32 chars |
| `avatar_url` | `text` | nullable; populated from Google metadata |
| `created_at` / `updated_at` | `timestamptz` | `updated_at` maintained by trigger |

### `public.addresses`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid` | owner, cascade delete |
| `full_name` | `text` | required |
| `phone` | `text` | nullable |
| `address_line_1` | `text` | required |
| `address_line_2` | `text` | nullable |
| `city`, `state`, `postal_code`, `country` | `text` | city/postal/country required, country defaults to `India` |
| `is_default` | `boolean` | default `false` |
| `created_at` / `updated_at` | `timestamptz` | trigger-maintained |

A partial unique index `addresses_one_default_per_user` guarantees **one default
address per customer**. The client clears the previous default first; the index
is the final protection against races or a buggy client.

### `public.wishlist`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid` | owner, cascade delete |
| `product_id` | `text` | existing catalogue ids: `pl1` … `pl110` |
| `created_at` | `timestamptz` | default `now()` |

`product_id` has a format check (`^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`) and a
unique constraint on `(user_id, product_id)`. The app never stores product
names or prices here — those stay in `js/data.js`.

### `public.user_roles`

| Column | Type | Notes |
| --- | --- | --- |
| `user_id` | `uuid` PK | `references auth.users(id) on delete cascade` |
| `role` | `text` | `customer` or `admin` |
| `created_at` | `timestamptz` | default `now()` |

Customers can read their own role. Only the service role or the dashboard can
change it — there is no client insert/update/delete policy, so a signed-in user
cannot promote themselves.

### `public.orders`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `gen_random_uuid()` (internal row id) |
| `user_id` | `uuid` | owner, cascade delete |
| `order_id` | `text` | readable checkout id `PL-123456`, unique per user |
| `data` | `jsonb` | full receipt snapshot: customer, items, totals, gift, delivery, tracking, package, leaves |
| `status` | `text` | `order_placed` (demo) |
| `tracking_number` | `text` | 12-digit FedEx-style demo number, indexed per user |
| `total` | `numeric(12,2)` | order total snapshots |
| `created_at` / `updated_at` | `timestamptz` | trigger-maintained |

### `public.returns`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | internal row id |
| `user_id` | `uuid` | owner, cascade delete |
| `return_id` | `text` | `RT-1234`, unique per user |
| `order_id` | `text` | the `PL-…` order this return belongs to |
| `data` | `jsonb` | picked items, reason, mode and simulated step timeline |
| `created_at` / `updated_at` | `timestamptz` | trigger-maintained |

The typed columns exist for ownership, sorting and lookups; the JSONB snapshot
keeps the receipt exactly as checkout created it, so old orders never change
when catalogue prices change.

## Triggers

- `profiles_set_updated_at`, `addresses_set_updated_at`, `orders_set_updated_at`,
  `returns_set_updated_at` — set `updated_at = now()` on every update.
- `on_auth_user_created` → `public.handle_new_user()` — after any new row in
  `auth.users`, insert a `profiles` row (name and avatar taken from
  `raw_user_meta_data`, which is what Google and the register form provide) and
  a `user_roles` row with `customer`. `security definer` + `search_path = public`
  so the insert is not blocked by the new user’s empty RLS context.
- The migration backfills profiles and roles for accounts that existed before
  it was run.

## Row Level Security

RLS is enabled on all six tables. Every policy targets the `authenticated`
role and compares the owner column with `auth.uid()`:

| Table | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| `profiles` | own row | own row | own row | — |
| `addresses` | own rows | own rows | own rows | own rows |
| `wishlist` | own rows | own rows | — | own rows |
| `user_roles` | own row | — | — | — |
| `orders` | own rows | own rows | own rows | own rows |
| `returns` | own rows | own rows | own rows | own rows |

`anon` has no table privileges at all. The frontend never decides
authorisation; it only reflects what the database returns. There is deliberately
no `service_role` key anywhere in the repository.

RLS is **not** forced on these tables because the `security definer` trigger must
insert the first profile/role as the table owner. The owner is the migration /
dashboard role, not a browser role.

## Verifying

```sql
-- RLS on?
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','addresses','wishlist','user_roles','orders','returns');

-- Policies
select tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public' order by tablename, policyname;
```

To prove isolation, sign in as two different customers and check that each sees
only their own profile, addresses, wish-list rows, orders and returns. The
browser’s anon key cannot bypass these policies.
