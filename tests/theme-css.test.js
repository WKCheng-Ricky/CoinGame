import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const SUPPORTS = "@supports (color: light-dark(#000, #fff))";

// Returns the text between the braces that open at the first "{" after `start`.
function block(text, start) {
  const open = text.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return { body: text.slice(open + 1, i), from: start, to: i + 1 };
  }
  throw new Error("unbalanced braces");
}

const supports = block(css, css.indexOf(SUPPORTS));
const vars = (text) => [...text.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]);
const pairs = vars(supports.body).map(([name, value]) => {
  const m = /^light-dark\((.*)\)$/s.exec(value);
  assert.ok(m, `${name} must be a light-dark() value`);
  let depth = 0, split = -1;
  for (let i = 0; i < m[1].length; i++) {
    if (m[1][i] === "(") depth++;
    else if (m[1][i] === ")") depth--;
    else if (m[1][i] === "," && depth === 0) { split = i; break; }
  }
  return [name, m[1].slice(0, split).trim(), m[1].slice(split + 1).trim()];
});

test("light-dark() appears only inside the @supports block", () => {
  const outside = css.slice(0, supports.from) + css.slice(supports.to);
  // the @supports conditions themselves mention light-dark(#000, #fff)
  assert.ok(!outside.replaceAll("(color: light-dark(#000, #fff))", "").includes("light-dark("));
});

test("every themed variable has a plain light fallback before the @supports block", () => {
  const before = css.slice(0, supports.from);
  const rootBlocks = [...before.matchAll(/:root\s*\{/g)].map((m) => block(before, m.index).body);
  const plain = new Map(rootBlocks.flatMap(vars));
  assert.ok(pairs.length >= 15);
  for (const [name, light] of pairs) {
    assert.ok(plain.has(name), `${name} has no plain definition`);
    assert.ok(!plain.get(name).includes("light-dark"), `${name} fallback must be plain`);
    assert.equal(plain.get(name).toLowerCase(), light.toLowerCase(), `${name} fallback differs from its light value`);
  }
});

test("--lift-shadow and --grid-major are themed (the fallback test above checks their plain values)", () => {
  for (const name of ["--lift-shadow", "--grid-major"]) {
    assert.ok(pairs.some(([n]) => n === name), `${name} has no light-dark() pair`);
    const plain = css.slice(0, supports.from).match(new RegExp(`${name}:\\s*([^;]+);`));
    assert.ok(plain && !plain[1].includes("light-dark"), `${name} has no plain fallback`);
  }
});

test("the lift shadows use --lift-shadow and no hard-coded #0005 drop-shadow remains", () => {
  assert.ok(!css.includes("#0005"));
  assert.equal([...css.matchAll(/drop-shadow\(0 3px 4px var\(--lift-shadow\)\)/g)].length, 3);
});

test("main pads its sides with the safe-area insets", () => {
  const rule = /(?:^|\n)main\s*\{([^}]*)\}/.exec(css);
  assert.ok(rule, "main rule");
  assert.match(rule[1], /padding-inline:\s*max\(1rem,\s*env\(safe-area-inset-left\)\)\s+max\(1rem,\s*env\(safe-area-inset-right\)\)/);
});

test("browsers without light-dark() hide the theme icon button", () => {
  const i = css.indexOf("@supports not (color: light-dark(#000, #fff))");
  assert.ok(i !== -1);
  assert.match(block(css, i).body, /\.theme-toggle\s*\{\s*display:\s*none/);
});
