# Give Change mode: Design Spec

Date: 2026-10-29
Builds on: `2026-10-27-cashier-mode-design.md`, `2026-10-27-drag-coins-design.md`,
`2026-10-27-messy-pile-design.md`, `2026-10-27-inspect-to-reveal-design.md`,
`2026-10-28-coin-visuals-and-layout-design.md`

## Purpose

An endless mode that combines Cashier and Endless. A customer pays for something
with a handful of coins; the player, as the cashier, works out whether change is
owed and, if so, builds it from the coin tray. The customer is not always well
behaved: they may pay exactly or underpay.

The screen reads like Endless: the customer's coins sit in the top bar, the
player's "Your change" card is in the middle, and the tray, Check and Clear are at
the bottom. Coins are drawn at one scale everywhere (never shrunk to make room); the
two piles are made shorter instead, so the whole screen fits a phone without
scrolling.

## Requirements

- **Home.** A fourth button, "Give Change", after Endless, Custom and Cashier. The
  Easy/Normal toggle applies. Like Endless and Cashier it is continuous: customers
  keep coming (Next after each correct answer, "Customers served: N") until the
  player presses Back. It has no "Play again" or "Change amount".
- **Three outcomes.** Each customer is one of:
  - **Overpaid** (`paid > price`): the correct answer is change totalling exactly
    `paid − price`.
  - **Exact** (`paid === price`): the correct answer is "No change".
  - **Underpaid** (`paid < price`): the correct answer is "Not enough!".
- **Answering.** Three answers: Check (in the dock), "No change" and "Not enough!"
  (in the "Your change" card).
  - **Check** is correct only on an overpaid round and only when the change pile
    totals exactly `paid − price`. On an overpaid round it hints "Too much change" /
    "Not enough change" (an empty change pile gives "Not enough change"; it is not an
    error). On an exact or underpaid round it hints "Does this customer need
    change?" whatever is in the change pile.
  - **No change** is correct only on an exact round; otherwise it hints "They
    overpaid, so you owe change" (overpaid) or "They have not paid enough yet"
    (underpaid).
  - **Not enough!** is correct only on an underpaid round; otherwise it hints "They
    paid enough".
  - Hints are gentle: no penalty, no attempt limit. Both piles are kept so the player
    can adjust and retry. Each wrong answer is a new message, so a repeated hint is
    announced again.
  - A correct answer shows a success message, increments "Customers served", locks
    the round (coins `aria-disabled`, as in the other modes) and shows Next. The
    messages are `Correct! Change: £x.xx.` (the amount due), `Correct! No change
    due.` and `Correct! They are £x.xx short.` (`price − paid`).
  - Enter (or Ctrl/Cmd+Enter) is a shortcut for Check, as in the other modes.
- **Outcome odds** are set in `src/config.js` per difficulty (`GIVE_CHANGE_ODDS`):
  - `underpaid`: Normal 0.25, Easy 0.
  - The rest splits between exact and overpaid by `exactShare` 1/3.
  - Resulting mix: Normal 25% underpaid, 25% exact, 50% overpaid; Easy 0%
    underpaid, about 33% exact, 67% overpaid.
- **Difficulty.**
  - **Normal:** printed coin values are hidden (dwell to read, as elsewhere).
  - **Easy:** values are always visible, a running total of the change pile ("Your
    change: £x.xx") shows under it, and "Not enough!" is hidden because no round is
    underpaid. The customer's paid total is never shown (the player sums it).
- **Exit.** Back returns to Home without confirmation and discards the round. The
  served counter resets when the mode is started again.
- **No persistence, no timer.** The existing 400 ms guard before Next works
  (`canAdvance`, `?advance=`) applies.
- **Accessibility.** Each pile has a visually hidden summary ("Customer paid: 2 ×
  20p, …" and "Your change: …") listing coin types and counts, not totals. The
  customer's pile is in a `role="group"` named by its visible label. Customer coins
  are labelled "20p coin" (not removable), change coins "Remove 20p". Focus follows
  the existing rules: the heading at the start of a round, the first visible dock
  action button (Next) after a correct answer. The hint line is `aria-live`.
- **Other modes unchanged.** Endless, Custom and Cashier look and behave as before,
  including their 9 cm play area (118.4 mm box) and the `.pile-area` card.

## Screen layout

Top to bottom:

1. **Top bar** (`.topbar`): Back, "Price £x.xx" (the heading) and "Customers served:
   N", then a group `#topbar-customer` with the label "Customer Coins:" and the
   customer's pile `#play-pile` under it. That pile has no drag hint. Its coins can be
   dragged and arrow-moved (to separate overlapping coins) but not added or removed.
2. **"Your change" card** (`#change-area`, an Endless-style `.pile-area`): heading
   "Your change", the hint "you can drag the coin around and stack them", the
   player's pile `#change-pile`, the Easy total `#change-total`, then one row
   `.answers` with "Not enough!" (`#btn-short`) on the left and "No change"
   (`#btn-none`) on the right. On Easy only "No change" shows, centred.
3. **Dock**: the same as Endless: the hint line `#play-message`, the coin tray, then
   Check and Clear (and Next after a solve). Clear empties only the change pile.

After a correct answer the two answer buttons **stay in place but are disabled**
(dimmed like the locked coins), so nothing in the card moves; they are enabled again
for the next customer. Check and Clear hide, as in Endless, and Next takes their place.

In the player's pile tray coins are added, removed, dragged, stacked, detached and
arrow-moved exactly as in Endless. A tray coin dropped anywhere outside the change
pile (including on the customer's pile) does nothing.

### Pile sizes

- **One scale.** Both piles are 138.4 mm wide like every pile and fill the same card
  width, and the tray uses the same mm-to-pixel scale, so a coin has the same
  diameter in the customer's pile, the player's pile and the tray.
- **Sizes are the visible dashed box** (the whole `.pile`, coin-radius margin
  included), because that is what the owner measures on screen. The play area, where
  coin centres may be, is the box minus `2 * PILE_MARGIN_MM` (28.4 mm) in each
  dimension:
  - **Customer pile: 4 cm box** (`CUSTOMER_BOX_MM = 40`, play height 11.6 mm).
  - **Player pile: 6 cm box** (`CHANGE_BOX_MM = 60`, play height 31.6 mm).
  - **Player pile on short screens: 4 cm box** (`CHANGE_BOX_COMPACT_MM = 40`) when
    `(max-height: 700px)` matches, e.g. an iPhone SE (375 × 667) or a landscape
    phone. With the 6 cm pile the SE scrolled and clipped "No change" once a hint
    showed in Easy, so the shorter pile applies there only; taller screens keep the
    6 cm pile.
- **Crowding is accepted.** A 12-coin handful in the 4 cm strip overlaps heavily and
  the player drags coins apart to count them; handfuls of 4–6 coins read fine. The
  handful size (2–12) is unchanged. Coin centres stay clamped inside the play area,
  so no coin is clipped by the edge or lost.

### Fitting the screen

- Within the app frame's existing height cap (no frame change), the top bar, the
  "Your change" card with its buttons and the dock are fully visible, with no
  scrolling and nothing behind the dock, at 390 × 844, 476 × 850, 375 × 667 and
  1280 × 800, in Normal and Easy, also while a hint shows. Spacing in Give Change mode is
  tightened (bar padding, card and dock gaps, more so under 700 px high); coins and
  the tray are never scaled.
- **The hint line keeps its space reserved**, as in Endless, so a hint appearing or
  clearing never moves the dock or the piles (a collapsing line made the screen
  jump). The one exception is a short landscape window (`max-height: 30rem`, e.g.
  844 × 390): there the content window is the scarce resource, the empty line
  collapses, and the requirement is only that every control stays reachable
  (scrolling the middle is allowed).
- **Known limit.** On iOS Safari the browser toolbars take part of the screen, so the
  usable height can be below the tested sizes and the middle may scroll there.

## Round generation (`src/game.js`)

All logic is pure and takes `rng` (default `Math.random`) for testing.

- **Customer coins** come from `randomHandful(rng, previous)` (2–12 coins; a handful
  matching the previous customer's coins is re-rolled once). `paid` is always
  `total(pile)`, never stored, so it cannot disagree with the screen.
- `rollScenario(odds, rng, paid = Infinity)` returns `"under" | "exact" | "over"`:
  `"under"` if `rng() < odds.underpaid`; otherwise a second draw `< odds.exactShare`
  gives `"exact"`, else `"over"`. An `"over"` becomes `"exact"` when `paid < 2`, so
  the scenario and the price cannot disagree (a handful is at least 2p, so this only
  guards the pure function).
- `priceFor(paid, scenario, rng)` returns the price in pence: `exact` → `paid`;
  `over` → `paid − k`, `k` uniform in `1 … floor(paid / 2)` (at least half of `paid`,
  at least 1p); `under` → `paid + k`, `k` uniform in `1 … 200`.
- `changeDue(paid, price)` returns `max(0, paid − price)`.
- `judgeAnswer(scenario, action, changeTotal, due)` returns `{ correct, hint }` for
  `action` `"check" | "none" | "short"`, applying the rules above (`hint` is `""`
  when correct). State and tests share this one source of truth.

## Pile heights (`src/game.js`, `src/drag.js`, `src/render.js`)

- `PILE_HEIGHT_MM` (90) stays the default. `game.js` exports `CUSTOMER_BOX_MM`,
  `CHANGE_BOX_MM`, `CHANGE_BOX_COMPACT_MM` and `heightForBox(boxMm)` (`boxMm − 2 *
  PILE_MARGIN_MM`), so the code states the visible size and derives the play height.
- Every function that measures the pile's y axis takes an optional trailing
  `heightMm = PILE_HEIGHT_MM`, so existing callers and tests are unchanged:
  `placeCoin`, `placeHandfulCoin`, `pileBox`, `detachNudge`, `settlePile`,
  `settleGroup`, `unitUids` and `stackCounts` (and their internal distance,
  clearance, stack-step and push helpers) in `game.js`; `toPileFraction` and
  `pixelsToFraction` in `drag.js`, with `createDrag` and `createTrayDrag` taking a
  `heightMm` option (a number or a function, resolved per pointer event);
  `renderPile(container, pile, excludeUid, removable, heightMm)` (which sets
  `--pile-h-mm` to the box height) and `showStackBadges` in `render.js`.
- `createTrayDrag`'s `pileEl` may be an element or a function returning one, so the
  tray drops onto the change pile in Give Change mode and onto `#play-pile` elsewhere.

## State (`src/state.js`)

- `"give-change"` is a mode and `isContinuous` is true for it. `createState` gains
  `change: []` (the player's coins, same entry shape as `pile`), `price: 0` and
  `scenario: ""`. One `nextUid` counter serves both piles, so uids stay unique.
- `startGiveChange(state, odds, rng)` and `nextGiveChangeCustomer(state, odds, rng)` deal the
  customer's handful into `pile` (placed and settled at the customer height), empty
  `change`, roll the scenario and set the price; `nextGiveChangeCustomer` keeps `rounds`
  and avoids a repeat handful; both keep `difficulty`. The odds come from `main.js`
  (`GIVE_CHANGE_ODDS[state.difficulty]`), since `config.js` already imports `state.js`.
- **Pile key.** `addToPile`, `addToPileAt`, `removeFromPile`, `moveCoin`,
  `settleCoin`, `moveGroup`, `settleGroupCoins` and `clearPile` take an optional
  trailing `key` (`"pile"` default, or `"change"`) and act on `state[key]`. In Change
  mode add, remove and clear on `"pile"` return the state unchanged (as in Cashier);
  move and settle work on either key. Callers that pass no key behave as before.
- `pileHeightMm(state, key = "pile", compact = false)` returns the play height:
  outside Change `PILE_HEIGHT_MM`; in Change `heightForBox(CUSTOMER_BOX_MM)` for
  `"pile"` and `heightForBox(compact ? CHANGE_BOX_COMPACT_MM : CHANGE_BOX_MM)` for
  `"change"`. `addToPile`, `settleCoin` and `settleGroupCoins` take `compact` as a
  further optional argument. There is no state field for it: `compact` is a property
  of the screen, not the game.
- `submitGiveChangeAnswer(state, action, now)` applies `judgeAnswer` with `due =
  changeDue(total(pile), price)` and `total(change)`: correct → `solved`, `solvedAt`,
  `rounds + 1` and the success message; wrong → a new hint message object. Once
  solved it returns the same object.

## UI (`index.html`, `src/main.js`, `styles.css`)

- `index.html`: `#btn-give-change` on Home; an empty `#topbar-customer` group (label
  `#customer-coins-label`, "Customer Coins:") inside `.topbar`; `id="play-area"` on
  the existing pile card; a second card `#change-area` with `#change-heading`, the
  hint, `#change-pile`, `#change-pile-summary`, `#change-total` and `.answers`
  (`#btn-short`, `#btn-none`).
- `render()`: in Give Change mode it moves the existing `#play-pile` and
  `#play-pile-summary` nodes into `#topbar-customer`, unhides it and hides
  `#play-area`; in any other mode it moves them back before `#play-total` and hides
  the host. Moving the same nodes keeps their drag and dwell listeners and a single
  id. It sets the heading to "Price" and the price, renders both piles with their
  heights, the summaries, the Easy total, the answer buttons' `hidden` (`#btn-short`
  also on Easy) and `disabled` (when solved), and toggles a `give-change` class on
  `#screen-play`.
- `main.js` wires both pile containers the same way (`wirePile(key)`: a `createDrag`,
  dwell, tap-to-remove and arrow keys, each using the pile's own key and height).
  Tray taps, tray drops and Clear go to the active key (`"change"` in Give Change mode).
  One `matchMedia("(max-height: 700px)")` supplies `compact`; when it changes the
  change pile is redrawn at the new height (coins keep their clamped fractional
  places, so none ends outside the box). A new customer clears both pile containers
  (`resetPileDom`), since uids restart per deal.
- `styles.css`: Change-only rules for the top-bar group and label, the `.answers`
  row (disabled buttons at the locked coins' opacity), tighter spacing, the reserved
  hint line, and the `(max-height: 700px)` and `(max-height: 30rem)` variants.
  `.topbar button` becomes `.topbar > button` so it does not pad the pile's coin
  buttons.

## Edge cases

- Switching modes (Change, Back, then Cashier or Endless, after a solve or from Easy)
  never leaves the customer pile in the top bar, the change card or the answer
  buttons visible, and `#play-pile` returns to its card at the 118.4 mm box.
- A correct answer cannot be re-submitted, and after a solve tray taps and drags,
  coin taps and drags, Clear and forced clicks on the disabled answer buttons change
  nothing.
- Dragging a customer coin never moves it into the change pile; the piles are
  separate, with separate drag controllers.
- Coins dragged, arrow-moved, stacked or detached in the short boxes stay inside
  them, and drops land under the pointer, because each pile converts pointer
  positions with its own height.
- Back mid-round discards everything; reload resets everything.

## Testing

- **`game.test.js`**: `rollScenario` at stubbed draws and the `underpaid` /
  `exactShare` boundaries, never `"under"` with `underpaid: 0`, and the `paid < 2`
  fallback; `priceFor` for all three scenarios at `rng` extremes; `changeDue`;
  `judgeAnswer` for every action × scenario; the box constants and `heightForBox`;
  the geometry functions without `heightMm` equal the 90 mm results, and with a short
  height keep centres in the play area, put the box edge where expected and measure
  settling, nudges and stack links in that height.
- **`state.test.js`**: `startGiveChange` / `nextGiveChangeCustomer` (consistent scenario and
  price, rounds and difficulty kept, change emptied, never under on Easy odds); the
  pile key (add/remove/clear only on the change in Give Change mode, move and settle on
  both, unique uids); `submitGiveChangeAnswer` (wrong answers keep both piles and give a
  new message object, one solve per round, the three success texts); `pileHeightMm`
  with and without `compact`; dealing and settling at the short heights; Cashier
  still at 90 mm.
- **`config.test.js`**: `GIVE_CHANGE_ODDS` per difficulty.
- **`drag.test.js`, `drag.dom.test.js`, `render.dom.test.js`**: the height-aware
  fraction maths; `createDrag` / `createTrayDrag` with `heightMm` as a number or a
  function; a `pileEl` getter; `renderPile` setting `--pile-h-mm` and linking stacks
  in the given height.
- **Playwright** (`e2e/change.spec.js`): the layout (customer pile in the top bar
  under its label, card contents, buttons in order and in one row, Check and Clear in
  the dock); one coin scale and equal pile widths; box heights of 40 and 60 mm (40
  and 40 under 700 px) and redraw on resize across 700 px; leaving Change; the change
  pile interactions; every answer and hint, Enter, Easy never underpaying; edits
  after a solve; drops under the pointer in the short piles; a 10+ coin handful
  staying inside; the dock and piles not moving when a hint shows or clears; screen
  fit at 390 × 844, 476 × 850, 375 × 667 and 1280 × 800 (Normal and Easy); every
  control reachable at 844 × 390. `labels.webkit.spec.js` checks coin numerals in
  both Change piles.
- Other e2e specs only adapt selectors (`#play-area`, visible `.pile-area`, the four
  Home buttons).
- Manual: Normal and Easy on a phone-sized viewport and on desktop.

## Out of scope

Banknotes, per-customer timers, scoring or streaks beyond the counter, sound,
customer remarks or jokes, baskets with several items, price realism beyond the
ranges above, persistence, a frame-height change, and any change to Endless, Custom
or Cashier behaviour.
