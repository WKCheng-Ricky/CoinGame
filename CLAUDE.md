# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

CoinGame is a browser coin-counting game with no build step: plain ES modules served as static files.
See [docs/gameplay.md](docs/gameplay.md) for the game and [docs/development.md](docs/development.md)
for setup, timing query parameters, CI and deploy.

## Commands

```
npm start                   # serve on http://localhost:4173 (PORT overrides); no npm install needed
npm test                    # unit and jsdom tests (node --test)
npm run test:coverage       # same, with the 80% per-file gate on src/ (except main.js)
npm run test:e2e            # happy-path Playwright specs (Chromium and WebKit)
npm run test:e2e:extended   # detailed specs in e2e/extended/ (not run in CI)
node --test tests/models/money.test.js   # run one test file
node --test tests/models/*.test.js       # run a folder of test files
npx playwright test <spec-file>          # run one e2e spec
```

Requires Node >=22.22.2 (`engines` in package.json). There is no lint step.

## Architecture

`src/` has six layers. Imports only point downward:

`main` -> `controllers` / `views` -> `services` -> `models` -> `constants` / `utils`

- `src/main.js`: app state and event wiring.
- `controllers/` and `views/` never import each other.
- `models/` is pure game logic; `services/` wraps storage, theme, scores and URL params.
- `tests/architecture.test.js` enforces the layer rule and import paths. `tests/` mirrors `src/`.

Layer contents are listed in [docs/development.md](docs/development.md#source-layout).

## Conventions

- Money is integer pence everywhere; never use floats for amounts.
- No build step, no bundler, no framework: plain ES modules that run directly in the browser.
- Commit messages use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`.

## Testing policy

- Unit tests keep an 80% per-file lines, branches and functions gate on `src/` (except `main.js`).
- E2E is happy path only, with no coverage gate. It runs on Chromium and WebKit in CI and gates deploy.
- The detailed specs in `e2e/extended/` are kept for local use only: not run in CI. The tests that failed against the current UI were deleted on 2026-11-11; the 112 remaining all pass (about 35 s on Chromium).
