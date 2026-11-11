# Development

## Running locally

```
npm start
```

Then open http://localhost:4173 (set `PORT` to use another port). It needs only
Node 22.22.2 or later, with no `npm install`.

Browsers block ES modules from `file://`, so the folder must be served. Other static
servers work, but may serve a stale `src/main.js`; hard-refresh (Ctrl+Shift+R) if buttons go dead.

## Commands

```
npm install
npm test                    # unit and jsdom tests (Node's test runner)
npm run test:coverage       # adds an 80% per-file gate on src/ (except main.js)
npx playwright install chromium webkit   # once, before the first e2e run
npm run test:e2e            # happy-path browser tests in e2e/ (Chromium and WebKit, no coverage gate)
npm run test:e2e:extended   # the older detailed specs in e2e/extended/ (not run in CI)
```

`npm run test:e2e` runs a boot check, one happy-path spec per mode, and the WebKit label spec.

The specs in `e2e/extended/` are kept for local use only and are not run in CI. On 2026-11-11 the tests that
failed against the current UI were deleted; the 112 that remain all passed (about 35 seconds on Chromium).

E2E specs run in parallel (6 workers locally, 2 when `CI` is set; override with
`E2E_WORKERS=n`).

**Timing query parameters.** The e2e tests shorten timers this way, and you can too,
e.g. `http://localhost:4173/?dwell=50&hold=50&advance=250`. `dwell`, `hold`, `advance` and
`unserved` are integer milliseconds from 0 to 10000; `par` is whole seconds from 1 to 600.
Anything else falls back to the default.

| Parameter | Controls | Note |
| --- | --- | --- |
| `dwell` | How long a coin is held before its value shows | |
| `hold` | How long a coin is held to separate it from a stack | `0` detaches instantly, so stacks cannot be dragged as a group |
| `advance` | Guard after a correct Cashier or Give Change answer before Next works | `0` removes the double-press guard |
| `unserved` | How long an unserved customer stays on screen before the next one | Used instead of `advance` after an unserved answer |
| `par` | Par time for every timed mode, in seconds (not milliseconds) | Overrides the per-mode par; 1 to 600 |

## CI and Deploy

Live at https://wkcheng-ricky.github.io/CoinGame/.

Every push to `main` runs CI as three jobs: `unit` (`npm run test:coverage`) and `e2e`
(`npm run test:e2e`, the happy-path suite on Chromium and WebKit) run in parallel, and `deploy`
waits for both. If both pass, it publishes `index.html`, `styles.css`, `theme-boot.js`,
`favicon.svg`, `apple-touch-icon.png`, `src/` and `fonts/` to GitHub Pages. Pull requests run CI but never deploy.

One-time setup: set Pages > Source to "GitHub Actions" in the repository settings.
Any static host also works, since there is no build step.

## Source layout

`src/` has six layers, and imports only point downward:
`main` -> `controllers` / `views` -> `services` -> `models` -> `constants` / `utils`.
`tests/architecture.test.js` guards this, and `tests/` mirrors `src/`.

- `src/main.js`: app state and event wiring
- `src/controllers/`: `drag.js` (drag geometry and the pile and tray drag controllers), `dwell.js` (hold-to-reveal timers), `shortcuts.js` (the Enter / Ctrl+Enter "Check" shortcut test)
- `src/views/`: `choice-dialog.js`, `coin-svg.js`, `home-view.js`, `icons.js`, `leaderboard-view.js`, `pile-view.js`, `summary-view.js` (coin SVGs, DOM rendering and screens)
- `src/services/`: `scores.js`, `storage.js`, `theme.js` (reading, saving, applying and cycling the theme), `url-params.js`
- `src/models/`: `customer.js`, `game-state.js` (pure game state transitions), `money.js` (money is integer pence), `pile.js` (pile placement and settling), `session.js`
- `src/constants/`: `coins.js` (coin data), `modes.js`, `options.js`, `timing.js`
- `src/utils/`: `shapes.js` (coin outline geometry)

Outside `src/`:

- `theme-boot.js`: applies a saved theme before first paint
- `scripts/serve.js`: the static server behind `npm start` and the e2e tests
- `docs/superpowers/`: design specs and implementation plans, including detailed
  behaviour notes (frame sizes, key handling, coin lettering)
