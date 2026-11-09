import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  execFixtureGit,
  fixtureGitEnvironment,
} from "../scripts/support/fixture-git.mjs";

const source = fileURLToPath(
  new URL("../.agents/skills/code-review/ownership-facts.mjs", import.meta.url),
);

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "rc-895-facts-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFixtureGit(args, { cwd: root }).trim();
  const write = (path, text = "initial\n") => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  git("init", "--quiet");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.com");
  const commit = () => {
    git("add", "--all");
    git("commit", "--quiet", "-m", "fixture");
    return git("rev-parse", "HEAD");
  };
  const run = (base, head, script = source) => {
    const child = spawnSync(process.execPath, [script, base, head], {
      cwd: root,
      encoding: "utf8",
      env: fixtureGitEnvironment(),
    });
    assert.equal(child.status, 0, child.stderr);
    return JSON.parse(child.stdout);
  };
  return { root, git, write, commit, run };
}

test("reports vendored paths by location or Git attribute, never package-like names", (t) => {
  const { write, commit, run } = fixture(t);
  write(
    ".gitattributes",
    "copies/** linguist-vendored\nsrc/react.mjs -linguist-vendored\n",
  );
  for (const path of [
    "vendor/ui.mjs",
    "copies/ui.mjs",
    "src/react.mjs",
    "src/ordinary.mjs",
  ])
    write(path);
  const base = commit();
  for (const path of [
    "vendor/ui.mjs",
    "copies/ui.mjs",
    "src/react.mjs",
    "src/ordinary.mjs",
  ])
    write(path, "changed\n");
  const head = commit();
  // Working-tree attributes cannot change the facts for the pinned diff.
  write(".gitattributes", "* linguist-vendored\n");
  commit();
  assert.deepEqual(run(base, head), [
    { kind: "vendored", path: "copies/ui.mjs", sources: ["linguist-vendored"] },
    { kind: "vendored", path: "vendor/ui.mjs", sources: ["vendor"] },
  ]);
});

test("compares every addition to the base tree, including repeated new kinds", (t) => {
  const { write, commit, run } = fixture(t);
  write("src/old.mjs");
  write("README.md");
  const base = commit();
  for (const path of [
    "src/a.toml",
    "src/b.toml",
    "config/a.mjs",
    "config/b.mjs",
    "src/normal.mjs",
    "NOTES.md",
  ])
    write(path);
  assert.deepEqual(run(base, commit()), [
    {
      kind: "added-file",
      path: "config/a.mjs",
      newTopLevelDirectory: "config",
    },
    {
      kind: "added-file",
      path: "config/b.mjs",
      newTopLevelDirectory: "config",
    },
    { kind: "added-file", path: "src/a.toml", newExtension: ".toml" },
    { kind: "added-file", path: "src/b.toml", newExtension: ".toml" },
  ]);
});

test("returns an empty list for an ordinary diff and runs from a standalone skill copy", (t) => {
  const { root, write, commit, run } = fixture(t);
  write("src/value.mjs");
  const base = commit();
  write("src/value.mjs", "changed\n");
  const head = commit();
  const installed = join(root, "standalone/ownership-facts.mjs");
  mkdirSync(dirname(installed));
  cpSync(source, installed);
  assert.deepEqual(run(base, head, installed), []);
  assert.deepEqual(run(head, head, installed), []);
});

test("retains base attribution for deleted files and handles unusual path bytes", (t) => {
  const { root, write, commit, run } = fixture(t);
  write(".gitattributes", "copies/** linguist-vendored=true\n");
  write("copies/old.mjs");
  write("src/old.mjs");
  const base = commit();
  rmSync(join(root, "copies/old.mjs"));
  write(".gitattributes", "copies/** -linguist-vendored\n");
  const path = "new dir/a\tb\nc.toml";
  write(path);
  assert.deepEqual(run(base, commit()), [
    {
      kind: "vendored",
      path: "copies/old.mjs",
      sources: ["linguist-vendored"],
    },
    {
      kind: "added-file",
      path,
      newExtension: ".toml",
      newTopLevelDirectory: "new dir",
    },
  ]);
});

test("reads newly added attribution at the pinned head", (t) => {
  const { write, commit, run } = fixture(t);
  write("copies/ui.mjs");
  const base = commit();
  write(".gitattributes", "copies/** linguist-vendored=true\n");
  write("copies/ui.mjs", "changed\n");
  const head = commit();
  // The new attributes file is also a new extensionless file kind.
  assert.deepEqual(run(base, head), [
    { kind: "added-file", path: ".gitattributes", newExtension: "" },
    { kind: "vendored", path: "copies/ui.mjs", sources: ["linguist-vendored"] },
  ]);
});

test("ignores local and global attribute overrides of pinned trees", (t) => {
  const { root, git, write, commit, run } = fixture(t);
  write(".gitattributes", "copies/** linguist-vendored\n");
  write("copies/ui.mjs");
  write("src/ordinary.mjs");
  const base = commit();
  write("copies/ui.mjs", "changed\n");
  write("src/ordinary.mjs", "changed\n");
  const head = commit();
  write(".git/info/attributes", "copies/** -linguist-vendored\n");
  const attributes = join(root, "global-attributes");
  writeFileSync(attributes, "src/** linguist-vendored\n");
  git("config", "core.attributesFile", attributes);
  assert.deepEqual(run(base, head), [
    { kind: "vendored", path: "copies/ui.mjs", sources: ["linguist-vendored"] },
  ]);
});
