export function createChoiceDialog(dialog) {
  const heading = dialog.querySelector("h2");
  const actions = dialog.querySelector(".dialog-actions");
  let finish = null;

  function open() {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function close() {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  // Escape: settle as "keep" ourselves so the native close that follows is a no-op.
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (finish) finish("keep");
  });

  function ask(title, choices) {
    if (finish) finish("keep");
    return new Promise((resolve) => {
      let done = false;
      finish = (id) => {
        if (done) return;
        done = true;
        finish = null;
        close();
        resolve(id);
      };
      heading.textContent = title;
      actions.replaceChildren(
        ...choices.map((choice) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = choice.label;
          button.addEventListener("click", () => finish(choice.id));
          return button;
        }),
      );
      open();
      actions.querySelector("button")?.focus();
    });
  }

  return { ask, isOpen: () => dialog.hasAttribute("open") };
}
