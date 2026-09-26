# TODO.md — Paranoidz

Session log and work queue. Read this first (CLAUDE.md §7), update it last (§5).

**Current phase:** 1 — Foundation
**Supabase project:** `rbuoirnnroauzdjwwfij` (linked via `supabase link`)

---

## Done

- [x] Scaffold pnpm monorepo — `apps/storefront`, `apps/admin`
- [x] Write `ARCHITECTURE.md`, `DESIGN.md`, `DASHBOARD_DESIGN.md`, `CLAUDE.md`
- [x] **Initial database schema** — `supabase/migrations/20260722000001_init.sql`, applied to the linked project (`f3f5a4e`). 19 tables, RLS on every table, `place_order()`, `transition_order_status()`, FTS index, seed voucher.
- [x] **Dev seed** — `supabase/seeds/dev.sql`, pushed to the linked project (2026-09-25): 4 categories, 10 products, 46 variants (7 sold out, 10 low stock, 11 on sale), 25 image rows, 3 email/password test customers with phone + default address. Kept separate from `seed.sql` so launch cleanup = drop it from `config.toml` `sql_paths` and delete the rows.
- [x] **`packages/db`** (2026-09-25) — subpath exports only (`@paranoidz/db/client|server|admin|proxy|types`, no barrel, so `admin.ts` can't ride along with another import). Session refresh in each app's `src/proxy.ts` → `updateSession()` (calls `getClaims()`, forwards the no-cache headers). Types: `pnpm --filter @paranoidz/db gen:types`. Verified: both apps build; a `"use client"` import of `admin` fails the build; anon server client reads 10 products / 46 variants and 0 vouchers / 0 orders.
- [x] **Migration smoke test** (2026-09-25) — `pnpm --filter @paranoidz/db smoke`, 7/7 pass: voucher `max_uses` race (1 of 3 redeems, losers roll back stock), duplicate-variant order restores all units on cancel, image snapshot picks the colourway, `is_admin` self-update rejected while `full_name` still works. Self-cleaning; re-run after any migration.

---

## Next up


---

## Backlog — storefront

Governed by `DESIGN.md` + `design-refs/`.

- [ ] Tailwind v4 `@theme` tokens in `globals.css` (no `tailwind.config` — §3)
- [ ] Layout shell: nav, announcement bar, footer
- [ ] Catalog / collection listing
- [ ] Product detail — variant matrix, sold-out states, size guide
- [ ] Search (Postgres FTS + unaccent)
- [ ] Cart + Buy It Now (Buy It Now skips cart)
- [ ] Order form → server route → `place_order()`
- [ ] Auth (email/password, Google, Facebook); phone required + unique
- [ ] Account: order history, addresses, wishlist
- [ ] Reviews + replies (server route — `is_brand_reply` must be unforgeable)

## Backlog — admin

Governed by `DASHBOARD_DESIGN.md` §6.

- [ ] Admin shell + auth gate (`is_admin`)
- [ ] Dashboard: stat cards, latest orders, low-stock (stock ≤ 3)
- [ ] Orders list + detail (every transition via `transition_order_status()`)
- [ ] Products list + edit (variant matrix, image uploader)
- [ ] Customers list + detail (loyalty progress, blacklist toggle)
- [ ] Bundles, Collections (drag-to-reorder)
- [ ] Promo codes (auto first-5 vouchers are system-managed, not listed)
- [ ] Gift pool (+ empty-pool banner for pending awards)
- [ ] Reviews moderation (hide/show only, no deletes)

## Backlog — infra

- [ ] Resend transactional email (customer confirmation + client alert)
- [ ] Telegram bot new-order alert
- [ ] Rate limit the order endpoint per phone and IP (ARCHITECTURE.md §6)
- [ ] Vercel: two projects from one monorepo, region `sin1`

---

## Blocked — pending client decisions

Do NOT implement (ARCHITECTURE.md §8). Each one has a concrete cost if guessed wrong:

1. **Free shipping** — all orders vs over ₫1.000.000. `orders` has no shipping column and `orders_total_math` currently asserts `total = subtotal - discount`; adding shipping means altering that constraint.
2. **Guest checkout vs account required** — current build assumes account required, and `place_order()` hard-fails on `AUTH_REQUIRED`.
3. **Voucher discount cap** — `AUTO-FIRST5` is seeded uncapped (`cap_amount = null`) in `supabase/seed.sql`. Change there, no migration needed.
4. Loyalty gift notification + fulfilment method.
5. Loyalty progress visibility on the account page.
6. Sanity CMS vs `site_content` table (recommendation: drop Sanity).
7. Announcement bar management (hardcoded for now).

---

## Known gaps — carried debt

Surfaced during the schema review, deliberately not fixed:

- **Reviews can't show author names.** `profiles` is own-row-only under RLS, so joining `full_name` onto a public review returns nothing. Decide when building reviews: snapshot an `author_name` column, or expose a narrow view.
- **`place_order()` is granted to `authenticated`**, so a browser holding a user session can call the RPC directly and skip the server route's rate limiting. Safe by design — all price, stock and voucher logic is inside the function — but it is unthrottled until the rate limit lands.
- **Deleting an `auth.users` row hard-fails** once that user has ordered (`orders.user_id ... on delete restrict`). Intentional, to preserve order history — but there is no working "delete my account" path as a result.
- **Dev seed data lives in the only (future production) project.** Test users `customer*@paranoidz.test` and the mock catalog must be deleted before launch (fixed id prefixes: `c0000000-`, `d0000000-`, `e0000000-`, `a0000000-`).
- **Seed image paths point at nothing.** No Storage bucket exists yet; `product_images.storage_path` values are placeholders.
- **No admin user seeded.** Deliberately — a committed password on an `is_admin` account would be a real hole. Promote your own account when the admin shell lands.
- **The claude.ai Supabase connector is read-only.** `execute_sql` fails on any write (`cannot execute INSERT in a read-only transaction`). Use it to inspect; write data through the CLI (`supabase db push --include-seed`).
- **`db push --include-seed` never re-runs a seed file it has seen** — it only updates the hash. New seed data needs a new file in `sql_paths`.
- **`admin.ts` is untested at runtime.** `SUPABASE_SERVICE_ROLE_KEY` isn't in `apps/admin/.env.local` — the read-only connector can't fetch secret keys. Add it from the dashboard (API Keys → secret) before the admin shell task.
- **Env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`**, not `..._ANON_KEY`: uses the modern `sb_publishable_` key (same `anon` role under RLS, rotates independently). ARCHITECTURE.md §2.1 still says "anon key" — same thing.
- **Next 16: middleware is `src/proxy.ts`**, exporting `proxy()`, Node runtime only.
- **`@supabase/ssr` `setAll(cookies, headers)`** — the second arg carries no-cache headers that must be put on the response, or a CDN can serve one user's session cookie to another. Any new cookie adapter must forward them.
- **Each app has its own create-next-app `.gitignore`** that overrides the root one (`.env*` ignored). Needed `!.env.example` added per app. Check `git check-ignore -v` for any new file that should be tracked.
- **The voucher race test didn't hit the atomic guard.** Both losers failed `INVALID_VOUCHER` (the winner had already committed), not `VOUCHER_EXHAUSTED` — the three HTTP calls never truly overlapped. Outcome correct; the `UPDATE ... WHERE used_count < max_uses` path itself is proven only by Postgres row-lock semantics, not by this test.
- **`order_number_seq` has gaps from smoke runs** (`last_value` = 3 after the first run). Real orders will not start at `PZ-2026-0001` unless it is reset with `setval` before launch. Each smoke run consumes ~3 more.
- **Column-grant denials say "permission denied for table profiles"**, not "column". Map it to a friendly message in the account page, don't match on the word "column".
- **Test sessions without passwords:** `auth.admin.generateLink({ type: "magiclink" })` → `verifyOtp({ token_hash })` gives a real user session from the service key. Use this for any future test that needs `auth.uid()`.
- **`supabase db dump` / `db reset` need Docker Desktop running.** `migration list`, `db push` and `inspect` do not.
