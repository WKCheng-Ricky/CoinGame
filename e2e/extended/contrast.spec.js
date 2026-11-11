import { test, expect } from "../fixtures.js";
import { FAST, seedRandom } from "../helpers.js";

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
  });
}
