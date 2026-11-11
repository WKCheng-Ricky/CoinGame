import { test, expect } from "../fixtures.js";
import { FAST, counterTotalPence, seedRandom, startMode } from "../helpers.js";
import { addFromTray } from "../tray.js";

// The button ignores clicks until the shortened advance delay has passed, so retry the click.
async function clickWhenReady(page, button, done) {
  await expect(async () => {
    await button.click();
    await done();
  }).toPass({ timeout: 5000 });
}

test("custom: building the target and Check shows success, then Play again and Change amount work", async ({ page }) => {
  await startMode(page, "Custom", { difficulty: "easy" });
  await page.locator("#custom-input").fill("0.30");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#play-target")).toHaveText("£0.30");

  await page.getByRole("button", { name: "Add 20p", exact: true }).click();
  await page.getByRole("button", { name: "Add 10p", exact: true }).click();
  await expect(page.locator("#play-total")).toHaveText("Your total: £0.30");
  await page.locator("#btn-check").click();
  await expect(page.locator("#play-message")).toHaveText("Correct! You made exactly £0.30.");
  await expect(page.locator("#play-message")).toHaveClass(/success/);
  await expect(page.locator("#btn-check")).toBeHidden();
  await expect(page.locator("#btn-next")).toBeHidden();

  const pileCoins = page.locator("#play-pile .pile-coin");
  await clickWhenReady(page, page.locator("#btn-again"), () => expect(pileCoins).toHaveCount(0, { timeout: 100 }));
  await expect(page.locator("#play-target")).toHaveText("£0.30");
  await expect(page.locator("#btn-check")).toBeVisible();
  await expect(page.locator("#btn-again")).toBeHidden();
  await expect(page.locator("#play-message")).toHaveText("");

  await addFromTray(page, 30);
  await expect.poll(() => counterTotalPence(page)).toBe(30);
  await page.locator("#btn-check").click();
  await expect(page.locator("#btn-change")).toBeVisible();
  await page.locator("#btn-change").click();
  await expect(page.locator("#screen-custom")).toBeVisible();
  await expect(page.locator("#screen-play")).toBeHidden();
  await expect(page.locator("#custom-input")).toHaveValue("0.30");
  await expect(page.locator("#custom-input")).toBeFocused();
});

test("custom: an invalid amount shows the inline error", async ({ page }) => {
  await startMode(page, "Custom");
  await page.locator("#custom-input").fill("abc");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#custom-error")).toHaveText("Enter an amount like 3.95");
  await expect(page.locator("#custom-input")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#screen-custom")).toBeVisible();
  await expect(page.locator("#screen-play")).toBeHidden();

  await page.locator("#custom-input").fill("0");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#custom-error")).toHaveText("The amount must be more than zero");
});

test("clear empties the pile and back returns to Home", async ({ page }) => {
  await startMode(page, "Endless", { difficulty: "easy" });
  for (const name of ["Add £1", "Add 50p", "Add 2p"]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await expect(page.locator("#play-pile .pile-coin")).toHaveCount(3);
  await expect(page.locator("#play-total")).toHaveText("Your total: £1.52");

  await page.locator("#btn-clear").click();
  await expect(page.locator("#play-pile .pile-coin")).toHaveCount(0);
  await expect(page.locator("#play-total")).toHaveText("Your total: £0.00");
  await expect(page.locator("#play-pile-summary")).toHaveText("The pile is empty.");

  await page.locator("#btn-back").click();
  await expect(page.locator("#screen-home")).toBeVisible();
  await expect(page.locator("#screen-play")).toBeHidden();
});
