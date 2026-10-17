import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
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
import {
  assessments,
  files,
  scopes,
} from "../scripts/release/adoption-fixture.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceUrl = "https://github.com/fixture/repo-canon";
const version = "v1.0.0";
// Declarations whose rules govern all work, with empty confirmed scope, and
// the profiles that select them.
const repositoryWide = {
  "github-repository-configuration": ["standard", "factory"],
  "factory-workflow": ["factory"],
};

// Exercise the published CLI, with its real acquisition, adoption, installation
// and rules lookup. Only GitHub HTTP and Git transport use disposable fixtures.
// No Scriptorium implementation or host is needed.
test("public CLI 7.1.0 installs the GitHub rules for the whole repository in both profiles, and factory workflow rules only in the factory profile", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "repo-canon-workflow-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const prefix = process.env.REPO_STANDARDS_PREFIX ?? join(directory, "cli");
  if (!process.env.REPO_STANDARDS_PREFIX)
    execFileSync(
      "npm",
      [
        "install",
        "--prefix",
        prefix,
        "--ignore-scripts",
        "--registry=https://registry.npmjs.org",
        "@lutzseverino/repo-standards@7.1.0",
      ],
      { stdio: "pipe" },
    );
  const cli = join(prefix, "node_modules/.bin/repo-standards");
  assert.equal(
    execFileSync(cli, ["--version"], { encoding: "utf8" }).trim(),
    "7.1.0",
  );
  const validation = JSON.parse(
    execFileSync(cli, ["source", "validate", root, "--json"], {
      encoding: "utf8",
    }),
  );
  assert.equal(validation.valid, true);
  const source = join(directory, "source");
  mkdirSync(source);
  // Copy only source inputs, excluding the old in-tree product even while it
  // exists. This fixture remains valid after that product's removal.
  const paths = new Set(["standards.yaml", "LICENSE"]);
  for (const profile of Object.values(validation.profiles))
    for (const declaration of profile.declarations) {
      for (const field of ["exact", "guidance", "rules", "discovery", "source"])
        if (declaration[field]) paths.add(declaration[field]);
      const fixes = declaration.fixes ?? [];
      for (const operation of [
        ...(declaration.checks ?? []),
        ...fixes,
        ...fixes.map((fix) => fix["remote-setup"]?.probe),
        declaration["discovery-script"],
      ].filter(Boolean)) {
        paths.add(operation.run.script);
        for (const resource of operation.run.resources ?? [])
          paths.add(resource);
      }
    }
  for (const path of paths) {
    assert.ok(!path.startsWith("factory/"));
    mkdirSync(dirname(join(source, path)), { recursive: true });
    cpSync(join(root, path), join(source, path), { recursive: true });
  }
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    XDG_CACHE_HOME: join(directory, "cache"),
  };
  const git = (cwd, ...args) =>
    execFileSync("git", ["-C", cwd, ...args], { env, encoding: "utf8" }).trim();
  git(source, "init", "--quiet");
  git(source, "add", "--all");
  git(
    source,
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--quiet",
    "-m",
    "Fixture source",
  );
  git(source, "-c", "tag.gpgsign=false", "tag", version);
  const sha = git(source, "rev-parse", "HEAD");
  const tree = git(source, "rev-parse", "HEAD^{tree}");
  const entries = git(source, "ls-tree", "-r", "-t", "HEAD")
    .split("\n")
    .map((line) => {
      const [, mode, type, sha, path] = /^(\d+) (\w+) ([a-f0-9]+)\t(.+)$/.exec(
        line,
      );
      return { mode, type, sha, path };
    });
  const api = "https://api.github.com/repos/fixture/repo-canon";
  const responses = join(directory, "github.json");
  writeFileSync(
    responses,
    JSON.stringify({
      [api]: { private: false, full_name: "fixture/repo-canon" },
      [`${api}/releases?per_page=100&page=1`]: [
        { tag_name: version, draft: false, prerelease: false },
      ],
      [`${api}/git/ref/tags/${version}`]: {
        ref: `refs/tags/${version}`,
        object: { type: "commit", sha },
      },
      [`${api}/git/commits/${sha}`]: { sha, tree: { sha: tree } },
      [`${api}/git/trees/${tree}?recursive=1`]: {
        sha: tree,
        truncated: false,
        tree: entries,
      },
    }),
  );
  Object.assign(env, {
    NODE_OPTIONS: `--import=${join(root, "test/fixtures/github-source.mjs")}`,
    FIXTURE_GITHUB_RESPONSES: responses,
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `url.file://${source}.insteadOf`,
    GIT_CONFIG_VALUE_0: sourceUrl,
  });
  for (const profile of ["standard", "factory"]) {
    const project = join(directory, profile);
    mkdirSync(project);
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(project, path)), { recursive: true });
      writeFileSync(join(project, path), content);
    }
    git(project, "init", "--quiet");
    git(project, "add", "--all");
    git(
      project,
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "Fixture project",
    );
    const invoke = (...args) => {
      const child = spawnSync(cli, [...args, "--project", project, "--json"], {
        cwd: project,
        env,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      });
      assert.ifError(child.error);
      const report = JSON.parse(child.stdout || child.stderr);
      return { report, child };
    };
    let { report } = invoke(
      "adopt",
      sourceUrl,
      "--standards-version",
      version,
      "--profile",
      profile,
    );
    for (let round = 0; report.outcome !== "complete" && round < 10; round++) {
      assert.ok(
        ["answers-required", "contextual"].includes(report.outcome),
        JSON.stringify(report),
      );
      for (const entry of report.contextual ?? [])
        if (repositoryWide[entry.id]) {
          assert.ok(repositoryWide[entry.id].includes(profile), entry.id);
          assert.deepEqual(entry.allowedTargets, {
            paths: [],
            directories: [],
          });
        }
      const questions = report.answers.questions.map((question) => {
        const [kind, name] = question.id.split(":");
        let answer = question.answer;
        if (kind === "scope") answer ??= scopes[name];
        if (kind === "assessment") answer = assessments[name];
        if (kind === "version") answer = version;
        if (kind === "profile") answer = profile;
        if (kind === "remote-setup") answer = "defer";
        if (
          kind === "inspection" &&
          report.missing.some((id) => !/^(inspection|remote-setup)$/.test(id))
        )
          answer = null;
        assert.notEqual(answer, undefined, question.id);
        if (repositoryWide[name] && kind === "scope") {
          assert.ok(repositoryWide[name].includes(profile), name);
          assert.deepEqual(answer.candidates, []);
          assert.deepEqual(answer.unresolved, []);
        }
        return { ...question, answer };
      });
      const answers = join(directory, `${profile}-answers.json`);
      writeFileSync(answers, JSON.stringify({ ...report.answers, questions }));
      ({ report } = invoke("adopt", "--answers", answers));
    }
    assert.equal(report.outcome, "complete", JSON.stringify(report));
    assert.equal(invoke("status").report.readyToCommit, true);
    for (const path of [null, "wordtally.mjs", ".factory/config.json"]) {
      const { report: lookup, child } = invoke(
        "rules",
        ...(path ? [path] : []),
      );
      assert.equal(child.status, 0, JSON.stringify(lookup));
      for (const [declaration, profiles] of Object.entries(repositoryWide)) {
        const rules = lookup.rules.filter(
          (rule) => rule.declaration === declaration,
        );
        const expected = profiles.includes(profile) ? 1 : 0;
        assert.equal(rules.length, expected, `${profile} ${declaration}`);
        if (!expected) continue;
        assert.equal(rules[0].coverage, "repository");
        assert.equal(
          rules[0].content,
          readFileSync(join(root, `rules/${declaration}.md`), "utf8"),
        );
        assert.equal(
          readFileSync(join(project, rules[0].path), "utf8"),
          rules[0].content,
        );
      }
      assert.ok(
        !lookup.rules.some(
          (rule) => rule.declaration === "factory-configuration",
        ),
      );
    }
  }
  const configuration = validation.profiles.factory.declarations.find(
    (declaration) => declaration.id === "factory-configuration",
  );
  assert.equal(configuration.kind, "file");
  assert.equal(configuration.target, ".factory/config.json");
  assert.equal(configuration.exact, ".factory/config.json");
  assert.equal(configuration.rules, undefined);
});
