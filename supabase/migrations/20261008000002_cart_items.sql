-- ============================================================
-- Account cart (TODO "Account cart sync"). Guests keep the browser cart (localStorage); a signed-in
-- user's cart lives here so it follows them across devices and isn't left behind on a shared
-- browser. Variant ids + quantities only — prices and stock are re-read, and place_order()
-- recomputes everything. Own rows only, read and written from the browser like wishlists.
-- ============================================================

create table public.cart_items (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  qty        int  not null check (qty > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, variant_id)
);

alter table public.cart_items enable row level security;

create policy cart_items_own on public.cart_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- On login: add the browser cart (p_lines = [{variant_id, qty}]) to the account cart in one
-- statement — quantities summed, capped at current stock. Ids are matched as text so a malformed
-- one from localStorage is skipped instead of failing the whole merge; sold-out variants and
-- variants of hidden products (not visible under RLS) are dropped. Security invoker: RLS applies.
create function public.merge_cart(p_lines jsonb)
returns void
language sql
set search_path = public
as $$
  insert into cart_items as c (user_id, variant_id, qty)
  select auth.uid(), v.id, least(sum(l.qty), v.stock)::int
    from jsonb_to_recordset(p_lines) as l(variant_id text, qty numeric)
    join product_variants v on v.id::text = l.variant_id
   where l.qty > 0 and v.stock > 0
   group by v.id, v.stock
  on conflict (user_id, variant_id) do update
    set qty = least(c.qty + excluded.qty, (select stock from product_variants where id = excluded.variant_id))
$$;

revoke execute on function public.merge_cart(jsonb) from public, anon;
grant execute on function public.merge_cart(jsonb) to authenticated;
