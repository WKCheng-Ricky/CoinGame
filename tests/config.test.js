import { test } from "node:test";
import assert from "node:assert/strict";
import { LARGE_COIN_SCALE, TIMING_DEFAULTS, coinScaleFor, giveChangeOdds, timingFromSearch } from "../src/config.js";

test("defaults when the search is empty", () => {
  assert.deepEqual(TIMING_DEFAULTS, { dwellMs: 2000, detachHoldMs: 1000, advanceDelayMs: 400, parMs: null, unservedDelayMs: 2000 });
  assert.deepEqual(timingFromSearch(""), TIMING_DEFAULTS);
});

test("reads dwell, hold and advance", () => {
  assert.deepEqual(timingFromSearch("?dwell=50&hold=60&advance=70"),
    { dwellMs: 50, detachHoldMs: 60, advanceDelayMs: 70, parMs: null, unservedDelayMs: 2000 });
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

test("giveChangeOdds underpays 25% of customers with Short-paying customers on", () => {
  assert.deepEqual(giveChangeOdds({ shortPay: true }), { underpaid: 0.25, exactShare: 1 / 3 });
});

test("giveChangeOdds never underpays with Short-paying customers off", () => {
  assert.deepEqual(giveChangeOdds({ shortPay: false }), { underpaid: 0, exactShare: 1 / 3 });
});

test("coinScaleFor is 1 normally and LARGE_COIN_SCALE with Large Coins", () => {
  assert.equal(coinScaleFor({ largeCoins: false }), 1);
  assert.equal(coinScaleFor({}), 1);
  assert.equal(coinScaleFor({ largeCoins: true }), LARGE_COIN_SCALE);
});

test("LARGE_COIN_SCALE makes coins bigger", () => {
  assert.ok(LARGE_COIN_SCALE > 1);
});

test("?par= reads whole seconds from 1 to 600 and nothing else", () => {
  assert.equal(timingFromSearch("?par=12").parMs, 12000);
  assert.equal(timingFromSearch("?par=600").parMs, 600000);
  for (const bad of ["0", "601", "abc", "1.5", "-3", ""]) assert.equal(timingFromSearch(`?par=${bad}`).parMs, null, bad);
});

test("?unserved= sets how long an unserved customer stays on screen", () => {
  assert.equal(timingFromSearch("?unserved=50").unservedDelayMs, 50);
  assert.equal(timingFromSearch("?unserved=abc").unservedDelayMs, 2000);
});
