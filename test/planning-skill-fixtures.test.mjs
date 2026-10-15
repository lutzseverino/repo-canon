import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

test("planning and project-agent-guidance fixture builder creates runnable bounded scenarios", (t) => {
  const parent = mkdtempSync(join(tmpdir(), "repo-canon-planning-test-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const target = join(parent, "fixtures");
  execFileSync(
    process.execPath,
    ["scripts/create-planning-skill-fixtures.mjs", "--root", target],
    { cwd: root, encoding: "utf8" },
  );
  const manifest = JSON.parse(
    readFileSync(join(target, "manifest.json"), "utf8"),
  );

  assert.deepEqual(Object.keys(manifest.repositories).sort(), [
    "delivery",
    "planning",
    "project-agent-guidance",
    "triage-wayfinder",
  ]);
  assert.equal(
    manifest.source.upstreamCommit,
    "24fe0ef7737efae15c87225755e9f6f5965e4888",
  );
  assert.deepEqual(Object.keys(manifest.source.linkedSkillDirectories).sort(), [
    "code-review",
    "domain-modeling",
    "grill-with-docs",
    "grilling",
    "implement",
    "pr",
    "prototype",
    "research",
    "tdd",
    "to-spec",
    "to-tickets",
    "triage",
    "wayfinder",
  ]);
  assert.deepEqual(
    manifest.skills.map(({ name }) => name),
    [
      "grill-with-docs",
      "to-spec",
      "to-tickets",
      "triage",
      "wayfinder",
      "implement",
      "pr",
      "prototype",
    ],
  );
  const deliveryScenario = manifest.repositories.delivery;
  assert.ok(deliveryScenario.skills.includes("implement"));
  assert.ok(deliveryScenario.skills.includes("pr"));
  assert.match(
    readFileSync(
      join(deliveryScenario.path, ".scratch/delivery/spec.md"),
      "utf8",
    ),
    /01-prioritize-parcels/,
  );
  assert.match(
    readFileSync(join(deliveryScenario.path, "docs/pr-evidence.md"), "utf8"),
    /Before/,
  );
  for (const repository of Object.values(manifest.repositories)) {
    for (const skill of readdirSync(
      join(repository.path, ".agents", "skills"),
    )) {
      const linked = realpathSync(
        join(repository.path, ".agents", "skills", skill),
      );
      assert.equal(statSync(linked).isDirectory(), true);
      assert.equal(manifest.source.linkedSkillDirectories[skill].path, linked);
    }
  }

  assert.equal(
    execFileSync("git", ["status", "--porcelain"], {
      cwd: join(target, "project-agent-guidance"),
      encoding: "utf8",
    }),
    "",
  );

  const delivery = join(target, "delivery");
  assert.throws(
    () =>
      execFileSync(process.execPath, ["test/delivery.test.mjs"], {
        cwd: delivery,
        encoding: "utf8",
        stdio: "pipe",
      }),
    /Command failed/,
  );
});
