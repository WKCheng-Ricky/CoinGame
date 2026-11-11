import { COINS, coinById } from "../constants/coins.js";

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

export function checkAnswer(pile, pence) {
  const result = check(pile, pence);
  if (result === "exact") return "exact";
  return result === "under" ? "over" : "under";
}
