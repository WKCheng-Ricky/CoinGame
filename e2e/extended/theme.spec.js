import { test, expect } from "../fixtures.js";
import { FAST } from "../helpers.js";

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
