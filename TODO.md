# TODO.md — Paranoidz

Session log and work queue. Read this first (CLAUDE.md §7), update it last (§5).

**Current phase:** 1 — Foundation
**Supabase project:** `rbuoirnnroauzdjwwfij` (linked via `supabase link`)

---

## Done

- [x] Scaffold pnpm monorepo — `apps/storefront`, `apps/admin`
- [x] Write `ARCHITECTURE.md`, `DESIGN.md`, `DASHBOARD_DESIGN.md`, `CLAUDE.md`
- [x] **Initial database schema** — `supabase/migrations/20260722000001_init.sql`, applied to the linked project (`f3f5a4e`). 19 tables, RLS on every table, `place_order()`, `transition_order_status()`, FTS index, seed voucher.

---

## Next up

- [ ] **`packages/db`** — the three clients from ARCHITECTURE.md §2.1:
  - `client.ts` (anon, browser), `server.ts` (anon + cookie session, `@supabase/ssr`), `admin.ts` (service_role, starts with `import "server-only"`)
  - Corrected session-refresh middleware — the Supabase quickstart snippet creates the client and never calls `getUser()`, so it refreshes nothing
  - Generated types via `supabase gen types typescript --linked`
  - Wire into workspace; add `.env.example`. Install with `pnpm`, never `npm` (§3)
- [ ] **Smoke test the migration's runtime logic** (deferred 2026-07-24; nothing has exercised these yet):
  - Voucher `max_uses` under concurrent redemption
  - Stock restore when one order holds two rows for the same variant
  - Image snapshot picks the exact colourway, not the general image
  - A customer cannot set `is_admin` on their own profile despite the UPDATE policy

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
- **`supabase db dump` / `db reset` need Docker Desktop running.** `migration list`, `db push` and `inspect` do not.
