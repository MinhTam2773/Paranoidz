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
- **Checkout price:** server-side `quote_order()` / `place_order()` (first-5 vs promo vs bundle, best wins) **+ a flash-sale discount on top** (client's PR #12) + SPX live shipping fee, with the `shipping_rates` table as a fallback.
- **Messages:** order emails via Resend, new-order Zalo alert to the client, auth emails via Resend SMTP (templates still Supabase's defaults on prod, see "Waiting").
- **CI:** GitHub Actions on a fresh local Supabase. It runs admin + db unit tests, `smoke`, `smoke:inventory` and Playwright e2e (S1–S13, A1–A13). Green on `master`. `master` isn't protected.
- **Who commits:** the developer (`MinhTam2773`, with Claude) and the client **Tủn** (`tuanthanh971`), who sends storefront PRs directly (commit messages in Vietnamese without diacritics). Check `git log` for their work. It doesn't always reach this file.

## Now (in order)

1. [ ] **Confirm SPX is really live in production.** (a) Vercel storefront Production has all `SPX_*` vars since 2026-10-16, but the values can't be read back. Confirm they are SPX's **production** app keys + the client's account (not the test host), and that the admin project has them too. (b) Is `https://paranoidz.vn/api/spx/webhook` registered with SPX? Has a real callback arrived? Watch one real order move by itself. (c) Compare the first real SPX quotes with the `shipping_rates` table (the `place_order()` bound is 3 × table). If the checkout card says "Theo bảng giá chuẩn", SPX isn't answering (`docs/SPX_VERCEL_SETUP.md`).
2. [ ] **Flash sale isn't in the specs.** PR #12 (`20261016000002_flash_sale_pricing.sql`) makes `order_discount()` add an extra 10% during 6 daily windows, **stacked on top of** the voucher / bundle discount. ARCHITECTURE.md §5 says discounts never stack. Ask the owner to confirm stacking is intended, then record it in ARCHITECTURE.md §5 and add a smoke case. The windows have no admin UI (rows are edited in Supabase).
3. [ ] **DESIGN.md is behind the live storefront** after the client's PRs #6 / #8 / #9 / #10 / #12. Examples: DESIGN.md still describes a two-row header, hotline 0972 926 956, 3:4 images and a top-right sale badge; the site has a one-row header, 0345 267 709, 1:1 images and a top-left badge. Agree with the owner which one is right, then update DESIGN.md (it's "law" for UI work).
4. [ ] **A2 (admin order lifecycle) is flaky in CI.** It passes on retry. Not looked at yet.

## Waiting on the client / owner (dashboard or content, no code)

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
