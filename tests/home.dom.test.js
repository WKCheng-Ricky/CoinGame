import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./dom-helper.js";
import { MODES, mountHome } from "../src/home.js";
import { MODE_IDS } from "../src/options.js";

const OPTS = { showCoins: false, largeCoins: false, autoStack: true, shortPay: true, timerScore: false, timeLimit: 0 };

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

const boxes = (document) => [...document.querySelectorAll("#options input[type=checkbox]")];
const radios = (document) => [...document.querySelectorAll("#options input[type=radio]")];

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
  assert.deepEqual(boxes(document).map((b) => b.dataset.option), ["showCoins", "largeCoins", "timerScore"]);
  assert.equal(boxes(document)[0].checked, false);
  home.update("give-change", OPTS);
  assert.deepEqual(boxes(document).map((b) => b.dataset.option), ["showCoins", "largeCoins", "autoStack", "shortPay", "timerScore"]);
  assert.equal(boxes(document)[3].checked, true);
}));

test("option values survive switching modes", withHome(({ document, home }) => {
  home.update("endless", { showCoins: true, largeCoins: false, autoStack: false, shortPay: false, timerScore: false, timeLimit: 0 });
  assert.equal(boxes(document)[0].checked, true);
  home.update("give-change", { showCoins: true, largeCoins: false, autoStack: false, shortPay: false, timerScore: false, timeLimit: 0 });
  assert.deepEqual(boxes(document).map((b) => b.checked), [true, false, false, false, false]);
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

test("each option label carries its hint as a title and a described-by reason line", withHome(({ document, home }) => {
  home.update("give-change", OPTS);
  const label = boxes(document)[3].closest("label");
  assert.equal(label.title, "Customers may not pay enough");
  assert.equal(document.getElementById(boxes(document)[3].getAttribute("aria-describedby")).textContent, "Harder: customers may not pay enough");
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

test("each option shows an icon and the effect word", withHome(({ document, home }) => {
  home.update("give-change", OPTS);
  const badge = (i) => boxes(document)[i].closest("label").querySelector(".badge");
  assert.ok(badge(3).classList.contains("badge-harder"));
  assert.equal(badge(3).textContent.trim(), "Harder");
  assert.equal(badge(3).querySelectorAll('svg[aria-hidden="true"]').length, 1);
  assert.equal(badge(0).textContent.trim(), "Easier");
  assert.equal(badge(1).textContent.trim(), "Neutral");
}));

test("the why line is visible and is the described-by target", withHome(({ document, home }) => {
  home.update("give-change", OPTS);
  const why = document.getElementById(boxes(document)[3].getAttribute("aria-describedby"));
  assert.ok(why.classList.contains("why"));
  assert.ok(!why.classList.contains("sr-only"));
}));

test("a choice option is a labelled radio group with one radio per choice", withHome(({ document, home }) => {
  home.update("cashier", OPTS);
  assert.deepEqual(radios(document).map((r) => r.value), ["0", "30", "20", "10"]);
  assert.ok(radios(document).every((r) => r.name === "opt-timeLimit" && r.dataset.option === "timeLimit"));
  assert.deepEqual(radios(document).filter((r) => r.checked).map((r) => r.value), ["0"]);
  const group = document.querySelector('[role="radiogroup"][aria-labelledby]');
  assert.equal(document.getElementById(group.getAttribute("aria-labelledby")).textContent, "Time Limit");
  assert.ok(document.querySelector("#options .opt-head .badge-harder"));
  assert.equal(document.getElementById(group.getAttribute("aria-describedby")).textContent, "Harder: each question has a time limit");
}));

test("choosing a radio reports the number", withHome(({ window, document, home, calls }) => {
  home.update("cashier", OPTS);
  const twenty = radios(document).find((r) => r.value === "20");
  twenty.checked = true;
  twenty.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.deepEqual(calls, [["option", "timeLimit", 20]]);
}));

test("update checks the radio for the current limit", withHome(({ document, home }) => {
  home.update("cashier", { ...OPTS, timeLimit: 10 });
  assert.deepEqual(radios(document).filter((r) => r.checked).map((r) => r.value), ["10"]);
}));

test("a time limit checks and disables Timer and Score, and clearing it restores the stored value", withHome(({ document, home }) => {
  const timer = () => boxes(document).find((b) => b.dataset.option === "timerScore");
  home.update("cashier", { ...OPTS, timerScore: false, timeLimit: 20 });
  assert.equal(timer().checked, true);
  assert.equal(timer().disabled, true);
  home.update("cashier", { ...OPTS, timerScore: false, timeLimit: 0 });
  assert.equal(timer().checked, false);
  assert.equal(timer().disabled, false);
}));
