import { test } from "node:test";
import assert from "node:assert/strict";
import { PAR_MS, isScored, exitPrompt, endSession, clockText, formatClock, isExpired, parFor, scoreFor, timeLeftMs } from "../../src/models/session.js";
import { createState, applyPreset, setOption } from "../../src/models/game-state.js";

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

const scoredState = (over = {}) => ({ ...applyPreset(createState(), "normal"), mode: "cashier", ...over });

test("isScored is true for the timed modes with the timer on, false for custom or with the timer off", () => {
  assert.equal(isScored(scoredState()), true);
  assert.equal(isScored(scoredState({ mode: "give-change" })), true);
  assert.equal(isScored(scoredState({ mode: "custom" })), false);
  assert.equal(isScored(applyPreset(scoredState(), "easy")), false);
});

test("exitPrompt asks only when scored, and Back with no score leaves at once", () => {
  const scored = (score) => scoredState({ score });
  const unscored = (score) => ({ ...applyPreset(createState(), "easy"), mode: "cashier", score });
  assert.equal(exitPrompt(scored(0), "end"), "end");
  assert.equal(exitPrompt(scored(5), "end"), "end");
  assert.equal(exitPrompt(scored(0), "back"), null);
  assert.equal(exitPrompt(scored(5), "back"), "back");
  for (const button of ["end", "back"]) {
    assert.equal(exitPrompt(unscored(0), button), null);
    assert.equal(exitPrompt(unscored(5), button), null);
  }
});

test("endSession reports mode, preset, score and customers served", () => {
  const s = { ...applyPreset(createState(), "hard"), mode: "give-change", score: 120, rounds: 3 };
  assert.deepEqual(endSession(s, "2026-10-31T10:00:00.000Z"), {
    mode: "give-change", preset: "hard", score: 120, served: 3, at: "2026-10-31T10:00:00.000Z",
  });
});

test("endSession preset is null for custom settings", () => {
  const s = setOption({ ...applyPreset(createState(), "hard"), score: 10, rounds: 1 }, "timeLimit", 20);
  assert.equal(endSession(s, "t").preset, null);
});

test("endSession does not change its input", () => {
  const s = scoredState({ score: 7, rounds: 2 });
  const copy = structuredClone(s);
  endSession(s, "t");
  assert.deepEqual(s, copy);
});
