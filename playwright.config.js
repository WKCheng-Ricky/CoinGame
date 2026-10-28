import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  // whole spec files run in parallel; E2E_WORKERS overrides (default 6 locally, 2 on CI).
  // Coverage is safe across workers: entries land in Monocart's on-disk cache (see e2e/coverage.js)
  workers: Number(process.env.E2E_WORKERS) || (CI ? 2 : 6),
  fullyParallel: false,
  forbidOnly: CI,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/global-setup.js",
  globalTeardown: "./e2e/global-teardown.js",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
  },
  // WebKit (iOS Safari's engine) only runs the *.webkit.spec.js files: the rest of the suite relies on Chromium's JS coverage.
  projects: [
    { name: "chromium", testIgnore: /\.webkit\.spec\.js$/, use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", testMatch: /\.webkit\.spec\.js$/, use: { ...devices["iPhone 14"] } },
  ],
  webServer: {
    command: "node e2e/serve.js",
    url: "http://localhost:4173",
    reuseExistingServer: !CI,
  },
});
