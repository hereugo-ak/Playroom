-- ============================================================================
-- Playrooom — customer orders & returns
-- ----------------------------------------------------------------------------
-- Checkout still creates a clearly-labelled DEMO order (no payment is taken),
-- but the snapshot is now stored against the signed-in customer instead of
-- living only in localStorage. Each order keeps its receipt, line items,
-- tracking number, delivery promise and gift details in a JSONB snapshot, with
-- a few indexed columns for history and lookups.
--
-- RLS guarantees that one customer can never read another customer's orders or
-- returns. Nothing here is authorised in the browser.
--
-- Safe to re-run. Run after 20261119090000_playrooom_accounts.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. updated_at helper (shared with the accounts migration)
-- ---------------------------------------------------------------------------
create or replace function public.playroom_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  -- Readable demo id from checkout: PL-123456. Unique per customer.
  order_id         text not null,
  -- Full, immutable snapshot: customer, items, totals, gift, delivery,
  -- tracking number, package metadata, payment status and earned leaves.
  data             jsonb not null default '{}'::jsonb,
  status           text not null default 'order_placed',
  tracking_number  text,
  total            numeric(12, 2) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint orders_user_order_key unique (user_id, order_id),
  constraint orders_order_id_format check (order_id ~ '^PL-[0-9]{6}$'),
  constraint orders_data_object check (jsonb_typeof(data) = 'object')
);

create table if not exists public.returns (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  -- Demo return id from the returns desk: RT-1234. Unique per customer.
  return_id        text not null,
  order_id         text not null,
  -- Snapshot: picked items, reason, mode and the simulated step timeline.
  data             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint returns_user_return_key unique (user_id, return_id),
  constraint returns_return_id_format check (return_id ~ '^RT-[0-9]{4}$'),
  constraint returns_order_id_format check (order_id ~ '^PL-[0-9]{6}$'),
  constraint returns_data_object check (jsonb_typeof(data) = 'object')
);

create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);

create index if not exists orders_user_tracking_idx
  on public.orders (user_id, tracking_number)
  where tracking_number is not null;

create index if not exists returns_user_order_idx
  on public.returns (user_id, order_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.playroom_set_updated_at();

drop trigger if exists returns_set_updated_at on public.returns;
create trigger returns_set_updated_at
  before update on public.returns
  for each row execute function public.playroom_set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.orders  enable row level security;
alter table public.returns enable row level security;

-- orders --------------------------------------------------------------------
drop policy if exists "orders: read own" on public.orders;
create policy "orders: read own"
  on public.orders for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "orders: insert own" on public.orders;
create policy "orders: insert own"
  on public.orders for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "orders: update own" on public.orders;
create policy "orders: update own"
  on public.orders for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "orders: delete own" on public.orders;
create policy "orders: delete own"
  on public.orders for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- returns -------------------------------------------------------------------
drop policy if exists "returns: read own" on public.returns;
create policy "returns: read own"
  on public.returns for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "returns: insert own" on public.returns;
create policy "returns: insert own"
  on public.returns for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "returns: update own" on public.returns;
create policy "returns: update own"
  on public.returns for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "returns: delete own" on public.returns;
create policy "returns: delete own"
  on public.returns for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.orders  to authenticated;
grant select, insert, update, delete on public.returns to authenticated;

revoke all on public.orders  from anon;
revoke all on public.returns from anon;

-- ---------------------------------------------------------------------------
-- 6. Useful checks (run manually)
-- ---------------------------------------------------------------------------
-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename in ('orders','returns');
-- select * from pg_policies where schemaname = 'public'
--   and tablename in ('orders','returns') order by tablename, policyname;
-- select order_id, tracking_number, total, created_at from public.orders
--   order by created_at desc limit 10;
