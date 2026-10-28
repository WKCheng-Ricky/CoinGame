// Runs in WebKit only (the "webkit" project in playwright.config.js). Plain @playwright/test, not ./fixtures.js,
// because the coverage fixture needs Chromium's JS coverage API.
import { test, expect } from "@playwright/test";
import { seedRandom, startMode } from "./helpers.js";

// iOS Safari (WebKit) mishandled `transform-box: fill-box` on SVG <text>, so the pile's counter-rotated
// numerals swung off their coins. Each numeral must sit where it does on an unrotated coin: on the coin's
// centre (or, for the 5p, on the vertical offset the coin gives it), turned with the coin.
test("pile coin numerals stay on their coins at every rotation", async ({ page }) => {
  await seedRandom(page);
  await startMode(page, "Cashier", { difficulty: "easy" });
  await expect(page.locator("#play-pile .pile-coin").first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  const offsets = await page.evaluate(async () => {
    const { COINS } = await import("/src/coins.js");
    return [...document.querySelectorAll("#play-pile .pile-coin")].map((btn) => {
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
  });

  expect(offsets.length).toBeGreaterThan(0);
  for (const o of offsets) expect(o.dist, `${o.id} at ${o.rot}`).toBeLessThan(o.tolerance);
});
