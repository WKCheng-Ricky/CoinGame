import { test } from "node:test";
import assert from "node:assert/strict";
import { EFFECTS, MODE_IDS, OPTIONS, defaultOptions, isForcedOn, isOptionId, isValidValue, optionsFor, timerOn } from "../src/options.js";

test("defaultOptions gives Show Coins and Large Coins off and Short-paying customers on", () => {
  assert.deepEqual(defaultOptions(), { showCoins: false, largeCoins: false, autoStack: true, shortPay: true, timerScore: false, timeLimit: 0 });
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
