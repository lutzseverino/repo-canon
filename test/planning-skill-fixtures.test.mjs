import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  lstatSync,
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
    "factory-planning",
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
    const factory = repository === manifest.repositories["factory-planning"];
    assert.equal(repository.profile, factory ? "factory" : "standard");
    const lookup = execFileSync(
      process.execPath,
      [".agents/skills/repository-standards/rules.mjs"],
      { cwd: repository.path, encoding: "utf8" },
    );
    assert.ok(lookup.includes("# GitHub repository configuration rules"));
    assert.equal(lookup.includes("# Factory workflow rules"), factory);
    assert.deepEqual(
      repository.ruleInputs,
      factory
        ? [
            "rules/github-repository-configuration.md",
            "rules/factory-workflow.md",
          ]
        : ["rules/github-repository-configuration.md"],
    );
    for (const input of repository.ruleInputs) {
      assert.equal(
        readFileSync(join(repository.path, ".repo-standards", input), "utf8"),
        readFileSync(join(root, input), "utf8"),
      );
    }
    const index = readFileSync(
      join(repository.path, ".repo-standards/rules/README.md"),
      "utf8",
    );
    assert.ok(index.includes("github-repository-configuration.md"));
    assert.equal(index.includes("factory-workflow.md"), factory);
    assert.equal(
      lstatSync(
        join(repository.path, ".agents/skills/repository-standards"),
      ).isSymbolicLink(),
      false,
    );
    assert.equal(
      execFileSync(
        process.execPath,
        [".agents/skills/repository-standards/rules.mjs", "new-file.md"],
        { cwd: repository.path, encoding: "utf8" },
      ),
      lookup,
    );
    for (const skill of readdirSync(
      join(repository.path, ".agents", "skills"),
    )) {
      if (skill === "repository-standards") continue;
      const linked = realpathSync(
        join(repository.path, ".agents", "skills", skill),
      );
      assert.equal(statSync(linked).isDirectory(), true);
      assert.equal(manifest.source.linkedSkillDirectories[skill].path, linked);
    }
  }

  for (const path of [
    "rules/github-repository-configuration.md",
    "rules/factory-workflow.md",
    "scripts/support/repository-standards/SKILL.md",
    "scripts/support/repository-standards/rules.mjs",
    "vendor/mattpocock-skills/skills/engineering/setup-matt-pocock-skills/issue-tracker-local.md",
  ]) {
    assert.equal(
      manifest.source.inputFiles[path]?.sha256,
      createHash("sha256")
        .update(readFileSync(join(root, path)))
        .digest("hex"),
      `provenance for ${path}`,
    );
  }

  // A relocated fixture's lookup has only Node and its copied inputs available.
  const detached = join(parent, "detached");
  cpSync(manifest.repositories["factory-planning"].path, detached, {
    recursive: true,
  });
  const localLookup = () =>
    execFileSync(
      process.execPath,
      [".agents/skills/repository-standards/rules.mjs"],
      {
        cwd: detached,
        encoding: "utf8",
        env: { ...process.env, PATH: "" },
        stdio: "pipe",
      },
    );
  assert.ok(localLookup().includes("# Factory workflow rules"));
  rmSync(join(detached, ".repo-standards/rules/factory-workflow.md"));
  assert.throws(localLookup, /Command failed/);

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
