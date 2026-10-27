import { test } from "node:test";
import assert from "node:assert/strict";
import { COINS, coinById } from "../src/coins.js";
import {
  formatPence, total, check, addCoin, removeCoin,
  parseAmount, randomTarget, MAX_CUSTOM_PENCE, MAX_RANDOM_PENCE,
} from "../src/game.js";

test("COINS lists the 8 UK coins ascending with unique ids", () => {
  assert.equal(COINS.length, 8);
  assert.deepEqual(COINS.map((c) => c.pence), [1, 2, 5, 10, 20, 50, 100, 200]);
  assert.equal(new Set(COINS.map((c) => c.id)).size, 8);
});

test("coin shapes and rings match real coins", () => {
  assert.equal(coinById("20p").shape, "heptagon");
  assert.equal(coinById("50p").shape, "heptagon");
  assert.equal(coinById("£1").shape, "dodecagon");
  assert.equal(coinById("1p").shape, "round");
  assert.deepEqual(COINS.filter((c) => c.ring).map((c) => c.id), ["£1", "£2"]);
});

test("formatPence formats pounds and pence", () => {
  assert.equal(formatPence(5), "£0.05");
  assert.equal(formatPence(50), "£0.50");
  assert.equal(formatPence(395), "£3.95");
  assert.equal(formatPence(1000), "£10.00");
  assert.equal(formatPence(9999), "£99.99");
});

test("total sums a pile in pence", () => {
  assert.equal(total({ "20p": 3, "£1": 1 }), 160);
  assert.equal(total({}), 0);
  assert.equal(total({ "1p": 9999 }), 9999);
});

test("check compares pile with target 395", () => {
  assert.equal(check({ "£2": 1, "£1": 1, "50p": 1, "20p": 2, "5p": 1 }, 395), "exact");
  assert.equal(check({ "£2": 2 }, 395), "over");
  assert.equal(check({ "£1": 1 }, 395), "under");
  assert.equal(check({}, 395), "under");
});

test("addCoin returns a new pile and leaves the original unchanged", () => {
  const pile = {};
  assert.deepEqual(addCoin(pile, "5p"), { "5p": 1 });
  assert.deepEqual(pile, {});
});

test("removeCoin decrements, deletes at zero, and never goes negative", () => {
  assert.deepEqual(removeCoin({ "5p": 2 }, "5p"), { "5p": 1 });
  assert.deepEqual(removeCoin({ "5p": 1 }, "5p"), {});
  assert.deepEqual(removeCoin({}, "5p"), {});
});

test("parseAmount enforces the 99.99 cap", () => {
  assert.equal(parseAmount("99.99").ok, true);
  assert.equal(parseAmount("99.99").pence, MAX_CUSTOM_PENCE);
  assert.equal(parseAmount("100.00").ok, false);
  assert.equal(MAX_RANDOM_PENCE, 999);
});

test("parseAmount accepts common ways of typing an amount", () => {
  const cases = {
    "3.95": 395, "£3.95": 395, "4": 400, ".5": 50, "£.5": 50,
    " 3.95 ": 395, "£ 3": 300, "£ 3.95": 395, "3.": 300, "3.9": 390, "0.01": 1, "99.99": 9999,
  };
  for (const [text, pence] of Object.entries(cases)) {
    assert.deepEqual(parseAmount(text), { ok: true, pence }, text);
  }
});

test("parseAmount rejects invalid, zero and over-cap amounts", () => {
  for (const text of ["", "£", "£ ", "££3", "395p", "abc", "-1", "£-1", "0", "0.00", "3.955", "1,50", "1e2", "100", "99.995"]) {
    const r = parseAmount(text);
    assert.equal(r.ok, false, text);
    assert.ok(r.error.length > 0, text);
  }
});

test("randomTarget covers the full range at the extremes", () => {
  assert.equal(randomTarget(undefined, () => 0), 1);
  assert.equal(randomTarget(undefined, () => 0.999999), 999);
});

test("randomTarget skips the previous value at the range edges", () => {
  assert.equal(randomTarget(1, () => 0), 2);
  assert.equal(randomTarget(999, () => 0.999999), 998);
  assert.equal(randomTarget(500, () => 0), 1);
  assert.equal(randomTarget(500, () => 0.999999), 999);
});

test("randomTarget stays an integer in 1..999 and never repeats previous", () => {
  for (let i = 0; i < 2000; i++) {
    const n = randomTarget(500);
    assert.ok(Number.isInteger(n) && n >= 1 && n <= 999 && n !== 500, String(n));
  }
});
