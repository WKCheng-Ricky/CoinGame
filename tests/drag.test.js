import { test } from "node:test";
import assert from "node:assert/strict";
import { PILE_WIDTH_MM, PILE_HEIGHT_MM, PILE_MARGIN_MM, pileBox } from "../src/game.js";
import { DRAG_THRESHOLD_PX, passesThreshold, toPileFraction, pointInRect, coinSizePx, DETACH_HOLD_MS, pixelsToFraction } from "../src/drag.js";
import { COINS } from "../src/coins.js";

function approx(a, b, tol = 1e-9) {
  assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
}

const W = PILE_WIDTH_MM + 2 * PILE_MARGIN_MM;
const H = PILE_HEIGHT_MM + 2 * PILE_MARGIN_MM;
const RECT = { left: 100, top: 50, width: W, height: H };

test("DRAG_THRESHOLD_PX is 6", () => {
  assert.equal(DRAG_THRESHOLD_PX, 6);
});

test("passesThreshold requires the distance to be strictly greater than the threshold", () => {
  assert.equal(passesThreshold(6, 0), false);
  assert.equal(passesThreshold(0, -6), false);
  assert.equal(passesThreshold(7, 0), true);
  assert.equal(passesThreshold(4, 4), false);
  assert.equal(passesThreshold(5, 5), true);
  assert.equal(passesThreshold(0, 0), false);
});

test("toPileFraction maps the rect centre to (0, 0)", () => {
  const p = toPileFraction({ x: RECT.left + W / 2, y: RECT.top + H / 2 }, RECT);
  assert.ok(Math.abs(p.x) < 1e-9);
  assert.ok(Math.abs(p.y) < 1e-9);
});

test("toPileFraction maps a point one margin in from the top-left to (-0.5, -0.5)", () => {
  const p = toPileFraction({ x: RECT.left + PILE_MARGIN_MM, y: RECT.top + PILE_MARGIN_MM }, RECT);
  approx(p.x, -0.5);
  approx(p.y, -0.5);
});

test("toPileFraction maps a point one margin in from the bottom-right to (0.5, 0.5)", () => {
  const p = toPileFraction({ x: RECT.left + W - PILE_MARGIN_MM, y: RECT.top + H - PILE_MARGIN_MM }, RECT);
  approx(p.x, 0.5);
  approx(p.y, 0.5);
});

test("toPileFraction is unclamped: the rect's own corner is beyond -0.5 on both axes", () => {
  const p = toPileFraction({ x: RECT.left, y: RECT.top }, RECT);
  assert.ok(p.x < -0.5);
  assert.ok(p.y < -0.5);
});

test("toPileFraction is unclamped: a far outside point gives values beyond ±0.5", () => {
  const p = toPileFraction({ x: RECT.left + 10 * W, y: RECT.top - 10 * H }, RECT);
  assert.ok(p.x > 0.5);
  assert.ok(p.y < -0.5);
});

test("toPileFraction inverts pileBox", () => {
  const original = { x: 0.3, y: -0.2 };
  const box = pileBox(original);
  const point = {
    x: RECT.left + (box.left / 100) * RECT.width,
    y: RECT.top + (box.top / 100) * RECT.height,
  };
  const back = toPileFraction(point, RECT);
  approx(back.x, original.x);
  approx(back.y, original.y);
});

test("pointInRect includes its edges and excludes points just outside", () => {
  const r = { left: 10, top: 20, width: 30, height: 40 };
  assert.equal(pointInRect({ x: 25, y: 40 }, r), true);
  for (const p of [{ x: 10, y: 40 }, { x: 40, y: 40 }, { x: 25, y: 20 }, { x: 25, y: 60 }]) {
    assert.equal(pointInRect(p, r), true);
  }
  for (const p of [{ x: 9.9, y: 40 }, { x: 40.1, y: 40 }, { x: 25, y: 19.9 }, { x: 25, y: 60.1 }]) {
    assert.equal(pointInRect(p, r), false);
  }
});

test("coinSizePx scales the diameter to the pile box width", () => {
  const rect = { width: 300 };
  const big = COINS.reduce((a, c) => (c.diameter > a.diameter ? c : a));
  const small = COINS.reduce((a, c) => (c.diameter < a.diameter ? c : a));
  for (const c of [big, small]) {
    approx(coinSizePx(c, rect), c.diameter / (110 + 2 * 14.2) * 300);
  }
  assert.ok(coinSizePx(big, rect) > coinSizePx(small, rect));
});

test("DETACH_HOLD_MS is 1 second", () => {
  assert.equal(DETACH_HOLD_MS, 1000);
});

test("pixelsToFraction maps zero to zero and matches toPileFraction differences", () => {
  const rect = { left: 10, top: 20, width: 400, height: 300 };
  assert.deepEqual(pixelsToFraction(0, 0, rect), { x: 0, y: 0 });
  for (const [dx, dy] of [[25, 10], [-40, -7], [13, -30]]) {
    const a = toPileFraction({ x: 100, y: 120 }, rect);
    const b = toPileFraction({ x: 100 + dx, y: 120 + dy }, rect);
    const f = pixelsToFraction(dx, dy, rect);
    approx(f.x, b.x - a.x);
    approx(f.y, b.y - a.y);
  }
  const sized = { left: 0, top: 0, width: W, height: H };
  approx(pixelsToFraction(PILE_WIDTH_MM, PILE_HEIGHT_MM, sized).x, 1);
  approx(pixelsToFraction(PILE_WIDTH_MM, PILE_HEIGHT_MM, sized).y, 1);
});

import { heightForBox, CUSTOMER_BOX_MM } from "../src/game.js";

test("toPileFraction and pixelsToFraction honour a custom height", () => {
  const h = heightForBox(CUSTOMER_BOX_MM);
  const rect = { left: 10, top: 20, width: W, height: h + 2 * PILE_MARGIN_MM };
  const p = toPileFraction({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, rect, h);
  approx(p.x, 0);
  approx(p.y, 0);
  approx(pixelsToFraction(0, rect.height, rect, h).y, (h + 2 * PILE_MARGIN_MM) / h);
});
