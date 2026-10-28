import { test } from "node:test";
import assert from "node:assert/strict";
import { COINS, coinById } from "../src/coins.js";
import { coinLabel, coinSvg } from "../src/render.js";

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

test("20p and 50p are curved seven-sided paths and the £1 has 12 points", () => {
  for (const id of ["20p", "50p"]) {
    const svg = coinSvg(coinById(id));
    assert.ok(svg.includes("<path"), id);
    assert.ok(!svg.includes("<polygon"), id);
    assert.equal(count(svg, /A92,92 /g), 7, id);
  }
  assert.equal(pointPairs(coinSvg(coinById("£1"))), 12);
});

test("round coins use a circle and no polygon", () => {
  const svg = coinSvg(coinById("1p"));
  assert.ok(svg.includes("<circle"));
  assert.ok(!svg.includes("<polygon"));
});

const classCount = (svg, name) => count(svg, new RegExp(`class="[^"]*\\b${name}\\b`, "g"));

test("every coin face has a body, rim, shine and one word element per letter", () => {
  for (const coin of COINS) {
    const svg = coinSvg(coin);
    const letters = coin.wording.replaceAll(" ", "").length;
    assert.equal(classCount(svg, "coin-body"), 1, coin.id);
    assert.equal(classCount(svg, "coin-rim"), 1, coin.id);
    assert.equal(classCount(svg, "coin-shine"), 1, coin.id);
    assert.equal(classCount(svg, "coin-word"), letters, coin.id);
    assert.equal(classCount(svg, "coin-label"), 1, coin.id);
    assert.ok(svg.includes(`class="coin-label"`) && svg.includes(`>${coin.label}</text>`), coin.id);
    assert.equal(classCount(svg, "coin-disc"), coin.ring ? 1 : 0, coin.id);
  }
});

test("wording letters spell the wording and are never tagged coin-label", () => {
  for (const coin of COINS) {
    const svg = coinSvg(coin);
    const letters = [...svg.matchAll(/<text class="coin-word"[^>]*>(.)<\/text>/g)].map((m) => m[1]).join("");
    assert.equal(letters, coin.wording.replaceAll(" ", ""), coin.id);
  }
});

test("coin SVGs carry no id attribute, so clones and repeats cannot clash", () => {
  for (const coin of COINS) assert.ok(!/\sid=/.test(coinSvg(coin)), coin.id);
});

test("only the £1 and £2 draw an inner disc", () => {
  const shapes = (id) => classCount(coinSvg(coinById(id)), "coin-disc");
  assert.equal(shapes("£1"), 1);
  assert.equal(shapes("£2"), 1);
  assert.equal(shapes("10p"), 0);
});

test("the rim follows the body's shape", () => {
  assert.match(coinSvg(coinById("1p")), /<circle class="coin-rim"/);
  assert.match(coinSvg(coinById("20p")), /<path class="coin-rim"/);
  assert.match(coinSvg(coinById("£1")), /<polygon class="coin-rim"/);
});

test("every coin label is tagged so CSS can hide it", () => {
  for (const coin of COINS) {
    assert.ok(coinSvg(coin).includes('<text class="coin-label"'), coin.id);
  }
});

test("coinLabel names removable coins by action and fixed coins by name", () => {
  assert.equal(coinLabel(coinById("20p"), true), "Remove 20p");
  assert.equal(coinLabel(coinById("20p"), false), "20p coin");
});
