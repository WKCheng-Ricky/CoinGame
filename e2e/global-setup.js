import { coverageReport } from "./coverage.js";

export default function globalSetup() {
  coverageReport().cleanCache();
}
