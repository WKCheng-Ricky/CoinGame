# Timer and Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** With the new Timer and Score option on, each question is timed and a correct answer adds a speed-based score (100 points falling to 10 at the mode's par time), shown with a running total.

**Architecture:** A pure `src/timer.js` holds the scoring maths and par times. `src/state.js` records when each round starts, awards points in the three submit paths and carries the running score across rounds. `src/main.js` ticks a clock display. Sub-project 3 of 4; plan 4 builds on `timerOn` defined here.

**Tech Stack:** Vanilla ES modules, `node --test`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-timing-stacking-and-option-clarity-design.md` (sections "Options registry changes" and "3. Timer and Score")

## Global Constraints

- Option id `timerScore`, label "Timer and Score", scope `["endless", "cashier", "give-change"]`, boolean, default off, effect `"neutral"`, why "Neutral: times each question and scores your speed", hint "Time each question and score your speed". Custom mode never times or scores.
- `scoreFor(elapsedMs, parMs)`: 100 at 0 ms, linear down to 10 at `parMs`, 10 beyond. Wrong checks never cost points.
- Par times: Endless 15000 ms, Cashier 20000 ms, Give Change 30000 ms. `?par=<seconds>` overrides all three (whole seconds 1-600; anything else is ignored).
- The clock starts when a round is dealt and stops when it is solved; the home and Custom amount screens never run it.
- `config.js` imports from `state.js`, so `state.js` must not import `config.js`; par logic lives in `timer.js`, which imports nothing.
- Conventional commits ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No e2e changes.

## Review Focus

- A solve at exactly 0 ms and at exactly `parMs`: 100 and 10, no NaN or fractional points (points are whole numbers, rounded).
- The running score survives `next*` (new customer) but resets on a new game (`startGame`, `startCashier`, `startGiveChange`).
- Option off: no points, no clock, messages unchanged from today.
- Custom mode with the option on: nothing is timed.
- A repeated wrong Check does not move `roundStartedAt` or change `score`.

---

### Task 1: Scoring maths and the par override

**Files:**
- Create: `src/timer.js`
- Modify: `src/config.js`, `src/options.js`
- Test: `tests/timer.test.js` (new), `tests/config.test.js`, `tests/options.test.js`

**Interfaces:**
- Produces in `src/timer.js`: `PAR_MS: { endless: 15000, cashier: 20000, "give-change": 30000 }`; `parFor(mode: string, overrideMs: number | null = null) -> number | null` (null for modes with no par, such as custom); `scoreFor(elapsedMs: number, parMs: number) -> number` (integer 10-100); `formatClock(ms: number) -> string` as `m:ss`.
- Produces in `src/config.js`: `TIMING_DEFAULTS.parMs = null`; `timingFromSearch` also returns `parMs` (ms or null).
- Produces in `src/options.js`: the `timerScore` entry; `timerOn(options) -> boolean` (`options.timerScore` for now; plan 4 widens it).

- [ ] **Step 1: Write failing tests.** `timer.test.js`: `scoreFor(0, 20000) === 100`; `scoreFor(20000, 20000) === 10`; `scoreFor(40000, 20000) === 10`; `scoreFor(10000, 20000) === 55`; `scoreFor(5, 0)` is 10 (no divide by zero); results are integers. `parFor("cashier") === 20000`, `parFor("custom") === null`, `parFor("cashier", 5000) === 5000`. `formatClock(0) === "0:00"`, `formatClock(65000) === "1:05"`, `formatClock(-5) === "0:00"`. `config.test.js`: the defaults deep-equal `{ dwellMs: 2000, detachHoldMs: 1000, advanceDelayMs: 400, parMs: null }`; `?par=12` gives 12000; `?par=0`, `?par=601`, `?par=abc`, `?par=1.5` give null. `options.test.js`: defaults include `timerScore: false`; scope is endless, cashier and give-change only, listed last among each mode's options; `timerOn({ timerScore: true }) === true` and `timerOn({}) === false`.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** the three modules' additions (Interfaces above). `scoreFor` uses `Math.round` of the linear value.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `src/timer.js src/config.js src/options.js tests/timer.test.js tests/config.test.js tests/options.test.js` as `feat: add the Timer and Score option and the scoring maths`.

### Task 2: Round clock and points in state

**Files:**
- Modify: `src/state.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Consumes: `scoreFor`, `parFor`, `timerOn`.
- Produces: `createState()` gains `roundStartedAt: 0`, `score: 0`, `lastPoints: 0`. New trailing `now = 0` parameter on `startGame(state, mode, target, now)`, `nextRound(state, target, now)`, `startCashier(state, rng, now)`, `startGiveChange(state, odds, rng, now)`, `nextCustomer(state, rng, now)`, `nextGiveChangeCustomer(state, odds, rng, now)`, which set `roundStartedAt`. New trailing `parMs = null` on `submitCheck(state, now, parMs)`, `submitAnswer(state, pence, now, parMs)`, `submitGiveChangeAnswer(state, action, now, parMs)`. `nextRound`, `nextCustomer` and `nextGiveChangeCustomer` carry `score`; the `start*` functions reset it.
- Behaviour: on a correct answer, if `timerOn(state.options)` and `parFor(state.mode, parMs) !== null`, set `lastPoints = scoreFor(now - roundStartedAt, par)`, `score += lastPoints` and append ` +N points` to the success text. Otherwise state and text are exactly as today.

- [ ] **Step 1: Write failing tests:** the updated `createState` shape; for each of the three submit functions with the option on, a solve 10000 ms after `roundStartedAt` in Cashier (par 20000) gives `lastPoints` 55, `score` 55 and a message ending ` +55 points`; the same solve with the option off leaves `score` 0 and the old message; Custom mode with the option on gives no points; a wrong answer or Check leaves `score`, `lastPoints` and `roundStartedAt` unchanged; `nextCustomer` and `nextGiveChangeCustomer` and `nextRound` keep `score` and set the new `roundStartedAt`; `startGame`, `startCashier` and `startGiveChange` zero `score`; a `parMs` override changes the points.
- [ ] **Step 2: Run** `node --test tests/state.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** with one private helper that takes the state and `now` and `parMs` and returns the `{ score, lastPoints, suffix }` fields merged into each success return; and one helper that stamps `roundStartedAt` after a deal.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `src/state.js tests/state.test.js` as `feat: time each round and award speed points`.

### Task 3: The clock display

**Files:**
- Modify: `index.html`, `styles.css`, `src/main.js`
- Test: `tests/render.dom.test.js` only if the display is a pure function in `src/render.js`; the interval wiring in `main.js` is excluded from coverage and checked by running the app.

**Interfaces:**
- Consumes: `timerOn`, `formatClock`, `state.roundStartedAt`, `state.score`, `timing.parMs`.
- Produces: `<p id="play-clock" class="rounds" hidden>` in `.topbar-info` after `#play-rounds`, showing `Time 0:12 · Score 340` and not an `aria-live` region.

- [ ] **Step 1: Add the element** to `index.html` and a `.clock` style if `.rounds` does not already fit.
- [ ] **Step 2: In `main.js` `render()`:** hide `#play-clock` unless `timerOn(state.options) && state.mode !== "custom"`; show the score from state. Pass `performance.now()` and `timing.parMs` to `startGame`, `nextRound`, `startCashier`, `startGiveChange`, `nextCustomer`, `nextGiveChangeCustomer`, and `timing.parMs` to the three submit calls.
- [ ] **Step 3: Add one `setInterval` (250 ms)** that, while the play screen is visible, the round is not solved and the clock is shown, updates the clock text from `performance.now() - state.roundStartedAt`; when the round is solved the final time stays shown.
- [ ] **Step 4: Run** `npm test` then `npm run test:coverage`. Expected: pass, and the 80% thresholds hold.
- [ ] **Step 5: Run the app** (`npm start`, open it), turn on Timer and Score in Cashier, solve one round and confirm the clock runs, stops on solve and the message shows points; then confirm Custom shows no clock. State plainly in the report that this was checked by hand.
- [ ] **Step 6: Commit** `index.html styles.css src/main.js` (plus any `render.js` test) as `feat: show the round clock and running score`.
