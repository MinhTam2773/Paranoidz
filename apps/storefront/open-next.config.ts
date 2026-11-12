import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache";

// How the Next.js cache maps onto Cloudflare (bindings in wrangler.jsonc): ISR pages are stored in
// R2, time-based re-renders are queued through a Durable Object, and revalidatePath() marks pages
// stale in a Durable Object tag cache.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: doQueue,
  tagCache: doShardedTagCache(),
  // Cached pages are answered before the Next.js server is loaded (less CPU per hit).
  enableCacheInterception: true,
});
