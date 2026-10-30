# Large Coins option: Design Spec

Date: 2026-10-30
Builds on: `2026-10-30-menu-and-options-design.md`,
`2026-10-28-coin-visuals-and-layout-design.md`

## Purpose

Make the game more accessible to players who find the coins small to see or tap.
A new global option, **Large Coins**, draws every coin bigger while every pile
keeps the same footprint on screen. The pile then represents a smaller real-world
area, so fewer coins fit in it.

Coins keep their true size relative to each other (a 2p stays bigger than a 1p),
so the lesson is unchanged; only the zoom changes.

The scale is an experiment: the factor is one tunable constant, and how far to
take it (and how to fit big piles) is decided after trying it. This spec covers
the option and the scaling mechanism, not the final factor.

## Requirements

- **Options** gains a global checkbox **Large Coins** (hint: "Bigger coins, so
  fewer fit in the pile"), off by default, available in every mode. It is not
  saved between visits, like the other options.
- With it on, in every mode:
  - Every coin on a pile and in the tray is drawn `LARGE_COIN_SCALE` times
    bigger (start: 1.5).
  - Pile boxes and the tray keep their width on screen, and stay close to their
    height: the default pile (Endless, Custom, Cashier) is 7 grid cells high
    (about 7.9 unscaled) and both Give Change boxes ("Customer Coins" and "Your
    change") are 3 cells (about 3.3). A cell is 10 mm of coin, so a box is
    `cells * 10 * k` mm tall (`LARGE_BOX_CELLS` in `src/game.js`).
  - The Large Coins tray is about 5 grid cells high instead of 6: its second row
    tucks up into the gaps under the first (CSS, in proportion to `k - 1`).
  - Placement, overlap, stacking and push-apart treat coins at the scaled size,
    so coins do not overlap more than they do today.
  - The 1 cm graph paper scales with the coins, so a grid square is still 1 cm
    of coin.
  - Dragging, tray drops and stack detaching work as today, and a coin keeps
    its size when dragged between tray and pile.
- With it off, behaviour and layout are identical to today.
- Toggling the option takes effect at the next Play (options are set on the
  home screen), and redraws the tray and piles at the new size.

## Design

### Option and config

- `src/options.js`: registry entry `{ id: "largeCoins", label: "Large Coins",
  hint, scope: "all", default: false }`.
- `src/config.js`: `LARGE_COIN_SCALE = 1.5` (tune here) and
  `coinScaleFor(options)`, which returns 1, or `LARGE_COIN_SCALE` with the option
  on.

### Geometry (`src/game.js`)

The pile's coordinate space is unchanged: positions stay 0 to 1 fractions of the
play area, so drag maths and saved positions need no change. Instead the play
area shrinks as the coins grow, inside a box that never changes size.

- Module setting `coinScale` (default 1) with `setCoinScale(k)` and
  `getCoinScale()`.
- `diameterOf(coin)` is the diameter times the scale. Placement clearance and
  the settle radius use it.
- `pileMarginMm()` is `PILE_MARGIN_MM * scale`, the margin of one biggest coin's
  radius around the play area.
- `pileWidthMm()` and `pileHeightDefaultMm()` are the box less the scaled
  margins, so the box's total width is fixed. The box height is `pileBoxMm()`
  (118.4 mm at scale 1; `LARGE_BOX_CELLS.pile` cells when large) and the Give
  Change boxes are `customerBoxMm()` and `changeBoxMm()` (50 mm each;
  `LARGE_BOX_CELLS.customer` and `.change` cells when large).
  `heightForBox` subtracts the margin and never goes below
  `MIN_PLAY_HEIGHT_MM` (1 mm), so a short box cannot flip the vertical axis.
- The exported base constants (`PILE_WIDTH_MM`, `PILE_HEIGHT_MM`,
  `PILE_MARGIN_MM`) keep their values; at scale 1 every function returns what it
  returned before, so existing callers and tests are unaffected.

### Drag (`src/drag.js`)

`BOX_W_MM` stays constant (the box size). The pixel-to-fraction functions and
`coinSizePx` use `pileWidthMm()`, `pileMarginMm()` and `diameterOf`.

### Rendering and app (`src/render.js`, `src/main.js`, `styles.css`)

- Coin buttons set `--d` to the scaled diameter, so pile coins (`--d` over the
  box width) and tray coins (`--d` times `--mm`) both grow.
- `main.js` `applyCoinScale(options)` runs at the top of `update()`. On a change
  it calls `setCoinScale`, sets `--coin-scale` on the root, rebuilds the tray and
  forces both piles to redraw. Because options only change on the home screen,
  the scale is set before any coin is placed.
- CSS multiplies the grid cell sizes (pile and tray) by `var(--coin-scale, 1)`.

## Known issues from the first try (scale 1.5, phone width)

To resolve after experimenting; not part of the first change.

1. **Short piles clip.** The Give Change boxes are 5 cm; the scaled margin leaves
   about 7 mm of play height, so big coins sit on the box's top and bottom edges
   and overflow it. Options: shrink the margin when scaled (coins may overhang
   the edge slightly), or make those boxes a little taller.
2. **Tray crowding.** The £1 and £2 almost fill their column at 1.5; larger
   scales would overflow. The tray needs a smaller `--mm` or fewer columns.
3. **Layout shift.** The gap between the Give Change piles changes slightly with
   the option on.
4. **Capacity.** A large pile (many coins) may not fit without overlap. Placement
   falls back to the least-overlapping spot, as today; whether to cap the option
   or the dealt amount is open.

## Testing

- Unit: `coinScaleFor`; the options registry, defaults and Home checkbox list
  (existing tests updated for the new entry); `createState` shape.
- Still to add: scaled placement stays in bounds with no overlap; at scale 1 the
  new geometry functions equal the old constants.
- Checked by eye at 390 × 844 in Give Change, on and off.
- No new e2e (see the standing decision to leave e2e for later).

## Out of scope

- A user-chosen size slider or several sizes.
- Final scale, and fixes for the known issues above.
- Saving the option between visits.
