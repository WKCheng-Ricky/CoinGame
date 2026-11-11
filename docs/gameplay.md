# Gameplay

Coin Counting Game: match a target amount using UK coins (1p to £2). Works on desktop and mobile.

## Highlights

- **Four game modes:** Endless, Custom, Cashier and Give Change.
- **Options:** tick **Show Coins** to see every coin's value and your running total (off is the challenge). Some modes have their own, such as Give Change's **Short-paying customers**, a chance you can set (Off, 1%, 5%, 10% or 25%; 5% by default).
- **Hands-on coins:** tap, drag and stack coins. Same coins stack and show a count.
- **Realistic coins:** real sizes, shapes and wording, plus a 1 cm reference grid so
  near-sized coins (1p and 5p, 20p and 50p) can be compared by eye.
- **Light and dark themes:** follows the device by default, or pick one.
- **Phone-sized frame:** fills a phone screen, or sits as a card on a larger one.
- **Plain HTML, CSS and JavaScript (ES modules):** no build step, no dependencies.

## How to play

| Mode | What you do |
| --- | --- |
| **Endless** | Build random targets from £0.01 to £9.99, one after another. Press End (the flag) to finish and score, or Back (‹) to stop. |
| **Custom** | Type an amount (up to £99.99) and build it with any coins. |
| **Cashier** | A customer's coins are on the counter. Add them up, type the total and press Check. Next brings the next customer. |
| **Give Change** | A customer pays for an item. Build their change from the tray and press Check, or press **No change** if they paid exactly or **Not enough!** if they paid too little (**Short-paying customers**, 5% by default, sets how often; Off means nobody underpays). Next brings the next customer. |

Pick a mode on Home, set any options, then press **Play**.

**Controls (Endless and Custom)**

- Tap a coin in the tray to add it; tap a coin in your pile to remove it.
- Drag coins around the pile, or from the tray into it. Arrow keys move a focused coin.
- Dragging a stack moves it together; hold a coin for 1 second to take it off the stack.
- With Show Coins off, hover, focus or hold a coin for 2 seconds to read its value.
- Press **Check** or **Enter** when the total matches. Ctrl/Cmd+Enter works even while a coin or button has focus.

In Cashier, counter coins can be dragged but not added or removed, and Enter in the amount field checks too.

In Give Change, the customer's coins sit in the top bar under the price. Below is the "Your change" card: tray coins go
there and are tapped, dragged and stacked as in Endless, and **Not enough!** and **No change** sit under it. Both piles
are 5 cm (4 cm on screens shorter than 700 px, such as an iPhone SE or a landscape phone). Coins can be dragged between
the customer's pile and your change, either way. The customer's coins can be moved to your change but never added or
removed: tapping one sends it to your change pile, and tapping it there sends it back. Giving back more than they paid
is refused with a hint to press Reset. The tray, Check and Reset are at the bottom, as in Endless; Reset puts the
customer's coins back as they paid them and empties your change. Pressing Check with no change counts as **No change**.
Every pile and the tray use the same coin size. On a portrait phone (375 × 667 and up) the screen fits without
scrolling; in a short landscape window the middle scrolls. Show Coins shows the running total of your change, and
setting Short-paying customers to Off means nobody underpays.

**Ending a session and the leaderboard.** The play screen's top bar has Back (‹) on the left and End (the flag) on the
right. When a score is being kept (Endless, Cashier or Give Change with the timer on), End asks "End the session and
save your score?" and Back, once you have points, asks "Leave without saving your score?"; the clock stops while the
question is open, and Keep playing (or Escape) carries on. Saving opens the Session over screen with your score,
customers served and rank. Each mode and difficulty (Normal, Hard, Very hard) has its own top 10, kept only on this
device; open it from Session over or the trophy on Home, where Clear scores needs a second press. Easy and custom
settings are not ranked, and with no score to keep End and Back simply leave.
