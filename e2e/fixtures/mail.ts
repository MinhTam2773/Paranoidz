import { expect } from "@playwright/test";

// Auth emails from the local Supabase land in Mailpit (never a real inbox). REST API:
// https://mailpit.axllent.org/docs/api-v1/
const mailpit = () => process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

type Summary = { ID: string; Subject: string };

/** Waits for the email to `to` with this subject and returns the auth link inside it. */
export async function authLinkFromEmail(to: string, subject: string) {
  let message: Summary | undefined;
  await expect
    .poll(async () => {
      const res = await fetch(`${mailpit()}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
      const { messages } = (await res.json()) as { messages: Summary[] };
      message = messages.find((m) => m.Subject === subject);
      return message !== undefined;
    }, { timeout: 15_000 })
    .toBe(true);
  const { HTML } = (await (await fetch(`${mailpit()}/api/v1/message/${message!.ID}`)).json()) as { HTML: string };
  const href = HTML.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1];
  expect(href, "auth link in the email").toBeTruthy();
  return href!.replaceAll("&amp;", "&");
}
