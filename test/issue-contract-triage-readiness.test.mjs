import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { installedValidator } from "./helpers/installed-validator.mjs";
import {
  factoryTriageResult,
  observedChangeId,
} from "../vendor/repo-canon/validate-issue-contract.mjs";
import { decideIssueContract } from "./helpers/contract-decision.mjs";
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
  created_at: "2026-11-06T10:00:00Z",
  updated_at: "2026-11-06T10:00:00Z",
  user: { login: factory },
  ...overrides,
});
const commentEdit = (contract, overrides = {}) => ({
  __typename: "IssueComment",
  id: contract.node_id,
  body: contract.body,
  author: { __typename: "Bot", login: "factory" },
  createdAt: contract.created_at,
  updatedAt: contract.updated_at,
  lastEditedAt: null,
  editor: null,
  includesCreatedEdit: false,
  userContentEdits: { totalCount: 0, nodes: [] },
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
    triageCommentEdit: commentEdit(contract),
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

test("refuses a person's edit even after its fresh notice and factory readiness", () => {
  const contract = brief({
    body: `${brief().body}\n\nChanged by another account.`,
    updated_at: "2026-11-06T10:00:03Z",
  });
  const input = snapshot({ contract });
  input.triageCommentEdit = commentEdit(contract, {
    lastEditedAt: contract.updated_at,
    editor: { login: "maintainer" },
    includesCreatedEdit: true,
    userContentEdits: { totalCount: 1, nodes: [{ id: "EDIT_1" }] },
  });
  assertRefused(decideIssueContract(input), /edited.*factory/i);
});

test("requires complete consistent provenance for new and recorded factory approval", async (t) => {
  const clean = brief();
  const accepted = decideIssueContract(snapshot());
  const approved = {
    id: 13,
    user: bot,
    body: accepted.feedback.body,
    updated_at: "2026-11-06T10:00:20Z",
  };
  /** @type {[string, any][]} */
  const cases = [
    ["missing evidence", undefined],
    ["unreadable evidence", null],
    ["missing last edit", { lastEditedAt: undefined }],
    ["missing editor", { editor: undefined }],
    ["missing creation edit flag", { includesCreatedEdit: undefined }],
    ["missing history", { userContentEdits: null }],
    ["missing history nodes", { userContentEdits: { totalCount: 0 } }],
    [
      "inconsistent history",
      { userContentEdits: { totalCount: 0, nodes: [{ id: "EDIT" }] } },
    ],
    ["different comment", { id: "OTHER_COMMENT" }],
    ["different body", { body: `${clean.body} changed` }],
    ["different author", { author: { __typename: "User", login: "other" } }],
    ["different creation time", { createdAt: "2026-11-06T09:59:59Z" }],
    ["different update time", { updatedAt: "2026-11-06T10:00:01Z" }],
    ["missing creation time", { createdAt: undefined }],
    ["wrong node type", { __typename: "Issue" }],
    [
      "same-second edit",
      {
        lastEditedAt: clean.created_at,
        editor: { login: "person" },
        includesCreatedEdit: true,
        userContentEdits: { totalCount: 1, nodes: [{ id: "EDIT" }] },
      },
    ],
    [
      "restored original bytes",
      {
        lastEditedAt: "2026-11-06T10:00:02Z",
        editor: { login: "factory" },
        includesCreatedEdit: true,
        userContentEdits: { totalCount: 2, nodes: [{ id: "RESTORE" }] },
      },
    ],
    [
      "hidden edit date with history",
      { userContentEdits: { totalCount: 1, nodes: [{ id: "EDIT" }] } },
    ],
    ["hidden history with editor", { editor: { login: "person" } }],
    ["hidden history with creation edit flag", { includesCreatedEdit: true }],
  ];
  for (const [name, changes] of cases) {
    await t.test(String(name), () => {
      for (const recorded of [false, true]) {
        const input = snapshot();
        input.triageCommentEdit =
          changes == null ? changes : commentEdit(clean, changes);
        // A factory role must not bypass the provenance requirement.
        input.permissions[factory] = role("admin");
        if (recorded) {
          input.comments = [clean, approved];
          input.event = neutralEvent({
            action: "edited",
            sender: { login: "x" },
          });
        }
        assertRefused(
          decideIssueContract(input),
          /edit provenance|edited.*factory/i,
        );
      }
    });
  }
});

test("authorized people can review an edited or unverifiable factory brief", () => {
  const contract = brief({ updated_at: "2026-11-06T10:00:03Z" });
  for (const evidence of [
    null,
    commentEdit(contract, {
      lastEditedAt: contract.updated_at,
      editor: { login: "maintainer" },
      includesCreatedEdit: true,
    }),
  ]) {
    const input = snapshot({ actor: "maintainer", contract });
    input.triageCommentEdit = evidence;
    assertApproved(decideIssueContract(input), "maintainer", contract);
  }
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

test("installed validator reads only the canonical triage identity and preserves missing/invalid behavior", async (t) => {
  const target = installedValidator(
    t,
    "vendor/repo-canon/validate-issue-contract.mjs",
  );
  const root = resolve(dirname(target), "../..");
  const { factoryTriageResult: readResult } = await import(
    pathToFileURL(target).href
  );
  mkdirSync(join(root, ".factory"));
  mkdirSync(join(root, ".scriptorium"));
  const legacy = { marker: "legacy:run", author: "legacy[bot]" };
  const canonical = {
    marker: "canonical:result",
    author: "canonical-reviewer[bot]",
  };
  writeFileSync(
    join(root, ".factory/config.json"),
    JSON.stringify({ triageResult: legacy }),
  );
  assert.equal(
    readResult(),
    null,
    "legacy-only inputs supply no triage identity",
  );
  const config = join(root, ".scriptorium/config.json");
  writeFileSync(config, JSON.stringify({ triageResult: canonical }));
  assert.deepEqual(
    readResult(),
    canonical,
    "canonical identity wins over conflicting legacy input",
  );
  writeFileSync(config, "{");
  assert.throws(() => readResult(), SyntaxError);
  writeFileSync(
    config,
    JSON.stringify({
      triageResult: { marker: " bad", author: "canonical[bot]" },
    }),
  );
  assert.throws(() => readResult(), /triageResult/);
});
