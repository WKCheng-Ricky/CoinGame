// Classic script run before the stylesheet so a saved theme is set before first paint.
// Keep in step with THEME_KEY and the accepted values in src/theme.js.
(() => {
  try {
    const THEME_KEY = "coin-game-theme";
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  } catch (e) { /* storage blocked: stay on Auto */ }
})();
