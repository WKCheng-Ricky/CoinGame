import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./dom-helper.js";
import { COINS } from "../src/coins.js";
import { renderPile, renderTray, showStackBadges, setText, announce } from "../src/render.js";

const entry = (uid, coinId, x = 10, y = 10, rot = 0) => ({ uid, coinId, x, y, rot });

function withDom(fn) {
  return async (t) => {
    const dom = installDom();
    try {
      await fn(t, dom);
    } finally {
      dom.teardown();
    }
  };
}

test("renderPile builds one button per entry labelled \"20p coin\" when not removable", withDom((t, { document }) => {
  const c = document.createElement("div");
  renderPile(c, [entry(1, "20p"), entry(2, "20p", 80, 80)], null, false);
  assert.equal(c.children.length, 2);
  for (const b of c.children) assert.equal(b.getAttribute("aria-label"), "20p coin");
}));

test("renderPile labels buttons \"Remove 20p\" when removable", withDom((t, { document }) => {
  const c = document.createElement("div");
  renderPile(c, [entry(1, "20p")], null, true);
  assert.equal(c.children[0].getAttribute("aria-label"), "Remove 20p");
}));

test("renderPile keeps the same button for an unchanged uid and coin", withDom((t, { document }) => {
  const c = document.createElement("div");
  renderPile(c, [entry(1, "20p")]);
  const first = c.children[0];
  renderPile(c, [entry(1, "20p", 50, 50)]);
  assert.equal(c.children.length, 1);
  assert.equal(c.children[0], first);
}));

test("renderPile rebuilds a button whose coin changed under the same uid", withDom((t, { document }) => {
  const c = document.createElement("div");
  renderPile(c, [entry(1, "20p")]);
  const first = c.children[0];
  renderPile(c, [entry(1, "£1")]);
  assert.equal(c.children.length, 1);
  assert.notEqual(c.children[0], first);
  assert.equal(c.children[0].dataset.coin, "£1");
  assert.equal(c.children[0].getAttribute("aria-label"), "Remove £1");
}));

test("renderPile re-labels a reused button when removable flips", withDom((t, { document }) => {
  const c = document.createElement("div");
  renderPile(c, [entry(1, "20p")], null, true);
  const btn = c.children[0];
  renderPile(c, [entry(1, "20p")], null, false);
  assert.equal(c.children[0], btn);
  assert.equal(btn.getAttribute("aria-label"), "20p coin");
}));

test("renderPile removes buttons whose uid left the pile", withDom((t, { document }) => {
  const c = document.createElement("div");
  renderPile(c, [entry(1, "20p"), entry(2, "50p", 80, 80)]);
  renderPile(c, [entry(2, "50p", 80, 80)]);
  assert.equal(c.children.length, 1);
  assert.equal(c.children[0].dataset.uid, "2");
}));

test("renderPile shows a ×2 badge on stacked same-coin entries and none on a lone coin", withDom((t, { document }) => {
  const c = document.createElement("div");
  renderPile(c, [entry(1, "20p"), entry(2, "20p"), entry(3, "50p", 90, 90)]);
  const badges = c.querySelectorAll(".stack-badge");
  assert.equal(badges.length, 1);
  assert.equal(badges[0].textContent, "×2");
  assert.equal(c.children[2].querySelector(".stack-badge"), null);
}));

test("excludeUid removes the badge from a detached coin and reduces its stack's count", withDom((t, { document }) => {
  const c = document.createElement("div");
  const pile = [entry(1, "20p"), entry(2, "20p"), entry(3, "20p")];
  renderPile(c, pile);
  assert.equal(c.querySelector(".stack-badge").textContent, "×3");
  renderPile(c, pile, 3);
  assert.equal(c.children[2].querySelector(".stack-badge"), null);
  const badges = c.querySelectorAll(".stack-badge");
  assert.equal(badges.length, 1);
  assert.equal(badges[0].textContent, "×2");
  // showStackBadges alone gives the same result
  showStackBadges(c, pile, 3);
  assert.equal(c.querySelectorAll(".stack-badge").length, 1);
}));

test("renderTray builds one \"Add <label>\" button per coin in COINS", withDom((t, { document }) => {
  const c = document.createElement("div");
  renderTray(c);
  assert.equal(c.children.length, COINS.length);
  COINS.forEach((coin, i) => {
    assert.equal(c.children[i].getAttribute("aria-label"), `Add ${coin.label}`);
    assert.equal(c.children[i].dataset.coin, coin.id);
  });
}));

test("setText skips identical text", withDom((t, { document }) => {
  const el = document.createElement("p");
  setText(el, "hello");
  const node = el.firstChild;
  setText(el, "hello");
  assert.equal(el.firstChild, node);
  setText(el, "bye");
  assert.equal(el.textContent, "bye");
}));

test("announce clears then re-sets text after a delay", withDom((t, { document }) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const el = document.createElement("p");
  el.textContent = "old";
  announce(el, "new");
  assert.equal(el.textContent, "");
  t.mock.timers.tick(49);
  assert.equal(el.textContent, "");
  t.mock.timers.tick(1);
  assert.equal(el.textContent, "new");
}));
