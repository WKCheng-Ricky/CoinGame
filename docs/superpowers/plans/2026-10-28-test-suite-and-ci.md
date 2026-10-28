# Test Suite and CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-file 80% unit coverage on every `src/*.js` except `main.js` (jsdom tests), a Chromium Playwright e2e suite that also drives `main.js` to 80% browser coverage, a timing config that lets tests shorten the waits, and a GitHub Actions workflow that runs both.

**Architecture:** Unit tests stay on `node --test`, wrapped by `c8` for a per-file threshold. A new `src/config.js` reads optional URL query parameters for the three waits; defaults are unchanged. Playwright serves the static game through a short Node server, shortens waits with query parameters, seeds `Math.random` from the test side, and collects V8 coverage that `monocart-coverage-reports` turns into an lcov report with a `main.js` threshold.

**Tech Stack:** Node 22 `node:test`, `jsdom`, `c8`, `@playwright/test` (Chromium), `monocart-coverage-reports`, GitHub Actions. All dev dependencies; the game keeps no build step and no runtime dependency.

**Spec:** `docs/superpowers/specs/2026-10-28-test-suite-and-ci-design.md`

## Global Constraints

- The only game-code change is the timing config (Task 2) plus one comment in `drag.js`. Defaults reproduce today's behaviour: `DWELL_MS = 2000`, `DETACH_HOLD_MS = 1000`, `ADVANCE_DELAY_MS = 400`.
- Every `src/*.js` file except `src/main.js` has at least 80% line coverage (`c8 --per-file`), and `src/main.js` has at least 80% from the e2e run.
- e2e: Chromium only, about 20 tests.
- CI: `unit` and `e2e` jobs run in parallel on `push` and `pull_request` for `main`, Node 22.
- Commits are Conventional Commits ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Coin values come from `src/coins.js`; do not copy denominations into tests.

## Review Focus

- A reused pile-button uid now holding a different coin must be rebuilt (stale-pile bug). Task 1.
- A bad timing parameter (`?dwell=abc`, `-5`, `1e9`, `1.5`, empty) must fall back to the default, never `NaN` or an instant reveal. Task 2.
- A pile coin released outside the board is pinned to the nearest edge, and a tray coin released outside is not added. Tasks 3 and 5.
- A second pointer during a drag must not move or drop a second coin. Task 3.
- Typed Cashier answers with a `£` prefix work, Enter behaves like Check, and a second Enter after a correct answer does nothing. Task 5.

---

### Task 1: jsdom helper, render tests, per-file coverage gate

**Files:**
- Create: `tests/dom-helper.js`, `tests/render.dom.test.js`, `.gitignore`
- Modify: `package.json`
- Reference: `src/render.js`

**Interfaces:**
- Produces: `installDom(html = "<!doctype html><body></body>") -> { window, document, teardown() }` in `tests/dom-helper.js`; it builds a `JSDOM`, sets `globalThis.window` and `globalThis.document`, and `teardown()` removes them. Also `pointer(window, type, init) -> Event`: a `window.PointerEvent` when it exists, otherwise a bubbling `MouseEvent` with `pointerId`, `pointerType`, `isPrimary` defined on it (defaults `1`, `"mouse"`, `true`).
- Produces: npm script `test:coverage`.

- [ ] **Step 1: Install and configure.** `npm install --save-dev jsdom c8`. In `package.json` add `"test:coverage": "c8 --check-coverage --lines 80 --per-file --include 'src/**' --exclude 'src/main.js' --reporter=text --reporter=lcov --reports-dir=coverage/unit node --test"`. Add `.gitignore` with `node_modules/`, `coverage/`, `test-results/`, `playwright-report/`.
- [ ] **Step 2: Write `tests/render.dom.test.js`** (each test calls `installDom()` and `teardown()`):
  - `renderPile builds one button per entry labelled "20p coin" when not removable` and `"Remove 20p"` when removable.
  - `renderPile keeps the same button for an unchanged uid and coin` (identity preserved across two calls).
  - `renderPile rebuilds a button whose coin changed under the same uid` (uid 1 `20p`, then uid 1 `£1`: `dataset.coin` is `£1` and the label matches).
  - `renderPile re-labels a reused button when removable flips`.
  - `renderPile removes buttons whose uid left the pile`.
  - `renderPile shows a ×2 badge on stacked same-coin entries and none on a lone coin` (entries `{uid, coinId, x, y, rot}` with identical x, y).
  - `excludeUid removes the badge from a detached coin and reduces its stack's count`.
  - `renderTray builds one "Add <label>" button per coin in COINS`.
  - `setText skips identical text` and `announce clears then re-sets text after a delay` (use `t.mock.timers`).
- [ ] **Step 3: Run** `npm run test:coverage`. Expected: `render.js` at least 80%; `drag.js` fails the gate, so the command exits non-zero naming only `src/drag.js` (confirms the gate works).
- [ ] **Step 4: Commit**
```bash
git add package.json package-lock.json .gitignore tests/dom-helper.js tests/render.dom.test.js
git commit -m "test: add jsdom render tests and per-file coverage gate"
```

### Task 2: Timing config

**Files:**
- Create: `src/config.js`, `tests/config.test.js`
- Modify: `src/drag.js` (`createDrag` option `holdMs`), `src/state.js` (`canAdvance`), `src/main.js` (read config, pass values), `tests/state.test.js`
- Reference: `src/dwell.js` (`createDwell({ delay })` already exists)

**Interfaces:**
- Produces: `TIMING_DEFAULTS = { dwellMs: DWELL_MS, detachHoldMs: DETACH_HOLD_MS, advanceDelayMs: ADVANCE_DELAY_MS }` and `timingFromSearch(search: string) -> { dwellMs, detachHoldMs, advanceDelayMs }` in `src/config.js`. Query parameters: `dwell`, `hold`, `advance` (ms). A value counts only if it matches `^\d+$` and is at most 10000; otherwise the default is used.
- Produces: `createDrag(container, { ..., holdMs = DETACH_HOLD_MS })` and `canAdvance(state, now, delayMs = ADVANCE_DELAY_MS) -> boolean`.

- [ ] **Step 1: Write `tests/config.test.js`:** `defaults when the search is empty`; `reads dwell, hold and advance`; `0 is accepted`; and one test per rejected value (`abc`, `-5`, `1.5`, `10001`, empty string) asserting the default is used. Add to `tests/state.test.js`: `canAdvance uses a custom delay` (solved at 0, true at 250 with delay 250, false at 249).
- [ ] **Step 2: Run** `node --test tests/config.test.js tests/state.test.js`. Expected: FAIL (module/arg missing).
- [ ] **Step 3: Implement** `src/config.js` as specified (parse with `URLSearchParams`), the `delayMs` parameter in `canAdvance`, and the `holdMs` option in `createDrag` (replace the `DETACH_HOLD_MS` use at the hold timer).
- [ ] **Step 4: Wire `main.js`:** `const timing = timingFromSearch(location.search)` once; pass `delay: timing.dwellMs` to `createDwell`, `holdMs: timing.detachHoldMs` to `createDrag`, and `timing.advanceDelayMs` to both `canAdvance` calls. Add a one-line comment in `drag.js` at the `onMove(t.uid, x, y)` call: the fraction is unclamped on purpose and `moveCoin` clamps it.
- [ ] **Step 5: Run** `npm test` (all 163 existing tests plus the new ones pass) and open the game once with and without `?dwell=50` to confirm the reveal speeds up (manual or in Task 4's e2e).
- [ ] **Step 6: Commit**
```bash
git add src tests
git commit -m "feat: make hold, dwell and advance timings configurable via query string"
```

### Task 3: drag.js DOM tests

**Files:**
- Create: `tests/drag.dom.test.js`
- Reference: `src/drag.js` (`createDrag`, `createTrayDrag`), `tests/dom-helper.js`

**Interfaces:**
- Consumes: `installDom`, `pointer` (Task 1); `createDrag`'s `holdMs` (Task 2).

jsdom has no layout: stub `getBoundingClientRect` on the container and coins, and define `clientLeft`, `clientTop`, `clientWidth`, `clientHeight` on the container so the padding rect equals a fixed box (e.g. 400×300 at 0,0). `setPointerCapture` is missing in jsdom; the code already catches that.

- [ ] **Step 1: Write the tests** (use `t.mock.timers` for the hold):
  - `a pointer drag past the threshold calls onDragStart then onMove with fractions` (expected values from `toPileFraction`).
  - `a release outside the container passes unclamped fractions to onMove` (assert `|x| > 0.5` for a far-right release; clamping belongs to `moveCoin`).
  - `movement under the threshold is a tap: onMove not called and a following click is not suppressed`.
  - `a second pointer during a drag is ignored`.
  - `isLocked() true blocks the pointerdown`.
  - `a non-primary mouse button does not start a drag`.
  - `pointercancel restores the coin: dragging class and --dx/--dy removed`.
  - `holding a stack member for holdMs fires onDetach once; releasing without moving fires onDetachRelease` (pass `holdMs: 50`).
  - `a group drag fires onMoveGroup with the pixel delta as a fraction`.
  - `createTrayDrag calls onDrop only when released inside pileEl` and `does not call onDrop when released outside`.
- [ ] **Step 2: Run** `npm run test:coverage`. Expected: exit 0, every listed file at least 80%.
- [ ] **Step 3: If `drag.js` is still under 80%,** add tests for the lines `c8` lists as uncovered; do not lower the threshold.
- [ ] **Step 4: Commit**
```bash
git add tests/drag.dom.test.js
git commit -m "test: cover drag.js with jsdom pointer tests"
```

### Task 4: Playwright setup, browser coverage, Home/Custom/Endless e2e

**Files:**
- Create: `playwright.config.js`, `e2e/serve.js`, `e2e/helpers.js`, `e2e/fixtures.js`, `e2e/global-teardown.js`, `e2e/modes.spec.js`
- Modify: `package.json` (scripts `"test:e2e": "playwright test"`)

**Interfaces:**
- Produces in `e2e/helpers.js`:
  - `FAST = "dwell=50&hold=50&advance=250"`.
  - `seedRandom(page, seed = 1)`: `page.addInitScript` replacing `Math.random` with a mulberry32 generator.
  - `counterTotalPence(page) -> Promise<number>`: reads `#play-pile-summary`, parses entries like `2 × 20p`, sums with `COINS` values imported from `../src/coins.js` (match by `label`).
  - `startMode(page, name)`: `page.goto("/?" + FAST)` then clicks the Home button for `"Endless" | "Custom" | "Cashier"`.
- Produces in `e2e/fixtures.js`: a `test` extending `@playwright/test` whose `page` fixture runs `page.coverage.startJSCoverage()` before the test and, after it, adds the entries to a shared `monocart-coverage-reports` instance; every spec imports `test` and `expect` from here.
- Produces `e2e/global-teardown.js`: generates the report (`lcovonly` and `console-summary` into `coverage/e2e`, `entryFilter` keeping only URLs under `/src/`) and throws if `src/main.js` is under 80% lines.

- [ ] **Step 1: Install** `npm install --save-dev @playwright/test monocart-coverage-reports` then `npx playwright install chromium`.
- [ ] **Step 2: Write `e2e/serve.js`:** a Node `http` server serving the repo root with correct `content-type` for `.html .js .css .svg`, `PORT` default 4173, rejecting any path that resolves outside the root.
- [ ] **Step 3: Write `playwright.config.js`:** `testDir: "e2e"`, project `chromium` (`devices["Desktop Chrome"]`), `use.baseURL: "http://localhost:4173"`, `use.trace: "retain-on-failure"`, `globalTeardown: "./e2e/global-teardown.js"`, `webServer: { command: "node e2e/serve.js", url: "http://localhost:4173", reuseExistingServer: !process.env.CI }`, reporter `[["list"], ["html", { open: "never" }]]` in CI and `"list"` locally. Set `workers: 1` and `fullyParallel: false` so every test runs in one process: the fixture then adds each test's coverage to one shared `monocart-coverage-reports` instance in memory, and the global teardown generates the report from it (no per-worker files to merge).
- [ ] **Step 3b: Confirm browser coverage works before writing more tests.** Run one trivial test (open Home) with the fixture; the report must show `src/main.js` with non-zero covered lines. If it reports 0 or misses the file, switch to the fallback in the spec's Risks section (Istanbul instrumentation of a copy of `src/`) and note the change in the commit.
- [ ] **Step 4: Write `e2e/modes.spec.js`:**
  - `home shows Endless, Custom and Cashier buttons`.
  - `custom: building the target and Check shows success, then Play again and Change amount work` (enter `0.30`, tap `Add 20p` and `Add 10p`, assert `#play-message`).
  - `custom: an invalid amount shows the inline error` (`#custom-error`).
  - `endless: a correct pile shows Next and the rounds counter increases` (read the target from `#play-target`, build it from tray coins).
  - `clear empties the pile and back returns to Home`.
  - `easy shows coin values and normal hides them until hover` (`#diff-easy` vs `#diff-normal`; Normal reveals via the `.revealed` class after hovering a pile coin for the shortened dwell).
- [ ] **Step 5: Run** `npx playwright test`. Expected: 6 passed and a coverage summary printed; the `main.js` threshold may fail until Task 5, which is expected here (the teardown can be gated behind `process.env.COVERAGE_ENFORCE` set by CI and `test:e2e:coverage`, so this task's run still exits 0).
- [ ] **Step 6: Commit**
```bash
git add playwright.config.js e2e package.json package-lock.json
git commit -m "test: add Playwright setup, browser coverage and mode e2e"
```

### Task 5: Cashier, viewport and drag e2e, `main.js` to 80%

**Files:**
- Create: `e2e/cashier.spec.js`, `e2e/layout.spec.js`, `e2e/drag.spec.js`
- Reference: `e2e/helpers.js`, `src/main.js:237` (arrow handler)

**Interfaces:**
- Consumes: `FAST`, `seedRandom`, `counterTotalPence`, `startMode`; ids `#cashier-input`, `#cashier-error`, `#btn-check`, `#btn-next`, `#btn-back`, `#play-message`, `#play-rounds`, `#play-pile`, `#play-tray`, `#play-pile-summary`.

- [ ] **Step 1: `e2e/cashier.spec.js`** (all call `seedRandom` first):
  - `invalid input shows the shared error with aria-invalid` for `""`, `"."`, `"abc"`; `"0"` shows the more-than-zero error; no hint appears.
  - `too high and too low hints keep the typed text and the coins`.
  - `a correct answer typed with a £ prefix and Enter locks the input, shows Next and Back, focuses Next, and a second Enter changes nothing`.
  - `Next inside the advance delay is ignored, after it advances` (page opened with `advance=250`: click Next at once via `page.evaluate` and assert the counter text unchanged, `page.waitForTimeout(300)`, click, assert the round advanced and the input cleared).
  - `counter coins cannot be removed and labels are never "Remove ..."`, including after playing Endless first.
- [ ] **Step 2: `e2e/layout.spec.js`:** at `390×844`, Cashier Easy: coin values visible and `scrollWidth <= innerWidth`; Normal: values hidden until hover or focus for the shortened dwell, then visible, and no horizontal overflow.
- [ ] **Step 3: `e2e/drag.spec.js`** (Custom or Endless, via `page.mouse`):
  - `dragging a pile coin changes its left/top style`.
  - `dropping a pile coin outside the board pins it to the nearest edge` (its left or top style equals the edge value from `pileBox`, never beyond).
  - `arrow keys move a focused pile coin` (focus the button, press `ArrowRight`, `left` increases).
  - `holding a coin in a stack for the shortened hold separates it` (build a same-coin stack, hold `mouse.down` over the top coin for `hold` ms, move, release; the stack badge count drops).
  - `dragging a stack moves the group together` (quick drag of a stacked coin moves every member).
  - `dragging a tray coin onto the pile adds it; dropping it outside does not`.
- [ ] **Step 4: Run** `npx playwright test` with coverage enforcement on. If `src/main.js` is under 80%, read the report (`coverage/e2e`), add tests for the largest uncovered blocks (touch long-press reveal, Clear, difficulty switch mid-flow, Custom Back), and re-run until it passes. Do not lower the threshold or exclude lines.
- [ ] **Step 5: Commit**
```bash
git add e2e
git commit -m "test: add Cashier, viewport and drag e2e covering main.js"
```

### Task 6: GitHub Actions workflow and README

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: Write `ci.yml`** named `CI`, `on: { push: { branches: [main] }, pull_request: { branches: [main] } }`, jobs:
  - `unit`: `actions/checkout@v4`, `actions/setup-node@v4` (`node-version: 22`, `cache: npm`), `npm ci`, `npm run test:coverage`.
  - `e2e`: same setup, `npm ci`, `npx playwright install --with-deps chromium`, `COVERAGE_ENFORCE=1 npx playwright test`, then `actions/upload-artifact@v4` with `if: failure()` uploading `playwright-report/` and `test-results/`.
- [ ] **Step 2: Update `README.md`:** a "Testing" section (`npm test`, `npm run test:coverage`, `npm run test:e2e`, first-time `npx playwright install chromium`, and the `dwell`, `hold`, `advance` query parameters) and a badge `![CI](https://github.com/WKCheng-Ricky/CoinGame/actions/workflows/ci.yml/badge.svg)` under the title.
- [ ] **Step 3: Verify locally:** `npm ci`, `npm run test:coverage`, `COVERAGE_ENFORCE=1 npx playwright test`; all pass. Check the YAML parses (`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` if PyYAML exists, otherwise re-read it).
- [ ] **Step 4: Commit**
```bash
git add .github README.md
git commit -m "ci: run unit and e2e tests on GitHub Actions"
```
- [ ] **Step 5 (human):** after pushing, confirm both jobs go green on the PR. Branch protection is the repo owner's setting and not part of this plan.
