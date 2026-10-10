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

test("builds scenario-specific repositories using every pinned productivity skill", (t) => {
  const manifest = build(t);
  assert.equal(manifest.format, "repo-canon/productivity-skill-fixtures/v1");
  assert.equal(
    manifest.source.upstreamCommit,
    "24fe0ef7737efae15c87225755e9f6f5965e4888",
  );
  assert.deepEqual(Object.keys(manifest.source.skills), [
    "grill-me",
    "grilling",
    "handoff",
    "teach",
    "to-questionnaire",
    "wait-what",
    "writing-for-agents",
  ]);

  const exercised = new Set();
  for (const repository of Object.values(manifest.repositories)) {
    assert.equal(
      execFileSync("git", ["status", "--short"], {
        cwd: repository.path,
        encoding: "utf8",
      }),
      "",
    );
    assert.equal(
      readFileSync(join(repository.path, "AGENTS.md"), "utf8"),
      readFileSync(join(sourceRoot, "AGENTS.md"), "utf8"),
    );
    for (const skill of repository.skills) {
      exercised.add(skill);
      const link = join(repository.path, ".agents/skills", skill);
      assert.ok(lstatSync(link).isSymbolicLink());
      assert.ok(existsSync(join(link, "SKILL.md")));
    }
  }
  assert.deepEqual(
    [...exercised].sort(),
    Object.keys(manifest.source.skills).sort(),
  );
});

test("fixtures link whole skill directories and keep the handoff secret ignored", (t) => {
  const { repositories } = build(t);
  assert.ok(
    readFileSync(
      join(repositories.handoff.path, ".gitignore"),
      "utf8",
    ).includes(".exercise-secret"),
  );
  assert.ok(
    existsSync(
      join(repositories.teach.path, ".agents/skills/teach/RESOURCES-FORMAT.md"),
    ),
  );
  assert.ok(
    existsSync(
      join(
        repositories["writing-for-agents"].path,
        ".agents/skills/writing-for-agents/SKILL-MECHANICS.md",
      ),
    ),
  );
});
