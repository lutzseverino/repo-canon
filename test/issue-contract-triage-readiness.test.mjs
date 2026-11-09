import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  decideIssueContract,
  factoryTriageResult,
  observedChangeId,
} from "../vendor/repo-canon/validate-issue-contract.mjs";
import {
  bot,
  briefRevision,
  completeAgentBrief,
  featureBody,
  feedbackState,
  neutralEvent,
  recordedState,
  repository,
  role,
} from "./helpers/issue-contracts.mjs";

// The factory's triage result (ADR 0030): the Agent Brief its account posts,
// naming the triage run on one marked line.
const factory = "factory[bot]";
const triageResult = { marker: "factory:run", author: factory };
const runLine = (run) => `<!-- factory:run ${JSON.stringify({ run })} -->`;
const brief = (overrides = {}) => ({
  id: 12,
  node_id: "COMMENT_12",
  body: `${completeAgentBrief}\n\n${runLine("triage-7")}`,
  updated_at: "2026-11-06T10:00:00Z",
  user: { login: factory },
  ...overrides,
});
const notice = (contract) => ({
  id: 13,
  body: feedbackState({
    status: "awaiting-review",
    revision: briefRevision(contract),
    kind: "triaged Agent Brief",
  }),
  user: bot,
  updated_at: "2026-11-06T10:00:05Z",
});
const readiness = (actor) => ({
  id: 4,
  event: "labeled",
  label: { name: "state:ready" },
  actor: { login: actor },
  created_at: "2026-11-06T10:00:10Z",
});

// A feature request a person opened, whose brief awaits review, with
// readiness that `actor` applied after the notice.
/** @param {Record<string, any>} options */
function snapshot({
  actor = factory,
  contract = brief(),
  comments = [contract, notice(contract)],
  opener = "reporter",
  body = featureBody,
  configured = triageResult,
} = {}) {
  return {
    repository,
    event: neutralEvent({
      action: "labeled",
      label: { name: "state:ready" },
      sender: { login: actor },
    }),
    issue: {
      number: 42,
      node_id: "ISSUE_42",
      body,
      labels: [{ name: "type:enhancement" }, { name: "state:ready" }],
      state: "open",
      user: { login: opener },
      created_at: "2026-11-06T09:00:00Z",
    },
    comments,
    blockedBy: [],
    parent: null,
    bodyRevision: { id: "ISSUE_42", lastEditedAt: null },
    issueEvents: [readiness(actor)],
    permissions: { maintainer: role("admin"), [factory]: { role: null } },
    triageResult: configured,
  };
}

function assertApproved(decision, reviewer, contract = brief()) {
  assert.equal(decision.exitCode, 0, decision.message);
  assert.deepEqual(decision.removeLabels, []);
  assert.deepEqual(recordedState(decision.feedback.body), {
    status: "approved",
    revision: briefRevision(contract),
    label: "state:ready",
    reviewer,
    reviewEventId: "4",
    sourceInvalidation: null,
  });
}

function assertRefused(decision, reason) {
  assert.equal(decision.exitCode, 1);
  assert.deepEqual(decision.removeLabels, ["state:ready"]);
  assert.match(decision.message, reason);
  assert.equal(recordedState(decision.feedback.body).status, "awaiting-review");
}

test("approves readiness the factory's triage run applied with its result", () => {
  assertApproved(decideIssueContract(snapshot()), factory);
});

test("refuses the factory's readiness when triage names no result", () => {
  assertRefused(
    decideIssueContract(snapshot({ configured: null })),
    /@factory\[bot\] is not authorized/,
  );
});

test("refuses the factory's readiness without a matching triage result", async (t) => {
  const unbacked = /not backed by the factory's triage result/;
  /** @type {[string, any][]} */
  const unmatched = [
    ["an unmarked brief", brief({ body: completeAgentBrief })],
    [
      "a marked line naming no run",
      brief({ body: `${completeAgentBrief}\n\n<!-- factory:run {} -->` }),
    ],
    [
      "two marked lines",
      brief({
        body: `${completeAgentBrief}\n\n${runLine("triage-7")}\n${runLine("triage-8")}`,
      }),
    ],
    ["a brief another account posted", brief({ user: { login: "triager" } })],
  ];
  for (const [name, contract] of unmatched)
    await t.test(name, () =>
      assertRefused(decideIssueContract(snapshot({ contract })), unbacked),
    );

  await t.test("a result for an earlier brief revision", () => {
    // A person's newer brief replaced the factory's result as the contract.
    const newer = brief({
      id: 14,
      node_id: "COMMENT_14",
      user: { login: "x" },
    });
    assertRefused(
      decideIssueContract(
        snapshot({
          contract: newer,
          comments: [brief(), newer, notice(newer)],
        }),
      ),
      unbacked,
    );
  });

  await t.test("a result edited after its revision notice", () => {
    const edited = brief({ updated_at: "2026-11-06T10:00:08Z" });
    assertRefused(
      decideIssueContract(
        snapshot({ contract: edited, comments: [edited, notice(brief())] }),
      ),
      /Wait for the validator to publish/,
    );
  });
});

test("refuses a triage result for an issue the factory wrote in that run", async (t) => {
  await t.test("the same run", () =>
    assertRefused(
      decideIssueContract(
        snapshot({
          opener: factory,
          body: `${featureBody}\n\n${runLine("triage-7")}`,
        }),
      ),
      /triage run triage-7 wrote this issue/,
    ),
  );
  await t.test("an unnamed run", () =>
    assertRefused(
      decideIssueContract(snapshot({ opener: factory })),
      /without naming the run that wrote it/,
    ),
  );
  await t.test("another run", () =>
    assertApproved(
      decideIssueContract(
        snapshot({
          opener: factory,
          body: `${featureBody}\n\n${runLine("implement-3")}`,
        }),
      ),
      factory,
    ),
  );
});

test("person readiness is unchanged whether triage names a result or not", () => {
  for (const configured of [triageResult, null]) {
    assertApproved(
      decideIssueContract(snapshot({ actor: "maintainer", configured })),
      "maintainer",
    );
  }
});

test("a recorded triage approval holds on later runs and ends with its result", () => {
  const first = decideIssueContract(snapshot());
  const approved = { ...first.feedback, id: 13, user: bot };
  const later = snapshot();
  later.comments = [
    brief(),
    { ...approved, updated_at: "2026-11-06T10:00:20Z" },
  ];
  later.event = neutralEvent({ action: "edited", sender: { login: "x" } });
  assertApproved(decideIssueContract(later), factory);
  later.triageResult = null;
  assertRefused(decideIssueContract(later), /is not authorized/);
});

test("reads the triage result the factory configuration names", (t) => {
  const root = mkdtempSync(join(tmpdir(), "factory-configuration-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const configuration = (value) => {
    const path = join(root, "config.json");
    writeFileSync(path, JSON.stringify(value));
    return path;
  };
  assert.equal(factoryTriageResult(join(root, "missing.json")), null);
  assert.equal(factoryTriageResult(configuration({ version: 2 })), null);
  assert.deepEqual(
    factoryTriageResult(configuration({ triageResult })),
    triageResult,
  );
  for (const malformed of [
    null,
    { marker: "factory:run" },
    { marker: " factory:run", author: factory },
    { marker: "factory:run", author: "" },
  ])
    assert.throws(
      () => factoryTriageResult(configuration({ triageResult: malformed })),
      /triageResult/,
    );
});

test("names the latest readiness change a result observes", () => {
  const change = (id, action, login, label = "state:ready") => ({
    id,
    action,
    label,
    actor: { login },
    time: "2026-11-06T10:00:00Z",
  });
  assert.equal(observedChangeId([]), null);
  assert.equal(
    observedChangeId([
      change(1, "added", "maintainer"),
      change(2, "removed", "github-actions[bot]"),
      change(3, "added", "maintainer", "model:x"),
    ]),
    "1",
  );
  assert.equal(
    observedChangeId([
      change(1, "added", "maintainer"),
      change(2, "removed", "maintainer"),
    ]),
    "2",
  );
});
