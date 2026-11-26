import "./helpers/temporary-directory.mjs";
// The check-location selection: the source offers all three locations in the
// standard and factory profiles, Repo Canon's workflows apply only at
// `github`, and the retired runner variable has no operative use. The public
// CLI 12.0.0 validates the source, resolves each location and adopts both
// project profiles at each, through the flag and the answers routes.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseStandards } from "../scripts/standards-declarations.mjs";
import { adoptFixture } from "../scripts/release/adoption.mjs";
import {
  assertHostedRunners,
  checkLocationSource,
  installedWorkflows,
  invoke,
  locations,
  nextVersion,
  projectFiles,
  repoCanonWorkflows,
  runnerVariable,
  sourceUrl,
  version,
} from "./helpers/check-locations.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowDeclarations = [
  "issue-contract-workflow",
  "pr-metadata-workflow",
  "standards-update-workflow",
  "factory-sandbox-image-workflow",
];
// The documents that may name the retired variable, and only to explain its
// retirement or the decision that replaced it.
const retirementMentions = [
  "rules/github-repository-configuration.md",
  "guidance/github-repository-configuration.md",
  "discovery/github-repository-configuration.md",
  "docs/usage/adopt-repo-canon.md",
  "docs/adr/0034-choose-where-checks-run-at-adoption.md",
  "docs/adr/0054-trust-the-runner-account-a-repository-variable-names.md",
];
// The inventory itself, which names the variable to search for it.
const inventory = [
  "test/check-locations.test.mjs",
  "test/helpers/check-locations.mjs",
];

test("the source offers every check location in the project profiles and installs workflows only at github", () => {
  const manifest = parseStandards(
    readFileSync(join(root, "standards.yaml"), "utf8"),
  );
  assert.equal(manifest.format, "repo-standards/v2");
  assert.equal(manifest.requires["repo-standards"], ">=12.0.0");
  for (const profile of ["standard", "factory"])
    assert.deepEqual(manifest.profiles[profile]["check-locations"], locations);
  assert.equal(manifest.profiles.workbench["check-locations"], undefined);
  const filtered = [
    ...Object.entries(manifest.defaults.declarations),
    ...Object.values(manifest.profiles).flatMap((profile) =>
      Object.entries(profile.declarations),
    ),
  ].filter(([, declaration]) => declaration["check-locations"]);
  assert.deepEqual(
    filtered.map(([id, declaration]) => [id, declaration["check-locations"]]),
    workflowDeclarations.map((id) => [id, ["github"]]),
  );
  for (const [, declaration] of filtered)
    assert.match(declaration.target, /^\.github\/workflows\/[\w-]+\.yml$/);
});

test("no source file uses the retired runner variable", () => {
  const paths = execFileSync(
    "git",
    ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard"],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter((path) => path && !path.startsWith(".repo-standards/"));
  const mentioning = [];
  for (const path of paths) {
    let text;
    try {
      text = readFileSync(join(root, path), "utf8");
    } catch {
      continue;
    }
    assert.ok(!text.includes(runnerVariable), `${path} reads the variable`);
    const lines = text
      .split("\n")
      .filter((line) => line.includes("REPO_CANON_RUNS_ON"));
    if (lines.length === 0 || inventory.includes(path)) continue;
    mentioning.push(path);
    for (const line of lines)
      assert.match(line, /retire|replace/, `${path}: ${line}`);
  }
  assert.deepEqual(mentioning.sort(), [...retirementMentions].sort());
});

test("public CLI 12.0.0 resolves and adopts the standard and factory profiles at every check location", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "repo-canon-locations-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const { cli, validation } = checkLocationSource(t, root, directory);
  // Source validity: the offers and each declaration's filter.
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  for (const [name, profile] of Object.entries(validation.profiles)) {
    assert.deepEqual(
      profile["check-locations"],
      name === "workbench" ? ["github"] : locations,
      name,
    );
    assert.deepEqual(
      profile.declarations
        .filter((declaration) => declaration["check-locations"])
        .map(({ target }) => target)
        .sort(),
      repoCanonWorkflows[name] ?? [],
      name,
    );
  }

  // Resolved applicability: inspection at each location, and the question a
  // fresh adoption asks without a choice.
  const empty = join(directory, "empty");
  mkdirSync(empty);
  execFileSync("git", ["init", "--quiet", empty]);
  for (const profile of ["standard", "factory", "workbench"]) {
    for (const checks of profile === "workbench" ? ["github"] : locations) {
      const inspection = invoke(cli, empty, [
        "inspect",
        "--source",
        sourceUrl,
        "--standards-version",
        version,
        "--profile",
        profile,
        "--checks",
        checks,
      ]);
      assert.equal(inspection.selection?.checks, checks, profile);
      assert.deepEqual(
        (inspection.sourceResolved ?? inspection.resolved).declarations
          .map(({ target }) => target)
          .filter((target) => target?.startsWith(".github/workflows/"))
          .sort(),
        checks === "github" ? (repoCanonWorkflows[profile] ?? []) : [],
        `${profile} at ${checks}`,
      );
    }
  }
  const unchosen = invoke(cli, empty, [
    "adopt",
    sourceUrl,
    "--standards-version",
    version,
    "--profile",
    "standard",
  ]);
  assert.equal(unchosen.outcome, "answers-required");
  assert.deepEqual(unchosen.missing, ["checks"]);
  assert.equal(unchosen.selection.checks, null);
  assert.deepEqual(
    unchosen.answers.questions.find(({ id }) => id === "checks").choices,
    locations,
  );

  const { "update-command": updateCommand } = parseStandards(
    readFileSync(join(root, "standards.yaml"), "utf8"),
  );
  assert.equal(typeof updateCommand, "string");

  // Installed output: the flag selects `runner`, the answers file the others.
  for (const profile of ["standard", "factory"]) {
    const installed = {};
    for (const checks of locations) {
      const fixture = join(directory, `${profile}-${checks}`);
      mkdirSync(fixture);
      const { project, status } = adoptFixture(
        cli,
        sourceUrl,
        version,
        profile,
        "12.0.0",
        fixture,
        checks === "runner"
          ? {
              initialArgs: [
                "--standards-version",
                version,
                "--profile",
                profile,
                "--checks",
                checks,
              ],
            }
          : { checks },
      );
      assert.equal(status.selection.checks, checks, `${profile} at ${checks}`);
      const workflows = installedWorkflows(project);
      assert.deepEqual(
        workflows,
        checks === "github" ? repoCanonWorkflows[profile] : [],
        `${profile} at ${checks}`,
      );
      const outdated = invoke(cli, project, ["outdated"]);
      assert.equal(outdated.format, "repo-standards/outdated/v3");
      assert.equal(outdated.cli.update, "none");
      assert.deepEqual(outdated.standards.adopterActions, [
        { version: nextVersion, action: null },
      ]);
      assert.equal(outdated.standards.update, "available");
      assert.equal(outdated.standards.newest, nextVersion);
      if (checks === "github") {
        assert.ok(!Object.hasOwn(outdated.standards, "updateCommand"));
      } else {
        assert.equal(outdated.standards.updateCommand, updateCommand);
      }
      assertHostedRunners(project, workflows);
      installed[checks] = projectFiles(project);
    }
    // Every other installed file is the same at each location.
    for (const checks of ["runner", "self-reported"]) {
      assert.deepEqual(
        installed.github.filter((path) => !installed[checks].includes(path)),
        repoCanonWorkflows[profile],
        `${profile}: github adds exactly its workflows to ${checks}`,
      );
      assert.deepEqual(
        installed[checks].filter((path) => !installed.github.includes(path)),
        [],
        `${profile}: ${checks} installs nothing github lacks`,
      );
    }
    for (const path of [
      "CONTRIBUTING.md",
      ".github/scripts/validate.mjs",
      ".github/scripts/validate-pr-metadata.mjs",
      "scripts/issue-contract-cutoff.mjs",
      ...(profile === "factory"
        ? [
            ".scriptorium/config.json",
            ".scriptorium/Dockerfile",
            "vendor/repo-canon/sandbox-image.mjs",
          ]
        : []),
    ])
      assert.ok(installed.runner.includes(path), `${profile} keeps ${path}`);
  }
});
