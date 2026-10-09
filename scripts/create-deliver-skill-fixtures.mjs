#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
const scriptSourcePath = "scripts/create-deliver-skill-fixtures.mjs";
const ghStandInPath = "scripts/support/exercise-gh.mjs";
const cliStandInPath = "scripts/support/exercise-repo-standards.mjs";
const skillPath = join(sourceRoot, ".agents/skills/deliver");
const pullRequestTemplatePath = ".github/PULL_REQUEST_TEMPLATE.md";
// The exact files an adopting repository holds that delivery reads, plus the
// trusted PR metadata validator and the runtime it imports, which the
// stand-in's PR metadata check runs from the base branch.
const sharedFiles = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  pullRequestTemplatePath,
  ".github/workflows/pr-metadata.yml",
  ".github/scripts/validate-pr-metadata.mjs",
  "operations/lib/rendered-markdown.mjs",
  "vendor/marked/LICENSE",
  "vendor/marked/README.md",
  "vendor/marked/marked.esm.js",
  "vendor/parse5/LICENSE.entities",
  "vendor/parse5/LICENSE.parse5",
  "vendor/parse5/README.md",
  "vendor/parse5/parse5.esm.js",
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
  requestedRoot ?? mkdtempSync(join(tmpdir(), "repo-canon-deliver-skill-"));
if (requestedRoot && existsSync(fixtureRoot)) {
  throw new Error(`Fixture root already exists: ${fixtureRoot}`);
}
mkdirSync(fixtureRoot, { recursive: true });

function write(root, path, content) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function installExecutable(source, target) {
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(sourceRoot, source), target);
  chmodSync(target, 0o755);
}

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

const ghBin = join(fixtureRoot, "bin");
installExecutable(ghStandInPath, join(ghBin, "gh"));
write(fixtureRoot, "github/calls.jsonl", "");

const projectGuidance = `# Exercise guidance

This repository is disposable. Its \`origin\` is a local bare repository, and
the \`gh\` on \`PATH\` is a local stand-in for GitHub CLI that records pull
requests and comments instead of publishing them and runs a pull request's
checks locally. Reach GitHub only through that \`gh\`.
`;
const development = `# Development

Development commands for the Parcel desk.

## Setup and validation

Use Node.js 24; the project has no dependencies to install. Run \`npm test\` and
\`git diff --check\` before opening a pull request.
`;
const context = `# Parcel desk

## Language

**Parcel**:
A shipment accepted by the desk.
_Avoid_: Package, item

**Parcel reference**:
The carrier-supplied identifier of one Parcel.
_Avoid_: Tracking code
`;
const packageJson = `${JSON.stringify(
  {
    name: "parcel-desk",
    private: true,
    type: "module",
    scripts: { test: "node --test" },
  },
  null,
  2,
)}\n`;
const acceptParcel = `export function acceptParcel(parcel) {
  return { ...parcel, accepted: true };
}
`;

function createRepository(name, { files = {} } = {}) {
  const root = join(fixtureRoot, name);
  mkdirSync(root, { recursive: true });
  for (const path of sharedFiles)
    write(root, path, readFileSync(join(sourceRoot, path)));
  write(root, "docs/agents/project.md", projectGuidance);
  write(root, "docs/development/README.md", development);
  write(root, "GLOSSARY.md", context);
  write(root, "package.json", packageJson);
  write(root, "src/parcel.mjs", acceptParcel);
  write(
    root,
    "test/parcel.test.mjs",
    `import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptParcel } from '../src/parcel.mjs';

test('accepts a Parcel', () => {
  assert.equal(acceptParcel({ reference: 'P-1' }).accepted, true);
});
`,
  );
  for (const [path, content] of Object.entries(files))
    write(root, path, content);
  mkdirSync(join(root, ".agents/skills"), { recursive: true });
  symlinkSync(skillPath, join(root, ".agents/skills/deliver"), "dir");

  const remote = join(fixtureRoot, "remotes", `${name}.git`);
  mkdirSync(dirname(remote), { recursive: true });
  execFileSync("git", [
    "init",
    "--quiet",
    "--bare",
    "--initial-branch=main",
    remote,
  ]);
  initializeFixtureRepository(root, {
    author: { name: "Repo Canon Exercise", email: "exercise@example.invalid" },
    remote,
  });
  const head = commitFixture(root, `chore: establish ${name} exercise`);
  git(root, "push", "--quiet", "origin", "main");
  git(root, "branch", "--quiet", "--set-upstream-to=origin/main", "main");
  return { path: root, remote, skills: ["deliver"], head };
}

const repositories = {};

// Ordinary completed work: uncommitted changes on the default branch that
// implement a ready implementation ticket.
{
  const issue = {
    number: 12,
    title: "Reject empty Parcel references",
    state: "OPEN",
    author: { login: "exercise-maintainer" },
    labels: [{ name: "ready-for-agent" }],
    url: "https://github.example.invalid/parcel/work/issues/12",
    body: `## What to build

\`acceptParcel()\` rejects a Parcel whose Parcel reference is missing or blank,
instead of accepting it.

## Acceptance criteria

- [ ] A missing or blank Parcel reference throws a \`TypeError\` naming the field.
- [ ] A Parcel with a Parcel reference is accepted as before.

## Blocked by

- None (can start immediately)
`,
    comments: [],
  };
  write(
    fixtureRoot,
    `github/work/issues/${issue.number}.json`,
    `${JSON.stringify(issue, null, 2)}\n`,
  );
  const repository = createRepository("work");
  write(
    repository.path,
    "src/parcel.mjs",
    `export function acceptParcel(parcel) {
  if (typeof parcel.reference !== 'string' || parcel.reference.trim() === '') {
    throw new TypeError('A Parcel needs a Parcel reference');
  }
  return { ...parcel, accepted: true };
}
`,
  );
  write(
    repository.path,
    "test/parcel-reference.test.mjs",
    `import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptParcel } from '../src/parcel.mjs';

test('rejects a missing or blank Parcel reference', () => {
  assert.throws(() => acceptParcel({}), /Parcel reference/);
  assert.throws(() => acceptParcel({ reference: '  ' }), /Parcel reference/);
});
`,
  );
  repositories.work = { ...repository, issue: issue.number };
}

// An adoption run's uncommitted changes: an update from Repo Canon v0.4.0 to
// v0.4.1 that replaced the pull request template and rewrote the product
// state, with the pinned CLI answering `status` for the completed run.
{
  const template = readFileSync(
    join(sourceRoot, pullRequestTemplatePath),
    "utf8",
  );
  const previousTemplate = template.replace(
    /\n<!-- For a breaking change[^\n]*-->\n$/,
    "\n",
  );
  if (previousTemplate === template)
    throw new Error(
      "The pull request template no longer ends with its breaking-change comment.",
    );
  const selection = (version) =>
    `cli: 4.0.0\nstandards:\n  repository: https://github.com/lutzseverino/repo-canon\n  version: ${version}\nprofile: complete\n`;
  const state = (version, run) =>
    `${JSON.stringify({ exercise: "stand-in product state", standards: version, run }, null, 2)}\n`;
  const repository = createRepository("adoption", {
    files: {
      [pullRequestTemplatePath]: previousTemplate,
      ".repo-standards/.gitignore":
        "/runtime/node_modules/\n/local/\n/cache/\n",
      ".repo-standards/selection.yaml": selection("v0.4.0"),
      ".repo-standards/state.json": state(
        "v0.4.0",
        "5b0e7c52-4a8e-4c1e-9d5e-1f0a2b3c4d5e",
      ),
    },
  });
  const root = repository.path;
  const run = "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a";
  const inspection =
    "sha256:3f1c9a7e5b2d4f6a8c0e1b3d5f7a9c2e4b6d8f0a1c3e5b7d9f2a4c6e8b0d1f3a";
  const completedAt = "2026-10-04T09:30:00.000Z";
  write(root, pullRequestTemplatePath, template);
  write(root, ".repo-standards/selection.yaml", selection("v0.4.1"));
  write(root, ".repo-standards/state.json", state("v0.4.1", run));
  const status = {
    format: "repo-standards/status/v6",
    selection: {
      cli: { package: "@lutzseverino/repo-standards", version: "4.0.0" },
      standards: {
        repository: "https://github.com/lutzseverino/repo-canon",
        version: "v0.4.1",
        commit: "e6ab5d712d61ca08e1b1b90686892b9b8c2aa7ff",
      },
      profile: "complete",
    },
    lastComplete: { run, inspection, completedAt, head: repository.head },
    changeSet: [{ path: pullRequestTemplatePath, phases: ["installation"] }],
    active: null,
    abandoned: [],
  };
  const summary = `# Repository Standards adoption record

## Selection

| Component | Value |
| --- | --- |
| CLI | \`4.0.0\` |
| Standards source | \`https://github.com/lutzseverino/repo-canon\` |
| Standards version | \`v0.4.1\` |
| Standards commit | \`e6ab5d712d61ca08e1b1b90686892b9b8c2aa7ff\` |
| Profile | \`complete\` |

## Operations

| Phase | Declaration | Operation | Result | Message |
| --- | --- | --- | --- | --- |
| checks | \`documentation\` | \`documentation-navigation\` | passed | Documentation navigation is valid; content placement and usefulness still require maintainer or agent review. |
| checks | \`repository-readme\` | \`repository-readme-structure\` | passed | Repository README structure is valid; factual content still requires maintainer or agent review. |

## Changed paths

| Path | Phases |
| --- | --- |
| \`${pullRequestTemplatePath}\` | installation |

## Identities

| Record | Value |
| --- | --- |
| Run | \`${run}\` |
| Inspection | \`${inspection}\` |
| HEAD at start | \`${repository.head}\` |
| Completed at | ${completedAt} |
`;
  const runtime = join(root, ".repo-standards/runtime/node_modules");
  installExecutable(cliStandInPath, join(runtime, ".bin/repo-standards"));
  write(
    runtime,
    ".exercise/status.json",
    `${JSON.stringify(status, null, 2)}\n`,
  );
  write(runtime, ".exercise/summary.md", summary);
  repositories.adoption = repository;
}

const provenance = identifyFixtureSource({
  sourceRoot,
  builderPath: scriptSourcePath,
  files: [...sharedFiles, ghStandInPath, cliStandInPath],
  directories: { deliver: skillPath },
});

const manifest = {
  format: "repo-canon/deliver-skill-fixtures/v1",
  root: fixtureRoot,
  path: ghBin,
  github: join(fixtureRoot, "github"),
  source: {
    worktreeCommit: provenance.head,
    builderSha256: provenance.inputFiles[scriptSourcePath].sha256,
    directoryHashSerialization: provenance.directoryHashSerialization,
    inputFiles: provenance.inputFiles,
    skills: provenance.directories,
  },
  repositories,
};

process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
