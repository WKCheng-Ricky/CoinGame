import { test, expect } from "./fixtures.js";
import { FAST, counterTotalPence, seedRandom, startMode } from "./helpers.js";

async function startCustom(page, amount) {
  await startMode(page, "Custom");
  await page.locator("#custom-input").fill(amount);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator("#play-target")).toBeVisible();
}

const CORRECT = "Correct! You made exactly £0.01.";

test("the Check button advertises Enter", async ({ page }) => {
  await startMode(page, "Endless");
  await expect(page.locator("#btn-check")).toHaveAttribute("aria-keyshortcuts", "Enter");
  await expect(page.locator("#btn-check")).toHaveAttribute("title", "Check (Enter)");
});

test("Enter with focus on the heading runs Check", async ({ page }) => {
  await startCustom(page, "0.01");
  await page.getByRole("button", { name: "Add 1p", exact: true }).click();
  await page.locator("#play-heading").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#play-message")).toHaveText(CORRECT);
});

test("Enter on a focused pile coin removes it and does not Check", async ({ page }) => {
  await startCustom(page, "0.01");
  await page.getByRole("button", { name: "Add 1p", exact: true }).click();
  const coin = page.locator("#play-pile .pile-coin");
  await coin.focus();
  await page.keyboard.press("Enter");
  await expect(coin).toHaveCount(0);
  await expect(page.locator("#play-message")).toHaveText("");
});

test("Enter on a focused Clear clears and does not Check", async ({ page }) => {
  await startCustom(page, "0.01");
  await page.getByRole("button", { name: "Add 1p", exact: true }).click();
  await page.locator("#btn-clear").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#play-pile .pile-coin")).toHaveCount(0);
  await expect(page.locator("#play-message")).toHaveText("");
});

test("Ctrl+Enter runs Check from a focused pile coin and keeps the coin", async ({ page }) => {
  await startCustom(page, "0.01");
  await page.getByRole("button", { name: "Add 1p", exact: true }).click();
  const coin = page.locator("#play-pile .pile-coin");
  await coin.focus();
  await page.keyboard.press("Control+Enter");
  await expect(page.locator("#play-message")).toHaveText(CORRECT);
  await expect(coin).toHaveCount(1);
});

test("a held Enter (repeated keydown) checks once", async ({ page }) => {
  await startCustom(page, "0.05");
  await page.getByRole("button", { name: "Add 1p", exact: true }).click();
  await page.locator("#play-heading").focus();
  await page.evaluate(() => {
    window.__announced = 0;
    new MutationObserver((records) => {
      for (const r of records) if (r.target.textContent) window.__announced++;
    }).observe(document.querySelector("#play-message"), { childList: true, characterData: true, subtree: true });
  });
  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  await expect(page.locator("#play-message")).toHaveText("Not enough yet");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__announced)).toBe(1);
});

test("Enter does nothing on Home: no round starts and no score, message or coin appears", async ({ page }) => {
  await page.goto("/?" + FAST);
  for (const focus of ["body", "#screen-home h1", "#diff-normal"]) {
    await page.evaluate((sel) => (sel === "body" ? document.activeElement.blur() : document.querySelector(sel).focus()), focus);
    await page.keyboard.press("Enter");
    await expect(page.locator("#screen-home")).toBeVisible();
    await expect(page.locator("#screen-play")).toBeHidden();
    await expect(page.locator("#screen-custom")).toBeHidden();
    await expect(page.locator("#play-target")).toHaveText("");
    await expect(page.locator("#play-message")).toHaveText("");
    await expect(page.locator("#play-pile .pile-coin")).toHaveCount(0);
    await expect(page.locator("#diff-normal")).toBeChecked();
  }
  // the control group: the same press on the play screen does check
  await page.locator("#btn-endless").click();
  await expect(page.locator("#play-target")).not.toHaveText("");
  await page.keyboard.press("Enter");
  await expect(page.locator("#play-message")).not.toHaveText("");
});

test("Enter in the Custom amount form only submits the form", async ({ page }) => {
  await startMode(page, "Custom");
  await page.locator("#custom-input").fill("0.30");
  await page.keyboard.press("Enter");
  await expect(page.locator("#play-target")).toHaveText("£0.30");
  await expect(page.locator("#play-message")).toHaveText("");
});

test("Enter does nothing once the round is solved", async ({ page }) => {
  await startCustom(page, "0.01");
  await page.getByRole("button", { name: "Add 1p", exact: true }).click();
  await page.locator("#btn-check").click();
  await expect(page.locator("#play-message")).toHaveText(CORRECT);
  await page.locator("#play-heading").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await expect(page.locator("#play-message")).toHaveText(CORRECT);
  await expect(page.locator("#btn-again")).toBeVisible();
});

test("Cashier: Enter on the page checks the typed amount", async ({ page }) => {
  await seedRandom(page);
  await startMode(page, "Cashier");
  await page.locator("#cashier-input").fill("0.01");
  await page.locator("#play-heading").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#play-message")).not.toHaveText("");
});

test("Cashier: Ctrl+Enter in the amount field checks once", async ({ page }) => {
  await seedRandom(page);
  await startMode(page, "Cashier");
  await page.locator("#cashier-input").fill("0.01");
  await page.evaluate(() => {
    window.__announced = 0;
    new MutationObserver((records) => {
      for (const r of records) if (r.target.textContent) window.__announced++;
    }).observe(document.querySelector("#play-message"), { childList: true, characterData: true, subtree: true });
  });
  await page.locator("#cashier-input").press("Control+Enter");
  await expect(page.locator("#play-message")).not.toHaveText("");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__announced)).toBe(1);
});

// Solve a Cashier customer with a real Enter press on the heading, so focus lands on Next.
async function solveToNext(page) {
  await seedRandom(page);
  await startMode(page, "Cashier");
  await expect(page.locator("#play-pile-summary")).toHaveText(/^On the counter: /);
  const sum = await counterTotalPence(page);
  await page.locator("#cashier-input").fill((sum / 100).toFixed(2));
  await page.locator("#play-heading").focus();
  await page.keyboard.down("Enter");
  await expect(page.locator("#btn-next")).toBeFocused();
  await page.evaluate(() => {
    window.__nextClicks = 0;
    document.querySelector("#btn-next").addEventListener("click", () => { window.__nextClicks++; });
  });
  await expect(page.locator("#play-rounds")).toHaveText("Customers served: 1");
  await page.waitForTimeout(350); // past the (shortened) Next guard, like the OS key-repeat delay
}

test("a held Enter that solves the round does not press the Next it moves focus to", async ({ page }) => {
  await solveToNext(page);
  await page.keyboard.down("Enter"); // auto-repeat of the still-held key
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__nextClicks)).toBe(0);
  await expect(page.locator("#btn-next")).toBeVisible();
  await expect(page.locator("#play-rounds")).toHaveText("Customers served: 1");
  // a deliberate new press on the focused Next still works
  await page.keyboard.press("Enter");
  expect(await page.evaluate(() => window.__nextClicks)).toBe(1);
  await expect(page.locator("#btn-next")).toBeHidden();
});

test("a held Space on a focused Next presses it at most once", async ({ page }) => {
  await solveToNext(page);
  await page.keyboard.up("Enter");
  await page.keyboard.down(" ");
  await page.keyboard.down(" ");
  await page.keyboard.down(" ");
  await page.keyboard.up(" ");
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.__nextClicks)).toBe(1);
  await expect(page.locator("#btn-next")).toBeHidden();
});

test("auto-repeat keydowns for Enter and Space are default-prevented on the play screen but not on Home", async ({ page }) => {
  const repeat = (sel, key) => page.evaluate(([s, k]) => {
    const e = new KeyboardEvent("keydown", { key: k, repeat: true, bubbles: true, cancelable: true });
    document.querySelector(s).dispatchEvent(e);
    return e.defaultPrevented;
  }, [sel, key]);
  await startMode(page, "Endless");
  for (const key of ["Enter", " "]) expect(await repeat("#btn-clear", key), key).toBe(true);
  expect(await repeat("#btn-clear", "a")).toBe(false);
  await page.locator("#btn-back").click();
  expect(await repeat("#btn-endless", "Enter")).toBe(false);
});
