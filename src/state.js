import { COINS } from "./coins.js";
import { check, formatPence, placeCoin } from "./game.js";

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
  return { ...state, pile: [...state.pile, entry], nextUid: state.nextUid + 1, message: NO_MESSAGE };
}

export function removeFromPile(state, uid) {
  if (state.solved || !state.pile.some((e) => e.uid === uid)) return state;
  return { ...state, pile: state.pile.filter((e) => e.uid !== uid), message: NO_MESSAGE };
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
