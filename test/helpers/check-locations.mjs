// Disposable public-CLI fixtures for the check-location selection. The source
// serves the candidate at v1.0.0 and v1.1.0 and, at v0.9.0, the same content
// without check-location keys and with the CLI 10 minimum, so CLI 10 can record
// a legacy selection without `checks`. Only GitHub HTTP and Git transport use
// local fixtures; the adoptions and updates run the published CLI.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { fixtureAnswer } from "../../scripts/release/adoption.mjs";
import { fixtureSource, publicCli, sourceUrl } from "./fixture-source.mjs";

export { sourceUrl };
export const locations = ["github", "runner", "self-reported"];
// The workflow files Repo Canon installs at `github`, by profile.
export const repoCanonWorkflows = {
  standard: [
    ".github/workflows/issue-contracts.yml",
    ".github/workflows/pr-metadata.yml",
    ".github/workflows/standards-update.yml",
  ],
  factory: [
    ".github/workflows/issue-contracts.yml",
    ".github/workflows/pr-metadata.yml",
    ".github/workflows/sandbox-image.yml",
    ".github/workflows/standards-update.yml",
  ],
};
export const legacyVersion = "v0.9.0";
export const version = "v1.0.0";
export const nextVersion = "v1.1.0";
// The operative runner expression the retired variable needed.
export const runnerVariable = ["vars", "REPO_CANON_RUNS_ON"].join(".");

// Publishes the source tags and routes this process's CLI runs through the
// fixtures until the test `t` ends. Returns the public CLI 11.0.0 and the
// source validation.
export function checkLocationSource(t, root, directory) {
  const saved = { ...process.env };
  t.after(() => {
    for (const name of Object.keys(process.env))
      if (!(name in saved)) delete process.env[name];
    Object.assign(process.env, saved);
  });
  const cli = publicCli(directory);
  const validation = JSON.parse(
    execFileSync(cli, ["source", "validate", root, "--json"], {
      encoding: "utf8",
    }),
  );
  const { source, env, git, publish } = fixtureSource(directory, validation);
  const manifestPath = join(source, "standards.yaml");
  const manifest = readFileSync(manifestPath, "utf8");
  const legacy = manifest
    .replace('repo-standards: ">=11.0.0"', 'repo-standards: ">=10.0.0"')
    .replace(/^ *check-locations: .*\n/gm, "");
  assert.notEqual(legacy, manifest);
  assert.doesNotMatch(legacy, /check-locations/);
  const commit = (...args) =>
    git(source, "-c", "commit.gpgsign=false", "commit", "--quiet", ...args);
  const tag = (name) => git(source, "-c", "tag.gpgsign=false", "tag", name);
  writeFileSync(manifestPath, legacy);
  commit("-am", "Legacy selection");
  tag(legacyVersion);
  writeFileSync(manifestPath, manifest);
  commit("-am", "Check locations");
  tag(version);
  commit("--allow-empty", "-m", "Next release");
  tag(nextVersion);
  publish([nextVersion, version, legacyVersion]);
  Object.assign(process.env, env);
  return { cli, validation };
}

// The public CLI at `cliVersion`, installed in `directory`.
export function installCli(directory, cliVersion) {
  execFileSync(
    "npm",
    [
      "install",
      "--prefix",
      directory,
      "--ignore-scripts",
      "--registry=https://registry.npmjs.org",
      `@lutzseverino/repo-standards@${cliVersion}`,
    ],
    { stdio: "pipe" },
  );
  const cli = join(directory, "node_modules/.bin/repo-standards");
  assert.equal(
    execFileSync(cli, ["--version"], { encoding: "utf8" }).trim(),
    cliVersion,
  );
  return cli;
}

// Every project path outside Git and Repository Standards' own state.
export function projectFiles(project, directory = project) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      const name = relative(project, path);
      if (name === ".git" || name === ".repo-standards") return [];
      return entry.isDirectory() ? projectFiles(project, path) : [name];
    })
    .sort();
}

export const installedWorkflows = (project) =>
  projectFiles(project).filter((path) => path.startsWith(".github/workflows/"));

// No installed file reads the retired runner variable, and every installed
// Repo Canon job runs on literal `ubuntu-latest`. The repository-owned `own`
// files keep whatever they read.
export function assertHostedRunners(project, workflows, own = []) {
  for (const path of projectFiles(project).filter(
    (path) => !own.includes(path) && lstatSync(join(project, path)).isFile(),
  ))
    assert.ok(
      !readFileSync(join(project, path), "utf8").includes(runnerVariable),
      `${path} reads the retired runner variable`,
    );
  for (const path of workflows) {
    const runners = [
      ...readFileSync(join(project, path), "utf8").matchAll(
        /^ {4}runs-on: (.*)$/gm,
      ),
    ].map(([, value]) => value);
    assert.ok(runners.length > 0, `${path} declares a job`);
    for (const runner of runners) assert.equal(runner, "ubuntu-latest", path);
  }
}

export function commitAll(project, message) {
  const git = (...args) =>
    execFileSync(
      "git",
      [
        "-C",
        project,
        "-c",
        "user.name=Repo Canon check locations",
        "-c",
        "user.email=check-locations@example.invalid",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { encoding: "utf8" },
    );
  git("add", "--all");
  git("commit", "--quiet", "--no-verify", "--message", message);
}

export function invoke(cli, project, args) {
  const child = spawnSync(cli, [...args, "--json"], {
    cwd: project,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  assert.ifError(child.error);
  return JSON.parse(child.stdout || child.stderr);
}

// Runs `adopt` with `args` in an adopted project and answers only its missing
// questions with the release fixture's answers, until the run completes.
// Returns the first report, which carries the update proposal, and the last.
export function updateAdoption(cli, project, args, { profile, checks }) {
  const first = invoke(cli, project, ["adopt", ...args]);
  let report = first;
  for (let round = 0; report.outcome !== "complete" && round < 10; round++) {
    assert.ok(
      ["answers-required", "contextual"].includes(report.outcome),
      JSON.stringify({ outcome: report.outcome, blockers: report.blockers }),
    );
    assert.deepEqual(report.failedChecks ?? [], []);
    const questions = report.answers.questions.map((question) =>
      report.missing.includes(question.id)
        ? {
            ...question,
            answer: fixtureAnswer(
              question,
              report,
              report.selection.version,
              profile,
              checks,
            ),
          }
        : question,
    );
    const answers = join(project, "..", "update-answers.json");
    writeFileSync(
      answers,
      `${JSON.stringify({ ...report.answers, questions }, null, 2)}\n`,
    );
    report = invoke(cli, project, ["adopt", "--answers", answers]);
  }
  assert.equal(report.outcome, "complete", JSON.stringify(report.missing));
  return { first, report };
}

// The recorded check location that `status` reports as ready to commit.
export function statusLocation(cli, project) {
  const status = invoke(cli, project, ["status"]);
  assert.equal(status.readyToCommit, true, status.readinessReasons?.join(" "));
  return status.selection.checks;
}

export const exists = (project, path) => existsSync(join(project, path));
