import { test, expect } from "./fixtures.js";
import { FAST, startMode } from "./helpers.js";

const PHONES = [
  { name: "iPhone SE", width: 375, height: 667, pileFits: false },
  { name: "Galaxy A55", width: 360, height: 800, pileFits: true },
  { name: "iPhone 16", width: 393, height: 852, pileFits: true },
];

const width = (page, sel) => page.locator(sel).evaluate((el) => parseFloat(getComputedStyle(el).width));
const near = (actual, expected, tol) => expect(Math.abs(actual / expected - 1)).toBeLessThan(tol);

async function centre(locator) {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

async function startCustom(page, amount) {
  await startMode(page, "Custom");
  await page.locator("#custom-input").fill(amount);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.locator("#play-target")).toBeVisible();
}

test.describe("running total", () => {
  test("is hidden in Normal and shown in Easy", async ({ page }) => {
    await startMode(page, "Endless");
    await page.getByRole("button", { name: "Add 20p", exact: true }).click();
    await expect(page.locator("#play-pile .pile-coin")).toHaveCount(1);
    await expect(page.locator("#play-total")).toBeHidden();
    await page.locator("#btn-back").click();

    await page.locator("#diff-easy").check();
    await page.getByRole("button", { name: "Endless", exact: true }).click();
    await page.getByRole("button", { name: "Add 20p", exact: true }).click();
    await expect(page.locator("#play-total")).toBeVisible();
    await expect(page.locator("#play-total")).toHaveText("Your total: £0.20");
  });

  test("is hidden in Cashier in both difficulties", async ({ page }) => {
    for (const difficulty of ["normal", "easy"]) {
      await startMode(page, "Cashier", { difficulty });
      await expect(page.locator("#play-total")).toBeHidden();
    }
  });
});

test("Normal still hides the tray numerals and Easy shows them", async ({ page }) => {
  await startMode(page, "Endless");
  const labels = page.locator("#play-tray .coin-label");
  expect(await labels.count()).toBe(8);
  for (const label of await labels.all()) await expect(label).toHaveCSS("opacity", "0");
  await page.locator("#btn-back").click();
  await page.locator("#diff-easy").check();
  await page.getByRole("button", { name: "Endless", exact: true }).click();
  for (const label of await labels.all()) await expect(label).toHaveCSS("opacity", "1");
});

test("a dragged tray coin does not show its numeral in Normal", async ({ page }) => {
  await startMode(page, "Endless");
  const coin = page.getByRole("button", { name: "Add 50p", exact: true });
  const from = await centre(coin);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y - 80, { steps: 5 });
  await expect(page.locator(".tray-ghost .coin-label")).toHaveCSS("opacity", "0");
  await page.mouse.up();
});

for (const phone of PHONES) {
  for (const mode of ["Endless", "Custom"]) {
    test(`${phone.name} ${phone.width}x${phone.height}: ${mode} dock, tray, Check and Clear are on screen`, async ({ page }) => {
      await page.setViewportSize({ width: phone.width, height: phone.height });
      if (mode === "Endless") await startMode(page, "Endless");
      else await startCustom(page, "3.95");
      await expect(page.locator(".dock #play-tray")).toHaveCount(1);
      await expect(page.locator(".dock")).toBeInViewport({ ratio: 1 });
      for (const coin of await page.locator("#play-tray .coin").all()) await expect(coin).toBeInViewport({ ratio: 1 });
      await expect(page.locator("#btn-check")).toBeInViewport({ ratio: 1 });
      await expect(page.locator("#btn-clear")).toBeInViewport({ ratio: 1 });
      if (phone.pileFits) await expect(page.locator(".pile-area")).toBeInViewport({ ratio: 1 });
    });
  }
}

test("a wrong Check shows its message inside the dock and in the viewport at 375x667", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startCustom(page, "0.05");
  await page.getByRole("button", { name: "Add 1p", exact: true }).click();
  await page.locator("#btn-check").click();
  await expect(page.locator("#play-message")).toHaveText("Not enough yet");
  await expect(page.locator(".dock #play-message")).toHaveCount(1);
  await expect(page.locator("#play-message")).toBeInViewport({ ratio: 1 });
});

test("Cashier has no tray and the dock still shows the buttons", async ({ page }) => {
  await startMode(page, "Cashier");
  await expect(page.locator("#play-tray")).toBeHidden();
  await expect(page.locator(".dock")).toBeVisible();
  await expect(page.locator(".dock #btn-check")).toBeVisible();
});

test("tapping a tray coin adds it; dragging one onto the pile adds it; dropping it outside does not", async ({ page }) => {
  await startMode(page, "Endless", { difficulty: "easy" });
  const pile = page.locator("#play-pile");
  const coins = page.locator("#play-pile .pile-coin");
  await page.getByRole("button", { name: "Add 20p", exact: true }).click();
  await expect(coins).toHaveCount(1);
  const tray50 = page.getByRole("button", { name: "Add 50p", exact: true });
  await drag(page, await centre(tray50), await centre(pile));
  await expect(coins).toHaveCount(2);
  await expect(page.locator("#play-total")).toHaveText("Your total: £0.70");
  await drag(page, await centre(tray50), await centre(page.locator("#play-heading")));
  await expect(coins).toHaveCount(2);
  await expect(page.locator(".tray-ghost")).toHaveCount(0);
});

test("the tray is a dashed box like the pile and its grid fills the whole box", async ({ page }) => {
  await startMode(page, "Endless");
  const style = (sel) => page.locator(sel).evaluate((el) => {
    const s = getComputedStyle(el);
    return { radius: s.borderTopLeftRadius, bg: s.backgroundColor, border: s.borderTopStyle };
  });
  const tray = await style("#play-tray");
  const pile = await style("#play-pile");
  expect(tray.border).toBe("dashed");
  expect(tray.radius).toBe(pile.radius);
  expect(tray.bg).toBe(pile.bg);
  const m = await page.locator("#play-tray").evaluate((el) => {
    const s = getComputedStyle(el, "::before");
    return {
      w: parseFloat(s.width), h: parseFloat(s.height), cw: el.clientWidth, ch: el.clientHeight,
      cell: parseFloat(s.backgroundSize.split(" ")[0]),
    };
  });
  expect(Math.abs(m.w - m.cw)).toBeLessThan(1);
  expect(Math.abs(m.h - m.ch)).toBeLessThan(1);
  near(m.cell, ((await width(page, '#play-tray [data-coin="1p"] svg')) * 10) / 20.3, 0.02);
});

test("wide screens: one row of eight with the buttons to the right of the tray", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await startMode(page, "Endless");
  const m = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll("#play-tray .coin")].map((el) => el.getBoundingClientRect());
    const tray = document.querySelector("#play-tray").getBoundingClientRect();
    const actions = document.querySelector(".dock .actions").getBoundingClientRect();
    return { mids: boxes.map((r) => r.top + r.height / 2), tray, actions };
  });
  expect(m.mids).toHaveLength(8);
  expect(Math.max(...m.mids) - Math.min(...m.mids)).toBeLessThan(4);
  expect(m.actions.left).toBeGreaterThanOrEqual(m.tray.right - 1);
});
