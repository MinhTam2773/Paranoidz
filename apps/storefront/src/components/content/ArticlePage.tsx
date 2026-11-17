import Link from "next/link";
import type { Metadata } from "next";
import { Prose } from "@/components/content/Prose";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import type { Article } from "@/content/articles";
import { SITE_URL, TEAM_NAME, breadcrumbJsonLd, websiteOpenGraph } from "@/lib/site";

// SEO kit 2026-11-17 (P2.3, E3): the size guide and the two blog posts. Author: "Team
// Paranoidz", the name the owner chose for the shop's people (2026-11-17).
export const PUBLISHED = "2026-11-17";
const BYLINE_DATE = "17/11/2026";

const link = "text-text-primary underline underline-offset-4 hover:text-accent";

// The article's "## FAQ" section ("**Question?**  " then the answer) as FAQPage, so the schema
// always matches the visible text. Markdown links and bold are reduced to plain text.
function faqFrom(body: string) {
  const section = body.split(/^## FAQ$/m)[1]?.split(/^## /m)[0];
  if (!section) return null;
  const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "").trim();
  const qa = section
    .split(/\n{2,}/)
    .map((b) => b.trim().split("\n"))
    .filter((l) => l.length > 1 && /^\*\*.+\*\*\s*$/.test(l[0]))
    .map(([q, ...a]) => ({
      "@type": "Question",
      name: plain(q),
      acceptedAnswer: { "@type": "Answer", text: plain(a.join(" ")) },
    }));
  return qa.length ? { "@type": "FAQPage", mainEntity: qa } : null;
}

export function articleMetadata(article: Article, path: string): Metadata {
  return {
    title: { absolute: article.title },
    description: article.description,
    alternates: { canonical: path },
    openGraph: {
      ...websiteOpenGraph(path),
      type: "article",
      publishedTime: PUBLISHED,
      title: article.title,
      description: article.description,
    },
  };
}

export function ArticlePage({
  article,
  path,
  crumbs,
  extraJsonLd,
  related,
}: {
  article: Article;
  path: string;
  crumbs: { label: string; href?: string }[];
  extraJsonLd?: object;
  related: { label: string; href: string }[];
}) {
  const url = `${SITE_URL}${path}`;
  const allCrumbs = [{ label: "Trang chủ", href: "/" }, ...crumbs, { label: article.h1 }];
  const faq = faqFrom(article.body);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: article.h1,
        description: article.description,
        inLanguage: "vi",
        mainEntityOfPage: url,
        datePublished: PUBLISHED,
        dateModified: PUBLISHED,
        author: { "@type": "Organization", name: TEAM_NAME, url: `${SITE_URL}/branding` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      breadcrumbJsonLd(allCrumbs, path),
      ...(faq ? [faq] : []),
      ...(extraJsonLd ? [extraJsonLd] : []),
    ],
  };
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Breadcrumb items={allCrumbs} />
      <article className="max-w-3xl">
        <h1 className="text-h2 uppercase">{article.h1}</h1>
        <p className="mt-3 mb-8 text-caption text-text-muted">
          <Link href="/branding" className="hover:text-text-primary">{TEAM_NAME}</Link> · {BYLINE_DATE}
        </p>
        <Prose source={article.body} />
        <nav aria-label="Đọc thêm" className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-body">
          <p className="text-nav font-bold uppercase text-text-primary">Đọc thêm</p>
          {related.map((r) => (
            <Link key={r.href} href={r.href} className={link}>{r.label}</Link>
          ))}
        </nav>
      </article>
    </div>
  );
}
