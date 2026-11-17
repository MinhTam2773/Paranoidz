import Link from "next/link";
import type { Metadata } from "next";
import { Prose } from "@/components/content/Prose";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import type { Article } from "@/content/articles";
import { SITE_NAME, SITE_URL, websiteOpenGraph } from "@/lib/site";

// SEO kit 2026-11-17 (P2.3, E3): the size guide and the two blog posts. Author is the brand
// ("Biên tập Paranoidz") until the owner supplies a person's name and bio (TODO.md).
export const PUBLISHED = "2026-11-17";
const BYLINE_DATE = "17/11/2026";

const link = "text-text-primary underline underline-offset-4 hover:text-accent";

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
        author: { "@type": "Organization", name: `Biên tập ${SITE_NAME}`, url: `${SITE_URL}/branding` },
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      ...(extraJsonLd ? [extraJsonLd] : []),
    ],
  };
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 lg:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <Breadcrumb items={[{ label: "Trang chủ", href: "/" }, ...crumbs, { label: article.h1 }]} />
      <article className="max-w-3xl">
        <h1 className="text-h2 uppercase">{article.h1}</h1>
        <p className="mt-3 mb-8 text-caption text-text-muted">
          <Link href="/branding" className="hover:text-text-primary">Biên tập {SITE_NAME}</Link> · {BYLINE_DATE}
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
