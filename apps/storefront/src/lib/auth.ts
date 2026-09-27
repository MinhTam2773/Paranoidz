// Where to go after login / signup / an email link. Only same-site paths, or ?next= is an open
// redirect: browsers read "//evil.com", "/\evil.com" and "/<tab>/evil.com" as another host.
// Parsing with the URL parser catches every such spelling; the parsed path is what's returned.
export function safeNext(next: unknown, fallback = "/account") {
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;
  const url = URL.parse(next, "http://same.site");
  return url?.origin === "http://same.site" ? url.pathname + url.search + url.hash : fallback;
}

// Every login lands here first: the phone step (ARCHITECTURE.md §1, phone required) passes
// straight through to `next` when the profile already has a phone.
export function afterLoginPath(next: string) {
  return `/account/phone?next=${encodeURIComponent(next)}`;
}

export const PASSWORD_MIN = 8;
