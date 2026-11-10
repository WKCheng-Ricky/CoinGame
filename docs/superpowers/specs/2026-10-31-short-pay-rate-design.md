# Selectable short-pay rate: Design Spec

Date: 2026-10-31
Source: owner feedback in `docs/coin_game_comment/coin game.md` (line 13)
Builds on: `2026-10-30-menu-declutter-and-presets-design.md` (presets, option registry)
Part of four specs from the same feedback: `branding-and-home-chrome` (A), `play-screen-fixes` (B), `end-round-and-leaderboard` (C), this one (D).

## Purpose

In Give Change mode a customer underpays with a fixed 25% chance, which gave the owner 4 or 5 short-paying customers in a row. Make the chance selectable and lower the default.

## Decisions (from the owner)

- Choices: **Off, 1%, 5%, 10%, 25%**.
- The default is **5%**.
- Presets: **Easy: Off. Normal, Hard and Very hard: 5%.** Difficulty still comes from the timer, time limit and the other options.
- Why 5% for Normal, Hard and Very hard: a run of short-paying customers lets a player rack up points, which is unfair on the leaderboard. Short-paying should be an occasional surprise, not a challenge. A higher rate is, in the owner's eyes, actually a little easier (more easy points), so it is not a difficulty step.
- **Ranking:** because 5% is part of Normal, Hard and Very hard, picking any other rate (1%, 10% or 25%) makes the options match no preset ("Custom settings"). Such a session is **not ranked** on the leaderboard (see the end-round-and-leaderboard spec). This is intended.
- Off is the old unticked state of the checkbox, kept as a choice: customers never short-pay. Easy uses it.
- E2E specs are not touched (paused CI job stays paused).

## Change

`shortPay` becomes a choice option, like `timeLimit`, instead of an on/off checkbox.

### Option registry (`src/options.js`)

```js
{
  id: "shortPay", label: "Short-paying customers", icon: "coin-down", chip: "Short-paying",
  hint: "Customers may not pay enough", effect: "harder",
  why: "Harder: customers may not pay enough", scope: ["give-change"], default: 5,
  choices: [{ value: 0, label: "Off" }, { value: 1, label: "1%" }, { value: 5, label: "5%" }, { value: 10, label: "10%" }, { value: 25, label: "25%" }],
},
```

- The value is the whole-number percentage chance; `0` is Off. `isValidValue` already accepts a choice option's values, so a bad value is rejected as before.
- Presets (`PRESETS`): `shortPay` is `0` for Easy and `5` for Normal, Hard and Very hard. `presetOf` compares `effective[key] === value`, so numbers work unchanged.

### Odds (`src/config.js`)

`giveChangeOdds(options)` returns `underpaid: options.shortPay / 100` (so `0` gives 0, `5` gives 0.05). The comment above it is updated. `exactShare` is unchanged.

### UI

- **Play screen** (`src/main.js`): the "Not enough!" button is shown when `options.shortPay > 0` (it is currently shown when the option is truthy, which `0` already makes false, but the check is written as an explicit comparison to match the new type).
- **Options screen** (`src/home.js`): a choice option already renders as a radio group (as Time Limit does). The row for Short-paying customers shows five choices. Time Limit's row uses four equal columns; with five, the group uses five equal columns, and each choice text ("Off", "1%", "5%", "10%", "25%") fits in 320 px. Make the column count follow the number of choices instead of the fixed four.
- **Home chips**: the chip shows the chosen value when it is not Off, for example "Short-paying 5%", the same way the time limit shows "Limit 30 s". When Off, no chip.
- **Press-and-hold hint** and other text that mention this option read from the registry, so they follow automatically.

### Persistence

Options are not persisted (only the theme is), so there is no stored data to migrate. A fresh visit gets the Normal preset with short-paying at 5%.

## Testing

- `tests/options.test.js`: `shortPay` has the five choices and the default `5`; `isValidValue("shortPay", 5)` is true and `true` or `7` are false; `presetOf` matches Normal at 5 and Easy at 0, and returns `null` at 10 (a custom setting); presets set the values in the table above.
- `tests/config.test.js`: `giveChangeOdds` returns `0`, `0.01`, `0.05`, `0.1` and `0.25` for the five choices.
- `tests/home.dom.test.js`: the Short-paying row renders five radios, the chip reads "Short-paying 5%" by default and disappears when Off, and choosing 25% updates the chip and the Difficulty selector (no preset selected, "Custom settings").
- `tests/game.test.js` / `tests/state.test.js`: with `underpaid` 0.05, a fixed random sequence gives an underpaying customer only when the draw is below 0.05 (this exercises the existing `rollScenario`).
- Manual: at 5% over about 100 customers expect around five to underpay.

## Out of scope

- Changing `exactShare` or how much a customer is short by.
- Remembering options between visits.
- E2E specs.
