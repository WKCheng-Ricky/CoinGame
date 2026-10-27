import { formatPence, parseAmount, randomTarget, total } from "./game.js";
import { announce, renderPile, renderTray, setText } from "./render.js";
import {
  addToPile, canAdvance, clearPile, createState, nextRound,
  removeFromPile, startGame, submitCheck,
} from "./state.js";

const $ = (id) => document.getElementById(id);
const SCREENS = ["home", "custom", "play"];

let state = createState();
let shownMessage = state.message;

function showScreen(name) {
  for (const s of SCREENS) $(`screen-${s}`).hidden = s !== name;
  $(`screen-${name}`).querySelector("h1").focus();
}

function render() {
  const endless = state.mode === "endless";
  setText($("play-target"), formatPence(state.target));
  renderPile($("play-pile"), state.pile);
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
  for (const btn of document.querySelectorAll(".coin, .stack")) {
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

$("play-tray").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-coin]");
  if (btn) update(addToPile(state, btn.dataset.coin));
});
$("play-pile").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-coin]");
  if (!btn) return;
  const id = btn.dataset.coin;
  update(removeFromPile(state, id));
  // the pile is re-rendered, so hand focus back to keep keyboard use flowing
  const target = document.querySelector(`#play-pile [data-coin="${id}"]`) ?? $("play-tray").querySelector(`[data-coin="${id}"]`);
  target.focus({ preventScroll: true });
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
