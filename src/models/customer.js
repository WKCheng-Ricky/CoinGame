import { COINS } from "../constants/coins.js";

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

// Give Change mode odds. `underpaid` is the chance a customer underpays: the shortPay option is its percentage (0 is Off).
export function giveChangeOdds(options) {
  return { underpaid: (options.shortPay ?? 0) / 100, exactShare: 1 / 3 };
}
