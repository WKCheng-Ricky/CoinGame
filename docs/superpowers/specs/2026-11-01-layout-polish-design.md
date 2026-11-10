# Layout polish: heading wrap, badge visibility, centred Play, stable primary button

Four fixes found in manual play. They amend the 2026-10-31 play-screen-fixes spec, section 3 ("Check on the right").

1. **Cashier heading.** "Customer's coins" and "How much?" wrapped awkwardly on one line. In Cashier the label now takes its own line above the question, and the question never breaks (`white-space: nowrap`).
2. **Stack count hidden by its own stack.** The badge goes on `stackCounts`' last member in pile order, but with `layerByPosition` the drawn order differs, so the badge could sit on a coin that another member of the same stack covers. `showStackBadges` now measures "last" in the drawn (DOM) order, so the badge is always on the top coin of its stack. The layering rule of the 2026-10-31 spec (rightmost and lowest underneath) is unchanged; an earlier attempt to lift badged coins with `z-index` broke it and was dropped.
3. **Play button centred.** `.play` was an inline-block, so `margin: auto` did nothing. It is now `display: block`.
4. **Primary button keeps its place.** The action row is a two-column grid: secondary buttons (Reset, Change amount) in the left column, the primary one (Check, then Next or Play again) in the right column, so Next appears exactly where Check was. In Cashier, Next also takes the column beside the field instead of dropping to a full-width row. The DOM order is now Reset, Check, Next, Change amount, Play again (primary rightmost, as the earlier spec required).

Tests: CSS rule tests in `tests/play-css.test.js`; DOM order test in `tests/index-html.test.js`.
