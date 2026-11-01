# Layout polish plan

Implements `docs/superpowers/specs/2026-11-01-layout-polish-design.md`.

- [x] `styles.css`: Cashier label block and nowrap question; `.play` block; `.actions` two-column grid with `.primary` in column 2; Cashier Next beside the field (drop the `.locked` single-column rule).
- [x] `src/render.js`: `showStackBadges` orders the pile by drawn order before `stackCounts`.
- [x] `index.html`: move `#btn-change` before `#btn-again`.
- [x] Tests: CSS rule tests, action row order.
- [x] Verified in a 390x780 browser: Check and Next have identical position in Cashier and the other modes; Play centred.
