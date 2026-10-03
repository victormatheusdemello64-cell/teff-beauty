-- Creates an order from the client cart in one database transaction.
-- This prevents half-created orders if one item is out of stock.

create or replace function public.create_order_from_cart(
  p_items jsonb,
  p_notes text default ''
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_product public.products;
  v_quantity integer;
  v_product_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuario precisa estar logado.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Carrinho vazio.';
  end if;

  insert into public.orders (customer_id, notes)
  values (auth.uid(), coalesce(p_notes, ''))
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    v_quantity := coalesce((v_item ->> 'quantity')::integer, 0);

    if v_product_id is null or v_quantity <= 0 then
      raise exception 'Item invalido no carrinho.';
    end if;

    select * into v_product
    from public.products
    where id = v_product_id
      and is_active = true
      and is_hidden = false
    for update;

    if not found then
      raise exception 'Produto indisponivel.';
    end if;

    if v_product.stock_quantity < v_quantity then
      raise exception 'Estoque insuficiente para %.', v_product.name;
    end if;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      product_image_url,
      quantity,
      unit_price,
      unit_cost
    )
    values (
      v_order.id,
      v_product.id,
      v_product.name,
      v_product.image_url,
      v_quantity,
      v_product.price,
      v_product.cost
    );
  end loop;

  perform public.recalculate_order_totals(v_order.id);

  select * into v_order
  from public.orders
  where id = v_order.id;

  return v_order;
end;
$$;

grant execute on function public.create_order_from_cart(jsonb, text) to authenticated;
