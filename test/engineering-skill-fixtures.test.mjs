import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

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

test("creates the engineering-skill repositories with the current regular skills and a retrospective", (t) => {
  const { root, manifest } = build(t);

  assert.equal(manifest.format, "repo-canon/engineering-skill-fixtures/v1");
  assert.equal(manifest.root, root);
  assert.deepEqual(Object.keys(manifest.skills).sort(), [
    "ask-matt",
    "code-review",
    "codebase-design",
    "diagnosing-bugs",
    "domain-modeling",
    "improve-codebase-architecture",
    "research",
    "retro",
    "tdd",
    "writing-for-agents",
  ]);
  assert.deepEqual(Object.keys(manifest.repositories).sort(), [
    "architecture",
    "debugging",
    "modeling-research",
    "retrospective",
    "routing-review",
    "tdd",
  ]);

  for (const [name, repository] of Object.entries(manifest.repositories)) {
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

  const retrospective = manifest.repositories.retrospective;
  assert.match(
    readFileSync(join(retrospective.path, "docs/session.md"), "utf8"),
    /npm test/,
  );
  assert.equal(
    readFileSync(join(retrospective.path, "GLOSSARY.md"), "utf8").startsWith(
      "# Ordering",
    ),
    true,
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
