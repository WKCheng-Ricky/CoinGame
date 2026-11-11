# Repository cleanup: layered `src/`, slim docs, happy-path e2e

Date: 2026-11-10
Status: draft for review

## Goal

Make the repository easier to read and maintain without changing how the game plays:

1. Replace the flat `src/` (19 files, several mixing responsibilities) with a layered layout that uses standard names.
2. Make `README.md` a short, human-readable page (under 300 words) and move technical detail into `CLAUDE.md` and `docs/`.
3. Re-enable e2e as a small happy-path suite that gates deploy, instead of a comprehensive suite with a coverage gate.

## Non-goals

- No gameplay, visual or behaviour changes.
- No splitting of `src/main.js` (702 lines, one closure over shared state). It moves to a follow-up once the layers exist.
- No CSS restructuring.
- No change to the 80% per-file unit coverage gate.

## 1. `src/` restructure

### Layers

Structure follows MVC naming. MVVM was rejected because it needs a data-binding layer that a framework-free app lacks. The code is already `(state, event) -> next state` plus `render()`, which maps onto models, views and controllers.

```
src/
├─ main.js              entry point; wires everything together (stays at the root: index.html loads it)
├─ constants/
│  ├─ coins.js          coin data                                   (was coins.js)
│  ├─ modes.js          MODES                                       (was inside home.js)
│  ├─ options.js        OPTIONS, PRESETS, option validation         (was options.js)
│  └─ timing.js         dwell / hold / advance defaults, unserved delay, coin scale
│                       (was config.js constants, DWELL_MS in dwell.js, DETACH_HOLD_MS in drag.js, ADVANCE_DELAY_MS in state.js)
├─ models/              pure logic, no DOM, no storage
│  ├─ money.js          formatPence, parseAmount, total, check, checkAnswer, randomTarget   (from game.js)
│  ├─ customer.js       rollScenario, priceFor, changeDue, judgeAnswer, randomHandful         (from game.js)
│  ├─ pile.js           pile sizing, placement, stacking, settling, layout                    (from game.js)
│  ├─ game-state.js     rounds, modes, pile edits, check/answer submission                    (from state.js)
│  └─ session.js        timer, par, score, exit prompts, end-session, clock pause/resume      (timer.js + session parts of state.js)
├─ services/            browser side effects
│  ├─ storage.js        getStorage                                  (from theme.js)
│  ├─ theme.js          read / save / apply / cycle theme
│  ├─ scores.js         leaderboard store, board ids, rank text
│  └─ url-params.js     timingFromSearch, giveChangeOdds            (from config.js)
├─ views/               builds and updates DOM / SVG
│  ├─ coin-svg.js       coin drawing                                (from render.js)
│  ├─ pile-view.js      pile / tray rendering, stack badges, announce (from render.js)
│  ├─ icons.js
│  ├─ choice-dialog.js  generic modal "ask a question" helper       (was confirm.js)
│  ├─ home-view.js      mountHome                                   (was home.js)
│  ├─ leaderboard-view.js                                           (was leaderboard.js)
│  └─ summary-view.js                                               (was summary.js)
├─ controllers/         user input handling
│  ├─ drag.js           drag geometry and the pile / tray drag controllers
│  ├─ dwell.js          hold-to-reveal timers
│  └─ shortcuts.js      Enter / Ctrl+Enter check shortcut           (was keys.js)
└─ utils/
   └─ shapes.js         coin outline geometry
```

### Dependency rule

Imports only point downward: `main` -> `controllers` / `views` -> `services` -> `models` -> `constants` / `utils`. `models` and `constants` never import from `views`, `controllers` or `services`. This fixes the current inversions (`config.js` importing from `drag.js`, `dwell.js` and `state.js`; `leaderboard.js` and `summary.js` importing `MODES` from `home.js`).

### Mechanics

- Move with `git mv` where a file is moved whole, so history follows it. Files that are split get their code moved by hand; no logic is rewritten.
- Public function names are kept unless a file is renamed for clarity (`confirm` -> `choice-dialog`, `keys` -> `shortcuts`).
- Whether a very small file (`storage.js`, `url-params.js`, `modes.js`) stays separate or merges into its neighbour is decided during the plan, based on what reads best once the code is moved. The layers stay the same either way.
- `tests/` mirrors `src/` (`tests/models/`, `tests/views/` and so on). Test helpers (`dom-helper.js`, `pile-helper.js`) go in `tests/helpers/`. Tests are split along with the code they cover.
- Paths updated: `index.html` (still `src/main.js`), `package.json` coverage globs, `tests/index-html.test.js`, `tests/pages-site.test.js`, `e2e/global-teardown.js`, `e2e/server.spec.js`.
- The CI deploy step already copies `src/` whole, so it needs no change.

### Acceptance

- `npm test` and `npm run test:coverage` pass, with the same 80% per-file gate.
- The static server moves from `e2e/serve.js` to `scripts/serve.js`, since it is dev tooling behind `npm start` as well as the e2e tests. The deploy job copies an explicit file list, so `scripts/` is not published.
- `npm start` serves a working game; a manual play of each mode shows no change.
- No import goes upward in the dependency rule (checked by a small test that scans imports).

## 2. Documentation

| File | Content |
| --- | --- |
| `README.md` | Under 300 words: title and CI badge, "Play it live on https://wkcheng-ricky.github.io/CoinGame/", a two-sentence description, the four modes in one line each, a short "Run locally" and a pointer to `docs/`. |
| `CLAUDE.md` | Created with `/init` (the repo has none today), then trimmed: commands, the layer layout and dependency rule, conventions (integer pence, no build step, conventional commits), the testing policy. |
| `docs/gameplay.md` | Controls, Cashier and Give Change behaviour, ending a session, the leaderboard, Show Coins and Short-paying options. Moved from the README. |
| `docs/development.md` | Test commands, timing query parameters, CI and deploy, how to re-run extended e2e. Moved from the README. |

`docs/superpowers/` is unchanged. The `docs/coin_game_comment` folder is left alone.

## 3. Test strategy

- **Unit and jsdom tests:** unchanged policy, 80% per file on `src/` (except `main.js`).
- **E2E:** happy path only, with no coverage gate.
  - `e2e/` holds the CI suite: a smoke test, plus one happy-path flow each for Endless, Custom, Cashier and Give Change. The existing WebKit iPhone label spec stays in the CI suite as the mobile check. New specs reuse existing helpers.
  - `e2e/extended/` holds the other existing specs (layout, contrast, drag, lettering and so on). They stay in the repo and run locally with `npm run test:e2e:extended`. CI does not run them. Their imports are fixed after the move.
- **Coverage tooling removed:** `e2e/coverage.js`, the teardown coverage report, `test:e2e:coverage` and the `monocart-coverage-reports` dependency. `e2e/fixtures.js` becomes a plain re-export of Playwright's `test` and `expect`, so the extended specs keep working unchanged.
- **CI:** remove `if: false` from the `e2e` job, run Chromium and WebKit, drop the coverage step, and add `e2e` back to the `deploy` job's `needs`.

### Acceptance

- `npm run test:e2e` passes locally on Chromium and WebKit.
- `npm run test:e2e:extended` still passes.
- The CI workflow file is valid, and the `e2e` job runs on a pull request.

## Order of work

Three commits or groups, in this order, each leaving the repo green:

1. `src/` restructure and `tests/` mirror (refactor commits).
2. Docs: README, `/init` for `CLAUDE.md`, `docs/gameplay.md`, `docs/development.md`. These come second so the layout they describe exists.
3. E2E: move specs to `extended/`, write the happy-path suite, remove coverage tooling, update CI.

## Risks

- Splitting `game.js`, `state.js` and `render.js` can break tests that import several names from one file. Mitigation: move code in small steps and run `npm test` after each.
- WebKit in CI needs system dependencies. The existing job already installs them; the plan checks that it still works once enabled.
- Re-enabling e2e as a deploy gate means a flaky spec blocks publishing. Mitigation: keep the suite small and run it several times locally before enabling.
