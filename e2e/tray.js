import { COINS } from "../src/constants/coins.js";

const LARGEST_FIRST = [...COINS].sort((a, b) => b.pence - a.pence);

export function parsePounds(text) {
  const m = /£(\d+)\.(\d{2})/.exec(text);
  if (!m) throw new Error(`Not an amount: "${text}"`);
  return Number(m[1]) * 100 + Number(m[2]);
}

// Tap tray coins (largest first) until `pence` has been added; returns the number of coins tapped.
export async function addFromTray(page, pence) {
  let left = pence;
  let taps = 0;
  for (const coin of LARGEST_FIRST) {
    while (left >= coin.pence) {
      await page.getByRole("button", { name: `Add ${coin.label}`, exact: true }).click();
      left -= coin.pence;
      taps++;
    }
  }
  return taps;
}
