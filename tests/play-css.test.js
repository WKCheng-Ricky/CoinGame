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

test("Back and End in the play top bar are at least 44 px square", () => {
  const decl = rule(".topbar > #btn-back, .topbar > #btn-end");
  assert.match(decl, /min-width:\s*44px/);
  assert.match(decl, /min-height:\s*44px/);
});

test("the Session over buttons are centred under the centred text", () => {
  assert.match(rule("#screen-summary .row"), /justify-content:\s*center/);
});

test("Cashier's label takes its own line and the question never wraps", () => {
  assert.match(rule("#screen-play.cashier .label"), /display:\s*block/);
  assert.match(rule("#screen-play.cashier .target #play-target"), /white-space:\s*nowrap/);
});

test("the primary action keeps one slot: Check, Next and Play again share the right-hand column", () => {
  assert.match(rule(".actions"), /display:\s*grid/);
  assert.match(rule(".actions .primary"), /grid-column:\s*2/);
  assert.match(rule("#screen-play.cashier .actions .primary"), /grid-column:\s*2/);
  assert.doesNotMatch(css, /cashier\.locked \.dock/);
});

test("the Play button on the home screen is centred", () => {
  assert.match(rule(".play"), /display:\s*block/);
});
