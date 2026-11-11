import { COINS, coinById } from "../constants/coins.js";
import { PILE_MARGIN_MM, PILE_WIDTH_MM, diameterOf, pileBox, pileHeightDefaultMm, pileMarginMm, pileWidthMm, stackCounts } from "../models/pile.js";
import { coinSvg } from "./coin-svg.js";

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
  btn.style.setProperty("--d", diameterOf(coin));
  btn.innerHTML = coinSvg(coin) + extraHtml;
  return btn;
}

export function renderTray(container) {
  container.replaceChildren(...COINS.map((coin) => coinButton(coin, "coin", `Add ${coin.label}`)));
}

export function coinLabel(coin, removable) {
  return removable ? `Remove ${coin.label}` : `${coin.label} coin`;
}

// The draw order that keeps every stack-count badge (bottom right of a coin) visible: coins further right or lower go
// underneath, so the upper-left coin is on top. First is the bottom layer. Both axes are measured in millimetres
// (x by the pile's width, y by its height), because the Give Change boxes are wide and short. Returns a copy.
export function layerOrder(pile, heightMm = pileHeightDefaultMm()) {
  const width = pileWidthMm();
  const depth = (e) => e.x * width + e.y * heightMm;
  return [...pile].sort((a, b) => depth(b) - depth(a) || a.uid - b.uid);
}

export function renderPile(container, pile, excludeUid = null, removable = true, heightMm = pileHeightDefaultMm(), layerByPosition = false) {
  container.style.setProperty("--pile-w-mm", PILE_WIDTH_MM + 2 * PILE_MARGIN_MM); // the box keeps its size at any coin scale
  container.style.setProperty("--pile-h-mm", heightMm + 2 * pileMarginMm());
  const existing = new Map([...container.children].map((el) => [el.dataset.uid, el]));
  const live = new Set(pile.map((e) => String(e.uid)));
  for (const [uid, el] of existing) {
    if (!live.has(uid)) { el.remove(); existing.delete(uid); }
  }
  const ordered = (layerByPosition ? layerOrder(pile, heightMm) : pile).map((entry) => {
    const key = String(entry.uid);
    let btn = existing.get(key);
    // uids restart per deal, so a reused uid may now hold a different coin: rebuild it
    if (btn && btn.dataset.coin !== entry.coinId) { btn.remove(); btn = undefined; }
    if (!btn) {
      const coin = coinById(entry.coinId);
      btn = coinButton(coin, "pile-coin settle", coinLabel(coin, removable && !entry.customer));
      btn.setAttribute("aria-description", "Use arrow keys to move");
      btn.dataset.uid = key;
      placeCoin(btn, entry, heightMm);
      btn.addEventListener("animationend", () => btn.classList.remove("settle"), { once: true });
      container.append(btn);
    } else {
      btn.setAttribute("aria-label", coinLabel(coinById(entry.coinId), removable && !entry.customer));
      placeCoin(btn, entry, heightMm);
    }
    return btn;
  });
  if (ordered.some((el, i) => container.children[i] !== el)) container.replaceChildren(...ordered);
  showStackBadges(container, pile, excludeUid, heightMm);
}

// excludeUid (a detached coin) does not count: it gets no badge and its former stack shows the reduced count
export function showStackBadges(container, pile, excludeUid = null, heightMm = pileHeightDefaultMm()) {
  // the badge goes on the member drawn last (on top of its stack), so measure "last" in the drawn (DOM) order,
  // which layerByPosition makes differ from the pile's order
  const drawn = new Map([...container.children].map((el, i) => [Number(el.dataset.uid), i]));
  const inDrawOrder = [...pile].sort((a, b) => (drawn.get(a.uid) ?? 0) - (drawn.get(b.uid) ?? 0));
  const counts = stackCounts(excludeUid === null ? inDrawOrder : inDrawOrder.filter((e) => e.uid !== excludeUid), heightMm);
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
