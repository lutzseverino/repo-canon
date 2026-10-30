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

const workflowPath = ".github/workflows/sandbox-image.yml";
const dockerfilePath = ".factory/Dockerfile";
const workflow = () =>
  readFileSync(new URL(`../${workflowPath}`, import.meta.url), "utf8");

function fixture(t, changes, dockerfile = "FROM scratch\n") {
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
      const script = workflow().match(/\n {8}run: \|\n([\s\S]+)$/)?.[1];
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
  ".factory/config.json",
  ".factory/Dockerfile.old",
  ".factory/nested/tool\nwith a newline",
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

test("moving the Dockerfile out of .factory fails instead of skipping the build", (t) => {
  const f = fixture(t, {
    [dockerfilePath]: null,
    Dockerfile: "FROM scratch\n",
  });
  stubDocker(f);
  const result = f.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /\.factory\/Dockerfile/);
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
  const declarations = readFileSync(
    new URL("../standards.yaml", import.meta.url),
    "utf8",
  );
  assert.ok(
    declarations.includes(
      `factory-sandbox-image-workflow:\n        kind: file\n        target: ${workflowPath}\n        exact: ${workflowPath}\n`,
    ),
    "the factory profile declares the workflow",
  );
});
