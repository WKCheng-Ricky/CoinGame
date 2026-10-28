import { coverageReport } from "./coverage.js";

const MIN_MAIN_LINES = 80;

export default async function globalTeardown() {
  const results = await coverageReport().generate();
  const lines = results?.files?.find((f) => f.sourcePath === "src/main.js")?.summary.lines;
  const pct = lines?.pct ?? 0;
  const text = `src/main.js lines: ${pct}% (${lines?.covered ?? 0}/${lines?.total ?? 0})`;
  if (pct >= MIN_MAIN_LINES) {
    console.log(text);
    return;
  }
  // enforced by CI and npm run test:e2e:coverage; a plain run only reports it
  if (process.env.COVERAGE_ENFORCE) throw new Error(`${text}, under ${MIN_MAIN_LINES}%`);
  console.log(`${text}, under ${MIN_MAIN_LINES}% (not enforced: set COVERAGE_ENFORCE=1 to fail)`);
}
