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
  // width / height: set by the admin uploader so the space is reserved before the image loads.
  img: ["src", "alt", "width", "height"],
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
      } else if (/^\d{1,5}$/.test(val)) {
        attrs += ` ${attrName}="${val}"`; // width / height: plain pixel numbers only
      }
    }
    if (name === "img" && !attrs.includes("src=")) continue; // img without a valid src is useless
    // Description photos are below the fold: never let them block the first paint.
    if (name === "img") attrs += ' loading="lazy" decoding="async"';
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
  return /<[a-zA-Z][^<>]*>/.test(input) ? sanitizeDescriptionHtml(input) : smartFormatPlainText(input);
}

// Legacy descriptions are a wall of text (labels like "Đặc điểm nổi bật:",
// ALL-CAPS headings, size rows, hashtag blocks) with no markup. This formats
// them into headings, bullet lists, size rows and a tag block so customers can
// actually read them. Everything is escaped; only the tags below are emitted.
const DESC_LABELS = [
  "đặc điểm nổi bật",
  "bảng size tham khảo",
  "thông tin mẫu",
  "lưu ý",
  "gợi ý phối đồ",
  "chất liệu",
  "ứng dụng",
  "cam kết",
  "cam kết shop",
  "hướng dẫn bảo quản",
  "hướng dẫn sử dụng",
];

function smartFormatPlainText(raw: string): string {
  let t = raw.replace(/\s+/g, " ").trim();
  if (!t) return "";

  // 1. hashtag block (3+ tags in a row, anywhere) -> muted tags at the end
  let tagsHtml = "";
  const tm = t.match(/(#[\p{L}\p{N}_]+(?:\s+#[\p{L}\p{N}_]+){2,})\s*/u);
  if (tm && tm.index !== undefined) {
    tagsHtml = `<p class="desc-tags">${escapeHtml(tm[1].trim())}</p>`;
    t = (t.slice(0, tm.index) + " " + t.slice(tm.index + tm[0].length)).replace(/\s+/g, " ").trim();
  }

  // 2. leading ALL-CAPS title -> lead paragraph
  let leadHtml = "";
  const lm = t.match(/^([\p{Lu}0-9][\p{Lu}0-9\s\-–&()\/]{8,}?)\s+(?=[\p{Lu}][\p{Ll}])/u);
  if (lm && lm[1].trim().split(/\s+/).length >= 3 && !/[\p{Ll}]/u.test(lm[1])) {
    leadHtml = `<p class="desc-lead">${escapeHtml(lm[1].trim())}</p>`;
    t = t.slice(lm[1].length).trim();
  }

  // 3. section boundaries: curated labels ("Label:" or 3+ word labels) and
  // ALL-CAPS headings (2-6 all-caps words). \b is ASCII-only in JS, so the
  // label match is anchored with (^|[\s.]) instead.
  const labelAlt = DESC_LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const labelRe = new RegExp(`(^|[\\s.])(${labelAlt})(\\s*:|(?=\\s+[\\p{Lu}]))`, "gui");
  const headRe = /([\p{Lu}0-9][\p{Lu}0-9&()\/\-–]*(?:\s+(?:[\p{Lu}0-9\(][\p{Lu}0-9&()\/\-–]+|[&\/\-–])){1,5})/gu;

  const bounds: { index: number; len: number; label: string; isLabel: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = labelRe.exec(t))) {
    const words = m[2].trim().split(/\s+/).length;
    const hasColon = m[3].trim().startsWith(":");
    if (!hasColon && words < 3) continue; // colon-less labels need 3+ words
    bounds.push({ index: m.index + m[1].length, len: m[2].length, label: m[2], isLabel: true });
  }
  while ((m = headRe.exec(t))) {
    const text = m[1].trim();
    if (/[\p{Ll}]/u.test(text)) continue;
    if (bounds.some((b) => m!.index < b.index + b.len && m!.index + m![0].length > b.index)) continue;
    bounds.push({ index: m.index, len: m[0].length, label: text, isLabel: false });
  }
  bounds.sort((a, b) => a.index - b.index);

  const sections: { label: string | null; isLabel: boolean; body: string }[] = [];
  for (let i = 0; i < bounds.length; i++) {
    const bodyStart = bounds[i].index + bounds[i].len;
    const bodyEnd = i + 1 < bounds.length ? bounds[i + 1].index : t.length;
    if (i === 0 && bounds[i].index > 0) sections.push({ label: null, isLabel: false, body: t.slice(0, bounds[i].index).trim() });
    sections.push({
      label: bounds[i].label,
      isLabel: bounds[i].isLabel,
      body: t.slice(bodyStart, bodyEnd).trim().replace(/^[:\s]+/, ""),
    });
  }
  if (!bounds.length) sections.push({ label: null, isLabel: false, body: t });

  // Split run-on benefit lists on missing-period boundaries, without breaking
  // proper nouns (Hàn Quốc), fabric names (Vải Nhung) or "Size X:" markers.
  const glue = (s: string) =>
    s
      .replace(/\b(Hàn|Nhật|Việt|Trung|Âu|Mỹ)\s+(Quốc|Bản|Nam)/gu, "$1 $2")
      .replace(/\b(Vải)\s+(Nhung|Cotton|Thun|Kaki|Jean|Nỉ|Lụa)/gu, "$1 $2");
  const unglue = (s: string) => s.replace(/ /g, " ");
  const splitItems = (body: string): string[] =>
    glue(body)
      .split(/(?<=[\p{Ll}0-9%]) +(?![\p{Lu}][\p{Ll}]*\s+(?:Quốc|Bản|Nam)\b|Size\s+[A-Z0-9]+\s*:)(?=[\p{Lu}][\p{Ll}])/u)
      .map((s) => unglue(s).trim().replace(/[.\s]+$/, ""))
      .filter((s) => s.length > 1);

  const html = sections
    .map(({ label, isLabel, body }) => {
      if (!body && !label) return "";
      let out = "";
      if (label) {
        const norm = label.toLowerCase();
        const display = isLabel
          ? norm
              .split(" ")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ")
          : label.trim();
        out += `<h4>${escapeHtml(display)}</h4>`;
      }
      if (!body) return out;
      const nl = (label ?? "").toLowerCase();
      if (nl.includes("bảng size")) {
        const rows = body
          .split(/(?=\bSize\s+[A-Z0-9]+\s*:)/u)
          .map((s) => s.trim())
          .filter(Boolean);
        if (rows.length > 1) {
          out += `<ul class="desc-sizes">${rows
            .map((r) => {
              const mm = r.match(/^Size\s+([A-Z0-9]+)\s*:\s*(.*)$/u);
              return mm
                ? `<li><strong>Size ${escapeHtml(mm[1])}:</strong> ${escapeHtml(mm[2])}</li>`
                : `<li>${escapeHtml(r)}</li>`;
            })
            .join("")}</ul>`;
          return out;
        }
      }
      // A section with no real sentences that splits into 3+ items is a run-on list.
      const items = splitItems(body);
      if (items.length >= 3 && !/\.\s/u.test(body)) {
        out += `<ul class="desc-points">${items.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ul>`;
        return out;
      }
      const sentences = body.match(/[^.!?]+[.!?]+/g) ?? [body];
      const paras: string[] = [];
      for (let i = 0; i < sentences.length; i += 2) paras.push(sentences.slice(i, i + 2).join(" ").trim());
      out += paras.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
      return out;
    })
    .join("");

  return leadHtml + html + tagsHtml;
}
