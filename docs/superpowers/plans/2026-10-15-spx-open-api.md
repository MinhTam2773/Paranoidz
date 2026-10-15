# SPX Open API Implementation Plan

**Goal:** Replace the manual spx.vn step: the admin creates the SPX shipment and prints the label from the Paranoidz order page (phase 1), checkout shows SPX's live fee including SPX vouchers (phase 2), and SPX's tracking webhook moves order statuses (phase 3). Decisions: ARCHITECTURE.md §5 "SPX Open API" (2026-10-15).

**Branch:** `feat/spx-open-api`. One phase per session (CLAUDE.md §5); merge after each phase is verified on the test environment.

**API facts (docs read 2026-10-14/15, `https://spx.vn/integration`):** all calls `POST {{host}}/open/api/…`, JSON, headers `app-id` / `timestamp` (s) / `random-num` (int64) / `check-sign` = hex HMAC-SHA256(app-secret, `<app-id>_<timestamp>_<random-num>_<body>`). Response `{ret_code, message, data}`, `ret_code 0` = success; batch calls also return `data.fail_list[]` with per-item `ret_code` / `message` / `debug_msg`. Test host `https://test-stable.spx.vn/` (app keys verified 2026-10-14 with 5.1). Endpoints used:

| # | Path | Phase |
| - | ---- | ----- |
| 1.1 Get pickup timeslot | `v1/order/get_pickup_time` `{user_id, user_secret, service_type: 1}` → `[{date, pickup_time, slots:[{pickup_time_range_id, pickup_time_range}]}]` | 1 |
| 1.2 Create order | `v1/order/batch_create_order` `{user_id, user_secret, orders:[…]}` → `orders[].tracking_no`, fee parts | 1 |
| 1.4 Cancel order | path to confirm in the docs `{…, tracking_no_list}` | 1 |
| 1.5 Get AWB | `v1/order/batch_get_shipping_label` `{…, tracking_no_list}` → `awb_link` (30 min, 10 opens) | 1 |
| 1.10 List voucher | `v1/order/list_voucher` → `vouchers[]` (code, % / fixed, cap, min_spend, valid window) | 2 |
| 2.1 Check shipping fee | `v1/order/batch_check_order` → `estimated_shipping_fee` + parts, `edt_min/max` | 2 |
| 3.2 Check credentials | `v1/account/verify` → `match_result` | 1 (setup check) |
| 4.1 Tracking webhook | SPX → our URL | 3 |

Create-order body per order (VN, address version 2): `order_id` (our order number, ≤ 32), `base_info.service_type 1`, `sender_info` {state, city (= ward), name, phone, detail_address, address_version 2}, `fulfillment_info` {payment_role 1, cod_collection 1, cod_amount = total (≤ ₫20.000.000), high_value_processing_collection = insured ≥ ₫3.000.000 ? 1 : 0, collect_type 1, pickup_time, pickup_time_range_id, voucher_code?}, `deliver_info` {state, city (= ward), name, phone, detail_address, instruction = note, address_version 2}, `parcel_info` {parcel_weight = 0.3 × units kg (≤ 17), parcel_item_name, parcel_item_quantity, express_insured_value = subtotal}.

---

## Phase 1 — create shipment + print label from the admin

### Task 1: SPX client (admin)
- `apps/admin/src/lib/spx/sign.ts` — pure `checkSign(appId, secret, timestamp, random, body)`.
- `apps/admin/tests/spx/sign.test.ts` — the docs' test vector: app-id `100000`, secret `H25HY53GO4BA2GQ`, timestamp `1677918414`, random `926611981`, body `{"user_id":239404781503925,"user_secret":"85f0d570-a265-4d9d-857e-b30aa57c4fbe","service_type":1}` → `97e21b23940e4ddc96fb4d2474f02425353d2b0e23aee384f3f94c3d0b9ba17d`.
- `apps/admin/src/lib/spx/client.ts` — `import "server-only"`; `spxCall(path, body)` reads `SPX_API_HOST` / `SPX_APP_ID` / `SPX_APP_SECRET`, serializes the body once and signs that exact string, 15 s timeout, throws `SpxError(retCode, message)` unless `ret_code === 0`; `spxUserCall(path, body)` adds `user_id` / `user_secret`. The user id is a 15-digit integer: within `Number.MAX_SAFE_INTEGER`, so plain JSON is fine (assert it in the client).
- Verify: `pnpm --filter admin test`; live 5.1 + (after the test account exists) 3.2 through the client.

### Task 2: SPX locations in the database
- Migration: `spx_locations (province text, ward text, primary key (province, ward))`, RLS on, public read (it is SPX's public address list). Seeded by a script (`packages/db/scripts/spx-locations.ts`) from SPX's public `shipment/merchant/open/location/get_sub_location_layer_info?…&address_version=2` (34 provinces → wards) — or from the 5.1 address file if SPX sends it (its `uat.spx.vn` link answers 403 from outside).
- Province mapping: our `lib/provinces.ts` names ("TP. Hồ Chí Minh", "Hà Nội") ↔ SPX's ("Thành phố Hồ Chí Minh", "Thành phố Hà Nội", "Tỉnh Cao Bằng"): add an `spx` name per province, checked by a test that every one of the 34 exists in `spx_locations`.
- Verify: row counts per province; the shop's ward "Phường Phú Thạnh" exists under HCMC.

### Task 3: order columns + write path
- Migration: `orders.spx_tracking_no text unique`, `spx_ward text`, `spx_fee numeric(12,0)` (SPX's estimate at creation, for comparison with `shipping_fee`), `spx_created_at timestamptz`. Written only by the admin server action with the service role after `requireAdmin()`; never by a browser.
- Smoke: anon / customer can't update them.

### Task 4: admin UI (DASHBOARD_DESIGN.md order detail — add the "Vận chuyển SPX" card spec first)
- Order `confirmed`, no tracking: ward picker (SPX wards of the order's province, pre-selected when the typed ward matches after accent-insensitive comparison), pickup slot select (1.1, loaded on open), **TẠO ĐƠN SPX** → server action → 1.2 → store tracking + fee. `fail_list` messages shown in Vietnamese with SPX's text as detail.
- With tracking: tracking number + SPX tracking link, SPX fee vs fee charged, **IN PHIẾU** → server action → 1.5 → `window.open(awb_link)`.
- Cancel / delivery-failed buttons: when cancelling an order with a tracking number, call 1.4 first; if SPX refuses (already picked up), stop and say so.
- Verify on the test environment end to end: create → label opens → cancel; 375 px + 1280 px.

---

## Phase 2 — live fee at checkout (storefront)
- Move the SPX client to a shared place both apps can import (second call site).
- `quoteShipping(province, ward, units)` → 1.10 vouchers (cached a few minutes) → best valid voucher → 2.1; on any error / > 3 s → `shipping_fee()` table. Returns `{fee, voucherCode, source: 'spx' | 'table'}`.
- Checkout ward → picker from `spx_locations`; saved addresses get the same picker.
- `place_order()` gains `p_shipping_fee` + `p_spx_voucher` (service-role only caller; NULL → table fee); sanity bound against the table (e.g. 0 ≤ fee ≤ 3 × table) so a bug can't charge nonsense. Smoke cases.
- Stored voucher code reused by phase 1's create call.

## Phase 3 — tracking webhook
- Route `apps/admin/src/app/api/spx/webhook/route.ts` (verify SPX's signature per 4.1 docs), map 2001 → `shipped`, 4001 → `delivered`, 6001/6003 → `delivery_failed` via `transition_order_status()`; idempotent; register the URL with SPX.

## Prerequisites (owner / client)
- Test seller account: 3.1 Create Account on the test host (owner runs it) → `SPX_USER_ID` / `SPX_USER_SECRET` in `apps/admin/.env.local`.
- Production: app-id / app-secret from SPX (privately), the client's account user id + secret key, bank verification finished (COD payouts).
