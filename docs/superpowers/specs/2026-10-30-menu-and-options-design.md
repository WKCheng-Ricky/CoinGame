# Main menu and options: Design Spec

Date: 2026-10-30
Builds on: `2026-10-27-inspect-to-reveal-design.md`,
`2026-10-29-give-change-mode-design.md`

## Purpose

Restructure the home screen so it can grow. Two changes:

1. **Difficulty becomes options.** "Normal / Easy" is replaced by a list of named
   checkboxes. Today's Easy is really "show the coins", so the first option is
   **Show Coins**; leaving it off is the challenge. Options are either global (every
   mode) or specific to one or more modes, so a mode can carry its own challenge
   settings. Timer and Score are planned later; the design reserves their place but
   does not build them.
2. **Pick a mode, then Play.** The home screen selects a game mode (each with a
   short description), then a single Play button starts it.

## Requirements

### Home screen (top to bottom)

- Title and tagline unchanged.
- **Game**: a single-choice group of four full-width rows (Endless, Custom, Cashier,
  Give Change). Each row has the mode name and a description of at most 4 words,
  sized for a phone-width screen. The selected row is highlighted.
  - Endless: "Random amounts, nonstop"
  - Custom: "Choose your own amount"
  - Cashier: "Count the customer's coins"
  - Give Change: "Work out the change"
- **Options**: a checkbox list. Global options come first, then the options for the
  selected mode. The list re-renders when the selected mode changes. A mode with no
  own options adds nothing.
- **Play**: one full-width button at the bottom. It starts the selected mode with the
  handlers that exist today. For Custom it opens the amount screen, as the Custom
  button does now.
- The press-and-hold hint (dwell) that explains an item without selecting it moves
  from the difficulty labels to the option labels. Its text is each option's `hint`.
- Accessibility: the mode group is a native radio group, options are native
  checkboxes, descriptions are linked with `aria-describedby`, Play is a normal
  button.

### Options

| id | Label | Scope | Default | Effect |
|---|---|---|---|---|
| `showCoins` | Show Coins | all modes | off | Reveals every coin's value and the running total. Off hides both (today's Normal). |
| `shortPay` | Short-paying customers | `give-change` | on | On: ~25% of customers underpay and the "Not enough!" button is shown. Off: no underpaying customers and no "Not enough!" button. |

- The running total is tied to Show Coins because a visible total gives away hidden
  values.
- Defaults reproduce today's default play (Normal): coins hidden, underpaying
  customers on.
- Options are not saved between visits (difficulty is not saved today).
- Timer and Score are future global options. They get no placeholder UI; the
  registry is the reserved place and the Options list simply gains rows.

## Design

### Options registry (`src/options.js`, new)

A declarative list. Each entry: `id`, `label`, `hint` (press-and-hold text), `scope`
(`"all"` or an array of mode ids), `default`.

- `defaultOptions()` returns a map of id to default value.
- `optionsFor(mode)` returns the global entries followed by those scoped to `mode`.
- Adding an option is one registry entry plus the logic that reads it.

### State (`src/state.js`)

- `state.difficulty` is replaced by `state.options`, a map of id to boolean.
- `setDifficulty` becomes `setOption(state, id, value)`; unknown ids and non-boolean
  values are ignored (state returned unchanged).
- New `selectMode(state, mode)` records the home-screen selection in `state.mode`
  (unknown modes ignored).
- Every `start*` and `next*` function carries `options` over, replacing the
  `difficulty: state.difficulty` spreads. Options for a mode that is not being played
  are kept, so toggling and switching modes does not reset them.

### Config (`src/config.js`)

`GIVE_CHANGE_ODDS` (keyed by difficulty) becomes `giveChangeOdds(options)`:
`{ underpaid: options.shortPay ? 0.25 : 0, exactShare: 1 / 3 }`.

### Play screen (`src/main.js`, `styles.css`, `src/drag.js`)

- `data-difficulty` becomes `data-show-coins` (`"true"` / `"false"`) on the play
  screen and on `<body>` (the tray drag ghost relies on the body copy). The CSS
  rules for `.coin-label` and `.revealed .coin-label` follow; the comment in
  `drag.js` is updated.
- The play total is hidden unless Show Coins is on. The change total is hidden
  unless Give Change and Show Coins are on.
- "Not enough!" is shown only in Give Change with `shortPay` on.

### Home screen (`index.html`, `src/main.js`, `styles.css`)

- The four mode buttons and the Difficulty fieldset become the radio group, the
  options container and the Play button.
- The options list is rendered from the registry and re-rendered on mode change.
- Play dispatches to the existing start handlers by selected mode.

## Testing

- Registry unit tests: scopes, defaults, ordering (global before mode-specific).
- `setOption` ignores unknown ids and non-boolean values; `selectMode` ignores
  unknown modes; options survive `startGame`, `nextRound`, `startCashier`,
  `startGiveChange` and `nextGiveChangeCustomer`.
- `giveChangeOdds` for `shortPay` on and off.
- DOM tests: the options list changes with the selected mode; toggling an option
  updates state; Play starts the selected mode.
- Existing state and config tests that use `difficulty` are updated.
- **e2e:** the existing specs still reference the old difficulty radios and mode
  buttons. They are left untouched, and the paused CI job stays paused, until the
  owner asks for a comprehensive e2e pass.

## Out of scope

- Timer and Score themselves, and any placeholder UI for them.
- Saving options between visits.
- Changes to game rules, coin visuals or the play screen layout.
