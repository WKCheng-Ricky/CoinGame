import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { parse } from "yaml";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const wf = parse(read(".github/workflows/ci.yml"));
const html = read("index.html");
const css = read("styles.css");

const stagedEntries = () => {
  const step = (wf.jobs.deploy?.steps ?? []).find((s) => s.run?.includes("_site/"));
  assert.ok(step, "deploy job needs a step that copies files into _site/");
  const match = step.run.match(/cp -r (.+) _site\//);
  assert.ok(match, "staging step must use `cp -r <entries> _site/`");
  return match[1].trim().split(/\s+/);
};

const localReferences = () => {
  const refs = [];
  for (const m of html.matchAll(/\b(?:src|href)="([^"]*)"/g)) refs.push(m[1]);
  for (const m of css.matchAll(/url\(\s*["']?([^"')]*)["']?\s*\)/g)) refs.push(m[1]);
  return refs.filter((r) => r && !/^(https?:|data:|#)/.test(r));
};

test("staged entries are exactly the seven runtime files", () => {
  const entries = stagedEntries();
  assert.deepEqual([...entries].sort(), ["apple-touch-icon.png", "favicon.svg", "fonts", "index.html", "src", "styles.css", "theme-boot.js"]);
  for (const entry of entries) assert.ok(existsSync(new URL(entry, root)), `${entry} exists in the repo root`);
});

test("every local reference in index.html and styles.css is staged", () => {
  const entries = stagedEntries();
  const refs = localReferences();
  assert.ok(refs.length > 0, "found local references to check");
  for (const ref of refs) assert.ok(entries.includes(ref.split("/")[0]), `${ref} is staged`);
});

test("no reference is root-absolute", () => {
  for (const ref of localReferences()) assert.ok(!ref.startsWith("/"), `${ref} must be relative`);
});

test("the e2e job runs unconditionally and deploy waits on unit and e2e", () => {
  assert.ok(wf.jobs.e2e, "e2e job exists");
  assert.ok(!("if" in wf.jobs.e2e), "e2e job has no `if`");
  assert.deepEqual(wf.jobs.deploy.needs, ["unit", "e2e"]);
});

test("the e2e job runs the happy-path suite without coverage on Chromium and WebKit", () => {
  const steps = wf.jobs.e2e.steps;
  assert.ok(steps.some((s) => s.run === "npm run test:e2e"));
  assert.ok(!JSON.stringify(wf.jobs.e2e).includes("coverage"), "no coverage anywhere in the e2e job");
  const installs = steps.filter((s) => s.run?.includes("playwright install")).map((s) => s.run);
  assert.ok(installs.length > 0);
  for (const browser of ["chromium", "webkit"]) {
    assert.ok(installs.every((r) => r.includes(browser)), `install steps cover ${browser}`);
  }
});

test("deploy runs only for pushes to main, after the unit and e2e jobs", () => {
  assert.deepEqual(wf.jobs.deploy.needs, ["unit", "e2e"]);
  const cond = wf.jobs.deploy.if;
  assert.equal(typeof cond, "string");
  assert.ok(cond.includes("github.event_name == 'push'"));
  assert.ok(cond.includes("github.ref == 'refs/heads/main'"));
});

test("deploy job has least-privilege Pages permissions", () => {
  const perms = wf.jobs.deploy.permissions;
  assert.equal(perms.pages, "write");
  assert.equal(perms["id-token"], "write");
  assert.ok(!("pages" in wf.permissions));
  assert.ok(!("id-token" in wf.permissions));
});

test("runs on main are never cancelled", () => {
  const cancel = wf.concurrency["cancel-in-progress"];
  assert.equal(typeof cancel, "string");
  assert.ok(cancel.includes("github.ref != 'refs/heads/main'"));
  assert.deepEqual(wf.jobs.deploy.concurrency, { group: "pages", "cancel-in-progress": false });
});

test("_site is git-ignored", () => {
  assert.ok(read(".gitignore").split(/\r?\n/).includes("_site/"));
});
