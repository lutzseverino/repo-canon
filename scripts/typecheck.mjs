#!/usr/bin/env node

// Type-checks Repo Canon's JavaScript with TypeScript's `checkJs`, as
// `tsconfig.json` configures it, and fails on any diagnostic outside the
// vendored bundles. The bundles keep their upstream bytes, so they cannot opt
// out with a `@ts-nocheck` comment, and the authored files that import them
// bring them into the program.
//
// Usage: node scripts/typecheck.mjs
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const vendoredFiles = [
  "vendor/marked/marked.esm.js",
  "vendor/parse5/parse5.esm.js",
  "vendor/postern/postern.mjs",
];

// Splits `tsc --pretty false` output into diagnostics, each its first line
// and the indented lines that continue it.
export function diagnostics(output) {
  /** @type {string[][]} */
  const found = [];
  for (const line of output.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    if (/^\s/.test(line) && found.length > 0) found.at(-1).push(line);
    else found.push([line]);
  }
  return found.map((lines) => lines.join("\n"));
}

// The diagnostics that are not located in a vendored file, including those
// located in no file.
export function authoredDiagnostics(output) {
  return diagnostics(output).filter(
    (diagnostic) =>
      !vendoredFiles.some((path) => diagnostic.startsWith(`${path}(`)),
  );
}

function executedAsScript() {
  if (!process.argv[1]) return false;
  return (
    realpathSync(process.argv[1]) ===
    realpathSync(fileURLToPath(import.meta.url))
  );
}

if (import.meta.main ?? executedAsScript()) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const manifest = createRequire(import.meta.url).resolve(
    "typescript/package.json",
  );
  const tsc = join(dirname(manifest), "bin/tsc");
  const result = spawnSync(
    process.execPath,
    [tsc, "--project", join(root, "tsconfig.json"), "--pretty", "false"],
    { cwd: root, encoding: "utf8" },
  );
  if (result.error) throw result.error;
  const authored = authoredDiagnostics(result.stdout);
  if (authored.length > 0) {
    process.stderr.write(`${authored.join("\n")}\n`);
    process.exitCode = 1;
  } else if (result.status !== 0 && diagnostics(result.stdout).length === 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exitCode = result.status ?? 1;
  }
}
