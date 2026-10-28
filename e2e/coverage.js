// Coverage report options shared by the fixture (adds entries) and the global setup/teardown.
// Tests run in a worker process and the teardown in the runner process, so entries travel through
// Monocart's cache folder (coverage/e2e/.cache): it is cleared once in global setup, never per process.
import MCR from "monocart-coverage-reports";

export const coverageReport = () => MCR({
  name: "e2e coverage",
  outputDir: "coverage/e2e",
  reports: ["lcovonly", "console-summary"],
  entryFilter: (entry) => new URL(entry.url).pathname.startsWith("/src/"),
  // "localhost-4173/src/main.js" -> "src/main.js", so lcov paths match the repo
  sourcePath: (path) => path.replace(/^localhost-\d+\//, ""),
  cleanCache: false,
});
