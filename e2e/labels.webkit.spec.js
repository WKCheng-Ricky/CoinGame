// Runs in WebKit only (the "webkit" project in playwright.config.js). Plain @playwright/test, not ./fixtures.js,
// because the coverage fixture needs Chromium's JS coverage API.
import { test, expect } from "@playwright/test";
import { seedRandom, startMode } from "./helpers.js";

// iOS Safari (WebKit) mishandled `transform-box: fill-box` on SVG <text>, so the pile's counter-rotated
// numerals swung off their coins. Each numeral must sit where it does on an unrotated coin: on the coin's
// centre (or, for the 5p, on the vertical offset the coin gives it), turned with the coin.
// Where each numeral in `pile` sits from where it should be on its (rotated) coin, with a tolerance.
const numeralOffsets = (page, pile) => page.evaluate(async (sel) => {
  const { COINS } = await import("/src/coins.js");
  return [...document.querySelectorAll(`${sel} .pile-coin`)].map((btn) => {
    const coin = COINS.find((c) => c.id === btn.dataset.coin);
    const svg = btn.querySelector("svg");
    const s = svg.getBoundingClientRect();
    const r = btn.querySelector(".coin-label").getBoundingClientRect();
    const rot = (parseFloat(btn.style.getPropertyValue("--rot")) * Math.PI) / 180;
    // where the numeral's centre goes when its offset down the unrotated coin is turned with the coin
    const down = ((coin.numeralY ?? 50) - 50) / 100 * (svg.clientWidth);
    const ex = s.left + s.width / 2 - down * Math.sin(rot);
    const ey = s.top + s.height / 2 + down * Math.cos(rot);
    return { id: coin.id, rot: btn.style.getPropertyValue("--rot"), tolerance: svg.clientWidth * 0.08,
      dist: Math.hypot(r.left + r.width / 2 - ex, r.top + r.height / 2 - ey) };
  });
}, pile);

test("pile coin numerals stay on their coins at every rotation", async ({ page }) => {
  await seedRandom(page);
  await startMode(page, "Cashier", { difficulty: "easy" });
  await expect(page.locator("#play-pile .pile-coin").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  const offsets = await numeralOffsets(page, "#play-pile");
  expect(offsets.length).toBeGreaterThan(0);
  for (const o of offsets) expect(o.dist, `${o.id} at ${o.rot}`).toBeLessThan(o.tolerance);
});

// Give Change mode's customer pile sits in the top bar in a short (4 cm) box; its numerals must stay on their coins too.
test("customer pile coin numerals in Give Change stay on their coins at every rotation", async ({ page }) => {
  await seedRandom(page);
  await startMode(page, "Give Change", { difficulty: "easy" });
  await expect(page.locator("#topbar-customer #play-pile .pile-coin").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  const offsets = await numeralOffsets(page, "#topbar-customer #play-pile");
  expect(offsets.length).toBeGreaterThan(0);
  for (const o of offsets) expect(o.dist, `${o.id} at ${o.rot}`).toBeLessThan(o.tolerance);
});

// Give Change mode's player pile (a short 6 cm box in the Your change card); its numerals must stay on their coins too.
test("change area coin numerals stay on their coins at every rotation", async ({ page }) => {
  await seedRandom(page);
  await startMode(page, "Give Change", { difficulty: "easy" });
  for (const id of ["1p", "2p", "5p", "10p", "20p", "50p", "£1", "£2"]) {
    await page.getByRole("button", { name: `Add ${id}`, exact: true }).click();
  }
  await expect(page.locator("#change-pile .pile-coin")).toHaveCount(8);
  await page.evaluate(() => document.fonts.ready);

  const offsets = await numeralOffsets(page, "#change-pile");
  expect(offsets).toHaveLength(8);
  for (const o of offsets) expect(o.dist, `${o.id} at ${o.rot}`).toBeLessThan(o.tolerance);
});
