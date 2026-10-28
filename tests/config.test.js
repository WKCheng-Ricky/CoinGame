import { test } from "node:test";
import assert from "node:assert/strict";
import { TIMING_DEFAULTS, timingFromSearch } from "../src/config.js";

test("defaults when the search is empty", () => {
  assert.deepEqual(TIMING_DEFAULTS, { dwellMs: 2000, detachHoldMs: 1000, advanceDelayMs: 400 });
  assert.deepEqual(timingFromSearch(""), TIMING_DEFAULTS);
});

test("reads dwell, hold and advance", () => {
  assert.deepEqual(timingFromSearch("?dwell=50&hold=60&advance=70"),
    { dwellMs: 50, detachHoldMs: 60, advanceDelayMs: 70 });
});

test("0 is accepted", () => {
  assert.equal(timingFromSearch("?dwell=0").dwellMs, 0);
});

test("10000 is accepted", () => {
  assert.equal(timingFromSearch("?hold=10000").detachHoldMs, 10000);
});

for (const [name, bad] of [["abc", "abc"], ["-5", "-5"], ["1.5", "1.5"], ["10001", "10001"], ["empty string", ""]]) {
  test(`rejects ${name} and uses the default`, () => {
    assert.deepEqual(timingFromSearch(`?dwell=${bad}&hold=${bad}&advance=${bad}`), TIMING_DEFAULTS);
  });
}
