# Branding and home screen chrome: Design Spec

Date: 2026-10-31
Source: owner feedback in `docs/coin_game_comment/coin game.md` (lines 2 to 6, and the legal question on line 7)
Builds on: `2026-10-30-menu-declutter-and-presets-design.md`
Part of four specs from the same feedback: this one (A), `play-screen-fixes` (B), `end-round-and-leaderboard` (C), `short-pay-rate` (D).

## Purpose

Give the game its proper name and identity, and make the home screen fit more on a phone:

1. Rename the game to **Coin Counting Game**.
2. Add a website icon (favicon).
3. Give the home screen a **top bar** and a **bottom bar** so the main controls are always on screen.
4. Use a traditional **gear** icon for Options, with no text beside it.
5. Close the gap between the title and its tagline so the game modes get the space.
6. Add a short **disclaimer footer** (the legal side of using UK coin images).

## Decisions (from the owner)

- The name is **Coin Counting Game** everywhere the user sees it.
- Top bar: **Options (gear) on the left, theme toggle on the right**. Bottom bar: **Play only**. Options is not repeated in the bottom bar.
- Once the Options button is a gear icon it carries no visible text.
- The tagline "Make the amount using UK coins." sits right under the title.
- The footer disclaimer is added (approved after a check of the Royal Mint's published guidance; see Legal).
- E2E specs are not touched (paused CI job stays paused).

## Name

- `index.html`: `<title>` and the home `<h1>` read "Coin Counting Game".
- `README.md`: the heading and the opening line use the new name. The repository, the package name (`coin-game`), the CI badge URL and the live site URL are unchanged.
- Old design docs under `docs/superpowers/` keep their original titles (they are a record of past work).
- The home `<h1>` is long at 320 px wide: it may wrap onto two lines and must not overflow. The page `<title>` is "Coin Counting Game".

## Favicon

- One SVG icon, `favicon.svg`, in the repository root: a simple flat coin (a gold disc with a darker rim and an inner ring) that reads at 16 px. It is original artwork and shows no coin design or royal portrait.
- `index.html` links it with `<link rel="icon" href="favicon.svg" type="image/svg+xml">`.
- For iPhone home-screen use: `apple-touch-icon.png` (180 x 180, the same coin on a solid background) linked with `<link rel="apple-touch-icon" href="apple-touch-icon.png">`. It is generated once from the SVG and committed; no build step is added.
- **Deploy:** the GitHub Pages job copies a fixed list of files into `_site/` (`.github/workflows/ci.yml`, and `tests/pages-site.test.js` asserts the list). Both new files are added to that list and to the test, or the icon would work locally and be missing in production.

## Home screen layout (`index.html`, `styles.css`, `src/home.js`)

The home screen becomes three stacked regions inside the existing phone-sized frame:

1. **Top bar** (not scrolling): the Options button on the left and the theme toggle on the right, each at least 44 x 44 px. Spec C adds a Leaderboard icon button beside the theme toggle, so the bar is built to hold more than two controls: a flex row with the Options button first and the other controls grouped on the right.
2. **Middle** (scrolls if the screen is short): title, tagline, Game modes, Quick settings and the disclaimer footer.
3. **Bottom bar** (not scrolling): the Play button, full width up to the existing 18.5 rem maximum, centred. It respects `env(safe-area-inset-bottom)` so it clears the iPhone home indicator, and has a thin top border or shadow so scrolled content visibly passes behind it.

Because the bars are always present, the Play button and Options button never scroll out of view, even with all the option chips showing on a small phone.

### Options button

- The visible text "Options" is removed. The button holds only the gear icon.
- `aria-label="Options"` and `title="Options"` give it its name for screen readers and hover.
- It uses a new `gear` icon: a traditional cogwheel (a toothed outline around a centre hole). The existing `gear` entry in `src/icons.js` is actually a circle with rays, which looks like the sun in the theme toggle, so it is **replaced** by a real cogwheel path in the same 24-unit stroke style. The icon test (`tests/icons.test.js`) keeps passing because the name does not change.
- The Options screen's own Back button still returns here and focuses this button.

### Title and tagline

- The gap between the `<h1>` and the tagline is closed: the tagline's top margin is 0 and the heading's bottom margin is small (0.25 rem).
- `#screen-home` stops reserving 2.75 rem of top padding for the old absolute-positioned buttons, since the top bar now takes its own space in the flow. The net result is more room for the Game modes and Quick settings below.

## Legal: disclaimer footer

The Royal Mint's published guidance says copyright in UK decimal coin designs belongs to the Crown, that the Mint authorises their reproduction, that educational and informative websites are permitted in good taste, and that its name must not be used as a brand identity. The guidance does not cover illustrations or drawings specifically. So the app:

- Adds a small footer line at the end of the home screen's middle region: "Unofficial educational game. Not affiliated with or endorsed by The Royal Mint. Coin pictures are original illustrations." in the muted small text style. It is plain text (not a link), `lang` inherits, and it meets the existing contrast tests.
- Never uses the Royal Mint's name or logo other than in this disclaimer.
- Keeps the head sides of the coins free of any portrait (as today).

**Not a code change, for the owner:** to remove the remaining doubt, email the Royal Mint press office (the address on its [copyright and re-use page](https://www.royalmint.com/aboutus/policies-and-guidelines/advertising-guidelines)) describing a free educational coin-counting game with original illustrations of UK coins, and keep a written reply. This spec does not make legal claims and the footer is not legal advice or a substitute for permission.

## Testing

Unit and DOM tests (the project's `node --test` suite):

- `tests/home.dom.test.js`: the Options button has no visible text, has `aria-label="Options"`, and still opens the Options screen; the Play button is outside the scrolling middle region; the disclaimer text is present.
- `tests/icons.test.js`: the new `gear` renders and is not the same shapes as before.
- `tests/home-css.test.js`: the bars are present in the home screen and the Play button is in the bottom bar; the tagline margin is tight.
- `tests/pages-site.test.js`: the staged entries now include `favicon.svg` and `apple-touch-icon.png`, and every local `href` in `index.html` is staged.
- A manual check at 320 px, 390 px and a short landscape phone: nothing overlaps, the Play button is always visible.

## Out of scope

- A web app manifest or a full PWA.
- Renaming the repository, package or deployed URL.
- E2E specs.
