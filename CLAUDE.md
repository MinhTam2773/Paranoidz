# CLAUDE.md — Paranoidz Monorepo

Rules for AI agents working in this repo. Read this fully before writing any code.

---

## 1. What this project is

Headless e-commerce for a Vietnamese streetwear brand. COD only — no payment gateway.
Two Next.js apps in one pnpm workspace:

- `apps/storefront` → paranoidz.com (customers)
- `apps/admin` → admin.paranoidz.com (single admin user, the client)
- `packages/db` → shared Supabase clients + generated types (create if missing)
- `supabase/` → migrations, seed, config
- `design-refs/` → Stitch PNG exports (visual reference for all UI work)

## 2. Source-of-truth documents

| Doc | Governs |
| --- | ------- |
| `DESIGN.md` | ALL storefront UI — tokens, components, layout |
| `DASHBOARD_DESIGN.md` | ALL admin UI — shell, tables, badges, page specs |
| `ARCHITECTURE.md` | Database schema, RLS, order lifecycle, voucher/loyalty logic, security model |

Design tokens are law. Never invent colors, fonts, radii, or spacing not defined in these files.
`ARCHITECTURE.md` section 8 lists Pending Decisions — do NOT implement those until resolved.

## 3. Stack facts (newer than your training habits)

- **Next.js 16 + React 19**: `params`, `searchParams`, `cookies()`, `headers()` are async — always `await` them.
- **Tailwind v4**: tokens live in `@theme` inside `globals.css`. There is NO `tailwind.config` file. Do not create one. Do not use v3 syntax.
- **pnpm workspace**: install from repo root. Filter commands: `pnpm --filter storefront dev`, `pnpm --filter admin dev`.
- Windows dev machine: prefer cross-platform scripts; never hardcode `/` path assumptions in tooling.

## 4. Non-negotiable security rules

- Supabase clients come ONLY from `@paranoidz/db`. Never call `createClient` elsewhere.
- `admin.ts` (service_role) starts with `import "server-only"` and must never be imported into a `"use client"` file.
- NO client-side writes to `orders`, stock, `vouchers`, or loyalty counters — server routes / RPCs only.
- All prices and totals are recomputed server-side from the database. Client-submitted totals are never trusted.
- Stock mutations happen ONLY inside `place_order()` / `transition_order_status()` Postgres functions. Never "simplify" the atomic guard (`WHERE stock >= qty`) into check-then-write — that reintroduces the race condition.
- Order status is only changed via `transition_order_status()` — never a raw UPDATE.

## 5. Project conventions

- Prices display as ₫ with dot separators: `₫269.000`.
- Storefront copy: uppercase for headings/nav/buttons, sentence case for body (see DESIGN.md).
- Order numbers: `PZ-YYYY-NNNN` from the Postgres sequence.
- One feature per session. Update `TODO.md` at the end of every session. Commit after each green step with a conventional message (`feat:`, `fix:`, `chore:`).

---

## 6. Karpathy Guidelines (behavioral rules)

Adapted from Andrej Karpathy's observations on LLM coding failures. These govern HOW you work, in every session, in addition to the project rules above.

### 6.1 Surface assumptions — don't run with guesses
- If the request is ambiguous, state your assumptions explicitly BEFORE implementing, or ask one clarifying question.
- If you notice an inconsistency (spec vs code, design vs architecture), surface it — don't silently pick a side.
- Present tradeoffs when there are meaningfully different approaches. Push back when the request conflicts with ARCHITECTURE.md or the security rules; do not be agreeable at the cost of correctness.
- Never hide confusion behind confident-sounding code.

### 6.2 Simplicity first — minimum viable implementation
- Write the least code that fully satisfies the request. No speculative features, no "while I'm here" additions.
- No new abstractions, layers, or config options until at least two real call sites need them.
- No error handling beyond what the task requires.
- If your implementation exceeds ~100 lines for something that feels simple, stop and reconsider — you are probably overcomplicating.

### 6.3 Surgical changes only
- Every changed line must trace directly to the request. No drive-by refactors, no "improvements" to adjacent code.
- Match the existing style of the file you're editing, even if you'd personally write it differently.
- Never change or delete comments or code you don't fully understand as a side effect of another task.
- Don't remove pre-existing dead code unless asked.
- Keep diffs small and reviewable. Prefer several small commits over one large one.

### 6.4 Verifiable success criteria — loop until proven
- Before starting, state the success criteria: what command runs, what page renders, what test passes.
- "It should work now" is not done. Done = the criteria verified (build passes, page renders at 375px and 1280px, RLS check fails for the wrong user, etc.).
- Bug fix protocol: first write or identify a reproduction (test or manual steps that reliably show the bug) → fix → re-run → only then is it fixed.
- If you cannot verify (missing env vars, needs manual step), say exactly what the human must check instead of claiming completion.

### 6.5 Dependency & repo hygiene
- No new dependencies without stating why an existing tool can't do it. Prefer what's already installed.
- Never commit secrets. `.env*` stays out of git (`.env.example` is the only template).
- Clean up after yourself: no leftover console.logs, commented-out blocks, or unused files from your own session.

---

## 7. Session workflow

1. Read `TODO.md` for current phase and next task.
2. Read the relevant spec section (DESIGN.md / DASHBOARD_DESIGN.md / ARCHITECTURE.md) and any screenshot in `design-refs/`.
3. State plan + assumptions + success criteria (2–5 lines).
4. Implement the ONE task.
5. Verify against the criteria. Fix until green.
6. Update `TODO.md`, commit.
