import "./helpers/temporary-directory.mjs";
// Updates that keep or change the check location, through the public CLIs.
// A deliberate update switching from `github` to `runner` or `self-reported`
// reports and applies the ordinary owned-workflow removals, and switching back
// adds them; repository-owned workflows and unrelated files survive. A
// headless update keeps the recorded location. A legacy CLI 10 selection
// without `checks` continues at `github` through CLI 11 and CLI 12. No
// selection, lock or remote variable is edited to make a transition.

import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { adoptFixture } from "../scripts/release/adoption.mjs";
import {
  assertHostedRunners,
  checkLocationSource,
  commitAll,
  installCli,
  installedWorkflows,
  invoke,
  legacyVersion,
  nextVersion,
  previousVersion,
  repoCanonWorkflows,
  runnerVariable,
  sourceUrl,
  statusLocation,
  updateAdoption,
  version,
} from "./helpers/check-locations.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ownFiles = {
  ".github/workflows/wordtally.yml": `name: Wordtally\non: push\njobs:\n  test:\n    runs-on: \${{ ${runnerVariable} }}\n    steps:\n      - run: node --test\n`,
  "notes/unrelated.md": "# Unrelated notes\n",
};

function setup(t) {
  const directory = mkdtempSync(join(tmpdir(), "repo-canon-location-update-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, ...checkLocationSource(t, root, directory) };
}

function adopt(cli, directory, label, profile, options) {
  const fixture = join(directory, label);
  mkdirSync(fixture);
  const { project } = adoptFixture(
    cli,
    sourceUrl,
    version,
    profile,
    "12.0.0",
    fixture,
    options,
  );
  return project;
}

// Switches `project` to `checks` with `--checks` and asserts the proposal's
// changed location and its workflow additions or removals.
function switchLocation(cli, project, profile, from, checks) {
  const { first } = updateAdoption(cli, project, ["--checks", checks], {
    profile,
    checks,
  });
  const summary = first.inspection.summary;
  assert.ok(
    summary.includes(`| Check location | \`${from}\` | \`${checks}\` |`),
    summary,
  );
  assert.match(summary, /^Changed components: .*\bchecks\b/m);
  for (const path of repoCanonWorkflows[profile]) {
    const row = summary
      .split("\n")
      .find((line) => line.includes(`| \`${path}\` |`));
    assert.ok(row, `the proposal lists ${path}`);
    if (checks === "github") assert.doesNotMatch(row, /deleted/, row);
    else assert.match(row, /\| deleted \|$/, row);
  }
  assert.equal(statusLocation(cli, project), checks);
  const workflows = installedWorkflows(project);
  assert.deepEqual(
    workflows.filter((path) => !(path in ownFiles)),
    checks === "github" ? repoCanonWorkflows[profile] : [],
  );
  assertHostedRunners(
    project,
    workflows.filter((path) => !(path in ownFiles)),
    Object.keys(ownFiles),
  );
  for (const [path, content] of Object.entries(ownFiles))
    assert.equal(readFileSync(join(project, path), "utf8"), content, path);
  commitAll(project, `Check location ${checks}`);
}

function addOwnFiles(project) {
  for (const [path, content] of Object.entries(ownFiles)) {
    mkdirSync(dirname(join(project, path)), { recursive: true });
    writeFileSync(join(project, path), content);
  }
  commitAll(project, "Repository-owned files");
}

test("public CLI 12.0.0 updates remove and restore Repo Canon's workflows when the check location changes", (t) => {
  const { cli, directory } = setup(t);
  for (const [profile, away] of [
    ["factory", "runner"],
    ["standard", "self-reported"],
  ]) {
    const project = adopt(cli, directory, profile, profile, {});
    assert.equal(statusLocation(cli, project), "github");
    commitAll(project, "Adopt at github");
    addOwnFiles(project);
    switchLocation(cli, project, profile, "github", away);
    switchLocation(cli, project, profile, away, "github");
  }
});

test("a headless update keeps the recorded check location", (t) => {
  const { cli, directory } = setup(t);
  const project = adopt(cli, directory, "headless", "standard", {
    checks: "self-reported",
  });
  assert.equal(statusLocation(cli, project), "self-reported");
  commitAll(project, "Adopt self-reported");
  const { first } = updateAdoption(cli, project, ["--headless"], {
    profile: "standard",
    checks: "github",
  });
  assert.equal(first.selection.version, nextVersion);
  assert.equal(first.selection.checks, "self-reported");
  assert.ok(!(first.missing ?? []).includes("checks"));
  assert.equal(statusLocation(cli, project), "self-reported");
  assert.deepEqual(installedWorkflows(project), []);
  const rejected = invoke(cli, project, [
    "adopt",
    "--headless",
    "--checks",
    "github",
  ]);
  assert.ok(rejected.errors?.length, JSON.stringify(rejected).slice(0, 1000));
});

test("a legacy CLI 10 selection continues at github through CLI 11 and CLI 12", (t) => {
  const { cli, directory } = setup(t);
  const cli10 = installCli(join(directory, "cli-10"), "10.0.0");
  const fixture = join(directory, "legacy");
  mkdirSync(fixture);
  const { project, status } = adoptFixture(
    cli10,
    sourceUrl,
    legacyVersion,
    "standard",
    "10.0.0",
    fixture,
    {
      initialArgs: [
        "--standards-version",
        legacyVersion,
        "--profile",
        "standard",
      ],
      formats: ["repo-standards/adopt/v2"],
    },
  );
  assert.equal(status.selection.checks, undefined);
  assert.doesNotMatch(
    readFileSync(join(project, ".repo-standards/selection.yaml"), "utf8"),
    /^checks:/m,
  );
  commitAll(project, "Adopt with CLI 10");

  // CLI 12 updates lock/v2 adoptions from CLI 11. Use CLI 11 first to
  // carry the CLI 10 adoption and its implicit github choice forward.
  const cli11 = installCli(join(directory, "cli-11"), "11.0.0");
  const { first } = updateAdoption(
    cli11,
    project,
    ["--standards-version", previousVersion],
    { profile: "standard", checks: "runner" },
  );
  assert.equal(first.selection.checks, "github");
  assert.ok(!(first.missing ?? []).includes("checks"));
  assert.equal(statusLocation(cli11, project), "github");
  commitAll(project, "Update with CLI 11");

  updateAdoption(cli, project, ["--standards-version", version], {
    profile: "standard",
    checks: "runner",
  });
  assert.equal(statusLocation(cli, project), "github");
  assert.match(
    readFileSync(join(project, ".repo-standards/selection.yaml"), "utf8"),
    /^checks: github$/m,
  );
  assert.deepEqual(installedWorkflows(project), repoCanonWorkflows.standard);
  assertHostedRunners(project, repoCanonWorkflows.standard);
});
