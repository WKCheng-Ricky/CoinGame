import { test, expect } from "./fixtures.js";
import { startMode } from "./helpers.js";

const FRAME_W = 433;
const FRAME_H = 771;
const SIZES = [
  [433, 771], [375, 667], [360, 800], [393, 852], [1440, 960], [912, 1368], [852, 393],
];

async function open(page, screen) {
  if (screen === "Home") {
    await page.goto("/?dwell=50&hold=50&advance=250");
    await expect(page.locator("#screen-home")).toBeVisible();
  } else {
    await startMode(page, screen);
    await expect(page.locator("#screen-play")).toBeVisible();
  }
}

const measure = (page) => page.evaluate(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el || el.getClientRects().length === 0) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const play = document.querySelector("#screen-play");
  const main = document.querySelector("main");
  const mainStyle = getComputedStyle(main);
  const playStyle = getComputedStyle(play);
  return {
    vw: window.innerWidth,
    vh: window.innerHeight,
    main: box("main"),
    topbar: box(".topbar"),
    content: box(".content"),
    dock: box(".dock"),
    play: box("#screen-play"),
    rowGap: parseFloat(playStyle.rowGap) || 0,
    radius: parseFloat(mainStyle.borderTopLeftRadius),
    borderWidth: parseFloat(mainStyle.borderTopWidth),
    doc: {
      scrollHeight: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth,
      bodyScrollHeight: document.body.scrollHeight,
    },
  };
});

for (const [w, h] of SIZES) {
  for (const screen of ["Home", "Endless", "Cashier"]) {
    test(`${w}x${h} ${screen}: the frame is phone-sized, centred, and the page never scrolls`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await open(page, screen);
      const m = await measure(page);
      expect(m.main.width).toBeCloseTo(Math.min(w, FRAME_W), 0);
      expect(m.main.height).toBeCloseTo(Math.min(h, FRAME_H), 0);
      if (w > FRAME_W) expect(Math.abs(m.main.left + m.main.width / 2 - w / 2)).toBeLessThan(1);
      if (h > FRAME_H) expect(Math.abs(m.main.top + m.main.height / 2 - h / 2)).toBeLessThan(1);
      expect(m.doc.scrollHeight).toBeLessThanOrEqual(m.vh);
      expect(m.doc.scrollWidth).toBeLessThanOrEqual(m.vw);
      // decoration only when the viewport is wider than the frame
      if (w > FRAME_W) {
        expect(m.radius).toBeGreaterThan(0);
        expect(m.borderWidth).toBeGreaterThan(0);
      } else {
        expect(m.radius).toBe(0);
        expect(m.borderWidth).toBe(0);
      }
      if (screen === "Home") return;
      for (const key of ["topbar", "dock"]) {
        const b = m[key];
        expect(b, key).not.toBeNull();
        expect(b.left).toBeGreaterThanOrEqual(m.main.left - 0.5);
        expect(b.right).toBeLessThanOrEqual(m.main.right + 0.5);
        expect(b.top).toBeGreaterThanOrEqual(m.main.top - 0.5);
        expect(b.bottom).toBeLessThanOrEqual(m.main.bottom + 0.5);
        expect(b.top).toBeGreaterThanOrEqual(-0.5);
        expect(b.bottom).toBeLessThanOrEqual(m.vh + 0.5);
      }
      // no gap: the three parts, plus the two flex gaps, fill the screen exactly
      const sum = m.topbar.height + m.content.height + m.dock.height + 2 * m.rowGap;
      expect(Math.abs(sum - m.play.height)).toBeLessThan(2);
      expect(Math.abs(m.dock.bottom - m.play.bottom)).toBeLessThan(2);
      expect(Math.abs(m.topbar.top - m.play.top)).toBeLessThan(2);
    });
  }
}

test("433x771: the Endless pile card and the whole Home screen need no scrolling", async ({ page }) => {
  await page.setViewportSize({ width: FRAME_W, height: FRAME_H });
  await open(page, "Home");
  expect(await page.locator("#screen-home").evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0);
  await page.locator("#btn-endless").click();
  const over = await page.locator(".content").evaluate((el) => el.scrollHeight - el.clientHeight);
  expect(over).toBeLessThanOrEqual(0);
  await expect(page.locator(".pile-area")).toBeInViewport({ ratio: 1 });
});

test("1440x960: dragging a tray coin to the pile drops it where it was released (fixed ghost)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await startMode(page, "Endless");
  const coin = page.getByRole("button", { name: "Add 50p", exact: true });
  const pile = page.locator("#play-pile");
  const from = await coin.boundingBox();
  const p = await pile.boundingBox();
  const target = { x: p.x + p.width * 0.3, y: p.y + p.height * 0.35 };
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  // the ghost follows the pointer while it is dragged
  const ghost = await page.locator(".tray-ghost").boundingBox();
  expect(Math.abs(ghost.x + ghost.width / 2 - target.x)).toBeLessThan(3);
  expect(Math.abs(ghost.y + ghost.height / 2 - target.y)).toBeLessThan(3);
  await page.mouse.up();
  const placed = page.locator("#play-pile .pile-coin");
  await expect(placed).toHaveCount(1);
  await page.waitForTimeout(400); // the coin glides to its settled spot
  const b = await placed.boundingBox();
  expect(Math.abs(b.x + b.width / 2 - target.x)).toBeLessThan(6);
  expect(Math.abs(b.y + b.height / 2 - target.y)).toBeLessThan(6);
});

for (const [screen, w, h] of [
  ["Cashier", 433, 771], ["Cashier", 375, 667], ["Cashier", 912, 1368], ["Endless", 433, 771],
]) {
  test(`${w}x${h} ${screen}: the pile card sits centred between the top bar and the dock (no dead strip)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await open(page, screen);
    const m = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const card = r(".pile-area");
      return { above: card.top - r(".topbar").bottom, below: r(".dock").top - card.bottom, card: card.height };
    });
    const spare = m.above + m.below;
    expect(Math.abs(m.above - m.below)).toBeLessThanOrEqual(2);
    expect(m.above).toBeLessThanOrEqual(spare / 2 + 2);
    expect(m.below).toBeLessThanOrEqual(spare / 2 + 2);
  });
}
