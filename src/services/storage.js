// Reading window.localStorage can itself throw (blocked storage), so wrap it.
export function getStorage(win) {
  try { return win.localStorage ?? null; } catch { return null; }
}
