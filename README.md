# Coin Game

A lightweight, dependency-free web game: match a target amount using UK coins
(1p to £2). Works on desktop and mobile.

- **Endless:** random targets from £0.01 to £9.99, one after another. Press
  Back to stop.
- **Custom:** type an amount (up to £99.99) and build it with any combination
  of coins.
- **Difficulty:** Easy always shows each coin's value. Normal hides it; hover,
  hold or focus a coin for 2 seconds to read it.

Tap a coin in the tray to add it, tap a coin in your pile to remove it. Coins
in the pile can be dragged (or moved one at a time with the arrow keys), and
coins can also be dragged from the tray to a spot in the pile. Same coins that
touch stack, and a stack shows its count (×2, ×3, ...); different coins push
apart. Dragging a stack moves it together; hold a coin for 1 second to take it
off the stack, and it stays off when you let go. Press Check when the total matches.

Plain HTML, CSS and JavaScript (ES modules). No build step, no dependencies.

## Run

Browsers block ES modules loaded from `file://`, so serve the folder with any
static server:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Test

```
npm test
```

Uses Node's built-in test runner (Node 18+). No packages to install.

## Deploy

Any static host works, e.g. GitHub Pages.

## Layout

- `src/coins.js`: coin data
- `src/game.js`: pure game logic (money is integer pence, pile placement and settling)
- `src/state.js`: pure game state transitions
- `src/drag.js`: drag geometry and the pile and tray drag controllers
- `src/dwell.js`: hold-to-reveal timers
- `src/render.js`: coin SVGs and DOM rendering
- `src/main.js`: app state and event wiring
- `docs/superpowers/`: design specs and implementation plans
