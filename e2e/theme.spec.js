import { test, expect } from "./fixtures.js";
import { FAST } from "./helpers.js";

async function bodyLuminance(page) {
  return page.evaluate(() => {
    const m = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g).map(Number);
    const [r, g, b] = m.slice(0, 3).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  });
}

const stored = (page) => page.evaluate(() => localStorage.getItem("coin-game-theme"));
const dataTheme = (page) => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
const metaColor = (page) => page.evaluate(() => document.querySelector('meta[name="theme-color"]').content);
const bodyBg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

const LABELS = {
  auto: "Theme: Auto. Press to switch to Light",
  light: "Theme: Light. Press to switch to Dark",
  dark: "Theme: Dark. Press to switch to Auto",
};
const toggle = (page) => page.locator("#btn-theme");
async function expectState(page, state) {
  await expect(toggle(page)).toHaveAttribute("data-state", state);
  await expect(page.getByRole("button", { name: LABELS[state], exact: true })).toBeVisible();
  await expect(toggle(page)).toHaveAttribute("title", LABELS[state]);
  const shown = await toggle(page).locator("svg").evaluateAll((els) => els.filter((e) => e.getClientRects().length > 0).length);
  expect(shown).toBe(1);
}

test("Auto follows the system colour scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/?" + FAST);
  await expectState(page, "auto");
  expect(await bodyLuminance(page)).toBeLessThan(0.2);
  await page.emulateMedia({ colorScheme: "light" });
  expect(await bodyLuminance(page)).toBeGreaterThan(0.8);
});

test("one button cycles Auto, Light, Dark and saves the choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/?" + FAST);
  await expectState(page, "auto");
  expect(await bodyLuminance(page)).toBeLessThan(0.2);

  await toggle(page).click();
  await expectState(page, "light");
  expect(await bodyLuminance(page)).toBeGreaterThan(0.8);
  expect(await dataTheme(page)).toBe("light");
  expect(await stored(page)).toBe("light");

  await page.emulateMedia({ colorScheme: "light" });
  await toggle(page).click();
  await expectState(page, "dark");
  expect(await bodyLuminance(page)).toBeLessThan(0.2);
  expect(await dataTheme(page)).toBe("dark");
  expect(await stored(page)).toBe("dark");

  await toggle(page).click();
  await expectState(page, "auto");
  expect(await stored(page)).toBeNull();
  expect(await dataTheme(page)).toBeNull();
  expect(await bodyLuminance(page)).toBeGreaterThan(0.8);
});

test("the state, icon and name survive a reload and apply before first paint", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/?" + FAST);
  await toggle(page).click();
  await toggle(page).click();
  await expectState(page, "dark");
  await page.reload({ waitUntil: "commit" });
  // the boot script is a blocking classic script, so the attribute is there as soon as the document is
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-theme"));
  await page.reload();
  await expectState(page, "dark");
  expect(await bodyLuminance(page)).toBeLessThan(0.2);
  await page.emulateMedia({ colorScheme: "dark" });
  await toggle(page).click(); // dark -> auto
  await toggle(page).click(); // auto -> light
  await expectState(page, "light");
  await page.reload();
  await expectState(page, "light");
  expect(await bodyLuminance(page)).toBeGreaterThan(0.8);
});

for (const [w, h] of [[390, 844], [1280, 720]]) {
  test(`the button sits in the top-right corner of Home at ${w}x${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto("/?" + FAST);
    const box = await toggle(page).boundingBox();
    const main = await page.locator("main").boundingBox();
    expect(main.x + main.width - (box.x + box.width)).toBeLessThan(24);
    expect(main.x + main.width - (box.x + box.width)).toBeGreaterThanOrEqual(-1);
    expect(box.y - main.y).toBeLessThan(24);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    // Home content stays centred and clear of the button
    const centre = main.x + main.width / 2;
    for (const sel of ["#screen-home h1", "#btn-endless", "#btn-custom", "#btn-cashier"]) {
      const b = await page.locator(sel).boundingBox();
      expect(Math.abs(b.x + b.width / 2 - centre), sel).toBeLessThanOrEqual(2);
    }
    const h1 = await page.locator("#screen-home h1").boundingBox();
    const overlaps = box.x < h1.x + h1.width && box.x + box.width > h1.x && box.y < h1.y + h1.height && box.y + box.height > h1.y;
    expect(overlaps).toBe(false);
  });
}

test("the button is not visible on the game screens", async ({ page }) => {
  await page.goto("/?" + FAST);
  await expect(toggle(page)).toBeVisible();
  await page.getByRole("button", { name: "Endless", exact: true }).click();
  await expect(toggle(page)).toBeHidden();
  await page.locator("#btn-back").click();
  await page.getByRole("button", { name: "Custom", exact: true }).click();
  await expect(toggle(page)).toBeHidden();
  await page.locator("#custom-back").click();
  await page.getByRole("button", { name: "Cashier", exact: true }).click();
  await expect(toggle(page)).toBeHidden();
});

test("a saved override that disagrees with the system is in place at first paint", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("coin-game-theme", "dark"));
  // record the body background as soon as styles apply, before module scripts have run
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      window.__bgAtLoad = getComputedStyle(document.body).backgroundColor;
      window.__attrAtLoad = document.documentElement.getAttribute("data-theme");
    });
  });
  await page.goto("/?" + FAST);
  expect(await page.evaluate(() => window.__attrAtLoad)).toBe("dark");
  expect(await page.evaluate(() => window.__bgAtLoad)).toBe(await bodyBg(page));
  expect(await bodyLuminance(page)).toBeLessThan(0.2);
});

test("the theme-color meta follows the shown theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/?" + FAST);
  expect(await metaColor(page)).toBe(await bodyBg(page));
  await toggle(page).click(); // light
  await toggle(page).click(); // dark
  expect(await metaColor(page)).toBe(await bodyBg(page));
  await toggle(page).click(); // auto
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => metaColor(page)).toBe(await bodyBg(page));
});

test("blocked storage falls back to Auto without errors and still themes", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e));
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    const boom = () => { throw new Error("blocked"); };
    Storage.prototype.getItem = boom;
    Storage.prototype.setItem = boom;
    Storage.prototype.removeItem = boom;
  });
  await page.goto("/?" + FAST);
  await expectState(page, "auto");
  expect(await bodyLuminance(page)).toBeGreaterThan(0.8);
  await toggle(page).click();
  await toggle(page).click();
  await expectState(page, "dark");
  expect(await bodyLuminance(page)).toBeLessThan(0.2);
  expect(errors).toEqual([]);
});
