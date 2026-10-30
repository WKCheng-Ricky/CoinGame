import { isForcedOn, optionsFor } from "./options.js";

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

const SVG_NS = "http://www.w3.org/2000/svg";
const BADGE_ICONS = {
  easier: "M12 5l7 9H5z", // up arrow
  harder: "M12 19l7-9H5z", // down arrow
  neutral: "M5 10h14v4H5z", // level bar
};

function badge(effect) {
  const icon = document.createElementNS(SVG_NS, "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "14");
  icon.setAttribute("height", "14");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", BADGE_ICONS[effect]);
  path.setAttribute("fill", "currentColor");
  icon.append(path);
  return el("span", { className: `badge badge-${effect}` }, icon, effect[0].toUpperCase() + effect.slice(1));
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
    el("div", { className: "opt-head" }, el("span", { className: "opt-text", id: labelId }, o.label), badge(o.effect)),
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
    el("label", { title: o.hint }, input, el("span", { className: "opt-text" }, o.label), badge(o.effect)),
    el("small", { className: "why", id: `option-help-${o.id}` }, o.why),
  ];
}

// Draws the mode rows and the options list into `els` and reports changes through `handlers`.
// The options list is rebuilt only when the mode changes, so toggling a checkbox keeps its focus.
export function mountHome(els, { onMode, onOption, onPlay }) {
  let shownMode;
  let mode;
  els.modes.addEventListener("change", (e) => onMode(e.target.value));
  els.options.addEventListener("change", (e) => {
    const t = e.target;
    onOption(t.dataset.option, t.type === "radio" ? Number(t.value) : t.checked);
  });
  els.play.addEventListener("click", () => onPlay(mode));

  function update(nextMode, options) {
    mode = nextMode;
    if (!els.modes.firstChild) els.modes.append(...MODES.map(modeRow));
    for (const r of els.modes.querySelectorAll("input")) r.checked = r.value === mode;
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
