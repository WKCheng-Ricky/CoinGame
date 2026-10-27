import { test } from "node:test";
import assert from "node:assert/strict";
import { COINS, coinById } from "../src/coins.js";
import {
  formatPence, total, check, summarisePile, describePile,
  parseAmount, randomTarget, MAX_CUSTOM_PENCE, MAX_RANDOM_PENCE,
} from "../src/game.js";
import {
  placeCoin, pileBox, PILE_WIDTH_MM, PILE_HEIGHT_MM, PILE_MARGIN_MM, CLUSTER_TRIES, MAX_PLACEMENT_TRIES,
} from "../src/game.js";
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
  assert.deepEqual(COINS.filter((c) => c.ring).map((c) => c.id), ["£1", "£2"]);
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
