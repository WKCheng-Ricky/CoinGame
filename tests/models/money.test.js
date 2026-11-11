import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPence, total, check, summarisePile, describePile, parseAmount, randomTarget, checkAnswer, MAX_CUSTOM_PENCE, MAX_RANDOM_PENCE } from "../../src/models/money.js";
import { pileOf } from "../helpers/pile-helper.js";

test("formatPence formats pounds and pence", () => {
  assert.equal(formatPence(5), "£0.05");
  assert.equal(formatPence(50), "£0.50");
  assert.equal(formatPence(395), "£3.95");
  assert.equal(formatPence(1000), "£10.00");
  assert.equal(formatPence(9999), "£99.99");
});

test("total sums a pile in pence", () => {
  assert.equal(total(pileOf("20p", "20p", "20p", "£1")), 160);
  assert.equal(total([]), 0);
  assert.equal(total(pileOf(...Array(9999).fill("1p"))), 9999);
});

test("check compares pile with target 395", () => {
  assert.equal(check(pileOf("£2", "£1", "50p", "20p", "20p", "5p"), 395), "exact");
  assert.equal(check(pileOf("£2", "£2"), 395), "over");
  assert.equal(check(pileOf("£1"), 395), "under");
  assert.equal(check([], 395), "under");
});

test("summarisePile counts coins by id", () => {
  assert.deepEqual(summarisePile(pileOf("£1", "20p", "20p", "20p")), { "20p": 3, "£1": 1 });
  assert.deepEqual(summarisePile([]), {});
});

test("describePile reads the pile in ascending coin order", () => {
  assert.equal(describePile([]), "The pile is empty.");
  assert.equal(describePile(pileOf("5p")), "In the pile: 1 × 5p");
  assert.equal(describePile(pileOf("£1", "20p", "20p", "20p")), "In the pile: 3 × 20p, 1 × £1");
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

test("checkAnswer compares the answer with the pile total", () => {
  assert.equal(checkAnswer(pileOf("£1", "50p"), 150), "exact");
  assert.equal(checkAnswer(pileOf("£1", "50p"), 200), "over");
  assert.equal(checkAnswer(pileOf("£1", "50p"), 100), "under");
  assert.equal(checkAnswer(pileOf("50p", "50p", "50p"), 150), "exact");
});

test("describePile accepts a custom intro", () => {
  assert.equal(describePile(pileOf("20p", "20p", "£1"), "On the counter"), "On the counter: 2 × 20p, 1 × £1");
});

