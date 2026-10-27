# Draggable pile coins: Design Spec

Date: 2026-10-27
Builds on: `2026-10-27-coin-game-design.md`,
`2026-10-27-inspect-to-reveal-design.md`, `2026-10-27-messy-pile-design.md`
Build order: inspect-to-reveal, messy pile, then this spec. Cashier mode
(separate spec, developed on its own branch) builds on it.

This is the single source of truth for dragging. The plans
`2026-10-27-drag-coins.md`, `2026-10-27-drag-coins-tray-and-stack-count.md` and
`2026-10-27-drag-coins-group-drag.md` record how it was built; where a plan and
this spec differ, this spec is current.

## Purpose

Overlapping coins can be hard to read. The player should be able to pick up a
coin in the pile and drag it somewhere else, so a covered or hard-to-spot coin
can be moved out and seen clearly, and slide coins apart to count them. Coins
that end up too close tidy themselves: same-type coins stack, different coins
are pushed apart so each shape stays readable. A stack shows how many coins it
holds, drags as one piece, and a single coin can be held to take it off. Coins
can also be dragged straight from the tray to a chosen spot in the pile.

The spec covers: dragging pile coins (and the keyboard alternative),
auto-stacking and push-apart, dragging from the tray, the stack count badge,
and dragging a stack as a group with hold-to-detach.

## Requirements

### Dragging pile coins

- **Drag to move.** In the pile, pressing a coin and moving the pointer more
  than `DRAG_THRESHOLD_PX = 6` starts a drag. The coin follows the pointer and
  stays where it is dropped (unless the too-close rules below settle it). Works
  with mouse, touch and pen via Pointer Events. Only the first pointer drags.
- **Tap still works.** A press that ends without passing the threshold is a
  normal tap and does what it does today: in Endless and Custom it removes that
  coin. A drag never removes a coin, and the click that follows a drag is
  suppressed so it cannot trigger removal.
- **Brought to front.** A coin that is being dragged is drawn on top of all
  others. On drop it stays on top (it becomes the last entry in draw order). So
  dragging a buried coin both moves it and puts it above the rest.
- **Stays inside the pile area.** While dragging, the coin follows the pointer
  freely. On drop its centre is clamped to the pile area (±0.5 of its width and
  height), so a coin cannot be lost off-screen.
- **Total unaffected.** Moving a coin never changes the total, the check result
  or the rounds counter.
- **Locked when solved.** Once a round is solved the board is locked, as it is
  for adding and removing: pile and tray coins cannot be dragged, and a drag
  in progress when the round is solved (by another finger) snaps back.

### Stacks: group drag and hold to detach

A *stack* is a group of two or more same-denomination coins whose centres are
linked within `STACK_LINK_MM = 3` of each other (transitively). The same
definition drives the badge, the group drag and the push units below.

- **A stack drags as a group.** Pressing any coin that belongs to a stack and
  dragging past the threshold moves the *whole stack* as one rigid group: every
  member shifts by the same amount, keeping its offset and its draw order, and
  the group is brought to the front as a block. The group is clamped as a
  whole, so no member ends outside the pile area (the movement is limited,
  never squashed). A coin that is not in a stack drags alone.
- **Hold to take one coin off a stack.** Pressing a stack coin and holding it
  still (movement not past the threshold) for `DETACH_HOLD_MS = 1000`
  (1 second; its own constant, independent of and shorter than the 2-second
  `DWELL_MS` value reveal) detaches that coin: it lifts (class `detached`:
  slightly scaled up, with a shadow), and dragging it from then on moves *only
  that coin*, using the single-coin rules. If the pointer moves past the
  threshold before the hold completes, it is a group drag instead. **Once held,
  the coin stays separated.** Releasing after a completed hold without dragging
  removes nothing (the click or touch release that follows is swallowed) and
  does not leave the coin in the stack: the coin steps `DETACH_NUDGE_MM =
  { x: 5, y: 5 }` out of the stack, each axis directed away from the nearest
  pile edge (towards the centre of the pile on that axis, so the step is never
  clamped away), and then settles like any other moved coin (a pushed or
  stacked outcome follows the usual rules, but it is never snapped back into
  the stack it just left). The step is 5 mm on each axis, which is more than
  `STACK_LINK_MM`, so the coin is no longer part of the stack and the stack's
  badge shows the reduced count. The `detached` look is removed on release,
  cancel, or when the drag ends. A second pointer before the drag starts cancels a pending
  hold and undoes a completed one (the press goes back to a group drag); a
  locked board or a cancelled pointer abandons the press entirely.
- **Group drops.** The drop is measured from the coin the player grabbed (the
  leader). A group dropped onto a same-denomination coin or stack is re-laid on
  top of it: the group's coins become consecutive layers above the target
  stack's top coin (each `STACK_STEP_MM` further, in the group's own draw
  order, with the target's rotation), so one stack of the combined size results
  (the badge shows the combined count). A group dropped on a
  different-denomination coin is pushed apart as a unit, the other coin moving
  away too, as for a single coin. The group's members never react to each
  other. Other coins that were not touched never move.

### Too-close coins settle themselves

When a coin is added (tap or tray drop), dropped after a drag, or moved with
the arrow keys, it is checked against the coins it has moved *towards*. Two
coins are too close when the distance between their centres is less than the
radius of the smaller one (each centre lies under the other coin). The result
depends on the denominations:

- **Same denomination: they stack.** The moved coin snaps onto the stack of the
  too-close coin of its type that is latest in draw order: it is placed on that
  stack's top coin, a fixed small offset up and to the right
  (`STACK_STEP_MM = { x: 1, y: -1 }`), with the same rotation, so the pile reads
  as a neat stack of layers. Several coins give a diagonal stack. Every coin is
  still its own pile entry, with its own uid, tap-to-remove and arrow-key move;
  a pointer drag moves the whole stack (see above).
- **Different denominations: they are pushed apart.** Both coins (and every
  coin stacked with either of them, which moves as one unit) are moved away
  from each other along the line between their centres, each by half of what
  is needed, until their centres are `PUSH_FACTOR × (rA + rB)` apart
  (`PUSH_FACTOR = 0.75`), so both coin shapes stay clearly visible. A push can
  make a coin too close to a third coin; that is settled the same way, for at
  most `MAX_SETTLE_PASSES = 8` passes. If the pile is too crowded to settle,
  coins stay where the last pass left them. Nothing fails and nothing is
  removed.
- **Only moves towards count.** A coin is only reacted to if the mover is now
  closer to it than before the move (an added coin has no previous position,
  so every too-close coin counts). Coins of the mover's own stack at its
  starting position never make it snap. So dragging a coin away from a stack is
  never undone, and the arrow keys can pull a coin out of its stack.
- **Animated.** The pushed coins, and the moved coin when it snaps or is
  pushed, glide to their settled position over 150 ms. A drop first lands
  where it was released, then glides.
- A drag may still drop a coin so it fully covers another of a different type
  for a moment; it is pushed apart straight away, so the player never has to
  drag a coin off another to see it.

### Dragging from the tray

- **Drag a coin from the tray into the pile.** Pressing a tray coin and moving
  more than `DRAG_THRESHOLD_PX` starts a drag of a *new* coin. The tray coin
  stays in the tray (the supply is unlimited) and is dimmed while dragging; a
  copy of the coin, drawn at its pile size, follows the pointer with its centre
  under the pointer, and the pile is outlined while the pointer is over it. On
  release with the pointer inside the pile area, a coin of that denomination is
  added at that spot (clamped), on top, with a random rotation, and settles like
  any other moved coin. Released outside the pile area, nothing is added.
- A tap on a tray coin (no drag) still adds a coin at a random spot as before,
  and the click after a drag is suppressed. Locked when solved, only the first
  pointer drags, and a starting drag cancels the pending dwell timer, exactly as
  for pile coins. The keyboard alternative is the existing Enter/Space add.
- Only tray coins and pile coins are draggable; nothing else.

### Stack count

- A stack shows a count badge such as `×2` or `×3` on its top coin (the last of
  the stack in draw order). It updates whenever coins join, leave, or are
  removed; a lone coin shows no badge. The badge is a small label at the coin's
  lower right, upright, `pointer-events: none`, `aria-hidden`, and visible in
  both Normal and Easy (it is a count, not a value). The top coin's
  `aria-description` reads `Stack of N. Use arrow keys to move`. It does not
  change the pile summary, the total, or tap/drag behaviour.
- **A detached coin does not count.** The moment the hold completes and a coin
  is detached (it lifts), that coin leaves its stack as far as the badge is
  concerned: the held coin shows no badge, and the stack it came from shows its
  reduced count (`×2` from `×3`, no badge at all from `×2`) on its own top
  coin immediately, while the pointer is still down. If the detached state ends
  without a drop that changes the pile (release without moving, cancel, a second
  pointer, a locked board), the counts return to the real stack. A re-render
  while a coin is detached keeps it excluded.

### Keyboard, touch, inspect and motion

- **Keyboard alternative.** A focused pile coin can be moved with the arrow
  keys: 0.02 of the pile size per press, 0.10 with Shift held. An arrow press
  always moves only the focused coin, even in a stack (this is how a keyboard
  user pulls a coin out of a stack). Each press brings the coin to front,
  clamps, and settles. Arrows with Ctrl, Alt or Meta, and arrows while a
  pointer drag is in progress, are ignored. Enter/Space keep their normal
  action (remove).
- **Accessibility text.** Pile coin buttons get an `aria-description` of
  "Use arrow keys to move" (with the stack prefix above on a stack's top coin).
  Moves are not announced one by one.
- **Touch.** Pile and tray coins use `touch-action: none` and `cursor: grab`
  so a drag does not scroll the page. The pile area itself and the rest of the
  page still scroll normally.
- **Interplay with inspect.** Starting a drag cancels a pending dwell timer. A
  coin that is already revealed stays revealed until the press ends.
- **Reduced motion.** With `prefers-reduced-motion: reduce` the glide is
  removed: coins jump straight to their settled position.

## Design

### Pile data (extends the messy pile spec)

Entries keep the shape `{ uid, coinId, x, y, rot }`. A move updates `x` and
`y` and moves the entry (or the group, as a block) to the end of the array.
`uid` never changes, so focus and keying survive the move.

### `src/game.js`

- `clampPosition(x, y)` returns `{x, y}` limited to ±0.5; a NaN coordinate
  becomes 0 and ±Infinity becomes ±0.5. Pure.
- Constants `STACK_STEP_MM = { x: 1, y: -1 }`, `STACK_LINK_MM = 3`,
  `PUSH_FACTOR = 0.75`, `MAX_SETTLE_PASSES = 8`.
- A private `unitOf` finds a stack (connected component of same-denomination
  coins within `STACK_LINK_MM`). Group membership, the badge and the push units
  all use it, so they can never disagree.
- `settlePile(pile, uid, from)` returns a new pile (same entries, same order,
  only `x`, `y` and, for stacked coins, `rot` changed) with the too-close rules
  applied for the moved coin `uid`. `from` is the coin's position before the
  move (`{x, y}`), or `null` for a newly added coin. If nothing needs to change,
  or `uid` is unknown, it returns the same array. Pure and deterministic (no
  rng). Coins that coincide exactly are pushed along the x axis. Every result
  position passes through `clampPosition` (coin by coin).
- `settleGroup(pile, uids, leaderUid, from)`: like `settlePile`, with the group
  as the mover. `leaderUid` is the coin the player grabbed and `from` its
  position before the move (`null` for none). Same-denomination targets use the
  re-lay rule; different denominations are pushed apart as a unit; the group's
  own members never react to each other. Same array if nothing changes or the
  leader is not among `uids`. Pure, deterministic, clamped. `settlePile` and
  `settleGroup` share one internal implementation.
- `unitUids(pile, uid)` returns the uids of the stack containing `uid` in draw
  order; a lone coin returns `[uid]`, an unknown uid `[]`.
- `stackCounts(pile)` returns a `Map` from uid to stack size for the top coin
  of every stack of two or more. Pure.

### `src/state.js`

- `moveCoin(state, uid, x, y)`: returns a new state with the entry moved to the
  clamped position and placed last in the array. Unknown `uid`, or a solved
  state, returns the same state object. It does not settle.
- `moveGroup(state, uids, dx, dy)`: shifts every listed coin by the same
  fraction delta (a NaN delta counts as 0, and the delta is limited so that no
  member leaves ±0.5), moves those entries to the end of the array keeping
  their relative order, and changes nothing else. Uids not in the pile are
  ignored; same state object when solved or when none of `uids` is in the
  pile. It does not settle.
- `settleCoin(state, uid, from)`: a new state whose pile is
  `settlePile(state.pile, uid, from)`; same state object if nothing changes, or
  if the state is solved or `uid` is unknown.
- `settleGroupCoins(state, uids, leaderUid, from)`: `settleGroup` applied to the
  pile; same state object if solved, the leader is unknown, or nothing changes.
- `addToPile(state, coinId, rng)` settles the coin it just added
  (`settlePile(..., uid, null)`).
- `addToPileAt(state, coinId, x, y, rng = Math.random)` adds a coin of that
  denomination at the clamped position, with `rot` from `rng`, as the last
  entry with the next uid, clearing the message. It does **not** settle (the
  caller settles after a style flush, as for a move). Solved state or an
  unknown `coinId` returns the same state object.
- The total never changes on a move or settle.

### `src/drag.js` (DOM-light)

Pure exports, unit-tested without a DOM:

- `DRAG_THRESHOLD_PX = 6` and `passesThreshold(dx, dy)` (distance strictly
  greater than the threshold).
- `DETACH_HOLD_MS = 1000`.
- `toPileFraction(point, rect)`: the inverse of `pileBox`, unclamped.
- `pixelsToFraction(dxPx, dyPx, rect)`: a pixel delta as a pile-fraction delta
  (the linear part of `toPileFraction`).
- `pointInRect(point, rect)`, edges inclusive.
- `coinSizePx(coin, pileRect)`: the drawn coin diameter in px (pile box width
  is `PILE_WIDTH_MM + 2 * PILE_MARGIN_MM`).

`createDrag(container, { onMove, onMoveGroup, getGroup, onDragStart, isLocked })`
returns `{ suppressed, active }`. Attached once to the pile container (event
delegation on `[data-uid]`):

- On `pointerdown` on a pile coin: ask `getGroup(uid)` for the stack; record
  the members, the start point and the grab offset; `setPointerCapture`; for a
  stack, start the `DETACH_HOLD_MS` timer. When it fires the coin gets
  `detached` and the press becomes single-coin. A stale track (the same pointer
  id again, a new primary pointer of the same type, or a dragged coin no longer
  in the DOM) is abandoned first.
- On `pointermove`: if the movement passes the threshold, clear the hold timer,
  enter drag mode (`dragging` on the coin, or on every member of a group), set
  the suppress flag and call `onDragStart(el)`. During the drag, move the
  elements with the `--dx`/`--dy` custom properties (no state update per
  frame).
- On `pointerup`: if dragging, clear `dragging`, `detached` and the offsets,
  set `transition: none` on the dropped elements for the duration of the call,
  then call once either `onMove(uid, x, y)` (pointer plus grab offset, via
  `toPileFraction` against the padding box) or `onMoveGroup(uids, dx, dy,
  leaderUid)` (via `pixelsToFraction`). If not dragging, do nothing and let the
  click go through as a tap.
- On `pointercancel` or loss of capture by the leader: restore the coins to
  their recorded positions; no state change.
- The suppressed click is swallowed in the capture phase. The flag is cleared
  by the swallowed click, by the next `pointerdown` (not by a second finger
  while a pointer is tracked) and by a `keydown` outside a drag.

`createTrayDrag(container, { onDrop, onDragStart, isLocked, pileEl })` returns
`{ suppressed, active }` and follows the same threshold, one-pointer, stale-track
and click-swallow rules. The ghost is a `position: fixed`, `pointer-events: none`
`.tray-ghost` clone of the coin, sized with `coinSizePx` from the pile's width
and appended inside `.board` (so the difficulty rules hide its label). The
source coin gets `dragging-source` and the pile `over-pile` while the pointer is
over it. `onDrop(coinId, x, y)` is called once, with unclamped fractions of the
pile area, only when the pointer is inside the pile's rect.

### `src/main.js`

- Creates both controllers before the matching `watchDwell` call so their
  listeners run first; `getGroup` is `unitUids(state.pile, uid)`.
- A single-coin drop and an arrow-key press go through `moveAndRefocus`:
  remember the coin's position, `update(moveCoin(...))` so the coin lands
  exactly where it was released, force a style flush, clear the drop's
  `transition: none`, then `update(settleCoin(state, uid, from))` so the glide
  starts from there. Focus is restored to the same `uid` after the re-render.
- A group drop goes through `moveGroupAndRefocus`: the same steps with
  `moveGroup` and `settleGroupCoins`, `from` being the leader's position.
- A tray drop: `update(addToPileAt(...))`, force a style flush, then
  `update(settleCoin(state, newUid, null))`.
- The touch hold-then-release removal in `watchDwell` is skipped when the
  matching controller reports `suppressed()`.

### `src/render.js`

- `renderPile` also updates `left`, `top` and `--rot` of coins that already
  exist, so settled coins move in place.
- On every pile render it shows the `.stack-badge` from `stackCounts` and sets
  the matching `aria-description`.

### `styles.css`

- `.pile-coin { touch-action: none; cursor: grab; transition: left 150ms
  ease-out, top 150ms ease-out; }`; `.pile-coin.dragging` (grabbing cursor,
  `z-index: 1000`, no transition, shifted by `--dx`/`--dy`, drop shadow);
  `.pile-coin.detached` (scaled up, drop shadow, on top).
- `.coin { touch-action: none; cursor: grab; }`, `.coin.dragging-source`
  (dimmed), `.tray-ghost`, `.pile.over-pile` (outline).
- `.stack-badge`: small pill at the lower right, `pointer-events: none`.
- The locked board turns both cursors back to default. The transition is
  removed under `prefers-reduced-motion`.

## Edge cases

- Pressing a stack coin and moving less than the threshold, then releasing
  before 1 second, is a tap and removes that coin, as it does today. Releasing
  after the hold without dragging removes nothing and steps the coin out of its
  stack (see "Once held, the coin stays separated").
- A group near the pile edge stops against the edge as a unit (its extreme
  member touches the limit); the drag never squashes it. Settling (a push or a
  re-lay) clamps coin by coin, so a stack pushed against the edge may squash
  slightly; this is accepted.
- A coin taken off with a hold and then dragged back onto its old stack stacks
  onto it as a normal single-coin drop; it does not re-join silently.
- Dragging a group onto a stack of the same type that is itself overlapping a
  different coin pushes that coin away after the merge, within the pass limit.
- A drag that starts on one coin while another is fully over it is not
  possible; the pointer always hits the topmost coin at that point. That coin
  (or its stack) is moved first, revealing the one beneath.
- Dropping a coin between a stack and a different coin: it snaps to the stack
  first, then the whole stack and the other coin are pushed apart.
- A crowded pile (many coins, no free room) may end with coins still close
  after 8 passes. The total, uids and order are always intact.
- Taking a coin off a stack (hold, then drag) leaves the rest of the stack
  intact; the coin stays where it is dropped unless it was dropped onto
  another too-close coin.
- A drag that ends outside the pile area still ends the drag; the coin is
  clamped to the nearest edge.
- Two fingers: only the first pointer drags; additional pointers are ignored
  (before the drag starts, they only cancel the hold).
- A tray drag released with the pointer (the coin's centre) outside the pile
  adds nothing; released inside, a coin partly hanging over the edge is clamped
  to the edge.
- A badge sits on whichever coin is last in draw order, so arrow-keying a
  middle coin to the front moves the badge to it, and a stack of two that is
  split loses its badge. With the 3 mm link, removing a middle layer leaves the
  rest counted as one stack.
- Rapid drag then tap on another coin: the swallowed-click flag is cleared on
  the next `pointerdown`, so a legitimate tap is never swallowed.
- Re-render during a drag (for example the hint message updating) must not
  rebuild the dragged element; the pile is keyed by uid and the controller
  reads positions from the DOM until the drop commits state.

## Testing

Unit tests (`npm test`, Node's built-in runner) cover the pure parts; the
pointer glue in `createDrag` / `createTrayDrag` and `main.js` is kept thin and
checked manually.

- `game.js`: `clampPosition` leaves in-range values unchanged, clamps each
  axis independently, maps NaN to 0 and infinities to the limits; the settle
  constants.
- `settlePile` / `settleCoin` / `addToPile`: a same-type coin placed too close
  snaps to the neighbour plus the stack step with the neighbour's `rot`; the
  latest too-close same-type coin is joined; a coin too close to the bottom of
  a stack snaps to its top; a different-type pair ends exactly
  `0.75 × (rA + rB)` apart, pushed equally in opposite directions; coincident
  centres are pushed along x without NaN; a pushed stack moves as a unit; a
  push cascades to a third coin; a crowded pile is capped by the pass limit;
  moving away is not snapped back or pushed, and an arrow step in any direction
  pulls the top of a 2- or 3-stack out; a far drop still snaps; nothing changes (same
  array/state) when no coin is too close, for an unknown uid, or when solved;
  results are inside ±0.5; uids, coinIds and order are preserved.
- `stackCounts`: empty for an empty or all-single pile; 2 for a stack of two
  and 3 for a chained three, keyed on the last coin in draw order; separate
  stacks counted separately; different denominations never counted together,
  even when interleaved in the array.
- `unitUids`, `moveGroup`, `settleGroup` / `settleGroupCoins`: stack in draw
  order, `[uid]` for a lone coin, `[]` for unknown; `STACK_LINK_MM = 3` keeps a
  stack linked when a middle layer is removed; `moveGroup` shifts all members
  together to the end in order, clamps jointly without squashing, handles NaN
  and Infinity, and is a no-op (same object) for solved, empty or unknown;
  `settleGroup` re-lays a group above a lone same-type coin or the top of an
  existing stack with the right combined count, pushes a different coin away
  keeping the group rigid, only re-lays when moving towards, never lets members
  react to each other, ignores a bad leader, and survives 20 coins at one spot.
- `state.js`: `moveCoin` moves one entry to the end, clamps, keeps other
  fields, total, rounds, message, `nextUid` and target, and no-ops on unknown
  `uid` and when solved; uids stay stable across move, add and remove.
  `addToPileAt` adds one entry at the clamped position with the next uid and a
  rotation from `rng`, raises the total, clears the message, does not settle,
  never reuses a uid, and returns the same object when solved or the `coinId`
  is unknown.
- `drag.js`: `DRAG_THRESHOLD_PX` and `passesThreshold` (strictly greater);
  `toPileFraction` at the centre and corners, unclamped outside, and inverse of
  `pileBox`; `pointInRect` edges inclusive; `coinSizePx` for the largest and
  smallest coin; `DETACH_HOLD_MS` is 1 second; `pixelsToFraction` maps zero to
  zero and matches `toPileFraction` differences.
- Manual: mouse drag, touch drag on a phone-sized viewport (page does not
  scroll while dragging a coin), tap to remove still works, drag does not
  remove, arrow keys move a focused coin, locked after solving; dropping
  same-type coins together stacks them, dropping different coins together
  pushes them apart with a glide, and no glide with reduced motion; the badge
  shows ×2 / ×3 and disappears when the stack is split; dragging a tray coin
  into the pile adds it (stacking or pushing as above), dragging it outside adds
  nothing, a tap on the tray still adds randomly, and a touch drag from the
  tray does not scroll the page; dragging a stack moves all its coins together
  and a stack dropped on a same-type stack merges with the right count; holding
  a stack coin for 1 second lifts it and then drags only it; a quick tap on a
  stack coin still removes one coin; arrow keys still move a single coin.

## Out of scope

Dragging coins back from the pile to the tray (removal stays a tap), dragging
between piles, momentum or physics, a stack as a single pile entry (each coin
stays its own entry), auto-sorting or grouping beyond the stack and push rules
above, undo, and sound.
