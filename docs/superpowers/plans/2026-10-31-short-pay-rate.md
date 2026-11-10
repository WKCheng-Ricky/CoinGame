# Selectable Short-Pay Rate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn "Short-paying customers" from an on/off checkbox into a choice (Off, 1%, 5%, 10%, 25%) that sets the real chance a Give Change customer underpays, defaulting to 5%.

**Architecture:** `shortPay` becomes a choice option like `timeLimit` in the option registry (`src/options.js`), its value is the whole-number percentage (`0` is Off), `giveChangeOdds` divides it by 100, and the Options screen's radio group takes its column count from the number of choices. Everything else (chips, presets, the "Custom settings" note, the leaderboard ranking rule) already reads the registry and follows.

**Tech Stack:** Plain HTML, CSS and ES modules; `node --test` with jsdom.

**Spec:** `docs/superpowers/specs/2026-10-31-short-pay-rate-design.md`

## Global Constraints

- Choices, in this order: **Off (0), 1%, 5%, 10%, 25%**; default **5**.
- Presets: **Easy `shortPay: 0`; Normal, Hard and Very hard `shortPay: 5`**.
- Odds: `giveChangeOdds(options).underpaid === options.shortPay / 100`; `exactShare` stays `1 / 3`.
- Any rate other than a preset's matches no preset ("Custom settings"), so such a session is not ranked on the leaderboard (intended).
- Options are not persisted, so no migration. Do not edit `e2e/` (paused; owner's instruction).
- Commit messages use Conventional Commits and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Run the unit suite with `npm test`.

## Review Focus

- `giveChangeOdds` with `shortPay` missing or `0` must give `underpaid: 0`, never `NaN`; pinned in Task 1.
- Picking 10% or 25% must make `presetOf` return `null` (and so show "Custom settings"); pinned in Task 1.
- Five radios must fit on one row at 320 px without wrapping or sideways scroll, while the Time Limit row stays four equal columns; pinned in Task 2 (CSS test) and checked by eye.
- "Not enough!" is hidden when Off and shown for every rate above 0; checked by eye in Task 2.
- No leftover boolean use of `shortPay` anywhere (`true`/`false` in code, tests or docs); pinned by the grep in Task 1.

---

## File Structure

- Modify `src/options.js`, `src/config.js`, `src/home.js`, `src/main.js` (one line), `styles.css`, `README.md`.
- Modify tests: `tests/options.test.js`, `tests/config.test.js`, `tests/state.test.js`, `tests/home.dom.test.js`, `tests/home-css.test.js`, `tests/game.test.js`.

---

### Task 1: Short-pay as a percentage choice

**Files:**
- Modify: `src/options.js` (the `shortPay` entry and `PRESETS`), `src/config.js:41-44`, `tests/options.test.js`, `tests/config.test.js`, `tests/state.test.js`, `tests/home.dom.test.js`, `tests/game.test.js`

**Interfaces:**
- Produces: option `shortPay` with `default: 5` and `choices: [{ value: 0, label: "Off" }, { value: 1, label: "1%" }, { value: 5, label: "5%" }, { value: 10, label: "10%" }, { value: 25, label: "25%" }]`; `PRESETS` values `shortPay: 0` (easy) and `shortPay: 5` (normal, hard, veryHard); `giveChangeOdds(options) -> { underpaid: number, exactShare: number }` with `underpaid = (options.shortPay ?? 0) / 100`.

- [ ] **Step 1: Update the tests first (they are the failing tests).** Every place that treats `shortPay` as a boolean becomes a number, and add the new assertions:
  - `tests/options.test.js`: `defaultOptions()` has `shortPay: 5`; the preset table (`VALUES` near line 84) uses `0` for easy and `5` for the others; `presetOf({ ...VALUES.normal, shortPay: 0 })` is `null` (replaces the `false` case at line 110); new tests: `shortPay is a choice option with the five percentages and default 5` (assert the `choices` values `[0, 1, 5, 10, 25]` and labels `["Off", "1%", "5%", "10%", "25%"]`); `isValidValue("shortPay", ...)` is true for `0, 1, 5, 10, 25` and false for `true`, `false`, `7` and `"5"`; `presetOf` returns `"normal"` for the normal values, `"easy"` for the easy values, and `null` when `shortPay` is `10` or `25` or `1`.
  - `tests/config.test.js`: replace the two boolean tests with `giveChangeOdds maps each choice to its percentage` asserting `underpaid` is `0`, `0.01`, `0.05`, `0.1`, `0.25` for `shortPay` `0, 1, 5, 10, 25` (with `exactShare` `1 / 3`), and `giveChangeOdds gives 0 when shortPay is missing` for `{}`.
  - `tests/state.test.js`: the options literal at line 32 uses `shortPay: 5`; lines 191-193 use `setOption(createState(), "shortPay", 0)` and assert `.options.shortPay === 0`.
  - `tests/game.test.js` (near `rollScenario` at line 649): add `rollScenario underpays only when the first draw is below the 5% odds`: with odds `{ underpaid: 0.05, exactShare: 1 / 3 }`, draw `0.049` gives `"under"` and draws `[0.05, 0.1]` give `"exact"`.
  - `tests/home.dom.test.js`: `OPTS` (line 7) uses `shortPay: 5`; `HARD` (line 154) `shortPay: 5`; the `false` literals at lines 67, 69, 172, 211 become `0`; the give-change checkbox list at line 62 loses `"shortPay"` (it is no longer a checkbox); tests that count or read `radios(document)` for `give-change` must expect the five short-pay radios (`["0","1","5","10","25"]`, name `opt-shortPay`) ahead of the Time Limit ones, and the existing Time Limit assertions must select by `[name="opt-timeLimit"]`. Add: `the Short-paying row is a labelled radio group with five choices and 5% checked by default` and `the chip reads "Short-paying 5%" by default, disappears when Off, and reads "Short-paying 25%" with no preset selected (Custom settings) at 25%` (use `home.update("give-change", ...)`).
- [ ] **Step 2: Run** `npm test`. Expected: the new and updated tests FAIL (registry still boolean) while unrelated tests pass.
- [ ] **Step 3: Implement.** In `src/options.js` replace the `shortPay` entry with the spec's, keeping its `id`, `label`, `icon`, `chip`, `hint`, `effect`, `why` and `scope: ["give-change"]` and adding `default: 5` and the `choices` above; set the `PRESETS` values as in Interfaces. In `src/config.js` change `giveChangeOdds` to `{ underpaid: (options.shortPay ?? 0) / 100, exactShare: 1 / 3 }` and update the comment above it to say `shortPay` is the percentage chance.
- [ ] **Step 4: Run** `npm test`, then `grep -rn "shortPay" src tests index.html | grep -n "true\|false"`. Expected: PASS, and the grep prints nothing (no boolean `shortPay` left).
- [ ] **Step 5: Commit**

```bash
git add src/options.js src/config.js tests/options.test.js tests/config.test.js tests/state.test.js tests/home.dom.test.js tests/game.test.js
git commit -m "feat: make short-paying a selectable percentage with a 5% default"
```

---

### Task 2: Five-choice row, button check and docs

**Files:**
- Modify: `src/home.js` (`choiceRows`), `src/main.js:230`, `styles.css:292`, `README.md` (lines 12, 27, 50), `tests/home-css.test.js`, `tests/home.dom.test.js`

**Interfaces:**
- Consumes: the `shortPay` choice option from Task 1.
- Produces: each choice radio group sets a CSS custom property `--cols` equal to its number of choices; `.options .radios` uses `repeat(var(--cols, 4), 1fr)`.

- [ ] **Step 1: Write the failing tests.** `tests/home.dom.test.js`: `each choice group sets --cols to its number of choices` (`group.style.getPropertyValue("--cols")` is `"5"` for Short-paying and `"4"` for Time Limit). `tests/home-css.test.js`: change the existing assertion `grid-template-columns:\s*repeat\(4` for `.options .radios` to `/grid-template-columns:\s*repeat\(var\(--cols,\s*4\),\s*1fr\)/`.
- [ ] **Step 2: Run** `node --test tests/home.dom.test.js tests/home-css.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `src/home.js` `choiceRows`, after creating `group`, `group.style.setProperty("--cols", String(o.choices.length));`. In `styles.css` change `.options .radios` to `grid-template-columns: repeat(var(--cols, 4), 1fr);` (keep the rest of the rule). In `src/main.js:230` write the explicit comparison: `$("btn-short").hidden = !giveChange || state.options.shortPay <= 0;`.
- [ ] **Step 4: Update `README.md`:** line 12 keeps "Give Change's **Short-paying customers**" and adds that it is a chance you can set (Off, 1%, 5%, 10%, 25%; 5% by default); line 27 replaces "(with **Short-paying customers** on, the default)" with "(**Short-paying customers**, 5% by default, sets how often; Off means nobody underpays)"; line 50 replaces "turning off Short-paying customers means nobody underpays" with "setting Short-paying customers to Off means nobody underpays".
- [ ] **Step 5: Run** `npm test` and `npm run test:coverage`. Expected: PASS.
- [ ] **Step 6: Check by eye in a browser** with a throwaway Playwright script outside the repo against `python3 -m http.server`: at 320 px open Options in Give Change; the five Short-paying choices ("Off", "1%", "5%", "10%", "25%") must each fit on one line with no sideways scroll (read `scrollWidth` vs `clientWidth` of the Options screen) and the Time Limit row must still read as four equal columns. If a choice wraps or overflows, tighten only `.options .radios label` (smaller gap or stacking the radio above its text) until it fits, keeping the CSS rule style (one rule per line at the left edge). Then play Give Change: with 5% selected "Not enough!" is shown; with Off it is hidden; choosing 25% on the home screen shows "Custom settings" and the chip "Short-paying 25%". Read the screenshots.
- [ ] **Step 7: Commit**

```bash
git add src/home.js src/main.js styles.css README.md tests/home.dom.test.js tests/home-css.test.js
git commit -m "feat: lay out the five short-pay choices and document the rate"
```

---

## Self-Review

- **Spec coverage:** registry entry, default 5, five choices (Task 1); presets table (Task 1); `giveChangeOdds` percentage (Task 1); play-screen button comparison, column count following the choice count, chip text, "Custom settings" at non-preset rates (Tasks 1-2); README (Task 2); the spec's `rollScenario` odds test (Task 1); manual check (Task 2 Step 6).
- **Names:** `--cols`, `shortPay` values and `giveChangeOdds` signature are defined in Tasks 1-2 and used only there.
- **Dependency:** none on plans A to C beyond the repository state; plan C's leaderboard already ranks only preset-matching sessions, so a non-5% rate is unranked as the spec intends.
