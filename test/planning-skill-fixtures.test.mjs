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
import { decideIssueContract } from "../scripts/validate-issue-contract.mjs";
import { repository as contractRepository } from "./helpers/issue-contracts.mjs";

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
    "orchestrate",
    "planning",
    "project-agent-guidance",
    "triage-routing",
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
    "orchestrate",
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
      "orchestrate",
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
    const factory = [
      manifest.repositories["factory-planning"],
      manifest.repositories["triage-routing"],
    ].includes(repository);
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

  // Triage links Repo Canon's fork, the skill adoption installs.
  assert.equal(
    manifest.source.linkedSkillDirectories.triage.path,
    realpathSync(join(root, ".agents/skills/triage")),
  );
  const routing = manifest.repositories["triage-routing"];
  const orchestrate = manifest.repositories.orchestrate;
  assert.deepEqual(orchestrate.skills, ["orchestrate"]);
  assert.equal(
    realpathSync(join(orchestrate.path, ".agents/skills/orchestrate")),
    realpathSync(join(root, ".agents/skills/orchestrate")),
  );
  const workbench = orchestrate.workbench.path;
  for (const path of [orchestrate.path, workbench]) {
    assert.equal(
      execFileSync("git", ["remote"], { cwd: path, encoding: "utf8" }),
      "",
    );
    assert.equal(
      execFileSync("git", ["status", "--porcelain"], {
        cwd: path,
        encoding: "utf8",
      }),
      "",
    );
    assert.equal(
      execFileSync("git", ["config", "commit.gpgsign"], {
        cwd: path,
        encoding: "utf8",
      }).trim(),
      "false",
    );
  }
  assert.deepEqual(
    readdirSync(workbench)
      .filter((name) => name !== ".git")
      .sort(),
    ["inbox.md", "index.md", "wishes.md"],
  );
  const orchestrateTask = readFileSync(
    join(orchestrate.path, "docs/exercise.md"),
    "utf8",
  );
  for (const phase of [
    "proposal",
    "approval",
    "amendment",
    "wish",
    "fresh session",
  ])
    assert.ok(orchestrateTask.includes(phase), `orchestrate phase: ${phase}`);
  const participantInputs = readFileSync(
    join(orchestrate.path, "docs/participant-inputs.md"),
    "utf8",
  );
  assert.match(participantInputs, /dropped \(owner\)/);
  assert.match(participantInputs, /not a Finding/);
  assert.match(participantInputs, /closed/i);
  // Controlled Findings routes accompany the existing non-finding wish.
  const existingFinding = ".scratch/tooling/issues/01-utf8-crash.md";
  assert.ok(participantInputs.includes(existingFinding));
  assert.match(participantInputs, /Existing Finding.*reuse.*no duplicate/);
  assert.match(
    participantInputs,
    /New Finding.*02-stale-option\.md.*needs-triage/,
  );
  assert.match(
    participantInputs,
    /Linked wish.*02-stale-option\.md.*reporting links/,
  );
  const findingIssue = readFileSync(
    join(orchestrate.path, existingFinding),
    "utf8",
  );
  assert.match(findingIssue, /^Status: open$/m);
  assert.match(findingIssue, /^Labels: needs-triage$/m);
  assert.match(findingIssue, /Observed:.*café\.md.*exits 1/);
  assert.deepEqual(
    readdirSync(join(orchestrate.path, ".scratch/tooling/issues")),
    ["01-utf8-crash.md"],
    "the participant must file the new finding, not the fixture builder",
  );
  assert.match(orchestrateTask, /Findings section.*responsible.*tooling/);
  assert.match(orchestrateTask, /no pull request.*review ticket 01/);
  assert.match(orchestrateTask, /filing fails.*unfiled.*target repository/);
  const factoryPlanning = manifest.repositories["factory-planning"];
  const factoryIntake = readFileSync(
    join(
      factoryPlanning.path,
      ".scratch/receipts/issues/01-export-receipts.md",
    ),
    "utf8",
  );
  assert.match(factoryIntake, /^Status: needs-triage$/m);
  assert.doesNotMatch(
    factoryIntake,
    /## Agent Brief|parcel_reference|exportReceipts\(|ready-for-agent/,
  );
  const factoryTask = readFileSync(
    join(factoryPlanning.path, "docs/exercise.md"),
    "utf8",
  );
  assert.match(factoryTask, /intent-bound/);
  assert.match(factoryTask, /no brief or readiness/i);
  const ownerInputs = readFileSync(
    join(factoryPlanning.path, ".scratch/receipts/owner-inputs.md"),
    "utf8",
  );
  for (const choice of [
    "parcel_reference,delivered_at,signer_name",
    "exportReceipts(receipts, date)",
    "caller-supplied",
  ])
    assert.ok(ownerInputs.includes(choice), `controlled choice: ${choice}`);
  const factoryReviews = readFileSync(
    join(factoryPlanning.path, ".scratch/receipts/review-inputs.md"),
    "utf8",
  );
  for (const outcome of [
    /simulated approved contract/i,
    /r1/,
    /r2/,
    /2026-10-18T10:00:00Z/,
    /2026-10-18T10:01:00Z/,
    /2026-10-18T11:00:00Z/,
    /2026-10-18T11:01:00Z/,
    /reviewer did not write r1/,
    /r1 readiness is invalidated/,
    /parent itself never runs/,
    /02 remains blocked by open 01/,
    /02's blocker is now closed/,
  ])
    assert.match(factoryReviews, outcome);
  assert.deepEqual(routing.skills, ["triage"]);
  const issues = join(routing.path, ".scratch/routing/issues");
  assert.deepEqual(readdirSync(issues).sort(), [
    "01-empty-date-export-fails.md",
    "02-dispatch-retry-gives-up.md",
    "03-pdf-receipts.md",
    "05-shared-csv-writer.md",
  ]);
  for (const [file, category] of [
    ["01-empty-date-export-fails.md", "bug"],
    ["02-dispatch-retry-gives-up.md", "bug"],
    ["03-pdf-receipts.md", "enhancement"],
  ])
    assert.match(
      readFileSync(join(issues, file), "utf8"),
      new RegExp(`^Status: needs-triage\nCategory: ${category}$`, "m"),
    );
  // The seeded first revision passes the shape check yet must not be
  // accepted, so the exercise can show that structure never grants it.
  const revision =
    /^> \*This was generated by AI during triage\.\*\n\n## Agent Brief\n[\s\S]*?(?=\n### Revision notice)/m.exec(
      readFileSync(join(issues, "01-empty-date-export-fails.md"), "utf8"),
    )?.[0];
  assert.ok(revision);
  const decision = decideIssueContract({
    repository: contractRepository,
    event: { issue: { number: 1 } },
    issue: {
      number: 1,
      node_id: "ISSUE_1",
      body: "## Problem\n\nExporting a date with no deliveries fails.\n",
      labels: [{ name: "bug" }, { name: "needs-triage" }],
      state: "open",
    },
    comments: [{ id: 12, user: { login: "research" }, body: revision }],
    issueEvents: [],
    blockedBy: [],
    parent: null,
    relatedIssues: {},
    permissions: {},
  });
  assert.equal(decision.exitCode, 0, decision.message);
  assert.match(decision.message, /valid triaged Agent Brief/i);
  const exercise = readFileSync(join(routing.path, "docs/exercise.md"), "utf8");
  for (const outcome of [
    /01 is code-bound/,
    /02 is labeled bug but intent-bound/,
    /03 is an intent-bound feature request/,
    /passes the GitHub rules' Agent Brief shape yet does not hold/,
    /exactly one model label it chose itself, records 05 as a blocker, and tells the owner with links/,
    /never re-asks the recorded decision/,
    /The Retry window persists in the product, so the orchestrating agent never infers it/,
    /separate grilling session with the owner, which asks short rounds of numbered questions/,
    /The orchestrating agent writes no brief itself/,
    /when its credentials hold only the write role, when they are a GitHub App installation, when no revision notice arrives, and when the brief is edited after readiness/,
  ])
    assert.match(exercise, outcome);

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
