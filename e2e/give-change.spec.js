import { test, expect } from "@playwright/test";
import { counterTotalPence, seedRandom, startMode } from "./helpers.js";
import { addFromTray, parsePounds } from "./tray.js";

test("give change: work out the change and Check shows success", async ({ page }) => {
  await seedRandom(page);
  // the Easy preset sets Short-paying customers to Off, so the customer never underpays
  await startMode(page, "Give Change", { difficulty: "easy" });
  await expect(page.locator("#play-heading")).toContainText("Price £");
  await expect(page.locator("#play-pile .pile-coin").first()).toBeVisible();

  const paid = await counterTotalPence(page);
  const price = parsePounds(await page.locator("#play-target").textContent());
  const due = paid - price;
  expect(due).toBeGreaterThanOrEqual(0);

  if (due === 0) {
    await page.locator("#btn-none").click();
  } else {
    const taps = await addFromTray(page, due);
    await expect(page.locator("#change-pile .pile-coin")).toHaveCount(taps);
    await page.locator("#btn-check").click();
  }
  await expect(page.locator("#play-message")).toHaveClass(/success/);
  await expect(page.locator("#play-rounds")).toHaveText("Customers served: 1");
});
