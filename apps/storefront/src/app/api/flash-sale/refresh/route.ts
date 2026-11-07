import { revalidatePath } from "next/cache";

// The homepage is cached for an hour, but its flash sale section changes at each window's start
// and end. The first browser that sees a boundary pass (FlashSale.tsx) posts it here and the
// homepage is rebuilt. `at` must be a whole minute in the past hour and later than the last one
// accepted, so a forged call can at most bring back the old once-a-minute rebuild.
export const runtime = "nodejs";

let last = 0;

export async function POST(req: Request) {
  const at = Number((await req.json().catch(() => null))?.at);
  const now = Date.now();
  if (Number.isSafeInteger(at) && at % 60_000 === 0 && at > last && at <= now && now - at <= 3_600_000) {
    last = at;
    revalidatePath("/");
  }
  return new Response(null, { status: 204 });
}
