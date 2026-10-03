-- Initial online data model for Teff Exclusivo.
-- This migration prepares shared data for products, customers, orders,
-- payments, stock, Pix settings, and closing cycles.

create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'cliente');
create type public.cart_status as enum ('ABERTO', 'FINALIZADO', 'CANCELADO');
create type public.order_status as enum ('CONFIRMADO', 'ENTREGUE', 'CANCELADO', 'PAGO', 'FECHADO');
create type public.payment_status as enum ('PENDENTE', 'PAGO', 'CANCELADO');
create type public.closing_status as enum ('ABERTO', 'FECHADO');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'cliente',
  full_name text not null default '',
  username text,
  whatsapp text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_unique_idx
  on public.profiles (lower(username))
  where username is not null and username <> '';

create table public.app_settings (
  id boolean primary key default true,
  store_name text not null default 'Teff Exclusivo',
  pix_key text not null default '',
  pix_holder text not null default '',
  payment_due_day smallint not null default 7 check (payment_due_day between 1 and 31),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint app_settings_single_row check (id)
);

insert into public.app_settings (id, store_name, pix_key, pix_holder, payment_due_day)
values (true, 'Teff Exclusivo', '', '', 7);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  description text not null default '',
  category text not null default 'Vitrine',
  image_url text,
  price numeric(12,2) not null check (price >= 0),
  cost numeric(12,2) not null default 0 check (cost >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  is_active boolean not null default true,
  is_hidden boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index products_sku_unique_idx
  on public.products (lower(sku))
  where sku is not null and sku <> '';

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  status public.cart_status not null default 'ABERTO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalized_at timestamptz
);

create unique index carts_one_open_per_customer_idx
  on public.carts (customer_id)
  where status = 'ABERTO';

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, product_id)
);

create sequence public.order_code_seq start with 1 increment by 1;

create table public.closing_cycles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  starts_on date not null,
  ends_on date not null,
  status public.closing_status not null default 'ABERTO',
  total_orders integer not null default 0,
  total_amount numeric(12,2) not null default 0,
  total_paid numeric(12,2) not null default 0,
  total_profit numeric(12,2) not null default 0,
  pdf_exported_at timestamptz,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check (ends_on >= starts_on)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  cycle_id uuid references public.closing_cycles(id) on delete set null,
  status public.order_status not null default 'CONFIRMADO',
  payment_status public.payment_status not null default 'PENDENTE',
  total_amount numeric(12,2) not null default 0,
  cost_amount numeric(12,2) not null default 0,
  profit_amount numeric(12,2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz not null default now(),
  delivered_at timestamptz,
  canceled_at timestamptz,
  cancel_reason text,
  paid_at timestamptz,
  closed_at timestamptz
);

create index orders_customer_status_idx on public.orders (customer_id, status, payment_status);
create index orders_cycle_idx on public.orders (cycle_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_image_url text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  subtotal numeric(12,2) generated always as (quantity * unit_price) stored,
  cost_subtotal numeric(12,2) generated always as (quantity * unit_cost) stored,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  cycle_id uuid references public.closing_cycles(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  method text not null default 'PIX',
  status public.payment_status not null default 'PENDENTE',
  pix_key_snapshot text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  canceled_at timestamptz
);

create table public.payment_orders (
  payment_id uuid not null references public.payments(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  primary key (payment_id, order_id)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  movement_type text not null,
  quantity_delta integer not null,
  reason text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger carts_set_updated_at
before update on public.carts
for each row execute function public.set_updated_at();

create trigger cart_items_set_updated_at
before update on public.cart_items
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, username, whatsapp)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(new.raw_user_meta_data ->> 'whatsapp', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

create or replace function public.generate_order_code()
returns trigger
language plpgsql
as $$
begin
  if new.order_code is null or new.order_code = '' then
    new.order_code := 'TB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger orders_generate_order_code
before insert on public.orders
for each row execute function public.generate_order_code();

create or replace function public.recalculate_order_totals(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(12,2);
  v_cost numeric(12,2);
begin
  select
    coalesce(sum(subtotal), 0),
    coalesce(sum(cost_subtotal), 0)
  into v_total, v_cost
  from public.order_items
  where order_id = p_order_id;

  update public.orders
  set total_amount = v_total,
      cost_amount = v_cost,
      profit_amount = v_total - v_cost
  where id = p_order_id;
end;
$$;

create or replace function public.order_items_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_order_totals(coalesce(new.order_id, old.order_id));
  return coalesce(new, old);
end;
$$;

create trigger order_items_recalculate_after_insert
after insert on public.order_items
for each row execute function public.order_items_after_change();

create trigger order_items_recalculate_after_update
after update on public.order_items
for each row execute function public.order_items_after_change();

create trigger order_items_recalculate_after_delete
after delete on public.order_items
for each row execute function public.order_items_after_change();

create or replace function public.adjust_stock_for_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.order_status;
  v_delta integer;
begin
  select status into v_status
  from public.orders
  where id = coalesce(new.order_id, old.order_id);

  if v_status <> 'CONFIRMADO' then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    v_delta := -new.quantity;
    update public.products
    set stock_quantity = stock_quantity + v_delta
    where id = new.product_id
      and stock_quantity + v_delta >= 0;

    if not found then
      raise exception 'Estoque insuficiente para o produto %', new.product_id;
    end if;

    insert into public.stock_movements (product_id, order_id, movement_type, quantity_delta, reason, created_by)
    values (new.product_id, new.order_id, 'SAIDA_PEDIDO', v_delta, 'Pedido confirmado', auth.uid());
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if old.product_id = new.product_id then
      v_delta := old.quantity - new.quantity;
      update public.products
      set stock_quantity = stock_quantity + v_delta
      where id = new.product_id
        and stock_quantity + v_delta >= 0;

      if not found then
        raise exception 'Estoque insuficiente para atualizar o produto %', new.product_id;
      end if;

      if v_delta <> 0 then
        insert into public.stock_movements (product_id, order_id, movement_type, quantity_delta, reason, created_by)
        values (new.product_id, new.order_id, 'AJUSTE_PEDIDO', v_delta, 'Item do pedido atualizado', auth.uid());
      end if;
    else
      update public.products set stock_quantity = stock_quantity + old.quantity where id = old.product_id;
      update public.products
      set stock_quantity = stock_quantity - new.quantity
      where id = new.product_id
        and stock_quantity - new.quantity >= 0;

      if not found then
        raise exception 'Estoque insuficiente para o produto %', new.product_id;
      end if;

      insert into public.stock_movements (product_id, order_id, movement_type, quantity_delta, reason, created_by)
      values (old.product_id, old.order_id, 'AJUSTE_PEDIDO', old.quantity, 'Produto trocado no pedido', auth.uid());
      insert into public.stock_movements (product_id, order_id, movement_type, quantity_delta, reason, created_by)
      values (new.product_id, new.order_id, 'AJUSTE_PEDIDO', -new.quantity, 'Produto trocado no pedido', auth.uid());
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.products set stock_quantity = stock_quantity + old.quantity where id = old.product_id;
    insert into public.stock_movements (product_id, order_id, movement_type, quantity_delta, reason, created_by)
    values (old.product_id, old.order_id, 'ESTORNO_ITEM', old.quantity, 'Item removido do pedido', auth.uid());
    return old;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger order_items_adjust_stock_after_insert
after insert on public.order_items
for each row execute function public.adjust_stock_for_order_item();

create trigger order_items_adjust_stock_after_update
after update on public.order_items
for each row execute function public.adjust_stock_for_order_item();

create trigger order_items_adjust_stock_after_delete
after delete on public.order_items
for each row execute function public.adjust_stock_for_order_item();

create or replace function public.restore_stock_when_order_canceled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
begin
  if old.status <> 'CANCELADO' and new.status = 'CANCELADO' then
    for v_item in select product_id, quantity from public.order_items where order_id = new.id and product_id is not null loop
      update public.products
      set stock_quantity = stock_quantity + v_item.quantity
      where id = v_item.product_id;

      insert into public.stock_movements (product_id, order_id, movement_type, quantity_delta, reason, created_by)
      values (v_item.product_id, new.id, 'ESTORNO_CANCELAMENTO', v_item.quantity, 'Pedido cancelado', auth.uid());
    end loop;
  end if;
  return new;
end;
$$;

create trigger orders_restore_stock_after_cancel
after update of status on public.orders
for each row execute function public.restore_stock_when_order_canceled();

create or replace function public.confirm_delivery(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  update public.orders
  set status = 'ENTREGUE',
      delivered_at = now()
  where id = p_order_id
    and customer_id = auth.uid()
    and status = 'CONFIRMADO'
  returning * into v_order;

  if not found then
    raise exception 'Pedido nao encontrado ou nao pode ser confirmado.';
  end if;

  return v_order;
end;
$$;

create or replace function public.cancel_order(p_order_id uuid, p_reason text default '')
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  update public.orders
  set status = 'CANCELADO',
      canceled_at = now(),
      cancel_reason = coalesce(p_reason, '')
  where id = p_order_id
    and customer_id = auth.uid()
    and status = 'CONFIRMADO'
  returning * into v_order;

  if not found then
    raise exception 'Pedido nao encontrado ou nao pode ser cancelado.';
  end if;

  return v_order;
end;
$$;

create or replace function public.create_pix_payment_for_my_balance()
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric(12,2);
  v_pix_key text;
  v_payment public.payments;
begin
  select coalesce(sum(total_amount), 0)
  into v_amount
  from public.orders
  where customer_id = auth.uid()
    and payment_status = 'PENDENTE'
    and status in ('CONFIRMADO', 'ENTREGUE');

  if v_amount <= 0 then
    raise exception 'Nao ha saldo pendente para pagamento.';
  end if;

  select pix_key into v_pix_key from public.app_settings where id = true;

  insert into public.payments (customer_id, amount, method, status, pix_key_snapshot)
  values (auth.uid(), v_amount, 'PIX', 'PENDENTE', coalesce(v_pix_key, ''))
  returning * into v_payment;

  insert into public.payment_orders (payment_id, order_id, amount)
  select v_payment.id, id, total_amount
  from public.orders
  where customer_id = auth.uid()
    and payment_status = 'PENDENTE'
    and status in ('CONFIRMADO', 'ENTREGUE');

  return v_payment;
end;
$$;

create or replace function public.update_my_profile(
  p_full_name text,
  p_username text,
  p_whatsapp text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  update public.profiles
  set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      username = nullif(trim(p_username), ''),
      whatsapp = nullif(trim(p_whatsapp), '')
  where id = auth.uid()
  returning * into v_profile;

  if not found then
    raise exception 'Perfil nao encontrado.';
  end if;

  return v_profile;
end;
$$;

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.products enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_orders enable row level security;
alter table public.closing_cycles enable row level security;
alter table public.stock_movements enable row level security;

create policy profiles_select_own_or_admin
on public.profiles for select
using (id = auth.uid() or public.is_admin());

create policy profiles_update_own_basic
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and role = 'cliente');

create policy profiles_admin_all
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

create policy app_settings_public_read
on public.app_settings for select
using (true);

create policy app_settings_admin_update
on public.app_settings for update
using (public.is_admin())
with check (public.is_admin());

create policy products_public_active_read
on public.products for select
using ((is_active = true and is_hidden = false) or public.is_admin());

create policy products_admin_all
on public.products for all
using (public.is_admin())
with check (public.is_admin());

create policy carts_owner_read
on public.carts for select
using (customer_id = auth.uid() or public.is_admin());

create policy carts_owner_insert
on public.carts for insert
with check (customer_id = auth.uid());

create policy carts_owner_update
on public.carts for update
using (customer_id = auth.uid() and status = 'ABERTO')
with check (customer_id = auth.uid());

create policy carts_admin_all
on public.carts for all
using (public.is_admin())
with check (public.is_admin());

create policy cart_items_owner_read
on public.cart_items for select
using (
  public.is_admin()
  or exists (
    select 1 from public.carts
    where carts.id = cart_items.cart_id
      and carts.customer_id = auth.uid()
  )
);

create policy cart_items_owner_insert
on public.cart_items for insert
with check (
  exists (
    select 1 from public.carts
    where carts.id = cart_items.cart_id
      and carts.customer_id = auth.uid()
      and carts.status = 'ABERTO'
  )
);

create policy cart_items_owner_update
on public.cart_items for update
using (
  exists (
    select 1 from public.carts
    where carts.id = cart_items.cart_id
      and carts.customer_id = auth.uid()
      and carts.status = 'ABERTO'
  )
)
with check (
  exists (
    select 1 from public.carts
    where carts.id = cart_items.cart_id
      and carts.customer_id = auth.uid()
      and carts.status = 'ABERTO'
  )
);

create policy cart_items_owner_delete
on public.cart_items for delete
using (
  exists (
    select 1 from public.carts
    where carts.id = cart_items.cart_id
      and carts.customer_id = auth.uid()
      and carts.status = 'ABERTO'
  )
);

create policy cart_items_admin_all
on public.cart_items for all
using (public.is_admin())
with check (public.is_admin());

create policy orders_owner_read
on public.orders for select
using (customer_id = auth.uid() or public.is_admin());

create policy orders_owner_insert
on public.orders for insert
with check (customer_id = auth.uid());

create policy orders_admin_all
on public.orders for all
using (public.is_admin())
with check (public.is_admin());

create policy order_items_owner_read
on public.order_items for select
using (
  public.is_admin()
  or exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.customer_id = auth.uid()
  )
);

create policy order_items_owner_insert
on public.order_items for insert
with check (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and orders.customer_id = auth.uid()
      and orders.status = 'CONFIRMADO'
  )
);

create policy order_items_admin_all
on public.order_items for all
using (public.is_admin())
with check (public.is_admin());

create policy payments_owner_read
on public.payments for select
using (customer_id = auth.uid() or public.is_admin());

create policy payments_owner_insert
on public.payments for insert
with check (customer_id = auth.uid());

create policy payments_admin_all
on public.payments for all
using (public.is_admin())
with check (public.is_admin());

create policy payment_orders_owner_read
on public.payment_orders for select
using (
  public.is_admin()
  or exists (
    select 1 from public.payments
    where payments.id = payment_orders.payment_id
      and payments.customer_id = auth.uid()
  )
);

create policy payment_orders_admin_all
on public.payment_orders for all
using (public.is_admin())
with check (public.is_admin());

create policy closing_cycles_admin_all
on public.closing_cycles for all
using (public.is_admin())
with check (public.is_admin());

create policy stock_movements_admin_read
on public.stock_movements for select
using (public.is_admin());

create policy stock_movements_admin_insert
on public.stock_movements for insert
with check (public.is_admin());

-- Allow authenticated users to execute only the safe customer-facing RPCs.
grant execute on function public.confirm_delivery(uuid) to authenticated;
grant execute on function public.cancel_order(uuid, text) to authenticated;
grant execute on function public.create_pix_payment_for_my_balance() to authenticated;
grant execute on function public.update_my_profile(text, text, text) to authenticated;
