import { COINS } from "./coins.js";
import { PILE_HEIGHT_MM, PILE_MARGIN_MM, PILE_WIDTH_MM, pileBox } from "./game.js";

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
  const label = `<text class="coin-label" x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-weight="700" font-size="${size}" fill="#222">${coin.label}</text>`;
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
  container.style.setProperty("--pile-w-mm", PILE_WIDTH_MM + 2 * PILE_MARGIN_MM);
  container.style.setProperty("--pile-h-mm", PILE_HEIGHT_MM + 2 * PILE_MARGIN_MM);
  const existing = new Map([...container.children].map((el) => [el.dataset.uid, el]));
  const live = new Set(pile.map((e) => String(e.uid)));
  for (const [uid, el] of existing) {
    if (!live.has(uid)) { el.remove(); existing.delete(uid); }
  }
  const ordered = pile.map((entry) => {
    const key = String(entry.uid);
    let btn = existing.get(key);
    if (!btn) {
      const coin = COINS.find((c) => c.id === entry.coinId);
      btn = coinButton(coin, "pile-coin settle", `Remove ${coin.label}`);
      const { left, top } = pileBox(entry);
      btn.dataset.uid = key;
      btn.style.left = `${left}%`;
      btn.style.top = `${top}%`;
      btn.style.setProperty("--rot", `${entry.rot}deg`);
      container.append(btn);
    }
    return btn;
  });
  if (ordered.some((el, i) => container.children[i] !== el)) container.replaceChildren(...ordered);
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
