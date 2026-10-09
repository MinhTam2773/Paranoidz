-- set_review_author() (20261008000003) failed on every reviews insert: PL/pgSQL doesn't
-- short-circuit `and`, so `new.is_brand_reply` was read on reviews, which has no such column.
create or replace function public.set_review_author()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_table_name = 'review_replies' then
    if new.is_brand_reply then
      new.author_name := 'PARANOIDZ';
      return new;
    end if;
  end if;
  new.author_name := public.short_author_name((select full_name from profiles where id = new.user_id));
  return new;
end
$$;
