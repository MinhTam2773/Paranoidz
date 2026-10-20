-- ============================================================
-- Homepage BEST SELLER tab: rank by the synced Shopee sold counts
-- (products.shopee_sold_count) instead of web order units. The web shop
-- has almost no orders yet, which left the tab empty, while the Shopee
-- counts (synced 2026-10-20) reflect real demand. Same signature and
-- contract as 20261008000001: product ids only, active products with at
-- least one recorded sale, at most 50 ids. SECURITY DEFINER because
-- orders stay private — this exposes no counts and no order data.
-- ============================================================

create or replace function public.best_seller_ids(p_limit int)
returns table (product_id uuid)
language sql stable security definer
set search_path = public
as $$
  select p.id
    from public.products p
   where p.is_active
     and coalesce(p.shopee_sold_count, 0) > 0
   order by p.shopee_sold_count desc, p.id
   limit least(greatest(coalesce(p_limit, 0), 0), 50)
$$;

revoke execute on function public.best_seller_ids(int) from public;
grant execute on function public.best_seller_ids(int) to anon, authenticated;
