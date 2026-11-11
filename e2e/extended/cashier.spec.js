import { test, expect } from "../fixtures.js";
import { COINS } from "../../src/constants/coins.js";
import { counterTotalPence, seedRandom, startMode } from "../helpers.js";

const pounds = (pence) => (pence / 100).toFixed(2);

const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const coinLabel = new RegExp(`^(${COINS.map((c) => escapeRe(c.label)).join("|")}) coin$`);

const input = (page) => page.locator("#cashier-input");
const counterCoins = (page) => page.locator("#play-pile .pile-coin");

// Start Cashier and wait for the dealt coins; returns their total in pence.
async function startCashier(page) {
  await startMode(page, "Cashier");
  await expect(page.locator("#play-pile-summary")).toHaveText(/^On the counter: /);
  return counterTotalPence(page);
}

test("invalid input shows the shared error with aria-invalid", async ({ page }) => {
  await seedRandom(page);
  const sum = await startCashier(page);
  const error = page.locator("#cashier-error");
  for (const text of ["", ".", "abc"]) {
    // reset: a valid wrong amount shows a hint and clears the shared error
    await input(page).fill(pounds(sum + 1));
    await page.locator("#btn-check").click();
    await expect(page.locator("#play-message")).toHaveText("Too high");
    await expect(error).toHaveText("");
    await expect(input(page)).not.toHaveAttribute("aria-invalid", "true");

    await input(page).fill(text);
    await page.locator("#btn-check").click();
    await expect(error).toHaveText("Enter an amount like 3.95");
    await expect(input(page)).toHaveAttribute("aria-invalid", "true");
  }
});

test("zero shows the more-than-zero error and no hint", async ({ page }) => {
  await seedRandom(page);
  await startCashier(page);
  await input(page).fill("0");
  await input(page).press("Enter");
  await expect(page.locator("#cashier-error")).toHaveText("The amount must be more than zero");
  await expect(input(page)).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#play-message")).toHaveText("");
  await expect(page.locator("#play-message")).not.toHaveClass(/hint/);
  await expect(page.locator("#btn-next")).toBeHidden();
});

test("too high and too low hints keep the typed text and the coins", async ({ page }) => {
  await seedRandom(page);
  const sum = await startCashier(page);
  const summary = await page.locator("#play-pile-summary").textContent();
  const count = await counterCoins(page).count();

  await input(page).fill(pounds(sum + 1));
  await page.locator("#btn-check").click();
  await expect(page.locator("#play-message")).toHaveText("Too high");
  await expect(page.locator("#play-message")).toHaveClass(/hint/);
  await expect(input(page)).toHaveValue(pounds(sum + 1));
  await expect(input(page)).not.toHaveAttribute("aria-invalid");
  await expect(page.locator("#cashier-error")).toHaveText("");

  await input(page).fill(pounds(sum - 1));
  await input(page).press("Enter");
  await expect(page.locator("#play-message")).toHaveText("Too low");
  await expect(input(page)).toHaveValue(pounds(sum - 1));
  await expect(input(page)).toBeEnabled();
  await expect(counterCoins(page)).toHaveCount(count);
  await expect(page.locator("#play-pile-summary")).toHaveText(summary);
  await expect(page.locator("#play-rounds")).toHaveText("Customers served: 0");
});

test("Next inside the advance delay is ignored, after it advances", async ({ page }) => {
  await seedRandom(page);
  const sum = await startCashier(page);
  const summary = await page.locator("#play-pile-summary").textContent();
  await input(page).fill(pounds(sum));

  // answer and click Next in one task, well inside the shortened 250 ms guard
  await page.evaluate(() => {
    document.getElementById("cashier-input").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    document.getElementById("btn-next").click();
  });
  await expect(page.locator("#play-rounds")).toHaveText("Customers served: 1");
  await expect(page.locator("#play-pile-summary")).toHaveText(summary);
  await expect(page.locator("#btn-next")).toBeVisible();
  await expect(input(page)).toBeDisabled();

  await page.waitForTimeout(300);
  await page.locator("#btn-next").click();
  await expect(page.locator("#play-pile-summary")).not.toHaveText(summary);
  await expect(page.locator("#play-pile-summary")).toHaveText(/^On the counter: /);
  await expect(input(page)).toHaveValue("");
  await expect(input(page)).toBeEnabled();
  await expect(page.locator("#btn-next")).toBeHidden();
  await expect(page.locator("#btn-check")).toBeVisible();
  await expect(page.locator("#play-message")).toHaveText("");
  await expect(page.locator("#play-rounds")).toHaveText("Customers served: 1");
  await expect(page.locator("#play-heading")).toBeFocused();
});
