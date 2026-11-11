import { test, expect } from "../fixtures.js";
import { seedRandom, startMode } from "../helpers.js";

const pileCoins = (page) => page.locator("#play-pile .pile-coin");

async function addCoins(page, labels) {
  for (const label of labels) await page.getByRole("button", { name: `Add ${label}`, exact: true }).click();
  await expect(pileCoins(page)).toHaveCount(labels.length);
}

test("tapping a pile coin removes it and hands focus to the top coin, then to the tray", async ({ page }) => {
  await seedRandom(page);
  await startMode(page, "Endless", { difficulty: "easy" });
  await addCoins(page, ["50p", "5p"]);
  await expect(page.locator("#play-total")).toHaveText("Your total: £0.55");

  await page.getByRole("button", { name: "Remove 5p", exact: true }).click();
  await expect(pileCoins(page)).toHaveCount(1);
  await expect(page.locator("#play-total")).toHaveText("Your total: £0.50");
  await expect(page.locator("#play-pile-summary")).toHaveText("In the pile: 1 × 50p");
  await expect(page.getByRole("button", { name: "Remove 50p", exact: true })).toBeFocused();

  // removing the last coin moves focus to the matching tray coin
  await page.keyboard.press("Enter");
  await expect(pileCoins(page)).toHaveCount(0);
  await expect(page.locator("#play-total")).toHaveText("Your total: £0.00");
  await expect(page.getByRole("button", { name: "Add 50p", exact: true })).toBeFocused();
});

test.describe("touch", () => {
  test.use({ hasTouch: true });

  // Hold a finger on the element's centre until its value is revealed, then lift it.
  async function longPress(page, locator) {
    const b = await locator.boundingBox();
    const point = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await expect(locator).toHaveClass(/revealed/);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  }
});
