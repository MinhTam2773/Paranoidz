-- ============================================================
-- Admin stock edits (decided 2026-10-05): the product editor sets stock with a
-- compare-and-set, so an order placed while the form was open is never
-- overwritten. place_order() / transition_order_status() remain the only places
-- that decrement or restore stock.
--
-- p_changes: [{"variant_id": "...", "expected": 5, "stock": 12}, ...]
-- All or nothing: if any variant's stock is no longer `expected`, nothing is
-- applied and STOCK_CHANGED is raised.
-- ============================================================
create function public.set_variant_stocks(p_changes jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_change record;
begin
  if auth.role() is distinct from 'service_role' then
    if not coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  for v_change in
    select * from jsonb_to_recordset(p_changes) as c(variant_id uuid, expected int, stock int)
  loop
    if v_change.stock is null or v_change.stock < 0 or v_change.expected is null then
      raise exception 'INVALID_STOCK';
    end if;

    update public.product_variants
       set stock = v_change.stock
     where id = v_change.variant_id and stock = v_change.expected;

    if not found then
      raise exception 'STOCK_CHANGED';
    end if;
  end loop;
end $$;

revoke execute on function public.set_variant_stocks(jsonb) from public, anon;
grant  execute on function public.set_variant_stocks(jsonb) to authenticated, service_role;
