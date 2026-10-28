import { COINS } from "./coins.js";
import { arcLetters, polygonPoints, reuleauxPath } from "./shapes.js";
import { PILE_HEIGHT_MM, PILE_MARGIN_MM, PILE_WIDTH_MM, pileBox, stackCounts } from "./game.js";


// Layout of one face, in viewBox units (a round coin's body is 92 wide, its rim line 78 wide).
const BODY_WIDTH = 92;
const RIM_WIDTH = 78;
const WORD_RADIUS = 40.6; // baseline radius of the wording, just outside the rim line
const WORD_SIZE = 4.6;
const SHINE_RADIUS = 35;

function outlineShape(coin, cls, width, fill, strokeWidth, extra = "") {
  const attrs = `class="${cls}" ${fill ? `fill="${fill}"` : 'fill="none"'} stroke-width="${strokeWidth}"${extra}`;
  if (coin.shape === "heptagon") return `<path ${attrs} d="${reuleauxPath(7, width)}"/>`;
  if (coin.shape === "dodecagon") return `<polygon ${attrs} points="${polygonPoints(12, width / 2)}"/>`;
  return `<circle ${attrs} cx="50" cy="50" r="${width / 2}"/>`;
}

function shineArc() {
  const point = (deg) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(50 + SHINE_RADIUS * Math.cos(a)).toFixed(2)},${(50 + SHINE_RADIUS * Math.sin(a)).toFixed(2)}`;
  };
  return `M${point(-75)} A${SHINE_RADIUS},${SHINE_RADIUS} 0 0 1 ${point(-30)}`;
}

function wordingLetters(coin) {
  return arcLetters(coin.wording, WORD_RADIUS, WORD_SIZE).map(({ char, angle }) =>
    `<text class="coin-word" x="50" y="${(50 - WORD_RADIUS).toFixed(2)}" text-anchor="middle" transform="rotate(${angle.toFixed(2)} 50 50)" font-family="system-ui, sans-serif" font-weight="700" font-size="${WORD_SIZE}" fill="#222">${char}</text>`).join("");
}

// Layers, outside in: body, rim line, shine, inner disc (two-metal coins), wording, numeral.
export function coinSvg(coin) {
  const body = outlineShape(coin, "coin-body coin-edge", BODY_WIDTH, coin.fill, 3);
  const rim = outlineShape(coin, "coin-rim", RIM_WIDTH, null, 1, ` stroke="${coin.shade.dark}"`);
  const shine = `<path class="coin-shine" d="${shineArc()}" fill="none" stroke="${coin.shade.light}" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>`;
  const disc = coin.ring
    ? `<circle class="coin-disc coin-edge" cx="50" cy="50" r="31" fill="${coin.ring}" stroke-width="2"/>`
    : "";
  const size = coin.label.length > 2 ? 28 : 34;
  const label = `<text class="coin-label" x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-weight="700" font-size="${size}" fill="#222">${coin.label}</text>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${body}${rim}${shine}${disc}${wordingLetters(coin)}${label}</svg>`;
}

function placeCoin(btn, entry) {
  const { left, top } = pileBox(entry);
  const l = `${left}%`, t = `${top}%`, r = `${entry.rot}deg`;
  if (btn.style.left !== l) btn.style.left = l;
  if (btn.style.top !== t) btn.style.top = t;
  if (btn.style.getPropertyValue("--rot") !== r) btn.style.setProperty("--rot", r);
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

export function coinLabel(coin, removable) {
  return removable ? `Remove ${coin.label}` : `${coin.label} coin`;
}

export function renderPile(container, pile, excludeUid = null, removable = true) {
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
    // uids restart per deal, so a reused uid may now hold a different coin: rebuild it
    if (btn && btn.dataset.coin !== entry.coinId) { btn.remove(); btn = undefined; }
    if (!btn) {
      const coin = COINS.find((c) => c.id === entry.coinId);
      btn = coinButton(coin, "pile-coin settle", coinLabel(coin, removable));
      btn.setAttribute("aria-description", "Use arrow keys to move");
      btn.dataset.uid = key;
      placeCoin(btn, entry);
      btn.addEventListener("animationend", () => btn.classList.remove("settle"), { once: true });
      container.append(btn);
    } else {
      btn.setAttribute("aria-label", coinLabel(COINS.find((c) => c.id === entry.coinId), removable));
      placeCoin(btn, entry);
    }
    return btn;
  });
  if (ordered.some((el, i) => container.children[i] !== el)) container.replaceChildren(...ordered);
  showStackBadges(container, pile, excludeUid);
}

// excludeUid (a detached coin) does not count: it gets no badge and its former stack shows the reduced count
export function showStackBadges(container, pile, excludeUid = null) {
  const counts = stackCounts(excludeUid === null ? pile : pile.filter((e) => e.uid !== excludeUid));
  for (const btn of container.children) {
    const uid = Number(btn.dataset.uid);
    updateBadge(btn, uid === excludeUid ? undefined : counts.get(uid));
  }
}

function updateBadge(btn, n) {
  let badge = btn.querySelector(":scope > .stack-badge");
  if (!n) {
    if (badge) badge.remove();
    btn.setAttribute("aria-description", "Use arrow keys to move");
    return;
  }
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "stack-badge";
    badge.setAttribute("aria-hidden", "true");
    btn.append(badge);
  }
  const text = "×" + n;
  if (badge.textContent !== text) badge.textContent = text;
  btn.setAttribute("aria-description", `Stack of ${n}. Use arrow keys to move`);
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
