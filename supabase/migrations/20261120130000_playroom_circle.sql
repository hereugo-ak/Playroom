-- ============================================================================
-- Playroom Circle — demo membership system
-- ----------------------------------------------------------------------------
-- Adds plans, subscriptions, demo payment records and member service requests.
-- Membership is activated only by the server after the existing demo payment
-- flow is approved. No real payment provider or card data is involved.
--
-- Safe to re-run. Run after 20261120120000_order_email_outbox.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Plans
-- ---------------------------------------------------------------------------
create table if not exists public.subscription_plans (
  code        text primary key,
  name        text not null,
  price       numeric(10, 2) not null,
  interval    text not null,
  benefits    jsonb not null default '[]'::jsonb,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint subscription_plans_interval_check check (interval in ('month', 'year')),
  constraint subscription_plans_price_check check (price >= 0)
);

insert into public.subscription_plans (code, name, price, interval, benefits, active)
values
  (
    'circle_monthly',
    'Monthly Circle',
    499,
    'month',
    '["Free next-day delivery","Gift wrapping on us","First look at new toys","Priority care desk","Monthly play guide","Build with us","Endless customisation","Lifetime repair desk"]'::jsonb,
    true
  ),
  (
    'circle_yearly',
    'Yearly Circle',
    4499,
    'year',
    '["Free next-day delivery","Gift wrapping on us","First look at new toys","Priority care desk","Monthly play guide","Build with us","Endless customisation","Lifetime repair desk"]'::jsonb,
    true
  )
on conflict (code) do update
set name = excluded.name,
    price = excluded.price,
    interval = excluded.interval,
    benefits = excluded.benefits,
    active = true;

-- ---------------------------------------------------------------------------
-- 2. Subscriptions + demo payments
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  plan_code             text not null references public.subscription_plans (code),
  status                text not null default 'active',
  provider              text not null default 'demo',
  provider_reference    text,
  current_period_start  timestamptz not null default now(),
  current_period_end    timestamptz not null,
  canceled_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint subscriptions_status_check check (status in ('active', 'past_due', 'canceled', 'expired')),
  constraint subscriptions_provider_check check (provider in ('demo', 'razorpay', 'stripe')),
  constraint subscriptions_period_check check (current_period_end > current_period_start)
);

create table if not exists public.subscription_payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  subscription_id     uuid references public.subscriptions (id) on delete set null,
  plan_code           text not null references public.subscription_plans (code),
  amount              numeric(10, 2) not null,
  method              text not null,
  status              text not null default 'demo_approved',
  provider_reference  text not null,
  idempotency_key     text not null unique,
  created_at          timestamptz not null default now(),
  constraint subscription_payments_status_check check (status in ('demo_approved', 'paid', 'failed', 'refunded'))
);

create index if not exists subscriptions_user_status_end_idx
  on public.subscriptions (user_id, status, current_period_end desc);

create index if not exists subscription_payments_user_created_idx
  on public.subscription_payments (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Member service requests
-- ---------------------------------------------------------------------------
create table if not exists public.member_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null,
  title       text not null,
  details     text not null default '',
  order_id    text,
  priority    boolean not null default false,
  status      text not null default 'received',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint member_requests_kind_check check (kind in ('build', 'repair', 'support')),
  constraint member_requests_status_check check (status in ('received', 'reviewing', 'resolved', 'closed'))
);

create index if not exists member_requests_user_created_idx
  on public.member_requests (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.playroom_set_updated_at();

drop trigger if exists member_requests_set_updated_at on public.member_requests;
create trigger member_requests_set_updated_at
  before update on public.member_requests
  for each row execute function public.playroom_set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Email outbox type
-- ---------------------------------------------------------------------------
alter table public.email_outbox
  drop constraint if exists email_outbox_type_check;

alter table public.email_outbox
  add constraint email_outbox_type_check
  check (email_type in ('order_confirmation', 'payment_confirmation', 'subscription_confirmation'));

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.subscription_plans      enable row level security;
alter table public.subscriptions          enable row level security;
alter table public.subscription_payments   enable row level security;
alter table public.member_requests         enable row level security;

-- Plans are public reference data.
drop policy if exists "subscription plans: read active" on public.subscription_plans;
create policy "subscription plans: read active"
  on public.subscription_plans for select
  to anon, authenticated
  using (active);

-- Customers may read their own records. Writes happen only on the server.
drop policy if exists "subscriptions: read own" on public.subscriptions;
create policy "subscriptions: read own"
  on public.subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "subscription payments: read own" on public.subscription_payments;
create policy "subscription payments: read own"
  on public.subscription_payments for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "member requests: read own" on public.member_requests;
create policy "member requests: read own"
  on public.member_requests for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------------
grant select on public.subscription_plans to anon, authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.subscription_payments to authenticated;
grant select on public.member_requests to authenticated;

grant all on public.subscription_plans to service_role;
grant all on public.subscriptions to service_role;
grant all on public.subscription_payments to service_role;
grant all on public.member_requests to service_role;

-- ---------------------------------------------------------------------------
-- 8. Verification
-- ---------------------------------------------------------------------------
-- select code, name, price, interval from public.subscription_plans;
-- select user_id, plan_code, status, current_period_end from public.subscriptions;
-- select kind, priority, status, created_at from public.member_requests;
