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
    // layers: the two major (5 cm) ones first, then the minor (1 cm) ones
    const cell = await page.locator("#play-tray").evaluate((el) => parseFloat(getComputedStyle(el, "::before").backgroundSize.split(",")[2].trim().split(" ")[0]));
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
      const first = getComputedStyle(el).backgroundSize.split(",")[2].trim().split(" ")[0]; // the minor (1 cm) layer
      // a percentage of the padding box when the browser keeps it unresolved
      return first.endsWith("%") ? (parseFloat(first) / 100) * el.clientWidth : parseFloat(first);
    });
    near(cell, ((await w("1p")) * 10) / 20.3, 0.02);
  });
}

test("one hint note shows under the pile heading in Endless and in Cashier", async ({ page }) => {
  await startMode(page, "Endless");
  const notes = page.locator(".scale-note");
  await expect(notes).toHaveCount(1);
  await expect(notes).toBeVisible();
  await expect(notes).toHaveText("you can drag the coin around and stack them");
  await page.locator("#btn-back").click();
  await page.getByRole("button", { name: "Cashier", exact: true }).click();
  await expect(page.locator(".pile-area .scale-note")).toBeVisible();
  await expect(page.locator("#play-tray")).toBeHidden();
});

// The computed gradient layers of an element, e.g. ["linear-gradient(to right, rgb(...) 1px, transparent 1px)", ...].
const layers = (image) => image.split(/\),\s*(?=linear-gradient)/).map((l, i, all) => (i < all.length - 1 ? l + ")" : l));
const resolved = (page, variable) => page.evaluate((v) => {
  const probe = document.createElement("div");
  probe.style.cssText = `background-color: var(${v}); position: absolute`;
  document.body.append(probe);
  const c = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return c;
}, variable);

test("light theme: the --grid-major layers are listed first (painted on top) at five times the cell size", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await startMode(page, "Endless");
  const major = await resolved(page, "--grid-major");
  const minor = await resolved(page, "--grid");
  expect(major).not.toBe(minor);
  for (const where of ["pile", "tray"]) {
    const m = await page.locator(where === "pile" ? "#play-pile" : "#play-tray").evaluate((el, pseudo) => {
      const s = getComputedStyle(el, pseudo);
      return { image: s.backgroundImage, size: s.backgroundSize, width: el.clientWidth, height: el.clientHeight };
    }, where === "tray" ? "::before" : null);
    const l = layers(m.image);
    expect(l, where).toHaveLength(4);
    // first two: major colour; last two: minor colour
    expect(l[0], `${where} layer 0`).toContain(major);
    expect(l[1], `${where} layer 1`).toContain(major);
    expect(l[2], `${where} layer 2`).toContain(minor);
    expect(l[3], `${where} layer 3`).toContain(minor);
    expect(l[0]).toContain("to right");
    expect(l[1]).not.toContain("to right"); // the default direction, top to bottom, is left out of the computed value
    const px = (v) => (v.endsWith("%") ? (parseFloat(v) / 100) * (m.width) : parseFloat(v));
    const sizes = m.size.split(",").map((t) => t.trim().split(/\s+/));
    expect(sizes).toHaveLength(4);
    near(px(sizes[0][0]), 5 * px(sizes[2][0]), 0.01); // major columns: five cells wide
    const py = (v) => (v.endsWith("%") ? (parseFloat(v) / 100) * m.height : parseFloat(v));
    near(py(sizes[1][1]), 5 * py(sizes[3][1]), 0.01); // major rows: five cells tall
  }
});
