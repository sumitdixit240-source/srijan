-- SRIJAN production hardening + platform expansion.
-- Run AFTER supabase-schema.sql.
-- Review Supabase Security Advisor after running this migration.

create extension if not exists pgcrypto;

-- Common updated_at trigger.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;

-- Additional platform tables. They are intentionally separated from auth.users.
create table if not exists public.service_images (
  id uuid primary key default gen_random_uuid(), service_id uuid not null references public.services(id) on delete cascade,
  image_url text not null, alt_text text not null default '', sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.service_addons (
  service_id uuid not null references public.services(id) on delete cascade,
  addon_id uuid not null references public.addons(id) on delete cascade,
  primary key(service_id,addon_id)
);
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(), quotation_code text unique not null,
  enquiry_id uuid references public.enquiries(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  title text not null default '', subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0, total numeric(12,2) not null default 0,
  status text not null default 'draft' check(status in ('draft','sent','approved','rejected','expired')),
  valid_until timestamptz, notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(), quotation_id uuid not null references public.quotations(id) on delete cascade,
  item_type text not null check(item_type in ('service','addon','custom')), item_name text not null,
  quantity numeric(10,2) not null default 1, unit_price numeric(12,2) not null default 0, total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  item_type text not null check(item_type in ('service','addon')), item_name text not null,
  quantity numeric(10,2) not null default 1, unit_price numeric(12,2) not null default 0, total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  title text not null, description text not null default '', status text not null default 'pending' check(status in ('pending','active','completed','blocked')),
  progress integer not null default 0 check(progress between 0 and 100), due_at timestamptz, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade, title text not null, document_type text not null,
  storage_path text not null, mime_type text not null default 'application/octet-stream', created_at timestamptz not null default now()
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null, body text not null, created_at timestamptz not null default now()
);
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(), ticket_code text unique not null, user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null, category text not null default 'general', priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
  status text not null default 'open' check(status in ('open','in_progress','resolved','closed')), message text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null, rating integer not null check(rating between 1 and 5),
  review text not null default '', status text not null default 'pending' check(status in ('pending','approved','hidden')), created_at timestamptz not null default now()
);
create table if not exists public.activity_logs (
  id bigint generated by default as identity primary key, actor_id uuid references public.profiles(id) on delete set null,
  action text not null, entity_type text not null, entity_id text, metadata jsonb not null default '{}'::jsonb, ip_hint text, created_at timestamptz not null default now()
);

-- Useful indexes.
create index if not exists service_images_service_idx on public.service_images(service_id,sort_order);
create index if not exists service_addons_addon_idx on public.service_addons(addon_id);
create index if not exists quotations_user_idx on public.quotations(user_id,created_at desc);
create index if not exists quotation_items_quote_idx on public.quotation_items(quotation_id);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists milestone_project_idx on public.project_milestones(project_id,sort_order);
create index if not exists documents_user_idx on public.documents(user_id,created_at desc);
create index if not exists documents_project_idx on public.documents(project_id,created_at desc);
create index if not exists messages_project_idx on public.messages(project_id,created_at);
create index if not exists support_user_idx on public.support_tickets(user_id,created_at desc);
create index if not exists reviews_project_idx on public.reviews(project_id);
create index if not exists activity_entity_idx on public.activity_logs(entity_type,entity_id,created_at desc);

-- Updated-at triggers.
do $$ declare t text; begin
  foreach t in array array['profiles','services','addons','enquiries','orders','projects','quotations','project_milestones','support_tickets'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I',t,t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',t,t);
  end loop;
end $$;

-- RLS on every application table exposed through the Data API.
alter table public.service_images enable row level security;
alter table public.service_addons enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.order_items enable row level security;
alter table public.project_milestones enable row level security;
alter table public.documents enable row level security;
alter table public.messages enable row level security;
alter table public.support_tickets enable row level security;
alter table public.reviews enable row level security;
alter table public.activity_logs enable row level security;

-- Remove direct client writes from sensitive records; server APIs use the Supabase secret key.
revoke insert, update, delete on public.enquiries from anon, authenticated;
revoke insert, update, delete on public.orders from anon, authenticated;
revoke insert, update, delete on public.projects from anon, authenticated;
revoke insert, update, delete on public.quotations from anon, authenticated;
revoke insert, update, delete on public.quotation_items from anon, authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, update, delete on public.activity_logs from anon, authenticated;

-- Safe profile policy: customers may see their own profile; only admins can change role/status.
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Service media follows the service's public/admin visibility.
drop policy if exists service_images_select on public.service_images;
create policy service_images_select on public.service_images for select using (
  public.is_admin() or exists(select 1 from public.services s where s.id=service_id and s.status='published' and s.visibility='public')
);
drop policy if exists service_images_admin on public.service_images;
create policy service_images_admin on public.service_images for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists service_addons_select on public.service_addons;
create policy service_addons_select on public.service_addons for select using (
  public.is_admin() or exists(select 1 from public.services s where s.id=service_id and s.status='published' and s.visibility='public')
);
drop policy if exists service_addons_admin on public.service_addons;
create policy service_addons_admin on public.service_addons for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Customer-owned data.
drop policy if exists quotations_user_select on public.quotations;
create policy quotations_user_select on public.quotations for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists quotation_items_user_select on public.quotation_items;
create policy quotation_items_user_select on public.quotation_items for select to authenticated using(exists(select 1 from public.quotations q where q.id=quotation_id and (q.user_id=auth.uid() or public.is_admin())));
drop policy if exists order_items_user_select on public.order_items;
create policy order_items_user_select on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_admin())));
drop policy if exists milestone_user_select on public.project_milestones;
create policy milestone_user_select on public.project_milestones for select to authenticated using(exists(select 1 from public.projects p where p.id=project_id and (p.user_id=auth.uid() or public.is_admin())));
drop policy if exists milestone_admin_write on public.project_milestones;
create policy milestone_admin_write on public.project_milestones for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists documents_user_select on public.documents;
create policy documents_user_select on public.documents for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists documents_admin_write on public.documents;
create policy documents_admin_write on public.documents for all to authenticated using(public.is_admin()) with check(public.is_admin());

drop policy if exists messages_participant_select on public.messages;
create policy messages_participant_select on public.messages for select to authenticated using(public.is_admin() or exists(select 1 from public.projects p where p.id=project_id and p.user_id=auth.uid()));
drop policy if exists messages_participant_insert on public.messages;
create policy messages_participant_insert on public.messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.projects p where p.id=project_id and p.user_id=auth.uid()));
drop policy if exists messages_admin_write on public.messages;
create policy messages_admin_write on public.messages for update,delete to authenticated using(public.is_admin()) with check(public.is_admin());

-- Support tickets belong to the customer who created them; admin can manage.
drop policy if exists support_user_select on public.support_tickets;
create policy support_user_select on public.support_tickets for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists support_user_insert on public.support_tickets;
create policy support_user_insert on public.support_tickets for insert to authenticated with check(user_id=auth.uid());
drop policy if exists support_admin_write on public.support_tickets;
create policy support_admin_write on public.support_tickets for update,delete to authenticated using(public.is_admin()) with check(public.is_admin());

-- Reviews: customers can submit for their own project; public sees only approved reviews.
drop policy if exists reviews_public_select on public.reviews;
create policy reviews_public_select on public.reviews for select using(status='approved' or user_id=auth.uid() or public.is_admin());
drop policy if exists reviews_user_insert on public.reviews;
create policy reviews_user_insert on public.reviews for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.projects p where p.id=project_id and p.user_id=auth.uid()));
drop policy if exists reviews_admin_write on public.reviews;
create policy reviews_admin_write on public.reviews for update,delete to authenticated using(public.is_admin()) with check(public.is_admin());

-- Activity logs are private to administrators. Server-side code should write these with the secret key.
drop policy if exists activity_admin_select on public.activity_logs;
create policy activity_admin_select on public.activity_logs for select to authenticated using(public.is_admin());

-- Admin service/add-on policies are explicit.
drop policy if exists services_public_select on public.services;
create policy services_public_select on public.services for select using((status='published' and visibility='public') or public.is_admin());
drop policy if exists services_admin_write on public.services;
create policy services_admin_write on public.services for all to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists addons_public_select on public.addons;
create policy addons_public_select on public.addons for select using(status='published' or public.is_admin());
drop policy if exists addons_admin_write on public.addons;
create policy addons_admin_write on public.addons for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Customer reads remain available for the dashboard.
drop policy if exists orders_user_select on public.orders;
create policy orders_user_select on public.orders for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists projects_user_select on public.projects;
create policy projects_user_select on public.projects for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists notifications_user_select on public.notifications;
create policy notifications_user_select on public.notifications for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists notifications_user_update on public.notifications;
create policy notifications_user_update on public.notifications for update to authenticated using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());

-- Grants: only the roles that actually need access get it.
grant select on public.services,public.addons,public.service_images,public.service_addons to anon,authenticated;
grant select on public.profiles,public.enquiries,public.orders,public.projects,public.notifications,public.quotations,public.quotation_items,public.order_items,public.project_milestones,public.documents,public.messages,public.support_tickets,public.reviews,public.activity_logs to authenticated;
grant insert on public.support_tickets,public.reviews to authenticated;
grant update on public.profiles,public.notifications,public.messages,public.reviews to authenticated;
grant all on all tables in schema public to service_role;

-- RLS policies call is_admin(), so authenticated must be able to execute this narrowly scoped helper.
-- The helper returns only a boolean and uses auth.uid(); it does not expose table data.
grant execute on function public.is_admin() to authenticated;

-- One active project per paid order prevents duplicate project creation if a payment callback is retried.
create unique index if not exists projects_order_unique on public.projects(order_id) where order_id is not null;

-- Admin UI updates enquiry status directly; RLS still limits this to admins.
grant update on public.enquiries to authenticated;
