import { describePile, detachNudge, formatPence, parseAmount, randomTarget, total, unitUids } from "./game.js";
import { createDwell } from "./dwell.js";
import { giveChangeOdds, timingFromSearch } from "./config.js";
import { mountHome } from "./home.js";
import { createDrag, createTrayDrag } from "./drag.js";
import { isCheckShortcut } from "./keys.js";
import { applyTheme, getStorage, nextTheme, readTheme, saveTheme, themeLabel } from "./theme.js";
import { announce, renderPile, renderTray, setText, showStackBadges } from "./render.js";
import {
  addToPile, canAdvance, clearPile, createState, isContinuous, nextGiveChangeCustomer, nextCustomer, nextRound, startCashier, startGiveChange, submitAnswer,
  addToPileAt, moveCoin, moveGroup, removeFromPile, settleCoin, settleGroupCoins, setOption, selectMode,
  pileHeightMm, startGame, submitCheck, submitGiveChangeAnswer, transferCoins, sendCoin,
} from "./state.js";

const $ = (id) => document.getElementById(id);
const SCREENS = ["home", "custom", "play"];

let state = createState();
let shownMessage = state.message;
let shownPile;
let shownChange;
// each pile container has a key into state: the customer's (or player's) coins and the change
const PILE_IDS = { pile: "play-pile", change: "change-pile" };
const pileEl = (key) => $(PILE_IDS[key]);
// tray adds, tray drops and Clear go to the change in Give Change mode, else to the pile
const activeKey = () => (state.mode === "give-change" ? "change" : "pile");
// Short screens (an iPhone SE, a landscape phone) shrink the piles to the 4 cm box so the screen fits
// (the player's pile, or both Give Change piles).
const compactQuery = window.matchMedia("(max-height: 700px)");
const heightOf = (key) => pileHeightMm(state, key, compactQuery.matches);
// the held, detached coin per pile: it does not count toward stack badges
const detachedUid = { pile: null, change: null };

function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  // light-dark() stays unresolved in a custom property, so read the body's resolved colour
  if (meta) meta.content = getComputedStyle(document.body).backgroundColor;
}

function initTheme() {
  const storage = getStorage(window);
  let theme = readTheme(storage);
  const button = $("btn-theme");
  const show = () => {
    applyTheme(document.documentElement, theme);
    syncThemeColor();
    if (!button) return;
    button.dataset.state = theme;
    button.setAttribute("aria-label", themeLabel(theme));
    button.title = themeLabel(theme);
  };
  show();
  button?.addEventListener("click", () => {
    theme = nextTheme(theme);
    saveTheme(storage, theme);
    show();
  });
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", syncThemeColor);
}
initTheme();

const timing = timingFromSearch(location.search);

const dwell = createDwell({
  delay: timing.dwellMs,
  onReveal: (el) => el.classList.add("revealed"),
  onHide: (el) => el.classList.remove("revealed"),
});

// :focus-visible is missing in old browsers; fall back to true so keyboard users still get the reveal
function focusVisible(el) {
  try { return el.matches(":focus-visible"); } catch { return true; }
}

// key is the pile's state key, or undefined for the tray
function watchDwell(container, key) {
  const coinOf = (e) => e.target.closest?.("[data-coin]");
  container.addEventListener("pointerover", (e) => {
    const coin = coinOf(e);
    if (coin) dwell.start(coin);
  });
  container.addEventListener("pointerout", (e) => {
    const coin = coinOf(e);
    if (coin && !coin.contains(e.relatedTarget)) dwell.stop(coin);
  });
  container.addEventListener("focusin", (e) => {
    const coin = coinOf(e);
    if (coin && focusVisible(coin)) dwell.start(coin);
  });
  container.addEventListener("focusout", (e) => {
    const coin = coinOf(e);
    if (coin) dwell.stop(coin);
  });
  container.addEventListener("contextmenu", (e) => e.preventDefault());
  // A long touch may not be followed by a click (Android long-press), so act on release
  // when the press revealed the value; a click that does follow is then ignored.
  container.addEventListener("pointerdown", () => { swallow = null; });
  container.addEventListener("pointerup", (e) => {
    if (e.pointerType === "mouse") return;
    const coin = coinOf(e);
    if (!coin || !coin.classList.contains("revealed")) return;
    if ((key ? drags[key] : trayDrag)?.suppressed()) return;
    const id = coin.dataset.uid ?? coin.dataset.coin;
    swallow = { id, container };
    setTimeout(() => { if (swallow?.id === id) swallow = null; }, 500);
    // a coin that sends on tap is only read by a hold: the release (and the click after it) does nothing
    if (!key) addCoin(id);
    else if (!sendsOnTap(key, id)) removeCoin(id, key);
  });
}

let swallow = null;
const drags = {};
let trayDrag;
function takeSwallow(container, id) {
  // a pile click may land on a different coin than the one just removed, so any pile click is swallowed
  const hit = swallow && swallow.container === container && (container !== $("play-tray") || swallow.id === id);
  swallow = null;
  return hit;
}

function addCoin(id, key = activeKey()) {
  update(addToPile(state, id, Math.random, key, compactQuery.matches));
}

function removeCoin(uidText, key) {
  const uid = Number(uidText);
  const entry = state[key].find((e) => e.uid === uid);
  if (!entry) return;
  const next = removeFromPile(state, uid, key);
  if (next === state) return;
  update(next);
  // the pile is re-rendered, so hand focus back to keep keyboard use flowing
  const top = [...pileEl(key).querySelectorAll(".pile-coin")].pop();
  const target = top ?? $("play-tray").querySelector(`[data-coin="${entry.coinId}"]`);
  target?.focus({ preventScroll: true });
}

function showScreen(name) {
  dwell.cancelAll();
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  $(`screen-${name}`).querySelector("h1").focus();
}

// Give Change shows the customer's pile in the top bar; every other mode keeps it in its card.
// The same nodes move, so their drag and dwell listeners (and any focus) go with them.
function placeCustomerPile(giveChange) {
  const pile = $("play-pile");
  const host = giveChange ? $("topbar-customer") : $("play-area");
  $("topbar-customer").hidden = !giveChange;
  $("play-area").hidden = giveChange;
  if (pile.parentElement === host) return;
  const before = giveChange ? null : $("play-total");
  host.insertBefore(pile, before);
  host.insertBefore($("play-pile-summary"), before);
  dwell.prune((el) => el.isConnected);
}

function render() {
  const endless = isContinuous(state);
  const cashier = state.mode === "cashier";
  const giveChange = state.mode === "give-change";
  const fixedPile = cashier || giveChange; // the customer's coins cannot be removed
  placeCustomerPile(giveChange);
  setText($("play-heading-label"), cashier ? "Customer's coins" : giveChange ? "Price" : "Make");
  setText($("play-target"), cashier ? "How much?" : giveChange ? formatPence(state.price) : formatPence(state.target));
  if (state.pile !== shownPile) {
    renderPile($("play-pile"), state.pile, detachedUid.pile, !fixedPile, heightOf("pile"));
    setText($("play-pile-summary"), cashier ? describePile(state.pile, "On the counter") : giveChange ? describePile(state.pile, "Customer paid") : describePile(state.pile));
    shownPile = state.pile;
    // drop dwells on removed pile coins (untouched pile and tray coins keep theirs)
    dwell.prune((el) => el.isConnected);
  }
  if (state.change !== shownChange) {
    renderPile($("change-pile"), state.change, detachedUid.change, true, heightOf("change"));
    setText($("change-pile-summary"), state.change ? describePile(state.change, "Your change") : "");
    shownChange = state.change;
    dwell.prune((el) => el.isConnected);
  }
  const screen = $("screen-play");
  const showCoins = state.options.showCoins;
  screen.dataset.showCoins = String(showCoins);
  // the tray drag ghost lives in <body> (drag.js), so mirror Show Coins there for the label rules
  document.body.dataset.showCoins = String(showCoins);
  setText($("play-total"), fixedPile ? "" : `Your total: ${formatPence(total(state.pile))}`);
  // with Show Coins off a visible total would give away the hidden coin values
  $("play-total").hidden = fixedPile || !showCoins;
  $("change-area").hidden = !giveChange;
  setText($("change-total"), giveChange ? `Your change: ${formatPence(total(state.change))}` : "");
  $("change-total").hidden = !giveChange || !showCoins;
  // the answer buttons stay in place after a solve (so nothing shifts) but are disabled until the next customer
  $("btn-none").hidden = !giveChange;
  $("btn-short").hidden = !giveChange || !state.options.shortPay;
  $("btn-none").disabled = state.solved;
  $("btn-short").disabled = state.solved;
  $("play-tray").hidden = cashier;
  $("cashier-answer").hidden = !cashier;
  $("cashier-input").disabled = state.solved;
  setText($("pile-heading"), cashier ? "On the counter" : giveChange ? "Customer paid" : "Your coins");
  // each submitCheck makes a new message object, so a repeated hint is announced again
  if (state.message !== shownMessage) {
    shownMessage = state.message;
    announce($("play-message"), state.message.text);
  }
  $("play-message").className = `message ${state.message.kind}`.trim();
  $("play-rounds").hidden = !endless;
  setText($("play-rounds"), `${cashier || giveChange ? "Customers served" : "Rounds completed"}: ${state.rounds}`);
  $("btn-check").hidden = state.solved;
  $("btn-clear").hidden = state.solved || cashier;
  $("btn-next").hidden = !(state.solved && endless);
  $("btn-again").hidden = !(state.solved && !endless);
  $("btn-change").hidden = !(state.solved && !endless);

  screen.classList.toggle("locked", state.solved);
  screen.classList.toggle("cashier", cashier);
  screen.classList.toggle("give-change", giveChange);
  for (const btn of document.querySelectorAll(".coin, .pile-coin")) {
    if (state.solved) btn.setAttribute("aria-disabled", "true");
    else btn.removeAttribute("aria-disabled");
  }
  home.update(state.mode, state.options);
}

function update(next) {
  state = next;
  render();
}

// uids restart per deal, so a new cashier or change deal must not reuse any old button. `shownChange` is
// reset so the change pile is redrawn; `shownPile` needs no reset because every new deal makes a new
// `state.pile` array, so render() redraws the customer pile on its own.
function resetPileDom() {
  $("play-pile").replaceChildren();
  $("change-pile").replaceChildren();
  shownChange = undefined;
  dwell.prune((el) => el.isConnected);
}

function beginRound(next) {
  update(next);
  $("play-heading").focus();
}

// the uid of the focused coin in this pile, or null
function focusedUidIn(key) {
  const focused = document.activeElement;
  return focused?.closest?.(`#${PILE_IDS[key]} [data-uid]`) ? focused.dataset.uid : null;
}

function moveAndRefocus(uid, x, y, key) {
  const entry = state[key].find((e) => e.uid === uid);
  if (!entry) return;
  const from = { x: entry.x, y: entry.y };
  const container = pileEl(key);
  const el = container.querySelector(`[data-uid="${uid}"]`);
  const focusedUid = focusedUidIn(key);
  update(moveCoin(state, uid, x, y, key));
  container.offsetWidth; // flush styles so the coin lands where released before it glides
  el?.style.removeProperty("transition"); // set by the drop in drag.js
  update(settleCoin(state, uid, from, key, compactQuery.matches));
  if (focusedUid !== null) container.querySelector(`[data-uid="${focusedUid}"]`)?.focus({ preventScroll: true });
}

function moveGroupAndRefocus(uids, dx, dy, leaderUid, key) {
  const leader = state[key].find((e) => e.uid === leaderUid);
  if (!leader) return;
  const from = { x: leader.x, y: leader.y };
  const container = pileEl(key);
  const els = uids.map((uid) => container.querySelector(`[data-uid="${uid}"]`));
  const focusedUid = focusedUidIn(key);
  update(moveGroup(state, uids, dx, dy, key));
  container.offsetWidth; // flush styles so the group lands where released before it glides
  for (const el of els) el?.style.removeProperty("transition"); // set by the drop in drag.js
  update(settleGroupCoins(state, uids, leaderUid, from, key, compactQuery.matches));
  // the group is re-ordered with replaceChildren, which drops focus, so restore it by uid
  if (focusedUid !== null) container.querySelector(`[data-uid="${focusedUid}"]`)?.focus({ preventScroll: true });
}

// Give Change: the pile container under a viewport point, so a drag can drop on the other pile
function dropTarget(pt) {
  if (state.mode !== "give-change") return null;
  // elementFromPoint respects the clipping of the scrolling .content, unlike a rectangle test
  const hit = document.elementFromPoint(pt.x, pt.y)?.closest(".pile");
  if (!hit) return null;
  for (const key of ["pile", "change"]) {
    if (pileEl(key) === hit) return { key, el: hit, heightMm: heightOf(key) };
  }
  return null;
}

function applyTransfer(next, from, to) {
  const hadFocus = focusedUidIn(from) !== null;
  const before = state;
  update(next);
  // the moved coins get new uids and the leader is appended last, so follow it into the target pile
  if (hadFocus && state[to] !== before[to]) pileEl(to).lastElementChild?.focus({ preventScroll: true });
}

function transferAndRefocus(uids, leaderUid, from, to, x, y) {
  applyTransfer(transferCoins(state, uids, leaderUid, from, to, x, y, compactQuery.matches), from, to);
}

// In Give Change a tap sends a customer coin (or any coin in the customer pile) to the other pile
const sendsOnTap = (key, uidText) => state.mode === "give-change"
  && (key === "pile" || !!state[key].find((e) => e.uid === Number(uidText))?.customer);

function tapCoin(uidText, key) {
  if (sendsOnTap(key, uidText)) {
    const next = sendCoin(state, Number(uidText), key, Math.random, compactQuery.matches);
    if (next !== state) { applyTransfer(next, key, key === "pile" ? "change" : "pile"); return; }
  }
  removeCoin(uidText, key);
}

function onDragStart(el) {
  if (!el.classList.contains("revealed")) dwell.stop(el);
}

function dropFromTray(coinId, x, y) {
  const key = activeKey();
  const next = addToPileAt(state, coinId, x, y, Math.random, key);
  if (next === state) return;
  update(next);
  pileEl(key).offsetWidth; // flush styles so the coin lands where released before it glides
  update(settleCoin(state, state[key][state[key].length - 1].uid, null, key, compactQuery.matches));
}

renderTray($("play-tray"));
// created before the tray's watchDwell so its listeners run first
trayDrag = createTrayDrag($("play-tray"), {
  onDrop: dropFromTray, onDragStart, isLocked: () => state.solved, pileEl: () => pileEl(activeKey()),
  heightMm: () => heightOf(activeKey()),
});
watchDwell($("play-tray"));

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

// Drag, dwell, tap-to-remove and arrow keys for one pile container.
function wirePile(key) {
  const container = pileEl(key);
  // created before the pile's watchDwell so its listeners run first
  drags[key] = createDrag(container, {
    holdMs: timing.detachHoldMs,
    onMove: (uid, x, y) => moveAndRefocus(uid, x, y, key),
    onMoveGroup: (uids, dx, dy, leaderUid) => moveGroupAndRefocus(uids, dx, dy, leaderUid, key),
    heightMm: () => heightOf(key),
    getGroup: (uid) => unitUids(state[key], uid, heightOf(key)),
    onDragStart,
    isLocked: () => state.solved,
    onDetach: (uid) => {
      detachedUid[key] = uid;
      showStackBadges(container, state[key], uid, heightOf(key));
    },
    onDetachEnd: () => {
      detachedUid[key] = null;
      showStackBadges(container, state[key], null, heightOf(key));
    },
    onDetachRelease: (uid) => {
      const entry = state[key].find((e) => e.uid === uid);
      if (!entry || state.solved) return;
      const { x, y } = detachNudge(entry, heightOf(key));
      moveAndRefocus(uid, x, y, key);
    },
    dropTarget,
    onTransfer: (uids, leaderUid, to, x, y) => transferAndRefocus(uids, leaderUid, key, to, x, y),
  });
  watchDwell(container, key);
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-uid]");
    if (btn && !takeSwallow(container, btn.dataset.uid)) tapCoin(btn.dataset.uid, key);
  });
  container.addEventListener("keydown", (e) => {
    const dir = ARROWS[e.key];
    const btn = e.target.closest?.("[data-uid]");
    if (!dir || !btn || e.ctrlKey || e.altKey || e.metaKey) return;
    if (drags[key].active()) return;
    e.preventDefault();
    const entry = state[key].find((p) => p.uid === Number(btn.dataset.uid));
    if (!entry) return;
    const step = e.shiftKey ? 0.1 : 0.02;
    moveAndRefocus(entry.uid, entry.x + dir[0] * step, entry.y + dir[1] * step, key);
  });
}
wirePile("pile");
wirePile("change");
// crossing 700 px high changes the pile boxes (the player's pile, or both in Give Change): redraw them
// (coins keep their fractional, clamped places)
compactQuery.addEventListener?.("change", () => {
  shownPile = undefined;
  shownChange = undefined;
  render();
});

// Hold, hover or focus an option label to read what it means, without toggling it.
// Returns the dwell so a rebuilt list can drop its pending reveals.
function watchOptionNotes(fieldset) {
  const note = $("option-note");
  let touching = false; // a non-mouse press is down
  let heldReveal = false; // that press revealed a note, so its click must not select
  const notes = createDwell({
    delay: timing.dwellMs,
    onReveal: (label) => {
      setText(note, label.title);
      if (touching) heldReveal = true;
    },
    onHide: () => setText(note, ""),
  });
  const labelOf = (e) => e.target.closest?.("label");
  fieldset.addEventListener("pointerover", (e) => {
    const label = labelOf(e);
    if (label) notes.start(label);
  });
  fieldset.addEventListener("pointerout", (e) => {
    const label = labelOf(e);
    if (label && !label.contains(e.relatedTarget)) notes.stop(label);
  });
  fieldset.addEventListener("focusin", (e) => {
    const label = labelOf(e);
    if (label && focusVisible(e.target)) notes.start(label);
  });
  fieldset.addEventListener("focusout", (e) => {
    const label = labelOf(e);
    if (label) notes.stop(label);
  });
  fieldset.addEventListener("pointerdown", (e) => {
    heldReveal = false;
    touching = e.pointerType !== "mouse";
  });
  const release = () => { touching = false; };
  fieldset.addEventListener("pointerup", release);
  fieldset.addEventListener("pointercancel", release);
  fieldset.addEventListener("contextmenu", (e) => e.preventDefault());
  fieldset.addEventListener("click", (e) => {
    if (!heldReveal) return;
    heldReveal = false;
    if (labelOf(e)) e.preventDefault();
  });
  return notes;
}
const optionNotes = watchOptionNotes($("options"));

$("play-tray").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-coin]");
  if (btn && !takeSwallow($("play-tray"), btn.dataset.coin)) addCoin(btn.dataset.coin);
});
$("btn-clear").addEventListener("click", () => update(clearPile(state, activeKey())));

function resetCashierInput() {
  const input = $("cashier-input");
  input.value = "";
  input.disabled = false;
  input.removeAttribute("aria-invalid");
  announce($("cashier-error"), "");
}

function checkCashier() {
  if (state.solved) return;
  const input = $("cashier-input");
  const result = parseAmount(input.value);
  if (!result.ok) {
    input.setAttribute("aria-invalid", "true");
    announce($("cashier-error"), result.error);
    return;
  }
  input.removeAttribute("aria-invalid");
  announce($("cashier-error"), "");
  update(submitAnswer(state, result.pence, performance.now()));
  if (state.solved) document.querySelector(".actions button:not([hidden])").focus();
}

$("cashier-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); checkCashier(); }
});
function answerGiveChange(action) {
  update(submitGiveChangeAnswer(state, action, performance.now()));
  if (state.solved) document.querySelector(".actions button:not([hidden])").focus();
}

function runCheck() {
  if (state.mode === "cashier") { checkCashier(); return; }
  if (state.mode === "give-change") { answerGiveChange("check"); return; }
  update(submitCheck(state, performance.now()));
  if (state.solved) document.querySelector(".actions button:not([hidden])").focus();
}
$("btn-check").addEventListener("click", runCheck);
$("btn-none").addEventListener("click", () => answerGiveChange("none"));
$("btn-short").addEventListener("click", () => answerGiveChange("short"));
// Enter (or Ctrl/Cmd+Enter) is a shortcut for Check on the play screen
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || $("screen-play").hidden || state.solved || !isCheckShortcut(e)) return;
  e.preventDefault();
  runCheck();
});
// A held Enter or Space must not repeat-activate a button: Enter held to Check would otherwise carry on
// into the Next that focus moves to after the solve, and skip the result.
$("screen-play").addEventListener("keydown", (e) => {
  if (e.repeat && (e.key === "Enter" || e.key === " ")) e.preventDefault();
}, true);
$("btn-next").addEventListener("click", () => {
  if (!canAdvance(state, performance.now(), timing.advanceDelayMs)) return;
  if (state.mode === "cashier") {
    resetPileDom();
    beginRound(nextCustomer(state));
    resetCashierInput();
  } else if (state.mode === "give-change") {
    resetPileDom();
    beginRound(nextGiveChangeCustomer(state, giveChangeOdds(state.options)));
  } else {
    beginRound(nextRound(state, randomTarget(state.target)));
  }
});
$("btn-again").addEventListener("click", () => {
  if (canAdvance(state, performance.now(), timing.advanceDelayMs)) beginRound(nextRound(state, state.target));
});
function startSelected(mode) {
  if (mode === "custom") { openCustom(""); return; }
  if (mode === "endless") {
    update(startGame(state, "endless", randomTarget()));
  } else if (mode === "cashier") {
    resetPileDom();
    update(startCashier(state));
    resetCashierInput();
  } else {
    resetPileDom();
    update(startGiveChange(state, giveChangeOdds(state.options)));
  }
  showScreen("play");
}

function openCustom(prefill) {
  const input = $("custom-input");
  input.value = prefill;
  input.removeAttribute("aria-invalid");
  announce($("custom-error"), "");
  showScreen("custom");
  input.focus();
}

$("btn-change").addEventListener("click", () => openCustom(formatPence(state.target).slice(1)));
$("custom-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const result = parseAmount($("custom-input").value);
  if (!result.ok) {
    $("custom-input").setAttribute("aria-invalid", "true");
    announce($("custom-error"), result.error);
    return;
  }
  $("custom-input").removeAttribute("aria-invalid");
  announce($("custom-error"), "");
  update(startGame(state, "custom", result.pence));
  showScreen("play");
});
$("custom-back").addEventListener("click", () => showScreen("home"));
$("btn-back").addEventListener("click", () => showScreen("home"));

const home = mountHome(
  { modes: $("modes"), options: $("options"), play: $("btn-play") },
  {
    onMode: (mode) => { optionNotes.cancelAll(); update(selectMode(state, mode)); },
    onOption: (id, value) => update(setOption(state, id, value)),
    onPlay: startSelected,
  },
);
home.update(state.mode, state.options);
