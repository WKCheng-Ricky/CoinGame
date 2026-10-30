import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./dom-helper.js";
import { MODES, mountHome } from "../src/home.js";
import { MODE_IDS, PRESETS } from "../src/options.js";

const OPTS = { showCoins: false, largeCoins: false, autoStack: true, shortPay: true, timerScore: true, timeLimit: 0 };

function withHome(fn) {
  return async () => {
    const dom = installDom(`<!doctype html><body><div id="modes"></div><div id="presets"></div><p id="preset-note"></p>
      <button id="large"></button><ul id="chips"></ul><p id="options-for"></p><div id="options"></div><button id="play"></button></body>`);
    const calls = [];
    try {
      const { document } = dom;
      const home = mountHome(
        {
          modes: document.getElementById("modes"), presets: document.getElementById("presets"), large: document.getElementById("large"),
          chips: document.getElementById("chips"), options: document.getElementById("options"),
          optionsFor: document.getElementById("options-for"), play: document.getElementById("play"),
        },
        {
          onMode: (m) => calls.push(["mode", m]),
          onPreset: (id) => calls.push(["preset", id]),
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

// --- Quick settings, chips and row icons ---
const HARD = { ...OPTS, showCoins: false, autoStack: false, shortPay: true, timerScore: true, timeLimit: 30 };
const presetRadios = (document) => [...document.querySelectorAll("#presets input[type=radio]")];
const chipTexts = (document) => [...document.querySelectorAll("#chips li")].map((li) => li.textContent.trim());

test("the Difficulty group has four presets in order, Normal checked for the defaults", withHome(({ document, home }) => {
  home.update("cashier", OPTS);
  const radios = presetRadios(document);
  assert.deepEqual(radios.map((r) => r.value), ["easy", "normal", "hard", "veryHard"]);
  assert.deepEqual(radios.map((r) => r.closest("label").textContent.trim()), PRESETS.map((p) => p.label));
  assert.deepEqual(radios.filter((r) => r.checked).map((r) => r.value), ["normal"]);
  assert.equal(document.getElementById("preset-note").textContent, "");
  assert.equal(document.getElementById("presets").getAttribute("role"), "radiogroup");
  assert.equal(document.getElementById("presets").getAttribute("aria-label"), "Difficulty");
}));

test("a matching preset is checked, and custom settings check none and say so", withHome(({ document, home }) => {
  home.update("cashier", HARD);
  assert.deepEqual(presetRadios(document).filter((r) => r.checked).map((r) => r.value), ["hard"]);
  home.update("cashier", { ...HARD, shortPay: false });
  assert.deepEqual(presetRadios(document).filter((r) => r.checked), []);
  assert.equal(document.getElementById("preset-note").textContent, "Custom settings");
}));

test("choosing a preset reports its id", withHome(({ window, document, home, calls }) => {
  home.update("cashier", OPTS);
  const hard = presetRadios(document).find((r) => r.value === "hard");
  hard.checked = true;
  hard.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.deepEqual(calls, [["preset", "hard"]]);
}));

test("the Larger coins button follows Large Coins and flips it", withHome(({ document, home, calls }) => {
  const large = document.getElementById("large");
  home.update("cashier", OPTS);
  assert.equal(large.getAttribute("aria-pressed"), "false");
  assert.match(large.textContent, /Larger coins/);
  assert.match(large.textContent, /Off/);
  large.click();
  home.update("cashier", { ...OPTS, largeCoins: true });
  assert.equal(large.getAttribute("aria-pressed"), "true");
  assert.match(large.textContent, /On/);
  large.click();
  assert.deepEqual(calls, [["option", "largeCoins", true], ["option", "largeCoins", false]]);
}));

test("the chips show the options that are on, in registry order, never Large Coins", withHome(({ document, home }) => {
  home.update("cashier", OPTS);
  assert.deepEqual(chipTexts(document), ["Auto-stack", "Timer"]);
  home.update("cashier", { ...HARD, showCoins: true, largeCoins: true });
  assert.deepEqual(chipTexts(document), ["Show Coins", "Timer", "Limit 30 s"]);
  home.update("give-change", OPTS);
  assert.deepEqual(chipTexts(document), ["Auto-stack", "Short-paying", "Timer"]);
  home.update("endless", OPTS); // Auto-stack and Short-paying are not options of Endless
  assert.deepEqual(chipTexts(document), ["Timer"]);
}));

test("with nothing on the chips say so, and the list is labelled", withHome(({ document, home }) => {
  home.update("cashier", { ...OPTS, autoStack: false, timerScore: false, shortPay: false });
  assert.deepEqual(chipTexts(document), ["No options on"]);
  const list = document.getElementById("chips");
  assert.equal(list.getAttribute("role"), "list");
  assert.equal(list.getAttribute("aria-label"), "Options on");
}));

test("chip icons are decorative and a forced timer still shows as on", withHome(({ document, home }) => {
  home.update("cashier", { ...OPTS, timerScore: false, timeLimit: 10 });
  assert.deepEqual(chipTexts(document), ["Auto-stack", "Timer", "Limit 10 s"]);
  for (const svg of document.querySelectorAll("#chips svg")) assert.equal(svg.getAttribute("aria-hidden"), "true");
}));

test("each option row has an icon and the Options-for line names the mode", withHome(({ document, home }) => {
  home.update("cashier", OPTS);
  assert.equal(document.getElementById("options-for").textContent, "Options for Cashier");
  const rows = [...document.querySelectorAll("#options label:not(.radios label), #options .opt-head")];
  assert.ok(rows.length >= 4);
  for (const row of rows) assert.ok(row.querySelector("svg.ico"), row.textContent);
  home.update("give-change", OPTS);
  assert.equal(document.getElementById("options-for").textContent, "Options for Give Change");
}));
