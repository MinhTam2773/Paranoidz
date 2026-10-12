# Zalo New-Order Alert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After every placed order, send the client a plain-text order summary in Zalo via the Zalo Bot Platform, without ever affecting the order.

**Architecture:** New `apps/storefront/src/lib/order-zalo.ts` (`sendZaloAlert(orderId)`), scheduled from `placeOrder` with `after()` next to the existing `sendOrderEmails`. It reads the order + items with the service-role client, builds the text (`zaloAlertText`), and POSTs `sendMessage`. Env unset → skip; any failure → log only. Spec: `docs/superpowers/specs/2026-10-12-zalo-order-alert-design.md`.

**Tech Stack:** Next.js 16 server action + `after()`, `@paranoidz/db/admin`, plain `fetch`. No new dependency.

**Testing note:** the repo has no test runner, and adding one is out of scope (CLAUDE.md §6.5). The text builder and the order query are checked with a scratch script (not committed) that loads the TS module through `jiti@2.7.0`, which tailwind already installs. The real send is tested once the client has created the bot (spec → Verification).

**Known API behaviour (probed 2026-10-12):** Zalo answers errors with **HTTP 200** and `{"ok":false,"description":"Not Found","error_code":404}` (fake token). Success must be judged by the JSON `ok` field, not by `res.ok` alone.

---

### Task 1: `order-zalo.ts` — text builder + sender

**Files:**
- Create: `apps/storefront/src/lib/order-zalo.ts`

- [ ] **Step 1: Write the module**

```ts
import { createAdminClient } from "@paranoidz/db/admin";
import { formatVnd } from "@/lib/format";

// New-order alert to the client's Zalo (ARCHITECTURE.md §4 step 4) via the Zalo Bot Platform
// (bot.zapps.me). Called from after() like the order emails: unset env or a failed send is only
// logged, never touches the order. Plain text (no parse_mode) so customer-typed text needs no escaping.
const ADMIN_URL = "https://admin.paranoidz.vn";
const MAX_TEXT = 2000; // sendMessage limit

type Order = {
  order_number: string; recipient_name: string; phone: string; secondary_phone: string | null;
  address: string; ward: string | null; city: string; note: string | null;
  subtotal: number; discount: number; shipping_fee: number; total: number;
  order_items: { name_snapshot: string; color_snapshot: string | null; size_snapshot: string | null; qty: number }[];
};

export function zaloAlertText(o: Order) {
  const items = o.order_items.map((i) => {
    const variant = [i.color_snapshot, i.size_snapshot].filter(Boolean).join(" / ");
    return `${i.qty} × ${i.name_snapshot}${variant ? ` (${variant})` : ""}`;
  });
  const totals = [
    `Tạm tính ${formatVnd(o.subtotal)}`,
    o.discount ? `Giảm −${formatVnd(o.discount)}` : "",
    `Ship ${formatVnd(o.shipping_fee)}`,
  ].filter(Boolean).join(" · ");
  return [
    `🛒 ĐƠN MỚI ${o.order_number}`,
    `${o.recipient_name} · ${[o.phone, o.secondary_phone].filter(Boolean).join(" / ")}`,
    [o.address, o.ward, o.city].filter(Boolean).join(", "),
    "─────", ...items, "─────",
    totals,
    `THU COD: ${formatVnd(o.total)}`,
    o.note ? `Ghi chú: ${o.note}` : "",
    `${ADMIN_URL}/orders/${encodeURIComponent(o.order_number)}`,
  ].filter(Boolean).join("\n").slice(0, MAX_TEXT);
}

export async function sendZaloAlert(orderId: string) {
  const token = process.env.ZALO_BOT_TOKEN;
  const chatId = process.env.ZALO_OWNER_CHAT_ID;
  if (!token || !chatId) return console.warn("ZALO_BOT_TOKEN / ZALO_OWNER_CHAT_ID unset: Zalo alert skipped");

  const { data, error } = await createAdminClient().from("orders")
    .select("order_number, recipient_name, phone, secondary_phone, address, ward, city, note, subtotal, discount, shipping_fee, total, order_items(name_snapshot, color_snapshot, size_snapshot, qty)")
    .eq("id", orderId).single();
  if (error) return console.error("zalo alert: order not readable", orderId, error);

  try {
    const res = await fetch(`https://bot-api.zaloplatforms.com/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: zaloAlertText(data as Order) }),
    });
    // Zalo reports errors as HTTP 200 + { ok: false }: judge by the body, not the status.
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    if (!body?.ok) console.error("zalo alert failed", data.order_number, res.status, body);
  } catch (sendError) {
    console.error("zalo alert failed", data.order_number, sendError);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter storefront exec tsc --noEmit`
Expected: no errors.

### Task 2: Scratch check of text + query + failure paths (not committed)

**Files:**
- Create (scratchpad, outside the repo): `zalo-check.mjs`, `empty.mjs` (`export {}`)

- [ ] **Step 1: Write the script**

```js
// node --env-file=C:/Programming/Paranoidz/apps/storefront/.env.local zalo-check.mjs
import { createJiti } from "C:/Programming/Paranoidz/node_modules/.pnpm/jiti@2.7.0/node_modules/jiti/lib/jiti.mjs";
const root = "C:/Programming/Paranoidz/apps/storefront/src";
const jiti = createJiti(import.meta.url, { alias: { "@": root, "server-only": new URL("./empty.mjs", import.meta.url).pathname.slice(1) } });
const { zaloAlertText, sendZaloAlert } = await jiti.import(`${root}/lib/order-zalo.ts`);

const base = { order_number: "PZ-2026-0074", recipient_name: "Nguyễn Văn A", phone: "0901234567", secondary_phone: null,
  address: "12 Lê Lợi", ward: "Phường Bến Nghé", city: "TP. Hồ Chí Minh", note: null,
  subtotal: 738000, discount: 0, shipping_fee: 30000, total: 768000,
  order_items: [{ name_snapshot: "Áo thun Paranoid", color_snapshot: "Đen", size_snapshot: "L", qty: 2 },
                { name_snapshot: "Quần cargo", color_snapshot: null, size_snapshot: "M", qty: 1 }] };
console.log(zaloAlertText(base), "\n=====");
console.log(zaloAlertText({ ...base, secondary_phone: "0907654321", discount: 73800, total: 694200, note: "Giao giờ hành chính *không* <b>" }), "\n=====");

// Real DB read (read-only) of the newest order, then each send path.
const { createAdminClient } = await jiti.import("@paranoidz/db/admin");
const { data } = await createAdminClient().from("orders").select("id").order("created_at", { ascending: false }).limit(1);
const id = data?.[0]?.id ?? "00000000-0000-0000-0000-000000000000";
delete process.env.ZALO_BOT_TOKEN; delete process.env.ZALO_OWNER_CHAT_ID;
await sendZaloAlert(id);                              // expect: skipped warning
process.env.ZALO_BOT_TOKEN = "FAKE"; process.env.ZALO_OWNER_CHAT_ID = "x";
await sendZaloAlert(id);                              // expect: "zalo alert failed … 200 {"ok":false,…}" (or "not readable" if no order exists)
```

- [ ] **Step 2: Run it**

Expected: first message without discount/note/secondary phone lines, second with all of them; `Quần cargo (M)`; note printed literally; skip warning; fake token → `zalo alert failed` with `{"ok":false…}`; nothing throws.

### Task 3: Wire into checkout + env template

**Files:**
- Modify: `apps/storefront/src/app/checkout/actions.ts` (imports; the `after(() => sendOrderEmails(...))` line)
- Modify: `apps/storefront/.env.example`

- [ ] **Step 1: Import and schedule**

Add next to the `order-email` import:
```ts
import { sendZaloAlert } from "@/lib/order-zalo";
```
After `after(() => sendOrderEmails(order.order_id));`:
```ts
  after(() => sendZaloAlert(order.order_id));
```

- [ ] **Step 2: Env template** — append to `apps/storefront/.env.example`:
```
# Server-only: new-order alert to the client's Zalo (lib/order-zalo). Zalo app → OA "Zalo Bot Manager" →
# Tạo bot; the token arrives by Zalo message. Chat id: the client messages the bot once, then
# POST https://bot-api.zaloplatforms.com/bot<token>/getUpdates. Either unset = no alert.
ZALO_BOT_TOKEN=
ZALO_OWNER_CHAT_ID=
```

- [ ] **Step 3: Verify** — `pnpm --filter storefront lint`, `pnpm --filter storefront exec tsc --noEmit`, `pnpm --filter storefront build`. Expected: all green.

- [ ] **Step 4: Commit** (only these files — the tree may hold someone else's work)

```bash
git add apps/storefront/src/lib/order-zalo.ts apps/storefront/src/app/checkout/actions.ts apps/storefront/.env.example docs/superpowers/plans/2026-10-12-zalo-order-alert.md
git commit -m "feat: send new-order alert to the client's Zalo"
```

### Task 4: TODO.md

- [ ] **Step 1:** Zalo item: code done, list what was verified, keep the client setup steps open. Add to "Known gaps — carried debt": Zalo Bot API returns HTTP 200 + `{"ok":false}` on errors.
- [ ] **Step 2:** Commit `chore: record Zalo alert status in TODO`.
