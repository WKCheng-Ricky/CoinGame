import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./dom-helper.js";
import { ICON_NAMES, badge, icon } from "../src/icons.js";

function withDom(fn) {
  return () => {
    const dom = installDom();
    try {
      fn(dom);
    } finally {
      dom.teardown();
    }
  };
}

test("ICON_NAMES lists the option, button and badge icons", () => {
  assert.deepEqual(ICON_NAMES, ["eye", "enlarge", "layers", "coin-down", "stopwatch", "hourglass", "gear", "easier", "harder", "neutral"]);
});

test("every icon is a decorative 24-unit svg with content", withDom(() => {
  for (const name of ICON_NAMES) {
    const svg = icon(name);
    assert.equal(svg.namespaceURI, "http://www.w3.org/2000/svg", name);
    assert.equal(svg.getAttribute("aria-hidden"), "true", name);
    assert.equal(svg.getAttribute("focusable"), "false", name);
    assert.equal(svg.getAttribute("viewBox"), "0 0 24 24", name);
    assert.ok(svg.classList.contains("ico"), name);
    assert.ok(svg.children.length > 0, name);
  }
}));

test("icon takes a size and rejects an unknown name", withDom(() => {
  assert.equal(icon("eye", 14).getAttribute("width"), "14");
  assert.equal(icon("eye").getAttribute("width"), "24");
  assert.throws(() => icon("nope"), /Unknown icon/);
}));

test("badge is the effect word with its arrow icon", withDom(() => {
  const b = badge("harder");
  assert.ok(b.classList.contains("badge") && b.classList.contains("badge-harder"));
  assert.equal(b.textContent.trim(), "Harder");
  assert.equal(b.querySelectorAll("svg[aria-hidden='true']").length, 1);
}));
