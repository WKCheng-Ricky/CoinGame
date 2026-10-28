import { pileBox } from "../src/game.js";
import { test, expect } from "./fixtures.js";
import { FAST, seedRandom } from "./helpers.js";

const pile = (page) => page.locator("#play-pile");
const pileCoins = (page) => page.locator("#play-pile .pile-coin");
const badges = (page) => page.locator("#play-pile .stack-badge");

// Open Endless with the given query string (fast timings by default) and a seeded Math.random.
async function openEndless(page, query = FAST, { difficulty } = {}) {
  await seedRandom(page);
  await page.goto("/?" + query);
  if (difficulty) await page.locator(`#diff-${difficulty}`).check();
  await page.getByRole("button", { name: "Endless", exact: true }).click();
}

async function addCoin(page, label) {
  await page.getByRole("button", { name: `Add ${label}`, exact: true }).click();
}

async function centre(locator) {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

// The coin's position as pile percentages, read from its inline left/top style
// (Chromium serialises these to 6 significant digits, so compare to 3 decimal places).
const position = (coin) => coin.evaluate((el) => ({ left: parseFloat(el.style.left), top: parseFloat(el.style.top) }));

// Press at `from`, move past the drag threshold to `to` in a few steps, release.
async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

// Two 20p coins in one stack: tap one in, then drag a second from the tray onto its centre.
async function buildStack(page) {
  await addCoin(page, "20p");
  const target = await centre(pileCoins(page).first());
  await drag(page, await centre(page.getByRole("button", { name: "Add 20p", exact: true })), target);
  await expect(pileCoins(page)).toHaveCount(2);
  await expect(badges(page)).toHaveText(["×2"]);
}

test("dragging a pile coin changes its left/top style", async ({ page }) => {
  await openEndless(page);
  await addCoin(page, "50p");
  const coin = pileCoins(page).first();
  const before = await position(coin);
  const from = await centre(coin);
  await drag(page, from, { x: from.x + 40, y: from.y + 30 });

  await expect.poll(() => position(coin)).not.toEqual(before);
  const after = await position(coin);
  expect(after.left).toBeGreaterThan(before.left);
  expect(after.top).toBeGreaterThan(before.top);
  await expect(coin).not.toHaveClass(/dragging/);
  // the drag is not a tap: the coin is still on the pile
  await expect(pileCoins(page)).toHaveCount(1);
});

test("dropping a pile coin outside the board pins it to the nearest edge", async ({ page }) => {
  await openEndless(page);
  await addCoin(page, "10p");
  const coin = pileCoins(page).first();
  const box = await pile(page).boundingBox();
  // up and to the right of the pile's top-right corner, still inside the viewport
  const to = { x: box.x + box.width + 80, y: Math.max(4, box.y - 40) };
  expect(to.y).toBeLessThan(box.y);
  await drag(page, await centre(coin), to);

  const edge = { left: pileBox({ x: 0.5, y: 0 }).left, top: pileBox({ x: 0, y: -0.5 }).top };
  await expect.poll(async () => (await position(coin)).left).toBeCloseTo(edge.left, 3);
  const at = await position(coin);
  expect(at.top).toBeCloseTo(edge.top, 3);
  expect(at.left).toBeLessThanOrEqual(edge.left + 1e-3);
  expect(at.top).toBeGreaterThanOrEqual(edge.top - 1e-3);
  await expect(pileCoins(page)).toHaveCount(1);
  await expect(coin).toBeInViewport();
});

test("arrow keys move a focused pile coin", async ({ page }) => {
  await openEndless(page);
  await addCoin(page, "£1");
  const coin = pileCoins(page).first();
  const start = await position(coin);

  await coin.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await position(coin)).left).toBeGreaterThan(start.left);
  await expect(coin).toBeFocused();

  // Shift makes a bigger step; ArrowUp moves the coin up
  const mid = await position(coin);
  await page.keyboard.press("Shift+ArrowUp");
  await expect.poll(async () => (await position(coin)).top).toBeLessThan(mid.top);
  const end = await position(coin);
  expect(end.left).toBeCloseTo(mid.left, 3);
  expect(mid.top - end.top).toBeGreaterThan(mid.left - start.left);
  await expect(coin).toBeFocused();
  await expect(pileCoins(page)).toHaveCount(1);
});

test("holding a coin in a stack for the shortened hold separates it", async ({ page }) => {
  await openEndless(page);
  await buildStack(page);
  const top = pileCoins(page).last();
  const bottom = pileCoins(page).first();
  const bottomBefore = await position(bottom);

  const from = await centre(top);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // the shortened hold detaches the top coin and the stack badge drops
  await expect(top).toHaveClass(/detached/);
  await expect(badges(page)).toHaveCount(0);
  await page.mouse.move(from.x + 60, from.y + 40, { steps: 5 });
  await page.mouse.up();

  await expect(top).not.toHaveClass(/detached/);
  await expect(badges(page)).toHaveCount(0);
  await expect(pileCoins(page)).toHaveCount(2);
  expect(await position(bottom)).toEqual(bottomBefore);
  const moved = await position(pileCoins(page).last());
  expect(moved.left).toBeGreaterThan(bottomBefore.left);
  expect(moved.top).toBeGreaterThan(bottomBefore.top);
});

test("holding a stacked coin and releasing it in place nudges it off the stack", async ({ page }) => {
  await openEndless(page);
  await buildStack(page);
  const top = pileCoins(page).last();
  const before = await position(top);

  const from = await centre(top);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await expect(top).toHaveClass(/detached/);
  await page.mouse.up();

  await expect(top).not.toHaveClass(/detached/);
  await expect.poll(() => position(top)).not.toEqual(before);
  await expect(badges(page)).toHaveCount(0);
  // the held release is not a tap: both coins stay
  await expect(pileCoins(page)).toHaveCount(2);
});

test("dragging a stack moves the group together", async ({ page }) => {
  // a long hold, so the quick drag below can never become a detach
  await openEndless(page, "dwell=50&hold=5000&advance=250");
  await buildStack(page);
  const coins = pileCoins(page);
  const before = await Promise.all([position(coins.nth(0)), position(coins.nth(1))]);

  const from = await centre(coins.last());
  await drag(page, from, { x: from.x - 50, y: from.y + 35 });

  await expect.poll(() => position(coins.nth(0))).not.toEqual(before[0]);
  const after = await Promise.all([position(coins.nth(0)), position(coins.nth(1))]);
  for (let i = 0; i < 2; i++) {
    expect(after[i].left).toBeLessThan(before[i].left);
    expect(after[i].top).toBeGreaterThan(before[i].top);
  }
  // the members kept their offsets, so the stack is intact
  expect(after[1].left - after[0].left).toBeCloseTo(before[1].left - before[0].left, 3);
  expect(after[1].top - after[0].top).toBeCloseTo(before[1].top - before[0].top, 3);
  await expect(badges(page)).toHaveText(["×2"]);
});

test("dragging a tray coin onto the pile adds it; dropping it outside does not", async ({ page }) => {
  await openEndless(page, FAST, { difficulty: "easy" });
  const tray50 = page.getByRole("button", { name: "Add 50p", exact: true });
  await drag(page, await centre(tray50), await centre(pile(page)));

  await expect(pileCoins(page)).toHaveCount(1);
  await expect(page.locator("#play-pile-summary")).toHaveText("In the pile: 1 × 50p");
  await expect(page.locator("#play-total")).toHaveText("Your total: £0.50");
  const at = await position(pileCoins(page).first());
  expect(at.left).toBeCloseTo(50, 0);
  expect(at.top).toBeCloseTo(50, 0);
  await expect(page.locator(".tray-ghost")).toHaveCount(0);
  await expect(pile(page)).not.toHaveClass(/over-pile/);

  await drag(page, await centre(tray50), await centre(page.locator("#play-heading")));
  await expect(page.locator(".tray-ghost")).toHaveCount(0);
  await expect(tray50).not.toHaveClass(/dragging-source/);
  await expect(pileCoins(page)).toHaveCount(1);
  await expect(page.locator("#play-total")).toHaveText("Your total: £0.50");
});
