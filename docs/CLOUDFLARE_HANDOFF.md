# Handoff: finish the storefront's move to Cloudflare (for a session on the dev machine)

Written 2026-11-10 by the cloud session that built PR #96 (run from the client's side). That
session has no access to the dev machine's files or to Chrome, and Vercel never returns Sensitive variables, so the last secrets
have to be uploaded from here. **Delete this file once `paranoidz.vn` is served by Cloudflare.**

Read first: `TODO.md` Now #13, `docs/CLOUDFLARE_SETUP.md`, `docs/LESSONS.md` → "Cloudflare Workers (OpenNext)".

## Where things stand

- Worker `paranoidz-storefront` (account `1197ae08ef6d285a75c5e869aa9e064e`) builds from branch
  `claude/lucid-meitner-m4bzh1` (PR #96, all checks green) and is deployed at
  `https://paranoidz-storefront.tamnguyen277353.workers.dev` **with production values and the
  production database. Do not place test orders there.**
- Already on the Worker (do not overwrite): `NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`,
  `ORDER_ALERT_EMAIL`, `R2_BUCKET`, `R2_ACCOUNT_ID`.
- `paranoidz.vn` and `www.paranoidz.vn` are still on Vercel. Nothing is merged.

## Rules

- The cloud session was run from the client's side (GitHub `tuanthanh971`); its user allowed
  Claude to enter keys and secrets there. On the dev machine that is Minh Tâm's call: ask him once
  before starting (`TODO.md` still says "Claude must not type keys" for the admin).
- Never print a secret value, paste one into chat, or write one into a file inside the repo.
  Report **names only**.

## Task 1 — upload the missing secrets (production values)

Source: `apps/storefront/.env.prod.local`. Missing on the Worker:

| Name | Needed before the domain moves? | If the file doesn't have it |
| ---- | ------------------------------- | --------------------------- |
| `SPX_API_HOST`, `SPX_APP_ID`, `SPX_APP_SECRET`, `SPX_USER_ID`, `SPX_USER_SECRET`, `SPX_SENDER_WARD`, `SPX_SENDER_PROVINCE` | Yes: without them the SPX webhook answers 401 and checkout uses the table fee | `apps/admin/.env.prod.local` has the same values |
| `RESEND_API_KEY` | Yes: order emails | resend.com → API Keys → new key (sending access, `paranoidz.vn`) |
| `ZALO_BOT_TOKEN`, `ZALO_OWNER_CHAT_ID` | Yes: new-order alert to the client | see `apps/storefront/.env.example` |
| `META_CAPI_TOKEN` | No | Events Manager → pixel `2608444106337265` → Settings → Conversions API |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | No (customer review photos) | `apps/admin/.env.prod.local`, or R2 → Manage API Tokens → Object Read & Write on `paranoidz-media` |
| `REVALIDATE_SECRET` | No | Must equal the admin's value on Vercel. If neither `.env.prod.local` has it: new `openssl rand -hex 32`, set it here **and** in the admin's Vercel Production variables, redeploy the admin |

Upload only these names, not the whole file. Save the script below **outside the repo** (for
example in the OS temp folder), then from `apps/storefront` run `node <path>/upload-secrets.mjs --dry`
(prints names only), check the list, and run it again without `--dry`. `wrangler` opens a browser
for the Cloudflare login the first time. The parsing and `--dry` path were tested; the upload itself
was not run by the cloud session.

```js
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const WANTED = [
  "SPX_API_HOST", "SPX_APP_ID", "SPX_APP_SECRET", "SPX_USER_ID", "SPX_USER_SECRET", "SPX_SENDER_WARD", "SPX_SENDER_PROVINCE",
  "RESEND_API_KEY", "ZALO_BOT_TOKEN", "ZALO_OWNER_CHAT_ID", "META_CAPI_TOKEN",
  "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "REVALIDATE_SECRET",
];
const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const env = {};
for (const f of files.length ? files : [".env.prod.local"]) {
  for (const line of readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && !(m[1] in env)) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const found = WANTED.filter((k) => env[k]);
console.log("will upload:", found.join(", ") || "nothing");
console.log("not in the file(s):", WANTED.filter((k) => !env[k]).join(", ") || "none");
if (!process.argv.includes("--dry") && found.length) {
  const file = join(tmpdir(), `pz-secrets-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(Object.fromEntries(found.map((k) => [k, env[k]]))));
  try {
    execFileSync("npx", ["-y", "wrangler@4.158.0", "secret", "bulk", file, "--name", "paranoidz-storefront"], { stdio: "inherit", shell: true });
  } finally {
    rmSync(file);
  }
}
```

A second file fills what the first lacks: `node <path>/upload-secrets.mjs .env.prod.local ../admin/.env.prod.local`.
Secrets take effect at once; no rebuild.

## Task 2 — tell the cloud session

Write this into `TODO.md` Now #13, or give it to whoever continues in the cloud session (names only):

```
Uploaded to paranoidz-storefront: <names>
Still missing: <names, or "none">
REVALIDATE_SECRET: <same as the admin's / new value set on both / not done>
```

Then, with Minh Tâm's go: merge PR #96 and switch the Worker's production branch to `master`
(`TODO.md` Now #13, steps 2–4).

## Task 3 — only on Minh Tâm's explicit go: move the domain

`docs/CLOUDFLARE_SETUP.md` steps 3 and 4, through Claude in Chrome: note the current
`paranoidz.vn` and `www` records, delete them, add both as Custom Domains on the Worker, then run
the checks (one real order, cancelled afterwards, with him watching).
