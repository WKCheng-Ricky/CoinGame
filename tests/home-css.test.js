import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const rule = (selector) => new RegExp(`^${selector.replace(/[.\s]/g, (c) => `\\${c}`)} \\{([^}]*)\\}`, "m").exec(css)?.[1] ?? "";

// The radios are hidden but still laid out; unanchored they stretch to the full-width global input rule
// and poke out of the scrolling home screen, which then pans sideways.
test("a mode row anchors its hidden radio so the radio cannot widen the home screen", () => {
  assert.match(rule(".mode"), /position:\s*relative/);
  assert.match(rule(".mode input"), /position:\s*absolute/);
  assert.match(rule(".mode input"), /width:\s*100%/);
  assert.match(rule(".mode input"), /inset:\s*0/);
});

test("each option badge takes its colour from a themed variable", () => {
  assert.match(rule(".badge-easier"), /var\(--good\)/);
  assert.match(rule(".badge-harder"), /var\(--bad\)/);
  assert.match(rule(".badge-neutral"), /var\(--muted\)/);
});

test("an option row keeps its badge beside the label and the Time Limit choices in four columns", () => {
  assert.match(rule(".options label"), /flex-wrap:\s*nowrap/);
  assert.match(rule(".options .opt-text"), /min-width:\s*0/);
  assert.match(rule(".options .badge"), /flex:\s*none/);
  assert.match(rule(".options .radios"), /grid-template-columns:\s*repeat\(4/);
});

// The Options page is its own screen, so its list sits on the page instead of in the home screen's narrow card.
test("the Options screen shows its list without the card around it", () => {
  const card = rule("#screen-options .choice");
  assert.match(card, /max-width:\s*none/);
  assert.match(card, /border:\s*0/);
  assert.match(card, /background:\s*none/);
  assert.match(card, /padding:\s*0/);
});

// The chip list is a direct child of the home screen's grid. A fixed min-height lets its grid row stay one chip
// tall on a short screen, so a wrapped second or third row of chips spills over the Play button.
test("the chip list has no fixed minimum height, so its row grows with the wrapped chips", () => {
  const chips = rule(".chips");
  assert.ok(chips.length > 0, "the .chips rule exists");
  assert.doesNotMatch(chips, /(^|[;\s])min-height\s*:\s*[\d.]+/);
  assert.doesNotMatch(chips, /(^|[;\s])height\s*:\s*[\d.]+/);
});
