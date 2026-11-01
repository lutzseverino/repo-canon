import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { skillProblems } from "../scripts/owned-skill-reads.mjs";
import { execFixtureGit } from "../scripts/support/fixture-git.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const script = join(
  repositoryRoot,
  "scripts/create-engineering-skill-fixtures.mjs",
);

function build(t, env = process.env) {
  const parent = mkdtempSync(
    join(tmpdir(), "repo-canon-engineering-skills-test-"),
  );
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, "fixtures");
  const child = spawnSync(process.execPath, [script, "--root", root], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env,
  });
  assert.equal(child.status, 0, child.stderr);
  return { parent, root, manifest: JSON.parse(child.stdout) };
}

test("creates the engineering-skill repositories with the declared engineering skills", (t) => {
  const { root, manifest } = build(t);

  assert.equal(manifest.format, "repo-canon/engineering-skill-fixtures/v1");
  assert.equal(manifest.root, root);
  assert.deepEqual(Object.keys(manifest.skills).sort(), [
    "code-review",
    "codebase-design",
    "diagnosing-bugs",
    "domain-modeling",
    "improve-codebase-architecture",
    "research",
    "tdd",
  ]);
  assert.deepEqual(Object.keys(manifest.repositories).sort(), [
    "architecture",
    "debugging",
    "modeling-research",
    "review",
    "standalone",
    "tdd",
  ]);

  for (const [name, repository] of Object.entries(manifest.repositories)) {
    if (name === "standalone") continue;
    assert.equal(
      readFileSync(join(repository.path, "AGENTS.md"), "utf8"),
      readFileSync(join(repositoryRoot, "AGENTS.md"), "utf8"),
      `${name} has the shared agent entry point`,
    );
    assert.equal(
      readFileSync(join(repository.path, "CONTRIBUTING.md"), "utf8"),
      readFileSync(join(repositoryRoot, "CONTRIBUTING.md"), "utf8"),
      `${name} has the shared contribution contract`,
    );
    for (const skill of repository.skills) {
      const link = join(repository.path, ".agents/skills", skill);
      assert.equal(
        lstatSync(link).isSymbolicLink(),
        true,
        `${name} exposes ${skill} as a repo skill`,
      );
      assert.equal(readlinkSync(link), manifest.skills[skill].path);
    }
  }

  const review = manifest.repositories.review;
  assert.match(
    readFileSync(join(review.path, "docs/specification.md"), "utf8"),
    /summarizeLedger\(entries\)/,
  );
  assert.equal(
    readFileSync(join(review.path, "GLOSSARY.md"), "utf8").startsWith(
      "# Ledger",
    ),
    true,
  );
});

test("the standalone repository has no Repo Canon adoption and a copied skill", (t) => {
  const { manifest } = build(t);
  const standalone = manifest.repositories.standalone;
  assert.equal(standalone.installation, "copy");
  assert.deepEqual(standalone.skills, ["code-review"]);
  for (const path of [
    "AGENTS.md",
    "CONTRIBUTING.md",
    "CODING_STANDARDS.md",
    "GLOSSARY.md",
    "docs",
    ".repo-standards",
    ".github",
    ".agents/skills/LICENSE.mattpocock-skills",
  ])
    assert.equal(
      existsSync(join(standalone.path, path)),
      false,
      `the standalone repository has no ${path}`,
    );
  const skill = join(standalone.path, ".agents/skills/code-review");
  assert.equal(lstatSync(skill).isSymbolicLink(), false);
  for (const path of readdirSync(manifest.skills["code-review"].path, {
    encoding: "utf8",
    recursive: true,
  }))
    if (!lstatSync(join(skill, path)).isDirectory())
      assert.deepEqual(
        readFileSync(join(skill, path)),
        readFileSync(join(manifest.skills["code-review"].path, path)),
        `code-review/${path} is copied unchanged`,
      );
  assert.deepEqual(skillProblems(skill, "code-review"), []);
  const git = (...args) =>
    execFixtureGit(args, { cwd: standalone.path, encoding: "utf8" }).trim();
  assert.equal(git("rev-parse", "HEAD"), standalone.head);
  assert.equal(git("rev-parse", "HEAD~1"), standalone.fixedPoint);
  assert.equal(git("status", "--porcelain"), "");
  assert.match(
    git("diff", "--name-only", `${standalone.fixedPoint}...HEAD`),
    /^src\/ledger\.mjs\ntest\/ledger\.test\.mjs$/,
  );
  assert.match(
    readFileSync(join(standalone.path, "specs/summarize-ledger.md"), "utf8"),
    /pending totals/,
  );
});

test("builds from a Repo Canon checkout without an origin remote", (t) => {
  const shimDirectory = mkdtempSync(
    join(tmpdir(), "repo-canon-engineering-git-shim-"),
  );
  t.after(() => rmSync(shimDirectory, { recursive: true, force: true }));
  const actualGit = execFileSync("sh", ["-c", "command -v git"], {
    encoding: "utf8",
  }).trim();
  const gitShim = join(shimDirectory, "git");
  writeFileSync(
    gitShim,
    `#!/bin/sh\nif [ "$1" = config ] && [ "$2" = --get ] && [ "$3" = remote.origin.url ]; then\n  exit 1\nfi\nexec "${actualGit}" "$@"\n`,
  );
  chmodSync(gitShim, 0o755);

  const { manifest } = build(t, {
    ...process.env,
    PATH: `${shimDirectory}:${process.env.PATH}`,
  });
  assert.equal(manifest.source.repository, null);
});
