# Coin Game

![CI](https://github.com/WKCheng-Ricky/CoinGame/actions/workflows/ci.yml/badge.svg)

Match a target amount using UK coins (1p to £2). Works on desktop and mobile.

Play it live on https://wkcheng-ricky.github.io/CoinGame/

## Highlights

- **Four game modes:** Endless, Custom, Cashier and Give Change.
- **Options:** tick **Show Coins** to see every coin's value and your running total (off is the challenge). Some modes have their own, such as Give Change's **Short-paying customers**.
- **Hands-on coins:** tap, drag and stack coins. Same coins stack and show a count.
- **Realistic coins:** real sizes, shapes and wording, plus a 1 cm reference grid so
  near-sized coins (1p and 5p, 20p and 50p) can be compared by eye.
- **Light and dark themes:** follows the device by default, or pick one.
- **Phone-sized frame:** fills a phone screen, or sits as a card on a larger one.
- **Plain HTML, CSS and JavaScript (ES modules):** no build step, no dependencies.

## How to play

| Mode | What you do |
| --- | --- |
| **Endless** | Build random targets from £0.01 to £9.99, one after another. Press Back to stop. |
| **Custom** | Type an amount (up to £99.99) and build it with any coins. |
| **Cashier** | A customer's coins are on the counter. Add them up, type the total and press Check. Next brings the next customer. |
| **Give Change** | A customer pays for an item. Build their change from the tray and press Check, or press **No change** if they paid exactly or **Not enough!** if they paid too little (with **Short-paying customers** on, the default). Next brings the next customer. |

Pick a mode on Home, set any options, then press **Play**.

**Controls (Endless and Custom)**

- Tap a coin in the tray to add it; tap a coin in your pile to remove it.
- Drag coins around the pile, or from the tray into it. Arrow keys move a focused coin.
- Dragging a stack moves it together; hold a coin for 1 second to take it off the stack.
- With Show Coins off, hover, focus or hold a coin for 2 seconds to read its value.
- Press **Check** or **Enter** when the total matches. Ctrl/Cmd+Enter works even while a coin or button has focus.

In Cashier, counter coins can be dragged but not added or removed, and Enter in the amount field checks too.

In Give Change, the customer's coins sit in the top bar under the price, in a 4 cm strip; they can be dragged apart but
not added or removed. Below is the "Your change" card with a 6 cm pile (4 cm on screens shorter than 700 px, such
as an iPhone SE or a landscape phone): tray coins go there and are tapped, dragged and stacked as in Endless, and
**Not enough!** and **No change** sit under it. The tray, Check and Clear are at the bottom, as in Endless; Clear
empties only your change. Every pile and the tray use the same coin size. On a portrait phone (375 × 667 and up) the
screen fits without scrolling; in a short landscape window the middle scrolls. Show Coins shows the running total of your
change, and turning off Short-paying customers means nobody underpays.

## Quick start

```
npm start
```

Then open http://localhost:4173 (set `PORT` to use another port). It needs only
Node 22.22.2 or later, with no `npm install`.

Browsers block ES modules from `file://`, so the folder must be served. Other static
servers work, but may serve a stale `src/main.js`; hard-refresh (Ctrl+Shift+R) if buttons go dead.

## Development

```
npm install
npm test                    # unit and jsdom tests (Node's test runner)
npm run test:coverage       # adds an 80% per-file gate on src/ (except main.js)
npx playwright install chromium   # once, before the first e2e run
npm run test:e2e            # Playwright browser tests in e2e/
npm run test:e2e:coverage   # also fails if src/main.js browser coverage is under 80%
```

E2E specs run in parallel (6 workers locally, 2 when `CI` is set; override with
`E2E_WORKERS=n`).

**Timing query parameters.** The e2e tests shorten timers this way, and you can too,
e.g. `http://localhost:4173/?dwell=50&hold=50&advance=250`. Each is an integer
number of milliseconds from 0 to 10000.

| Parameter | Controls | Note |
| --- | --- | --- |
| `dwell` | How long a coin is held before its value shows | |
| `hold` | How long a coin is held to separate it from a stack | `0` detaches instantly, so stacks cannot be dragged as a group |
| `advance` | Guard after a correct Cashier or Give Change answer before Next works | `0` removes the double-press guard |

## Deploy

Live at https://wkcheng-ricky.github.io/CoinGame/.

Every push to `main` runs CI; if the `unit` job passes, the `deploy` job publishes
`index.html`, `styles.css`, `theme-boot.js`, `src/` and `fonts/` to GitHub Pages. Pull
requests run CI but never deploy. The `e2e` browser job is paused for now (`if: false` in
`.github/workflows/ci.yml`; the e2e specs and `npm run test:e2e` still work locally), and
re-enabling it means deleting that line and adding `e2e` back to the `deploy` job's `needs`.

One-time setup: set Pages > Source to "GitHub Actions" in the repository settings.
Any static host also works, since there is no build step.

## Project layout

- `src/coins.js`: coin data
- `src/game.js`: pure game logic (money is integer pence, pile placement and settling)
- `src/state.js`: pure game state transitions
- `src/drag.js`: drag geometry and the pile and tray drag controllers
- `src/dwell.js`: hold-to-reveal timers
- `src/keys.js`: the Enter / Ctrl+Enter "Check" shortcut test
- `src/shapes.js`: coin outline geometry
- `src/theme.js`: reading, saving, applying and cycling the theme
- `theme-boot.js`: applies a saved theme before first paint
- `src/render.js`: coin SVGs and DOM rendering
- `src/main.js`: app state and event wiring
- `e2e/serve.js`: the static server behind `npm start` and the e2e tests
- `docs/superpowers/`: design specs and implementation plans, including detailed
  behaviour notes (frame sizes, key handling, coin lettering)
