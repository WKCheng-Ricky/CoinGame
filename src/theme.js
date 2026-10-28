export const THEME_KEY = "coin-game-theme";

// Reading window.localStorage can itself throw (blocked storage), so wrap it.
export function getStorage(win) {
  try { return win.localStorage ?? null; } catch { return null; }
}

export function readTheme(storage) {
  try {
    const value = storage?.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "auto";
  } catch { return "auto"; }
}

export function saveTheme(storage, theme) {
  try {
    if (!storage) return;
    if (theme === "light" || theme === "dark") storage.setItem(THEME_KEY, theme);
    else storage.removeItem(THEME_KEY);
  } catch { /* storage blocked: the choice just is not remembered */ }
}

export function applyTheme(root, theme) {
  if (theme === "light" || theme === "dark") root.dataset.theme = theme;
  else delete root.dataset.theme;
}

const NEXT = { auto: "light", light: "dark", dark: "auto" };
const NAME = { auto: "Auto", light: "Light", dark: "Dark" };

// auto -> light -> dark -> auto; anything unknown starts the cycle at light
export function nextTheme(theme) {
  return NEXT[theme] ?? "light";
}

export function themeLabel(theme) {
  const current = NAME[theme] ? theme : "auto";
  return `Theme: ${NAME[current]}. Press to switch to ${NAME[NEXT[current]]}`;
}
