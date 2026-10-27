# Tray Drag and Stack Count Implementation Plan

> **Status:** implemented. Changed later: `STACK_LINK_MM` is 3 (not 2.5), and dragging a stack coin now moves the whole stack. Current source of truth: `docs/superpowers/specs/2026-10-27-drag-coins-design.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a `×N` count badge on the top coin of every stack, and let the player drag a coin from the tray into the pile (a copy follows the pointer; the coin is added where it is released and settles like any moved coin).

**Architecture:** Pure pieces first (`stackCounts` in `game.js`, `addToPileAt` in `state.js`, `pointInRect` / `coinSizePx` in `drag.js`). Then the badge in `renderPile`. Then `createTrayDrag` (same file as `createDrag`) and its `main.js` wiring, reusing the land, style flush, settle two-step already used for moves.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node built-in test runner (`node --test`). No dependencies.

**Spec:** `docs/superpowers/specs/2026-10-27-drag-coins-design.md` (sections "Drag a coin from the tray into the pile", "Stack count", and "Add from the tray and the stack count"). This plan extends the already-implemented plan `2026-10-27-drag-coins.md`; the existing code (`createDrag`, `moveAndRefocus`, `settlePile`, `settleCoin`, `renderPile`) is the base.

## Global Constraints

- Static site: plain HTML, CSS, vanilla JS ES modules. No backend, no build step, no dependencies.
- Pile entry shape stays `{ uid, coinId, x, y, rot }`; `x`, `y` clamped to ±0.5; array order is draw order; uids are never reused (`nextUid` only increases within a round).
- Stack = connected component of same-denomination coins whose centres are within `STACK_LINK_MM = 2.5` of each other (the existing `unitOf` in `game.js`; reuse it, do not duplicate it). The badge goes on the member that is last in draw order; units of size 1 get none.
- `DRAG_THRESHOLD_PX = 6`; only the first pointer drags; the click after a drag is swallowed (flag cleared on the next pointerdown, on the swallowed click and on keydown, and not cleared by a second finger while a pointer is tracked); a starting drag cancels the pending dwell timer; locked (solved) boards ignore drags.
- A tap on a tray coin still adds at a random spot via `addToPile`; adding by drop uses `addToPileAt` followed by `settleCoin(state, uid, null)` after a style flush (land where released, then glide). Settling must not run inside `addToPileAt`.
- Released with the pointer outside the pile rect: nothing is added. Inside: the coin centre is `toPileFraction(...)`, clamped by `clampPosition`.
- Tray coins use `touch-action: none` and `cursor: grab`; the dragged copy is `position: fixed`, `pointer-events: none`, `aria-hidden`, sized from the pile's drawn width, and removed on drop, cancel, lost capture or a stuck pointer; no `dragging` or ghost state may remain after any path.
- The badge is `×N` (multiplication sign, not the letter x), `aria-hidden`, `pointer-events: none`, upright, lower right of the coin, visible in Normal and Easy. The top coin's `aria-description` is `Stack of N. Use arrow keys to move`; other pile coins keep `Use arrow keys to move`.
- `game.js`, `state.js` and `drag.js` stay importable in Node (no top-level DOM access). Only `render.js`, `main.js` and the pointer glue touch the DOM.
- Moving, settling or counting never changes the total, the check result or the rounds counter; adding by drop raises the total by exactly the coin's value.
- Commits use Conventional Commits and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A tray drag that ends outside the pile, is cancelled, loses capture, or is a second finger must leave no ghost and add nothing; a tap that moves 6 px or less must still add at a random spot.
2. After a tray drag, a later tap on a tray coin and a later Enter/Space must still add a coin (the swallow flag must not linger or eat the next real click); the touch hold-then-release add in `main.js` must not also fire after a drag.
3. The badge must follow the stack: dragging a middle coin to the front moves the badge, splitting a stack of two removes it, removing the top coin moves it to the next, and two separate stacks of one denomination each show their own count.
4. A coin dropped exactly on a stack, on a different coin, partly over the pile edge, and on the dashed border must all behave (stack, push, clamp, accepted/rejected per the pointer-in-rect rule) with no NaN and no duplicate uid.
5. Locked boards: no tray drag starts after the round is solved, and a drag in progress when the round is solved (second finger on Check) adds nothing.

---

## File Structure

- Modify `src/game.js`: `stackCounts`.
- Modify `src/state.js`: `addToPileAt`.
- Modify `src/drag.js`: `pointInRect`, `coinSizePx`, `createTrayDrag`.
- Modify `src/render.js`: badge and `aria-description` from `stackCounts`.
- Modify `src/main.js`, `styles.css`, `README.md`.
- Tests: `tests/game.test.js`, `tests/state.test.js`, `tests/drag.test.js`.

---

### Task 1: Pure pieces

**Files:**
- Modify: `src/game.js`, `src/state.js`, `src/drag.js`
- Test: `tests/game.test.js`, `tests/state.test.js`, `tests/drag.test.js`

**Interfaces:**
- Consumes: `unitOf`, `STACK_LINK_MM`, `clampPosition`, `PILE_WIDTH_MM`, `PILE_MARGIN_MM`, `STACK_STEP_MM` (game.js); `COINS` / `coinById` (coins.js); the state shape from `state.js`.
- Produces:
  - `stackCounts(pile) -> Map<number, number>` in `game.js`: uid of the last-in-draw-order member of each stack of two or more, mapped to the stack size. Empty map for an empty or all-single pile.
  - `addToPileAt(state, coinId: string, x: number, y: number, rng = Math.random) -> state` in `state.js`: the new entry is `{ uid: state.nextUid, coinId, x, y (clamped), rot: Math.floor(rng() * 360) }`, appended last, `nextUid + 1`, message cleared. Does not settle. Returns the same state object when `state.solved` or `coinId` is not a known coin.
  - `pointInRect({x, y}, {left, top, width, height}) -> boolean` (edges inclusive) and `coinSizePx(coin, pileRect) -> number` in `drag.js`: `coin.diameter / (PILE_WIDTH_MM + 2 * PILE_MARGIN_MM) * pileRect.width`.

- [ ] **Step 1: Write the failing tests**

`tests/game.test.js`, `stackCounts` with hand-built piles (ids `"20p"`, `"50p"`; `STEP_X = STACK_STEP_MM.x / PILE_WIDTH_MM`, `STEP_Y = STACK_STEP_MM.y / PILE_HEIGHT_MM`):
- empty pile and a pile of three far-apart coins: empty map.
- two 20p at `(0,0)` and `(STEP_X, STEP_Y)` (uids 1, 2): map has exactly `uid 2 -> 2`.
- three 20p chained by the step (uids 1, 2, 3): `uid 3 -> 3` only.
- the badge follows draw order: the same two-coin stack with array order `[uid 2, uid 1]` gives `uid 1 -> 2`.
- two separate 20p stacks far apart: two entries, each `-> 2`.
- a 20p and a 50p at the same spot: empty map (different denominations never count together).
- a 20p stack with a different coin between layers in the array: still one entry for the last 20p.

`tests/state.test.js`, `addToPileAt` on `createState()`-based hand-built states:
- adds one entry with `uid === old nextUid`, `nextUid` advanced by one, the given `coinId`, `rot` from a stub `rng` (`() => 0.5` gives 180), position equal to `(x, y)`, appended last; other entries deeply equal.
- clamps: `(5, -5)` gives `(0.5, -0.5)`; `(NaN, 0)` gives `x === 0`.
- `total(pile)` rises by exactly the coin's pence; message cleared; `target`, `rounds` unchanged.
- unknown `coinId` returns the same object; solved state returns the same object.
- does not settle: dropping a 20p exactly on an existing 20p leaves the new entry at exactly the given position.
- uids never reused: add, remove that coin, add again gives a fresh uid.

`tests/drag.test.js`:
- `pointInRect`: inside true; each of the four edges true; just outside each edge false.
- `coinSizePx`: for the largest and smallest coin in `COINS` with `pileRect.width = 300`, equals `diameter / (110 + 2 * 14.2) * 300` within 1e-9, and the largest is bigger than the smallest.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL (`stackCounts`, `addToPileAt`, `pointInRect`, `coinSizePx` do not exist).

- [ ] **Step 3: Implement** the four exports. `stackCounts` walks the pile once, builds each unit with the existing `unitOf` (so it uses the same link rule as settling; handle the fact that it works on entry objects), and records the last member in array order. Keep `addToPileAt` free of any import beyond what `state.js` already uses plus `clampPosition`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/game.js src/state.js src/drag.js tests/game.test.js tests/state.test.js tests/drag.test.js
git commit -m "feat: add stack counts, add-at-position and tray drag geometry"
```

---

### Task 2: Stack count badge

**Files:**
- Modify: `src/render.js`, `styles.css`

**Interfaces:**
- Consumes: `stackCounts(pile)` from Task 1; `renderPile(container, pile)` (called only when `state.pile` changes).
- Produces: pile coin buttons carry a `.stack-badge` child with text `×N` exactly when they are the top of a stack, and an `aria-description` of `Stack of N. Use arrow keys to move` for them (`Use arrow keys to move` otherwise).

- [ ] **Step 1: Implement in `renderPile`**: after reconciling coins, compute `stackCounts(pile)` once; for each pile coin, add, update or remove its `.stack-badge` span (`textContent = "×" + n`, `aria-hidden="true"`) and set `aria-description` accordingly. Do not rebuild a button just to change its badge (keyed reconcile and focus must survive), and do not touch the `settle` class logic.
- [ ] **Step 2: CSS** (`styles.css`): `.stack-badge` is absolutely positioned at the coin's lower right (`right`/`bottom` a few px inside the button, which has no rotation), small bold text, high-contrast pill (readable on every coin colour), `pointer-events: none`, `user-select: none`, not rotated, `z-index` above the coin's own svg only. It must not change the button's hit area.
- [ ] **Step 3: Verify**

Run: `npm test` (must stay green; no new Node tests, the DOM glue is checked in the browser).
Then check in a real browser if one is available to you, otherwise say plainly that you could not: a stack of two shows `×2`, three shows `×3`, a lone coin shows nothing, dragging a middle coin to the front moves the badge, the badge is not selectable and does not intercept clicks.

- [ ] **Step 4: Commit**

```bash
git add src/render.js styles.css
git commit -m "feat: show a count badge on the top coin of each stack"
```

---

### Task 3: Drag a coin from the tray

**Files:**
- Modify: `src/drag.js`, `src/main.js`, `styles.css`, `README.md`

**Interfaces:**
- Consumes: Task 1's `addToPileAt`, `pointInRect`, `coinSizePx`; existing `toPileFraction`, `passesThreshold`, `settleCoin`, `watchDwell`, `swallow` / `takeSwallow`, `dwell`, `update`, `state`, `moveAndRefocus` (for its flush pattern), `renderTray`.
- Produces: `createTrayDrag(container, { onDrop, onDragStart, isLocked, pileEl }) -> { suppressed(): boolean, active(): boolean }` in `drag.js`. `onDrop(coinId: string, x: number, y: number)` is called once, only when the pointer is released inside `pileEl.getBoundingClientRect()`, with the unclamped `toPileFraction` of the pointer using the padding-box rect (same construction `createDrag` uses). `onDragStart(el)` once when the drag starts.

- [ ] **Step 1: Implement `createTrayDrag`** (`src/drag.js`), delegation on `[data-coin]` buttons in `container`:
  - `pointerdown`: clear the suppress flag only when no pointer is tracked; ignore if `isLocked()`, a pointer is already tracked, a mouse event with `button !== 0`, or not on a `[data-coin]` button; clear a stale `track` whose element is no longer connected; otherwise record pointer id, start point and the button, and `setPointerCapture` (in a try).
  - `pointermove` (matching id): until dragging, `passesThreshold` on movement from the start; first time it passes, set the suppress flag, call `onDragStart(el)`, add class `dragging-source` to the tray coin, create the ghost (a clone of the coin's `svg` in a `div.tray-ghost`, `aria-hidden`, `position: fixed`, `pointer-events: none`, `width`/`height` = `coinSizePx(coin, pileEl.getBoundingClientRect())`, positioned with its centre on the pointer using `transform: translate(...)`; the coin comes from `COINS` by `dataset.coin`). While dragging, move the ghost; add class `over-pile` to `pileEl` while the pointer is inside the pile rect (used for a subtle highlight), remove it otherwise.
  - `pointerup` (matching id): if dragging: remove the ghost, `dragging-source` and `over-pile`, release tracking, then if the pointer is inside the pile rect call `onDrop(coinId, x, y)` once. If not dragging: do nothing (the click adds a coin at a random spot as before).
  - `pointercancel` / `lostpointercapture` (matching id, only while tracking): remove the ghost and classes, call nothing, release tracking.
  - capture-phase `click` on the container: if the suppress flag is set, `preventDefault()`, `stopImmediatePropagation()` and clear the flag; `keydown` on the container clears the flag only when no drag is active.
  - Return `{ suppressed, active }` (`active` is true only while dragging past the threshold).
- [ ] **Step 2: Wire `main.js`**:
  - Create the controller before `watchDwell($("play-tray"))` so its listeners run first. `onDragStart(el)` calls `dwell.stop(el)` only if the coin is not `.revealed`. `isLocked: () => state.solved`, `pileEl: $("play-pile")`.
  - `onDrop(coinId, x, y)`: remember nothing about a previous position; `update(addToPileAt(state, coinId, x, y))` (do nothing if the state came back unchanged), read `$("play-pile").offsetWidth` to flush styles, then `update(settleCoin(state, uid, null))` where `uid` is the new entry's uid (the last entry of `state.pile`). Do not move focus to the new coin.
  - In `watchDwell`'s touch `pointerup` handler, return early for tray coins when the tray controller `suppressed()` (the existing pile guard stays), so hold, drag, release never also adds a coin.
  - Tray `click` handler needs no change (the capture-phase swallow handles it).
- [ ] **Step 3: CSS** (`styles.css`): `.coin { touch-action: none; cursor: grab; }` for tray coins; `.coin.dragging-source { opacity: 0.5; }` (reduced emphasis, keeps its place); `.tray-ghost { position: fixed; left: 0; top: 0; z-index: 2000; pointer-events: none; filter: drop-shadow(0 3px 4px #0005); }` with its svg filling it; `.pile.over-pile { outline: 3px solid var(--accent, #2a6df4); outline-offset: -3px; }` (reuse an existing accent colour variable if one exists); `.board.locked .coin { cursor: default; }`.
- [ ] **Step 4: README** (`README.md`): extend the line about dragging with one short sentence that coins can also be dragged from the tray into the pile.
- [ ] **Step 5: Verify**

Run: `npm test` (all green). Then, in a real browser if available to you, otherwise say plainly you could not: drag a tray coin into the pile and a coin of that type appears under the release point; the tray coin stays; releasing outside the pile adds nothing; a tray tap still adds at a random spot; dropping a 20p on a 20p stacks (badge `×2`); dropping on a different coin pushes apart with a glide; after a drag, tapping a tray coin and pressing Enter on a focused tray coin still add; nothing starts after solving; a touch drag from the tray does not scroll the page.

- [ ] **Step 6: Commit**

```bash
git add src/drag.js src/main.js styles.css README.md
git commit -m "feat: drag a coin from the tray into the pile"
```
