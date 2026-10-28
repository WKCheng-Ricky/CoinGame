// Every spec imports test and expect from here so each test's browser JS coverage is collected.
import { test as base, expect } from "@playwright/test";
import { coverageReport } from "./coverage.js";

const report = coverageReport();

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    await use(page);
    const entries = await page.coverage.stopJSCoverage();
    await report.add(entries);
  },
});

export { expect };
