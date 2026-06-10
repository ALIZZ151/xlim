-- XLIMSTORE Supabase schema for full Vercel deployment.
-- Run this in Supabase SQL Editor, then run supabase/seed.sql.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text,
  price integer not null check (price >= 0),
  price_label text,
  description text,
  features jsonb default '[]'::jsonb,
  image_url text,
  status text not null default 'ready' check (status in ('ready', 'soldout', 'preorder', 'inactive')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_active_sort_idx on public.products (is_active, sort_order, created_at desc);
create index if not exists products_category_idx on public.products (category);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  name text,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  avatar_url text,
  ip_hash text,
  user_agent_hash text,
  is_visible boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ratings_visible_created_idx on public.ratings (is_visible, created_at desc);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  detail jsonb default '{}'::jsonb,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_created_idx on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_action_idx on public.admin_audit_logs (action);

create table if not exists public.contact_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  amount integer,
  contact_method text not null check (contact_method in ('whatsapp', 'telegram')),
  customer_note text,
  message text,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now()
);

create index if not exists contact_orders_created_idx on public.contact_orders (created_at desc);
create index if not exists contact_orders_product_idx on public.contact_orders (product_id);

create table if not exists public.security_rate_limits (
  key text primary key,
  attempts integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists security_rate_limits_blocked_idx on public.security_rate_limits (blocked_until);

create table if not exists public.admin_request_nonces (
  nonce_hash text primary key,
  session_id_hash text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_request_nonces_expires_idx on public.admin_request_nonces (expires_at);

-- RLS: public can only read visible public data. Mutations go through Vercel API using service role.
alter table public.products enable row level security;
alter table public.ratings enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.contact_orders enable row level security;
alter table public.security_rate_limits enable row level security;
alter table public.admin_request_nonces enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname = 'Public read active products') then
    create policy "Public read active products" on public.products for select using (is_active = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'ratings' and policyname = 'Public read visible ratings') then
    create policy "Public read visible ratings" on public.ratings for select using (is_visible = true);
  end if;
end $$;

-- Storage bucket for admin product uploads. Keep this bucket public so image_url can be used directly by the storefront.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public product image read') then
    create policy "Public product image read" on storage.objects for select using (bucket_id = 'product-images');
  end if;
end $$;

-- Pakasir automated payment flow tables.
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_id text unique not null,
  product_id uuid references public.products(id) on delete set null,
  product_name text,
  customer_name text not null,
  customer_contact text,
  customer_note text,
  amount integer not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled', 'failed')),
  source text not null default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  expired_at timestamptz
);

create index if not exists orders_order_id_idx on public.orders (order_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_idx on public.orders (created_at desc);
create index if not exists orders_product_idx on public.orders (product_id);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(order_id) on delete cascade,
  provider text not null default 'pakasir',
  provider_project text,
  payment_method text,
  amount integer not null check (amount >= 0),
  fee integer not null default 0 check (fee >= 0),
  total_payment integer not null check (total_payment >= 0),
  payment_number text,
  payment_url text,
  status text not null default 'pending',
  expired_at timestamptz,
  completed_at timestamptz,
  raw_response jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_order_provider_unique unique (order_id, provider)
);

create index if not exists payments_order_id_idx on public.payments (order_id);
create index if not exists payments_status_idx on public.payments (status);
create index if not exists payments_created_idx on public.payments (created_at desc);
create index if not exists payments_provider_idx on public.payments (provider, provider_project);

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create table if not exists public.payment_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'pakasir',
  order_id text,
  amount integer,
  project text,
  status text,
  payment_method text,
  completed_at timestamptz,
  is_valid boolean not null default false,
  validation_message text,
  raw_payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payment_webhook_logs_order_id_idx on public.payment_webhook_logs (order_id);
create index if not exists payment_webhook_logs_status_idx on public.payment_webhook_logs (status);
create index if not exists payment_webhook_logs_created_idx on public.payment_webhook_logs (created_at desc);
create index if not exists payment_webhook_logs_valid_idx on public.payment_webhook_logs (is_valid);

alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.payment_webhook_logs enable row level security;

-- No public select/insert/update/delete policies are added for orders, payments, or webhook logs.
-- These tables are intentionally accessed only through the Vercel API using SUPABASE_SERVICE_ROLE_KEY.
