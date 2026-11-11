// Session helpers: par times, scoring, the clock text, scored rounds, exit prompts and the session record. Pure functions; imports only constants/options.js.
import { presetOf, timerOn } from "../constants/options.js";

// How long a good answer takes in each timed mode; Custom has no par and is never timed.
export const PAR_MS = { endless: 15000, cashier: 20000, "give-change": 30000 };

export const MAX_POINTS = 100;
export const MIN_POINTS = 10;

// The par for a mode: the `?par=` override (ms) when given, null for a mode that is not timed.
export function parFor(mode, overrideMs = null) {
  if (!(mode in PAR_MS)) return null;
  return overrideMs ?? PAR_MS[mode];
}

// 100 points at no time, falling in a line to 10 at `parMs` and staying there, as whole points.
export function scoreFor(elapsedMs, parMs) {
  if (parMs <= 0 || elapsedMs >= parMs) return MIN_POINTS;
  const used = Math.max(0, elapsedMs) / parMs;
  return Math.round(MAX_POINTS - (MAX_POINTS - MIN_POINTS) * used);
}

export function formatClock(ms) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export const clockText = (elapsedMs, score) => `Time ${formatClock(elapsedMs)} · Score ${score}`;

export const timeLeftMs = (startedAt, now, limitSeconds) => Math.max(0, limitSeconds * 1000 - (now - startedAt));

// A limit of 0 means no limit.
export const isExpired = (startedAt, now, limitSeconds) => limitSeconds > 0 && now - startedAt >= limitSeconds * 1000;

// Only timed rounds in the scoring modes count toward a leaderboard result.
export const isScored = (state) => state.mode !== "custom" && timerOn(state.options);

// Which confirmation (if any) leaving the round needs: "end" or "back", or null to leave at once.
export function exitPrompt(state, button) {
  if (!isScored(state)) return null;
  if (button === "end") return "end";
  return state.score > 0 ? "back" : null;
}

export const endSession = (state, at) => ({
  mode: state.mode, preset: presetOf(state.options), score: state.score, served: state.rounds, at,
});
