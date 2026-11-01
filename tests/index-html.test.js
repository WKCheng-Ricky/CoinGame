import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const load = () => new JSDOM(readFileSync(new URL("../index.html", import.meta.url), "utf8")).window.document;

test("the page title and the home heading say Coin Counting Game", () => {
  const doc = load();
  assert.equal(doc.title, "Coin Counting Game");
  assert.equal(doc.querySelector("#screen-home h1").textContent, "Coin Counting Game");
});

test("the README heading uses the new name", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /^# Coin Counting Game$/m);
});

test("the head links the SVG favicon and the iPhone touch icon", () => {
  const doc = load();
  const icon = doc.querySelector('link[rel="icon"]');
  assert.equal(icon.getAttribute("href"), "favicon.svg");
  assert.equal(icon.getAttribute("type"), "image/svg+xml");
  assert.equal(doc.querySelector('link[rel="apple-touch-icon"]').getAttribute("href"), "apple-touch-icon.png");
});

test("the home screen has a top bar with Options on the left and the theme toggle on the right", () => {
  const doc = load();
  const bar = doc.querySelector("#screen-home > .home-bar");
  const options = bar.querySelector("#btn-options");
  assert.equal(options.textContent.trim(), "", "icon-only: no visible text");
  assert.equal(options.getAttribute("aria-label"), "Options");
  assert.equal(options.getAttribute("title"), "Options");
  assert.equal(bar.firstElementChild, options);
  assert.ok(bar.querySelector(".home-end #btn-theme"));
});

test("Play is alone in a bottom bar outside the scrolling middle, and Options is not repeated there", () => {
  const doc = load();
  const foot = doc.querySelector("#screen-home > .home-foot");
  assert.ok(foot.querySelector("#btn-play"));
  assert.equal(foot.querySelectorAll("button").length, 1);
  const body = doc.querySelector("#screen-home > .home-body");
  assert.ok(!body.querySelector("#btn-play"));
  assert.ok(body.querySelector("#modes") && body.querySelector("#presets") && body.querySelector("#btn-large") && body.querySelector("#chips"));
  assert.equal(doc.querySelectorAll("#btn-options").length, 1);
});

test("the tagline follows the title directly and the disclaimer ends the scrolling middle", () => {
  const doc = load();
  const title = doc.querySelector("#screen-home h1");
  assert.ok(title.nextElementSibling.matches("p.tagline"));
  assert.equal(title.nextElementSibling.textContent, "Make the amount using UK coins.");
  const note = doc.querySelector("#screen-home .home-body > p.disclaimer:last-child");
  assert.equal(note.textContent, "Unofficial educational game. Not affiliated with or endorsed by The Royal Mint. Coin pictures are original illustrations.");
});
