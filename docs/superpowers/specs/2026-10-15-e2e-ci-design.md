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
- **Env is passed, not written, locally.** Local Supabase URL + keys go to `next build` / `next start`
  as process env (Next.js never overrides existing env with `.env.local`), so the developer's
  `.env.local` files keep pointing at `paranoidz-test`. CI writes both apps' `.env.local` from
  `supabase status` (the smoke scripts read `apps/admin/.env.local`). Cost locally: each app's `.next`
  is rebuilt, so the next `pnpm dev` starts cold.
- **Tests run against `next build` + `next start`**, not `next dev`, so ISR / caching behave like
  production.
- **Each test owns its data:** a `seedProduct()` fixture (service key) creates a product + variants with
  known stock and a unique slug; each test uses its own phone and sends its own `x-real-ip` header
  (`lib/rate-limit.ts` keys on it). Tests run in parallel without sharing stock, the per-phone rules
  (first-5 discount, 3 open pending orders) or the IP rate limit. `dev.sql` still loads (the smoke
  scripts need its stock), but no e2e test depends on it.
- **Users:** global setup creates a test admin and a test customer with the service key, with random
  per-run passwords that are never written to disk; only the saved sessions (`storageState`) are reused.
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
| S7 | Signed-in customer orders | Order appears in `/account` history |
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
`pnpm install` → Supabase CLI (pinned) → `supabase start` without Studio, Realtime, Mailpit, imgproxy,
edge runtime, logflare / vector → write `.env.local`s → admin unit tests → `smoke` +
`smoke:inventory` → build both apps → install Chromium (cached) → Playwright → on failure upload the
HTML report + traces.
