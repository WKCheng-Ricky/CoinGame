const COPPER = "#b87333";
const SILVER = "#c9ccd1";
const GOLD = "#d4af37";

export const COINS = [
  { id: "1p", pence: 1, label: "1p", diameter: 20.3, shape: "round", fill: COPPER },
  { id: "2p", pence: 2, label: "2p", diameter: 25.9, shape: "round", fill: COPPER },
  { id: "5p", pence: 5, label: "5p", diameter: 18.0, shape: "round", fill: SILVER },
  { id: "10p", pence: 10, label: "10p", diameter: 24.5, shape: "round", fill: SILVER },
  { id: "20p", pence: 20, label: "20p", diameter: 21.4, shape: "heptagon", fill: SILVER },
  { id: "50p", pence: 50, label: "50p", diameter: 27.3, shape: "heptagon", fill: SILVER },
  { id: "£1", pence: 100, label: "£1", diameter: 23.43, shape: "dodecagon", fill: GOLD, ring: SILVER },
  { id: "£2", pence: 200, label: "£2", diameter: 28.4, shape: "round", fill: SILVER, ring: GOLD },
];

const BY_ID = new Map(COINS.map((c) => [c.id, c]));

export function coinById(id) {
  return BY_ID.get(id);
}
