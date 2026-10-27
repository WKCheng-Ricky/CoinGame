# Coin Game

A lightweight, dependency-free web game: match a target amount using UK coins
(1p to £2). Works on desktop and mobile.

- **Endless:** random targets from £0.01 to £9.99, one after another. Press
  Back to stop.
- **Custom:** type an amount (up to £99.99) and build it with any combination
  of coins.
- **Difficulty:** Easy always shows each coin's value. Normal hides it; hover,
  hold or focus a coin for 2 seconds to read it.

Tap a coin in the tray to add it, tap a coin in your pile to remove it, and
press Check when the total matches.

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
- `src/game.js`: pure game logic (money is integer pence)
- `src/render.js`: coin SVGs and DOM rendering
- `src/main.js`: state and event wiring
- `docs/superpowers/`: design spec and implementation plan
