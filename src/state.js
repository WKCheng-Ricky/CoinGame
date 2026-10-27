import { COINS } from "./coins.js";
import { check, clampPosition, formatPence, placeCoin, settlePile, settleGroup } from "./game.js";

export const ADVANCE_DELAY_MS = 400;

const NO_MESSAGE = { text: "", kind: "" };

export function createState() {
  return {
    mode: "endless", target: 0, pile: [], nextUid: 1, rounds: 0, solved: false, solvedAt: 0,
    message: NO_MESSAGE, difficulty: "normal",
  };
}

export function setDifficulty(state, difficulty) {
  if (difficulty !== "easy" && difficulty !== "normal") return state;
  return { ...state, difficulty };
}

export function startGame(state, mode, target) {
  return { ...createState(), mode, target, difficulty: state.difficulty };
}

export function nextRound(state, target) {
  return { ...createState(), mode: state.mode, rounds: state.rounds, target, difficulty: state.difficulty };
}

export function addToPile(state, coinId, rng = Math.random) {
  const coin = COINS.find((c) => c.id === coinId);
  if (state.solved || !coin) return state;
  const entry = { uid: state.nextUid, coinId, ...placeCoin(state.pile, coin, rng) };
  const pile = settlePile([...state.pile, entry], entry.uid, null);
  return { ...state, pile, nextUid: state.nextUid + 1, message: NO_MESSAGE };
}

export function addToPileAt(state, coinId, x, y, rng = Math.random) {
  if (state.solved || !COINS.some((c) => c.id === coinId)) return state;
  const entry = { uid: state.nextUid, coinId, ...clampPosition(x, y), rot: Math.floor(rng() * 360) };
  return { ...state, pile: [...state.pile, entry], nextUid: state.nextUid + 1, message: NO_MESSAGE };
}

export function removeFromPile(state, uid) {
  if (state.solved || !state.pile.some((e) => e.uid === uid)) return state;
  return { ...state, pile: state.pile.filter((e) => e.uid !== uid), message: NO_MESSAGE };
}

export function moveCoin(state, uid, x, y) {
  if (state.solved) return state;
  const moved = state.pile.find((e) => e.uid === uid);
  if (!moved) return state;
  const others = state.pile.filter((e) => e.uid !== uid);
  return { ...state, pile: [...others, { ...moved, ...clampPosition(x, y) }] };
}

export function settleCoin(state, uid, from) {
  if (state.solved || !state.pile.some((e) => e.uid === uid)) return state;
  const pile = settlePile(state.pile, uid, from);
  return pile === state.pile ? state : { ...state, pile };
}

export function moveGroup(state, uids, dx, dy) {
  if (state.solved) return state;
  const wanted = new Set(uids);
  const group = state.pile.filter((e) => wanted.has(e.uid));
  if (group.length === 0) return state;
  const limit = (d, key) => {
    const v = Number.isNaN(d) ? 0 : d;
    const lo = -0.5 - Math.min(...group.map((e) => e[key]));
    const hi = 0.5 - Math.max(...group.map((e) => e[key]));
    return Math.min(hi, Math.max(lo, v));
  };
  const ddx = limit(dx, "x");
  const ddy = limit(dy, "y");
  const others = state.pile.filter((e) => !wanted.has(e.uid));
  const shifted = group.map((e) => ({ ...e, x: e.x + ddx, y: e.y + ddy }));
  return { ...state, pile: [...others, ...shifted] };
}

export function settleGroupCoins(state, uids, leaderUid, from) {
  if (state.solved) return state;
  const pile = settleGroup(state.pile, uids, leaderUid, from);
  return pile === state.pile ? state : { ...state, pile };
}

export function clearPile(state) {
  if (state.solved) return state;
  return { ...state, pile: [], message: NO_MESSAGE };
}

export function submitCheck(state, now) {
  if (state.solved) return state;
  const result = check(state.pile, state.target);
  if (result === "exact") {
    return {
      ...state,
      solved: true,
      solvedAt: now,
      rounds: state.mode === "endless" ? state.rounds + 1 : state.rounds,
      message: { text: `Correct! You made exactly ${formatPence(state.target)}.`, kind: "success" },
    };
  }
  const text = result === "over" ? "A bit too much" : "Not enough yet";
  return { ...state, message: { text, kind: "hint" } };
}

export function canAdvance(state, now) {
  return state.solved && now - state.solvedAt >= ADVANCE_DELAY_MS;
}
