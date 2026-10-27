# Coin Game: Design Spec

Date: 2026-10-27

## Purpose

A lightweight website game, playable on desktop and mobile, where the player
matches a target amount of money by choosing UK coins. Core gameplay: given a
target such as £3.95, assemble coins that add up to exactly that amount.

## Constraints

- Static site: plain HTML, CSS and vanilla JS (ES modules). No backend, no build
  step, no runtime dependencies.
- Works with mouse and touch on desktop and phone-sized screens.
- UK coins only for now (1p, 2p, 5p, 10p, 20p, 50p, £1, £2). Coin set is data,
  so other currencies can be added later.
- Coins are drawn as inline SVG (no image assets).

## Game modes

1. **Custom.** The player types a target amount, then builds any coin
   combination that reaches it. Any combination that sums to the target counts.
2. **Endless.** Random targets, one after another, with a rounds-completed
   counter. The player ends the session at any time via Back. No timer, no
   score beyond the counter.

Random targets are a single range: 1p to £9.99. Custom amounts accept 1p to
£99.99 (the cap is a single constant).

## Screens

A single page with three views, one visible at a time:

1. **Home.** "Endless" and "Custom" buttons.
2. **Custom setup.** Amount field (`inputmode="decimal"`), Start, Back. Invalid
   input shows an inline message. Enter submits.
3. **Play** (shared by both modes), top to bottom in one column:
   - **Target:** large amount, e.g. "£3.95".
   - **Pile:** coins the player has placed, grouped by denomination as stacks
     with a count badge (e.g. "20p ×3"). Tapping a stack removes one coin.
   - **Running total:** "Your total: £2.70", always visible.
   - **Tray:** all 8 coins, unlimited supply, sized by real relative diameter.
     Tapping a coin adds one to the pile.
   - **Actions:** Check (primary), Clear, Back.

On wide screens the tray and pile sit side by side. On phone widths the tray
wraps to two rows of four.

### Check feedback

- **Exact:** success message. Endless offers Next and shows the rounds counter.
  Custom offers Play again (same target) and Change amount. The Check/Clear
  buttons are replaced so the round cannot be re-submitted.
- **Over / under:** gentle hint ("A bit too much" / "Not enough yet"). The pile
  stays so the player can adjust. No penalty.
- An empty pile checks as "under".

### Accessibility and touch

- Coins and stacks are `<button>` elements with labels such as "Add 20p".
- Total and result message use `aria-live`.
- Tap targets are at least 44px; `touch-action: manipulation` prevents
  double-tap zoom.

## Architecture

```
index.html
styles.css
src/
  coins.js     # UK coin data: pence value, label, diameter, shape, colours
  game.js      # pure logic, no DOM
  render.js    # coin SVG drawing + DOM updates
  main.js      # screen switching, event wiring, state
tests/
  game.test.js # Node built-in test runner
```

Only `render.js` and `main.js` touch the DOM. `game.js` and `coins.js` are
importable in Node for testing.

### Money representation

All amounts are integer pence. Pounds are produced only for display, avoiding
floating-point errors.

### `coins.js`

Array of 8 objects, e.g. `{ id: "20p", pence: 20, shape: "heptagon",
diameter: 21.4, ... }`. Shapes: round, heptagon (20p, 50p), 12-sided (£1).
£1 and £2 use a two-tone ring. Designs are simplified colour approximations,
not accurate reproductions of real coin art.

### `game.js` (pure functions)

- `randomTarget(previous, rng = Math.random)`: integer in 1 to 999 pence,
  never equal to `previous` when one is given.
- `parseAmount(text)`: returns pence or an error. Accepts "3.95", "£3.95", "4",
  ".5". Rejects negatives, zero, more than 2 decimals, non-numbers, and values
  above £99.99.
- `total(pile)`: sum in pence.
- `check(pile, target)`: `"exact" | "over" | "under"`.
- `formatPence(n)`: "£3.95", "£0.05", "£10.00".

Every target is reachable because the 1p coin exists.

### State

One plain object in `main.js`: `{ mode, target, pile, rounds }`, where `pile`
maps coin id to count. Each action updates state and calls `render(state)`.
No framework or reactive system.

## Edge cases

- Back mid-round discards the round without confirmation; the Endless rounds
  counter resets when Endless is started again.
- No persistence in v1; reload resets everything.
- Same-target repeat is avoided in Endless.

## Testing

- Unit tests for `game.js` using `node --test` (no test dependency):
  - `parseAmount`: valid forms ("3.95", "£3.95", "4", ".5") and rejects
    (negative, zero, 3 decimals, text, over cap).
  - `check` and `total`: exact, over, under, empty pile.
  - `randomTarget`: always within 1 to 999, using a stub `rng` at the extremes;
    no immediate repeat when a previous target is supplied.
  - `formatPence`: 5 → "£0.05", 395 → "£3.95", 1000 → "£10.00".
- Manual check of both modes end to end in a desktop browser and a phone-sized
  viewport. No browser test framework.

## Out of scope (v1)

Timers, scoring beyond the rounds counter, difficulty levels, persistence,
other currencies, banknotes, sound, and accurate coin artwork.
