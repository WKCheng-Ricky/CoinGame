import test from "node:test";
import assert from "node:assert/strict";
import { createScoreStore, boardId, rankText } from "../src/scores.js";

function fakeStorage() {
  const data = {};
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
  };
}

const throwing = {
  getItem() { throw new Error("blocked"); },
  setItem() { throw new Error("blocked"); },
  removeItem() { throw new Error("blocked"); },
};

const entry = (score) => ({ score, served: 1, at: "2026-10-31T00:00:00.000Z" });
const B = "endless:normal";

test("add returns the 1-based rank and list returns scores high to low", () => {
  const store = createScoreStore(fakeStorage());
  assert.equal(store.add(B, entry(10)), 1);
  assert.equal(store.add(B, entry(30)), 1);
  assert.equal(store.add(B, entry(20)), 2);
  assert.deepEqual(store.list(B).map((e) => e.score), [30, 20, 10]);
});

test("a tie ranks after the earlier equal score", () => {
  const store = createScoreStore(fakeStorage());
  const first = { score: 50, served: 1, at: "first" };
  const second = { score: 50, served: 2, at: "second" };
  assert.equal(store.add(B, first), 1);
  assert.equal(store.add(B, second), 2);
  assert.equal(store.list(B)[0].at, "first");
});

test("a board keeps only the top 10", () => {
  const store = createScoreStore(fakeStorage());
  for (let s = 10; s <= 110; s += 10) store.add(B, entry(s));
  const list = store.list(B);
  assert.equal(list.length, 10);
  assert.equal(list.at(-1).score, 20);
  assert.ok(!list.some((e) => e.score === 10));
  const before = JSON.stringify(list);
  assert.equal(store.add(B, entry(5)), null);
  assert.equal(store.add(B, entry(20)), null);
  assert.equal(JSON.stringify(store.list(B)), before);
});

test("boards are separate per boardId", () => {
  const store = createScoreStore(fakeStorage());
  store.add("endless:normal", entry(5));
  store.add("cashier:hard", entry(7));
  assert.deepEqual(store.list("endless:normal").map((e) => e.score), [5]);
  assert.deepEqual(store.list("cashier:hard").map((e) => e.score), [7]);
  assert.deepEqual(store.list("give-change:veryHard"), []);
});

test("a result survives a new store over the same storage", () => {
  const storage = fakeStorage();
  createScoreStore(storage).add(B, entry(42));
  assert.deepEqual(createScoreStore(storage).list(B).map((e) => e.score), [42]);
});

test("corrupt JSON, a non-object value and entries of the wrong shape give an empty board", () => {
  for (const bad of ["not json", "[]", JSON.stringify({ [B]: [{ score: "x" }] })]) {
    const storage = fakeStorage();
    storage.setItem("coin-counting-game-scores", bad);
    const store = createScoreStore(storage);
    assert.deepEqual(store.list(B), []);
    assert.equal(store.add(B, entry(9)), 1);
    assert.deepEqual(store.list(B).map((e) => e.score), [9]);
  }
});

test("a throwing or null storage never throws", () => {
  for (const storage of [throwing, null]) {
    const store = createScoreStore(storage);
    assert.deepEqual(store.list(B), []);
    assert.equal(store.add(B, entry(5)), 1);
    assert.doesNotThrow(() => store.clear());
  }
});

test("clear removes every board", () => {
  const store = createScoreStore(fakeStorage());
  store.add("endless:normal", entry(1));
  store.add("cashier:hard", entry(2));
  store.clear();
  assert.deepEqual(store.list("endless:normal"), []);
  assert.deepEqual(store.list("cashier:hard"), []);
});

test("rankText and boardId", () => {
  assert.equal(rankText(1, 5), "New best score!");
  assert.equal(rankText(3, 7), "Rank 3 of 7");
  assert.equal(rankText(null, 10), "Not in the top 10");
  assert.equal(boardId("give-change", "veryHard"), "give-change:veryHard");
});
