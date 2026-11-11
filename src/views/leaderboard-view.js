import { BOARD_MODES, BOARD_PRESETS, boardId } from "../services/scores.js";
import { MODES } from "../constants/modes.js";
import { PRESETS } from "../constants/options.js";

const CLEAR_LABEL = "Clear scores";
const ARMED_LABEL = "Press again to clear all scores";

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function el(tag, props = {}, ...kids) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...kids);
  return node;
}

function radio(name, item) {
  const input = el("input", { type: "radio", name, value: item.id, autocomplete: "off" });
  return el("label", {}, input, item.label);
}

// Draws the leaderboard screen: a Game and a Difficulty selector, the top-10 table for that pair, and a
// two-press Clear scores button. show() picks the board and highlights a 1-based row (the player's new score).
export function mountLeaderboard(els, { store, onBack }) {
  const modes = MODES.filter((m) => BOARD_MODES.includes(m.id));
  const presets = PRESETS.filter((p) => BOARD_PRESETS.includes(p.id));
  const table = els.list.closest("table");
  let highlight = 0;
  let armed = false;

  els.mode.append(...modes.map((m) => radio("lb-mode", m)));
  els.preset.append(...presets.map((p) => radio("lb-preset", p)));

  const chosen = (group) => group.querySelector("input:checked")?.value;

  function disarm() {
    armed = false;
    els.clear.textContent = CLEAR_LABEL;
  }

  function render() {
    const mode = chosen(els.mode);
    const preset = chosen(els.preset);
    const entries = store.list(boardId(mode, preset));
    els.caption.textContent = `${modes.find((m) => m.id === mode).label}, ${presets.find((p) => p.id === preset).label}: top 10`;
    els.list.replaceChildren(...entries.map((e, i) => {
      const row = el("tr", {}, el("td", {}, String(i + 1)), el("td", {}, String(e.score)), el("td", {}, String(e.served)), el("td", {}, formatDate(e.at)));
      if (i + 1 === highlight) row.setAttribute("aria-current", "true");
      return row;
    }));
    if (table) table.hidden = entries.length === 0;
    els.empty.hidden = entries.length > 0;
  }

  function change() {
    highlight = 0;
    disarm();
    render();
  }

  els.mode.addEventListener("change", change);
  els.preset.addEventListener("change", change);
  els.back.addEventListener("click", () => onBack());
  els.clear.addEventListener("blur", disarm);
  els.clear.addEventListener("click", () => {
    if (!armed) {
      armed = true;
      els.clear.textContent = ARMED_LABEL;
      return;
    }
    store.clear();
    disarm();
    render();
  });
  disarm();

  return {
    show(mode, preset, row = 0) {
      els.mode.querySelector(`input[value="${mode}"]`).checked = true;
      els.preset.querySelector(`input[value="${preset}"]`).checked = true;
      disarm();
      highlight = row;
      render();
    },
  };
}
