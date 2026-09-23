-- SRIJAN Priority-1 database schema for Supabase/Postgres.
-- Run this in Supabase SQL Editor.
-- Then create your first user in Authentication > Users and promote that user's
-- profile role to super_admin with the final UPDATE statement below.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'customer' check (role in ('customer','admin','super_admin')),
  status text not null default 'active' check (status in ('active','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  emoji text default '✦',
  description text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  delivery text not null default '',
  features jsonb not null default '[]'::jsonb,
  image_url text,
  status text not null default 'published' check (status in ('draft','published','hidden')),
  visibility text not null default 'public' check (visibility in ('public','logged_in')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addons (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  emoji text default '✦',
  price numeric(12,2) not null default 0 check (price >= 0),
  delivery text not null default '',
  status text not null default 'published' check (status in ('draft','published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  enquiry_code text unique not null,
  user_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  business_name text not null,
  notes text default '',
  service_ids jsonb not null default '[]'::jsonb,
  addon_ids jsonb not null default '[]'::jsonb,
  service_snapshot jsonb not null default '[]'::jsonb,
  addon_snapshot jsonb not null default '[]'::jsonb,
  estimated_value numeric(12,2) not null default 0,
  status text not null default 'new' check (status in ('new','reviewing','quoted','converted','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null,
  user_id uuid references public.profiles(id) on delete set null,
  customer_email text not null,
  customer_name text not null,
  service_snapshot jsonb not null default '[]'::jsonb,
  addon_snapshot jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  payment_status text not null default 'created' check (payment_status in ('created','captured','failed','refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  project_code text unique not null,
  user_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  title text not null,
  status text not null default 'active' check (status in ('active','completed','paused','cancelled')),
  progress integer not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists enquiries_user_idx on public.enquiries(user_id);
create index if not exists orders_user_idx on public.orders(user_id);
create index if not exists projects_user_idx on public.projects(user_id);
create index if not exists notifications_user_idx on public.notifications(user_id);

-- New auth users automatically get a customer profile.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.email,''))
  on conflict (id) do update set email=excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','super_admin') and status='active');
$$;

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.addons enable row level security;
alter table public.enquiries enable row level security;
alter table public.orders enable row level security;
alter table public.projects enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select using (id=auth.uid() or public.is_admin());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists services_public_select on public.services;
create policy services_public_select on public.services for select using (status='published' and visibility='public' or public.is_admin());
drop policy if exists services_admin_write on public.services;
create policy services_admin_write on public.services for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists addons_public_select on public.addons;
create policy addons_public_select on public.addons for select using (status='published' or public.is_admin());
drop policy if exists addons_admin_write on public.addons;
create policy addons_admin_write on public.addons for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists enquiries_user_select on public.enquiries;
create policy enquiries_user_select on public.enquiries for select using (user_id=auth.uid() or public.is_admin());
drop policy if exists enquiries_user_insert on public.enquiries;
create policy enquiries_user_insert on public.enquiries for insert with check (user_id=auth.uid() or user_id is null);
drop policy if exists enquiries_admin_update on public.enquiries;
create policy enquiries_admin_update on public.enquiries for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists orders_user_select on public.orders;
create policy orders_user_select on public.orders for select using (user_id=auth.uid() or public.is_admin());
drop policy if exists orders_admin_write on public.orders;
create policy orders_admin_write on public.orders for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists projects_user_select on public.projects;
create policy projects_user_select on public.projects for select using (user_id=auth.uid() or public.is_admin());
drop policy if exists projects_admin_write on public.projects;
create policy projects_admin_write on public.projects for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists notifications_user_select on public.notifications;
create policy notifications_user_select on public.notifications for select using (user_id=auth.uid() or public.is_admin());
drop policy if exists notifications_user_update on public.notifications;
create policy notifications_user_update on public.notifications for update using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());

-- After creating your first account, run:
-- update public.profiles set role='super_admin' where email='YOUR_ADMIN_EMAIL';
