# Customer returns (trả hàng) — design

Status: **approved by the owner 2026-11-13.** PR 1 (schema + functions): #99 on `claude/lucid-meitner-m4bzh1`. PR 2 (storefront): `feat/returns-storefront`.

## Decisions (owner, 2026-11-13)

| Question | Answer |
| -------- | ------ |
| Who starts a return | The customer, online (no more hotline-only) |
| Return or exchange | **Return + refund only.** Exchanges (đổi size / mẫu) stay by hotline for now |
| Conditions | Not washed, tags not removed: the customer ticks both and uploads 1–5 photos showing the tags. Admin checks the goods when they arrive |
| How goods come back | **The shop books an SPX pickup** from the customer's address |
| Return shipping | **The shop pays** for a return. (Exchanges, where the customer pays, are out of scope) |
| Refund | COD and bank-transfer orders alike: **the admin contacts the customer and transfers the money by hand**, then records it. The site never asks for bank details |

Kept from `/policy#returns`: 7 days from delivery.

## Flow

```
customer                      admin                               SPX
--------                      -----                               ---
/order-lookup (number+phone)
  or /account order history
→ "Yêu cầu trả hàng"
  pick items + qty, reason,
  tick 2 conditions, 1–5 photos
                     ──→ requested ── Từ chối ──→ rejected (note shown to customer)
                                     └ Duyệt ──→ approved
                                                  └ Tạo đơn lấy hàng SPX ──→ pickup_booked ──→ parcel picked up / delivered to shop
                                                                                └ Đã nhận hàng:
                                                                                    Đạt     → received (stock restored)
                                                                                    Không đạt → rejected (no restock; admin sends it back by hand)
                                                  received ── Đã hoàn tiền (amount, note) ──→ refunded
requested / approved / pickup_booked ── Huỷ (admin) ──→ cancelled
```

The customer sees the current step on the order lookup page (and in the account's order history).

## Rules

- **Eligible order:** status `delivered`, and the `delivered` row in `order_status_history` is at most **7 days** old when the request is sent. Payment method doesn't matter.
- **One open request per order** (`requested`, `approved`, `pickup_booked`). After one closes, another may be sent while the 7 days last, for items not yet returned.
- **Items:** any non-gift line, qty ≤ ordered qty minus qty already in non-rejected, non-cancelled requests. Gift lines (`is_gift`, the free sock) are not selectable; the customer is asked to send the gift back with the items (text only, not enforced).
- **Reasons:** `defect` (Lỗi sản phẩm), `wrong_item` (Giao sai mẫu / size), `not_as_described` (Không giống mô tả), `other` (Khác, note required). Note ≤ 500 chars.
- **Photos:** 1–5, jpg / png / webp, 5 MB each like review photos (no browser compression on the storefront), stored in media bucket `return-images` (R2 in production, Supabase Storage locally) under `<order_id>/<uuid>.<ext>`. Public like review photos: the URL is an unguessable uuid, not a secret (R2's public domain has no private reads).
- **Refund amount (suggested, admin can change):** Σ(`price_snapshot` × returned qty) minus the order's code discount split pro rata over the paid lines. Shipping isn't refunded. The admin types the final amount and a note (e.g. bank reference) when marking `refunded`.
- **Order status doesn't change.** `delivered` stays terminal (ARCHITECTURE.md §4); returns live in their own tables.
- **Not changed (carried debt):** the per-phone delivered counter / loyalty milestone, Meta / Google conversions, revenue in the admin dashboard and the Excel export still count a returned order as sold.

## Data (one migration)

```sql
create type public.return_status as enum
  ('requested', 'approved', 'rejected', 'pickup_booked', 'received', 'refunded', 'cancelled');

create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  status public.return_status not null default 'requested',
  reason text not null check (reason in ('defect','wrong_item','not_as_described','other')),
  note text check (char_length(note) <= 500),
  not_washed boolean not null check (not_washed),
  tags_attached boolean not null check (tags_attached),
  admin_note text,                     -- shown to the customer when rejected
  spx_tracking_no text unique,         -- pickup shipment
  refund_amount numeric(12,0) check (refund_amount >= 0),
  refund_note text,
  created_at timestamptz not null default now(),
  received_at timestamptz,
  refunded_at timestamptz
);
create unique index return_requests_one_open on public.return_requests (order_id)
  where status in ('requested','approved','pickup_booked');

create table public.return_items (
  return_id uuid references public.return_requests(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete restrict,
  qty int not null check (qty > 0),
  primary key (return_id, order_item_id)
);

create table public.return_images (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.return_requests(id) on delete cascade,
  storage_path text not null
);

create table public.return_status_history (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.return_requests(id) on delete cascade,
  status public.return_status not null,
  note text,
  created_at timestamptz not null default now()
);
```

RLS on all four: no anon / authenticated access; the storefront and admin go through the service role in server actions, like order lookup (guests have no session).

Functions (SECURITY DEFINER, `service_role` only):

- `request_return(p_order_number, p_phone, p_reason, p_note, p_not_washed, p_tags_attached, p_items jsonb, p_image_paths text[])` — re-checks every rule above inside one transaction (row lock on the order), inserts the request, items, images and the first history row. Returns the request id. Errors: `NOT_ELIGIBLE`, `WINDOW_CLOSED`, `OPEN_REQUEST`, `BAD_ITEMS`, `CONDITIONS`.
- `transition_return(p_return_id, p_new_status, p_note, p_spx_tracking_no, p_refund_amount)` — the only way the status changes (like `transition_order_status()`); valid moves as in the flow above. **`→ received` restores stock**: `update product_variants set stock = stock + qty` per returned line, inside the function. Admin-only (`is_admin()` check, like `transition_order_status`).

**This adds a third function that mutates stock.** CLAUDE.md §4 and ARCHITECTURE.md list the allowed ones; both get `transition_return()` added once this design is approved.

## SPX pickup

No return endpoint in SPX's Open API (25 pages read 2026-10-14). A pickup is an ordinary **Create Order (1.2)** with the addresses swapped: sender = the customer (order's name, phone, address, ward, city), receiver = the shop (`SPX_SENDER_*`), `cod_collection` 0, insured value = suggested refund, weight from the returned variants. Built by a new `returnBody()` next to `packages/db/src/spx/order-body.ts`; the tracking number goes to `return_requests.spx_tracking_no`.

**To verify on SPX's test host before building the admin part:** that Create Order accepts a customer address as sender, how the pickup slot works for it, and what the webhook sends for that tracking number (our `/api/spx/webhook` must ignore return shipments instead of looking for an order with that number). If SPX refuses, fall back to: the admin books the pickup in SPX's own app and types the tracking number.

## Pages

Storefront (Vietnamese, DESIGN.md tokens):
- `/order-lookup` result and `/account` order history: a **YÊU CẦU TRẢ HÀNG** button on eligible orders ("Còn N ngày để yêu cầu trả hàng"), and the current return status when one exists.
- The form opens in place on `/order-lookup` after a successful lookup (number + phone stay in the page's memory, never in a URL; the account's order history links to the lookup with the number filled in): items with qty steppers, reason, note, the two checkboxes, photo picker (1–5), the return policy summary, **GỬI YÊU CẦU**. Rate limit scope `return` (ip 30 / phone 15 per hour: each photo ticket and the submit count).
- `/policy#returns`: rewritten to match (7 days, conditions, photos, shop books SPX pickup and pays it, refund by transfer within 3–5 working days after the goods arrive, exchanges by hotline).

Admin (DASHBOARD_DESIGN.md):
- **Trả hàng** in the sidebar: list with status tabs (Chờ duyệt, Đã duyệt, Chờ lấy hàng, Đã nhận, Đã hoàn tiền, Từ chối / Huỷ), count badge on Chờ duyệt.
- Return detail: order link, customer, items, reason, note, photos (lightbox), history; buttons for the next steps; refund form with the suggested amount.
- Order page: a "Trả hàng" card when the order has requests.

Notifications: a Zalo alert to the client on each new request (same bot as orders). No customer emails in v1; the customer sees the status on the lookup page.

## Build order (one PR each, `test` green before the next)

1. **Schema + functions** — migration, types, smoke cases: eligible / window closed / gift line / qty too high / second open request / `received` restores stock exactly once / non-admin refused.
2. **Storefront** — request form + status on lookup and account, photo upload, policy text, Zalo alert. e2e: request a return on a delivered order, see "Chờ duyệt".
3. **Admin** — list, detail, approve / reject / cancel / receive / refund. e2e: full happy path to `refunded` with stock checked.
4. **SPX pickup** — after the test-host check above; webhook ignores return tracking numbers.

Done when: the 4 PRs are merged, migrations on test then prod, and one real-shaped return run end to end on `paranoidz-test` (request → approve → pickup booked on SPX's test host → received → refunded) with stock back.
