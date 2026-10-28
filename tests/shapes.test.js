import { test } from "node:test";
import assert from "node:assert/strict";
import { arcLetters, polygonPoints, reuleauxPath } from "../src/shapes.js";

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
