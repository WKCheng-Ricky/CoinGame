import test from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../helpers/dom-helper.js";
import { createChoiceDialog } from "../../src/views/choice-dialog.js";

const HTML = `<!doctype html><body><dialog id="confirm-dialog" aria-labelledby="confirm-title"><h2 id="confirm-title"></h2><div class="dialog-actions"></div></dialog></body>`;
const CHOICES = [
  { id: "save", label: "Save" },
  { id: "discard", label: "Discard" },
  { id: "keep", label: "Keep playing" },
];

function setup() {
  const dom = installDom(HTML);
  const dialog = dom.document.getElementById("confirm-dialog");
  return { dom, dialog, ui: createChoiceDialog(dialog) };
}

test("ask opens the dialog with the title and one button per choice, the first focused", () => {
  const { dom, dialog, ui } = setup();
  try {
    ui.ask("End round?", CHOICES);
    assert.equal(ui.isOpen(), true);
    assert.equal(dialog.querySelector("h2").textContent, "End round?");
    const buttons = [...dialog.querySelectorAll(".dialog-actions button")];
    assert.deepEqual(buttons.map((b) => b.textContent), ["Save", "Discard", "Keep playing"]);
    assert.equal(dom.document.activeElement, buttons[0]);
  } finally {
    dom.teardown();
  }
});

test("clicking a choice resolves its id and closes the dialog", async () => {
  const { dom, dialog, ui } = setup();
  try {
    const answer = ui.ask("End round?", CHOICES);
    dialog.querySelectorAll(".dialog-actions button")[1].click();
    assert.equal(await answer, "discard");
    assert.equal(ui.isOpen(), false);
  } finally {
    dom.teardown();
  }
});

test("the cancel event (Escape) resolves keep and closes the dialog", async () => {
  const { dom, dialog, ui } = setup();
  try {
    const answer = ui.ask("End round?", CHOICES);
    dialog.dispatchEvent(new dom.window.Event("cancel", { cancelable: true }));
    assert.equal(await answer, "keep");
    assert.equal(ui.isOpen(), false);
  } finally {
    dom.teardown();
  }
});

test("ask can be used again and replaces the previous buttons", async () => {
  const { dom, dialog, ui } = setup();
  try {
    const first = ui.ask("One", CHOICES);
    dialog.querySelector(".dialog-actions button").click();
    await first;
    const second = ui.ask("Two", [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }]);
    const buttons = [...dialog.querySelectorAll(".dialog-actions button")];
    assert.deepEqual(buttons.map((b) => b.textContent), ["Yes", "No"]);
    assert.equal(dialog.querySelector("h2").textContent, "Two");
    buttons[1].click();
    assert.equal(await second, "no");
    assert.equal(ui.isOpen(), false);
  } finally {
    dom.teardown();
  }
});

test("a dialog with native showModal and close uses them instead of the open attribute", async () => {
  const { dom, dialog, ui } = setup();
  try {
    const calls = [];
    dialog.showModal = () => { calls.push("showModal"); dialog.setAttribute("open", ""); };
    dialog.close = () => { calls.push("close"); dialog.removeAttribute("open"); };
    const answer = ui.ask("End round?", CHOICES);
    assert.equal(ui.isOpen(), true);
    dialog.querySelector(".dialog-actions button").click();
    assert.equal(await answer, "save");
    assert.deepEqual(calls, ["showModal", "close"]);
  } finally {
    dom.teardown();
  }
});

test("a cancel event with no question pending is ignored", () => {
  const { dom, dialog, ui } = setup();
  try {
    const event = new dom.window.Event("cancel", { cancelable: true });
    dialog.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(ui.isOpen(), false);
  } finally {
    dom.teardown();
  }
});

test("asking again while a question is open settles the first as keep", async () => {
  const { dom, dialog, ui } = setup();
  try {
    const first = ui.ask("One", CHOICES);
    const second = ui.ask("Two", CHOICES);
    assert.equal(await first, "keep");
    assert.equal(ui.isOpen(), true);
    dialog.querySelectorAll(".dialog-actions button")[1].click();
    assert.equal(await second, "discard");
  } finally {
    dom.teardown();
  }
});
