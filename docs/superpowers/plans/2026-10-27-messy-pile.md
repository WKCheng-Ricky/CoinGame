# Messy Pile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the grouped "×N" stacks with a pile of individual, overlapping, randomly offset and rotated coins, where no coin's centre is ever covered by a later coin (while there is room).

**Architecture:** The pile becomes an ordered array of `{ uid, coinId, x, y, rot }` entries held in the pure state object; position and rotation are chosen once, in a pure, seedable `placeCoin` in `game.js` that nudges away from existing coin centres. `render.js` reconciles DOM buttons by `uid` (never re-creating untouched coins); CSS sizes and positions them as percentages of a fixed-aspect pile box.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node built-in test runner (`node --test`). No dependencies.

**Spec:** `docs/superpowers/specs/2026-10-27-messy-pile-design.md` (parents: `2026-10-27-coin-game-design.md`, `2026-10-27-inspect-to-reveal-design.md`)

## Global Constraints

- Static site: plain HTML, CSS, vanilla JS ES modules. No backend, no build step, no runtime or test dependencies.
- Integer pence for money; positions are fractions (floats) and never feed money maths.
- Pile entry shape: `{ uid, coinId, x, y, rot }`; `x`, `y` in -0.5 to 0.5 as fractions of the 110 by 90 mm centre area; `rot` an integer 0 to 359; array order is draw order, later on top.
- `PILE_WIDTH_MM = 110`, `PILE_HEIGHT_MM = 90`, `PILE_MARGIN_MM = 14.2` (largest coin radius, derived from `COINS`), `CLUSTER_TRIES = 20` (range ±0.35), `MAX_PLACEMENT_TRIES = 60` (the remaining 40 use range ±0.5).
- A candidate is valid when its distance (in mm) from the centre of every existing pile coin is at least the new coin's radius (`diameter / 2`).
- Pile coin buttons are labelled `Remove 20p` style. The total and result message stay `aria-live`; the new pile summary line is visually hidden and not live.
- Tapping a pile coin removes that exact coin; Clear remains; solved state stays read-only; the 400 ms advance guard is unchanged.
- Inspect-to-reveal keeps working on pile coins (dwell, touch-release handling); a printed value stays upright whatever `rot` is.
- 44px minimum tap area for tray coins and buttons; no horizontal scroll at 320px width; the layout below the pile must not shift as coins are added.
- Only `render.js` and `main.js` touch the DOM; `game.js` and `state.js` stay importable in Node.
- `prefers-reduced-motion: reduce` removes the 150 ms settle animation.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A uid must never be reused: add A, remove A, add B must give B a new uid (a stale click on an old element must not remove the wrong coin).
2. Overlapping 44px buttons: tapping the visible part of a lower coin must hit that coin, not a transparent corner of a coin above it (circular hit areas).
3. 20 coins on a 320px-wide screen: no horizontal scroll, no coin outside its panel, and nothing below the pile moves while adding.
4. Clear, a new round and Back-then-new-game must leave no stale coin buttons, and the empty hint must come back; once solved, tapping a pile coin must neither remove it nor move focus.
5. The screen-reader summary must read correctly for an empty pile, one coin, and mixed coins, always in ascending coin order rather than insertion order.

---

## File Structure

- Modify `src/game.js`: pile geometry constants, `placeCoin`, `pileBox`, entry-based `total`/`check`, `summarisePile`, `describePile`; remove `addCoin`/`removeCoin`.
- Modify `src/state.js`: array pile, `nextUid`, `addToPile(state, coinId, rng)`, `removeFromPile(state, uid)`.
- Modify `src/render.js`: keyed `renderPile`.
- Modify `src/main.js`: uid-based removal, focus handoff, summary line, renamed class selectors.
- Modify `index.html`, `styles.css`, `README.md`.
- Create `tests/pile-helper.js` (shared test helpers, not a test file): `pileOf(...ids)`, `seeded(seed)`, `seq(values, rest)`.
- Modify `tests/game.test.js`, `tests/state.test.js`.

---

### Task 1: Placement and pile geometry (pure, additive)

**Files:**
- Modify: `src/game.js` (append; do not change existing exports yet)
- Create: `tests/pile-helper.js`
- Test: `tests/game.test.js`

**Interfaces:**
- Consumes: `COINS`, `coinById` from `src/coins.js`.
- Produces in `src/game.js`: constants `PILE_WIDTH_MM`, `PILE_HEIGHT_MM`, `PILE_MARGIN_MM`, `CLUSTER_TRIES`, `MAX_PLACEMENT_TRIES`; `placeCoin(pile: {x:number,y:number}[], coin: Coin, rng?: () => number) -> { x, y, rot }`; `pileBox({ x, y }) -> { left: number, top: number }` (percent of the visible pile box, i.e. including the margin).
- Produces in `tests/pile-helper.js`: `seeded(seed: number) -> () => number` (mulberry32), `seq(values: number[], rest?: number) -> () => number` (yields `values` in order, then `rest`, default 0.5), `pileOf(...coinIds: string[]) -> Entry[]` (uid 1..n, x 0, y 0, rot 0).

- [ ] **Step 1: Write the failing tests in `tests/game.test.js`** (import `placeCoin`, `pileBox`, the constants, and the helpers). Names and assertions (use an `approx(a, b)` helper with 1e-9 tolerance for floats):

```js
test("pile constants match the spec", ...)      // 110, 90, 14.2, 20, 60
test("placeCoin on an empty pile uses the first draw", ...)
  // seq([0.5, 0.5, 0.25]) -> deepEqual { x: 0, y: 0, rot: 90 }
test("placeCoin clusters within ±0.35 and rot is 0..359", ...)
  // rng () => 0 -> x -0.35, y -0.35, rot 0 ; rng () => 0.999999 -> |x|,|y| <= 0.35, rot 359
test("placeCoin re-draws when a candidate covers an existing centre", ...)
  // pile [{x:0,y:0}], coin 1p, seq([0.5,0.5, 0.9,0.5, 0]) -> x ≈ 0.28, y 0, rot 0
test("after 20 clustered tries it widens to ±0.5", ...)
  // pile [{x:0,y:0},{x:0.315,y:0}], coin £2, seq([...40 x 0.5, 0.95, 0.5, 0]) -> x ≈ 0.45, y 0
test("when no candidate is valid it returns the one with the greatest clearance", ...)
  // pile [{x:0,y:0}], coin £2, seq([0.5,0.5, 0.564935,0.5]) (rest 0.5) -> x ≈ 0.04545 (±1e-5), y 0, rot 180
test("placeCoin is deterministic for the same rng sequence", ...)
  // build a 10-coin pile twice from seeded(7); entries deep-equal
test("no centre is ever covered by a later coin while there is room", ...)
  // for seeds 1..300: build 20 £2 coins, and 20 random coins (picks from seeded(seed + 1000));
  // for every pair i < j: hypot((xi-xj)*110, (yi-yj)*90) >= diameter(j)/2 - 1e-9
test("pileBox maps the centre area into the visible box", ...)
  // {0,0} -> {50,50}; {-0.5,-0.5} -> left ≈ 10.2601, top ≈ 11.9932; {0.5,0.5} -> 100 minus those
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/game.test.js`
Expected: FAIL (`placeCoin` is not exported).

- [ ] **Step 3: Implement in `src/game.js`**

`placeCoin(pile, coin, rng = Math.random)`, exact draw order: for each try `i` in `0..MAX_PLACEMENT_TRIES-1`, range is 0.35 when `i < CLUSTER_TRIES` else 0.5; draw `x = (rng()*2-1)*range` then `y = (rng()*2-1)*range`. A candidate's clearance is `min over pile of (hypot((x-ex)*PILE_WIDTH_MM, (y-ey)*PILE_HEIGHT_MM) - coin.diameter/2)`, and `Infinity` for an empty pile; it is valid when clearance >= 0. Return the first valid candidate; otherwise the candidate with the greatest clearance (first wins ties). Finally draw `rot = Math.floor(rng() * 360)` (exactly one more `rng()` call) and return `{ x, y, rot }`. `pileBox`: `left = (PILE_MARGIN_MM + (0.5 + x) * PILE_WIDTH_MM) / (PILE_WIDTH_MM + 2 * PILE_MARGIN_MM) * 100`, `top` likewise with the height. `PILE_MARGIN_MM = Math.max(...COINS.map((c) => c.diameter)) / 2`.

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: all PASS. If the 300-seed capacity test fails for any seed, do not change the seeds or the constants: stop and report which seed and which coins (the spec's simulation found zero failures, so a failure means the implementation differs from the spec).

- [ ] **Step 5: Commit**

```bash
git add src/game.js tests/game.test.js tests/pile-helper.js
git commit -m "Add messy pile placement with centre-uncovered nudge"
```

---

### Task 2: Pile as individual coin entries (data model)

**Files:**
- Modify: `src/game.js` (`total`, `check` unchanged in contract; remove `addCoin`, `removeCoin`; add `summarisePile`, `describePile`)
- Modify: `src/state.js`
- Test: `tests/game.test.js`, `tests/state.test.js`

**Interfaces:**
- Consumes: `placeCoin`, `pileOf` helper from Task 1; `coinById`, `COINS`.
- Produces: `total(pile: Entry[]) -> number`; `check(pile, target)` as before; `summarisePile(pile) -> { [coinId]: number }`; `describePile(pile) -> string` ("The pile is empty." for an empty pile, otherwise "In the pile: 3 × 20p, 1 × £1", ascending coin order, `×` is U+00D7); state shape gains `nextUid` and `pile: Entry[]`; `addToPile(state, coinId, rng = Math.random) -> state`; `removeFromPile(state, uid: number) -> state`; `clearPile(state) -> state`.
- **The browser UI is intentionally broken after this task** (render.js and main.js still expect the old map). Do not browser-test until Task 3.

- [ ] **Step 1: Update and add failing tests**

`tests/game.test.js`: delete the `addCoin` and `removeCoin` tests and imports; rewrite the `total` and `check` tests to use `pileOf` (same expectations: `pileOf("20p","20p","20p","£1")` totals 160, empty 0, 9999 `"1p"` entries total 9999; `check` exact/over/under/empty for target 395 with `pileOf("£2","£1","50p","20p","20p","5p")`). Add `summarisePile` (`pileOf("£1","20p","20p","20p")` -> `{ "20p": 3, "£1": 1 }`, empty -> `{}`) and `describePile` tests (empty -> `"The pile is empty."`; one coin -> `"In the pile: 1 × 5p"`; mixed inserted in descending order still reads `"In the pile: 3 × 20p, 1 × £1"`).

`tests/state.test.js`: `createState` expects `pile: []` and `nextUid: 1` (all other fields unchanged); replace map piles with `pileOf(...)`; `EXACT_395` becomes the id list above passed through `pileOf`. Update the existing tests that call `removeFromPile(x, "5p")`/`"£2"` to pass a uid. New tests:

```js
test("addToPile appends an entry with the next uid and placement from rng", ...)
  // seq([0.5,0.5,0.25]): entry deepEqual { uid: 1, coinId: "5p", x: 0, y: 0, rot: 90 }; nextUid 2; input state unchanged
test("uids are never reused after a removal", ...)      // add, remove it, add again: new uid is 2
test("addToPile keeps earlier entries untouched", ...)  // second add: first entry deep-equals what it was
test("addToPile ignores an unknown coin id", ...)       // returns the same state object
test("removeFromPile removes only the matching uid", ...)
test("removeFromPile with an unknown uid returns the same object", ...)
test("clearPile empties the pile and keeps nextUid", ...)
test("a solved round still cannot be changed", ...)     // add/remove/clear return the same object
test("startGame and nextRound reset the pile and nextUid", ...)
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL (state still map-based).

- [ ] **Step 3: Implement**

`game.js`: `total` sums `coinById(e.coinId).pence` over entries; remove `addCoin`/`removeCoin`; implement `summarisePile` and `describePile` (iterate `COINS` for ordering). `state.js`: `createState` gets `pile: []` and `nextUid: 1`; rewrite `changePile` so every pile action returns the same state when solved; `addToPile` builds `{ uid: state.nextUid, coinId, ...placeCoin(state.pile, coin, rng) }`, appends it, increments `nextUid`, and clears the message; `removeFromPile` filters by `uid` (unknown uid returns `state`); `clearPile` sets `pile: []`.

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game.js src/state.js tests/game.test.js tests/state.test.js
git commit -m "Hold the pile as individual coin entries in state"
```

---

### Task 3: Render the messy pile

**Files:**
- Modify: `src/render.js`, `src/main.js`, `index.html`, `styles.css`, `README.md`

**Interfaces:**
- Consumes: state and game exports from Tasks 1 and 2 (`pileBox`, `PILE_WIDTH_MM`, `PILE_HEIGHT_MM`, `PILE_MARGIN_MM`, `describePile`, uid-based `removeFromPile`).
- Produces: `renderPile(container: HTMLElement, pile: Entry[]) -> void` (keyed by `uid`; sets `--pile-w-mm` and `--pile-h-mm` on the container as `PILE_WIDTH_MM + 2 * PILE_MARGIN_MM` and `PILE_HEIGHT_MM + 2 * PILE_MARGIN_MM`); pile buttons are `button.pile-coin[data-coin][data-uid]` with `aria-label="Remove <label>"`, inline `left`/`top` percentages from `pileBox`, and `--rot` set to `<rot>deg`; a visually hidden `<p id="play-pile-summary" class="sr-only">` under the pile.

- [ ] **Step 1: Implement `src/render.js`**

`renderPile`: build a map of existing children by `dataset.uid`; remove children whose uid is not in `pile`; for each entry not already present, create the button with `coinButton(coin, "pile-coin settle", ...)`, set `dataset.uid`, `style.left`, `style.top`, `--rot`, and append it. Untouched buttons are never re-created or moved. After reconciling, if DOM order differs from `pile` order, fall back to `container.replaceChildren(...buttons in pile order)` (drag will rely on this later). Remove the `.badge` markup. `coinButton` keeps its signature.

- [ ] **Step 2: Implement `index.html`, `styles.css`, `README.md`**

- `index.html`: add `<p id="play-pile-summary" class="sr-only"></p>` after `#play-pile`.
- `README.md`: "tap a stack in your pile to remove one" becomes "tap a coin in your pile to remove it".
- `styles.css`:
  - Replace the `.pile` flex rules with a positioned box: `position: relative; container-type: inline-size; width: min(100%, calc(var(--pile-w-mm) * 0.17rem)); margin-inline: auto; aspect-ratio: var(--pile-w-mm) / var(--pile-h-mm);` plus a light background and dashed `var(--line)` border so the table is visible.
  - Rename every `.stack` selector to `.pile-coin` (including `.board.locked` and the `-webkit-touch-callout` rule). Delete `.badge` and `.stack svg { width... }`. Leave `.stack-col` (Home buttons) alone.
  - `.pile-coin { position: absolute; translate: -50% -50%; border-radius: 50%; }` (keeps `.coin, .pile-coin` shared tap-area rules; the circular border radius makes overlapping hit areas circular; `translate` rather than `transform` so `:active { transform: scale(0.94) }` still works).
  - `.pile-coin svg { width: calc(var(--d) / var(--pile-w-mm) * 100cqw); transform: rotate(var(--rot)); }` and `.pile-coin .coin-label { transform: rotate(calc(-1 * var(--rot))); transform-box: fill-box; transform-origin: center; }` so the printed value stays upright.
  - `.settle { animation: settle 150ms ease-out; }` with `@keyframes settle { from { opacity: 0; transform: scale(1.15); } }`; `@media (prefers-reduced-motion: reduce) { .settle { animation: none; } }`.
  - `.pile:empty::before` keeps its text but is centred: `position: absolute; inset: 0; display: grid; place-items: center; text-align: center;`.
  - `.sr-only` (visually hidden, still readable by assistive tech).

- [ ] **Step 3: Implement `src/main.js`**

- Import `describePile`; in the `state.pile !== shownPile` branch also `setText($("play-pile-summary"), describePile(state.pile))`.
- Selectors `.coin, .stack` become `.coin, .pile-coin` (the `aria-disabled` loop).
- Pile click handler resolves `e.target.closest("[data-uid]")` and calls `removeCoin(btn.dataset.uid)`.
- `removeCoin(uid)`: convert to a number, find the entry in `state.pile`; do nothing if missing; `const next = removeFromPile(state, uid)`; if `next === state` return without touching focus; otherwise `update(next)` then focus the last `#play-pile .pile-coin` (topmost) if any, else the tray coin whose `data-coin` equals the removed entry's `coinId` (`focus({ preventScroll: true })`).
- The touch-release path in `watchDwell` keys the swallow flag by `coin.dataset.uid ?? coin.dataset.coin` and passes that key to `addCoin`/`removeCoin`; the click handlers use the same key in `takeSwallow` (tray keys by coin id, pile by uid).

- [ ] **Step 4: Run tests, then verify in a browser**

Run: `npm test` (all PASS). Serve with `python3 -m http.server 8000` and check, in Easy mode first (labels visible), then Normal:
- Adding coins one at a time: each lands as its own coin near the middle with a short settle; existing coins do not move or re-animate; coins overlap but every coin's centre is visible (add 20 £2 coins).
- Tapping a visible part of a lower coin removes that coin (not the one above); removing a middle coin leaves the others where they are.
- Keyboard: Tab to a pile coin, Enter removes it; focus lands on the topmost remaining pile coin, or the matching tray coin when the pile is empty.
- Clear and Next/Play again empty the pile and bring back the "Tap a coin to add it" hint; after Check solves the round, tapping a pile coin does nothing and focus does not move.
- Normal mode: hovering or holding a pile coin 2 s reveals its value upright whatever its rotation; adding another coin while hovering a pile coin keeps its reveal.
- Screen reader summary (inspect in devtools): "The pile is empty.", "In the pile: 1 × 5p", mixed coins in ascending order.
- At 320px width: no horizontal scroll with 20 coins, and the content below the pile does not shift as coins are added; at desktop width the pile box stops growing at its maximum.
- Heptagon and 12-sided coins show their rotation; touch emulation: a quick tap on a pile coin removes it once, a 2 s hold reveals and then removes it once.

Record the result of each check; if one cannot be run (for example real touch hardware), say so.

- [ ] **Step 5: Commit**

```bash
git add src/render.js src/main.js index.html styles.css README.md
git commit -m "Render the pile as individual overlapping coins"
```

---

## Self-Review Notes

- **Spec coverage:** one element per coin, no badges (Task 3); messy placement with rotation and later-on-top (Tasks 1, 3); stable positions, keyed reconcile (Task 3); remove exact coin, Clear kept (Tasks 2, 3); bounds and fixed-aspect box (Tasks 1, 3); no centre covered, retry 20+40, capacity (Task 1, the 300-seed test); total unaffected (Task 2); empty hint (Task 3); inspect on pile coins and upright labels (Task 3); accessibility names and summary (Tasks 2, 3); reduced motion (Task 3); state shape, uid, `rng` injection (Task 2); focus handoff (Task 3); tests listed in the spec (Tasks 1, 2; DOM-only render checks are manual).
- **Deliberate deviations from the spec text:** the spec's "render.js tests: one button per entry" cannot run under Node (no DOM), so it is the manual browser checklist in Task 3. `placeCoin` takes `pile` entries and a full `coin` (as the spec's signature says); the retry rule is the amended 20+40 scheme from the spec's verified-capacity paragraph.
- **Interfaces:** `placeCoin`, `pileBox`, `describePile`, `Entry`, `pile-coin`, `data-uid`, `--pile-w-mm`/`--pile-h-mm` are defined once and used with the same names across tasks.
