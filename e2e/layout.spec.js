import { test, expect } from "./fixtures.js";
import { FAST, seedRandom } from "./helpers.js";

test.use({ viewport: { width: 390, height: 844 } });

async function openCashier(page, difficulty) {
  await seedRandom(page);
  await page.goto("/?" + FAST);
  await page.locator(`#diff-${difficulty}`).check();
  await page.getByRole("button", { name: "Cashier", exact: true }).click();
  await expect(page.locator("#play-pile .pile-coin").first()).toBeVisible();
}

async function expectNoHorizontalOverflow(page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

test("easy at 390x844: Cashier coin values are visible and nothing overflows sideways", async ({ page }) => {
  await openCashier(page, "easy");
  await expect(page.locator(".board")).toHaveAttribute("data-difficulty", "easy");
  const labels = page.locator("#play-pile .pile-coin .coin-label");
  expect(await labels.count()).toBeGreaterThanOrEqual(2);
  for (const label of await labels.all()) await expect(label).toHaveCSS("opacity", "1");
  await expect(page.locator("#cashier-input")).toBeInViewport();
  await expectNoHorizontalOverflow(page);
});

test("normal at 390x844: values hide until hover or keyboard focus dwells, and nothing overflows sideways", async ({ page }) => {
  await openCashier(page, "normal");
  await expect(page.locator(".board")).toHaveAttribute("data-difficulty", "normal");
  const coins = page.locator("#play-pile .pile-coin");
  for (const label of await coins.locator(".coin-label").all()) await expect(label).toHaveCSS("opacity", "0");

  // hover the topmost coin (last drawn), so no other coin covers it
  const top = coins.last();
  await top.hover();
  await expect(top).toHaveClass(/revealed/);
  await expect(top.locator(".coin-label")).toHaveCSS("opacity", "1");
  await page.locator("#play-heading").hover();
  await expect(top).not.toHaveClass(/revealed/);

  // the heading has focus after the screen opens; Tab moves keyboard focus to the first counter coin
  await page.locator("#play-heading").focus();
  await page.keyboard.press("Tab");
  const first = coins.first();
  await expect(first).toBeFocused();
  await expect(first).toHaveClass(/revealed/);
  await expect(first.locator(".coin-label")).toHaveCSS("opacity", "1");
  await page.keyboard.press("Shift+Tab");
  await expect(first).not.toHaveClass(/revealed/);
  await expect(first.locator(".coin-label")).toHaveCSS("opacity", "0");

  await expectNoHorizontalOverflow(page);
});
