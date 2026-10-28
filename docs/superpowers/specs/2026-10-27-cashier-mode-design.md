# Cashier mode (customer booth): Design Spec

Date: 2026-10-27
Builds on: `2026-10-27-coin-game-design.md`,
`2026-10-27-inspect-to-reveal-design.md`, `2026-10-27-messy-pile-design.md`,
`2026-10-27-drag-coins-design.md`
Part 4 of 4. Written now; built after the other three.

## Purpose

Flip the core game around. Instead of building a pile to match a target, the
player is a cashier: a customer puts a handful of coins on the counter and the
player works out how much it is. An endless mode, like Endless, from the other
side of the counter.

## Requirements

- **Home.** A third button, "Cashier", next to Endless and Custom. It behaves
  like Endless seen from the other side of the counter: customers keep coming
  (Next after each correct answer, a running counter) until the player presses
  Back. It has no "Play again" or "Change amount", which belong to Custom. The
  Easy/Normal toggle from the inspect spec applies to this mode.
- **Round flow.**
  1. A customer places a random handful of coins on the counter, shown as a
     messy pile (same rendering as the messy pile spec). The player cannot add
     or remove these coins, but can drag them around the counter (drag spec)
     to separate overlapping coins and count them.
  2. The player types the total into an amount field (`inputmode="decimal"`,
     parsed by the existing `parseAmount`, so "3.95", "£3.95", "4", ".5" work).
  3. Check compares the typed amount with the true total of the coins.
- **Feedback.**
  - **Correct:** success message, rounds counter increments, a Next button
    brings the next customer. Check and the input are locked after a correct
    answer, as in the core game, so a round cannot be submitted twice.
  - **Too high / too low:** gentle hint ("Too high" / "Too low"). The coins stay,
    the typed text stays, and the player can recount and try again. No penalty,
    no attempt limit.
  - **Invalid text:** the same inline error as Custom mode; it does not count as
    an attempt.
  - **Empty field:** treated as invalid input with the same inline error.
- **Counter.** There is no target display. The running-total line used in other
  modes is not shown (it would give away the answer). The hint region and a
  "Customers served: N" counter are shown.
- **Difficulty.**
  - **Normal:** coin values are hidden; the player must dwell on a coin to read
    its value, or recognise coins by size, shape and colour.
  - **Easy:** values are always visible; the task is purely adding up.
- **Exit.** Back returns to Home without confirmation and discards the round.
  The customers-served counter resets when Cashier is started again.
- **No persistence, no timer** (consistent with v1).
- **Accessibility.**
  - The amount field has a visible label, `aria-invalid` and `aria-describedby`
    for errors, as in Custom mode.
  - The result message and hint region are `aria-live`.
  - A visually hidden summary of the counter coins ("On the counter: 2 × 20p,
    1 × £1, ...") is provided. This reveals the denominations to screen reader
    users, consistent with the inspect spec's decision that hiding printed values
    is a visual challenge only. Because the summary lists coin types and counts
    but not the total, the player still has to do the sum.

## Customer generation

New pure function in `src/game.js`:

`randomHandful(rng = Math.random, previous = [])` returns an array of coin ids
(`previous` is the last handful's ids, used for the repeat guard). State turns
these ids into pile entries using the placement rules below.

- Coin count: integer in 2 to 12 (inclusive), via `rng`.
- Each coin: a uniformly random denomination from the 8 UK coins.
- Placement: coins are laid out like the messy pile, except that a coin whose
  denomination is already on the counter lands on one of those coins with
  probability `STACK_CHANCE = 0.25`, so it stacks, as real customers sometimes
  do. (The messy pile spec makes the player's own coins land apart; that rule is
  unchanged.) Stacked coins are still separate coins in the total and summary.
- Cap: at most `MAX_HANDFUL = 12` coins so the pile stays readable on a phone.
- The true total is computed with `total()` from the generated coins, never
  stored separately, so the answer cannot disagree with what is on screen.
- Totals are not capped at £9.99; a handful of 12 mixed coins can exceed it.
  This is accepted (the answer field already accepts up to £99.99).
- A handful with the exact same total as the previous customer is allowed; only
  an identical coin multiset on consecutive rounds is re-rolled once (cheap
  guard, not a guarantee).

Reasoning: uniform denominations give a realistic mix of small and large coins
and totals that vary widely, without any need for a separately generated
target.

## Design

### State

`mode: "cashier"` is added. The cashier state carries the same pile as the other
modes (an array of entries `{uid, coinId, x, y, rot}`, see the messy pile and
drag specs), with `target` unused (0), an `answer` text field in the UI (not in state), the
rounds counter, and `solved`. `submitAnswer(state, pence, now)` is a new function in
`state.js` returning a new state with a hint message (`over`/`under` mapped to
"Too high"/"Too low") or the solved state. It reuses the 400 ms advance guard
via `canAdvance`.

### `src/game.js`

- `randomHandful(rng)` as above.
- `checkAnswer(pile, pence)` returns `"exact" | "over" | "under"` where "over"
  means the answer is higher than the true total (message: "Too high"). Thin
  wrapper over `check(pile, answer)` to keep the naming straight.

### `src/main.js` / `index.html`

- New "cashier" screen section (or reuse of the play screen with elements shown
  and hidden per mode, whichever the plan finds smaller). Hidden elements in
  this mode: target, tray, total, Clear.
- Starting a round builds pile entries from `randomHandful()` using the
  placement rules above and puts them in state; adding and removing coins is
  disabled in this mode (moving is not).
- Taps on counter coins do nothing (no removal), and there is no tray. Dragging
  and arrow-key moving of counter coins work as in the drag spec; the coins are
  labelled "20p coin" rather than "Remove 20p".
- Check button, Enter in the field and Next follow the same focus management as
  other modes (focus the success action after a correct answer; focus the heading
  at the start of a round).

## Edge cases

- Back mid-round discards the round; reload resets everything.
- The player can still dwell on counter coins to read values in Normal mode.
- Duplicate submit of a correct answer is ignored once solved.
- Repeated identical wrong answers still re-announce the hint (new message
  object per check, as in the core game).

## Testing

- `randomHandful`: with a stub `rng` at both extremes the count is 2 and 12;
  every id is a valid coin; the result length never exceeds `MAX_HANDFUL`.
- `checkAnswer`: exact, too high, too low, and pence equal to a wrong total of a
  different coin mix.
- `state.js`: `submitAnswer` solving increments rounds once; a wrong answer keeps
  the pile; further input after solving is a no-op returning the same object; the
  400 ms guard applies to Next.
- `parseAmount` reuse: empty and invalid strings produce the shared error.
- Manual: Normal and Easy on desktop and a phone-sized viewport; confirm tray
  and total are hidden; confirm a correct answer cannot be re-submitted.

## Out of scope

Change-giving, prices or shopping baskets, banknotes, per-customer patience
timers, scoring or streaks beyond the counter, sound, difficulty tiers beyond
Easy/Normal, and any change to Endless or Custom behaviour.
