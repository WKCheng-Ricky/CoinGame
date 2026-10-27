import { COINS } from "./coins.js";
import { PILE_WIDTH_MM, PILE_HEIGHT_MM, PILE_MARGIN_MM } from "./game.js";

export const DRAG_THRESHOLD_PX = 6;

// The pile box (centre area plus a margin on each side), as laid out by pileBox.
const BOX_W_MM = PILE_WIDTH_MM + 2 * PILE_MARGIN_MM;
const BOX_H_MM = PILE_HEIGHT_MM + 2 * PILE_MARGIN_MM;

export function passesThreshold(dx, dy) {
  return Math.hypot(dx, dy) > DRAG_THRESHOLD_PX;
}

export function pointInRect({ x, y }, { left, top, width, height }) {
  return x >= left && x <= left + width && y >= top && y <= top + height;
}

// Rendered coin diameter in px for a pile box of the given width.
export function coinSizePx(coin, pileRect) {
  return (coin.diameter / BOX_W_MM) * pileRect.width;
}

// Inverse of pileBox: maps a viewport point to pile fractions. Unclamped.
export function toPileFraction({ x: px, y: py }, rect) {
  const x = (((px - rect.left) / rect.width) * BOX_W_MM - PILE_MARGIN_MM) / PILE_WIDTH_MM - 0.5;
  const y = (((py - rect.top) / rect.height) * BOX_H_MM - PILE_MARGIN_MM) / PILE_HEIGHT_MM - 0.5;
  return { x, y };
}

// 1 s, its own constant: independent of (and shorter than) the 2 s value-reveal DWELL_MS
export const DETACH_HOLD_MS = 1000;

// A pixel delta as a pile-fraction delta (the linear part of toPileFraction).
export function pixelsToFraction(dxPx, dyPx, rect) {
  return {
    x: ((dxPx / rect.width) * BOX_W_MM) / PILE_WIDTH_MM,
    y: ((dyPx / rect.height) * BOX_H_MM) / PILE_HEIGHT_MM,
  };
}

// Percentages resolve against the padding box, not the border box (the pile has a border).
function paddingRect(el) {
  const b = el.getBoundingClientRect();
  return { left: b.left + el.clientLeft, top: b.top + el.clientTop, width: el.clientWidth, height: el.clientHeight };
}

export function createDrag(container, { onMove, onMoveGroup, getGroup, onDragStart, isLocked, onDetach, onDetachEnd, onDetachRelease }) {
  let suppress = false;
  // { id, type, el, uid, uids, members, startX, startY, offX, offY, dragging, group, single, timer }
  let track = null;

  // clears the hold timer and every trace of the drag on every member; calls nothing
  const endDetach = (t) => {
    if (!t.detachedNotified) return;
    t.detachedNotified = false;
    onDetachEnd?.();
  };

  const restore = (t) => {
    clearTimeout(t.timer);
    t.timer = null;
    for (const m of t.members) {
      m.classList.remove("dragging", "detached");
      m.style.removeProperty("--dx");
      m.style.removeProperty("--dy");
    }
    endDetach(t);
  };

  const abandon = () => {
    if (!track) return;
    const t = track;
    track = null;
    restore(t);
  };

  container.addEventListener("pointerdown", (e) => {
    if (track && e.pointerId === track.id) abandon(); // stale: its pointerup was lost
    // a new primary touch of the same kind means the old finger is gone (its end was lost)
    if (track && e.isPrimary && e.pointerType === track.type && e.pointerId !== track.id) abandon();
    if (track && !track.el.isConnected) abandon(); // dragged coin removed mid-drag
    if (!track) suppress = false; // a second finger must not clear it
    if (track) {
      // a second pointer is ignored during a drag; before one starts it only cancels the hold
      // (a pending timer can no longer detach, a completed hold is abandoned entirely)
      const t = track;
      if (!t.dragging) {
        clearTimeout(t.timer);
        t.timer = null;
        t.el.classList.remove("detached");
        t.single = t.uids.length === 1;
        endDetach(t);
      }
      return;
    }
    if (isLocked()) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = e.target.closest?.("[data-uid]");
    if (!el) return;
    const uid = Number(el.dataset.uid);
    const found = getGroup ? getGroup(uid) : [];
    const uids = found.length > 1 && found.includes(uid) ? found : [uid];
    const members = uids.map((u) => (u === uid ? el : container.querySelector(`[data-uid="${u}"]`)))
      .filter(Boolean);
    const r = el.getBoundingClientRect();
    const t = {
      id: e.pointerId, type: e.pointerType, el, uid, uids, members, startX: e.clientX, startY: e.clientY,
      offX: r.left + r.width / 2 - e.clientX, offY: r.top + r.height / 2 - e.clientY,
      dragging: false, group: false, single: uids.length === 1, timer: null,
    };
    track = t;
    if (uids.length > 1) {
      t.timer = setTimeout(() => {
        t.timer = null;
        if (track !== t || t.dragging) return;
        if (!t.el.isConnected || isLocked()) { abandon(); return; }
        t.el.classList.add("detached");
        suppress = true; // a held coin stays separated: the release is not a tap
        t.single = true;
        if (onDetach) { t.detachedNotified = true; onDetach(t.uid); }
      }, DETACH_HOLD_MS);
    }
    try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  });

  container.addEventListener("pointermove", (e) => {
    if (!track || e.pointerId !== track.id) return;
    if (isLocked()) { abandon(); return; } // solved by another finger: snap back
    const t = track;
    const dx = e.clientX - t.startX;
    const dy = e.clientY - t.startY;
    if (!t.dragging) {
      if (!passesThreshold(dx, dy)) return;
      clearTimeout(t.timer);
      t.timer = null;
      t.dragging = true;
      t.group = !t.single;
      for (const m of t.group ? t.members : [t.el]) m.classList.add("dragging");
      suppress = true;
      onDragStart(t.el);
    }
    for (const m of t.group ? t.members : [t.el]) {
      m.style.setProperty("--dx", `${dx}px`);
      m.style.setProperty("--dy", `${dy}px`);
    }
  });

  container.addEventListener("pointerup", (e) => {
    if (!track || e.pointerId !== track.id) return;
    const t = track;
    track = null;
    if (!t.dragging) {
      const held = t.el.classList.contains("detached");
      restore(t);
      if (held) onDetachRelease?.(t.uid); // a completed hold released without dragging
      return;
    } // otherwise a tap is a tap
    const rect = paddingRect(container);
    restore(t);
    // removing .dragging must not enable the glide; main.js clears this after its style flush
    const flat = t.group ? t.members : [t.el];
    for (const m of flat) m.style.transition = "none";
    try {
      if (t.group) {
        const d = pixelsToFraction(e.clientX - t.startX, e.clientY - t.startY, rect);
        onMoveGroup(t.uids, d.x, d.y, t.uid);
      } else {
        const { x, y } = toPileFraction({ x: e.clientX + t.offX, y: e.clientY + t.offY }, rect);
        onMove(t.uid, x, y);
      }
    } finally {
      for (const m of flat) m.style.removeProperty("transition");
    }
  });

  const cancel = (e) => {
    if (!track || e.pointerId !== track.id) return;
    // only the leader holds capture; a release from an older element must not end this track
    if (e.type === "lostpointercapture" && e.target !== track.el) return;
    abandon();
  };
  container.addEventListener("pointercancel", cancel);
  container.addEventListener("lostpointercapture", cancel);

  container.addEventListener("click", (e) => {
    if (!suppress) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    suppress = false;
  }, true);
  container.addEventListener("keydown", () => {
    if (!(track && track.dragging)) suppress = false;
  });

  return { suppressed: () => suppress, active: () => !!(track && track.dragging) };
}

export function createTrayDrag(container, { onDrop, onDragStart, isLocked, pileEl }) {
  let suppress = false;
  let track = null; // { id, type, el, startX, startY, dragging, ghost, size }

  const finish = (t) => {
    t.ghost?.remove();
    t.el.classList.remove("dragging-source");
    pileEl.classList.remove("over-pile");
  };

  const inPile = (e) => pointInRect({ x: e.clientX, y: e.clientY }, pileEl.getBoundingClientRect());

  const moveGhost = (t, e) => {
    t.ghost.style.transform = `translate(${e.clientX - t.size / 2}px, ${e.clientY - t.size / 2}px)`;
  };

  container.addEventListener("pointerdown", (e) => {
    if (track && e.pointerId === track.id) { finish(track); track = null; } // stale: its pointerup was lost
    if (track && e.isPrimary && e.pointerType === track.type && e.pointerId !== track.id) { finish(track); track = null; }
    if (track && !track.el.isConnected) { finish(track); track = null; } // tray re-rendered mid-drag
    if (!track) suppress = false; // a second finger must not clear it
    if (isLocked() || track) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = e.target.closest?.("[data-coin]");
    if (!el) return;
    track = { id: e.pointerId, type: e.pointerType, el, startX: e.clientX, startY: e.clientY, dragging: false, ghost: null };
    try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  });

  container.addEventListener("pointermove", (e) => {
    if (!track || e.pointerId !== track.id) return;
    const t = track;
    if (isLocked()) { track = null; finish(t); return; } // solved by another finger
    if (!t.dragging) {
      if (!passesThreshold(e.clientX - t.startX, e.clientY - t.startY)) return;
      t.dragging = true;
      suppress = true;
      onDragStart(t.el);
      t.el.classList.add("dragging-source");
      const coin = COINS.find((c) => c.id === t.el.dataset.coin);
      const size = coinSizePx(coin, { width: pileEl.clientWidth });
      t.size = size;
      const ghost = document.createElement("div");
      ghost.className = "tray-ghost";
      ghost.setAttribute("aria-hidden", "true");
      ghost.style.position = "fixed";
      ghost.style.pointerEvents = "none";
      ghost.style.width = `${size}px`;
      ghost.style.height = `${size}px`;
      const svg = t.el.querySelector("svg");
      if (svg) ghost.append(svg.cloneNode(true));
      // inside .board so the difficulty rules hide the label; mirror the revealed state
      if (t.el.classList.contains("revealed")) ghost.classList.add("revealed");
      (t.el.closest(".board") ?? document.body).append(ghost);
      t.ghost = ghost;
    }
    moveGhost(t, e);
    pileEl.classList.toggle("over-pile", inPile(e));
  });

  container.addEventListener("pointerup", (e) => {
    if (!track || e.pointerId !== track.id) return;
    const t = track;
    track = null;
    if (!t.dragging) return;
    const inside = inPile(e);
    finish(t);
    if (!inside) return;
    const { x, y } = toPileFraction({ x: e.clientX, y: e.clientY }, paddingRect(pileEl));
    onDrop(t.el.dataset.coin, x, y);
  });

  const cancel = (e) => {
    if (!track || e.pointerId !== track.id) return;
    const t = track;
    track = null;
    finish(t);
  };
  container.addEventListener("pointercancel", cancel);
  container.addEventListener("lostpointercapture", cancel);

  container.addEventListener("click", (e) => {
    if (!suppress) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    suppress = false;
  }, true);
  container.addEventListener("keydown", () => {
    if (!(track && track.dragging)) suppress = false;
  });

  return { suppressed: () => suppress, active: () => !!(track && track.dragging) };
}
