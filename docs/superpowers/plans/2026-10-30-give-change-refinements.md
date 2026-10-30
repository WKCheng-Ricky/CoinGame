# Give Change refinements Implementation Plan

> **Superseded in part:** written before the menu and options rebase (difficulty is now the `state.options` registry) and before tap-to-send (customer coins now move on tap); the spec is the current authority.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Even out Give Change's two piles (5 cm each), let coins be dragged between the customer pile and the change pile with an "over-paid" limit, and make an empty Check mean "No change".

**Architecture:** Pile sizes and `judgeAnswer` are small changes in `src/game.js`. A Give Change round stores the original `paid` amount and the dealt customer pile; a new `transferCoins` in `src/state.js` moves entries between the two lists and enforces the limit. `createDrag` in `src/drag.js` gets an optional `dropTarget` hook that turns a drop on the other pile into an `onTransfer` call and draws the dragged coins as body ghosts; `src/main.js` wires both piles.

**Tech Stack:** Vanilla ES modules, `node --test` with jsdom. No build step.

**Spec:** `docs/superpowers/specs/2026-10-30-give-change-refinements-design.md`

## Global Constraints

- Branch `feature/give-change-mode`. The menu and options work (`feature/menu-and-options`) is not on this branch: difficulty is still `state.difficulty` (`"normal"` / `"easy"`). Do not touch it.
- Pile boxes: customer 50 mm, change 50 mm; on short screens (`compact`, under 700 px high) both 40 mm. Play-area height is `heightForBox(box)`: 21.6 mm and 11.6 mm. Other modes stay 90 mm.
- Refusal hint text, exactly: `That is more than they paid. Press Clear to start again.` with kind `"hint"`.
- Empty-Check hints reuse existing text: exact round succeeds ("Correct! No change due."); underpaid round says `They have not paid enough yet`; overpaid round stays `Not enough change`; a non-empty Check on a non-overpaid round stays `Does this customer need change?`.
- Transfers work in every round, never in a solved round, and only between `"pile"` and `"change"` in `give-change` mode. Tray drops still go only to the change pile; tapping a change coin discards it; tapping a customer coin does nothing.
- Judging uses the stored `paid`, `price` and `scenario`, never the customer pile as currently shown.
- e2e: do not write, run or plan e2e work. Leave `e2e/` and the paused CI job untouched; specs that check the old pile sizes will be stale until the owner asks for a comprehensive pass.
- Commit messages use Conventional Commits and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Match the surrounding code's style: short comments, no extra abstractions.

## Review Focus

- A stack dragged into the customer pile whose total would exceed `paid` is refused as a whole: nothing moves, one hint (Task 3 test).
- Moves in exact and underpaid rounds leave `scenario`, `price` and the due unchanged, and a returned customer coin in the change pile counts toward Check (Task 3 tests).
- Clear after transfers and tapped-away coins restores the customer pile exactly and empties the change pile; Clear on a solved round is still a no-op (Task 3 tests).
- A drag that starts in another mode (`dropTarget` returns `null`) behaves exactly as before, with no ghosts (Task 4 test).
- A drag released outside both piles, or cancelled, leaves the coin where it was and removes every ghost (Task 4 tests).

---

### Task 1: Even 5 cm piles

**Files:**
- Modify: `src/game.js:118-121` (constants)
- Modify: `src/state.js` (`pileHeightMm`)
- Test: `tests/state.test.js` (the `pileHeightMm` tests near lines 641-681 and 737-741)

**Interfaces:**
- Produces:
  - `CUSTOMER_BOX_MM = 50`, `CHANGE_BOX_MM = 50`, `CHANGE_BOX_COMPACT_MM = 40`, and new exported `CUSTOMER_BOX_COMPACT_MM = 40` in `src/game.js`.
  - `pileHeightMm(state, key = "pile", compact = false)` in Give Change returns `heightForBox(CUSTOMER_BOX_MM)` or `heightForBox(CUSTOMER_BOX_COMPACT_MM)` for the customer pile (`key !== "change"`), and `heightForBox(CHANGE_BOX_MM)` or `heightForBox(CHANGE_BOX_COMPACT_MM)` for `"change"`.

- [ ] **Step 1: Update the tests first.** In `tests/state.test.js` change the expectations: Give Change `pileHeightMm` for `"pile"` and `"change"` is 21.6 (not 11.6 / 31.6); compact is 11.6 for both (the existing compact test already expects that, keep it); other modes still 90. Add `CUSTOMER_BOX_COMPACT_MM` to the import and assert `heightForBox(CUSTOMER_BOX_COMPACT_MM)` is 11.6.
- [ ] **Step 2: Run** `node --test tests/state.test.js`. Expected: FAIL on the changed 21.6 expectations (and the missing export).
- [ ] **Step 3: Implement** the constants and `pileHeightMm` as above; update the comment on `CHANGE_BOX_COMPACT_MM` to say both piles shrink on short screens. Tests elsewhere that import `CUSTOMER_BOX_MM` (`tests/drag.test.js`, `tests/drag.dom.test.js`) derive from the constant; fix any that break because they hard-code the old height.
- [ ] **Step 4: Run** `node --test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: make the Give Change piles an even 5 cm`.

---

### Task 2: An empty Check means "No change"

**Files:**
- Modify: `src/game.js` (`judgeAnswer`, line ~100)
- Test: `tests/game.test.js` (the `judgeAnswer` test near line 676)

**Interfaces:**
- Produces: `judgeAnswer(scenario, action, changeTotal, due)` unchanged signature. When `action === "check"`, `changeTotal === 0` and `scenario !== "over"` it returns exactly what `action === "none"` returns for that scenario.

- [ ] **Step 1: Write the failing tests** in `tests/game.test.js`:
  - `judgeAnswer("exact", "check", 0, 0)` deep-equals `{ correct: true, hint: "" }`.
  - `judgeAnswer("under", "check", 0, 0)` deep-equals `{ correct: false, hint: "They have not paid enough yet" }`.
  - `judgeAnswer("over", "check", 0, 265)` deep-equals `{ correct: false, hint: "Not enough change" }`.
  - `judgeAnswer("exact", "check", 20, 0)` and `judgeAnswer("under", "check", 20, 0)` both deep-equal `{ correct: false, hint: "Does this customer need change?" }`.
- [ ] **Step 2: Run** `node --test tests/game.test.js`. Expected: FAIL on the first two.
- [ ] **Step 3: Implement** the rule in `judgeAnswer` with a short comment. The existing assertions in the covering test must keep passing unchanged.
- [ ] **Step 4: Run** `node --test`. Expected: all pass.
- [ ] **Step 5: Commit** `fix: treat an empty Check as No change`.

---

### Task 3: Paid amount, Clear and transfers in state

**Files:**
- Modify: `src/state.js` (`createState`, `setScenario`, `submitGiveChangeAnswer`, `clearPile`; new `transferCoins`)
- Test: `tests/state.test.js`

**Interfaces:**
- Consumes: `pileHeightMm`, `settleGroup` (`src/game.js`), `clampPosition`, `total`.
- Produces:
  - `state.paid: number` (pence) and `state.dealt: Entry[]` (the dealt customer pile). `createState()` defaults: `paid: 0`, `dealt: []`. `setScenario` sets `paid = total(state.pile)` and `dealt = state.pile`, so `startGiveChange` and `nextGiveChangeCustomer` both get them.
  - `submitGiveChangeAnswer(state, action, now)`: `due` and the "short by" amount come from `state.paid`, not `total(state.pile)`.
  - `clearPile(state, key)`: when `state.mode === "give-change"`, `key === "change"` and the round is not solved, returns `{ ...state, pile: state.dealt, change: [], message: NO_MESSAGE }`. Every other case is unchanged.
  - `transferCoins(state, uids: number[], leaderUid: number, from: "pile" | "change", to: "pile" | "change", x: number, y: number, compact = false): state`.
    - Returns the same object when the mode is not `give-change`, the round is solved, `from === to`, either key is invalid, or `leaderUid` is not in `state[from]`.
    - Otherwise removes the named entries (ignoring unknown uids) from `state[from]` and appends them to `state[to]` with fresh `uid`s from `nextUid`, in their existing order with the leader last. The leader lands at `clampPosition(x, y)`; the others keep their offset from the leader. The new entries are settled with `settleGroup(list, newUids, newLeaderUid, null, pileHeightMm(state, to, compact))`.
    - When `to === "pile"` and `total(state.pile)` plus the moved coins' value exceeds `state.paid`, it returns `{ ...state, message: { text: "That is more than they paid. Press Clear to start again.", kind: "hint" } }` with both lists unchanged. On success it clears the message.

- [ ] **Step 1: Write the failing tests** in `tests/state.test.js` (use `startGiveChange(createState(), NORMAL, seeded(n))`, `pileOf`, and set `pile`, `price`, `paid`, `scenario` explicitly where a test needs fixed amounts):
  - `startGiveChange` sets `paid === total(pile)` and `dealt` deep-equals `pile`; `nextGiveChangeCustomer` does the same for its new pile; `createState()` has `paid: 0, dealt: []`.
  - Transfer pile to change: moving one `50p` from a customer pile of `£1, 50p` puts a `50p` entry in `change` with a new uid, leaves `£1` in `pile`, and keeps `paid`, `price`, `scenario`.
  - Transfer change to pile within the limit succeeds (move a `50p` out, then back).
  - Limit: a customer pile of `£1` with `paid` 100 and a change pile holding a `20p`; moving the `20p` into `pile` returns a state whose `pile` and `change` are the same arrays and whose message is the refusal hint with kind `"hint"`.
  - Group limit: moving two coins whose total would exceed `paid` is refused as a whole (neither moves).
  - A group transfer into `change` moves every named coin and keeps their relative offsets (leader at the clamped drop point, others offset by their original difference), and the leader is the last entry.
  - Allowed in exact and underpaid rounds (set `scenario` to `"exact"` and `"under"`); `scenario`, `price` and `paid` are unchanged afterwards.
  - Returns the same object for: `endless` mode, a solved round, `from === to`, key `"tray"`, an unknown `leaderUid`.
  - `submitGiveChangeAnswer(..., "check")` on an overpaid round is correct when the change pile holds a coin transferred from the customer pile and totals `paid - price`; `"none"` on an exact round still succeeds after a customer coin was moved out (judging uses `paid`); the "short by" amount in the underpaid success message uses `paid`.
  - Clear: after a transfer and a tapped-away coin, `clearPile(s, "change")` gives `pile` deep-equal to the `dealt` entries and `change` `[]` with an empty message; a solved round is returned unchanged (`===`); `clearPile` in `cashier`/`endless` is unchanged (existing tests keep passing).
- [ ] **Step 2: Run** `node --test tests/state.test.js`. Expected: FAIL (missing `paid`, `dealt`, `transferCoins`).
- [ ] **Step 3: Implement** the interfaces above in `src/state.js`; export `transferCoins`. Add a short comment on why judging uses `paid`.
- [ ] **Step 4: Run** `node --test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: store the paid amount, restore it on Clear and transfer coins between piles`.

---

### Task 4: Cross-pile drag in `createDrag`

**Files:**
- Modify: `src/drag.js` (`createDrag`)
- Modify: `styles.css` (one rule for dimmed pile coins being dragged)
- Test: `tests/drag.dom.test.js`

**Interfaces:**
- Consumes: `pointInRect`, `toPileFraction`, `paddingRect`, `coinSizePx` (already in `src/drag.js`).
- Produces: `createDrag(container, { ...existing, dropTarget, onTransfer })`:
  - `dropTarget(point: { x, y }): { key: string, el: HTMLElement, heightMm: number } | null`. Called once when a drag passes the threshold, with the drag's start point. `null` means a classic drag, exactly as today. Non-null switches this drag to ghost mode.
  - `onTransfer(uids: number[], leaderUid: number, targetKey: string, x: number, y: number): void`, called on release over a target pile whose `el` is not `container`. `x`, `y` are the leader's pile fractions in the target (`toPileFraction` against the target's `paddingRect(el)` and its `heightMm`, using the leader's centre offset `offX`, `offY` as `onMove` does).
- Ghost mode:
  - Each dragged member (the group if `t.group`, else `t.el`) gets a `div.tray-ghost` appended to `document.body`, `aria-hidden`, `position: fixed`, sized to the member's rendered width, holding a clone of its `svg`, and copying the `revealed` class. Ghosts follow the pointer (`translate` of the member's start centre plus the pointer delta). The sources get the class `dragging-source` and do not get `dragging` or `--dx` / `--dy`.
  - While the pointer is over a target pile other than `container`, that pile's `el` has the class `over-pile`; it is removed when the pointer leaves, and on release or cancel.
  - Release: ghosts are removed and the sources un-dimmed in every case. Over another pile: `onTransfer`. Over `container` itself: the existing `onMove` / `onMoveGroup` path. Outside both piles: nothing is called and nothing moves (the coin stays where it was).
  - `pointercancel`, a lost capture, and `abandon()` also remove ghosts, the dimming and `over-pile`.
  - Threshold, hold-to-detach, suppress-click and multi-pointer logic are unchanged.

- [ ] **Step 1: Write the failing tests** in `tests/drag.dom.test.js`, reusing `makeContainer`, `addCoin`, `stubRect` and `pointer` (add a second stubbed container for the other pile, e.g. a 400x300 box at `top: 400`, and give both containers `clientLeft`, `clientTop`, `clientWidth`, `clientHeight`):
  - With `dropTarget` returning the drag's own pile `{ key: "pile", el: own, heightMm }`: after a move past the threshold `document.body` has one `.tray-ghost` per dragged coin, the source has `dragging-source` and not `dragging`.
  - Moving the pointer over the other container adds `over-pile` to it and not to the own one; moving back removes it.
  - Release over the other container calls `onTransfer([uid], uid, "change", x, y)` with `x`, `y` equal to `toPileFraction` of the pointer plus the coin's centre offset against the other container's rect, and does not call `onMove`; ghosts and `dragging-source` and `over-pile` are gone afterwards.
  - A group (`getGroup` returns two uids, drag after the hold or a normal group drag) produces two ghosts and one `onTransfer` with both uids and the leader's uid.
  - Release over the own container calls `onMove` (not `onTransfer`) and removes the ghosts.
  - Release outside both containers calls neither, removes the ghosts, and leaves the coin's element without `dragging-source`.
  - `pointercancel` mid-drag removes the ghosts, `dragging-source` and `over-pile`.
  - `dropTarget` returning `null` at the start gives no ghosts, the `dragging` class and `--dx`, and `onMove` on release, exactly as in the existing tests; a drag with no `dropTarget` option at all is unchanged (the existing tests cover this and must keep passing).
- [ ] **Step 2: Run** `node --test tests/drag.dom.test.js`. Expected: FAIL on the new tests, existing ones pass.
- [ ] **Step 3: Implement** the interfaces above in `src/drag.js`. In `styles.css` add `.pile-coin.dragging-source { opacity: 0.5; }` next to the `.coin.dragging-source` rule; `.tray-ghost`, `.tray-ghost svg` and `.pile.over-pile` already exist.
- [ ] **Step 4: Run** `node --test`. Expected: all pass.
- [ ] **Step 5: Amend the spec** to match two decisions made here: in the "Moving coins" requirement, a release outside both piles keeps the coin where it was (today's in-pile drag clamps it to the pile edge, which would read as a failed transfer when `dropTarget` is on); and in the `src/drag.js` design, `dropTarget` returns `{ key, el, heightMm }` and is called once at drag start with the start point. Commit the spec with the code.
- [ ] **Step 6: Commit** `feat: draw cross-pile drags as ghosts and report drops on the other pile`.

---

### Task 5: Wire the two piles, layout and README

**Files:**
- Modify: `src/main.js` (`wirePile`, imports)
- Modify: `styles.css` (only if the Give Change screen no longer fits)
- Modify: `README.md` (Give Change paragraph, lines ~41-47)

**Interfaces:**
- Consumes: `transferCoins` (`src/state.js`), `pointInRect` (`src/drag.js`, export it from the existing import), `createDrag` options from Task 4.

- [ ] **Step 1: `src/main.js`.** In `wirePile(key)` pass to `createDrag`:
  - `dropTarget: (pt) => { if (state.mode !== "give-change") return null; for (const k of ["pile", "change"]) { const el = pileEl(k); if (pointInRect(pt, el.getBoundingClientRect())) return { key: k, el, heightMm: heightOf(k) }; } return null; }`.
  - `onTransfer: (uids, leaderUid, to, x, y) => update(transferCoins(state, uids, leaderUid, key, to, x, y, compactQuery.matches))`.
  Import `transferCoins` and `pointInRect`. After a transfer, hand focus to the moved coin: if a coin in the source pile had focus, focus the last child of the target pile (the leader is appended last).
- [ ] **Step 2: Run** `node --test`. Expected: all pass (`main.js` has no unit tests).
- [ ] **Step 3: Verify in a browser** (do not run e2e). Start `npm start`, then drive it with a throwaway Playwright script kept outside the repo (e.g. `/tmp`), at 390 × 844 and 375 × 667. Check:
  - Give Change: the two pile boxes have the same height (5 cm, 4 cm at 375 × 667) and the screen fits without scrolling at 375 × 667.
  - Dragging a customer coin onto the change pile moves it; the dragged coin stays visible all the way across; the target pile highlights; dragging a change coin back works within the limit.
  - Dragging a change coin into the customer pile past what they paid snaps back with the hint "That is more than they paid. Press Clear to start again." Clear then restores the customer coins and empties the change pile.
  - Releasing a coin outside both piles leaves it where it was.
  - Reload and start Give Change until a round answers "Correct! No change due." to an empty Check (about one in three to four rounds), to confirm the empty Check; Endless, Custom and Cashier drags still move coins inside their pile with no ghost.
  Adjust spacing in `styles.css` only if a layout check fails.
- [ ] **Step 4: `README.md`.** Update the Give Change paragraph: both piles are 5 cm (4 cm on short screens), customer coins and change coins can be dragged between the piles, giving back more than they paid is refused with a hint to press Clear, Clear restores everything, and an empty Check counts as No change. Remove the old 4 cm / 6 cm wording.
- [ ] **Step 5: Commit** `feat: drag coins between the customer pile and your change`.
