import { readFileSync } from "node:fs";

// Installed at <fixture>/.agents/skills/repository-standards/rules.mjs.
const root = new URL("../../../", import.meta.url);
const index = JSON.parse(
  readFileSync(new URL(".repo-standards/rules/index.json", root), "utf8"),
);
if (process.argv.length > 3)
  throw new Error(
    "Usage: node .agents/skills/repository-standards/rules.mjs [path]",
  );

console.log(
  `Repository-wide rules (local exercise, profile ${index.profile}):`,
);
for (const rule of index.rules) {
  console.log(
    `\n## ${rule.declaration} (${rule.path}), the whole repository\n`,
  );
  console.log(readFileSync(new URL(rule.path, root), "utf8"));
}
