import { badge, icon } from "./icons.js";
import { PRESETS, isForcedOn, optionsFor, presetOf } from "./options.js";

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

function choiceRows(o) {
  const labelId = `option-label-${o.id}`;
  const group = el("div", { className: "radios" });
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-labelledby", labelId);
  group.setAttribute("aria-describedby", `option-help-${o.id}`);
  for (const c of o.choices) {
    const input = el("input", { type: "radio", name: `opt-${o.id}`, value: String(c.value), autocomplete: "off" });
    input.dataset.option = o.id;
    group.append(el("label", { title: o.hint }, input, el("span", { className: "opt-text" }, c.label)));
  }
  return [
    el("div", { className: "opt-head" }, el("span", { className: "opt-text", id: labelId }, icon(o.icon, 18), o.label), badge(o.effect)),
    group,
    el("small", { className: "why", id: `option-help-${o.id}` }, o.why),
  ];
}

function optionRows(o) {
  if (o.choices) return choiceRows(o);
  const input = el("input", { type: "checkbox", autocomplete: "off" });
  input.dataset.option = o.id;
  input.setAttribute("aria-describedby", `option-help-${o.id}`);
  return [
    el("label", { title: o.hint }, input, el("span", { className: "opt-text" }, icon(o.icon, 18), o.label), badge(o.effect)),
    el("small", { className: "why", id: `option-help-${o.id}` }, o.why),
  ];
}

function presetRow(p) {
  const input = el("input", { type: "radio", name: "preset", value: p.id, autocomplete: "off" });
  return el("label", {}, input, p.label);
}

// A chip for each option that is on. Large Coins has none: the Larger coins button shows it.
function chipFor(o, options) {
  const text = o.choices ? `${o.chip} ${o.choices.find((c) => c.value === options[o.id]).label}` : o.chip;
  return el("li", {}, icon(o.icon, 16), text);
}

function activeChips(mode, options) {
  const on = (o) => (o.choices ? options[o.id] > 0 : isForcedOn(o.id, options) || options[o.id]);
  const chips = optionsFor(mode).filter((o) => o.id !== "largeCoins" && on(o)).map((o) => chipFor(o, options));
  return chips.length ? chips : [el("li", { className: "none" }, "No options on")];
}

// Draws the home screen's mode rows, Difficulty selector, Larger coins button and option chips, and the option
// list, into `els`, and reports changes through `handlers`. The option list is rebuilt only when the mode
// changes, so toggling a checkbox keeps its focus.
export function mountHome(els, { onMode, onOption, onPreset, onPlay }) {
  let shownMode;
  let mode;
  let largeCoins = false;
  const presetNote = els.presets.nextElementSibling;
  els.presets.setAttribute("role", "radiogroup");
  els.presets.setAttribute("aria-label", "Difficulty");
  els.presets.append(...PRESETS.map(presetRow));
  const largeState = el("span", { className: "state" });
  els.large.setAttribute("aria-pressed", "false");
  els.large.append(icon("enlarge", 20), el("b", {}, "Larger coins"), largeState);
  els.chips.setAttribute("role", "list");
  els.chips.setAttribute("aria-label", "Options on");

  els.modes.addEventListener("change", (e) => onMode(e.target.value));
  els.presets.addEventListener("change", (e) => onPreset(e.target.value));
  els.large.addEventListener("click", () => onOption("largeCoins", !largeCoins));
  els.options.addEventListener("change", (e) => {
    const t = e.target;
    onOption(t.dataset.option, t.type === "radio" ? Number(t.value) : t.checked);
  });
  els.play.addEventListener("click", () => onPlay(mode));

  function update(nextMode, options) {
    mode = nextMode;
    if (!els.modes.firstChild) els.modes.append(...MODES.map(modeRow));
    for (const r of els.modes.querySelectorAll("input")) r.checked = r.value === mode;
    const preset = presetOf(options);
    for (const r of els.presets.querySelectorAll("input")) r.checked = r.value === preset;
    presetNote.textContent = preset ? "" : "Custom settings";
    largeCoins = options.largeCoins;
    els.large.setAttribute("aria-pressed", String(largeCoins));
    largeState.textContent = largeCoins ? "On" : "Off";
    els.chips.replaceChildren(...activeChips(mode, options));
    els.optionsFor.textContent = `Options for ${MODES.find((m) => m.id === mode).label}`;
    if (mode !== shownMode) {
      els.options.replaceChildren(...optionsFor(mode).flatMap(optionRows));
      shownMode = mode;
    }
    for (const input of els.options.querySelectorAll("input")) {
      const id = input.dataset.option;
      if (input.type === "radio") {
        input.checked = input.value === String(options[id]);
      } else {
        input.disabled = isForcedOn(id, options);
        input.checked = input.disabled || options[id];
      }
    }
  }

  return { update };
}
