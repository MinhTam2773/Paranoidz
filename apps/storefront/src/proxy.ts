import type { NextRequest } from "next/server";
import { updateSession } from "@paranoidz/db/proxy";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);
  // Visitor's country from Vercel's geo header, read by trackMeta() (MetaPixel.tsx) to keep events
  // from outside Vietnam out of the Meta pixel. Not httpOnly: client code reads it.
  const country = request.headers.get("x-vercel-ip-country");
  if (country && request.cookies.get("pz-cc")?.value !== country) {
    response.cookies.set("pz-cc", country, { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax", secure: true });
  }
  return response;
}

export const config = {
  // Skip static assets and images; every page/route refreshes the session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif)$).*)"],
};
