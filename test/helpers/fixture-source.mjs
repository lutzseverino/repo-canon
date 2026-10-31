import {
  execFixtureGit,
  fixtureGitEnvironment,
} from "../../scripts/support/fixture-git.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const sourceUrl = "https://github.com/fixture/repo-canon";

// The public CLI 10.0.0 under `REPO_STANDARDS_PREFIX`, or installed in
// `directory` when the variable is unset.
export function publicCli(directory) {
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
        "@lutzseverino/repo-standards@10.0.0",
      ],
      { stdio: "pipe" },
    );
  const cli = join(prefix, "node_modules/.bin/repo-standards");
  assert.equal(
    execFileSync(cli, ["--version"], { encoding: "utf8" }).trim(),
    "10.0.0",
  );
  return cli;
}

// A disposable source holding only the inputs that the validated profiles
// declare, committed once. Its Git environment ignores the maintainer's
// configuration. `publish` serves the given tags to the CLI: only GitHub HTTP
// and Git transport use fixtures, and the environment it fills in routes both.
export function fixtureSource(directory, validation) {
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
    ...fixtureGitEnvironment(),
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    XDG_CACHE_HOME: join(directory, "cache"),
  };
  const git = (cwd, ...args) =>
    execFixtureGit(["-C", cwd, ...args], { env, encoding: "utf8" }).trim();
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
  const publish = (tags) => {
    const api = "https://api.github.com/repos/fixture/repo-canon";
    const responses = join(directory, "github.json");
    const releases = tags.map((tag_name, index) => ({
      id: index + 1,
      tag_name,
      name: tag_name,
      draft: false,
      prerelease: false,
      published_at: "2026-01-01T00:00:00Z",
    }));
    // An initial `adopt` lists the releases by page, and an update through
    // Postern without one.
    const github = {
      [api]: { private: false, full_name: "fixture/repo-canon" },
      [`${api}/releases?per_page=100&page=1`]: releases,
      [`${api}/releases?per_page=100`]: releases,
    };
    for (const tag of tags) {
      const sha = git(source, "rev-parse", `${tag}^{commit}`);
      const tree = git(source, "rev-parse", `${tag}^{tree}`);
      const entries = git(source, "ls-tree", "-r", "-t", tag)
        .split("\n")
        .map((line) => {
          const [, mode, type, sha, path] =
            /^(\d+) (\w+) ([a-f0-9]+)\t(.+)$/.exec(line);
          return { mode, type, sha, path };
        });
      Object.assign(github, {
        [`${api}/git/ref/tags/${tag}`]: {
          ref: `refs/tags/${tag}`,
          object: { type: "commit", sha },
        },
        [`${api}/git/commits/${sha}`]: { sha, tree: { sha: tree } },
        [`${api}/git/trees/${tree}?recursive=1`]: {
          sha: tree,
          truncated: false,
          tree: entries,
        },
      });
    }
    writeFileSync(responses, JSON.stringify(github));
    Object.assign(env, {
      NODE_OPTIONS: `--import=${join(root, "test/fixtures/github-source.mjs")}`,
      FIXTURE_GITHUB_RESPONSES: responses,
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: `url.file://${source}.insteadOf`,
      GIT_CONFIG_VALUE_0: sourceUrl,
    });
  };
  return { source, env, git, publish };
}
