import "./helpers/temporary-directory.mjs";
import { execFixtureGit } from "../scripts/support/fixture-git.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const sourceRoot = new URL("..", import.meta.url).pathname;
const builder = join(
  sourceRoot,
  "scripts/create-productivity-skill-fixtures.mjs",
);

function build(t) {
  const parent = mkdtempSync(join(tmpdir(), "repo-canon-productivity-test-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, "fixtures");
  const output = execFileSync(process.execPath, [builder, "--root", root], {
    cwd: sourceRoot,
    encoding: "utf8",
  });
  return JSON.parse(output);
}

test("builds scenario-specific repositories using every declared productivity skill", (t) => {
  const manifest = build(t);
  assert.equal(manifest.format, "repo-canon/productivity-skill-fixtures/v1");
  assert.equal(
    manifest.source.upstreamCommit,
    "24fe0ef7737efae15c87225755e9f6f5965e4888",
  );
  assert.deepEqual(Object.keys(manifest.source.skills), [
    "grilling",
    "writing-for-agents",
    "implement",
  ]);

  const installed = new Set(["implement"]);
  for (const repository of Object.values(manifest.repositories)) {
    assert.equal(
      execFixtureGit(["status", "--short"], {
        cwd: repository.path,
        encoding: "utf8",
      }),
      "",
    );
    assert.equal(
      readFileSync(join(repository.path, "AGENTS.md"), "utf8"),
      readFileSync(join(sourceRoot, "AGENTS.md"), "utf8"),
    );
    for (const path of [
      ".agents/skills/repository-standards/SKILL.md",
      ".agents/skills/implement/DELEGATION.md",
      ".repo-standards/rules/planning.md",
    ])
      assert.ok(existsSync(join(repository.path, path)), `map reaches ${path}`);
    const lookup = execFileSync(
      process.execPath,
      [".agents/skills/repository-standards/rules.mjs"],
      { cwd: repository.path, encoding: "utf8" },
    );
    assert.match(lookup, /github-repository-configuration/);
    assert.match(lookup, /## planning/);
    assert.doesNotMatch(lookup, /## factory-workflow/);
    for (const skill of repository.skills) {
      installed.add(skill);
      const link = join(repository.path, ".agents/skills", skill);
      assert.ok(lstatSync(link).isSymbolicLink());
      assert.ok(existsSync(join(link, "SKILL.md")));
    }
  }
  assert.deepEqual(
    [...installed].sort(),
    Object.keys(manifest.source.skills).sort(),
  );
});

test("fixtures link whole skill directories", (t) => {
  const { repositories } = build(t);
  assert.ok(
    existsSync(
      join(
        repositories["writing-for-agents"].path,
        ".agents/skills/writing-for-agents/SKILL-MECHANICS.md",
      ),
    ),
  );
});
