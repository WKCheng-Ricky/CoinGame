# Auto-stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** With the new Auto-stack option on (default), the customer's dealt coins in Cashier and Give Change form one same-coin stack per denomination, spread so no stack covers another, in no value order.

**Architecture:** A pure `layoutStacks` in `src/game.js` builds the whole dealt pile; `dealHandful` in `src/state.js` uses it when `state.options.autoStack` is on and keeps today's scatter otherwise. Stack members use the existing `STACK_STEP_MM` offsets, so `stackCounts`, `unitUids` and drag behave as for hand-made stacks. Sub-project 2 of 4; run after plan 1 so the new entry carries `effect` and `why`.

**Tech Stack:** Vanilla ES modules, `node --test`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-timing-stacking-and-option-clarity-design.md` (sections "Options registry changes" and "2. Auto-stack")

## Global Constraints

- Option id `autoStack`, label "Auto-stack", scope `["cashier", "give-change"]`, boolean, **default on**, effect `"easier"`, why "Easier: matching coins are stacked and kept apart", hint "Matching coins are stacked and spread apart".
- Registry order: `showCoins`, `largeCoins`, then mode-specific entries with `autoStack` before `shortPay`.
- Dealt coins only: `placeCoin`, `placeHandfulCoin`, drag, send and transfer are unchanged. Option off means exactly today's `dealHandful` behaviour.
- Stacks are not ordered by value; stack bottoms step by `STACK_STEP_MM`; one rotation per stack.
- A handful of up to `MAX_HANDFUL` (12) must always lay out. When a box is too small for no overlap, minimise overlap instead of failing.
- Conventional commits ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No e2e changes.

## Review Focus

- 12 coins of one denomination: a single tall stack that stays inside the pile bounds (positions clamped to ±0.5).
- 8 different denominations in the Large Coins Give Change box (play height about 2 mm): no throw, all coins present, positions valid.
- The compact (short-screen) boxes: same guarantees as above.
- Give Change Clear must still restore the exact dealt layout (`dealt` is the laid-out pile).
- The same seed gives the same layout (determinism for tests), and `rng` is never called a variable number of times between the two layout paths in a way that breaks existing seeded tests (option off path untouched).

---

### Task 1: The layout function

**Files:**
- Modify: `src/game.js`
- Test: `tests/game.test.js`

**Interfaces:**
- Produces: `layoutStacks(coinIds: string[], rng: () => number, heightMm: number = pileHeightDefaultMm()) -> Array<{ coinId: string, x: number, y: number, rot: number }>` — one entry per input id, grouped so each denomination is one stack (members of a stack are consecutive in the result, bottom first), with positions inside `[-0.5, 0.5]`.
- Produces: `stackOverlapMm(entries, heightMm = pileHeightDefaultMm()) -> number` — total overlap depth between stacks of different denominations (0 when none), used by the tests and by the layout's own choice.

- [ ] **Step 1: Write failing tests in `tests/game.test.js`** (reset the scale with `setCoinScale(1)` in a `finally` wherever the test changes it):
  - `layoutStacks returns every coin id once, one stack per denomination`: for `["1p","1p","£2","5p","1p"]` the result has 5 entries, the three `1p` entries are consecutive, and `stackCounts` over the entries (given uids 1..n) reports a count of 3.
  - `a stack steps by STACK_STEP_MM and shares one rotation`: members of the `1p` stack differ by `STACK_STEP_MM.x / pileWidthMm()` in x and `STACK_STEP_MM.y / PILE_HEIGHT` in y, and share `rot`.
  - `no two stacks overlap at coin scale 1 in the default pile box`: for seeds 1..200 (`seeded` from `pile-helper.js`) and `randomHandful(seeded(seed))`, `stackOverlapMm(...) === 0`.
  - `no two stacks overlap in the normal Give Change customer box` (`heightForBox(customerBoxMm())`): same, for seeds 1..200.
  - `stacks are not placed in value order`: across seeds 1..50 with a handful of at least 4 denominations, the order of stacks by x is not always ascending by pence.
  - `a 12-coin single stack stays inside the pile bounds`.
  - `tight boxes still lay out every coin`: with `setCoinScale(1.5)` and heights `heightForBox(customerBoxMm())`, `heightForBox(CUSTOMER_BOX_COMPACT_MM)`, and `pileHeightDefaultMm()`, for seeds 1..50: length equals input length, all `x`/`y` in `[-0.5, 0.5]`, no NaN.
  - `same seed gives the same layout`.
- [ ] **Step 2: Run** `node --test tests/game.test.js`. Expected: FAIL (`layoutStacks` not exported).
- [ ] **Step 3: Implement `layoutStacks` and `stackOverlapMm`.** Algorithm: group ids by denomination; a stack's disc radius is the coin radius (`diameterOf`) plus `(n - 1) * hypot(STACK_STEP_MM.x, STACK_STEP_MM.y)`; try up to `MAX_PLACEMENT_TRIES` random bottom positions per stack (range ±0.5 shrunk so the whole stack stays inside), accepting the first with zero overlap against placed stacks, else the least-overlapping; shuffle the stack order first with `rng`. If the sampled layout has overlap, also build a jittered-grid layout (cells sized to the largest stack disc, cells shuffled, jitter within the cell slack) and keep whichever has the smaller `stackOverlapMm`. Positions go through `clampPosition`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `src/game.js tests/game.test.js` as `feat: lay out dealt coins as separate same-coin stacks`.

### Task 2: The option and the deal

**Files:**
- Modify: `src/options.js`, `src/state.js` (`dealHandful`)
- Test: `tests/options.test.js`, `tests/state.test.js`, `tests/home.dom.test.js`

**Interfaces:**
- Consumes: `layoutStacks(coinIds, rng, heightMm)` from Task 1; `pileHeightMm(state, "pile")`.
- Produces: option `autoStack`; `dealHandful` builds uids `1..n` in layout order when `state.options.autoStack` is on.

- [ ] **Step 1: Write failing tests:**
  - `options.test.js`: `defaultOptions()` now includes `autoStack: true`; `optionsFor("cashier")` is `["showCoins", "largeCoins", "autoStack"]`; `optionsFor("give-change")` is `["showCoins", "largeCoins", "autoStack", "shortPay"]`; `optionsFor("endless")` is unchanged.
  - `state.test.js`: update the `createState` shape for the new default. `startCashier with Auto-stack on deals one stack per denomination`: `stackCounts(state.pile)` has one entry per repeated denomination and no two same-denomination coins are apart (use a seeded rng). `startGiveChange` likewise, and `state.dealt` equals the laid-out pile. `with Auto-stack off, startCashier deals exactly the pile the old path dealt for the same seed` (build the expected pile with `placeHandfulCoin` directly). `Clear in Give Change restores the stacked layout`. `Endless and Custom are unaffected`.
  - `home.dom.test.js`: update the checkbox lists for the new option and its position.
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Add the `autoStack` entry to `OPTIONS`** (Global Constraints values) and, in `dealHandful`, branch on `state.options.autoStack`: lay out with `layoutStacks(ids, rng, pileHeightMm(state, "pile"))` and map to entries `{ uid: i + 1, ...placed }`, with `nextUid` set to `ids.length + 1`; otherwise keep the existing reduce.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `src/options.js src/state.js tests/options.test.js tests/state.test.js tests/home.dom.test.js` as `feat: add the Auto-stack option for Cashier and Give Change`.
