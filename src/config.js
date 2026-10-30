import { DWELL_MS } from "./dwell.js";
import { DETACH_HOLD_MS } from "./drag.js";
import { ADVANCE_DELAY_MS } from "./state.js";

// How long an unserved customer stays on screen, so the answer can be read before the next one arrives.
export const UNSERVED_DELAY_MS = 2000;

export const TIMING_DEFAULTS = {
  dwellMs: DWELL_MS, detachHoldMs: DETACH_HOLD_MS, advanceDelayMs: ADVANCE_DELAY_MS, parMs: null, unservedDelayMs: UNSERVED_DELAY_MS,
};

const MAX_MS = 10000;

function readMs(params, key, fallback) {
  const raw = params.get(key);
  if (raw === null || !/^\d+$/.test(raw)) return fallback;
  const n = Number(raw);
  return n <= MAX_MS ? n : fallback;
}

// ?par= is whole seconds (1 to 600) and overrides the par time of every timed mode; anything else leaves the per-mode par.
function readParMs(params) {
  const raw = params.get("par");
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= 600 ? n * 1000 : null;
}

// Timing overrides from a query string (?dwell=, ?hold=, ?advance=, ?unserved= in ms, ?par= in s); bad values use the default.
export function timingFromSearch(search) {
  const params = new URLSearchParams(search);
  return {
    dwellMs: readMs(params, "dwell", TIMING_DEFAULTS.dwellMs),
    detachHoldMs: readMs(params, "hold", TIMING_DEFAULTS.detachHoldMs),
    advanceDelayMs: readMs(params, "advance", TIMING_DEFAULTS.advanceDelayMs),
    parMs: readParMs(params),
    unservedDelayMs: readMs(params, "unserved", TIMING_DEFAULTS.unservedDelayMs),
  };
}

// Give Change mode odds. `underpaid` is the chance a customer underpays (only with the shortPay option); tune it here.
export function giveChangeOdds(options) {
  return { underpaid: options.shortPay ? 0.25 : 0, exactShare: 1 / 3 };
}

// Large Coins option: how much bigger every coin is drawn, with the pile box keeping its size on screen. Tune here.
export const LARGE_COIN_SCALE = 1.5;
export const coinScaleFor = (options) => (options.largeCoins ? LARGE_COIN_SCALE : 1);
