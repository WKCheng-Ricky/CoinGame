import { test } from "node:test";
import assert from "node:assert/strict";
import { COINS, coinById } from "../../src/constants/coins.js";
import { giveChangeOdds, randomHandful, rollScenario, priceFor, changeDue, judgeAnswer, MAX_HANDFUL } from "../../src/models/customer.js";
import { seeded, seq } from "../helpers/pile-helper.js";

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

const ODDS = { underpaid: 0.25, exactShare: 1 / 3 };

test("rollScenario underpays only when the first draw is below the 5% odds", () => {
  const five = { underpaid: 0.05, exactShare: 1 / 3 };
  assert.equal(rollScenario(five, seq([0.049])), "under");
  assert.equal(rollScenario(five, seq([0.05, 0.1])), "exact");
});

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
  // an empty Check means "No change"
  assert.deepEqual(judgeAnswer("exact", "check", 0, 0), ok);
  assert.deepEqual(judgeAnswer("under", "check", 0, 0), bad("They have not paid enough yet"));
  assert.deepEqual(judgeAnswer("exact", "check", 20, 0), bad("Does this customer need change?"));
  assert.deepEqual(judgeAnswer("under", "check", 20, 0), bad("Does this customer need change?"));
  assert.deepEqual(judgeAnswer("exact", "none", 0, 0), ok);
  assert.deepEqual(judgeAnswer("over", "none", 0, 265), bad("They overpaid, so you owe change"));
  assert.deepEqual(judgeAnswer("under", "none", 0, 0), bad("They have not paid enough yet"));
  assert.deepEqual(judgeAnswer("under", "short", 0, 0), ok);
  assert.deepEqual(judgeAnswer("exact", "short", 0, 0), bad("They paid enough"));
  assert.deepEqual(judgeAnswer("over", "short", 0, 265), bad("They paid enough"));
});

test("giveChangeOdds maps each choice to its percentage", () => {
  for (const [shortPay, underpaid] of [[0, 0], [1, 0.01], [5, 0.05], [10, 0.1], [25, 0.25]]) {
    assert.deepEqual(giveChangeOdds({ shortPay }), { underpaid, exactShare: 1 / 3 });
  }
});

test("giveChangeOdds gives 0 when shortPay is missing", () => {
  assert.deepEqual(giveChangeOdds({}), { underpaid: 0, exactShare: 1 / 3 });
});
