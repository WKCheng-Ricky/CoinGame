import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;
const EXTENDED = !!process.env.E2E_EXTENDED;

export default defineConfig({
  testDir: "e2e",
  // whole spec files run in parallel; E2E_WORKERS overrides (default 6 locally, 2 on CI).
  workers: Number(process.env.E2E_WORKERS) || (CI ? 2 : 6),
  fullyParallel: false,
  forbidOnly: CI,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  // Default: the CI set (e2e/*.spec.js) on Chromium and WebKit. E2E_EXTENDED=1: only e2e/extended/** on Chromium.
  projects: EXTENDED
    ? [{ name: "chromium", testMatch: /extended\/.*\.spec\.js$/, use: { ...devices["Desktop Chrome"] } }]
    : [
        { name: "chromium", testIgnore: [/extended\//, /\.webkit\.spec\.js$/], use: { ...devices["Desktop Chrome"] } },
        { name: "webkit", testIgnore: /extended\//, use: { ...devices["iPhone 14"] } },
      ],
  webServer: {
    command: "node scripts/serve.js",
    url: "http://localhost:4173",
    reuseExistingServer: !CI,
  },
});
