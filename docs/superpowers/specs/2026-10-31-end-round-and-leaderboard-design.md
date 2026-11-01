# End a session and the leaderboard: Design Spec

Date: 2026-10-31
Source: owner feedback in `docs/coin_game_comment/coin game.md` (line 12)
Builds on: `2026-10-30-timing-stacking-and-option-clarity-design.md` (timer, score, time limit), `2026-10-31-branding-and-home-chrome-design.md` (top bar)
Part of four specs from the same feedback: `branding-and-home-chrome` (A), `play-screen-fixes` (B), this one (C), `short-pay-rate` (D).

## Purpose

A timed game cannot be stopped today: with a time limit, a customer who runs out of time just leaves and the next one arrives, so the score is never banked. The owner wants:

1. A way to **end the session** and bank the score.
2. A **leaderboard** of past scores.
3. A cleaner game top bar: no "Back" word, just the "‹".

## Decisions (from the owner)

- The play screen's top bar is: **‹ on the left (Back, no label), the price in the centre, an End button on the right.** End works like Back (it leaves the game) but when the session is scored it first **totals the score**. When there is no score (Easy, Custom), End is just another Back.
- **Both End and Back ask for confirmation in a scored session, and the clock stops while the question is open.** Back asks whether to leave without saving the score; choosing to save does what End does.
- **Leaderboard is local only**: scores live in the browser (`localStorage`) on that device. There is no server, no accounts and no names. The storage sits behind a small interface so an online board could replace it later without redoing the screens.
- **One board per game mode and difficulty**: Endless, Cashier and Give Change, each at Normal, Hard and Very hard. A Very hard score is never ranked against a Normal one. Easy has no timer and so no board.
- E2E specs are not touched (paused CI job stays paused).

## Play screen top bar (`index.html`, `src/main.js`, `styles.css`)

- `#btn-back` shows only the "‹" glyph (`&lsaquo;`), at least 44 x 44 px, with `aria-label="Back"` and `title="Back"`. It leaves the game; when a score is being kept it first asks whether to save it (see Confirmations).
- A new `#btn-end` sits on the right of the top bar: a flag (finish) icon, at least 44 x 44 px, `aria-label="End and score"`, `title="End and score"`. No visible text, mirroring the Back button, and the Options button in spec A.
- **End is always shown**, in every mode and with every option set. What it does depends on whether the session is scored (the mode is Endless, Cashier or Give Change and the timer is on, `timerOn(options)`):
  - **Scored:** it asks to confirm, then banks the score and opens the Summary (below).
  - **Not scored** (Custom mode, or Timer and Score off, as in Easy): there is no score to bank, so it behaves exactly like Back: it leaves the game at once, with no dialog.
- The price and the clock/score lines stay in the centre. In Give Change the top bar already wraps to hold the customer's coins; End stays on the same row as Back and the price.

## Confirmations (scored sessions only)

Both dialogs are a native `<dialog>` opened with `showModal()` (focus is trapped, Escape means "Keep playing", the focus goes to the first button). They appear only when the session is scored.

- **While a dialog is open, the clock stops.** The round timer, the time-limit countdown and the score timing all pause, and resume when the dialog is dismissed with "Keep playing" (the paused time is added to `roundStartedAt`, so nothing is lost or gained). The pause is a pure state helper (`pauseClock` / `resumeClock` in `src/state.js`) so it is unit tested. Coins cannot be dragged while the dialog is up (it is modal).
- **End** shows "End the session and save your score?" with two buttons: **End and save** (banks the score and opens the Summary) and **Keep playing** (resumes the clock).
- **Back** (‹), when the score is above 0, shows "Leave without saving your score?" with three buttons: **Save score and leave** (does exactly what End does), **Leave without saving** (goes home, nothing recorded) and **Keep playing** (resumes). With a score of 0 there is nothing to save, so Back leaves at once.
- Back and End when the session is not scored never show a dialog.

## Ending a session

Pressing End (state function `endSession`, pure, in `src/state.js`):

- Freezes the clock and the score. The round in progress, if unanswered, scores nothing.
- Builds a result `{ mode, preset, score, served, at }`:
  - `score`: `state.score` as shown on screen.
  - `served`: `state.rounds` (customers served, or rounds completed in Endless).
  - `preset`: the difficulty id that the options match (`presetOf(options)`: `normal`, `hard`, `veryHard`), or `null` when the options match no preset ("Custom settings").
  - `at`: the end time (ISO date string).
- Records the result on the board `"<mode>:<preset>"` if `preset` is not null and `score` is greater than 0.
- Opens the **Summary** screen.

A result with a score of 0 is not stored (nothing to rank). A result under custom settings is shown but not ranked, and the summary says so ("Custom settings are not ranked").

## Summary screen (new `screen-summary`)

- Heading focused on open: "Session over" (add to `SCREENS` and the screen focus handling like the other screens).
- Shows: the mode and difficulty ("Give Change, Hard"), the **score**, **customers served**, and the **rank** on that board ("Rank 3 of 10", "New best score!" for rank 1, or "Not in the top 10").
- Buttons: **Play again** (starts the same mode with the same options, score reset), **Leaderboard** (opens the leaderboard on this board), **Home**.

## Leaderboard

### Storage (`src/scores.js`, new, pure and storage-injected like `src/theme.js`)

- One `localStorage` key, `coin-counting-game-scores`, holding JSON: `{ "<mode>:<preset>": [ { score, served, at }, ... ] }`.
- Each board keeps the **top 10**, sorted by score (high to low), ties ordered with the earlier result first.
- Interface (an object made from a storage, so tests use a fake and a later online store matches the same shape):
  - `list(boardId)` returns the board's entries.
  - `add(boardId, entry)` stores an entry and returns its 1-based rank, or `null` if it did not make the top 10.
  - `clear()` removes every board.
- Reading and writing are wrapped in try/catch like `theme.js`: blocked storage means nothing is saved and the leaderboard is empty, and the game still works. Corrupt JSON or entries of the wrong shape are discarded, not crashed on.
- The browser's own storage limits are not a concern at this size.

### Leaderboard screen (new `screen-leaderboard`)

- Heading "Leaderboard", a ‹ Back button (to wherever it was opened from: Home or Summary), a focus-on-open heading.
- A **mode** selector (Endless, Cashier, Give Change) and a **difficulty** selector (Normal, Hard, Very hard), both native radio groups in the existing segmented style. Opened from the Summary it starts on that result's board and highlights its row.
- The list shows rank, score, customers served and date, as a table with a caption, or "No scores yet. Play a timed game and press End to add one." when empty.
- A **Clear scores** button at the bottom with a confirm step (a second press, "Press again to clear all scores"), because it deletes data.

### Home entry point

A trophy icon button (icon-only, `aria-label="Leaderboard"`) sits in the home top bar next to the theme toggle (the bar is built in spec A to hold it). Add the `trophy` icon to `src/icons.js`.

## State and flow notes

- `SCREENS` gains `summary` and `leaderboard`. Moving between screens uses the existing show/focus logic in `src/main.js`.
- `endSession` is a pure function (state in, result and new state out) so it is unit tested without the DOM. Recording goes through the score store, which `main.js` creates from `getStorage(window)`.
- The expired-time-limit behaviour is unchanged: the customer leaves and play continues. End is now the way a limited session is finished.

## Testing

- `tests/scores.test.js` (new): add and rank, top-10 trimming, ties, zero score not stored, corrupt JSON ignored, blocked storage safe, `clear`.
- `tests/state.test.js`: `endSession` result for each mode, preset detection, `null` preset for custom options, zero score, frozen clock.
- `tests/state.test.js`: `pauseClock` / `resumeClock` leave the elapsed time and the time-limit countdown unchanged across a pause.
- DOM tests for the dialogs: End in a scored session opens the confirm and does nothing until "End and save"; "Keep playing" resumes with the clock unchanged; Back with a score opens the three-button dialog and "Leave without saving" records nothing; Back with a score of 0 leaves at once; End and Back in an unscored session leave with no dialog.
- `tests/home.dom.test.js` / a new DOM test: Back has no text and an `aria-label`; End is present in every mode and behaves like Back when unscored; Summary shows rank text; the leaderboard lists entries and respects the mode and difficulty selectors; Clear scores needs two presses.
- `tests/icons.test.js`: the `flag` and `trophy` icons render.
- Manual check of the top bar at 320 px in Give Change (the tightest layout).

## Out of scope

- An online or shared leaderboard, player names, accounts and anti-cheat (the storage interface keeps the door open).
- Ranking Easy or custom-settings sessions.
- E2E specs.
