-- ============================================================================
-- Playrooom — customer accounts
-- ----------------------------------------------------------------------------
-- Creates the customer-facing tables used by the storefront:
--
--   public.profiles    one row per auth user (name, phone, avatar)
--   public.addresses   the places a customer orders to
--   public.wishlist    saved product ids (existing catalogue ids: pl1 … pl110)
--   public.user_roles  'customer' | 'admin', for future staff tooling
--
-- Every table is protected with Row Level Security. A signed-in customer can
-- only read and write their own rows; nothing is authorised in the browser.
--
-- Run this once in Supabase → SQL Editor, or with the Supabase CLI:
--   supabase db push
-- It is written to be safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_full_name_length check (char_length(full_name) <= 120),
  constraint profiles_phone_length check (phone is null or char_length(phone) <= 32)
);

create table if not exists public.addresses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  full_name        text not null,
  phone            text,
  address_line_1   text not null,
  address_line_2   text,
  city             text not null,
  state            text,
  postal_code      text not null,
  country          text not null default 'India',
  is_default       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint addresses_full_name_length check (char_length(full_name) between 1 and 120),
  constraint addresses_line_1_length check (char_length(address_line_1) between 1 and 200),
  constraint addresses_city_length check (char_length(city) between 1 and 120),
  constraint addresses_postal_length check (char_length(postal_code) between 1 and 24),
  constraint addresses_country_length check (char_length(country) between 1 and 80)
);

create table if not exists public.wishlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Catalogue ids are currently pl1 … pl110. The constraint keeps arbitrary
  -- strings out of the table without coupling the database to a fixed list.
  product_id  text not null,
  created_at  timestamptz not null default now(),
  constraint wishlist_product_id_format check (product_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'),
  constraint wishlist_user_product_key unique (user_id, product_id)
);

create table if not exists public.user_roles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'customer',
  created_at  timestamptz not null default now(),
  constraint user_roles_role_check check (role in ('customer', 'admin'))
);

-- Only one default address per customer. The client clears the previous
-- default before setting a new one, and this index is the final guarantee.
create unique index if not exists addresses_one_default_per_user
  on public.addresses (user_id)
  where is_default;

create index if not exists addresses_user_created_idx
  on public.addresses (user_id, created_at desc);

create index if not exists wishlist_user_idx
  on public.wishlist (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 2. updated_at triggers
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

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.playroom_set_updated_at();

drop trigger if exists addresses_set_updated_at on public.addresses;
create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.playroom_set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Create the profile and role automatically for every new auth user
-- ---------------------------------------------------------------------------
-- Runs as the table owner, so it still works while RLS is enabled and while the
-- brand-new user has no rows of their own yet.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text;
begin
  meta_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    ''
  );

  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    left(meta_name, 120),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Existing accounts (created before this migration) get the same treatment.
insert into public.profiles (id, full_name, avatar_url)
select
  u.id,
  left(coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
    ''
  ), 120),
  nullif(u.raw_user_meta_data ->> 'avatar_url', '')
from auth.users u
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select u.id, 'customer'
from auth.users u
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles   enable row level security;
alter table public.addresses  enable row level security;
alter table public.wishlist   enable row level security;
alter table public.user_roles enable row level security;

-- Note: RLS is deliberately not FORCEd. The `security definer` trigger below
-- must be able to insert the first profile/role row as the table owner; with
-- FORCE RLS enabled that insert would be filtered out by the policies.

-- profiles ------------------------------------------------------------------
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- addresses -----------------------------------------------------------------
drop policy if exists "addresses: read own" on public.addresses;
create policy "addresses: read own"
  on public.addresses for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "addresses: insert own" on public.addresses;
create policy "addresses: insert own"
  on public.addresses for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "addresses: update own" on public.addresses;
create policy "addresses: update own"
  on public.addresses for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "addresses: delete own" on public.addresses;
create policy "addresses: delete own"
  on public.addresses for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- wishlist ------------------------------------------------------------------
drop policy if exists "wishlist: read own" on public.wishlist;
create policy "wishlist: read own"
  on public.wishlist for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "wishlist: insert own" on public.wishlist;
create policy "wishlist: insert own"
  on public.wishlist for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "wishlist: delete own" on public.wishlist;
create policy "wishlist: delete own"
  on public.wishlist for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- user_roles ----------------------------------------------------------------
-- Customers may read their own role. Only the service role / dashboard can
-- change it; there is deliberately no insert/update/delete policy.
drop policy if exists "user_roles: read own" on public.user_roles;
create policy "user_roles: read own"
  on public.user_roles for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------
-- Supabase grants these by default on new tables, but stating them makes the
-- migration portable and documents the intended surface. RLS still decides
-- which rows are visible.

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
grant select, insert, delete on public.wishlist to authenticated;
grant select on public.user_roles to authenticated;

revoke all on public.profiles   from anon;
revoke all on public.addresses  from anon;
revoke all on public.wishlist   from anon;
revoke all on public.user_roles from anon;

-- ---------------------------------------------------------------------------
-- 6. Useful checks (run manually)
-- ---------------------------------------------------------------------------
-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename in ('profiles','addresses','wishlist','user_roles');
-- select * from pg_policies where schemaname = 'public' order by tablename;
