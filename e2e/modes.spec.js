import { COINS } from "../src/coins.js";
import { test, expect } from "./fixtures.js";
import { FAST, counterTotalPence, seedRandom, startMode } from "./helpers.js";

const LARGEST_FIRST = [...COINS].sort((a, b) => b.pence - a.pence);

function parsePounds(text) {
  const m = /^£(\d+)\.(\d{2})$/.exec(text.trim());
  if (!m) throw new Error(`Not an amount: "${text}"`);
  return Number(m[1]) * 100 + Number(m[2]);
}

// Tap tray coins (largest first) until the pile holds exactly `pence`.
async function buildFromTray(page, pence) {
  let left = pence;
  for (const coin of LARGEST_FIRST) {
    while (left >= coin.pence) {
      await page.getByRole("button", { name: `Add ${coin.label}`, exact: true }).click();
      left -= coin.pence;
    }
  }
  await expect.poll(() => counterTotalPence(page)).toBe(pence);
}

// The button ignores clicks until the shortened advance delay has passed, so retry the click.
async function clickWhenReady(page, button, done) {
  await expect(async () => {
    await button.click();
    await done();
  }).toPass({ timeout: 5000 });
}

test("home shows Endless, Custom and Cashier buttons", async ({ page }) => {
  await page.goto("/?" + FAST);
  await expect(page.locator("#screen-home")).toBeVisible();
  for (const name of ["Endless", "Custom", "Cashier"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(page.locator("#screen-play")).toBeHidden();
});

test("custom: building the target and Check shows success, then Play again and Change amount work", async ({ page }) => {
  await startMode(page, "Custom");
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

  await buildFromTray(page, 30);
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

test("endless: a correct pile shows Next and the rounds counter increases", async ({ page }) => {
  await seedRandom(page);
  await startMode(page, "Endless");
  await expect(page.locator("#play-rounds")).toHaveText("Rounds completed: 0");

  const first = (await page.locator("#play-target").textContent()).trim();
  await buildFromTray(page, parsePounds(first));
  await page.locator("#btn-check").click();
  await expect(page.locator("#play-message")).toHaveText(`Correct! You made exactly ${first}.`);
  await expect(page.locator("#btn-next")).toBeVisible();
  await expect(page.locator("#btn-again")).toBeHidden();
  await expect(page.locator("#play-rounds")).toHaveText("Rounds completed: 1");

  await clickWhenReady(page, page.locator("#btn-next"), () => expect(page.locator("#btn-next")).toBeHidden({ timeout: 100 }));
  await expect(page.locator("#play-target")).not.toHaveText(first);
  await expect(page.locator("#play-pile .pile-coin")).toHaveCount(0);
  await expect(page.locator("#play-rounds")).toHaveText("Rounds completed: 1");

  const second = (await page.locator("#play-target").textContent()).trim();
  await buildFromTray(page, parsePounds(second));
  await page.locator("#btn-check").click();
  await expect(page.locator("#play-rounds")).toHaveText("Rounds completed: 2");
});

test("clear empties the pile and back returns to Home", async ({ page }) => {
  await startMode(page, "Endless");
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

test("easy shows coin values and normal hides them until hover", async ({ page }) => {
  await page.goto("/?" + FAST);
  await page.locator("#diff-easy").check();
  await page.getByRole("button", { name: "Endless", exact: true }).click();
  await page.getByRole("button", { name: "Add 20p", exact: true }).click();
  const coin = page.locator("#play-pile .pile-coin").first();
  await expect(page.locator(".board")).toHaveAttribute("data-difficulty", "easy");
  await expect(coin.locator(".coin-label")).toHaveCSS("opacity", "1");

  await page.locator("#btn-back").click();
  await page.locator("#diff-normal").check();
  await page.getByRole("button", { name: "Endless", exact: true }).click();
  await page.getByRole("button", { name: "Add 20p", exact: true }).click();
  await expect(page.locator(".board")).toHaveAttribute("data-difficulty", "normal");
  await expect(coin.locator(".coin-label")).toHaveCSS("opacity", "0");
  await expect(coin).not.toHaveClass(/revealed/);

  await coin.hover();
  await expect(coin).toHaveClass(/revealed/);
  await expect(coin.locator(".coin-label")).toHaveCSS("opacity", "1");

  await page.locator("#play-heading").hover();
  await expect(coin).not.toHaveClass(/revealed/);
  await expect(coin.locator(".coin-label")).toHaveCSS("opacity", "0");
});
