-- transition_order_status(): optional p_count_refusal (default true = unchanged behaviour).
-- The SPX webhook passes false for SPX-side failures (5001 pickup failed, 5002 damaged,
-- 5003 lost, 7001 pickup cancelled) so they don't count toward the customer's blacklist.
-- Stock is still restored for every delivery_failed (lost / damaged: corrected by hand for now).
-- New signature, so the old 3-argument function is dropped (named-argument callers are unaffected).

drop function public.transition_order_status(uuid, public.order_status, text);

create or replace function public.transition_order_status(
  p_order_id   uuid,
  p_new_status public.order_status,
  p_note       text default null,
  p_count_refusal boolean default true
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_order      public.orders%rowtype;
  v_caller     uuid := auth.uid();
  v_is_admin   boolean := false;
  v_new_count  int;
  v_gift_id    uuid;
  v_valid      boolean := false;
begin
  -- only admin (or service_role from admin server routes)
  if auth.role() is distinct from 'service_role' then
    select is_admin into v_is_admin from public.profiles where id = v_caller;
    if not coalesce(v_is_admin, false) then
      raise exception 'FORBIDDEN';
    end if;
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  -- valid transitions only
  v_valid := (v_order.status = 'pending'   and p_new_status in ('confirmed', 'cancelled'))
          or (v_order.status = 'confirmed' and p_new_status in ('shipped', 'cancelled'))
          or (v_order.status = 'shipped'   and p_new_status in ('delivered', 'delivery_failed'));
  if not v_valid then
    raise exception 'INVALID_TRANSITION:%_TO_%', v_order.status, p_new_status;
  end if;

  update public.orders set status = p_new_status where id = p_order_id;

  insert into public.order_status_history (order_id, status, note)
  values (p_order_id, p_new_status, p_note);

  -- stock restoration + voucher slot release
  if p_new_status in ('cancelled', 'delivery_failed') then
    -- aggregate first: an order may hold several rows for the same variant, and
    -- UPDATE ... FROM applies only one arbitrary join row per target row.
    update public.product_variants v
       set stock = v.stock + agg.qty
      from (
        select variant_id, sum(qty) as qty
          from public.order_items
         where order_id = p_order_id and variant_id is not null
         group by variant_id
      ) agg
     where agg.variant_id = v.id;

    update public.voucher_uses
       set released_at = now()
     where order_id = p_order_id and released_at is null;

    update public.vouchers vc
       set used_count = greatest(used_count - 1, 0)
      from public.voucher_uses vu
     where vu.order_id = p_order_id and vu.voucher_id = vc.id;
  end if;

  -- refusal tracking (per phone). SPX-side failures (pickup failed, damaged, lost, pickup
  -- cancelled) pass p_count_refusal = false: the customer didn't refuse anything.
  if p_new_status = 'delivery_failed' and p_count_refusal then
    insert into public.customers (phone, refusal_count) values (v_order.phone, 1)
    on conflict (phone) do update set refusal_count = public.customers.refusal_count + 1;
  end if;

  -- loyalty: delivered counter + milestone gift (per phone)
  if p_new_status = 'delivered' then
    insert into public.customers (phone, delivered_count) values (v_order.phone, 1)
    on conflict (phone) do update set delivered_count = public.customers.delivered_count + 1
    returning delivered_count into v_new_count;

    if v_new_count % 10 = 0 then
      select id into v_gift_id from public.loyalty_gifts
       where is_active = true
       order by random() limit 1;   -- NULL if pool empty → banked award

      insert into public.loyalty_awards (phone, gift_id, milestone)
      values (v_order.phone, v_gift_id, v_new_count)
      on conflict (phone, milestone) do nothing;
    end if;
  end if;
end $$;

revoke execute on function public.transition_order_status(uuid, public.order_status, text, boolean) from public, anon;
grant  execute on function public.transition_order_status(uuid, public.order_status, text, boolean) to authenticated, service_role;
