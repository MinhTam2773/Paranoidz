import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";

// On-demand ISR (2026-11-07, Vercel ISR writes hit the free-plan cap): the admin calls this after
// any change the catalog pages show, so those pages can stay cached for a day instead of a minute.
// Drops every cached page; each re-renders on its next visit. Auth: Bearer REVALIDATE_SECRET.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const sent = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || sent.length !== expected.length || !timingSafeEqual(sent, expected)) {
    return new Response(null, { status: 401 });
  }
  revalidatePath("/", "layout");
  return Response.json({ revalidated: true });
}
