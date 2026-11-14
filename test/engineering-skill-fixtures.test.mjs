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
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(manifest.repositories).map(([name, { skills }]) => [
        name,
        skills,
      ]),
    ),
    {
      review: ["code-review", "codebase-design"],
      architecture: ["codebase-design", "improve-codebase-architecture"],
      debugging: ["diagnosing-bugs"],
      "modeling-research": ["domain-modeling", "research"],
      tdd: ["tdd"],
      standalone: ["code-review", "codebase-design"],
    },
  );

  for (const [name, repository] of Object.entries(manifest.repositories)) {
    assert.deepEqual(
      readdirSync(join(repository.path, ".agents/skills")).sort(),
      [...repository.skills].sort(),
      `${name} installs exactly its selected skills`,
    );
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

  for (const path of ["docs/specification.md", "GLOSSARY.md"])
    assert.ok(existsSync(join(manifest.repositories.review.path, path)));

  const review = manifest.repositories.review;
  assert.deepEqual(review.skills, ["code-review", "codebase-design"]);
  assert.equal(
    readFileSync(
      join(review.path, ".agents/skills/codebase-design/SKILL.md"),
      "utf8",
    ),
    readFileSync(
      join(manifest.skills["codebase-design"].path, "SKILL.md"),
      "utf8",
    ),
  );
  assert.equal(
    execFixtureGit(["diff", "--name-only", review.fixedPoint, review.head], {
      cwd: review.path,
      encoding: "utf8",
    }).trim(),
    "src/ledger.mjs\ntest/ledger.test.mjs",
  );
});

test("the standalone repository has no Repo Canon adoption and copied skills", (t) => {
  const { manifest } = build(t);
  const standalone = manifest.repositories.standalone;
  assert.equal(standalone.installation, "copy");
  assert.deepEqual(standalone.skills, ["code-review", "codebase-design"]);
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
  for (const name of standalone.skills) {
    const skill = join(standalone.path, ".agents/skills", name);
    assert.equal(lstatSync(skill).isDirectory(), true);
    assert.equal(lstatSync(skill).isSymbolicLink(), false);
    const paths = readdirSync(skill, { encoding: "utf8", recursive: true });
    assert.deepEqual(
      paths.sort(),
      readdirSync(manifest.skills[name].path, {
        encoding: "utf8",
        recursive: true,
      }).sort(),
    );
    for (const path of paths)
      if (!lstatSync(join(skill, path)).isDirectory())
        assert.deepEqual(
          readFileSync(join(skill, path)),
          readFileSync(join(manifest.skills[name].path, path)),
          `${name}/${path} is copied unchanged`,
        );
    assert.deepEqual(skillProblems(skill, name), []);
  }
  const git = (...args) =>
    execFixtureGit(args, { cwd: standalone.path, encoding: "utf8" }).trim();
  assert.equal(git("rev-parse", "HEAD"), standalone.head);
  assert.equal(git("rev-parse", "HEAD~1"), standalone.fixedPoint);
  assert.equal(git("status", "--porcelain"), "");
  assert.match(
    git("diff", "--name-only", `${standalone.fixedPoint}...HEAD`),
    /^src\/ledger\.mjs\ntest\/ledger\.test\.mjs$/,
  );
  assert.ok(existsSync(join(standalone.path, "specs/summarize-ledger.md")));
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
