import { test as base } from "@playwright/test";

// Storefront tests: every test gets its own client IP. `next start` fills x-forwarded-for from
// the socket, so without this all tests share 127.0.0.1 and hit the per-IP order limit
// (lib/rate-limit.ts reads x-real-ip first).
const randomIp = () => `10.${[0, 0, 0].map(() => Math.floor(Math.random() * 254) + 1).join(".")}`;

export const test = base.extend({
  extraHTTPHeaders: async ({}, use) => use({ "x-real-ip": randomIp() }),
});

export { expect } from "@playwright/test";
