# Play Screen Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop customer coins hiding each other's stack-count badges, stop iPhone text selection while holding a coin, move Check to the right, and rename Clear to Reset.

**Architecture:** `src/render.js` gains a pure `layerOrder(pile)` and a `layerByPosition` flag on `renderPile`; `src/main.js` turns the flag on for the customer's (fixed) pile. Selection fixes are CSS only. The action row is reordered in `index.html`, and "Clear" wording is replaced everywhere a player can read it.

**Tech Stack:** Plain HTML, CSS and ES modules; `node --test` with jsdom.

**Spec:** `docs/superpowers/specs/2026-10-31-play-screen-fixes-design.md`

## Global Constraints

- Layering: a coin further **right** or **lower** is drawn **underneath**; the upper-left coin is on top. Draw order is **descending depth** (`x * pileWidthMm() + y * heightMm`, in millimetres), ties by ascending `uid`. State (`state.pile`) is never reordered; only the DOM order changes.
- The flag applies to the customer's fixed pile only (`fixedPile` in `src/main.js`: Cashier and Give Change). The player's own piles and the change pile keep insertion order.
- The element id `btn-clear` and `clearPile` in `src/state.js` do not change; only user-visible text does.
- The Enter shortcut for Check is unchanged.
- Do not edit `e2e/` (paused; owner's instruction).
- Commit messages use Conventional Commits and end with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Run the unit suite with `npm test`.

## Review Focus

- Re-ordering the customer pile's DOM must reuse the same button elements (so focus, drag and dwell listeners survive); pinned in Task 1.
- An empty pile and a single-coin pile must render with the flag on without error; pinned in Task 1.
- Inputs inside the now non-selectable play screen must stay typeable on iOS (WebKit needs an explicit `-webkit-user-select: text` on them); pinned in Task 2.
- The Cashier layout puts Check in the second grid column beside the answer field, and Reset is hidden there; reordering the row must not move it; checked by eye in Task 3.
- No player-readable "Clear" remains (button, hint, README); pinned in Task 3.

---

## File Structure

- Modify `src/render.js` (`layerOrder`, `renderPile` flag), `src/main.js` (pass the flag; one comment), `src/state.js` (hint text, one comment), `styles.css` (selection rules), `index.html` (action row), `README.md`.
- Modify `tests/render.test.js`, `tests/render.dom.test.js`, `tests/state.test.js`, `tests/index-html.test.js`.
- Create `tests/play-css.test.js`.

---

### Task 1: Layer customer coins right-to-left and top-to-bottom

**Files:**
- Modify: `src/render.js` (`renderPile`, line 144), `src/main.js:199`
- Test: `tests/render.test.js`, `tests/render.dom.test.js`

**Interfaces:**
- Produces: `layerOrder(pile: Entry[]) -> Entry[]` exported from `src/render.js`: a new array (input untouched) sorted by descending `x + y`, ties by ascending `uid`. The first element is the bottom layer.
- Produces: `renderPile(container, pile, excludeUid = null, removable = true, heightMm = pileHeightDefaultMm(), layerByPosition = false)`; when `layerByPosition` is true the buttons are placed in the container in `layerOrder(pile)` order.
- `Entry` is `{ uid, coinId, x, y, rot }` with `x` and `y` fractions of the pile box.

- [ ] **Step 1: Write the failing pure tests** in `tests/render.test.js` (add `layerOrder` to its import from `../src/render.js`). Use this fixture, the coins of the owner's first screenshot (`docs/coin_game_comment/Attachments/image3.png`) as pile fractions:

```js
const IMAGE3 = [
  { uid: 1, coinId: "£2", x: -0.341, y: -0.273 }, { uid: 2, coinId: "10p", x: -0.185, y: -0.338 },
  { uid: 3, coinId: "£1", x: -0.034, y: -0.266 }, { uid: 4, coinId: "5p", x: -0.350, y: -0.050 },
  { uid: 5, coinId: "2p", x: -0.215, y: -0.050 }, { uid: 6, coinId: "20p", x: -0.062, y: -0.014 },
  { uid: 7, coinId: "50p", x: -0.308, y: 0.165 }, { uid: 8, coinId: "50p", x: -0.312, y: 0.170 },
  { uid: 9, coinId: "50p", x: -0.316, y: 0.175 }, { uid: 10, coinId: "1p", x: -0.138, y: 0.165 },
];
const over = (order, a, b) => order.findIndex((e) => e.uid === a) > order.findIndex((e) => e.uid === b);
```

Tests (names exact):
  - `layerOrder puts the owner's wanted coins on top: £2 over 10p, 10p over £1, 5p over 2p, 2p over 20p, 2p over 50p, 50p over 1p`: shuffle `IMAGE3` into a bad deal order first, then `assert.ok(over(layerOrder(shuffled), a, b))` for each pair (uids 1/2, 2/3, 4/5, 5/6, 5/7, 7/10).
  - `layerOrder never lets a coin to the right or below sit over one up and to the left`: for every pair in `IMAGE3` where `a.x <= b.x && a.y <= b.y` and they differ, `over(order, a.uid, b.uid)` is true.
  - `layerOrder breaks ties by uid and does not change its input`: two entries with equal `x + y` come out uid ascending; the input array's order and length are unchanged afterwards.
- [ ] **Step 2: Write the failing DOM tests** in `tests/render.dom.test.js` (add `layerOrder` to its import):
  - `renderPile with layerByPosition draws the buttons in layerOrder order`: pile of `[entry(1,"£2",-0.3,-0.3), entry(2,"5p",0.3,0.3)]`, `renderPile(c, pile, null, false, undefined, true)`; `[...c.children].map(b => b.dataset.uid)` equals `["2","1"]`; with the flag omitted it equals `["1","2"]`.
  - `layerByPosition keeps the same button elements when the order changes`: render, remember the elements, re-render with a changed `x` so the order flips; the same two element objects are present.
  - `layerByPosition renders an empty pile and a single coin`: no throw; 0 and 1 children.
- [ ] **Step 3: Run** `node --test tests/render.test.js tests/render.dom.test.js`. Expected: the new tests FAIL (`layerOrder` is not exported / the flag is ignored).
- [ ] **Step 4: Implement** `layerOrder` in `src/render.js` (sort a copy: descending by `x + y`, then ascending by `uid`), export it, and in `renderPile` build `ordered` from `layerByPosition ? layerOrder(pile) : pile`. Nothing else in `renderPile` changes (reuse of existing buttons, labels and badges stays as is).
- [ ] **Step 5: Pass the flag** in `src/main.js:199`: `renderPile($("play-pile"), state.pile, detachedUid.pile, !fixedPile, heightOf("pile"), fixedPile);`. The change pile call (line 206) is untouched.
- [ ] **Step 6: Run** `npm test`. Expected: all PASS. If the image3 pairs fail with `x + y`, tune the key (for example `x + 2 * y`) until they pass and write the final key into the spec's section 1 and Global Constraints; otherwise leave it.
- [ ] **Step 7: Check by eye.** Run `npm start`, open Cashier mode with Large Coins on, deal several times, and confirm no "x2" badge is covered by a neighbouring coin. Then Give Change with Large Coins.
- [ ] **Step 8: Commit**

```bash
git add src/render.js src/main.js tests/render.test.js tests/render.dom.test.js
git commit -m "fix: draw the customer's coins right to left and bottom to top so stack counts stay visible"
```

---

### Task 2: Stop text selection while playing on iPhone

**Files:**
- Modify: `styles.css` (the rule at line 308 and new rules after it)
- Create: `tests/play-css.test.js`

**Interfaces:**
- Produces: `tests/play-css.test.js` with a local `rule(selector)` helper that escapes **all** regex metacharacters (the existing helper in `tests/home-css.test.js` does not escape `*`), returning the declarations of the rule written at the start of a line, or `""`.

- [ ] **Step 1: Write the failing tests** in `tests/play-css.test.js` reading `styles.css`:
  - `coins and everything inside them cannot be selected`: `rule(".coin, .pile-coin")` matches `/-webkit-user-select:\s*none/` and `/user-select:\s*none/`; `rule(".coin *, .pile-coin *")` matches both too.
  - `piles and the tray suppress the touch callout`: `rule(".pile, .tray")` matches `/-webkit-touch-callout:\s*none/`.
  - `the whole play screen is unselectable but its inputs stay typeable`: `rule("#screen-play")` is the layout rule already present, so assert on the new rule `rule("#screen-play, #screen-play *")` matching `/-webkit-user-select:\s*none/`, and `rule("#screen-play input")` matching `/-webkit-user-select:\s*text/` and `/user-select:\s*text/`.
  - `the home and options screens are not made unselectable`: neither `rule("#screen-home")` nor `rule("#screen-options")` contains `user-select`.
- [ ] **Step 2: Run** `node --test tests/play-css.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement in `styles.css`:** add `-webkit-user-select: none; user-select: none;` to the existing `.coin, .pile-coin` rule; add `.coin *, .pile-coin * { -webkit-user-select: none; user-select: none; }`, `.pile, .tray { -webkit-touch-callout: none; }`, `#screen-play, #screen-play * { -webkit-user-select: none; user-select: none; }` and `#screen-play input { -webkit-user-select: text; user-select: text; }`, each on its own line at the left edge, after the existing `.coin, .pile-coin` rule.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Manual check on an iPhone** (the owner does this; it cannot be proven on a desktop): press and hold on a coin, on the gap between coins, on the coin lettering and on the price; no selection handles or magnifier should appear, and the Cashier total field still takes typing. Record the result with the owner; if a case still selects, extend the rule to that element.
- [ ] **Step 6: Commit**

```bash
git add styles.css tests/play-css.test.js
git commit -m "fix: stop iPhone text selection while holding coins on the play screen"
```

---

### Task 3: Check on the right and Clear becomes Reset

**Files:**
- Modify: `index.html` (the `.actions` row), `src/state.js:243` (and the comment at 235), `src/main.js:28` (comment), `README.md:46-47`, `tests/state.test.js:811` and `:893`, `tests/index-html.test.js`

**Interfaces:**
- Consumes: `load()` from `tests/index-html.test.js` (Plan A, Task 1).
- Produces: the action row's DOM order `btn-clear, btn-check, btn-next, btn-change, btn-again`.

- [ ] **Step 1: Write the failing tests.**
  - In `tests/index-html.test.js`: `the action row reads Reset then Check, with the primary button last in each state`: the ids of `.actions` children equal `["btn-clear", "btn-check", "btn-next", "btn-change", "btn-again"]`; `#btn-clear` text is exactly `Reset`; no button in the document has text `Clear`.
  - In `tests/state.test.js`: change `REFUSED` (line 811) to the hint "That is more than they paid. Press Reset to start again." and the regex at line 893 to `/Press Reset/`.
- [ ] **Step 2: Run** `node --test tests/index-html.test.js tests/state.test.js`. Expected: FAIL (order, text and hint).
- [ ] **Step 3: Implement.** In `index.html` reorder the row to the order above and change the Clear button's text to "Reset" (keep `id="btn-clear"`). In `src/state.js` change `OVERPAID_HINT` to "That is more than they paid. Press Reset to start again."; change the two code comments that say "Clear" (`src/state.js:235`, `src/main.js:28`) to "Reset". In `README.md` change the Give Change paragraph: "press Reset", "The tray, Check and Reset are at the bottom", "Reset puts the customer's coins back". `Next` stays before `Change amount`, and `Change amount` before `Play again`, so the primary button is rightmost when the round is solved (this swaps the old `Play again`, `Change amount` order, following the spec's "primary on the right").
- [ ] **Step 4: Run** `npm test`, then `grep -rn "Clear" src index.html README.md` and read each hit: only `clearPile`, `btn-clear`, `clearTimeout` and similar code names may remain. Expected: PASS, and no player-readable "Clear".
- [ ] **Step 5: Check by eye** (`npm start`): in Endless the row is Reset | Check with Check green on the right; after solving in Custom mode the row is Change amount | Play again; Cashier still shows Check beside the total field; Give Change still shows Check on the right.
- [ ] **Step 6: Commit**

```bash
git add index.html src/state.js src/main.js README.md tests/state.test.js tests/index-html.test.js
git commit -m "feat: move Check to the right and rename Clear to Reset"
```

---

## Self-Review

- **Spec coverage:** layering with the owner's screenshot as a fixture, flag on the fixed pile only, state untouched (Task 1); SVG-inner, pile, tray and play-screen selection rules with inputs kept typeable, plus the iPhone manual check (Task 2); Check on the right, Reset text, hint, README (Task 3). The spec's "A search for Clear" is the grep in Task 3 Step 4.
- **Names:** `layerOrder` and the sixth `renderPile` parameter are defined in Task 1 and used only there; `load()` comes from Plan A and must exist before Task 3.
- **Dependency:** Plan A must be done first (it creates `tests/index-html.test.js`); it is merged on this branch.
