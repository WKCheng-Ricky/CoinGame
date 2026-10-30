# Large Coins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global **Large Coins** option that draws every coin `LARGE_COIN_SCALE` times bigger while every pile and the tray keep their on-screen size.

**Architecture:** A module-level `coinScale` in `src/game.js` (default 1) scales coin diameters and the pile margin; the pile box stays a fixed size, so the play area shrinks. `main.js` sets the scale from `state.options` before anything is placed; CSS reads `--coin-scale` for the grid. At scale 1 every function returns what it did before.

**Tech Stack:** Vanilla ES modules, `node --test` (jsdom for DOM tests). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-large-coins-design.md`

**State of the branch:** the code for Tasks 1-3 was written as a first try and sits uncommitted on `feature/large-coins`, with the existing tests already updated. Each task below adds the tests the first try lacks, checks the code against the spec, and commits that task's files. The "known issues" in the spec are **not** in this plan; they follow once the scale has been tried by eye.

## Global Constraints

- Option id `largeCoins`, label "Large Coins", hint "Bigger coins, so fewer fit in the pile", `scope: "all"`, `default: false`.
- `LARGE_COIN_SCALE = 1.5`, one constant in `src/config.js`.
- Exported `PILE_WIDTH_MM` (110), `PILE_HEIGHT_MM` (90), `PILE_MARGIN_MM` keep their values.
- At scale 1 behaviour and layout are identical to today.
- Not saved between visits. No new e2e specs (standing decision).
- Commit messages use conventional commits (`feat:`, `test:`, `docs:`) and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A pile with the option on and many coins (a large Endless or Custom amount, e.g. £99.99): placement must not throw or loop, and falls back to the least-overlapping spot.
- Toggling Large Coins off after playing with it on: the next game must be fully back to scale 1 (tray, piles, grid).
- Switching the option while a pile is already drawn: no stale coin sizes survive the redraw.
- A coin dragged from the tray to a pile at scale 1.5 lands where the pointer is, not offset by the margin change.
- `setCoinScale` left at a non-1 value must not leak into other tests (tests reset it).

---

### Task 1: Option, config and state shape

**Files:**
- Modify: `src/options.js`, `src/config.js`
- Test: `tests/options.test.js`, `tests/config.test.js`, `tests/state.test.js`, `tests/home.dom.test.js`

**Interfaces:**
- Produces: option id `"largeCoins"` in `OPTIONS` / `defaultOptions()` (between `showCoins` and `shortPay`); `LARGE_COIN_SCALE: number`; `coinScaleFor(options: {largeCoins?: boolean}) -> number` in `src/config.js`.

- [ ] **Step 1: Confirm the tests exist and assert the spec's values.** `options.test.js`: defaults `{ showCoins: false, largeCoins: false, shortPay: true }`, `optionsFor("endless")` is `["showCoins", "largeCoins"]`, `optionsFor("give-change")` adds `"shortPay"` last. `state.test.js` `createState` shape includes `largeCoins: false`. `home.dom.test.js` lists the checkbox for every mode and its hint.
- [ ] **Step 2: Tighten `config.test.js`.** Replace the dynamic `import()` in the `coinScaleFor` test with a top-level import, and add: `coinScaleFor({})` is 1 (option absent) and `LARGE_COIN_SCALE` is greater than 1.
- [ ] **Step 3: Run** `npm test`. Expected: all pass.
- [ ] **Step 4: Commit** `src/options.js src/config.js tests/options.test.js tests/config.test.js tests/state.test.js tests/home.dom.test.js` as `feat: add the Large Coins option and its scale constant`.

### Task 2: Scale-aware pile geometry

**Files:**
- Modify: `src/game.js`, `src/state.js`
- Test: `tests/game.test.js`

**Interfaces:**
- Produces in `src/game.js`: `setCoinScale(k: number) -> void`; `getCoinScale() -> number`; `diameterOf(coin) -> number` (diameter × scale); `pileMarginMm() -> number`; `pileWidthMm() -> number`; `pileHeightDefaultMm() -> number`. `state.js` `pileHeightMm` returns `pileHeightDefaultMm()` outside Give Change.
- Invariant: `pileWidthMm() + 2 * pileMarginMm()` and `pileHeightDefaultMm() + 2 * pileMarginMm()` are constant at every scale (the box size).

- [ ] **Step 1: Write failing tests in `tests/game.test.js`**, each ending with `setCoinScale(1)` in a `finally`:
  - at scale 1: `pileMarginMm() === PILE_MARGIN_MM`, `pileWidthMm() === PILE_WIDTH_MM`, `pileHeightDefaultMm() === PILE_HEIGHT_MM`, `diameterOf(coin) === coin.diameter`.
  - at scale 1.5: `diameterOf` is 1.5 × diameter; box width and height are unchanged (the invariant above); `getCoinScale()` is 1.5.
  - `placeCoin` at scale 1.5 with a seeded rng: 30 coins placed one after another all stay within ±0.5 on both axes.
  - `placeCoin` at scale 1.5 puts two coins at least `(r1 + r2)` scaled mm apart when there is free room (empty pile, then one coin).
  - `pileHeightMm({ mode: "endless" })` in `state.test.js` equals `pileHeightDefaultMm()` at scale 1.5.
- [ ] **Step 2: Run** `node --test tests/game.test.js tests/state.test.js`. Expected: new tests fail only if the code is wrong; if the first-try code already passes, deliberately break `diameterOf` (return `coin.diameter`) to see the placement test fail, then restore it.
- [ ] **Step 3: Review `src/game.js` against the invariant above.** Every use of the play-area width, the margin and the default height inside the file goes through the three functions, not the base constants. Fix any that do not.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `src/game.js src/state.js tests/game.test.js tests/state.test.js` as `feat: scale coin diameters and the play area with the coin scale`.

### Task 3: Drag, rendering, app wiring and CSS

**Files:**
- Modify: `src/drag.js`, `src/render.js`, `src/main.js`, `styles.css`
- Test: `tests/drag.test.js`, `tests/render.dom.test.js`

**Interfaces:**
- Consumes: Task 2's `diameterOf`, `pileMarginMm`, `pileWidthMm`, `pileHeightDefaultMm`, `setCoinScale`, `getCoinScale`; Task 1's `coinScaleFor`.
- Produces: `main.js` `applyCoinScale(options)` (called first in `update`); root CSS custom property `--coin-scale`; coin buttons' `--d` is the scaled diameter.

- [ ] **Step 1: Write failing tests.**
  - `drag.test.js`: at scale 1.5, `coinSizePx(coin, rect)` is 1.5 × its scale-1 value; `toPileFraction` and `pixelsToFraction` invert `pileBox` (a point from `pileBox({x, y})` maps back to `{x, y}` within 1e-9) at scale 1.5 and at scale 1.
  - `render.dom.test.js`: a coin rendered at scale 1.5 has `--d` equal to `1.5 * coin.diameter`; `--pile-w-mm` and `--pile-h-mm` on the pile container are the same at scale 1 and 1.5 for one height.
  - Both reset the scale to 1 in a `finally`.
- [ ] **Step 2: Run** `node --test tests/drag.test.js tests/render.dom.test.js`. Expected: new tests pass with the first-try code (or fail, showing a missed scale site; fix it).
- [ ] **Step 3: Review the wiring by reading.** `applyCoinScale` returns early when the scale is unchanged, and otherwise sets the scale, sets `--coin-scale` on `document.documentElement`, calls `renderTray`, and clears `shownPile` and `shownChange`. Toggling the option off sets the property back to 1. `styles.css` multiplies `--cell-w`, `--cell-h` (pile) and `--cell` (tray) by `var(--coin-scale, 1)`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Verify by eye.** `npm start` (or reuse a server already on port 4173); at 390 × 844 open Give Change and Endless with Large Coins off and on. Expected: with it on, coins are bigger and boxes are the same size; off restores today's look exactly; dragging a coin from the tray keeps its size. The clipping in short piles is a known issue (spec) and not a failure here.
- [ ] **Step 6: Commit** `src/drag.js src/render.js src/main.js styles.css tests/drag.test.js tests/render.dom.test.js` as `feat: draw and drag coins at the Large Coins scale`.

### Task 4: Spec and hand-off

**Files:**
- Add: `docs/superpowers/specs/2026-10-30-large-coins-design.md`, `docs/superpowers/plans/2026-10-30-large-coins.md`

- [ ] **Step 1: Run** `npm test && npm run test:coverage`. Expected: all pass and the per-file 80% thresholds still hold (`src/main.js` is excluded).
- [ ] **Step 2: Commit** the spec and this plan as `docs: add the Large Coins design spec and plan`.
- [ ] **Step 3: Report** the result and the open decision (how to fix clipping: smaller margin when scaled, or taller Give Change boxes) so the follow-up can be planned after the scale is tried.
