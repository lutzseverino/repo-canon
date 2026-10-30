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
      manifest.repositories.orchestrate,
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
  const triageWayfinder = manifest.repositories["triage-wayfinder"];
  const triageIntake = readFileSync(
    join(triageWayfinder.path, ".scratch/triage/01-export-receipts.md"),
    "utf8",
  );
  assert.match(triageIntake, /^Status: needs-triage$/m);
  assert.doesNotMatch(
    triageIntake,
    /## Agent Brief|parcel_reference|exportReceipts\(|ready-for-agent/,
  );
  const triageOwnerInputs = readFileSync(
    join(triageWayfinder.path, ".scratch/triage/owner-inputs.md"),
    "utf8",
  );
  for (const choice of [
    "parcel_reference,delivered_at,signer_name",
    "exportReceipts(receipts, date)",
    "caller-supplied",
    "reference, deliveredAt and signer string fields",
    "2026-10-18",
    ".scratch/triage/owner-inputs.md",
    "ISO 8601 UTC",
    "Parcel-reference ordering",
    "header-only",
    "PDF",
    "scheduled",
  ])
    assert.ok(
      triageOwnerInputs.includes(choice),
      `controlled choice: ${choice}`,
    );
  assert.match(triageOwnerInputs, /simulated participant decisions/);
  assert.match(triageOwnerInputs, /only after the intent-bound handoff/);
  const triageTask = readFileSync(
    join(triageWayfinder.path, "docs/exercise.md"),
    "utf8",
  );
  let previousCheckpoint = -1;
  for (const checkpoint of [
    "### 1. Initial handoff",
    "### 2. Controlled answers and draft",
    "### 3. First notice and independent review",
    "### 4. Edit and invalidation",
    "### 5. Second notice and independent review",
    "### 6. Wayfinder",
  ]) {
    const position = triageTask.indexOf(checkpoint);
    assert.ok(
      position > previousCheckpoint,
      `ordered checkpoint: ${checkpoint}`,
    );
    previousCheckpoint = position;
  }
  for (const requirement of [
    /separate research session/,
    /local decision inbox/,
    /no brief or readiness/i,
    /fresh sessions.*relays.*verbatim/,
    /never author a brief you accept/i,
    /No public CSV\/API\/source choice is inferred/,
    /no factory model suggestion requirement/,
    /child 02; child 03 remains blocked/,
    /Maps and children carry no readiness or workflow state/,
  ])
    assert.match(triageTask, requirement);
  const triageReviewInputs = readFileSync(
    join(triageWayfinder.path, ".scratch/triage/review-inputs.md"),
    "utf8",
  );
  for (const requirement of [
    /not GitHub events or actual authority/,
    /retain its exact text.*revisions\/r1\.md/,
    /notice for r1 only after.*draft exists/,
    /reviewer did not write r1/,
    /actual accept\/reject outcome/,
    /no preapproved verdict/,
    /If r1 holds.*readiness bound to r1/,
    /Replace only.*Summary.*Export Delivery receipts as date-filtered CSV text from caller-supplied receipts/,
    /retain.*revisions\/r2\.md.*both texts/,
    /r1 readiness is invalidated/,
    /Withhold r2 readiness until.*r2's revision notice.*independent reviewer/,
  ])
    assert.match(triageReviewInputs, requirement);
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
    assert.doesNotMatch(text, /ready-for-agent|needs-triage|model:/);
  }
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
  // Inputs exercise observation before approval and closure from worker records.
  assert.match(participantInputs, /1a\. Pre-approval filing/);
  assert.match(
    participantInputs,
    /1b\. Heartbeat.*configured cadence.*no PR.*no directly launched worker/,
  );
  assert.match(
    participantInputs,
    /1c\. Answered blocker question.*no observable continuation/,
  );
  assert.match(
    participantInputs,
    /2\. Approval:.*independent contract review.*other readiness gates/,
  );
  assert.match(orchestrateTask, /Observation.*readiness.*recovery rules/);
  const closureInputs = readFileSync(
    join(orchestrate.path, "docs/closure-inputs.md"),
    "utf8",
  );
  for (const evidence of [
    "11-findings.md",
    "04-factory-only.md",
    "05-already-closed.md",
    "99-unrelated.md",
    "02-final.md",
    "receipt-review#4",
    "tooling#4",
  ])
    assert.ok(closureInputs.includes(evidence), evidence);
  assert.match(closureInputs, /absent from.*ticket table.*creation log/);
  assert.match(closureInputs, /two references.*same.*tooling#4/);
  assert.match(closureInputs, /pre-existing.*01-utf8-crash/);
  assert.match(closureInputs, /directly launched.*without.*issue.*final/);
  assert.match(
    orchestrateTask,
    /reconcile.*PR findings comments.*runs without PRs/,
  );
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
  const inputCheckpoint = factoryReviews
    .split("## Input availability checkpoint: release one step at a time")[1]
    ?.split("## Exact revision and independent acceptance")[0];
  assert.ok(inputCheckpoint);
  const hostStep = inputCheckpoint.split("\n1. ")[1].split("\n2. ")[0];
  const postingStep = inputCheckpoint.split("\n2. ")[1].split("\n3. ")[0];
  const correctedStep = inputCheckpoint.split("\n3. ")[1];
  assert.match(
    hostStep,
    /available only at \/srv\/exercise\/receipts\/sample\.json/,
  );
  assert.match(hostStep, /reviewer who did not write it/);
  assert.match(hostStep, /rejected with no readiness.*shape check passes/);
  assert.match(
    hostStep,
    /missing-input question through the orchestrating agent/,
  );
  assert.match(postingStep, /only after the rejection.*recorded/);
  assert.match(postingStep, /Check it for secrets before posting/);
  assert.match(postingStep, /quote or attach this same non-secret material/);
  assert.match(postingStep, /"reference":"P001"/);
  assert.match(
    correctedStep,
    /replace the host-only source.*issue-comment reference/,
  );
  assert.match(
    correctedStep,
    /corrected candidate and its own simulated revision notice/,
  );
  assert.match(correctedStep, /actual acceptance or rejection/);
  assert.match(
    correctedStep,
    /every other acceptance requirement still applies/,
  );
  assert.match(correctedStep, /Never preseed an approval/);
  assert.doesNotMatch(
    readFileSync(
      join(
        factoryPlanning.path,
        ".scratch/receipts/issues/01-export-receipts.md",
      ),
      "utf8",
    ),
    /P001|sample\.json/,
    "the operator releases the sample only after the missing-input rejection",
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
  const retryIntake = readFileSync(
    join(issues, "02-dispatch-retry-gives-up.md"),
    "utf8",
  );
  assert.doesNotMatch(retryIntake, /60 minutes|one hour|approved Retry window/);
  assert.match(retryIntake, /Only transient carrier failures are retried/);
  const ownerAnswers = readFileSync(
    join(routing.path, ".scratch/routing/owner-inputs.md"),
    "utf8",
  );
  assert.match(ownerAnswers, /only after.*grill.*questions/);
  assert.match(ownerAnswers, /60 minutes.*first transient carrier failure/);
  assert.match(ownerAnswers, /strictly less than 60.*at or beyond 60/);
  assert.match(ownerAnswers, /validation failures never/);
  assert.match(ownerAnswers, /2026-10-10.*earlier owner thread/);
  assert.match(ownerAnswers, /2026-10-26.*owner-inputs\.md/);
  assert.match(ownerAnswers, /No new backoff.*cadence/);
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
  const embeddedRevision =
    /^> \*This was generated by AI during triage\.\*\n\n## Agent Brief\n[\s\S]*?(?=\n### Revision notice)/m.exec(
      readFileSync(join(issues, "01-empty-date-export-fails.md"), "utf8"),
    )?.[0];
  assert.ok(embeddedRevision);
  const revision = readFileSync(
    join(routing.path, ".scratch/routing/contracts/01-r1.md"),
    "utf8",
  );
  assert.equal(embeddedRevision.trim(), revision.trim());
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
  ).split("### Revision notice (controlled input)")[1];
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
  const routingReviews = readFileSync(
    join(routing.path, ".scratch/routing/review-inputs.md"),
    "utf8",
  );
  const stages = [
    "## Turn 1: Sort and challenge",
    "## Turn 2: Owner answers after questions",
    "## Turn 3: Corrected contracts and notices",
    "## Turn 4: Independent acceptance",
    "## Turn 5: Edit after readiness; withhold the notice",
    "## Turn 6: Release the changed revision for renewed review",
    "## Turn 7: Credential handoffs",
  ];
  let priorStage = -1;
  for (const stage of stages) {
    const position = routingReviews.indexOf(stage);
    assert.ok(position > priorStage, `ordered participant stage: ${stage}`);
    priorStage = position;
  }
  assert.match(routingReviews, /Keep the existing CSV header unchanged\./);
  assert.match(routingReviews, /no readiness.*while.*withheld/);
  assert.match(routingReviews, /reviewer who did not write.*exact.*text/);
  assert.match(routingReviews, /including triage notes and whitespace/);
  assert.match(routingReviews, /never run.*ready\.mjs/);
  const editTurn = routingReviews.split(stages[4])[1].split(stages[5])[0];
  assert.match(editTurn, /only after.*independently passed review.*readiness/);
  assert.match(editTurn, /append the exact sentence/);
  assert.match(editTurn, /readiness invalidated immediately/);
  assert.match(editTurn, /earlier notice.*stale.*cannot authorize/);
  assert.doesNotMatch(editTurn, /node docs\/revision-notice\.mjs/);
  const renewedTurn = routingReviews.split(stages[5])[1].split(stages[6])[0];
  assert.match(renewedTurn, /only after turn 5's outcomes exist/);
  assert.match(
    renewedTurn,
    /only after both the new notice and renewed independent acceptance/,
  );

  // Exercise the local relay against dynamically written text. This verifies
  // revision identity, not whether an agent actually performed an independent
  // content review during a skill exercise.
  const draft = revision.replace(
    "**Summary:** Empty-date receipt exports should return a header-only CSV instead of failing",
    "**Summary:** Return the CSV header for dates with no deliveries",
  );
  const changedDraft = draft.replace(
    "**Summary:** Return the CSV header for dates with no deliveries",
    "**Summary:** Return the CSV header for dates with no deliveries Keep the existing CSV header unchanged.",
  );
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
        labels: [{ name: "bug" }, { name: "needs-triage" }],
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
  const retryHash = relay(draft, "02-r1.md", "routing-02", "null");
  // Execute the commands participants are actually given, after the dynamic
  // drafts exist; changing a command's file or metadata breaks its association.
  const commands = [
    ...routingReviews.matchAll(/^- node (docs\/revision-notice\.mjs .+)$/gm),
  ];
  assert.equal(commands.length, 3);
  for (const [index, [, command]] of commands.entries()) {
    const notice = execFileSync(process.execPath, command.split(" "), {
      cwd: routing.path,
      encoding: "utf8",
    });
    assert.ok(notice.includes([correctedHash, retryHash, changedHash][index]));
  }
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
