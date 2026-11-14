import { execFixtureGit } from "../scripts/support/fixture-git.mjs";
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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { decideIssueContract } from "./helpers/contract-decision.mjs";
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
    "factory-triage",
    "host-grant",
    "orchestrate",
    "planning",
    "project-agent-guidance",
    "session-naming",
    "triage-routing",
    "triage-wayfinder",
  ]);
  assert.equal(
    manifest.source.upstreamCommit,
    "24fe0ef7737efae15c87225755e9f6f5965e4888",
  );
  assert.deepEqual(Object.keys(manifest.source.linkedSkillDirectories).sort(), [
    "babysit",
    "code-review",
    "codebase-design",
    "domain-modeling",
    "factory",
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
      "factory",
    ],
  );
  const expectedSkills = {
    "project-agent-guidance": [],
    planning: [
      "grill-with-docs",
      "to-spec",
      "to-tickets",
      "domain-modeling",
      "grilling",
    ],
    "triage-wayfinder": [
      "triage",
      "grill-with-docs",
      "to-spec",
      "to-tickets",
      "wayfinder",
      "grilling",
      "domain-modeling",
      "research",
      "prototype",
    ],
    "factory-planning": [
      "triage",
      "grill-with-docs",
      "to-spec",
      "to-tickets",
      "grilling",
      "domain-modeling",
      "research",
      "prototype",
    ],
    "triage-routing": [
      "triage",
      "research",
      "grill-with-docs",
      "to-spec",
      "to-tickets",
      "grilling",
      "domain-modeling",
    ],
    "factory-triage": ["triage"],
    delivery: [
      "implement",
      "pr",
      "tdd",
      "prototype",
      "babysit",
      "codebase-design",
    ],
    orchestrate: ["orchestrate", "factory"],
    "host-grant": ["orchestrate", "factory"],
    "session-naming": [],
  };
  for (const [name, skills] of Object.entries(expectedSkills))
    assert.deepEqual(
      readdirSync(
        join(manifest.repositories[name].path, ".agents/skills"),
      ).sort(),
      [...skills, "repository-standards"].sort(),
      `${name} installs exactly its selected skills`,
    );
  const naming = manifest.repositories["session-naming"];
  assert.deepEqual(naming.skills, []);
  assert.ok(
    readFileSync(join(naming.path, "AGENTS.md"), "utf8").startsWith(
      readFileSync(join(root, "AGENTS.md"), "utf8"),
    ),
    "workers discover the naming rule without orchestration skills",
  );
  const deliveryScenario = manifest.repositories.delivery;
  for (const repository of Object.values(manifest.repositories)) {
    for (const path of ["AGENTS.md", "docs/exercise.md"])
      assert.ok(
        statSync(join(repository.path, path)).isFile(),
        `${repository.path}/${path}`,
      );
    assert.equal(
      execFixtureGit(["status", "--porcelain"], {
        cwd: repository.path,
        encoding: "utf8",
      }),
      "",
    );
  }
  for (const path of [".scratch/delivery/spec.md", "docs/pr-evidence.md"])
    assert.ok(statSync(join(deliveryScenario.path, path)).isFile());

  assert.deepEqual(deliveryScenario.skills, [
    "implement",
    "pr",
    "babysit",
    "prototype",
    "codebase-design",
  ]);
  const deliveryDesign = join(
    deliveryScenario.path,
    ".agents/skills/codebase-design",
  );
  assert.ok(lstatSync(deliveryDesign).isSymbolicLink());
  assert.equal(
    realpathSync(deliveryDesign),
    manifest.source.linkedSkillDirectories["codebase-design"].path,
  );
  assert.match(
    manifest.source.linkedSkillDirectories["codebase-design"].sha256,
    /^[0-9a-f]{64}$/,
  );
  assert.equal(
    readFileSync(join(deliveryDesign, "SKILL.md"), "utf8"),
    readFileSync(join(root, ".agents/skills/codebase-design/SKILL.md"), "utf8"),
  );
  const deliveryConfiguration = JSON.parse(
    readFileSync(
      join(deliveryScenario.path, ".scriptorium/config.json"),
      "utf8",
    ),
  );
  assert.ok(deliveryConfiguration.runKinds.implement);
  assert.ok(deliveryConfiguration.runKinds.review);
  for (const repository of Object.values(manifest.repositories)) {
    const factory = [
      manifest.repositories["factory-planning"],
      manifest.repositories["factory-triage"],
      manifest.repositories["triage-routing"],
      manifest.repositories.orchestrate,
      manifest.repositories["host-grant"],
      manifest.repositories.delivery,
    ].includes(repository);
    assert.equal(repository.profile, factory ? "factory" : "standard");
    const lookup = execFileSync(
      process.execPath,
      [".agents/skills/repository-standards/rules.mjs"],
      { cwd: repository.path, encoding: "utf8" },
    );

    assert.deepEqual(
      repository.ruleInputs,
      factory
        ? [
            "rules/comments.md",
            "rules/github-repository-configuration.md",
            "rules/factory-workflow.md",
          ]
        : ["rules/comments.md", "rules/github-repository-configuration.md"],
    );
    for (const input of repository.ruleInputs) {
      assert.equal(
        readFileSync(join(repository.path, ".repo-standards", input), "utf8"),
        readFileSync(join(root, input), "utf8"),
      );
    }

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
    let position = -1;
    for (const input of repository.ruleInputs) {
      const bytes = readFileSync(join(root, input), "utf8");
      const found = lookup.indexOf(bytes);
      assert.ok(found > position, `${input} appears in lookup order`);
      position = found;
    }
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
    "rules/comments.md",
    "rules/github-repository-configuration.md",
    "rules/factory-workflow.md",
    "scripts/support/repository-standards/SKILL.md",
    "scripts/support/repository-standards/rules.mjs",
    ".scriptorium/config.json",
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

  // Every skill links its owned copy, the skill adoption installs.
  for (const [name, { path }] of Object.entries(
    manifest.source.linkedSkillDirectories,
  ))
    assert.equal(path, realpathSync(join(root, ".agents/skills", name)), name);
  // Direct grill contracts stay body contracts in either repository. Exercise
  // the real validator and hash relay without any tracker publication or prose
  // assertions about what an agent should say.
  const planning = manifest.repositories.planning;
  const scenarios = JSON.parse(
    readFileSync(
      join(planning.path, ".scratch/planning/scenarios.json"),
      "utf8",
    ),
  );
  const contracts = new Map(
    [...scenarios.contracts, scenarios.amendment.newTicket].map((contract) => [
      contract.id,
      contract,
    ]),
  );
  function nativeIssue(id) {
    const contract = contracts.get(id);
    assert.ok(contract, `native relationship target ${id}`);
    return {
      number: Number(id.split("#")[1]),
      node_id: id,
      html_url: `https://github.com/${id.replace("#", "/issues/")}`,
      body: contract.body,
      labels: [],
      state: "open",
    };
  }
  for (const contract of contracts.values()) {
    const issue = nativeIssue(contract.id);
    const parentEdge = [
      ...scenarios.nativeRelationships.subIssues,
      ...scenarios.amendment.addRelationships.subIssues,
    ].find(({ child }) => child === contract.id);
    const blockedBy = [
      ...scenarios.nativeRelationships.blockedBy,
      ...scenarios.amendment.addRelationships.blockedBy,
    ]
      .filter(({ issue }) => issue === contract.id)
      .map(({ blocker }) => nativeIssue(blocker));
    const result = decideIssueContract({
      repository: contract.id.split("#")[0],
      event: { issue: { number: issue.number } },
      issue,
      bodyRevision: { id: issue.node_id, lastEditedAt: null },
      comments: [],
      issueEvents: [],
      parent: parentEdge ? nativeIssue(parentEdge.parent) : null,
      blockedBy,
      relatedIssues: {},
      permissions: {},
    });
    assert.equal(result.exitCode, 0, result.message);
    assert.match(result.message, new RegExp(`valid ${contract.kind}`, "i"));
    assert.doesNotMatch(result.message, /with state:ready bound/i);
    const path = ".scratch/planning/retained-contract.md";
    writeFileSync(join(planning.path, path), contract.body);
    // Use the copied source relay; no runtime packages or hosting credentials.
    const notice = execFileSync(
      process.execPath,
      [
        join(root, "scripts/support/planning-revision-notice.mjs"),
        path,
        issue.node_id,
        "null",
        contract.kind,
      ],
      {
        cwd: planning.path,
        encoding: "utf8",
        env: { ...process.env, PATH: "" },
      },
    );
    const hash = /sha256:[0-9a-f]{64}/.exec(result.feedback.body)?.[0];
    assert.ok(hash);
    assert.ok(notice.includes(hash), contract.id);
    assert.ok(notice.includes('"type":"issue-body"'));
  }
  assert.equal(
    scenarios.nativeRelationships.subIssues.length,
    scenarios.contracts.length - 1,
  );
  assert.equal(
    new Set(scenarios.nativeRelationships.subIssues.map(({ parent }) => parent))
      .size,
    1,
  );
  assert.equal(
    new Set(scenarios.contracts.map(({ id }) => id.split("#")[0])).size,
    2,
  );
  // This is an injected platform failure, never successful graph evidence.
  assert.ok(scenarios.linkFailure.platformFailure);
  assert.ok(contracts.has(scenarios.linkFailure.issue));
  assert.ok(contracts.has(scenarios.linkFailure.blocker));
  assert.ok(contracts.has(scenarios.amendment.specification));
  for (const id of scenarios.amendment.affectedTickets)
    assert.ok(contracts.has(id));
  const triageWayfinder = manifest.repositories["triage-wayfinder"];
  const triageIntake = readFileSync(
    join(triageWayfinder.path, ".scratch/triage/01-export-receipts.md"),
    "utf8",
  );
  assert.match(triageIntake, /^Status: state:triage$/m);
  assert.doesNotMatch(triageIntake, /state:ready/);
  assert.equal(
    readdirSync(join(triageWayfinder.path, ".scratch/triage")).includes(
      "revisions",
    ),
    false,
    "contract texts must come from the actual draft and edit, not a seeded approval",
  );
  for (const [child, blocker, status] of [
    ["01-define-failure-categories.md", "None", "resolved"],
    ["02-choose-default-retry-window.md", "01", "open"],
    ["03-choose-retry-window.md", "02", "open"],
  ]) {
    const text = readFileSync(
      join(triageWayfinder.path, ".scratch/shipping-map/issues", child),
      "utf8",
    );
    assert.ok(text.includes(`Blocked by: ${blocker}\n`));
    assert.ok(text.includes(`Status: ${status}\n`));
    assert.doesNotMatch(text, /state:ready|state:triage|model:/);
  }
  const routing = manifest.repositories["triage-routing"];
  const routingResearch = join(routing.path, ".agents/skills/research");
  assert.equal(
    readFileSync(join(routingResearch, "SKILL.md"), "utf8"),
    readFileSync(join(root, ".agents/skills/research/SKILL.md"), "utf8"),
  );
  assert.ok(lstatSync(routingResearch).isSymbolicLink());
  assert.equal(
    realpathSync(routingResearch),
    realpathSync(join(root, ".agents/skills/research")),
  );
  assert.equal(
    realpathSync(routingResearch),
    manifest.source.linkedSkillDirectories.research.path,
  );
  const orchestrate = manifest.repositories.orchestrate;
  assert.deepEqual(orchestrate.skills, ["orchestrate", "factory"]);
  for (const skill of orchestrate.skills)
    assert.equal(
      realpathSync(join(orchestrate.path, ".agents/skills", skill)),
      realpathSync(join(root, ".agents/skills", skill)),
    );
  // The factory skill pauses the repository with its configured hold label.
  assert.equal(
    readFileSync(join(orchestrate.path, ".scriptorium/config.json"), "utf8"),
    readFileSync(join(root, ".scriptorium/config.json"), "utf8"),
  );
  const workbench = orchestrate.workbench.path;
  for (const path of [orchestrate.path, workbench]) {
    assert.equal(
      execFixtureGit(["remote"], { cwd: path, encoding: "utf8" }),
      "",
    );
    assert.equal(
      execFixtureGit(["status", "--porcelain"], {
        cwd: path,
        encoding: "utf8",
      }),
      "",
    );
    assert.equal(
      execFixtureGit(["config", "commit.gpgsign"], {
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
    ["inbox.md", "index.md", "now.md", "wishes.md"],
  );
  assert.deepEqual(
    readdirSync(join(orchestrate.path, ".scratch/tooling/issues")),
    ["01-utf8-crash.md"],
    "the participant must file the new finding, not the fixture builder",
  );
  // Two workers share one host access grant and report in either order.
  const hostGrant = manifest.repositories["host-grant"];
  assert.deepEqual(hostGrant.skills, ["orchestrate", "factory"]);
  for (const skill of hostGrant.skills)
    assert.equal(
      realpathSync(join(hostGrant.path, ".agents/skills", skill)),
      realpathSync(join(root, ".agents/skills", skill)),
    );
  assert.equal(
    readFileSync(join(hostGrant.path, ".scriptorium/config.json"), "utf8"),
    readFileSync(join(root, ".scriptorium/config.json"), "utf8"),
  );
  const grantWorkbench = hostGrant.workbench.path;
  for (const path of [hostGrant.path, grantWorkbench]) {
    assert.equal(
      execFixtureGit(["remote"], { cwd: path, encoding: "utf8" }),
      "",
    );
    assert.equal(
      execFixtureGit(["status", "--porcelain"], {
        cwd: path,
        encoding: "utf8",
      }),
      "",
    );
  }
  assert.deepEqual(
    readdirSync(grantWorkbench)
      .filter((name) => name !== ".git")
      .sort(),
    ["inbox.md", "index.md", "now.md", "rollout", "wishes.md"],
  );
  const rollout = join(hostGrant.path, ".scratch/rollout");
  assert.match(
    readFileSync(join(rollout, "issues/01-serve-receipts.md"), "utf8"),
    /^Status: closed$/m,
  );
  for (const ticket of [
    "02-accept-endpoint-on-staging.md",
    "03-accept-export-on-staging.md",
  ]) {
    const text = readFileSync(join(rollout, "issues", ticket), "utf8");
    assert.match(text, /^Status: state:ready$/m);
    assert.match(text, /^Labels: .*model:.*factory:skip$/m);
    assert.match(text, /^Blocked by: 01 \(closed\)$/m);
  }
  const sourcePull = readFileSync(join(rollout, "pulls/21.md"), "utf8");
  assert.match(sourcePull, /^Closes #1$/m);
  assert.match(sourcePull, /^Part of #2$/m);
  assert.match(sourcePull, /^Part of #3$/m);
  assert.doesNotMatch(sourcePull, /Closes #[23]/);
  // The factory triage run gets one run per issue, each with its own result
  // path, and the tracker starts with every issue waiting on triage.
  const factoryTriage = manifest.repositories["factory-triage"];
  assert.deepEqual(factoryTriage.skills, ["triage"]);
  const runFacts = JSON.parse(
    readFileSync(
      join(factoryTriage.path, ".scratch/factory-triage/run-facts.json"),
      "utf8",
    ),
  );
  assert.ok(runFacts.allowedModels.length > 0);
  assert.equal(
    new Set(runFacts.allowedModels).size,
    runFacts.allowedModels.length,
  );
  assert.deepEqual(Object.keys(runFacts.runResult).sort(), [
    "fields",
    "outcomes",
  ]);
  assert.equal(runFacts.runs.length, 3);
  assert.equal(
    new Set(runFacts.runs.map(({ result }) => result)).size,
    runFacts.runs.length,
  );
  assert.equal(
    readdirSync(join(factoryTriage.path, ".scratch/factory-triage")).includes(
      "results",
    ),
    false,
    "each run writes its own result",
  );
  const intakes = runFacts.runs.map(({ issue, run }) => {
    assert.ok(run);
    const text = readFileSync(join(factoryTriage.path, issue), "utf8");
    assert.match(text, /^Status: state:triage$/m);
    assert.doesNotMatch(text, /state:ready|model:|gate:/);
    return text;
  });
  // One issue carries a person's priority, and one comes from an outside
  // reporter without a category.
  assert.equal(
    intakes.filter((text) => /^Labels: .*priority:/m.test(text)).length,
    1,
  );
  const outside = intakes.filter((text) =>
    /^Author: .*outside reporter/m.test(text),
  );
  assert.equal(outside.length, 1);
  assert.doesNotMatch(outside[0], /^Labels: .*type:/m);
  for (const record of ["CHANGELOG.md", "docs/adr/README.md"])
    assert.ok(statSync(join(factoryTriage.path, record)).isFile(), record);

  const factoryPlanning = manifest.repositories["factory-planning"];
  const factoryIntake = readFileSync(
    join(
      factoryPlanning.path,
      ".scratch/receipts/issues/01-export-receipts.md",
    ),
    "utf8",
  );
  assert.match(factoryIntake, /^Status: state:triage$/m);
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
      new RegExp(`^Status: state:triage\nCategory: ${category}$`, "m"),
    );
  // The seeded first revision passes the shape check yet must not be
  // accepted, so the exercise can show that structure never grants it.
  const revision = readFileSync(
    join(routing.path, ".scratch/routing/contracts/01-r1.md"),
    "utf8",
  );
  const seededIssue = readFileSync(
    join(issues, "01-empty-date-export-fails.md"),
    "utf8",
  );
  assert.ok(seededIssue.includes(revision.trim()));
  const decision = decideIssueContract({
    repository: contractRepository,
    event: { issue: { number: 1 } },
    issue: {
      number: 1,
      node_id: "ISSUE_1",
      body: "## Problem\n\nExporting a date with no deliveries fails.\n",
      labels: [{ name: "type:bug" }, { name: "state:triage" }],
      state: "open",
    },
    comments: [
      { id: "routing-01", user: { login: "research" }, body: revision },
    ],
    issueEvents: [],
    blockedBy: [],
    parent: null,
    relatedIssues: {},
    permissions: {},
  });
  assert.equal(decision.exitCode, 0, decision.message);
  assert.match(decision.message, /valid triaged Agent Brief/i);
  const seededNotice = readFileSync(
    join(issues, "01-empty-date-export-fails.md"),
    "utf8",
  );
  const exactRevision = /sha256:[0-9a-f]{64}/.exec(decision.feedback.body)?.[0];
  assert.ok(exactRevision);
  assert.ok(seededNotice.includes(exactRevision));
  assert.equal(
    manifest.source.inputFiles["scripts/support/planning-revision-notice.mjs"]
      ?.sha256,
    createHash("sha256")
      .update(
        readFileSync(
          join(root, "scripts/support/planning-revision-notice.mjs"),
        ),
      )
      .digest("hex"),
  );
  // Exercise the local relay against dynamically written text. This verifies
  // revision identity, not whether an agent actually performed an independent
  // content review during a skill exercise.
  const draft = revision.replace(
    /(\*\*Summary:\*\*)[^\n]+/,
    "$1 A corrected fixture summary",
  );
  const changedDraft = `${draft}\n\nA later edit.\n`;
  function relay(body, file, id, editedAt) {
    const path = `.scratch/routing/contracts/${file}`;
    writeFileSync(join(routing.path, path), body);
    const notice = execFileSync(
      process.execPath,
      ["docs/revision-notice.mjs", path, id, editedAt],
      {
        cwd: routing.path,
        encoding: "utf8",
        env: { ...process.env, PATH: "" },
      },
    );
    const result = decideIssueContract({
      repository: contractRepository,
      event: { issue: { number: 1 } },
      issue: {
        number: 1,
        body: "Intake context.",
        labels: [{ name: "type:bug" }, { name: "state:triage" }],
        state: "open",
      },
      comments: [
        { id, updated_at: editedAt === "null" ? null : editedAt, body },
      ],
      issueEvents: [],
      blockedBy: [],
      parent: null,
      relatedIssues: {},
      permissions: {},
    });
    assert.equal(result.exitCode, 0, result.message);
    const hash = /sha256:[0-9a-f]{64}/.exec(result.feedback.body)?.[0];
    assert.ok(hash);
    assert.ok(
      notice.includes(hash),
      "relay matches the validator's exact revision",
    );
    assert.ok(notice.includes(id));
    assert.ok(notice.includes(editedAt));
    return hash;
  }
  const correctedHash = relay(
    draft,
    "01-r2.md",
    "routing-01",
    "2026-10-26T10:01:00Z",
  );
  const changedHash = relay(
    changedDraft,
    "01-r3.md",
    "routing-01",
    "2026-10-26T10:02:00Z",
  );
  assert.notEqual(correctedHash, exactRevision);
  assert.notEqual(changedHash, correctedHash);
  // Body changes matter even when the source metadata has not changed.
  assert.notEqual(
    relay(
      changedDraft,
      "changed-body.md",
      "routing-01",
      "2026-10-26T10:01:00Z",
    ),
    correctedHash,
  );
  // Source identity and edit time are also part of the validator's convention.
  assert.notEqual(
    relay(draft, "changed-source.md", "routing-02", "2026-10-26T10:01:00Z"),
    correctedHash,
  );
  assert.notEqual(
    relay(draft, "changed-time.md", "routing-01", "2026-10-26T10:02:00Z"),
    correctedHash,
  );
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
  assert.equal(
    localLookup(),
    execFileSync(
      process.execPath,
      [".agents/skills/repository-standards/rules.mjs"],
      { cwd: manifest.repositories["factory-planning"].path, encoding: "utf8" },
    ),
  );
  rmSync(join(detached, ".repo-standards/rules/factory-workflow.md"));
  assert.throws(localLookup, /Command failed/);

  assert.equal(
    execFixtureGit(["status", "--porcelain"], {
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
