import { test } from "node:test";
import assert from "node:assert/strict";
import { ICON_NAMES } from "../src/icons.js";
import { PRESETS, presetOf, EFFECTS, MODE_IDS, OPTIONS, defaultOptions, isForcedOn, isOptionId, isValidValue, optionsFor, timerOn } from "../src/options.js";

test("defaultOptions gives Show Coins and Large Coins off and Short-paying customers on", () => {
  assert.deepEqual(defaultOptions(), { showCoins: false, largeCoins: false, autoStack: true, shortPay: true, timerScore: true, timeLimit: 0 });
});

test("optionsFor lists the global options, then the ones scoped to the mode", () => {
  assert.deepEqual(optionsFor("endless").map((o) => o.id), ["showCoins", "largeCoins", "timerScore", "timeLimit"]);
  assert.deepEqual(optionsFor("cashier").map((o) => o.id), ["showCoins", "largeCoins", "autoStack", "timerScore", "timeLimit"]);
  assert.deepEqual(optionsFor("give-change").map((o) => o.id), ["showCoins", "largeCoins", "autoStack", "shortPay", "timerScore", "timeLimit"]);
});

test("optionsFor an unknown mode gives the global options only", () => {
  assert.deepEqual(optionsFor("nope").map((o) => o.id), ["showCoins", "largeCoins"]);
});

test("MODE_IDS lists the four modes in menu order", () => {
  assert.deepEqual(MODE_IDS, ["endless", "custom", "cashier", "give-change"]);
});

test("every option has a label, a hint and a scope of \"all\" or known modes", () => {
  for (const o of OPTIONS) {
    assert.ok(o.label.length > 0 && o.hint.length > 0, o.id);
    if (o.scope !== "all") {
      assert.ok(o.scope.length > 0 && o.scope.every((m) => MODE_IDS.includes(m)), o.id);
    }
  }
});

test("option ids are unique", () => {
  const ids = OPTIONS.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("isOptionId accepts registered ids only", () => {
  assert.equal(isOptionId("shortPay"), true);
  assert.equal(isOptionId("timer"), false);
  assert.equal(isOptionId(undefined), false);
});

test("every option has a known effect and a why that starts with that effect", () => {
  for (const o of OPTIONS) {
    assert.ok(EFFECTS.includes(o.effect), o.id);
    assert.ok(o.why.startsWith(`${o.effect[0].toUpperCase()}${o.effect.slice(1)}:`), o.id);
  }
});

test("the current options are classified as the spec says", () => {
  assert.deepEqual(Object.fromEntries(OPTIONS.map((o) => [o.id, o.effect])), {
    showCoins: "easier", largeCoins: "neutral", autoStack: "easier", shortPay: "harder", timerScore: "neutral", timeLimit: "harder",
  });
});

test("Timer and Score is not offered in Custom, and timerOn reads it", () => {
  assert.deepEqual(optionsFor("custom").map((o) => o.id), ["showCoins", "largeCoins"]);
  assert.equal(timerOn({ timerScore: true }), true);
  assert.equal(timerOn({}), false);
});

test("isValidValue takes a boolean for a checkbox option and a listed value for a choice option", () => {
  assert.equal(isValidValue("showCoins", true), true);
  assert.equal(isValidValue("showCoins", 1), false);
  for (const ok of [0, 30, 20, 10]) assert.equal(isValidValue("timeLimit", ok), true, String(ok));
  for (const bad of [15, "30", NaN, true, undefined]) assert.equal(isValidValue("timeLimit", bad), false, String(bad));
  assert.equal(isValidValue("nope", true), false);
});

test("a time limit forces Timer and Score on and turns the timer on", () => {
  assert.equal(isForcedOn("timerScore", { timeLimit: 20 }), true);
  assert.equal(isForcedOn("timerScore", { timeLimit: 0 }), false);
  assert.equal(isForcedOn("showCoins", { timeLimit: 20 }), false);
  assert.equal(timerOn({ timeLimit: 10 }), true);
  assert.equal(timerOn({ timerScore: false, timeLimit: 0 }), false);
});

test("Time Limit is not offered in Custom", () => {
  assert.equal(optionsFor("custom").some((o) => o.id === "timeLimit"), false);
});

const VALUES = {
  easy: { showCoins: true, autoStack: true, shortPay: false, timerScore: false, timeLimit: 0 },
  normal: { showCoins: false, autoStack: true, shortPay: true, timerScore: true, timeLimit: 0 },
  hard: { showCoins: false, autoStack: false, shortPay: true, timerScore: true, timeLimit: 30 },
  veryHard: { showCoins: false, autoStack: false, shortPay: true, timerScore: true, timeLimit: 10 },
};

test("PRESETS lists Easy, Normal, Hard and Very hard with the spec's values", () => {
  assert.deepEqual(PRESETS.map((p) => [p.id, p.label]), [["easy", "Easy"], ["normal", "Normal"], ["hard", "Hard"], ["veryHard", "Very hard"]]);
  for (const p of PRESETS) assert.deepEqual(p.values, VALUES[p.id], p.id);
});

test("the defaults are Normal with Large Coins off", () => {
  assert.equal(presetOf(defaultOptions()), "normal");
  assert.equal(defaultOptions().largeCoins, false);
});

test("presetOf names each preset and gives null when any one of its five values differs", () => {
  for (const p of PRESETS) {
    assert.equal(presetOf({ ...p.values, largeCoins: false }), p.id);
    for (const key of Object.keys(p.values)) {
      if (key === "timerScore" && p.values.timeLimit > 0) continue; // a limit counts as the timer being on
      const flipped = typeof p.values[key] === "boolean" ? !p.values[key] : (p.values[key] === 0 ? 20 : 0);
      const result = presetOf({ ...p.values, [key]: flipped });
      assert.notEqual(result, p.id, `${p.id} with ${key} changed`);
    }
  }
  assert.equal(presetOf({ ...VALUES.normal, shortPay: false }), null);
});

test("presetOf ignores Large Coins and counts a time limit as the timer being on", () => {
  assert.equal(presetOf({ ...VALUES.normal, largeCoins: true }), "normal");
  assert.equal(presetOf({ ...VALUES.hard, timerScore: false }), "hard");
  assert.equal(presetOf({ ...VALUES.easy, timerScore: false, timeLimit: 0 }), "easy");
});

test("each option has an icon and chip text, as the spec lists them", () => {
  for (const o of OPTIONS) {
    assert.ok(ICON_NAMES.includes(o.icon), o.id);
    assert.ok(o.chip.length > 0, o.id);
  }
  assert.deepEqual(Object.fromEntries(OPTIONS.map((o) => [o.id, [o.icon, o.chip]])), {
    showCoins: ["eye", "Show Coins"],
    largeCoins: ["enlarge", "Large Coins"],
    autoStack: ["layers", "Auto-stack"],
    shortPay: ["coin-down", "Short-paying"],
    timerScore: ["stopwatch", "Timer"],
    timeLimit: ["hourglass", "Limit"],
  });
});

test("Auto-stack is on for Easy and Normal and off for Hard and Very hard", () => {
  assert.deepEqual(PRESETS.map((p) => [p.id, p.values.autoStack]), [["easy", true], ["normal", true], ["hard", false], ["veryHard", false]]);
  // a limit chosen from Normal is not Hard: Hard has Auto-stack off
  assert.equal(presetOf({ ...VALUES.normal, timeLimit: 30 }), null);
});
