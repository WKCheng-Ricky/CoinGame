import { test, expect } from "@playwright/test";
import { counterTotalPence, seedRandom, startMode } from "./helpers.js";

test("cashier: type the customer's total and Enter shows success", async ({ page }) => {
  await seedRandom(page);
  await startMode(page, "Cashier");
  await expect(page.locator("#play-pile .pile-coin").first()).toBeVisible();

  const pence = await counterTotalPence(page);
  await page.locator("#cashier-input").fill((pence / 100).toFixed(2));
  await page.locator("#cashier-input").press("Enter");
  await expect(page.locator("#play-message")).toHaveClass(/success/);
  await expect(page.locator("#btn-next")).toBeVisible();
  await expect(page.locator("#play-rounds")).toHaveText("Customers served: 1");
});
