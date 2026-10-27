import { test } from "node:test";
import assert from "node:assert/strict";
import { seq, pileOf } from "./pile-helper.js";
import {
  ADVANCE_DELAY_MS, createState, startGame, nextRound,
  addToPile, removeFromPile, clearPile, submitCheck, canAdvance,
  setDifficulty,
} from "../src/state.js";

const EXACT_395 = pileOf("£2", "£1", "50p", "20p", "20p", "5p");
const withPile = (s, pile) => ({ ...s, pile });

test("createState has the expected shape", () => {
  assert.deepEqual(createState(), {
    mode: "endless", target: 0, pile: [], nextUid: 1, rounds: 0, solved: false, solvedAt: 0,
    message: { text: "", kind: "" },
    difficulty: "normal",
  });
  assert.equal(ADVANCE_DELAY_MS, 400);
});

test("startGame sets mode and target with an empty pile and rounds 0", () => {
  const s = startGame(createState(), "endless", 395);
  assert.equal(s.mode, "endless");
  assert.equal(s.target, 395);
  assert.deepEqual(s.pile, []);
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
  assert.deepEqual(s.pile, []);
  assert.equal(s.solved, false);
  assert.deepEqual(s.message, { text: "", kind: "" });
});

test("addToPile appends an entry with the next uid and placement from rng", () => {
  const s0 = startGame(createState(), "custom", 395);
  const s1 = addToPile(s0, "5p", seq([0.5, 0.5, 0.25]));
  assert.deepEqual(s1.pile, [{ uid: 1, coinId: "5p", x: 0, y: 0, rot: 90 }]);
  assert.equal(s1.nextUid, 2);
  assert.deepEqual(s0.pile, []);
  assert.equal(s0.nextUid, 1);
});

test("uids are never reused after a removal", () => {
  const s1 = addToPile(startGame(createState(), "custom", 395), "5p");
  const s2 = removeFromPile(s1, 1);
  assert.deepEqual(s2.pile, []);
  assert.equal(addToPile(s2, "5p").pile[0].uid, 2);
});

test("addToPile keeps earlier entries untouched", () => {
  const s1 = addToPile(startGame(createState(), "custom", 395), "5p");
  const first = { ...s1.pile[0] };
  const s2 = addToPile(s1, "£1");
  assert.equal(s2.pile.length, 2);
  assert.deepEqual(s2.pile[0], first);
  assert.equal(s2.pile[1].uid, 2);
});

test("addToPile ignores an unknown coin id", () => {
  const s = startGame(createState(), "custom", 395);
  assert.equal(addToPile(s, "3p"), s);
});

test("removeFromPile removes only the matching uid", () => {
  let s = startGame(createState(), "custom", 395);
  s = addToPile(addToPile(addToPile(s, "5p"), "5p"), "£1");
  const r = removeFromPile(s, 2);
  assert.deepEqual(r.pile.map((e) => e.uid), [1, 3]);
  assert.equal(r.nextUid, 4);
});

test("removeFromPile with an unknown uid returns the same object", () => {
  const s = addToPile(startGame(createState(), "custom", 395), "5p");
  assert.equal(removeFromPile(s, 99), s);
});

test("clearPile empties the pile and keeps nextUid", () => {
  const s = addToPile(addToPile(startGame(createState(), "custom", 395), "5p"), "£1");
  const c = clearPile(s);
  assert.deepEqual(c.pile, []);
  assert.equal(c.nextUid, 3);
});

test("startGame and nextRound reset the pile and nextUid", () => {
  const s = addToPile(startGame(createState(), "endless", 395), "5p");
  for (const r of [startGame(s, "custom", 100), nextRound(s, 100)]) {
    assert.deepEqual(r.pile, []);
    assert.equal(r.nextUid, 1);
  }
});

test("submitCheck reports exact, over and under for target 395", () => {
  const s = startGame(createState(), "custom", 395);
  const exact = submitCheck(withPile(s, EXACT_395), 1000);
  assert.equal(exact.solved, true);
  assert.equal(exact.solvedAt, 1000);
  assert.deepEqual(exact.message, { text: "Correct! You made exactly £3.95.", kind: "success" });
  const over = submitCheck(withPile(s, pileOf("£2", "£2")), 1000);
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
  assert.equal(removeFromPile(solved, 1), solved);
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
  const s = withPile(startGame(createState(), "endless", 395), pileOf("£1"));
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
