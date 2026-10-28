# Coin Game

![CI](https://github.com/WKCheng-Ricky/CoinGame/actions/workflows/ci.yml/badge.svg)

A lightweight, dependency-free web game: match a target amount using UK coins
(1p to £2). Works on desktop and mobile.

- **Endless:** random targets from £0.01 to £9.99, one after another. Press
  Back to stop.
- **Custom:** type an amount (up to £99.99) and build it with any combination
  of coins.
- **Cashier:** a customer's coins are on the counter. Add them up and type the
  total in the bar at the bottom (the field has Check beside it, and Enter checks
  too); Check says if it is too high or too low. After a correct answer, Next
  brings the next customer, and "Customers served" counts them. Counter coins
  can be dragged around but not added or removed. Difficulty applies here too.
- **Choose a game:** on Home the three modes sit in a "Choose a game" box; one
  tap on Endless, Custom or Cashier starts it. None of them is pre-selected: each
  gets an accent border on hover (devices that can hover) and fills with the accent
  colour while pressed. The chosen difficulty has an accent border and bold text.
- **Difficulty:** Easy always shows each coin's value and the running total.
  Normal hides them; hover, hold or focus a coin for 2 seconds to read its
  value. The labels are just "Normal" and "Easy"; hover, focus or press and
  hold one for 2 seconds to read what it means in a note under the box (a hold
  does not change the choice).

In Endless and Custom, tap a coin in the tray to add it, tap a coin in your
pile to remove it. Coins in the pile can be dragged (or moved one at a time with the arrow keys), and
coins can also be dragged from the tray to a spot in the pile. Same coins that
touch stack, and a stack shows its count (×2, ×3, ...); different coins push
apart. Dragging a stack moves it together; hold a coin for 1 second to take it
off the stack, and it stays off when you let go. Press Check when the total matches,
or press Enter (Ctrl+Enter or Cmd+Enter works even while a coin or button has focus).
Enter on a focused coin or button keeps its own meaning. After a correct answer
the Enter shortcut does nothing; pressing Enter again on the focused Next button
presses it, like any button.

- **Phone-sized frame:** the whole app lives in a phone-shaped frame (up to
  433 x 771 px). On a phone it fills the screen; on a bigger screen it is a rounded
  card centred on the page. The page itself never scrolls: on the play screens the
  top bar and the bottom bar stay put and only the area between them scrolls, when
  it has to (for example on a landscape phone).
- **Tray in the bar:** the message, the coin tray (two rows of four) and the
  buttons sit in the bottom bar, so a wrong Check ("Too high", "Too low") is always
  visible. In Cashier the bar holds the amount field instead of the tray.
- **Held keys:** holding Enter or Space never repeat-activates a button on the
  play screen, so a held Enter that solves a round cannot carry on into Next.
- **Running total:** "Your total" is shown only in Easy, so in Normal adding a
  coin does not give its hidden value away.

- **Theme:** Auto (the default) follows the device's light or dark setting. The
  round icon button in the top-right corner of Home cycles Auto, Light, Dark with
  each press (the icon and its label show the current choice). The choice is saved
  in the browser. Browsers older than 2024 (no CSS `light-dark()`) show the light
  theme and no theme button.
- **Coin faces:** each coin has an inner rim line and its wording placed like the
  real coin (for example ONE PENNY up the left of the 1p, FIFTY PENCE along the
  bottom of the 50p, FIVE PENCE straight across the 5p). In dark mode the metals
  are a little darker so the coins do not glare. The Mint's artwork is not drawn.
- **Reference grid:** the pile and the tray have a faint graph-paper grid where
  one square is 1 cm on a real coin, at the coins' own scale, so coins of near
  sizes (1p and 5p, 20p and 50p) can be compared by eye.

Plain HTML, CSS and JavaScript (ES modules). No build step, no dependencies.

## Run

Browsers block ES modules loaded from `file://`, so serve the folder:

```
npm start
```

Then open http://localhost:4173 (set `PORT` to use another port). `npm start`
needs only Node, no `npm install`, and tells the browser not to reuse old files.

Any other static server works too (for example `python3 -m http.server 8000`),
but some servers let the browser keep a stale `src/main.js` beside a newer
`index.html` after an update, which can leave buttons dead. If that happens, or
after pulling new code, hard-refresh with Ctrl+Shift+R (Cmd+Shift+R on a Mac).

## Testing

```
npm install
npm test
npm run test:coverage
npx playwright install chromium
npm run test:e2e
npm run test:e2e:coverage
```

- Node 22.22.2 or later is needed for the dev tooling (jsdom, c8, Playwright);
  the game itself needs nothing.
- `npm test` runs the unit and jsdom tests with Node's built-in test runner.
- `npm run test:coverage` adds a per-file 80% gate on lines,
  branches and functions for `src/` (except `src/main.js`).
- `npx playwright install chromium` is needed once, before the first e2e run.
- `npm run test:e2e` runs the Playwright browser tests: gameplay and drag specs,
  plus `e2e/theme.spec.js` (the theme button, cycling and saving), `e2e/frame.spec.js`
  (the phone-sized frame on seven screen sizes, no page scroll, the drag ghost),
  `e2e/phone.spec.js` (bars on phone sizes, centred Home), `e2e/home.spec.js` (the
  "Choose a game" box and difficulty notes), `e2e/home-feedback.spec.js` (hover,
  pressed and selected states), `e2e/dock.spec.js` (the tray in the bottom bar, the
  total in Normal and Easy), `e2e/cashier-dock.spec.js` (the Cashier field in the
  bar), `e2e/enter.spec.js` (Enter to Check, held keys), `e2e/coins.spec.js` (coin
  wording, metals and rotation), `e2e/grid.spec.js` (coin sizes and grid scale),
  `e2e/server.spec.js` (the static server's cache header) and `e2e/contrast.spec.js`
  (WCAG contrast in both themes).
- The e2e specs run in parallel, one spec file per worker: 6 workers locally, 2 when
  `CI` is set. Set `E2E_WORKERS=n` to change it (`E2E_WORKERS=1` runs them in order).
- `npm run test:e2e:coverage` also fails if browser coverage of `src/main.js`
  is below 80%.

The e2e tests shorten the game's timers with query parameters, which also work
by hand, e.g. `http://localhost:4173/?dwell=50&hold=50&advance=250`. Each is an
integer number of milliseconds from 0 to 10000 (0 changes how the game plays:
`hold=0` detaches coins instantly so stacks cannot be dragged as a group, and
`advance=0` removes the double-press guard):

- `dwell`: how long a coin is held before its value is revealed.
- `hold`: how long a coin is held to separate it from a stack.
- `advance`: the guard after a correct Cashier answer before Next works.

## Deploy

Any static host works, e.g. GitHub Pages.

## Layout

- `src/coins.js`: coin data
- `src/game.js`: pure game logic (money is integer pence, pile placement and settling)
- `src/state.js`: pure game state transitions
- `src/drag.js`: drag geometry and the pile and tray drag controllers
- `src/dwell.js`: hold-to-reveal timers
- `src/keys.js`: the Enter / Ctrl+Enter "Check" shortcut test
- `src/shapes.js`: coin outline geometry (polygons, Reuleaux heptagon, curved lettering)
- `src/theme.js`: reading, saving, applying and cycling the theme choice
- `theme-boot.js`: classic script that applies a saved theme before first paint
- `src/render.js`: coin SVGs and DOM rendering
- `src/main.js`: app state and event wiring
- `e2e/serve.js`: the static server behind `npm start` and the e2e tests
- `docs/superpowers/`: design specs and implementation plans
