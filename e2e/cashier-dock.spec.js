import { test, expect } from "./fixtures.js";
import { counterTotalPence, seedRandom, startMode } from "./helpers.js";

const PHONES = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "Galaxy A55", width: 360, height: 800 },
  { name: "iPhone 16", width: 393, height: 852 },
];
const pounds = (pence) => (pence / 100).toFixed(2);

for (const phone of PHONES) {
  test(`${phone.name} ${phone.width}x${phone.height}: the amount field, label, error and Check are in the dock and on screen`, async ({ page }) => {
    await page.setViewportSize({ width: phone.width, height: phone.height });
    await seedRandom(page);
    await startMode(page, "Cashier");
    await expect(page.locator("#cashier-input")).toBeVisible();
    await page.locator("#cashier-input").fill("abc");
    await page.locator("#btn-check").click();
    await expect(page.locator("#cashier-error")).not.toHaveText("");
    for (const sel of ["#cashier-input", 'label[for="cashier-input"]', "#cashier-error", "#btn-check", "#play-message"]) {
      await expect(page.locator(`.dock ${sel}`), `${sel} is in the dock`).toHaveCount(1);
      await expect(page.locator(sel), `${sel} is on screen`).toBeInViewport({ ratio: 1 });
    }
    // the Check button sits to the right of the field on the same row
    const m = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      return { input: r("#cashier-input"), check: r("#btn-check"), label: r('label[for="cashier-input"]'), error: r("#cashier-error"), message: r("#play-message") };
    });
    expect(m.check.left).toBeGreaterThanOrEqual(m.input.right - 1);
    expect(Math.abs((m.check.top + m.check.height / 2) - (m.input.top + m.input.height / 2))).toBeLessThan(4);
    expect(m.label.bottom).toBeLessThanOrEqual(m.input.top + 1);
    expect(m.error.top).toBeGreaterThanOrEqual(m.message.bottom - 1);
    expect(m.error.bottom).toBeLessThanOrEqual(m.label.top + 1);
  });
}

test("the old in-flow field is gone and the label reads Total (£)", async ({ page }) => {
  await startMode(page, "Cashier");
  await expect(page.locator(".content #cashier-input")).toHaveCount(0);
  await expect(page.locator(".content #cashier-answer")).toHaveCount(0);
  await expect(page.locator('label[for="cashier-input"]')).toHaveText("Total (£)");
});

test("the focused field is not covered by anything and an empty error takes no height", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startMode(page, "Cashier");
  await page.locator("#cashier-input").focus();
  const m = await page.evaluate(() => {
    const input = document.querySelector("#cashier-input").getBoundingClientRect();
    const hit = document.elementFromPoint(input.left + input.width / 2, input.top + input.height / 2);
    return { hit: hit?.id, errorHeight: document.querySelector("#cashier-error").getBoundingClientRect().height };
  });
  expect(m.hit).toBe("cashier-input");
  expect(m.errorHeight).toBe(0);
});

test("Check and Enter still check; a correct answer shows Next, locks the field and hides Check", async ({ page }) => {
  await seedRandom(page);
  await startMode(page, "Cashier");
  await expect(page.locator("#play-pile-summary")).toHaveText(/^On the counter: /);
  const sum = await counterTotalPence(page);
  await page.locator("#cashier-input").fill(pounds(sum + 1));
  await page.locator("#btn-check").click();
  await expect(page.locator("#play-message")).toHaveText("Too high");
  await page.locator("#cashier-input").fill(pounds(sum - 1));
  await page.locator("#cashier-input").press("Enter");
  await expect(page.locator("#play-message")).toHaveText("Too low");
  await page.locator("#cashier-input").fill(pounds(sum));
  await page.locator("#btn-check").click();
  await expect(page.locator("#play-message")).toHaveClass(/success/);
  await expect(page.locator("#btn-next")).toBeVisible();
  await expect(page.locator("#btn-next")).toBeInViewport({ ratio: 1 });
  await expect(page.locator("#btn-check")).toBeHidden();
  await expect(page.locator("#cashier-input")).toBeDisabled();
  await expect(page.locator(".dock #cashier-input")).toBeVisible();
});

test("the field and label are hidden in Endless and Custom", async ({ page }) => {
  await startMode(page, "Endless");
  await expect(page.locator("#cashier-input")).toBeHidden();
  await expect(page.locator('label[for="cashier-input"]')).toBeHidden();
  await page.locator("#btn-back").click();
  await startMode(page, "Custom");
  await page.locator("#custom-input").fill("1.00");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator("#cashier-input")).toBeHidden();
  await expect(page.locator('label[for="cashier-input"]')).toBeHidden();
});
