# Coin Counting Game

![CI](https://github.com/WKCheng-Ricky/CoinGame/actions/workflows/ci.yml/badge.svg)

Play it live on https://wkcheng-ricky.github.io/CoinGame/

Match a target amount using UK coins (1p to £2) by tapping, dragging and stacking them. Works on desktop and mobile, with light and dark themes.

- **Endless:** build random targets from £0.01 to £9.99, one after another.
- **Custom:** type an amount (up to £99.99) and build it.
- **Cashier:** add up a customer's coins and type the total.
- **Give Change:** build a customer's change from the tray.

## Run locally

```
npm start
```

Then open http://localhost:4173. It needs Node 22.22.2 or later, and no `npm install` to play.

## More

- [Gameplay](docs/gameplay.md): modes, controls, options and the leaderboard
- [Development](docs/development.md): tests, timing parameters, CI and deploy, source layout
