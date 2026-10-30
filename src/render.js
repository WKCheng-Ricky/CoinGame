import { COINS } from "./coins.js";
import { arcLetters, fitFont, polygonPoints, reuleauxPath, shapeRadiusAt } from "./shapes.js";
import { PILE_HEIGHT_MM, PILE_MARGIN_MM, PILE_WIDTH_MM, pileBox, stackCounts } from "./game.js";


// Layout of one face, in viewBox units (the body is 92 wide, its rim line 70 wide).
const BODY_WIDTH = 92;
const BODY_STROKE = 3;
const RIM_WIDTH = 70;
const RIM_STROKE = 1;
const MIN_WORD_SIZE = 3.5;
const MAX_WORD_SIZE = 8.5;
const WORD_SPAN = 72; // degrees the wording covers
const CAP_HEIGHT = 0.72; // capital height as a fraction of the font size
// Room left in the band besides the capitals. The wording is set in the bundled CoinLetters font (see styles.css),
// but if that fails to load a system font takes over, and these differ in cap height and ink position (DejaVu Sans
// puts the £1 ink 0.4 closer to the rim line than Noto Sans), so this has to cover them too.
const BAND_SLACK = 2.2;
// With dominant-baseline="central" the capitals' ink centre is not on the text's radius: measured in
// Chromium at 8 units it sits 0.2 inward for outer letters and 0.3 outward for upright ones (as a fraction
// of the font size, in the direction away from the coin centre).
const INK_SHIFT = { outer: -0.026, upright: 0.037 };
const GLYPH_HALF_WIDTH = 0.4; // half a letter's width as a fraction of the font size
const SHINE_RADIUS = 35;
const STRAIGHT_LENGTH = 66; // width of the 5p's straight wording
const STRAIGHT_SIZE = 9;

const deg = (rad) => (rad * 180) / Math.PI;

// Wording radius and font for an arc coin. The band is the room between the rim line's outer edge and the
// body's inner edge over the angles the text covers (measured on the real outline: circle, Reuleaux
// heptagon or 12-gon). The letters are centred in it, and the font is the one that spans WORD_SPAN
// degrees, limited by the band so the capitals leave a little room to both lines. The span depends on the
// radius and the band on the span, so it is settled in a few rounds.
const layouts = new Map();
export function faceLayout(coin) {
  if (layouts.has(coin.id)) return layouts.get(coin.id);
  const { text, at = 0, flow } = coin.wording;
  let layout;
  if (flow === "straight") {
    layout = {};
  } else {
    let radius = 40, font = MAX_WORD_SIZE;
    for (let round = 0; round < 6; round++) {
      font = fitFont(text, radius, WORD_SPAN, MAX_WORD_SIZE);
      const angles = arcLetters(text, radius, font, at, flow).map((l) => l.angle);
      const reach = deg((GLYPH_HALF_WIDTH * font) / radius);
      let inner = 0, outer = Infinity;
      for (let a = Math.min(...angles) - reach; a <= Math.max(...angles) + reach + 1e-9; a += 1) {
        inner = Math.max(inner, shapeRadiusAt(coin.shape, RIM_WIDTH, a) + RIM_STROKE / 2);
        outer = Math.min(outer, shapeRadiusAt(coin.shape, BODY_WIDTH, a) - BODY_STROKE / 2);
      }
      radius = (inner + outer) / 2 - INK_SHIFT[flow] * font; // centre the real ink, not the text anchor
      font = Math.max(MIN_WORD_SIZE, Math.min(fitFont(text, radius, WORD_SPAN, MAX_WORD_SIZE), (outer - inner - BAND_SLACK) / CAP_HEIGHT));
    }
    layout = { radius, font };
  }
  layouts.set(coin.id, layout);
  return layout;
}

// `cls` may include a metal-<name> class, which CSS turns into the fill (SVG attributes cannot use var()).
function outlineShape(coin, cls, width, hasFill, strokeWidth, extra = "") {
  const attrs = `class="${cls}"${hasFill ? "" : ' fill="none"'} stroke-width="${strokeWidth}"${extra}`;
  if (coin.shape === "heptagon") return `<path ${attrs} d="${reuleauxPath(7, width)}"/>`;
  if (coin.shape === "dodecagon") return `<polygon ${attrs} points="${polygonPoints(12, width / 2)}"/>`;
  return `<circle ${attrs} cx="50" cy="50" r="${width / 2}"/>`;
}

function shineArc(radius) {
  const point = (angle) => {
    const a = ((angle - 90) * Math.PI) / 180;
    return `${(50 + radius * Math.cos(a)).toFixed(2)},${(50 + radius * Math.sin(a)).toFixed(2)}`;
  };
  return `M${point(-75)} A${radius},${radius} 0 0 1 ${point(-30)}`;
}

const WORD_ATTRS = 'text-anchor="middle" dominant-baseline="central" font-family="CoinLetters, system-ui, sans-serif" font-weight="600"';
// W and M are wider than the 0.7 em a letter gets along the arc, so they are squeezed to fit their slot.
const WIDE_LETTERS = "WM";

// Arc coins: one <text> per letter, set on a circle and turned to follow it (no textPath, no ids).
// Upright letters start at the bottom and carry an extra half turn, so their tops face the centre.
function wordingLetters(coin, { radius, font }) {
  const { text, at, flow } = coin.wording;
  if (flow === "straight") {
    return `<text class="coin-word" x="50" y="50" ${WORD_ATTRS} textLength="${STRAIGHT_LENGTH}" lengthAdjust="spacing" font-size="${STRAIGHT_SIZE}">${text}</text>`;
  }
  const upright = flow === "upright";
  const y = upright ? 50 + radius : 50 - radius;
  return arcLetters(text, radius, font, at, flow).map(({ char, angle }) =>
    `<text class="coin-word" x="50" y="${y.toFixed(2)}" ${WORD_ATTRS} transform="rotate(${(upright ? angle + 180 : angle).toFixed(2)} 50 50)" font-size="${font.toFixed(2)}"${WIDE_LETTERS.includes(char) ? ` textLength="${(0.8 * font).toFixed(2)}" lengthAdjust="spacingAndGlyphs"` : ""}>${char}</text>`).join("");
}

// Layers, outside in: body, rim line, shine, inner disc (two-metal coins), wording, numeral.
export function coinSvg(coin) {
  const layout = faceLayout(coin);
  const body = outlineShape(coin, `coin-body coin-edge metal-${coin.metal}`, BODY_WIDTH, true, BODY_STROKE);
  const rim = outlineShape(coin, "coin-rim", RIM_WIDTH, false, RIM_STROKE, ` stroke="${coin.shade.dark}"`);
  // keep the highlight inside the rim line
  let shineRadius = SHINE_RADIUS;
  for (let angle = -75; angle <= -30; angle += 5) {
    shineRadius = Math.min(shineRadius, shapeRadiusAt(coin.shape, RIM_WIDTH, angle) - 2.5);
  }
  const shine = `<path class="coin-shine" d="${shineArc(shineRadius)}" fill="none" stroke="${coin.shade.light}" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>`;
  const disc = coin.discMetal
    ? `<circle class="coin-disc coin-edge metal-${coin.discMetal}" cx="50" cy="50" r="31" stroke-width="2"/>`
    : "";
  const size = coin.numeralSize ?? (coin.label.length > 2 ? 28 : 34);
  const labelY = coin.numeralY ?? 50;
  // The pile counter-rotates the label about its own centre. The pivot is given in viewBox units because
  // transform-box: fill-box is unreliable on SVG <text> in WebKit (labels swung off the coin on iOS).
  const label = `<text class="coin-label" x="50" y="${labelY}" style="transform-origin: 50px ${labelY}px" text-anchor="middle" dominant-baseline="central" font-family="CoinLetters, system-ui, sans-serif" font-weight="700" font-size="${size}">${coin.label}</text>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${body}${rim}${shine}${disc}${wordingLetters(coin, layout)}${label}</svg>`;
}

function placeCoin(btn, entry, heightMm) {
  const { left, top } = pileBox(entry, heightMm);
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

export function renderPile(container, pile, excludeUid = null, removable = true, heightMm = PILE_HEIGHT_MM) {
  container.style.setProperty("--pile-w-mm", PILE_WIDTH_MM + 2 * PILE_MARGIN_MM);
  container.style.setProperty("--pile-h-mm", heightMm + 2 * PILE_MARGIN_MM);
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
      placeCoin(btn, entry, heightMm);
      btn.addEventListener("animationend", () => btn.classList.remove("settle"), { once: true });
      container.append(btn);
    } else {
      btn.setAttribute("aria-label", coinLabel(COINS.find((c) => c.id === entry.coinId), removable));
      placeCoin(btn, entry, heightMm);
    }
    return btn;
  });
  if (ordered.some((el, i) => container.children[i] !== el)) container.replaceChildren(...ordered);
  showStackBadges(container, pile, excludeUid, heightMm);
}

// excludeUid (a detached coin) does not count: it gets no badge and its former stack shows the reduced count
export function showStackBadges(container, pile, excludeUid = null, heightMm = PILE_HEIGHT_MM) {
  const counts = stackCounts(excludeUid === null ? pile : pile.filter((e) => e.uid !== excludeUid), heightMm);
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
