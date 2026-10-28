import { test } from "node:test";
import assert from "node:assert/strict";
import { COINS } from "../src/coins.js";

const DIAMETERS = { "1p": 20.3, "2p": 25.9, "5p": 18.0, "10p": 24.5, "20p": 21.4, "50p": 27.3, "£1": 23.43, "£2": 28.4 };
const WORDING = {
  "1p": "ONE PENNY", "2p": "TWO PENCE", "5p": "FIVE PENCE", "10p": "TEN PENCE",
  "20p": "TWENTY PENCE", "50p": "FIFTY PENCE", "£1": "ONE POUND", "£2": "TWO POUNDS",
};

test("coin diameters are the Royal Mint figures", () => {
  assert.deepEqual(Object.fromEntries(COINS.map((c) => [c.id, c.diameter])), DIAMETERS);
});

test("every coin has its wording and a light and dark shade", () => {
  assert.deepEqual(Object.fromEntries(COINS.map((c) => [c.id, c.wording])), WORDING);
  for (const coin of COINS) {
    assert.match(coin.shade.light, /^#[0-9a-f]{6}$/i, coin.id);
    assert.match(coin.shade.dark, /^#[0-9a-f]{6}$/i, coin.id);
    assert.notEqual(coin.shade.light, coin.shade.dark, coin.id);
  }
});
