# Time Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Time Limit option (off, 30 s, 20 s or 10 s per question). When the time runs out the customer is not served: the round scores 0, the answer is shown for 2 s, then the next customer arrives.

**Architecture:** The registry learns a second option type, `choice`, which the home screen renders as a radio group. `timerOn` widens to include a limit, and `src/state.js` gains `expireRound`. `src/main.js` calls it from the clock tick added by plan 3, which this plan requires. Sub-project 4 of 4.

**Tech Stack:** Vanilla ES modules, `node --test`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-timing-stacking-and-option-clarity-design.md` (sections "Options registry changes" and "4. Time limit")

## Global Constraints

- Option id `timeLimit`, label "Time Limit", scope `["endless", "cashier", "give-change"]`, `choices` `[{ value: 0, label: "Off" }, { value: 30, label: "30 s" }, { value: 20, label: "20 s" }, { value: 10, label: "10 s" }]`, default `0`, effect `"harder"`, why "Harder: each question has a time limit", hint "Run out of time and the customer leaves".
- A non-zero limit forces Timer and Score on: the `timerScore` checkbox shows checked and disabled while a limit is set; `timerOn(options)` is `options.timerScore || options.timeLimit > 0`.
- Unserved round: `solved: true`, `unserved: true`, `lastPoints: 0`, `score` unchanged, `rounds + 1`, message kind `"hint"` and text "Customer not served. " followed by the mode's answer text. The next customer arrives after `UNSERVED_DELAY_MS = 2000` (overridable with `?unserved=<ms>` like the other timings).
- Live-region announcements: only the not-served message; the countdown is not announced.
- Custom mode never has a limit. Requires plan 3 (`timerOn`, the clock tick, `roundStartedAt`) to be merged first.
- Conventional commits ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No e2e changes.

## Review Focus

- The player solves in the same tick the limit expires: whichever call reaches state first wins, and a solved round is never expired (`expireRound` is a no-op when solved).
- A limit chosen on the home screen while Timer and Score is off and later cleared: the Timer and Score checkbox returns to its own stored value, not to a value forced by the limit.
- Backgrounded tab: elapsed time is computed from timestamps, so returning after the limit expires the round at once (known behaviour, not paused).
- The Cashier input and every coin become inert on an unserved round (the existing `state.solved` guards), and Next is not available until the longer delay has passed.
- `setOption` rejects a limit that is not one of the listed values (for example 15, "30", NaN) and a boolean for a choice option.

---

### Task 1: Choice options in the registry and the home screen

**Files:**
- Modify: `src/options.js`, `src/state.js` (`setOption` only), `src/home.js`, `styles.css`
- Test: `tests/options.test.js`, `tests/state.test.js`, `tests/home.dom.test.js`

**Interfaces:**
- Produces in `src/options.js`: entries may have `choices: Array<{ value: number, label: string }>` in place of a boolean default; `isValidValue(id: string, value: unknown) -> boolean` (boolean for entries without `choices`, a listed value for entries with); the `timeLimit` entry; `isForcedOn(id: string, options: object) -> boolean` (true for `timerScore` when `options.timeLimit > 0`); `timerOn(options)` widened as in the Global Constraints.
- `setOption(state, id, value)` accepts exactly what `isValidValue` accepts.
- Home rendering: a choice option renders a `role="radiogroup"` row labelled by its label, with one radio per choice (`name="opt-timeLimit"`, `data-option="timeLimit"`, `value="30"`), the badge and why line as for checkboxes. The `onOption` handler gets `(id, Number(value))` for radios and `(id, checked)` for checkboxes. `home.update` checks the radio matching `String(options[id])`, and checks and disables the box of any option for which `isForcedOn` is true.

- [ ] **Step 1: Write failing tests.** `options.test.js`: `defaultOptions().timeLimit === 0`; `isValidValue("timeLimit", 30)` true, `15` false, `"30"` false, `true` false; `isValidValue("showCoins", true)` true, `1` false; `isForcedOn("timerScore", { timeLimit: 20 })` true and `{ timeLimit: 0 }` false; `timerOn({ timeLimit: 10 })` true; `optionsFor("custom")` has neither new option. `state.test.js`: `setOption(state, "timeLimit", 20)` stores it; invalid values return the same state object; the `createState` shape includes `timeLimit: 0`. `home.dom.test.js`: for Cashier the list has four radios named `opt-timeLimit` with values `0,30,20,10` and the `0` one checked; changing to 20 calls `onOption("timeLimit", 20)`; with `timeLimit: 20` the Timer and Score checkbox is checked and disabled; with `timeLimit: 0` it is enabled and shows its own value; the radio group has an accessible name.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** the registry, validation and `setOption` change; in `home.js` split `optionRows` into a checkbox renderer and a choice renderer and extend the `change` listener and `update` as in Interfaces; add radio-row styles beside `.options label` in `styles.css` (44 px tall targets).
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `src/options.js src/state.js src/home.js styles.css tests/options.test.js tests/state.test.js tests/home.dom.test.js` as `feat: add the Time Limit option and choice options to the menu`.

### Task 2: Expiring a round

**Files:**
- Modify: `src/state.js`, `src/config.js`, `src/timer.js`
- Test: `tests/state.test.js`, `tests/timer.test.js`, `tests/config.test.js`

**Interfaces:**
- Produces in `src/state.js`: `unserved: false` in `createState()`; `expireRound(state: object, now: number) -> object`; the existing "Correct! ..." change text moves into a shared `answerText(scenario, due, shortBy)` (without the "Correct! " prefix) used by both `successText` and the unserved message; `canAdvance` is unchanged.
- Produces in `src/timer.js`: `timeLeftMs(startedAt: number, now: number, limitSeconds: number) -> number` (never below 0) and `isExpired(startedAt, now, limitSeconds) -> boolean` (false when `limitSeconds` is 0).
- Produces in `src/config.js`: `UNSERVED_DELAY_MS = 2000`; `timingFromSearch` also returns `unservedDelayMs` (default 2000, `?unserved=` in ms using the existing `readMs` rules). Update `TIMING_DEFAULTS` accordingly.
- Answer text per mode in the unserved message: Endless "The answer was £3.95." (the target); Cashier "The answer was £3.95." (total of the pile); Give Change by scenario — "Change: £0.60.", "No change due.", "They are £0.40 short."

- [ ] **Step 1: Write failing tests:** `expireRound` on an unsolved Endless, Cashier and Give Change round (one scenario each: over, exact, under) sets `solved`, `unserved`, `solvedAt = now`, `lastPoints 0`, `rounds + 1`, leaves `score` as it was, and gives the exact message text above with kind `"hint"`; on a solved round it returns the same object; after it `submitCheck`, `submitAnswer`, `moveCoin` and `addToPile` return the same state (solved guards); Custom is never expired by the caller but `expireRound` still works on it without touching rounds (Custom does not count rounds, matching `submitCheck`). `timer.test.js`: `timeLeftMs(1000, 4000, 10) === 7000`, `timeLeftMs(0, 20000, 10) === 0`; `isExpired(0, 9999, 10) === false`, `isExpired(0, 10000, 10) === true`, `isExpired(0, 99999, 0) === false`. `config.test.js`: defaults include `unservedDelayMs: 2000`; `?unserved=50` gives 50; bad values fall back.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** the Interfaces above; `expireRound` reuses `changeDue`, `total`, `formatPence`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `src/state.js src/config.js src/timer.js tests/state.test.js tests/timer.test.js tests/config.test.js` as `feat: expire a round when the time limit runs out`.

### Task 3: Countdown and not-served flow in the app

**Files:**
- Modify: `index.html`, `styles.css`, `src/main.js`
- Test: by running the app; any pure helper added to `src/render.js` gets a test in `tests/render.test.js`.

**Interfaces:**
- Consumes: `isExpired`, `timeLeftMs`, `expireRound`, `timerOn`, `timing.unservedDelayMs`, `state.options.timeLimit`, `state.unserved`.
- Produces: `<div id="play-countdown" class="countdown" hidden><div class="countdown-bar"></div></div>` under the clock, decorative (`aria-hidden="true"`).

- [ ] **Step 1: Extend the plan-3 tick:** each tick, if a limit is set and the round is unsolved and `isExpired(state.roundStartedAt, performance.now(), state.options.timeLimit)`, call `update(expireRound(state, performance.now()))` and focus the visible primary action as the solve paths do; otherwise update the bar width to `timeLeftMs / (limit * 1000)` and show the clock as the time left.
- [ ] **Step 2: Use the longer delay.** In `btn-next` and `btn-again` handlers pass `state.unserved ? timing.unservedDelayMs : timing.advanceDelayMs` to `canAdvance`. Reset the countdown bar when a new round is dealt.
- [ ] **Step 3: Hide the bar** unless a limit is set and the mode is not Custom; style it (width transition off so it does not lag the tick; colour from `--accent`, switching to `--bad` in the last 5 seconds, with the clock text remaining the non-colour cue).
- [ ] **Step 4: Run** `npm test` then `npm run test:coverage`. Expected: pass, thresholds hold.
- [ ] **Step 5: Run the app**, choose Cashier with a 10 s limit, do nothing and confirm: the bar drains, at zero the "Customer not served" message with the answer appears, input is inert, Next works after about 2 s and the score is unchanged; then solve a round in time and confirm the normal points path; then choose Custom and confirm no limit applies. Report that this was verified by hand.
- [ ] **Step 6: Commit** `index.html styles.css src/main.js` as `feat: count down the time limit and show unserved customers`.
