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

export function describePile(pile) {
  const counts = summarisePile(pile);
  const parts = COINS.filter((c) => counts[c.id]).map((c) => `${counts[c.id]} × ${c.id}`);
  return parts.length ? `In the pile: ${parts.join(", ")}` : "The pile is empty.";
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

export function pileBox({ x, y }) {
  const boxW = PILE_WIDTH_MM + 2 * PILE_MARGIN_MM;
  const boxH = PILE_HEIGHT_MM + 2 * PILE_MARGIN_MM;
  return {
    left: ((PILE_MARGIN_MM + (0.5 + x) * PILE_WIDTH_MM) / boxW) * 100,
    top: ((PILE_MARGIN_MM + (0.5 + y) * PILE_HEIGHT_MM) / boxH) * 100,
  };
}
