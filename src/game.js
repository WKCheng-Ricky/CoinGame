import { COINS, coinById } from "./coins.js";

export const MAX_RANDOM_PENCE = 999;
export const MAX_CUSTOM_PENCE = 9999;

export function formatPence(n) {
  const pounds = Math.floor(n / 100);
  const pence = n % 100;
  return `£${pounds}.${String(pence).padStart(2, "0")}`;
}

export function total(pile) {
  let sum = 0;
  for (const e of pile) sum += coinById(e.coinId).pence;
  return sum;
}

export function check(pile, target) {
  const sum = total(pile);
  if (sum === target) return "exact";
  return sum > target ? "over" : "under";
}

export function summarisePile(pile) {
  const counts = {};
  for (const e of pile) counts[e.coinId] = (counts[e.coinId] ?? 0) + 1;
  return counts;
}

export function describePile(pile, intro = "In the pile") {
  const counts = summarisePile(pile);
  const parts = COINS.filter((c) => counts[c.id]).map((c) => `${counts[c.id]} × ${c.id}`);
  return parts.length ? `${intro}: ${parts.join(", ")}` : "The pile is empty.";
}

export function parseAmount(text) {
  let t = text.trim();
  if (t.startsWith("£")) t = t.slice(1).trim();
  const m = /^(\d*)(?:\.(\d{0,2}))?$/.exec(t);
  if (!m || (m[1] === "" && !m[2])) {
    return { ok: false, error: "Enter an amount like 3.95" };
  }
  const pence = Number(m[1] || 0) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (pence === 0) return { ok: false, error: "The amount must be more than zero" };
  if (pence > MAX_CUSTOM_PENCE) {
    return { ok: false, error: `The amount can be at most ${formatPence(MAX_CUSTOM_PENCE)}` };
  }
  return { ok: true, pence };
}

export function randomTarget(previous, rng = Math.random) {
  const hasPrevious = previous >= 1 && previous <= MAX_RANDOM_PENCE;
  if (!hasPrevious) return 1 + Math.floor(rng() * MAX_RANDOM_PENCE);
  let n = 1 + Math.floor(rng() * (MAX_RANDOM_PENCE - 1));
  if (n >= previous) n++;
  return n;
}

export const MAX_HANDFUL = 12;

export function randomHandful(rng = Math.random, previous = []) {
  const draw = () => {
    const count = 2 + Math.floor(rng() * (MAX_HANDFUL - 1));
    return Array.from({ length: count }, () => COINS[Math.floor(rng() * COINS.length)].id);
  };
  const key = (ids) => [...ids].sort().join(",");
  const first = draw();
  return key(first) === key(previous) ? draw() : first;
}

export function checkAnswer(pile, pence) {
  const result = check(pile, pence);
  if (result === "exact") return "exact";
  return result === "under" ? "over" : "under";
}

// Rolls the customer's outcome from `odds` ({ underpaid, exactShare }). It uses one draw when the
// customer underpays and two otherwise (the second splits exact from over), so anything that replays a
// seeded sequence must expect a variable draw count. An "over" roll cannot happen when paid < 2p
// (there would be no price below it), so it becomes "exact".
export function rollScenario(odds, rng = Math.random, paid = Infinity) {
  if (rng() < odds.underpaid) return "under";
  if (rng() < odds.exactShare) return "exact";
  return paid < 2 ? "exact" : "over";
}

// The shop price for a payment of `paid` pence: equal for "exact"; 1p up to half of `paid` less for
// "over" (so a 2p or 3p payment is always 1p over, and the price never drops below 1p); 1p up to 2 pounds
// more for "under".
export function priceFor(paid, scenario, rng = Math.random) {
  if (scenario === "exact") return paid;
  if (scenario === "over") return paid - (1 + Math.floor(rng() * Math.floor(paid / 2)));
  return paid + 1 + Math.floor(rng() * 200);
}

export function changeDue(paid, price) {
  return Math.max(0, paid - price);
}

export function judgeAnswer(scenario, action, changeTotal, due) {
  const ok = { correct: true, hint: "" };
  const bad = (hint) => ({ correct: false, hint });
  if (action === "check") {
    // an empty Check means "No change"
    if (changeTotal === 0 && scenario !== "over") return judgeAnswer(scenario, "none", 0, due);
    if (scenario !== "over") return bad("Does this customer need change?");
    if (changeTotal === due) return ok;
    return bad(changeTotal > due ? "Too much change" : "Not enough change");
  }
  if (action === "none") {
    if (scenario === "exact") return ok;
    return bad(scenario === "over" ? "They overpaid, so you owe change" : "They have not paid enough yet");
  }
  return scenario === "under" ? ok : bad("They paid enough");
}

export const PILE_WIDTH_MM = 110;
export const PILE_HEIGHT_MM = 90;
export const PILE_MARGIN_MM = Math.max(...COINS.map((c) => c.diameter)) / 2;

// Large Coins: every coin is drawn and laid out `coinScale` times bigger while the pile box keeps its width on
// screen, so the play area (the box less a margin of one big coin's radius on each side) holds fewer coins.
let coinScale = 1;
export function setCoinScale(k) { coinScale = k; }
export const getCoinScale = () => coinScale;
export const diameterOf = (coin) => coin.diameter * coinScale;
export const pileMarginMm = () => PILE_MARGIN_MM * coinScale;
export const pileWidthMm = () => PILE_WIDTH_MM + 2 * PILE_MARGIN_MM - 2 * pileMarginMm();
export const CUSTOMER_BOX_MM = 50;
export const CHANGE_BOX_MM = 50;
// Large Coins: the default pile box and both Give Change boxes are a whole number of grid cells high
// (a cell is 10 mm of coin, so 10 * coinScale box-mm), a little shorter than the base boxes.
export const LARGE_BOX_CELLS = { pile: 7, change: 3, customer: 3 };
const largeBoxMm = (cells) => cells * 10 * coinScale;
export const pileBoxMm = () => (coinScale > 1 ? largeBoxMm(LARGE_BOX_CELLS.pile) : PILE_HEIGHT_MM + 2 * PILE_MARGIN_MM);
export const changeBoxMm = () => (coinScale > 1 ? largeBoxMm(LARGE_BOX_CELLS.change) : CHANGE_BOX_MM);
export const customerBoxMm = () => (coinScale > 1 ? largeBoxMm(LARGE_BOX_CELLS.customer) : CUSTOMER_BOX_MM);
export const pileHeightDefaultMm = () => pileBoxMm() - 2 * pileMarginMm();
// both piles shrink on short screens (under 700 px high), so the Give Change screen still fits
export const CUSTOMER_BOX_COMPACT_MM = 40;
export const CHANGE_BOX_COMPACT_MM = 40;

// Play-area height for a pile box of the given edge length.
// Never below MIN_PLAY_HEIGHT_MM: a big coin scale can leave a short box no room, and a negative height flips the axis.
export const MIN_PLAY_HEIGHT_MM = 1;
export function heightForBox(boxMm) {
  return Math.max(MIN_PLAY_HEIGHT_MM, boxMm - 2 * pileMarginMm());
}

export const CLUSTER_TRIES = 20;
export const MAX_PLACEMENT_TRIES = 60;

function clearanceAt(pile, x, y, radius, heightMm) {
  let min = Infinity;
  for (const e of pile) {
    const d = Math.hypot((x - e.x) * pileWidthMm(), (y - e.y) * heightMm);
    min = Math.min(min, d - radius);
  }
  return min;
}

export function placeCoin(pile, coin, rng = Math.random, heightMm = pileHeightDefaultMm()) {
  const radius = diameterOf(coin) / 2;
  let best = null;
  let found = null;
  for (let i = 0; i < MAX_PLACEMENT_TRIES && !found; i++) {
    const range = i < CLUSTER_TRIES ? 0.35 : 0.5;
    const x = (rng() * 2 - 1) * range;
    const y = (rng() * 2 - 1) * range;
    const clearance = clearanceAt(pile, x, y, radius, heightMm);
    if (clearance >= 0) found = { x, y };
    else if (best === null || clearance > best.clearance) best = { x, y, clearance };
  }
  const spot = found ?? best;
  const rot = Math.floor(rng() * 360);
  return { x: spot.x, y: spot.y, rot };
}

export const STACK_CHANCE = 0.25;

export function placeHandfulCoin(pile, coin, rng = Math.random, heightMm = pileHeightDefaultMm()) {
  const same = pile.filter((e) => e.coinId === coin.id);
  if (same.length > 0 && rng() < STACK_CHANCE) {
    const target = same[Math.floor(rng() * same.length)];
    return { x: target.x, y: target.y, rot: Math.floor(rng() * 360) };
  }
  return placeCoin(pile, coin, rng, heightMm);
}

export function pileBox({ x, y }, heightMm = pileHeightDefaultMm()) {
  const boxW = pileWidthMm() + 2 * pileMarginMm();
  const boxH = heightMm + 2 * pileMarginMm();
  return {
    left: ((pileMarginMm() + (0.5 + x) * pileWidthMm()) / boxW) * 100,
    top: ((pileMarginMm() + (0.5 + y) * heightMm) / boxH) * 100,
  };
}

function clampAxis(v) {
  if (Number.isNaN(v)) return 0;
  return Math.min(0.5, Math.max(-0.5, v));
}

export function clampPosition(x, y) {
  return { x: clampAxis(x), y: clampAxis(y) };
}

export const STACK_STEP_MM = { x: 1, y: -1 };
export const STACK_LINK_MM = 3;
export const DETACH_NUDGE_MM = { x: 5, y: 5 };

// Where a held, released coin steps to: each axis towards the pile centre (positive at 0).
export function detachNudge(entry, heightMm = pileHeightDefaultMm()) {
  const dx = entry.x <= 0 ? DETACH_NUDGE_MM.x : -DETACH_NUDGE_MM.x;
  const dy = entry.y <= 0 ? DETACH_NUDGE_MM.y : -DETACH_NUDGE_MM.y;
  return clampPosition(entry.x + dx / pileWidthMm(), entry.y + dy / heightMm);
}

export const PUSH_FACTOR = 0.75;
export const MAX_SETTLE_PASSES = 8;

function distMm(a, b, heightMm) {
  return Math.hypot((a.x - b.x) * pileWidthMm(), (a.y - b.y) * heightMm);
}

function radiusOf(entry) {
  return diameterOf(coinById(entry.coinId)) / 2;
}

// b is reacted to by a when it is too close and a moved towards it (or a is new).
function reactsTo(a, prev, b, heightMm) {
  const d = distMm(a, b, heightMm);
  if (d >= Math.min(radiusOf(a), radiusOf(b))) return false;
  return prev === null || d < distMm(prev, b, heightMm);
}

// The connected component of same-denomination coins around `start`.
function unitOf(cur, start, heightMm = pileHeightDefaultMm()) {
  const unit = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const e = queue.pop();
    for (const o of cur) {
      if (!unit.has(o) && o.coinId === e.coinId && distMm(e, o, heightMm) < STACK_LINK_MM) {
        unit.add(o);
        queue.push(o);
      }
    }
  }
  return unit;
}

function shiftUnit(unit, dxMm, dyMm, next, heightMm) {
  for (const e of unit) {
    if (!next.has(e)) next.set(e, { x: e.x, y: e.y });
    Object.assign(e, clampPosition(e.x + dxMm / pileWidthMm(), e.y + dyMm / heightMm));
  }
}

// Settles `members` (entries of `cur`, in pile order) after they moved together; `leader`
// is the one the reactions are measured from. Mutates the entries of `cur`.
function settleEntries(cur, members, leader, from, heightMm) {
  const group = new Set(members);
  const others = cur.filter((c) => !group.has(c));

  // Previous positions: every member moved by the leader's displacement.
  const prevOf = new Map();
  for (const e of members) {
    if (from === null) prevOf.set(e, null);
    else if (e === leader) prevOf.set(e, from);
    else prevOf.set(e, { x: e.x - (leader.x - from.x), y: e.y - (leader.y - from.y) });
  }

  // Coins stacked with the leader where it started: an arrow step away from one
  // layer can be a step towards another, so these never snap or react to it.
  const own = new Set();
  if (from !== null) {
    const origin = { ...leader, x: from.x, y: from.y };
    for (const e of unitOf([...others, origin], origin, heightMm)) own.add(e.uid);
  }
  const stackOn = others
    .filter((c) => !own.has(c.uid) && c.coinId === leader.coinId && reactsTo(leader, from, c, heightMm))
    .pop();
  if (stackOn) {
    const unit = unitOf(others, stackOn, heightMm);
    const top = others.findLast((c) => unit.has(c));
    members.forEach((e, i) => {
      Object.assign(e, clampPosition(
        top.x + ((i + 1) * STACK_STEP_MM.x) / pileWidthMm(),
        top.y + ((i + 1) * STACK_STEP_MM.y) / heightMm,
      ));
      e.rot = top.rot;
    });
  }

  let moved = new Map(prevOf);
  for (let pass = 0; pass < MAX_SETTLE_PASSES && moved.size > 0; pass++) {
    const next = new Map();
    for (const [a, prev] of moved) {
      for (const b of cur) {
        if (b.coinId === a.coinId || !reactsTo(a, prev, b, heightMm)) continue;
        const d = distMm(a, b, heightMm);
        const need = PUSH_FACTOR * (radiusOf(a) + radiusOf(b)) - d;
        if (need <= 0) continue;
        const ux = d === 0 ? 1 : ((a.x - b.x) * pileWidthMm()) / d;
        const uy = d === 0 ? 0 : ((a.y - b.y) * heightMm) / d;
        const half = need / 2;
        const unitA = unitOf(cur, a, heightMm);
        const unitB = unitOf(cur, b, heightMm);
        shiftUnit(unitA, ux * half, uy * half, next, heightMm);
        shiftUnit(unitB, -ux * half, -uy * half, next, heightMm);
      }
    }
    moved = next;
  }
}

function settled(pile, cur) {
  const changed = cur.some((e, i) => e.x !== pile[i].x || e.y !== pile[i].y || e.rot !== pile[i].rot);
  return changed ? cur : pile;
}

export function settlePile(pile, uid, from, heightMm = pileHeightDefaultMm()) {
  const cur = pile.map((e) => ({ ...e }));
  const m = cur.find((e) => e.uid === uid);
  if (!m) return pile;
  settleEntries(cur, [m], m, from, heightMm);
  return settled(pile, cur);
}

export function settleGroup(pile, uids, leaderUid, from, heightMm = pileHeightDefaultMm()) {
  const wanted = new Set(uids);
  const cur = pile.map((e) => ({ ...e }));
  const members = cur.filter((e) => wanted.has(e.uid));
  const leader = members.find((e) => e.uid === leaderUid);
  if (!leader) return pile;
  settleEntries(cur, members, leader, from, heightMm);
  return settled(pile, cur);
}

// Uids of the stack containing `uid`, in draw order ([] when unknown).
export function unitUids(pile, uid, heightMm = pileHeightDefaultMm()) {
  const start = pile.find((e) => e.uid === uid);
  if (!start) return [];
  const unit = unitOf(pile, start, heightMm);
  return pile.filter((e) => unit.has(e)).map((e) => e.uid);
}

// Uid of the last-drawn member of each stack of two or more, mapped to the stack size.
export function stackCounts(pile, heightMm = pileHeightDefaultMm()) {
  const counts = new Map();
  const seen = new Set();
  for (const e of pile) {
    if (seen.has(e)) continue;
    const unit = unitOf(pile, e, heightMm);
    for (const m of unit) seen.add(m);
    if (unit.size < 2) continue;
    const last = pile.findLast((m) => unit.has(m));
    counts.set(last.uid, unit.size);
  }
  return counts;
}
