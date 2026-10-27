# Inspect-to-reveal and Easy Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In Normal difficulty, hide coin values until the player dwells on a coin for 2 seconds; Easy difficulty (a global toggle on Home) shows them always.

**Architecture:** Difficulty lives in the pure state object. Hiding is done in CSS off a `data-difficulty` attribute on `.board`, so `coinSvg` keeps emitting the label with a class and needs no new parameter. A small DOM-free `dwell.js` timer helper (injectable timers) drives a `revealed` class on the coin button; `main.js` only wires delegated pointer and focus events to it.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node built-in test runner (`node --test`). No dependencies.

**Spec:** `docs/superpowers/specs/2026-10-27-inspect-to-reveal-design.md` (parent: `2026-10-27-coin-game-design.md`)

## Global Constraints

- Static site: plain HTML, CSS, vanilla JS ES modules. No backend, no build step, no runtime or test dependencies.
- All money is integer pence. Not touched by this plan, do not introduce floats.
- `DWELL_MS = 2000`, one named constant, exported from `src/dwell.js`.
- Difficulty is `"normal"` (default) or `"easy"`, one global setting, state only, no persistence.
- Button accessible names ("Add 20p", "Remove one 20p (N in pile)") are unchanged.
- Tapping or clicking a coin adds or removes it exactly as before; a dwell never changes gameplay.
- Fade is 200 ms CSS opacity transition; instant under `prefers-reduced-motion: reduce`.
- Tap targets stay at least 44px; the 320px-wide layout must not gain horizontal scroll.
- Only `render.js` and `main.js` touch the DOM; `state.js`, `game.js`, `dwell.js` are importable in Node.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Mouse click on a coin focuses it. Focus must not start a dwell (only keyboard focus does), or the value appears 2 s after any click and stays while the pointer is elsewhere.
2. Pointer leaves a coin before 2 s, or moves quickly across several coins: no label ever appears and no stale timer fires later.
3. The pile re-renders (add/remove coin, message update) while a coin is being dwelt on: the pending timer must be cancelled and no label stuck `revealed` on a removed element.
4. Difficulty must survive `startGame` (Back to Home, then a new game) and `nextRound`; an invalid difficulty value must be ignored.
5. A long touch that reveals a value must still add the coin on release and must not open a context menu or text-selection callout.

---

## File Structure

- Create `src/dwell.js`: `DWELL_MS`, `createDwell(...)`. DOM-free timer logic.
- Create `tests/dwell.test.js`.
- Modify `src/state.js`: `difficulty` field, `setDifficulty`, preserve across `startGame`/`nextRound`.
- Modify `tests/state.test.js`: update the `createState` shape test; add difficulty tests.
- Modify `src/render.js`: give the label `<text>` the class `coin-label`.
- Modify `tests/render.test.js`: one markup test.
- Modify `index.html`: difficulty radio group on Home; `data-difficulty="normal"` on `.board`.
- Modify `styles.css`: hidden-label rules, `.revealed`, radio styling, touch-callout suppression, reduced motion.
- Modify `src/main.js`: toggle wiring, `data-difficulty` sync, skip pile rebuild when unchanged, dwell wiring.
- Modify `README.md`: one line on Easy/Normal.

---

### Task 1: Difficulty in state

**Files:**
- Modify: `src/state.js`
- Test: `tests/state.test.js`

**Interfaces:**
- Consumes: existing `createState`, `startGame`, `nextRound`.
- Produces: `createState()` now includes `difficulty: "normal"`; `setDifficulty(state, difficulty: "easy" | "normal") -> state` (returns the same object for any other value); `startGame` and `nextRound` carry `state.difficulty` over.

- [ ] **Step 1: Update and add failing tests in `tests/state.test.js`**

Change the `createState has the expected shape` expectation to include `difficulty: "normal"` (after `message`), and import `setDifficulty`. Add:

```js
test("setDifficulty switches between easy and normal without touching the round", () => {
  const s = withPile(startGame(createState(), "endless", 395), { "£1": 1 });
  const easy = setDifficulty(s, "easy");
  assert.equal(easy.difficulty, "easy");
  assert.deepEqual(easy.pile, s.pile);
  assert.equal(easy.target, 395);
  assert.equal(setDifficulty(easy, "normal").difficulty, "normal");
});

test("setDifficulty ignores unknown values and returns the same object", () => {
  const s = createState();
  assert.equal(setDifficulty(s, "hard"), s);
  assert.equal(setDifficulty(s, undefined), s);
});

test("startGame and nextRound keep the difficulty", () => {
  const easy = setDifficulty(createState(), "easy");
  const started = startGame(easy, "custom", 150);
  assert.equal(started.difficulty, "easy");
  assert.equal(nextRound(started, 200).difficulty, "easy");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/state.test.js`
Expected: FAIL (`setDifficulty` is not exported; shape test mismatch).

- [ ] **Step 3: Implement in `src/state.js`**

Add `difficulty: "normal"` to `createState()`. Export `setDifficulty(state, difficulty)`: return `state` unchanged unless `difficulty` is `"easy"` or `"normal"`, else `{ ...state, difficulty }`. Change `startGame` and `nextRound` to pass `difficulty: state.difficulty` into the object they build.

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: all tests PASS (27 existing plus 3 new, shape test updated).

- [ ] **Step 5: Commit**

```bash
git add src/state.js tests/state.test.js
git commit -m "Add difficulty setting to game state"
```

---

### Task 2: Dwell timer helper

**Files:**
- Create: `src/dwell.js`
- Test: `tests/dwell.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `export const DWELL_MS = 2000`; `createDwell({ delay = DWELL_MS, onReveal, onHide, setTimer, clearTimer }) -> { start(key), stop(key), cancelAll() }`. `key` is any value usable as a `Map` key (the coin element in practice). `setTimer(fn, ms) -> id` and `clearTimer(id)` default to wrappers around `setTimeout`/`clearTimeout`.
  - `start(key)`: no-op if `key` is already pending or revealed; otherwise schedules `onReveal(key)` after `delay`.
  - `stop(key)`: cancels a pending timer; if `key` was revealed, forgets it and calls `onHide(key)` once. Unknown key: no-op.
  - `cancelAll()`: `stop` for every pending or revealed key.

- [ ] **Step 1: Write the failing tests in `tests/dwell.test.js`**

Test helper (in the test file): a fake timer with `setTimer(fn, ms)`, `clearTimer(id)` and `advance(ms)` that runs due callbacks in time order. Tests (each builds its own `calls` log array with entries like `"reveal:a"` / `"hide:a"`):

```js
test("DWELL_MS is 2000 and is the default delay", ...)
  // createDwell without delay, start("a"), advance(1999) -> no reveal; advance(1) -> ["reveal:a"]
test("reveals only after the delay", ...)
test("stop before the delay cancels it: no reveal, no hide", ...)  // advance(5000) afterwards, calls stays []
test("stop after reveal hides exactly once", ...)                   // second stop adds nothing
test("start while pending or revealed does not schedule twice", ...) // start x3 -> one reveal
test("keys are independent", ...)  // start a, advance 1000, start b, advance 1000 -> only a revealed; stop(a) leaves b pending
test("cancelAll clears pending timers and hides revealed keys", ...)
test("a key can be revealed again after it was stopped", ...)
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/dwell.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/dwell.js`**

Keep a `Map` of key to timer id for pending keys and a `Set` of revealed keys. When the timer fires, move the key from pending to revealed, then call `onReveal(key)`.

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dwell.js tests/dwell.test.js
git commit -m "Add dwell timer helper"
```

---

### Task 3: Difficulty toggle and hidden labels

**Files:**
- Modify: `src/render.js` (the `label` string in `coinSvg`)
- Test: `tests/render.test.js`
- Modify: `index.html`, `styles.css`, `src/main.js`, `README.md`

**Interfaces:**
- Consumes: `setDifficulty` and `state.difficulty` from Task 1.
- Produces: the label `<text>` has `class="coin-label"`; `.board[data-difficulty]` is `"normal"` or `"easy"`, kept in sync with `state.difficulty`; CSS contract for Task 4: in Normal, `.coin-label` is `opacity: 0` and becomes `opacity: 1` inside an element with class `revealed`.

- [ ] **Step 1: Write the failing test in `tests/render.test.js`**

```js
test("every coin label is tagged so CSS can hide it", () => {
  for (const coin of COINS) {
    assert.ok(coinSvg(coin).includes('<text class="coin-label"'), coin.id);
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/render.test.js`
Expected: FAIL on the new test. The existing `>${coin.label}<` test must keep passing afterwards.

- [ ] **Step 3: Implement**

- `src/render.js`: add `class="coin-label"` as the first attribute of the label `<text>`.
- `index.html`: in `#screen-home`, between the intro paragraph and the buttons, add `<fieldset class="difficulty">` with `<legend>Difficulty</legend>` and two `<label>`s each wrapping a radio `name="difficulty"`: value `normal` (checked, text "Normal: read the coins yourself") and value `easy` (text "Easy: values always shown"), ids `diff-normal` and `diff-easy`. Add `data-difficulty="normal"` to `<div class="board">`'s opening tag.
- `styles.css`:
  - `input[type="radio"] { width: auto; min-height: 0; }` (the global `input` rule is full-width), and fieldset styling consistent with `.pile-area` borders.
  - `.coin-label { transition: opacity 200ms; }`
  - `.board[data-difficulty="normal"] .coin-label { opacity: 0; }`
  - `.board[data-difficulty="normal"] .revealed .coin-label { opacity: 1; }`
  - `@media (prefers-reduced-motion: reduce) { .coin-label { transition: none; } }`
- `src/main.js`: import `setDifficulty`. In `render()` set `document.querySelector(".board").dataset.difficulty = state.difficulty`. Add a `change` listener on the difficulty fieldset that calls `update(setDifficulty(state, e.target.value))`. Track `let shownPile` and in `render()` call `renderPile` only when `state.pile !== shownPile` (assign afterwards); `changePile` produces a new object on every pile change, so this is safe.
- `README.md`: one line describing Easy (values always shown) and Normal (hover, hold or focus a coin for 2 seconds to read it).

- [ ] **Step 4: Run tests, then check in a browser**

Run: `npm test` (all PASS). Then serve with `python3 -m http.server 8000` and open `http://localhost:8000`:
- Default is Normal: start Endless, tray and pile coins show no value text.
- Back, choose Easy, start Endless: every coin shows its value.
- Back, Normal again, Custom 1.50: hidden again. Playing a full round still works and Check/Next behave as before.

- [ ] **Step 5: Commit**

```bash
git add src/render.js tests/render.test.js index.html styles.css src/main.js README.md
git commit -m "Add Easy/Normal toggle and hide coin values in Normal"
```

---

### Task 4: Dwell-to-reveal wiring

**Files:**
- Modify: `src/main.js`, `styles.css`

**Interfaces:**
- Consumes: `createDwell` from Task 2; the `.revealed` CSS contract from Task 3; `[data-coin]` on tray and pile buttons.
- Produces: coin buttons gain/lose the `revealed` class according to dwell; nothing else.

- [ ] **Step 1: Wire the dwell in `src/main.js`**

Create one dwell instance: `onReveal: (el) => el.classList.add("revealed")`, `onHide: (el) => el.classList.remove("revealed")`. Attach delegated listeners to both `#play-tray` and `#play-pile` (a small helper that takes the container), each resolving `e.target.closest("[data-coin]")`:
- `pointerover`: `dwell.start(coin)`.
- `pointerout`: `dwell.stop(coin)` unless `e.relatedTarget` is inside the same coin.
- `focusin`: `dwell.start(coin)` only if `coin.matches(":focus-visible")` (keyboard focus); a mouse click must not start a dwell.
- `focusout`: `dwell.stop(coin)`.
- `contextmenu`: `e.preventDefault()`.

Call `dwell.cancelAll()` whenever `renderPile` actually rebuilds the pile (inside the `state.pile !== shownPile` branch from Task 3), and also when `showScreen` runs.

In Easy the reveal is harmless (labels already visible), so the wiring needs no difficulty check.

- [ ] **Step 2: CSS in `styles.css`**

`.coin, .stack { -webkit-touch-callout: none; user-select: none; }`

- [ ] **Step 3: Run tests and verify in a browser**

Run: `npm test` (all PASS). Serve with `python3 -m http.server 8000` and check, in Normal mode:
- Hover a tray coin for about 2 s: its value fades in; moving away fades it out. Moving across coins quickly reveals nothing.
- Click a tray coin and move the mouse away: no value appears 2 s later (Review Focus 1).
- Tab to a coin and wait 2 s: value appears; Tab on: it hides.
- Add a coin, hover it in the pile for 2 s, value appears. Press Check while still hovering: no stuck label afterwards (Review Focus 3).
- In devtools device mode (touch emulation), hold a coin 2 s: value appears; release: coin is added and no context menu shows.
- A quick tap still adds a coin and tapping a pile coin still removes it.
- Easy mode: values always visible, nothing flickers on hover.
- Layout at 320px width has no horizontal scroll.

Record the result of each check in the commit message body or report. If a check cannot be run (for example real touch hardware), say so rather than skipping it silently.

- [ ] **Step 4: Commit**

```bash
git add src/main.js styles.css
git commit -m "Reveal coin values after dwelling on a coin"
```

---

## Self-Review Notes

- **Spec coverage:** global Easy/Normal toggle (Task 1, 3); Normal hides value, keeps shape/size/colour (Task 3); Easy unchanged (Task 3); 2 s dwell via hover, held touch, keyboard focus (Task 2, 4); fade out on leave (Task 4); tap unchanged and no context menu (Task 4); `DWELL_MS` constant (Task 2); reduced motion (Task 3); accessible names unchanged (no task edits `aria-label`); difficulty kept across rounds and games (Task 1); pile coins follow the same rule (Task 4, delegated on both containers).
- **Deliberate deviations from the spec text:** `coinSvg` takes no `easy` option; the spec marks its exact markup an implementation detail, and a CSS rule on `.board[data-difficulty]` is smaller. The spec's "Easy markup shows / Normal hides" render test cannot run under Node (no DOM or CSS), so it becomes the `coin-label` markup test plus the browser checks in Tasks 3 and 4. Keyboard dwell uses `:focus-visible` so mouse clicks do not trigger a reveal.
- **Interfaces:** `setDifficulty`, `createDwell`, `DWELL_MS`, `.coin-label`, `.revealed` and `data-difficulty` are defined once and used with the same names across tasks.
