import { describePile, detachNudge, formatPence, parseAmount, randomTarget, total, unitUids } from "./game.js";
import { createDwell } from "./dwell.js";
import { timingFromSearch } from "./config.js";
import { createDrag, createTrayDrag } from "./drag.js";
import { isCheckShortcut } from "./keys.js";
import { applyTheme, getStorage, nextTheme, readTheme, saveTheme, themeLabel } from "./theme.js";
import { announce, renderPile, renderTray, setText, showStackBadges } from "./render.js";
import {
  addToPile, canAdvance, clearPile, createState, isContinuous, nextCustomer, nextRound, startCashier, submitAnswer,
  addToPileAt, moveCoin, moveGroup, removeFromPile, settleCoin, settleGroupCoins, setDifficulty,
  startGame, submitCheck,
} from "./state.js";

const $ = (id) => document.getElementById(id);
const SCREENS = ["home", "custom", "play"];

let state = createState();
let shownMessage = state.message;
let shownPile;
let detachedUid = null; // the held, detached coin: it does not count toward stack badges

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

function watchDwell(container) {
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
    if (container === $("play-pile") && drag?.suppressed()) return;
    if (container === $("play-tray") && trayDrag?.suppressed()) return;
    const key = coin.dataset.uid ?? coin.dataset.coin;
    swallow = { id: key, container };
    setTimeout(() => { if (swallow?.id === key) swallow = null; }, 500);
    (container === $("play-tray") ? addCoin : removeCoin)(key);
  });
}

let swallow = null;
let drag;
let trayDrag;
function takeSwallow(container, id) {
  // a pile click may land on a different coin than the one just removed, so any pile click is swallowed
  const hit = swallow && swallow.container === container && (container === $("play-pile") || swallow.id === id);
  swallow = null;
  return hit;
}

function addCoin(id) {
  update(addToPile(state, id));
}

function removeCoin(uidText) {
  const uid = Number(uidText);
  const entry = state.pile.find((e) => e.uid === uid);
  if (!entry) return;
  const next = removeFromPile(state, uid);
  if (next === state) return;
  update(next);
  // the pile is re-rendered, so hand focus back to keep keyboard use flowing
  const top = [...document.querySelectorAll("#play-pile .pile-coin")].pop();
  const target = top ?? $("play-tray").querySelector(`[data-coin="${entry.coinId}"]`);
  target?.focus({ preventScroll: true });
}

function showScreen(name) {
  dwell.cancelAll();
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  $(`screen-${name}`).querySelector("h1").focus();
}

function render() {
  const endless = isContinuous(state);
  const cashier = state.mode === "cashier";
  setText($("play-heading-label"), cashier ? "Customer's coins" : "Make");
  setText($("play-target"), cashier ? "How much?" : formatPence(state.target));
  if (state.pile !== shownPile) {
    renderPile($("play-pile"), state.pile, detachedUid, !cashier);
    setText($("play-pile-summary"), cashier ? describePile(state.pile, "On the counter") : describePile(state.pile));
    shownPile = state.pile;
    // drop dwells on removed pile coins (untouched pile and tray coins keep theirs)
    dwell.prune((el) => el.isConnected);
  }
  const screen = $("screen-play");
  screen.dataset.difficulty = state.difficulty;
  // the tray drag ghost lives in <body> (drag.js), so mirror the difficulty there for the label rules
  document.body.dataset.difficulty = state.difficulty;
  setText($("play-total"), cashier ? "" : `Your total: ${formatPence(total(state.pile))}`);
  // in Normal a visible total would give away the hidden coin values
  $("play-total").hidden = cashier || state.difficulty !== "easy";
  $("play-tray").hidden = cashier;
  $("cashier-answer").hidden = !cashier;
  $("cashier-input").disabled = state.solved;
  setText($("pile-heading"), cashier ? "On the counter" : "Your coins");
  // each submitCheck makes a new message object, so a repeated hint is announced again
  if (state.message !== shownMessage) {
    shownMessage = state.message;
    announce($("play-message"), state.message.text);
  }
  $("play-message").className = `message ${state.message.kind}`.trim();
  $("play-rounds").hidden = !endless;
  setText($("play-rounds"), `${cashier ? "Customers served" : "Rounds completed"}: ${state.rounds}`);
  $("btn-check").hidden = state.solved;
  $("btn-clear").hidden = state.solved || cashier;
  $("btn-next").hidden = !(state.solved && endless);
  $("btn-again").hidden = !(state.solved && !endless);
  $("btn-change").hidden = !(state.solved && !endless);

  screen.classList.toggle("locked", state.solved);
  screen.classList.toggle("cashier", cashier);
  for (const btn of document.querySelectorAll(".coin, .pile-coin")) {
    if (state.solved) btn.setAttribute("aria-disabled", "true");
    else btn.removeAttribute("aria-disabled");
  }
}

function update(next) {
  state = next;
  render();
}

// uids restart per deal, so a new cashier deal must not reuse any old button
function resetPileDom() {
  $("play-pile").replaceChildren();
  dwell.prune((el) => el.isConnected);
}

function beginRound(next) {
  update(next);
  $("play-heading").focus();
}

function moveAndRefocus(uid, x, y) {
  const entry = state.pile.find((e) => e.uid === uid);
  if (!entry) return;
  const from = { x: entry.x, y: entry.y };
  const el = $("play-pile").querySelector(`[data-uid="${uid}"]`);
  const focused = document.activeElement;
  const focusedUid = focused?.closest?.("#play-pile [data-uid]") ? focused.dataset.uid : null;
  update(moveCoin(state, uid, x, y));
  $("play-pile").offsetWidth; // flush styles so the coin lands where released before it glides
  el?.style.removeProperty("transition"); // set by the drop in drag.js
  update(settleCoin(state, uid, from));
  if (focusedUid !== null) $("play-pile").querySelector(`[data-uid="${focusedUid}"]`)?.focus({ preventScroll: true });
}

function moveGroupAndRefocus(uids, dx, dy, leaderUid) {
  const leader = state.pile.find((e) => e.uid === leaderUid);
  if (!leader) return;
  const from = { x: leader.x, y: leader.y };
  const els = uids.map((uid) => $("play-pile").querySelector(`[data-uid="${uid}"]`));
  const focused = document.activeElement;
  const focusedUid = focused?.closest?.("#play-pile [data-uid]") ? focused.dataset.uid : null;
  update(moveGroup(state, uids, dx, dy));
  $("play-pile").offsetWidth; // flush styles so the group lands where released before it glides
  for (const el of els) el?.style.removeProperty("transition"); // set by the drop in drag.js
  update(settleGroupCoins(state, uids, leaderUid, from));
  // the group is re-ordered with replaceChildren, which drops focus, so restore it by uid
  if (focusedUid !== null) $("play-pile").querySelector(`[data-uid="${focusedUid}"]`)?.focus({ preventScroll: true });
}

function onDragStart(el) {
  if (!el.classList.contains("revealed")) dwell.stop(el);
}

function dropFromTray(coinId, x, y) {
  const next = addToPileAt(state, coinId, x, y);
  if (next === state) return;
  update(next);
  $("play-pile").offsetWidth; // flush styles so the coin lands where released before it glides
  update(settleCoin(state, state.pile[state.pile.length - 1].uid, null));
}

renderTray($("play-tray"));
// created before the tray's watchDwell so its listeners run first
trayDrag = createTrayDrag($("play-tray"), {
  onDrop: dropFromTray, onDragStart, isLocked: () => state.solved, pileEl: $("play-pile"),
});
watchDwell($("play-tray"));
// created before the pile's watchDwell so its listeners run first
drag = createDrag($("play-pile"), {
  holdMs: timing.detachHoldMs,
  onMove: moveAndRefocus,
  onMoveGroup: moveGroupAndRefocus,
  getGroup: (uid) => unitUids(state.pile, uid),
  onDragStart,
  isLocked: () => state.solved,
  onDetach: (uid) => {
    detachedUid = uid;
    showStackBadges($("play-pile"), state.pile, uid);
  },
  onDetachEnd: () => {
    detachedUid = null;
    showStackBadges($("play-pile"), state.pile, null);
  },
  onDetachRelease: (uid) => {
    const entry = state.pile.find((e) => e.uid === uid);
    if (!entry || state.solved) return;
    const { x, y } = detachNudge(entry);
    moveAndRefocus(uid, x, y);
  },
});
watchDwell($("play-pile"));

document.querySelector(".difficulty").addEventListener("change", (e) => {
  update(setDifficulty(state, e.target.value));
});

// Hold, hover or focus a difficulty label to read what it means, without choosing it.
function watchDifficultyNotes(fieldset) {
  const note = $("difficulty-note");
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
}
watchDifficultyNotes(document.querySelector(".difficulty"));

$("play-tray").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-coin]");
  if (btn && !takeSwallow($("play-tray"), btn.dataset.coin)) addCoin(btn.dataset.coin);
});
$("play-pile").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-uid]");
  if (btn && !takeSwallow($("play-pile"), btn.dataset.uid)) removeCoin(btn.dataset.uid);
});
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
$("play-pile").addEventListener("keydown", (e) => {
  const dir = ARROWS[e.key];
  const btn = e.target.closest?.("[data-uid]");
  if (!dir || !btn || e.ctrlKey || e.altKey || e.metaKey) return;
  if (drag.active()) return;
  e.preventDefault();
  const entry = state.pile.find((p) => p.uid === Number(btn.dataset.uid));
  if (!entry) return;
  const step = e.shiftKey ? 0.1 : 0.02;
  moveAndRefocus(entry.uid, entry.x + dir[0] * step, entry.y + dir[1] * step);
});
$("btn-clear").addEventListener("click", () => update(clearPile(state)));

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
function runCheck() {
  if (state.mode === "cashier") { checkCashier(); return; }
  update(submitCheck(state, performance.now()));
  if (state.solved) document.querySelector(".actions button:not([hidden])").focus();
}
$("btn-check").addEventListener("click", runCheck);
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
  } else {
    beginRound(nextRound(state, randomTarget(state.target)));
  }
});
$("btn-again").addEventListener("click", () => {
  if (canAdvance(state, performance.now(), timing.advanceDelayMs)) beginRound(nextRound(state, state.target));
});
$("btn-cashier").addEventListener("click", () => {
  resetPileDom();
  update(startCashier(state));
  resetCashierInput();
  showScreen("play");
});
$("btn-endless").addEventListener("click", () => {
  update(startGame(state, "endless", randomTarget()));
  showScreen("play");
});

function openCustom(prefill) {
  const input = $("custom-input");
  input.value = prefill;
  input.removeAttribute("aria-invalid");
  announce($("custom-error"), "");
  showScreen("custom");
  input.focus();
}

$("btn-custom").addEventListener("click", () => openCustom(""));
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
