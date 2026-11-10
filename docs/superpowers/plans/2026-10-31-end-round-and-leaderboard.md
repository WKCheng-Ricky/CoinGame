# End a Session and the Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an End button and an icon-only Back to the play screen, confirmation dialogs that pause the clock, a Session over summary, and a local per-mode, per-difficulty top-10 leaderboard.

**Architecture:** Pure logic goes in `src/state.js` (`isScored`, `exitPrompt`, `endSession`, `pauseClock`, `resumeClock`) and a new `src/scores.js` (a storage-injected score store, like `src/theme.js`). Two small DOM modules, `src/confirm.js` (a choice dialog) and `src/leaderboard.js` / `src/summary.js` (screen renderers), take their elements as arguments, like `mountHome`. `src/main.js` only wires them together.

**Tech Stack:** Plain HTML, CSS and ES modules; `node --test` with jsdom (jsdom has no `<dialog>.showModal()`, so `confirm.js` falls back to the `open` attribute when it is missing).

**Spec:** `docs/superpowers/specs/2026-10-31-end-round-and-leaderboard-design.md`

## Global Constraints

- Local only: one `localStorage` key `coin-counting-game-scores`, JSON `{ "<mode>:<preset>": [ { score, served, at } ] }`; each board keeps the **top 10**, score high to low, ties earlier first. No names, no server.
- Boards are per mode (`endless`, `cashier`, `give-change`) and difficulty preset (`normal`, `hard`, `veryHard`). Easy and custom-settings sessions are never ranked; a score of 0 is never stored.
- A session is **scored** when the mode is not `custom` and `timerOn(options)` is true. End is **always shown**; unscored, it behaves exactly like Back (leaves at once, no dialog).
- Scored End asks "End the session and save your score?" (**End and save** / **Keep playing**). Scored Back with a score above 0 asks "Leave without saving your score?" (**Save score and leave** / **Leave without saving** / **Keep playing**); with a score of 0 it leaves at once. Escape means Keep playing.
- The clock (round timer, time-limit countdown, score timing) is stopped while a dialog is open and resumes unchanged.
- Back and End are icon-only, at least 44 x 44 px, with `aria-label` and `title`: Back "Back", End "End and score". Trophy: `aria-label="Leaderboard"`.
- Clear scores needs a second press ("Press again to clear all scores").
- Blocked or corrupt storage must never crash the game.
- Do not edit `e2e/` (paused; owner's instruction). Commit messages use Conventional Commits and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Run the unit suite with `npm test`.

## Review Focus

- The Enter-to-Check shortcut and drag/dwell must not act while a dialog is open; pinned in Task 7's guard and checked by eye.
- Pausing while the round is already solved (answer showing) or paused twice must not shift times; pinned in Task 3.
- Corrupt or wrong-shape stored JSON and a throwing storage must give an empty board, not an error; pinned in Task 2.
- A tie at rank 10, and a score that does not make the top 10, must return `null` and leave the board unchanged; pinned in Task 2.
- Back from the leaderboard must return to where it was opened (Home or the Summary) and keep the Summary intact; pinned in Task 5/6 and checked by eye in Task 7.

---

## File Structure

- Create `src/scores.js` (store), `src/confirm.js` (choice dialog), `src/leaderboard.js` (leaderboard screen), `src/summary.js` (summary screen).
- Modify `src/state.js`, `src/icons.js`, `src/main.js`, `index.html`, `styles.css`, `README.md`.
- Create tests `tests/scores.test.js`, `tests/confirm.dom.test.js`, `tests/leaderboard.dom.test.js`, `tests/summary.dom.test.js`; extend `tests/state.test.js`, `tests/icons.test.js`, `tests/index-html.test.js`.

---

### Task 1: Flag and trophy icons

**Files:**
- Modify: `src/icons.js`, `tests/icons.test.js`

**Interfaces:**
- Produces: `icon("flag", size)` and `icon("trophy", size)`; `ICON_NAMES` gains `"flag"` and `"trophy"` (after `"gear"`, before `"easier"`).

- [ ] **Step 1: Write the failing test.** In `tests/icons.test.js` update the `ICON_NAMES` list assertion to `["eye", "enlarge", "layers", "coin-down", "stopwatch", "hourglass", "gear", "flag", "trophy", "easier", "harder", "neutral"]`. The existing every-icon test then covers aria-hidden, the 24-unit box and non-empty content.
- [ ] **Step 2: Run** `node --test tests/icons.test.js`. Expected: FAIL (list differs).
- [ ] **Step 3: Add the two entries** to `SHAPES` in `src/icons.js`, stroke style like the others: `flag` = a pole and a pennant (for example `path("M5 21V4M5 4h12l-2 4 2 4H5")`); `trophy` = a cup with two handles and a base (for example `path("M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M10 17h4")`). Adjust the paths if they do not read at 24 px.
- [ ] **Step 4: Run** `node --test tests/icons.test.js`, then render both at 96 px and 24 px with a throwaway Playwright page outside the repo (as the gear was checked) and Read the screenshot. Expected: PASS, and both icons recognisable.
- [ ] **Step 5: Commit**

```bash
git add src/icons.js tests/icons.test.js
git commit -m "feat: add flag and trophy icons"
```

---

### Task 2: Score store

**Files:**
- Create: `src/scores.js`, `tests/scores.test.js`

**Interfaces:**
- Produces:
  - `SCORES_KEY = "coin-counting-game-scores"`, `TOP_N = 10`.
  - `BOARD_MODES = ["endless", "cashier", "give-change"]`, `BOARD_PRESETS = ["normal", "hard", "veryHard"]`.
  - `boardId(mode: string, preset: string) -> string` returning `"<mode>:<preset>"`.
  - `createScoreStore(storage) -> { list(boardId): Entry[], add(boardId, entry): number | null, clear(): void }` where `Entry = { score: number, served: number, at: string }` and `storage` may be `null`.
  - `rankText(rank: number | null, size: number) -> string`: `"New best score!"` for 1, `"Rank <rank> of <size>"` otherwise, `"Not in the top 10"` for `null`.

- [ ] **Step 1: Write the failing tests** in `tests/scores.test.js` using a fake storage (`{ getItem, setItem, removeItem }` over an object; also a throwing one):
  - `add returns the 1-based rank and list returns scores high to low`.
  - `a tie ranks after the earlier equal score`: add 50 twice; the second returns 2 and `list` keeps the first first.
  - `a board keeps only the top 10`: add 11 ascending scores; `list` length is 10, the lowest is gone, and adding a score lower than all ten returns `null` and leaves the board unchanged; a score equal to the 10th returns `null`.
  - `boards are separate per boardId`.
  - `a result survives a new store over the same storage`.
  - `corrupt JSON, a non-object value and entries of the wrong shape give an empty board`: stored `"not json"`, `"[]"`, and `{"endless:normal":[{"score":"x"}]}` all `list` as `[]` and `add` still works afterwards.
  - `a throwing or null storage never throws`: `add` returns the rank it would have had (the result is still shown) and `list` returns `[]`.
  - `clear removes every board`.
  - `rankText` for 1, 3 of 7 (`"Rank 3 of 7"`) and `null`; `boardId("give-change", "veryHard") === "give-change:veryHard"`.
- [ ] **Step 2: Run** `node --test tests/scores.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `src/scores.js`.** Read the key inside try/catch (as `src/theme.js` does); validate each entry (finite numbers for `score` and `served`, string `at`); sort by `score` descending with a stable sort so earlier entries stay first on ties; write with `setItem` inside try/catch and ignore failure.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/scores.js tests/scores.test.js
git commit -m "feat: add a local top-10 score store"
```

---

### Task 3: Session rules in state

**Files:**
- Modify: `src/state.js` (`createState` and new exports), `tests/state.test.js`

**Interfaces:**
- Consumes: `timerOn`, `presetOf` from `src/options.js`.
- Produces:
  - `createState()` gains `pausedAt: null`.
  - `isScored(state) -> boolean`: `state.mode !== "custom" && timerOn(state.options)`.
  - `exitPrompt(state, button: "back" | "end") -> null | "end" | "back"`: `null` when not scored, or when `button` is `"back"` and `state.score === 0`; `"end"` for a scored End; `"back"` for a scored Back with a score above 0.
  - `endSession(state, at: string) -> { mode, preset, score, served, at }` with `preset = presetOf(state.options)`, `score = state.score`, `served = state.rounds`.
  - `pauseClock(state, now: number) -> state`: sets `pausedAt = now`, unless the round is `solved` or already paused (then returns `state` unchanged).
  - `resumeClock(state, now: number) -> state`: when paused, adds `now - pausedAt` to `roundStartedAt` and clears `pausedAt`; otherwise returns `state` unchanged.

- [ ] **Step 1: Write the failing tests** in `tests/state.test.js`:
  - `isScored is true for the timed modes with the timer on, false for custom or with the timer off`.
  - `exitPrompt asks only when scored, and Back with no score leaves at once`: cases for `end`/`back` x scored/unscored x score 0/5.
  - `endSession reports mode, preset, score and customers served`: for `"give-change"` Hard preset options with score 120 and rounds 3 returns `{ mode: "give-change", preset: "hard", score: 120, served: 3, at }`.
  - `endSession preset is null for custom settings` (change one option so no preset matches), and `endSession does not change its input`.
  - `pauseClock then resumeClock leaves elapsed time and the countdown unchanged`: `roundStartedAt: 1000`, pause at 5000, resume at 9000, expect `roundStartedAt === 5000` and `pausedAt === null`.
  - `pauseClock does nothing when solved or already paused, and resumeClock does nothing when not paused`.
- [ ] **Step 2: Run** `node --test tests/state.test.js`. Expected: new tests FAIL (exports missing).
- [ ] **Step 3: Implement** the functions above in `src/state.js` (add `presetOf` to the `options.js` import). Keep each one small and pure.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/state.js tests/state.test.js
git commit -m "feat: add scored-session rules, the end result and clock pausing"
```

---

### Task 4: Choice dialog

**Files:**
- Create: `src/confirm.js`, `tests/confirm.dom.test.js`
- Modify: `index.html` (add a dialog before the closing `</main>`), `styles.css`

**Interfaces:**
- Produces: `createChoiceDialog(dialog: HTMLDialogElement) -> { ask(title: string, choices: { id: string, label: string }[]) -> Promise<string>, isOpen() -> boolean }`. `ask` fills the dialog's `<h2>` with `title` and its `.dialog-actions` with one button per choice (the first is focused), opens it, and resolves with the chosen `id`. Closing by Escape or the `cancel` event resolves `"keep"`. The dialog is closed again when it resolves. If `showModal` or `close` is missing (jsdom, very old browsers) it falls back to setting and removing the `open` attribute.
- Markup: `<dialog id="confirm-dialog" aria-labelledby="confirm-title"><h2 id="confirm-title"></h2><div class="dialog-actions"></div></dialog>`.

- [ ] **Step 1: Write the failing tests** in `tests/confirm.dom.test.js` (build the dialog markup in `installDom`):
  - `ask opens the dialog with the title and one button per choice, the first focused`.
  - `clicking a choice resolves its id and closes the dialog` (`isOpen()` false afterwards).
  - `the cancel event (Escape) resolves keep and closes the dialog`.
  - `ask can be used again and replaces the previous buttons`.
- [ ] **Step 2: Run** `node --test tests/confirm.dom.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement `src/confirm.js`** and add the markup to `index.html`. In `styles.css` style it with the existing variables: `dialog { max-width: min(20rem, calc(100vw - 2rem)); padding: 1rem; border: 2px solid var(--line); border-radius: 0.8rem; background: var(--panel); color: var(--ink); }`, `dialog::backdrop { background: #0006; }`, `.dialog-actions { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem; }`, each rule at the left edge on its own line.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/confirm.js tests/confirm.dom.test.js index.html styles.css
git commit -m "feat: add a modal choice dialog for End and Back"
```

---

### Task 5: Leaderboard screen and its home button

**Files:**
- Create: `src/leaderboard.js`, `tests/leaderboard.dom.test.js`
- Modify: `index.html` (new `#screen-leaderboard`; trophy button in `.home-end`), `styles.css`, `tests/index-html.test.js`

**Interfaces:**
- Consumes: `createScoreStore` shape, `BOARD_MODES`, `BOARD_PRESETS`, `boardId` from `src/scores.js`; `MODES` from `src/home.js`; `PRESETS` from `src/options.js`.
- Produces: `mountLeaderboard(els, { store, onBack }) -> { show(mode: string, preset: string, highlight?: number) }` where `els = { mode, preset, list, empty, caption, clear, back }`. `show` selects the board, renders it and highlights the 1-based row `highlight`. Changing either radio group re-renders. `formatDate(iso: string) -> string` is also exported (en-GB, for example "31 Oct 2026").
- Markup ids: `#screen-leaderboard` (hidden, with `<h1 tabindex="-1">Leaderboard</h1>`), `#leaderboard-back`, `#lb-mode` and `#lb-preset` (radiogroups with `class="seg"`), `<table id="lb-table">` with a `<caption>` and `<thead>` Rank / Score / Served / Date, `#lb-empty`, `#lb-clear`. In `.home-end`, before `#btn-theme`: `<button id="btn-leaderboard" class="options-btn" type="button" aria-label="Leaderboard" title="Leaderboard"></button>` (main.js prepends the trophy icon).

- [ ] **Step 1: Write the failing tests.** `tests/leaderboard.dom.test.js` with a fake store: `show renders rank, score, served and date rows in order` ; `show highlights the given row` (a `aria-current="true"` on that row); `an empty board shows the no-scores message and hides the table`; `choosing another mode or difficulty re-renders that board`; `Clear scores needs two presses: the first changes the label to "Press again to clear all scores" and clears nothing, the second calls store.clear() and shows the empty message`; `the armed state is dropped when focus leaves or the board changes`; `Back calls onBack`; `formatDate gives "31 Oct 2026" for a midday UTC ISO date`. In `tests/index-html.test.js`: `the home top bar has an icon-only Leaderboard button before the theme toggle` (aria-label, no text, inside `.home-end`, before `#btn-theme`).
- [ ] **Step 2: Run** `node --test tests/leaderboard.dom.test.js tests/index-html.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/leaderboard.js` and the markup. Modes shown are `MODES` filtered to `BOARD_MODES`; presets are `PRESETS` filtered to `BOARD_PRESETS`; radio names `lb-mode` / `lb-preset`. Add CSS: table styles using `var(--line)` and `var(--panel)`, `tr[aria-current="true"]` with the accent tint, the screen added to the shared `#screen-custom, #screen-options` scrolling rule.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/leaderboard.js tests/leaderboard.dom.test.js index.html styles.css tests/index-html.test.js
git commit -m "feat: add the leaderboard screen and its home button"
```

---

### Task 6: Summary screen

**Files:**
- Create: `src/summary.js`, `tests/summary.dom.test.js`
- Modify: `index.html` (new `#screen-summary`), `styles.css`

**Interfaces:**
- Consumes: `rankText` from `src/scores.js`; labels from `MODES` and `PRESETS`.
- Produces: `mountSummary(els, { onAgain, onLeaderboard, onHome }) -> { show(result, rank: number | null, size: number) }` where `els = { title, line, score, served, rank, again, leaderboard, home }`. `result` is the `endSession` result. `show` writes: the line `"<Mode label>, <Preset label>"` (or just the mode label with " (custom settings)" when `preset` is `null`); the score; the customers served; and the rank line: `rankText(rank, size)`, or `"Custom settings are not ranked."` when `preset` is `null`, or `"No points scored, so nothing was saved."` when `score` is 0. The Leaderboard button is hidden for a custom-settings result.
- Markup: `#screen-summary` (hidden) with `<h1 tabindex="-1">Session over</h1>` and ids `summary-line`, `summary-score`, `summary-served`, `summary-rank`, `summary-again` ("Play again"), `summary-leaderboard` ("Leaderboard"), `summary-home` ("Home").

- [ ] **Step 1: Write the failing tests** in `tests/summary.dom.test.js`: `show writes the mode and difficulty, score and customers served`; `rank 1 says New best score!, rank 3 of 7 says "Rank 3 of 7", null says "Not in the top 10"`; `a custom-settings result says it is not ranked and hides the Leaderboard button`; `a score of 0 says nothing was saved`; `the three buttons call their handlers`.
- [ ] **Step 2: Run** `node --test tests/summary.dom.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/summary.js` and the markup; add `#screen-summary` to the shared scrolling-screen CSS rule and give the score a large heading style.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/summary.js tests/summary.dom.test.js index.html styles.css
git commit -m "feat: add the Session over summary screen"
```

---

### Task 7: Play top bar, flows and wiring

**Files:**
- Modify: `index.html` (play top bar), `styles.css`, `src/main.js`, `README.md`, `tests/index-html.test.js`

**Interfaces:**
- Consumes: everything produced in Tasks 1-6; `getStorage` from `src/theme.js`.
- Produces: the finished feature; no new exports.

- [ ] **Step 1: Write the failing markup tests** in `tests/index-html.test.js`: `the play top bar has an icon-only Back on the left and an End on the right` (`#btn-back` text is exactly `‹`, `aria-label="Back"`, `title="Back"`, is the first child of `.topbar`; `#btn-end` has `aria-label="End and score"`, no text, comes after `.topbar-info` and before `#topbar-customer`); `the dialog, summary and leaderboard screens exist and start hidden`.
- [ ] **Step 2: Run** `node --test tests/index-html.test.js`. Expected: FAIL.
- [ ] **Step 3: Edit `index.html` and `styles.css`.** `#btn-back` shows only the `&lsaquo;` glyph (remove the word "Back") and gets `aria-label="Back" title="Back"`; add `<button id="btn-end" type="button" aria-label="End and score" title="End and score"></button>` after `.topbar-info`. CSS: `.topbar > #btn-back, .topbar > #btn-end { min-width: 44px; min-height: 44px; padding: 0; display: grid; place-items: center; }` and `.topbar #btn-end .ico { width: 1.4rem; height: 1.4rem; }`; confirm the Give Change top bar still keeps Back, price and End on one row (the customer pile is `flex: 1 0 100%` and stays below).
- [ ] **Step 4: Wire `src/main.js`.** Add `"summary"` and `"leaderboard"` to `SCREENS`; prepend `icon("flag", 24)` to `#btn-end` and `icon("trophy", 24)` to `#btn-leaderboard`; create the store with `createScoreStore(getStorage(window))` (the same storage helper the theme uses), the choice dialog from `#confirm-dialog`, and mount the leaderboard and summary with these handlers: summary Play again calls `startSelected(state.mode)`; summary Leaderboard opens the leaderboard on the result's board, highlighting its rank, with Back returning to the summary; summary Home and leaderboard Back from home go to `home`; `#btn-leaderboard` opens the leaderboard on `endless:normal`.
  Implement two flows:
  - `leave(button)`: `const ask = exitPrompt(state, button)`; if `null` call `showScreen("home")`. Otherwise `update(pauseClock(state, performance.now()))`, `await dialog.ask(...)` with the End or Back choices from Global Constraints, then `update(resumeClock(state, performance.now()))` unless the choice leaves. Choices: `"save"` runs `finish()`; `"discard"` shows home; `"keep"` just resumes.
  - `finish()`: `const result = endSession(state, new Date().toISOString())`; if `result.preset !== null && result.score > 0` then `rank = store.add(boardId(result.mode, result.preset), { score: result.score, served: result.served, at: result.at })` else `rank = null`; `summary.show(result, rank, store.list(boardId).length)`; `showScreen("summary")`.
  `#btn-back` and `#btn-end` call `leave("back")` and `leave("end")`. In `tickClock` treat a paused round as stopped: skip the expiry check while `state.pausedAt !== null` and use `state.pausedAt` as `now` for the displayed time. In the Enter-to-Check handler return early when `dialog.isOpen()`. `home.update` and `render` are unchanged.
- [ ] **Step 5: Run** `npm test` and `npm run test:coverage`. Expected: PASS (`src/main.js` is excluded from coverage).
- [ ] **Step 6: Verify the flow in a browser** with a throwaway Playwright script outside the repo against `python3 -m http.server`: Cashier on Normal, answer one customer, press End, confirm the dialog stops the clock (the clock text does not change over 2 s), "Keep playing" resumes, then End and save shows the Session over screen with the score and "New best score!", Leaderboard shows the row highlighted and Back returns to the summary, Home opens the home screen, the trophy opens the same board, and Clear scores needs two presses. Also check Back with a score offers the three choices, Back with no score leaves at once, Easy and Custom End just leave, and the Give Change top bar at 320 px keeps Back, price and End on one row. Read the screenshots.
- [ ] **Step 7: Update `README.md`:** add a short "Ending a session and the leaderboard" paragraph (End and Back, confirmations, per-mode and difficulty top-10 kept on this device, Easy and custom settings not ranked).
- [ ] **Step 8: Commit**

```bash
git add index.html styles.css src/main.js README.md tests/index-html.test.js
git commit -m "feat: add End and Back confirmations, the summary and the leaderboard to the play flow"
```

---

## Self-Review

- **Spec coverage:** icon-only Back and End always shown (Task 7); scored/unscored behaviour (`isScored`, `exitPrompt`, Task 3); confirmations with the exact texts and a stopped clock (Tasks 3, 4, 7); `endSession` result and recording rules (Tasks 3, 7); Summary with rank lines and the three buttons (Task 6); store, top 10, tie order, corrupt and blocked storage, `clear` (Task 2); leaderboard screen with the selectors, highlight, empty message, two-press Clear scores (Task 5); trophy on home (Task 5); `flag` and `trophy` icons (Task 1); README (Task 7).
- **Names:** `isScored`, `exitPrompt`, `endSession`, `pauseClock`, `resumeClock` (Task 3) are what Task 7 calls; `createScoreStore`, `boardId`, `rankText`, `BOARD_MODES`, `BOARD_PRESETS` (Task 2) are used in Tasks 5-7; `createChoiceDialog` (Task 4), `mountLeaderboard` (Task 5), `mountSummary` (Task 6).
- **Dependencies:** Plans A and B are merged on this branch (the home `.home-end` bar and `tests/index-html.test.js` exist).
