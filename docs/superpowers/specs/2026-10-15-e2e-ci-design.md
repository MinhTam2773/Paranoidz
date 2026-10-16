# E2E tests + CI — design

Date: 2026-10-15 · Status: approved by the owner; build order in TODO.md (Next up)

There is no CI yet; the only automated checks are the admin `node:test` unit tests and the two
`@paranoidz/db` smoke scripts, all run by hand. This adds Playwright e2e tests for the critical paths
and one GitHub Actions job that runs everything on a throwaway database.

## Decisions (owner, 2026-10-15)

- **Database: a fresh local Supabase per run** (`supabase start` in CI, Docker locally). All migrations
  and seeds apply from zero, the run uses the CLI's fixed demo keys (no Supabase secrets in GitHub),
  and the stack is discarded afterwards — so every run also proves the migrations apply cleanly.
  Rejected: **`paranoidz-test`** — shared, hand-edited state (catalog wiped 2026-10-14), parallel PRs
  would collide, its storefront env sends order emails and a `[TEST]` Zalo to the **client's** chat,
  the free plan pauses when idle, and GitHub runners (US) → Singapore adds ~200 ms per query, which
  cancels its faster start. **Supabase Branching** — needs Pro, and the client owns billing.
- **Hard guard:** Playwright global setup aborts unless the Supabase URL host is `127.0.0.1` or
  `localhost`. A misconfigured run can never reach prod or test.
- **No side effects:** `RESEND_API_KEY`, `ZALO_*`, `TEST_LABEL` are never set for e2e runs.
- **Env is passed, not written.** `e2e/env.ts` reads `supabase status -o env` and hands the URL + keys
  to `next build` / `next start` as process env, with every other key found in the apps' `.env*`
  files set to `""` (Next.js never overrides an existing variable, empty or not), so the developer's
  `.env.local` (paranoidz-test, Resend, Zalo) can't leak in. CI writes only `apps/admin/.env.local`,
  for the smoke scripts. Apps run on `:3100` / `:3101` with `reuseExistingServer: false`, so a
  `pnpm dev` on `:3000` (pointing at paranoidz-test) is never reused. The production build lands in
  `.next`; Next 16's dev server uses `.next/dev`, so both coexist.
- **The service-role test client lives in `@paranoidz/db/testing`** (`createLocalTestClient()`), not
  in `e2e/`: `admin.ts` can't load in plain Node (`server-only`), and `createClient` stays inside
  `packages/db` (CLAUDE.md §4). It runs the same local-URL guard.
- **Tests run against `next build` + `next start`**, not `next dev`, so ISR / caching behave like
  production.
- **Each test owns its data:** a `seedProduct()` fixture (service key) creates a product + variants with
  known stock and a unique slug; each test uses its own phone, and storefront tests send their own
  `x-real-ip` (`e2e/fixtures/test.ts`) — `next start` fills `x-forwarded-for` from the socket, so
  without it every test shares one IP and trips the 10-orders-per-hour limit. Tests run in parallel
  without sharing stock, the per-phone rules (first-5 discount, 3 open pending orders) or the rate
  limits. `dev.sql` still loads (the smoke scripts need its stock); the only e2e use of it is S1's
  "listing renders a card" step (see A4 / ISR below).
- **Users:** the `setup` project creates the admin with the service key (random password, kept in
  memory) and signs in through the real login form; only the saved session (`e2e/.auth/`, gitignored)
  is reused. Tests that need a customer (S7, A1) create their own.
- **A4 checks the new product's own page**, not `/products`: the listing is ISR with
  `revalidate = 60`, and admin `revalidatePath` only clears the admin app's cache. Showing a new product
  in the listing within 60 s is by design, not something to test.

## Layout

New workspace package `e2e/` (added to `pnpm-workspace.yaml`): `@playwright/test`,
`playwright.config.ts` (`webServer` for storefront `:3000` + admin `:3001`), `fixtures/`,
`tests/storefront/`, `tests/admin/`. Chromium only. Projects: `setup`, `desktop` (1280 px, all tests),
`mobile` (375 px, tests tagged `@mobile` — S3 only). Root script `pnpm test:e2e`.

## Tests (12)

| # | Flow | Proves |
|---|------|--------|
| S1 | Home → `/products` → product page, pick colour + size | Catalog renders; sold-out sizes can't be picked |
| S2 | Cart: add, change qty, remove, reload | Cart survives reload; header badge count right |
| S3 | Guest checkout (province picker, live price) — **also at 375 px** | `PZ-YYYY-NNNN` shown; DB order `pending`, stock down, total = server-computed subtotal − first-5 + shipping |
| S4 | Promo code at checkout | Valid code lowers total; invalid → Vietnamese error, priced without it |
| S5 | Checkout guards | Bad phone / missing fields → Vietnamese errors; stock gone before submit → refused, never negative |
| S6 | Order lookup | Number + phone → status; wrong phone → not found |
| S7 | Sign in → add the account phone → order | Order appears in `/account` history |
| A1 | Admin access | Signed out → `/login`; customer refused; admin gets in |
| A2 | Lifecycle pending → confirmed → shipped → delivered | Each step in detail + history; `delivered_count` +1 |
| A3 | Cancel a pending order | Stock restored; voucher slot released |
| A4 | Create product with variant + stock | It renders on the storefront product page |
| A5 | Inventory − / + | Adjusts stock; can't go below 0 |

Later: search, reviews, bundles, collections, BigSeller import/export, sign-up / reset emails, admin
customers / promo codes / categories. Tampered prices stay with `smoke` (server-side pricing is checked
there directly; an e2e test can't easily forge a server action payload).

## CI — `.github/workflows/ci.yml`

One job on `ubuntu-latest`, on pull requests to `master` and pushes to `master`: checkout → pnpm + Node →
`pnpm install` → Supabase CLI (pinned 2.72.7, same as local) → `supabase start` without Studio,
Realtime, Mailpit, imgproxy, edge runtime, logflare / vector, supavisor → write
`apps/admin/.env.local` → admin unit tests → `smoke` +
`smoke:inventory` → build both apps → install Chromium (cached) → Playwright → on failure upload the
HTML report + traces.
