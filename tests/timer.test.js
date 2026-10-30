import { test } from "node:test";
import assert from "node:assert/strict";
import { PAR_MS, clockText, formatClock, isExpired, parFor, scoreFor, timeLeftMs } from "../src/timer.js";

test("scoreFor is 100 at no time, 10 at par and beyond, and linear between", () => {
  assert.equal(scoreFor(0, 20000), 100);
  assert.equal(scoreFor(20000, 20000), 10);
  assert.equal(scoreFor(40000, 20000), 10);
  assert.equal(scoreFor(10000, 20000), 55);
});

test("scoreFor gives whole points and survives a zero par", () => {
  assert.equal(Number.isInteger(scoreFor(3333, 20000)), true);
  assert.equal(scoreFor(5, 0), 10);
});

test("parFor gives each timed mode its par, honours an override and has none for custom", () => {
  assert.deepEqual(PAR_MS, { endless: 15000, cashier: 20000, "give-change": 30000 });
  assert.equal(parFor("cashier"), 20000);
  assert.equal(parFor("custom"), null);
  assert.equal(parFor("cashier", 5000), 5000);
  assert.equal(parFor("custom", 5000), null);
});

test("formatClock shows minutes and zero-padded seconds, never negative", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(65000), "1:05");
  assert.equal(formatClock(-5), "0:00");
});

test("clockText shows the elapsed time and the running score", () => {
  assert.equal(clockText(12000, 340), "Time 0:12 · Score 340");
  assert.equal(clockText(0, 0), "Time 0:00 · Score 0");
});

test("timeLeftMs counts down to zero and no further", () => {
  assert.equal(timeLeftMs(1000, 4000, 10), 7000);
  assert.equal(timeLeftMs(0, 20000, 10), 0);
});

test("isExpired is true from the limit on and never without a limit", () => {
  assert.equal(isExpired(0, 9999, 10), false);
  assert.equal(isExpired(0, 10000, 10), true);
  assert.equal(isExpired(0, 99999, 0), false);
});
