import { test } from "node:test";
import assert from "node:assert/strict";
import { COINS } from "../src/coins.js";
import { arcLetters, fitFont, polygonPoints, reuleauxPath, shapeRadiusAt } from "../src/shapes.js";

const WIDTH = 92;
const R = WIDTH / 2 / Math.cos(Math.PI / 14);

function parse(d) {
  const nums = (s) => s.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const [mx, my] = nums(d.split(" ")[0]);
  const arcs = [...d.matchAll(/A(\d+(?:\.\d+)?),(\d+(?:\.\d+)?) (\d) (\d) (\d) (-?[\d.]+),(-?[\d.]+)/g)]
    .map((m) => ({ r: Number(m[1]), large: m[4], sweep: m[5], x: Number(m[6]), y: Number(m[7]) }));
  return { start: [mx, my], arcs };
}

test("reuleauxPath(7, 92) is a closed path of seven radius-92 arcs", () => {
  const d = reuleauxPath(7, WIDTH);
  assert.ok(d.startsWith("M") && d.endsWith("Z"));
  assert.equal((d.match(/A/g) ?? []).length, 7);
  const { arcs } = parse(d);
  assert.equal(arcs.length, 7);
  for (const a of arcs) assert.equal(a.r, WIDTH);
});

test("reuleauxPath vertices sit on the circumradius", () => {
  const { start, arcs } = parse(reuleauxPath(7, WIDTH));
  for (const [x, y] of [start, ...arcs.map((a) => [a.x, a.y])]) {
    assert.ok(Math.abs(Math.hypot(x - 50, y - 50) - R) < 0.01);
  }
});

test("reuleauxPath has constant width: opposite vertices are 92 apart", () => {
  const { start, arcs } = parse(reuleauxPath(7, WIDTH));
  const v = [start, ...arcs.slice(0, 6).map((a) => [a.x, a.y])];
  for (let k = 0; k < 7; k++) {
    const [ax, ay] = v[k];
    const [bx, by] = v[(k + 3) % 7];
    assert.ok(Math.abs(Math.hypot(ax - bx, ay - by) - WIDTH) < 0.01);
  }
});

test("reuleauxPath sides bulge outward (clockwise sweep flag 1)", () => {
  const { start, arcs } = parse(reuleauxPath(7, WIDTH));
  const v = [start, ...arcs.slice(0, 6).map((a) => [a.x, a.y])];
  v.push(start);
  for (let k = 0; k < 7; k++) {
    assert.equal(arcs[k].sweep, "1");
    const [ax, ay] = v[k], [bx, by] = v[k + 1];
    // arc centre is the opposite vertex
    const [cx, cy] = v[(k + 4) % 7];
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const len = Math.hypot(mx - cx, my - cy);
    const arcMid = [cx + ((mx - cx) / len) * WIDTH, cy + ((my - cy) / len) * WIDTH];
    assert.ok(Math.hypot(arcMid[0] - 50, arcMid[1] - 50) > Math.hypot(mx - 50, my - 50));
  }
});

test("arcLetters spreads letters symmetrically with a wider gap at spaces", () => {
  const letters = arcLetters("TEN PENCE", 42, 5);
  assert.equal(letters.length, 8);
  assert.equal(letters.map((l) => l.char).join(""), "TENPENCE");
  assert.ok(Math.abs(letters[0].angle + letters[7].angle) < 0.01);
  for (let i = 1; i < letters.length; i++) assert.ok(letters[i].angle > letters[i - 1].angle);
  const gap = (i) => letters[i + 1].angle - letters[i].angle;
  assert.ok(gap(2) > gap(0) + 0.01);
});

test("polygonPoints gives one pair per side", () => {
  assert.equal(polygonPoints(12, 46).split(" ").length, 12);
});

test("shapeRadiusAt is the radius everywhere on a circle", () => {
  for (const angle of [0, 17, 90, 200, 359]) assert.ok(Math.abs(shapeRadiusAt("round", 92, angle) - 46) < 1e-9);
});

test("shapeRadiusAt on a width-92 Reuleaux heptagon: vertex radius at a vertex, shortest at mid-arc", () => {
  assert.ok(Math.abs(shapeRadiusAt("heptagon", 92, 0) - 47.18) < 0.01);
  assert.ok(Math.abs(shapeRadiusAt("heptagon", 92, 360 / 7) - 47.18) < 0.01);
  assert.ok(Math.abs(shapeRadiusAt("heptagon", 92, 180 / 7) - 44.82) < 0.01);
  assert.ok(Math.abs(shapeRadiusAt("heptagon", 92, -180 / 7) - 44.82) < 0.01);
  assert.ok(Math.abs(shapeRadiusAt(7, 92, 400) - shapeRadiusAt("heptagon", 92, 40)) < 1e-9);
});

test("shapeRadiusAt on a 12-gon of width 92: 46 at a vertex, about 44.43 at a flat", () => {
  assert.ok(Math.abs(shapeRadiusAt("dodecagon", 92, 0) - 46) < 1e-9);
  assert.ok(Math.abs(shapeRadiusAt("dodecagon", 92, 15) - 44.43) < 0.01);
  assert.ok(Math.abs(shapeRadiusAt(12, 92, 45) - 44.43) < 0.01);
});

test("shapeRadiusAt scales with the width and agrees with the drawn path's vertices", () => {
  assert.ok(Math.abs(shapeRadiusAt("heptagon", 46, 0) - 47.18 / 2) < 0.01);
  const { start } = parse(reuleauxPath(7, 92));
  assert.ok(Math.abs(Math.hypot(start[0] - 50, start[1] - 50) - shapeRadiusAt("heptagon", 92, 0)) < 0.01);
});

test("shapeRadiusAt rejects an unknown shape", () => {
  assert.throws(() => shapeRadiusAt("pentagon", 92, 0));
});

test("fitFont makes the text span the asked angle unless the font cap is hit", () => {
  const spanDeg = (text, radius, font) => ((([...text].length - 1) * 0.7 * font) / radius) * (180 / Math.PI);
  for (const [text, radius] of [["TWENTY PENCE", 40], ["FIFTY PENCE", 38], ["TWO POUNDS", 41]]) {
    const font = fitFont(text, radius);
    assert.ok(font < 8.5, text);
    assert.ok(Math.abs(spanDeg(text, radius, font) - 72) < 0.01, text);
    assert.ok(Math.abs(spanDeg(text, radius, fitFont(text, radius, 60)) - 60) < 0.01, text);
  }
  // a short text would need a huge font: it is capped
  assert.equal(fitFont("TEN PENCE", 40), 8.5);
  assert.equal(fitFont("TEN PENCE", 40, 72, 6), 6);
});

test("arcLetters with at: 270 is centred on 270 and runs clockwise, not flipped", () => {
  const letters = arcLetters("ONE PENNY", 40, 7, 270, "outer");
  assert.equal(letters.length, 8);
  assert.ok(Math.abs((letters[0].angle + letters[7].angle) / 2 - 270) < 0.01);
  for (let i = 1; i < letters.length; i++) assert.ok(letters[i].angle > letters[i - 1].angle);
  assert.ok(letters.every((l) => l.flip === false));
});

test("upright letters run counter-clockwise from the largest angle so they read left to right along the bottom", () => {
  const letters = arcLetters("FIFTY PENCE", 40, 7, 180, "upright");
  assert.equal(letters.length, 10);
  assert.ok(Math.abs((letters[0].angle + letters[9].angle) / 2 - 180) < 0.01);
  assert.ok(letters[0].angle > letters[9].angle);
  for (let i = 1; i < letters.length; i++) assert.ok(letters[i].angle < letters[i - 1].angle);
  assert.ok(letters.every((l) => l.flip === true));
  // x = sin(angle) increases from the first letter to the last
  const xs = letters.map((l) => Math.sin((l.angle * Math.PI) / 180));
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1]);
});

test("arcLetters defaults keep the old behaviour (centred on the top, clockwise)", () => {
  const letters = arcLetters("TEN PENCE", 42, 5);
  assert.ok(Math.abs(letters[0].angle + letters[7].angle) < 0.01);
  assert.equal(letters[0].flip, false);
});

test("every arc coin's real text spans 60 to 80 degrees at a typical radius", () => {
  for (const coin of COINS.filter((c) => c.wording.flow !== "straight")) {
    const letters = arcLetters(coin.wording.text, 40, fitFont(coin.wording.text, 40), coin.wording.at, coin.wording.flow);
    const angles = letters.map((l) => l.angle);
    const span = Math.max(...angles) - Math.min(...angles);
    assert.ok(span >= 60 && span <= 80, `${coin.id} spans ${span.toFixed(1)}`);
  }
});
