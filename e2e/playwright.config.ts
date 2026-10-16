import { defineConfig, devices } from "@playwright/test";
import { ADMIN_URL, APP_ENV, ROOT, STOREFRONT_URL } from "./env";

// Spec: docs/superpowers/specs/2026-10-15-e2e-ci-design.md. Both apps are built and served
// against the local Supabase stack. Ports 3100/3101 so a running `pnpm dev` isn't reused —
// that one talks to paranoidz-test.
const app = (name: string, url: string) => ({
  command: `pnpm --filter ${name} build && pnpm --filter ${name} start --port ${new URL(url).port}`,
  url,
  cwd: ROOT,
  env: APP_ENV,
  reuseExistingServer: false,
  timeout: 300_000,
  stdout: "ignore" as const,
  stderr: "pipe" as const,
});

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  // Server round trips (auth, server actions) under the full parallel suite on a laptop can pass
  // 5 s (2026-10-16: sign-up and a listing click); 10 s still fails a real hang.
  expect: { timeout: 10_000 },
  use: {
    baseURL: STOREFRONT_URL,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      grep: /@mobile/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: [app("storefront", STOREFRONT_URL), app("admin", ADMIN_URL)],
});
