import { COINS } from "./coins.js";
import { MODE_IDS, defaultOptions, isValidValue, timerOn } from "./options.js";
import { isExpired, parFor, scoreFor } from "./timer.js";
import {
  CHANGE_BOX_COMPACT_MM, CUSTOMER_BOX_COMPACT_MM, changeDue, check, checkAnswer, clampPosition, formatPence,
  changeBoxMm, customerBoxMm, heightForBox, judgeAnswer, layoutStacks, pileHeightDefaultMm, placeCoin, placeHandfulCoin, priceFor, randomHandful, rollScenario, settlePile,
  settleGroup, total,
} from "./game.js";

export const ADVANCE_DELAY_MS = 400;

const NO_MESSAGE = { text: "", kind: "" };

export function createState() {
  return {
    mode: "endless", target: 0, pile: [], nextUid: 1, rounds: 0, solved: false, solvedAt: 0, unserved: false,
    roundStartedAt: 0, score: 0, lastPoints: 0,
    message: NO_MESSAGE, options: defaultOptions(),
    change: [], price: 0, scenario: "", paid: 0, dealt: [],
  };
}

export function setOption(state, id, value) {
  if (!isValidValue(id, value)) return state;
  return { ...state, options: { ...state.options, [id]: value } };
}

// The home screen's selected mode; a game start sets it again.
export function selectMode(state, mode) {
  if (!MODE_IDS.includes(mode)) return state;
  return { ...state, mode };
}

// `now` (ms) is when the round is dealt; the speed score is measured from it.
export function startGame(state, mode, target, now = 0) {
  return { ...createState(), mode, target, options: state.options, roundStartedAt: now };
}

export function nextRound(state, target, now = 0) {
  return {
    ...createState(), mode: state.mode, rounds: state.rounds, score: state.score, target, options: state.options,
    roundStartedAt: now,
  };
}

// An answer after the limit does not count: the customer has already left (the clock tick may not have run yet).
const late = (state, now) => state.mode !== "custom" && isExpired(state.roundStartedAt, now, state.options.timeLimit);

// The fields a correct answer changes: the success message, and the speed points when rounds are timed.
// Custom has no par, so it is never scored.
function solvedFields(state, now, parMs, text) {
  const par = parFor(state.mode, parMs);
  if (!timerOn(state.options) || par === null) return { message: { text, kind: "success" } };
  const points = scoreFor(now - state.roundStartedAt, par);
  return { score: state.score + points, lastPoints: points, message: { text: `${text} +${points} points`, kind: "success" } };
}

// Play-area height of a pile: Give Change mode gives the customer's and the player's piles short boxes.
// `compact` (a short screen, from the UI) shrinks both piles to 4 cm boxes.
export function pileHeightMm(state, key = "pile", compact = false) {
  if (state.mode !== "give-change") return pileHeightDefaultMm();
  if (key !== "change") return heightForBox(compact ? CUSTOMER_BOX_COMPACT_MM : customerBoxMm());
  return heightForBox(compact ? CHANGE_BOX_COMPACT_MM : changeBoxMm());
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

function dealHandful(state, ids, rng, compact = false) {
  const empty = { ...state, pile: [], nextUid: 1, solved: false, solvedAt: 0, message: NO_MESSAGE };
  if (state.options.autoStack) {
    const pile = layoutStacks(ids, rng, pileHeightMm(state, "pile", compact)).map((e, i) => ({ uid: i + 1, ...e }));
    return { ...empty, pile, nextUid: pile.length + 1 };
  }
  return ids.reduce((s, id) => placeAndSettle(s, COINS.find((c) => c.id === id), placeHandfulCoin, rng, "pile", compact), empty);
}

export function startCashier(state, rng = Math.random, now = 0) {
  const fresh = { ...createState(), mode: "cashier", options: state.options, roundStartedAt: now };
  return dealHandful(fresh, randomHandful(rng), rng);
}

// The dealt coins are the customer's: they stay flagged wherever they are moved, and can never be removed.
function setScenario(state, odds, rng) {
  const pile = state.pile.map((e) => ({ ...e, customer: true }));
  const paid = total(pile);
  const scenario = rollScenario(odds, rng, paid);
  return { ...state, pile, scenario, price: priceFor(paid, scenario, rng), paid, dealt: pile };
}

// `compact` (a short screen) deals the customer's coins for the smaller pile box.
export function startGiveChange(state, odds, rng = Math.random, now = 0, compact = false) {
  const fresh = { ...createState(), mode: "give-change", options: state.options, roundStartedAt: now };
  return setScenario(dealHandful(fresh, randomHandful(rng), rng, compact), odds, rng);
}

export function nextGiveChangeCustomer(state, odds, rng = Math.random, now = 0, compact = false) {
  const previous = state.dealt.map((e) => e.coinId);
  const fresh = {
    ...createState(), mode: "give-change", rounds: state.rounds, score: state.score, options: state.options, roundStartedAt: now,
  };
  return setScenario(dealHandful(fresh, randomHandful(rng, previous), rng, compact), odds, rng);
}

function answerText(scenario, due, shortBy) {
  if (scenario === "over") return `Change: ${formatPence(due)}.`;
  if (scenario === "exact") return "No change due.";
  return `They are ${formatPence(shortBy)} short.`;
}

const successText = (scenario, due, shortBy) => `Correct! ${answerText(scenario, due, shortBy)}`;

// Judging uses the amount paid when the round was dealt, not the customer pile as shown:
// coins moved between the piles never change the scenario or the change due.
export function submitGiveChangeAnswer(state, action, now, parMs = null) {
  if (state.solved) return state;
  if (late(state, now)) return expireRound(state, now);
  const due = changeDue(state.paid, state.price);
  const result = judgeAnswer(state.scenario, action, total(state.change), due);
  if (result.correct) {
    return {
      ...state,
      solved: true,
      solvedAt: now,
      rounds: state.rounds + 1,
      ...solvedFields(state, now, parMs, successText(state.scenario, due, state.price - state.paid)),
    };
  }
  return { ...state, message: { text: result.hint, kind: "hint" } };
}

export function nextCustomer(state, rng = Math.random, now = 0) {
  const previous = state.pile.map((e) => e.coinId); // Cashier's pile is read-only, and `dealt` is only set in Give Change
  return dealHandful(
    { ...createState(), mode: state.mode, rounds: state.rounds, score: state.score, options: state.options, roundStartedAt: now },
    randomHandful(rng, previous),
    rng,
  );
}

export function submitAnswer(state, pence, now, parMs = null) {
  if (state.solved) return state;
  if (late(state, now)) return expireRound(state, now);
  const result = checkAnswer(state.pile, pence);
  if (result === "exact") {
    return {
      ...state,
      solved: true,
      solvedAt: now,
      rounds: state.rounds + 1,
      ...solvedFields(state, now, parMs, `Correct! That is ${formatPence(pence)}.`),
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
  const entry = state[key].find((e) => e.uid === uid);
  if (locked(state, key) || !entry || entry.customer) return state;
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
  // Give Change: Clear also puts the customer's coins back where they were dealt.
  if (state.mode === "give-change" && key === "change") {
    return { ...state, pile: state.dealt, change: [], message: NO_MESSAGE };
  }
  return { ...state, [key]: [], message: NO_MESSAGE };
}

const PILE_KEYS = ["pile", "change"];
const OVERPAID_HINT = { text: "That is more than they paid. Press Clear to start again.", kind: "hint" };

// Give Change: moves coins between the customer's pile and the change pile. The leader lands at
// (x, y) and the others keep their offset from it; the moved coins get new uids, leader last.
export function transferCoins(state, uids, leaderUid, from, to, x, y, compact = false) {
  if (state.mode !== "give-change" || state.solved || from === to) return state;
  if (!PILE_KEYS.includes(from) || !PILE_KEYS.includes(to)) return state;
  const leader = state[from].find((e) => e.uid === leaderUid);
  if (!leader) return state;
  const wanted = new Set(uids);
  wanted.add(leaderUid);
  const group = state[from].filter((e) => wanted.has(e.uid) && e !== leader);
  group.push(leader);
  if (to === "pile" && total(state.pile) + total(group) > state.paid) {
    return { ...state, message: { ...OVERPAID_HINT } };
  }
  const at = clampPosition(x, y);
  const moved = group.map((e, i) => ({
    ...e, uid: state.nextUid + i, x: at.x + e.x - leader.x, y: at.y + e.y - leader.y,
  }));
  const newUids = moved.map((e) => e.uid);
  const list = settleGroup([...state[to], ...moved], newUids, newUids.at(-1), null, pileHeightMm(state, to, compact));
  return {
    ...state,
    [from]: state[from].filter((e) => !wanted.has(e.uid)),
    [to]: list,
    nextUid: state.nextUid + moved.length,
    message: NO_MESSAGE,
  };
}

// Give Change: a tap sends a coin to the other pile, so a handful need not be dragged coin by coin.
// A customer coin in the change pile goes back; one of your own coins there is left for the caller to remove.
export function sendCoin(state, uid, from, rng = Math.random, compact = false) {
  if (!PILE_KEYS.includes(from)) return state;
  const entry = state[from].find((e) => e.uid === uid);
  if (!entry || (from === "change" && !entry.customer)) return state;
  const to = from === "pile" ? "change" : "pile";
  const coin = COINS.find((c) => c.id === entry.coinId);
  const { x, y } = placeCoin(state[to], coin, rng, pileHeightMm(state, to, compact));
  return transferCoins(state, [uid], uid, from, to, x, y, compact);
}

export function submitCheck(state, now, parMs = null) {
  if (state.solved) return state;
  if (late(state, now)) return expireRound(state, now);
  const result = check(state.pile, state.target);
  if (result === "exact") {
    return {
      ...state,
      solved: true,
      solvedAt: now,
      rounds: state.mode === "endless" ? state.rounds + 1 : state.rounds,
      ...solvedFields(state, now, parMs, `Correct! You made exactly ${formatPence(state.target)}.`),
    };
  }
  const text = result === "over" ? "A bit too much" : "Not enough yet";
  return { ...state, message: { text, kind: "hint" } };
}

export function canAdvance(state, now, delayMs = ADVANCE_DELAY_MS) {
  return state.solved && now - state.solvedAt >= delayMs;
}

// The time limit ran out: the customer leaves unserved, scoring nothing, and the answer is shown.
export function expireRound(state, now) {
  if (state.solved) return state;
  const answer = {
    endless: () => `The answer was ${formatPence(state.target)}.`,
    custom: () => `The answer was ${formatPence(state.target)}.`,
    cashier: () => `The answer was ${formatPence(total(state.pile))}.`,
    "give-change": () => answerText(state.scenario, changeDue(state.paid, state.price), state.price - state.paid),
  }[state.mode]();
  return {
    ...state,
    solved: true,
    unserved: true,
    solvedAt: now,
    lastPoints: 0,
    rounds: state.mode === "custom" ? state.rounds : state.rounds + 1,
    message: { text: `Customer not served. ${answer}`, kind: "hint" },
  };
}
