import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ADVANCE_DELAY_MS, createState, startGame, nextRound,
  addToPile, removeFromPile, clearPile, submitCheck, canAdvance,
  setDifficulty,
} from "../src/state.js";

const EXACT_395 = { "£2": 1, "£1": 1, "50p": 1, "20p": 2, "5p": 1 };
const withPile = (s, pile) => ({ ...s, pile });

test("createState has the expected shape", () => {
  assert.deepEqual(createState(), {
    mode: "endless", target: 0, pile: {}, rounds: 0, solved: false, solvedAt: 0,
    message: { text: "", kind: "" },
    difficulty: "normal",
  });
  assert.equal(ADVANCE_DELAY_MS, 400);
});

test("startGame sets mode and target with an empty pile and rounds 0", () => {
  const s = startGame(createState(), "endless", 395);
  assert.equal(s.mode, "endless");
  assert.equal(s.target, 395);
  assert.deepEqual(s.pile, {});
  assert.equal(s.rounds, 0);
});

test("startGame resets rounds but nextRound keeps them", () => {
  let s = startGame(createState(), "endless", 395);
  s = submitCheck(withPile(s, EXACT_395), 1000);
  assert.equal(s.rounds, 1);
  assert.equal(nextRound(s, 100).rounds, 1);
  assert.equal(nextRound(s, 100).mode, "endless");
  assert.equal(startGame(s, "endless", 100).rounds, 0);
});

test("nextRound clears pile, solved flag and message", () => {
  let s = submitCheck(withPile(startGame(createState(), "custom", 395), EXACT_395), 1000);
  s = nextRound(s, 395);
  assert.deepEqual(s.pile, {});
  assert.equal(s.solved, false);
  assert.deepEqual(s.message, { text: "", kind: "" });
});

test("addToPile and removeFromPile round-trip without mutating input", () => {
  const s0 = startGame(createState(), "custom", 395);
  const s1 = addToPile(s0, "5p");
  assert.deepEqual(s1.pile, { "5p": 1 });
  assert.deepEqual(s0.pile, {});
  assert.deepEqual(removeFromPile(s1, "5p").pile, {});
  assert.deepEqual(removeFromPile(s0, "5p").pile, {});
});

test("submitCheck reports exact, over and under for target 395", () => {
  const s = startGame(createState(), "custom", 395);
  const exact = submitCheck(withPile(s, EXACT_395), 1000);
  assert.equal(exact.solved, true);
  assert.equal(exact.solvedAt, 1000);
  assert.deepEqual(exact.message, { text: "Correct! You made exactly £3.95.", kind: "success" });
  const over = submitCheck(withPile(s, { "£2": 2 }), 1000);
  assert.equal(over.solved, false);
  assert.deepEqual(over.message, { text: "A bit too much", kind: "hint" });
  const under = submitCheck(s, 1000);
  assert.deepEqual(under.message, { text: "Not enough yet", kind: "hint" });
});

test("endless exact increments rounds; custom exact does not", () => {
  const endless = submitCheck(withPile(startGame(createState(), "endless", 395), EXACT_395), 0);
  const custom = submitCheck(withPile(startGame(createState(), "custom", 395), EXACT_395), 0);
  assert.equal(endless.rounds, 1);
  assert.equal(custom.rounds, 0);
});

test("a solved round cannot be changed or re-submitted", () => {
  const solved = submitCheck(withPile(startGame(createState(), "endless", 395), EXACT_395), 1000);
  assert.equal(addToPile(solved, "1p"), solved);
  assert.equal(removeFromPile(solved, "£2"), solved);
  assert.equal(clearPile(solved), solved);
  assert.equal(submitCheck(solved, 5000), solved);
  assert.equal(solved.rounds, 1);
});

test("changing the pile clears a previous hint", () => {
  const s = startGame(createState(), "custom", 395);
  const hinted = submitCheck(s, 0);
  assert.equal(hinted.message.kind, "hint");
  assert.deepEqual(addToPile(hinted, "1p").message, { text: "", kind: "" });
  assert.deepEqual(clearPile(hinted).message, { text: "", kind: "" });
});

test("canAdvance needs a solved round and 400ms", () => {
  const s = startGame(createState(), "custom", 395);
  assert.equal(canAdvance(s, 99999), false);
  const solved = { ...s, solved: true, solvedAt: 1000 };
  assert.equal(canAdvance(solved, 1399), false);
  assert.equal(canAdvance(solved, 1400), true);
});

test("setDifficulty switches between easy and normal without touching the round", () => {
  const s = withPile(startGame(createState(), "endless", 395), { "£1": 1 });
  const easy = setDifficulty(s, "easy");
  assert.equal(easy.difficulty, "easy");
  assert.deepEqual(easy.pile, s.pile);
  assert.equal(easy.target, 395);
  assert.equal(setDifficulty(easy, "normal").difficulty, "normal");
});

test("setDifficulty ignores unknown values and returns the same object", () => {
  const s = createState();
  assert.equal(setDifficulty(s, "hard"), s);
  assert.equal(setDifficulty(s, undefined), s);
});

test("startGame and nextRound keep the difficulty", () => {
  const easy = setDifficulty(createState(), "easy");
  const started = startGame(easy, "custom", 150);
  assert.equal(started.difficulty, "easy");
  assert.equal(nextRound(started, 200).difficulty, "easy");
});
