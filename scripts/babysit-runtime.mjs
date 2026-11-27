#!/usr/bin/env node

// Generate the standalone installation from the canonical runtime owners.
// Seam (deferred): standalone runtime packaging; consumers: babysit; extract at 3.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const runtimeFiles = [
  "LICENSE",
  "vendor/postern/README.md",
  "vendor/marked/README.md",
  "vendor/parse5/README.md",
  "vendor/postern/postern.mjs",
  "vendor/postern/LICENSE",
  "vendor/marked/marked.esm.js",
  "vendor/marked/LICENSE",
  "vendor/parse5/parse5.esm.js",
  "vendor/parse5/LICENSE.parse5",
  "vendor/parse5/LICENSE.entities",
  "vendor/repo-canon/validate-issue-contract.mjs",
  "operations/lib/canonical-labels.mjs",
  "operations/lib/rendered-markdown.mjs",
  "scripts/issue-contract-sources.mjs",
  "scripts/issue-contract-store.mjs",
];
export const runtimeDirectory = ".agents/skills/babysit/runtime";

export function runtimeContents(root, path) {
  let contents = readFileSync(join(root, path), "utf8");
  if (path === "scripts/issue-contract-store.mjs") {
    // Reuse the installed skill's connection and check interpretation in cycles.
    contents = contents.replaceAll("../.agents/skills/babysit/", "../../");
  }
  return contents;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).join(" ") !== "write") {
    console.error("Usage: node scripts/babysit-runtime.mjs write");
    process.exit(1);
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  rmSync(join(root, runtimeDirectory), { recursive: true, force: true });
  for (const path of runtimeFiles) {
    const destination = join(root, runtimeDirectory, path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, runtimeContents(root, path));
  }
  writeFileSync(
    join(root, runtimeDirectory, "package.json"),
    '{"type":"module"}\n',
  );
}
