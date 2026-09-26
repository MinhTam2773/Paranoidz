-- ============================================================
-- Storefront search (ARCHITECTURE.md §2.2): Postgres FTS + unaccent, diacritic-insensitive.
-- Searchable text = product name (weight A), category + variant colours (B), description (C),
-- so "black hoodie" works although descriptions don't name colours. That text spans three
-- tables, so it's built per query instead of indexed — a few ms at this catalog size — and the
-- name + description expression index from init is dropped as unused.
-- ============================================================

drop index public.products_fts_idx;

-- Every word must match, as a prefix ("hood" → hoodie). The query is unaccented + lowercased and
-- split on anything that isn't a-z / 0-9, so user input never reaches to_tsquery() syntax.
-- At most 8 words. No words → no rows. Security invoker: RLS limits it to active products.
create function public.search_products(p_query text)
returns table (product_id uuid, rank real)
language sql stable
set search_path = public
as $$
  with words as (
    select w
      from regexp_split_to_table(lower(public.immutable_unaccent(coalesce(p_query, ''))), '[^a-z0-9]+') w
     where w <> ''
     limit 8
  ), q as (
    select to_tsquery('simple', string_agg(w || ':*', ' & ')) as tsq
      from words
    having count(*) > 0
  ), docs as (
    select p.id, p.name,
           setweight(to_tsvector('simple', public.immutable_unaccent(p.name)), 'A') ||
           setweight(to_tsvector('simple', public.immutable_unaccent(
             coalesce(c.name, '') || ' ' || coalesce(string_agg(distinct v.color, ' '), ''))), 'B') ||
           setweight(to_tsvector('simple', public.immutable_unaccent(coalesce(p.description, ''))), 'C') as doc
      from products p
      left join categories c on c.id = p.category_id
      left join product_variants v on v.product_id = p.id
     group by p.id, c.name
  )
  select d.id, ts_rank(d.doc, q.tsq)
    from docs d, q
   where d.doc @@ q.tsq
   order by 2 desc, d.name
$$;
