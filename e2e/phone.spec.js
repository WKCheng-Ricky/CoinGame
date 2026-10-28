import { test, expect } from "./fixtures.js";
import { FAST } from "./helpers.js";

const PHONES = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "Galaxy A55", width: 360, height: 800 },
  { name: "iPhone 16", width: 393, height: 852 },
];

async function openMode(page, mode) {
  await page.goto("/?" + FAST);
  if (mode === "endless") await page.getByRole("button", { name: "Endless", exact: true }).click();
  else if (mode === "cashier") await page.getByRole("button", { name: "Cashier", exact: true }).click();
  else {
    await page.getByRole("button", { name: "Custom", exact: true }).click();
    await page.locator("#custom-input").fill(mode === "custom-solved" ? "0.01" : "3.95");
    await page.getByRole("button", { name: "Start", exact: true }).click();
    if (mode === "custom-solved") {
      await page.locator('#play-tray [data-coin="1p"]').click();
      await page.locator("#btn-check").click();
      await expect(page.locator("#btn-again")).toBeVisible();
    }
  }
  await expect(page.locator("#screen-play")).toBeVisible();
}

async function noHorizontalOverflow(page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
}

for (const phone of PHONES) {
  for (const mode of ["endless", "custom", "custom-solved", "cashier"]) {
    test(`${phone.name} ${phone.width}x${phone.height}: ${mode} keeps bars on screen`, async ({ page }) => {
      await page.setViewportSize({ width: phone.width, height: phone.height });
      await openMode(page, mode);
      await expect(page.locator(".topbar")).toBeInViewport({ ratio: 1 });
      await expect(page.locator("#btn-back")).toBeInViewport({ ratio: 1 });
      for (const btn of await page.locator(".dock button:visible").all()) {
        await expect(btn).toBeInViewport({ ratio: 1 });
      }
      const scrollable = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      // where the page is taller than the screen it must really have scrolled, or this check proves nothing
      if (scrollable) expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await expect(page.locator("#play-heading")).toBeInViewport();
      await noHorizontalOverflow(page);
    });
  }
}

test("320x640: no horizontal overflow in any mode", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const mode of ["endless", "custom", "cashier"]) {
    await openMode(page, mode);
    await noHorizontalOverflow(page);
  }
});

test("Cashier: the focused input is not hidden behind a sticky bar", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openMode(page, "cashier");
  await page.locator("#cashier-input").focus();
  const r = await page.evaluate(() => {
    const box = (sel) => document.querySelector(sel).getBoundingClientRect();
    return { input: box("#cashier-input"), top: box(".topbar"), actions: box(".dock") };
  });
  const overlaps = (a, b) => a.top < b.bottom && b.top < a.bottom && a.left < b.right && b.left < a.right;
  expect(overlaps(r.input, r.top)).toBe(false);
  expect(overlaps(r.input, r.actions)).toBe(false);
});

for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 720 }]) {
  test(`Home is centred at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto("/?" + FAST);
    const m = await page.evaluate(() => {
      const cx = (el) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };
      const home = document.querySelector("#screen-home");
      const kids = [...home.children].filter((el) => !el.classList.contains("theme-toggle")).map((el) => el.getBoundingClientRect());
      const screen = home.getBoundingClientRect();
      return {
        view: document.documentElement.clientWidth / 2,
        stack: cx(home.querySelector(".stack-col")),
        difficulty: cx(home.querySelector(".difficulty")),
        modes: cx(home.querySelector("fieldset.choice:not(.difficulty)")),
        h1: cx(home.querySelector("h1")),
        gapTop: Math.min(...kids.map((r) => r.top)) - screen.top,
        gapBottom: screen.bottom - Math.max(...kids.map((r) => r.bottom)),
      };
    });
    for (const key of ["stack", "difficulty", "modes", "h1"]) expect(Math.abs(m[key] - m.view)).toBeLessThan(1);
    if (vp.width === 1280) expect(Math.abs(m.gapTop - m.gapBottom)).toBeLessThan(40);
  });
}
