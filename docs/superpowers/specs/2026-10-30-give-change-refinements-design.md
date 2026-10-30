# Give Change refinements: Design Spec

Date: 2026-10-30
Builds on: `2026-10-29-give-change-mode-design.md`, `2026-10-27-drag-coins-design.md`

## Purpose

Playtesting showed three things in Give Change that are not intuitive:

1. The two piles are different sizes (customer 4 cm, player 6 cm).
2. The customer's coins and the player's change cannot interact, although handing a
   customer's own coin back is the natural way to give change.
3. When no change is due, pressing Check on an empty change pile is rejected, while
   pressing No change works. An empty pile should read as "no change".

## Requirements

### Pile sizes

- The customer pile and the player's change pile are both a **5 cm** box (was 4 cm
  and 6 cm). The total stays 10 cm on a tall phone.
- On a short screen (under 700 px high) both are **4 cm**. The change pile already
  shrinks to 4 cm there; the customer pile gains the same compact size so the two
  stay even.
- Other modes keep their 9 cm play area.

### Moving coins between the piles

- Works in **every round** (overpaid, exact, underpaid), so a move never reveals
  whether change is due.
- Drag a customer coin, or a stack, and release it over the change pile: it leaves
  the customer pile and lands where it is dropped, then settles into stacks at the
  change pile's height. Dragging a change coin, or a stack, over the customer pile
  does the reverse. A group moves as a whole.
- **The dragged coin stays visible across both piles.** Each pile is its own stacking
  context (`container-type`) and the middle area scrolls, so a coin dragged inside its
  own pile would hide under, or be clipped by, the other one. In Give Change a pile
  drag is therefore drawn as fixed-position ghosts on `<body>` (as the tray drag does),
  one per dragged coin with their relative offsets kept, while the source coins stay in
  place, dimmed, until the drop. The pile under the pointer (the other one) is
  highlighted while the ghost is over it.
- A release over the coin's own pile moves it within that pile, as today. A release
  outside both piles keeps it where it was: nothing moves (unlike today's in-pile drag,
  which clamps it to the pile edge; with two piles that would read as a failed move).
- The moved coin keeps its coin type and gets a new `uid` in the target pile.
- **Limit.** A move into the customer pile is refused when the customer pile's total
  would exceed the amount the customer originally paid (`paid`), because that is the
  cashier giving extra money back. The coins snap back, nothing changes, and a hint
  appears: "That is more than they paid. Press Clear to start again." The hint is a
  normal hint (cleared by the next action, announced by the `aria-live` message).
  Moves into the change pile are never refused.
- **Tray.** Tray drops still go only to the change pile.
- **Tap.** Tapping a coin in the customer pile sends that one coin to the change pile
  (placed like a tray tap, never refused). Tapping a customer-flagged coin in the change
  pile sends it back, subject to the same limit (refused with the Clear hint if the
  customer pile would exceed `paid`). Tapping one of your own coins in the change pile (one
  added from the tray) removes it (the coin is discarded). A coin that came from the
  customer can never be removed, and is labelled "20p coin", not "Remove 20p". Enter or
  Space on a focused coin does the same as a tap, and focus follows the moved coin. When a
  touch hold reveals a coin's value, the hold is read-only for coins that
  send on tap: the release (and the click after it) does nothing. A solved round ignores
  taps.
- **Clear.** In Give Change, Clear restores the customer pile to the coins and
  positions dealt at the start of the round and empties the change pile. It still
  clears the message.
- **Keyboard.** Arrow keys still move a focused coin within its pile. Enter or Space on a
  focused coin sends it to the other pile like a tap, and focus follows it.

### Judging

- A round stores `paid`, the original amount in pence. Check, No change and Not
  enough! judge against `paid` and the stored `price` and `scenario`, never against
  the customer pile as currently shown. Moving coins does not change the scenario or
  the change due (`paid - price`).
- Check on an overpaid round is correct only when the change pile totals exactly
  `paid - price`; returned customer coins count toward that total like any other.

### Empty Check

With an empty change pile (`changeTotal === 0`), Check on a non-overpaid round acts as
the No change button:

| Round | Empty Check | Non-empty Check (unchanged) |
|---|---|---|
| Exact | Correct: "Correct! No change due.", solves the round, Customers served +1 | "Does this customer need change?" |
| Underpaid | Wrong, hint "They have not paid enough yet" | "Does this customer need change?" |
| Overpaid | Wrong, "Not enough change" (unchanged) | Judged against `paid - price` (unchanged) |

The No change and Not enough! buttons behave as before.

## Design

### `src/game.js`

- `CUSTOMER_BOX_MM = 50`, `CHANGE_BOX_MM = 50`, `CHANGE_BOX_COMPACT_MM = 40`, new
  `CUSTOMER_BOX_COMPACT_MM = 40`.
- `judgeAnswer(scenario, action, changeTotal, due)`: when `action` is `"check"`,
  `changeTotal === 0` and `scenario !== "over"`, it is treated as `"none"`.

### `src/state.js`

- Dealt customer entries carry `customer: true`. The flag travels with the entry through
  transfers (they spread the entry), `removeFromPile` refuses flagged entries, and
  `renderPile` labels them as not removable. Tray coins never get the flag, even if
  moved through the customer pile.
- A Give Change round (`startGiveChange`, `nextGiveChangeCustomer`) stores `paid`
  (pence) and `dealt`, a copy of the dealt customer pile (entries with their
  positions) used by Clear. `createState` defaults: `paid: 0`, `dealt: []`.
- `pileHeightMm(state, key, compact)`: in Give Change the customer pile uses
  `CUSTOMER_BOX_MM`, or `CUSTOMER_BOX_COMPACT_MM` when `compact`; the change pile
  uses `CHANGE_BOX_MM` or `CHANGE_BOX_COMPACT_MM`.
- New `transferCoins(state, uids, leaderUid, from, to, x, y, compact)`: moves the named entries
  from list `from` to list `to` (keys `"pile"` and `"change"`), only in Give Change
  and only when the round is not solved. The dragged leader lands at (`x`, `y`),
  clamped; other members keep their offset from it. Entries get new `uid`s from
  `nextUid` and are settled at the target's height. When `to` is `"pile"` and the
  customer total after the move exceeds `paid`, it returns the state with only a new
  hint message (`{ text: "That is more than they paid. Press Clear to start again.",
  kind: "hint" }`) and both lists unchanged.
- New `sendCoin(state, uid, from, rng, compact)`: picks a landing spot with `placeCoin` in the other
  pile and calls `transferCoins` for that one coin. It returns the state unchanged for a bad key,
  an unknown coin, or one of your own coins in the change pile (the caller removes it).
- `submitGiveChangeAnswer` computes `due` from `paid` instead of `total(state.pile)`.
- `clearPile(state, "change")` in Give Change also restores `pile` from `dealt` (the original entries and `uid`s;
  `nextUid` only grows, so no `uid` can clash) and empties `change`.
  Other modes are unchanged.
- `locked(state, "pile")` stays locked for taps and tray adds; transfers use
  `transferCoins`, not the add/remove functions.

### `src/drag.js`

`createDrag` takes an optional `dropTarget(point)` that returns `null` or
`{ key, el, heightMm }` for the pile under a viewport point. It is called once when a
drag starts (passes the threshold), with the drag's start point: `null` keeps the
classic in-pile drag, exactly as today; a pile switches that drag to ghost mode. In
ghost mode it is then asked with the pointer's point on every move (the other pile
under the pointer gets `over-pile`) and at the release. A release over a pile whose
`el` is not the drag's own container calls a new
`onTransfer(uids, leaderUid, key, x, y)` with the leader's fractions computed against
that pile's `el` padding box and `heightMm` (same maths as a drop inside the pile),
instead of `onMove` / `onMoveGroup`; a release over the own pile takes the usual
`onMove` / `onMoveGroup` path; a release outside both piles calls nothing. In ghost mode
the dragged coins are drawn as `body` ghosts (see above) and the source coins get the
`dragging-source` dimming instead of moving with `--dx` / `--dy`; release, cancel and a
lost capture remove the ghosts, the dimming and `over-pile`. The hold-to-detach,
threshold and cancel logic are unchanged. Without `dropTarget`, behaviour is unchanged.

### `src/main.js`

- Passes `dropTarget` to both piles' drags in Give Change (hit-test the two pile
  containers) and wires `onTransfer` to `transferCoins`, refocusing the moved coin as
  `moveAndRefocus` does.
- Only supplies the hit-test (`dropTarget`); `createDrag` itself highlights the other pile with `over-pile` while a ghost is over it.
- Re-renders both piles and their hidden summaries after a transfer. A refused move
  re-renders so the dragged coin returns to its place.

### `styles.css`, `README.md`

- The pile height reaches the DOM through the existing `--pile-h-mm`; check that the
  Give Change layout rules (top bar, card and dock paddings) still fit a 375 × 667
  phone with both piles at 5 cm (4 cm on short screens), and adjust spacing only if
  not.
- Update the README's Give Change paragraph (pile sizes, moving coins, Clear, empty
  Check).

## Testing

- `tests/game.test.js`: `judgeAnswer` for every scenario with an empty and a
  non-empty pile; box constants and the compact sizes.
- `tests/state.test.js`: `pileHeightMm` for both piles, compact and not;
  `transferCoins` both directions, a group, new `uid`s, settling; the limit refusal
  (hint, lists unchanged, `message.kind === "hint"`); moves allowed in exact and
  underpaid rounds; scenario, `price` and due unchanged after moves;
  `submitGiveChangeAnswer` correct with a returned customer coin in the change pile;
  Clear restoring `pile` from `dealt` and emptying `change`; Clear unchanged in the
  other modes; a solved round refuses transfers.
- `tests/drag.dom.test.js`: with `dropTarget`, a started drag appends `body` ghosts (one per coin), dims the sources and removes both on release or cancel; a drop over the other pile calls `onTransfer` with that
  pile's fractions; a drop elsewhere does not; `onMove` still fires for a drop in
  the coin's own pile; no `dropTarget` leaves behaviour unchanged.
- Existing tests that assert the old 4 cm and 6 cm sizes are updated.
- **e2e:** not touched. The existing specs that check the old pile sizes will be stale
  until the owner asks for a comprehensive e2e pass.

## Out of scope

- Positioning a coin in the other pile by keyboard: Enter or Space on a focused coin sends it
  like a tap and focus follows it, and arrow keys still move within a pile.
- Bringing back a discarded tray coin (a tray coin tapped away is gone; Clear is the reset).
  Customer coins can't be tapped away.
- Any change to Endless, Custom or Cashier.
- This spec is written against Give Change after the menu and options work (difficulty is
  the `state.options` registry: Show Coins, Short-paying customers).
