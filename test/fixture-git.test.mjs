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
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { test } from "node:test";

// Observe file bytes, including Git metadata, rather than asking Git to refresh
// the outer index while checking whether the fixture touched it.
function tree(root) {
  const files = {};
  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) visit(child);
      else
        files[relative(root, child)] = readFileSync(child).toString("base64");
    }
  }
  visit(root);
  return files;
}

test("fixture Git operations ignore inherited repository and config redirections in a linked worktree", (t) => {
  const parent = mkdtempSync(join(tmpdir(), "repo-canon-hostile-git-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const outer = join(parent, "outer");
  mkdirSync(outer);
  const cleanEnv = fixtureGitEnvironment();
  const git = (...args) =>
    execFixtureGit(args, {
      cwd: outer,
      env: cleanEnv,
      encoding: "utf8",
    }).trim();
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.name", "Outer");
  git("config", "user.email", "outer@example.invalid");
  git("config", "commit.gpgsign", "false");
  writeFileSync(join(outer, "tracked"), "committed\n");
  git("add", ".");
  git("commit", "--quiet", "-m", "Outer baseline");
  const worktree = join(parent, "worktree");
  git("worktree", "add", "--quiet", "-b", "linked", worktree);
  writeFileSync(join(outer, "tracked"), "staged\n");
  git("add", ".");
  writeFileSync(join(outer, "tracked"), "unstaged\n");
  writeFileSync(join(worktree, "untracked"), "preserve me\n");
  const gitDir = join(outer, ".git/worktrees/worktree");
  const config = join(parent, "hostile-config");
  writeFileSync(config, "[core]\n\tbare = true\n[user]\n\tname = Hostile\n");
  const redirects = {
    GIT_DIR: gitDir,
    GIT_WORK_TREE: worktree,
    GIT_INDEX_FILE: join(outer, ".git/index"),
    GIT_COMMON_DIR: join(outer, ".git"),
    GIT_OBJECT_DIRECTORY: join(outer, ".git/objects"),
    GIT_ALTERNATE_OBJECT_DIRECTORIES: join(outer, ".git/objects"),
    GIT_CONFIG: config,
    GIT_CONFIG_GLOBAL: config,
    GIT_CONFIG_SYSTEM: config,
    GIT_CONFIG_PARAMETERS: "'core.bare=true'",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "core.bare",
    GIT_CONFIG_VALUE_0: "true",
    GIT_NAMESPACE: "hostile",
    GIT_SHALLOW_FILE: join(parent, "do-not-create-shallow"),
    GIT_CEILING_DIRECTORIES: tmpdir(),
    GIT_AUTHOR_NAME: "Hostile author",
    GIT_AUTHOR_EMAIL: "hostile@example.invalid",
    GIT_COMMITTER_NAME: "Hostile committer",
    GIT_COMMITTER_EMAIL: "hostile@example.invalid",
  };
  const before = tree(parent);
  // Each variable separately catches masking (e.g. GIT_COMMON_DIR hiding the
  // linked-worktree GIT_DIR failure); together covers hook-style inheritance.
  for (const env of [
    ...Object.entries(redirects).map(([key, value]) => ({ [key]: value })),
    redirects,
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      import assert from "node:assert/strict";
      import { existsSync, writeFileSync } from "node:fs";
      import { execFixtureGit } from ${JSON.stringify(new URL("../scripts/support/fixture-git.mjs", import.meta.url).href)};
      import { fixture } from ${JSON.stringify(new URL("./helpers/operation.mjs", import.meta.url).href)};
      import { initializeFixtureRepository, commitFixture } from ${JSON.stringify(new URL("../scripts/support/fixture-authoring.mjs", import.meta.url).href)};
      const project = fixture({ "README.md": "# Fixture\\n" });
      try {
        assert.ok(existsSync(project.root + "/.git"), "fixture has its own Git metadata");
        initializeFixtureRepository(project.root, { author: { name: "Fixture author", email: "fixture@example.invalid" } });
        writeFileSync(project.root + "/.git/hooks/pre-commit", '#!/bin/sh\\n[ "$FIXTURE_UNRELATED" = retained ]\\n', { mode: 0o755 });
        commitFixture(project.root, "Fixture commit");
        // Observe the fixture through the same isolated Git boundary.
        const git = (...args) => execFixtureGit(args, { cwd: project.root, encoding: "utf8" }).trim();
        assert.equal(git("show", "-s", "--format=%an <%ae> / %cn <%ce>"), "Fixture author <fixture@example.invalid> / Fixture author <fixture@example.invalid>");
        assert.equal(git("config", "commit.gpgsign"), "false");
        assert.equal(process.env.FIXTURE_UNRELATED, "retained");
      } finally { project.close(); }
    `,
      ],
      {
        env: { ...cleanEnv, ...env, FIXTURE_UNRELATED: "retained" },
        encoding: "utf8",
        timeout: 20000,
      },
    );
    assert.equal(
      result.status,
      0,
      `${Object.keys(env).join(", ")}: ${result.stderr}`,
    );
    assert.deepEqual(
      tree(parent),
      before,
      "outer config, refs, objects, index and worktrees stay byte-identical",
    );
  }
  // Exercise existing inline fixtures, spawned builders, fake adoption and
  // production commands under a hostile inherited environment. This raw spawn
  // deliberately preserves the test input; fixture Git calls must isolate it.
  const suites = [
    "fixture-builder-provenance",
    "release-scripts",
    "github-operation",
    "babysit-destination",
    "sandbox-image-workflow",
  ];
  /** @type {NodeJS.ProcessEnv} */
  const suiteEnvironment = { ...cleanEnv, ...redirects };
  delete suiteEnvironment.NODE_TEST_CONTEXT;
  const suite = spawnSync(
    process.execPath,
    [
      "--test",
      "--test-reporter=tap",
      ...suites.map(
        (name) => new URL(`./${name}.test.mjs`, import.meta.url).pathname,
      ),
    ],
    {
      env: suiteEnvironment,
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  assert.ifError(suite.error);
  assert.equal(suite.status, 0, `${suite.stdout}\n${suite.stderr}`);
  assert.match(suite.stdout, /# tests [1-9][0-9]*/);
  assert.deepEqual(
    tree(parent),
    before,
    "existing fixture suites preserve the outer repository",
  );
});
