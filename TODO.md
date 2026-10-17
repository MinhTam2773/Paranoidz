# TODO.md — Paranoidz

Read this first (CLAUDE.md §7), update it last. It stays short on purpose; the rest lives in:

| File | What's in it | How to use it |
| ---- | ------------ | ------------- |
| `docs/BACKLOG.md` | Work not started + carried debt + pre-launch checks | Pick from here when "Now" is empty |
| `docs/LESSONS.md` | Tool / environment gotchas, by topic | Read the section for what you're about to touch (Supabase, SPX, browser pane, e2e…) |
| `docs/DONE.md` | Every finished task with its verification notes | Grep it (`grep -n "SPX" docs/DONE.md`); don't read it whole (~150 KB) |

**Last full review:** 2026-10-16, against `master` `c6299b8` (PRs #1–#17 all merged).

---

## State of the world

- **Live:** `paranoidz.vn` (storefront) and `admin.paranoidz.vn` (admin) on Vercel, functions in `sin1`. Vercel deploys `master` to production on merge → **push a PR's migrations to prod before merging it**.
- **Databases:** prod `rbuoirnnroauzdjwwfij` (linked); test `paranoidz-test` `mnxbymkvectnvtcplrfj`. `apps/*/.env.local` point at **test**; prod values are in `apps/*/.env.prod.local`. Migrations go test → prod (workflow in `docs/LESSONS.md` § Supabase).
- **Catalog:** 10 real products live on prod (pdz01–pdz08 tees / polos + 2 socks, imported from BigSeller 2026-10-12). No collections yet. Product names are still the long Shopee titles.
- **Orders:** COD only. Admin creates the SPX shipment (one by one or in bulk), which also confirms a `pending` order; labels print from the admin; SPX's tracking webhook (`/api/spx/webhook`) moves orders to shipped / delivered / failed.
- **Checkout price:** server-side `quote_order()` / `place_order()` (first-5 vs promo vs bundle, best wins) **+ a flash-sale discount on top** (client's PR #12) + SPX live shipping fee, with the `shipping_rates` table as a fallback. **Production runs on SPX test keys right now: see Now #1.**
- **Messages:** order emails via Resend, new-order Zalo alert to the client, auth emails via Resend SMTP (templates still Supabase's defaults on prod, see "Waiting").
- **CI:** GitHub Actions on a fresh local Supabase. It runs admin + db unit tests, `smoke`, `smoke:inventory` and Playwright e2e (S1–S13, A1–A13). Green on `master`. `master` isn't protected.
- **Who commits:** the developer (`MinhTam2773`, with Claude) and the client **Tủn** (`tuanthanh971`), who sends storefront PRs directly (commit messages in Vietnamese without diacritics). Check `git log` for their work. It doesn't always reach this file.

## In progress: orders + customers Excel export (branch `claude/modest-visvesvaraya-c77e68`)

Spec: `docs/superpowers/specs/2026-10-17-orders-customers-excel-export-design.md`. No migration.

- [x] Row builders + paging helper (`apps/admin/src/lib/exports/`) with `node:test` unit tests
- [x] Server actions: orders (date range + tab + search) and customers (all / search), `requireAdmin()` first
- [ ] XUẤT EXCEL on `/orders` (inline Từ ngày / Đến ngày + TẢI FILE) and `/customers` (direct download)
- [ ] Playwright admin case A14 (orders file + customers file)
- [ ] Verify: admin unit tests, `next build`, e2e A14, both pages at 375px / 1280px, files opened by hand
- [ ] Send the spec's client questions to aT (owner)

## Now (in order)

1. [ ] **URGENT: production runs on SPX's *test* keys** (owner, 2026-10-17: prod keys not received from SPX yet). Seen on paranoidz.vn 2026-10-17: checkout for 1 tee to Hà Nội / Phường Ba Đình shows **"₫21 · Giá trực tiếp từ SPX"**, total ₫125.121. That's the test host's fake fee. `quoteShipping()` only rejects fees *above* 3 × table, and `place_order()` accepts anything from 0 to 3 × table, so a real order would be charged ₫21. TẠO ĐƠN SPX in the prod admin would create the shipment on SPX's test system: a fake tracking number and no real pickup. To do: (a) check prod orders for `shipping_fee` < ₫1.000 or a test-host tracking number; (b) stop using the test keys in Production (remove `SPX_*` from both Vercel projects' Production + redeploy, so checkout uses the table and shipments go on spx.vn by hand until the prod keys arrive); (c) code guard: a lower bound in `quoteShipping()` too (SPX fee < table ÷ 3 → table), and refuse a `test-stable` host when `VERCEL_ENV=production`. Then, once SPX sends prod keys: register `https://paranoidz.vn/api/spx/webhook` with SPX, watch one real order move by itself, and compare the first real SPX quotes with the table.
2. [ ] **DESIGN.md is stale: the client's live design wins** (owner, 2026-10-17). The client's PRs #6 / #8 / #9 / #10 / #12 replaced parts of DESIGN.md: one-row header (not two), hotline 0345 267 709 (not 0972 926 956), 1:1 product images (not 3:4), sale badge top-left (not top-right), ticker announcement bar, hero carousel. **Until DESIGN.md is rewritten, the live storefront code is the reference for storefront UI. Don't "fix" the site back to DESIGN.md.** Recommended: rewrite DESIGN.md from the current code in its own session.
3. [ ] **A2 (admin order lifecycle) is flaky in CI.** It passes on retry. Not looked at yet.

## Waiting on the client / owner (dashboard or content, no code)

- [ ] **Ask the client: is the flash sale meant to stack?** PR #12 (`20261016000002_flash_sale_pricing.sql`) makes `order_discount()` add an extra 10% during 6 daily 1-hour windows (0 / 9 / 12 / 15 / 18 / 21 h VN), **on top of** the first-5 / promo code / combo discount. Everything else in ARCHITECTURE.md §5 is "best one wins, never stacked", and checkout copy says "không cộng dồn". Example: a first-5 customer in a window gets 10% + 10%. Once answered: record the rule in ARCHITECTURE.md §5, fix the checkout copy if needed, add a smoke case. Also ask whether they want to edit the windows from the admin (today: rows in Supabase).
- [ ] **SPX production keys** (app-id / app-secret from SPX, then the client's account user-id / secret). Ask SPX to send them privately, not in a group chat. Then TODO "Now" #1.

- [ ] **Paste the auth email templates on prod.** In Authentication → Emails → Templates, for all 6: subject from `supabase/config.toml`'s `[auth.email.template.*]`, HTML from `supabase/templates/*.html`. Until then prod sends Supabase's default English emails, and the sign-up / reset links are the scanner-prone single-use ones (PR #17 only works with our templates). Then: do a real sign-up from a school / Outlook address, and remove ForgotPasswordForm's "Hãy mở liên kết trên trình duyệt này" line.
- [ ] **Test project auth (Owner role only):** custom SMTP like prod (separate Resend key `paranoidz-test-smtp`), the same templates with `[TEST] ` subjects, and the broken redirect entry. Delete it and add `https://*-minhtam2773s-projects.vercel.app/**`.
- [ ] **Collections `Outlet 2026` / `New collection`** (slugs `outlet-2026` / `new-collection`) in admin → Bộ sưu tập. Both nav links 404 on prod today, and the homepage collection cards stay hidden until active collections exist. The cards have never been seen with real data.
- [ ] **Categories** (Áo thun, Polo, Tất…) on prod, one per product.
- [ ] **Catalog content:** shorter product names, Vietnamese colour names, description / size guide. Decide what Sck1 ("[QUÀ TẶNG]" socks) is for.
- [ ] **Branding + Policy copy:** both are placeholders. Return terms are still in `[brackets]` in `app/policy/page.tsx`.
- [ ] **GitHub → Settings → Branches → protect `master`**, require the `test` check (PRs #7–#10 merged while CI was red).
- [ ] **First real BigSeller stock-out / stock-in upload:** watch that BigSeller accepts the Vietnamese headers (never tried). Press ĐÃ NHẬP VÀO BIGSELLER only after both files are accepted (`docs/BACKLOG.md` debt has the fallback).
- [ ] **SPX bank verification** (COD payouts) was still "Pending Verification" on 2026-10-15. Check before the first real order.
- [ ] **Secrets hygiene:** rotate the `paranoidz-test` DB password (it was shared in a chat) and update `supabase/.env.test.local`. Swap the legacy `service_role` JWT in the test `.env.local`s for an `sb_secret_` key.
- [ ] **Mail:** DKIM for the `paranoidz.vn` mailbox (ask the mail host). Move Resend to a client-owned account at handover.
- [ ] **Google / Facebook login are still in testing mode.** Publishing needs the steps in `docs/BACKLOG.md` → Features.

## Blocked — pending client decisions

ARCHITECTURE.md §8 items 3–7: voucher cap, loyalty gift notification + fulfilment, loyalty progress on the account page, CMS vs `site_content`, announcement bar management. **Do not implement** until resolved. (Voucher cap: `AUTO-FIRST5` is seeded uncapped, `cap_amount = null` in `supabase/seed.sql`; once decided, change it there and on prod, no migration needed.)

## Last session

- 2026-10-16: TODO.md split into this file + `docs/BACKLOG.md` / `docs/DONE.md` / `docs/LESSONS.md`. Every item was re-checked against `master` `c6299b8`. Stale entries were dropped; entries for the client's PRs #6–#12 were added to DONE.md from their commits (not re-verified).
- 2026-10-17: found prod checkout charging SPX test-host fees (₫21, Now #1). Owner decided the client's live design wins over DESIGN.md. Flash-sale stacking question parked for the client. CI on `3cd939a` failed once on a Google Fonts download during `next build` (Vercel built the same commit fine); re-ran it.
- 2026-10-17: scoped the orders + customers Excel export with the owner (spec `docs/superpowers/specs/2026-10-17-orders-customers-excel-export-design.md`, docs exception added). Not built. Its client questions are at the end of the spec; send them to aT.
