# Give Change Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth, endless "Give Change" mode: a customer pays with a handful of coins and the player builds the right change, says "No change", or says "Not enough!". The screen reads like Endless, with the customer's coins in a 4 cm strip in the top bar and a 6 cm "Your change" pile (4 cm on screens under 700 px high), all at one coin scale.

**Architecture:** Pure rules (scenario roll, price, judging) in `game.js`, odds in `config.js`. State gains a second pile (`state.change`); the existing pile operations take an optional trailing `key` (`"pile"` default, `"change"`), and every geometry function takes an optional trailing pile height (default 90 mm), so Endless, Custom and Cashier and their tests are untouched. `main.js` wires both pile containers the same way and moves the customer's pile node into the top bar in Give Change mode.

**Tech Stack:** Vanilla ES modules, `node --test` with jsdom and c8, Playwright e2e (Chromium + WebKit).

**Spec:** `docs/superpowers/specs/2026-10-29-give-change-mode-design.md`

## Global Constraints

- Odds in `src/config.js`: `GIVE_CHANGE_ODDS = { normal: { underpaid: 0.25, exactShare: 1/3 }, easy: { underpaid: 0, exactShare: 1/3 } }`.
- Customer coins: `randomHandful(rng, previous)` (2–12 coins); `paid` is always `total(state.pile)`, never stored.
- Price: `exact` → `paid`; `over` → `paid − k`, `k` in `1…floor(paid/2)`; `under` → `paid + k`, `k` in `1…200`.
- Hint texts, verbatim: `Too much change`, `Not enough change`, `Does this customer need change?`, `They overpaid, so you owe change`, `They have not paid enough yet`, `They paid enough`.
- Success texts (kind `"success"`, amounts via `formatPence`): `Correct! Change: £x.xx.`, `Correct! No change due.`, `Correct! They are £x.xx short.`
- Labels, verbatim: `Change` (Home), `Price`, `Customers served: N`, `Customer Coins:`, `Your change`, `No change`, `Not enough!`.
- Pile sizes are the VISIBLE dashed box, 138.4 mm wide: `CUSTOMER_BOX_MM = 40`, `CHANGE_BOX_MM = 60`, `CHANGE_BOX_COMPACT_MM = 40` under `(max-height: 700px)`; the geometry gets `heightForBox(boxMm) = boxMm − 2 * PILE_MARGIN_MM` (11.6 / 31.6 mm). Other piles keep `PILE_HEIGHT_MM = 90` (118.4 mm box).
- Coins and the tray are never scaled; the frame height cap does not change. The Change screen fits without scrolling at 390 × 844, 476 × 850, 375 × 667 and 1280 × 800 (Normal and Easy, with or without a hint); 844 × 390 only needs every control reachable.
- The dock's hint line keeps its space reserved, except in `max-height: 30rem`.
- No persistence, no timer; the existing 400 ms Next guard (`canAdvance`) applies.
- Endless, Custom and Cashier look and behave as before; existing tests pass untouched except where a test describes the Home buttons, the `createState` shape or a selector the new markup makes ambiguous.
- Commits use Conventional Commits and end with the session's `Co-Authored-By` line.
- `npm run test:coverage` enforces 80% lines/branches/functions per file on `src/**` except `src/main.js`.

## Review Focus

- A wrong answer keeps both piles so the player can retry; a repeated hint is re-announced (Task 4, Task 6).
- Check on an overpaid round with an empty change pile hints `Not enough change` and is not an error (Task 1, Task 6).
- Easy never underpays and hides `Not enough!` (Tasks 2, 4, 6).
- Dragging, arrow-moving, stacking and detaching in the 40 mm and 60 mm boxes keep coins inside and convert pointer positions with each pile's own height, not 90 (Tasks 3, 4, 5).
- Leaving Change for Cashier or Endless (plain, after a solve, from Easy) returns `#play-pile` to its card at 118.4 mm with no leftover top-bar group, change card or answer buttons (Task 6).
- After a solve the answer buttons stay put but disabled, Check and Clear hide, Next has focus, and no edit changes either pile (Task 6).
- A hint appearing or clearing never moves the dock or the piles (Task 7).

---

### Task 1: Pure change rules in `game.js`

**Files:**
- Modify: `src/game.js`
- Test: `tests/game.test.js`

**Interfaces:**
- Produces:
  - `rollScenario(odds: {underpaid, exactShare}, rng = Math.random, paid = Infinity): "under" | "exact" | "over"`: first draw `< underpaid` → `"under"`; second draw `< exactShare` → `"exact"`; else `"over"`, which becomes `"exact"` when `paid < 2`.
  - `priceFor(paid, scenario, rng = Math.random): number`, per Global Constraints (`k = 1 + floor(rng() * range)`).
  - `changeDue(paid, price): number`: `max(0, paid − price)`.
  - `judgeAnswer(scenario, action: "check" | "none" | "short", changeTotal, due): {correct, hint}`, `hint` `""` when correct.

- [x] **Step 1: Write failing tests:** `rollScenario picks under, exact or over from the rng draws` (`[0.24]` → under, `[0.25, 0.32]` → exact, `[0.25, 0.34]` → over), `rollScenario never gives under when underpaid is 0`, `rollScenario turns over into exact when paid is under 2`, `priceFor follows the scenario rule` (`rng` 0 and 0.999 bounds, over ≥ 1p at `paid = 2`), `changeDue is the overpayment, never negative`, `judgeAnswer covers every action and scenario` (one assertion per cell, including an empty change pile → `Not enough change`).
- [x] **Step 2: Run** `node --test tests/game.test.js`: FAIL (exports missing).
- [x] **Step 3: Implement** the four functions.
- [x] **Step 4: Run** `node --test tests/game.test.js`: PASS.
- [x] **Step 5: Commit** `feat: add pure change-giving rules`.

---

### Task 2: Odds config

**Files:**
- Modify: `src/config.js`
- Test: `tests/config.test.js`

**Interfaces:**
- Produces: `GIVE_CHANGE_ODDS` (Global Constraints), with a comment that the underpaid chance is per difficulty and tunable here.

- [x] **Step 1: Write the failing test** `GIVE_CHANGE_ODDS has per-difficulty underpaid chances` (Normal 0.25, Easy 0, both `exactShare` 1/3).
- [x] **Step 2: Run** `node --test tests/config.test.js`: FAIL.
- [x] **Step 3: Implement** `GIVE_CHANGE_ODDS`.
- [x] **Step 4: Run** the same command: PASS.
- [x] **Step 5: Commit** `feat: add change-mode odds`.

---

### Task 3: Optional pile height in the geometry

**Files:**
- Modify: `src/game.js`, `src/drag.js`, `src/render.js`
- Test: `tests/game.test.js`, `tests/drag.test.js`, `tests/drag.dom.test.js`, `tests/render.dom.test.js`

**Interfaces:**
- Produces: `game.js` constants `CUSTOMER_BOX_MM = 40`, `CHANGE_BOX_MM = 60`, `CHANGE_BOX_COMPACT_MM = 40` and `heightForBox(boxMm)` (`boxMm − 2 * PILE_MARGIN_MM`).
- Produces (trailing `heightMm = PILE_HEIGHT_MM` everywhere; defaults keep every current caller identical):
  - `game.js`: `placeCoin`, `placeHandfulCoin`, `pileBox({x, y}, heightMm)`, `detachNudge(entry, heightMm)`, `settlePile`, `settleGroup`, `unitUids`, `stackCounts`, and the internal clearance, distance, stack-step, push and shift helpers.
  - `drag.js`: `toPileFraction(point, rect, heightMm)`, `pixelsToFraction(dx, dy, rect, heightMm)`; `createDrag(container, {..., heightMm})` and `createTrayDrag(container, {..., pileEl, heightMm})`, where `heightMm` is a number or a `() => number` and `pileEl` an element or a `() => Element`, resolved per pointer event.
  - `render.js`: `renderPile(container, pile, excludeUid = null, removable = true, heightMm)` sets `--pile-h-mm` to `heightMm + 2 * PILE_MARGIN_MM`; `showStackBadges(container, pile, excludeUid, heightMm)`.

- [x] **Step 1: Write failing tests:** `the box constants and heightForBox derive the play-area height from a box edge`, `with no heightMm placeCoin, settlePile and pileBox equal the 90 mm results`, `placeCoin with a short height keeps every centre inside the play area`, `pileBox places the bottom of the play area at the box edge for a given height`, `settlePile and detachNudge measure the y axis in the given height`, `unitUids and stackCounts measure the link distance in the given height`; `toPileFraction and pixelsToFraction honour a custom height`; `createDrag resolves heightMm given as a number / a function`, `createDrag with heightMm moves a group by the fraction for that height`, `createTrayDrag maps the drop with heightMm given as a number / a function`, `createTrayDrag resolves a pileEl getter on every pointer event`; `renderPile sets --pile-h-mm from the given height and defaults to 90`, `renderPile and showStackBadges link stacks in the given height`.
- [x] **Step 2: Run** `node --test tests/game.test.js tests/drag.test.js tests/drag.dom.test.js tests/render.dom.test.js`: FAIL.
- [x] **Step 3: Implement** the signatures (the box height is computed per call instead of the old `BOX_H_MM` constant).
- [x] **Step 4: Run** `npm test` and `npm run test:coverage`: PASS, existing tests untouched.
- [x] **Step 5: Commit** `feat: let a pile have its own height`.

---

### Task 4: Change state, a keyed second pile and per-pile heights

**Files:**
- Modify: `src/state.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Consumes: Task 1's functions, Task 3's constants and optional `heightMm`, `total`, `randomHandful`.
- Produces:
  - `createState()` gains `change: [], price: 0, scenario: ""` (update the existing shape test).
  - `startGiveChange(state, odds, rng = Math.random)`, `nextGiveChangeCustomer(state, odds, rng = Math.random)`: mode `"give-change"`, handful dealt into `pile` at the customer height, `change: []`, `scenario` and `price` from Task 1; `nextGiveChangeCustomer` keeps `rounds` and avoids a repeat handful; both keep `difficulty`.
  - Trailing `key = "pile"` on `addToPile(state, coinId, rng, key, compact)`, `addToPileAt(state, coinId, x, y, rng, key)`, `removeFromPile(state, uid, key)`, `moveCoin(state, uid, x, y, key)`, `settleCoin(state, uid, from, key, compact)`, `moveGroup(state, uids, dx, dy, key)`, `settleGroupCoins(state, uids, leaderUid, from, key, compact)`, `clearPile(state, key)`. In Give Change mode add/remove/clear on `"pile"` return `state`; move/settle work on either key.
  - `pileHeightMm(state, key = "pile", compact = false): number`: 90 outside Change; in Change 11.6 for `"pile"`, 31.6 for `"change"` (11.6 when `compact`). Placement and settling use it.
  - `submitGiveChangeAnswer(state, action, now)`: same object when solved; correct → `solved`, `solvedAt`, `rounds + 1`, success text; wrong → `{...state, message: {text: hint, kind: "hint"}}` (a new object each time).
  - `isContinuous` true for `"give-change"`.

- [x] **Step 1: Write failing tests** in `tests/state.test.js` (with `seeded`/`pileOf` from `tests/pile-helper.js`): `startGiveChange deals a customer handful with a consistent scenario and price`, `startGiveChange never rolls under when underpaid is 0`, `nextGiveChangeCustomer keeps rounds and difficulty and empties change`, `pile key routes add/remove/clear in give-change mode` (also unique uids across both lists), `move and settle work on either key`, `submitGiveChangeAnswer judges the change against what is due` (wrong answers keep both piles by reference, a repeat gives a new message object, one solve), `submitGiveChangeAnswer accepts none and short on matching scenarios`, `submitGiveChangeAnswer success messages are plain` (paid 500 / price 235 → `£2.65`; paid 100 / price 140 → `£0.40 short`), `isContinuous is true for give-change mode`, `pileHeightMm gives the short customer and change heights in Give Change only`, `pileHeightMm with compact gives 11.6 mm for both Give Change piles and 90 mm in other modes`, `startGiveChange deals the customer's coins into the short play area` (centres inside 11.6 mm over many seeds, 12-coin handfuls included), `startCashier and nextCustomer still deal at the 90 mm height`, `moveCoin and settleCoin on the Give Change customer pile push apart by the 11.6 mm amount`, `adding to the Give Change player's pile places and settles at 31.6 mm`, `addToPile, settleCoin and settleGroupCoins on the change pile use the compact height when asked`, `CHANGE_BOX_COMPACT_MM is the 4 cm box`.
- [x] **Step 2: Run** `node --test tests/state.test.js`: FAIL.
- [x] **Step 3: Implement** in `src/state.js` (a `locked(state, key)` helper for the read-only customer pile; `placeAndSettle` takes `key` and `compact`).
- [x] **Step 4: Run** `npm test`: PASS (all existing tests included).
- [x] **Step 5: Commit** `feat: add change-mode state with a keyed second pile and short pile heights`.

---

### Task 5: The Change screen and the change pile

**Files:**
- Modify: `index.html`, `src/main.js`, `styles.css`
- Create: `e2e/change.spec.js`
- Modify (selectors only): `e2e/home.spec.js`, `e2e/grid.spec.js`, `e2e/dock.spec.js`, `e2e/frame.spec.js`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces (DOM): `#btn-give-change` on Home; `<div id="topbar-customer" role="group" aria-labelledby="customer-coins-label" hidden>` in `.topbar` with `<p id="customer-coins-label" class="pile-label">Customer Coins:</p>`; `id="play-area"` on the existing card; `#change-area` (`hidden`) with `#change-heading`, `.scale-note`, `#change-pile`, `#change-pile-summary`, `#change-total` and `.answers` holding `#btn-short` then `#btn-none`. `.actions` keeps Check, Clear and Next.
- Produces (`main.js`): `placeCustomerPile(giveChange)` moves `#play-pile` and `#play-pile-summary` between `#topbar-customer` and `#play-area` (before `#play-total`) only when the host changes, then prunes dwells; `wirePile(key)` gives each container its drag (`heightMm: () => heightOf(key)`), dwell, tap-to-remove and arrow keys; `activeKey()` routes tray taps, tray drops and Clear; one `matchMedia("(max-height: 700px)")` feeds `compact` and redraws the change pile on change; `resetPileDom` clears both containers.

- [x] **Step 1: Write failing e2e tests** (`startMode(page, "Give Change")`, `seedRandom`): `starting Give Change puts the customer's coins in the top bar and the answers in the Your change card`; `one scale: a coin has the same size in both piles and the tray, and the piles are as wide as each other` (also `#btn-short` left of `#btn-none` on one row); box heights (`height / (width / 138.4)`): `…: Give Change shows a 40 mm customer box and a 60 mm change box` (1280 × 720, 390 × 844, 476 × 850, 1280 × 800), `375x667 normal|easy: both boxes are 40 mm`, `resizing across 700 px high redraws the change pile at the matching height, with its coins inside`; `leaving Give Change (plain Normal | after a solve | from Easy), then starting Cashier and then Endless, puts the pile back in its card at 118.4 mm`; the change area group (tray tap and drag add to the change only, drops on the customer pile or outside do nothing, change coins removable and customer coins not, arrow keys, stacking and detach, dragging in either pile, Clear empties only the change); `drops land where released in the short piles`; `a handful of 10 or more coins stays inside the customer pile, and one coin drags on its own`. Update the four other specs' selectors (four Home buttons, `#play-area`, `.pile-area:not([hidden])`, visible `.scale-note`).
- [x] **Step 2: Run** `npx playwright test e2e/change.spec.js`: FAIL.
- [x] **Step 3: Implement** the markup, `render()` (Price heading, both piles with `heightOf(key)`, the "Customer paid" / "Your change" summaries, the Easy `#change-total`, `#btn-short` hidden on Easy, `give-change` class on `#screen-play`), the Home and Next handlers (`resetPileDom()` then `startGiveChange` / `nextGiveChangeCustomer` with `GIVE_CHANGE_ODDS[state.difficulty]`) and the Change CSS (top-bar group, `.pile-label`, tightened card and dock spacing, `.topbar > button`).
- [x] **Step 4: Run** `npm test` and `npx playwright test`: PASS, including the existing Endless and Cashier specs.
- [x] **Step 5: Commit** `feat: show the Change screen with the customer's coins in the top bar`.

---

### Task 6: Answers and round flow

**Files:**
- Modify: `src/main.js`, `styles.css`, `e2e/change.spec.js`

**Interfaces:**
- Consumes: `submitGiveChangeAnswer`, Task 5's ids.
- Produces: `answerGiveChange(action)` (submit, then focus the first visible `.actions` button when solved); `runCheck()` calls it with `"check"` in Give Change mode (so Enter checks); `#btn-none` / `#btn-short` call it with `"none"` / `"short"`. `render()` sets both answer buttons `disabled` when solved; `.answers button:disabled` uses the locked coins' opacity.

- [x] **Step 1: Write failing e2e tests** (answering a round): `exact change on an overpaid round solves it and the next customer clears the change area`, `a solve keeps the layout still, and a forced click on a disabled answer button does nothing`, `a wrong total keeps the coins; the same wrong answer twice is announced twice`, `too little change says so and keeps the coins`, `Check with no change given on an overpaid round says Not enough change`, `No change solves an exact round and focus moves to Next`, `Not enough! solves an underpaid round`, one test per wrong button and scenario with its verbatim hint, `Enter checks`, `Easy never offers Not enough! and never underpays`, `Easy shows the change total, hides Not enough!, and a solve disables the answer buttons and focuses Next`, and `tray taps and drags, coin taps and drags, and Clear leave both piles unchanged` after a solve.
- [x] **Step 2: Run** `npx playwright test e2e/change.spec.js`: FAIL.
- [x] **Step 3: Implement** as in Interfaces.
- [x] **Step 4: Run** `npm test` and `npx playwright test`: PASS.
- [x] **Step 5: Commit** `feat: answer a change round with Check, No change or Not enough`.

---

### Task 7: Screen fit, docs and full verification

**Files:**
- Modify: `styles.css`, `e2e/change.spec.js`, `e2e/labels.webkit.spec.js`, `README.md`

- [x] **Step 1: Write failing e2e tests:** `the tray sits no further below the dock's top edge in Give Change than in Endless`; `a hint never moves the Give Change layout` (390 × 844, 375 × 667, 476 × 850, 1280 × 800, Normal and Easy: dock, piles and tray stay put when a hint shows and clears); `change layout fits without scrolling` (the same four sizes, Normal and Easy: `.content` does not scroll, both piles, the answer buttons, Check and Clear are fully on screen and clear of the bars, no horizontal overflow); `375x667 normal|easy: with a hint showing the content does not scroll and No change is fully in view`; `short landscape window` (844 × 390, Normal and Easy: every control reachable, Check works). In `labels.webkit.spec.js`: numerals stay on their coins in the customer pile and in the change pile.
- [x] **Step 2: Run** `npx playwright test e2e/change.spec.js`: FAIL.
- [x] **Step 3: Implement** the Change spacing: the hint line's `min-height` always reserved in the dock, tighter padding and gaps, a `(max-height: 700px)` block with less air again, and a `(max-height: 30rem)` block where the empty hint line collapses. Do not change the frame height or scale coins or the tray.
- [x] **Step 4: Update `README.md`:** the Change row in "How to play" and a paragraph on its layout (customer coins in a 4 cm strip in the top bar, the 6 cm change pile, 4 cm under 700 px, answer buttons under it, the Endless dock, Easy's total and no underpaying), and the `advance` parameter covering Change.
- [x] **Step 5: Verify everything:** `npm test`, `npm run test:coverage`, `npm run test:e2e`: all pass with coverage thresholds met.
- [x] **Step 6: Commit** `feat: fit the Change screen on phones and desktop` and `docs: describe the Give Change mode in the README`.
