import { test, expect } from "./fixtures.js";
import { FAST } from "./helpers.js";

const MODES = ["#btn-endless", "#btn-custom", "#btn-cashier"];

async function openHome(page) {
  await page.goto("/?" + FAST);
  await expect(page.locator("#screen-home")).toBeVisible();
}

// Resolve a CSS variable to the colour the browser really paints.
const resolved = (page, variable) => page.evaluate((v) => {
  const probe = document.createElement("div");
  probe.style.cssText = `background-color: var(${v}); border: 0 solid var(${v}); position: absolute`;
  document.body.append(probe);
  const s = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return s;
}, variable);

const style = (page, sel) => page.locator(sel).evaluate((el) => {
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, border: s.borderTopColor, weight: Number(s.fontWeight), color: s.color };
});

for (const scheme of ["light", "dark"]) {
  test.describe(`${scheme} theme`, () => {
    test.beforeEach(async ({ page }) => { await page.emulateMedia({ colorScheme: scheme }); });

    test("at rest none of the three mode buttons is accent filled", async ({ page }) => {
      await openHome(page);
      const accent = await resolved(page, "--accent");
      const panel = await resolved(page, "--panel");
      for (const sel of MODES) {
        await expect(page.locator(sel)).not.toHaveClass(/primary/);
        const s = await style(page, sel);
        expect(s.bg, sel).toBe(panel);
        expect(s.bg, sel).not.toBe(accent);
      }
    });

    test("hovering a mode button gives it an accent border and a tint", async ({ page }) => {
      await openHome(page);
      expect(await page.evaluate(() => matchMedia("(hover: hover)").matches)).toBe(true);
      const accent = await resolved(page, "--accent");
      const tint = await resolved(page, "--accent-tint");
      for (const sel of MODES) {
        const before = await style(page, sel);
        await page.locator(sel).hover();
        const after = await style(page, sel);
        expect(after.border, sel).toBe(accent);
        expect(after.bg, sel).toBe(tint);
        expect(after.bg, sel).not.toBe(before.bg);
        expect(after.border, sel).not.toBe(before.border);
        await page.locator("#screen-home h1").hover();
      }
    });

    test("pressing a mode button gives it the accent fill", async ({ page }) => {
      await openHome(page);
      const accent = await resolved(page, "--accent");
      for (const sel of MODES) {
        const box = await page.locator(sel).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        expect((await style(page, sel)).bg, sel).toBe(accent);
        await page.mouse.move(2, 2); // release elsewhere: no click, no navigation
        await page.mouse.up();
        await expect(page.locator("#screen-home")).toBeVisible();
      }
    });

    test("the checked difficulty has an accent border and bold text, and switching moves it", async ({ page }) => {
      await openHome(page);
      const accent = await resolved(page, "--accent");
      const normal = "label:has(#diff-normal)";
      const easy = "label:has(#diff-easy)";
      let n = await style(page, normal), e = await style(page, easy);
      expect(n.border).toBe(accent);
      expect(n.weight).toBeGreaterThanOrEqual(600);
      expect(e.border).not.toBe(accent);
      expect(e.weight).toBeLessThan(600);
      await page.locator("#diff-easy").check();
      n = await style(page, normal); e = await style(page, easy);
      expect(e.border).toBe(accent);
      expect(e.weight).toBeGreaterThanOrEqual(600);
      expect(n.border).not.toBe(accent);
      expect(n.weight).toBeLessThan(600);
    });

    test("Check in the dock is still the green primary action", async ({ page }) => {
      await openHome(page);
      await page.locator("#btn-endless").click();
      const accent = await resolved(page, "--accent");
      expect((await style(page, "#btn-check")).bg).toBe(accent);
      await expect(page.locator("#btn-check")).toHaveClass(/primary/);
    });
  });
}
