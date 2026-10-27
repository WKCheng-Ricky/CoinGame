import { test } from "node:test";
import assert from "node:assert/strict";
import { seq, seeded, pileOf } from "./pile-helper.js";
import {
  ADVANCE_DELAY_MS, createState, startGame, nextRound,
  addToPile, removeFromPile, clearPile, submitCheck, canAdvance,
  setDifficulty, moveCoin, settleCoin, addToPileAt, moveGroup, settleGroupCoins,
} from "../src/state.js";
import { stackCounts, total, PUSH_FACTOR, PILE_WIDTH_MM, PILE_HEIGHT_MM, STACK_STEP_MM, detachNudge } from "../src/game.js";
import { coinById } from "../src/coins.js";

const EXACT_395 = pileOf("£2", "£1", "50p", "20p", "20p", "5p");
const withPile = (s, pile) => ({ ...s, pile });

// Hand-built, well-separated pile so moveCoin tests do not depend on placement.
const A = { uid: 1, coinId: "£2", x: -0.4, y: -0.4, rot: 10 };
const B = { uid: 2, coinId: "50p", x: 0, y: 0, rot: 20 };
const C = { uid: 3, coinId: "£1", x: 0.4, y: 0.4, rot: 30 };
const SPREAD = { ...createState(), target: 395, pile: [A, B, C], nextUid: 4 };

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

test("moveCoin moves one entry to the end with the new position and keeps its other fields", () => {
  const next = moveCoin(SPREAD, 1, 0.2, -0.3);
  assert.deepEqual(next.pile.map((e) => e.uid), [2, 3, 1]);
  assert.deepEqual(next.pile[0], B);
  assert.deepEqual(next.pile[1], C);
  assert.deepEqual(next.pile[2], { uid: 1, coinId: "£2", x: 0.2, y: -0.3, rot: 10 });
});

test("moveCoin clamps the target position", () => {
  const next = moveCoin(SPREAD, 2, 5, -5);
  const moved = next.pile.find((e) => e.uid === 2);
  assert.equal(moved.x, 0.5);
  assert.equal(moved.y, -0.5);
});

test("moveCoin leaves total, rounds, message, nextUid and target unchanged", () => {
  const s = { ...SPREAD, rounds: 3, message: { text: "hi", kind: "hint" } };
  const next = moveCoin(s, 1, 0.1, 0.1);
  assert.equal(total(next.pile), total(s.pile));
  assert.equal(next.rounds, 3);
  assert.deepEqual(next.message, { text: "hi", kind: "hint" });
  assert.equal(next.nextUid, 4);
  assert.equal(next.target, 395);
});

test("moveCoin keeps order when the last entry is moved", () => {
  const next = moveCoin(SPREAD, 3, 0.1, 0.1);
  assert.deepEqual(next.pile.map((e) => e.uid), [1, 2, 3]);
  assert.deepEqual(next.pile[2], { ...C, x: 0.1, y: 0.1 });
});

test("moveCoin returns the same object for an unknown uid", () => {
  assert.equal(moveCoin(SPREAD, 99, 0.1, 0.1), SPREAD);
});

test("moveCoin returns the same object for a solved state", () => {
  const solved = { ...SPREAD, solved: true };
  assert.equal(moveCoin(solved, 1, 0.1, 0.1), solved);
});

test("after moving a coin, addToPile uses the old nextUid and removeFromPile removes exactly that coin", () => {
  const moved = moveCoin(SPREAD, 1, 0.2, -0.3);
  const added = addToPile(moved, "5p", seeded(7));
  assert.equal(added.pile.at(-1).uid, SPREAD.nextUid);
  assert.equal(added.nextUid, SPREAD.nextUid + 1);
  assert.deepEqual(removeFromPile(moved, 1).pile, [B, C]);
});

const placed = (...entries) => ({ ...startGame(createState(), "endless", 100), pile: entries, nextUid: 10 });
const e = (uid, coinId, x, y, rot = 0) => ({ uid, coinId, x, y, rot });

test("settleCoin returns the same state when nothing is too close or the uid is unknown", () => {
  const far = placed(e(1, "20p", 0, 0), e(2, "20p", 0.3, 0));
  assert.equal(settleCoin(far, 2, null), far);
  const close = placed(e(1, "20p", 0, 0), e(2, "20p", 0.01, 0));
  assert.equal(settleCoin(close, 99, null), close);
});

test("settleCoin leaves a solved state alone", () => {
  const solved = { ...placed(e(1, "20p", 0, 0), e(2, "20p", 0.01, 0)), solved: true };
  assert.equal(settleCoin(solved, 2, null), solved);
});

test("settleCoin after moveCoin snaps onto a same-type coin", () => {
  const s = {
    ...placed(e(1, "20p", 0, 0, 30), e(2, "20p", 0.3, 0)),
    rounds: 3, message: { text: "hi", kind: "hint" },
  };
  const moved = moveCoin(s, 2, 0.02, 0);
  const out = settleCoin(moved, 2, { x: 0.3, y: 0 });
  const m = out.pile.find((p) => p.uid === 2);
  assert.ok(Math.abs(m.x - STACK_STEP_MM.x / PILE_WIDTH_MM) < 1e-9);
  assert.equal(m.rot, 30);
  assert.equal(total(out.pile), total(moved.pile));
  for (const k of ["nextUid", "rounds", "message", "target"]) assert.equal(out[k], moved[k]);
});

test("addToPile stacks a new coin that lands on a same-type coin", () => {
  const s = placed(e(1, "20p", 0, 0, 77));
  const out = addToPile(s, "20p", () => 0.5);
  const n = out.pile[1];
  assert.ok(Math.abs(n.x - STACK_STEP_MM.x / PILE_WIDTH_MM) < 1e-9);
  assert.ok(Math.abs(n.y - STACK_STEP_MM.y / PILE_HEIGHT_MM) < 1e-9);
  assert.equal(n.rot, 77);
});

test("addToPile pushes a different-type coin apart", () => {
  const s = placed(e(1, "20p", 0, 0));
  const out = addToPile(s, "50p", seq([0.5, 0.5], 0.5));
  const [a, b] = out.pile;
  const d = Math.hypot((a.x - b.x) * PILE_WIDTH_MM, (a.y - b.y) * PILE_HEIGHT_MM);
  const want = PUSH_FACTOR * (coinById("20p").diameter + coinById("50p").diameter) / 2;
  assert.ok(Math.abs(d - want) < 1e-6);
});

test("addToPileAt appends one entry at the given spot with a rotation from rng", () => {
  const s = { ...SPREAD };
  const out = addToPileAt(s, "20p", 0.2, -0.3, () => 0.5);
  assert.equal(out.pile.length, 4);
  assert.deepEqual(out.pile[3], { uid: 4, coinId: "20p", x: 0.2, y: -0.3, rot: 180 });
  assert.deepEqual(out.pile.slice(0, 3), s.pile);
  assert.equal(out.nextUid, 5);
});

test("addToPileAt clamps the position", () => {
  const a = addToPileAt(SPREAD, "20p", 5, -5, () => 0).pile[3];
  assert.equal(a.x, 0.5);
  assert.equal(a.y, -0.5);
  assert.equal(addToPileAt(SPREAD, "20p", NaN, 0, () => 0).pile[3].x, 0);
});

test("addToPileAt raises the total by the coin's pence and clears the message", () => {
  const s = { ...SPREAD, message: { text: "A bit too much", kind: "hint" }, target: 777, rounds: 3 };
  const out = addToPileAt(s, "50p", 0, 0, () => 0);
  assert.equal(total(out.pile), total(s.pile) + coinById("50p").pence);
  assert.deepEqual(out.message, { text: "", kind: "" });
  assert.equal(out.target, 777);
  assert.equal(out.rounds, 3);
});

test("addToPileAt returns the same state for an unknown coin or a solved state", () => {
  assert.equal(addToPileAt(SPREAD, "3p", 0, 0), SPREAD);
  const solved = { ...SPREAD, solved: true };
  assert.equal(addToPileAt(solved, "20p", 0, 0), solved);
});

test("addToPileAt does not settle onto an existing coin", () => {
  const s = placed(e(1, "20p", 0.1, 0.1));
  const out = addToPileAt(s, "20p", 0.1, 0.1, () => 0);
  assert.deepEqual(out.pile[0], s.pile[0]);
  assert.equal(out.pile[1].x, 0.1);
  assert.equal(out.pile[1].y, 0.1);
});

test("addToPileAt never reuses a uid", () => {
  const a = addToPileAt(SPREAD, "20p", 0, 0, () => 0);
  const b = removeFromPile(a, 4);
  const c = addToPileAt(b, "20p", 0, 0, () => 0);
  assert.equal(c.pile[c.pile.length - 1].uid, 5);
});

// ---- group moves ----
const GA = { uid: 1, coinId: "20p", x: 0, y: 0, rot: 1 };
const GB = { uid: 2, coinId: "20p", x: 0.01, y: -0.01, rot: 2 };
const GO = { uid: 3, coinId: "£2", x: -0.4, y: 0.4, rot: 3 };
const GS = { ...createState(), target: 100, pile: [GA, GO, GB], nextUid: 4 };

test("moveGroup shifts the group together and moves it to the end in order", () => {
  const s = moveGroup(GS, [1, 2], 0.1, 0.2);
  assert.deepEqual(s.pile.map((e) => e.uid), [3, 1, 2]);
  assert.deepEqual(s.pile[0], GO);
  assert.ok(Math.abs(s.pile[1].x - 0.1) < 1e-12 && Math.abs(s.pile[1].y - 0.2) < 1e-12);
  assert.ok(Math.abs(s.pile[2].x - 0.11) < 1e-12 && Math.abs(s.pile[2].y - 0.19) < 1e-12);
  assert.equal(s.nextUid, GS.nextUid);
  assert.equal(s.message, GS.message);
  assert.equal(s.rounds, GS.rounds);
  assert.equal(total(s.pile), total(GS.pile));
});

test("moveGroup clamps jointly without squashing, handles NaN and Infinity", () => {
  let s = moveGroup(GS, [1, 2], 5, 0);
  assert.equal(s.pile[2].x, 0.5);
  assert.ok(Math.abs(s.pile[1].x - 0.49) < 1e-12);
  s = moveGroup(GS, [1, 2], -5, 0);
  assert.equal(s.pile[1].x, -0.5);
  assert.ok(Math.abs(s.pile[2].x + 0.49) < 1e-12);
  s = moveGroup(GS, [1, 2], 0, 5);
  assert.equal(s.pile[1].y, 0.5);
  assert.ok(Math.abs(s.pile[2].y - 0.49) < 1e-12);
  s = moveGroup(GS, [1, 2], 0, -5);
  assert.equal(s.pile[2].y, -0.5);
  assert.ok(Math.abs(s.pile[1].y - -0.49) < 1e-12);
  s = moveGroup(GS, [1, 2], NaN, Infinity);
  assert.equal(s.pile[1].x, 0);
  assert.equal(s.pile[1].y, 0.5);
});

test("moveGroup returns the same state when solved, empty or unknown", () => {
  const solved = { ...GS, solved: true };
  assert.equal(moveGroup(solved, [1, 2], 0.1, 0), solved);
  assert.equal(moveGroup(GS, [], 0.1, 0), GS);
  assert.equal(moveGroup(GS, [99], 0.1, 0), GS);
});

test("settleGroupCoins re-lays onto a same-type coin and keeps the total", () => {
  const base = { uid: 9, coinId: "20p", x: 0.3, y: 0.3, rot: 50 };
  const st = { ...GS, pile: [base, GA, GB] };
  const moved = moveGroup(st, [1, 2], 0.3, 0.3);
  const out = settleGroupCoins(moved, [1, 2], 1, { x: 0, y: 0 });
  assert.notEqual(out, moved);
  assert.equal(stackCounts(out.pile).get(2), 3);
  assert.equal(total(out.pile), total(moved.pile));
});

test("settleGroupCoins returns the same state when solved, unknown or unchanged", () => {
  const solved = { ...GS, solved: true };
  assert.equal(settleGroupCoins(solved, [1, 2], 1, { x: 0.3, y: 0.3 }), solved);
  assert.equal(settleGroupCoins(GS, [1, 2], 99, { x: 0.3, y: 0.3 }), GS);
  assert.equal(settleGroupCoins(GS, [1, 2], 1, { x: 0.3, y: 0.3 }), GS);
});

test("a nudged top coin leaves a 3-stack and does not snap back", () => {
  const pile = [1, 2, 3].map((i) => ({
    uid: i, coinId: "20p",
    x: -0.2 + ((i - 1) * STACK_STEP_MM.x) / PILE_WIDTH_MM,
    y: -0.2 + ((i - 1) * STACK_STEP_MM.y) / PILE_HEIGHT_MM,
    rot: 0,
  }));
  let s = { ...createState(), pile, nextUid: 4 };
  assert.equal(stackCounts(s.pile).get(3), 3);
  const top = s.pile.find((e) => e.uid === 3);
  const from = { x: top.x, y: top.y };
  const { x, y } = detachNudge(top);
  s = settleCoin(moveCoin(s, 3, x, y), 3, from);
  const counts = stackCounts(s.pile);
  assert.equal(counts.size, 1);
  assert.equal(counts.get(2), 2);
  assert.ok(!counts.has(3));
});
