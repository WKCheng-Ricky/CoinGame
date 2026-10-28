import { test, expect } from "./fixtures.js";

// Spec 7.4: every arc letter's real ink clears the rim line and the body edge by 0.5 units. The wording of
// each coin is rasterised by Chromium at 1000 px (10 px per unit) and every ink pixel is compared, at its
// own angle, with the real outlines (the unit test can only model glyph boxes).
const MIN_GAP = 0.5;

test("real letter ink clears the rim line and the body edge by 0.5 units on every arc coin", async ({ page }) => {
  await page.goto("/");
  const gaps = await page.evaluate(async () => {
    const { COINS } = await import("/src/coins.js");
    const { coinSvg } = await import("/src/render.js");
    const { shapeRadiusAt } = await import("/src/shapes.js");
    const PX = 10;
    const out = {};
    for (const coin of COINS.filter((c) => c.wording.flow !== "straight")) {
      const words = coinSvg(coin).match(/<text class="coin-word"[^>]*>.<\/text>/g).join("");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${100 * PX}" height="${100 * PX}">${words}</svg>`;
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 100 * PX;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let inner = Infinity, outer = Infinity, ink = 0;
      for (let py = 0; py < canvas.height; py++) {
        for (let px = 0; px < canvas.width; px++) {
          if (data[(py * canvas.width + px) * 4 + 3] < 128) continue;
          ink++;
          const dx = (px + 0.5) / PX - 50, dy = (py + 0.5) / PX - 50;
          const r = Math.hypot(dx, dy), angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
          inner = Math.min(inner, r - (shapeRadiusAt(coin.shape, 70, angle) + 0.5));
          outer = Math.min(outer, shapeRadiusAt(coin.shape, 92, angle) - 1.5 - r);
        }
      }
      out[coin.id] = { inner, outer, ink };
    }
    return out;
  });
  for (const [id, g] of Object.entries(gaps)) console.log(`${id}: rim line ${g.inner.toFixed(2)}, body edge ${g.outer.toFixed(2)}`);
  for (const [id, g] of Object.entries(gaps)) {
    expect(g.ink, `${id} has ink`).toBeGreaterThan(100);
    expect(g.inner, `${id} gap to the rim line`).toBeGreaterThanOrEqual(MIN_GAP);
    expect(g.outer, `${id} gap to the body edge`).toBeGreaterThanOrEqual(MIN_GAP);
  }
});
