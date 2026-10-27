import { COINS } from "./coins.js";

const SIDES = { heptagon: 7, dodecagon: 12 };
const STROKE = "#00000055";

function polygonPoints(sides, radius) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i) / sides - Math.PI / 2;
    pts.push(`${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return pts.join(" ");
}

export function coinSvg(coin) {
  const sides = SIDES[coin.shape];
  const outline = sides
    ? `<polygon points="${polygonPoints(sides, 46)}" fill="${coin.fill}" stroke="${STROKE}" stroke-width="3"/>`
    : `<circle cx="50" cy="50" r="46" fill="${coin.fill}" stroke="${STROKE}" stroke-width="3"/>`;
  const inner = coin.ring
    ? `<circle cx="50" cy="50" r="31" fill="${coin.ring}" stroke="${STROKE}" stroke-width="2"/>`
    : "";
  const size = coin.label.length > 2 ? 28 : 34;
  const label = `<text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-weight="700" font-size="${size}" fill="#222">${coin.label}</text>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${outline}${inner}${label}</svg>`;
}

function coinButton(coin, className, ariaLabel, extraHtml = "") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.dataset.coin = coin.id;
  btn.setAttribute("aria-label", ariaLabel);
  btn.style.setProperty("--d", coin.diameter);
  btn.innerHTML = coinSvg(coin) + extraHtml;
  return btn;
}

export function renderTray(container) {
  container.replaceChildren(...COINS.map((coin) => coinButton(coin, "coin", `Add ${coin.label}`)));
}

export function renderPile(container, pile) {
  container.replaceChildren(
    ...COINS.filter((coin) => pile[coin.id]).map((coin) =>
      coinButton(
        coin,
        "stack",
        `Remove one ${coin.label} (${pile[coin.id]} in pile)`,
        `<span class="badge">×${pile[coin.id]}</span>`,
      ),
    ),
  );
}

export function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

// Clearing then re-setting makes screen readers announce a repeated message again.
const pending = new Map();
export function announce(el, text) {
  clearTimeout(pending.get(el));
  el.textContent = "";
  if (!text) return;
  pending.set(el, setTimeout(() => { el.textContent = text; }, 50));
}
