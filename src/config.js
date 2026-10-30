import { DWELL_MS } from "./dwell.js";
import { DETACH_HOLD_MS } from "./drag.js";
import { ADVANCE_DELAY_MS } from "./state.js";

export const TIMING_DEFAULTS = { dwellMs: DWELL_MS, detachHoldMs: DETACH_HOLD_MS, advanceDelayMs: ADVANCE_DELAY_MS };

const MAX_MS = 10000;

function readMs(params, key, fallback) {
  const raw = params.get(key);
  if (raw === null || !/^\d+$/.test(raw)) return fallback;
  const n = Number(raw);
  return n <= MAX_MS ? n : fallback;
}

// Timing overrides from a query string (?dwell=, ?hold=, ?advance= in ms); bad values use the default.
export function timingFromSearch(search) {
  const params = new URLSearchParams(search);
  return {
    dwellMs: readMs(params, "dwell", TIMING_DEFAULTS.dwellMs),
    detachHoldMs: readMs(params, "hold", TIMING_DEFAULTS.detachHoldMs),
    advanceDelayMs: readMs(params, "advance", TIMING_DEFAULTS.advanceDelayMs),
  };
}

// Give Change mode odds per difficulty. `underpaid` is the chance a customer underpays; tune it here.
export const GIVE_CHANGE_ODDS = {
  normal: { underpaid: 0.25, exactShare: 1 / 3 },
  easy: { underpaid: 0, exactShare: 1 / 3 },
};
