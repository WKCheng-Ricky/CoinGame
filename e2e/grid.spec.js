import { test, expect } from "./fixtures.js";
import { startMode } from "./helpers.js";

const width = (page, sel) => page.locator(sel).evaluate((el) => parseFloat(getComputedStyle(el).width));
const near = (actual, expected, tol) => expect(Math.abs(actual / expected - 1)).toBeLessThan(tol);

for (const vw of [320, 1280]) {
  test(`tray coins keep the real width ratios and the grid matches their scale at ${vw}px`, async ({ page }) => {
    await page.setViewportSize({ width: vw, height: 800 });
    await startMode(page, "Endless");
    const w = (id) => width(page, `#play-tray [data-coin="${id}"] svg`);
    near((await w("1p")) / (await w("5p")), 20.3 / 18.0, 0.01);
    near((await w("20p")) / (await w("50p")), 21.4 / 27.3, 0.01);
    const cell = await page.locator("#play-tray").evaluate((el) => parseFloat(getComputedStyle(el, "::before").backgroundSize.split(" ")[0]));
    near(cell, ((await w("1p")) * 10) / 20.3, 0.02);
  });

  test(`pile coins keep the real width ratios and the pile grid matches their scale at ${vw}px`, async ({ page }) => {
    await page.setViewportSize({ width: vw, height: 800 });
    await startMode(page, "Endless");
    await page.locator('#play-tray [data-coin="1p"]').click();
    await page.locator('#play-tray [data-coin="5p"]').click();
    await expect(page.locator("#play-pile .pile-coin")).toHaveCount(2);
    const w = (id) => width(page, `#play-pile [data-coin="${id}"] svg`);
    near((await w("1p")) / (await w("5p")), 20.3 / 18.0, 0.01);
    const cell = await page.locator("#play-pile").evaluate((el) => {
      const first = getComputedStyle(el).backgroundSize.split(" ")[0];
      // a percentage of the padding box when the browser keeps it unresolved
      return first.endsWith("%") ? (parseFloat(first) / 100) * el.clientWidth : parseFloat(first);
    });
    near(cell, ((await w("1p")) * 10) / 20.3, 0.02);
  });
}

test("one 1 cm scale note shows under the pile heading in Endless and in Cashier", async ({ page }) => {
  await startMode(page, "Endless");
  const notes = page.locator(".scale-note");
  await expect(notes).toHaveCount(1);
  await expect(notes).toBeVisible();
  await expect(notes).toHaveText("1 square = 1 cm on a real coin");
  await page.locator("#btn-back").click();
  await page.getByRole("button", { name: "Cashier", exact: true }).click();
  await expect(page.locator(".pile-area .scale-note")).toBeVisible();
  await expect(page.locator("#play-tray")).toBeHidden();
});
