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

test.describe("touch device", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("hover styling is not applied to the mode buttons on touch", async ({ page }) => {
    await openHome(page);
    // proves this context exercises the no-hover branch of the media query
    expect(await page.evaluate(() => matchMedia("(hover: hover)").matches)).toBe(false);
    const panel = await resolved(page, "--panel");
    const accent = await resolved(page, "--accent");
    const tint = await resolved(page, "--accent-tint");
    for (const sel of MODES) {
      const before = await style(page, sel);
      expect(before.bg, sel).toBe(panel);
      await page.locator(sel).hover(); // moves the pointer over it: must not trigger :hover styling
      const after = await style(page, sel);
      expect(after.bg, sel).toBe(before.bg);
      expect(after.bg, sel).not.toBe(tint);
      expect(after.border, sel).toBe(before.border);
      expect(after.border, sel).not.toBe(accent);
    }
  });

  test("a passive touchstart listener covers the mode buttons so iOS Safari applies :active", async ({ page }) => {
    // iOS only applies :active when a touch listener exists on the element or an ancestor
    await page.addInitScript(() => {
      window.__touchRegs = [];
      const orig = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type, fn, opts) {
        if (type === "touchstart") window.__touchRegs.push({ target: this, passive: !!(opts && opts.passive) });
        return orig.call(this, type, fn, opts);
      };
    });
    await openHome(page);
    const covered = await page.evaluate(() => {
      const btn = document.getElementById("btn-endless");
      return window.__touchRegs.some((r) => r.passive && r.target.contains && r.target.contains(btn));
    });
    expect(covered).toBe(true);
    // the no-op listener changes nothing: a touchstart neither navigates nor cancels
    const cancelled = await page.evaluate(() => {
      const ev = new Event("touchstart", { bubbles: true, cancelable: true });
      document.getElementById("btn-endless").dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(cancelled).toBe(false);
    await expect(page.locator("#screen-home")).toBeVisible();
    // the pressed state still paints the accent fill
    const accent = await resolved(page, "--accent");
    const box = await page.locator("#btn-endless").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    expect((await style(page, "#btn-endless")).bg).toBe(accent);
    await page.mouse.move(2, 2);
    await page.mouse.up();
    await expect(page.locator("#screen-home")).toBeVisible();
  });
});
