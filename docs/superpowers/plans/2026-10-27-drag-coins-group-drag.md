# Group Drag of Stacks Implementation Plan

> **Status:** implemented. Changed later: `DETACH_HOLD_MS` is 1000 (1 s), its own constant and no longer `DWELL_MS`, so read "2 seconds" / `2000` here as 1 second; a second pointer before the drag starts cancels or undoes the hold instead of being ignored. Current source of truth: `docs/superpowers/specs/2026-10-27-drag-coins-design.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dragging any coin of a stack moves the whole stack as one rigid group; holding a stack coin still for 2 seconds detaches that coin so it drags alone. The stack link distance becomes 3 mm so a stack (and its badge count) survives a middle layer leaving.

**Architecture:** Pure pieces first (`STACK_LINK_MM = 3`, `unitUids`, `moveGroup`, `settleGroup` in `game.js`/`state.js`, `pixelsToFraction` in `drag.js`), generalising the existing settle code rather than duplicating it. A small hardening task fixes review findings in both drag controllers. Then `createDrag` learns to drag a group and to run the hold-to-detach timer, and `main.js` commits a group drop with the existing land, flush, settle two-step.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node built-in test runner (`node --test`). No dependencies.

**Spec:** `docs/superpowers/specs/2026-10-27-drag-coins-design.md` (sections "A stack drags as a group", "Hold to take one coin off a stack", "Group drops", "Arrow keys still move one coin", and the group parts of "Design"). This plan builds on the already-implemented code (`createDrag`, `createTrayDrag`, `settlePile`, `settleCoin`, `stackCounts`, `moveAndRefocus`, `dropFromTray`).

## Global Constraints

- Static site: plain HTML, CSS, vanilla JS ES modules. No backend, no build step, no dependencies.
- Pile entry shape stays `{ uid, coinId, x, y, rot }`; `x`, `y` within ±0.5; array order is draw order; uids never change or get reused.
- `STACK_LINK_MM = 3` (was 2.5), `STACK_STEP_MM = { x: 1, y: -1 }`, `PUSH_FACTOR = 0.75`, `MAX_SETTLE_PASSES = 8`, `DRAG_THRESHOLD_PX = 6` are unchanged apart from the link distance. `DETACH_HOLD_MS = DWELL_MS` (2000, from `dwell.js`), exported from `drag.js`.
- A *stack* (unit) is a connected component of same-denomination coins within `STACK_LINK_MM` of each other (the existing `unitOf`); group membership, the badge count and push units must all come from it (reuse, never duplicate).
- Dragging a coin in a stack of two or more moves the whole unit rigidly (same shift for every member, offsets and relative draw order preserved, the group ends at the end of the array as a block). A lone coin drags alone as before. The group is clamped as a whole: the shift is limited so no member leaves ±0.5 (never squashed).
- Hold-to-detach: a press on a stack coin that stays within the threshold for `DETACH_HOLD_MS` marks that coin `detached` (scaled up with a shadow) and from then on a drag moves only that coin through the existing single-coin path. Moving past the threshold earlier is a group drag. The hold is abandoned (timer cleared, `detached` removed) on pointerup, pointercancel, lostpointercapture, a disconnected element, a locked board, or the drag starting; extra pointers are ignored. A press shorter than the hold that never moves is still a tap and removes one coin.
- Group drops: onto a same-denomination coin or stack the group is re-laid as consecutive layers above that stack's top coin (each `STACK_STEP_MM` further, in the group's own draw order, with the target's `rot`), giving one stack of the combined size; onto a different denomination the group is pushed apart as a unit like a single coin. Coins not involved never move. Group members never react to each other.
- Arrow keys and Shift+arrow still move exactly one coin; the tray drag, the badge and the tap behaviour are unchanged.
- Moving or settling never changes the total, check result, rounds, target, `nextUid` or message.
- `game.js`, `state.js` and `drag.js` stay importable in Node (no top-level DOM access).
- Commits use Conventional Commits and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A group near an edge or corner must stop as a unit (no member outside ±0.5, no squashing) and NaN/Infinity deltas must not reach state.
2. A group dropped on a same-type stack must end as exactly one stack of the combined size (badge correct) with no two coins on the same spot, uids/order/coinIds preserved; a group dropped on a different coin pushes both apart without moving untouched coins.
3. The hold timer must never leave `detached` or a live timer behind (release, cancel, lost capture, disconnected element, solved board mid-hold, second finger), a hold that ends in a plain release must not change behaviour, and a quick tap on a stack coin must still remove one coin.
4. After a group drag the swallowed click and the touch hold-then-release removal must not remove a coin; a later tap, Enter or Space must still work.
5. After widening the link distance, removing a middle layer must leave the rest counted as one stack, and one Shift+arrow step must still pull a coin out of a stack.

---

## File Structure

- Modify `src/game.js`: `STACK_LINK_MM`, `unitUids`, `settleGroup` (shared internals with `settlePile`).
- Modify `src/state.js`: `moveGroup`, `settleGroupCoins`.
- Modify `src/drag.js`: `DETACH_HOLD_MS`, `pixelsToFraction`, hardening, group drag and hold-to-detach in `createDrag`.
- Modify `src/main.js`, `styles.css`, `README.md`.
- Tests: `tests/game.test.js`, `tests/state.test.js`, `tests/drag.test.js`.

---

### Task 1: Pure group logic

**Files:**
- Modify: `src/game.js`, `src/state.js`, `src/drag.js`
- Test: `tests/game.test.js`, `tests/state.test.js`, `tests/drag.test.js`

**Interfaces:**
- Consumes: `unitOf`, `settlePile`'s internals, `clampPosition`, `distMm`, `reactsTo`, `STACK_STEP_MM`, `PILE_WIDTH_MM`, `PILE_HEIGHT_MM`, `PILE_MARGIN_MM`, `stackCounts` (game.js); `DWELL_MS` (dwell.js); `toPileFraction` (drag.js).
- Produces:
  - `STACK_LINK_MM = 3`.
  - `unitUids(pile, uid: number) -> number[]` in `game.js`: uids of the stack containing `uid`, in draw order; `[uid]` for a lone coin; `[]` for an unknown uid.
  - `settleGroup(pile, uids: number[], leaderUid: number, from: {x, y} | null) -> pile` in `game.js`: same-array-if-unchanged, otherwise a new array with the same entries in the same order (only `x`, `y`, and `rot` for re-laid coins differ). `leaderUid` must be in `uids`, else the same array is returned.
  - `moveGroup(state, uids, dx: number, dy: number) -> state` and `settleGroupCoins(state, uids, leaderUid, from) -> state` in `state.js`.
  - `DETACH_HOLD_MS` and `pixelsToFraction(dxPx: number, dyPx: number, rect: {width, height}) -> { x, y }` in `drag.js`.

**Algorithm for `settleGroup` (decided here):**
1. Group = the entries listed in `uids` (in pile order); the rest are other coins. The members' previous positions are their current position minus the leader's displacement `(leader.now - from)` (every member moved by the same delta); all are `null` when `from` is `null`.
2. **Re-lay first.** Reacted-to same-denomination coins are those among the *other* coins with the leader's `coinId` that `reactsTo(leader, from, c)` (too close and moved towards; unchanged rule). If there are any, take the one latest in pile order, find the *top* of its unit (the unit member latest in pile order among the other coins), and lay the group's coins above it: group member number `i` (1-based, in the group's own draw order) at `top.position + i * STACK_STEP_MM` (converted to fractions), `rot` = the target's `rot`, each through `clampPosition`.
3. **Then push,** exactly as `settlePile`'s push phase: moved set = every group member with its previous position from step 1, same passes and same `unitOf` rigid shifting, same clamping, same skip of same-denomination pairs (so members never react to each other or to the stack they merged into).
- Implement by generalising the internals `settlePile` already has instead of copying them. `settlePile(pile, uid, from)` must keep its behaviour: all existing `settlePile` / `settleCoin` / `addToPile` tests must pass unchanged. Where a single coin snaps, the target becomes the *top of the unit* of the latest too-close coin (identical to today whenever that coin is already the top; if an existing test disagrees, report it instead of editing the test).

- [ ] **Step 1: Write the failing tests**

`tests/game.test.js` (update the existing `assert.equal(STACK_LINK_MM, 2.5)` to 3; helpers as in the existing settle tests):
- `unitUids`: lone coin gives `[uid]`; a 3-stack built with the step gives its three uids in draw order whichever member is asked about, and with the array order reversed the order follows the array; two separate stacks of the same type stay separate; unknown uid gives `[]`.
- Link distance: three 20p chained by the step (uids 1, 2, 3); removing uid 2 leaves 1 and 3 (2.83 mm apart) still one unit and `stackCounts` still `uid 3 -> 2`; a fourth layer with the second removed still counts the three remaining.
- `settleGroup` re-lay: a 2-stack of 20p (uids 1, 2) shifted onto a lone 20p (uid 9 at `(0,0)`) with `from` set far away gives layers `uid 9`, then `uid 1`, then `uid 2` at `9 + STEP`, `9 + 2*STEP`, all with uid 9's `rot`; `stackCounts` gives `uid 2 -> 3`; entries/uids/order/coinIds preserved; uid 9 untouched.
- Group onto an existing 3-stack: the group lands above the stack's top layer (positions `top + i*STEP`), combined count correct, no two coins on the same position.
- Group onto a different denomination: a 2-stack of 20p moved onto a 50p: after settling the group's coins keep their mutual offset, the 50p moved away, the centre distance between the grabbed 20p and the 50p is at least `PUSH_FACTOR * (r20 + r50)` within 1e-6, and an unrelated far coin did not move.
- Group moved away is not re-laid: the group's own previous unit never triggers it (leader moved away from a same-type neighbour: same array returned); moved towards: re-laid.
- Members never react to each other: a group alone in the pile returns the same array.
- `leaderUid` not in `uids` returns the same array; pass cap (20 mixed coins at one spot) settles without throwing, uids and order preserved, all inside ±0.5.
- `settlePile` regression: every previous `settlePile` test still passes untouched.

`tests/state.test.js`:
- `moveGroup`: shifts every listed coin by the same amount, the group ends as the last entries in their original relative order, other entries untouched and in order; total, nextUid, rounds, message unchanged.
- joint clamp: a group whose right-most member would pass 0.5 is limited so that member sits at exactly 0.5 and the others keep their offsets (not squashed); same for the left, top and bottom edges; `dx = NaN` is treated as 0 and `Infinity` clamps.
- same object for solved, empty `uids`, and any unknown uid.
- `settleGroupCoins`: same object when solved, unknown uid, or nothing changes; after `moveGroup` onto a same-type coin it re-lays and `stackCounts(state.pile)` shows the combined count; total unchanged.

`tests/drag.test.js`: `DETACH_HOLD_MS === 2000`; `pixelsToFraction`: `(0, 0)` gives `(0, 0)`, positive and negative, and for a rect of `{ width: W, height: H }` (box sizes from `PILE_*`) it equals the difference of two `toPileFraction` points one pixel-delta apart within 1e-9.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL (new exports missing, `STACK_LINK_MM` still 2.5).

- [ ] **Step 3: Implement** per the algorithm and interfaces above (`moveGroup` limits the shared delta to `[-0.5 - minCoord, 0.5 - maxCoord]` per axis over the listed coins, with NaN treated as 0).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/game.js src/state.js src/drag.js tests/game.test.js tests/state.test.js tests/drag.test.js
git commit -m "feat: add group move and settle logic and widen the stack link distance"
```

---

### Task 2: Drag controller hardening

**Files:**
- Modify: `src/drag.js`, `tests/state.test.js`

**Interfaces:**
- Consumes: `createDrag`, `createTrayDrag`, `coinSizePx`.
- Produces: no new exports; behaviour fixes only.

- [ ] **Step 1: Stale same-pointer track (both controllers).** In the `pointerdown` handler of `createDrag` and `createTrayDrag`, a tracked pointer with the same `pointerId` as the new press is stale (its pointerup went missing): finish it (the same cleanup as pointercancel, including removing the ghost / classes) and clear `track`, before the suppress/ignore checks, so later drags and clicks work again.
- [ ] **Step 2: Ghost size.** `createTrayDrag` sizes the ghost from `coinSizePx(coin, { width: pileEl.clientWidth })` (content box) instead of the border-box rect width, so it matches the coin that lands. Store the size on the track and use `size / 2` in `moveGhost` instead of reading layout each pointermove.
- [ ] **Step 3: Test tightening.** In `tests/state.test.js`, the "does not settle" `addToPileAt` test also asserts the existing entry is unmoved (deep equal to before).
- [ ] **Step 4: Verify.** Run `npm test` (all green). No new automated tests for the controllers (DOM glue, checked in the browser by the controller).
- [ ] **Step 5: Commit**

```bash
git add src/drag.js tests/state.test.js
git commit -m "fix: recover from a stale tracked pointer and size the tray ghost exactly"
```

---

### Task 3: Group drag and hold to detach

**Files:**
- Modify: `src/drag.js`, `src/main.js`, `styles.css`, `README.md`

**Interfaces:**
- Consumes: Task 1's `unitUids`, `moveGroup`, `settleGroupCoins`, `pixelsToFraction`, `DETACH_HOLD_MS`; existing `createDrag`, `moveAndRefocus`, `onDragStart`, `watchDwell`, `drag`, `dwell`.
- Produces: `createDrag(container, { onMove, onMoveGroup, getGroup, onDragStart, isLocked })`. `getGroup(uid) -> number[]` returns the uids to drag with `uid` (length 1 means a plain single drag). `onMoveGroup(uids, dxFraction, dyFraction, leaderUid)` is called once on drop of a group drag; `onMove(uid, x, y)` is unchanged for single drags (lone coins and detached coins).

- [ ] **Step 1: `createDrag` group and hold.**
  - `pointerdown` on a coin: compute `group = getGroup(uid)`. Track every member element (query `[data-uid]` in the container), the leader, the start point and the existing grab offsets. If `group.length > 1`, start the hold timer (`setTimeout`, `DETACH_HOLD_MS`).
  - Hold fires (still not dragging, same pointer, element connected, not locked): add class `detached` to the leader and mark the track `single = true`.
  - First `pointermove` past the threshold: clear the hold timer. If `single` or `group.length === 1`, behave exactly as today (single coin, `dragging` on the leader only). Otherwise enter group mode: add `dragging` to every member element and keep updating `--dx`/`--dy` on **every** member from the same pointer movement.
  - `pointerup` while dragging: remove `dragging`, `detached` and the offsets from all members **before** calling the callback, with the inline `transition: none` guard on every member element exactly as the single path does (cleared in a `finally`; `moveAndRefocus`-style helper clears it after the flush). Group mode calls `onMoveGroup(uids, dx, dy, leaderUid)` with `pixelsToFraction` of the pointer movement against the same padding-box rect used for single drops; single mode calls `onMove` as today. Not dragging: clear the timer and `detached`, do nothing else (a tap is a tap).
  - `pointercancel`, `lostpointercapture`, a disconnected leader on the next `pointerdown`, a stale same-pointer track, a locked board at hold time, and a second pointer all clear the timer, `dragging`, `detached` and offsets on every member and call nothing.
  - Suppress-flag rules are unchanged (set when a drag starts, cleared on the next pointerdown only if no pointer is tracked, on the swallowed click, and on keydown only when not dragging).
- [ ] **Step 2: Wire `main.js`.** Pass `getGroup: (uid) => unitUids(state.pile, uid)` and `onMoveGroup` to `createDrag`. `onMoveGroup(uids, dx, dy, leaderUid)`: remember the leader's current position as `from`; remember which pile coin had focus; `update(moveGroup(state, uids, dx, dy))`; read `$("play-pile").offsetWidth` to flush; clear the inline `transition` on every member element; `update(settleGroupCoins(state, uids, leaderUid, from))`; restore focus by uid as `moveAndRefocus` does. Keep `moveAndRefocus` for single drags and arrow keys. `onDragStart(el)` is still called once with the leader element. The touch hold-then-release removal in `watchDwell` must keep returning early when `drag.suppressed()` (also true after a group drag).
- [ ] **Step 3: CSS.** `.pile-coin.detached` and `.pile-coin.detached:active`: `transform: scale(1.08)`, `filter: drop-shadow(0 3px 4px #0005)`, `z-index: 1000` (above the others while held); no transition on `transform` that fights the existing `:active` rule; removed under no condition other than the class going away.
- [ ] **Step 4: README.** One short sentence: dragging a stack moves it together; hold a coin for 2 seconds to take it off the stack.
- [ ] **Step 5: Verify.** Run `npm test` (all green). Then, if a real browser is available to you, otherwise say plainly you could not (the controller will run these with Playwright): dragging a 3-stack by its middle coin moves all three; a group stops at the pile edge without squashing; a group dropped on a same-type coin merges with the right `×N`; a group dropped on a different coin pushes apart; a quick tap on a stack coin removes one; holding a stack coin 2 seconds lifts it and then drags only it; releasing after the hold without moving leaves things as they were; Shift+arrow still pulls a single coin out of a stack.
- [ ] **Step 6: Commit**

```bash
git add src/drag.js src/main.js styles.css README.md
git commit -m "feat: drag a stack as a group and hold to take one coin off"
```
