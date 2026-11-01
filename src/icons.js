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
  gear: [path("M10.3 4.7L10.6 2.1L13.4 2.1L13.7 4.7L16.0 5.6L18.0 4.0L20.0 6.0L18.4 8.0L19.3 10.3L21.9 10.6L21.9 13.4L19.3 13.7L18.4 16.0L20.0 18.0L18.0 20.0L16.0 18.4L13.7 19.3L13.4 21.9L10.6 21.9L10.3 19.3L8.0 18.4L6.0 20.0L4.0 18.0L5.6 16.0L4.7 13.7L2.1 13.4L2.1 10.6L4.7 10.3L5.6 8.0L4.0 6.0L6.0 4.0L8.0 5.6Z"), ["circle", { cx: 12, cy: 12, r: 3 }]], // 8-tooth cogwheel
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
