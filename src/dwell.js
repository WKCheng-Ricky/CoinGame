export const DWELL_MS = 2000;

export function createDwell({
  delay = DWELL_MS,
  onReveal,
  onHide,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
}) {
  const pending = new Map();
  const revealed = new Set();

  function start(key) {
    if (pending.has(key) || revealed.has(key)) return;
    const id = setTimer(() => {
      pending.delete(key);
      revealed.add(key);
      onReveal(key);
    }, delay);
    pending.set(key, id);
  }

  function stop(key) {
    if (pending.has(key)) {
      clearTimer(pending.get(key));
      pending.delete(key);
    } else if (revealed.delete(key)) {
      onHide(key);
    }
  }

  function cancelAll() {
    for (const key of [...pending.keys(), ...revealed]) stop(key);
  }

  function prune(keep) {
    for (const key of [...pending.keys(), ...revealed]) {
      if (!keep(key)) stop(key);
    }
  }

  return { start, stop, cancelAll, prune };
}
