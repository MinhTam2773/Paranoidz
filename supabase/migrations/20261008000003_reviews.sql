-- ============================================================
-- Storefront reviews (ARCHITECTURE.md §2.2 / §3). Owner's decisions (2026-10-08):
--   * only customers with a DELIVERED order of the product can review it (orders matched by account
--     or by the profile's phone, since most orders are guest orders);
--   * the author shows as a snapshot of their shortened name ("Nguyễn Văn An" → "An N. V."):
--     profiles stay private, later name edits don't touch old reviews;
--   * any signed-in customer can reply; brand replies (is_brand_reply) come only from the admin
--     (service role) — customers can neither insert nor update that flag;
--   * customers edit (rating, content) and delete their own review, and delete their own replies.
-- Moderation stays hide/show (is_visible), now on replies too. Writes go through the storefront's
-- server actions, but RLS + column grants below are what enforce every rule.
-- ============================================================

alter table public.reviews
  add column author_name text not null default 'Khách hàng',
  add constraint reviews_content_length check (char_length(content) between 1 and 2000);

alter table public.review_replies
  add column author_name text not null default 'Khách hàng',
  add column is_visible boolean not null default true,
  add constraint review_replies_content_length check (char_length(content) between 1 and 1000);

create index reviews_product_idx on public.reviews (product_id, created_at desc);
create index review_replies_review_idx on public.review_replies (review_id, created_at);

-- Vietnamese order is family … given: show the given name, then the other initials.
-- One word → as is; no name → "Khách hàng".
create function public.short_author_name(p_name text)
returns text
language sql immutable
set search_path = public
as $$
  with w as (
    select array_remove(regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+'), '') as words
  )
  select case
    when cardinality(words) = 0 then 'Khách hàng'
    when cardinality(words) = 1 then words[1]
    else words[cardinality(words)] || ' ' ||
         (select string_agg(upper(left(x, 1)) || '.', ' ' order by i)
            from unnest(words[1:cardinality(words) - 1]) with ordinality as t(x, i))
  end
  from w
$$;

-- Did the signed-in user receive this product? Definer: reads orders, which are private.
create function public.has_delivered_product(p_product_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
      from orders o
      join order_items i on i.order_id = o.id
     where i.product_id = p_product_id
       and o.status = 'delivered'
       and (o.user_id = auth.uid()
            or o.phone = (select p.phone from profiles p where p.id = auth.uid()))
  )
$$;

revoke execute on function public.has_delivered_product(uuid) from public, anon;
grant execute on function public.has_delivered_product(uuid) to authenticated;

-- Author snapshot, set server-side on insert (the client can't send author_name — see grants).
create function public.set_review_author()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_table_name = 'review_replies' and new.is_brand_reply then
    new.author_name := 'PARANOIDZ';
  else
    new.author_name := public.short_author_name((select full_name from profiles where id = new.user_id));
  end if;
  return new;
end
$$;

create trigger trg_reviews_author before insert on public.reviews
  for each row execute function public.set_review_author();
create trigger trg_review_replies_author before insert on public.review_replies
  for each row execute function public.set_review_author();

-- Column grants: customers send only these columns; everything else takes its default.
revoke insert, update on public.reviews from anon, authenticated;
grant  insert (product_id, user_id, rating, content) on public.reviews to authenticated;
grant  update (rating, content) on public.reviews to authenticated;
revoke insert, update on public.review_replies from anon, authenticated;
grant  insert (review_id, user_id, content) on public.review_replies to authenticated;

-- reviews: public sees visible ones (init); the author also sees their own (even hidden).
create policy reviews_select_own on public.reviews
  for select using (user_id = auth.uid());
create policy reviews_insert_buyer on public.reviews
  for insert with check (user_id = auth.uid() and public.has_delivered_product(product_id));
create policy reviews_update_own on public.reviews
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_delete_own on public.reviews
  for delete using (user_id = auth.uid());

-- review_replies: visible replies of visible reviews; own replies; reply only to a visible review.
drop policy review_replies_public_read on public.review_replies;
create policy review_replies_public_read on public.review_replies
  for select using (
    is_visible and exists (select 1 from public.reviews r where r.id = review_id and r.is_visible)
  );
create policy review_replies_select_own on public.review_replies
  for select using (user_id = auth.uid());
create policy review_replies_insert_own on public.review_replies
  for insert with check (
    user_id = auth.uid()
    and not is_brand_reply
    and exists (select 1 from public.reviews r where r.id = review_id and r.is_visible)
  );
create policy review_replies_delete_own on public.review_replies
  for delete using (user_id = auth.uid() and not is_brand_reply);
