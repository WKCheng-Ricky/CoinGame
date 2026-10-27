# Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every issue raised by the two independent code reviews of `feature/coin-game`: one layout bug, the accessibility and focus gaps, weak tests, and small input and cleanup items.

**Architecture:** Same as the original plan. New: a pure `src/state.js` holds all round-state transitions so they can be unit-tested; `main.js` becomes DOM wiring only. Tray coins are sized from the tray's own width (CSS container query units), with the 44px tap area decoupled from the drawn coin size.

**Tech Stack:** HTML, CSS, vanilla JS (ES modules), Node built-in test runner. No dependencies.

**Spec:** `docs/superpowers/specs/2026-10-27-coin-game-design.md` (original plan: `docs/superpowers/plans/2026-10-27-coin-game.md`)

## Global Constraints

All original constraints still hold, in particular:
- No backend, no build step, no runtime or dev dependencies.
- All amounts are integer pence; only `render.js` and `main.js` touch the DOM.
- Tap targets at least 44px; `touch-action: manipulation` on buttons; coins and stacks stay `<button>` elements labelled like "Add 20p" / "Remove one 20p"; total and result message use `aria-live`.
- Over/under hints stay "A bit too much" / "Not enough yet"; success text stays `Correct! You made exactly £3.95.`
- Pile grouped by denomination with `×N` badge; no persistence; Back discards the round; Endless rounds counter resets when Endless is started.
- Work continues on branch `feature/coin-game`, one commit per task, on top of the existing squashed commit.

## Rulings made while planning

- **"395p" stays rejected.** It is ambiguous (395 pence or £395) and the error message already shows the expected form. `"£ 3"` (space after the pound sign) becomes valid.
- **Double-tap guard is a 400ms delay**, not a layout change: Next and Play again ignore clicks for 400ms after a round is solved.
- **Hit area vs drawn size:** the drawn coin keeps its true relative size at every width; only the invisible button area is raised to 44px.
- **Announcements:** repeated identical messages are re-announced by clearing the live region and setting the text again after 50ms.

## Review Focus

1. Tray layout at every phone width, not just 320 and 360: 320, 337, 344, 350, 359, 360, 390, and with the root font size raised to 125% (browser text zoom). No sideways page scroll at any of them (Task 3).
2. At 320px the drawn coins keep their real size order (5p smallest, then 1p, 20p, £1, 10p, 2p, 50p, £2). No coin is squashed to the 44px tap size (Task 3).
3. Checking the same wrong pile twice announces the hint twice; submitting the same invalid amount twice announces the error twice (Task 4).
4. After a solved round, clicking Next within 400ms is ignored; after 400ms it works; Back, Clear and coin taps never change a solved round (Tasks 2 and 4).
5. Keyboard user flow: after Next/Play again/Start/Back, focus lands on a sensible element, never on `<body>` (Task 4).

---

## File Structure

```
src/state.js         # NEW: pure round-state transitions
src/main.js          # DOM wiring only, uses state.js
src/game.js          # parseAmount accepts "£ 3"
src/render.js        # coinButton helper; coin.diameter; setText/announce helpers
index.html           # h1 target, aria attributes
styles.css           # container-query coin sizing, locked/empty states
tests/game.test.js   # exact randomTarget assertions, caps test replaced
tests/state.test.js  # NEW
```

---

### Task 1: Input parsing and test fixes

**Files:**
- Modify: `src/game.js`, `tests/game.test.js`

**Interfaces:**
- Consumes/Produces: `parseAmount(text: string)` keeps its signature; `"£ 3"` now returns `{ ok: true, pence: 300 }`.

- [ ] **Step 1: Write failing tests** in `tests/game.test.js`:
  - Add to the accepted cases in the parseAmount test: `"£ 3"→300`, `"£ 3.95"→395`. Add rejects: `"£ "`, `"££3"`, `"395p"`.
  - Replace the "caps are 99.99…" test with a test named `parseAmount enforces the 99.99 cap`: `parseAmount("99.99").ok === true`, `parseAmount("100.00").ok === false`, `parseAmount("99.99").pence === MAX_CUSTOM_PENCE`; keep a second assertion that `MAX_RANDOM_PENCE === 999`.
  - Replace the two `notEqual` edge assertions with exact values: `randomTarget(1, () => 0) === 2`, `randomTarget(999, () => 0.999999) === 998`, `randomTarget(500, () => 0) === 1`, `randomTarget(500, () => 0.999999) === 999`.

- [ ] **Step 2: Run `npm test`.** Expected: only the `"£ 3"`/`"£ 3.95"` cases FAIL; the strengthened randomTarget assertions pass against the current code (they pin existing behaviour).

- [ ] **Step 3: Implement** in `parseAmount`: after stripping one leading `£`, trim the remainder again before matching.

- [ ] **Step 4: Run `npm test`.** Expected: all pass.

- [ ] **Step 5: Commit** `src/game.js tests/game.test.js` with message `Accept "£ 3" and tighten randomTarget tests`.

---

### Task 2: Pure round state and double-tap guard

**Files:**
- Create: `src/state.js`, `tests/state.test.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `addCoin`, `removeCoin`, `check`, `formatPence` from `src/game.js`.
- Produces (`src/state.js`), where `State = { mode: "endless"|"custom", target: number, pile: Pile, rounds: number, solved: boolean, solvedAt: number, message: { text: string, kind: ""|"success"|"hint" } }`. All functions return a new state and never mutate the input; an operation that is not allowed returns the same object:
  - `ADVANCE_DELAY_MS = 400`
  - `createState(): State` (mode `"endless"`, target 0, empty pile, rounds 0, not solved, `solvedAt` 0, empty message)
  - `startGame(state, mode, target): State` (sets mode, target, empty pile, `solved` false, **rounds reset to 0**, empty message)
  - `nextRound(state, target): State` (same as above but keeps `mode` and `rounds`)
  - `addToPile(state, id)`, `removeFromPile(state, id)`, `clearPile(state)` (each clears the message; each returns `state` unchanged when `solved`)
  - `submitCheck(state, now): State` (no-op when solved; exact → `solved` true, `solvedAt = now`, `rounds + 1` only in endless, message `{ text: "Correct! You made exactly £3.95.", kind: "success" }`; over → `"A bit too much"`, under → `"Not enough yet"`, both `kind: "hint"`; empty pile counts as under)
  - `canAdvance(state, now): boolean` (true only when solved and `now - solvedAt >= ADVANCE_DELAY_MS`)

- [ ] **Step 1: Write failing tests in `tests/state.test.js`** (`node:test`, `node:assert/strict`):
  - `createState` has the shape above.
  - `startGame(s, "endless", 395)` gives target 395, empty pile, rounds 0; after a solved endless round (rounds 1), `startGame` again resets rounds to 0 while `nextRound` keeps it at 1.
  - `addToPile` then `removeFromPile` round-trips to `{}`; removing from an empty pile keeps `{}`; the input state object is never mutated.
  - `submitCheck` for target 395: pile `{"£2":1,"£1":1,"50p":1,"20p":2,"5p":1}` → solved, success message text `Correct! You made exactly £3.95.`; `{"£2":2}` → not solved, text `A bit too much`; `{}` → `Not enough yet`.
  - Endless exact increments `rounds` to 1; custom exact leaves `rounds` at 0.
  - Once solved: `addToPile`, `removeFromPile`, `clearPile` and a second `submitCheck` all return the identical (`===`) state; rounds does not increase twice.
  - `canAdvance`: false when not solved; with `solvedAt = 1000`, false at `now = 1399`, true at `now = 1400`.
  - Any change to the pile clears a previous hint message.

- [ ] **Step 2: Run `npm test`.** Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/state.js`** to the interface above. Use spread copies, not mutation.

- [ ] **Step 4: Run `npm test`.** Expected: all pass.

- [ ] **Step 5: Rewire `src/main.js`** to hold one `let state = createState()` replaced on every action by the `state.js` function, with `render()` reading only from `state` (including `state.message`). Remove the old module-level `message` variable and the local `change`/`onCheck` logic. `btn-next` and `btn-again` handlers call `canAdvance(state, performance.now())` first and return early when false. `btn-endless` calls `startGame(state, "endless", randomTarget())`; Custom submit calls `startGame(state, "custom", pence)`; Next calls `nextRound(state, randomTarget(state.target))`; Play again calls `nextRound(state, state.target)`. Behaviour is otherwise unchanged.

- [ ] **Step 6: Verify manually** (static server at `python3 -m http.server 8765`, started with `nohup … &`; stop it afterwards with `fuser -k 8765/tcp`, not `pkill -f`). Expected: Endless and Custom play exactly as before (empty check, over, exact, Next, Play again, Change amount, rounds reset after Back and Endless); a script that solves a round and clicks Next in the same tick stays on the success screen, while a click 500ms later advances; no console errors. `npm test` passes.

- [ ] **Step 7: Commit** `src/state.js src/main.js tests/state.test.js` with message `Extract pure round state and add double-tap guard`.

---

### Task 3: Tray layout and coin sizing

**Files:**
- Modify: `styles.css`, `src/render.js`, `index.html` (only if class names change)

**Interfaces:**
- Consumes: nothing new.
- Produces: `render.js` has a private helper `coinButton(coin, className, ariaLabel, extraHtml = ""): HTMLButtonElement` used by both `renderTray` and `renderPile`; `renderPile` uses `coin.diameter` directly (no `coinById` import).

- [ ] **Step 1: Re-create the throwaway layout check** in the git-ignored `.superpowers/` directory (never committed): a page that loads `/index.html` in an iframe whose width is set from a query parameter, clicks `btn-endless`, adds one of each coin to the pile, and prints, per width: whether the page scrolls sideways (`documentElement.scrollWidth > clientWidth`), the list of visible buttons smaller than 44×44px, and the `<svg>` widths of the 8 tray coins. Run it with `google-chrome --headless=new --no-sandbox --window-size=600,800 --virtual-time-budget=2000 --dump-dom <url>` at widths 320, 337, 344, 350, 359, 360, 390, and again with `html { font-size: 125% }` injected.

- [ ] **Step 2: Run it against the current code. Expected (RED):** sideways scroll at 337, 344 and 350; at 320 the 5p svg is wider than or equal to the 1p svg. Record the output.

- [ ] **Step 3: Implement the CSS change.** Make `.tray` an inline-size container (`container-type: inline-size`). The tray button becomes a fixed minimum 44×44px hit area centred in its grid cell (`grid-template-columns: repeat(4, minmax(0, 1fr))`), and its `<svg>` is sized `width: calc(var(--d) * min(0.17rem, 0.75cqw))` so the drawn coin keeps its true relative size at every width and never exceeds its column. Pile stacks keep sizing from `0.17rem` only (the pile wraps, so it cannot overflow). Remove the `--coin-scale` variable and the `@media (max-width: 21rem)` rule it needed. Keep the `×N` badge anchored to the stack button.

- [ ] **Step 4: Implement the `render.js` cleanup:** add `coinButton` and use it in `renderTray` and `renderPile`; replace `coinById(coin.id).diameter` with `coin.diameter` and drop the unused import.

- [ ] **Step 5: Re-run the layout check at all widths.** Expected (GREEN): no sideways scroll at any width, with or without 125% font size; no visible button below 44×44px; at 320px the tray svg widths are strictly ascending in this order: 5p, 1p, 20p, £1, 10p, 2p, 50p, £2. Also take a 400px and a 1100px screenshot and confirm the coins look as in the original (side-by-side layout at ≥48rem unchanged).

- [ ] **Step 6: Run `npm test`.** Expected: 17+ pass (render tests still pass).

- [ ] **Step 7: Commit** `styles.css src/render.js` with message `Size tray coins from tray width and decouple tap area`.

---

### Task 4: Accessibility, focus and small UI polish

**Files:**
- Modify: `index.html`, `styles.css`, `src/main.js`, `src/render.js`

**Interfaces:**
- Consumes: `state.js` functions and `canAdvance` from Task 2; `coinButton` from Task 3.
- Produces: `render.js` exports `setText(el: HTMLElement, text: string): void` (writes `textContent` only when it differs) and `announce(el: HTMLElement, text: string): void` (sets `textContent` to `""`, then to `text` after 50ms via `setTimeout`; empty `text` just clears).

- [ ] **Step 1: Markup changes in `index.html`:**
  - Replace the "Make" label and target paragraph with `<h1 id="play-heading" class="target" tabindex="-1"><span class="label">Make</span> <span id="play-target"></span></h1>`; give the Home and Custom `<h1>`s `tabindex="-1"` too. Keep the `play-target` id.
  - Add `aria-describedby="custom-error"` to `custom-input`.

- [ ] **Step 2: Implement `setText` and `announce` in `render.js`** and use them in `main.js`: `play-target` and `play-total` via `setText` (so unchanged values are not re-announced); `play-message` and `custom-error` via `announce`.

- [ ] **Step 3: Focus management in `main.js`.** `showScreen(name)` focuses that screen's `<h1>`. `startGame` and `nextRound` call sites focus `play-heading` after rendering (this also announces the new target). `openCustom` focuses `custom-input` as before. After a solved Check, focus still goes to the first visible action button. In the stack-removal handler use `focus({ preventScroll: true })` for the stack/tray fallback.

- [ ] **Step 4: Locked state after solving.** While `state.solved`, `render()` sets `aria-disabled="true"` on every `.coin` and `.stack` button and adds class `locked` to `.board`; otherwise removes both. CSS: `.board.locked .coin, .board.locked .stack { opacity: 0.5; }`.

- [ ] **Step 5: Custom field errors.** On a failed parse set `aria-invalid="true"` on `custom-input`; clear it on success and when the Custom screen opens. "Change amount" (`btn-change`) opens the Custom screen **pre-filled** with the current target as plain text, e.g. `3.95` (`formatPence(state.target).slice(1)`); "Custom" from Home still opens it empty.

- [ ] **Step 6: Empty pile hint.** CSS only: `.pile:empty::before { content: "Tap a coin to add it"; color: #5a6070; }`.

- [ ] **Step 7: Verify** with the headless driver (static server as in Task 2). Expected:
  - Pressing Check twice on the same wrong pile makes `play-message` go empty then reappear with the same text (observe the cleared state within 50ms); the same for submitting the same invalid amount twice.
  - After Next, Play again, Start and Back, `document.activeElement` is the screen's `<h1>` (or the custom input), never `<body>`.
  - Solved round: coin and stack buttons have `aria-disabled="true"` and the board has class `locked`; after Next both are gone.
  - `custom-input` has `aria-invalid="true"` after an invalid amount and none after a valid one; Change amount shows the previous target in the field.
  - Empty pile shows the hint text (screenshot); removing the last coin from a tall pile does not scroll the page (scroll position unchanged).
  - `npm test` passes; the Task 3 layout check still shows no sideways scroll at all widths.

- [ ] **Step 8: Commit** `index.html styles.css src/main.js src/render.js` with message `Improve accessibility, focus handling and empty/locked states`.

---

### Task 5: Final check

**Files:** none (verification only; fixes go back into the owning task's files with their own commit).

- [ ] **Step 1: Run `npm test`.** Expected: all pass, 0 fail.
- [ ] **Step 2: Walk both modes end to end** at 320px, 360px and desktop width with the headless driver and screenshots: Endless round, Custom `£3.95` round, Play again, Change amount, Back. Expected: no console errors, no sideways scroll, layout as in the original design.
- [ ] **Step 3: Confirm the working tree is clean** (`git status --short` is empty) and list the new commits with `git log --oneline main..feature/coin-game`. Stop the static server and delete `.superpowers/`.
