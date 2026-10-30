# Option Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every menu option shows a badge (icon plus word: Easier, Harder or Neutral) and a visible one-line reason, so the player knows what switching it on does.

**Architecture:** Registry entries in `src/options.js` gain `effect` and `why`; `src/home.js` renders them; badge colours reuse existing themed variables so the contrast tests keep covering them. This is sub-project 1 of 4; plans 2-4 add registry entries that must carry `effect` and `why` too.

**Tech Stack:** Vanilla ES modules, `node --test` (jsdom for DOM tests). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-timing-stacking-and-option-clarity-design.md` (sections "Options registry changes" and "1. Option badges")

## Global Constraints

- `effect` is one of `"easier" | "harder" | "neutral"` and describes what turning the option **on** does.
- Meaning is never carried by colour alone: icon shape plus the word.
- Effects for the options that exist now: `showCoins` easier, `largeCoins` neutral, `shortPay` harder.
- `why` begins with the effect word, for example "Harder: customers may not pay enough".
- Press-and-hold (dwell) keeps showing `hint` through the label `title`.
- Commit messages are conventional (`feat:`, `test:`) and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No e2e changes.

## Review Focus

- A registry entry with a missing or unknown `effect` must fail a test, not render a blank badge.
- The visible `why` line must not be duplicated for screen readers (one `aria-describedby` target, not two).
- Badge text must still fit a 320 px wide phone screen without clipping the label.
- Toggling a checkbox must still keep its focus (the list is rebuilt only on a mode change).
- A dark-theme badge must meet the same contrast as other text (reusing `--good`, `--bad`, `--muted` guarantees it).

---

### Task 1: Registry effect and why

**Files:**
- Modify: `src/options.js`
- Test: `tests/options.test.js`

**Interfaces:**
- Produces: `OPTIONS` entries with `effect: "easier" | "harder" | "neutral"` and `why: string`; exported `EFFECTS = ["easier", "harder", "neutral"]`.

- [ ] **Step 1: Write failing tests in `tests/options.test.js`:**
  - `every option has a known effect and a why that starts with that effect`: for each option, `EFFECTS.includes(o.effect)` and `o.why.startsWith(o.effect[0].toUpperCase() + o.effect.slice(1) + ":")`.
  - `the current options are classified as the spec says`: `Object.fromEntries(OPTIONS.map((o) => [o.id, o.effect]))` deep-equals `{ showCoins: "easier", largeCoins: "neutral", shortPay: "harder" }`.
- [ ] **Step 2: Run** `node --test tests/options.test.js`. Expected: FAIL (`EFFECTS` not exported / `effect` undefined).
- [ ] **Step 3: Add `EFFECTS`, and `effect` plus `why` to the three entries** in `src/options.js`. Wording: showCoins "Easier: every coin's value is shown"; largeCoins "Neutral: bigger coins, but fewer fit"; shortPay "Harder: customers may not pay enough".
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `src/options.js tests/options.test.js` as `feat: classify each option as easier, harder or neutral`.

### Task 2: Render the badge and the reason

**Files:**
- Modify: `src/home.js` (`optionRows`), `styles.css` (near `.options label`)
- Test: `tests/home.dom.test.js`, `tests/home-css.test.js`

**Interfaces:**
- Consumes: `o.effect`, `o.why` from Task 1.
- Produces: per option, inside the `<label>`, a `<span class="badge badge-<effect>">` holding an `aria-hidden` inline `<svg>` icon and the effect word; the `why` text in a visible `<small id="option-help-<id>" class="why">` after the label, which the checkbox's `aria-describedby` points at (this replaces the `sr-only` help span).

- [ ] **Step 1: Write failing tests in `tests/home.dom.test.js`** (using `withHome`):
  - `each option shows an icon and the effect word`: after `home.update("give-change", OPTS)`, the label of `shortPay` contains `.badge.badge-harder` whose text is `"Harder"` and which contains one `svg[aria-hidden="true"]`; the `showCoins` badge text is `"Easier"`.
  - `the why line is visible and described-by`: `document.getElementById(box.getAttribute("aria-describedby"))` has text `"Harder: customers may not pay enough"` and class `why` and not `sr-only`.
  - Update the existing "carries its hint as a title and a described-by help line" test so its described-by expectation is the `why` text, keeping the `title` equal to the hint.
- [ ] **Step 2: Write a failing test in `tests/home-css.test.js`:** the three rules `.badge-easier`, `.badge-harder`, `.badge-neutral` exist in `styles.css` and use `var(--good)`, `var(--bad)` and `var(--muted)` respectively.
- [ ] **Step 3: Run** `node --test tests/home.dom.test.js tests/home-css.test.js`. Expected: FAIL.
- [ ] **Step 4: Implement in `src/home.js`:** a `badge(effect)` helper returning the span with a small inline SVG per effect (easier: upward arrow, harder: downward arrow, neutral: horizontal bar) and the capitalised word; `optionRows(o)` puts the badge inside the label after the text and returns `[label, el("small", { className: "why", id: ... }, o.why)]`.
- [ ] **Step 5: Implement the CSS:** `.badge` is inline-flex, small, bordered 1.5px in `currentColor`, with the colour per effect from the Global Constraints; `.why` is muted, 0.85rem, indented to line up under the label text. The row must wrap rather than clip at 320 px (`flex-wrap: wrap` on the label, with the label text taking the remaining width).
- [ ] **Step 6: Run** `npm test`. Expected: all pass.
- [ ] **Step 7: Commit** `src/home.js styles.css tests/home.dom.test.js tests/home-css.test.js` as `feat: show an easier, harder or neutral badge and reason on each option`.
