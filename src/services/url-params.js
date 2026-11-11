import { TIMING_DEFAULTS } from "../constants/timing.js";

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
