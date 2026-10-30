export const MODE_IDS = ["endless", "custom", "cashier", "give-change"];

export const EFFECTS = ["easier", "harder", "neutral"];

// A new option is one entry here plus the logic that reads it. `scope` is "all" or the modes it applies to.
// `effect` is what turning the option on does to the difficulty; `why` is the line shown under the label.
export const OPTIONS = [
  { id: "showCoins", label: "Show Coins", icon: "eye", chip: "Show Coins", hint: "Show every coin's value", effect: "easier", why: "Easier: every coin's value is shown", scope: "all", default: false },
  { id: "largeCoins", label: "Large Coins", icon: "enlarge", chip: "Large Coins", hint: "Bigger coins, so fewer fit in the pile", effect: "neutral", why: "Neutral: bigger coins, but fewer fit", scope: "all", default: false },
  {
    id: "autoStack", label: "Auto-stack", icon: "layers", chip: "Auto-stack", hint: "Matching coins are stacked and spread apart", effect: "easier",
    why: "Easier: matching coins are stacked and kept apart", scope: ["cashier", "give-change"], default: true,
  },
  { id: "shortPay", label: "Short-paying customers", icon: "coin-down", chip: "Short-paying", hint: "Customers may not pay enough", effect: "harder", why: "Harder: customers may not pay enough", scope: ["give-change"], default: true },
  {
    id: "timerScore", label: "Timer and Score", icon: "stopwatch", chip: "Timer", hint: "Time each question and score your speed", effect: "neutral",
    why: "Neutral: times each question and scores your speed", scope: ["endless", "cashier", "give-change"], default: true,
  },
  {
    id: "timeLimit", label: "Time Limit", icon: "hourglass", chip: "Limit", hint: "Run out of time and the customer leaves", effect: "harder",
    why: "Harder: each question has a time limit", scope: ["endless", "cashier", "give-change"], default: 0,
    choices: [{ value: 0, label: "Off" }, { value: 30, label: "30 s" }, { value: 20, label: "20 s" }, { value: 10, label: "10 s" }],
  },
];

// A checkbox option holds a boolean; one with `choices` holds the value of one of them.
export function isValidValue(id, value) {
  const option = OPTIONS.find((o) => o.id === id);
  if (!option) return false;
  return option.choices ? option.choices.some((c) => c.value === value) : typeof value === "boolean";
}

// A time limit needs the timer, so choosing one switches Timer and Score on whatever it was set to.
export const isForcedOn = (id, options) => id === "timerScore" && options.timeLimit > 0;

// Whether rounds are timed and scored.
export const timerOn = (options) => Boolean(options.timerScore) || options.timeLimit > 0;

// Difficulty presets: each sets exactly these five options (never Large Coins). Normal is the default.
export const PRESETS = [
  { id: "easy", label: "Easy", values: { showCoins: true, autoStack: true, shortPay: false, timerScore: false, timeLimit: 0 } },
  { id: "normal", label: "Normal", values: { showCoins: false, autoStack: true, shortPay: true, timerScore: true, timeLimit: 0 } },
  { id: "hard", label: "Hard", values: { showCoins: false, autoStack: false, shortPay: true, timerScore: true, timeLimit: 30 } },
  { id: "veryHard", label: "Very hard", values: { showCoins: false, autoStack: false, shortPay: true, timerScore: true, timeLimit: 10 } },
];

// The preset the options match, or null. Timer and Score counts as on whenever a time limit is set.
export function presetOf(options) {
  const effective = { ...options, timerScore: timerOn(options) };
  return PRESETS.find((p) => Object.entries(p.values).every(([key, value]) => effective[key] === value))?.id ?? null;
}

export function defaultOptions() {
  return Object.fromEntries(OPTIONS.map((o) => [o.id, o.default]));
}

export function optionsFor(mode) {
  return OPTIONS.filter((o) => o.scope === "all" || o.scope.includes(mode));
}

export function isOptionId(id) {
  return OPTIONS.some((o) => o.id === id);
}
