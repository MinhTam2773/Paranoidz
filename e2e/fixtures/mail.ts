import { expect } from "@playwright/test";

// Auth emails from the local Supabase land in Mailpit (never a real inbox). REST API:
// https://mailpit.axllent.org/docs/api-v1/
const mailpit = () => process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

type Summary = { ID: string; Subject: string; To: { Address: string }[] };

// Matched by recipient + link type, not subject: in CI the local auth service sends its default
// English templates although `config.toml` sets ours (unexplained, 2026-10-16 — TODO.md). Hosted
// projects never read `config.toml` anyway; their templates live in the dashboard.
async function verifyLink(id: string, type: "recovery" | "signup") {
  const { HTML } = (await (await fetch(`${mailpit()}/api/v1/message/${id}`)).json()) as { HTML: string };
  const href = HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
  return href && new URL(href).searchParams.get("type") === type ? href : null;
}

/** Waits for the auth email to `to` whose link is of this type and returns that link. */
export async function authLinkFromEmail(to: string, type: "recovery" | "signup") {
  let link: string | null = null;
  try {
    await expect
      .poll(async () => {
        const res = await fetch(`${mailpit()}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
        const { messages } = (await res.json()) as { messages: Summary[] };
        for (const m of messages) if ((link = await verifyLink(m.ID, type))) break;
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
