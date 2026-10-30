import { COINS } from "./coins.js";
import {
  CHANGE_BOX_COMPACT_MM, CHANGE_BOX_MM, CUSTOMER_BOX_MM, PILE_HEIGHT_MM, changeDue, check, checkAnswer, clampPosition, formatPence,
  heightForBox, judgeAnswer, placeCoin, placeHandfulCoin, priceFor, randomHandful, rollScenario, settlePile,
  settleGroup, total,
} from "./game.js";

export const ADVANCE_DELAY_MS = 400;

const NO_MESSAGE = { text: "", kind: "" };

export function createState() {
  return {
    mode: "endless", target: 0, pile: [], nextUid: 1, rounds: 0, solved: false, solvedAt: 0,
    message: NO_MESSAGE, difficulty: "normal",
    change: [], price: 0, scenario: "",
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

// Play-area height of a pile: Give Change mode gives the customer's and the player's piles short boxes.
// `compact` (a short screen, from the UI) shrinks the player's pile to the customer's 4 cm box.
export function pileHeightMm(state, key = "pile", compact = false) {
  if (state.mode !== "give-change") return PILE_HEIGHT_MM;
  if (key !== "change") return heightForBox(CUSTOMER_BOX_MM);
  return heightForBox(compact ? CHANGE_BOX_COMPACT_MM : CHANGE_BOX_MM);
}

function placeAndSettle(state, coin, place, rng, key = "pile", compact = false) {
  const h = pileHeightMm(state, key, compact);
  const entry = { uid: state.nextUid, coinId: coin.id, ...place(state[key], coin, rng, h) };
  const list = settlePile([...state[key], entry], entry.uid, null, h);
  return { ...state, [key]: list, nextUid: state.nextUid + 1, message: NO_MESSAGE };
}

// In Cashier and Give Change the customer's pile is read-only; only the change list is editable in Give Change.
function locked(state, key) {
  return state.solved || state.mode === "cashier" || (state.mode === "give-change" && key === "pile");
}

function dealHandful(state, ids, rng) {
  const empty = { ...state, pile: [], nextUid: 1, solved: false, solvedAt: 0, message: NO_MESSAGE };
  return ids.reduce((s, id) => placeAndSettle(s, COINS.find((c) => c.id === id), placeHandfulCoin, rng), empty);
}

export function startCashier(state, rng = Math.random) {
  const fresh = { ...createState(), mode: "cashier", difficulty: state.difficulty };
  return dealHandful(fresh, randomHandful(rng), rng);
}

function setScenario(state, odds, rng) {
  const paid = total(state.pile);
  const scenario = rollScenario(odds, rng, paid);
  return { ...state, scenario, price: priceFor(paid, scenario, rng) };
}

export function startGiveChange(state, odds, rng = Math.random) {
  const fresh = { ...createState(), mode: "give-change", difficulty: state.difficulty };
  return setScenario(dealHandful(fresh, randomHandful(rng), rng), odds, rng);
}

export function nextGiveChangeCustomer(state, odds, rng = Math.random) {
  const previous = state.pile.map((e) => e.coinId);
  const fresh = { ...createState(), mode: "give-change", rounds: state.rounds, difficulty: state.difficulty };
  return setScenario(dealHandful(fresh, randomHandful(rng, previous), rng), odds, rng);
}

function successText(scenario, due, shortBy) {
  if (scenario === "over") return `Correct! Change: ${formatPence(due)}.`;
  if (scenario === "exact") return "Correct! No change due.";
  return `Correct! They are ${formatPence(shortBy)} short.`;
}

export function submitGiveChangeAnswer(state, action, now) {
  if (state.solved) return state;
  const due = changeDue(total(state.pile), state.price);
  const result = judgeAnswer(state.scenario, action, total(state.change), due);
  if (result.correct) {
    return {
      ...state,
      solved: true,
      solvedAt: now,
      rounds: state.rounds + 1,
      message: { text: successText(state.scenario, due, state.price - total(state.pile)), kind: "success" },
    };
  }
  return { ...state, message: { text: result.hint, kind: "hint" } };
}

export function nextCustomer(state, rng = Math.random) {
  const previous = state.pile.map((e) => e.coinId);
  return dealHandful(
    { ...createState(), mode: state.mode, rounds: state.rounds, difficulty: state.difficulty },
    randomHandful(rng, previous),
    rng,
  );
}

export function submitAnswer(state, pence, now) {
  if (state.solved) return state;
  const result = checkAnswer(state.pile, pence);
  if (result === "exact") {
    return {
      ...state,
      solved: true,
      solvedAt: now,
      rounds: state.rounds + 1,
      message: { text: `Correct! That is ${formatPence(pence)}.`, kind: "success" },
    };
  }
  return { ...state, message: { text: result === "over" ? "Too high" : "Too low", kind: "hint" } };
}

export function isContinuous(state) {
  return state.mode === "endless" || state.mode === "cashier" || state.mode === "give-change";
}

export function addToPile(state, coinId, rng = Math.random, key = "pile", compact = false) {
  const coin = COINS.find((c) => c.id === coinId);
  if (locked(state, key) || !coin) return state;
  return placeAndSettle(state, coin, placeCoin, rng, key, compact);
}

export function addToPileAt(state, coinId, x, y, rng = Math.random, key = "pile") {
  if (locked(state, key) || !COINS.some((c) => c.id === coinId)) return state;
  const entry = { uid: state.nextUid, coinId, ...clampPosition(x, y), rot: Math.floor(rng() * 360) };
  return { ...state, [key]: [...state[key], entry], nextUid: state.nextUid + 1, message: NO_MESSAGE };
}

export function removeFromPile(state, uid, key = "pile") {
  if (locked(state, key) || !state[key].some((e) => e.uid === uid)) return state;
  return { ...state, [key]: state[key].filter((e) => e.uid !== uid), message: NO_MESSAGE };
}

export function moveCoin(state, uid, x, y, key = "pile") {
  if (state.solved) return state;
  const moved = state[key].find((e) => e.uid === uid);
  if (!moved) return state;
  const others = state[key].filter((e) => e.uid !== uid);
  return { ...state, [key]: [...others, { ...moved, ...clampPosition(x, y) }] };
}

export function settleCoin(state, uid, from, key = "pile", compact = false) {
  if (state.solved || !state[key].some((e) => e.uid === uid)) return state;
  const list = settlePile(state[key], uid, from, pileHeightMm(state, key, compact));
  return list === state[key] ? state : { ...state, [key]: list };
}

export function moveGroup(state, uids, dx, dy, key = "pile") {
  if (state.solved) return state;
  const wanted = new Set(uids);
  const group = state[key].filter((e) => wanted.has(e.uid));
  if (group.length === 0) return state;
  const limit = (d, axis) => {
    const v = Number.isNaN(d) ? 0 : d;
    const lo = -0.5 - Math.min(...group.map((e) => e[axis]));
    const hi = 0.5 - Math.max(...group.map((e) => e[axis]));
    return Math.min(hi, Math.max(lo, v));
  };
  const ddx = limit(dx, "x");
  const ddy = limit(dy, "y");
  const others = state[key].filter((e) => !wanted.has(e.uid));
  const shifted = group.map((e) => ({ ...e, x: e.x + ddx, y: e.y + ddy }));
  return { ...state, [key]: [...others, ...shifted] };
}

export function settleGroupCoins(state, uids, leaderUid, from, key = "pile", compact = false) {
  if (state.solved) return state;
  const list = settleGroup(state[key], uids, leaderUid, from, pileHeightMm(state, key, compact));
  return list === state[key] ? state : { ...state, [key]: list };
}

export function clearPile(state, key = "pile") {
  if (locked(state, key)) return state;
  return { ...state, [key]: [], message: NO_MESSAGE };
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

export function canAdvance(state, now, delayMs = ADVANCE_DELAY_MS) {
  return state.solved && now - state.solvedAt >= delayMs;
}
