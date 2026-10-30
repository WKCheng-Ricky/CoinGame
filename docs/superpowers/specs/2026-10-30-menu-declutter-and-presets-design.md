# Menu declutter, difficulty presets and option icons: Design Spec

Date: 2026-10-30
Builds on: `2026-10-30-menu-and-options-design.md`,
`2026-10-30-timing-stacking-and-option-clarity-design.md`

## Purpose

The home screen now lists six options with badges, reasons and a choice row, and has become
cluttered. Three changes:

1. **Collapse the options.** The full option list moves to its own Options screen, opened by an
   Options button at the top left of the home screen.
2. **Quick settings on the home screen.** Two shortcuts replace the old list: a Difficulty
   selector (Easy, Normal, Hard, Very hard) that sets the options, and an accessibility
   toggle that enlarges the coins.
3. **Option icons.** Each option has an icon. The home screen shows a chip (icon and text) for
   every option that is on; the Options screen shows the icon on every row.

## Decisions (from the owner)

- The Options button opens a **full Options screen** (same pattern as the Custom amount screen), not a panel or a drop-down.
- The Difficulty presets and what they set:

| Preset | Show Coins | Auto-stack | Short-paying | Timer and Score | Time Limit |
|---|---|---|---|---|---|
| Easy | on | on | off | off | Off |
| Normal | off | on | on | on | Off |
| Hard | off | off | on | on | 30 s |
| Very hard | off | off | on | on | 10 s |

- A preset sets exactly these five options and **never touches Large Coins**; Large Coins belongs to the accessibility button.
- Auto-stack is on for Easy and Normal and off for Hard and Very hard.
- A fresh visit is **Normal**, so one registry default changes: `timerScore` default **on** (was off). `autoStack` stays on, and `showCoins`, `largeCoins`, `shortPay` and `timeLimit` keep their defaults.
- The home screen shows a chip for **every option that is on** (for the selected mode), except Large Coins: the Larger coins toggle already shows that state, so a chip would repeat it.
- Icons: an hourglass for the time limit, an enlarge icon for Large Coins, and one icon per other option.
- E2E specs are not touched (paused CI job stays paused).

## Home screen (`index.html`, `src/home.js`, `styles.css`)

Top to bottom:

1. **Top bar:** an Options button at the top left (gear icon and the word "Options", at least 44 px tall) and the existing theme toggle at the top right.
2. Title and tagline, unchanged.
3. **Game:** the mode radio group, unchanged.
4. **Quick settings:**
   - **Difficulty:** a native radio group of four segments (Easy, Normal, Hard, Very hard), labelled "Difficulty". The segment matching the current options is selected. When the options match no preset, no segment is selected and a note reads "Custom settings".
   - **Larger coins:** a toggle button with the enlarge icon and the label "Larger coins", `aria-pressed` bound to the Large Coins option. Pressing it flips Large Coins. It is the same option as the Large Coins row on the Options screen, so the two always agree.
   - **Active options:** a list (`role="list"`, labelled "Options on") of chips, one per option in `optionsFor(mode)` that is on, except Large Coins (shown by the toggle above). A chip is the option's icon (decorative) and its short text. A choice option shows its chosen value when not Off (for example hourglass and "Limit 30 s"). No chips are drawn when none are on. The list follows the registry order.
5. **Play** button, unchanged.

The Options screen's changes re-render the home screen's selector, toggle and chips, because all of them read `state.options`.

## Options screen (`index.html`, `src/home.js`, `src/main.js`)

- A new screen `options` (added to `SCREENS`) with a heading "Options", a Back button that returns to the home screen, the options list, and the press-and-hold note paragraph (`#option-note`) that is moved here from the home screen.
- The list is the existing one: per row the icon, label, badge, reason, and the Time Limit radio group; the list is built from `optionsFor(state.mode)` using the mode selected on the home screen, and shows that mode's name in a small line under the heading ("Options for Cashier").
- The press-and-hold hint watcher attaches to this screen's list instead of the home list. Opening the screen focuses its heading; Back focuses the Options button.
- **Row layout (a fix to the shipped rows):** the icon, label and badge share one line. The label may shrink and wrap within its own space, and the badge stays on the right; it never drops onto its own line (long labels such as "Short-paying customers" and "Timer and Score" must keep the badge beside them at 320 px wide). The reason line sits under the label.
- **Time Limit choices:** the four choices (Off, 30 s, 20 s, 10 s) sit on one row, in four equal columns, at 320 px wide.
- Changing any option here may leave the options matching no preset; nothing else about the options logic changes.

## Presets (`src/options.js`, `src/state.js`)

- `PRESETS`: an ordered list of `{ id, label, values }` for `easy`, `normal`, `hard`, `veryHard`, where `values` is the table above (`showCoins`, `autoStack`, `shortPay`, `timerScore`, `timeLimit`).
- `presetOf(options) -> id | null`: the preset whose five values all equal the options' values, else null. Large Coins and options the preset does not set are ignored in the comparison. Timer and Score is compared as it takes effect: a time limit above 0 counts as on, so a hand-chosen limit on top of the other Hard values still matches Hard. (A limit chosen from Normal gives "Custom settings": Normal has Auto-stack on and Hard does not.)
- `applyPreset(state, id) -> state`: returns the state with those five options set (unknown id: state unchanged). It does not change `largeCoins`.
- `defaultOptions()` must equal `Normal` plus `largeCoins: false`. A test asserts `presetOf(defaultOptions()) === "normal"`.
- Presets apply regardless of the selected mode (options scoped to other modes are stored as today). Custom mode ignores the timer, score and limit values as before.
- A time limit still forces Timer and Score on (existing rule), so Hard and Very hard are consistent with their own `timerScore: true`.

## Icons (`src/icons.js`, new)

- `icon(name) -> SVGElement`: a 24-unit inline SVG, `aria-hidden="true"`, `focusable="false"`, drawn with `currentColor`, so it follows the theme.
- Names: `eye` (Show Coins), `enlarge` (Large Coins and the accessibility button), `layers` (Auto-stack), `coin-down` (Short-paying customers), `stopwatch` (Timer and Score), `hourglass` (Time Limit), `gear` (Options button).
- The badge arrows (easier, harder, neutral) move here from `home.js` so there is one icon module.
- Registry entries gain `icon` (a name above) and `chip` (the short chip text): Show Coins, Large Coins, Auto-stack, Short-paying, Timer, Limit. A choice option's chip is its `chip` text, a space and the chosen choice label ("Limit 30 s").
- Icons never carry meaning alone: the label, chip text or button text is always present.

## State and defaults

- `src/state.js` needs no new fields. Options already live in `state.options`.
- The changed registry default (`timerScore` on) flows through `createState()`.
- Existing tests that relied on Timer and Score being off set the option explicitly.

## Testing

- **Presets:** each preset's five values; `presetOf` for each preset, for a changed single option (null), and ignoring `largeCoins`; `applyPreset` leaves `largeCoins` alone and ignores unknown ids; `presetOf(defaultOptions()) === "normal"`.
- **Registry:** every option has a known icon name and a non-empty chip text; defaults.
- **Icons:** every name returns an `svg` with `aria-hidden="true"`; unknown name throws.
- **DOM (home):** four difficulty radios with the right one checked for each preset and none (plus the "Custom settings" note) when custom; selecting a segment reports the preset id; the Larger coins toggle's `aria-pressed` follows Large Coins and pressing it reports the toggle; chips match the options that are on for the selected mode, including the "30 s" chip and none when nothing is on.
- **DOM (options screen):** the list is built for the selected mode, the Time Limit group still works, Back returns home.
- Existing home and state tests are updated for the new defaults and layout.
- **Manual check** (not automated): at 360 by 640 nothing on the home screen is clipped and Play is reachable (the screen may scroll; the prototype showed it cannot fit without scrolling), and the Options screen opens and returns with focus on the Options button. At 320 px wide the Options rows keep every badge beside its label and the Time Limit choices on one row.
- **e2e:** untouched, and the paused CI job stays paused, until the owner asks for a comprehensive e2e pass.

## Out of scope

- Saving options or the preset between visits.
- A "Reset to Normal" button or per-mode presets.
- Animations for the screen change.
- Changing what any option does, or the badge classifications.
