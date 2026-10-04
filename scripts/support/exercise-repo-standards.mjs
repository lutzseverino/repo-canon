#!/usr/bin/env node

// A stand-in for the pinned Repository Standards CLI in the deliver skill
// exercise. It answers `status` for the completed adoption run the builder
// recorded, so the exercise needs no real adoption or network. Every other
// command fails.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const records = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".exercise",
);
const args = process.argv
  .slice(2)
  .filter(
    (argument, index, all) =>
      argument !== "--project" &&
      all[index - 1] !== "--project" &&
      !argument.startsWith("--project="),
  );

if (args[0] === "--version") {
  process.stdout.write("4.0.0\n");
} else if (
  args[0] === "status" &&
  args.includes("--json") &&
  !args.includes("--summary")
) {
  process.stdout.write(readFileSync(join(records, "status.json"), "utf8"));
} else if (
  args[0] === "status" &&
  args.includes("--summary") &&
  !args.includes("--json")
) {
  process.stdout.write(readFileSync(join(records, "summary.md"), "utf8"));
} else {
  process.stderr.write(
    `The exercise stand-in for repo-standards does not support: repo-standards ${process.argv.slice(2).join(" ")}\n`,
  );
  process.exitCode = 1;
}
