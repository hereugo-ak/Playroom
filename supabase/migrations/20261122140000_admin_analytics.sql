-- ============================================================================
-- Playrooom — admin analytics foundation
-- ----------------------------------------------------------------------------
-- Adds low-level event tracking, admin audit logs and analytics views.
-- The admin password is NOT stored here. Create the Supabase Auth user first,
-- then this migration assigns the admin role by email.
--
-- Safe to re-run. Run after the Circle and order email migrations.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Low-level analytics events
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id            uuid primary key default gen_random_uuid(),
  event_id      text,
  session_id    text,
  user_id       uuid references auth.users (id) on delete set null,
  anon_id       text,
  event_name    text not null,
  page_path     text,
  referrer      text,
  product_id    text,
  order_id      text,
  plan_code     text,
  value         numeric(12, 2),
  currency      text not null default 'INR',
  properties    jsonb not null default '{}'::jsonb,
  device_type   text,
  browser       text,
  viewport      text,
  country       text,
  created_at    timestamptz not null default now(),
  constraint analytics_events_properties_object check (jsonb_typeof(properties) = 'object')
);

create unique index if not exists analytics_events_event_id_key
  on public.analytics_events (event_id)
  where event_id is not null;

create index if not exists analytics_events_created_idx
  on public.analytics_events (created_at desc);

create index if not exists analytics_events_name_created_idx
  on public.analytics_events (event_name, created_at desc);

create index if not exists analytics_events_user_created_idx
  on public.analytics_events (user_id, created_at desc)
  where user_id is not null;

create index if not exists analytics_events_session_created_idx
  on public.analytics_events (session_id, created_at desc)
  where session_id is not null;

create index if not exists analytics_events_product_created_idx
  on public.analytics_events (product_id, created_at desc)
  where product_id is not null;

create index if not exists analytics_events_order_idx
  on public.analytics_events (order_id)
  where order_id is not null;

-- ---------------------------------------------------------------------------
-- 2. Admin audit log
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint admin_audit_logs_detail_object check (jsonb_typeof(detail) = 'object')
);

create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Admin role assignment
-- ---------------------------------------------------------------------------
-- Create this user in Supabase Authentication first:
--   Authentication → Users → Add user → playrooom.project@gmail.com
-- This migration only assigns the role. No password is stored in SQL.
insert into public.user_roles (user_id, role)
select u.id, 'admin'
from auth.users u
where lower(u.email) = lower('playrooom.project@gmail.com')
on conflict (user_id) do update
set role = 'admin';

-- ---------------------------------------------------------------------------
-- 4. Helper views
-- ---------------------------------------------------------------------------
create or replace view public.analytics_events_daily as
select
  date_trunc('day', created_at) as day,
  event_name,
  count(*) as events,
  count(distinct coalesce(user_id::text, session_id, anon_id)) as unique_visitors,
  sum(coalesce(value, 0)) as value_total
from public.analytics_events
group by date_trunc('day', created_at), event_name;

create or replace view public.analytics_pages_daily as
select
  date_trunc('day', created_at) as day,
  coalesce(page_path, '(unknown)') as page_path,
  count(*) as views,
  count(distinct coalesce(user_id::text, session_id, anon_id)) as unique_viewers
from public.analytics_events
where event_name in ('page_view', 'admin_view')
group by date_trunc('day', created_at), coalesce(page_path, '(unknown)');

-- ---------------------------------------------------------------------------
-- 5. RLS and grants
-- ---------------------------------------------------------------------------
alter table public.analytics_events enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Browser clients do not read or write these tables directly. Events and audit
-- rows go through Vercel functions using the service role.
revoke all on public.analytics_events from anon, authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;

grant select, insert, update, delete on public.analytics_events to service_role;
grant select, insert on public.admin_audit_logs to service_role;

grant select on public.analytics_events_daily to service_role;
grant select on public.analytics_pages_daily to service_role;

-- ---------------------------------------------------------------------------
-- 6. Verification
-- ---------------------------------------------------------------------------
-- select count(*) from public.analytics_events;
-- select user_id, role from public.user_roles where role = 'admin';
-- select * from public.analytics_events_daily order by day desc limit 10;
