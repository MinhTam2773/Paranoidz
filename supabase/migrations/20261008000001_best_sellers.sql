-- ============================================================
-- Homepage BEST SELLER tab (DESIGN.md §4). Orders are private under RLS, so this is
-- security definer and returns product ids only, ranked by units sold — no counts, no order data.
-- Sold = any order not cancelled or refused at the door (delivery_failed). Active products only,
-- since definer bypasses the products RLS. At most 50 ids.
-- ============================================================

create function public.best_seller_ids(p_limit int)
returns table (product_id uuid)
language sql stable security definer
set search_path = public
as $$
  select oi.product_id
    from order_items oi
    join orders o on o.id = oi.order_id
    join products p on p.id = oi.product_id
   where o.status not in ('cancelled', 'delivery_failed')
     and p.is_active
   group by oi.product_id
   order by sum(oi.qty) desc, oi.product_id
   limit least(greatest(coalesce(p_limit, 0), 0), 50)
$$;

revoke execute on function public.best_seller_ids(int) from public;
grant execute on function public.best_seller_ids(int) to anon, authenticated;
