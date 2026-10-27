import { test } from "node:test";
import assert from "node:assert/strict";
import { COINS, coinById } from "../src/coins.js";
import { coinSvg } from "../src/render.js";

const count = (s, re) => (s.match(re) ?? []).length;
const pointPairs = (svg) => {
  const m = /<polygon[^>]*points="([^"]+)"/.exec(svg);
  return m[1].trim().split(/\s+/).length;
};

test("every coin renders an accessible-hidden svg with its label", () => {
  for (const coin of COINS) {
    const svg = coinSvg(coin);
    assert.ok(svg.startsWith("<svg"), coin.id);
    assert.ok(svg.includes('aria-hidden="true"'), coin.id);
    assert.ok(svg.includes(`>${coin.label}<`), coin.id);
  }
});

test("heptagon coins have 7 points and the £1 has 12", () => {
  assert.equal(pointPairs(coinSvg(coinById("20p"))), 7);
  assert.equal(pointPairs(coinSvg(coinById("50p"))), 7);
  assert.equal(pointPairs(coinSvg(coinById("£1"))), 12);
});

test("round coins use a circle and no polygon", () => {
  const svg = coinSvg(coinById("1p"));
  assert.ok(svg.includes("<circle"));
  assert.ok(!svg.includes("<polygon"));
});

test("ringed coins draw two shapes, plain coins draw one", () => {
  const shapes = (id) => count(coinSvg(coinById(id)), /<(circle|polygon)\b/g);
  assert.equal(shapes("£1"), 2);
  assert.equal(shapes("£2"), 2);
  assert.equal(shapes("10p"), 1);
});

test("every coin label is tagged so CSS can hide it", () => {
  for (const coin of COINS) {
    assert.ok(coinSvg(coin).includes('<text class="coin-label"'), coin.id);
  }
});
