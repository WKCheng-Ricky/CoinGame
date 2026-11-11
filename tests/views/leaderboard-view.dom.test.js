import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../helpers/dom-helper.js";
import { mountLeaderboard, formatDate } from "../../src/views/leaderboard-view.js";

const HTML = `<!doctype html><body><div id="lb-mode"></div><div id="lb-preset"></div>
  <table id="lb-table"><caption id="lb-caption"></caption><tbody id="lb-list"></tbody></table>
  <p id="lb-empty" hidden></p><button id="lb-clear">Clear scores</button><button id="lb-back">Back</button></body>`;

function withBoard(boards, fn) {
  return async () => {
    const dom = installDom(HTML);
    try {
      const { document } = dom;
      const asked = [];
      let cleared = 0;
      let backs = 0;
      const store = {
        list: (id) => { asked.push(id); return boards[id] ?? []; },
        add: () => null,
        clear: () => { cleared += 1; for (const k of Object.keys(boards)) delete boards[k]; },
      };
      const g = (id) => document.getElementById(id);
      const lb = mountLeaderboard(
        { mode: g("lb-mode"), preset: g("lb-preset"), list: g("lb-list"), empty: g("lb-empty"), caption: g("lb-caption"), clear: g("lb-clear"), back: g("lb-back"), table: g("lb-table") },
        { store, onBack: () => { backs += 1; } },
      );
      await fn({ ...dom, lb, asked, g, cleared: () => cleared, backs: () => backs });
    } finally {
      dom.teardown();
    }
  };
}

const B = {
  "endless:normal": [
    { score: 90, served: 9, at: "2026-10-31T12:00:00.000Z" },
    { score: 40, served: 4, at: "2026-10-30T12:00:00.000Z" },
  ],
  "cashier:hard": [{ score: 7, served: 1, at: "2026-01-02T12:00:00.000Z" }],
};
const rows = (document) => [...document.querySelectorAll("#lb-list tr")];

test("show renders rank, score, served and date rows in order", withBoard({ ...B }, ({ document, lb }) => {
  lb.show("endless", "normal");
  assert.deepEqual(rows(document).map((r) => [...r.children].map((c) => c.textContent)), [
    ["1", "90", "9", "31 Oct 2026"], ["2", "40", "4", "30 Oct 2026"],
  ]);
  assert.equal(document.getElementById("lb-table").hidden, false);
  assert.equal(document.getElementById("lb-empty").hidden, true);
}));

test("show highlights the given row", withBoard({ ...B }, ({ document, lb }) => {
  lb.show("endless", "normal", 2);
  assert.deepEqual(rows(document).map((r) => r.getAttribute("aria-current")), [null, "true"]);
}));

test("an empty board shows the no-scores message and hides the table", withBoard({ ...B }, ({ document, lb }) => {
  lb.show("give-change", "veryHard");
  assert.equal(document.getElementById("lb-table").hidden, true);
  assert.equal(document.getElementById("lb-empty").hidden, false);
  assert.equal(rows(document).length, 0);
}));

test("choosing another mode or difficulty re-renders that board", withBoard({ ...B }, ({ document, window, lb }) => {
  lb.show("endless", "normal");
  const pick = (name, value) => {
    const r = document.querySelector(`input[name=${name}][value=${value}]`);
    r.checked = true;
    r.dispatchEvent(new window.Event("change", { bubbles: true }));
  };
  pick("lb-mode", "cashier");
  assert.equal(rows(document).length, 0);
  pick("lb-preset", "hard");
  assert.deepEqual(rows(document).map((r) => r.children[1].textContent), ["7"]);
  assert.deepEqual([...document.querySelectorAll("input[name=lb-mode]")].map((r) => r.value), ["endless", "cashier", "give-change"]);
  assert.deepEqual([...document.querySelectorAll("input[name=lb-preset]")].map((r) => r.value), ["normal", "hard", "veryHard"]);
}));

test("Clear scores needs two presses", withBoard({ ...B }, ({ document, g, lb, cleared }) => {
  lb.show("endless", "normal");
  const clear = g("lb-clear");
  clear.click();
  assert.equal(clear.textContent, "Press again to clear all scores");
  assert.equal(cleared(), 0);
  clear.click();
  assert.equal(cleared(), 1);
  assert.equal(clear.textContent, "Clear scores");
  assert.equal(document.getElementById("lb-empty").hidden, false);
}));

test("the armed state is dropped when focus leaves or the board changes", withBoard({ ...B }, ({ window, g, lb, cleared }) => {
  lb.show("endless", "normal");
  const clear = g("lb-clear");
  clear.click();
  clear.dispatchEvent(new window.FocusEvent("blur"));
  assert.equal(clear.textContent, "Clear scores");
  clear.click();
  lb.show("cashier", "hard");
  assert.equal(clear.textContent, "Clear scores");
  clear.click();
  assert.equal(cleared(), 0);
}));

test("Back calls onBack", withBoard({}, ({ g, backs }) => {
  g("lb-back").click();
  assert.equal(backs(), 1);
}));

test("formatDate gives \"31 Oct 2026\" for a midday UTC ISO date", () => {
  assert.equal(formatDate("2026-10-31T12:00:00.000Z"), "31 Oct 2026");
});
