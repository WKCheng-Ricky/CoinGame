import { test, expect } from "./fixtures.js";
import { FAST, seedRandom } from "./helpers.js";

// Runs inside the page: WCAG contrast for text, borders, focus outlines and coin edges.
const MEASURE = () => {
  const parse = (css) => {
    const nums = css.match(/-?[\d.]+(?:e-?\d+)?/g).map(Number);
    if (css.startsWith("color(")) {
      const [r, g, b, a = 1] = nums;
      return [r * 255, g * 255, b * 255, a];
    }
    const [r, g, b, a = 1] = nums;
    return [r, g, b, a];
  };
  const over = (top, bottom) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1);
  };
  const lum = ([r, g, b]) => {
    const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  // composite each ancestor's background (alpha-blended) up to the root
  const background = (el, includeSelf = true) => {
    const chain = [];
    for (let n = includeSelf ? el : el.parentElement; n; n = n.parentElement) {
      chain.push(parse(getComputedStyle(n).backgroundColor));
    }
    return chain.reduceRight((below, layer) => over(layer, below), [255, 255, 255, 1]);
  };
  const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
  const out = [];
  return {
    text(selector, label = selector) {
      for (const el of document.querySelectorAll(selector)) {
        if (!visible(el)) continue;
        if (!el.textContent.trim() && !(el.value ?? "").length && !el.placeholder) continue;
        const bg = background(el);
        const fg = over(parse(getComputedStyle(el).color), bg);
        out.push({ label, kind: "text", ratio: ratio(fg, bg) });
      }
    },
    pseudoText(selector, label) {
      const el = document.querySelector(selector);
      const bg = background(el);
      out.push({ label, kind: "text", ratio: ratio(over(parse(getComputedStyle(el, "::before").color), bg), bg) });
    },
    inputBorder(selector, label) {
      const el = document.querySelector(selector);
      if (!el || !visible(el)) return;
      const around = background(el, false);
      out.push({ label, kind: "border", ratio: ratio(over(parse(getComputedStyle(el).borderTopColor), around), around) });
    },
    icon(selector, label) {
      const el = document.querySelector(selector);
      const bg = background(el);
      out.push({ label, kind: "border", ratio: ratio(over(parse(getComputedStyle(el).color), bg), bg) });
    },
    focus(el, label) {
      const around = background(el, false);
      const cs = getComputedStyle(el);
      out.push({ label: `${label} (outline shown)`, kind: "outline", style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) });
      out.push({ label, kind: "border", ratio: ratio(over(parse(getComputedStyle(el).outlineColor), around), around) });
    },
    // min: the edge is a thin soft outline; in dark it is deliberately faint (a bright halo made the coins
    // look like stickers), and the coin is identified by its metal fill, checked at 3:1 in its own test
    coinEdge(coinId, min = 3) {
      const pile = document.querySelector("#play-pile");
      const body = pile.querySelector(`[data-coin="${coinId}"] .coin-body`);
      const bg = background(pile);
      out.push({ label: `${coinId} edge on the pile`, kind: "border", min, ratio: ratio(over(parse(getComputedStyle(body).stroke), bg), bg) });
    },
    // the resolved fill of each metal on the pile, and its contrast against the pile's own background
    metalFills() {
      const pile = document.querySelector("#play-pile");
      const bg = background(pile);
      const fills = {}, ratios = {};
      for (const metal of ["copper", "silver", "gold"]) {
        const el = pile.querySelector(`.metal-${metal}`);
        if (!el) continue;
        fills[metal] = getComputedStyle(el).fill;
        ratios[metal] = ratio(over(parse(fills[metal]), bg), bg);
      }
      return { fills, ratios };
    },
    results: () => out,
  };
};

async function measure(page, fn) {
  return page.evaluate(`(() => { const m = (${MEASURE.toString()})(); (${fn.toString()})(m); return m.results(); })()`);
}

function assertAll(results) {
  expect(results.length).toBeGreaterThan(0);
  // a focus ring must really be drawn: a visible style and at least 2px
  const hidden = results.filter((r) => r.kind === "outline" && (r.style === "none" || !(r.width >= 2)));
  expect(hidden, `focus outline not visible: ${JSON.stringify(hidden)}`).toEqual([]);
  const bad = results.filter((r) => r.kind !== "outline" && r.ratio < (r.min ?? (r.kind === "text" ? 4.5 : 3)));
  expect(bad, `low contrast: ${JSON.stringify(bad)}`).toEqual([]);
}

const TEXT_ALL = (m) => {
  for (const sel of ["h1", "p", "legend", "label", "button", "button.primary", "h2", ".scale-note", ".rounds", ".total",
    ".message", ".error", "input", ".target", ".label", ".stack-badge"]) m.text(sel);
};

for (const scheme of ["light", "dark"]) {
  test.describe(`${scheme} theme`, () => {
    test.beforeEach(async ({ page }) => { await page.emulateMedia({ colorScheme: scheme }); });

    test("Home: text, radio and button contrast", async ({ page }) => {
      await page.goto("/?" + FAST);
      assertAll(await measure(page, TEXT_ALL));
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      const focus = await page.evaluate(`(() => { const m = (${MEASURE.toString()})(); m.focus(document.activeElement, "home focus"); return m.results(); })()`);
      assertAll(focus);
    });

    test("Home: hovered, pressed and checked states keep their text readable", async ({ page }) => {
      await page.goto("/?" + FAST);
      // the checked difficulty label is bold ink on the accent tint
      assertAll(await measure(page, (m) => m.text("label:has(input:checked)", "checked difficulty label")));
      await page.locator("#diff-easy").check();
      assertAll(await measure(page, (m) => m.text("label:has(input:checked)", "checked difficulty label (Easy)")));
      for (const sel of ["#btn-endless", "#btn-custom", "#btn-cashier"]) {
        await page.locator(sel).hover();
        assertAll(await measure(page, (m) => m.text(".stack-col button", "hovered mode button")));
        const box = await page.locator(sel).boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        assertAll(await measure(page, (m) => m.text(".stack-col button", "pressed mode button")));
        await page.mouse.move(2, 2);
        await page.mouse.up();
      }
    });

    test("Home: theme button icon and focus ring", async ({ page }) => {
      await page.goto("/?" + FAST);
      assertAll(await measure(page, (m) => m.icon("#btn-theme", "theme icon")));
      await page.keyboard.press("Tab");
      await expect(page.locator("#btn-theme")).toBeFocused();
      assertAll(await page.evaluate(`(() => { const m = (${MEASURE.toString()})(); m.focus(document.activeElement, "theme button focus"); return m.results(); })()`));
    });

    test("Endless and Custom: hint, success and error colours", async ({ page }) => {
      await page.goto("/?" + FAST);
      await page.getByRole("button", { name: "Custom", exact: true }).click();
      await page.locator("#custom-form button.primary").click(); // empty submit
      await expect(page.locator("#custom-error")).not.toHaveText("");
      assertAll(await measure(page, (m) => {
        for (const sel of ["h1", "label", "button", "button.primary", ".error", "input"]) m.text(sel);
        m.inputBorder("#custom-input", "custom input border");
      }));
      await page.locator("#custom-input").fill("0.01");
      await page.locator("#custom-form button.primary").click();
      await page.locator("#btn-check").click(); // empty pile: wrong
      await expect(page.locator("#play-message.hint")).toBeVisible();
      await expect(page.locator("#play-message")).not.toHaveText("");
      assertAll(await measure(page, TEXT_ALL));
      await page.locator('#play-tray [data-coin="1p"]').click();
      await page.locator("#btn-check").click();
      await expect(page.locator("#play-message.success")).toBeVisible();
      assertAll(await measure(page, TEXT_ALL));
    });

    test("Empty pile hint, focus outlines and coin edges", async ({ page }) => {
      await page.goto("/?" + FAST);
      await page.getByRole("button", { name: "Endless", exact: true }).click();
      assertAll(await measure(page, (m) => m.pseudoText("#play-pile", "empty pile hint")));
      await page.locator("#btn-check").focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      assertAll(await page.evaluate(`(() => { const m = (${MEASURE.toString()})(); m.focus(document.activeElement, "bar button focus"); return m.results(); })()`));
      for (const id of ["1p", "5p", "20p"]) await page.locator(`#play-tray [data-coin="${id}"]`).click();
      await expect(page.locator("#play-pile .pile-coin")).toHaveCount(3);
      const min = scheme === "dark" ? 1.5 : 3;
      assertAll(await measure(page, `(m) => { for (const id of ["1p", "5p", "20p"]) m.coinEdge(id, ${min}); }`));
    });

    test("Cashier: input, label and error contrast", async ({ page }) => {
      await seedRandom(page); // seed 1 deals a counter with stacked coins, so a stack badge shows
      await page.goto("/?" + FAST);
      await page.getByRole("button", { name: "Cashier", exact: true }).click();
      await expect(page.locator("#play-pile .pile-coin").first()).toBeVisible();
      await expect(page.locator("#play-pile .stack-badge").first()).toBeVisible();
      await page.locator("#cashier-input").fill("abc");
      await page.locator("#btn-check").click();
      await expect(page.locator("#cashier-error")).not.toHaveText("");
      await page.locator("#cashier-input").focus();
      assertAll(await measure(page, (m) => {
        for (const sel of ["h1", "label", "button", "button.primary", ".error", "input", ".rounds", "h2", ".scale-note", ".stack-badge"]) m.text(sel);
        m.inputBorder("#cashier-input", "cashier input border");
        m.focus(document.activeElement, "cashier input focus");
      }));
    });
  });
}

test("each metal is at least 3:1 against the pile in dark; in light the fills are unchanged and the 3:1 edge outlines them", async ({ page }) => {
  const LIGHT = { copper: "rgb(184, 115, 51)", silver: "rgb(201, 204, 209)", gold: "rgb(212, 175, 55)" };
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/?" + FAST);
    await page.getByRole("button", { name: "Endless", exact: true }).click();
    for (const id of ["1p", "5p", "£1", "£2"]) await page.locator(`#play-tray [data-coin="${id}"]`).click();
    await expect(page.locator("#play-pile .pile-coin")).toHaveCount(4);
    const m = await page.evaluate(`(() => { const m = (${MEASURE.toString()})(); return m.metalFills(); })()`);
    for (const metal of ["copper", "silver", "gold"]) {
      expect(m.fills[metal], `${scheme} ${metal} fill`).toBeTruthy();
      // The light silver and gold are pale by design (the light fills must stay as they were: 1.5:1 and 1.9:1
      // against the cream pile), so in light the coin is identified by its 3:1 edge line (see the edge test).
      if (scheme === "dark") expect(m.ratios[metal], `dark ${metal} against the pile`).toBeGreaterThanOrEqual(3);
      else expect(m.fills[metal]).toBe(LIGHT[metal]);
    }
    // the disc and body of the two-metal coins really use the themed metals
    expect(m.fills.copper).not.toBe(m.fills.silver);
    expect(m.fills.silver).not.toBe(m.fills.gold);
  }
});
