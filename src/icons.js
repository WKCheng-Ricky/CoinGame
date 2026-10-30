const SVG_NS = "http://www.w3.org/2000/svg";

// Each icon is a list of shapes in a 24-unit box. Option and button icons are drawn as strokes in currentColor
// (the .ico rule in styles.css); the three badge arrows are filled.
const path = (d) => ["path", { d }];
const SHAPES = {
  eye: [path("M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"), ["circle", { cx: 12, cy: 12, r: 3 }]],
  enlarge: [path("M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6")],
  layers: [path("M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5")],
  "coin-down": [["circle", { cx: 12, cy: 12, r: 9 }], path("M12 7v10M8 13l4 4 4-4")],
  stopwatch: [["circle", { cx: 12, cy: 13, r: 8 }], path("M12 13V9M9 2h6M12 2v3")],
  hourglass: [path("M6 3h12M6 21h12M7 3c0 6 5 6 5 9s-5 3-5 9M17 3c0 6-5 6-5 9s5 3 5 9")],
  gear: [["circle", { cx: 12, cy: 12, r: 3 }], path("M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1")],
  easier: [path("M12 5l7 9H5z")], // up arrow
  harder: [path("M12 19l7-9H5z")], // down arrow
  neutral: [path("M5 10h14v4H5z")], // level bar
};
const FILLED = ["easier", "harder", "neutral"];

export const ICON_NAMES = Object.keys(SHAPES);

// A decorative inline icon: the words next to it carry the meaning.
export function icon(name, size = 24) {
  const shapes = SHAPES[name];
  if (!shapes) throw new Error(`Unknown icon: ${name}`);
  const svg = document.createElementNS(SVG_NS, "svg");
  const attrs = {
    viewBox: "0 0 24 24", width: size, height: size, class: FILLED.includes(name) ? "ico ico-fill" : "ico",
    "aria-hidden": "true", focusable: "false",
  };
  for (const [key, value] of Object.entries(attrs)) svg.setAttribute(key, value);
  for (const [tag, shape] of shapes) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(shape)) node.setAttribute(key, value);
    if (FILLED.includes(name)) node.setAttribute("fill", "currentColor");
    svg.append(node);
  }
  return svg;
}

// The Easier / Harder / Neutral badge: arrow icon plus the word.
export function badge(effect) {
  const node = document.createElement("span");
  node.className = `badge badge-${effect}`;
  node.append(icon(effect, 14), effect[0].toUpperCase() + effect.slice(1));
  return node;
}
