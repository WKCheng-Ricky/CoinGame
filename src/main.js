import { describePile, formatPence, parseAmount, randomTarget, total } from "./game.js";
import { createDwell } from "./dwell.js";
import { announce, renderPile, renderTray, setText } from "./render.js";
import {
  addToPile, canAdvance, clearPile, createState, nextRound,
  removeFromPile, setDifficulty, startGame, submitCheck,
} from "./state.js";

const $ = (id) => document.getElementById(id);
const SCREENS = ["home", "custom", "play"];

let state = createState();
let shownMessage = state.message;
let shownPile;

const dwell = createDwell({
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
    const key = coin.dataset.uid ?? coin.dataset.coin;
    swallow = { id: key, container };
    setTimeout(() => { if (swallow?.id === key) swallow = null; }, 500);
    (container === $("play-tray") ? addCoin : removeCoin)(key);
  });
}

let swallow = null;
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
  target.focus({ preventScroll: true });
}

function showScreen(name) {
  dwell.cancelAll();
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  $(`screen-${name}`).querySelector("h1").focus();
}

function render() {
  const endless = state.mode === "endless";
  setText($("play-target"), formatPence(state.target));
  if (state.pile !== shownPile) {
    renderPile($("play-pile"), state.pile);
    setText($("play-pile-summary"), describePile(state.pile));
    shownPile = state.pile;
    // drop dwells on removed pile coins (untouched pile and tray coins keep theirs)
    dwell.prune((el) => el.isConnected);
  }
  document.querySelector(".board").dataset.difficulty = state.difficulty;
  setText($("play-total"), `Your total: ${formatPence(total(state.pile))}`);
  // each submitCheck makes a new message object, so a repeated hint is announced again
  if (state.message !== shownMessage) {
    shownMessage = state.message;
    announce($("play-message"), state.message.text);
  }
  $("play-message").className = `message ${state.message.kind}`.trim();
  $("play-rounds").hidden = !endless;
  setText($("play-rounds"), `Rounds completed: ${state.rounds}`);
  $("btn-check").hidden = state.solved;
  $("btn-clear").hidden = state.solved;
  $("btn-next").hidden = !(state.solved && endless);
  $("btn-again").hidden = !(state.solved && !endless);
  $("btn-change").hidden = !(state.solved && !endless);

  document.querySelector(".board").classList.toggle("locked", state.solved);
  for (const btn of document.querySelectorAll(".coin, .pile-coin")) {
    if (state.solved) btn.setAttribute("aria-disabled", "true");
    else btn.removeAttribute("aria-disabled");
  }
}

function update(next) {
  state = next;
  render();
}

function beginRound(next) {
  update(next);
  $("play-heading").focus();
}

renderTray($("play-tray"));
watchDwell($("play-tray"));
watchDwell($("play-pile"));

document.querySelector(".difficulty").addEventListener("change", (e) => {
  update(setDifficulty(state, e.target.value));
});

$("play-tray").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-coin]");
  if (btn && !takeSwallow($("play-tray"), btn.dataset.coin)) addCoin(btn.dataset.coin);
});
$("play-pile").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-uid]");
  if (btn && !takeSwallow($("play-pile"), btn.dataset.uid)) removeCoin(btn.dataset.uid);
});
$("btn-clear").addEventListener("click", () => update(clearPile(state)));
$("btn-check").addEventListener("click", () => {
  update(submitCheck(state, performance.now()));
  if (state.solved) document.querySelector(".actions button:not([hidden])").focus();
});
$("btn-next").addEventListener("click", () => {
  if (canAdvance(state, performance.now())) beginRound(nextRound(state, randomTarget(state.target)));
});
$("btn-again").addEventListener("click", () => {
  if (canAdvance(state, performance.now())) beginRound(nextRound(state, state.target));
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
