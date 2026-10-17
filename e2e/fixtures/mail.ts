import { expect, type Page } from "@playwright/test";

// Auth emails from the local Supabase land in Mailpit (never a real inbox). REST API:
// https://mailpit.axllent.org/docs/api-v1/
const mailpit = () => process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

type Summary = { ID: string; Subject: string; To: { Address: string }[] };

// Matched by recipient + link type. Only our templates (supabase/templates) link to /auth/confirm;
// Supabase's defaults link to /auth/v1/verify and never match. Hosted projects never read
// `config.toml`; their templates live in the dashboard.
async function confirmLink(id: string, type: "recovery" | "email") {
  const { HTML } = (await (await fetch(`${mailpit()}/api/v1/message/${id}`)).json()) as { HTML: string };
  const href = HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
  return href && new URL(href).searchParams.get("type") === type ? href : null;
}

/** Waits for the auth email to `to` whose link is of this type and returns that link. */
export async function authLinkFromEmail(to: string, type: "recovery" | "email") {
  let link: string | null = null;
  try {
    await expect
      .poll(async () => {
        const res = await fetch(`${mailpit()}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
        const { messages } = (await res.json()) as { messages: Summary[] };
        for (const m of messages) if ((link = await confirmLink(m.ID, type))) break;
        return link !== null;
      }, { timeout: 15_000 })
      .toBe(true);
  } catch {
    // Say what the inbox does hold, so a CI failure explains itself.
    const res = await fetch(`${mailpit()}/api/v1/messages?limit=10`);
    const { total, messages } = (await res.json()) as { total: number; messages: Summary[] };
    const seen = messages.map((m) => `${m.To.map((t) => t.Address).join(",")}: ${m.Subject}`).join(" | ");
    throw new Error(`No ${type} email to ${to} in Mailpit (${mailpit()}) after 15 s. Inbox has ${total}: ${seen || "nothing"}`);
  }
  return link!;
}

/** Opens an auth email link as a person would. It is first fetched once the way a mail scanner
 *  does, which must not spend its token; then the button on /auth/confirm is clicked. */
export async function openAuthLink(page: Page, link: string) {
  expect((await page.request.get(link)).ok()).toBe(true);
  await page.goto(link);
  await page.getByRole("button", { name: /Xác nhận email|Đặt mật khẩu mới/ }).click();
}
