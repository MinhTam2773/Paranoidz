// Product descriptions support a small safe HTML subset (images + basic
// formatting) so the shop can embed photos in the description. Everything else
// is stripped to prevent stored XSS — the description is admin-entered but
// rendered to every visitor, so this runs server-side before dangerouslySetInnerHTML.

const ALLOWED: Record<string, readonly string[]> = {
  p: [],
  br: [],
  strong: [],
  b: [],
  em: [],
  i: [],
  u: [],
  ul: [],
  ol: [],
  li: [],
  h3: [],
  h4: [],
  img: ["src", "alt"],
  a: ["href"],
};

const VOID = new Set(["br", "img"]);
// Tags whose content must be dropped entirely, not just the tags.
const DROP_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "form", "input", "button"]);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Only absolute https URLs (Supabase public URLs). Rejects javascript:, data:,
// relative paths and anything with whitespace/quotes.
function cleanUrl(url: string): string | null {
  const u = url.trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : null;
}

export function sanitizeDescriptionHtml(input: string): string {
  let out = "";
  let dropDepth = 0;
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(input))) {
    if (dropDepth === 0) out += escapeHtml(input.slice(last, m.index));
    const name = m[1].toLowerCase();
    const isClose = m[0].startsWith("</");
    last = tagRe.lastIndex;

    if (DROP_CONTENT.has(name)) {
      if (!isClose) dropDepth++;
      else if (dropDepth > 0) dropDepth--;
      continue;
    }
    if (dropDepth > 0) continue;

    const allowed = ALLOWED[name];
    if (!allowed) continue; // strip the tag, keep its inner text
    if (isClose) {
      if (!VOID.has(name)) out += `</${name}>`;
      continue;
    }

    let attrs = "";
    const attrRe = /([a-zA-Z-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(m[2]))) {
      const attrName = am[1].toLowerCase();
      if (!allowed.includes(attrName)) continue;
      const val = am[2] ?? am[3] ?? am[4] ?? "";
      if (attrName === "src" || attrName === "href") {
        const clean = cleanUrl(val);
        if (!clean) continue;
        attrs += ` ${attrName}="${escapeHtml(clean)}"`;
      } else if (attrName === "alt") {
        attrs += ` alt="${escapeHtml(val.slice(0, 200))}"`;
      }
    }
    if (name === "img" && !attrs.includes("src=")) continue; // img without a valid src is useless
    if (name === "a") attrs += ' rel="nofollow noopener"';
    out += `<${name}${attrs}>`;
  }
  if (dropDepth === 0) out += escapeHtml(input.slice(last));
  return out;
}

// Plain-text descriptions (the old format) keep their line breaks; HTML
// descriptions go through the allowlist sanitizer.
export function renderDescription(input: string): string {
  if (!input) return "";
  return /<[a-zA-Z][^<>]*>/.test(input)
    ? sanitizeDescriptionHtml(input)
    : escapeHtml(input).replace(/\r?\n/g, "<br>");
}
