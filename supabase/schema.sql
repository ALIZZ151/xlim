create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  role text not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text default 'Produk',
  price text not null,
  description text default '',
  features jsonb not null default '[]'::jsonb,
  badge text default '',
  icon text default 'ri-server-fill',
  theme text default 'ocean',
  is_popular boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text,
  product_name text not null,
  price text not null,
  product_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'waiting_payment', 'processing', 'active', 'done', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'waiting_confirmation', 'paid', 'refunded', 'cancelled')),
  customer_note text default '',
  admin_note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_orders_updated_at on public.orders;
create trigger set_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "profiles select own" on public.profiles;
create policy "profiles select own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "public can read active products" on public.products;
create policy "public can read active products"
on public.products
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "customers can read own orders" on public.orders;
create policy "customers can read own orders"
on public.orders
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "customers can create own orders" on public.orders;
create policy "customers can create own orders"
on public.orders
for insert
to authenticated
with check (auth.uid() = user_id);

create or replace view public.orders_admin_view as
select
  o.*,
  p.email as user_email,
  p.full_name as user_full_name,
  p.avatar_url as user_avatar_url
from public.orders o
left join public.profiles p on p.id = o.user_id;

revoke all on public.orders_admin_view from anon, authenticated;
grant select on public.orders_admin_view to service_role;

insert into public.products (name, category, price, description, features, badge, icon, theme, is_popular, is_active, sort_order)
values
('Panel Bot Basic', 'Starter', 'Rp 5.000', 'Cocok untuk bot WhatsApp, bot Discord kecil, dan script ringan.', '["Setup cepat", "Panel siap deploy", "Support Node.js", "Cocok untuk pemula"]'::jsonb, 'Starter', 'ri-robot-2-line', 'ocean', false, true, 1),
('Private Node', 'Best Seller', 'Rp 15.000', 'Performa lebih stabil untuk bot aktif, API, backend, dan project yang butuh uptime.', '["Resource lebih lega", "Server lebih stabil", "Cocok untuk bot rame", "Support aktif"]'::jsonb, 'Populer', 'ri-vip-crown-fill', 'yellow', true, true, 2),
('VPS Cloud Custom', 'Developer', 'Chat Admin', 'Untuk developer yang butuh akses server penuh, deployment backend, bot, dan tools custom.', '["Full akses server", "OS sesuai stok", "Cocok untuk backend", "Spek bisa request"]'::jsonb, 'Custom', 'ri-server-fill', 'cyan', false, true, 3)
on conflict (name) do update set
  category = excluded.category,
  price = excluded.price,
  description = excluded.description,
  features = excluded.features,
  badge = excluded.badge,
  icon = excluded.icon,
  theme = excluded.theme,
  is_popular = excluded.is_popular,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();
