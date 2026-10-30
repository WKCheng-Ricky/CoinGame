export const MODE_IDS = ["endless", "custom", "cashier", "give-change"];

// A new option is one entry here plus the logic that reads it. `scope` is "all" or the modes it applies to.
export const OPTIONS = [
  { id: "showCoins", label: "Show Coins", hint: "Show every coin's value", scope: "all", default: false },
  { id: "largeCoins", label: "Large Coins", hint: "Bigger coins, so fewer fit in the pile", scope: "all", default: false },
  { id: "shortPay", label: "Short-paying customers", hint: "Customers may not pay enough", scope: ["give-change"], default: true },
];

export function defaultOptions() {
  return Object.fromEntries(OPTIONS.map((o) => [o.id, o.default]));
}

export function optionsFor(mode) {
  return OPTIONS.filter((o) => o.scope === "all" || o.scope.includes(mode));
}

export function isOptionId(id) {
  return OPTIONS.some((o) => o.id === id);
}
