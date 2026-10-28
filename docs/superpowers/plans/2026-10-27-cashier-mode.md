# Cashier Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third "Cashier" mode where a customer's random handful of coins sits on the counter and the player types the total.

**Architecture:** Reuse the play screen, the messy pile (entries `{uid, coinId, x, y, rot}`), dragging, dwell-to-reveal and the 400 ms advance guard. Pure logic goes in `src/game.js` (`randomHandful`, `checkAnswer`) and `src/state.js` (`startCashier`, `nextCustomer`, `submitAnswer`, add/remove disabled in cashier mode). `main.js`/`index.html` show and hide elements per mode.

**Tech Stack:** Plain HTML/CSS/ES modules, `node --test` (no dependencies).

**Spec:** `docs/superpowers/specs/2026-10-27-cashier-mode-design.md`

## Global Constraints

- No build step, no dependencies, no persistence, no timer.
- Customer coins are placed like the messy pile (non-overlapping search + settle), except that a coin whose denomination is already on the counter lands on one of those coins with probability `STACK_CHANCE = 0.25`, so it stacks (customers do that). The messy-pile rule that the player's own coins are placed apart is unchanged.
- Money is integer pence. The true total is always `total(state.pile)`, never stored.
- `MAX_HANDFUL = 12`; coin count is an integer 2 to 12 inclusive; denominations uniform over the 8 coins in `COINS`.
- Hint texts exactly "Too high" / "Too low"; counter text exactly `Customers served: N`; screen-reader summary starts `On the counter: ` (e.g. "On the counter: 2 × 20p, 1 × £1").
- Reuse `ADVANCE_DELAY_MS` (400) via `canAdvance`; reuse `parseAmount` errors verbatim.
- Cashier follows Endless for round flow: Next after a correct answer, a running counter, no "Play again" / "Change amount". Anywhere `main.js` tests `state.mode === "endless"` for that behaviour, it uses `isContinuous(state)` instead.
- Hidden in cashier mode: target value, tray, running total (`#play-total`), Clear. Endless and Custom behaviour must not change.
- Commits use Conventional Commits and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Constant `rng` (always 0) with `previous` equal to the result: re-rolls once only, never loops.
- Typed text is empty, `"."`, `"£"`, `"0"`, `"abc"`: shows the `parseAmount` error, no attempt counted, state unchanged (Task 3).
- Wrong answer then the same wrong answer again: hint message is a new object each time so it re-announces (Task 2).
- Tapping or clicking a counter coin, or Enter pressed twice after a correct answer: nothing changes, rounds incremented once (Tasks 2, 3).
- A stacked pair on the counter still counts as two coins in `total` and in the screen-reader summary (Task 2).
- Dragging or arrow-moving counter coins never changes the coin multiset or the total (Task 2).
- Starting Cashier after Endless: no leftover message, input text, pile or rounds (Tasks 2, 3).

---

### Task 1: Handful generation and answer checking

**Files:**
- Modify: `src/game.js` (add after `randomTarget`; extend `describePile`)
- Test: `tests/game.test.js`

**Interfaces:**
- Produces:
  - `export const MAX_HANDFUL = 12`
  - `randomHandful(rng = Math.random, previous = []): string[]` coin ids; `previous` is the last handful's ids.
  - `export const STACK_CHANCE = 0.25`
  - `placeHandfulCoin(pile, coin, rng = Math.random): { x, y, rot }` — if `pile` has an entry of `coin.id`, draw `rng()`; when it is `< STACK_CHANCE`, draw `rng()` again to pick one of those same-denomination entries (index `floor(r * n)`) and return its `x`,`y` with `rot` from `rng()` (the caller's settle step then snaps it onto the stack). Otherwise (no same denomination, or the draw is `>= STACK_CHANCE`) return `placeCoin(pile, coin, rng)`. With no same-denomination entry no extra `rng()` call is made.
  - `checkAnswer(pile, pence): "exact" | "over" | "under"` — `"over"` means `pence` is higher than `total(pile)`.
  - `describePile(pile, intro = "In the pile")` — the non-empty text becomes `` `${intro}: ...` ``; default output unchanged.

- [ ] **Step 1: Write failing tests** in `tests/game.test.js`:
  - `randomHandful` with `() => 0` has length 2 and `() => 0.999999` has length 12 (`MAX_HANDFUL`); every id satisfies `coinById(id) !== undefined`; over `seeded(1..200)` lengths stay within 2..12.
  - Denominations: with a stub cycling `rng` values, the ids map to `COINS[floor(r * 8)]`.
  - Re-roll guard: `previous` equal (same multiset, different order) to the first draw gives a different multiset when the second draw differs; with `() => 0` and `previous = ["1p","1p"]` it returns `["1p","1p"]` (re-rolled once only, no loop).
  - `placeHandfulCoin`: with `pileOf("20p")` (entry at 0,0) and a stub giving `0.1` then `0` it returns `x: 0, y: 0` (stacks); with `0.9` it equals `placeCoin(pile, coin, sameStub)`; with an empty pile or only other denominations it equals `placeCoin` and consumes no extra `rng()` draw; with two same-denomination entries at different positions the second draw picks the entry by index.
  - `checkAnswer(pileOf("£1","50p"), 150) === "exact"`, `checkAnswer(..., 200) === "over"`, `checkAnswer(..., 100) === "under"`, and a different coin mix with the same pence (`pileOf("50p","50p","50p")` vs 150) is `"exact"`.
  - `describePile(pileOf("20p","20p","£1"), "On the counter") === "On the counter: 2 × 20p, 1 × £1"`; existing `describePile` tests still pass.

- [ ] **Step 2: Run** `node --test tests/game.test.js` — Expected: FAIL (missing exports).

- [ ] **Step 3: Implement** the three items in `src/game.js`. `randomHandful`: count `2 + Math.floor(rng() * (MAX_HANDFUL - 1))`, ids `COINS[Math.floor(rng() * COINS.length)].id`; if `previous` has the same sorted ids, draw once more and return that second result. `checkAnswer` inverts the `check(pile, answer)` result (`check` returns `"under"` when the pile total is below the answer, which here means the answer is too high).

- [ ] **Step 4: Run** `npm test` — Expected: all pass.

- [ ] **Step 5: Commit** `feat: add randomHandful and checkAnswer for cashier mode`

---

### Task 2: Cashier state transitions

**Files:**
- Modify: `src/state.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Consumes: Task 1's `randomHandful`, `checkAnswer`, `MAX_HANDFUL`; existing `placeCoin`, `settlePile`, `formatPence`, `total`.
- Produces:
  - `startCashier(state, rng = Math.random): State` — fresh state, `mode: "cashier"`, `rounds: 0`, `target: 0`, keeps `difficulty`, pile filled from `randomHandful(rng)`.
  - `nextCustomer(state, rng = Math.random): State` — keeps `mode`, `rounds`, `difficulty`; new pile from `randomHandful(rng, previousIds)` where `previousIds = state.pile.map(e => e.coinId)`; solved/message reset.
  - `submitAnswer(state, pence, now): State` — returns the same object if `state.solved`; on exact: `solved: true`, `solvedAt: now`, `rounds + 1`, message `{ text: "Correct! That is " + formatPence(pence) + ".", kind: "success" }`; otherwise a new `{ text: "Too high" | "Too low", kind: "hint" }` object and the pile unchanged.
  - `isContinuous(state): boolean` — true for modes `"endless"` and `"cashier"`, false for `"custom"`.
  - `addToPile`, `addToPileAt`, `removeFromPile`, `clearPile` return the same state object when `state.mode === "cashier"`. `moveCoin`, `settleCoin`, `moveGroup`, `settleGroupCoins` keep working (they only stop when solved).

- [ ] **Step 1: Write failing tests** in `tests/state.test.js`:
  - `startCashier(createState())`: mode `"cashier"`, `rounds 0`, `solved false`, empty message, pile length 2..12, uids unique and `nextUid === pile.length + 1`, every entry has finite `x`,`y` within ±0.5 and integer `rot`; keeps `difficulty: "easy"` when set; starting from a state with rounds 5, a message and a pile resets all of them.
  - Counter coins can stack: over `seeded(1..200)`, at least one `startCashier` result has `stackCounts(pile).size > 0` and at least one has `size === 0`; in a stacked result `total(pile)` and `pile.length` still equal the sum/length of the generated ids (stacked coins are still separate entries).
  - `nextCustomer` keeps `rounds`, clears `solved`/message, and returns a pile whose multiset differs from the previous one when the rng allows.
  - `submitAnswer` with the exact total: `solved`, `rounds` 1, success message; a second call with `now` later returns the identical object (`assert.equal(again, solved)`) and rounds stays 1.
  - `submitAnswer` with a higher answer → message text "Too high", lower → "Too low"; `pile` is the same array; two identical wrong answers give two different message objects (`notEqual`) with equal text; not solved.
  - `isContinuous`: true for `createState()` (endless) and `startCashier(createState())`, false for `startGame(createState(), "custom", 395)`.
  - `canAdvance` is false before 400 ms and true at 400 ms after a correct answer.
  - In cashier mode `addToPile`, `addToPileAt`, `removeFromPile(state, uid)`, `clearPile` each `assert.equal(result, state)`.
  - After `moveCoin` + `settleCoin` on a cashier state, the sorted `coinId` list and `total` are unchanged.

- [ ] **Step 2: Run** `node --test tests/state.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement** in `src/state.js`. Build the pile by folding ids through the same place-then-settle step `addToPile` uses (extract that step into an internal helper that takes the placement function, so `addToPile` passes `placeCoin` and the cashier passes `placeHandfulCoin`), then add the cashier guard `state.mode === "cashier"` to the four editing functions. Update the `createState` mode comment/shape only if needed; its test shape must not change.

- [ ] **Step 4: Run** `npm test` — Expected: all pass.

- [ ] **Step 5: Commit** `feat: add cashier state transitions`

---

### Task 3: Cashier UI

**Files:**
- Modify: `index.html`, `src/main.js`, `src/render.js`, `styles.css`, `README.md`
- Test: `tests/render.test.js`

**Interfaces:**
- Consumes: Tasks 1 and 2 exports; `parseAmount`, `announce`, `setText`, `describePile`.
- Produces:
  - `render.js`: `export function coinLabel(coin, removable): string` returning `` `Remove ${coin.label}` `` when `removable`, else `` `${coin.label} coin` ``; `renderPile(container, pile, excludeUid = null, removable = true)` uses it for new pile buttons.
  - `index.html`: `#btn-cashier` on Home (after Custom), button text exactly "Cashier"; in `#screen-play` a block `#cashier-answer` (hidden outside cashier) containing `<label for="cashier-input">Total on the counter (£)</label>`, `<input id="cashier-input" type="text" inputmode="decimal" autocomplete="off" aria-describedby="cashier-error" placeholder="3.95">` and `<p id="cashier-error" class="error" role="alert"></p>`.

- [ ] **Step 1: Write failing test** in `tests/render.test.js`: `coinLabel(coinById("20p"), true) === "Remove 20p"` and `coinLabel(coinById("20p"), false) === "20p coin"`.

- [ ] **Step 2: Run** `node --test tests/render.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement `coinLabel` and the `removable` parameter** in `src/render.js`. Pass `state.mode !== "cashier"` from `main.js`. Because `renderPile` only labels newly created buttons, a pile re-render after `startCashier`/`nextCustomer` is sufficient (new uids).

- [ ] **Step 4: Wire the mode** in `index.html`/`main.js`/`styles.css`:
  - `#btn-cashier` click: `update(startCashier(state))`, reset `#cashier-input` (empty, enabled, no `aria-invalid`), clear `#cashier-error`, `showScreen("play")`, then focus `#play-heading` (as `beginRound`).
  - `render()` when `state.mode === "cashier"`: heading label "Customer's coins" and target span "How much?" (no amount shown); `#play-total` hidden; `.tray-area` and `#btn-clear` hidden; `#cashier-answer` visible; `#play-pile-summary` uses `describePile(state.pile, "On the counter")`; the existing `endless` flag in `render()` becomes `isContinuous(state)`, so `#play-rounds`, `#btn-next` (when solved) and the hidden `#btn-again`/`#btn-change` follow Endless; the rounds text is `Customers served: N` in cashier and stays `Rounds completed: N` in Endless; `#cashier-input` disabled when `state.solved`. In other modes restore heading text ("Make" + formatted target) and hide `#cashier-answer`.
  - Check (button click and Enter in `#cashier-input`): `parseAmount(input.value)`; on error set `aria-invalid="true"`, `announce($("cashier-error"), result.error)`, and do not change state; otherwise clear the error/`aria-invalid` and `update(submitAnswer(state, result.pence, performance.now()))`; after a correct answer focus the first visible `.actions` button (Next). Ignore Enter/Check when `state.solved`.
  - Next in cashier mode: if `canAdvance`, `beginRound(nextCustomer(state))` then clear and enable the input and error. Existing Endless Next path unchanged.
  - Back (`#btn-back`) already returns Home; no confirmation.
  - Reuse the existing `.error`, `.board`, `label`, `input` styles; add only what the new block needs in `styles.css`.

- [ ] **Step 5: Update `README.md`**: add a "Cashier" bullet under the modes list and note Difficulty applies to it.

- [ ] **Step 6: Verify automated** — Run `npm test` — Expected: all pass (143 existing plus the new ones).

- [ ] **Step 7: Verify manually** with `python3 -m http.server 8000` and the Playwright browser at desktop and 390×844 viewports, Normal and Easy:
  - After a correct answer the buttons are exactly Next and Back (no Play again / Change amount), and Endless and Custom show the same buttons as before.
  - Cashier shows no tray, total, Clear or target; counter coins drag and push apart; clicking one does nothing; label is "20p coin" style.
  - Empty, `.`, `0`, `abc` show the shared error; "Too high"/"Too low" keep the text and coins; correct answer (e.g. summing the screen-reader summary) shows success, locks input and Check, focus lands on Next; Enter again does nothing; counter reads 1 after one correct answer; Next within 400 ms is ignored, later gives a new customer with a cleared field.
  - Back to Home then Cashier again: counter resets to 0; Endless and Custom still work.

- [ ] **Step 8: Commit** `feat: add cashier mode screen and wiring`
