import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { THEME_KEY, applyTheme, getStorage, nextTheme, readTheme, saveTheme, themeLabel } from "../src/theme.js";

const bootSource = readFileSync(new URL("../theme-boot.js", import.meta.url), "utf8");
const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const fakeStorage = (value) => ({ getItem: () => value });
const throwing = () => { throw new Error("blocked"); };

test("readTheme passes light and dark through", () => {
  assert.equal(readTheme(fakeStorage("dark")), "dark");
  assert.equal(readTheme(fakeStorage("light")), "light");
});

test("readTheme falls back to auto for null, unknown, missing or throwing storage", () => {
  assert.equal(readTheme(fakeStorage(null)), "auto");
  assert.equal(readTheme(fakeStorage("banana")), "auto");
  assert.equal(readTheme(undefined), "auto");
  assert.equal(readTheme(null), "auto");
  assert.equal(readTheme({ getItem: throwing }), "auto");
});

test("saveTheme stores light and dark and removes the key for auto", () => {
  const calls = [];
  const storage = { setItem: (...a) => calls.push(["set", ...a]), removeItem: (...a) => calls.push(["remove", ...a]) };
  saveTheme(storage, "dark");
  saveTheme(storage, "light");
  saveTheme(storage, "auto");
  assert.deepEqual(calls, [["set", THEME_KEY, "dark"], ["set", THEME_KEY, "light"], ["remove", THEME_KEY]]);
});

test("saveTheme swallows storage errors and a null storage", () => {
  const bad = { setItem: throwing, removeItem: throwing };
  assert.doesNotThrow(() => saveTheme(bad, "dark"));
  assert.doesNotThrow(() => saveTheme(bad, "auto"));
  assert.doesNotThrow(() => saveTheme(null, "dark"));
});

test("getStorage returns localStorage, or null when reading it throws", () => {
  const storage = {};
  assert.equal(getStorage({ localStorage: storage }), storage);
  assert.equal(getStorage({ get localStorage() { throw new Error("blocked"); } }), null);
  assert.equal(getStorage({}), null);
});

test("applyTheme sets light and dark and removes the attribute otherwise", () => {
  const root = new JSDOM("").window.document.documentElement;
  applyTheme(root, "dark");
  assert.equal(root.dataset.theme, "dark");
  applyTheme(root, "light");
  assert.equal(root.dataset.theme, "light");
  applyTheme(root, "auto");
  assert.equal("theme" in root.dataset, false);
  applyTheme(root, "dark");
  applyTheme(root, "banana");
  assert.equal("theme" in root.dataset, false);
});

function boot(setup) {
  const dom = new JSDOM("<!doctype html><html></html>", { url: "http://localhost/", runScripts: "outside-only" });
  setup?.(dom.window);
  dom.window.eval(bootSource);
  return dom.window.document.documentElement.dataset.theme;
}

test("boot script applies a saved light or dark theme", () => {
  assert.equal(boot((w) => w.localStorage.setItem(THEME_KEY, "dark")), "dark");
  assert.equal(boot((w) => w.localStorage.setItem(THEME_KEY, "light")), "light");
});

test("boot script ignores unknown values and a missing key", () => {
  assert.equal(boot((w) => w.localStorage.setItem(THEME_KEY, "banana")), undefined);
  assert.equal(boot(), undefined);
});

test("boot script does not throw when localStorage throws", () => {
  const theme = boot((w) => Object.defineProperty(w, "localStorage", { get: throwing }));
  assert.equal(theme, undefined);
});

test("boot script uses the same key as theme.js", () => {
  assert.ok(bootSource.includes(THEME_KEY));
});

test("index.html loads theme-boot.js as a plain script before the stylesheet", () => {
  const boot = indexHtml.indexOf("theme-boot.js");
  const css = indexHtml.indexOf("styles.css");
  assert.ok(boot !== -1 && boot < css);
  const tag = /<script[^>]*theme-boot\.js[^>]*>/.exec(indexHtml)[0];
  assert.ok(!/type="module"|\bdefer\b|\basync\b/.test(tag));
});

test("nextTheme cycles auto, light, dark, auto and maps unknown values to light", () => {
  assert.equal(nextTheme("auto"), "light");
  assert.equal(nextTheme("light"), "dark");
  assert.equal(nextTheme("dark"), "auto");
  assert.equal(nextTheme("banana"), "light");
  assert.equal(nextTheme(undefined), "light");
});

test("themeLabel names the current choice and what a press does", () => {
  assert.equal(themeLabel("auto"), "Theme: Auto. Press to switch to Light");
  assert.equal(themeLabel("light"), "Theme: Light. Press to switch to Dark");
  assert.equal(themeLabel("dark"), "Theme: Dark. Press to switch to Auto");
  assert.equal(themeLabel("banana"), themeLabel("auto"));
});
