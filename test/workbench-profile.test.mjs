import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  fixtureSource,
  publicCli,
  sourceUrl,
} from "./helpers/fixture-source.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The workflow skills, which the workbench profile installs as the standard
// profile does.
const skills = [
  "babysit",
  "code-review",
  "codebase-design",
  "diagnosing-bugs",
  "domain-modeling",
  "grill-with-docs",
  "grilling",
  "implement",
  "improve-codebase-architecture",
  "orchestrate",
  "pr",
  "prototype",
  "research",
  "tdd",
  "to-spec",
  "to-tickets",
  "triage",
  "wayfinder",
  "writing-for-agents",
];
// The files the installed skill executables import, and the license notices
// for the skills and those files, by declaration and installed path. `triage`'s
// readiness command imports the issue-contract validator, which imports the
// rendered-Markdown runtime and its parsers; `babysit`, `orchestrate`'s wait
// and that validator import Postern.
const support = {
  "humanlayer-skills-license": ".agents/skills/LICENSE.humanlayer-skills",
  "issue-contract-validator": "scripts/validate-issue-contract.mjs",
  "marked-license": "vendor/marked/LICENSE",
  "marked-parser": "vendor/marked/marked.esm.js",
  "marked-provenance": "vendor/marked/README.md",
  "mattpocock-skills-license": ".agents/skills/LICENSE.mattpocock-skills",
  "parse5-entities-license": "vendor/parse5/LICENSE.entities",
  "parse5-license": "vendor/parse5/LICENSE.parse5",
  "parse5-parser": "vendor/parse5/parse5.esm.js",
  "parse5-provenance": "vendor/parse5/README.md",
  "postern-bundle": "vendor/postern/postern.mjs",
  "postern-license": "vendor/postern/LICENSE",
  "postern-provenance": "vendor/postern/README.md",
  "rendered-markdown-runtime": "operations/lib/rendered-markdown.mjs",
};
// The installed commands, each of which prints its usage and exits 1 when run
// without arguments once every import resolves.
const commands = [
  "babysit/merge.mjs",
  "babysit/request.mjs",
  "babysit/wait.mjs",
  "orchestrate/wait.mjs",
  "triage/ready.mjs",
];

// The declaration IDs of `standards.yaml`'s defaults and each profile's
// exclusions, read from the manifest's own layout.
function manifestIds() {
  const manifest = readFileSync(join(root, "standards.yaml"), "utf8");
  const [, defaults, profiles] =
    /^defaults:\n {2}declarations:\n([\s\S]*?)^profiles:\n([\s\S]*)$/m.exec(
      manifest,
    );
  const workbench = /^ {2}workbench:\n([\s\S]*?)(?=^ {2}\S|(?![\s\S]))/m.exec(
    profiles,
  )[1];
  return {
    defaults: [...defaults.matchAll(/^ {4}([a-z0-9-]+):$/gm)].map(
      ([, id]) => id,
    ),
    excluded: [
      ...workbench.matchAll(/^ {6}([a-z0-9-]+): \{ exclude: true \}$/gm),
    ].map(([, id]) => id),
    added: [...workbench.matchAll(/^ {6}([a-z0-9-]+):$/gm)].map(([, id]) => id),
  };
}

const allowed = [
  ...skills.map((name) => `skill-${name}`),
  ...Object.keys(support),
].sort();

test("the workbench profile excludes every default but the workflow skills, their support files and license notices", () => {
  const { defaults, excluded, added } = manifestIds();
  assert.deepEqual(added, [], "the workbench profile adds no declaration");
  for (const id of excluded)
    assert.ok(defaults.includes(id), `${id} is a default declaration`);
  // A new default declaration fails here until the workbench excludes it or
  // this list admits it.
  assert.deepEqual(
    defaults.filter((id) => !excluded.includes(id)).sort(),
    allowed,
  );
  for (const id of [
    "issue-contract-workflow",
    "pr-metadata-workflow",
    "standards-update-workflow",
  ])
    assert.ok(excluded.includes(id), `the workbench profile excludes ${id}`);
});

test("public CLI 10.0.0 adopts the workbench profile into an empty repository and updates it in one direct commit", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "repo-canon-workbench-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const cli = publicCli(directory);
  const validation = JSON.parse(
    execFileSync(cli, ["source", "validate", root, "--json"], {
      encoding: "utf8",
    }),
  );
  assert.equal(validation.valid, true);
  const resolved = validation.profiles.workbench.declarations;
  assert.deepEqual(resolved.map(({ id }) => id).sort(), allowed);
  for (const declaration of resolved) {
    assert.ok(["file", "skill"].includes(declaration.kind), declaration.id);
    assert.equal(declaration.rules, undefined, declaration.id);
    assert.equal(declaration.guidance, undefined, declaration.id);
    assert.deepEqual(declaration.checks ?? [], [], declaration.id);
    assert.deepEqual(declaration.fixes ?? [], [], declaration.id);
    if (declaration.kind === "file") {
      assert.equal(declaration.target, support[declaration.id]);
      assert.ok(declaration.exact, declaration.id);
    }
  }
  // The other profiles keep their resolved declarations.
  assert.equal(validation.profiles.standard.declarations.length, 60);
  assert.equal(validation.profiles.factory.declarations.length, 64);

  const { source, env, git, publish } = fixtureSource(directory, validation);
  git(source, "-c", "tag.gpgsign=false", "tag", "v1.0.0");
  // The next release changes one installed skill.
  appendFileSync(
    join(source, ".agents/skills/orchestrate/SKILL.md"),
    "\nA fixture release's change.\n",
  );
  git(source, "-c", "commit.gpgsign=false", "commit", "--quiet", "-am", "Next");
  git(source, "-c", "tag.gpgsign=false", "tag", "v1.0.1");
  publish(["v1.0.1", "v1.0.0"]);

  const project = join(directory, "workbench");
  mkdirSync(project);
  const commit = (message) => {
    git(project, "add", "--all");
    git(
      project,
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      message,
    );
  };
  git(project, "init", "--quiet", "--initial-branch=main");
  commit("Create the workbench");
  const invoke = (...args) => {
    const child = spawnSync(cli, [...args, "--project", project, "--json"], {
      cwd: project,
      env,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    assert.ifError(child.error);
    return { report: JSON.parse(child.stdout || child.stderr), child };
  };
  // The workbench profile asks no scope, assessment or remote setup question.
  const adopt = (...args) => {
    let { report } = invoke("adopt", ...args);
    for (let round = 0; report.outcome !== "complete" && round < 5; round++) {
      assert.equal(report.outcome, "answers-required", JSON.stringify(report));
      for (const { id } of report.answers.questions)
        assert.ok(["version", "profile", "inspection"].includes(id), id);
      const answers = join(directory, "answers.json");
      writeFileSync(answers, JSON.stringify(report.answers));
      ({ report } = invoke("adopt", "--answers", answers));
    }
    assert.equal(report.outcome, "complete", JSON.stringify(report));
    assert.deepEqual(report.contextual ?? [], []);
    const { report: status } = invoke("status");
    assert.equal(status.readyToCommit, true, JSON.stringify(status));
    assert.deepEqual(status.deferred, []);
    assert.equal(status.selection.profile, "workbench");
    return status;
  };

  assert.equal(
    adopt(sourceUrl, "--standards-version", "v1.0.0", "--profile", "workbench")
      .selection.standards.version,
    "v1.0.0",
  );
  // Apart from the skills and the CLI's own bookkeeping, adoption writes
  // only the support files, and no rules, workflow or other convention.
  const written = git(project, "ls-files", "--others", "--exclude-standard")
    .split("\n")
    .filter(
      (path) =>
        !/^(?:\.agents\/skills\/[a-z-]+\/|\.claude\/skills\/|\.repo-standards\/)/.test(
          path,
        ),
    );
  assert.deepEqual(written.sort(), Object.values(support).sort());
  assert.deepEqual(
    readdirSync(join(project, ".agents/skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map(({ name }) => name)
      .filter((name) => name !== "repository-standards"),
    skills,
  );
  for (const path of [".github", ".repo-standards/rules", "AGENTS.md"])
    assert.equal(existsSync(join(project, path)), false, path);
  const { report: lookup, child: lookupChild } = invoke("rules");
  assert.equal(lookupChild.status, 0, JSON.stringify(lookup));
  assert.deepEqual(lookup.rules, []);
  for (const command of commands) {
    const child = spawnSync(
      process.execPath,
      [join(project, ".agents/skills", command)],
      { cwd: project, env: { PATH: process.env.PATH }, encoding: "utf8" },
    );
    assert.equal(child.status, 1, `${command}: ${child.stderr}`);
    assert.match(child.stderr, /usage/i, command);
  }
  commit("Adopt Repo Canon v1.0.0");

  // An update in the adopted workbench advances the pinned skill and lands as
  // one direct commit on the default branch.
  assert.equal(adopt().selection.standards.version, "v1.0.1");
  commit("Update Repo Canon to v1.0.1");
  assert.equal(git(project, "branch", "--show-current"), "main");
  assert.equal(git(project, "rev-list", "--count", "HEAD"), "3");
  assert.equal(git(project, "status", "--porcelain"), "");
  const changed = git(project, "diff", "--name-only", "HEAD~1", "HEAD").split(
    "\n",
  );
  assert.ok(changed.includes(".agents/skills/orchestrate/SKILL.md"));
  for (const path of changed)
    assert.match(
      path,
      /^(?:\.agents\/skills\/orchestrate\/|\.repo-standards\/)/,
      path,
    );
  assert.deepEqual(
    readFileSync(join(project, ".agents/skills/orchestrate/SKILL.md")),
    readFileSync(join(source, ".agents/skills/orchestrate/SKILL.md")),
  );
});
