import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { isCheckShortcut } from "../src/keys.js";

const { document } = new JSDOM(`<!doctype html><body>
  <h1 tabindex="-1">Heading</h1><button>B</button><input><select></select><textarea></textarea>
  <a href="#x">link</a><a>no href</a><details><summary>S</summary></details>
  <div contenteditable="true"><span>edit</span></div>
</body>`).window;

const pick = (selector) => document.querySelector(selector);
const key = (target, init = {}) => ({ key: "Enter", ctrlKey: false, metaKey: false, repeat: false, target, ...init });

test("plain Enter on the body and on a heading is the shortcut", () => {
  assert.equal(isCheckShortcut(key(document.body)), true);
  assert.equal(isCheckShortcut(key(pick("h1"))), true);
});

test("plain Enter on a control that uses Enter itself is not", () => {
  for (const sel of ["button", "input", "select", "textarea", "a[href]", "summary", "[contenteditable] span"]) {
    assert.equal(isCheckShortcut(key(pick(sel))), false, sel);
  }
  assert.equal(isCheckShortcut(key(pick("a:not([href])"))), true);
});

test("Ctrl+Enter and Meta+Enter work from anywhere, including a control", () => {
  assert.equal(isCheckShortcut(key(pick("button"), { ctrlKey: true })), true);
  assert.equal(isCheckShortcut(key(pick("button"), { metaKey: true })), true);
  assert.equal(isCheckShortcut(key(pick("input"), { ctrlKey: true })), true);
});

test("a repeated keydown is not the shortcut", () => {
  assert.equal(isCheckShortcut(key(document.body, { repeat: true })), false);
  assert.equal(isCheckShortcut(key(pick("button"), { ctrlKey: true, repeat: true })), false);
});

test("other keys are not the shortcut", () => {
  assert.equal(isCheckShortcut(key(document.body, { key: "a" })), false);
  assert.equal(isCheckShortcut(key(document.body, { key: " " })), false);
  assert.equal(isCheckShortcut(key(document.body, { key: "Escape", ctrlKey: true })), false);
});

test("Shift+Enter on the body still counts (Shift is not a shortcut modifier)", () => {
  assert.equal(isCheckShortcut({ ...key(document.body), shiftKey: true }), true);
});

test("a target that is not an element (the document) counts as not interactive", () => {
  assert.equal(isCheckShortcut(key(document)), true);
  assert.equal(isCheckShortcut(key(null)), true);
});
