import type { NextRequest } from "next/server";
import { updateSession } from "@paranoidz/db/proxy";

// Still the `middleware` convention (edge runtime), not Next 16's `proxy` (Node.js): OpenNext on
// Cloudflare only supports the edge one.
export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  // Visitor's country, read by trackMeta() (MetaPixel.tsx) to keep events from outside Vietnam out
  // of the Meta pixel. Vercel sends this header; on Cloudflare OpenNext fills it from request.cf.
  // Not httpOnly: client code reads it.
  const country = request.headers.get("x-vercel-ip-country");
  if (country && request.cookies.get("pz-cc")?.value !== country) {
    response.cookies.set("pz-cc", country, { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax", secure: true });
  }
  // SEO kit P3.4: /products?page=2, ?sort=…, /collections/x?size=L render the same listing as the
  // clean URL. Keep them out of the index with a header, so the pages stay static (ISR) instead of
  // reading searchParams; links on them are still followed.
  const { pathname, search } = request.nextUrl;
  if (search && (pathname === "/products" || pathname.startsWith("/collections/"))) {
    response.headers.set("X-Robots-Tag", "noindex, follow");
  }
  return response;
}

export const config = {
  // Skip static assets and images; every page/route refreshes the session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)"],
};
