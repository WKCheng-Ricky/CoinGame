# Coin visuals and page layout: Design Spec

Date: 2026-10-28
Builds on: all earlier specs, including Cashier mode (PR #5).
Assumes the test suite and CI PR (`feature/test-suite-and-ci`) has merged: the
tests below use its jsdom helper, Playwright setup and coverage gates. If it has
not, rebase this work on it before implementing.

## Purpose

Make the coins easier to tell apart and nicer to look at, and make the page work
on real phones.

- UK coins come in two metals of near-identical colour and in sizes that differ
  by a few millimetres, so with no reference point a 1p and a 5p, or a 20p and a
  50p, are hard to tell apart.
- The faces are plain discs with a numeral. Real coins have an inner rim and
  lettering.
- On a phone (iPhone SE 375x667, Galaxy A55 360x800, iPhone 16 393x852) the
  Check, Clear and Back row sits partly or fully below the bottom of the screen
  (measured: Cashier row at y=647-691 on a 667 px screen; Endless row at
  y=788-832), and the Home screen hugs the top left.

## Requirements

- **Reference grid** in the pile and the tray, at the coins' own scale.
- **Sizes** match real coins, pinned by tests.
- **Coin faces** have an inner circumference line and curved denomination
  wording, and pile coins show them rotated.
- **Home** is centred.
- **Game screens** keep the target, the counter, Back and the main actions on
  screen without scrolling, on the three phones above and at 320 px wide.
- **Dark mode** that follows the system by default, can be overridden to Light
  or Dark on Home, and is remembered; text stays readable and coins stand out
  against the dark board.
- No change to game rules, state, placement or drag behaviour. No new runtime
  dependency, no build step.

## 1. Page layout

- **Home (`#screen-home`).** A centred column: heading, text, difficulty box and
  the three mode buttons are all centred horizontally; the column is centred
  vertically with `min-height: 100dvh`. The buttons keep their 16rem width.
- **Top bar (sticky, game screens only).** `position: sticky; top: 0` with the
  panel background, a bottom border and the top safe-area inset. It holds a
  compact "< Back" button on the left (the existing `#btn-back`, same id), the
  target ("Make £3.95" in about 1.75rem, one line) and the rounds counter. In
  Cashier there is no target; it shows the counter ("Customers served: N"). It
  replaces the large 3.5rem heading in `#play-heading`; the heading element and
  its focus behaviour (`tabindex="-1"`, focused at the start of a round) stay.
- **Bottom bar (sticky).** `.actions` becomes `position: sticky; bottom: 0` with
  the panel background, a top border and `padding-bottom:
  env(safe-area-inset-bottom)`. It holds Check, Clear, Next, Play again and
  Change amount (as today, shown per mode and state), but not Back. It wraps and
  grows upward only if the width runs out; it never overflows sideways.
- **Why sticky and not fixed.** Both bars stay in the page flow, so no content can
  be hidden behind them and no padding workaround is needed. The viewport meta
  tag gains `viewport-fit=cover` so the safe-area insets take effect.
- **Custom screen** (`#screen-custom`) keeps its own Start and Back buttons; it
  is a form, not a game screen, and is not part of the sticky bars.
- **Space.** Two bars take about 110 px; the old heading took about 130 px and
  goes away, so the content area on a 667 px screen stays about the same.

## 2. Reference grid

- A faint 1 cm graph-paper grid drawn as a CSS background on the pile
  (`.pile`) and the tray (`.tray`). It is decoration only: no markup, no events,
  no effect on dragging, and it sits under coins and under the empty-pile hint.
- **Same scale as the coins.**
  - Pile: the square is `10 / var(--pile-w-mm)` of the board width wide and
    `10 / var(--pile-h-mm)` of its height tall (the board's width and height in
    mm are already CSS variables), so it is exactly the coins' scale.
  - Tray: the square is `10 * min(0.17rem, 0.75cqw)` wide and tall, the same
    expression `.coin svg` uses. The tray is already a container, so the grid is
    drawn on a pseudo-element that can read its `cqw`; the plan confirms that it
    scales with the coins at 320 px and at desktop width.
- **Style.** Lines use `--line` at low opacity, with every fifth line a little
  stronger. Shown in both difficulties.
- **Caption.** A short line under each area heading: "1 square = 1 cm on a real
  coin" (coins are drawn at about 72% of life size, so the grid is in real-coin
  millimetres, not screen millimetres).

## 3. Coin sizes

- The eight `diameter` values in `coins.js` are the Royal Mint figures (1p 20.3,
  2p 25.9, 5p 18.0, 10p 24.5, 20p 21.4, 50p 27.3, £1 23.43, £2 28.4) and stay.
  The 1p is larger than the 5p in real life.
- **Defect to fix.** The 20p and 50p are drawn as straight-sided heptagons of
  circumradius 46, whose widest point is `46 * (1 + cos(pi/7))`, about 87.5
  units against 92 for a round coin, so they are about 5% too small. Real 20p
  and 50p are Reuleaux heptagons (seven outward curved sides, constant width).
  Draw them that way with constant width 92 units, so each coin's diameter is
  its true width. The £1 (12 sides, measured corner to corner) is already
  right.
- Tests pin the diameter table and the rendered width ratios (see Testing).

## 4. Coin faces, wording and rotation

- **Data.** Each entry in `coins.js` gains `wording` (the inscription text) and
  `shade` (a lighter and a darker tone of the metal, for the rim line and a
  highlight). Wording: ONE PENNY, TWO PENCE, FIVE PENCE, TEN PENCE, TWENTY PENCE,
  FIFTY PENCE, ONE POUND, TWO POUNDS.
- **Layers, outside in.** Body (shape and metal colour); outer edge stroke; an
  inner circumference line inset about 7 units that follows the body's shape
  (circle, Reuleaux heptagon, or 12-gon); the wording on an arc between the two
  lines; the centre. The £1 and £2 keep their two-metal inner disc and the
  centre numeral stays. A lighter highlight arc on the upper left gives a metal
  look. All flat colours, no gradients.
- **Wording.** Curved along the top of the band between the two lines, following
  the face's curvature. Each letter is its own `<text>` placed on a circle and
  rotated to follow it, centred on the top. No `textPath` and no SVG `id`s: the
  tray drag ghost clones the SVG and many identical coins sit in the pile, so
  shared ids would clash.
- **Not an exact copy.** The lettering position and curve are one stylised
  convention for all eight coins, not the Royal Mint's exact layout, which could
  not be confirmed from sources we could reach. The Mint's reverse artwork
  (animals, flowers, shield pieces) is not reproduced. Individual coins can be
  corrected later from references, which is why the wording and layout come from
  data and one render function.
- **Rotation.** Pile coins already carry `rot` (random 0-359, stacked coins copy
  the top coin's). The whole SVG, wording included, turns with it, as it does
  today. The centre numeral keeps its existing counter-rotation so a revealed
  numeral is always upright. Tray coins stay upright. No change to state or
  placement.
- **Normal difficulty.** The wording is always visible in both difficulties,
  by design: real coins carry their wording and a player can look at it, but it
  is tiny (under 4 px on a 5p at 320 px wide), so it is hard to read, which is
  also true of real coins. Inspect to reveal is the clearer view of the coin, as
  holding it up close is in real life. The numeral hide-and-reveal mechanic is
  unchanged.

## 5. Dark mode

- **Choice.** Three states: Auto (the default, follows the system), Light and
  Dark. They are changed with one icon button in the top-right corner of the
  Home screen. This replaces an earlier design with a "Theme" fieldset of three
  radio buttons next to Difficulty, which was dropped because it looked ugly;
  the icon button is the intended control, not a stopgap.
  - **Markup.** `<button id="btn-theme" class="theme-toggle" type="button">`,
    44 px minimum, in `#screen-home`, positioned at its top-right corner
    (`#screen-home` is `position: relative`, the button `position: absolute`).
    The Home content stays centred. It holds three inline SVG icons that use
    `currentColor`: a half-filled circle (Auto), a sun (Light) and a moon
    (Dark). The button's `data-state` is `auto`, `light` or `dark`, and CSS shows
    only the matching icon.
  - **Behaviour.** Each press cycles Auto, then Light, then Dark, then back to
    Auto. The change applies at once, is saved as described below (Auto removes
    the key), and updates the `theme-color` meta. It is on Home only, not on the
    game screens. The radio ids `theme-auto`, `theme-light` and `theme-dark` no
    longer exist.
  - **Accessibility.** The accessible name and the hover tooltip (`title`) state
    the current choice and what a press does, for example "Theme: Auto. Press to
    switch to Light", and are updated on every press. The icon follows the theme
    through `currentColor`, and the focus ring is the existing one.
  - **Logic.** `theme.js` gains `nextTheme(theme)` (the cycle) and
    `themeLabel(theme)` (the accessible name), both pure, so they are unit
    tested; `main.js` only wires the button and the DOM updates.
- **Mechanism.** `<html data-theme="light|dark">` is the override; no attribute
  means Auto. `styles.css` sets `:root { color-scheme: light dark }`,
  `:root[data-theme="light"] { color-scheme: light }` and
  `:root[data-theme="dark"] { color-scheme: dark }`, and every theme colour
  variable gets the CSS `light-dark(<light>, <dark>)` function. So the same
  variables serve Auto (the system picks) and both overrides, with no
  duplicated dark block and no `prefers-color-scheme` media query. `color-
  scheme` also themes form controls, scrollbars and the page canvas.
- **Older browsers (fallback).** `light-dark()` needs Chrome 123, Safari 17.5 or
  Firefox 120 (2024). A browser that lacks it must show a clean light page, not
  a half-themed one, so the colours are layered:
  1. `:root` first defines every theme variable as a plain light colour
     (today's values). This is all an old browser reads.
  2. The same variables are then redefined with `light-dark(<light>, <dark>)`
     inside `@supports (color: light-dark(#000, #fff)) { ... }`. A browser
     without support skips the whole block.
  3. `@supports not (color: light-dark(#000, #fff)) { .theme-toggle { display: none } }`
     hides the theme icon button where it could not work, so there is no dead
     control. (The boot script and `main.js` still run harmlessly.)

  This is the only duplication: each light value appears twice, once plain and
  once as the first argument of its `light-dark()`. A unit test reads
  `styles.css` and fails if any `light-dark(` appears outside the `@supports`
  block, if any variable lacks a plain fallback, or if a plain value differs
  from its pair's light value. Old browsers get the light theme only; they do not
  get a dark theme from `prefers-color-scheme`, which would need a second copy
  of the dark values and is not worth it.
- **Remembering.** The override is saved in `localStorage` under
  `coin-game-theme` as `"light"` or `"dark"`; Auto removes the key. This is the
  first stored value in the project; game state is still not saved. Any
  storage failure (blocked, private mode, quota) or any unknown stored value
  falls back to Auto and never throws.
- **No flash.** A tiny classic script, `src/theme-boot.js`, loaded in `<head>`
  before the stylesheet, reads the saved value and sets `data-theme` before the
  first paint (module scripts are deferred, so they would run too late). It is
  a classic script, not inline, so a future Content Security Policy needs no
  exception. `src/theme.js` (an ES module used by `main.js`) exports
  `readTheme(storage)`, `saveTheme(storage, theme)` and `applyTheme(root,
  theme)`; the boot script repeats only the read-and-set (about four lines),
  and a test checks both use the same key and accept the same values.
- **Variables.** `styles.css` already keeps most colours in `:root` variables.
  The colours still hard-coded move into variables: muted text (`#5a6070`), the
  pile background (`#faf8f3`), the stack badge (`#1f2430`) and the focus
  outline (`#1a73e8`), plus the new grid line colour and the bar backgrounds
  from section 1. Each variable, including `--bg`, `--ink`, `--panel`,
  `--line`, `--accent`, `--good`, `--hint` and `--bad`, gets its light value
  (today's) and a dark value in one `light-dark()` pair. Exact dark values are
  chosen in the plan and checked for contrast (below); the intent is a
  near-black blue-grey page, a slightly lighter panel, off-white text, and
  lighter versions of the green, amber and red.
- **Browser bar.** A single `<meta name="theme-color">` is kept in sync by
  `main.js`: it reads the computed `--bg` on load, on a theme change and on a
  `matchMedia("(prefers-color-scheme: dark)")` change, so the phone's browser
  bar matches whichever theme is showing (media-query `theme-color` tags would
  ignore the override).
- **Coins.** The metal colours (copper, silver, gold) stay the same in both
  themes, because they are objects, not UI. Contrast comes from the board: a
  dark pile background and a lighter outer-edge stroke or soft rim glow in dark
  mode so the silver and copper coins and their edge lines stay visible. The
  numeral and wording colours stay dark on the metal in both themes. The drag
  drop-shadow stays but is made lighter on dark so it still reads as lift.
- **Grid.** Lines use the themed grid colour, so they stay faint in both modes.
- **Contrast.** Every text and control colour pair meets WCAG AA (4.5:1 for text,
  3:1 for borders, focus outlines and the theme icon against the page) in both
  themes.
- **Not done.** No theme control on game screens, no high-contrast or other
  themes, no syncing between devices.

## Testing

- **jsdom, `theme.js`:** `readTheme` returns `"light"`, `"dark"` or `"auto"`
  and treats unknown values and a storage that throws as `"auto"`; `saveTheme`
  stores light and dark and removes the key for auto, and swallows storage
  errors; `applyTheme` sets and removes `data-theme`; `nextTheme` cycles
  auto to light to dark to auto and maps unknown values to light; `themeLabel`
  names the current choice and the next one for each of the three states. A
  test loads
  `theme-boot.js` in jsdom and checks it sets the same attribute from the same
  key.
- **jsdom, `render.js`:** each coin's SVG contains its wording as one `<text>`
  per letter; contains the inner circumference element; has no `id` attribute
  anywhere; the 20p and 50p outlines are curved paths; the numeral's counter
  rotation still follows `--rot`; the grid CSS variables come from the same
  constants as the coin scale.
- **Unit, `coins.js`:** a table test pins the eight diameters and the wording
  and shade fields exist for every coin.
- **e2e (Playwright):**
  - Rendered widths in the pile and the tray are in the ratio of the diameters
    (1p : 5p = 20.3 : 18.0, 20p : 50p = 21.4 : 27.3), and a grid square is
    10 / 20.3 of a 1p's width.
  - At 375x667, 360x800 and 393x852 the top bar and every visible bottom
    action are fully inside the viewport without scrolling; after scrolling the
    page, the target is still visible; no horizontal overflow. Run for Endless,
    Custom (before and after solving) and Cashier.
  - Home is horizontally centred at 390 px and at desktop width.
  - Theme choice: with the system emulated as dark and Auto showing, the page
    is dark; pressing `#btn-theme` once gives Light (page light, `data-state`
    `light`, key saved), a second press gives Dark whatever the system says, a
    third gives Auto (key removed, follows the system); after a reload the
    choice is kept, the button shows its icon and name, and the page is already
    themed on first paint (the body's computed background checked right after
    load, with the system emulated the opposite way). The button's accessible
    name matches the state after every press, it sits in the top-right corner
    of Home (right edge within 24 px of the main column's right edge, top within
    24 px of its top) without moving the centred content, and it is hidden on
    the game screens. The `theme-color` meta follows the shown theme.
  - Dark mode: with `page.emulateMedia({ colorScheme: "dark" })` the page
    background and text colours differ from light mode, and a test computes the
    contrast ratio of each text/background pair and of each border and focus
    outline against its background in both schemes, asserting at least 4.5:1
    for text and 3:1 for borders and focus. Coins render the same metal colours
    in both schemes.
  - Existing e2e tests that use `#btn-back` keep working because the id is
    unchanged; those that read `#play-heading` are updated to the new bar.
- The coverage gates from the test-suite spec still apply and must pass.

## Out of scope

A theme control on the game screens, other themes, saving game state, sound, a settings
page, changing difficulty rules,
changing game logic or the drag model, accurate reproduction of the Mint's
reverse artwork or inscriptions, edge details (milling, edge lettering), and
any tablet layout beyond the existing 48rem breakpoint.

## Risks

- **Sticky bars and on-screen keyboard.** In Cashier the keyboard shrinks the
  visual viewport; with sticky (not fixed) bars the page just scrolls, but this
  needs a manual check on a real phone or an emulator.
- **Grid in the tray.** Drawing it on a pseudo-element that reads the tray's
  `cqw` is the least certain CSS here; the fallback is a wrapper element that
  carries the container.
- **Letter placement.** Per-letter arcs are easy to get slightly uneven on
  polygon coins; the face is checked visually at desktop zoom for all eight
  coins, with the 20p and 50p (curved heptagon) the most likely to need tuning.
- **Tiny lettering.** By design, see "Normal difficulty" above.
- **`light-dark()` support.** Handled by the layered fallback in section 5:
  older browsers show a clean light page with no Theme control. The `@supports`
  fallback itself cannot be exercised by Chromium in e2e, so a static test of
  `styles.css` guards it, and it is checked once by hand by removing the
  `@supports` wrapper's effect (for example by editing the condition to a
  false one in dev tools) and confirming the page stays light and readable.
- **First stored value.** `localStorage` is new to the project. Failure modes
  are covered by tests; nothing else reads it.
- **Silver on dark.** The silver coins and their rim lines are the least likely
  to read against the dark board; the edge stroke or glow is tuned by eye at
  desktop zoom and on a phone-sized viewport, not only by the contrast test.
