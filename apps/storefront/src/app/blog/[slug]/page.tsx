import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticlePage, articleMetadata } from "@/components/content/ArticlePage";
import { ARTICLES } from "@/content/articles";

// Blog posts from the SEO kit (P2.3). Static: only these slugs exist, anything else is a 404.
const POSTS = ["ao-thun-boxy-va-oversize-khac-nhau", "cach-phoi-ao-thun-local-brand"] as const;
type Post = (typeof POSTS)[number];
const isPost = (slug: string): slug is Post => (POSTS as readonly string[]).includes(slug);

export const dynamicParams = false;

export function generateStaticParams() {
  return POSTS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return isPost(slug) ? articleMetadata(ARTICLES[slug], `/blog/${slug}`) : {};
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  if (!isPost(slug)) notFound();
  const other = POSTS.find((p) => p !== slug)!;
  return (
    <ArticlePage
      article={ARTICLES[slug]}
      path={`/blog/${slug}`}
      crumbs={[]}
      related={[
        { label: "Hướng dẫn chọn size áo Paranoidz", href: "/huong-dan-chon-size" },
        { label: ARTICLES[other].h1, href: `/blog/${other}` },
        { label: "Xem tất cả áo thun", href: "/collections/t-shirtz" },
      ]}
    />
  );
}
