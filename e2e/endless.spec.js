import { test, expect } from "@playwright/test";
import { seedRandom, startMode } from "./helpers.js";
import { addFromTray, parsePounds } from "./tray.js";

test("endless: build the target from the tray and Check shows success", async ({ page }) => {
  await seedRandom(page);
  await startMode(page, "Endless");
  await expect(page.locator("#play-rounds")).toHaveText("Rounds completed: 0");

  const target = (await page.locator("#play-target").textContent()).trim();
  const taps = await addFromTray(page, parsePounds(target));
  await expect(page.locator("#play-pile .pile-coin")).toHaveCount(taps);
  await page.locator("#btn-check").click();
  await expect(page.locator("#play-message")).toContainText(`Correct! You made exactly ${target}.`);
  await expect(page.locator("#play-message")).toHaveClass(/success/);
  await expect(page.locator("#btn-next")).toBeVisible();
  await expect(page.locator("#play-rounds")).toHaveText("Rounds completed: 1");
});
