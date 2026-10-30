import { test } from "node:test";
import assert from "node:assert/strict";
import { COINS, coinById } from "../src/coins.js";
import {
  formatPence, total, check, summarisePile, describePile,
  parseAmount, randomTarget, MAX_CUSTOM_PENCE, MAX_RANDOM_PENCE,
} from "../src/game.js";
import {
  placeCoin, pileBox, clampPosition, PILE_WIDTH_MM, PILE_HEIGHT_MM, PILE_MARGIN_MM, CLUSTER_TRIES, MAX_PLACEMENT_TRIES,
} from "../src/game.js";
import {
  settlePile, settleGroup, unitUids, STACK_STEP_MM, STACK_LINK_MM, PUSH_FACTOR, MAX_SETTLE_PASSES, stackCounts, DETACH_NUDGE_MM, detachNudge,
} from "../src/game.js";
import {
  randomHandful, placeHandfulCoin, checkAnswer, MAX_HANDFUL, STACK_CHANCE,
} from "../src/game.js";
import { rollScenario, priceFor, changeDue, judgeAnswer } from "../src/game.js";
import { seeded, seq, pileOf } from "./pile-helper.js";

function approx(a, b, tol = 1e-9) {
  assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
}

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
  assert.deepEqual(COINS.filter((c) => c.discMetal).map((c) => c.id), ["£1", "£2"]);
});

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

test("pile constants match the spec", () => {
  assert.equal(PILE_WIDTH_MM, 110);
  assert.equal(PILE_HEIGHT_MM, 90);
  assert.equal(PILE_MARGIN_MM, 14.2);
  assert.equal(CLUSTER_TRIES, 20);
  assert.equal(MAX_PLACEMENT_TRIES, 60);
});

test("placeCoin on an empty pile uses the first draw", () => {
  assert.deepEqual(placeCoin([], coinById("1p"), seq([0.5, 0.5, 0.25])), { x: 0, y: 0, rot: 90 });
});

test("placeCoin clusters within ±0.35 and rot is 0..359", () => {
  const low = placeCoin([], coinById("1p"), () => 0);
  approx(low.x, -0.35);
  approx(low.y, -0.35);
  assert.equal(low.rot, 0);
  const high = placeCoin([], coinById("1p"), () => 0.999999);
  assert.ok(Math.abs(high.x) <= 0.35 && Math.abs(high.y) <= 0.35);
  assert.equal(high.rot, 359);
});

test("placeCoin re-draws when a candidate covers an existing centre", () => {
  const p = placeCoin([{ x: 0, y: 0 }], coinById("1p"), seq([0.5, 0.5, 0.9, 0.5, 0]));
  approx(p.x, 0.28);
  approx(p.y, 0);
  assert.equal(p.rot, 0);
});

test("after 20 clustered tries it widens to ±0.5", () => {
  const pile = [{ x: 0, y: 0 }, { x: 0.315, y: 0 }];
  const p = placeCoin(pile, coinById("£2"), seq([...Array(40).fill(0.5), 0.95, 0.5, 0]));
  approx(p.x, 0.45);
  approx(p.y, 0);
});

test("when no candidate is valid it returns the one with the greatest clearance", () => {
  const p = placeCoin([{ x: 0, y: 0 }], coinById("£2"), seq([0.5, 0.5, 0.564935, 0.5]));
  approx(p.x, 0.04545, 1e-5);
  approx(p.y, 0);
  assert.equal(p.rot, 180);
});

test("placeCoin is deterministic for the same rng sequence", () => {
  const build = () => {
    const rng = seeded(7);
    const pile = [];
    for (let i = 0; i < 10; i++) {
      const coin = COINS[Math.floor(rng() * COINS.length)];
      pile.push({ ...placeCoin(pile, coin, rng), coinId: coin.id });
    }
    return pile;
  };
  assert.deepEqual(build(), build());
});

test("no centre is ever covered by a later coin while there is room", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = seeded(seed);
    const rngPick = seeded(seed + 1000);
    const sets = [
      Array.from({ length: 20 }, () => coinById("£2")),
      Array.from({ length: 20 }, () => COINS[Math.floor(rngPick() * COINS.length)]),
    ];
    for (const coins of sets) {
      const pile = [];
      for (const coin of coins) pile.push(placeCoin(pile, coin, rng));
      for (let j = 0; j < pile.length; j++) {
        for (let i = 0; i < j; i++) {
          const d = Math.hypot((pile[i].x - pile[j].x) * PILE_WIDTH_MM, (pile[i].y - pile[j].y) * PILE_HEIGHT_MM);
          assert.ok(d >= coins[j].diameter / 2 - 1e-9, `seed ${seed} coins ${i},${j}: ${d}`);
        }
      }
    }
  }
});

test("pileBox maps the centre area into the visible box", () => {
  const c = pileBox({ x: 0, y: 0 });
  approx(c.left, 50);
  approx(c.top, 50);
  const lo = pileBox({ x: -0.5, y: -0.5 });
  approx(lo.left, 10.2601, 1e-4);
  approx(lo.top, 11.9932, 1e-4);
  const hi = pileBox({ x: 0.5, y: 0.5 });
  approx(hi.left, 100 - 10.2601, 1e-4);
  approx(hi.top, 100 - 11.9932, 1e-4);
});

test("clampPosition returns in-range positions unchanged", () => {
  assert.deepEqual(clampPosition(0.2, -0.3), { x: 0.2, y: -0.3 });
  assert.deepEqual(clampPosition(0.5, -0.5), { x: 0.5, y: -0.5 });
});

test("clampPosition clamps each axis independently to ±0.5", () => {
  assert.deepEqual(clampPosition(0.9, 0.1), { x: 0.5, y: 0.1 });
  assert.deepEqual(clampPosition(-2, -0.7), { x: -0.5, y: -0.5 });
});

test("clampPosition maps NaN to 0 and infinities to the limits", () => {
  assert.deepEqual(clampPosition(NaN, Infinity), { x: 0, y: 0.5 });
  assert.deepEqual(clampPosition(-Infinity, NaN), { x: -0.5, y: 0 });
});

const STEP_X = STACK_STEP_MM.x / PILE_WIDTH_MM;
const STEP_Y = STACK_STEP_MM.y / PILE_HEIGHT_MM;
const at = (uid, coinId, x, y, rot = 0) => ({ uid, coinId, x, y, rot });
const dist = (a, b) => Math.hypot((a.x - b.x) * PILE_WIDTH_MM, (a.y - b.y) * PILE_HEIGHT_MM);
const rad = (e) => coinById(e.coinId).diameter / 2;

test("settle constants", () => {
  assert.deepEqual(STACK_STEP_MM, { x: 1, y: -1 });
  assert.equal(STACK_LINK_MM, 3);
  assert.equal(PUSH_FACTOR, 0.75);
  assert.equal(MAX_SETTLE_PASSES, 8);
});

test("settlePile snaps a same-type coin onto the other", () => {
  const pile = [at(1, "20p", 0, 0, 40), at(2, "20p", 0.05, 0, 100)];
  const out = settlePile(pile, 2, null);
  assert.deepEqual(out[0], pile[0]);
  assert.ok(Math.abs(out[1].x - STEP_X) < 1e-9);
  assert.ok(Math.abs(out[1].y - STEP_Y) < 1e-9);
  assert.equal(out[1].rot, 40);
  assert.equal(pile[1].x, 0.05);
});

test("settlePile joins the latest too-close same-type coin", () => {
  const pile = [at(1, "20p", 0, 0, 40), at(2, "20p", STEP_X, STEP_Y, 40), at(3, "20p", 0.02, 0, 5)];
  const out = settlePile(pile, 3, null);
  assert.ok(Math.abs(out[2].x - 2 * STEP_X) < 1e-9);
  assert.ok(Math.abs(out[2].y - 2 * STEP_Y) < 1e-9);
  assert.equal(out[2].rot, 40);
});

test("settlePile returns the same array when nothing is too close", () => {
  const pile = [at(1, "20p", 0, 0), at(2, "20p", 0.2, 0)];
  assert.equal(settlePile(pile, 2, null), pile);
});

test("settlePile pushes different types apart equally along x", () => {
  const pile = [at(1, "20p", 0, 0), at(2, "50p", 0.05, 0)];
  const out = settlePile(pile, 2, null);
  assert.ok(Math.abs(dist(out[0], out[1]) - PUSH_FACTOR * (10.7 + 13.65)) < 1e-6);
  assert.ok(out[1].x > 0.05);
  assert.ok(out[0].x < 0);
  assert.ok(Math.abs((out[1].x - 0.05) + out[0].x) < 1e-9);
  assert.equal(out[0].y, 0);
  assert.equal(out[1].y, 0);
});

test("settlePile separates coincident different coins without NaN", () => {
  const pile = [at(1, "20p", 0, 0), at(2, "50p", 0, 0)];
  const out = settlePile(pile, 2, null);
  assert.ok(Math.abs(dist(out[0], out[1]) - PUSH_FACTOR * (10.7 + 13.65)) < 1e-6);
  assert.ok(out[1].x > out[0].x);
  for (const e of out) assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y));
});

test("settlePile moves a pushed stack as a unit", () => {
  const pile = [at(1, "20p", 0, 0), at(2, "20p", STEP_X, STEP_Y), at(3, "50p", 0.04, 0)];
  const out = settlePile(pile, 3, null);
  const d1 = { x: out[0].x - 0, y: out[0].y - 0 };
  const d2 = { x: out[1].x - STEP_X, y: out[1].y - STEP_Y };
  assert.ok(Math.abs(d1.x - d2.x) < 1e-9 && Math.abs(d1.y - d2.y) < 1e-9);
  assert.ok(d1.x < 0);
  assert.ok(Math.abs(dist(out[0], out[1]) - Math.hypot(STACK_STEP_MM.x, STACK_STEP_MM.y)) < 1e-9);
});

test("settlePile cascades pushes to a third coin", () => {
  const pile = [at(1, "1p", -0.2, 0), at(2, "20p", 0, 0), at(3, "50p", 0.05, 0)];
  const out = settlePile(pile, 3, null);
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      if (out[i].coinId === out[j].coinId) continue;
      assert.ok(dist(out[i], out[j]) >= Math.min(rad(out[i]), rad(out[j])), `${i}-${j}`);
    }
  }
  const line = [at(1, "1p", -0.09, 0), at(2, "20p", 0, 0), at(3, "50p", 0.05, 0)];
  const res = settlePile(line, 3, null);
  assert.notEqual(res[0].x, line[0].x);
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      assert.ok(dist(res[i], res[j]) >= Math.min(rad(res[i]), rad(res[j])), `${i}-${j}`);
    }
  }
});

test("settlePile caps passes on a crowded pile", () => {
  const ids = ["1p", "2p", "5p", "10p", "20p", "50p", "£1", "£2"];
  const pile = Array.from({ length: 20 }, (_, i) => at(i + 1, ids[i % ids.length], 0, 0));
  const out = settlePile(pile, 20, null);
  assert.deepEqual(out.map((e) => e.uid), pile.map((e) => e.uid));
  for (const e of out) assert.ok(Math.abs(e.x) <= 0.5 && Math.abs(e.y) <= 0.5);
});

test("settlePile does not react to moving away", () => {
  const pile = [at(1, "20p", 0, 0), at(2, "20p", 0.04, 0)];
  assert.equal(settlePile(pile, 2, { x: 0.01, y: 0 }), pile);
  const out = settlePile(pile, 2, { x: 0.2, y: 0 });
  assert.notEqual(out, pile);
  assert.ok(Math.abs(out[1].x - STEP_X) < 1e-9);
});

const ARROW_STEP = 0.02;
const ARROW_DIRS = { Left: [-1, 0], Right: [1, 0], Up: [0, -1], Down: [0, 1] };

function stackOf(n) {
  return Array.from({ length: n }, (_, i) => at(i + 1, "20p", i * STEP_X, i * STEP_Y, 40));
}

for (const n of [2, 3]) {
  for (const [name, [dx, dy]] of Object.entries(ARROW_DIRS)) {
    test(`settlePile lets an arrow step ${name} pull the top of a ${n}-stack out`, () => {
      const stack = stackOf(n);
      const top = stack[n - 1];
      const from = { x: top.x, y: top.y };
      const pile = stack.map((e) => (e === top ? { ...e, x: e.x + dx * ARROW_STEP, y: e.y + dy * ARROW_STEP } : e));
      assert.equal(settlePile(pile, top.uid, from), pile);
    });
  }
}

test("settlePile still snaps a coin dropped from far away onto a stack", () => {
  const pile = [...stackOf(3), at(4, "20p", 0.02, 0, 5)];
  const out = settlePile(pile, 4, { x: 0.3, y: 0.3 });
  assert.notEqual(out, pile);
  assert.ok(dist(out[3], out[2]) < 3);
  assert.equal(out[3].rot, 40);
});

test("settlePile pushes only when a different coin was approached, not moved away from", () => {
  const pile = [at(1, "20p", 0, 0), at(2, "50p", 0.04, 0)];
  assert.equal(settlePile(pile, 2, { x: 0.03, y: 0 }), pile);
  const out = settlePile(pile, 2, { x: 0.3, y: 0 });
  assert.notEqual(out, pile);
  assert.ok(dist(out[0], out[1]) > dist(pile[0], pile[1]));
});

test("settlePile keeps results inside the pile area", () => {
  const edge = [at(1, "20p", 0.5, 0.5), at(2, "20p", 0.49, 0.5)];
  for (const e of settlePile(edge, 2, null)) assert.ok(Math.abs(e.x) <= 0.5 && Math.abs(e.y) <= 0.5);
  const push = [at(1, "20p", 0.5, -0.5), at(2, "50p", 0.49, -0.5)];
  for (const e of settlePile(push, 2, null)) assert.ok(Math.abs(e.x) <= 0.5 && Math.abs(e.y) <= 0.5);
});

test("settlePile returns the same array for an unknown uid", () => {
  const pile = [at(1, "20p", 0, 0)];
  assert.equal(settlePile(pile, 9, null), pile);
});

test("settlePile preserves uids, coinIds and order", () => {
  const pile = [at(1, "20p", 0, 0), at(2, "50p", 0.03, 0), at(3, "20p", 0.01, 0)];
  const out = settlePile(pile, 3, null);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((e) => [e.uid, e.coinId]), pile.map((e) => [e.uid, e.coinId]));
  assert.equal(total(out), total(pile));
});

const SX = STACK_STEP_MM.x / PILE_WIDTH_MM;
const SY = STACK_STEP_MM.y / PILE_HEIGHT_MM;
const coinAt = (uid, coinId, x, y) => ({ uid, coinId, x, y, rot: 0 });

test("stackCounts is empty for an empty pile and for far-apart singles", () => {
  assert.equal(stackCounts([]).size, 0);
  const far = [coinAt(1, "20p", -0.4, -0.4), coinAt(2, "20p", 0, 0), coinAt(3, "20p", 0.4, 0.4)];
  assert.equal(stackCounts(far).size, 0);
});

test("stackCounts maps the last member of a two-coin stack to 2", () => {
  const m = stackCounts([coinAt(1, "20p", 0, 0), coinAt(2, "20p", SX, SY)]);
  assert.deepEqual([...m], [[2, 2]]);
});

test("stackCounts counts a chained stack of three once", () => {
  const m = stackCounts([coinAt(1, "20p", 0, 0), coinAt(2, "20p", SX, SY), coinAt(3, "20p", 2 * SX, 2 * SY)]);
  assert.deepEqual([...m], [[3, 3]]);
});

test("stackCounts follows draw order", () => {
  const m = stackCounts([coinAt(2, "20p", SX, SY), coinAt(1, "20p", 0, 0)]);
  assert.deepEqual([...m], [[1, 2]]);
});

test("stackCounts reports separate stacks separately", () => {
  const m = stackCounts([
    coinAt(1, "20p", -0.3, -0.3), coinAt(2, "20p", -0.3 + SX, -0.3 + SY),
    coinAt(3, "20p", 0.3, 0.3), coinAt(4, "20p", 0.3 + SX, 0.3 + SY),
  ]);
  assert.deepEqual([...m].sort(), [[2, 2], [4, 2]]);
});

test("stackCounts never counts different denominations together", () => {
  assert.equal(stackCounts([coinAt(1, "20p", 0, 0), coinAt(2, "50p", 0, 0)]).size, 0);
});

test("stackCounts ignores a different coin between layers in the array", () => {
  const m = stackCounts([coinAt(1, "20p", 0, 0), coinAt(2, "50p", 0.4, 0.4), coinAt(3, "20p", SX, SY)]);
  assert.deepEqual([...m], [[3, 2]]);
});

// ---- group logic ----
const stackAt = (uids, coinId, x, y, rot = 0) =>
  uids.map((uid, i) => at(uid, coinId, x + i * STEP_X, y + i * STEP_Y, rot));

test("unitUids returns the stack in draw order, [uid] for a lone coin, [] for unknown", () => {
  const pile = [...stackAt([1, 2, 3], "20p", 0, 0), at(7, "20p", 0.3, 0.3)];
  for (const uid of [1, 2, 3]) assert.deepEqual(unitUids(pile, uid), [1, 2, 3]);
  assert.deepEqual(unitUids(pile, 7), [7]);
  assert.deepEqual(unitUids(pile, 99), []);
  assert.deepEqual(unitUids([...pile].reverse(), 2), [3, 2, 1]);
});

test("the widened link distance keeps a stack linked with a layer removed", () => {
  const pile = stackAt([1, 2, 3], "20p", 0, 0);
  const gap = pile.filter((e) => e.uid !== 2);
  assert.ok(dist(gap[0], gap[1]) > 2.8 && dist(gap[0], gap[1]) < 2.9);
  assert.deepEqual(unitUids(gap, 1), [1, 3]);
  assert.equal(stackCounts(gap).get(3), 2);
  const four = stackAt([1, 2, 3, 4], "20p", 0, 0).filter((e) => e.uid !== 2);
  assert.equal(stackCounts(four).get(4), 3);
});

test("settleGroup re-lays a stack above a lone same-type coin", () => {
  const pile = [at(9, "20p", 0, 0, 77), ...stackAt([1, 2], "20p", 0.2, 0.2, 5)];
  const from = { x: 0.3, y: 0.3 };
  const group = pile.slice(1).map((e) => ({ ...e, x: e.x - 0.2, y: e.y - 0.2 }));
  const start = [pile[0], ...group];
  const out = settleGroup(start, [1, 2], 1, from);
  assert.deepEqual(out.map((e) => e.uid), [9, 1, 2]);
  assert.deepEqual(out.map((e) => e.coinId), ["20p", "20p", "20p"]);
  assert.deepEqual(out[0], pile[0]);
  for (const i of [1, 2]) {
    approx(out[i].x, i * STEP_X);
    approx(out[i].y, i * STEP_Y);
    assert.equal(out[i].rot, 77);
  }
  assert.equal(stackCounts(out).get(2), 3);
});

test("settleGroup lands above the top of an existing stack", () => {
  const base = stackAt([5, 6, 7], "20p", 0, 0, 40);
  const grp = stackAt([1, 2], "20p", 0.0, 0.0, 0).map((e) => ({ ...e, x: e.x + STEP_X * 0.3 }));
  const out = settleGroup([...base, ...grp], [1, 2], 1, { x: 0.4, y: 0.4 });
  const top = base[2];
  approx(out[3].x, top.x + STEP_X);
  approx(out[3].y, top.y + STEP_Y);
  approx(out[4].x, top.x + 2 * STEP_X);
  approx(out[4].y, top.y + 2 * STEP_Y);
  assert.equal(stackCounts(out).get(2), 5);
  const keys = new Set(out.map((e) => `${e.x.toFixed(9)},${e.y.toFixed(9)}`));
  assert.equal(keys.size, 5);
});

test("settleGroup pushes a different denomination away and keeps the group rigid", () => {
  const g1 = at(1, "20p", 0.01, 0.01);
  const g2 = at(2, "20p", 0.01 + STEP_X, 0.01 + STEP_Y);
  const far = at(4, "£2", 0.45, -0.45);
  const pile = [at(3, "50p", 0, 0), g1, g2, far];
  const out = settleGroup(pile, [1, 2], 1, { x: 0.3, y: 0.3 });
  const [o50, o1, o2, ofar] = out;
  approx(o2.x - o1.x, STEP_X, 1e-9);
  approx(o2.y - o1.y, STEP_Y, 1e-9);
  assert.notDeepEqual(o50, pile[0]);
  assert.ok(dist(o1, o50) >= PUSH_FACTOR * (rad(o1) + rad(o50)) - 1e-6);
  assert.deepEqual(ofar, far);
});

test("settleGroup does not re-lay when moving away, does when moving towards", () => {
  // about 5 mm apart: not linked, so only the direction check can decide
  const lone = at(9, "20p", 0, 0);
  const g = at(1, "20p", 0.05, 0);
  const pile = [lone, g];
  assert.equal(settleGroup(pile, [1], 1, { x: 0.04, y: 0 }), pile);
  const out = settleGroup(pile, [1], 1, { x: 0.3, y: 0 });
  assert.notEqual(out, pile);
  approx(out[1].x, STEP_X);
});

test("a same-type coin too close to the bottom of a stack snaps to the top of the unit", () => {
  const stack = stackAt([1, 2, 3], "20p", 0, 0, 40);
  const top = stack[2];
  const lone = at(9, "20p", -10.2 / PILE_WIDTH_MM, 0, 77);
  const pile = [...stack, lone];
  const out = settleGroup(pile, [9], 9, { x: -0.3, y: 0 });
  assert.notEqual(out, pile);
  const moved = out.find((e) => e.uid === 9);
  approx(moved.x, top.x + STEP_X);
  approx(moved.y, top.y + STEP_Y);
  assert.equal(moved.rot, 40);
  assert.equal(stackCounts(out).get(9), 4);
});

test("group members never react to each other, and a bad leader changes nothing", () => {
  const pile = stackAt([1, 2, 3], "20p", 0, 0);
  assert.equal(settleGroup(pile, [1, 2, 3], 1, { x: 0.3, y: 0.3 }), pile);
  assert.equal(settleGroup(pile, [1, 2], 3, { x: 0.3, y: 0.3 }), pile);
});

test("settleGroup pass cap: 20 mixed coins at one spot settle without throwing", () => {
  const ids = ["1p", "2p", "5p", "10p", "20p", "50p", "£1", "£2"];
  const pile = Array.from({ length: 20 }, (_, i) => at(i + 1, ids[i % 8], 0, 0));
  const out = settleGroup(pile, [1, 9], 1, null);
  assert.deepEqual(out.map((e) => e.uid), pile.map((e) => e.uid));
  for (const e of out) assert.ok(Math.abs(e.x) <= 0.5 && Math.abs(e.y) <= 0.5);
});

test("detachNudge moves +5 mm on both axes for a coin at negative x and y", () => {
  const r = detachNudge({ x: -0.2, y: -0.2 });
  approx(r.x, -0.2 + 5 / PILE_WIDTH_MM);
  approx(r.y, -0.2 + 5 / PILE_HEIGHT_MM);
});

test("detachNudge moves -5 mm on both axes for a coin at positive x and y", () => {
  const r = detachNudge({ x: 0.2, y: 0.3 });
  approx(r.x, 0.2 - 5 / PILE_WIDTH_MM);
  approx(r.y, 0.3 - 5 / PILE_HEIGHT_MM);
});

test("detachNudge treats exactly 0 as the positive direction", () => {
  const r = detachNudge({ x: 0, y: 0 });
  approx(r.x, 5 / PILE_WIDTH_MM);
  approx(r.y, 5 / PILE_HEIGHT_MM);
});

test("detachNudge keeps edge coins inside the pile", () => {
  const r = detachNudge({ x: 0.5, y: -0.5 });
  approx(r.x, 0.5 - 5 / PILE_WIDTH_MM);
  approx(r.y, -0.5 + 5 / PILE_HEIGHT_MM);
  for (const c of [{ x: -0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: -0.5, y: -0.5 }]) {
    const n = detachNudge(c);
    assert.ok(Math.abs(n.x) <= 0.5 && Math.abs(n.y) <= 0.5);
  }
});

test("detachNudge moves hypot(5, 5) mm when unclamped", () => {
  const from = { x: 0.1, y: -0.1 };
  const to = detachNudge(from);
  approx(Math.hypot((to.x - from.x) * PILE_WIDTH_MM, (to.y - from.y) * PILE_HEIGHT_MM),
    Math.hypot(DETACH_NUDGE_MM.x, DETACH_NUDGE_MM.y));
});

const sortedIds = (ids) => [...ids].sort().join(",");

test("randomHandful draws 2 to MAX_HANDFUL real coins", () => {
  assert.equal(randomHandful(() => 0).length, 2);
  assert.equal(randomHandful(() => 0.999999).length, MAX_HANDFUL);
  assert.equal(MAX_HANDFUL, 12);
  for (let s = 1; s <= 200; s++) {
    const ids = randomHandful(seeded(s));
    assert.ok(ids.length >= 2 && ids.length <= MAX_HANDFUL);
    for (const id of ids) assert.notEqual(coinById(id), undefined);
  }
});

test("randomHandful maps rng values onto COINS denominations", () => {
  const values = [0, 0.13, 0.5, 0.99];
  // count = 2 + floor(0.2 * 11) = 4
  const ids = randomHandful(seq([0.2, ...values]));
  assert.deepEqual(ids, values.map((r) => COINS[Math.floor(r * 8)].id));
});

test("randomHandful re-rolls once when it repeats the previous handful", () => {
  let checked = 0;
  for (let s = 1; s <= 200; s++) {
    const first = randomHandful(seeded(s));
    const rng = seeded(s);
    randomHandful(rng);
    const second = randomHandful(rng);
    if (sortedIds(first) === sortedIds(second)) continue;
    const prev = [...first].reverse();
    assert.deepEqual(randomHandful(seeded(s), prev), second);
    checked++;
  }
  assert.ok(checked > 0);
  assert.deepEqual(randomHandful(() => 0, ["1p", "1p"]), ["1p", "1p"]);
});

test("placeHandfulCoin stacks on a same-denomination coin when the chance draw hits", () => {
  const pile = pileOf("20p");
  const coin = coinById("20p");
  assert.ok(0.1 < STACK_CHANCE);
  const spot = placeHandfulCoin(pile, coin, seq([0.1, 0, 0.5]));
  assert.equal(spot.x, 0);
  assert.equal(spot.y, 0);
});

test("placeHandfulCoin falls through to placeCoin when the chance draw misses", () => {
  const pile = pileOf("20p");
  const coin = coinById("20p");
  const rest = [0.3, 0.6, 0.2, 0.7, 0.4];
  assert.deepEqual(
    placeHandfulCoin(pile, coin, seq([0.9, ...rest])),
    placeCoin(pile, coin, seq(rest)),
  );
});

test("placeHandfulCoin makes no extra draw without a same-denomination coin", () => {
  const coin = coinById("20p");
  for (const pile of [[], pileOf("1p", "£1")]) {
    const a = seq([0.3, 0.6, 0.2, 0.7]);
    const b = seq([0.3, 0.6, 0.2, 0.7]);
    assert.deepEqual(placeHandfulCoin(pile, coin, a), placeCoin(pile, coin, b));
    assert.equal(a(), b());
  }
});

test("placeHandfulCoin picks the same-denomination entry by index", () => {
  const pile = pileOf("20p", "20p");
  pile[0].x = -0.3; pile[0].y = -0.2;
  pile[1].x = 0.3; pile[1].y = 0.2;
  const coin = coinById("20p");
  assert.deepEqual(placeHandfulCoin(pile, coin, seq([0.1, 0, 0.5])), { x: -0.3, y: -0.2, rot: 180 });
  const second = placeHandfulCoin(pile, coin, seq([0.1, 0.99, 0.25]));
  assert.equal(second.x, 0.3);
  assert.equal(second.y, 0.2);
  assert.equal(second.rot, 90);
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

const ODDS = { underpaid: 0.25, exactShare: 1 / 3 };

test("rollScenario picks under, exact or over from the rng draws", () => {
  assert.equal(rollScenario(ODDS, seq([0.24])), "under");
  assert.equal(rollScenario(ODDS, seq([0.25, 0.32])), "exact");
  assert.equal(rollScenario(ODDS, seq([0.25, 0.34])), "over");
});

test("rollScenario never gives under when underpaid is 0", () => {
  assert.equal(rollScenario({ underpaid: 0, exactShare: 0.5 }, seq([0, 0.9])), "over");
  assert.notEqual(rollScenario({ underpaid: 0, exactShare: 0.5 }, seq([0, 0.1])), "under");
});

test("rollScenario turns over into exact when paid is under 2", () => {
  assert.equal(rollScenario(ODDS, seq([0.25, 0.34]), 1), "exact");
  assert.equal(rollScenario(ODDS, seq([0.25, 0.34]), 2), "over");
});

test("priceFor follows the scenario rule", () => {
  assert.equal(priceFor(500, "over", () => 0), 499);
  assert.equal(priceFor(500, "under", () => 0), 501);
  assert.equal(priceFor(500, "over", () => 0.999), 250);
  assert.equal(priceFor(500, "under", () => 0.999), 700);
  assert.equal(priceFor(500, "exact", () => 0.5), 500);
  assert.equal(priceFor(2, "over", () => 0.999), 1);
});

test("changeDue is the overpayment, never negative", () => {
  assert.equal(changeDue(500, 235), 265);
  assert.equal(changeDue(235, 500), 0);
});

test("judgeAnswer covers every action and scenario", () => {
  const ok = { correct: true, hint: "" };
  const bad = (hint) => ({ correct: false, hint });
  assert.deepEqual(judgeAnswer("over", "check", 265, 265), ok);
  assert.deepEqual(judgeAnswer("over", "check", 266, 265), bad("Too much change"));
  assert.deepEqual(judgeAnswer("over", "check", 264, 265), bad("Not enough change"));
  assert.deepEqual(judgeAnswer("over", "check", 0, 265), bad("Not enough change"));
  assert.deepEqual(judgeAnswer("exact", "check", 0, 0), bad("Does this customer need change?"));
  assert.deepEqual(judgeAnswer("under", "check", 0, 0), bad("Does this customer need change?"));
  assert.deepEqual(judgeAnswer("exact", "none", 0, 0), ok);
  assert.deepEqual(judgeAnswer("over", "none", 0, 265), bad("They overpaid, so you owe change"));
  assert.deepEqual(judgeAnswer("under", "none", 0, 0), bad("They have not paid enough yet"));
  assert.deepEqual(judgeAnswer("under", "short", 0, 0), ok);
  assert.deepEqual(judgeAnswer("exact", "short", 0, 0), bad("They paid enough"));
  assert.deepEqual(judgeAnswer("over", "short", 0, 265), bad("They paid enough"));
});

import { CUSTOMER_BOX_MM, CHANGE_BOX_MM, heightForBox } from "../src/game.js";

test("the box constants and heightForBox derive the play-area height from a box edge", () => {
  assert.equal(CUSTOMER_BOX_MM, 40);
  assert.equal(CHANGE_BOX_MM, 60);
  approx(heightForBox(CUSTOMER_BOX_MM), 11.6);
  approx(heightForBox(CHANGE_BOX_MM), 31.6);
  approx(heightForBox(CUSTOMER_BOX_MM) + 2 * PILE_MARGIN_MM, 40);
});

test("with no heightMm placeCoin, settlePile and pileBox equal the 90 mm results", () => {
  const coin = coinById("20p");
  const pile = pileOf("20p", "1p");
  assert.deepEqual(placeCoin(pile, coin, seeded(7)), placeCoin(pile, coin, seeded(7), PILE_HEIGHT_MM));
  const close = [{ uid: 1, coinId: "20p", x: 0, y: 0, rot: 0 }, { uid: 2, coinId: "1p", x: 0, y: 0.02, rot: 0 }];
  assert.deepEqual(settlePile(close, 2, null), settlePile(close, 2, null, PILE_HEIGHT_MM));
  assert.deepEqual(pileBox({ x: 0.1, y: -0.2 }), pileBox({ x: 0.1, y: -0.2 }, PILE_HEIGHT_MM));
});

test("placeCoin with a short height keeps every centre inside the play area", () => {
  const h = heightForBox(CUSTOMER_BOX_MM);
  for (const v of [0, 0.999]) {
    let pile = [];
    for (let i = 0; i < 200; i++) {
      const spot = placeCoin(pile, coinById("1p"), () => v, h);
      assert.ok(Math.abs(spot.y) <= 0.5);
      assert.ok(Math.abs(spot.y) * h <= h / 2);
      pile = i < 5 ? [...pile, { uid: i, coinId: "1p", ...spot }] : pile;
    }
  }
});

test("pileBox places the bottom of the play area at the box edge for a given height", () => {
  const h = heightForBox(CUSTOMER_BOX_MM);
  approx(h + 2 * PILE_MARGIN_MM, 40);
  approx(pileBox({ x: 0, y: 0.5 }, h).top, ((PILE_MARGIN_MM + 1 * h) / (h + 2 * PILE_MARGIN_MM)) * 100);
});

test("settlePile and detachNudge measure the y axis in the given height", () => {
  const h = heightForBox(CHANGE_BOX_MM);
  const pile = [{ uid: 1, coinId: "20p", x: 0, y: 0, rot: 0 }, { uid: 2, coinId: "1p", x: 0, y: 0.02, rot: 0 }];
  const out = settlePile(pile, 2, null, h);
  const want = PUSH_FACTOR * (coinById("20p").diameter / 2 + coinById("1p").diameter / 2);
  approx(Math.abs(out[1].y - out[0].y) * h, want, 1e-6);
  const n = detachNudge({ x: 0.2, y: -0.2 }, h);
  approx(n.y, -0.2 + DETACH_NUDGE_MM.y / h);
});

test("unitUids and stackCounts measure the link distance in the given height", () => {
  // 0.2 apart in y: 18 mm in a 90 mm area (separate), 2.32 mm in an 11.6 mm area (stacked)
  const h = heightForBox(CUSTOMER_BOX_MM);
  const pile = [coinAt(1, "20p", 0, 0), coinAt(2, "20p", 0, 0.2)];
  assert.deepEqual(unitUids(pile, 1), [1]);
  assert.deepEqual(unitUids(pile, 1, PILE_HEIGHT_MM), [1]);
  assert.deepEqual(unitUids(pile, 1, h), [1, 2]);
  assert.equal(stackCounts(pile).size, 0);
  assert.equal(stackCounts(pile, PILE_HEIGHT_MM).size, 0);
  assert.deepEqual([...stackCounts(pile, h)], [[2, 2]]);
});
