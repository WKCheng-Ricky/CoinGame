import { test } from "node:test";
import assert from "node:assert/strict";
import { MODE_IDS, OPTIONS, defaultOptions, isOptionId, optionsFor } from "../src/options.js";

test("defaultOptions gives Show Coins off and Short-paying customers on", () => {
  assert.deepEqual(defaultOptions(), { showCoins: false, shortPay: true });
});

test("optionsFor lists the global options, then the ones scoped to the mode", () => {
  assert.deepEqual(optionsFor("endless").map((o) => o.id), ["showCoins"]);
  assert.deepEqual(optionsFor("give-change").map((o) => o.id), ["showCoins", "shortPay"]);
});

test("optionsFor an unknown mode gives the global options only", () => {
  assert.deepEqual(optionsFor("nope").map((o) => o.id), ["showCoins"]);
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
