# Coin Game

![CI](https://github.com/WKCheng-Ricky/CoinGame/actions/workflows/ci.yml/badge.svg)

A lightweight, dependency-free web game: match a target amount using UK coins
(1p to £2). Works on desktop and mobile.

- **Endless:** random targets from £0.01 to £9.99, one after another. Press
  Back to stop.
- **Custom:** type an amount (up to £99.99) and build it with any combination
  of coins.
- **Cashier:** a customer's coins are on the counter. Add them up and type the
  total; Check says if it is too high or too low. After a correct answer, Next
  brings the next customer, and "Customers served" counts them. Counter coins
  can be dragged around but not added or removed. Difficulty applies here too.
- **Choose a game:** on Home the three modes sit in a "Choose a game" box; one
  tap on Endless, Custom or Cashier starts it.
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
Enter on a focused coin or button keeps its own meaning, and after a correct answer
it does nothing.

- **Tray in the bar:** on the play screens the message, the coin tray and the
  buttons sit in a bar that stays at the bottom of the screen, so a wrong Check
  ("Too high", "Too low") is always visible. On a phone the tray is two rows of
  four; on a wide screen it is one row with the buttons beside it.
- **Running total:** "Your total" is shown only in Easy, so in Normal adding a
  coin does not give its hidden value away.

- **Theme:** Auto (the default) follows the device's light or dark setting. The
  round icon button in the top-right corner of Home cycles Auto, Light, Dark with
  each press (the icon and its label show the current choice). The choice is saved
  in the browser. Browsers older than 2024 (no CSS `light-dark()`) show the light
  theme and no theme button.
- **Reference grid:** the pile and the tray have a faint graph-paper grid where
  one square is 1 cm on a real coin, at the coins' own scale, so coins of near
  sizes (1p and 5p, 20p and 50p) can be compared by eye.

Plain HTML, CSS and JavaScript (ES modules). No build step, no dependencies.

## Run

Browsers block ES modules loaded from `file://`, so serve the folder with any
static server:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

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
  plus `e2e/theme.spec.js` (the theme button, cycling and saving), `e2e/phone.spec.js`
  (sticky bars on phone sizes, centred Home), `e2e/home.spec.js` (the "Choose a game"
  box and difficulty notes), `e2e/dock.spec.js` (the tray in the bottom bar, the
  total in Normal and Easy), `e2e/enter.spec.js` (Enter to Check), `e2e/coins.spec.js` (coin wording and
  rotation), `e2e/grid.spec.js` (coin sizes and grid scale) and `e2e/contrast.spec.js`
  (WCAG contrast in both themes).
- `npm run test:e2e:coverage` also fails if browser coverage of `src/main.js`
  is below 80%.

The e2e tests shorten the game's timers with query parameters, which also work
by hand, e.g. `http://localhost:8000/?dwell=50&hold=50&advance=250`. Each is an
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
- `docs/superpowers/`: design specs and implementation plans
