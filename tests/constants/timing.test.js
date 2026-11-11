import test from "node:test";
import assert from "node:assert/strict";
import { TIMING_DEFAULTS } from "../../src/constants/timing.js";
import { MODES } from "../../src/constants/modes.js";

test("TIMING_DEFAULTS holds the default timings", () => {
  assert.deepEqual(TIMING_DEFAULTS, { dwellMs: 2000, detachHoldMs: 1000, advanceDelayMs: 400, parMs: null, unservedDelayMs: 2000 });
});

test("MODES lists the four modes in menu order", () => {
  assert.deepEqual(MODES.map((m) => m.id), ["endless", "custom", "cashier", "give-change"]);
});
