import { optionsFor } from "./options.js";

export const MODES = [
  { id: "endless", label: "Endless", blurb: "Random amounts, nonstop" },
  { id: "custom", label: "Custom", blurb: "Choose your own amount" },
  { id: "cashier", label: "Cashier", blurb: "Count the customer's coins" },
  { id: "give-change", label: "Give Change", blurb: "Work out the change" },
];

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function modeRow(m) {
  const input = el("input", { type: "radio", name: "mode", value: m.id, autocomplete: "off" });
  input.setAttribute("aria-describedby", `mode-blurb-${m.id}`);
  return el("label", { className: "mode" }, input, el("b", {}, m.label), el("small", { id: `mode-blurb-${m.id}` }, m.blurb));
}

function optionRows(o) {
  const input = el("input", { type: "checkbox", autocomplete: "off" });
  input.dataset.option = o.id;
  input.setAttribute("aria-describedby", `option-help-${o.id}`);
  return [
    el("label", { title: o.hint }, input, ` ${o.label}`),
    el("span", { className: "sr-only", id: `option-help-${o.id}` }, o.hint),
  ];
}

// Draws the mode rows and the options list into `els` and reports changes through `handlers`.
// The options list is rebuilt only when the mode changes, so toggling a checkbox keeps its focus.
export function mountHome(els, { onMode, onOption, onPlay }) {
  let shownMode;
  let mode;
  els.modes.addEventListener("change", (e) => onMode(e.target.value));
  els.options.addEventListener("change", (e) => onOption(e.target.dataset.option, e.target.checked));
  els.play.addEventListener("click", () => onPlay(mode));

  function update(nextMode, options) {
    mode = nextMode;
    if (!els.modes.firstChild) els.modes.append(...MODES.map(modeRow));
    for (const r of els.modes.querySelectorAll("input")) r.checked = r.value === mode;
    if (mode !== shownMode) {
      els.options.replaceChildren(...optionsFor(mode).flatMap(optionRows));
      shownMode = mode;
    }
    for (const box of els.options.querySelectorAll("input")) box.checked = options[box.dataset.option];
  }

  return { update };
}
