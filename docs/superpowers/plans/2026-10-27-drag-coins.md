# Draggable Pile Coins Implementation Plan

> **Status:** implemented. Changed later: `STACK_LINK_MM` is 3 (not 2.5); tray coins are draggable; a pointer drag on a stack coin moves the whole stack (hold 1 s to take one off); a snapping coin lands on the top of the target's stack; arrow keys exclude the coin's own stack from snapping and are ignored mid-drag; a second finger does not clear the click-suppress flag. Current source of truth: `docs/superpowers/specs/2026-10-27-drag-coins-design.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player drag a pile coin (mouse, touch, pen) or move it with the arrow keys, bringing it to the front, and have too-close coins tidy themselves: same denomination stacks, different denominations are pushed apart with a glide. The total never changes and a drag never removes a coin.

**Architecture:** Pure pieces first: `clampPosition` and `settlePile` in `game.js`, `moveCoin` / `settleCoin` in `state.js` (and `addToPile` settles what it adds), and the geometry helpers in a new `src/drag.js`. `createDrag` (same file) is a thin Pointer Events controller that moves the dragged element with CSS custom properties and calls `onMove(uid, x, y)` once on drop. `main.js` commits a drop in two updates (land where released, flush styles, settle) so the CSS transition on `left`/`top` produces the glide. `render.js` reconciles by `uid`, so it only needs to update the position of an existing coin.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node built-in test runner (`node --test`). No dependencies.

**Spec:** `docs/superpowers/specs/2026-10-27-drag-coins-design.md` (parents: `2026-10-27-coin-game-design.md`, `2026-10-27-inspect-to-reveal-design.md`, `2026-10-27-messy-pile-design.md`)

## Global Constraints

- Static site: plain HTML, CSS, vanilla JS ES modules. No backend, no build step, no runtime or test dependencies.
- Pile entry shape stays `{ uid, coinId, x, y, rot }`; `x`, `y` are fractions of the 110 by 90 mm centre area, clamped to ±0.5. Array order is draw order (later on top). `uid` never changes when a coin moves or settles, and `nextUid` is untouched by a move or settle.
- `DRAG_THRESHOLD_PX = 6`: a drag starts when pointer movement is **more than** 6 px.
- Keyboard step: `0.02` of the pile size per arrow press, `0.10` with Shift held.
- Too close: centre distance (mm, via `PILE_WIDTH_MM` / `PILE_HEIGHT_MM`) is less than the radius (`diameter / 2`) of the smaller of the two coins.
- Settle constants (in `game.js`): `STACK_STEP_MM = { x: 1, y: -1 }`, `STACK_LINK_MM = 2.5`, `PUSH_FACTOR = 0.75`, `MAX_SETTLE_PASSES = 8`.
- Moving or settling a coin never changes the total, the check result, the rounds counter, `target`, `nextUid` or the message.
- Solved state is read-only: `moveCoin` and `settleCoin` return the same state object, the pointer controller does not start a drag, and arrow keys do nothing.
- Only pile coins move. Tray coins are not draggable. Only the first pointer drags; extra pointers are ignored.
- Pile coin buttons get `aria-description="Use arrow keys to move"`. Moves are not announced.
- `.pile-coin` has `touch-action: none` (cursor `grab`, `grabbing` while dragging, default when locked). The rest of the page still scrolls.
- Glide: `transition: left 150ms ease-out, top 150ms ease-out` on `.pile-coin`, none while `.dragging`, removed under `prefers-reduced-motion: reduce`.
- `game.js`, `state.js` and `drag.js` stay importable in Node (no top-level DOM access). Only `render.js`, `main.js` and the pointer glue inside `createDrag` touch the DOM.
- Commits use Conventional Commits (`feat:`, `test:`, `docs:`) and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Non-finite coordinates (zero-size pile rect, NaN from a bad pointer event) must not reach state: `clampPosition` maps NaN to 0 and ±Infinity to ±0.5.
2. A coin dragged or arrow-keyed **away** from a same-type stack must stay where it is (never snapped back), while dropping it onto a stack snaps it; coincident centres of different types must not divide by zero.
3. After a drag, a stray click must not remove a coin, but a later Enter/Space or a later real tap must still work (the suppress flag must not linger).
4. Moving a coin, then adding another, then removing the moved one must remove the right entry (uids stable, `nextUid` untouched, no reuse); settle must never drop, duplicate or re-id an entry.
5. Pointer cancel, losing capture, a second finger, or solving the round mid-drag must leave the coin where it was with no state change and no stuck `dragging` class; and a crowded pile (20 coins, 8 passes) must settle without throwing or looping.

---

## File Structure

- Modify `src/game.js`: `clampPosition`, settle constants, `settlePile`.
- Modify `src/state.js`: `moveCoin`, `settleCoin`; `addToPile` settles.
- Create `src/drag.js`: pure `DRAG_THRESHOLD_PX`, `passesThreshold`, `toPileFraction`; DOM glue `createDrag`.
- Modify `src/render.js`: update position of existing coins; `aria-description`.
- Modify `src/main.js`: wire the controller and the arrow keys.
- Modify `styles.css`, `README.md`.
- Tests: `tests/game.test.js`, `tests/state.test.js`, new `tests/drag.test.js`.

---

### Task 1: Pure move logic and geometry

**Files:**
- Modify: `src/game.js`, `src/state.js`
- Create: `src/drag.js`
- Test: `tests/game.test.js`, `tests/state.test.js`, `tests/drag.test.js`

**Interfaces:**
- Consumes: `PILE_WIDTH_MM`, `PILE_HEIGHT_MM`, `PILE_MARGIN_MM`, `pileBox` from `game.js`; `pileOf`, `seeded` from `tests/pile-helper.js`; the entry shape above.
- Produces:
  - `clampPosition(x: number, y: number) -> { x, y }` in `game.js`.
  - `moveCoin(state, uid: number, x: number, y: number) -> state` in `state.js`.
  - `DRAG_THRESHOLD_PX = 6`, `passesThreshold(dx: number, dy: number) -> boolean`, `toPileFraction(point: {x, y}, rect: {left, top, width, height}) -> {x, y}` (unclamped) in `drag.js`.

- [ ] **Step 1: Write the failing tests**

`tests/game.test.js`, `clampPosition`: in range is returned unchanged; each axis clamps independently (`(0.9, 0.1)` gives `(0.5, 0.1)`, `(-2, -0.7)` gives `(-0.5, -0.5)`); `(NaN, Infinity)` gives `(0, 0.5)`.

`tests/state.test.js`, `moveCoin`, using a state built with `addToPile` three times (seeded rng) so the pile is `[a, b, c]`:
- moving `a` to `(0.2, -0.3)` gives a pile ordered `[b, c, a']` where `a'` has the new `x`/`y` and the same `uid`, `coinId`, `rot`; `b` and `c` are deeply equal to before.
- the target is clamped: moving to `(5, -5)` stores `(0.5, -0.5)`.
- `total(state.pile)`, `rounds`, `message`, `nextUid` and `target` are unchanged.
- moving the last entry keeps the order.
- unknown `uid` returns the same object (`assert.equal(next, state)`); a solved state returns the same object.
- after moving `a`, `addToPile` gives the new coin `uid` equal to the old `nextUid`, and `removeFromPile(state, a.uid)` removes exactly `a`.

`tests/drag.test.js`:
- `DRAG_THRESHOLD_PX === 6`.
- `passesThreshold`: `(6, 0)` false, `(0, -6)` false, `(7, 0)` true, `(4, 4)` false (5.66), `(5, 5)` true (7.07), `(0, 0)` false.
- `toPileFraction` with rect `{ left: 100, top: 50, width: W, height: H }` where `W = PILE_WIDTH_MM + 2 * PILE_MARGIN_MM` and `H = PILE_HEIGHT_MM + 2 * PILE_MARGIN_MM`: the rect centre gives `(0, 0)` (use `Math.abs(v) < 1e-9`); the point `PILE_MARGIN_MM` in from the top-left corner gives `(-0.5, -0.5)`; `PILE_MARGIN_MM` in from the bottom-right corner gives `(0.5, 0.5)`; the rect's own top-left corner gives a value below `-0.5` on both axes (unclamped); a point far outside the rect gives values beyond ±0.5.
- `toPileFraction` is the inverse of `pileBox`: for `{x: 0.3, y: -0.2}`, converting `pileBox` percentages back into a point inside the rect gives `(0.3, -0.2)` within 1e-9.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL (`clampPosition`, `moveCoin` and `../src/drag.js` do not exist).

- [ ] **Step 3: Implement**

- `clampPosition` in `game.js`: per axis, NaN becomes 0, otherwise `Math.min(0.5, Math.max(-0.5, v))` (so ±Infinity clamps to ±0.5).
- `moveCoin` in `state.js`: guards first (`state.solved` or unknown `uid` returns `state`), then returns a new state whose `pile` is the other entries in order followed by the moved entry with clamped `x`/`y`. Touch no other field. It does not settle.
- `drag.js`: export the three names above. `passesThreshold` uses `Math.hypot(dx, dy) > DRAG_THRESHOLD_PX`. `toPileFraction` is the algebraic inverse of `pileBox` (box width `PILE_WIDTH_MM + 2 * PILE_MARGIN_MM`, height likewise): `x = ((px - rect.left) / rect.width * boxW - PILE_MARGIN_MM) / PILE_WIDTH_MM - 0.5`, same for `y` with the height values.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/game.js src/state.js src/drag.js tests/game.test.js tests/state.test.js tests/drag.test.js
git commit -m "feat: add pure pile coin move logic and drag geometry"
```

---

### Task 2: Settle too-close coins (stack and push apart)

**Files:**
- Modify: `src/game.js`, `src/state.js`
- Test: `tests/game.test.js`, `tests/state.test.js`

**Interfaces:**
- Consumes: `clampPosition`, `PILE_WIDTH_MM`, `PILE_HEIGHT_MM`, `coinById` (from `coins.js`, for diameters), `moveCoin`.
- Produces:
  - Exports in `game.js`: `STACK_STEP_MM`, `STACK_LINK_MM`, `PUSH_FACTOR`, `MAX_SETTLE_PASSES` (values in Global Constraints), and `settlePile(pile, uid: number, from: {x, y} | null) -> pile`. `from` is the mover's position before the move; `null` for a newly added coin. Returns the **same array** when nothing changes; otherwise a new array with the same entries in the same order, where only `x`, `y` and (for a snapped coin) `rot` differ. Pure and deterministic (no rng).
  - `settleCoin(state, uid, from) -> state` in `state.js`: `settlePile` applied to `state.pile`; returns the same state object if the state is solved, `uid` is unknown, or the pile came back unchanged.
  - `addToPile` now settles the coin it adds (`from` = `null`) before returning.

**Algorithm (decided here, not left open):**
1. Mover `m` = entry `uid`. A coin `c` is *reacted to* when it is too close to `m` **and** (`from` is `null` or `m` is now closer to `c` than `from` was).
2. **Stack first.** If any reacted-to coin has the mover's denomination, take the one latest in pile order and set `m` to that coin's position plus `STACK_STEP_MM` (converted to fractions by dividing by `PILE_WIDTH_MM` / `PILE_HEIGHT_MM`), with that coin's `rot`, then `clampPosition`.
3. **Then push.** A *unit* is a connected component of same-denomination coins whose centres are within `STACK_LINK_MM` of each other. Passes run up to `MAX_SETTLE_PASSES`, starting with moved set `{m}` (previous position `from`, or none). In each pass, for every coin `a` in the moved set and every coin `b` of a different denomination that is reacted to (same rule as step 1, using `a`'s previous position): let `d` be their centre distance, `need = PUSH_FACTOR * (rA + rB) - d` (mm). Shift `a`'s unit by half of `need` away from `b` and `b`'s unit by half of `need` away from `a`, along the line between centres (along +x for `a` when the centres coincide, −x for `b`), converting mm to fractions per axis and clamping each coin. Every coin so shifted joins the next pass's moved set, remembering its position from before the shift. Stop when the moved set is empty.

- [ ] **Step 1: Write the failing tests**

`tests/game.test.js` (hand-built piles; ids `"20p"` r 10.7, `"50p"` r 13.65, `"1p"` r 10.15; `STEP_X = STACK_STEP_MM.x / PILE_WIDTH_MM`, `STEP_Y = STACK_STEP_MM.y / PILE_HEIGHT_MM`; a helper `dist(a, b)` in mm):
- Same type snaps: `20p` at `(0, 0)` rot 40, mover `20p` uid 2 at `(0.05, 0)` (5.5 mm) with `from: null` gives mover at `(STEP_X, STEP_Y)` with rot 40; the first coin is untouched.
- A third `20p` too close to the second joins the second (position = second + step, second's rot).
- Not too close: `20p` at 0 and mover `20p` at `(0.2, 0)` returns the **same array** (`assert.equal`).
- Different type pushes apart: `20p` at `(0, 0)`, mover `50p` at `(0.05, 0)`, `from: null`: afterwards their centre distance in mm equals `PUSH_FACTOR * (10.7 + 13.65)` within 1e-6; the mover moved in +x and the other in −x by equal amounts; `y` unchanged.
- Coincident centres: `20p` and `50p` both at `(0, 0)`: distance becomes the target, the two coins separated along x, no NaN.
- A pushed stack moves as a unit: `20p` at `(0, 0)` and `20p` at `(STEP_X, STEP_Y)` (a stack), mover `50p` at `(0.04, 0)`; both `20p` coins shift by the same vector and stay `STACK_STEP_MM` apart.
- Cascade: a third coin sitting where the pushed coin lands is itself pushed on the next pass; with 3 coins in a line the result has no pair of different-type coins too close.
- Pass cap: a pile of 20 coins (mixed ids, all at `(0, 0)` except the mover) settles without throwing and returns entries with the same uids in the same order, all inside ±0.5.
- Moving away is not undone: `20p` at `(0, 0)`, mover `20p` now at `(0.04, 0)` with `from: {x: 0.01, y: 0}` (so it moved **away**) returns the same array; the same pile with `from: {x: 0.2, y: 0}` (moved **towards**) snaps.
- Clamping: a push or snap at the pile edge never leaves ±0.5.
- Unknown `uid` returns the same array.
- Preservation: every result has the same length, uids, `coinId`s and order as the input; `total` is unchanged.

`tests/state.test.js`:
- `settleCoin` returns the same state object when nothing is too close, when solved, and for an unknown `uid`.
- `settleCoin` after `moveCoin` onto a same-type coin snaps it and leaves `total`, `nextUid`, `rounds`, `message`, `target` unchanged.
- `addToPile` with a stubbed rng that forces the new coin's position on top of an existing same-type coin (use `seq` from the helper so the first two draws give the same `x`, `y` as the existing coin) results in a stacked position; with a different-type coin it results in a centre distance of at least `PUSH_FACTOR * (rA + rB)` (within 1e-6).
- A normal `addToPile` with a seeded rng and an empty pile is unchanged from today (existing tests keep passing).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL (`settlePile`, `settleCoin` and the constants do not exist).

- [ ] **Step 3: Implement** the constants and `settlePile` in `game.js` following the algorithm above, `settleCoin` in `state.js`, and the `addToPile` change. Keep `settlePile` free of mutation of its input.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/game.js src/state.js tests/game.test.js tests/state.test.js
git commit -m "feat: stack same-type coins and push different coins apart when too close"
```

---

### Task 3: Pointer dragging and the glide

**Files:**
- Modify: `src/drag.js`, `src/render.js`, `src/main.js`, `styles.css`

**Interfaces:**
- Consumes: `toPileFraction`, `passesThreshold`, `moveCoin`, `settleCoin`; `renderPile(container, pile)` keyed by `data-uid`; `main.js`'s `update(next)`, `state`, `dwell`, `watchDwell`, `swallow`, `takeSwallow`, `removeCoin`.
- Produces: `createDrag(container, { onMove, onDragStart, isLocked }) -> { suppressed(): boolean }` in `drag.js`. `onMove(uid: number, x: number, y: number)` is called once per completed drag with unclamped fractions of the coin **centre**; `onDragStart(el)` once when a drag starts. `suppressed()` is true from the moment a drag starts until the swallowed click, the next `pointerdown` or the next `keydown`. In `main.js`: `moveAndRefocus(uid, x, y)` (see Step 3), reused by Task 4.

- [ ] **Step 1: Position updates in `renderPile`** (`src/render.js`)

For a coin that already exists, set `left`, `top` and `--rot` from its entry if they differ (currently these are set only on creation). Factor the three assignments into one helper used for new and existing buttons. Existing behaviour (keyed reconcile, `settle` class only on creation, reorder when DOM order differs) is unchanged.

- [ ] **Step 2: Implement `createDrag`** (`src/drag.js`)

The controller attaches listeners to `container` once and uses event delegation on `[data-uid]`. All of it is required:

- `pointerdown`: always clear the suppress flag first. Then ignore the event if `isLocked()`, if a pointer is already tracked, if it is a mouse event with `button !== 0`, or if it is not on a `[data-uid]` coin. Otherwise record the pointer id, the start point, the coin element, and the **grab offset** (coin centre minus pointer, in px, from the element's `getBoundingClientRect()`), and call `setPointerCapture`.
- `pointermove` (matching pointer id only): until dragging, check `passesThreshold` on the movement from the start point; the first time it passes, enter drag mode: add class `dragging`, set the suppress flag, call `onDragStart(el)`. While dragging, set `--dx` and `--dy` (px strings) on the element to the pointer movement since the start. Do not touch state.
- `pointerup` (matching id): if dragging, compute the coin centre as pointer + grab offset, convert with `toPileFraction(centre, container.getBoundingClientRect())`, **first** remove `dragging` and the `--dx`/`--dy` properties, **then** call `onMove(uid, x, y)` once. If not dragging, do nothing (the click goes through as a tap). Release tracking either way.
- `pointercancel` and `lostpointercapture` (matching id, only while still tracking): remove `dragging` and the properties, call nothing, release tracking. A `lostpointercapture` that follows a normal `pointerup` finds nothing tracked and does nothing.
- A capture-phase `click` listener on the container: if the suppress flag is set, `preventDefault()`, `stopImmediatePropagation()` and clear the flag.
- `keydown` on the container clears the suppress flag.
- Return `{ suppressed: () => flag }`.

- [ ] **Step 3: Wire into `main.js`**

- `moveAndRefocus(uid, x, y)`: remember `from = {x, y}` of that entry in `state.pile`; remember whether the coin element had focus; `update(moveCoin(state, uid, x, y))`; read `$("play-pile").offsetWidth` to flush styles (so the coin lands where released before it glides); `update(settleCoin(state, uid, from))`; then, if the coin had focus, refocus the element with the same `data-uid` (`focus({ preventScroll: true })`), because reordering the DOM drops focus.
- `let drag = createDrag($("play-pile"), { onMove: moveAndRefocus, onDragStart, isLocked: () => state.solved })`, created **before** `watchDwell($("play-pile"))` so its listeners run first. `onDragStart(el)` calls `dwell.stop(el)` only when the coin is not `.revealed` (a revealed coin stays revealed until the press ends).
- In `watchDwell`'s touch `pointerup` handler, return early when `drag?.suppressed()` is true for a pile coin, so hold, drag, release never removes the coin. `drag` is a module-level binding assigned before the pile's `watchDwell` call; the tray's call never consults it.
- The pile `click` handler needs no change.

- [ ] **Step 4: CSS** (`styles.css`)

- `.pile-coin { touch-action: none; cursor: grab; transition: left 150ms ease-out, top 150ms ease-out; }`
- `.pile-coin.dragging { cursor: grabbing; z-index: 1000; transition: none; translate: calc(-50% + var(--dx, 0px)) calc(-50% + var(--dy, 0px)); filter: drop-shadow(0 3px 4px #0005); }` (the existing `translate: -50% -50%` is the base; do not use `transform`, which `:active` and the settle animation already use.)
- `.board.locked .pile-coin { cursor: default; }`
- Extend the existing `prefers-reduced-motion` block so `.pile-coin { transition: none; }`.

- [ ] **Step 5: Verify**

Run: `npm test`
Expected: all tests pass (no new Node tests; the pointer glue is thin and checked manually).

Then in a browser (`python3 -m http.server`), report which of these you ran and which you could not: mouse drag moves a coin and it stays; the dragged coin ends on top; tap still removes; a drag does not remove; drag past the pile edge clamps; the total does not change; dropping a 20p onto a 20p stacks it; dropping a 20p onto a 50p pushes both apart with a glide; dragging the top coin off a stack leaves it where dropped; after solving, coins do not drag; a touch drag on a phone-sized viewport does not scroll the page; a second finger is ignored.

- [ ] **Step 6: Commit**

```bash
git add src/drag.js src/render.js src/main.js styles.css
git commit -m "feat: drag pile coins with the pointer and glide them into place"
```

---

### Task 4: Keyboard moves, accessibility text and docs

**Files:**
- Modify: `src/main.js`, `src/render.js`, `README.md`

**Interfaces:**
- Consumes: `moveAndRefocus(uid, x, y)`, `state` from `main.js`.
- Produces: nothing new for later tasks.

- [ ] **Step 1: `aria-description`** (`src/render.js`)

Pile coin buttons created in `renderPile` get `aria-description="Use arrow keys to move"` (set only on creation, next to the `Remove …` aria-label).

- [ ] **Step 2: Arrow-key handler** (`src/main.js`)

A `keydown` listener on `$("play-pile")` for `ArrowLeft/Right/Up/Down` on a focused `[data-uid]` coin:
- Ignore the event if Ctrl, Alt or Meta is held. Otherwise `preventDefault()` (so the page does not scroll).
- Step is `0.10` with Shift, else `0.02`. Left/Right change `x` by minus/plus the step; Up/Down change `y` by minus/plus the step (screen y grows downward, matching stored `y`).
- Call `moveAndRefocus(uid, entry.x + dx, entry.y + dy)` using the entry's current position from `state.pile`. The helper already settles with the previous position as `from`, so an arrow press away from a stack never snaps back.
- Enter and Space are not handled here: they keep their normal click action.
- Solved state: `moveCoin` returns the same state, so nothing changes.

- [ ] **Step 3: README** (`README.md`)

Extend the line that says "tap a coin in your pile to remove it" with one short sentence: coins in the pile can be dragged (or moved with the arrow keys); same coins that touch stack, different ones push apart.

- [ ] **Step 4: Verify**

Run: `npm test`
Expected: all tests pass.

In a browser, report what you ran: Tab to a pile coin, arrow keys move it by a small step, Shift+arrow by a larger one, the coin comes to the front and keeps focus, the page does not scroll, arrow keys pull a coin out of a stack without it snapping back, Enter still removes the coin in Endless, nothing moves after solving, a coin cannot be moved past the pile edge; after a mouse drag, pressing Enter on a focused coin still removes it (no lingering suppress).

- [ ] **Step 5: Commit**

```bash
git add src/main.js src/render.js README.md
git commit -m "feat: move pile coins with the arrow keys"
```
