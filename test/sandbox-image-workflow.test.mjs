import { declarations } from "../scripts/standards-declarations.mjs";
import { fileURLToPath } from "node:url";
import {
  execFixtureGit,
  fixtureGitEnvironment,
} from "../scripts/support/fixture-git.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { stringify } from "yaml";
import { parseStandards } from "../scripts/standards-declarations.mjs";
import {
  fixtureSource,
  publicCli,
  sourceUrl,
} from "./helpers/fixture-source.mjs";

const workflowPath = ".github/workflows/sandbox-image.yml";
const dockerfilePath = ".scriptorium/Dockerfile";
const workflow = () =>
  readFileSync(new URL(`../${workflowPath}`, import.meta.url), "utf8");

function fixture(
  t,
  changes,
  dockerfile = "FROM scratch\n",
  installedWorkflow = workflow(),
) {
  const directory = mkdtempSync(join(tmpdir(), "repo-canon-sandbox-workflow-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const repository = join(directory, "repository");
  mkdirSync(repository);
  const git = (...args) =>
    execFixtureGit(args, { cwd: repository, encoding: "utf8" }).trim();
  const write = (path, contents) => {
    mkdirSync(dirname(join(repository, path)), { recursive: true });
    writeFileSync(join(repository, path), contents);
  };
  const commit = (changes, message) => {
    for (const [path, contents] of Object.entries(changes)) {
      if (contents === null) rmSync(join(repository, path));
      else write(path, contents);
    }
    git("add", "-A");
    git("commit", "--quiet", "-m", message);
    return git("rev-parse", "HEAD");
  };
  git("init", "--quiet");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "user.name", "Fixture");
  write(dockerfilePath, dockerfile);
  write(workflowPath, "original workflow\n");
  write("README.md", "original readme\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "Base");
  const base = git("rev-parse", "HEAD");
  const head = commit(changes, "Pull request");
  const env = {
    ...fixtureGitEnvironment(),
    BASE_SHA: base,
    HEAD_SHA: head,
    RUNNER_TEMP: directory,
  };
  return {
    directory,
    env,
    advanceBase(changes) {
      git("checkout", "--quiet", "--detach", base);
      env.BASE_SHA = commit(changes, "Advance base");
      git("checkout", "--quiet", "--detach", head);
    },
    run() {
      const script = installedWorkflow.match(/\n {8}run: \|\n([\s\S]+)$/)?.[1];
      assert.ok(script, "the workflow has an executable build step");
      return spawnSync(
        "bash",
        [
          "--noprofile",
          "--norc",
          "-e",
          "-o",
          "pipefail",
          "-c",
          script.replace(/^ {10}/gm, ""),
        ],
        {
          cwd: repository,
          env,
          encoding: "utf8",
          timeout: 120_000,
        },
      );
    },
  };
}

function stubDocker(f, status = 0) {
  const bin = join(f.directory, "bin");
  mkdirSync(bin);
  const capture = join(f.directory, "docker.json");
  writeFileSync(
    join(bin, "docker"),
    `#!${process.execPath}\nimport { readFileSync, writeFileSync } from "node:fs";
writeFileSync(process.env.DOCKER_CAPTURE, JSON.stringify({ args: process.argv.slice(2), input: readFileSync(0, "utf8") }));
if (process.env.DOCKER_STATUS !== "0") console.error("toolchain build failed");
process.exit(Number(process.env.DOCKER_STATUS));
`,
    { mode: 0o755 },
  );
  f.env.PATH = `${bin}:${process.env.PATH}`;
  f.env.DOCKER_CAPTURE = capture;
  f.env.DOCKER_STATUS = String(status);
  return () => JSON.parse(readFileSync(capture, "utf8"));
}

test("unrelated pull requests succeed without invoking Docker", (t) => {
  const f = fixture(t, { "README.md": "updated readme\n" });
  const capture = stubDocker(f, 1);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No toolchain image changes/);
  assert.throws(capture, { code: "ENOENT" });
});

test("base-only toolchain fixes do not trigger a build on an unrelated stale pull request", (t) => {
  const f = fixture(t, { "README.md": "updated readme\n" });
  f.advanceBase({ [dockerfilePath]: "FROM scratch\n# base fix\n" });
  const capture = stubDocker(f, 17);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No toolchain image changes/);
  assert.throws(capture, { code: "ENOENT" });
});

test("pull request toolchain changes still build when the base branch advances", (t) => {
  const dockerfile = "FROM scratch\n# pull request toolchain\n";
  const f = fixture(t, { [dockerfilePath]: dockerfile });
  f.advanceBase({ "README.md": "base-only readme update\n" });
  const capture = stubDocker(f);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(capture().input, dockerfile);
});

for (const path of [dockerfilePath, workflowPath]) {
  test(`a change to ${path} builds only the head toolchain Dockerfile without context`, (t) => {
    const f = fixture(t, { [path]: "FROM scratch\n# updated\n" });
    const capture = stubDocker(f);
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(capture(), {
      args: ["build", "-"],
      input:
        path === dockerfilePath
          ? "FROM scratch\n# updated\n"
          : "FROM scratch\n",
    });
  });
}

// Only the Dockerfile builds the image, so other factory files, and paths
// that merely start like it, need no build.
for (const path of [
  ".scriptorium/config.json",
  ".scriptorium/Dockerfile.old",
  ".scriptorium/nested/tool\nwith a newline",
  ".factory/Dockerfile",
  ".factory/config.json",
  ".sandcastle/Dockerfile",
]) {
  test(`a change to ${JSON.stringify(path)} alone does not build`, (t) => {
    const f = fixture(t, { [path]: "FROM scratch\n# unrelated\n" });
    const capture = stubDocker(f, 1);
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /No toolchain image changes/);
    assert.throws(capture, { code: "ENOENT" });
  });
}

test("moving the Dockerfile out of .scriptorium fails instead of skipping the build", (t) => {
  const f = fixture(t, {
    [dockerfilePath]: null,
    Dockerfile: "FROM scratch\n",
  });
  stubDocker(f);
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /\.scriptorium\/Dockerfile/);
});

test("a failed Docker build fails the job and preserves its diagnostic", (t) => {
  const f = fixture(t, {
    [dockerfilePath]: 'FROM scratch\nRUN ["/missing-toolchain"]\n',
  });
  stubDocker(f, 17);
  const result = f.run();
  assert.equal(result.status, 17);
  assert.match(result.stderr, /toolchain build failed/);
});

test("an unavailable comparison revision fails instead of passing without a build", (t) => {
  const f = fixture(t, { "README.md": "updated readme\n" });
  const capture = stubDocker(f);
  f.env.BASE_SHA = "0000000000000000000000000000000000000000";
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.throws(capture, { code: "ENOENT" });
});

test("a real Docker toolchain failure fails the workflow step", (t) => {
  const docker = spawnSync("docker", ["info"], {
    encoding: "utf8",
    timeout: 10_000,
  });
  if (docker.status !== 0) {
    t.skip(
      "Docker daemon unavailable; the GitHub-hosted CI runner exercises this fixture",
    );
    return;
  }
  const f = fixture(t, {
    [dockerfilePath]: 'FROM scratch\nRUN ["/missing-toolchain"]\n',
  });
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /missing-toolchain/);
  assert.match(result.stdout + result.stderr, /no such file|not found/i);
});

test("the shared workflow always reports on pull requests with read-only permissions and no secrets", () => {
  const text = workflow();
  assert.match(text, /on:\n {2}pull_request:\n/);
  assert.match(text, /permissions:\n {2}contents: read\n/);
  assert.doesNotMatch(
    text,
    /pull_request_target|secrets\.|\bwrite\b|paths(?:-ignore)?:/,
  );
  assert.match(text, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(text, /fetch-depth: 0/);
  assert.match(text, /persist-credentials: false/);
  const profiles = declarations(fileURLToPath(new URL("..", import.meta.url)));
  assert.deepEqual(
    profiles.factory.find(({ id }) => id === "factory-sandbox-image-workflow"),
    {
      id: "factory-sandbox-image-workflow",
      kind: "file",
      target: workflowPath,
      exact: workflowPath,
    },
  );
});

test("public CLI installs the workflow whose executable step builds canonical inputs only", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "sandbox-installed-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = fileURLToPath(new URL("..", import.meta.url));
  const cli = publicCli(directory);
  // Install the production exact configuration/workflow declarations. Full
  // factory/standard/workbench selection is covered by the adoption suites.
  const ids = ["factory-configuration", "factory-sandbox-image-workflow"];
  const selected = declarations(root).factory.filter(({ id }) =>
    ids.includes(id),
  );
  const { source, env, git, publish } = fixtureSource(directory, {
    profiles: { factory: { declarations: selected } },
  });
  const manifest = parseStandards(
    readFileSync(join(root, "standards.yaml"), "utf8"),
  );
  manifest.defaults = { declarations: {} };
  manifest.profiles = {
    factory: {
      description: manifest.profiles.factory.description,
      declarations: Object.fromEntries(
        selected.map(({ id, ...declaration }) => [id, declaration]),
      ),
    },
  };
  writeFileSync(join(source, "standards.yaml"), stringify(manifest));
  git(source, "add", "standards.yaml");
  git(
    source,
    "commit",
    "--quiet",
    "-m",
    "Select production sandbox declarations",
  );
  git(source, "tag", "v1.0.0");
  publish(["v1.0.0"]);
  const project = join(directory, "project");
  mkdirSync(project);
  git(project, "init", "--quiet");
  git(project, "commit", "--quiet", "--allow-empty", "-m", "Fixture");
  const invoke = (...args) => {
    const child = spawnSync(cli, [...args, "--project", project, "--json"], {
      env,
      encoding: "utf8",
    });
    assert.ifError(child.error);
    const report = JSON.parse(child.stdout || child.stderr);
    assert.ok([0, 1].includes(child.status), JSON.stringify(report));
    return report;
  };
  let report = invoke(
    "adopt",
    sourceUrl,
    "--standards-version",
    "v1.0.0",
    "--profile",
    "factory",
  );
  if (report.outcome === "answers-required") {
    const answers = join(directory, "answers.json");
    writeFileSync(
      answers,
      JSON.stringify({
        ...report.answers,
        questions: report.answers.questions.map((question) => ({
          ...question,
          answer: question.id === "inspection" ? true : question.answer,
        })),
      }),
    );
    report = invoke("adopt", "--answers", answers);
  }
  assert.equal(report.outcome, "complete", JSON.stringify(report));
  assert.equal(invoke("status").readyToCommit, true);
  const installed = readFileSync(join(project, workflowPath), "utf8");
  assert.equal(installed, workflow());
  assert.deepEqual(
    readFileSync(join(project, ".scriptorium/config.json")),
    readFileSync(join(root, ".scriptorium/config.json")),
  );
  for (const path of [
    dockerfilePath,
    workflowPath,
    ".scriptorium/config.json",
    ".factory/Dockerfile",
    "README.md",
  ]) {
    const f = fixture(
      t,
      { [path]: "FROM scratch\n# installed workflow exercise\n" },
      "FROM scratch\n",
      installed,
    );
    const capture = stubDocker(f);
    assert.equal(f.run().status, 0);
    if ([dockerfilePath, workflowPath].includes(path))
      assert.deepEqual(capture(), {
        args: ["build", "-"],
        input:
          path === dockerfilePath
            ? "FROM scratch\n# installed workflow exercise\n"
            : "FROM scratch\n",
      });
    else assert.throws(capture, { code: "ENOENT" });
  }
  const missing = fixture(
    t,
    { [dockerfilePath]: null },
    "FROM scratch\n",
    installed,
  );
  stubDocker(missing);
  assert.notEqual(missing.run().status, 0);
  const broken = fixture(
    t,
    { [dockerfilePath]: "FROM scratch\n# broken\n" },
    "FROM scratch\n",
    installed,
  );
  stubDocker(broken, 17);
  assert.equal(broken.run().status, 17);
});
