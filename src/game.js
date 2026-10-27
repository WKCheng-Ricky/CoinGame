import { coinById } from "./coins.js";

export const MAX_RANDOM_PENCE = 999;
export const MAX_CUSTOM_PENCE = 9999;

export function formatPence(n) {
  const pounds = Math.floor(n / 100);
  const pence = n % 100;
  return `£${pounds}.${String(pence).padStart(2, "0")}`;
}

export function total(pile) {
  let sum = 0;
  for (const [id, count] of Object.entries(pile)) {
    sum += coinById(id).pence * count;
  }
  return sum;
}

export function check(pile, target) {
  const sum = total(pile);
  if (sum === target) return "exact";
  return sum > target ? "over" : "under";
}

export function addCoin(pile, id) {
  return { ...pile, [id]: (pile[id] ?? 0) + 1 };
}

export function removeCoin(pile, id) {
  const count = pile[id] ?? 0;
  if (count === 0) return { ...pile };
  const next = { ...pile };
  if (count === 1) delete next[id];
  else next[id] = count - 1;
  return next;
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
