import { test, expect } from "./fixtures.js";
import { startMode } from "./helpers.js";

async function addCoins(page, ids) {
  for (const id of ids) await page.locator(`#play-tray [data-coin="${id}"]`).click();
  await expect(page.locator("#play-pile .pile-coin")).toHaveCount(ids.length);
}

test("Normal difficulty hides the numeral but keeps the wording visible", async ({ page }) => {
  await startMode(page, "Endless");
  await addCoins(page, ["20p"]);
  await expect(page.locator("#screen-play")).toHaveAttribute("data-difficulty", "normal");
  const coin = page.locator("#play-pile .pile-coin").first();
  await expect(coin.locator(".coin-label")).toHaveCSS("opacity", "0");
  const words = coin.locator(".coin-word");
  expect(await words.count()).toBe("TWENTYPENCE".length);
  for (const word of await words.all()) await expect(word).toHaveCSS("opacity", "1");
});

test("a pile coin turns with its --rot while its numeral stays upright; tray coins do not turn", async ({ page }) => {
  await startMode(page, "Endless");
  await addCoins(page, ["1p", "2p", "5p", "10p"]);
  const angles = await page.evaluate(() => {
    const angle = (el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return (Math.atan2(m.b, m.a) * 180) / Math.PI;
    };
    return [...document.querySelectorAll("#play-pile .pile-coin")].map((btn) => ({
      rot: parseFloat(btn.style.getPropertyValue("--rot")),
      svg: angle(btn.querySelector("svg")),
      label: angle(btn.querySelector(".coin-label")),
    }));
  });
  const norm = (a) => ((a % 360) + 360) % 360;
  for (const a of angles) {
    const sum = norm(a.svg + a.label);
    expect(Math.min(sum, 360 - sum)).toBeLessThan(0.01);
    if (a.rot % 360 !== 0) expect(norm(a.svg)).not.toBeCloseTo(0, 1);
  }
  expect(angles.some((a) => a.rot % 360 !== 0)).toBe(true);

  for (const svg of await page.locator("#play-tray .coin svg").all()) {
    await expect(svg).toHaveCSS("transform", "none");
  }
});

test("coin bodies take their metal from the theme variables, not from the markup", async ({ page }) => {
  await startMode(page, "Endless");
  await addCoins(page, ["1p", "£1"]);
  const fills = await page.evaluate(() => Object.fromEntries(["copper", "silver", "gold"].map((m) => {
    const el = document.querySelector(`#play-pile .metal-${m}`);
    return [m, el ? getComputedStyle(el).fill : null];
  })));
  expect(fills.copper).toBe("rgb(184, 115, 51)");
  expect(fills.gold).toBe("rgb(212, 175, 55)");
  expect(fills.silver).toBe("rgb(201, 204, 209)"); // the £1's inner disc
  expect(await page.locator("#play-pile .coin-body").first().getAttribute("fill")).toBeNull();
});

test("the £1 and £2 both have a gold body around a silver disc, in light and dark", async ({ page }) => {
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: scheme });
    await startMode(page, "Endless");
    await addCoins(page, ["£1", "£2"]);
    for (const id of ["£1", "£2"]) {
      const coin = page.locator(`#play-pile [data-coin="${id}"]`);
      await expect(coin.locator(".coin-body")).toHaveClass(/metal-gold/);
      await expect(coin.locator(".coin-disc")).toHaveClass(/metal-silver/);
    }
  }
});
