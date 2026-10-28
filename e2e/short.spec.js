import { test, expect } from "./fixtures.js";
import { startMode } from "./helpers.js";

// Landscape phone: a short window must keep Endless and Custom usable (spec 7.1).
const SHORT = { width: 852, height: 393 };

async function openMode(page, mode) {
  await page.setViewportSize(SHORT);
  await startMode(page, mode);
  if (mode === "Custom") {
    await page.locator("#custom-input").fill("1.50");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.locator("#play-target")).toBeVisible();
  }
}

const inside = (b, vp) => b.x >= 0 && b.y >= 0 && b.x + b.width <= vp.width && b.y + b.height <= vp.height;

for (const mode of ["Endless", "Custom"]) {
  test.describe(`${mode} at 852x393`, () => {
    test("content and dock share the height sensibly", async ({ page }) => {
      await openMode(page, mode);
      const content = await page.locator(".content").boundingBox();
      const dock = await page.locator(".dock").boundingBox();
      expect(content.height).toBeGreaterThanOrEqual(150);
      expect(dock.height).toBeLessThanOrEqual(SHORT.height * 0.45);
    });

    test("tray is one row of eight, Check and Clear are in view", async ({ page }) => {
      await openMode(page, mode);
      const coins = page.locator("#play-tray .coin");
      await expect(coins).toHaveCount(8);
      const ys = [];
      for (let i = 0; i < 8; i++) {
        const b = await coins.nth(i).boundingBox();
        expect(inside(b, SHORT)).toBe(true);
        expect(b.width).toBeGreaterThanOrEqual(43.5);
        ys.push(b.y + b.height / 2);
      }
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(4);
      for (const name of ["Check", "Clear"]) {
        const b = await page.getByRole("button", { name, exact: true }).boundingBox();
        expect(inside(b, SHORT)).toBe(true);
      }
    });

    test("the pile card can be scrolled fully into view", async ({ page }) => {
      await openMode(page, mode);
      const r = await page.locator(".content").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
        const c = el.getBoundingClientRect();
        const card = el.querySelector(".pile-area").getBoundingClientRect();
        return { cardBottom: card.bottom, contentBottom: c.bottom, cardTop: card.top, contentTop: c.top };
      });
      expect(r.cardBottom).toBeLessThanOrEqual(r.contentBottom + 1);
      // and the top is reachable too
      const top = await page.locator(".content").evaluate((el) => {
        el.scrollTop = 0;
        return el.querySelector(".pile-area").getBoundingClientRect().top - el.getBoundingClientRect().top;
      });
      expect(top).toBeGreaterThanOrEqual(-1);
    });

    test("a tray-to-pile drag lands the coin near the release point", async ({ page }) => {
      await openMode(page, mode);
      const pile = page.locator("#play-pile");
      await pile.scrollIntoViewIfNeeded();
      const pb = await pile.boundingBox();
      const content = await page.locator(".content").boundingBox();
      const to = {
        x: pb.x + pb.width / 2,
        y: Math.min(pb.y + pb.height / 2, content.y + content.height - 20),
      };
      const from = await page.getByRole("button", { name: "Add 50p", exact: true }).boundingBox();
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 6 });
      await page.mouse.up();
      const coin = page.locator("#play-pile .pile-coin");
      await expect(coin).toHaveCount(1);
      const cb = await coin.boundingBox();
      expect(Math.abs(cb.x + cb.width / 2 - to.x)).toBeLessThanOrEqual(12);
      expect(Math.abs(cb.y + cb.height / 2 - to.y)).toBeLessThanOrEqual(12);
      expect(cb.y + cb.height / 2).toBeGreaterThan(pb.y);
      expect(cb.y + cb.height / 2).toBeLessThan(pb.y + pb.height);
    });
  });
}

test("Cashier at 852x393 still fits its dock", async ({ page }) => {
  await openMode(page, "Cashier");
  const content = await page.locator(".content").boundingBox();
  expect(content.height).toBeGreaterThanOrEqual(150);
});

test("portrait SE dock is unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startMode(page, "Endless");
  const dock = await page.locator(".dock").boundingBox();
  expect(Math.abs(dock.height - 247.75)).toBeLessThanOrEqual(2);
  const rows = await page.locator("#play-tray").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  expect(rows).toBe(4);
});
