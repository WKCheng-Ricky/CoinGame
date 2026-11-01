import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
// The declarations of every rule written at the start of a line with exactly this selector, joined, or "".
const rule = (selector) => {
  const re = new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`, "gm");
  return [...css.matchAll(re)].map((m) => m[1]).join(" ");
};

test("coins and everything inside them cannot be selected", () => {
  for (const selector of [".coin, .pile-coin", ".coin *, .pile-coin *"]) {
    assert.match(rule(selector), /-webkit-user-select:\s*none/, selector);
    assert.match(rule(selector), /(^|[;\s])user-select:\s*none/, selector);
  }
});

test("piles and the tray suppress the touch callout", () => {
  assert.match(rule(".pile, .tray"), /-webkit-touch-callout:\s*none/);
});

test("the whole play screen is unselectable but its inputs stay typeable", () => {
  assert.match(rule("#screen-play, #screen-play *"), /-webkit-user-select:\s*none/);
  assert.match(rule("#screen-play input"), /-webkit-user-select:\s*text/);
  assert.match(rule("#screen-play input"), /(^|[;\s])user-select:\s*text/);
});

test("the home and options screens are not made unselectable", () => {
  assert.doesNotMatch(rule("#screen-home"), /user-select/);
  assert.doesNotMatch(rule("#screen-options"), /user-select/);
});
