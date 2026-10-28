import { test } from "node:test";
import assert from "node:assert/strict";
import { DWELL_MS, createDwell } from "../src/dwell.js";

function fakeTimers() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimer(fn, ms) {
      const id = nextId++;
      timers.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimer(id) { timers.delete(id); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let due = null;
        for (const [id, t] of timers) {
          if (t.at <= end && (due === null || t.at < due[1].at)) due = [id, t];
        }
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
  };
}

function setup(options = {}) {
  const calls = [];
  const timers = fakeTimers();
  const dwell = createDwell({
    onReveal: (key) => calls.push(`reveal:${key}`),
    onHide: (key) => calls.push(`hide:${key}`),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    ...options,
  });
  return { calls, timers, dwell };
}

test("DWELL_MS is 2000 and is the default delay", () => {
  assert.equal(DWELL_MS, 2000);
  const { calls, timers, dwell } = setup();
  dwell.start("a");
  timers.advance(1999);
  assert.deepEqual(calls, []);
  timers.advance(1);
  assert.deepEqual(calls, ["reveal:a"]);
});

test("reveals only after the delay", () => {
  const { calls, timers, dwell } = setup({ delay: 500 });
  dwell.start("a");
  timers.advance(499);
  assert.deepEqual(calls, []);
  timers.advance(1);
  assert.deepEqual(calls, ["reveal:a"]);
});

test("stop before the delay cancels it: no reveal, no hide", () => {
  const { calls, timers, dwell } = setup();
  dwell.start("a");
  timers.advance(1000);
  dwell.stop("a");
  timers.advance(5000);
  assert.deepEqual(calls, []);
});

test("stop after reveal hides exactly once", () => {
  const { calls, timers, dwell } = setup();
  dwell.start("a");
  timers.advance(DWELL_MS);
  dwell.stop("a");
  dwell.stop("a");
  assert.deepEqual(calls, ["reveal:a", "hide:a"]);
});

test("start while pending or revealed does not schedule twice", () => {
  const { calls, timers, dwell } = setup();
  dwell.start("a");
  dwell.start("a");
  timers.advance(DWELL_MS);
  dwell.start("a");
  timers.advance(DWELL_MS * 3);
  assert.deepEqual(calls, ["reveal:a"]);
});

test("keys are independent", () => {
  const { calls, timers, dwell } = setup();
  dwell.start("a");
  timers.advance(1000);
  dwell.start("b");
  timers.advance(1000);
  assert.deepEqual(calls, ["reveal:a"]);
  dwell.stop("a");
  timers.advance(1000);
  assert.deepEqual(calls, ["reveal:a", "hide:a", "reveal:b"]);
});

test("stop on one key leaves another pending", () => {
  const { calls, timers, dwell } = setup();
  dwell.start("a");
  dwell.start("b");
  dwell.stop("a");
  timers.advance(DWELL_MS);
  assert.deepEqual(calls, ["reveal:b"]);
});

test("cancelAll clears pending timers and hides revealed keys", () => {
  const { calls, timers, dwell } = setup();
  dwell.start("a");
  timers.advance(DWELL_MS);
  dwell.start("b");
  dwell.cancelAll();
  timers.advance(5000);
  assert.deepEqual(calls, ["reveal:a", "hide:a"]);
});

test("a key can be revealed again after it was stopped", () => {
  const { calls, timers, dwell } = setup();
  dwell.start("a");
  timers.advance(DWELL_MS);
  dwell.stop("a");
  dwell.start("a");
  timers.advance(DWELL_MS);
  assert.deepEqual(calls, ["reveal:a", "hide:a", "reveal:a"]);
});

test("prune keeps keys for which keep is true", () => {
  const { calls, timers, dwell } = setup();
  dwell.start("a");
  timers.advance(DWELL_MS);
  dwell.start("b");
  dwell.prune(() => true);
  timers.advance(DWELL_MS);
  assert.deepEqual(calls, ["reveal:a", "reveal:b"]);
});

test("prune stops pending keys without a hide", () => {
  const { calls, timers, dwell } = setup();
  dwell.start("a");
  dwell.start("b");
  dwell.prune((k) => k === "b");
  timers.advance(DWELL_MS);
  assert.deepEqual(calls, ["reveal:b"]);
});

test("prune hides revealed keys that are not kept", () => {
  const { calls, timers, dwell } = setup();
  dwell.start("a");
  dwell.start("b");
  timers.advance(DWELL_MS);
  dwell.prune((k) => k === "a");
  assert.deepEqual(calls, ["reveal:a", "reveal:b", "hide:b"]);
});

test("prune on an empty dwell is a no-op", () => {
  const { calls, dwell } = setup();
  dwell.prune(() => false);
  assert.deepEqual(calls, []);
});

test("the default timers use the global setTimeout and clearTimeout", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const calls = [];
  const dwell = createDwell({ onReveal: (k) => calls.push(`reveal:${k}`), onHide: (k) => calls.push(`hide:${k}`) });
  dwell.start("a");
  t.mock.timers.tick(DWELL_MS - 1);
  assert.deepEqual(calls, []);
  t.mock.timers.tick(1);
  assert.deepEqual(calls, ["reveal:a"]);
  dwell.start("b");
  dwell.stop("b");
  t.mock.timers.tick(DWELL_MS);
  assert.deepEqual(calls, ["reveal:a"]);
});
