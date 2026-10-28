const COPPER = "#b87333";
const SILVER = "#c9ccd1";
const GOLD = "#d4af37";

// Lighter and darker tones of each metal, for the inner rim line and the highlight.
const COPPER_SHADE = { light: "#dc9a60", dark: "#7f4c22" };
const SILVER_SHADE = { light: "#f2f4f7", dark: "#80858e" };
const GOLD_SHADE = { light: "#f2d46a", dark: "#8f7016" };

export const COINS = [
  { id: "1p", pence: 1, label: "1p", wording: "ONE PENNY", diameter: 20.3, shape: "round", fill: COPPER, shade: COPPER_SHADE },
  { id: "2p", pence: 2, label: "2p", wording: "TWO PENCE", diameter: 25.9, shape: "round", fill: COPPER, shade: COPPER_SHADE },
  { id: "5p", pence: 5, label: "5p", wording: "FIVE PENCE", diameter: 18.0, shape: "round", fill: SILVER, shade: SILVER_SHADE },
  { id: "10p", pence: 10, label: "10p", wording: "TEN PENCE", diameter: 24.5, shape: "round", fill: SILVER, shade: SILVER_SHADE },
  { id: "20p", pence: 20, label: "20p", wording: "TWENTY PENCE", diameter: 21.4, shape: "heptagon", fill: SILVER, shade: SILVER_SHADE },
  { id: "50p", pence: 50, label: "50p", wording: "FIFTY PENCE", diameter: 27.3, shape: "heptagon", fill: SILVER, shade: SILVER_SHADE },
  { id: "£1", pence: 100, label: "£1", wording: "ONE POUND", diameter: 23.43, shape: "dodecagon", fill: GOLD, ring: SILVER, shade: GOLD_SHADE },
  { id: "£2", pence: 200, label: "£2", wording: "TWO POUNDS", diameter: 28.4, shape: "round", fill: SILVER, ring: GOLD, shade: SILVER_SHADE },
];

const BY_ID = new Map(COINS.map((c) => [c.id, c]));

export function coinById(id) {
  return BY_ID.get(id);
}
