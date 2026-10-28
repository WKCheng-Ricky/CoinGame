import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, pointer } from "./dom-helper.js";
import { createDrag, createTrayDrag, toPileFraction, pixelsToFraction } from "../src/drag.js";

const BOX = { left: 0, top: 0, width: 400, height: 300 };

function withDom(fn) {
  return async (t) => {
    const dom = installDom();
    try {
      await fn(t, dom);
    } finally {
      dom.teardown();
    }
  };
}

function stubRect(el, { left, top, width, height }) {
  el.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top });
}

// a 400x300 container at the origin; the padding rect equals the border box
function makeContainer(document) {
  const c = document.createElement("div");
  document.body.append(c);
  stubRect(c, BOX);
  for (const [k, v] of Object.entries({ clientLeft: 0, clientTop: 0, clientWidth: 400, clientHeight: 300 })) {
    Object.defineProperty(c, k, { value: v });
  }
  return c;
}

// a 40x40 coin whose centre is (cx, cy)
function addCoin(document, container, uid, cx, cy) {
  const el = document.createElement("button");
  el.dataset.uid = String(uid);
  stubRect(el, { left: cx - 20, top: cy - 20, width: 40, height: 40 });
  container.append(el);
  return el;
}

function setup(document, opts = {}) {
  const container = makeContainer(document);
  const calls = { move: [], group: [], start: [], detach: [], detachEnd: 0, release: [] };
  const drag = createDrag(container, {
    onMove: (...a) => calls.move.push(a),
    onMoveGroup: (...a) => calls.group.push(a),
    onDragStart: (el) => calls.start.push(el),
    onDetach: (uid) => calls.detach.push(uid),
    onDetachEnd: () => { calls.detachEnd += 1; },
    onDetachRelease: (uid) => calls.release.push(uid),
    isLocked: () => false,
    ...opts,
  });
  return { container, calls, drag };
}

const fire = (window, el, type, init) => el.dispatchEvent(pointer(window, type, init));

test("a pointer drag past the threshold calls onDragStart then onMove with fractions", withDom((t, { window, document }) => {
  const { container, calls } = setup(document);
  const coin = addCoin(document, container, 1, 120, 120);
  fire(window, coin, "pointerdown", { clientX: 110, clientY: 110 });
  fire(window, coin, "pointermove", { clientX: 210, clientY: 160 });
  assert.deepEqual(calls.start, [coin]);
  assert.equal(calls.move.length, 0);
  assert.ok(coin.classList.contains("dragging"));
  assert.equal(coin.style.getPropertyValue("--dx"), "100px");
  assert.equal(coin.style.getPropertyValue("--dy"), "50px");
  fire(window, coin, "pointerup", { clientX: 210, clientY: 160 });
  // the coin keeps its grab offset (+10, +10) from the pointer
  const { x, y } = toPileFraction({ x: 220, y: 170 }, BOX);
  assert.equal(calls.move.length, 1);
  assert.equal(calls.move[0][0], 1);
  assert.ok(Math.abs(calls.move[0][1] - x) < 1e-9);
  assert.ok(Math.abs(calls.move[0][2] - y) < 1e-9);
  assert.ok(!coin.classList.contains("dragging"));
  assert.equal(coin.style.getPropertyValue("--dx"), "");
}));

test("a release outside the container passes unclamped fractions to onMove", withDom((t, { window, document }) => {
  const { container, calls } = setup(document);
  const coin = addCoin(document, container, 1, 120, 120);
  fire(window, coin, "pointerdown", { clientX: 120, clientY: 120 });
  fire(window, coin, "pointermove", { clientX: 900, clientY: 120 });
  fire(window, coin, "pointerup", { clientX: 5000, clientY: 120 });
  assert.equal(calls.move.length, 1);
  assert.ok(Math.abs(calls.move[0][1]) > 0.5, `x was ${calls.move[0][1]}`);
}));

test("movement under the threshold is a tap: onMove not called and a following click is not suppressed", withDom((t, { window, document }) => {
  const { container, calls, drag } = setup(document);
  const coin = addCoin(document, container, 1, 120, 120);
  let clicked = 0;
  coin.addEventListener("click", () => { clicked += 1; });
  fire(window, coin, "pointerdown", { clientX: 120, clientY: 120 });
  fire(window, coin, "pointermove", { clientX: 123, clientY: 122 });
  fire(window, coin, "pointerup", { clientX: 123, clientY: 122 });
  coin.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  assert.equal(calls.move.length, 0);
  assert.equal(calls.start.length, 0);
  assert.equal(drag.suppressed(), false);
  assert.equal(clicked, 1);
}));

test("a click right after a real drag is suppressed", withDom((t, { window, document }) => {
  const { container, drag } = setup(document);
  const coin = addCoin(document, container, 1, 120, 120);
  let clicked = 0;
  coin.addEventListener("click", () => { clicked += 1; });
  fire(window, coin, "pointerdown", { clientX: 120, clientY: 120 });
  fire(window, coin, "pointermove", { clientX: 200, clientY: 120 });
  fire(window, coin, "pointerup", { clientX: 200, clientY: 120 });
  assert.equal(drag.suppressed(), true);
  coin.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  assert.equal(clicked, 0);
  assert.equal(drag.suppressed(), false);
}));

test("a second pointer during a drag is ignored", withDom((t, { window, document }) => {
  const { container, calls, drag } = setup(document);
  const a = addCoin(document, container, 1, 120, 120);
  const b = addCoin(document, container, 2, 300, 200);
  fire(window, a, "pointerdown", { pointerId: 1, clientX: 120, clientY: 120 });
  fire(window, a, "pointermove", { pointerId: 1, clientX: 200, clientY: 120 });
  assert.equal(drag.active(), true);
  fire(window, b, "pointerdown", { pointerId: 2, pointerType: "touch", isPrimary: false, clientX: 300, clientY: 200 });
  fire(window, b, "pointermove", { pointerId: 2, pointerType: "touch", isPrimary: false, clientX: 380, clientY: 200 });
  fire(window, b, "pointerup", { pointerId: 2, pointerType: "touch", isPrimary: false, clientX: 380, clientY: 200 });
  assert.equal(calls.move.length, 0);
  assert.equal(calls.start.length, 1);
  assert.ok(!b.classList.contains("dragging"));
  assert.equal(drag.active(), true);
  fire(window, a, "pointerup", { pointerId: 1, clientX: 200, clientY: 120 });
  assert.deepEqual(calls.move.map((m) => m[0]), [1]);
}));

test("isLocked() true blocks the pointerdown", withDom((t, { window, document }) => {
  const { container, calls, drag } = setup(document, { isLocked: () => true });
  const coin = addCoin(document, container, 1, 120, 120);
  fire(window, coin, "pointerdown", { clientX: 120, clientY: 120 });
  fire(window, coin, "pointermove", { clientX: 250, clientY: 120 });
  fire(window, coin, "pointerup", { clientX: 250, clientY: 120 });
  assert.equal(calls.start.length, 0);
  assert.equal(calls.move.length, 0);
  assert.equal(drag.active(), false);
}));

test("a pointermove that finds the game locked mid-drag snaps the coin back", withDom((t, { window, document }) => {
  let locked = false;
  const { container, calls, drag } = setup(document, { isLocked: () => locked });
  const coin = addCoin(document, container, 1, 120, 120);
  fire(window, coin, "pointerdown", { clientX: 120, clientY: 120 });
  fire(window, coin, "pointermove", { clientX: 200, clientY: 120 });
  assert.ok(coin.classList.contains("dragging"));
  locked = true;
  fire(window, coin, "pointermove", { clientX: 210, clientY: 120 });
  assert.ok(!coin.classList.contains("dragging"));
  assert.equal(drag.active(), false);
  fire(window, coin, "pointerup", { clientX: 210, clientY: 120 });
  assert.equal(calls.move.length, 0);
}));

test("a non-primary mouse button does not start a drag", withDom((t, { window, document }) => {
  const { container, calls, drag } = setup(document);
  const coin = addCoin(document, container, 1, 120, 120);
  fire(window, coin, "pointerdown", { button: 2, clientX: 120, clientY: 120 });
  fire(window, coin, "pointermove", { clientX: 250, clientY: 120 });
  fire(window, coin, "pointerup", { clientX: 250, clientY: 120 });
  assert.equal(calls.start.length, 0);
  assert.equal(calls.move.length, 0);
  assert.equal(drag.active(), false);
}));

test("a pointerdown away from any coin starts nothing", withDom((t, { window, document }) => {
  const { container, calls } = setup(document);
  addCoin(document, container, 1, 120, 120);
  fire(window, container, "pointerdown", { clientX: 300, clientY: 250 });
  fire(window, container, "pointermove", { clientX: 380, clientY: 250 });
  assert.equal(calls.start.length, 0);
}));

test("pointercancel restores the coin: dragging class and --dx/--dy removed", withDom((t, { window, document }) => {
  const { container, calls, drag } = setup(document);
  const coin = addCoin(document, container, 1, 120, 120);
  fire(window, coin, "pointerdown", { clientX: 120, clientY: 120 });
  fire(window, coin, "pointermove", { clientX: 200, clientY: 150 });
  assert.ok(coin.classList.contains("dragging"));
  assert.equal(coin.style.getPropertyValue("--dx"), "80px");
  fire(window, coin, "pointercancel", {});
  assert.ok(!coin.classList.contains("dragging"));
  assert.equal(coin.style.getPropertyValue("--dx"), "");
  assert.equal(coin.style.getPropertyValue("--dy"), "");
  assert.equal(drag.active(), false);
  fire(window, coin, "pointerup", { clientX: 200, clientY: 150 });
  assert.equal(calls.move.length, 0);
}));

test("a new primary touch replaces a lost touch's drag", withDom((t, { window, document }) => {
  const { container, calls } = setup(document);
  const a = addCoin(document, container, 1, 120, 120);
  const b = addCoin(document, container, 2, 300, 200);
  const touch = (id, init) => ({ pointerId: id, pointerType: "touch", isPrimary: true, ...init });
  fire(window, a, "pointerdown", touch(1, { clientX: 120, clientY: 120 }));
  fire(window, a, "pointermove", touch(1, { clientX: 200, clientY: 120 }));
  // finger 1's pointerup was lost; a fresh primary touch arrives
  fire(window, b, "pointerdown", touch(2, { clientX: 300, clientY: 200 }));
  assert.ok(!a.classList.contains("dragging"));
  fire(window, b, "pointermove", touch(2, { clientX: 340, clientY: 200 }));
  fire(window, b, "pointerup", touch(2, { clientX: 340, clientY: 200 }));
  assert.deepEqual(calls.move.map((m) => m[0]), [2]);
}));

test("holding a stack member for holdMs fires onDetach once; releasing without moving fires onDetachRelease", withDom((t, { window, document }) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { container, calls } = setup(document, { holdMs: 50, getGroup: () => [1, 2] });
  const a = addCoin(document, container, 1, 120, 120);
  addCoin(document, container, 2, 125, 125);
  fire(window, a, "pointerdown", { clientX: 120, clientY: 120 });
  t.mock.timers.tick(49);
  assert.deepEqual(calls.detach, []);
  t.mock.timers.tick(1);
  assert.deepEqual(calls.detach, [1]);
  assert.ok(a.classList.contains("detached"));
  t.mock.timers.tick(500);
  assert.deepEqual(calls.detach, [1]);
  fire(window, a, "pointerup", { clientX: 120, clientY: 120 });
  assert.deepEqual(calls.release, [1]);
  assert.equal(calls.detachEnd, 1);
  assert.ok(!a.classList.contains("detached"));
  assert.equal(calls.move.length, 0);
  assert.equal(calls.group.length, 0);
}));

test("releasing a stack member before holdMs neither detaches nor releases", withDom((t, { window, document }) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { container, calls } = setup(document, { holdMs: 50, getGroup: () => [1, 2] });
  const a = addCoin(document, container, 1, 120, 120);
  addCoin(document, container, 2, 125, 125);
  fire(window, a, "pointerdown", { clientX: 120, clientY: 120 });
  t.mock.timers.tick(20);
  fire(window, a, "pointerup", { clientX: 120, clientY: 120 });
  t.mock.timers.tick(200);
  assert.deepEqual(calls.detach, []);
  assert.deepEqual(calls.release, []);
}));

test("dragging a held (detached) stack member moves only that coin", withDom((t, { window, document }) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { container, calls } = setup(document, { holdMs: 50, getGroup: () => [1, 2] });
  const a = addCoin(document, container, 1, 120, 120);
  const b = addCoin(document, container, 2, 125, 125);
  fire(window, a, "pointerdown", { clientX: 120, clientY: 120 });
  t.mock.timers.tick(50);
  fire(window, a, "pointermove", { clientX: 220, clientY: 120 });
  assert.ok(a.classList.contains("dragging"));
  assert.ok(!b.classList.contains("dragging"));
  fire(window, a, "pointerup", { clientX: 220, clientY: 120 });
  assert.deepEqual(calls.move.map((m) => m[0]), [1]);
  assert.equal(calls.group.length, 0);
  assert.equal(calls.release.length, 0);
  assert.equal(calls.detachEnd, 1);
}));

test("a second pointer before the hold completes cancels the pending detach", withDom((t, { window, document }) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { container, calls } = setup(document, { holdMs: 50, getGroup: () => [1, 2] });
  const a = addCoin(document, container, 1, 120, 120);
  addCoin(document, container, 2, 125, 125);
  fire(window, a, "pointerdown", { pointerId: 1, clientX: 120, clientY: 120 });
  fire(window, a, "pointerdown", { pointerId: 2, pointerType: "touch", isPrimary: false, clientX: 130, clientY: 130 });
  t.mock.timers.tick(100);
  assert.deepEqual(calls.detach, []);
}));

test("a group drag fires onMoveGroup with the pixel delta as a fraction", withDom((t, { window, document }) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { container, calls } = setup(document, { holdMs: 50, getGroup: () => [1, 2] });
  const a = addCoin(document, container, 1, 120, 120);
  const b = addCoin(document, container, 2, 125, 125);
  fire(window, a, "pointerdown", { clientX: 120, clientY: 120 });
  fire(window, a, "pointermove", { clientX: 160, clientY: 150 });
  for (const m of [a, b]) {
    assert.ok(m.classList.contains("dragging"));
    assert.equal(m.style.getPropertyValue("--dx"), "40px");
    assert.equal(m.style.getPropertyValue("--dy"), "30px");
  }
  t.mock.timers.tick(200); // the hold was cancelled by the drag
  assert.deepEqual(calls.detach, []);
  fire(window, a, "pointerup", { clientX: 160, clientY: 150 });
  const d = pixelsToFraction(40, 30, BOX);
  assert.equal(calls.group.length, 1);
  const [uids, dx, dy, leader] = calls.group[0];
  assert.deepEqual(uids, [1, 2]);
  assert.ok(Math.abs(dx - d.x) < 1e-9);
  assert.ok(Math.abs(dy - d.y) < 1e-9);
  assert.equal(leader, 1);
  assert.equal(calls.move.length, 0);
  assert.ok(!b.classList.contains("dragging"));
}));

test("removing the dragged coin mid-drag lets a new pointerdown start a fresh drag", withDom((t, { window, document }) => {
  const { container, calls } = setup(document);
  const a = addCoin(document, container, 1, 120, 120);
  const b = addCoin(document, container, 2, 300, 200);
  fire(window, a, "pointerdown", { pointerId: 1, clientX: 120, clientY: 120 });
  fire(window, a, "pointermove", { pointerId: 1, clientX: 200, clientY: 120 });
  a.remove();
  fire(window, b, "pointerdown", { pointerId: 2, pointerType: "touch", isPrimary: false, clientX: 300, clientY: 200 });
  fire(window, b, "pointermove", { pointerId: 2, pointerType: "touch", isPrimary: false, clientX: 360, clientY: 200 });
  fire(window, b, "pointerup", { pointerId: 2, pointerType: "touch", isPrimary: false, clientX: 360, clientY: 200 });
  assert.deepEqual(calls.move.map((m) => m[0]), [2]);
}));

function setupTray(document) {
  const container = document.createElement("div");
  const coin = document.createElement("button");
  coin.dataset.coin = "20p";
  coin.innerHTML = "<svg></svg>";
  container.append(coin);
  const board = document.createElement("div");
  board.className = "board";
  const pileEl = document.createElement("div");
  board.append(container, pileEl);
  document.body.append(board);
  stubRect(pileEl, BOX);
  for (const [k, v] of Object.entries({ clientLeft: 0, clientTop: 0, clientWidth: 400, clientHeight: 300 })) {
    Object.defineProperty(pileEl, k, { value: v });
  }
  const calls = { drop: [], start: [] };
  const drag = createTrayDrag(container, {
    onDrop: (...a) => calls.drop.push(a),
    onDragStart: (el) => calls.start.push(el),
    isLocked: () => false,
    pileEl,
  });
  return { container, coin, pileEl, board, calls, drag };
}

test("createTrayDrag calls onDrop only when released inside pileEl", withDom((t, { window, document }) => {
  const { coin, pileEl, board, calls } = setupTray(document);
  fire(window, coin, "pointerdown", { clientX: 500, clientY: 400 });
  fire(window, coin, "pointermove", { clientX: 300, clientY: 150 });
  assert.deepEqual(calls.start, [coin]);
  assert.ok(coin.classList.contains("dragging-source"));
  assert.ok(pileEl.classList.contains("over-pile"));
  assert.equal(board.querySelectorAll(".tray-ghost").length, 1);
  fire(window, coin, "pointerup", { clientX: 300, clientY: 150 });
  const { x, y } = toPileFraction({ x: 300, y: 150 }, BOX);
  assert.equal(calls.drop.length, 1);
  assert.equal(calls.drop[0][0], "20p");
  assert.ok(Math.abs(calls.drop[0][1] - x) < 1e-9);
  assert.ok(Math.abs(calls.drop[0][2] - y) < 1e-9);
  assert.equal(board.querySelectorAll(".tray-ghost").length, 0);
  assert.ok(!coin.classList.contains("dragging-source"));
  assert.ok(!pileEl.classList.contains("over-pile"));
}));

test("createTrayDrag does not call onDrop when released outside", withDom((t, { window, document }) => {
  const { coin, pileEl, board, calls } = setupTray(document);
  fire(window, coin, "pointerdown", { clientX: 500, clientY: 400 });
  fire(window, coin, "pointermove", { clientX: 450, clientY: 350 });
  assert.ok(!pileEl.classList.contains("over-pile"));
  fire(window, coin, "pointerup", { clientX: 450, clientY: 350 });
  assert.equal(calls.start.length, 1);
  assert.equal(calls.drop.length, 0);
  assert.equal(board.querySelectorAll(".tray-ghost").length, 0);
  assert.ok(!coin.classList.contains("dragging-source"));
}));

test("createTrayDrag: a tap under the threshold drops nothing and pointercancel cleans up the ghost", withDom((t, { window, document }) => {
  const { coin, board, calls, drag } = setupTray(document);
  fire(window, coin, "pointerdown", { clientX: 500, clientY: 400 });
  fire(window, coin, "pointermove", { clientX: 502, clientY: 401 });
  fire(window, coin, "pointerup", { clientX: 502, clientY: 401 });
  assert.equal(calls.start.length, 0);
  assert.equal(drag.suppressed(), false);
  fire(window, coin, "pointerdown", { clientX: 500, clientY: 400 });
  fire(window, coin, "pointermove", { clientX: 300, clientY: 150 });
  assert.equal(drag.active(), true);
  fire(window, coin, "pointercancel", {});
  assert.equal(drag.active(), false);
  assert.equal(board.querySelectorAll(".tray-ghost").length, 0);
  assert.equal(calls.drop.length, 0);
}));

const keydown = (window, el) => el.dispatchEvent(new window.KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" }));
const click = (window, el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));

test("a key press after a drag clears the suppression so the next click goes through", withDom((t, { window, document }) => {
  const { container, drag } = setup(document);
  const coin = addCoin(document, container, 1, 120, 120);
  let clicked = 0;
  coin.addEventListener("click", () => { clicked += 1; });
  fire(window, coin, "pointerdown", { clientX: 120, clientY: 120 });
  fire(window, coin, "pointermove", { clientX: 200, clientY: 120 });
  fire(window, coin, "pointerup", { clientX: 200, clientY: 120 });
  assert.equal(drag.suppressed(), true);
  keydown(window, coin);
  assert.equal(drag.suppressed(), false);
  click(window, coin);
  assert.equal(clicked, 1);
}));

test("a key press during a drag does not clear the suppression", withDom((t, { window, document }) => {
  const { container, drag } = setup(document);
  const coin = addCoin(document, container, 1, 120, 120);
  let clicked = 0;
  coin.addEventListener("click", () => { clicked += 1; });
  fire(window, coin, "pointerdown", { clientX: 120, clientY: 120 });
  fire(window, coin, "pointermove", { clientX: 200, clientY: 120 });
  assert.equal(drag.active(), true);
  keydown(window, coin);
  assert.equal(drag.suppressed(), true);
  fire(window, coin, "pointerup", { clientX: 200, clientY: 120 });
  click(window, coin);
  assert.equal(clicked, 0);
  assert.equal(drag.suppressed(), false);
}));

test("createTrayDrag swallows the click that follows a drag, then lets the next one through", withDom((t, { window, document }) => {
  const { coin, drag } = setupTray(document);
  let clicked = 0;
  coin.addEventListener("click", () => { clicked += 1; });
  fire(window, coin, "pointerdown", { clientX: 500, clientY: 400 });
  fire(window, coin, "pointermove", { clientX: 300, clientY: 150 });
  fire(window, coin, "pointerup", { clientX: 300, clientY: 150 });
  assert.equal(drag.suppressed(), true);
  click(window, coin);
  assert.equal(clicked, 0);
  assert.equal(drag.suppressed(), false);
  click(window, coin);
  assert.equal(clicked, 1);
}));

test("createTrayDrag: a key press after a drag clears the suppression", withDom((t, { window, document }) => {
  const { coin, drag } = setupTray(document);
  let clicked = 0;
  coin.addEventListener("click", () => { clicked += 1; });
  fire(window, coin, "pointerdown", { clientX: 500, clientY: 400 });
  fire(window, coin, "pointermove", { clientX: 300, clientY: 150 });
  fire(window, coin, "pointerup", { clientX: 300, clientY: 150 });
  assert.equal(drag.suppressed(), true);
  keydown(window, coin);
  assert.equal(drag.suppressed(), false);
  click(window, coin);
  assert.equal(clicked, 1);
}));
