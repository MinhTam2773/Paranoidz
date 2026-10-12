# Zalo new-order alert — design

Date: 2026-10-12 · Status: approved, code first; live test waits on the client creating the bot

The client wants new-order alerts in Zalo.
The shop alert email (`lib/order-email.ts`, live since 2026-10-12) stays as the backup channel.

## Decisions (owner, 2026-10-12)

- **Channel: Zalo Bot Platform** (`bot.zapps.me`: bot token + `sendMessage`). Rejected: Zalo OA + ZNS
  (verified business OA, approved templates, per-message fee, OAuth token refresh every ~25 h — built
  for messaging customers, too heavy for one recipient); unofficial personal-account libraries such as
  zca-js (break Zalo's terms, the account can be banned).
- **Zalo is the instant alert channel**; the client email alert stays.
- **Recipient: the client only** — one `chat_id`.
- **Content: full summary** — the client's next step is calling the customer, so the message carries
  everything needed for that call.
- **Code ships before the bot exists.** The client can't create the bot yet; with the env vars unset the
  alert is skipped and checkout is unaffected.

## Zalo Bot API (from the official docs, checked 2026-10-12)

- Create: in the Zalo app open the OA **Zalo Bot Manager** → **Tạo bot**; the name must start with
  "Bot" (e.g. "Bot Paranoidz"). The bot token arrives as a Zalo message to the creator.
- Send: `POST https://bot-api.zaloplatforms.com/bot<BOT_TOKEN>/sendMessage`, JSON
  `{ chat_id, text }`, text 1–2000 characters. Optional `parse_mode` (`markdown` / `html`) — not used.
- `chat_id`: the recipient messages the bot once; `POST …/getUpdates` (long polling, only works while no
  webhook is set) returns the message with the sender's chat id. No webhook is needed — we only send.
- Plans: a free version and paid versions exist; the pricing page returned HTTP 500 on 2026-10-12, so
  the free-plan limits are unverified. Expected volume (~10–20 orders/day) should be small.

## Flow

```
placeOrder (apps/storefront/src/app/checkout/actions.ts)
  → place_order() RPC succeeds
  → after(() => sendOrderEmails(order.order_id))   // existing
  → after(() => sendZaloAlert(order.order_id))     // new
  → response returns to the customer immediately
sendZaloAlert
  → env missing → log "skipped", return
  → read order + items with the service-role client
  → POST sendMessage; any failure (network, non-2xx, Zalo `ok: false`) is logged only, no retry
```

The order is never affected by the alert.

## Components

- **New `apps/storefront/src/lib/order-zalo.ts`** — `sendZaloAlert(orderId: string)`. Own query (one
  extra small read per order) so the working email module stays untouched; sharing the query would mean
  refactoring `sendOrderEmails` for no real gain. Plain `fetch`, no new dependency. Errors caught and
  logged, same pattern as `order-email.ts`.
- **`checkout/actions.ts`** — one added `after(...)` line next to the email one.
- **Env (server-only, never `NEXT_PUBLIC_`)** — `ZALO_BOT_TOKEN`, `ZALO_OWNER_CHAT_ID`, documented in
  `apps/storefront/.env.example`. Either unset → no alert. In Vercel: production only, Sensitive (previews
  don't alert the client, same as `ORDER_ALERT_EMAIL`).

## Message

Plain text (no `parse_mode`, so customer-typed names and notes need no escaping). Prices via
`formatVnd`. Lines in this order; bracketed lines appear only when there is a value:

```
🛒 ĐƠN MỚI PZ-2026-0074
Nguyễn Văn A · 0901234567 [/ 0907654321]
<address>, <ward>, <city>
─────
2 × Áo thun Paranoid (Đen / L)
1 × Quần cargo (Xám / M)
─────
Tạm tính ₫738.000 · [Giảm −₫73.800 · ]Ship ₫30.000
THU COD: ₫694.200
[Ghi chú: Giao giờ hành chính]
https://admin.paranoidz.vn/orders/PZ-2026-0074
```

Item variant in parentheses is `color / size`, whichever exist. Text longer than 2000 characters is cut
to 2000 (only a very large cart could hit it).

Privacy: name, phone and address land in the client's own Zalo chat — the same data the admin shows.

## Verification

Before the bot exists:
- Lint, typecheck, build green.
- Scratch script (not committed, read-only on the DB): message text for sample orders; the real order query; env unset → skip line; fake token → logged failure. No test orders are placed before the bot exists.

After the client creates the bot:
1. Token → `apps/storefront/.env.local` + Vercel production (Sensitive).
2. Client sends the bot any message; run `getUpdates` once, read `chat_id` → same places.
3. Client checks the free-plan limits on `bot.zapps.me`.
4. Place a real test order (local, then live) → alert arrives in the client's Zalo with correct content;
   cancel + delete the test order, restore stock / AUTO-FIRST5.

## Docs touched

- `ARCHITECTURE.md` §1 stack table and §4 step 4: client alert channel is Zalo Bot.
- `TODO.md`: Zalo item with the client setup steps; the carried-debt note on alert channels
  is updated.
