import { test, expect } from "./fixtures.js";
import { seedRandom, startMode } from "./helpers.js";

// The phone the layout was designed on; tests below run here unless they say otherwise.
const PHONE = { width: 390, height: 844 };

test("starting Give Change puts the customer's coins in the top bar and the answers in the Your change card", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await seedRandom(page);
  await startMode(page, "Give Change");
  await expect(page.locator("#play-heading")).toHaveText(/Price £/);
  await expect(page.locator("#play-rounds")).toHaveText("Customers served: 0");
  await expect(page.locator("#play-pile-summary")).toHaveText(/^Customer paid: /);
  await expect(page.locator("#cashier-answer")).toBeHidden();
  await expect(page.locator("#play-total")).toBeHidden();
  await expect(page.locator("#play-quip")).toHaveCount(0);

  // top bar: the label "Customer Coins:" above the customer's pile, with no drag hint
  const host = page.locator(".topbar #topbar-customer");
  await expect(host).toBeVisible();
  await expect(host).toHaveAttribute("role", "group");
  // named by its visible label
  await expect(host).toHaveAttribute("aria-labelledby", "customer-coins-label");
  await expect(host).not.toHaveAttribute("aria-label");
  await expect(page.getByRole("group", { name: "Customer Coins:" })).toHaveAttribute("id", "topbar-customer");
  await expect(host.locator("#customer-coins-label.pile-label")).toHaveText("Customer Coins:");
  await expect(host.locator("#play-pile")).toBeVisible();
  await expect(host.locator("#play-pile-summary")).toHaveCount(1);
  await expect(host.locator(".scale-note")).toHaveCount(0);
  const label = await host.locator(".pile-label").boundingBox();
  const pile = await page.locator("#play-pile").boundingBox();
  expect(label.y + label.height).toBeLessThanOrEqual(pile.y + 1);
  await expect(page.locator("#play-area")).toBeHidden();

  // middle card: heading, hint, pile, then the answer buttons
  const card = page.locator("#change-area");
  await expect(card).toBeVisible();
  await expect(card.locator("#change-heading")).toHaveText("Your change");
  await expect(card.locator(".scale-note")).toHaveText("you can drag the coin around and stack them");
  await expect(card.locator(".scale-note")).toBeVisible();
  await expect(card.locator("#change-pile")).toBeVisible();
  await expect(card.locator(".answers #btn-short")).toBeVisible();
  await expect(card.locator(".answers #btn-none")).toBeVisible();
  await expect(card.locator(".answers button")).toHaveText(["Not enough!", "No change"]);

  // dock: tray, Check and Clear; the answer buttons are not there
  await expect(page.locator(".dock #play-tray")).toBeVisible();
  await expect(page.locator(".dock .actions #btn-check")).toBeVisible();
  await expect(page.locator(".dock .actions #btn-clear")).toBeVisible();
  await expect(page.locator(".dock #btn-none")).toHaveCount(0);
  await expect(page.locator(".dock #btn-short")).toHaveCount(0);
});

test("one scale: a coin has the same size in both piles and the tray, and the piles are as wide as each other", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await seedRandom(page);
  await startMode(page, "Give Change");
  await page.getByRole("button", { name: "Add £2", exact: true }).click();
  const widthOf = (sel) => page.locator(sel).evaluate((el) => el.getBoundingClientRect().width);
  const tray2 = await widthOf('#play-tray [data-coin="£2"]');
  // polled: a new pile coin settles in from 115% over 150 ms
  await expect.poll(async () => Math.abs((await widthOf('#change-pile [data-coin="£2"]')) - tray2)).toBeLessThanOrEqual(1);
  // the £2 in the customer's pile when they paid with one, and every customer coin's drawn size against the tray's
  const sizes = await page.evaluate(() => {
    const w = (el) => parseFloat(getComputedStyle(el).width);
    return [...document.querySelectorAll("#play-pile .pile-coin")].map((btn) => ({
      id: btn.dataset.coin,
      button: btn.getBoundingClientRect().width,
      pile: w(btn.querySelector("svg")),
      tray: w(document.querySelector(`#play-tray [data-coin="${btn.dataset.coin}"] svg`)),
    }));
  });
  expect(sizes.length).toBeGreaterThan(0);
  for (const s of sizes) {
    expect(Math.abs(s.pile - s.tray), s.id).toBeLessThanOrEqual(1);
    if (s.id === "£2") expect(Math.abs(s.button - tray2), "customer £2").toBeLessThanOrEqual(1);
  }
  expect(Math.abs((await widthOf("#play-pile")) - (await widthOf("#change-pile")))).toBeLessThanOrEqual(1);

  const short = await page.locator("#btn-short").boundingBox();
  const none = await page.locator("#btn-none").boundingBox();
  expect(short.x + short.width).toBeLessThanOrEqual(none.x);
  expect(Math.abs(short.y - none.y)).toBeLessThanOrEqual(1);
});

test("Easy shows the change total, hides Not enough!, and a solve disables the answer buttons and focuses Next", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await seedRandom(page);
  await startMode(page, "Give Change", { difficulty: "easy" });
  await expect(page.locator("#change-total")).toHaveText("Your change: £0.00");
  await expect(page.locator("#btn-short")).toBeHidden();
  await expect(page.locator("#btn-none")).toBeVisible();
  await solveCorrectly(page);
  await expect(page.locator("#btn-next")).toBeFocused();
  for (const sel of ["#btn-check", "#btn-clear", "#btn-short"]) await expect(page.locator(sel), sel).toBeHidden();
  await expect(page.locator("#btn-none")).toBeVisible();
  await expect(page.locator("#btn-none")).toBeDisabled();
  await page.locator("#btn-back").click();
  await page.locator("#diff-normal").check();
  await page.getByRole("button", { name: "Give Change", exact: true }).click();
  await expect(page.locator("#change-total")).toBeHidden();
});

// ---- pile heights: the visible box in mm, from its width (138.4 mm wide) ----
const boxHeightMm = (page, sel) => page.locator(sel).evaluate((el) => {
  const r = el.getBoundingClientRect();
  return r.height / (r.width / 138.4);
});

for (const vp of [{ width: 1280, height: 720 }, PHONE, { width: 476, height: 850 }, { width: 1280, height: 800 }]) {
  test(`${vp.width}x${vp.height}: Give Change shows a 40 mm customer box and a 60 mm change box`, async ({ page }) => {
    await page.setViewportSize(vp);
    await seedRandom(page);
    await startMode(page, "Give Change");
    await expect(page.locator("#change-pile")).toBeVisible();
    expect(Math.abs((await boxHeightMm(page, "#play-pile")) - 40)).toBeLessThanOrEqual(1);
    expect(Math.abs((await boxHeightMm(page, "#change-pile")) - 60)).toBeLessThanOrEqual(1);
  });
}

// Under 700 px high (iPhone SE, a landscape phone) the player's pile drops to 4 cm so the screen fits.
const SE = { width: 375, height: 667 };
for (const difficulty of ["normal", "easy"]) {
  test(`375x667 ${difficulty}: both boxes are 40 mm`, async ({ page }) => {
    await page.setViewportSize(SE);
    await seedRandom(page);
    await startMode(page, "Give Change", { difficulty });
    await expect(page.locator("#change-pile")).toBeVisible();
    expect(Math.abs((await boxHeightMm(page, "#play-pile")) - 40)).toBeLessThanOrEqual(1);
    expect(Math.abs((await boxHeightMm(page, "#change-pile")) - 40)).toBeLessThanOrEqual(1);
  });

  test(`375x667 ${difficulty}: with a hint showing the content does not scroll and No change is fully in view`, async ({ page }) => {
    await page.setViewportSize(SE);
    await seedRandom(page);
    await startMode(page, "Give Change", { difficulty });
    // Check with no change given is never right while unsolved, so it always shows a hint
    await page.locator("#btn-check").click();
    await expect(page.locator("#play-message")).toHaveClass(/hint/);
    await expect(page.locator("#play-message")).not.toHaveText("");
    const m = await page.evaluate(() => {
      const c = document.querySelector(".content");
      const r = c.getBoundingClientRect();
      const b = document.querySelector("#btn-none").getBoundingClientRect();
      return { scroll: c.scrollHeight - c.clientHeight, top: r.top, bottom: r.bottom, btnTop: b.top, btnBottom: b.bottom };
    });
    expect(m.scroll, "content scrolls").toBeLessThanOrEqual(0);
    expect(m.btnTop).toBeGreaterThanOrEqual(m.top);
    expect(m.btnBottom).toBeLessThanOrEqual(m.bottom);
    await expect(page.locator("#btn-none")).toBeInViewport({ ratio: 1 });
  });
}

test("resizing across 700 px high redraws the change pile at the matching height, with its coins inside", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await seedRandom(page);
  await startMode(page, "Give Change");
  const p = await page.locator("#change-pile").boundingBox();
  // a coin near the bottom edge and one near the top, so a shorter box must still hold them
  await drag(page, await centre(page.getByRole("button", { name: "Add 50p", exact: true })), { x: p.x + p.width * 0.25, y: p.y + p.height * 0.75 });
  await drag(page, await centre(page.getByRole("button", { name: "Add £1", exact: true })), { x: p.x + p.width * 0.75, y: p.y + p.height * 0.25 });
  await expect(page.locator("#change-pile .pile-coin")).toHaveCount(2);
  const fractions = () => page.locator("#change-pile .pile-coin").evaluateAll((els) => els.map((el) => [el.style.left, el.style.top]));
  const inside = () => page.evaluate(() => {
    const p = document.querySelector("#change-pile").getBoundingClientRect();
    return [...document.querySelectorAll("#change-pile .pile-coin")].every((el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      return x >= p.left && x <= p.right && y >= p.top && y <= p.bottom;
    });
  });
  const tall = await fractions();
  for (const [vp, mm] of [[SE, 40], [PHONE, 60], [SE, 40]]) {
    await page.setViewportSize(vp);
    await expect.poll(async () => Math.abs((await boxHeightMm(page, "#change-pile")) - mm), `${vp.height}`).toBeLessThanOrEqual(1);
    expect(Math.abs((await boxHeightMm(page, "#play-pile")) - 40)).toBeLessThanOrEqual(1);
    await expect.poll(inside, `${vp.height}`).toBe(true);
    // the coins keep their place in the box (the same fractions) and both stay
    await expect(page.locator("#change-pile .pile-coin")).toHaveCount(2);
  }
  await page.setViewportSize(PHONE);
  await expect.poll(fractions).toEqual(tall);
  // the drag uses the new height too: a drop 70% down lands under the pointer
  await page.setViewportSize(SE);
  await expect.poll(async () => Math.abs((await boxHeightMm(page, "#change-pile")) - 40)).toBeLessThanOrEqual(1);
  const q = await page.locator("#change-pile").boundingBox();
  const to = { x: q.x + q.width * 0.5, y: q.y + q.height * 0.62 };
  await drag(page, await centre(page.getByRole("button", { name: "Add 1p", exact: true })), to);
  const coin = page.locator('#change-pile [data-coin="1p"]');
  await expect.poll(async () => {
    const c = await centre(coin);
    return Math.hypot(c.x - to.x, c.y - to.y);
  }).toBeLessThanOrEqual(2);
});

// Leaving Give Change in any state, then starting Cashier and Endless, puts the customer's pile back in its card.
const LEAVE = {
  "plain Normal": async () => {},
  "after a solve": async (page) => {
    await solveCorrectly(page);
    await expect(page.locator("#btn-next")).toBeVisible();
  },
  "from Easy": async (page) => {
    await expect(page.locator("#change-total")).toBeVisible();
  },
};
for (const [how, setup] of Object.entries(LEAVE)) {
  test(`leaving Give Change (${how}), then starting Cashier and then Endless, puts the pile back in its card at 118.4 mm`, async ({ page }) => {
    await page.setViewportSize(PHONE);
    await seedRandom(page);
    await startMode(page, "Give Change", how === "from Easy" ? { difficulty: "easy" } : {});
    await expect(page.locator("#topbar-customer #play-pile")).toBeVisible();
    await setup(page);
    await page.locator("#btn-back").click();
    for (const mode of ["Cashier", "Endless"]) {
      await page.getByRole("button", { name: mode, exact: true }).click();
      await expect(page.locator("#topbar-customer"), mode).toBeHidden();
      await expect(page.locator("#topbar-customer .pile"), mode).toHaveCount(0);
      await expect(page.locator("#topbar-customer #play-pile-summary"), mode).toHaveCount(0);
      await expect(page.locator("#play-area"), mode).toBeVisible();
      await expect(page.locator("#play-area #play-pile"), mode).toBeVisible();
      await expect(page.locator("#play-area #play-pile-summary"), mode).toHaveCount(1);
      // the pile and its summary go back above the total, in their old order
      expect(await page.locator("#play-area").evaluate((el) => [...el.children].map((c) => c.id || c.className)), mode)
        .toEqual(["pile-heading", "scale-note", "play-pile", "play-pile-summary", "play-total"]);
      await expect(page.locator("#change-area"), mode).toBeHidden();
      await expect(page.locator(".answers button:visible"), mode).toHaveCount(0);
      // a fresh, unsolved round: no Next, Check is back, nothing locked
      await expect(page.locator("#btn-next"), mode).toBeHidden();
      await expect(page.locator("#btn-check"), mode).toBeVisible();
      await expect(page.locator("#screen-play"), mode).not.toHaveClass(/locked|give-change/);
      await expect(page.locator("#play-message"), mode).toHaveText("");
      expect(Math.abs((await boxHeightMm(page, "#play-pile")) - 118.4), mode).toBeLessThanOrEqual(1);
      await page.locator("#btn-back").click();
    }
    // and back into Give Change: the pile moves into the top bar again
    await page.getByRole("button", { name: "Give Change", exact: true }).click();
    await expect(page.locator("#topbar-customer #play-pile")).toBeVisible();
    await expect(page.locator("#play-area")).toBeHidden();
  });
}

const changeCoins = (page) => page.locator("#change-pile .pile-coin");
const customerCoins = (page) => page.locator("#play-pile .pile-coin");
const changeBadges = (page) => page.locator("#change-pile .stack-badge");
const trayCoin = (page, label) => page.getByRole("button", { name: `Add ${label}`, exact: true });

// The centre of an element on screen; every Give Change control is in view without scrolling (see the fit tests).
async function centre(locator) {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

const position = (coin) => coin.evaluate((el) => ({ left: parseFloat(el.style.left), top: parseFloat(el.style.top) }));

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

test.describe("the change area", () => {
  test("tapping a tray coin adds it to the change, not the customer's coins", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change", { difficulty: "easy" });
    const customer = await customerCoins(page).count();
    expect(customer).toBeGreaterThan(0);
    await trayCoin(page, "20p").click();
    await expect(changeCoins(page)).toHaveCount(1);
    await expect(page.locator("#change-pile-summary")).toHaveText("Your change: 1 × 20p");
    await expect(page.locator("#change-total")).toHaveText("Your change: £0.20");
    await trayCoin(page, "50p").click();
    await expect(changeCoins(page)).toHaveCount(2);
    await expect(page.locator("#change-total")).toHaveText("Your change: £0.70");
    await expect(customerCoins(page)).toHaveCount(customer);
  });

  test("dragging a tray coin onto the change area adds it; onto the customer's coins or outside does not", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change");
    const customer = await customerCoins(page).count();
    const tray50 = trayCoin(page, "50p");
    await drag(page, await centre(tray50), await centre(page.locator("#change-pile")));
    await expect(changeCoins(page)).toHaveCount(1);
    await expect(page.locator("#change-pile-summary")).toHaveText("Your change: 1 × 50p");
    await expect(page.locator(".tray-ghost")).toHaveCount(0);
    await expect(page.locator("#change-pile")).not.toHaveClass(/over-pile/);

    await drag(page, await centre(tray50), await centre(page.locator("#play-pile")));
    await expect(page.locator(".tray-ghost")).toHaveCount(0);
    await expect(changeCoins(page)).toHaveCount(1);
    await expect(customerCoins(page)).toHaveCount(customer);
    await expect(page.locator("#play-pile")).not.toHaveClass(/over-pile/);

    await drag(page, await centre(tray50), await centre(page.locator("#play-heading")));
    await expect(page.locator(".tray-ghost")).toHaveCount(0);
    await expect(changeCoins(page)).toHaveCount(1);
    await expect(customerCoins(page)).toHaveCount(customer);
  });

  test("a change coin is removable by tap; a customer coin is not", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change");
    const customer = await customerCoins(page).count();
    await trayCoin(page, "20p").click();
    const coin = changeCoins(page).first();
    await expect(coin).toHaveAttribute("aria-label", "Remove 20p");
    await expect(customerCoins(page).first()).toHaveAttribute("aria-label", / coin$/);

    // the last-drawn coin is on top, so the tap reaches it in the crowded strip
    await customerCoins(page).last().click();
    await expect(customerCoins(page)).toHaveCount(customer);
    await expect(changeCoins(page)).toHaveCount(1);

    await coin.click();
    await expect(changeCoins(page)).toHaveCount(0);
    await expect(page.locator("#change-pile-summary")).toHaveText("The pile is empty.");
    await expect(customerCoins(page)).toHaveCount(customer);
    // with the change empty, focus goes back to the tray coin
    await expect(trayCoin(page, "20p")).toBeFocused();
  });

  test("arrow keys move a change coin", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change");
    await trayCoin(page, "£1").click();
    const coin = changeCoins(page).first();
    const start = await position(coin);
    await coin.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(async () => (await position(coin)).left).toBeGreaterThan(start.left);
    await expect(coin).toBeFocused();
    await page.keyboard.press("Shift+ArrowUp");
    await expect.poll(async () => (await position(coin)).top).toBeLessThan(start.top);
    await expect(changeCoins(page)).toHaveCount(1);
  });

  test("change coins stack, and a held coin separates from its stack", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change");
    await trayCoin(page, "20p").click();
    await drag(page, await centre(trayCoin(page, "20p")), await centre(changeCoins(page).first()));
    await expect(changeCoins(page)).toHaveCount(2);
    await expect(changeBadges(page)).toHaveText(["×2"]);

    const top = changeCoins(page).last();
    const before = await position(top);
    const from = await centre(top);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await expect(top).toHaveClass(/detached/);
    await expect(changeBadges(page)).toHaveCount(0);
    await page.mouse.up();
    await expect(top).not.toHaveClass(/detached/);
    await expect.poll(() => position(top)).not.toEqual(before);
    await expect(changeBadges(page)).toHaveCount(0);
    await expect(changeCoins(page)).toHaveCount(2);
  });

  test("dragging a change coin moves it within the change area", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change");
    await trayCoin(page, "50p").click();
    const coin = changeCoins(page).first();
    const before = await position(coin);
    const from = await centre(coin);
    await drag(page, from, { x: from.x + 30, y: from.y + 20 });
    await expect.poll(() => position(coin)).not.toEqual(before);
    await expect(changeCoins(page)).toHaveCount(1);
  });

  test("customer coins can be dragged within their area", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change");
    const customer = await customerCoins(page).count();
    const coin = customerCoins(page).last();
    const before = await position(coin);
    const mid = await centre(page.locator("#play-pile"));
    const from = await centre(coin);
    const to = Math.hypot(mid.x - from.x, mid.y - from.y) > 20 ? mid : { x: from.x + 40, y: from.y + 30 };
    await drag(page, from, to);
    await expect.poll(() => position(coin)).not.toEqual(before);
    await expect(customerCoins(page)).toHaveCount(customer);
    await expect(changeCoins(page)).toHaveCount(0);
  });

  test("Clear empties only the change area", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change", { difficulty: "easy" });
    const customer = await customerCoins(page).count();
    await trayCoin(page, "10p").click();
    await trayCoin(page, "5p").click();
    await expect(page.locator("#change-total")).toHaveText("Your change: £0.15");
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(changeCoins(page)).toHaveCount(0);
    await expect(page.locator("#change-total")).toHaveText("Your change: £0.00");
    await expect(customerCoins(page)).toHaveCount(customer);
  });
});

// ---- answering a round ----
import { COINS } from "../src/coins.js";
import { counterTotalPence } from "./helpers.js";

const PRICE = /Price £(\d+)\.(\d\d)/;
const message = (page) => page.locator("#play-message");

async function round(page) {
  const heading = await page.locator("#play-heading").textContent();
  const [, pounds, pence] = heading.match(PRICE);
  const price = Number(pounds) * 100 + Number(pence);
  const paid = await counterTotalPence(page);
  const due = paid - price;
  return { paid, price, due, scenario: due > 0 ? "over" : due === 0 ? "exact" : "under" };
}

// Tap tray coins, largest first, to make exactly `pence` in the change area.
async function buildChange(page, pence) {
  let left = pence;
  for (const coin of [...COINS].sort((a, b) => b.pence - a.pence)) {
    while (left >= coin.pence) {
      await trayCoin(page, coin.id).click();
      left -= coin.pence;
    }
  }
  expect(left).toBe(0);
}

async function solveCorrectly(page) {
  const { scenario, due } = await round(page);
  if (scenario === "over") {
    await buildChange(page, due);
    await page.locator("#btn-check").click();
  } else if (scenario === "exact") {
    await page.locator("#btn-none").click();
  } else {
    await page.locator("#btn-short").click();
  }
}

async function next(page) {
  await page.waitForTimeout(300);
  await page.locator("#btn-next").click();
}

// Press through customers with correct answers until the wanted scenario shows.
async function reach(page, scenario) {
  for (let i = 0; i < 40; i++) {
    const r = await round(page);
    if (r.scenario === scenario) return r;
    await solveCorrectly(page);
    await next(page);
  }
  throw new Error(`no ${scenario} round within 40 customers`);
}

test.describe("answering a round", () => {
  test("exact change on an overpaid round solves it and the next customer clears the change area", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change");
    const { due } = await reach(page, "over");
    const served = await page.locator("#play-rounds").textContent();
    const n = Number(served.match(/\d+/)[0]);
    await buildChange(page, due);
    await page.locator("#btn-check").click();
    await expect(message(page)).toHaveText(/^Correct! Change: £\d+\.\d\d\.$/);
    await expect(page.locator("#play-rounds")).toHaveText(`Customers served: ${n + 1}`);
    await expect(page.locator("#btn-next")).toBeFocused();
    await expect(page.locator("#btn-check")).toBeHidden();
    await expect(page.locator("#btn-none")).toBeVisible();
    await expect(page.locator("#btn-none")).toBeDisabled();
    await expect(page.locator("#btn-short")).toBeVisible();
    await expect(page.locator("#btn-short")).toBeDisabled();
    await expect(page.locator("#btn-clear")).toBeHidden();
    await expect(page.locator(".coin").first()).toHaveAttribute("aria-disabled", "true");
    await expect(changeCoins(page).first()).toHaveAttribute("aria-disabled", "true");
    await expect(customerCoins(page).first()).toHaveAttribute("aria-disabled", "true");
    await next(page);
    await expect(changeCoins(page)).toHaveCount(0);
    await expect(page.locator("#btn-check")).toBeVisible();
    await expect(page.locator("#btn-none")).toBeEnabled();
    await expect(page.locator("#btn-short")).toBeEnabled();
  });

  test("a solve keeps the layout still, and a forced click on a disabled answer button does nothing", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await seedRandom(page);
    await startMode(page, "Give Change");
    const rects = () => page.evaluate(() => ["#btn-none", "#change-pile", ".dock"].map((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return [s, r.x, r.y, r.width, r.height];
    }));
    const before = await rects();
    await solveCorrectly(page);
    await expect(page.locator("#btn-next")).toBeVisible();
    await expect(page.locator("#btn-none")).toBeDisabled();
    const after = await rects();
    for (let i = 0; i < before.length; i++) {
      if (before[i][0] === ".dock") expect(after[i][2], "dock top").toBeCloseTo(before[i][2], 0);
      else expect(after[i], before[i][0]).toEqual(before[i]);
    }
    await expect(message(page)).toHaveText(/^Correct!/); // the live region fills in a moment after the solve
    const msg = await message(page).textContent();
    const served = await page.locator("#play-rounds").textContent();
    await page.locator("#btn-none").click({ force: true });
    await page.locator("#btn-short").click({ force: true }).catch(() => {});
    await expect(message(page)).toHaveText(msg);
    await expect(page.locator("#play-rounds")).toHaveText(served);
    await next(page);
    await expect(page.locator("#btn-none")).toBeEnabled();
    await expect(page.locator("#btn-short")).toBeEnabled();
  });

  test("a wrong total keeps the coins; the same wrong answer twice is announced twice", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change");
    const { due } = await reach(page, "over");
    await buildChange(page, due + 1);
    await page.evaluate(() => {
      window.__announced = 0;
      new MutationObserver((records) => {
        for (const r of records) if (r.target.textContent) window.__announced++;
      }).observe(document.querySelector("#play-message"), { childList: true, characterData: true, subtree: true });
    });
    const count = await changeCoins(page).count();
    const served = await page.locator("#play-rounds").textContent();
    await page.locator("#btn-check").click();
    await expect(message(page)).toHaveText("Too much change");
    await page.waitForTimeout(150);
    await page.locator("#btn-check").click();
    await expect(message(page)).toHaveText("Too much change");
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.__announced)).toBe(2);
    await expect(changeCoins(page)).toHaveCount(count);
    await expect(page.locator("#btn-check")).toBeVisible();
    await expect(page.locator("#play-rounds")).toHaveText(served);
  });

  test("too little change says so and keeps the coins", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change");
    const { due } = await reach(page, "over");
    await buildChange(page, due - 1);
    const count = await changeCoins(page).count();
    await page.locator("#btn-check").click();
    await expect(message(page)).toHaveText("Not enough change");
    await expect(changeCoins(page)).toHaveCount(count);
  });

  test("Check with no change given on an overpaid round says Not enough change", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change");
    await reach(page, "over");
    await page.locator("#btn-check").click();
    await expect(message(page)).toHaveText("Not enough change");
    await expect(page.locator("#cashier-error")).toHaveText("");
    await expect(page.locator("#cashier-input")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("No change solves an exact round and focus moves to Next", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change");
    await reach(page, "exact");
    await page.locator("#btn-none").click();
    await expect(message(page)).toHaveText(/^Correct! No change due\.$/);
    await expect(page.locator("#btn-next")).toBeFocused();
  });

  test("Not enough! solves an underpaid round", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change");
    await reach(page, "under");
    await page.locator("#btn-short").click();
    await expect(page.locator("#play-message")).toHaveClass(/success/);
    await expect(page.locator("#play-message")).toHaveText(/^Correct! They are £\d+\.\d\d short\.$/);
    await expect(page.locator("#btn-next")).toBeFocused();
  });

  const WRONG = [
    ["over", "#btn-none", "They overpaid, so you owe change"],
    ["over", "#btn-short", "They paid enough"],
    ["exact", "#btn-check", "Does this customer need change?"],
    ["exact", "#btn-short", "They paid enough"],
    ["under", "#btn-check", "Does this customer need change?"],
    ["under", "#btn-none", "They have not paid enough yet"],
  ];
  for (const [scenario, button, hint] of WRONG) {
    test(`${scenario} round: ${button} shows "${hint}"`, async ({ page }) => {
      await seedRandom(page);
      await startMode(page, "Give Change");
      await reach(page, scenario);
      await page.locator(button).click();
      await expect(message(page)).toHaveText(hint);
      await expect(page.locator("#btn-check")).toBeVisible();
      await expect(page.locator("#play-rounds")).toHaveText(/Customers served: \d+/);
    });
  }

  test("Enter checks", async ({ page }) => {
    await seedRandom(page);
    await startMode(page, "Give Change");
    const { due } = await reach(page, "over");
    await buildChange(page, due);
    await page.locator("#play-heading").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#play-message")).toHaveClass(/success/);
    await expect(page.locator("#btn-next")).toBeFocused();
  });

  test("Easy never offers Not enough! and never underpays", async ({ page }) => {
    await seedRandom(page, 7);
    await startMode(page, "Give Change", { difficulty: "easy" });
    for (let i = 0; i < 40; i++) {
      const r = await round(page);
      expect(r.price).toBeLessThanOrEqual(r.paid);
      await expect(page.locator("#btn-short")).toBeHidden();
      await solveCorrectly(page);
      await next(page);
    }
  });
});

test.describe("after a solve, edits do nothing", () => {
  async function solvedOver(page) {
    await seedRandom(page);
    await startMode(page, "Give Change");
    const { due } = await reach(page, "over");
    await buildChange(page, due);
    await page.locator("#btn-check").click();
    await expect(page.locator("#btn-next")).toBeVisible();
    const snap = async () => ({
      change: await changeCoins(page).evaluateAll((els) => els.map((e) => [e.dataset.uid, e.style.left, e.style.top])),
      customer: await customerCoins(page).evaluateAll((els) => els.map((e) => [e.dataset.uid, e.style.left, e.style.top])),
    });
    return snap;
  }

  test("tray taps and drags, coin taps and drags, and Clear leave both piles unchanged", async ({ page }) => {
    const snap = await solvedOver(page);
    const before = await snap();
    expect(before.change.length).toBeGreaterThan(0);

    await trayCoin(page, "20p").click({ force: true });
    await drag(page, await centre(trayCoin(page, "50p")), await centre(page.locator("#change-pile")));
    await expect(page.locator(".tray-ghost")).toHaveCount(0);

    await changeCoins(page).first().click({ force: true });
    await customerCoins(page).first().click({ force: true });

    const c = await centre(changeCoins(page).last());
    await drag(page, c, { x: c.x + 30, y: c.y + 20 });
    const k = await centre(customerCoins(page).last());
    await drag(page, k, { x: k.x + 30, y: k.y + 20 });

    await changeCoins(page).last().focus();
    await page.keyboard.press("ArrowRight");

    await expect(page.locator("#btn-clear")).toBeHidden();
    await page.waitForTimeout(200);
    expect(await snap()).toEqual(before);
  });
});

// ---- each pile's own height reaches the drag and drop code (main.js wiring) ----
// A drop away from the pile's middle lands where released only if the drag maps the pointer with the
// pile's own (short) height; with the 90 mm default it would land several pixels off.
test.describe("drops land where released in the short piles", () => {
  test("a tray coin dropped 70% down the change pile lands under the pointer", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await seedRandom(page);
    await startMode(page, "Give Change");
    const p = await page.locator("#change-pile").boundingBox();
    const to = { x: p.x + p.width * 0.3, y: p.y + p.height * 0.7 };
    await drag(page, await centre(trayCoin(page, "50p")), to);
    await expect(changeCoins(page)).toHaveCount(1);
    await expect.poll(async () => {
      const c = await centre(changeCoins(page).first());
      return Math.hypot(c.x - to.x, c.y - to.y);
    }).toBeLessThanOrEqual(2);
  });

  test("a customer coin dragged off-centre in the customer pile lands under the pointer", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await seedRandom(page);
    await startMode(page, "Give Change");
    await page.waitForTimeout(300); // let the dealt coins finish settling in
    const p = await page.locator("#play-pile").boundingBox();
    // a spot 62% (or 38%) down, off the middle row, clear enough of every coin that it neither stacks nor is pushed
    const pick = await page.evaluate(({ p }) => {
      const coins = [...document.querySelectorAll("#play-pile .pile-coin")].map((el) => {
        const r = el.getBoundingClientRect();
        return { uid: el.dataset.uid, id: el.dataset.coin, x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
      });
      for (const c of coins) {
        // the coin must be the top one at its own centre so the press picks it up
        const hit = document.elementFromPoint(c.x, c.y)?.closest("[data-uid]");
        if (hit?.dataset.uid !== c.uid) continue;
        if (coins.some((o) => o !== c && o.id === c.id && Math.hypot(o.x - c.x, o.y - c.y) < 10)) continue; // in a stack
        for (const fy of [0.62, 0.38]) {
          const y = p.y + p.height * fy;
          for (let i = 3; i <= 17; i++) {
            const x = p.x + (p.width * i) / 20;
            if (Math.hypot(x - c.x, y - c.y) < 30) continue;
            // closer than the smaller radius would stack on, or push, that coin
            if (coins.every((o) => o === c || Math.hypot(o.x - x, o.y - y) > Math.min(o.r, c.r) + 3)) return { uid: c.uid, from: { x: c.x, y: c.y }, to: { x, y } };
          }
        }
      }
      return null;
    }, { p });
    expect(pick, "a clear spot in the customer pile").not.toBeNull();
    await drag(page, pick.from, pick.to);
    const coin = page.locator(`#play-pile [data-uid="${pick.uid}"]`);
    await expect.poll(async () => {
      const c = await centre(coin);
      return Math.hypot(c.x - pick.to.x, c.y - pick.to.y);
    }).toBeLessThanOrEqual(2);
  });
});

// ---- a big handful still fits the 4 cm strip ----
test("a handful of 10 or more coins stays inside the customer pile, and one coin drags on its own", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await seedRandom(page);
  await startMode(page, "Give Change");
  for (let i = 0; i < 40 && (await customerCoins(page).count()) < 10; i++) {
    await solveCorrectly(page);
    await next(page);
  }
  expect(await customerCoins(page).count()).toBeGreaterThanOrEqual(10);

  const inside = () => page.evaluate(() => {
    const p = document.querySelector("#play-pile").getBoundingClientRect();
    return [...document.querySelectorAll("#play-pile .pile-coin")].filter((el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      return !(x >= p.left && x <= p.right && y >= p.top && y <= p.bottom);
    }).map((el) => el.dataset.uid);
  });
  expect(await inside()).toEqual([]);
  await page.waitForTimeout(300); // let the dealt coins finish settling in

  // a coin on top at its own centre and not in a stack, so a press drags it alone
  const pick = await page.evaluate(() => {
    const p = document.querySelector("#play-pile").getBoundingClientRect();
    const coins = [...document.querySelectorAll("#play-pile .pile-coin")].map((el) => {
      const r = el.getBoundingClientRect();
      return { uid: el.dataset.uid, id: el.dataset.coin, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const c = coins.find((c) => document.elementFromPoint(c.x, c.y)?.closest("[data-uid]")?.dataset.uid === c.uid
      && !coins.some((o) => o !== c && o.id === c.id && Math.hypot(o.x - c.x, o.y - c.y) < 10));
    return c && { uid: c.uid, x: c.x, y: c.y, dx: c.x < p.left + p.width / 2 ? 60 : -60 };
  });
  expect(pick).toBeTruthy();
  const boxes = () => customerCoins(page).evaluateAll((els) => Object.fromEntries(els.map((el) => {
    const r = el.getBoundingClientRect();
    return [el.dataset.uid, [Math.round(r.left), Math.round(r.top)]];
  })));
  const before = await boxes();
  await page.mouse.move(pick.x, pick.y);
  await page.mouse.down();
  await page.mouse.move(pick.x + pick.dx, pick.y, { steps: 5 });
  // mid-drag only the held coin has moved
  const during = await boxes();
  const moved = Object.keys(before).filter((uid) => before[uid][0] !== during[uid][0] || before[uid][1] !== during[uid][1]);
  expect(moved, JSON.stringify({ before, during, pick })).toEqual([pick.uid]);
  await page.mouse.up();
  await expect.poll(async () => (await centre(page.locator(`#play-pile [data-uid="${pick.uid}"]`))).x).not.toBeCloseTo(pick.x, 0);
  await page.waitForTimeout(200);
  expect(await inside()).toEqual([]);
  await expect(customerCoins(page)).toHaveCount(Object.keys(before).length);
});

// ---- layout: the whole screen fits the frame on phones and desktop ----
const rect = (page, sel) => page.locator(sel).evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
});

test("the tray sits no further below the dock's top edge in Give Change than in Endless", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await seedRandom(page);
  await startMode(page, "Endless");
  const endlessDock = await rect(page, ".dock");
  const endlessTray = await rect(page, "#play-tray");
  await startMode(page, "Give Change");
  const dock = await rect(page, ".dock");
  const tray = await rect(page, "#play-tray");
  expect(tray.top - dock.top).toBeLessThanOrEqual(endlessTray.top - endlessDock.top + 1);
});

// 844x390 landscape is left out on purpose: there the empty hint line collapses to save room for the content window
const HINT_SCREENS = [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 476, height: 850 },
  { width: 1280, height: 800 },
];
const boxes = (page, sels) => Promise.all(sels.map(async (sel) => {
  const r = await rect(page, sel);
  return { top: r.top, height: r.height };
}));
const expectSameBoxes = (a, b, sels) => sels.forEach((sel, i) => {
  expect(Math.abs(b[i].top - a[i].top), `${sel} top`).toBeLessThanOrEqual(0.5);
  expect(Math.abs(b[i].height - a[i].height), `${sel} height`).toBeLessThanOrEqual(0.5);
});

test.describe("a hint never moves the Give Change layout", () => {
  for (const vp of HINT_SCREENS) {
    for (const difficulty of ["normal", "easy"]) {
      test(`${vp.width}x${vp.height} ${difficulty}: dock, piles and tray stay put when a hint shows and clears`, async ({ page }) => {
        await page.setViewportSize(vp);
        await seedRandom(page);
        await startMode(page, "Give Change", { difficulty });
        await expect(page.locator("#change-pile")).toBeVisible();
        const all = [".dock", "#change-pile", "#play-pile", "#play-tray"];
        const before = await boxes(page, all);
        await page.locator("#btn-check").click();
        await expect(page.locator("#play-message")).not.toBeEmpty();
        expectSameBoxes(before, await boxes(page, all), all);
        await page.locator("#play-tray button").first().click();
        await expect(page.locator("#play-message")).toBeEmpty();
        const dockAndPiles = [".dock", "#play-pile", "#play-tray"];
        expectSameBoxes([before[0], before[2], before[3]], await boxes(page, dockAndPiles), dockAndPiles);
      });
    }
  }
});

const SCREENS = [
  { width: 390, height: 844 },
  { width: 476, height: 850 },
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
];

test.describe("change layout fits without scrolling", () => {
  for (const vp of SCREENS) {
    for (const difficulty of ["normal", "easy"]) {
      test(`${vp.width}x${vp.height} ${difficulty}: piles, answer buttons and Check are on screen, clear of the bars`, async ({ page }) => {
        await page.setViewportSize(vp);
        await seedRandom(page);
        await startMode(page, "Give Change", { difficulty });
        await expect(page.locator("#change-pile")).toBeVisible();
        const m = await page.evaluate(() => {
          const c = document.querySelector(".content");
          const main = document.querySelector("main");
          return {
            content: c.scrollHeight - c.clientHeight,
            main: main.scrollHeight - main.clientHeight,
            sw: document.documentElement.scrollWidth,
            vw: window.innerWidth,
          };
        });
        expect(m.content, "content scrolls").toBeLessThanOrEqual(0);
        expect(m.main, "frame scrolls").toBeLessThanOrEqual(0);
        expect(m.sw, "sideways overflow").toBeLessThanOrEqual(m.vw);

        const topbar = await rect(page, ".topbar");
        const dock = await rect(page, ".dock");
        const sels = ["#play-pile", "#change-pile", "#btn-none", "#btn-check", "#btn-clear"];
        if (difficulty === "normal") sels.push("#btn-short");
        for (const sel of sels) {
          const b = await rect(page, sel);
          expect(b.top, sel).toBeGreaterThanOrEqual(0);
          expect(b.left, sel).toBeGreaterThanOrEqual(0);
          expect(b.bottom, sel).toBeLessThanOrEqual(vp.height);
          expect(b.right, sel).toBeLessThanOrEqual(vp.width);
          const inTopbar = await page.locator(`.topbar ${sel}`).count();
          const inDock = await page.locator(`.dock ${sel}`).count();
          if (!inDock) expect(b.bottom, `${sel} above the dock`).toBeLessThanOrEqual(dock.top);
          if (!inTopbar) expect(b.top, `${sel} below the top bar`).toBeGreaterThanOrEqual(topbar.bottom);
          if (inTopbar) expect(b.bottom, `${sel} inside the top bar`).toBeLessThanOrEqual(topbar.bottom);
          await expect(page.locator(sel), sel).toBeInViewport({ ratio: 1 });
        }
        // the answer buttons sit inside the Your change card, under its pile
        const card = await rect(page, "#change-area");
        const pile = await rect(page, "#change-pile");
        const none = await rect(page, "#btn-none");
        expect(none.top).toBeGreaterThanOrEqual(pile.bottom);
        expect(none.bottom).toBeLessThanOrEqual(card.bottom);
        if (difficulty === "easy") {
          // centred on its own
          expect(Math.abs((none.left + none.right) / 2 - (card.left + card.right) / 2)).toBeLessThanOrEqual(2);
        }
      });
    }
  }
});

test.describe("short landscape window", () => {
  for (const difficulty of ["normal", "easy"]) {
    test(`844x390 ${difficulty}: every control can be reached and Check works`, async ({ page }) => {
      await page.setViewportSize({ width: 844, height: 390 });
      await seedRandom(page);
      await startMode(page, "Give Change", { difficulty });
      await expect(page.locator("#change-pile")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      // tightened like the other modes, with the 4 cm player pile: the content keeps a useful height
      expect((await rect(page, ".content")).height).toBeGreaterThanOrEqual(80);
      expect(Math.abs((await boxHeightMm(page, "#change-pile")) - 40)).toBeLessThanOrEqual(1);
      const sels = ["#btn-back", "#play-pile", "#change-pile", "#btn-none", "#btn-check", "#btn-clear", "#play-tray"];
      if (difficulty === "normal") sels.push("#btn-short");
      for (const sel of sels) {
        await page.locator(sel).scrollIntoViewIfNeeded();
        await expect(page.locator(sel), sel).toBeInViewport();
      }
      for (const coin of await page.locator("#play-tray .coin").all()) await coin.click({ trial: true });
      for (const sel of ["#btn-none", "#btn-check", "#btn-clear"]) await page.locator(sel).click({ trial: true });
      await page.locator("#btn-check").click();
      await expect(page.locator("#play-message")).not.toHaveText("");
    });
  }
});
