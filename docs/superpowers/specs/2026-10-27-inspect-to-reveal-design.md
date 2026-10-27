# Inspect-to-reveal and Easy mode: Design Spec

Date: 2026-10-27
Builds on: `2026-10-27-coin-game-design.md`
Part 1 of 4 (see also `2026-10-27-messy-pile-design.md`,
`2026-10-27-drag-coins-design.md` and `2026-10-27-cashier-mode-design.md`).
Build order: this spec, then messy pile, then draggable coins, then cashier
mode.

## Purpose

Real coins do not announce their value in large print; you read the small
lettering by looking closely. In Normal difficulty, coin values are hidden until
the player inspects a coin for a moment. Easy difficulty keeps today's behaviour
of always showing values.

## Requirements

- **Difficulty setting.** Home gets an Easy/Normal toggle. It is a single global
  setting that applies to every mode (Endless, Custom and, later, Cashier). The
  default is Normal. It is kept in state only; no persistence (reload resets it,
  consistent with v1).
- **Normal.** Coins are drawn without their value text. Shape, size, colour and
  ring still show, as they do on real coins. This applies to tray coins and pile
  coins.
- **Easy.** Value text is always shown, as today.
- **Inspect (Normal only).** Dwelling on a coin for about 2 seconds fades its
  value text in on that coin. Dwelling means any of:
  - mouse pointer hovering over the coin,
  - a finger or pen resting on the coin (touch/pen pointer held down),
  - keyboard focus on the coin.
  The value fades out when the dwell ends (pointer leaves, touch released,
  focus moves away).
- **Inspect does not change gameplay.** Tapping or clicking a coin still adds or
  removes it exactly as before. A tap shorter than the dwell time never reveals
  anything. A long touch that reveals a value still performs its normal tap
  action on release (it must not be swallowed or turned into a context menu;
  `-webkit-touch-callout: none` and `contextmenu` suppression on coins).
- **Dwell constant.** `DWELL_MS = 2000`, one named constant.
- **Reduced motion.** With `prefers-reduced-motion: reduce` the fade is instant.
- **Accessibility.** The button accessible names ("Add 20p") are unchanged.
  Hiding the printed value is a visual challenge, not an access barrier: screen
  reader users always hear the denomination. This is deliberate and noted here
  so it is not "fixed" later.

## Design

### `src/dwell.js` (new, no DOM)

A small timer helper that can be unit-tested with a fake clock:

- `createDwell({ delay, onReveal, onHide, setTimer, clearTimer })` returns
  `{ start(key), stop(key) }`.
- `start(key)` schedules `onReveal(key)` after `delay`; calling it again for the
  same key while pending is a no-op.
- `stop(key)` cancels a pending timer and calls `onHide(key)` if the key was
  revealed.
- Timer functions are injectable (default `setTimeout`/`clearTimeout`).

### `src/render.js`

- `coinSvg(coin, { easy })`: the label `<text>` is always emitted, with class
  `label`. In Normal it is hidden by CSS (`opacity: 0`) until the coin button
  has the `revealed` class, so the fade is a CSS transition. In Easy it is
  always visible. (Exact markup is an implementation detail for the plan; the
  contract is the observable behaviour above.)
- Rendering does not know about timers.

### `src/main.js`

- Wires `pointerenter`/`pointerleave`, `pointerdown`/`pointerup`/
  `pointercancel`, and `focusin`/`focusout` on the tray and pile containers
  (delegated) to `dwell.start/stop` keyed by the coin element.
- Difficulty toggle on Home updates `state.difficulty` and re-renders.
- Re-rendering the pile replaces its buttons; any pending dwell on a removed
  element is cancelled.

### `src/state.js`

- `createState()` gains `difficulty: "normal"`.
- `setDifficulty(state, "easy" | "normal")` returns a new state.
- `startGame` and `nextRound` keep the difficulty.

### `index.html` / `styles.css`

- Toggle on Home implemented as two radio inputs (or a pressed-state button
  pair) with a visible label, keyboard operable.
- `.coin .label { transition: opacity 200ms; }`, hidden in Normal until
  `.revealed`.

## Edge cases

- Switching to Easy and back mid-session is only possible from Home, so no round
  is ever re-rendered with a different difficulty.
- A coin that is revealed and then removed from the pile simply disappears.
- Touch: if the pointer moves off the coin while held, the dwell stops.

## Testing

- `dwell.js` unit tests with a fake timer: reveals after the delay, not before;
  `stop` before the delay cancels; `stop` after reveal calls `onHide`; repeated
  `start` does not double-schedule; independent keys do not interfere.
- `render.js` tests: Easy markup marks the label visible; Normal markup marks
  it hidden until `.revealed`; button `aria-label` unchanged in both.
- `state.js` tests: default difficulty is Normal; `setDifficulty`; difficulty
  survives `startGame` and `nextRound`.
- Manual: desktop hover, touch hold on a phone-sized viewport, keyboard Tab
  focus, and that quick taps still add coins.

## Out of scope

Persisting the difficulty, a per-mode difficulty, a magnifier tool, sound,
timed penalties, or realistic coin artwork.
