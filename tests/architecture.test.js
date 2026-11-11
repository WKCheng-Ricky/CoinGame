import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const srcDir = fileURLToPath(new URL("../src/", import.meta.url));

const RANKS = {
  constants: 0,
  utils: 0,
  models: 1,
  services: 2,
  views: 3,
  controllers: 3,
  main: 4,
};
const LAYER_FOLDERS = Object.keys(RANKS).filter((k) => k !== "main");

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const files = walk(srcDir).map((full) => ({
  full,
  rel: path.relative(srcDir, full).split(path.sep).join("/"),
}));
const jsFiles = files.filter((f) => f.rel.endsWith(".js"));

// Layer name of a src-relative path ("main.js" -> "main").
const layerOf = (rel) => (rel === "main.js" ? "main" : rel.split("/")[0]);

const SPECIFIER_PATTERNS = [
  /\bfrom\s+["'](\.[^"']+)["']/g, // import/export ... from "./x.js"
  /\bimport\s+["'](\.[^"']+)["']/g, // bare side-effect import "./x.js"
  /\bimport\(\s*["'](\.[^"']+)["']\s*\)/g, // dynamic import("./x.js")
];

const importsOf = (file) => {
  const source = readFileSync(file.full, "utf8");
  const found = [];
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const m of source.matchAll(pattern)) found.push(m[1]);
  }
  return found.map((spec) => ({
    spec,
    target: path.resolve(path.dirname(file.full), spec),
  }));
};

test("the scan is not vacuous: it finds src files, main.js and imports", () => {
  assert.ok(jsFiles.length > 0, "no .js files found under src/");
  assert.ok(jsFiles.some((f) => f.rel === "main.js"), "main.js is not among the scanned files");
  const total = jsFiles.reduce((n, f) => n + importsOf(f).length, 0);
  assert.ok(total > 0, "no relative imports were matched in src/");
});

test("src/ holds only main.js at the root and files in the six layer folders", () => {
  for (const { rel } of files) {
    if (!rel.includes("/")) {
      assert.equal(rel, "main.js", `src/${rel}: only main.js may sit directly in src/`);
    } else {
      const folder = rel.split("/")[0];
      assert.ok(
        LAYER_FOLDERS.includes(folder),
        `src/${rel}: folder "${folder}" is not one of ${LAYER_FOLDERS.join(", ")}`,
      );
    }
  }
});

test("every relative import in src/ resolves to an existing file", () => {
  for (const file of jsFiles) {
    for (const { spec, target } of importsOf(file)) {
      assert.ok(
        existsSync(target) && statSync(target).isFile(),
        `src/${file.rel} imports "${spec}" which does not resolve to an existing file`,
      );
    }
  }
});

test("imports respect layer ranks (own folder or strictly lower rank)", () => {
  for (const file of jsFiles) {
    const from = layerOf(file.rel);
    for (const { spec, target } of importsOf(file)) {
      const targetRel = path.relative(srcDir, target).split(path.sep).join("/");
      const to = layerOf(targetRel);
      if (to === from) continue;
      assert.ok(
        to in RANKS,
        `src/${file.rel} imports "${spec}" which points outside the layer folders`,
      );
      assert.ok(
        RANKS[to] < RANKS[from],
        `src/${file.rel} (${from}, rank ${RANKS[from]}) imports "${spec}" (${to}, rank ${RANKS[to]}): ` +
          `a layer may only import from its own folder or a strictly lower rank`,
      );
    }
  }
});
