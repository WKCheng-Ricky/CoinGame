import { test, expect } from "./fixtures.js";
import { COINS } from "../src/coins.js";
import { counterTotalPence, seedRandom, startMode } from "./helpers.js";

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

test("a correct answer typed with a £ prefix and Enter locks the input, shows Next and Back, focuses Next, and a second Enter changes nothing", async ({ page }) => {
  await seedRandom(page);
  const sum = await startCashier(page);
  const answer = "£" + pounds(sum);

  await input(page).fill(answer);
  await input(page).press("Enter");
  const message = `Correct! That is ${answer}.`;
  await expect(page.locator("#play-message")).toHaveText(message);
  await expect(page.locator("#play-message")).toHaveClass(/success/);
  await expect(input(page)).toBeDisabled();
  await expect(input(page)).toHaveValue(answer);
  await expect(page.locator("#btn-next")).toBeVisible();
  await expect(page.locator("#btn-back")).toBeVisible();
  await expect(page.locator("#btn-check")).toBeHidden();
  await expect(page.locator("#btn-clear")).toBeHidden();
  await expect(page.locator("#btn-next")).toBeFocused();
  await expect(page.locator("#play-rounds")).toHaveText("Customers served: 1");

  // the input is disabled, so deliver the second Enter to it directly
  await input(page).dispatchEvent("keydown", { key: "Enter" });
  await expect(page.locator("#play-rounds")).toHaveText("Customers served: 1");
  await expect(page.locator("#play-message")).toHaveText(message);
  await expect(page.locator("#btn-next")).toBeVisible();
  await expect(page.locator("#cashier-error")).toHaveText("");
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

test('counter coins cannot be removed and labels are never "Remove ..."', async ({ page }) => {
  await seedRandom(page);
  await startMode(page, "Endless");
  for (const name of ["Add £2", "Add 20p", "Add 1p"]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(3);
  await page.locator("#btn-back").click();
  await page.getByRole("button", { name: "Cashier", exact: true }).click();
  await expect(page.locator("#play-pile-summary")).toHaveText(/^On the counter: /);

  const coins = counterCoins(page);
  const count = await coins.count();
  const summary = await page.locator("#play-pile-summary").textContent();
  expect(count).toBeGreaterThanOrEqual(2);
  for (const label of await coins.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")))) {
    expect(label).toMatch(coinLabel);
  }
  await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
  await expect(page.locator(".tray-area")).toBeHidden();
  await expect(page.locator("#btn-clear")).toBeHidden();

  // the topmost coin is always clickable; a click must not remove it
  await coins.last().click();
  await expect(coins).toHaveCount(count);
  await expect(page.locator("#play-pile-summary")).toHaveText(summary);
});
