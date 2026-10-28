# Automated test suite and GitHub CI: Design Spec

Date: 2026-10-28
Builds on: all earlier specs, including Cashier mode (merged in PR #5).

## Purpose

Make regressions visible before they merge. The 163 existing unit tests cover
the pure logic, but the DOM wiring (`render.js`, `drag.js`, `main.js`) has little
or no automated coverage, and that is where the Cashier bugs were found (stale
pile buttons, a helper that shadowed an import and broke `main.js`, the 400 ms
guard, focus management). Add a DOM-level unit layer, a browser e2e suite that
also covers `main.js`, and a GitHub workflow that runs both on every push and
pull request.

## Requirements

- **Game code changes are limited to one thing:** a small timing config (see
  below) so tests can shorten the waits. No other change to `src/`,
  `index.html` or `styles.css` for the sake of testing. The defaults keep
  today's behaviour exactly.
- **Unit coverage.** Every file in `src/` except `main.js` reaches at least 80%
  lines, branches and functions, enforced per file by a threshold that fails
  the run.
- **`main.js` coverage.** The e2e run collects browser (V8) coverage for
  `src/*.js` and `main.js` must reach at least 80% line coverage there, also
  enforced.
- **e2e suite.** Playwright, Chromium only, about 20 tests: the main flow of
  each mode, the known past bugs, and the drag interactions players use to
  inspect covered coins. Short enough to run in a few minutes in CI.
- **CI.** A GitHub Actions workflow runs the unit job and the e2e job in
  parallel on `push` and `pull_request` for `main`.
- The shipped game keeps no build step and no runtime dependencies.

## Timing config

Three waits are hard-coded today: `DWELL_MS = 2000` (hold to reveal a coin's
value, `dwell.js`), `DETACH_HOLD_MS = 1000` (hold to separate a coin from a
stack, `drag.js`) and `ADVANCE_DELAY_MS = 400` (Next ignored right after a
correct answer, `state.js`). Make them configurable:

- New `src/config.js` exports `TIMING_DEFAULTS = { dwellMs, detachHoldMs,
  advanceDelayMs }` (built from the three existing constants, so the values
  live in one place) and `timingFromSearch(search)`, which reads the URL query
  parameters `dwell`, `hold` and `advance` (milliseconds) and returns a full
  timing object. A value counts only if it is an integer from 0 to 10000;
  anything else falls back to the default. No parameters gives the defaults.
- `createDrag` takes an optional `holdMs` (default `DETACH_HOLD_MS`);
  `canAdvance(state, now, delayMs = ADVANCE_DELAY_MS)`; `createDwell` already
  takes `delay`. `main.js` calls `timingFromSearch(location.search)` once and
  passes the values in.
- The existing constants stay exported so current tests are unchanged.
- This is also the seam a future settings page would write to.
- Because the game is a static page, a query string is visible and editable by
  anyone. That is accepted: it only changes waits, and it is the simplest way
  for a test to set them.

## Drop outside the board

Today a pile coin released outside the pile area is pinned to the nearest edge
inside it: `createDrag` passes the unclamped fraction (`toPileFraction` says so)
and `moveCoin` in `state.js` clamps it with `clampPosition` to the range -0.5 to
0.5. A tray coin released outside the pile area is not added and returns to the
tray. This is the intended behaviour and the tests pin it; a short comment in
`drag.js` at the `onMove` call will say where the clamping happens.

## Unit tests (jsdom)

- Dev dependencies: `jsdom`, `c8`.
- Helper `tests/dom-helper.js` creates a jsdom document and exposes `document`
  and `window` globals, plus a pointer-event factory. jsdom has no layout, so
  `getBoundingClientRect` and the container's client sizes are stubbed to a
  fixed board size.
- `tests/render.dom.test.js` (for `render.js`): button labels, button reuse only
  when uid and coin match (the stale-pile regression), `removable` labels,
  stack badges, removal of departed coins, `renderTray`, `setText`, `announce`.
- `tests/drag.dom.test.js` (for `drag.js`): drag past the threshold, release
  outside the board passes unclamped fractions, tap vs drag, second pointer
  ignored, locked pile, hold-to-detach with a short `holdMs`, group drag, tray
  drop inside and outside the pile.
- Tests for `config.js`, and for the new `holdMs` and `delayMs` options.
- Coverage uses `c8` (V8's built-in coverage, no experimental Node flag):
  `c8 --check-coverage --lines 80 --per-file --include 'src/**' --exclude
  'src/main.js' node --test`, as the `test:coverage` script.

## e2e tests (Playwright)

- Dev dependencies: `@playwright/test`, `monocart-coverage-reports`. Tests live
  in `e2e/`, config in `playwright.config.js`, Chromium project only.
- `e2e/serve.js`: a short Node static file server, started by the config's
  `webServer` option. No Python and no extra package.
- **Fast timing.** Tests open pages with query parameters (for example
  `?dwell=50&hold=50&advance=250`). The 400 ms guard test still proves the guard
  works: an early Next is ignored and one after the shortened delay advances.
- **Determinism for Cashier.** A helper calls `page.addInitScript()` to replace
  `Math.random` with a seeded generator inside the browser tab before the page
  loads. This runs from the test file only and never ships with the game. The
  expected total is read from the page's own "On the counter" summary and
  summed with the coin values from `src/coins.js`, so tests never depend on the
  seed's output.
- **Coverage.** Playwright runs with a single worker so coverage collects in one process. A Playwright fixture starts `page.coverage` JS coverage for each
  test, feeds the entries to `monocart-coverage-reports`, and a global teardown
  writes an lcov report to `coverage/e2e` and fails if `src/main.js` is under
  80% lines.
- Tests (about 20): Home buttons; Custom build, check, Play again, Change
  amount, and invalid amount; Endless counter and Next; Clear and Back; the
  Easy/Normal toggle; Cashier invalid input, hints, correct answer with Enter,
  Next guard, non-removable coins; Easy and Normal at 390x844 with no
  horizontal overflow; dwell-to-reveal by mouse hover; dragging a coin with the
  mouse; arrow-key moving; dropping outside the board pins the coin to the
  nearest edge; holding a coin in a stack separates it; dragging a stack as a
  group; dragging a tray coin onto the pile and dropping one outside it. More
  tests are added only as needed to bring `main.js` to 80%.

## CI

- `.github/workflows/ci.yml`, triggers `push` and `pull_request` on `main`.
- **`unit`:** checkout, Node 22, `npm ci`, `npm run test:coverage`.
- **`e2e`:** checkout, Node 22, `npm ci`,
  `npx playwright install --with-deps chromium`, `npx playwright test`. On
  failure it uploads the Playwright report and traces as artifacts.
- Jobs run in parallel. npm cache is keyed on `package-lock.json`.
- Repo files added: `package-lock.json` (committed), `.gitignore` covering
  `node_modules/`, `coverage/`, `test-results/` and `playwright-report/`, a
  README "Testing" section and a CI status badge.

## Out of scope

Branch protection and merge rules (configured by the repo owner), Firefox and
WebKit, visual regression screenshots, a settings page (only the config seam),
and any change to game behaviour.

## Risks

- Playwright browser download adds CI time. Mitigated with Chromium only.
- jsdom differs from a real browser for pointer and layout behaviour, so drag
  correctness is confirmed by the e2e drag tests rather than by jsdom alone.
- Seeding `Math.random` assumes the game keeps using it for customer coins. If
  that changes, the seed helper is the single place to update.
- Browser coverage depends on `monocart-coverage-reports` reading Playwright's
  V8 data for plain ES modules served over HTTP, which its README does not show.
  Task 4 first confirms `main.js` reports real line coverage. If not, the
  fallback is Istanbul instrumentation: `nyc instrument` a copy of `src/`,
  serve that copy during e2e, and read `window.__coverage__` per test.
- The suite runs with one worker, so coverage collects in one process. Going
  parallel later means using Monocart's shared cache folder.
