# Timing, auto-stack and option clarity: Design Spec

Date: 2026-10-30
Builds on: `2026-10-30-menu-and-options-design.md`, `2026-10-30-large-coins-design.md`,
`2026-10-29-give-change-mode-design.md`, `2026-10-27-messy-pile-design.md`

## Purpose

Four related changes, built and planned as four sub-projects in this order:

1. **Option badges**: show whether each menu option makes the game easier, harder or neutral.
2. **Auto-stack**: tidy the customer's dealt coins in Cashier and Give Change so multi-round play is less tedious.
3. **Timer and Score**: time each question and convert the time into a score.
4. **Time limit**: cap the time per question; running out means the customer is not served.

Each sub-project gets its own implementation plan. 4 depends on 3; 1 and 2 are independent.
Order: 1, 2, 3, 4.

## Decisions (from the owner)

- Auto-stack makes same-coin stacks, each in its own spot so no stack covers another. Stacks are not sorted by value.
- Auto-stack is an option, on by default, for Cashier and Give Change. It applies to dealt coins only; coins the player adds as change are placed as today.
- Score is a speed bonus per question. Wrong checks cost time, not points.
- The time limit is an option with 30s / 20s / 10s presets. Expiry means "customer not served": score 0, answer shown, next customer.
- Option badges use text and an icon, never colour alone, and say what turning the option **on** does.
- Timer and Score is one option, off by default. Choosing a time limit forces it on.
- Custom mode has no timer, score or limit.
- E2E specs are not touched (see the standing note on the paused CI job).

## Options registry changes (`src/options.js`)

Each entry gains:

- `effect`: `"easier" | "harder" | "neutral"`, what turning it on does.
- `why`: one short line shown under the label, beginning with the effect, for example "Harder: coin values are hidden".

Final table:

| id | Label | Scope | Type / default | Effect |
|---|---|---|---|---|
| `showCoins` | Show Coins | all | boolean, off | easier |
| `largeCoins` | Large Coins | all | boolean, off | neutral |
| `autoStack` | Auto-stack | cashier, give-change | boolean, **on** | easier |
| `shortPay` | Short-paying customers | give-change | boolean, on | harder |
| `timerScore` | Timer and Score | endless, cashier, give-change | boolean, off | neutral |
| `timeLimit` | Time Limit | endless, cashier, give-change | choice: `0` (off), `30`, `20`, `10`; default `0` | harder |

`timeLimit` is the first non-boolean option. Entries may declare `choices` (a list of
`{ value, label }`) in place of a boolean. `defaultOptions()` returns the default value;
`setOption` accepts a boolean for boolean options and a listed value for choice options,
and ignores anything else. `optionsFor` ordering is unchanged (global, then mode-specific).

A registry test asserts that every option declares an `effect` and a non-empty `why`.

## 1. Option badges (`src/home.js`, `styles.css`)

- `optionRows` renders a badge beside each label: an icon plus the word Easier, Harder or Neutral, with a distinct shape per effect (for example up, down and level arrows) so meaning never relies on colour.
- The `why` line replaces the screen-reader-only help text. It is linked with `aria-describedby` and visible.
- Press-and-hold (dwell) still shows `hint`.
- Choice options render as a small radio group in the same row layout, with the badge on the group's label.
- Badge colours come from theme variables and must meet the existing contrast tests in light and dark themes.

## 2. Auto-stack (`src/game.js`, `src/state.js`)

- When `autoStack` is on, `dealHandful` (Cashier, Give Change) does not place coins one by one. It groups the handful by coin id and builds one stack per group using the existing stack step (`STACK_STEP_MM`, one shared rotation per stack).
- Stacks are positioned by rejection sampling so no two stacks' bounding areas overlap, taking the stack's real extent into account (radius of the coin plus its step offset times the count), at the current coin scale and the current box height (including the compact boxes). If sampling fails after a bounded number of tries, it falls back to a jittered grid of cells sized to the largest stack.
- The positions are shuffled, not ordered by value.
- A handful of up to 12 coins must always fit, including with Large Coins in the shortest Give Change box. If a layout cannot avoid overlap in a box, it minimises overlap rather than failing, and a test pins the worst case.
- With the option off, `dealHandful` behaves exactly as today (random scatter, 25% stack chance).
- Give Change keeps flagging dealt coins as the customer's and keeps `dealt` as the placed layout so Clear restores it.
- Nothing about drag, send, transfer or settle changes. Settling a stack the player moves later works as before.

## 3. Timer and Score (`src/timer.js` new, `src/state.js`, `src/config.js`, `src/main.js`)

- New option `timerScore`.
- `timer.js` is pure. `scoreFor(elapsedMs, parMs)` returns 100 at 0 ms, falling linearly to a floor of 10 at `parMs`, and 10 beyond it. `parMs` comes from `config.js`: Endless 15 s, Cashier 20 s, Give Change 30 s. They are overridable by query string like the existing timing values (`?par=` in seconds, same validation style as `readMs`).
- State gains `roundStartedAt`, `score` (running total) and `lastPoints`. The start functions and `next*` functions take a `now` and set `roundStartedAt`. The success paths (`submitCheck`, `submitAnswer`, `submitGiveChangeAnswer`) already record `solvedAt`; when `timerScore` is on they also add `scoreFor(solvedAt - roundStartedAt, par)` to `score`, set `lastPoints`, and append "+N points" to the success message. The running `score` carries across rounds like `rounds` does.
- The clock runs in `main.js` on `performance.now()` and the UI shows elapsed time and the running score. Tests inject the time.
- The clock stops when the round is solved. It does not start until the round is dealt, so the home screen and the Custom amount screen never run it.
- With the option off, nothing is shown and state is unchanged in behaviour.

## 4. Time limit (`src/state.js`, `src/main.js`)

- New choice option `timeLimit`. A non-zero value forces Timer and Score on: the Timer and Score checkbox shows checked and disabled while a limit is chosen, and the state reads `timerScore || timeLimit > 0`.
- `expireRound(state, now)` sets `solved: true`, `solvedAt: now`, `unserved: true`, `lastPoints: 0` and the message "Customer not served. The answer was …", using the existing answer text for the mode (the amount, or the change due, or "no change", or "not enough"). It increments `rounds` and leaves `score` unchanged. It does nothing if the round is already solved.
- Advance uses the existing `canAdvance` delay, so the next customer arrives as after a correct answer. The expired round must stay visible long enough to read; the advance delay for an unserved round is longer (2 s, in `config.js`).
- `main.js` checks the clock on a timer tick and calls `expireRound` when elapsed time reaches the limit. A countdown bar replaces the plain elapsed time when a limit is set. Live-region announcements are limited to the "not served" result so the countdown is not read out every second.
- Input is locked on an expired round the same way it is on a solved one, because the existing `state.solved` guards already apply.

## Testing

- Registry: every entry has `effect` and `why`; choice values validate; defaults; scoping of `autoStack`, `timerScore` and `timeLimit`.
- `setOption`: boolean and choice validation. Options survive `startGame`, `nextRound`, `startCashier`, `startGiveChange` and `nextGiveChangeCustomer`.
- Auto-stack: seeded rounds across many handfuls at both coin scales and in the normal and compact Give Change boxes. Assert no overlap between stacks, all coins present, and an unchanged scatter path when off.
- Scoring: `scoreFor` at 0, at the midpoint, at par, and beyond; running total across rounds; no points for Custom.
- Expiry: `expireRound` per mode, idempotence on a solved round, and `rounds` and `score` effects. The forced-on rule for Timer and Score.
- DOM: badges render with text and icon for each option; the choice row; the disabled Timer and Score checkbox; the timer and score display; the "not served" message.
- Contrast tests extended to the badges in both themes.
- **e2e:** untouched, and the paused CI job stays paused, until the owner asks for a comprehensive e2e pass.

## Out of scope

- Saving options, scores or best times between visits.
- A leaderboard, sessions that end after N unserved customers, or a summary screen.
- Auto-stacking the player's own change coins.
- Per-denomination difficulty tuning of par times beyond the three mode values.
- Timer, score or limit in Custom mode.
