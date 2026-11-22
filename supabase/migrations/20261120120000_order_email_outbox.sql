-- ============================================================================
-- Playrooom — server-owned checkout + email outbox
-- ----------------------------------------------------------------------------
-- Adds server-side idempotency to orders and a durable outbox for transactional
-- email. The browser never sends email directly and the outbox is written only
-- after an order has been committed successfully.
--
-- Safe to re-run. Run after 20261119110000_playrooom_orders.sql.
-- ============================================================================

-- The API sends a client-generated key so a refresh/retry cannot create a
-- second order or a second confirmation email.
alter table public.orders
  add column if not exists idempotency_key text,
  add column if not exists payment_status text not null default 'demo_not_charged';

create unique index if not exists orders_idempotency_key_key
  on public.orders (idempotency_key)
  where idempotency_key is not null;

create index if not exists orders_payment_status_idx
  on public.orders (payment_status);

-- ---------------------------------------------------------------------------
-- Email outbox
-- ---------------------------------------------------------------------------
create table if not exists public.email_outbox (
  id                  uuid primary key default gen_random_uuid(),
  order_id            text not null,
  user_id             uuid references auth.users (id) on delete set null,
  recipient           text not null,
  email_type          text not null,
  status              text not null default 'pending',
  provider_message_id text,
  attempt_count       integer not null default 0,
  last_error          text,
  idempotency_key     text not null,
  payload             jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  sent_at             timestamptz,
  constraint email_outbox_status_check
    check (status in ('pending', 'processing', 'sent', 'failed')),
  constraint email_outbox_type_check
    check (email_type in ('order_confirmation', 'payment_confirmation')),
  constraint email_outbox_idempotency_key unique (idempotency_key)
);

create index if not exists email_outbox_status_created_idx
  on public.email_outbox (status, created_at desc);

create index if not exists email_outbox_order_idx
  on public.email_outbox (order_id, email_type);

-- Reuse the shared updated_at trigger from the earlier migrations.
drop trigger if exists email_outbox_set_updated_at on public.email_outbox;
create trigger email_outbox_set_updated_at
  before update on public.email_outbox
  for each row execute function public.playroom_set_updated_at();

-- No browser role may read or write the outbox. The serverless function uses
-- the service role, which bypasses RLS; RLS is still enabled as a guardrail.
alter table public.email_outbox enable row level security;

revoke all on public.email_outbox from anon, authenticated;
grant select, insert, update on public.email_outbox to service_role;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
-- select column_name, data_type from information_schema.columns
--   where table_name = 'orders' and column_name in ('idempotency_key','payment_status');
-- select status, count(*) from public.email_outbox group by status;
