import { test, expect } from "./fixtures.js";
import { FAST } from "./helpers.js";

const NORMAL_HELP = "Read the coins yourself";
const EASY_HELP = "Values always shown";

async function openHome(page) {
  await page.goto("/?" + FAST);
  await expect(page.locator("#screen-home")).toBeVisible();
}

test("the Choose a game box holds exactly the three mode buttons", async ({ page }) => {
  await openHome(page);
  const box = page.locator("fieldset.choice", { has: page.locator("legend", { hasText: "Choose a game" }) });
  await expect(box).toHaveCount(1);
  await expect(box.locator("button")).toHaveText(["Endless", "Custom", "Cashier"]);
  await expect(box.locator("#btn-endless, #btn-custom, #btn-cashier")).toHaveCount(3);
});

test("each mode button still opens its mode on one click", async ({ page }) => {
  await openHome(page);
  await page.locator("#btn-endless").click();
  await expect(page.locator("#play-target")).toBeVisible();
  await page.locator("#btn-back").click();
  await page.locator("#btn-custom").click();
  await expect(page.locator("#custom-input")).toBeVisible();
  await page.locator("#custom-back").click();
  await page.locator("#btn-cashier").click();
  await expect(page.locator("#cashier-input")).toBeVisible();
});

// Number of text lines a label's text occupies, read from its rendered rectangles.
const lineCount = (label) => label.evaluate((el) => {
  // only the label's text (not its radio): one rectangle per line box it occupies
  const rects = [];
  for (const node of el.childNodes) {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    rects.push(...range.getClientRects());
  }
  const tops = new Set(rects.filter((r) => r.width > 0).map((r) => Math.round(r.top / 4)));
  return tops.size;
});
const lineHeightOf = (label) => label.evaluate((el) => {
  const s = getComputedStyle(el);
  return s.lineHeight === "normal" ? 1.2 * parseFloat(s.fontSize) : parseFloat(s.lineHeight);
});

test("the difficulty labels read Normal and Easy and each is one line high at 320x640", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openHome(page);
  const labels = page.locator("fieldset.difficulty label");
  await expect(labels).toHaveText(["Normal", "Easy"]);
  for (const label of await labels.all()) {
    expect(await lineCount(label)).toBe(1);
    // the label (text plus its radio) is no taller than the 44px tap target allows for one line
    const lineHeight = await lineHeightOf(label);
    const height = await label.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeLessThan(2 * lineHeight);
  }
  // control: the same check does fail for text that wraps
  const wrapped = await labels.first().evaluate((el) => {
    el.lastChild.textContent = " Normal and a good many more words besides"; // too long for one line
    return el.getBoundingClientRect().height;
  });
  expect(await lineCount(labels.first())).toBeGreaterThan(1);
  expect(wrapped).toBeGreaterThanOrEqual(2 * (await lineHeightOf(labels.first())));
});

test("each difficulty label has a title and a described-by text", async ({ page }) => {
  await openHome(page);
  for (const [id, help] of [["normal", NORMAL_HELP], ["easy", EASY_HELP]]) {
    const label = page.locator(`label:has(#diff-${id})`);
    await expect(label).toHaveAttribute("title", help);
    const describedBy = await label.getAttribute("aria-describedby");
    expect(describedBy).toBe(`diff-${id}-help`);
    await expect(page.locator(`#${describedBy}`)).toHaveText(help);
    await expect(page.locator(`#${describedBy}`)).toHaveClass(/sr-only/);
  }
  await expect(page.locator("#difficulty-note")).toHaveAttribute("aria-live", "polite");
});

test("hovering a label for the dwell time shows its note and leaving clears it", async ({ page }) => {
  await openHome(page);
  const note = page.locator("#difficulty-note");
  await expect(note).toHaveText("");
  await page.locator("label:has(#diff-easy)").hover();
  await expect(note).toHaveText(EASY_HELP);
  await page.locator("#screen-home h1").hover();
  await expect(note).toHaveText("");
});

test("focusing a radio by keyboard shows its note and blurring clears it", async ({ page }) => {
  await openHome(page);
  const note = page.locator("#difficulty-note");
  await page.locator("#btn-theme").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#diff-normal")).toBeFocused();
  await expect(note).toHaveText(NORMAL_HELP);
  await page.keyboard.press("Tab"); // Normal and Easy share one tab stop, so this leaves the group
  await expect(note).toHaveText("");
});

test.describe("touch", () => {
  test.use({ hasTouch: true });

  async function press(page, locator, holdMs) {
    const b = await locator.boundingBox();
    const point = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await page.waitForTimeout(holdMs);
    return async () => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
    };
  }

  test("press and hold shows the note without selecting; a quick tap still selects", async ({ page }) => {
    await openHome(page);
    const easy = page.locator("label:has(#diff-easy)");
    await expect(page.locator("#diff-normal")).toBeChecked();
    const release = await press(page, easy, 300);
    await expect(page.locator("#difficulty-note")).toHaveText(EASY_HELP);
    await release();
    await expect(page.locator("#difficulty-note")).toHaveText("");
    await page.waitForTimeout(100);
    await expect(page.locator("#diff-normal")).toBeChecked();
    await expect(page.locator("#diff-easy")).not.toBeChecked();

    await easy.tap();
    await expect(page.locator("#diff-easy")).toBeChecked();
  });
});
