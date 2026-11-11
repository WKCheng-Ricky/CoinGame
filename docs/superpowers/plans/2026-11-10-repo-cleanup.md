# Repo Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat `src/` with a layered layout, slim the README into a short human page backed by `CLAUDE.md` and `docs/`, and bring e2e back as a small happy-path suite that gates deploy.

**Architecture:** `src/` is split by technical role (`constants`, `utils`, `models`, `services`, `views`, `controllers`) with `main.js` at the root; imports only point downward. Code is moved bottom-up, one layer per task, and every task leaves `npm test` and `npm run test:coverage` green. Docs follow, then e2e.

**Tech Stack:** Plain ES modules (no build step), Node 22 `node --test` with jsdom, c8, Playwright (Chromium + WebKit), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-10-repo-cleanup-design.md`

## Global Constraints

- No behaviour, visual or gameplay change. Move code; do not rewrite logic. Exported function names are kept unless this plan renames them.
- `src/main.js` stays at `src/main.js` (`index.html` loads it) and is not split.
- Dependency rule, downward only: `main` -> `controllers` / `views` -> `services` -> `models` -> `constants` / `utils`. `views` and `controllers` do not import each other.
- Unit coverage gate stays: 80% lines, branches and functions per file on `src/**` except `src/main.js` (`npm run test:coverage`).
- Commit messages use Conventional Commits (`refactor:`, `docs:`, `test:`, `ci:`, `feat:`, `fix:`) and end with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Use `git mv` for whole-file moves so history follows. A file that is split keeps its history on its largest remainder.
- `tests/` mirrors `src/` (`tests/constants/`, `tests/models/`, ...). Tests move with, and are split along with, the code they cover. Shared helpers live in `tests/helpers/`.
- README is under 300 words. The live URL is `https://wkcheng-ricky.github.io/CoinGame/`.
- E2E has no coverage gate. CI e2e runs the happy-path suite on both Chromium and WebKit (decided with the owner: every happy-path spec runs on both) and gates `deploy`.
- The `docs/coin_game_comment/` and `docs/superpowers/` folders are not touched (except this plan and its spec).

## Review Focus

- A wrong relative import only fails in the browser (`main.js` and the views are not all loaded by unit tests). Task 7 adds a test that every relative import in `src/` resolves to a real file, and the happy-path e2e fails on any `pageerror`.
- c8's per-file 80% gate can fail on a newly split small file whose tests stayed with its old neighbour. Run `npm run test:coverage` after each task, not only at the end.
- `e2e/helpers.js` and the WebKit spec import `src/coins.js` by path (one by dynamic `import("/src/coins.js")` in the browser). The move to `src/constants/coins.js` breaks them silently until run.
- The Give Change happy path is random (5% short-paying by default). The spec must pin the seed and the Short-paying option so it cannot flake.
- Re-enabling `e2e` as a deploy gate: a missing WebKit system dependency or a flaky spec blocks publishing. Run the suite 3 times locally before enabling it in CI.

---

## Task 1: Constants, utils and test helpers

**Files:**
- Move: `src/coins.js` -> `src/constants/coins.js`; `src/options.js` -> `src/constants/options.js`; `src/shapes.js` -> `src/utils/shapes.js`
- Create: `src/constants/modes.js`, `src/constants/timing.js`
- Modify: `src/home.js` (remove `MODES`), `src/config.js`, `src/dwell.js`, `src/drag.js`, `src/state.js` (drop their timing constants), and every importer of a moved name, including `src/main.js`, `tests/**`, `e2e/helpers.js`, `e2e/*.spec.js`, `e2e/labels.webkit.spec.js`
- Move tests: `tests/coins.test.js` -> `tests/constants/coins.test.js`; `tests/options.test.js` -> `tests/constants/options.test.js`; `tests/shapes.test.js` -> `tests/utils/shapes.test.js`; `tests/dom-helper.js`, `tests/pile-helper.js` -> `tests/helpers/`

**Interfaces:**
- Produces `constants/modes.js`: `export const MODES` (the array now in `home.js`, unchanged).
- Produces `constants/timing.js`: `DWELL_MS`, `DETACH_HOLD_MS`, `ADVANCE_DELAY_MS`, `UNSERVED_DELAY_MS`, `LARGE_COIN_SCALE`, and `TIMING_DEFAULTS` (same shape as today's `config.js`). Imports nothing.
- `constants/coins.js`, `constants/options.js`, `utils/shapes.js` keep their exports unchanged.
- `home.js`, `config.js`, `dwell.js`, `drag.js`, `state.js` re-export nothing; callers import from the new files.

- [ ] **Step 1: Write the failing test** `tests/constants/timing.test.js`: `TIMING_DEFAULTS` deep-equals `{ dwellMs: 2000, detachHoldMs: 1000, advanceDelayMs: 400, parMs: null, unservedDelayMs: 2000 }`, `LARGE_COIN_SCALE === 1.5`, and `MODES.map((m) => m.id)` deep-equals `["endless", "custom", "cashier", "give-change"]`. Take the values from the current `tests/config.test.js` and `home.dom.test.js` if they differ.
- [ ] **Step 2: Run** `node --test tests/constants/timing.test.js`. Expected: FAIL, modules not found.
- [ ] **Step 3: Create `constants/timing.js` and `constants/modes.js`** by moving the constants out of their current files. `config.js` keeps only code that is not a constant until Task 4.
- [ ] **Step 4: `git mv` the three files and the five test/helper files** listed above; fix every import path in `src/`, `tests/` and `e2e/` (`grep -rn "coins.js\|options.js\|shapes.js\|dom-helper\|pile-helper" src tests e2e`). Browser-side paths too: `e2e/labels.webkit.spec.js` imports `/src/coins.js` inside `page.evaluate`.
- [ ] **Step 5: Run** `npm test && npm run test:coverage`. Expected: all pass, coverage gate passes.
- [ ] **Step 6: Run** `npm start` in the background, `curl -s localhost:4173/src/constants/coins.js | head -3` returns the module; stop the server.
- [ ] **Step 7: Commit** `refactor: move coin data, options, modes, timing and shapes into constants and utils`

## Task 2: Split `game.js` into `models/money`, `models/customer`, `models/pile`

**Files:**
- Move: `src/game.js` -> `src/models/pile.js` (largest remainder)
- Create: `src/models/money.js`, `src/models/customer.js`
- Modify: `src/models/pile.js`, `src/config.js` (`coinScaleFor`, `giveChangeOdds` leave it), importers (`state.js`, `render.js`, `drag.js`, `main.js`, tests, `e2e`)
- Tests: split `tests/game.test.js` into `tests/models/money.test.js`, `tests/models/customer.test.js`, `tests/models/pile.test.js`; move the `coinScaleFor` and `giveChangeOdds` tests from `tests/config.test.js` next to the code

**Interfaces:**
- `models/money.js` exports: `MAX_RANDOM_PENCE`, `MAX_CUSTOM_PENCE`, `formatPence(n)`, `total(pile)`, `check(pile, target)`, `summarisePile`, `describePile(pile, intro?)`, `parseAmount(text)`, `randomTarget(previous, rng?)`, `checkAnswer(pile, pence)`. Imports `constants/coins.js`.
- `models/customer.js` exports: `MAX_HANDFUL`, `randomHandful(rng?, previous?)`, `rollScenario`, `priceFor`, `changeDue`, `judgeAnswer`, and `giveChangeOdds(options)` (moved from `config.js`). Imports `constants/coins.js` and, if needed, `models/money.js`.
- `models/pile.js` exports everything from `game.js` line 117 onward (box sizes, coin scale, placement, stacking, settling, `layoutStacks`), plus `coinScaleFor(options)` (moved from `config.js`; uses `LARGE_COIN_SCALE` from `constants/timing.js`). Imports `models/money.js` only if the code needs `total` or `formatPence`.
- `models/*` import only `constants/*`, `utils/*` and each other (money <- customer, pile).

- [ ] **Step 1: Write the failing test** `tests/models/layout-of-game.test.js` (temporary): imports `formatPence` from `models/money.js`, `rollScenario` from `models/customer.js` and `placeCoin` from `models/pile.js`, and asserts each is a function. Delete it in Step 5 once the real tests exist.
- [ ] **Step 2: Run it.** Expected: FAIL, modules not found.
- [ ] **Step 3: `git mv src/game.js src/models/pile.js`, then cut the money and customer code into the two new files** (boundary: money is the top of `game.js` through `randomHandful`; scenario functions `rollScenario`..`judgeAnswer` are customer; everything from `PILE_WIDTH_MM` down stays in `pile.js`). Check `game.js` for any helper shared between the sections and place it with its heaviest user, importing from there.
- [ ] **Step 4: Split `tests/game.test.js` along the same boundaries and fix all importers** (`grep -rn "game.js" src tests e2e`).
- [ ] **Step 5: Delete the temporary test. Run** `npm test && npm run test:coverage`. Expected: pass, with each of `money.js`, `customer.js`, `pile.js` at or above 80% per file.
- [ ] **Step 6: Commit** `refactor: split game.js into money, customer and pile models`

## Task 3: `models/session` and `models/game-state`

**Files:**
- Move: `src/state.js` -> `src/models/game-state.js`; `src/timer.js` -> `src/models/session.js`
- Modify: `src/models/session.js` (receives session code from `state.js`), importers
- Tests: `tests/state.test.js` -> `tests/models/game-state.test.js`; `tests/timer.test.js` -> `tests/models/session.test.js`, which also receives the tests for the functions below

**Interfaces:**
- `models/session.js` exports: everything `timer.js` exports today (`PAR_MS`, `MAX_POINTS`, `MIN_POINTS`, `parFor`, `scoreFor`, `formatClock`, `clockText`, `timeLeftMs`, `isExpired`) plus, moved from `state.js`: `isScored(state)`, `exitPrompt(state, button)`, `endSession(state, at)`, `pauseClock(state, now)`, `resumeClock(state, now)`. Imports `constants/options.js` (`presetOf`, `timerOn`) only.
- `models/game-state.js` exports everything else `state.js` exports today. It imports `models/session.js` (`isExpired`, `parFor`, `scoreFor`), `models/money.js`, `models/customer.js`, `models/pile.js`, `constants/coins.js`, `constants/options.js`, and `ADVANCE_DELAY_MS` from `constants/timing.js`. It re-exports no session functions; `main.js` imports them from `models/session.js`.

- [ ] **Step 1: Write the failing test:** in the new `tests/models/session.test.js`, add one case per moved function that imports it from `../../src/models/session.js` (copy assertions from the matching cases in `tests/state.test.js`).
- [ ] **Step 2: Run** `node --test tests/models/session.test.js`. Expected: FAIL (names not exported).
- [ ] **Step 3: `git mv` both files; move the five functions** (`state.js` lines from `isScored` down to `resumeClock`) into `session.js`; keep `expireRound`, `pileHeightMm` and the rest in `game-state.js`.
- [ ] **Step 4: Fix importers** (`main.js` takes the five names from `models/session.js`), move the old assertions out of `tests/models/game-state.test.js` so none test a function that no longer lives there.
- [ ] **Step 5: Run** `npm test && npm run test:coverage`. Expected: pass.
- [ ] **Step 6: Commit** `refactor: move game state and session logic into models`

## Task 4: Services

**Files:**
- Move: `src/theme.js` -> `src/services/theme.js`; `src/scores.js` -> `src/services/scores.js`
- Create: `src/services/storage.js`, `src/services/url-params.js`
- Delete: `src/config.js` (empty after Tasks 1 and 2)
- Tests: `tests/theme.test.js` -> `tests/services/theme.test.js`; `tests/scores.test.js` -> `tests/services/scores.test.js`; `timingFromSearch` cases from `tests/config.test.js` -> `tests/services/url-params.test.js`; `getStorage` cases -> `tests/services/storage.test.js`; delete `tests/config.test.js` once empty

**Interfaces:**
- `services/storage.js`: `getStorage(win)`; same behaviour as today (`theme.js`).
- `services/theme.js`: `THEME_KEY`, `readTheme`, `saveTheme`, `applyTheme`, `nextTheme`, `themeLabel`. No longer exports `getStorage`.
- `services/scores.js`: unchanged exports (`SCORES_KEY`, `TOP_N`, `BOARD_MODES`, `BOARD_PRESETS`, `boardId`, `rankText`, `createScoreStore`).
- `services/url-params.js`: `timingFromSearch(search)`; imports `TIMING_DEFAULTS` from `constants/timing.js`.

- [ ] **Step 1: Write the failing test** `tests/services/storage.test.js` (a `win` whose `localStorage` getter throws returns `null`; a normal one returns its storage) and keep `tests/services/url-params.test.js` as moved from the config tests. Run both. Expected: FAIL, modules not found.
- [ ] **Step 2: Create the two files, `git mv` the other two, delete `config.js`, fix importers** (`grep -rn "config.js\|theme.js\|scores.js" src tests e2e`; `main.js` and `theme-boot.js` check: `theme-boot.js` is a classic script that does not import `src/`, confirm and leave it).
- [ ] **Step 3: Run** `npm test && npm run test:coverage`. Expected: pass, `storage.js` at or above 80% on its own tests.
- [ ] **Step 4: Commit** `refactor: group storage, theme, scores and url params into services`

## Task 5: Views

**Files:**
- Move: `src/render.js` -> `src/views/pile-view.js`; `src/home.js` -> `src/views/home-view.js`; `src/leaderboard.js` -> `src/views/leaderboard-view.js`; `src/summary.js` -> `src/views/summary-view.js`; `src/icons.js` -> `src/views/icons.js`; `src/confirm.js` -> `src/views/choice-dialog.js`
- Create: `src/views/coin-svg.js`
- Tests: `tests/render.test.js` -> `tests/views/coin-svg.test.js` (pure SVG layout cases) and `tests/views/pile-view.test.js` if some cases belong there; `tests/render.dom.test.js` -> `tests/views/pile-view.dom.test.js`; `home.dom.test.js` -> `tests/views/home-view.dom.test.js`; `leaderboard.dom.test.js` -> `.../leaderboard-view.dom.test.js`; `summary.dom.test.js` -> `.../summary-view.dom.test.js`; `confirm.dom.test.js` -> `.../choice-dialog.dom.test.js`; `icons.test.js` -> `tests/views/icons.test.js`

**Interfaces:**
- `views/coin-svg.js` exports: `faceLayout(coin)`, `coinSvg(coin)`; contains the face-layout constants and helpers from the top of `render.js` (through `wordingLetters`). Imports `constants/coins.js`, `utils/shapes.js`.
- `views/pile-view.js` exports: `renderTray`, `coinLabel`, `layerOrder`, `renderPile`, `showStackBadges`, `setText`, `announce`. Imports `views/coin-svg.js` and `models/pile.js`.
- Other view files keep their exports; `mountHome` etc. now import `MODES` from `constants/modes.js`, `rankText`/`boardId` from `services/scores.js`, `PRESETS` from `constants/options.js`.
- `views/choice-dialog.js` exports `createChoiceDialog(dialog)` unchanged.

- [ ] **Step 1: Write the failing test:** `tests/views/coin-svg.test.js` imports `coinSvg` and `faceLayout` from `../../src/views/coin-svg.js`, and asserts `coinSvg(COINS[0])` starts with `<svg`. Run it. Expected: FAIL.
- [ ] **Step 2: Move and split.** `git mv` the six files; cut `faceLayout`, `coinSvg` and their private helpers/constants into `coin-svg.js`; leave `coinButton` and below in `pile-view.js` (note: `render.js` has a private DOM `placeCoin(btn, entry, heightMm)`; keep it private so it never collides with `models/pile.js`).
- [ ] **Step 3: Fix importers and test imports; move/split the tests as listed.**
- [ ] **Step 4: Run** `npm test && npm run test:coverage`. Expected: pass.
- [ ] **Step 5: Commit** `refactor: move rendering and screens into views and rename confirm to choice-dialog`

## Task 6: Controllers

**Files:**
- Move: `src/drag.js` -> `src/controllers/drag.js`; `src/dwell.js` -> `src/controllers/dwell.js`; `src/keys.js` -> `src/controllers/shortcuts.js`
- Tests: `drag.test.js`, `drag.dom.test.js` -> `tests/controllers/`; `dwell.test.js` -> `tests/controllers/dwell.test.js`; `keys.test.js` -> `tests/controllers/shortcuts.test.js`

**Interfaces:** exports unchanged (`createDrag`, `createTrayDrag`, `passesThreshold`, `pointInRect`, `coinSizePx`, `toPileFraction`, `pixelsToFraction`, `DRAG_THRESHOLD_PX`, `createDwell`, `isCheckShortcut`). `DETACH_HOLD_MS` and `DWELL_MS` are no longer exported here; callers (tests included) import them from `constants/timing.js`. Controllers import `models/pile.js`, `constants/*`, never `views/*`.

- [ ] **Step 1: `git mv` the files; fix imports** (`grep -rn "drag.js\|dwell.js\|keys.js" src tests e2e`).
- [ ] **Step 2: Run** `npm test && npm run test:coverage`. Expected: pass.
- [ ] **Step 3: Check the browser still loads.** `npm start` in the background, open `http://localhost:4173`, and with Playwright MCP or a browser start each of the 4 modes, tap a coin and drag one. No console errors. Stop the server.
- [ ] **Step 4: Commit** `refactor: group drag, dwell and shortcuts into controllers`

## Task 7: Layer guard test and path cleanup

**Files:**
- Create: `tests/architecture.test.js`
- Modify: `e2e/global-teardown.js` only if it names a moved path (it names `src/main.js`, which has not moved; leave), `README.md` project layout (rewritten in Task 8)

**Interfaces:** none produced. The test reads `src/**/*.js` from disk.

- [ ] **Step 1: Write the test.** `tests/architecture.test.js` walks `src/`, and for each file asserts: (a) the only `.js` file directly in `src/` is `main.js`, and every other file sits in one of `constants`, `utils`, `models`, `services`, `views`, `controllers`; (b) every relative `from "..."` specifier (regex over `from\s+"(\.[^"]+)"`) resolves to an existing file; (c) layer ranks `constants=0, utils=0, models=1, services=2, views=3, controllers=3, main=4`: a file imports only from its own folder or a lower rank, and `views`/`controllers` never import each other.
- [ ] **Step 2: Run** `node --test tests/architecture.test.js`. Expected: PASS.
- [ ] **Step 3: Prove it can fail.** Temporarily add `import "../views/icons.js";` to `src/models/money.js`; run the test; expected FAIL naming the file and import. Remove the line and re-run to PASS.
- [ ] **Step 4: Run** `npm test && npm run test:coverage`, and `git status --short src | head` shows no stray files at the `src/` root except `main.js`.
- [ ] **Step 5: Commit** `test: guard the src layer boundaries and import paths`

## Task 8: README and `docs/`

**Files:**
- Create: `docs/gameplay.md`, `docs/development.md`, `tests/readme.test.js`
- Modify: `README.md`

**Interfaces:** `README.md` links to `docs/gameplay.md` and `docs/development.md`, and keeps the heading `# Coin Counting Game` (checked by `tests/index-html.test.js`). The docs describe the end state of this plan: `npm run test:e2e` runs the happy-path suite, `npm run test:e2e:extended` runs the detailed specs.

- [ ] **Step 1: Write the failing test** `tests/readme.test.js`: (a) README text with image lines removed has fewer than 300 whitespace-separated words; (b) it contains `https://wkcheng-ricky.github.io/CoinGame/` and the words Endless, Custom, Cashier and Give Change; (c) every relative link in it (`](docs/...)`) points to a file that exists.
- [ ] **Step 2: Run it.** Expected: FAIL (word count is 1,232).
- [ ] **Step 3: Move content, nothing lost.** `docs/gameplay.md` gets "How to play" details, the controls, Cashier and Give Change behaviour, ending a session and the leaderboard. `docs/development.md` gets the dev commands, timing query parameters table, CI/deploy notes (rewritten for the re-enabled e2e job) and the one-time Pages setup. Copy the existing prose; light edits only.
- [ ] **Step 4: Rewrite `README.md`:** heading, CI badge, "Play it live on <url>", two-sentence description, the four modes one line each, "Run locally" (`npm start`, `http://localhost:4173`), and links to the two docs.
- [ ] **Step 5: Run** `npm test`. Expected: PASS, including `readme.test.js` and `index-html.test.js`.
- [ ] **Step 6: Commit** `docs: shorten the README and move gameplay and development detail into docs`

## Task 9: `CLAUDE.md` via `/init`

**Files:** Create `CLAUDE.md`.

- [ ] **Step 1: Run the `init` skill** (Skill tool, skill `init`) in the repo root. There is no existing `CLAUDE.md`, so it creates one.
- [ ] **Step 2: Trim and correct it.** It must cover only: the commands (`npm start`, `npm test`, `npm run test:coverage`, `npm run test:e2e`, `npm run test:e2e:extended`); the `src/` layers and the downward dependency rule, pointing at `tests/architecture.test.js`; conventions (money is integer pence, no build step, ES modules, Conventional Commits); the test policy (unit 80% per file; e2e happy path only, no coverage gate; extended specs not run in CI); and links to `docs/gameplay.md` and `docs/development.md`. Remove anything `/init` guessed that the repo does not show. Keep it under about 60 lines.
- [ ] **Step 3: Verify every command and path in `CLAUDE.md` exists** (`npm run` lists the scripts after Task 12; check again there). Run `npm test`. Expected: PASS.
- [ ] **Step 4: Commit** `docs: add CLAUDE.md with commands, layer rules and the testing policy`

## Task 10: Reorganise e2e into CI and extended

**Files:**
- Move to `e2e/extended/`: `cashier-dock`, `cashier`, `change`, `coins`, `contrast`, `dock`, `drag`, `enter`, `frame`, `grid`, `home-feedback`, `home`, `layout`, `lettering`, `modes`, `phone`, `pile`, `short`, `theme` (all `.spec.js`)
- Stay in `e2e/`: `server.spec.js` (smoke), `labels.webkit.spec.js`, `helpers.js`, `fixtures.js`, `serve.js`, `global-setup.js`, `global-teardown.js`
- Modify: moved specs (imports `./fixtures.js` -> `../fixtures.js`, `./helpers.js` -> `../helpers.js`, `../src/...` -> `../../src/...`), `playwright.config.js`, `package.json`

**Interfaces:**
- `npm run test:e2e` -> `playwright test`: runs `e2e/*.spec.js` (not `extended/`). The Chromium project ignores `extended/` and `*.webkit.spec.js`; the WebKit project (iPhone 14) runs every `e2e/*.spec.js` (smoke, the four happy-path specs and the WebKit label spec) and ignores `extended/`.
- `npm run test:e2e:extended` -> `E2E_EXTENDED=1 playwright test`: when that variable is set, the Chromium project matches only `e2e/extended/**` and the WebKit project is empty/omitted.

- [ ] **Step 1: `git mv` the 19 specs into `e2e/extended/`; fix their imports.**
- [ ] **Step 2: Update `playwright.config.js`** as in Interfaces (`testIgnore` of `extended/` by default; `testMatch` of `extended/` when `E2E_EXTENDED` is set), and add the `test:e2e:extended` script.
- [ ] **Step 3: Run** `npm run test:e2e -- --list` and expect `server.spec.js` on both projects and the WebKit label spec on WebKit only; run `E2E_EXTENDED=1 npx playwright test --list` and expect the 19 moved specs.
- [ ] **Step 4: Run** `npm run test:e2e:extended` once. Expected: the same pass/fail result as before the move (failures that already existed on `main` are reported, not fixed here).
- [ ] **Step 5: Commit** `test: move the detailed e2e specs into e2e/extended and keep CI to a smoke set`

## Task 11: Happy-path e2e suite

**Files:** Create `e2e/endless.spec.js`, `e2e/custom.spec.js`, `e2e/cashier.spec.js`, `e2e/give-change.spec.js`; extend `e2e/server.spec.js` or add `e2e/boot.spec.js` for the smoke boot.

**Interfaces:** Consumes `FAST`, `seedRandom`, `startMode`, `counterTotalPence` from `e2e/helpers.js` and `test`, `expect` from `@playwright/test` (not `fixtures.js`). Reuse selectors seen in the extended specs: `#btn-check`, `#btn-next`, `#play-message`, `#play-total`, `#play-target`, `#cashier-input`, `#btn-short`, `#btn-none`, `#change-pile`, `#play-heading`, `#custom-input`.

- [ ] **Step 1: Write `e2e/boot.spec.js`:** home loads at `/?` + `FAST`, the four mode buttons are visible, and no `pageerror` or `console` error was emitted while starting each mode (attach listeners with `page.on` before `goto`). Run `npm run test:e2e -- boot`. Expected: PASS (this is the guard for broken browser-side import paths).
- [ ] **Step 2: Write `e2e/custom.spec.js`:** Easy, amount `0.30`, add 20p and 10p, press Check, expect `#play-message` `Correct! You made exactly £0.30.` Adapt from the existing `modes.spec.js` custom test.
- [ ] **Step 3: Write `e2e/endless.spec.js`:** seeded; read the target from `#play-target`, add coins (largest first, as `buildFromTray` in `extended/modes.spec.js`) until `#play-total` matches, press Check, expect a `success` message.
- [ ] **Step 4: Write `e2e/cashier.spec.js`:** seeded; read `counterTotalPence`, fill `#cashier-input` with the total, press Enter, expect `#btn-next` visible and `#play-rounds` `Customers served: 1`.
- [ ] **Step 5: Write `e2e/give-change.spec.js`:** seeded and with Short-paying set to Off on Home (find the control in `index.html`) so the customer always overpays or pays exactly. Compute `due = paid - price` from `counterTotalPence` and the `Price £x.xx` heading; if `due` is 0 press `#btn-none`, else build `due` from the tray into `#change-pile` and press `#btn-check`; expect a success message and `Customers served: 1`.
- [ ] **Step 6: Run** `npm run test:e2e` three times. Expected: all pass every time, on both Chromium and WebKit (every happy-path spec runs on both; the label spec runs on WebKit only). If a spec needs Chromium-only APIs, fix the spec, not the project list.
- [ ] **Step 7: Commit** `test: add happy-path e2e specs for each game mode and a boot check`

## Task 12: Remove e2e coverage tooling and re-enable CI e2e

**Files:**
- Modify: `tests/pages-site.test.js`, `.github/workflows/ci.yml`, `package.json`, `package-lock.json`, `playwright.config.js`, `e2e/fixtures.js`
- Delete: `e2e/coverage.js`, `e2e/global-setup.js`, `e2e/global-teardown.js`

**Interfaces:** `e2e/fixtures.js` becomes `export { test, expect } from "@playwright/test";` so the extended specs keep their import. `package.json` loses `test:e2e:coverage` and `monocart-coverage-reports`.

- [ ] **Step 1: Write the failing tests in `tests/pages-site.test.js`:** (a) `wf.jobs.e2e` exists and has no `if`; (b) `wf.jobs.deploy.needs` deep-equals `["unit", "e2e"]`; (c) the e2e job's steps include `npm run test:e2e` and none mention `coverage`; (d) its install step installs both `chromium` and `webkit`. Run it. Expected: FAIL.
- [ ] **Step 2: Edit `ci.yml`:** delete the `if: false` line and the "Paused" comment, change the run step to `npm run test:e2e`, drop the coverage artifact path, set `deploy.needs: [unit, e2e]`.
- [ ] **Step 3: Remove coverage:** delete the three e2e coverage files, remove `globalSetup`/`globalTeardown` from `playwright.config.js` and its coverage comments, simplify `fixtures.js`, run `npm uninstall monocart-coverage-reports`, delete the `test:e2e:coverage` script.
- [ ] **Step 4: Run** `npm test`, `npm run test:coverage`, `npm run test:e2e` and `npm run test:e2e:extended`. Expected: unit passes; e2e passes; extended unchanged from Task 10.
- [ ] **Step 5: Commit** `ci: re-enable happy-path e2e on Chromium and WebKit as a deploy gate and drop e2e coverage`

## Task 13: Final verification

- [ ] **Step 1:** Run every command in `CLAUDE.md` and `docs/development.md` and confirm each exists and succeeds (`npm run` lists the scripts).
- [ ] **Step 2:** `git grep -n "src/game.js\|src/state.js\|src/render.js\|src/config.js\|src/confirm.js\|src/keys.js\|test:e2e:coverage\|monocart"` returns nothing outside `docs/superpowers/`.
- [ ] **Step 3:** Push the branch only if asked; otherwise report the branch state, the commit list and the results of Step 1 to the user. Ask whether to open a PR so CI proves the e2e job on a pull request.
