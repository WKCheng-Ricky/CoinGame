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

## 6. Round 2: menu, difficulty, tray in the bar, Enter to check, review fixes

Added after the first implementation was reviewed and tried. Where this section
conflicts with sections 1, 2 or 5, this section wins: the tray moves into the
bottom bar, the theme control is the icon button of section 5, and the target
size is the one stated in 6.7. Everything else in sections 1 to 5 stands.

### 6.1 Game mode box (Home)

- A bordered box with the legend "Choose a game", built like the Difficulty box
  (`<fieldset class="choice">`), holds the three mode buttons `#btn-endless`,
  `#btn-custom` and `#btn-cashier`. They stay buttons that start the game on one
  tap (no select-then-Start step); ids and behaviour are unchanged. The
  fieldset only groups them and gives them a visible label.
- Home order: title and line of text, Difficulty box, "Choose a game" box. The
  theme icon stays at the top-right.

### 6.2 Difficulty labels

- The two radios are labelled just "Normal" and "Easy" (nothing wraps).
- Their explanations ("Read the coins yourself" and "Values always shown") are
  shown three ways:
  - a `title` tooltip on each label, for mouse users;
  - an `aria-describedby` target with the same text, for screen readers;
  - hold to reveal, for touch and keyboard: hovering, focusing or pressing and
    holding a label for the dwell time (`timing.dwellMs`, so the existing
    `?dwell=` query parameter shortens it) shows the explanation in a one-line
    note under the box (`<p id="difficulty-note" class="choice-note">`,
    `aria-live="polite"`); leaving, blurring or releasing hides it. A press
    that reveals the note does not change the selection (the click that
    follows is ignored, as the coin code does), so a player can read an option
    without choosing it.

### 6.3 Tray in the sticky bottom bar (Endless and Custom)

- The sticky bottom card becomes `<div class="dock">`, containing, in order: the
  result message `#play-message`, the tray `#play-tray`, and the existing
  `.actions` row (Check, Clear, Next, Play again, Change amount). Only `.dock`
  is sticky; `.actions` is a plain row inside it.
- The board holds only the pile area, centred (max about 28rem on wide
  screens), in all modes. The tray's "Add a coin" heading and its second scale
  note are removed; `#play-tray` gets `role="group"` and `aria-label="Add a
  coin"`, and the one scale note stays under the pile heading (both grids use the
  same square).
- **Phones (under 48rem):** tray as two rows of four, then the buttons centred
  below. **Wide screens:** the tray as one row of eight at full scale, and the
  buttons to its right, in one row.
- **Cashier:** no tray (hidden as today), so the dock holds the message and the
  buttons. The Cashier answer field stays in the page flow.
- **The result message moves into the dock** so "Too high", "Too low" and the
  success text are always on screen when Check is pressed. Before this change the
  message sat in the page flow above the bar and could be scrolled out of
  view on a short phone.
- **Height cost (be aware):** on a phone the dock is about 200 to 230 px tall
  (message line, two coin rows, buttons). With the top bar the board gets about
  370 px on a 375x667 phone, so on that size the pile may need a small scroll;
  on 360x800 and 393x852 the whole pile fits without scrolling. Dragging a coin
  from the tray to the pile works while both are on screen, because the drag
  ghost is `position: fixed`.
- **Tray box:** the tray is a box like the pile: `2px dashed var(--line)`, the
  same radius, `--pile-bg` background, a small inner padding so coins do not
  touch the edge, and the 1 cm grid filling the whole box edge to edge (the
  grid is drawn on the tray box itself, not a smaller inner area, so it is no
  longer cut off). The scale arithmetic of section 2 is unchanged.

### 6.4 Running total hidden in Normal

- `#play-total` ("Your total: ...") is shown only in Easy and hidden in Normal,
  as it already is in Cashier. In Normal, adding a coin and watching the total
  jump gave away its hidden value, which defeated the point of counting.
- Unchanged: the "Too high / Too low" hints after Check, the stack badge (a
  count, not a value), and the screen-reader-only list of coin types
  (`#play-pile-summary`), which earlier specs accept as a visual-only
  challenge.
- This changes the first spec's "Running total, always visible": it is now
  visible in Easy only.

### 6.5 Enter to Check

- On the play screen (Endless, Custom and Cashier), pressing Enter runs the same
  action as the Check button, when the round is not solved.
- **Plain Enter** works when focus is not on a button, input, link or other
  control that uses Enter itself. A focused coin keeps its meaning (Enter
  removes it from the pile or adds it from the tray) and a focused Clear keeps
  clearing. The Cashier amount field already checks on Enter and keeps doing so.
- **Ctrl+Enter** (or Cmd+Enter on a Mac) works from anywhere on the play
  screen, including while a coin or button has focus.
- It ignores held-down key repeat (one Check per press), does nothing on Home or
  the Custom amount form, and does nothing once the round is solved. After a
  correct answer Enter does not press Next or Play again.
- The Check button gets `aria-keyshortcuts="Enter"` and the tooltip "Check
  (Enter)".

### 6.6 Review fixes

From the whole-branch review of the first implementation.

- **Dark-mode lift shadow (important).** The drag, held-coin and tray-ghost
  shadows use a new themed `--lift-shadow` (a plain light value in `:root`, a
  `light-dark()` pair in the `@supports` block, with a dark value that is
  visible on the dark pile, such as a stronger shadow or a faint light glow). It
  replaces the three hard-coded `#0005` drop-shadows.
- **Landscape safe-area (important).** `main` uses `padding-inline:
  max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right))`,
  so Back, the pile and Home clear a camera cut-out in landscape. Chromium
  cannot emulate insets, so a test checks the declaration in the stylesheet, and
  it needs one manual check on a real phone.
- **Wording clear of the edge lines.** On the 20p, 50p and £1 the letters touch
  the edge line (the Reuleaux sides and the 12-gon flats are closer to the
  centre than the round coins' rim), and on the 20p and 50p the top letters
  nearly touch the inner rim line. The word radius is derived from each body's
  minimum radius, the font is sized to fit, and the inner rim may be inset a
  little more (down to a width of 74 units) to widen the band, so that every
  letter clears both lines by at least 0.5 units on all eight coins. A unit test
  computes each coin's letter extents against the band.
- **Grid major lines in light.** A new themed `--grid-major` variable gives
  every fifth line its own stronger colour in both themes; in light the major
  lines were the same opaque colour as the minor ones.
- **Test fixes:** the contrast test asserts a visible outline (style not none,
  width at least 2 px) as well as its colour; its dead `slice(cond ? 0 : 0)` is
  removed; the "heading still visible after scrolling" phone test also asserts
  that the page actually scrolled (`scrollY > 0`) on screens where it can.
- **`theme-boot.js`** wraps its code in a block or function so it creates no
  global variables.

### 6.7 Spec corrections to match what was built

- The top-bar target is `clamp(1.2rem, 5vw, 1.75rem)`, not a fixed "about
  1.75rem": it reaches 1.75rem above about 560 px and is about 1.2rem on phones,
  so the Cashier heading fits on one line.
- The light-theme coin edge is `#00000080` (was `#00000055`), because the old
  value measured 2.3:1 against the pile and 3:1 is the target; the dark-theme
  grid line is `#ffffff1a`.

### 6.8 Out of scope

Select-then-Start for modes, a persisted difficulty, Enter to advance after a
correct answer, a collapsible tray, and any change to coin art or game rules.

### 6.9 Testing

- **e2e, Home:** the "Choose a game" fieldset contains the three mode buttons
  and each still starts its mode on one click; the difficulty labels read
  "Normal" and "Easy" with no wrapping at 320 px; the `title` and
  `aria-describedby` text is present; holding or hovering a label for the dwell
  time shows the note, and a held press does not change the selection.
- **e2e, play screen:** in Normal `#play-total` is hidden and in Easy it is
  visible (and still hidden in Cashier); in Endless and Custom `#play-tray` is
  inside `.dock`, and the dock, tray, Check and Clear are fully in the viewport
  at 375x667, 360x800 and 393x852; the pile is fully visible at 360x800 and
  393x852; after a wrong Check the message is inside the dock and in the
  viewport; dragging a tray coin onto the pile and tapping one both still work
  from the dock; the tray box has the dashed border and its grid covers its
  full width and height (computed background size and box size); Cashier shows
  no tray.
- **e2e, Enter:** Enter with focus on the page or the heading runs Check;
  Enter on a focused coin removes it and on Clear clears; Ctrl+Enter runs Check
  from a focused coin; a held key (repeated keydown) checks once; nothing on
  Home or Custom; nothing once solved.
- **Review fixes:** a stylesheet test finds `--lift-shadow` and `--grid-major`
  with plain fallbacks and the `padding-inline` safe-area declaration and no
  `#0005` drop-shadow; the unit test of letter extents above; the contrast and
  phone test changes; a jsdom test that `theme-boot.js` leaves no global
  variables.
- Existing e2e tests that use `.tray-area`, "Add a coin", `.actions` as the
  sticky bar, `.board` columns or a visible total in Normal are updated to the
  new structure; the coverage gates still apply.

## 7. Round 3: phone frame, Cashier dock, dark coins, reference lettering, Home feedback

Added after the round 2 implementation was reviewed and tried. Where this
section conflicts with sections 1 to 6, this section wins: the sticky bars and
the wide-screen layout are replaced by the frame (7.1), the metals are themed
(7.3, replacing "same metal colours in both themes" in section 5), the lettering
follows the reference coins (7.4, replacing the small curved wording of section
4 and the wording numbers of 6.6), and 6.5 is clarified (7.6).

### 7.1 Phone-sized frame

- **Problem.** At 1440x960 the bars stretched to 864 px wide while the pile card
  stayed a small centred square, with about 300 px of dead space between the pile
  and the bottom bar. The design is phone-shaped, so the app is held in a phone
  shaped frame on every screen size.
- **Frame.** `main` is the frame: `width: min(100%, 433px)`, `height:
  min(100dvh, 771px)`, centred horizontally and vertically on the page, as a
  flex column that does not scroll itself. 433 is chosen because the pile is
  376 px wide at full coin scale and 433 leaves exactly the padding to hold it.
  The numbers are two CSS variables, `--frame-w: 433px` and `--frame-h: 771px`.
  The page itself never scrolls (`html, body` do not overflow).
- **Screens.** Home, Custom and Play all live in the frame. On Play the frame
  is: top bar (fixed height), a content area that fills the rest and scrolls
  inside the frame when it must, and the dock (fixed at the bottom of the
  frame). The bars are ordinary flex children, so no `position: sticky`, no
  `scroll-padding` and no `min-height` workarounds remain, and there is no gap
  between content and dock.
- **Look.** On a viewport wider than the frame (more than 433 px) the frame is a
  rounded, bordered card with a soft shadow on the page background, like a
  device. On a phone (433 px or narrower) it is full-bleed with no border or
  rounding.
- **Safe areas.** The frame pads all four sides with
  `max(<normal padding>, env(safe-area-inset-*))`, which also fixes landscape
  cut-outs. The viewport meta keeps `viewport-fit=cover` and adds
  `interactive-widget=resizes-content`.
- **One layout.** Because the frame is always phone-shaped, the wide-screen rules
  (`min-width: 48rem`: tray in one row, dock as a row, two-column board,
  `main` wider) are removed. The tray is always two rows of four.
- **Short windows and landscape phones.** The frame takes the window height
  and the content scrolls inside it. A landscape phone (for example 852x393) is
  a 433 px wide, 393 px tall frame; the pile may need scrolling there. That is
  accepted and no separate landscape layout is built.
- **Constraint.** The frame must not use `transform`, `filter` or `contain:
  paint`, which would break the `position: fixed` tray drag ghost.
- **Not included (idea for later).** Scaling the frame up on tall screens by
  changing the root font size, since the layout is mostly `rem`.

### 7.2 Cashier input in the dock

- In Cashier the dock holds, top to bottom: the result message `#play-message`,
  `#cashier-error` (directly under it, taking no height when empty), then a
  small label "Total (£)" above one row with the amount field `#cashier-input`
  (flexible width) and the Check button on its right. After a correct answer
  Check becomes Next and the field is locked, as before.
- `#cashier-answer` moves from the page flow into the dock; it is hidden outside
  Cashier. Enter in the field still checks. Nothing else about Cashier changes.
- On-screen keyboard: with `interactive-widget=resizes-content` Chrome and
  Firefox on Android shrink the frame so the dock stays above the keyboard. iOS
  Safari does not support it and pans the page instead; this needs a manual check
  on a real phone and is listed under Risks.

### 7.3 Themed metal colours (dark-mode coins)

- **Diagnosis.** In dark mode the coins use the light theme's full-brightness
  silver (`#c9ccd1`) and copper, flat, with a pale `#ffffff66` edge, on a
  near-black pile. They look like bright stickers with a halo.
- **Fix.** The metal fills become themed CSS variables, `--metal-copper`,
  `--metal-silver` and `--metal-gold`, each defined like the other theme
  variables (a plain light value in `:root`, a `light-dark()` pair in the
  `@supports` block). Light values are today's colours. Starting dark values:
  copper `#a0622d`, silver `#9ea5af`, gold `#bf9b30`; the dark `--coin-edge`
  becomes `#ffffff33`. Final values are tuned by eye with before-and-after
  screenshots.
- SVG presentation attributes cannot use `var()`, so `coinSvg` emits a class
  per metal (`metal-copper`, `metal-silver`, `metal-gold`) on the body and the
  £1/£2 disc, and CSS sets `fill`. The rim line and shine still come from the
  per-coin shade data. `coins.js` gains `metal` (and `discMetal` for the £1 and
  £2) and keeps its light `fill` values for the existing tests.
- Contrast: each metal against the pile background is at least 3:1 in both
  themes (this replaces "coins render the same fills in both schemes").

### 7.4 Lettering like the reference coins

Reference images are in `docs/ref/`. Read from them: the wording follows the rim
and spans about one fifth of it (about 72 degrees), in much larger letters than
before, placed where the shield leaves a blank strip. Artwork is not reproduced;
only the position, direction and size of the wording.

| Coin | Centre of the text (degrees clockwise from the top) | Direction |
|---|---|---|
| 2p, 10p | 0 (top) | tops outward, reads clockwise |
| 1p | 270 (left) | tops outward, reads clockwise |
| 20p | 90 (right) | tops outward, reads clockwise |
| £2 | 300 (upper left, on the gold ring) | tops outward, reads clockwise |
| 50p, £1 | 180 (bottom) | upright, tops toward the centre, reads left to right |
| 5p | across the middle | straight horizontal line, no curve |

- **Data.** Each `coins.js` entry's `wording` becomes `{ text, at, flow }` with
  `flow` one of `"outer"`, `"upright"` or `"straight"` (`at` unused for
  `"straight"`).
- **Arc coins.** The font is chosen so the text spans about 72 degrees, limited
  by the band: the rim line moves in to a width of 70 units, the letters are
  at most 8.5 units and their cap height (0.72 of the font size) clears both the
  rim line and the body edge by at least 0.5 units, measured at each letter's own
  angle against the real outline (circle, Reuleaux heptagon or 12-gon). Letters
  stay per-letter `<text class="coin-word">` with no `id` and no `textPath`.
  `"upright"` letters are rotated 180 degrees extra and run counter-clockwise so
  they read left to right along the bottom.
- **5p.** "FIVE PENCE" is one `<text class="coin-word">` centred on the coin,
  about 66 units wide (`textLength`), turning with the coin like the other
  wording. The centre is where the numeral shows, so the 5p's numeral moves down
  to a fixed spot in the lower half (about y = 72 in the coin's own frame). It
  keeps its counter-rotation, so it stays upright, and because it sits at a fixed
  offset on one side of the line it cannot overlap the wording at any rotation.
- Wording stays visible in both difficulties, as decided in section 4.
- The tray and pile scale are unchanged; at tray size the lettering is still only
  a few pixels tall.

### 7.5 Home buttons: feedback and selected state

- **Mode buttons.** Endless was green (`primary`), which looked like a selected
  default. Endless, Custom and Cashier become the same neutral style, because
  none is "selected": each starts a game. Feedback: on hover (inside
  `@media (hover: hover)`, so a tap on a phone does not leave a stuck hover) an
  accent border and a light tint; while pressed (touch and mouse) an accent fill;
  keyboard focus keeps the existing ring.
- **Difficulty.** The checked option also gets an accent border, a light tint and
  bold text (`label:has(input:checked)`), so the choice is clear at a glance,
  not only from the small radio dot. Browsers without `:has()` keep the radio dot.
- Check in the dock stays green: it is the one primary action there.

### 7.6 Items from the round 2 review

- **Held Enter.** A held Enter or Space never repeat-activates a button on the
  play screen (`keydown` with `repeat` is default-prevented there). Focus still
  moves to Next or Play again after a solve, for keyboard users. This clarifies
  6.5: the Enter shortcut never advances to the next round, but a deliberate new
  Enter press on a focused Next button activates it like any button; a held key
  cannot skip the result.
- **Grid major lines in light.** The every-fifth-line layers are listed first in
  `background-image` (painted on top) and use `--grid-major`; a test checks the
  computed layer order and sizes. (In round 2 the opaque minor lines hid the
  major ones in the light theme.)
- **`npm start`.** `package.json` gets `"start": "node e2e/serve.js"`, the server
  sends `Cache-Control: no-cache` and reads `PORT` (default 4173); the README
  tells users to use it, notes that `python3 -m http.server` can leave a browser
  with a stale `main.js`, and to hard-refresh (Ctrl+Shift+R) after pulling. (A
  stale cached `main.js` with the newer `index.html` left the Home buttons dead.)
- **Weak tests.** The "labels do not wrap" and "Enter does nothing on Home"
  tests are rewritten so they can fail.

### 7.7 Out of scope

Scaling the frame, a landscape layout, a Surface-style two-pane layout,
changing game rules, reproducing the Mint's artwork, and any persisted state
other than the theme.

### 7.8 Testing

- **e2e, frame:** at 433x771, 375x667, 360x800, 393x852, 1440x960, 912x1368 and
  852x393 the frame is `min(viewport, 433x771)`, centred when the viewport is
  larger, the page does not scroll (`scrollHeight <= innerHeight`), the top bar
  and dock are inside the frame and the viewport, and the content area plus the
  two bars fill the frame (no gap). At 433x771 the Endless pile card and the
  whole Home screen are visible without scrolling. Frame decoration (radius,
  border) appears only above 433 px wide.
- **e2e, Cashier:** `#cashier-input` and `#cashier-error` are inside the dock and
  in the viewport at the three phone sizes; Check and Enter still check; after a
  solve Next appears and the field is locked; the old in-flow field is gone.
- **e2e, Home feedback:** at rest none of the three mode buttons is accent
  filled; hover (with `hasHover`) and pressed states change the computed style;
  the checked difficulty has the accent border and bold text; Check is still
  green.
- **Unit and jsdom, coins:** each coin's wording data matches the table; the
  arc letters span 60 to 80 degrees; every letter clears the rim line and body
  edge by at least 0.5 units (reusing `shapeRadiusAt`); upright letters run
  left to right; the 5p has one straight `coin-word` text and its numeral sits
  below the line (numeral top at least 2 units below the wording's bottom);
  metal classes are present and no `id` appears in any SVG.
- **Dark coins:** each metal against the pile background is at least 3:1 in both
  themes; light fills are unchanged; the three metal variables have plain
  fallbacks (the existing stylesheet test covers them).
- **Review items:** a held Enter on a focused Next presses it once at most; the
  grid layer-order test; `GET /` returns `Cache-Control: no-cache`; the two
  rewritten tests.
- Existing e2e tests that use wide viewports, `.dock` as sticky, the page's
  scroll position, or `#cashier-answer` in the page flow are updated; the
  coverage gates still apply.

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
- **Cashier on-screen keyboard (round 3).** With the amount field in the dock,
  Android Chrome and Firefox use `interactive-widget=resizes-content` to keep the
  dock above the keyboard, but iOS Safari ignores it and pans the page instead.
  This is not testable in Chromium; it needs a manual check on a real iPhone,
  and if the dock is hidden there the fallback is to move the field above the
  dock only while it has focus.
- **Frame and fixed ghost (round 3).** The tray drag ghost is `position: fixed`
  on `<body>`; the frame must not create a containing block for it (no
  `transform`, `filter` or `contain: paint`). A drag test at a centred frame
  (1440x960) pins this.
