import { test } from "node:test";
import assert from "node:assert/strict";
import { seq, seeded, pileOf } from "./pile-helper.js";
import {
  ADVANCE_DELAY_MS, createState, startGame, nextRound,
  addToPile, removeFromPile, clearPile, submitCheck, canAdvance,
  setDifficulty, moveCoin, settleCoin, addToPileAt, moveGroup, settleGroupCoins,
  startCashier, nextCustomer, submitAnswer, isContinuous,
  startGiveChange, nextGiveChangeCustomer, submitGiveChangeAnswer,
} from "../src/state.js";
import { formatPence, randomHandful, stackCounts, total, PUSH_FACTOR, PILE_WIDTH_MM, PILE_HEIGHT_MM, STACK_STEP_MM, detachNudge } from "../src/game.js";
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
    change: [], price: 0, scenario: "",
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

test("canAdvance uses a custom delay", () => {
  const solved = { ...startGame(createState(), "custom", 395), solved: true, solvedAt: 0 };
  assert.equal(canAdvance(solved, 250, 250), true);
  assert.equal(canAdvance(solved, 249, 250), false);
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

test("startCashier starts a fresh cashier game with a handful", () => {
  const s = startCashier(createState(), seeded(3));
  assert.equal(s.mode, "cashier");
  assert.equal(s.rounds, 0);
  assert.equal(s.target, 0);
  assert.equal(s.solved, false);
  assert.deepEqual(s.message, { text: "", kind: "" });
  assert.ok(s.pile.length >= 2 && s.pile.length <= 12);
  assert.equal(new Set(s.pile.map((e) => e.uid)).size, s.pile.length);
  assert.equal(s.nextUid, s.pile.length + 1);
  for (const e of s.pile) {
    assert.ok(Number.isFinite(e.x) && Math.abs(e.x) <= 0.5);
    assert.ok(Number.isFinite(e.y) && Math.abs(e.y) <= 0.5);
    assert.ok(Number.isInteger(e.rot));
  }
});

test("startCashier keeps difficulty and resets old state", () => {
  const easy = setDifficulty(createState(), "easy");
  assert.equal(startCashier(easy, seeded(1)).difficulty, "easy");
  const old = { ...easy, rounds: 5, message: { text: "x", kind: "hint" }, pile: pileOf("£1"), nextUid: 2 };
  const s = startCashier(old, seeded(2));
  assert.equal(s.rounds, 0);
  assert.deepEqual(s.message, { text: "", kind: "" });
  assert.ok(s.pile.length >= 2);
  assert.equal(s.nextUid, s.pile.length + 1);
});

test("startCashier handfuls can stack, and stacked coins stay separate entries", () => {
  let stacked = 0;
  let plain = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const s = startCashier(createState(), seeded(seed));
    if (stackCounts(s.pile).size > 0) {
      stacked++;
      const expected = randomHandful(seeded(seed)); // the deal draws its ids first
      assert.equal(s.pile.length, s.nextUid - 1);
      assert.deepEqual(s.pile.map((e) => e.coinId).sort(), [...expected].sort());
      assert.equal(total(s.pile), expected.reduce((sum, id) => sum + coinById(id).pence, 0));
    } else plain++;
  }
  assert.ok(stacked > 0);
  assert.ok(plain > 0);
});

test("nextCustomer keeps rounds and mode, resets solved and message, and changes the pile", () => {
  const first = startCashier(createState(), seeded(4));
  const solved = submitAnswer(first, total(first.pile), 100);
  const next = nextCustomer(solved, seeded(9));
  assert.equal(next.mode, "cashier");
  assert.equal(next.rounds, 1);
  assert.equal(next.solved, false);
  assert.deepEqual(next.message, { text: "", kind: "" });
  const ids = (s) => s.pile.map((e) => e.coinId).sort().join(",");
  assert.notEqual(ids(next), ids(first));
});

test("submitAnswer with the exact total solves once", () => {
  const s = startCashier(createState(), seeded(5));
  const solved = submitAnswer(s, total(s.pile), 1000);
  assert.equal(solved.solved, true);
  assert.equal(solved.solvedAt, 1000);
  assert.equal(solved.rounds, 1);
  assert.deepEqual(solved.message, { text: `Correct! That is ${formatPence(total(s.pile))}.`, kind: "success" });
  const again = submitAnswer(solved, total(s.pile), 2000);
  assert.equal(again, solved);
  assert.equal(again.rounds, 1);
});

test("submitAnswer hints Too high / Too low and leaves the pile alone", () => {
  const s = startCashier(createState(), seeded(6));
  const t = total(s.pile);
  const high = submitAnswer(s, t + 1, 0);
  const low = submitAnswer(s, t - 1, 0);
  assert.equal(high.message.text, "Too high");
  assert.equal(high.message.kind, "hint");
  assert.equal(low.message.text, "Too low");
  assert.equal(high.pile, s.pile);
  assert.equal(low.solved, false);
  const again = submitAnswer(high, t + 1, 0);
  assert.notEqual(again.message, high.message);
  assert.equal(again.message.text, high.message.text);
});

test("isContinuous is true for endless and cashier only", () => {
  assert.equal(isContinuous(createState()), true);
  assert.equal(isContinuous(startCashier(createState(), seeded(1))), true);
  assert.equal(isContinuous(startGame(createState(), "custom", 395)), false);
});

test("canAdvance after a correct cashier answer waits for the delay", () => {
  const s = startCashier(createState(), seeded(7));
  const solved = submitAnswer(s, total(s.pile), 1000);
  assert.equal(canAdvance(solved, 1000 + ADVANCE_DELAY_MS - 1), false);
  assert.equal(canAdvance(solved, 1000 + ADVANCE_DELAY_MS), true);
});

test("cashier mode blocks adding, removing and clearing coins", () => {
  const s = startCashier(createState(), seeded(8));
  assert.equal(addToPile(s, "£1", seeded(1)), s);
  assert.equal(addToPileAt(s, "£1", 0, 0, seeded(1)), s);
  assert.equal(removeFromPile(s, s.pile[0].uid), s);
  assert.equal(clearPile(s), s);
});

test("moving and settling in cashier mode keeps the coins and total", () => {
  const s = startCashier(createState(), seeded(10));
  const uid = s.pile[0].uid;
  const moved = moveCoin(s, uid, 0.1, 0.1);
  const settled = settleCoin(moved, uid, { x: s.pile[0].x, y: s.pile[0].y });
  const ids = (st) => st.pile.map((e) => e.coinId).sort();
  assert.deepEqual(ids(settled), ids(s));
  assert.equal(total(settled.pile), total(s.pile));
});

// ---- Give Change mode ----
const NORMAL = { underpaid: 0.25, exactShare: 1 / 3 };

test("startGiveChange deals a customer handful with a consistent scenario and price", () => {
  const s = startGiveChange(createState(), NORMAL, seeded(7));
  const paid = total(s.pile);
  assert.equal(s.mode, "give-change");
  assert.ok(s.pile.length >= 2 && s.pile.length <= 12);
  assert.deepEqual(s.change, []);
  assert.equal(s.rounds, 0);
  if (s.scenario === "over") assert.ok(s.price < paid);
  else if (s.scenario === "exact") assert.equal(s.price, paid);
  else { assert.equal(s.scenario, "under"); assert.ok(s.price > paid); }
});

test("startGiveChange never rolls under when underpaid is 0", () => {
  for (let i = 1; i <= 100; i++) {
    assert.notEqual(startGiveChange(createState(), { underpaid: 0, exactShare: 1 / 3 }, seeded(i)).scenario, "under");
  }
});

test("nextGiveChangeCustomer keeps rounds and difficulty and empties change", () => {
  let s = startGiveChange(setDifficulty(createState(), "easy"), NORMAL, seeded(3));
  s = { ...s, rounds: 4, solved: true, change: pileOf("20p") };
  const n = nextGiveChangeCustomer(s, NORMAL, seeded(5));
  assert.equal(n.mode, "give-change");
  assert.equal(n.rounds, 4);
  assert.equal(n.difficulty, "easy");
  assert.deepEqual(n.change, []);
  assert.equal(n.solved, false);
  assert.notDeepEqual(n.pile.map((e) => e.coinId).sort(), s.pile.map((e) => e.coinId).sort());
});

test("pile key routes add/remove/clear in give-change mode", () => {
  const s = startGiveChange(createState(), NORMAL, seeded(11));
  assert.equal(addToPile(s, "20p", seeded(1), "pile"), s);
  assert.equal(addToPileAt(s, "20p", 0, 0, seeded(1), "pile"), s);
  const a = addToPile(s, "20p", seeded(1), "change");
  assert.equal(a.change.length, 1);
  assert.equal(a.pile, s.pile);
  const b = addToPileAt(a, "5p", 0.1, 0.1, seeded(1), "change");
  assert.equal(b.change.length, 2);
  const uids = [...b.pile, ...b.change].map((e) => e.uid);
  assert.equal(new Set(uids).size, uids.length);
  assert.equal(removeFromPile(b, s.pile[0].uid), b);
  assert.equal(removeFromPile(b, s.pile[0].uid, "pile"), b);
  const r = removeFromPile(b, b.change[0].uid, "change");
  assert.equal(r.change.length, 1);
  assert.equal(r.pile, b.pile);
  assert.equal(clearPile(b), b);
  const c = clearPile(b, "change");
  assert.deepEqual(c.change, []);
  assert.equal(c.pile, b.pile);
});

test("move and settle work on either key", () => {
  const s = startGiveChange(createState(), NORMAL, seeded(11));
  const uid = s.pile[0].uid;
  const m = moveCoin(s, uid, 0.2, -0.2, "pile");
  const moved = m.pile.find((e) => e.uid === uid);
  assert.equal(moved.x, 0.2);
  assert.equal(moved.y, -0.2);
  const a = addToPile(s, "20p", seeded(1), "change");
  const cuid = a.change[0].uid;
  const m2 = moveCoin(a, cuid, 0.3, 0.3, "change");
  assert.equal(m2.change.find((e) => e.uid === cuid).x, 0.3);
  assert.equal(m2.pile, a.pile);
  assert.ok(Array.isArray(settleCoin(m2, cuid, null, "change").change));
  const g = moveGroup(m2, [cuid], 0.05, 0.05, "change");
  assert.equal(g.pile, m2.pile);
  assert.ok(Array.isArray(settleGroupCoins(g, [cuid], cuid, null, "change").change));
});

test("submitGiveChangeAnswer judges the change against what is due", () => {
  const base = { ...startGiveChange(createState(), NORMAL, seeded(1)), pile: pileOf("£2"), scenario: "over", price: 125 };
  // due is 75p
  const wrong = submitGiveChangeAnswer({ ...base, change: pileOf("50p") }, "check", 100);
  assert.equal(wrong.message.kind, "hint");
  assert.equal(wrong.pile, base.pile);
  assert.equal(wrong.solved, false);
  const wrong2 = submitGiveChangeAnswer(wrong, "check", 200);
  assert.notEqual(wrong2.message, wrong.message);
  assert.equal(wrong2.change, wrong.change);
  const right = submitGiveChangeAnswer({ ...base, change: pileOf("50p", "20p", "5p") }, "check", 300);
  assert.equal(right.solved, true);
  assert.equal(right.solvedAt, 300);
  assert.equal(right.rounds, 1);
  assert.equal(right.message.kind, "success");
  assert.equal(submitGiveChangeAnswer(right, "check", 400), right);
});

test("submitGiveChangeAnswer accepts none and short on matching scenarios", () => {
  const base = startGiveChange(createState(), NORMAL, seeded(1));
  const none = submitGiveChangeAnswer({ ...base, scenario: "exact", price: total(base.pile) }, "none", 1);
  assert.equal(none.solved, true);
  const short = submitGiveChangeAnswer({ ...base, scenario: "under", price: total(base.pile) + 10 }, "short", 1);
  assert.equal(short.solved, true);
  assert.equal(short.rounds, 1);
});

test("submitGiveChangeAnswer success messages are plain", () => {
  const base = startGiveChange(createState(), NORMAL, seeded(1));
  const check = submitGiveChangeAnswer(
    { ...base, pile: pileOf("£2", "£2", "£1"), scenario: "over", price: 235, change: pileOf("£2", "50p", "10p", "5p") }, "check", 1);
  assert.equal(check.message.text, "Correct! Change: £2.65.");
  assert.equal(check.message.kind, "success");
  const none = submitGiveChangeAnswer({ ...base, pile: pileOf("£1"), scenario: "exact", price: 100 }, "none", 1);
  assert.equal(none.message.text, "Correct! No change due.");
  const short = submitGiveChangeAnswer({ ...base, pile: pileOf("£1"), scenario: "under", price: 140 }, "short", 1);
  assert.equal(short.message.text, "Correct! They are £0.40 short.");
});

test("isContinuous is true for give-change mode", () => {
  assert.equal(isContinuous({ mode: "give-change" }), true);
});

// ---- per-pile heights in Give Change mode ----
import { pileHeightMm } from "../src/state.js";
import { CUSTOMER_BOX_MM, CHANGE_BOX_MM, heightForBox, placeHandfulCoin, settlePile } from "../src/game.js";

const CUSTOMER_H = heightForBox(CUSTOMER_BOX_MM);
const CHANGE_H = heightForBox(CHANGE_BOX_MM);
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const mmApart = (a, b, h) => Math.hypot((a.x - b.x) * PILE_WIDTH_MM, (a.y - b.y) * h);

// A dealt pile where no coin centre sits under a different-denomination coin (the settle rule's reach).
function differentCoinsApart(pile, h) {
  for (let i = 0; i < pile.length; i++) {
    for (let j = 0; j < i; j++) {
      const [a, b] = [pile[i], pile[j]];
      if (a.coinId === b.coinId) continue;
      const reach = Math.min(coinById(a.coinId).diameter, coinById(b.coinId).diameter) / 2;
      if (mmApart(a, b, h) < reach - 1e-9) return false;
    }
  }
  return true;
}

// The Cashier/Give Change deal replayed with an explicit height.
function dealAt(seed, h) {
  const rng = seeded(seed);
  let pile = [];
  randomHandful(rng).forEach((coinId, i) => {
    const entry = { uid: i + 1, coinId, ...placeHandfulCoin(pile, coinById(coinId), rng, h) };
    pile = settlePile([...pile, entry], entry.uid, null, h);
  });
  return pile;
}

test("pileHeightMm gives the short customer and change heights in Give Change only", () => {
  const giveChange = startGiveChange(createState(), NORMAL, seeded(1));
  near(pileHeightMm(giveChange), 11.6);
  near(pileHeightMm(giveChange, "pile"), 11.6);
  near(pileHeightMm(giveChange, "change"), 31.6);
  for (const s of [startCashier(createState(), seeded(1)), startGame(createState(), "endless", 100)]) {
    assert.equal(pileHeightMm(s), 90);
    assert.equal(pileHeightMm(s, "pile"), 90);
    assert.equal(pileHeightMm(s, "change"), 90);
  }
});

test("startGiveChange deals the customer's coins into the short play area", () => {
  let apart = 0;
  let full = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const s = startGiveChange(createState(), NORMAL, seeded(seed));
    if (s.pile.length === 12) full++;
    for (const e of s.pile) assert.ok(Math.abs(e.y) * CUSTOMER_H <= CUSTOMER_H / 2 + 1e-9);
    assert.deepEqual(s.pile, dealAt(seed, CUSTOMER_H));
    if (differentCoinsApart(s.pile, CUSTOMER_H)) apart++;
  }
  assert.ok(full > 0, "some deals are full 12-coin handfuls");
  assert.ok(apart >= 190, `different coins settled apart in ${apart} of 200 deals`);
});

test("startCashier and nextCustomer still deal at the 90 mm height", () => {
  for (let seed = 1; seed <= 20; seed++) {
    assert.deepEqual(startCashier(createState(), seeded(seed)).pile, dealAt(seed, PILE_HEIGHT_MM));
  }
  const first = startCashier(createState(), seeded(4));
  const next = nextCustomer(first, seeded(9));
  for (const e of next.pile) assert.ok(Math.abs(e.y) <= 0.5);
  assert.ok(differentCoinsApart(next.pile, PILE_HEIGHT_MM));
});

test("moveCoin and settleCoin on the Give Change customer pile push apart by the 11.6 mm amount", () => {
  // a pair 1 mm apart in y and 3 mm in x, so the push is mostly sideways and stays inside the short area
  const dx = 3 / PILE_WIDTH_MM;
  const dy = 1 / CUSTOMER_H;
  const base = startGiveChange(createState(), NORMAL, seeded(1));
  const s = { ...base, pile: [e(1, "20p", 0, 0), e(2, "1p", 0.3, 0.3)] };
  const moved = moveCoin(s, 2, dx, dy);
  const out = settleCoin(moved, 2, { x: 0.3, y: 0.3 });
  const want = PUSH_FACTOR * (coinById("20p").diameter + coinById("1p").diameter) / 2;
  near(mmApart(out.pile[0], out.pile[1], CUSTOMER_H), want, 1e-6);
  const group = settleGroupCoins({ ...s, pile: [e(1, "20p", 0, 0), e(2, "1p", dx, dy)] }, [2], 2, null);
  near(mmApart(group.pile[0], group.pile[1], CUSTOMER_H), want, 1e-6);
});

test("adding to the Give Change player's pile places and settles at 31.6 mm", () => {
  const base = { ...startGiveChange(createState(), NORMAL, seeded(1)), change: [e(1, "20p", 0.01, 0.02)], nextUid: 50 };
  const out = addToPile(base, "1p", seq([0.5, 0.5], 0.5), "change");
  const want = PUSH_FACTOR * (coinById("20p").diameter + coinById("1p").diameter) / 2;
  near(mmApart(out.change[0], out.change[1], CHANGE_H), want, 1e-6);
});

// ---- compact (screens under 700 px high): the player's pile drops to the 4 cm box too ----
import { CHANGE_BOX_COMPACT_MM } from "../src/game.js";

test("CHANGE_BOX_COMPACT_MM is the 4 cm box", () => {
  assert.equal(CHANGE_BOX_COMPACT_MM, 40);
});

test("pileHeightMm with compact gives 11.6 mm for both Give Change piles and 90 mm in other modes", () => {
  const giveChange = startGiveChange(createState(), NORMAL, seeded(1));
  near(pileHeightMm(giveChange, "pile", true), 11.6);
  near(pileHeightMm(giveChange, "change", true), 11.6);
  near(pileHeightMm(giveChange, "change", false), 31.6);
  for (const s of [startCashier(createState(), seeded(1)), startGame(createState(), "endless", 100), startGame(createState(), "custom", 100)]) {
    assert.equal(pileHeightMm(s, "pile", true), 90);
    assert.equal(pileHeightMm(s, "change", true), 90);
  }
});

test("addToPile, settleCoin and settleGroupCoins on the change pile use the compact height when asked", () => {
  const want = PUSH_FACTOR * (coinById("20p").diameter + coinById("1p").diameter) / 2;
  const base = { ...startGiveChange(createState(), NORMAL, seeded(1)), change: [e(1, "20p", 0.01, 0.02)], nextUid: 50 };
  const added = addToPile(base, "1p", seq([0.5, 0.5], 0.5), "change", true);
  near(mmApart(added.change[0], added.change[1], CUSTOMER_H), want, 1e-6);

  const dx = 3 / PILE_WIDTH_MM;
  const dy = 1 / CUSTOMER_H;
  const s = { ...base, change: [e(1, "20p", 0, 0), e(2, "1p", 0.3, 0.3)] };
  const out = settleCoin(moveCoin(s, 2, dx, dy, "change"), 2, { x: 0.3, y: 0.3 }, "change", true);
  near(mmApart(out.change[0], out.change[1], CUSTOMER_H), want, 1e-6);
  const group = settleGroupCoins({ ...s, change: [e(1, "20p", 0, 0), e(2, "1p", dx, dy)] }, [2], 2, null, "change", true);
  near(mmApart(group.change[0], group.change[1], CUSTOMER_H), want, 1e-6);
  // without the flag the same moves settle at 31.6 mm
  const tall = settleGroupCoins({ ...s, change: [e(1, "20p", 0, 0), e(2, "1p", dx, dy)] }, [2], 2, null, "change");
  assert.ok(Math.abs(mmApart(tall.change[0], tall.change[1], CUSTOMER_H) - want) > 1e-3);
});
