import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./dom-helper.js";
import { MODES, mountHome } from "../src/home.js";
import { MODE_IDS } from "../src/options.js";

const OPTS = { showCoins: false, shortPay: true };

function withHome(fn) {
  return async () => {
    const dom = installDom('<!doctype html><body><div id="modes"></div><div id="options"></div><button id="play"></button></body>');
    const calls = [];
    try {
      const { document } = dom;
      const home = mountHome(
        { modes: document.getElementById("modes"), options: document.getElementById("options"), play: document.getElementById("play") },
        {
          onMode: (m) => calls.push(["mode", m]),
          onOption: (id, v) => calls.push(["option", id, v]),
          onPlay: (m) => calls.push(["play", m]),
        },
      );
      await fn({ ...dom, home, calls });
    } finally {
      dom.teardown();
    }
  };
}

const boxes = (document) => [...document.querySelectorAll("#options input")];

test("MODES lists the four modes in menu order with blurbs of 4 words or fewer", () => {
  assert.deepEqual(MODES.map((m) => m.id), MODE_IDS);
  for (const m of MODES) assert.ok(m.blurb.split(" ").length <= 4, m.id);
});

test("update draws four mode radios, selects the current one and links each blurb", withHome(({ document, home }) => {
  home.update("endless", OPTS);
  const radios = [...document.querySelectorAll("#modes input[type=radio]")];
  assert.deepEqual(radios.map((r) => r.value), MODE_IDS);
  assert.deepEqual(radios.filter((r) => r.checked).map((r) => r.value), ["endless"]);
  for (const r of radios) {
    const blurb = document.getElementById(r.getAttribute("aria-describedby"));
    assert.equal(blurb.textContent, MODES.find((m) => m.id === r.value).blurb);
  }
  home.update("cashier", OPTS);
  assert.deepEqual(radios.filter((r) => r.checked).map((r) => r.value), ["cashier"]);
}));

test("the options list follows the selected mode", withHome(({ document, home }) => {
  home.update("endless", OPTS);
  assert.deepEqual(boxes(document).map((b) => b.dataset.option), ["showCoins", "largeCoins"]);
  assert.equal(boxes(document)[0].checked, false);
  home.update("give-change", OPTS);
  assert.deepEqual(boxes(document).map((b) => b.dataset.option), ["showCoins", "largeCoins", "shortPay"]);
  assert.equal(boxes(document)[2].checked, true);
}));

test("option values survive switching modes", withHome(({ document, home }) => {
  home.update("endless", { showCoins: true, largeCoins: false, shortPay: false });
  assert.equal(boxes(document)[0].checked, true);
  home.update("give-change", { showCoins: true, largeCoins: false, shortPay: false });
  assert.deepEqual(boxes(document).map((b) => b.checked), [true, false, false]);
}));

test("an update in the same mode keeps the focused checkbox", withHome(({ document, home }) => {
  home.update("endless", OPTS);
  const box = boxes(document)[0];
  box.focus();
  home.update("endless", { ...OPTS, showCoins: true });
  assert.equal(boxes(document)[0], box);
  assert.equal(document.activeElement, box);
  assert.equal(box.checked, true);
}));

test("each option label carries its hint as a title and a described-by help line", withHome(({ document, home }) => {
  home.update("give-change", OPTS);
  const label = boxes(document)[2].closest("label");
  assert.equal(label.title, "Customers may not pay enough");
  assert.equal(document.getElementById(boxes(document)[2].getAttribute("aria-describedby")).textContent, label.title);
}));

test("a radio change calls onMode, a checkbox change calls onOption, Play calls onPlay with the mode", withHome(({ window, document, home, calls }) => {
  home.update("give-change", OPTS);
  const radio = document.querySelector('#modes input[value="cashier"]');
  radio.checked = true;
  radio.dispatchEvent(new window.Event("change", { bubbles: true }));
  const box = boxes(document)[0];
  box.checked = true;
  box.dispatchEvent(new window.Event("change", { bubbles: true }));
  document.getElementById("play").click();
  assert.deepEqual(calls, [["mode", "cashier"], ["option", "showCoins", true], ["play", "give-change"]]);
}));
