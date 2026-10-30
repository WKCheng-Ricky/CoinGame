# Main menu and options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Normal/Easy toggle and the four mode buttons with a mode radio group, a registry-driven options checkbox list, and one Play button.

**Architecture:** A declarative registry (`src/options.js`) lists options with a scope (all modes or named modes). `state.options` (id to boolean) replaces `state.difficulty`. A new DOM module (`src/home.js`) renders the mode rows and the options list and reports changes through callbacks, so it is unit-testable in jsdom. `main.js` wires it to state and to the existing start handlers.

**Tech Stack:** Vanilla ES modules, `node --test` with jsdom. No build step.

**Spec:** `docs/superpowers/specs/2026-10-30-menu-and-options-design.md`

## Global Constraints

- Mode ids: `endless`, `custom`, `cashier`, `give-change`.
- Mode descriptions, 4 words or fewer, exactly: Endless "Random amounts, nonstop"; Custom "Choose your own amount"; Cashier "Count the customer's coins"; Give Change "Work out the change".
- Options: `showCoins` (label "Show Coins", scope all, default off); `shortPay` (label "Short-paying customers", scope `["give-change"]`, default on).
- `shortPay` on gives `underpaid: 0.25`; off gives `underpaid: 0`; `exactShare` stays `1 / 3`.
- Show Coins off hides coin values and the running totals. The "Not enough!" button shows only in Give Change with `shortPay` on.
- Options are not saved between visits. No Timer or Score UI.
- e2e: do not write, run or plan e2e work. Leave `e2e/` and the paused CI job untouched; the e2e specs will be stale until the owner asks for a comprehensive pass.
- Commit messages use Conventional Commits and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Match the surrounding code's style: short comments, no extra abstractions.

## Review Focus

- Toggling a checkbox must not rebuild the list, or a keyboard user loses focus (Task 3 test).
- Option values must survive switching modes back and forth, including options of a mode that is not selected (Tasks 2 and 3 tests).
- `setOption` with an unknown id, or a non-boolean value, and `selectMode` with an unknown mode must return the same state object (Task 2 tests).
- Custom is selected, Play opens the amount screen, and Back from it returns to a home screen that still shows Custom selected (Task 4 manual check).
- Show Coins on with `shortPay` on in Give Change shows both the total and "Not enough!" (Task 4 manual check).

---

### Task 1: Options registry

**Files:**
- Create: `src/options.js`
- Test: `tests/options.test.js`

**Interfaces:**
- Produces:
  - `MODE_IDS: string[]` is `["endless", "custom", "cashier", "give-change"]`.
  - `OPTIONS: { id: string, label: string, hint: string, scope: "all" | string[], default: boolean }[]`, global entries first.
  - `defaultOptions(): Record<string, boolean>`.
  - `optionsFor(mode: string): typeof OPTIONS`, the global entries followed by those whose scope includes `mode`, in registry order. An unknown mode gets the global entries only.
  - `isOptionId(id: unknown): boolean`.

- [ ] **Step 1: Write the failing tests** in `tests/options.test.js` (`node:test`, `node:assert/strict`):
  - `defaultOptions()` deep-equals `{ showCoins: false, shortPay: true }`.
  - `optionsFor("endless").map(o => o.id)` deep-equals `["showCoins"]`; `optionsFor("give-change").map(o => o.id)` deep-equals `["showCoins", "shortPay"]`; `optionsFor("nope").map(o => o.id)` deep-equals `["showCoins"]`.
  - `MODE_IDS` deep-equals the four ids above, in that order.
  - Every `OPTIONS` entry has a non-empty `label` and `hint`, and its scope is `"all"` or a non-empty subset of `MODE_IDS`.
  - Ids are unique; `isOptionId("shortPay")` is true, `isOptionId("timer")` and `isOptionId(undefined)` are false.
- [ ] **Step 2: Run** `node --test tests/options.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `src/options.js`** with the signatures above. Hints: `showCoins` "Show every coin's value"; `shortPay` "Customers may not pay enough". Add a one-line comment saying a new option is one entry here plus the logic that reads it.
- [ ] **Step 4: Run** `node --test tests/options.test.js`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add the options registry`.

---

### Task 2: Options in state and Give Change odds

The app is not usable between this task and Task 4 (`main.js` still imports `setDifficulty` and `GIVE_CHANGE_ODDS`). Unit tests are green after this task; do Tasks 2 to 4 back to back.

**Files:**
- Modify: `src/state.js` (`createState`, `setDifficulty`, `startGame`, `nextRound`, `startCashier`, `startGiveChange`, `nextGiveChangeCustomer`, `nextCustomer`)
- Modify: `src/config.js` (`GIVE_CHANGE_ODDS`)
- Test: `tests/state.test.js`, `tests/config.test.js`

**Interfaces:**
- Consumes: `defaultOptions`, `isOptionId`, `MODE_IDS` from `src/options.js`.
- Produces:
  - `state.options: Record<string, boolean>`; `createState().options` equals `defaultOptions()`. `state.difficulty` no longer exists.
  - `setOption(state, id: string, value: boolean): state`. Returns the same object when `id` is not an option id or `value` is not a boolean; otherwise `{ ...state, options: { ...state.options, [id]: value } }`.
  - `selectMode(state, mode: string): state`. Returns the same object when `mode` is not in `MODE_IDS`; otherwise `{ ...state, mode }`.
  - `giveChangeOdds(options: Record<string, boolean>): { underpaid: number, exactShare: number }` in `src/config.js`. `GIVE_CHANGE_ODDS` is removed.

- [ ] **Step 1: Update and add tests.**
  - `tests/state.test.js`: in the `createState` shape test replace `difficulty: "normal"` with `options: { showCoins: false, shortPay: true }`. Replace the three `setDifficulty` tests with:
    - `setOption` sets `showCoins` true without touching `pile` or `target`, and sets it back to false.
    - `setOption` returns the same object for `"hard"`, for `undefined`, and for `("showCoins", "yes")`.
    - `setOption(s, "shortPay", false)` works while `s.mode` is `"endless"` (an option of a mode that is not selected), and `startGiveChange` of that state still has `options.shortPay === false`.
    - `selectMode` sets `mode` and keeps everything else; it returns the same object for `"nope"` and `undefined`.
    - `startGame`, `nextRound`, `startCashier`, `nextCustomer`, `startGiveChange` and `nextGiveChangeCustomer` all keep `options` (use `setOption(createState(), "showCoins", true)` as input and assert `.options.showCoins === true`). Rewrite the existing tests at the `startGame and nextRound keep the difficulty`, `startCashier keeps difficulty` and `nextGiveChangeCustomer keeps rounds and difficulty` names, and add one for `nextCustomer`.
  - `tests/config.test.js`: replace the `GIVE_CHANGE_ODDS` test with `giveChangeOdds({ shortPay: true })` deep-equals `{ underpaid: 0.25, exactShare: 1 / 3 }` and `giveChangeOdds({ shortPay: false })` deep-equals `{ underpaid: 0, exactShare: 1 / 3 }`.
- [ ] **Step 2: Run** `node --test tests/state.test.js tests/config.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces above. In `state.js` replace every `difficulty: state.difficulty` spread with `options: state.options`, and remove `setDifficulty`. In `config.js` import nothing new; `giveChangeOdds` reads `options.shortPay` only. Update the comment above it.
- [ ] **Step 4: Run** `node --test`. Expected: all tests pass (the suite excludes `main.js`, which is untested).
- [ ] **Step 5: Commit** `feat: replace difficulty with options in state`.

---

### Task 3: Home screen renderer

**Files:**
- Create: `src/home.js`
- Test: `tests/home.dom.test.js` (use `installDom` from `tests/dom-helper.js`, as `tests/render.dom.test.js` does)

**Interfaces:**
- Consumes: `MODE_IDS`, `optionsFor` from `src/options.js`.
- Produces:
  - `MODES: { id: string, label: string, blurb: string }[]` in the order and wording of the Global Constraints; its ids equal `MODE_IDS`.
  - `mountHome(els: { modes: HTMLElement, options: HTMLElement, play: HTMLElement }, handlers: { onMode(mode: string): void, onOption(id: string, checked: boolean): void, onPlay(mode: string): void }): { update(mode: string, options: Record<string, boolean>): void }`.
- Markup `update` produces:
  - `els.modes`: one `<label class="mode">` per mode holding `<input type="radio" name="mode" value="{id}">`, `<b>{label}</b>` and `<small id="mode-blurb-{id}">{blurb}</small>`; the input has `aria-describedby="mode-blurb-{id}"`.
  - `els.options`: for each entry of `optionsFor(mode)`, `<label title="{hint}"><input type="checkbox" data-option="{id}" aria-describedby="option-help-{id}"> {label}</label>` and `<span class="sr-only" id="option-help-{id}">{hint}</span>`.
- Behaviour:
  - The mode rows are built once, on the first `update`.
  - The options list is rebuilt only when `mode` changes from the previous `update`; otherwise only `checked` states are synced on the existing inputs.
  - Radio `change` calls `onMode(value)`; checkbox `change` calls `onOption(id, checked)`; clicking `els.play` calls `onPlay` with the mode from the last `update`.

- [ ] **Step 1: Write the failing tests.** Build a jsdom body containing three divs and a button, mount, and assert:
  - After `update("endless", { showCoins: false, shortPay: true })` there are four radios; the `endless` radio is checked; each radio's `aria-describedby` target exists and holds that mode's blurb; every blurb is 4 words or fewer; `MODES` ids equal `MODE_IDS`.
  - Options: endless shows one checkbox (`showCoins`, unchecked); `update("give-change", ...)` shows two, with `shortPay` checked.
  - Option values are reflected: `update("endless", { showCoins: true, shortPay: false })` checks `showCoins`, and a later `update("give-change", ...)` shows `shortPay` unchecked (values survive switching modes).
  - Focus: focus the `showCoins` checkbox, call `update` with the same mode and `showCoins: true`; the same element is still in the document, is `document.activeElement`, and is checked.
  - Handlers: dispatching `change` on a radio calls `onMode` with its id; on a checkbox calls `onOption("showCoins", true)` after setting `checked = true`; clicking Play calls `onPlay("give-change")` after `update("give-change", ...)`.
- [ ] **Step 2: Run** `node --test tests/home.dom.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `src/home.js`** per the interfaces. Use event delegation on `els.modes` and `els.options` so rebuilding the list needs no re-binding; build nodes with `document.createElement` (no `innerHTML` with labels).
- [ ] **Step 4: Run** `node --test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: add the home screen renderer`.

---

### Task 4: Wire the home and play screens

**Files:**
- Modify: `index.html` (home section; `data-difficulty` on `#screen-play`)
- Modify: `styles.css`
- Modify: `src/main.js`
- Modify: `src/drag.js:254` (comment only)
- Modify: `README.md`

**Interfaces:**
- Consumes: `mountHome`, `MODES` (`src/home.js`); `setOption`, `selectMode`, `startGame`, `startCashier`, `startGiveChange` (`src/state.js`); `giveChangeOdds` (`src/config.js`).

- [ ] **Step 1: `index.html`.** Replace the Difficulty fieldset, `#difficulty-note` and the "Choose a game" fieldset with: `<h2 id="modes-heading" class="sec">Game</h2>`; `<div id="modes" class="modes" role="radiogroup" aria-labelledby="modes-heading"></div>`; `<h2 class="sec">Options</h2>`; `<div class="choice options" id="options"></div>`; `<p id="option-note" class="choice-note" aria-live="polite"></p>`; `<button id="btn-play" class="primary play" type="button">Play</button>`. Change `data-difficulty="normal"` on `#screen-play` to `data-show-coins="false"`.
- [ ] **Step 2: `styles.css`.**
  - Delete the `.difficulty` rules (lines 133 to 135 and 282), the `.stack-col` rules (123, 124, 137, 149, 281), and the `.stack-col` touchstart no-op in `main.js`, after confirming with `grep -rn "stack-col" index.html src styles.css` that nothing else uses them.
  - Replace `[data-difficulty="normal"]` at lines 145 and 146 with `[data-show-coins="false"]`.
  - Reword the comment at line 335 ("Easy's total") to "the Show Coins total".
  - Add these rules (the approved mockup's look):
    ```css
    .modes { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; max-width: 18.5rem; margin: 0 auto; }
    .mode { display: block; margin: 0; padding: 0.55rem 0.8rem; min-height: 44px; border: 2px solid var(--line); border-radius: 0.7rem; background: var(--panel); text-align: left; cursor: pointer; }
    .mode:has(input:checked) { border-color: var(--accent); background: var(--accent-tint); }
    .mode input { position: absolute; opacity: 0; pointer-events: none; }
    .mode b { display: block; }
    .mode small { display: block; color: var(--muted); font-size: 0.85rem; }
    .mode:has(input:focus-visible) { outline: 3px solid var(--focus); outline-offset: 2px; }
    .options label { display: flex; align-items: center; gap: 0.6rem; min-height: 44px; margin: 0; padding-inline: 0.4rem; text-align: left; }
    .options input { width: 1.2rem; height: 1.2rem; flex: none; }
    h2.sec { max-width: 18.5rem; width: 100%; margin: 0.9rem auto 0.3rem; text-align: left; }
    .play { width: 100%; max-width: 18.5rem; margin: 0.5rem auto 1rem; }
    ```
    Delete the existing `input[type="radio"] { width: auto; min-height: 0; }` rule only if the new `.mode input` rule makes it unused.
- [ ] **Step 3: `src/main.js`.**
  - Imports: drop `GIVE_CHANGE_ODDS` and `setDifficulty`; add `giveChangeOdds`, `setOption`, `selectMode`, `mountHome`.
  - In `render()`: set `data-show-coins` (`String(state.options.showCoins)`) on `#screen-play` and on `document.body` in place of `data-difficulty`; `play-total` and `change-total` hidden unless `state.options.showCoins` (keeping the existing `fixedPile` / `giveChange` conditions); `btn-short` hidden unless `giveChange && state.options.shortPay`; end `render()` with `home.update(state.mode, state.options)`.
  - Replace the two `GIVE_CHANGE_ODDS[state.difficulty]` uses with `giveChangeOdds(state.options)`.
  - Replace the four mode button handlers (`btn-endless`, `btn-custom`, `btn-cashier`, `btn-give-change`) with one `startSelected(mode)` switch run by `onPlay`, whose branches contain the existing handler bodies unchanged (Custom: `openCustom("")`).
  - `const home = mountHome({ modes: $("modes"), options: $("options"), play: $("btn-play") }, { onMode: (m) => update(selectMode(state, m)), onOption: (id, v) => update(setOption(state, id, v)), onPlay: startSelected })`; create it after `render` and `update` are defined, and make the first call `render()` so the home screen is drawn at startup.
  - Rename `watchDifficultyNotes` to `watchOptionNotes`; point it at `$("options")` and `$("option-note")`; it still reads `label.title`. Call its dwell's `cancelAll()` whenever the option list is rebuilt (expose it as the function's return value and call it from `onMode`).
  - Remove the `.difficulty` change listener and the `.stack-col` touchstart no-op.
- [ ] **Step 4: `src/drag.js:254`** comment: "so the Show Coins rules hide the label".
- [ ] **Step 5: `README.md`** (lines 12, 27, 29, 36, 46): describe Show Coins (off by default; on shows values and totals), the Give Change "Short-paying customers" option (on by default), and "pick a mode, set options, press Play". Replace "In Normal, ..." with "With Show Coins off, ...".
- [ ] **Step 6: Verify.** Run `node --test`; expected all pass (do not run e2e). Start the app with `npm start` and check in a browser at phone width:
  - Home matches the approved mockup; selecting a mode swaps the options list; toggling a checkbox keeps focus.
  - Endless, Custom (amount screen, Back returns with Custom selected), Cashier and Give Change each start from Play.
  - Show Coins off hides labels and totals; on shows both. In Give Change, `shortPay` off hides "Not enough!" and no customer underpays over ~30 customers.
  - Back from a game, pick a different mode, Play: the new mode starts clean (the spec's open question on `state.mode`).
- [ ] **Step 7: Commit** `feat: pick a mode, set options, then press Play`.
