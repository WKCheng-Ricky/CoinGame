import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const text = readme
  .split("\n")
  .filter((line) => !/^\s*!\[/.test(line))
  .join("\n");

test("the README is short (under 300 words, image lines excluded)", () => {
  const words = text.split(/\s+/).filter(Boolean).length;
  assert.ok(words < 300, `README has ${words} words`);
});

test("the README has the live URL and names the four modes", () => {
  assert.ok(readme.includes("https://wkcheng-ricky.github.io/CoinGame/"));
  for (const word of ["Endless", "Custom", "Cashier", "Give Change"]) {
    assert.ok(readme.includes(word), `missing ${word}`);
  }
});

test("every relative docs link in the README points to an existing file", () => {
  const links = [...readme.matchAll(/\]\((docs\/[^)#\s]+)/g)].map((m) => m[1]);
  assert.ok(links.length >= 2);
  for (const link of links) {
    assert.ok(existsSync(new URL(`../${link}`, import.meta.url)), `broken link ${link}`);
  }
});
