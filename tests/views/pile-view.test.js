import { test } from "node:test";
import assert from "node:assert/strict";
import { coinById } from "../../src/constants/coins.js";
import { coinLabel, layerOrder } from "../../src/views/pile-view.js";

test("coinLabel names removable coins by action and fixed coins by name", () => {
  assert.equal(coinLabel(coinById("20p"), true), "Remove 20p");
  assert.equal(coinLabel(coinById("20p"), false), "20p coin");
});

// The coins of the owner's first screenshot (docs/coin_game_comment/Attachments/image3.png) as pile fractions.
const IMAGE3 = [
  { uid: 1, coinId: "£2", x: -0.341, y: -0.273 }, { uid: 2, coinId: "10p", x: -0.185, y: -0.338 },
  { uid: 3, coinId: "£1", x: -0.034, y: -0.266 }, { uid: 4, coinId: "5p", x: -0.350, y: -0.050 },
  { uid: 5, coinId: "2p", x: -0.215, y: -0.050 }, { uid: 6, coinId: "20p", x: -0.062, y: -0.014 },
  { uid: 7, coinId: "50p", x: -0.308, y: 0.165 }, { uid: 8, coinId: "50p", x: -0.312, y: 0.170 },
  { uid: 9, coinId: "50p", x: -0.316, y: 0.175 }, { uid: 10, coinId: "1p", x: -0.138, y: 0.165 },
];
const over = (order, a, b) => order.findIndex((e) => e.uid === a) > order.findIndex((e) => e.uid === b);
const BAD_DEAL = [IMAGE3[6], IMAGE3[0], IMAGE3[9], IMAGE3[4], IMAGE3[2], IMAGE3[7], IMAGE3[1], IMAGE3[5], IMAGE3[8], IMAGE3[3]];

test("layerOrder puts the owner's wanted coins on top: £2 over 10p, 10p over £1, 5p over 2p, 2p over 20p, 2p over 50p, 50p over 1p", () => {
  const order = layerOrder(BAD_DEAL);
  for (const [a, b] of [[1, 2], [2, 3], [4, 5], [5, 6], [5, 7], [7, 10]]) assert.ok(over(order, a, b), `${a} over ${b}`);
});

test("layerOrder never lets a coin to the right or below sit over one up and to the left", () => {
  const order = layerOrder(BAD_DEAL);
  for (const a of IMAGE3) {
    for (const b of IMAGE3) {
      if (a !== b && a.x <= b.x && a.y <= b.y) assert.ok(over(order, a.uid, b.uid), `${a.uid} over ${b.uid}`);
    }
  }
});

test("layerOrder breaks ties by uid and does not change its input", () => {
  const input = [{ uid: 9, coinId: "1p", x: 0.1, y: 0.1 }, { uid: 4, coinId: "2p", x: 0.2, y: 0 }];
  const copy = [...input];
  assert.deepEqual(layerOrder(input).map((e) => e.uid), [4, 9]);
  assert.deepEqual(input, copy);
  assert.equal(input.length, 2);
});

test("layerOrder measures both axes in millimetres, so a short box weighs a step down less than a step right", () => {
  // In a 20 mm tall box, 0.1 right (11 mm) outweighs 0.4 up (8 mm): the right-hand coin goes underneath.
  const upLeft = { uid: 1, coinId: "1p", x: 0, y: 0 };
  const rightUp = { uid: 2, coinId: "2p", x: 0.1, y: -0.4 };
  assert.deepEqual(layerOrder([upLeft, rightUp], 20).map((e) => e.uid), [2, 1]);
  // In a 90 mm tall box the same two coins swap, because 0.4 up (36 mm) outweighs 0.1 right (11 mm).
  assert.deepEqual(layerOrder([upLeft, rightUp], 90).map((e) => e.uid), [1, 2]);
});
