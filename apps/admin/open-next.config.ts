import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Admin pages are all dynamic: no incremental cache, queue or tag cache needed.
export default defineCloudflareConfig();
