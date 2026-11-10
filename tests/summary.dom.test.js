import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "./dom-helper.js";
import { mountSummary } from "../src/summary.js";

const HTML = `<!doctype html><body><h1 id="summary-title">Session over</h1><p id="summary-line"></p>
  <p id="summary-score"></p><p id="summary-served"></p><p id="summary-rank"></p>
  <button id="summary-again">Play again</button><button id="summary-leaderboard">Leaderboard</button><button id="summary-home">Home</button></body>`;

function withSummary(fn) {
  return async () => {
    const dom = installDom(HTML);
    try {
      const g = (id) => dom.document.getElementById(id);
      const calls = [];
      const summary = mountSummary(
        { title: g("summary-title"), line: g("summary-line"), score: g("summary-score"), served: g("summary-served"), rank: g("summary-rank"), again: g("summary-again"), leaderboard: g("summary-leaderboard"), home: g("summary-home") },
        { onAgain: () => calls.push("again"), onLeaderboard: () => calls.push("leaderboard"), onHome: () => calls.push("home") },
      );
      await fn({ ...dom, g, summary, calls });
    } finally {
      dom.teardown();
    }
  };
}

const result = (over = {}) => ({ mode: "give-change", preset: "hard", score: 120, served: 7, at: "2026-10-31T12:00:00.000Z", ...over });

test("show writes the mode and difficulty, score and customers served", withSummary(({ g, summary }) => {
  summary.show(result(), 3, 7);
  assert.equal(g("summary-line").textContent, "Give Change, Hard");
  assert.equal(g("summary-score").textContent, "120");
  assert.equal(g("summary-served").textContent, "Customers served: 7");
}));

test("rank 1 says New best score!, rank 3 of 7 says \"Rank 3 of 7\", null says \"Not in the top 10\"", withSummary(({ g, summary }) => {
  summary.show(result(), 1, 1);
  assert.equal(g("summary-rank").textContent, "New best score!");
  summary.show(result(), 3, 7);
  assert.equal(g("summary-rank").textContent, "Rank 3 of 7");
  summary.show(result(), null, 10);
  assert.equal(g("summary-rank").textContent, "Not in the top 10");
}));

test("a custom-settings result says it is not ranked and hides the Leaderboard button", withSummary(({ g, summary }) => {
  summary.show(result({ preset: null, mode: "endless" }), null, 0);
  assert.equal(g("summary-line").textContent, "Endless (custom settings)");
  assert.equal(g("summary-rank").textContent, "Custom settings are not ranked.");
  assert.equal(g("summary-leaderboard").hidden, true);
  summary.show(result(), 2, 5);
  assert.equal(g("summary-leaderboard").hidden, false);
}));

test("a score of 0 says nothing was saved", withSummary(({ g, summary }) => {
  summary.show(result({ score: 0 }), null, 4);
  assert.equal(g("summary-rank").textContent, "No points scored, so nothing was saved.");
}));

test("the three buttons call their handlers", withSummary(({ g, calls, summary }) => {
  summary.show(result(), 1, 1);
  g("summary-again").click();
  g("summary-leaderboard").click();
  g("summary-home").click();
  assert.deepEqual(calls, ["again", "leaderboard", "home"]);
}));
