import { test } from "node:test";
import assert from "node:assert/strict";
import { COINS } from "../src/coins.js";

const DIAMETERS = { "1p": 20.3, "2p": 25.9, "5p": 18.0, "10p": 24.5, "20p": 21.4, "50p": 27.3, "£1": 23.43, "£2": 28.4 };
// Where the lettering sits, from the reference photos (degrees clockwise from the top).
const WORDING = {
  "1p": { text: "ONE PENNY", at: 270, flow: "outer" },
  "2p": { text: "TWO PENCE", at: 0, flow: "outer" },
  "5p": { text: "FIVE PENCE", flow: "straight" },
  "10p": { text: "TEN PENCE", at: 0, flow: "outer" },
  "20p": { text: "TWENTY PENCE", at: 90, flow: "outer" },
  "50p": { text: "FIFTY PENCE", at: 180, flow: "upright" },
  "£1": { text: "ONE POUND", at: 180, flow: "upright" },
  "£2": { text: "TWO POUNDS", at: 300, flow: "outer" },
};

test("coin diameters are the Royal Mint figures", () => {
  assert.deepEqual(Object.fromEntries(COINS.map((c) => [c.id, c.diameter])), DIAMETERS);
});

test("every coin has its wording data ({ text, at, flow }) and a light and dark shade", () => {
  assert.deepEqual(Object.fromEntries(COINS.map((c) => [c.id, c.wording])), WORDING);
  for (const coin of COINS) {
    assert.match(coin.shade.light, /^#[0-9a-f]{6}$/i, coin.id);
    assert.match(coin.shade.dark, /^#[0-9a-f]{6}$/i, coin.id);
    assert.notEqual(coin.shade.light, coin.shade.dark, coin.id);
  }
});

test("only the 5p moves its numeral off the centre, down to y = 72", () => {
  for (const coin of COINS) assert.equal(coin.numeralY, coin.id === "5p" ? 72 : undefined, coin.id);
});

test("every coin names its metal, and the £1 and £2 name the inner disc's metal; light fills are kept", () => {
  const METALS = { copper: "#b87333", silver: "#c9ccd1", gold: "#d4af37" };
  for (const coin of COINS) {
    assert.ok(coin.metal in METALS, `${coin.id} metal`);
    assert.equal(coin.fill, METALS[coin.metal], `${coin.id} light fill`);
    if (coin.ring) {
      assert.ok(coin.discMetal in METALS, `${coin.id} discMetal`);
      assert.equal(coin.ring, METALS[coin.discMetal], `${coin.id} light ring`);
      assert.notEqual(coin.discMetal, coin.metal, coin.id);
    } else {
      assert.equal(coin.discMetal, undefined, coin.id);
    }
  }
  assert.deepEqual(COINS.filter((c) => c.discMetal).map((c) => [c.id, c.metal, c.discMetal]), [["£1", "gold", "silver"], ["£2", "silver", "gold"]]);
});
