// Controls that use Enter themselves, so a plain Enter on them keeps its own meaning.
const INTERACTIVE = "button, input, select, textarea, a[href], summary, [contenteditable]";

// True for the "Check" keyboard shortcut: Enter (not a held-down repeat) that is either
// Ctrl+Enter / Cmd+Enter, or a plain Enter while focus is not on an interactive control.
export function isCheckShortcut(event) {
  if (event.key !== "Enter" || event.repeat) return false;
  if (event.ctrlKey || event.metaKey) return true;
  return !event.target?.closest?.(INTERACTIVE);
}
