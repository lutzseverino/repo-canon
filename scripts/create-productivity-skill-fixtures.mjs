#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  commitFixture,
  identifyFixtureSource,
  initializeFixtureRepository,
} from "./support/fixture-authoring.mjs";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
const scriptSourcePath = "scripts/create-productivity-skill-fixtures.mjs";
const skillsRoot = join(sourceRoot, ".agents/skills");
const skillNames = ["grilling", "writing-for-agents"];
const sharedFiles = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "docs/agents/README.md",
  "docs/agents/domain.md",
  "docs/agents/issue-tracker.md",
  "docs/agents/triage-labels.md",
];

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  if (!process.argv[index + 1]) throw new Error(`${name} requires a value`);
  return process.argv[index + 1];
}

const requestedRoot = argument("--root");
const fixtureRoot =
  requestedRoot ??
  mkdtempSync(join(tmpdir(), "repo-canon-productivity-skills-"));
if (requestedRoot && existsSync(fixtureRoot)) {
  throw new Error(`Fixture root already exists: ${fixtureRoot}`);
}
mkdirSync(fixtureRoot, { recursive: true });

function write(root, path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function createRepository(
  name,
  skills,
  { context, project, development, files = {} },
) {
  const root = join(fixtureRoot, name);
  mkdirSync(root, { recursive: true });
  for (const path of sharedFiles)
    cpSync(join(sourceRoot, path), join(root, path), { recursive: true });
  write(root, "docs/agents/project.md", project);
  write(root, "GLOSSARY.md", context);
  write(root, "docs/development/README.md", development);
  for (const [path, content] of Object.entries(files))
    write(root, path, content);
  mkdirSync(join(root, ".agents/skills"), { recursive: true });
  for (const skill of skills)
    symlinkSync(
      join(skillsRoot, skill),
      join(root, ".agents/skills", skill),
      "dir",
    );
  initializeFixtureRepository(root, {
    author: { name: "Repo Canon Exercise", email: "exercise@example.invalid" },
  });
  return {
    path: root,
    skills,
    head: commitFixture(root, `chore: establish ${name} exercise`),
  };
}

const repositories = {};

repositories.grilling = createRepository("grilling", ["grilling"], {
  context: `# Batch exports\n\nLanguage for customer data exports.\n\n## Language\n\n**Export request**:\nA customer's request to produce one downloadable archive.\n_Avoid_: Job\n\n**Retry window**:\nThe period during which a failed Export request can be attempted again automatically.\n_Avoid_: Timeout\n`,
  project: `# Exercise repository guidance\n\nThis disposable repository holds an unsettled design for failed Export requests. Inspect the local constraints, map dependent decisions, and wait for controlled-participant answers between rounds. Do not implement the design.\n`,
  development: `# Development\n\nThe exercise is discussion-only. Product facts are in \`docs/export-constraints.md\`; no build or test command applies.\n`,
  files: {
    "docs/export-constraints.md": `# Export constraints\n\nArchives expire after 24 hours. The queue supports delayed delivery and records attempt count. Support staff can see failures but cannot replay requests. The first release must avoid new paid infrastructure.\n`,
  },
});

repositories["writing-for-agents"] = createRepository(
  "writing-for-agents",
  ["writing-for-agents"],
  {
    context: `# Catalog sync\n\nLanguage for synchronizing product catalogs.\n\n## Language\n\n**Catalog snapshot**:\nThe complete supplier catalog observed during one synchronization.\n_Avoid_: Data dump\n`,
    project: `# Catalog sync agent guidance\n\nThis disposable fixture needs clear routing. Always be careful and thorough. Always inspect everything before doing anything. Read docs/agents/sync.md before changing synchronization behavior. Read docs/agents/fixtures.md before changing supplier fixtures. Read both files whenever doing catalog work. Make sure to follow all relevant instructions and do not forget the tests.\n`,
    development: `# Development\n\nUse Node.js 24 or 26. Run \`npm test\` for JavaScript changes. Documentation-only pointer edits use \`git diff --check\`.\n`,
    files: {
      "docs/agents/sync.md": `# Synchronization behavior\n\nPreserve supplier ordering in each Catalog snapshot. Run \`npm test\` after behavior changes.\n`,
      "docs/agents/fixtures.md": `# Supplier fixtures\n\nKeep fixture supplier names fictional and use the reserved \`.example\` domain.\n`,
      "package.json": `${JSON.stringify({ name: "catalog-sync-exercise", private: true, type: "module", scripts: { test: "node --test" } }, null, 2)}\n`,
      "test/catalog.test.mjs": `import assert from 'node:assert/strict';\nimport { test } from 'node:test';\n\ntest('fixture is runnable', () => assert.equal(1, 1));\n`,
    },
  },
);

const provenance = identifyFixtureSource({
  sourceRoot,
  builderPath: scriptSourcePath,
  files: sharedFiles,
  directories: Object.fromEntries(
    skillNames.map((name) => [name, join(skillsRoot, name)]),
  ),
});

const manifest = {
  format: "repo-canon/productivity-skill-fixtures/v1",
  root: fixtureRoot,
  source: {
    worktreeCommit: provenance.head,
    builderSha256: provenance.inputFiles[scriptSourcePath].sha256,
    upstreamCommit: "24fe0ef7737efae15c87225755e9f6f5965e4888",
    directoryHashSerialization: provenance.directoryHashSerialization,
    inputFiles: provenance.inputFiles,
    skills: provenance.directories,
  },
  repositories,
};

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
