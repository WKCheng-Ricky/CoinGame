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

export const PILE_WIDTH_MM = 110;
export const PILE_HEIGHT_MM = 90;
export const PILE_MARGIN_MM = Math.max(...COINS.map((c) => c.diameter)) / 2;
export const CLUSTER_TRIES = 20;
export const MAX_PLACEMENT_TRIES = 60;

function clearanceAt(pile, x, y, radius) {
  let min = Infinity;
  for (const e of pile) {
    const d = Math.hypot((x - e.x) * PILE_WIDTH_MM, (y - e.y) * PILE_HEIGHT_MM);
    min = Math.min(min, d - radius);
  }
  return min;
}

export function placeCoin(pile, coin, rng = Math.random) {
  const radius = coin.diameter / 2;
  let best = null;
  let found = null;
  for (let i = 0; i < MAX_PLACEMENT_TRIES && !found; i++) {
    const range = i < CLUSTER_TRIES ? 0.35 : 0.5;
    const x = (rng() * 2 - 1) * range;
    const y = (rng() * 2 - 1) * range;
    const clearance = clearanceAt(pile, x, y, radius);
    if (clearance >= 0) found = { x, y };
    else if (best === null || clearance > best.clearance) best = { x, y, clearance };
  }
  const spot = found ?? best;
  const rot = Math.floor(rng() * 360);
  return { x: spot.x, y: spot.y, rot };
}

export const STACK_CHANCE = 0.25;

export function placeHandfulCoin(pile, coin, rng = Math.random) {
  const same = pile.filter((e) => e.coinId === coin.id);
  if (same.length > 0 && rng() < STACK_CHANCE) {
    const target = same[Math.floor(rng() * same.length)];
    return { x: target.x, y: target.y, rot: Math.floor(rng() * 360) };
  }
  return placeCoin(pile, coin, rng);
}

export function pileBox({ x, y }) {
  const boxW = PILE_WIDTH_MM + 2 * PILE_MARGIN_MM;
  const boxH = PILE_HEIGHT_MM + 2 * PILE_MARGIN_MM;
  return {
    left: ((PILE_MARGIN_MM + (0.5 + x) * PILE_WIDTH_MM) / boxW) * 100,
    top: ((PILE_MARGIN_MM + (0.5 + y) * PILE_HEIGHT_MM) / boxH) * 100,
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
export function detachNudge(entry) {
  const dx = entry.x <= 0 ? DETACH_NUDGE_MM.x : -DETACH_NUDGE_MM.x;
  const dy = entry.y <= 0 ? DETACH_NUDGE_MM.y : -DETACH_NUDGE_MM.y;
  return clampPosition(entry.x + dx / PILE_WIDTH_MM, entry.y + dy / PILE_HEIGHT_MM);
}

export const PUSH_FACTOR = 0.75;
export const MAX_SETTLE_PASSES = 8;

function distMm(a, b) {
  return Math.hypot((a.x - b.x) * PILE_WIDTH_MM, (a.y - b.y) * PILE_HEIGHT_MM);
}

function radiusOf(entry) {
  return coinById(entry.coinId).diameter / 2;
}

// b is reacted to by a when it is too close and a moved towards it (or a is new).
function reactsTo(a, prev, b) {
  const d = distMm(a, b);
  if (d >= Math.min(radiusOf(a), radiusOf(b))) return false;
  return prev === null || d < distMm(prev, b);
}

// The connected component of same-denomination coins around `start`.
function unitOf(cur, start) {
  const unit = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const e = queue.pop();
    for (const o of cur) {
      if (!unit.has(o) && o.coinId === e.coinId && distMm(e, o) < STACK_LINK_MM) {
        unit.add(o);
        queue.push(o);
      }
    }
  }
  return unit;
}

function shiftUnit(unit, dxMm, dyMm, next) {
  for (const e of unit) {
    if (!next.has(e)) next.set(e, { x: e.x, y: e.y });
    Object.assign(e, clampPosition(e.x + dxMm / PILE_WIDTH_MM, e.y + dyMm / PILE_HEIGHT_MM));
  }
}

// Settles `members` (entries of `cur`, in pile order) after they moved together; `leader`
// is the one the reactions are measured from. Mutates the entries of `cur`.
function settleEntries(cur, members, leader, from) {
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
    for (const e of unitOf([...others, origin], origin)) own.add(e.uid);
  }
  const stackOn = others
    .filter((c) => !own.has(c.uid) && c.coinId === leader.coinId && reactsTo(leader, from, c))
    .pop();
  if (stackOn) {
    const unit = unitOf(others, stackOn);
    const top = others.findLast((c) => unit.has(c));
    members.forEach((e, i) => {
      Object.assign(e, clampPosition(
        top.x + ((i + 1) * STACK_STEP_MM.x) / PILE_WIDTH_MM,
        top.y + ((i + 1) * STACK_STEP_MM.y) / PILE_HEIGHT_MM,
      ));
      e.rot = top.rot;
    });
  }

  let moved = new Map(prevOf);
  for (let pass = 0; pass < MAX_SETTLE_PASSES && moved.size > 0; pass++) {
    const next = new Map();
    for (const [a, prev] of moved) {
      for (const b of cur) {
        if (b.coinId === a.coinId || !reactsTo(a, prev, b)) continue;
        const d = distMm(a, b);
        const need = PUSH_FACTOR * (radiusOf(a) + radiusOf(b)) - d;
        if (need <= 0) continue;
        const ux = d === 0 ? 1 : ((a.x - b.x) * PILE_WIDTH_MM) / d;
        const uy = d === 0 ? 0 : ((a.y - b.y) * PILE_HEIGHT_MM) / d;
        const half = need / 2;
        const unitA = unitOf(cur, a);
        const unitB = unitOf(cur, b);
        shiftUnit(unitA, ux * half, uy * half, next);
        shiftUnit(unitB, -ux * half, -uy * half, next);
      }
    }
    moved = next;
  }
}

function settled(pile, cur) {
  const changed = cur.some((e, i) => e.x !== pile[i].x || e.y !== pile[i].y || e.rot !== pile[i].rot);
  return changed ? cur : pile;
}

export function settlePile(pile, uid, from) {
  const cur = pile.map((e) => ({ ...e }));
  const m = cur.find((e) => e.uid === uid);
  if (!m) return pile;
  settleEntries(cur, [m], m, from);
  return settled(pile, cur);
}

export function settleGroup(pile, uids, leaderUid, from) {
  const wanted = new Set(uids);
  const cur = pile.map((e) => ({ ...e }));
  const members = cur.filter((e) => wanted.has(e.uid));
  const leader = members.find((e) => e.uid === leaderUid);
  if (!leader) return pile;
  settleEntries(cur, members, leader, from);
  return settled(pile, cur);
}

// Uids of the stack containing `uid`, in draw order ([] when unknown).
export function unitUids(pile, uid) {
  const start = pile.find((e) => e.uid === uid);
  if (!start) return [];
  const unit = unitOf(pile, start);
  return pile.filter((e) => unit.has(e)).map((e) => e.uid);
}

// Uid of the last-drawn member of each stack of two or more, mapped to the stack size.
export function stackCounts(pile) {
  const counts = new Map();
  const seen = new Set();
  for (const e of pile) {
    if (seen.has(e)) continue;
    const unit = unitOf(pile, e);
    for (const m of unit) seen.add(m);
    if (unit.size < 2) continue;
    const last = pile.findLast((m) => unit.has(m));
    counts.set(last.uid, unit.size);
  }
  return counts;
}
