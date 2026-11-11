export const DWELL_MS = 2000;

// 1 s, its own constant: independent of (and shorter than) the 2 s value-reveal DWELL_MS
export const DETACH_HOLD_MS = 1000;

export const ADVANCE_DELAY_MS = 400;

// How long an unserved customer stays on screen, so the answer can be read before the next one arrives.
export const UNSERVED_DELAY_MS = 2000;

export const TIMING_DEFAULTS = {
  dwellMs: DWELL_MS, detachHoldMs: DETACH_HOLD_MS, advanceDelayMs: ADVANCE_DELAY_MS, parMs: null, unservedDelayMs: UNSERVED_DELAY_MS,
};
