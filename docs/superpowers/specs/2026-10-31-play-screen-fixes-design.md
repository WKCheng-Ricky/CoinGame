# Play screen fixes: Design Spec

Date: 2026-10-31
Source: owner feedback in `docs/coin_game_comment/coin game.md` (lines 8 to 11)
Part of four specs from the same feedback: `branding-and-home-chrome` (A), this one (B), `end-round-and-leaderboard` (C), `short-pay-rate` (D).

## Purpose

Four small fixes to the play screen:

1. Customer coins must never hide each other in Large Coins mode.
2. Holding a coin on an iPhone must not start a text selection.
3. The **Check** button moves to the right (the owner is right-handed).
4. The **Clear** button is labelled **Reset**.

## Decisions (from the owner)

- Layering rule: the **rightmost coin is at the bottom of the stack and the leftmost coin is on top**. The reason is the stack-count badge ("x2"): it sits at the bottom right of a coin, so only a coin to its right (or below it) can cover it. Coins further right or lower are therefore drawn underneath, and the badge always stays visible. This replaces the owner's first wording (leftmost at the bottom), which would have hidden the badges.
- In two dimensions (a pile with several rows, such as Cashier or Large Coins in Give Change) the same reasoning applies on both axes: the coin further **right** is underneath, and the coin **lower** on the pile is underneath, so the upper-left coin is on top.
- Applies to the **customer's coins** (the pile the player cannot change). The player's own piles keep their drag-and-stack behaviour: the coin most recently dropped is on top, as today.
- Check goes on the right; Clear becomes Reset.
- E2E specs are not touched (paused CI job stays paused).

## 1. Customer coin layering (`src/render.js`, `src/main.js`)

**Cause.** The pile is drawn in the order of `state.pile`, and later entries sit on top. The customer's coins are dealt in a random order, so a big coin (a £2) can land after a small one (a 5p) and bury it where they overlap, as in the first screenshot. Large Coins makes this worse because the same coins take more room.

**Change.**
- `renderPile` gets a `layerByPosition` flag (default off). When on, the coin elements are put in the DOM in order of **descending depth** (first drawn is the bottom layer), where depth is `x` times the pile width in mm plus `y` times the pile height in mm (both axes in millimetres, because the Give Change boxes are wide and short; raw `x + y` was tried first and let a coin to the right cover a £2's badge in a short box). Ties are broken by `uid`. So the coin furthest right and lowest is drawn first and ends up underneath, and the coin furthest left and highest is drawn last and ends up on top. With one row of coins this is simply right to left; with several rows both axes count. State is not reordered: only the drawn order changes, so `state.pile` and everything that indexes it (undo, uids, stack counts, drag) are unaffected.
- `main.js` passes the flag for the pile whose coins are fixed (`fixedPile`): the customer's pile in Cashier and Give Change. The "Your coins" pile in Endless and Custom, and the change pile, are unchanged.
- Existing code that reads the DOM order must not assume it equals `state.pile` order. The only one is `main.js:137`, which takes the last `.pile-coin` as the top coin: it keeps working because that is still the topmost drawn coin.
- A coin the player detaches and drops back keeps its position; the order is recalculated on every render.

**Acceptance.** With any deal and with Large Coins on, for two overlapping customer coins the one further right (or lower) is drawn underneath, so the "x2" badge of the left or upper coin is never covered by a coin that overlaps it from the right or below. A unit test builds a pile in a bad order (for example a 5p at the left that comes last in deal order, after a £2 at the right) and checks the rendered order follows descending depth, including a two-row case.

**Confirmed by the owner's screenshots** (`docs/coin_game_comment/Attachments/image3.png` is the current layout and `image4.png` is the wanted one, in Cashier mode with 8 coins). Going from image3 to image4: the 5p (left) goes over the 2p to its right; the silver coin at the top left goes over the £1 to its right; the 2p (higher up) goes over the 50p x3 stack (lower down). So the rule is as written above: a coin further left or higher is on top of one further right or lower. The owner's earlier wording "top at bottom, bottom at top" was a slip. (If those two images are moved or renamed, this spec's reference to them must be updated.)

**The final sort key** is depth in millimetres (see above). Plain `x + y` is the simplest single number that orders coins on both axes, but coins overlap by their size, not just their centres, and two coins whose centres are almost level on the diagonal (the 2p and the 50p stack in image4) can come out the wrong way round. The implementation plan must therefore use the image3 deal as a fixture: build a pile with the same coins at the same relative positions and assert that the draw order matches image4 (5p over 2p, silver over £1, 2p over 50p). If `x + y` fails it, the key is tuned (for example weighting `y` more than `x`) until it passes, and the final key is written into this spec.

**Known limit.** Layering by position protects the badges but does not stop a coin being covered entirely by a much larger one. If real play shows that, the placement code (`placeCoin` in `src/game.js`) would need to space coins out; that is not part of this spec.

## 2. No text selection on iPhone (`styles.css`)

**Cause.** The coin buttons already have `user-select: none` and `-webkit-touch-callout: none` (`styles.css`, `.coin, .pile-coin`), yet iOS Safari still selects text. The likely causes are the coin artwork's SVG `<text>` lettering (selection and the magnifier target text inside the SVG, which the button's rule does not always reach) and the surrounding pile and card text being selected when a long press starts on the gap between coins.

**Change.**
- Apply `user-select: none` and `-webkit-user-select: none` (Safari needs the prefixed one) to the coins' SVG content too (`.coin *, .pile-coin *`), and `-webkit-touch-callout: none` to the pile containers (`.pile`) and the tray (`.tray`).
- Set `-webkit-user-select: none` on the whole play screen (`#screen-play`) except the inputs, so long-pressing anywhere in the game area never starts a selection. The Cashier answer input and the Custom amount input stay selectable (`user-select: text` on `input`).
- Text on the home and Options screens stays selectable.

**Verification.** This cannot be fully proved in a desktop browser, so the verification is: unit tests that the CSS rules exist for the listed selectors; and a manual check on a real iPhone (press and hold on a coin, on the pile gap, on the coin lettering and on the price) with the owner confirming no selection handles or magnifier appear. If a case still selects, the fix is extended to that element; the spec's success criterion is "no selection while playing".

## 3. Check on the right (`index.html`, `styles.css`)

- In the action row, the order becomes **Reset, Check** (Reset on the left, the primary Check on the right). It is a DOM order change, so keyboard tab order and screen-reader order match what is seen.
- The row's other buttons (Next, Play again, Change amount) keep their places: they replace Check/Reset in the same row and the primary one is the rightmost there too, so the primary action is always on the right.
- The Enter keyboard shortcut for Check is unchanged.

## 4. Clear becomes Reset (`index.html`, `src/*.js`, `README.md`)

- The button's visible text reads "Reset". The element id `btn-clear` stays (it is not user-facing and the unit and e2e specs use it), as does `clearPile` in `src/state.js`.
- The hint text in `src/state.js` (`OVERPAID_HINT`: "That is more than they paid. Press Clear to start again.") reads "Press Reset to start again.".
- A search of `src`, `index.html` and `README.md` for "Clear" finds every other user-facing mention; all are updated.
- Give Change's Reset also puts the customer's coins back where they were dealt, unchanged.

## Testing

- `tests/render.dom.test.js`: customer coins are drawn in descending depth order, so the rightmost and lowest is underneath (including a deliberately bad deal order and Large Coins scale); the change and player piles keep insertion order.
- `tests/home-css.test.js` (or a new CSS test): the selection rules exist for the coin, its SVG children, the pile, tray and play screen, and inputs stay selectable.
- `tests/state.test.js`: the over-paid hint says Reset.
- A DOM test that the action row's order is Reset then Check.
- Manual iPhone check for the selection fix, as above.

## Out of scope

- Changing how coins are placed or spaced in `placeCoin`.
- E2E specs.
