import { test, expect } from "@playwright/test";
import { FAST, seedRandom, startMode } from "./helpers.js";

const MODES = ["Endless", "Custom", "Cashier", "Give Change"];

// Collect every uncaught page error and console error (a broken import path shows up as one of these).
function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // WebKit logs this for the viewport meta's interactive-widget key; it is not an app error
    if (m.type() === "error" && !/Viewport argument key "?interactive-widget"? not recognized/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

test("home loads with the four modes present and selectable", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/?" + FAST);
  await expect(page.locator("#screen-home")).toBeVisible();
  await expect(page.locator("#modes input[name=mode]")).toHaveCount(MODES.length);
  for (const name of MODES) {
    const row = page.locator("#modes label.mode").filter({ hasText: new RegExp(`^${name}`) });
    await expect(row).toBeVisible();
    await row.click();
    await expect(row.locator("input")).toBeChecked();
  }
  await expect(page.locator("#btn-play")).toBeVisible();
  expect(errors).toEqual([]);
});

for (const name of MODES) {
  test(`starting ${name} raises no page or console errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await seedRandom(page);
    await startMode(page, name);
    if (name === "Custom") {
      await expect(page.locator("#screen-custom")).toBeVisible();
      await page.locator("#custom-input").fill("0.30");
      await page.getByRole("button", { name: "Start" }).click();
    }
    await expect(page.locator("#screen-play")).toBeVisible();
    await expect(page.locator(name === "Cashier" ? "#cashier-input" : "#play-tray button").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}
