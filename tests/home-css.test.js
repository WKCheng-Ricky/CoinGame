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
