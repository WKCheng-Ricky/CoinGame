# Branding and Home Screen Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the game to "Coin Counting Game", add a favicon, and rebuild the home screen as a fixed top bar, a scrolling middle and a fixed bottom Play bar, with an icon-only gear, a tight tagline and a disclaimer footer.

**Architecture:** The home screen markup in `index.html` is regrouped into three regions (`.home-bar`, `.home-body`, `.home-foot`) keeping every existing element id, so `src/home.js` and `src/main.js` keep working unchanged apart from the gear icon size. Layout is CSS only. Two new static files (`favicon.svg`, `apple-touch-icon.png`) join the Pages deploy list. The gear icon in `src/icons.js` is replaced by a real cogwheel.

**Tech Stack:** Plain HTML, CSS and ES modules, `node --test` with jsdom, Playwright (already a devDependency, used once to render the PNG).

**Spec:** `docs/superpowers/specs/2026-10-31-branding-and-home-chrome-design.md`

## Global Constraints

- The user-visible name is exactly **Coin Counting Game**. The repo, the package name `coin-game`, the CI badge URL and the live site URL do not change. Old docs under `docs/superpowers/` keep their titles.
- Top bar: Options (gear) on the left, theme toggle on the right, each at least 44 x 44 px. Bottom bar: Play only. Options is not repeated in the bottom bar.
- The Options button has no visible text: `aria-label="Options"` and `title="Options"`.
- Disclaimer text, verbatim: `Unofficial educational game. Not affiliated with or endorsed by The Royal Mint. Coin pictures are original illustrations.`
- The Pages job stages a fixed file list; every file the page references must be on it and in `tests/pages-site.test.js`.
- No build step, no new dependencies. Do not edit `e2e/` (paused, owner's instruction).
- Commit messages use Conventional Commits and end with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Run the unit suite with `npm test` (it runs `node --test`).

## Review Focus

- A long title wraps at 320 px instead of widening the home screen (`#screen-home h1` has `overflow-wrap`); pinned in Task 4's CSS test.
- A short landscape phone (`max-height: 30rem`) must still scroll the middle while both bars stay put: `.home-body` has `min-height: 0` and `overflow-y: auto`; pinned in Task 4.
- Screen readers must hear "Options" and "Theme: ..." for icon-only buttons, and the icons stay `aria-hidden`; pinned in Task 4's markup test and Task 3.
- When the browser lacks `light-dark()` the theme toggle is hidden; the top bar must still hold the Options button on the left (`justify-content: space-between` with the right group kept in the DOM); pinned in Task 4.
- A deploy that is missing `favicon.svg` or `apple-touch-icon.png` ships a broken icon; pinned in Task 2 through the Pages staging tests.

---

## File Structure

- Modify `index.html`: title, home markup regions, icon links, tagline class, disclaimer.
- Modify `styles.css`: home regions, icon-only buttons, tagline, disclaimer.
- Modify `src/icons.js`: real `gear` cogwheel.
- Modify `src/main.js` (one line): gear icon size.
- Modify `README.md`, `.github/workflows/ci.yml`, `tests/pages-site.test.js`, `tests/icons.test.js`, `tests/home-css.test.js`.
- Create `favicon.svg`, `apple-touch-icon.png`, `tests/index-html.test.js`.

---

### Task 1: Rename to Coin Counting Game

**Files:**
- Create: `tests/index-html.test.js`
- Modify: `index.html` (the `<title>` and the home `<h1>`), `README.md`

**Interfaces:**
- Produces: `tests/index-html.test.js` exporting nothing; it defines a local `load()` that parses `index.html` with jsdom and returns `document`. Later tasks add tests to this file and reuse `load()`.

- [ ] **Step 1: Write the failing tests** in `tests/index-html.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const load = () => new JSDOM(readFileSync(new URL("../index.html", import.meta.url), "utf8")).window.document;

test("the page title and the home heading say Coin Counting Game", () => {
  const doc = load();
  assert.equal(doc.title, "Coin Counting Game");
  assert.equal(doc.querySelector("#screen-home h1").textContent, "Coin Counting Game");
});

test("the README heading uses the new name", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /^# Coin Counting Game$/m);
});
```

- [ ] **Step 2: Run it to verify it fails.** Run: `node --test tests/index-html.test.js`. Expected: both tests FAIL (title is "Coin Game").
- [ ] **Step 3: Change** `<title>` and the home `<h1>` text in `index.html` to "Coin Counting Game"; in `README.md` change the `# Coin Game` heading and make the opening line start "Coin Counting Game: match a target amount using UK coins (1p to £2)." Leave the badge and live URLs alone.
- [ ] **Step 4: Run** `node --test tests/index-html.test.js`. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add tests/index-html.test.js index.html README.md
git commit -m "feat: rename the game to Coin Counting Game"
```

---

### Task 2: Favicon and iPhone icon, staged for deploy

**Files:**
- Create: `favicon.svg`, `apple-touch-icon.png`
- Modify: `index.html` (`<head>`), `.github/workflows/ci.yml` (the `cp -r` line, about line 87), `tests/pages-site.test.js`, `tests/index-html.test.js`

**Interfaces:**
- Produces: staged entries now include `favicon.svg` and `apple-touch-icon.png`.

- [ ] **Step 1: Write the failing tests.** In `tests/pages-site.test.js` change the "staged entries" test to expect (sorted) `["apple-touch-icon.png", "favicon.svg", "fonts", "index.html", "src", "styles.css", "theme-boot.js"]` and rename it "staged entries are exactly the seven runtime files". In `tests/index-html.test.js` add:

```js
test("the head links the SVG favicon and the iPhone touch icon", () => {
  const doc = load();
  const icon = doc.querySelector('link[rel="icon"]');
  assert.equal(icon.getAttribute("href"), "favicon.svg");
  assert.equal(icon.getAttribute("type"), "image/svg+xml");
  assert.equal(doc.querySelector('link[rel="apple-touch-icon"]').getAttribute("href"), "apple-touch-icon.png");
});
```

- [ ] **Step 2: Run** `node --test tests/pages-site.test.js tests/index-html.test.js`. Expected: FAIL (entries differ, links missing).
- [ ] **Step 3: Create `favicon.svg`** exactly:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#d4af37" stroke="#a8832a" stroke-width="2"/><circle cx="32" cy="32" r="23" fill="#e3c25a" stroke="#a8832a" stroke-width="3"/><text x="32" y="43" text-anchor="middle" font-family="system-ui, sans-serif" font-size="32" font-weight="700" fill="#7a5c12">£</text></svg>
```

- [ ] **Step 4: Create `apple-touch-icon.png`** (180 x 180, the coin on a solid `#f6f3ec` background, coin about 140 px wide and centred). Render it once with a throwaway script kept outside the repo (for example `/tmp/make-icon.mjs`) that uses Playwright's `chromium` to open an HTML page with that background and `favicon.svg` as an `<img>`, then screenshots a 180 x 180 clip to `apple-touch-icon.png`. If the browser is missing run `npx playwright install chromium` first. Open the PNG with the Read tool and confirm the coin and "£" are visible. Commit the PNG only, not the script.
- [ ] **Step 5: Add the head links** to `index.html` after the `<meta name="theme-color">` line: `<link rel="icon" href="favicon.svg" type="image/svg+xml">` and `<link rel="apple-touch-icon" href="apple-touch-icon.png">`. In `.github/workflows/ci.yml` change the copy line to `cp -r index.html styles.css theme-boot.js favicon.svg apple-touch-icon.png src fonts _site/`.
- [ ] **Step 6: Run** `npm test`. Expected: all PASS (the staging tests also confirm both files exist in the repo root and that every local reference is staged).
- [ ] **Step 7: Commit**

```bash
git add favicon.svg apple-touch-icon.png index.html .github/workflows/ci.yml tests/pages-site.test.js tests/index-html.test.js
git commit -m "feat: add a favicon and iPhone home-screen icon and stage them for deploy"
```

---

### Task 3: Real gear icon

**Files:**
- Modify: `src/icons.js` (the `gear` entry in `SHAPES`), `tests/icons.test.js`

**Interfaces:**
- Produces: `icon("gear", size)` now draws a cogwheel. `ICON_NAMES` is unchanged.

- [ ] **Step 1: Write the failing test** in `tests/icons.test.js`:

```js
test("the gear is a toothed cogwheel with a centre hole, not rays", withDom(() => {
  const svg = icon("gear");
  const d = svg.querySelector("path").getAttribute("d");
  assert.match(d, /^M/);
  assert.ok(d.endsWith("Z"), "the outline is closed");
  assert.equal(d.match(/[ML]/g).length, 32, "8 teeth of 4 corners each");
  assert.doesNotMatch(d, /M12 2v3/, "no longer the sun-like rays");
  assert.equal(svg.querySelector("circle").getAttribute("r"), "3");
}));
```

- [ ] **Step 2: Run** `node --test tests/icons.test.js`. Expected: FAIL.
- [ ] **Step 3: Replace the `gear` shapes** with one closed polygon `path` and the existing centre `["circle", { cx: 12, cy: 12, r: 3 }]`. The polygon is built from 8 teeth centred at angles `45k` degrees (k = 0..7) around (12, 12), each tooth four absolute vertices in order: root radius 7.5 at angle -13 deg, outer radius 10 at -8 deg, outer radius 10 at +8 deg, root radius 7.5 at +13 deg (relative to the tooth centre). Use `M` for the first vertex, `L` for the other 31, then `Z`; round coordinates to one decimal.
- [ ] **Step 4: Run** `node --test tests/icons.test.js`. Expected: PASS.
- [ ] **Step 5: Check it by eye.** Render `icon("gear", 96)` in a throwaway page with Playwright (same approach as Task 2, script outside the repo), Read the screenshot, and confirm it reads as a cogwheel. Adjust the tooth widths if it looks like a star or a blob, keeping the 32-vertex shape.
- [ ] **Step 6: Commit**

```bash
git add src/icons.js tests/icons.test.js
git commit -m "feat: draw the gear icon as a real cogwheel"
```

---

### Task 4: Top bar, scrolling middle and bottom Play bar

**Files:**
- Modify: `index.html` (the `#screen-home` section), `styles.css` (lines 302-303 and the `.options-btn` / `.theme-toggle` rules near 334-338), `src/main.js:604`, `tests/index-html.test.js`, `tests/home-css.test.js`

**Interfaces:**
- Consumes: every existing id stays: `btn-options`, `btn-theme`, `modes`, `presets`, `preset-note`, `btn-large`, `chips`, `btn-play`; `mountHome` in `src/home.js` and the `$("btn-...")` lookups in `src/main.js` are not changed.
- Produces: classes `.home-bar`, `.home-end`, `.home-body`, `.home-foot`.

- [ ] **Step 1: Write the failing tests.** In `tests/index-html.test.js`:

```js
test("the home screen has a top bar with Options on the left and the theme toggle on the right", () => {
  const doc = load();
  const bar = doc.querySelector("#screen-home > .home-bar");
  const options = bar.querySelector("#btn-options");
  assert.equal(options.textContent.trim(), "", "icon-only: no visible text");
  assert.equal(options.getAttribute("aria-label"), "Options");
  assert.equal(options.getAttribute("title"), "Options");
  assert.equal(bar.firstElementChild, options);
  assert.ok(bar.querySelector(".home-end #btn-theme"));
});

test("Play is alone in a bottom bar outside the scrolling middle, and Options is not repeated there", () => {
  const doc = load();
  const foot = doc.querySelector("#screen-home > .home-foot");
  assert.ok(foot.querySelector("#btn-play"));
  assert.equal(foot.querySelectorAll("button").length, 1);
  const body = doc.querySelector("#screen-home > .home-body");
  assert.ok(!body.querySelector("#btn-play"));
  assert.ok(body.querySelector("#modes") && body.querySelector("#presets") && body.querySelector("#btn-large") && body.querySelector("#chips"));
  assert.equal(doc.querySelectorAll("#btn-options").length, 1);
});
```

In `tests/home-css.test.js` (it has the `rule(selector)` helper that matches a rule written at the start of a line):

```js
test("the home bars stay put and only the middle scrolls", () => {
  assert.match(rule(".home-bar"), /flex:\s*none/);
  assert.match(rule(".home-bar"), /justify-content:\s*space-between/);
  assert.match(rule(".home-foot"), /flex:\s*none/);
  assert.match(rule(".home-body"), /min-height:\s*0/);
  assert.match(rule(".home-body"), /overflow-y:\s*auto/);
});

test("the home title wraps rather than widening the screen, and the buttons are at least 44px", () => {
  assert.match(rule("#screen-home h1"), /overflow-wrap:\s*anywhere/);
  assert.match(rule(".options-btn"), /min-width:\s*44px/);
  assert.match(rule(".options-btn"), /min-height:\s*44px/);
  assert.doesNotMatch(rule(".options-btn"), /position:\s*absolute/);
  assert.doesNotMatch(rule(".theme-toggle"), /position:\s*absolute/);
});
```

- [ ] **Step 2: Run** `node --test tests/index-html.test.js tests/home-css.test.js`. Expected: new tests FAIL.
- [ ] **Step 3: Regroup the markup** in `index.html`. `#screen-home` becomes three children: `<header class="home-bar">` holding `#btn-options` (no text; add `aria-label="Options" title="Options"`, keep `class="options-btn" type="button"`) then `<div class="home-end">` holding the existing `#btn-theme` button unchanged; `<div class="home-body">` holding the `<h1>`, the tagline `<p>`, the Game heading and `#modes`, the Quick settings heading, `#presets`, `#preset-note`, `#btn-large` and `#chips`; and `<div class="home-foot">` holding `#btn-play` only.
- [ ] **Step 4: Change the CSS.**
  - Take `#screen-home` out of the shared `#screen-home, #screen-custom, #screen-options` rule and give it its own: `#screen-home { flex: 1; min-height: 0; display: flex; flex-direction: column; }` (delete the old grid, `padding-top: 2.75rem` and `position: relative`).
  - Add (each rule on its own lines starting at the left edge, as the tests expect): `.home-bar { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }`, `.home-end { display: flex; align-items: center; gap: 0.25rem; }`, `.home-body { flex: 1; min-height: 0; overflow-y: auto; display: grid; align-content: safe center; justify-items: center; text-align: center; }`, `.home-foot { flex: none; padding-top: 0.5rem; border-top: 1px solid var(--line); }`, and `#screen-home h1 { overflow-wrap: anywhere; }` (the bottom safe-area inset is already covered by `main`'s padding, so the bar adds none).
  - `.options-btn`: drop `position`/`top`/`left`, the gap and the text padding; make it a 44 x 44 icon button: `display: grid; place-items: center; min-width: 44px; min-height: 44px; padding: 0; border-radius: 50%; color: var(--ink);`.
  - `.theme-toggle`: drop `position: absolute; top: 0; right: 0;`, keep the rest.
  - Keep the `.play` rule (max-width 18.5rem, centred) so Play stays the same width; its `margin` is reduced to `0 auto 0.25rem` because the bar now frames it.
- [ ] **Step 5: Make the gear 24 px** in `src/main.js:604`: `icon("gear", 24)`.
- [ ] **Step 6: Run** `npm test`. Expected: all PASS. Then run `npm start`, open the printed URL, and check at 320 px, 390 px and a short landscape height: the gear (left) and theme toggle (right) never scroll away, Play stays pinned, the middle scrolls, and Back from the Options screen returns focus to the gear.
- [ ] **Step 7: Commit**

```bash
git add index.html styles.css src/main.js tests/index-html.test.js tests/home-css.test.js
git commit -m "feat: add a home top bar and a pinned Play bar with an icon-only gear"
```

---

### Task 5: Tight tagline and disclaimer footer

**Files:**
- Modify: `index.html` (tagline and a footer paragraph inside `.home-body`), `styles.css`, `tests/index-html.test.js`, `tests/home-css.test.js`

**Interfaces:**
- Consumes: `.home-body` from Task 4.
- Produces: `p.tagline`, `p.disclaimer`.

- [ ] **Step 1: Write the failing tests.** In `tests/index-html.test.js`:

```js
test("the tagline follows the title directly and the disclaimer ends the scrolling middle", () => {
  const doc = load();
  const title = doc.querySelector("#screen-home h1");
  assert.ok(title.nextElementSibling.matches("p.tagline"));
  assert.equal(title.nextElementSibling.textContent, "Make the amount using UK coins.");
  const note = doc.querySelector("#screen-home .home-body > p.disclaimer:last-child");
  assert.equal(note.textContent, "Unofficial educational game. Not affiliated with or endorsed by The Royal Mint. Coin pictures are original illustrations.");
});
```

In `tests/home-css.test.js`:

```js
test("the tagline hugs the title and the disclaimer is small muted text", () => {
  assert.match(rule(".tagline"), /margin:\s*0 0 0\.5rem/);
  assert.match(rule("#screen-home h1"), /margin:\s*0\.25rem 0 0\.25rem/);
  assert.match(rule(".disclaimer"), /color:\s*var\(--muted\)/);
  assert.match(rule(".disclaimer"), /font-size:\s*0\.8rem/);
});
```

- [ ] **Step 2: Run** `node --test tests/index-html.test.js tests/home-css.test.js`. Expected: the two new tests FAIL.
- [ ] **Step 3: Edit `index.html`:** give the tagline `<p>` `class="tagline"`; add `<p class="disclaimer">` with the verbatim disclaimer text as the last child of `.home-body`.
- [ ] **Step 4: Edit `styles.css`:** extend the `#screen-home h1` rule from Task 4 to `{ margin: 0.25rem 0 0.25rem; overflow-wrap: anywhere; }`; add `.tagline { margin: 0 0 0.5rem; }` and `.disclaimer { max-width: 18.5rem; margin: 0.75rem auto 0.5rem; color: var(--muted); font-size: 0.8rem; text-align: center; }`.
- [ ] **Step 5: Run** `npm test`. Expected: all PASS. Then run `npm run test:coverage` and confirm it still passes the 80% gates. Check by eye (`npm start`) at 320 px that the Game modes now start higher than before and the disclaimer is readable in both light and dark themes.
- [ ] **Step 6: Commit**

```bash
git add index.html styles.css tests/index-html.test.js tests/home-css.test.js
git commit -m "feat: tighten the tagline and add the unofficial-game disclaimer"
```

---

## Self-Review

- **Spec coverage:** Name (Task 1), favicon and deploy list (Task 2), real gear (Task 3), top and bottom bars, icon-only Options with aria-label, Play pinned, scrolling middle, safe-area note (Task 4), tagline gap and disclaimer (Task 5). The Royal Mint email in the spec is the owner's task, not code, and has no step.
- **Types and names:** `load()` (Task 1) is reused in Tasks 2, 4, 5; classes `.home-bar`, `.home-end`, `.home-body`, `.home-foot` are defined in Task 4 and used in Task 5; ids are unchanged throughout.
- **Known follow-on:** spec C adds a trophy button to `.home-end`; this plan leaves room for it.
