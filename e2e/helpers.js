import { COINS } from "../src/coins.js";

// Short waits so tests do not sit through the real 2 s dwell, 1 s hold and 400 ms Next guard.
export const FAST = "dwell=50&hold=50&advance=250";

// Replace Math.random in the tab with a seeded mulberry32 before the page loads (test-only).
export async function seedRandom(page, seed = 1) {
  await page.addInitScript((initial) => {
    let a = initial >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
}

// Sum the page's own pile summary ("On the counter: 2 × 20p, 1 × £1") in pence.
export async function counterTotalPence(page) {
  const text = await page.locator("#play-pile-summary").textContent();
  let sum = 0;
  // describePile writes each coin's id ("20p", "£1")
  for (const [, count, id] of text.matchAll(/(\d+) × ([^,\s]+)/g)) {
    const coin = COINS.find((c) => c.id === id);
    if (!coin) throw new Error(`Unknown coin "${id}" in "${text}"`);
    sum += Number(count) * coin.pence;
  }
  return sum;
}

// Open Home with fast timings and start a mode by its Home button.
export async function startMode(page, name) {
  await page.goto("/?" + FAST);
  await page.getByRole("button", { name, exact: true }).click();
}
