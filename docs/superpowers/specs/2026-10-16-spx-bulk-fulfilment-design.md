# SPX bulk fulfilment + no confirmation call — design

Date: 2026-10-16 · Status: built and verified on the SPX test host (branch `feat/spx-bulk-fulfilment`); labels: one call, no chunking needed

The client wants two things:
1. **Print shipping labels for many orders at once.**
2. **Stop calling customers to confirm orders** ("không muốn làm phiền khách"). Order tracking through
   SPX is already built (webhook, PR #7) — only its production registration is unverified (see Out of scope).

## Decisions (owner, 2026-10-16)

- **Keep `pending`; creating the SPX shipment is what confirms an order.** No phone call. The order moves
  `pending → confirmed` when its SPX shipment is created. Rejected: creating orders as `confirmed` at
  checkout (needs a `place_order()` migration and breaks the "3 open `pending` orders per phone" limit).
- **The manual "Xác nhận đơn" button is removed.** Creating an SPX shipment is the only way an order gets
  confirmed. The manual "Đánh dấu đang giao" / "Đánh dấu đã giao" / "Giao thất bại" buttons stay (fallback
  when an SPX webhook never arrives).
- **Bulk create + print from `/orders`.** The client ticks orders, picks one pickup slot, and gets the
  shipments created and one label document opened.
- **Status labels (both apps):** `pending` = **Đã tiếp nhận**, `confirmed` = **Đã tạo vận đơn**.
- **No database migration.** The enum, valid transitions and the per-phone pending limit are unchanged.

## Trade-off accepted

ARCHITECTURE.md §6 names the confirmation call as the backstop against fake COD orders and addresses SPX
doesn't serve. Without it the remaining defences are the rate limits, the blacklist, the 20-unit cap and
the admin looking at each order before ticking it. A refused parcel costs the shop SPX's return fee.

## 1. Confirmation = SPX shipment

`apps/admin/src/app/(shell)/orders/[number]/actions.ts`

- `createSpxShipment(orderId, ward, slot)` accepts an order that is `pending`, or `confirmed` with no
  tracking number (orders confirmed before this change). Anything else keeps today's stale-page error.
- After the tracking number is saved (the existing `.is("spx_tracking_no", null)` guard stays), a
  `pending` order is moved to `confirmed` with `transition_order_status()`. If that call fails, the
  shipment is **kept** (not cancelled): the order shows its tracking number, and the SPX webhook walks it
  forward from `pending` later (`stepsTo` already includes `pending`). The action returns an error saying
  the shipment exists but the status didn't change.
- The create logic is split into an internal function `createShipment(admin, orderId, ward, slot)` that
  returns `{trackingNo} | {error}`, so the single-order action and the bulk action share it.

`apps/admin/src/lib/order-status.ts`

- `ORDER_ACTIONS.pending` = `{ secondary: [CANCEL] }` (no primary).
- `STATUS_LABEL.pending` = "Đã tiếp nhận", `STATUS_LABEL.confirmed` = "Đã tạo vận đơn".
- `confirmed.primary` ("Đánh dấu đang giao") body unchanged.

`apps/admin/src/components/orders/SpxCard.tsx`

- A `pending` order without a shipment shows the create form (ward + slot + TẠO ĐƠN SPX), the same as a
  `confirmed` one; the "Xác nhận đơn trước khi tạo đơn SPX." line goes.

## 2. Bulk actions on `/orders`

`apps/admin/src/app/(shell)/orders/page.tsx` + a new client component `components/orders/BulkBar.tsx`.

- Checkboxes on the **Đã tiếp nhận** (`pending`) and **Đã tạo vận đơn** (`confirmed`) tabs only, on the
  table (first column, header checkbox = select all on the page) and the mobile cards. Selection is the
  current page (≤ 20 orders). Other tabs and "Tất cả" render as today.
- When at least one row is ticked, a sticky bar at the bottom shows the count and:
  - **Đã tiếp nhận tab:** pickup slot select (SPX 1.1, next 3 days, earliest selected; loaded server-side
    under `<Suspense>` only on this tab; if SPX doesn't answer, the bar says so and the button is
    disabled) + **TẠO ĐƠN SPX & IN PHIẾU (n)**.
  - **Đã tạo vận đơn tab:** **IN PHIẾU (n)** — orders without a tracking number are not selectable.
- The label tab is opened inside the click (`window.open("", "_blank")`, as `SpxLabelButton` does) and
  pointed at the label link when it arrives, or closed on failure.

Server actions (same `actions.ts` or a sibling `apps/admin/src/app/(shell)/orders/actions.ts`):

- `createSpxShipments(orderIds: string[], slot: string)` → `requireAdmin()`; ≤ 20 ids; for each order the
  ward is `matchWard(order.ward, wards of its SPX province)` (orders placed since the checkout ward picker
  match exactly; older typed wards may not); no match → skipped with "Không khớp phường / xã SPX — tạo
  ở trang đơn". Matched orders go through
  `createShipment` with a concurrency of 4. Then one label call for every tracking number created.
  Returns `{ url?: string, created: string[] /* order numbers */, failed: { orderNumber, reason }[] }`.
- `getSpxLabels(orderIds: string[])` → `requireAdmin()`; ≤ 20 ids; tracking numbers of those orders;
  one `batch_get_shipping_label` call; `{ url?: string, error?: string }`.
- `revalidatePath("/", "layout")` after creation (list, badge, dashboard).

After a run the bar is replaced by a results panel: "Đã tạo n vận đơn", and each failure as
"PZ-2026-0041 — <reason>" linking to the order. If shipments were created but the label call failed, the
panel says so and points to the Đã tạo vận đơn tab to reprint.

**To check on the SPX test host before building the bar:** does one `batch_get_shipping_label` call with
several tracking numbers return one link containing every label, and what is its list limit? If the
limit is below 20, labels are fetched in chunks and the panel shows one "Mở phiếu" link per chunk
(only the first can open automatically — popup blockers allow one tab per click).

## 3. Copy

Storefront:
- `lib/order-status.ts`: `pending` → "Đã tiếp nhận" / "Chúng tôi đã nhận đơn và đang chuẩn bị hàng.";
  `confirmed` → "Đã tạo vận đơn" / "Đơn đã được đóng gói, chờ SPX đến lấy hàng."
- `components/checkout/CheckoutView.tsx` success screen and `lib/order-email.ts`: no call; "Chúng tôi sẽ
  chuẩn bị và giao hàng. Bạn thanh toán bằng tiền mặt khi nhận hàng (COD)." (exact sentence in the plan).
- `app/checkout/actions.ts` "3 đơn đang chờ gọi xác nhận" → "Số điện thoại này đã có 3 đơn đang được xử
  lý. Vui lòng chờ hoặc gọi {HOTLINE}." ; `lib/checkout-validation.ts` phone hint → "Nhập số điện thoại để
  chúng tôi giao hàng."

Admin:
- Dashboard tile "Chờ xác nhận" and sidebar badge `aria-label` → "Đơn mới".
- `/inventory/export`: "Đơn đã xác nhận" → "Đơn đã tạo vận đơn"; "đang chờ xác nhận … sau khi xác nhận" →
  "đơn mới chưa tạo vận đơn: sẽ được xuất sau khi tạo vận đơn".

Not changed: the Zalo alert text, `supabase/templates/confirmation.html` and `email_not_confirmed`
(account-email confirmation, unrelated), the email subject "Xác nhận đơn hàng" (it is a receipt).

## 4. Docs

- ARCHITECTURE.md §4: `pending` = "Submitted, awaiting SPX shipment", `confirmed` = "SPX shipment created";
  step 5 = admin creates the SPX shipment (single or bulk) → `confirmed` → SPX picks up → webhook.
  §5 "SPX Open API" Fulfilment: from `pending`; bulk; no call. §6: replace the confirmation-call backstop
  with the accepted trade-off above.
- DASHBOARD_DESIGN.md §6.2: bulk selection + bar + results panel; order detail without "Xác nhận đơn".
- TODO.md: this feature; a separate item "verify the SPX webhook URL is registered in production and a
  real callback arrived" (no record exists).

## 5. Testing

- Unit (`apps/admin/tests`): `ORDER_ACTIONS.pending` has no primary action; the bulk ward-matching step
  (matched / skipped) as a pure function.
- E2E: A2 (`e2e/tests/admin/orders.spec.ts`) starts from an order moved to `confirmed` with the service
  role (CI has no SPX keys) and checks a `pending` order shows no "Xác nhận đơn"; account and checkout
  specs use the new labels. Note: `feat/e2e-round-2` (unmerged) also edits e2e — rebase on whichever
  merges first.
- Manual on the SPX test host: bulk-create 3 `pending` orders, one with a ward that doesn't match → 2
  shipments, both orders `confirmed`, one label link opens with both labels, the third is listed with the
  reason; reprint from Đã tạo vận đơn; single-order create from a `pending` order page; 375 px + 1280 px.

## Delivery

Branch `feat/spx-bulk-fulfilment`, one feature, two commits:
1. Confirmation via SPX shipment + copy + docs (sections 1, 3, 4).
2. Bulk bar on `/orders` (section 2).

## Out of scope

- SPX webhook production registration — verify separately (TODO item above).
- Bulk actions across pages, bulk cancel, bulk "đang giao".
