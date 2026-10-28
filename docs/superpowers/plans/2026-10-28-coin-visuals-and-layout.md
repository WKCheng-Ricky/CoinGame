# Coin visuals and page layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Light/Dark/Auto theme, centred Home, sticky top and bottom bars, a real-scale reference grid, true-to-size Reuleaux 20p/50p, and richer coin faces with curved wording.

**Architecture:** Pure CSS does the theming (`color-scheme` plus `light-dark()` variables, with `<html data-theme>` as the override). A tiny classic boot script applies the saved override before first paint. Coin geometry moves into a new pure `src/shapes.js`, and `coinSvg` in `render.js` composes the layers from per-coin data in `coins.js`. Layout and grid are CSS and markup only.

**Tech Stack:** Plain HTML/CSS/ES modules; `node --test` with jsdom and c8; Playwright (Chromium) with Monocart coverage. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-28-coin-visuals-and-layout-design.md`

## Global Constraints

- No build step, no runtime dependency, no change to game rules, state, placement or drag behaviour (`state.js`, `game.js`, `drag.js` stay untouched).
- `npm run test:coverage` must pass: every `src/**` file except `src/main.js` at least 80% lines, branches and functions. `npm run test:e2e:coverage` must pass: `src/main.js` at least 80% lines.
- Commits are Conventional Commits ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never `git add -A` or `git commit -a`.
- Coin diameters in `coins.js` do not change. Coin scale: `0.17rem` per mm (tray, capped by `0.75cqw`), `d / --pile-w-mm * 100cqw` (pile).
- SVG coin markup never contains an `id` attribute (the tray drag ghost clones the SVG).
- Wording letters never use the class `coin-label`: CSS hides that class in Normal difficulty.
- Storage key: `coin-game-theme`, values `"light"` and `"dark"`; Auto removes the key.

## Rulings (plan decisions the spec left open)

- **Boot script location.** `theme-boot.js` lives at the repo root, not in `src/`, because `c8 --all --per-file` would count a never-imported `src/` file as 0% and fail the gate.
- **`theme-color` source.** `light-dark()` values stay unresolved in a computed custom property, so `main.js` reads the body's resolved `background-color`, not `--bg`.
- **Counter-rotation test.** The numeral's counter-rotation is CSS, which jsdom does not apply, so that check is an e2e test, not a jsdom one.
- **Grid variables test.** The spec's jsdom test that the grid variables come from the coin constants is dropped: `renderPile` already sets `--pile-w-mm` and `--pile-h-mm` (covered today), and the grid size itself is CSS, so the e2e grid test in Task 6 checks the real computed result instead.
- **Bars are cards.** The bars are panel-coloured cards inside `main` (border, radius, shadow), not full-bleed strips, so they match the existing panels on desktop and need no full-width hack.
- **Contrast scope.** The 3:1 border rule applies to input borders, focus outlines and the coin edge, which are the only things that identify those controls. Buttons with text labels are not required to have a 3:1 border. A new `--control-border` variable (darker than `--line`) gives inputs 3:1 in both themes, a small intended change to the light theme.
- **Palette.** Starting values are in Task 2; the Task 7 contrast test is the judge and values are adjusted until it passes.

## Review Focus

- A blocked, throwing or invalid `localStorage` must fall back to Auto with no error (Task 1).
- A saved override that disagrees with the system must be applied before first paint (Task 2: static order check plus reload test).
- Wording stays visible in Normal while the numeral hides (Task 5).
- Focusing the Cashier input must not leave it hidden behind a sticky bar (Task 3).
- 20p and 50p must be constant width, equal to the round coins' 92 units (Task 4).

---

### Task 1: Theme core (`theme.js`, boot script)

**Files:**
- Create: `src/theme.js`, `theme-boot.js`, `tests/theme.test.js`

**Interfaces:**
- Produces: `THEME_KEY = "coin-game-theme"`; `getStorage(win) -> Storage | null` (null if reading `win.localStorage` throws); `readTheme(storage) -> "light" | "dark" | "auto"`; `saveTheme(storage, theme) -> void`; `applyTheme(root, theme) -> void`. `theme-boot.js` is a classic script that sets `document.documentElement.dataset.theme` from the saved value.

- [ ] **Step 1: Write failing tests** in `tests/theme.test.js` (use `node:test`, jsdom from `tests/dom-helper.js` or `new JSDOM(html, { url: "http://localhost/", runScripts: "outside-only" })` for the boot script):
  - `readTheme`: `"dark"` and `"light"` pass through; `null`, `"banana"`, `undefined` storage, and a storage whose `getItem` throws all give `"auto"`.
  - `saveTheme`: `"dark"`/`"light"` call `setItem(THEME_KEY, value)`; `"auto"` calls `removeItem(THEME_KEY)`; a throwing `setItem`/`removeItem` and a `null` storage do not throw.
  - `getStorage`: returns `win.localStorage`; returns `null` when the property getter throws.
  - `applyTheme`: `"dark"`/`"light"` set `root.dataset.theme`; `"auto"` and unknown values delete it.
  - Boot script: read `theme-boot.js` text and `window.eval` it in a jsdom with `localStorage[THEME_KEY] = "dark"` gives `dataset.theme === "dark"`; `"banana"` and no key leave it unset; a throwing `localStorage` getter does not throw; the source contains `THEME_KEY`.
  - Static: `index.html` is read as text; `theme-boot.js` appears before `styles.css`, and its `<script>` tag has no `type="module"`, `defer` or `async`. (Fails until Task 2 edits `index.html`; write it here, expect it red, and it goes green in Task 2.)
- [ ] **Step 2:** Run `node --test tests/theme.test.js`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** `src/theme.js` with the signatures above; `theme-boot.js` is about four lines in a try/catch reading the key and accepting only `"light"`/`"dark"`.
- [ ] **Step 4:** Run `node --test tests/theme.test.js`. Expected: all pass except the static `index.html` test.
- [ ] **Step 5: Commit** `feat: add theme storage helpers and boot script` (add only these three files).

---

### Task 2: Theme UI and the colour variables

**Files:**
- Modify: `index.html`, `styles.css`, `src/main.js`
- Create: `e2e/theme.spec.js`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: CSS variables, each defined twice: a plain light value in `:root`, then `light-dark(light, dark)` inside `@supports (color: light-dark(#000, #fff))` (see Step 4): `--bg --ink --muted --panel --pile-bg --line --control-border --accent --accent-ink --good --hint --bad --badge-bg --badge-ink --focus --grid --coin-edge`. Later tasks use these names. Elements `#theme-auto`, `#theme-light`, `#theme-dark` (radios, `name="theme"`) in `<fieldset class="theme">`.

- [ ] **Step 1: Write the failing e2e** `e2e/theme.spec.js` (import `test`, `expect` from `./fixtures.js`, `FAST` from `./helpers.js`). Helper `bodyLuminance(page)` reads `getComputedStyle(document.body).backgroundColor` and returns relative luminance. Tests:
  - System emulated dark (`page.emulateMedia({ colorScheme: "dark" })`), Auto checked: luminance < 0.2; emulated light: > 0.8.
  - With dark emulated, choose Light: luminance > 0.8, `html` has `data-theme="light"`, `localStorage["coin-game-theme"] === "light"`. Choose Dark with light emulated: dark. Choose Auto: key removed, `data-theme` absent, follows the emulated system.
  - Reload keeps the choice (emulate the opposite scheme) and the matching radio is checked.
  - `meta[name="theme-color"]` content equals the body's computed background after each switch.
  - Blocked storage: `addInitScript` that redefines `Storage.prototype.getItem`, `setItem` and `removeItem` to throw: page loads in Auto, no `pageerror`, and choosing Dark still themes the page.
- [ ] **Step 1b: Write the failing static test** `tests/theme-css.test.js` (reads `styles.css` as text): (a) no `light-dark(` appears outside the `@supports (color: light-dark(` block; (b) every variable defined inside that block (`--name:`) also has a plain, non-`light-dark` definition in `:root` before it; (c) each plain value equals the first argument of its `light-dark()` pair (trim and compare case-insensitively); (d) an `@supports not (color: light-dark(` rule hides `.theme`.
- [ ] **Step 2:** Run `npx playwright test e2e/theme.spec.js` and `node --test tests/theme-css.test.js`. Expected: FAIL.
- [ ] **Step 3: `index.html`:** before the stylesheet link add `<script src="theme-boot.js"></script>`; add `<meta name="color-scheme" content="light dark">` and `<meta name="theme-color" content="#f6f3ec">`; add a Theme fieldset after the Difficulty fieldset, built the same way (legend "Theme", three labelled radios Auto / Light / Dark, `autocomplete="off"`, Auto `checked`), class `theme` (not `difficulty`: `main.js` listens on `.difficulty`).
- [ ] **Step 4: `styles.css`:**
  - `:root { color-scheme: light dark; }`, `:root[data-theme="light"] { color-scheme: light; }`, `:root[data-theme="dark"] { color-scheme: dark; }`.
  - Define every variable below first as a plain light colour in `:root` (an old browser reads only this). Then redefine all of them as `light-dark(<light>, <dark>)` inside one `@supports (color: light-dark(#000, #fff)) { :root { ... } }` block. Add `@supports not (color: light-dark(#000, #fff)) { .theme { display: none; } }`. Starting values (light → dark): `--bg #f6f3ec → #14171d`; `--ink #1f2430 → #e9e6df`; `--muted #5a6070 → #a2a9b8`; `--panel #fff → #1d222b`; `--pile-bg #faf8f3 → #11141a`; `--line #d8d2c4 → #3a4150`; `--control-border #8a8577 → #7d8596`; `--accent #2f6f4f → #3f9d6e`; `--accent-ink #fff → #0c1710`; `--good #1f7a3f → #5fd08a`; `--hint #9a5b00 → #e0a24a`; `--bad #b3261e → #ff8a80`; `--badge-bg #1f2430 → #e9e6df`; `--badge-ink #fff → #14171d`; `--focus #1a73e8 → #8ab4f8`; `--grid #d8d2c4 → #ffffff22`; `--coin-edge #00000055 → #ffffff66`.
  - Replace hard-coded colours: `#5a6070` (h2, `.label`, `.rounds`, `.pile:empty::before`) → `var(--muted)`; pile `#faf8f3` → `var(--pile-bg)`; focus outline `#1a73e8` → `var(--focus)`; badge colours and its `#fff` border; `input` gets `background: var(--panel); color: var(--ink); border-color: var(--control-border)`; `.theme` shares the `.difficulty` rules.
- [ ] **Step 4b: `src/main.js`:** `initTheme()` near the top: `storage = getStorage(window)`, `theme = readTheme(storage)`, check the matching radio, `applyTheme`, `syncThemeColor()` (sets the meta `content` to `getComputedStyle(document.body).backgroundColor`). A `change` listener on `.theme` calls `saveTheme`, `applyTheme`, `syncThemeColor`. `matchMedia("(prefers-color-scheme: dark)")` `change` also calls `syncThemeColor`.
- [ ] **Step 5:** Run `npx playwright test e2e/theme.spec.js` and `node --test`. Expected: all pass, including Task 1's static `index.html` test and the new `styles.css` test.
- [ ] **Step 5b: Check the fallback by hand once.** With Playwright, load the page, edit the `@supports (color: light-dark(...))` condition in the live stylesheet to a false one (replace `light-dark(#000, #fff)` with `not-a-function(#000)` through `document.styleSheets`), and screenshot Home and Endless: the page must be a clean, readable light theme with the Theme fieldset hidden.
- [ ] **Step 6: Commit** `feat: add Light/Dark/Auto theme with system default` (add the five files plus `tests/theme-css.test.js`).

---

### Task 3: Centred Home and sticky top and bottom bars

**Files:**
- Modify: `index.html`, `styles.css`
- Create: `e2e/phone.spec.js`

**Interfaces:**
- Consumes: Task 2 variables. Ids unchanged: `#btn-back`, `#play-heading`, `#play-rounds`, `.actions`.
- Produces: `<header class="topbar">` inside `#screen-play` containing `#btn-back`, `#play-heading` and `#play-rounds`; `.actions` no longer contains Back.

- [ ] **Step 1: Write the failing e2e** `e2e/phone.spec.js`: for each viewport 375x667, 360x800, 393x852 and each of Endless, Custom (3.95, and 0.01 solved with one 1p tap and Check), Cashier:
  - `.topbar`, `#btn-back` and every visible `.actions button` are `toBeInViewport({ ratio: 1 })` with no scrolling.
  - After `window.scrollTo(0, document.body.scrollHeight / 2)`, `#play-heading` is still in the viewport.
  - No horizontal overflow (`scrollWidth <= innerWidth`), also at 320x640.
  - Cashier: focus `#cashier-input`; its rect does not intersect `.topbar` or `.actions` rects.
  - Home: at 390x844 and 1280x720 the horizontal centre of `#screen-home .stack-col`, of the Difficulty fieldset and of the `h1` is within 1 px of the viewport centre; `#screen-home` is vertically centred (its content's top gap and bottom gap differ by less than 40 px at 1280x720).
- [ ] **Step 2:** Run `npx playwright test e2e/phone.spec.js`. Expected: FAIL.
- [ ] **Step 3: `index.html`:** move `#btn-back` (as `‹ Back`) out of `.actions`, and wrap `#btn-back`, `#play-heading` and `#play-rounds` in `<header class="topbar">`.
- [ ] **Step 4: `styles.css`:**
  - Home: `#screen-home { min-height: calc(100dvh - 2rem); display: grid; align-content: center; justify-items: center; text-align: center; }`; `.difficulty`, `.theme` and `.stack-col` get `margin-inline: auto; width: 100%` within their max widths; labels inside stay left-aligned.
  - `#screen-play { min-height: calc(100dvh - 2rem); display: flex; flex-direction: column; }`; `.actions { margin-top: auto; }` so the bar rests at the bottom on tall screens.
  - `.topbar` and `.actions`: `position: sticky`, `background: var(--panel)`, `border: 2px solid var(--line)`, `border-radius: 0.8rem`, soft shadow, `z-index: 10`. Top bar `top: 0.5rem`, flex row, Back on the left, heading and rounds in a centred column (heading about 1.5rem, label inline and small, margin 0). Bottom bar `bottom: max(0.5rem, env(safe-area-inset-bottom))`.
  - `html { scroll-padding-block: 6rem; }` so a focused input scrolls clear of both bars.
  - Remove the 3.5rem `.target` size and stacked `.label` styling.
  - `index.html` viewport meta gains `viewport-fit=cover`.
- [ ] **Step 5:** Run `npx playwright test` (the whole suite). Expected: all pass. If a drag spec fails because a bar covers a drop target at 1280x720, fix the spec's viewport or target, not the game.
- [ ] **Step 6: Visual check.** Screenshot Endless and Cashier at 375x667 in light and dark, and Home at 390x844; look for overlap, clipped text and a heading that wraps badly (the Cashier heading "Customer's coins How much?" may wrap to two lines at 320 px, which is accepted).
- [ ] **Step 7: Commit** `feat: centre Home and add sticky top and bottom bars` (index.html, styles.css, e2e/phone.spec.js, plus any adjusted spec).

---

### Task 4: Shapes and true-width 20p and 50p

**Files:**
- Create: `src/shapes.js`, `tests/shapes.test.js`
- Modify: `src/render.js`, `tests/render.test.js`

**Interfaces:**
- Produces in `src/shapes.js`: `polygonPoints(sides, radius) -> string` (moved from `render.js`, same output); `reuleauxPath(sides, width, cx = 50, cy = 50) -> string` (an SVG path `d`); `arcLetters(text, radius, fontSize) -> Array<{ char, angle }>` (degrees from the top, centred on 0, one entry per non-space character, spaces advance the position).
- `render.js` imports from `shapes.js`; `coinSvg(coin) -> string` signature unchanged.

- [ ] **Step 1: Write failing tests** in `tests/shapes.test.js`:
  - `reuleauxPath(7, 92)`: seven `A` commands, each with radius `92` (the width); starts with `M` and ends with `Z`; vertices lie on circumradius `R = (width / 2) / Math.cos(Math.PI / (2 * sides))` (about 47.2 for width 92), computed in the test, and each vertex is within 0.01 of it.
  - Constant width: for the seven vertices, the distance from each vertex to its opposite vertices (3 steps away) equals `92` within 0.01.
  - Each side bulges outward: the midpoint of the arc (computed from the arc centre and radius) is farther from the centre than the chord's midpoint. (This pins the sweep flag: sides run clockwise, so the flag is `1`.)
  - `arcLetters("TEN PENCE", 42, 5)`: one entry per non-space character, angles symmetric about 0 (first = −last within 0.01), strictly increasing, the gap across the space larger than between letters.
  - `polygonPoints(12, 46)` has 12 pairs.
- [ ] **Step 2: Update `tests/render.test.js`:** the heptagon test now expects `coinSvg(20p)` and `coinSvg(50p)` to contain a `<path` with 7 `A` commands and no `<polygon`; the £1 test keeps `polygonPoints` 12 pairs; the "ringed coins draw two shapes" test counts `<circle|polygon>` and will break when Task 5 adds layers; it is rewritten in Task 5, so it may stay red between the two commits only if you run this task's tests by file.
- [ ] **Step 3:** Run `node --test`. Expected: shapes tests FAIL, render heptagon test FAILS.
- [ ] **Step 4: Implement.** `reuleauxPath`: vertices `V_k` at `theta_k = 2*pi*k/n - pi/2`, circumradius `R = (width/2) / cos(pi/(2n))`; side `k` runs `V_k -> V_{k+1}` as `A width width 0 0 1 x y` (arc centred on the opposite vertex, radius = width). `arcLetters`: advance per character `fontSize * 0.7`, angle step `advance / radius` in degrees, centred so the whole string is symmetric about 0. In `render.js` use `reuleauxPath(7, 92)` as the body for `heptagon` coins (fill, stroke 3, class `coin-body`); keep the circle and 12-gon bodies.
- [ ] **Step 5:** Run `node --test` and `npm run test:coverage`. Expected: pass; `shapes.js` meets the 80% gates.
- [ ] **Step 6: Commit** `feat: draw 20p and 50p as true-width Reuleaux heptagons`.

---

### Task 5: Coin faces, wording and rotation

**Files:**
- Modify: `src/coins.js`, `src/render.js`, `styles.css`, `tests/render.test.js`
- Create: `tests/coins.test.js`, `e2e/coins.spec.js`

**Interfaces:**
- `coins.js` entries gain `wording` (string) and `shade: { light, dark }` (two hex colours per metal: copper, silver, gold; the £1 and £2 take the outer metal's shades).
- `coinSvg` output classes: `coin-body` (outer shape), `coin-rim` (inner circumference line, inset to width 78: circle `r=39`, `reuleauxPath(7, 78)`, or `polygonPoints(12, 39)`), `coin-disc` (the £1/£2 inner disc, as the old ring), `coin-shine` (highlight arc, upper left), `coin-word` (one `<text>` per letter, wording on a circle of radius about 42 and font about 5, placed with `rotate(angle 50 50)` at `x=50 y=50-radius`), `coin-label` (the numeral, unchanged). Outline strokes use the class `coin-edge` (`stroke: var(--coin-edge)` in CSS) instead of the inline `STROKE`.

- [ ] **Step 1: Write failing tests.**
  - `tests/coins.test.js`: the eight diameters equal `{1p:20.3, 2p:25.9, 5p:18.0, 10p:24.5, 20p:21.4, 50p:27.3, £1:23.43, £2:28.4}`; every coin has a `wording` equal to `{1p:"ONE PENNY", 2p:"TWO PENCE", 5p:"FIVE PENCE", 10p:"TEN PENCE", 20p:"TWENTY PENCE", 50p:"FIFTY PENCE", £1:"ONE POUND", £2:"TWO POUNDS"}` and two-colour `shade`.
  - `tests/render.test.js`: each coin's SVG has one `coin-word` per non-space letter of its wording, one `coin-rim`, one `coin-shine`, one `coin-label` with the coin's label, exactly one `coin-body`, and a `coin-disc` only for the £1 and £2; no `id=` anywhere in any coin's SVG; wording letters never carry the class `coin-label`. Replace the old "ringed coins" test with the `coin-disc` rule.
  - `e2e/coins.spec.js`: (a) in Normal, a pile coin's `.coin-word` letters have computed opacity `1` while `.coin-label` has `0`; (b) pile coin rotation: the computed transform of the SVG and of `.coin-label` have rotation angles that sum to 0 modulo 360 (parse with `new DOMMatrix`), and the SVG's angle is not 0 for a coin whose `--rot` is not 0; (c) tray coins have no rotation (transform `none`).
- [ ] **Step 2:** Run `node --test` and `npx playwright test e2e/coins.spec.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the data and layers; draw order: body, rim, shine, disc (when present), words, numeral. `shine` is a short arc stroke (white, about 0.35 opacity, round caps) near the upper left at radius about 36. Rotation needs no new CSS: the existing `.pile-coin svg { transform: rotate(var(--rot)) }` and the label counter-rotation already apply.
- [ ] **Step 4:** Run `node --test`, `npm run test:coverage`, and the e2e spec. Expected: pass.
- [ ] **Step 5: Visual check.** Screenshot all eight coins in the tray at desktop zoom (1280x720) in light and dark, and a rotated pile. Tune the word radius, font size, rim inset and shine until the lettering sits inside the band on all eight, with the 20p and 50p the first to check. Record the final numbers in the commit message.
- [ ] **Step 6: Commit** `feat: add inner rim, curved wording and shine to coin faces`.

---

### Task 6: Reference grid and scale notes

**Files:**
- Modify: `index.html`, `styles.css`
- Create: `e2e/grid.spec.js`

**Interfaces:**
- Consumes: `--grid`, `--pile-bg`, `--pile-w-mm`, `--pile-h-mm` (set by `renderPile`).
- Produces: a `<p class="scale-note">1 square = 1 cm on a real coin</p>` under both area headings.

- [ ] **Step 1: Write the failing e2e** `e2e/grid.spec.js` (Endless, `FAST`):
  - Tray widths: the computed `width` of `#play-tray [data-coin="1p"] svg` over `[data-coin="5p"] svg` is `20.3 / 18.0` within 1%, and `20p` over `50p` is `21.4 / 27.3`. Repeat at a 320 px and a 1280 px viewport.
  - Pile widths: tap a 1p and a 5p into the pile and compare the computed `width` of their SVGs the same way (computed width, not the bounding box, which rotation inflates).
  - Grid scale: the first value of `getComputedStyle(#play-pile).backgroundSize` is `10 / 20.3` of the 1p SVG's computed width within 2%; the tray's first value from `getComputedStyle(#play-tray, "::before").backgroundSize` is the same fraction of the tray 1p SVG's width, at both viewports.
  - Both `.scale-note` lines are visible in Endless and the tray one is hidden in Cashier.
- [ ] **Step 2:** Run `npx playwright test e2e/grid.spec.js`. Expected: FAIL.
- [ ] **Step 3: `styles.css` and `index.html`.**
  - Pile: `background-color: var(--pile-bg)` plus two layered `linear-gradient` line sets (1 px lines), minor lines every `calc(10 / var(--pile-w-mm) * 100%)` by `calc(10 / var(--pile-h-mm) * 100%)` and stronger lines every fifth; `--grid` colour, stronger lines via a second `--grid` layer.
  - Tray: `.tray { position: relative; }` and `.tray::before { content: ""; position: absolute; inset: 0; pointer-events: none; ... }` with `background-size: calc(10 * min(0.17rem, 0.75cqw))` square, the same layers. Coins draw above it by tree order.
  - If `cqw` does not resolve against the tray from the pseudo-element (the grid test fails by a wrong ratio), fall back to a wrapper `<div class="tray-grid">` that is the container and holds the grid. Note the fallback in the commit.
  - Scale notes added under both `<h2>`s, styled with `--muted`, small.
- [ ] **Step 4:** Run `npx playwright test` (all). Expected: pass.
- [ ] **Step 5: Visual check.** Screenshot Endless in light and dark at 375x667 and 1280x720; the grid must stay faint under coins and not hide the empty-pile hint.
- [ ] **Step 6: Commit** `feat: add a real-scale 1 cm reference grid`.

---

### Task 7: Contrast checks, docs and full verification

**Files:**
- Create: `e2e/contrast.spec.js`
- Modify: `README.md`, `styles.css` (only to tune palette values the test rejects)

- [ ] **Step 1: Write `e2e/contrast.spec.js`.** A helper `contrast(fg, bg)` using WCAG relative luminance, and `effectiveBackground(el)` that composites each ancestor's `backgroundColor` (alpha-blend) up to the root. For each of `light` and `dark` (`emulateMedia`, Auto), check on Home, Endless (with a wrong Check to show the hint, then a correct one for success), Custom (with an invalid submit to show the error) and Cashier:
  - Text and its background at least 4.5:1: headings, body text, labels, legends, h2, `.scale-note`, `.rounds`, `.total`, `.message.hint`, `.message.success`, `.error`, buttons (including `.primary`), input text, stack badge text.
  - Non-text: input border against its surroundings at least 3:1; a focused button's `outline-color` against the bar or page background at least 3:1; a silver and a copper coin's fill against `.pile` background at least 3:1.
  - Coins render the same fills in both schemes.
- [ ] **Step 2:** Run it. Expected: it fails on at least one pair if any palette value is weak; adjust only the failing values in `styles.css` until it passes, keeping the intent (near-black blue-grey page, off-white text).
- [ ] **Step 3: `README.md`:** document the theme choice (Auto/Light/Dark, saved in the browser; browsers older than 2024 show the light theme and no Theme control), the reference grid, the new files (`src/theme.js`, `src/shapes.js`, `theme-boot.js`) in the Layout list, and the new e2e specs.
- [ ] **Step 4: Full verification.** `npm run test:coverage` and `npm run test:e2e:coverage` both exit 0, with `main.js` at least 80%. Screenshot Home, Endless and Cashier at 375x667, 360x800 and 393x852, light and dark, for the final look.
- [ ] **Step 5: Commit** `test: add contrast checks; docs: describe theme and grid` (two commits if the palette changed).

---

### Task 8 (revision): Replace the theme radios with a top-right icon button

The spec's section 5 "Choice" changed after Tasks 1-7 were built: the Theme fieldset of three radios is replaced by one cycling icon button. Tasks 2 and 7 above describe the radio version; this task supersedes them where they conflict.

**Files:**
- Modify: `src/theme.js`, `src/main.js`, `index.html`, `styles.css`, `tests/theme.test.js`, `tests/theme-css.test.js`, `e2e/theme.spec.js`, `e2e/contrast.spec.js`, `README.md`

**Interfaces:**
- Consumes: Task 1's `readTheme`, `saveTheme`, `applyTheme`, `getStorage`.
- Produces: `nextTheme(theme) -> "light" | "dark" | "auto"` (auto to light to dark to auto; unknown values give `"light"`); `themeLabel(theme) -> string` ("Theme: Auto. Press to switch to Light", "Theme: Light. Press to switch to Dark", "Theme: Dark. Press to switch to Auto"; unknown treated as Auto). Element `<button id="btn-theme" class="theme-toggle" type="button" data-state="auto|light|dark">` in `#screen-home`.

- [ ] **Step 1: Write failing tests.**
  - `tests/theme.test.js`: `nextTheme` cycles the three states and maps unknown to `"light"`; `themeLabel` returns the three strings above (unknown like auto). Remove nothing else.
  - `e2e/theme.spec.js`: replace radio interactions with `#btn-theme`: system emulated dark, button `data-state="auto"`, page dark; press once: `light`, page light, key `coin-game-theme` is `"light"`; press again: `dark` whatever the system says, key `"dark"`; third press: `auto`, key removed, page follows the emulated system. Accessible name (`getByRole("button", { name: ... })` or `aria-label`) matches `themeLabel` after each press. After a reload the state, icon and name are kept, and the body's computed background is right with the system emulated the opposite way. The button's right edge is within 24 px of `main`'s right edge and its top within 24 px of `main`'s top at 390x844 and 1280x720, and the Home heading and mode buttons stay horizontally centred (reuse the existing centring assertions). The button is not visible on the game screens. Keep the meta `theme-color` and blocked-storage tests, rewritten for the button.
  - `tests/theme-css.test.js`: the `@supports not` rule hides `.theme-toggle` (not `.theme`). Keep the other checks.
  - `e2e/contrast.spec.js`: add the theme button's icon colour against its background at least 3:1 in both schemes, and its focus ring at least 3:1; drop checks that referenced the removed fieldset and radios.
- [ ] **Step 2:** Run `node --test` and `npx playwright test e2e/theme.spec.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `src/theme.js`: add `nextTheme` and `themeLabel`.
  - `index.html`: remove the Theme fieldset. Add the button at the start of `#screen-home` with three inline `<svg>` icons (`aria-hidden="true"`, `focusable="false"`, `currentColor`, no `id` attributes): a half-filled circle, a sun, a moon. `aria-label` and `title` start as the Auto label.
  - `styles.css`: `#screen-home { position: relative; }`; `.theme-toggle { position: absolute; top: 0; right: 0; min-width: 44px; min-height: 44px; padding: 0; border-radius: 50%; display: grid; place-items: center; color: var(--ink); }`; show only the icon matching `data-state`; remove the `.theme` fieldset rules; the `@supports not (color: light-dark(#000, #fff))` block hides `.theme-toggle`. Keep the Home content centred (the button is out of flow).
  - `src/main.js`: in `initTheme`, set the button's `data-state`, `aria-label` and `title` from the saved theme; on click compute `nextTheme`, then `saveTheme`, `applyTheme`, `syncThemeColor`, and update the button. Remove the radio lookup and `.theme` change listener. Keep the `matchMedia` listener.
  - `README.md`: describe the icon button (one press cycles Auto, Light, Dark; saved in the browser; hidden in browsers older than 2024).
- [ ] **Step 4:** Run `npm run test:coverage` and `npm run test:e2e:coverage`. Expected: both exit 0, `main.js` at least 80%.
- [ ] **Step 5: Smoke test the real page by hand (not only the e2e suite).** Serve the repo (`node e2e/serve.js`, wait until `curl` returns 200), open it with the Playwright tools at 1280x720 and 375x667, light and dark, and actually click Endless, Custom (enter 3.95, Start) and Cashier from Home, add a coin, press Back, and press the theme button three times. Take screenshots of Home in light and dark and look at them: the icon must sit cleanly in the top-right corner, not overlap the heading, and the Home content must stay centred. Report anything that fails to respond to a click. Stop any server you start.
- [ ] **Step 6: Commit** `feat: replace theme radios with a top-right icon button` (explicit paths only; no other branch or history changes).

---

## Round 2 (Tasks 9-13): menu, difficulty, tray in the bar, Enter to Check, review fixes

**Spec:** section 6 of `docs/superpowers/specs/2026-10-28-coin-visuals-and-layout-design.md`. It wins over sections 1, 2 and 5 where they conflict. The Global Constraints above still apply (still no change to `state.js`, `game.js`, `drag.js` or `dwell.js`; no new dependency; both gates must pass). Tasks 9-12 each end with one commit; Task 13 verifies. The Rulings above still apply.

**Review Focus for round 2** (each is pinned by a named test):
- Moving the tray out of `.board` must not unhide the tray numerals in Normal: the `data-difficulty` and `locked` hooks move to `#screen-play` (Task 10).
- Enter must not break keyboard activation of coins and buttons (Task 11).
- The result message must be in the viewport after a wrong Check on a short phone (Task 10).
- Holding a difficulty label to read its note must not select it (Task 9).
- Every letter on all eight coins clears the rim line and the body edge by at least 0.5 units, measured at the letter's own angle (Task 12).

### Task 9: Game mode box and short difficulty labels

**Files:**
- Modify: `index.html`, `styles.css`, `src/main.js`, `e2e/phone.spec.js` (Home centring selectors)
- Create: `e2e/home.spec.js`

**Interfaces:**
- Produces: `<fieldset class="choice">` with `<legend>Choose a game</legend>` around `#btn-endless`, `#btn-custom`, `#btn-cashier` (inside `.stack-col`); difficulty labels read "Normal" and "Easy"; `<p id="difficulty-note" class="choice-note" aria-live="polite">`; each difficulty `<label>` has `title` and an `aria-describedby` pointing at a visually hidden `<span class="sr-only" id="diff-normal-help|diff-easy-help">` with "Read the coins yourself" / "Values always shown". The existing `.difficulty` fieldset keeps that class (main.js listens on it) and also gets `choice`.

- [ ] **Step 1: Write failing e2e** `e2e/home.spec.js` (`FAST` timings, `?dwell=50`): the "Choose a game" fieldset contains exactly the three mode buttons and each still opens its mode on one click (Endless shows `#play-target`, Custom shows the amount field, Cashier shows `#cashier-input`); the radio labels' text is exactly "Normal" and "Easy" and neither wraps at 320x640 (label height equals one line); `title` and the described-by text match the two explanations; hovering a label for 50 ms shows its text in `#difficulty-note` and leaving clears it; focusing it by keyboard does the same; a touch press-and-hold (use `page.touchscreen` or a `pointerdown` with `pointerType: "touch"` held 100 ms, then release) shows the note and does NOT change the selected radio, while a quick tap still selects it.
- [ ] **Step 2:** Run `npx playwright test e2e/home.spec.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Markup per Interfaces. In `main.js` add a second `createDwell` (delay `timing.dwellMs`, key = the label element) whose `onReveal` writes the label's help text into `#difficulty-note` and whose `onHide` clears it; wire `pointerover/out`, `focusin/out` and `pointerdown/up/cancel` on the `.difficulty` fieldset (reuse the pattern of `watchDwell`); when a hold revealed the note, swallow the click that follows (`preventDefault` on that label click) so the selection does not change. Styles: `.choice` shares the `.difficulty` rules, `.choice-note` is small and muted with `min-height: 1.4em` so the layout does not jump, `.stack-col` inside the box has no max-width trouble.
- [ ] **Step 4:** Update `e2e/phone.spec.js` Home centring to measure the new boxes; run `npx playwright test` (all). Expected: pass.
- [ ] **Step 5: Commit** `feat: group the game modes and shorten the difficulty labels`.

### Task 10: Tray in the sticky dock, message in the dock, total hidden in Normal

**Files:**
- Modify: `index.html`, `styles.css`, `src/main.js`, and the e2e specs listed in Step 4
- Create: `e2e/dock.spec.js`

**Interfaces:**
- Produces: `<div class="dock">` (the only sticky bottom element) containing `#play-message`, `#play-tray` (`role="group" aria-label="Add a coin"`) and the `.actions` row. `data-difficulty`, `locked` and cashier hiding now hang off `#screen-play` (not `.board`). `.board` holds only `.pile-area`. `#play-total` is visible only when `state.difficulty === "easy"` and the mode is not Cashier.

- [ ] **Step 1: Write failing e2e** `e2e/dock.spec.js`:
  - Normal: `#play-total` hidden after adding a coin; Easy: visible with the running total ("Your total: £0.20"); Cashier: hidden in both.
  - Normal still hides the tray numerals: `#play-tray .coin-label` computed opacity `0`, and `1` in Easy (this is the regression the selector move could cause).
  - `#play-tray` is inside `.dock` in Endless and Custom; at 375x667, 360x800 and 393x852 the dock, every tray coin, Check and Clear are fully in the viewport; the pile area is fully visible at 360x800 and 393x852; Cashier has no visible tray and the dock still shows the buttons.
  - After a wrong Check (Custom 0.05, tap a 1p, Check) `#play-message` is inside `.dock` and in the viewport at 375x667.
  - Tapping a tray coin adds it, dragging a tray coin onto the pile adds it there, and dragging one outside the pile does not (reuse the helpers in `e2e/drag.spec.js`).
  - The tray box: computed `border-top-style` is `dashed`, its border radius and background match `.pile`'s, and `getComputedStyle(#play-tray, "::before").backgroundSize` cell width equals the grid test's expectation; the `::before` box equals the tray's padding box (grid covers the full box).
  - Wide (1280x720): tray coins are on one row (all `top` values within 4 px) and the buttons are to the right of the tray.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: `index.html`:** remove `.tray-area` and its heading and scale note; keep one `.scale-note` under the pile heading; wrap `#play-message`, `#play-tray` and the `.actions` row in `<div class="dock">`; move the classes/attributes: `<section id="screen-play" data-difficulty="normal">`.
- [ ] **Step 4: `src/main.js`:** set `data-difficulty`, the `locked` class and the Cashier layout class on `#screen-play` instead of `.board`; hide the tray with `$("play-tray").hidden = cashier`; set `$("play-total").hidden = cashier || state.difficulty !== "easy"`. Update every existing e2e use: `.board` + `data-difficulty` becomes `#screen-play` (layout, modes, pile, coins specs); `.tray-area` becomes `#play-tray` (cashier, grid); `.pile-area .scale-note` only (grid spec); `.actions` as the sticky bar becomes `.dock` (phone spec); tests that read "Your total: ..." in Normal (modes, drag, pile specs) start in Easy through a `startMode(page, name, { difficulty })` option in `e2e/helpers.js` (check `#diff-easy` before clicking the mode), except where a test is about Normal.
- [ ] **Step 5: `styles.css`:**
  - `.dock { position: sticky; bottom: max(0.5rem, env(safe-area-inset-bottom)); margin-top: auto; z-index: 10 }` with the card look the bars have (panel background, border, radius, shadow, padding); remove sticky and card styling from `.actions` (a plain centred flex row); `.dock .message` is a compact one-line status (smaller margins, `min-height` so it does not jump).
  - Replace every `.board[data-difficulty=...]` and `.board.locked` selector with `#screen-play[data-difficulty=...]` and `#screen-play.locked`; the board is one centred column (about 28rem) in all modes.
  - Tray as a box: `border: 2px dashed var(--line); border-radius: 0.8rem; background-color: var(--pile-bg); padding: 0.4rem`, grid `::before` with `inset: 0` covering the box and `--cell` unchanged; phones: two rows of four; from 48rem: one row of eight and `.dock` as a flex row (tray left, `.actions` right). Keep `container-type: inline-size` on the tray.
  - `html { scroll-padding-block: 6rem 14rem; }` (or whatever clears the dock; the Cashier input test must still pass).
- [ ] **Step 6:** Run `npx playwright test` (all) and `node --test`. Expected: pass. Fix specs, not the game, if a sticky bar covers a drop target.
- [ ] **Step 7: Visual check.** Screenshot Endless and Cashier at 375x667, 360x800, 393x852 and 1280x720 in light and dark; check the tray box, the grid edges, the message line and that nothing overlaps.
- [ ] **Step 8: Commit** `feat: move the coin tray into the sticky bar and hide the total in Normal`.

### Task 11: Enter to Check

**Files:**
- Create: `src/keys.js`, `tests/keys.test.js`, `e2e/enter.spec.js`
- Modify: `src/main.js`, `index.html`

**Interfaces:**
- Produces: `isCheckShortcut(event) -> boolean` in `src/keys.js`; `event` has `key`, `ctrlKey`, `metaKey`, `repeat`, `target`. True when `key === "Enter"`, not `repeat`, and either `ctrlKey`/`metaKey` is set, or the target is not an interactive control (`button`, `input`, `select`, `textarea`, `a[href]`, `summary`, `[contenteditable]`). `#play-heading` (tabindex -1) and `body` are not interactive.

- [ ] **Step 1: Write failing tests.** `tests/keys.test.js` (jsdom elements): Enter on `body` and on a heading true; on a `button` and an `input` false; Ctrl+Enter and Meta+Enter on a button true; `repeat: true` false; other keys false; Shift+Enter on body true (not a shortcut modifier). `e2e/enter.spec.js`: with focus on `#play-heading`, Enter runs Check (Custom 0.01 with a 1p: success message); Enter on a focused pile coin removes it and does not Check; Enter on Clear clears; Ctrl+Enter from a focused pile coin runs Check; `page.keyboard.down("Enter")` repeated (hold) checks once (Custom 0.05 with a 1p: the hint is announced once, assert the message object changed once via a counter on the `#play-message` text updates or `MutationObserver`); nothing on Home or the Custom form (Enter there still only submits the form); nothing after the round is solved (message unchanged); Cashier: Enter on the page with a typed amount checks it; the Check button has `aria-keyshortcuts="Enter"` and `title="Check (Enter)"`.
- [ ] **Step 2:** Run `node --test tests/keys.test.js` and `npx playwright test e2e/enter.spec.js`. Expected: FAIL.
- [ ] **Step 3: Implement** `isCheckShortcut`; in `main.js` add one `document` `keydown` listener: if `#screen-play` is visible and `isCheckShortcut(e)` and not solved, `preventDefault()` and run the same function the Check button's click handler runs (extract it to a named function used by both). `index.html`: Check gets `aria-keyshortcuts="Enter"` and `title="Check (Enter)"`.
- [ ] **Step 4:** Run `npm run test:coverage` and the e2e spec. Expected: pass; `keys.js` meets the 80% gates.
- [ ] **Step 5: Commit** `feat: press Enter to Check`.

### Task 12: Review fixes

**Files:**
- Modify: `styles.css`, `theme-boot.js`, `src/render.js`, `src/shapes.js`, `tests/shapes.test.js`, `tests/render.test.js`, `tests/theme.test.js`, `tests/theme-css.test.js`, `e2e/contrast.spec.js`, `e2e/phone.spec.js`

**Interfaces:**
- Produces: CSS variables `--lift-shadow` and `--grid-major` (plain light value in `:root`, `light-dark()` pair in the `@supports` block, like the others, so the existing fallback test covers them); `shapeRadiusAt(sides|kind, width, angleDeg) -> number` in `src/shapes.js` (distance from the centre to the outline of a circle, a Reuleaux heptagon or a 12-gon of the given width, at an angle from the top).

- [ ] **Step 1: Write failing tests.**
  - `tests/theme-css.test.js`: `--lift-shadow` and `--grid-major` each have a plain fallback and a `light-dark()` pair; no `drop-shadow(0 3px 4px #0005)` remains (the three drop-shadows use `var(--lift-shadow)`); `main` has `padding-inline` using `env(safe-area-inset-left)` and `env(safe-area-inset-right)`.
  - `tests/theme.test.js`: running `theme-boot.js` in jsdom adds no new keys to `window` (compare `Object.keys(window)` before and after).
  - `tests/shapes.test.js`: `shapeRadiusAt` equals the radius for a circle, and for a width-92 Reuleaux heptagon is about 47.18 at a vertex angle and 44.82 at a mid-arc angle; for a 12-gon is 46 at a vertex and about 44.43 at a flat.
  - `tests/render.test.js`: for each coin, every wording letter's extent (baseline radius to baseline + cap height, with cap height 0.72 of the font size, and its angular half-width) clears the rim line outer edge (rim outline plus half its stroke) and the body's inner stroke edge by at least 0.5 units, using `shapeRadiusAt` at the letter's own angle.
  - `e2e/contrast.spec.js`: the focus checks also assert `outlineStyle !== "none"` and `outlineWidth >= 2px`; remove the dead `slice(cond ? 0 : 0)`.
  - `e2e/phone.spec.js`: the "heading still visible after scrolling" test asserts `scrollY > 0` first on the screens where the page is taller than the viewport.
- [ ] **Step 2:** Run `node --test` and the touched e2e specs. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `styles.css`: add the two variables and use them (all three lift shadows; the fifth grid lines use `--grid-major`; choose a darker stripe in light and a lighter one in dark so major lines read in both). Add `main { padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right)); }` keeping the existing vertical padding.
  - `src/render.js`: derive the wording radius and size per coin from the band between the rim line and the body edge: sample `shapeRadiusAt` over the angles the wording spans; inset the rim (`RIM_WIDTH` down to 74 if needed) so a font of at least 3.5 fits with 0.5 units of clearance both sides; set the baseline radius so the letters sit centred in the band. Keep the numerals, disc and shine unchanged and re-check that the inner disc of the £1 and £2 still clears the rim.
  - `theme-boot.js`: wrap the code in an IIFE.
- [ ] **Step 4:** Run `npm run test:coverage` and the full e2e. Expected: pass.
- [ ] **Step 5: Visual check.** Screenshot all eight coins at 300 px in light and dark: lettering clear of both lines and still legible; a dragged coin and a held stack coin show a visible lift in dark.
- [ ] **Step 6: Commit** `fix: address review findings (dark lift shadow, safe-area padding, wording clearance, grid major lines)`.

### Task 13: Docs and full verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README:** document the "Choose a game" box, the short difficulty labels and hold-to-read notes, the tray in the sticky bar, the total shown only in Easy, Enter and Ctrl+Enter to Check, and the new files (`src/keys.js`) and e2e specs (`home`, `dock`, `enter`) in the Layout list.
- [ ] **Step 2: Full verification.** `npm run test:coverage` and `npm run test:e2e:coverage` both exit 0, `main.js` at least 80% lines.
- [ ] **Step 3: Smoke test the real page by hand,** from a plain `python3 -m http.server` (wait until `curl` returns 200) and from `node e2e/serve.js`: at 1280x720 and 375x667, light and dark, click Endless, Custom (3.95, Start) and Cashier from Home; add a coin from the dock; press Enter; press Back; press the theme button three times; read the console for errors after each step. Stop every server you start.
- [ ] **Step 4: Commit** `docs: describe the round 2 menu, tray and shortcut changes` (explicit paths only).
