-- Supabase/Postgres schema for Food Palace ordering
create extension if not exists pgcrypto;

create table if not exists public.daily_order_counters (
  order_date date primary key,
  last_order_no integer not null default 0
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_date date not null,
  order_no integer not null,
  booking_type text not null check (booking_type in ('advance', 'stall')),
  status text not null default 'placed',
  subtotal numeric(12,2) not null,
  tax numeric(12,2) not null,
  total numeric(12,2) not null,
  created_at timestamptz not null default now(),
  unique (order_date, order_no)
);

-- Ensure all new columns exist if table was already created
alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;
alter table public.orders add column if not exists utr text;
alter table public.orders add column if not exists arrival_time text;

create table if not exists public.order_items (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  item_id text not null,
  item_name text not null,
  qty integer not null check (qty > 0),
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  note text,
  image_url text,
  created_at timestamptz not null default now()
);

create or replace function public.create_order_with_items(
  p_booking_type text,
  p_items jsonb,
  p_subtotal numeric,
  p_tax numeric,
  p_total numeric,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_utr text default null,
  p_arrival_time text default null
)
returns table(order_id uuid, order_no integer, order_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_date date := timezone('Asia/Kolkata', now())::date;
  v_order_no integer;
  v_order_id uuid;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'p_items must be a non-empty JSON array';
  end if;

  insert into public.daily_order_counters (order_date, last_order_no)
  values (v_order_date, 1)
  on conflict (order_date)
  do update set last_order_no = public.daily_order_counters.last_order_no + 1
  returning last_order_no into v_order_no;

  insert into public.orders (order_date, order_no, booking_type, subtotal, tax, total, customer_name, customer_phone, utr, arrival_time)
  values (v_order_date, v_order_no, p_booking_type, p_subtotal, p_tax, p_total, p_customer_name, p_customer_phone, p_utr, p_arrival_time)
  returning id into v_order_id;

  insert into public.order_items (order_id, item_id, item_name, qty, unit_price, line_total, note, image_url)
  select
    v_order_id,
    coalesce(elem->>'id', ''),
    coalesce(elem->>'name', ''),
    greatest((elem->>'qty')::integer, 1),
    coalesce((elem->>'price')::numeric, 0),
    coalesce((elem->>'price')::numeric, 0) * greatest((elem->>'qty')::integer, 1),
    nullif(elem->>'note', ''),
    nullif(elem->>'image', '')
  from jsonb_array_elements(p_items) as elem;

  return query
  select v_order_id, v_order_no, v_order_date;
end;
$$;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Basic public policies for anon/app users. Tighten for production auth roles.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_select_all'
  ) then
    create policy orders_select_all on public.orders for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='order_items' and policyname='order_items_select_all'
  ) then
    create policy order_items_select_all on public.order_items for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='orders' and policyname='orders_insert_all'
  ) then
    create policy orders_insert_all on public.orders for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='order_items' and policyname='order_items_insert_all'
  ) then
    create policy order_items_insert_all on public.order_items for insert with check (true);
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert on public.orders to anon, authenticated;
grant select, insert on public.order_items to anon, authenticated;
grant usage, select on sequence public.order_items_id_seq to anon, authenticated;
grant execute on function public.create_order_with_items(text, jsonb, numeric, numeric, numeric, text, text, text, text) to anon, authenticated;
