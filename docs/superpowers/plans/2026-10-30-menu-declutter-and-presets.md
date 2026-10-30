# Menu Declutter, Presets and Option Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the option list to its own Options screen, add a Difficulty selector (Easy, Normal, Hard, Very hard) and a Larger coins toggle to the home screen, and show an icon on every option plus a chip for every option that is on.

**Architecture:** Presets and `presetOf` live in `src/options.js` next to the registry; a new `src/icons.js` draws every icon as inline SVG; `src/home.js` renders the home quick settings and the option rows from `state.options`; `src/main.js` adds the `options` screen and wires the new handlers. No new state fields. Builds on the timing branch (`feature/timing-stacking-option-clarity`).

**Tech Stack:** Vanilla ES modules, `node --test` with jsdom for DOM tests. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-menu-declutter-and-presets-design.md`. A throwaway clickable prototype the owner approved is at `.superpowers/prototype/index.html` (git-ignored); copy its look, not its code.

## Global Constraints

- Presets (set exactly `showCoins`, `autoStack`, `shortPay`, `timerScore`, `timeLimit`; never `largeCoins`): Easy `{ true, true, false, false, 0 }`, Normal `{ false, true, true, true, 0 }`, Hard `{ false, false, true, true, 30 }`, Very hard `{ false, false, true, true, 10 }`, in that order, in the field order given above.
- Registry defaults become Normal plus `largeCoins: false`: `timerScore` default **true** (was false); `autoStack` stays **true**.
- `presetOf` compares Timer and Score as it takes effect (a limit above 0 counts as on).
- Icon names: `eye`, `enlarge`, `layers`, `coin-down`, `stopwatch`, `hourglass`, `gear`, plus badge arrows `easier`, `harder`, `neutral`. Every icon is `aria-hidden="true"`, `focusable="false"`, drawn in `currentColor`; text always accompanies it.
- Option chips and icons: Show Coins `eye` "Show Coins"; Large Coins `enlarge` "Large Coins" (never shown as a chip); Auto-stack `layers` "Auto-stack"; Short-paying customers `coin-down` "Short-paying"; Timer and Score `stopwatch` "Timer"; Time Limit `hourglass` "Limit" (chip text is "Limit 30 s").
- Chips list: `role="list"` labelled "Options on", registry order, only options in `optionsFor(mode)` that are on, never Large Coins; empty shows the text "No options on".
- Home copy: Difficulty group label "Difficulty", note "Custom settings" when no preset matches, toggle label "Larger coins" with state text "On" / "Off", Options button text "Options", Options screen heading "Options" and sub-line "Options for <mode label>", Back button text "Back".
- Option rows: icon, label and badge share a line; the label shrinks and wraps, the badge never drops to its own line; the four Time Limit choices share one row of four equal columns at 320 px wide.
- Options are not saved between visits. No e2e changes. Conventional commits ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Switching from Easy to a limit of 30 by hand (stored `timerScore` false): the selector must still show a sensible preset or "Custom settings", never throw, and the Timer and Score checkbox is forced on and disabled as before.
- Pressing Larger coins must stay in step with the Large Coins checkbox on the Options screen (one option, two controls), including after a preset is applied.
- Back from the Options screen must put focus on the Options button, and the press-and-hold hint text must clear when the screen is left.
- A new default game is Normal: Timer and Score on in Endless, Cashier and Give Change, never in Custom (existing rule); existing tests that assumed the old defaults must set their options explicitly.
- The Options button and the theme toggle must not overlap or push the title at 320 px wide.

---

### Task 1: Presets and the new defaults

**Files:**
- Modify: `src/options.js`, `tests/options.test.js`, `tests/state.test.js`, `tests/home.dom.test.js`

**Interfaces:**
- Produces: `PRESETS: Array<{ id: "easy" | "normal" | "hard" | "veryHard", label: string, values: { showCoins: boolean, autoStack: boolean, shortPay: boolean, timerScore: boolean, timeLimit: number } }>`; `presetOf(options: object) -> string | null`; `applyPreset(state: object, id: string) -> object` exported from `src/state.js` (it calls `setOption` per value and returns the same state for an unknown id).
- Defaults: `defaultOptions()` is `{ showCoins: false, largeCoins: false, autoStack: true, shortPay: true, timerScore: true, timeLimit: 0 }`.

- [ ] **Step 1: Write failing tests.** `options.test.js`: `defaultOptions()` deep-equals the object above; `PRESETS` ids/labels are `easy/Easy`, `normal/Normal`, `hard/Hard`, `veryHard/Very hard`; each preset's `values` equal the Global Constraints table; `presetOf(defaultOptions()) === "normal"`; `presetOf` of each preset's values is that id; flipping any single one of the five values gives `null`; `largeCoins: true` does not change the result; `presetOf({ ...hardValues, timerScore: false })` is `"hard"` (a limit counts as the timer on). `state.test.js`: `applyPreset(createState(), "hard")` has the Hard values and `largeCoins` unchanged (test with `largeCoins: true` first); `applyPreset(s, "nope") === s`; `presetOf(applyPreset(s, id).options) === id` for all four. Update existing tests that depended on the old defaults: the `createState` shape, the options and home lists' `OPTS` objects. Tests that relied on Timer and Score being off use an explicit untimed state.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL (new names missing, defaults differ).
- [ ] **Step 3: Implement** `PRESETS` and `presetOf` in `src/options.js`, flip the two registry `default` values, and add `applyPreset` to `src/state.js` (importing `PRESETS`).
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `src/options.js src/state.js tests` as `feat: add difficulty presets and make Normal the default`.

### Task 2: The icon module and registry icons

**Files:**
- Create: `src/icons.js`, `tests/icons.test.js`
- Modify: `src/options.js`, `src/home.js` (badge only), `tests/options.test.js`

**Interfaces:**
- Produces: `icon(name: string, size?: number) -> SVGElement` (default size 24; `viewBox="0 0 24 24"`, `class="ico"`; throws `Error` for an unknown name); `ICON_NAMES: string[]` (the eleven names in Global Constraints); `badge(effect: "easier" | "harder" | "neutral") -> HTMLElement` (the `<span class="badge badge-<effect>">` with the arrow icon and the capitalised word) moved here from `src/home.js`, which imports it.
- Registry entries gain `icon` (an `ICON_NAMES` member) and `chip` (string) per the Global Constraints.

- [ ] **Step 1: Write failing tests.** `icons.test.js` (jsdom via `installDom`): every name in `ICON_NAMES` returns an `svg` with `aria-hidden="true"`, `focusable="false"`, a `viewBox` of `0 0 24 24` and at least one child; `icon("eye", 14)` has width `14`; `icon("nope")` throws; `badge("harder")` has classes `badge badge-harder`, text `Harder` and one icon. `options.test.js`: every option has an `icon` in `ICON_NAMES` and a non-empty `chip`; the icon and chip per option match the Global Constraints.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `src/icons.js` (stroke-style paths for the seven option and button icons, filled arrows for the three badge icons; build with `createElementNS`) and add `icon` and `chip` to the six registry entries; replace the local `badge` in `home.js` with the import.
- [ ] **Step 4: Run** `npm test`. Expected: all pass, including the existing badge tests in `home.dom.test.js`.
- [ ] **Step 5: Commit** `src tests` as `feat: add the icon module and an icon for every option`.

### Task 3: Home quick settings, chips and row icons

**Files:**
- Modify: `src/home.js`, `styles.css`, `tests/home.dom.test.js`, `tests/home-css.test.js`

**Interfaces:**
- Consumes: `PRESETS`, `presetOf`, `optionsFor`, `isForcedOn`, `timerOn` (options), `icon`, `badge` (icons).
- Produces: `mountHome(els, handlers)` where `els = { modes, presets, large, chips, options, optionsFor, play }` (elements: the mode group, the Difficulty group, the Larger coins `<button>`, the chips `<ul>`, the option list, the "Options for" line, the Play button) and `handlers = { onMode(id), onOption(id, value), onPreset(id), onPlay(mode) }`. `update(mode, options)` redraws everything. The Larger coins button calls `onOption("largeCoins", !currentValue)`.
- Rendering: Difficulty is a radio group `name="preset"` of four labels (`aria-labelledby`/`aria-label` "Difficulty") with the matching one checked (none when `presetOf` is null, and the `els.presets` sibling note element with id `preset-note` showing "Custom settings"; the note element is `els.presets.nextElementSibling`). Each option row gets its `icon(o.icon, 18)` before the label text, the badge and reason unchanged.

- [ ] **Step 1: Write failing tests in `home.dom.test.js`** (extend `withHome` to build all seven elements with a note `<p>` after the presets group; update `OPTS` to the new defaults):
  - four preset radios in order, `Easy..Very hard`, the Normal one checked for defaults; for `applyPreset`-style option objects the right one is checked; with one option changed none is checked and the note reads `Custom settings`; the note is empty otherwise.
  - changing a preset radio calls `onPreset("hard")`.
  - the Larger coins button has `aria-pressed` `"false"`/`"true"` following `largeCoins`, its state text is `Off`/`On`, and a click calls `onOption("largeCoins", true)` (then `false` once updated to on).
  - chips for Cashier with Normal defaults are exactly `["Auto-stack", "Timer"]`; with the Hard values and `showCoins` they are `["Show Coins", "Timer", "Limit 30 s"]` (registry order); with `largeCoins: true` there is still no Large Coins chip; in Give Change the Normal chips are `["Auto-stack", "Short-paying", "Timer"]`; with nothing on the list shows one item `No options on`; the list has `role="list"` and an `aria-label` of `Options on`; chip icons are `aria-hidden`.
  - each option row contains an `svg.ico`; `els.optionsFor` reads `Options for Cashier` after `update("cashier", ...)`.
  - Update the existing tests whose expectations changed (lists, hints, badges) and keep the focus-preservation and choice-group tests.
  - `home-css.test.js`: `.options label` has `flex-wrap: nowrap`, `.options .opt-text` has `min-width: 0`, `.options .badge` has `flex: none`, and `.options .radios` is a four-column grid (`repeat(4`).
- [ ] **Step 2: Run** `node --test tests/home.dom.test.js tests/home-css.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the new `mountHome` rendering in `src/home.js`. The preset group and the chips are redrawn on every `update`; the option list is still rebuilt only when the mode changes (so a focused checkbox keeps focus), but its icon-bearing rows keep the same dwell-hint `title`s.
- [ ] **Step 4: Implement the styles** in `styles.css`: `.seg` (four-column grid of 44 px segments, selected = accent border and tint, focus-visible outline, like `.mode`), `.big-toggle` (the Larger coins button, pressed = accent border and tint), `.chips` (wrapping row of pill chips), the Options button and the existing theme toggle on one top row (`.options-btn` absolutely positioned at the top left, 44 px tall, matching the theme toggle), and the row fixes: `.options label` no longer wraps, `.options .opt-text` is `flex: 1 1 0; min-width: 0`, `.options .badge` is `flex: none`, `.options .radios` is `display: grid; grid-template-columns: repeat(4, 1fr)` with labels at `min-width: 0`.
- [ ] **Step 5: Run** `npm test`. Expected: all pass.
- [ ] **Step 6: Commit** `src/home.js styles.css tests` as `feat: add the home quick settings, option chips and row icons`.

### Task 4: The Options screen and navigation

**Files:**
- Modify: `index.html`, `src/main.js`
- Test: by running the app (see Step 4); any pure helper added gets a unit test.

**Interfaces:**
- Consumes: `mountHome` (Task 3), `applyPreset` (Task 1), `icon("gear")` (Task 2).
- Produces: `<button id="btn-options" class="options-btn">` (gear icon and the text "Options") inside `#screen-home`, and `<section id="screen-options" hidden>` with `<button id="options-back">`, `<h1 tabindex="-1">Options</h1>`, `<p id="options-for">`, the existing `#options` list and `#option-note` moved into it; the home screen gains `#presets` (+ `<p id="preset-note">` right after it), `#btn-large` and `#chips`, in the order Game, Quick settings (Difficulty, Larger coins, chips), Play.

- [ ] **Step 1: Update `index.html`** as described; add `<h2 class="sec">Quick settings</h2>` above the Difficulty group; render the gear icon with `icon("gear", 18)` from `main.js` (not hard-coded markup).
- [ ] **Step 2: Update `src/main.js`:** `SCREENS = ["home", "custom", "options", "play"]`; pass the new `els` and `onPreset: (id) => update(applyPreset(state, id))` to `mountHome`; `#btn-options` click shows the `options` screen; `#options-back` click calls `optionNotes.cancelAll()`, shows `home` and focuses `#btn-options`; `showScreen("options")` focuses the Options heading (the existing `showScreen` already does).
- [ ] **Step 3: Run** `npm test` and `npm run test:coverage`. Expected: pass, thresholds hold.
- [ ] **Step 4: Run the app** (`npm start`) and check by hand, then report plainly that it was checked by hand: (a) the Options button opens the screen and Back returns with focus on the Options button; (b) Easy, Normal, Hard and Very hard change the chips and the options as the Global Constraints table says, and changing one option on the Options screen clears the selector and shows "Custom settings"; (c) Larger coins toggles and the Large Coins checkbox agrees, and a game then draws large coins; (d) at 360 by 640 nothing is clipped and Play is reachable; at 320 wide every badge stays beside its label and the Time Limit choices share one row; (e) a default Normal game in Cashier shows the clock, and Hard counts down from 30 s.
- [ ] **Step 5: Commit** `index.html src/main.js` as `feat: move the options to their own screen behind an Options button`.
