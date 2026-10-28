import { test } from "node:test";
import assert from "node:assert/strict";
import { COINS, coinById } from "../src/coins.js";
import { coinLabel, coinSvg, faceLayout } from "../src/render.js";
import { shapeRadiusAt } from "../src/shapes.js";

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

const isStraight = (coin) => coin.wording.flow === "straight";
const letterCount = (coin) => coin.wording.text.replaceAll(" ", "").length;

test("every coin face has a body, rim, shine and its wording elements", () => {
  for (const coin of COINS) {
    const svg = coinSvg(coin);
    assert.equal(classCount(svg, "coin-body"), 1, coin.id);
    assert.equal(classCount(svg, "coin-rim"), 1, coin.id);
    assert.equal(classCount(svg, "coin-shine"), 1, coin.id);
    // one text per letter on the arc coins, one straight line on the 5p
    assert.equal(classCount(svg, "coin-word"), isStraight(coin) ? 1 : letterCount(coin), coin.id);
    assert.equal(classCount(svg, "coin-label"), 1, coin.id);
    assert.ok(svg.includes(`class="coin-label"`) && svg.includes(`>${coin.label}</text>`), coin.id);
    assert.equal(classCount(svg, "coin-disc"), coin.ring ? 1 : 0, coin.id);
  }
});

test("wording letters spell the wording and are never tagged coin-label", () => {
  for (const coin of COINS) {
    const svg = coinSvg(coin);
    const words = [...svg.matchAll(/<text class="coin-word"[^>]*>([^<]+)<\/text>/g)].map((m) => m[1]);
    // upright letters are listed left to right and outer ones clockwise, which is reading order either way
    assert.equal(words.join(isStraight(coin) ? "" : ""), isStraight(coin) ? coin.wording.text : coin.wording.text.replaceAll(" ", ""), coin.id);
    assert.ok(!/class="coin-word[^"]*coin-label|class="coin-label[^"]*coin-word/.test(svg), coin.id);
  }
});

test("no coin uses textPath", () => {
  for (const coin of COINS) assert.ok(!coinSvg(coin).includes("textPath"), coin.id);
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

// Width of a drawn outline (circle, 12-gon or Reuleaux heptagon), read back from the markup.
function drawnWidth(svg, cls) {
  const circle = new RegExp(`<circle class="${cls}[^"]*"[^>]* r="([\\d.]+)"`).exec(svg);
  if (circle) return 2 * Number(circle[1]);
  const poly = new RegExp(`<polygon class="${cls}[^"]*"[^>]*points="([\\d.]+),([\\d.]+)`).exec(svg);
  if (poly) return 2 * (50 - Number(poly[2]));
  const path = new RegExp(`<path class="${cls}[^"]*"[^>]*d="M([\\d.]+),([\\d.]+)`).exec(svg);
  return 2 * (50 - Number(path[2])) * Math.cos(Math.PI / 14);
}

// Arc letters read back from the markup: radius of the letter's centre, its position angle, font size.
function arcLettersOf(svg, flow) {
  return [...svg.matchAll(/<text class="coin-word"[^>]* y="([\d.]+)"[^>]*rotate\((-?[\d.]+) 50 50\)[^>]*font-size="([\d.]+)"[^>]*>(.)<\/text>/g)].map((m) => {
    const y = Number(m[1]), rotate = Number(m[2]);
    return flow === "upright"
      ? { r: y - 50, angle: rotate - 180, rotate, size: Number(m[3]), char: m[4] }
      : { r: 50 - y, angle: rotate, rotate, size: Number(m[3]), char: m[4] };
  });
}

test("the rim line is 70 wide on every coin", () => {
  for (const coin of COINS) assert.ok(Math.abs(drawnWidth(coinSvg(coin), "coin-rim") - 70) < 0.1, coin.id);
});

test("every arc letter clears the rim line and the body edge by at least 0.5 units, at its own angle", () => {
  const deg = (r) => (r * 180) / Math.PI;
  for (const coin of COINS.filter((c) => !isStraight(c))) {
    const svg = coinSvg(coin);
    const rim = drawnWidth(svg, "coin-rim");
    const letters = arcLettersOf(svg, coin.wording.flow);
    assert.equal(letters.length, letterCount(coin), coin.id);
    let worstInner = Infinity, worstOuter = Infinity;
    for (const { r, angle, size } of letters) {
      assert.ok(size >= 3.5 && size <= 8.5 + 1e-9, `${coin.id} font ${size}`);
      // letters are vertically centred on their radius (dominant-baseline central)
      const cap = 0.72 * size, hw = 0.4 * size, near = r - cap / 2, far = r + cap / 2;
      for (const x of [-hw, -hw / 2, 0, hw / 2, hw]) {
        const inner = Math.hypot(near, x) - (shapeRadiusAt(coin.shape, rim, angle + deg(Math.atan2(x, near))) + 0.5);
        const outer = shapeRadiusAt(coin.shape, 92, angle + deg(Math.atan2(x, far))) - 1.5 - Math.hypot(far, x);
        worstInner = Math.min(worstInner, inner);
        worstOuter = Math.min(worstOuter, outer);
      }
    }
    assert.ok(worstInner >= 0.5, `${coin.id}: a letter is only ${worstInner.toFixed(2)} from the rim line`);
    assert.ok(worstOuter >= 0.5, `${coin.id}: a letter is only ${worstOuter.toFixed(2)} from the body edge`);
  }
});

test("arc wording is centred where the table says and spans 60 to 80 degrees", () => {
  for (const coin of COINS.filter((c) => !isStraight(c))) {
    const angles = arcLettersOf(coinSvg(coin), coin.wording.flow).map((l) => ((l.angle % 360) + 360) % 360);
    // unwrap around the wanted centre
    const unwrapped = angles.map((a) => a - 360 * Math.round((a - coin.wording.at) / 360));
    const span = Math.max(...unwrapped) - Math.min(...unwrapped);
    assert.ok(span >= 60 && span <= 80, `${coin.id} spans ${span.toFixed(1)}`);
    assert.ok(Math.abs((Math.max(...unwrapped) + Math.min(...unwrapped)) / 2 - coin.wording.at) < 0.5, coin.id);
  }
});

test("upright letters (50p, £1) carry a rotation of angle + 180 and read left to right", () => {
  for (const id of ["50p", "£1"]) {
    const letters = arcLettersOf(coinSvg(coinById(id)), "upright");
    for (const l of letters) assert.ok(Math.abs(l.rotate - (l.angle + 180)) < 1e-9, id);
    const xs = letters.map((l) => l.r * Math.sin((l.angle * Math.PI) / 180));
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1], `${id} letter ${i} is not to the right`);
    // placed below the centre, tops toward it
    assert.ok(/<text class="coin-word" x="50" y="(?:[5-9]\d(?:\.\d+)?)"/.test(coinSvg(coinById(id))), id);
  }
});

test("outer letters (everything else) sit above the centre, turned to their angle", () => {
  for (const id of ["1p", "2p", "10p", "20p", "£2"]) {
    const svg = coinSvg(coinById(id));
    for (const l of arcLettersOf(svg, "outer")) assert.ok(Math.abs(l.rotate - l.angle) < 1e-9, id);
    assert.ok(/<text class="coin-word" x="50" y="(?:[0-4]\d(?:\.\d+)?)"/.test(svg), id);
  }
});

test("the 5p has one straight wording line with a textLength, and its numeral sits clear below it", () => {
  const svg = coinSvg(coinById("5p"));
  const words = [...svg.matchAll(/<text class="coin-word"[^>]*>/g)];
  assert.equal(words.length, 1);
  assert.match(words[0][0], /textLength="\d+"/);
  assert.ok(!words[0][0].includes("rotate("));
  const wordSize = Number(/font-size="([\d.]+)"/.exec(words[0][0])[1]);
  const wordBottom = 50 + wordSize / 2; // em box, a safe overestimate of the glyph bottom
  const label = /<text class="coin-label" x="50" y="([\d.]+)"[^>]*font-size="([\d.]+)"/.exec(svg);
  assert.equal(Number(label[1]), 72);
  const numeralTop = 72 - (0.72 * Number(label[2])) / 2;
  assert.ok(numeralTop >= wordBottom + 2, `numeral top ${numeralTop} vs wording bottom ${wordBottom}`);
  // and the numeral stays inside the rim line: its lower corners and the descender of the p
  const size = Number(label[2]);
  const reach = (x, y) => Math.hypot(x, y - 50);
  assert.ok(reach(0.55 * size, 72 + 0.36 * size) < 34.5, "numeral corner reaches the rim line");
  assert.ok(reach(0.1 * size, 72 + 0.56 * size) < 34.5, "numeral descender reaches the rim line");
});

test("faceLayout gives arc coins a radius and font and the 5p none", () => {
  for (const coin of COINS) {
    const layout = faceLayout(coin);
    assert.equal(layout.rimWidth, 70, coin.id);
    if (isStraight(coin)) assert.equal(layout.font, undefined, coin.id);
    else assert.ok(layout.radius > 34 && layout.radius < 46 && layout.font >= 3.5, coin.id);
  }
});

test("the £1 and £2 inner disc still clears the rim line", () => {
  for (const id of ["£1", "£2"]) {
    const svg = coinSvg(coinById(id));
    const rim = drawnWidth(svg, "coin-rim");
    const minRim = shapeRadiusAt(coinById(id).shape, rim, id === "£1" ? 15 : 0);
    assert.ok(minRim - 0.5 >= 31 + 1, `${id} rim ${minRim}`);
  }
});

test("the body and the inner disc carry their metal class and no inline metal fill", () => {
  for (const coin of COINS) {
    const svg = coinSvg(coin);
    const body = /<(?:circle|path|polygon) class="([^"]*\bcoin-body\b[^"]*)"([^>]*)>/.exec(svg);
    assert.ok(body, coin.id);
    assert.ok(body[1].split(" ").includes(`metal-${coin.metal}`), `${coin.id} body class ${body[1]}`);
    assert.ok(!/\sfill="#/.test(body[2]), `${coin.id} body has an inline fill`);
    const disc = /<circle class="([^"]*\bcoin-disc\b[^"]*)"([^>]*)>/.exec(svg);
    if (coin.discMetal) {
      assert.ok(disc[1].split(" ").includes(`metal-${coin.discMetal}`), `${coin.id} disc class ${disc[1]}`);
      assert.ok(!/\sfill="#/.test(disc[2]), `${coin.id} disc has an inline fill`);
    } else {
      assert.equal(disc, null, coin.id);
    }
    assert.ok(!svg.includes(`fill="${coin.fill}"`), `${coin.id} writes the metal as an attribute`);
  }
});
