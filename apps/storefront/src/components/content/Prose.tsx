import Link from "next/link";
import type { ReactNode } from "react";

// Renders the small markdown subset used by src/content/articles.ts: ## / ### headings, paragraphs
// (a trailing double space is a line break), "- " and "1. " lists, pipe tables, **bold** and
// [text](href). Server-only, no dependency: the copy is ours, not user input.

const link = "text-text-primary underline underline-offset-4 hover:text-accent";

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${m.index}`;
    if (m[1] !== undefined) out.push(<strong key={key} className="font-semibold text-text-primary">{m[1]}</strong>);
    else if (m[3].startsWith("/")) out.push(<Link key={key} href={m[3]} className={link}>{m[2]}</Link>);
    else out.push(<a key={key} href={m[3]} target="_blank" rel="noopener noreferrer" className={link}>{m[2]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Lines joined into one paragraph; "  " at a line end keeps the break (FAQ question / answer).
function lines(block: string[]): ReactNode[] {
  return block.flatMap((l, i) => [
    ...(i ? [l.endsWith("  ") || block[i - 1].endsWith("  ") ? <br key={`br${i}`} /> : " "] : []),
    ...inline(l.trim()),
  ]);
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Prose({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/).map((b) => b.split("\n"));
  return (
    <div className="flex flex-col gap-4 text-body text-text-secondary">
      {blocks.map((block, i) => {
        const first = block[0];
        if (first.startsWith("### "))
          return <h3 key={i} className="mt-4 text-h3 text-text-primary">{inline(first.slice(4))}</h3>;
        if (first.startsWith("## "))
          return <h2 key={i} className="mt-6 border-l-4 border-accent pl-3 text-h3 uppercase text-text-primary">{inline(first.slice(3))}</h2>;
        if (first.startsWith("|")) {
          const [head, , ...rows] = block;
          return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-bg-secondary text-nav uppercase text-text-primary">
                    {cells(head).map((c) => <th key={c} scope="col" className="px-4 py-3">{inline(c)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r} className="border-b border-border">
                      {cells(r).map((c, j) => <td key={j} className="px-4 py-3 align-top">{inline(c)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (/^(- |\d+\. )/.test(first)) {
          const items = block.map((l) => inline(l.replace(/^(- |\d+\. )/, "").trim()));
          const ordered = /^\d+\. /.test(first);
          const List = ordered ? "ol" : "ul";
          return (
            <List key={i} className={`flex flex-col gap-2 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
              {items.map((item, j) => <li key={j}>{item}</li>)}
            </List>
          );
        }
        return <p key={i}>{lines(block)}</p>;
      })}
    </div>
  );
}
