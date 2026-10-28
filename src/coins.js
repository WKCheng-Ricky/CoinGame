
// Lighter and darker tones of each metal, for the inner rim line and the highlight.
const COPPER_SHADE = { light: "#dc9a60", dark: "#7f4c22" };
const SILVER_SHADE = { light: "#f2f4f7", dark: "#80858e" };
const GOLD_SHADE = { light: "#f2d46a", dark: "#8f7016" };

// wording: where the inscription sits, read from the reference photos. `at` is the centre of the text in
// degrees clockwise from the top; `flow` is "outer" (tops outward, reads clockwise), "upright" (along the
// bottom, tops toward the centre, reads left to right) or "straight" (one horizontal line, `at` unused).
// numeralY, numeralSize: the 5p's numeral sits below the middle (its straight wording runs across it), smaller so it stays inside the rim line.
// metal / discMetal name the theme variables (--metal-<name>) that colour the body and the £1 and £2's inner
// disc.
export const COINS = [
  { id: "1p", pence: 1, label: "1p", wording: { text: "ONE PENNY", at: 270, flow: "outer" }, diameter: 20.3, shape: "round", metal: "copper", shade: COPPER_SHADE },
  { id: "2p", pence: 2, label: "2p", wording: { text: "TWO PENCE", at: 0, flow: "outer" }, diameter: 25.9, shape: "round", metal: "copper", shade: COPPER_SHADE },
  { id: "5p", pence: 5, label: "5p", numeralY: 72, numeralSize: 22, wording: { text: "FIVE PENCE", flow: "straight" }, diameter: 18.0, shape: "round", metal: "silver", shade: SILVER_SHADE },
  { id: "10p", pence: 10, label: "10p", wording: { text: "TEN PENCE", at: 0, flow: "outer" }, diameter: 24.5, shape: "round", metal: "silver", shade: SILVER_SHADE },
  { id: "20p", pence: 20, label: "20p", wording: { text: "TWENTY PENCE", at: 90, flow: "outer" }, diameter: 21.4, shape: "heptagon", metal: "silver", shade: SILVER_SHADE },
  { id: "50p", pence: 50, label: "50p", wording: { text: "FIFTY PENCE", at: 180, flow: "upright" }, diameter: 27.3, shape: "heptagon", metal: "silver", shade: SILVER_SHADE },
  { id: "£1", pence: 100, label: "£1", wording: { text: "ONE POUND", at: 180, flow: "upright" }, diameter: 23.43, shape: "dodecagon", metal: "gold", discMetal: "silver", shade: GOLD_SHADE },
  { id: "£2", pence: 200, label: "£2", wording: { text: "TWO POUNDS", at: 300, flow: "outer" }, diameter: 28.4, shape: "round", metal: "gold", discMetal: "silver", shade: GOLD_SHADE },
];

const BY_ID = new Map(COINS.map((c) => [c.id, c]));

export function coinById(id) {
  return BY_ID.get(id);
}
