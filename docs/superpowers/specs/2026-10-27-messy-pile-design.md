# Messy pile: Design Spec

Date: 2026-10-27
Builds on: `2026-10-27-coin-game-design.md` and
`2026-10-27-inspect-to-reveal-design.md`
Part 2 of 4. Build order: inspect-to-reveal, then this spec, then draggable
coins (`2026-10-27-drag-coins-design.md`), then cashier mode.

## Purpose

Grouped stacks with "×N" badges are efficient but unlike real life. Coins should
sit in the pile individually, overlapping and slightly jumbled, like coins put
down on a counter. First version: coins simply lie on top of one another with
random offsets and rotations. No physics.

## Requirements

- **One element per coin.** Every coin the player adds appears as its own coin
  in the pile. The "×N" badges and per-denomination stacks are removed.
- **Messy placement.** A new coin lands near the centre of the pile area with a
  small random offset and a random rotation. Later coins are drawn on top of
  earlier ones.
- **Stable.** A coin's position and rotation are fixed when it is added. Adding,
  removing or re-rendering never moves existing coins.
- **Removing.** Tapping/clicking a coin in the pile removes that specific coin.
  Buried coins may be partly covered; the topmost coin is always reachable and
  Clear remains available. Removing a coin never moves the others.
- **Bounds.** Offsets are clamped so a coin's centre stays inside the pile area.
  For large piles coins just overlap more densely. The pile area has a fixed
  height so the layout below it does not jump as coins are added.
- **No coin is ever completely hidden.** Coins may overlap, but the centre of
  every coin in the pile stays uncovered by every coin placed after it. So each
  coin always has a visible, tappable spot and can be seen and counted. This is
  enforced when a coin is placed (see "Nudge" below), not left to chance.
- **Total unaffected.** The total, check result, and every rule in the core spec
  depend only on which coins are in the pile, never on their position.
- **Empty pile.** The existing empty hint is kept.
- **Inspect.** Pile coins follow the same dwell-to-reveal rule as tray coins
  (difficulty setting from the inspect spec).
- **Accessibility.** Each pile coin is a button labelled "Remove 20p". A
  visually hidden summary line (for example "In the pile: 3 × 20p, 1 × £1")
  is kept up to date so screen reader users need not step through every coin.
  The visible running total remains an `aria-live` region.
- **Upright labels.** A coin's shape rotates with `rot`, but its printed value
  stays upright when it is revealed, so it is always readable (including in
  Easy mode).
- **Reduced motion.** New coins appear without a drop animation under
  `prefers-reduced-motion: reduce`; otherwise a short (150 ms) settle animation
  is allowed.

## Design

### Pile data

`pile` changes from `{coinId: count}` to an ordered array of entries:

```
{ uid, coinId, x, y, rot }
```

- `uid`: monotonically increasing integer from state, so the renderer can key
  elements and removal targets exactly one coin.
- `x`, `y`: offset from the pile centre as fractions of the pile area
  (-0.5 to 0.5), already clamped.
- `rot`: degrees, 0 to 359.

Array order is draw order (later on top).

### `src/game.js`

- `total(pile)` sums `coin.pence` over entries.
- `check(pile, target)` unchanged in contract.
- `placeCoin(pile, coin, rng = Math.random)` returns `{ x, y, rot }`. Pure and
  deterministic given `rng`. Offsets are drawn from a bounded range (default
  ±0.35) so coins cluster instead of scattering to the edges.

  **Nudge.** Positions are compared in real millimetres, using each coin's
  `diameter` and the pile area's fixed size (`PILE_WIDTH_MM`, `PILE_HEIGHT_MM`
  constants; the rendered pile coin size uses the same scale). A candidate
  position is *valid* when its distance from the centre of every coin already in
  the pile is at least the new coin's radius. That means the new coin never
  covers an existing coin's centre, so no existing coin can become completely
  hidden, even by several later coins together.

  1. Draw a candidate (x, then y, each uniform within ±range). The first
     `CLUSTER_TRIES = 20` candidates use range ±0.35 so coins cluster; the next
     40 use ±0.5, the whole pile area. Take the first valid candidate.
  2. `MAX_PLACEMENT_TRIES = 60` candidates in total.
  3. If none is valid, use the candidate with the greatest clearance (the
     smallest violation). This only happens when the pile is crowded.
  4. After the position is chosen, draw `rot` (one more `rng()` call).

  **Pile area size.** The area where coin centres may fall is
  `PILE_WIDTH_MM = 110` by `PILE_HEIGHT_MM = 90`. The visible pile box adds a
  margin of `PILE_MARGIN_MM = 14.2` (the largest coin's radius, derived from
  `COINS`) on every side, so a coin centred on the edge of the area still lies
  inside the box and cannot spill out of its panel or off the screen. `x` and
  `y` are fractions of the 110 by 90 centre area.

  **Verified capacity.** A simulation of this algorithm (centre-in-area, 20 then
  40 tries) found no covered centre in 3,000 seeded runs each of 20 £2 coins
  (the worst case), 20 random coins and 12 £2 coins. The first draft of this
  spec (20 tries, ±0.35 only, 90 by 70) failed in 256 of 1,000 runs of 20 £2
  coins, and a 100 by 80 area still failed 3 of 1,000, hence these numbers.
  The guarantee is therefore absolute for at least 20 coins of any mix, which
  covers the cashier mode's 12-coin cap with margin. Beyond about 20 coins (a
  large custom target built from many small coins) the placement is best
  effort, a coin can end up partly or fully covered, and the hidden summary
  line, Clear, and the running total remain the way to keep track (the drag
  spec lets the player move covered coins out).
- `summarisePile(pile)` returns `{coinId: count}` for the screen reader summary
  and any grouped display. Pure.

### `src/state.js`

- `addToPile(state, coinId, rng)` appends an entry with a new `uid`; `rng`
  defaults to `Math.random` so tests can pass a stub.
- `removeFromPile(state, uid)` now removes by `uid` rather than by coin id.
- `clearPile`, solved-state no-ops and the 400 ms advance guard behave as before.

### `src/render.js`

- `renderPile(container, pile)` keeps one button per entry, keyed by `uid`:
  buttons for removed entries are removed, buttons for new entries are appended,
  and untouched buttons are never re-created (so existing coins do not move,
  restart their animation, or lose a dwell in progress). Each button is
  absolutely positioned with `left/top` percentages of the pile box and
  centred with `translate(-50%, -50%)`; the coin's SVG is rotated by `rot`.
  Coin size is `diameter / box width` of the pile box, so the pile scales
  with its container.
- The pile box has a fixed aspect ratio and a maximum width equal to the tray's
  largest coin scale (0.17rem per mm); the badge CSS is deleted.

### `src/main.js`

- Pile click handler reads `data-uid` and calls `removeFromPile`.
- Focus handling after removal moves to the topmost remaining pile coin, or to
  the tray coin of the removed type if the pile is now empty (matching today's
  intent of keeping keyboard flow).

## Edge cases

- Very large piles (custom targets up to £99.99): rendering cost is one small
  SVG per coin. Accepted for v1; the cashier mode caps its handful at 12 coins.
- Rapid taps: each add creates a distinct entry; the existing state guards still
  apply when solved.
- Touch targets: overlapping coins can be smaller than the 44 px guideline in
  effect. The requirement is that every coin has a clickable top-visible region
  and Clear is always available; the 44 px rule continues to apply to tray coins
  and buttons.

## Testing

- `game.js`: `placeCoin` stays within bounds at rng extremes (0 and just under
  1); `total` and `check` with entry arrays, empty pile; `summarisePile` counts.
- `placeCoin` nudge: with a stub `rng` whose first draws land on an existing
  coin's centre, the result is a different, valid position; with the pile
  built from 20 of the largest coins using a seeded `rng`, every coin's centre
  is uncovered by all later coins; when no valid spot exists after the retry
  cap, it returns the least-bad candidate rather than failing; same `rng`
  sequence gives the same result.
- `state.js`: `addToPile` appends with increasing `uid` and keeps earlier entries
  untouched; `removeFromPile` removes only the matching `uid`; unknown `uid` is
  a no-op returning the same object; solved state remains read-only.
- `render.js`: one button per entry, in order; `aria-label`s; no badge markup.
- Manual: add 10+ coins and confirm the pile stays inside its area and the page
  does not shift; remove a middle coin and confirm the others do not move.

## Out of scope

Dragging coins is covered by its own spec (`2026-10-27-drag-coins-design.md`).

Physics or collision, coins sliding off the pile, true 3D
stacking, sound.
