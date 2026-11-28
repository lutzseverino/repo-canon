import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  issueContractResult,
  isSpecification,
} from "../vendor/repo-canon/validate-issue-contract.mjs";
import { decideIssueContract } from "./helpers/contract-decision.mjs";
import {
  bot,
  bugBody,
  completeAgentBrief,
  ticketBody,
  featureBody,
} from "./helpers/issue-contracts.mjs";

const brief = {
  id: 12,
  node_id: "C12",
  body: completeAgentBrief,
  updated_at: "2026-11-08T00:00:00Z",
  user: { login: "reporter" },
};
function snapshot(body = ticketBody, labels = []) {
  return {
    repository: "example/repository",
    event: { kind: "commentCreated", actor: { login: "reporter" } },
    issue: { number: 42, node_id: "I42", state: "open", body, labels },
    comments: [brief],
    blockedBy: [],
    parent: null,
    issueEvents: [],
    permissions: {},
    bodyRevision: { id: "I42", lastEditedAt: null },
  };
}
const state = (decision) =>
  issueContractResult([{ user: bot, body: decision.feedback.body }]).state;

test("prepared selection keeps a direct ticket ahead of every brief and category", () => {
  const expected = state(decideIssueContract(snapshot()));
  for (const labels of [[], ["type:bug"], ["type:bug", "type:enhancement"]]) {
    const decision = decideIssueContract(snapshot(ticketBody, labels));
    assert.equal(decision.exitCode, 0, decision.message);
    assert.equal(state(decision).kind, "implementation ticket");
    assert.equal(state(decision).source.type, "issue-body");
    assert.equal(state(decision).revision, expected.revision);
  }
  const malformed = decideIssueContract(
    snapshot("## What to build\n\nFix it.", ["type:bug"]),
  );
  assert.equal(malformed.exitCode, 1);
  assert.equal(state(malformed).kind, "implementation ticket");
  assert.match(malformed.message, /Acceptance criteria/);
});

test("any author's newest brief is valid without matching or unique category labels", () => {
  let revision;
  for (const labels of [
    [],
    ["type:bug"],
    ["type:question", "type:enhancement"],
  ]) {
    const s = snapshot(featureBody, labels);
    const decision = decideIssueContract(s);
    assert.equal(decision.exitCode, 0, decision.message);
    const selected = state(decision);
    assert.equal(selected.kind, "triaged Agent Brief");
    assert.equal(selected.source.id, "12");
    assert.equal(selected.revision, revision ?? selected.revision);
    revision = selected.revision;
    assert.match(decision.feedback.body, /Classification discrepancy/);
  }
});

test("valid intake forms report classification discrepancies without creating a revision notice", () => {
  for (const [body, expected] of [
    [bugBody, "type:bug"],
    [featureBody, "type:enhancement"],
  ]) {
    const issue = snapshot(body);
    issue.comments = [];
    const decision = decideIssueContract(issue);
    assert.equal(decision.exitCode, 0, decision.message);
    assert.equal(decision.feedback, null);
    assert.ok(decision.message.includes(expected));
  }
});

function authenticatedSnapshot() {
  const s = snapshot(featureBody);
  s.evaluatedAt = "2026-11-09T01:00:00Z";
  s.sourceEdits = {
    I42: { id: "created:I42", editedAt: null },
    C12: { id: "created:C12", editedAt: null },
  };
  s.sourceHistory = {
    I42: { complete: true, edits: [] },
    C12: { complete: true, edits: [] },
  };
  return s;
}

function notice(s, decision, at) {
  const comment = {
    id: 90,
    user: bot,
    body: decision.feedback.body,
    updated_at: at,
  };
  s.comments = s.comments
    .filter((comment) => comment.id !== 90)
    .concat(comment);
}

function approvedSnapshot() {
  const s = authenticatedSnapshot();
  notice(s, decideIssueContract(s), "2026-11-09T01:00:01Z");
  s.issue.labels.push("state:ready");
  s.permissions.maintainer = { role: "admin" };
  s.issueEvents.push({
    id: 101,
    event: "labeled",
    label: { name: "state:ready" },
    actor: { login: "maintainer" },
    created_at: "2026-11-09T01:00:10Z",
  });
  s.evaluatedAt = "2026-11-09T01:00:11Z";
  const approved = decideIssueContract(s);
  assert.equal(state(approved).status, "approved", approved.message);
  notice(s, approved, "2026-11-09T01:00:12Z");
  return s;
}

test("an authenticated edit-and-restore never inherits approval even when v1 hash bytes repeat", () => {
  const s = approvedSnapshot();
  const revision = state(decideIssueContract(s)).revision;
  s.sourceEdits.C12 = { id: "EDIT2", editedAt: brief.updated_at };
  s.sourceHistory.C12.edits = [
    {
      id: "EDIT2",
      editedAt: brief.updated_at,
      deletedAt: null,
      diff: brief.body,
    },
  ];
  s.evaluatedAt = "2026-11-09T01:00:20Z";
  const ended = decideIssueContract(s);
  assert.equal(state(ended).revision, revision);
  assert.equal(state(ended).status, "awaiting-review");
  assert.deepEqual(ended.removeLabels, ["state:ready"]);
  assert.match(ended.message, /ended approval cannot revive/);
  notice(s, ended, "2026-11-09T01:00:21Z");
  assert.equal(state(decideIssueContract(s)).status, "awaiting-review");
  s.issueEvents.push(
    {
      id: 102,
      event: "unlabeled",
      label: { name: "state:ready" },
      actor: bot,
      created_at: "2026-11-09T01:00:21Z",
    },
    {
      id: 103,
      event: "labeled",
      label: { name: "state:ready" },
      actor: { login: "maintainer" },
      created_at: "2026-11-09T01:00:30Z",
    },
  );
  assert.equal(state(decideIssueContract(s)).status, "approved");
});

test("complete history catches an intermediate direct body even after the intake is restored", () => {
  const s = approvedSnapshot();
  s.sourceHistory.I42.edits = [
    {
      id: "BODY2",
      editedAt: "2026-11-09T01:00:21Z",
      deletedAt: null,
      diff: featureBody,
    },
    {
      id: "BODY1",
      editedAt: "2026-11-09T01:00:20Z",
      deletedAt: null,
      diff: ticketBody,
    },
  ];
  s.sourceEdits.I42 = { id: "BODY2", editedAt: "2026-11-09T01:00:21Z" };
  s.evaluatedAt = "2026-11-09T01:00:22Z";
  const changed = decideIssueContract(s);
  assert.equal(state(changed).status, "awaiting-review");
  assert.match(changed.message, /authenticated edit history changed/);
  const unchanged = approvedSnapshot();
  unchanged.sourceHistory.I42.edits = [
    {
      id: "CONTEXT",
      editedAt: "2026-11-09T01:00:20Z",
      deletedAt: null,
      diff: featureBody + " context",
    },
  ];
  assert.equal(state(decideIssueContract(unchanged)).status, "approved");
});

test("a newer comment that became a brief then ordinary prose ends the old source's approval", () => {
  const s = approvedSnapshot();
  s.comments.push({
    ...brief,
    id: 20,
    node_id: "C20",
    body: "Only discussion now.",
  });
  s.sourceHistory.C20 = {
    complete: true,
    edits: [
      {
        id: "NEW2",
        editedAt: "2026-11-09T01:00:21Z",
        deletedAt: null,
        diff: "Only discussion now.",
      },
      {
        id: "NEW1",
        editedAt: "2026-11-09T01:00:20Z",
        deletedAt: null,
        diff: completeAgentBrief,
      },
    ],
  };
  const changed = decideIssueContract(s);
  assert.equal(state(changed).status, "awaiting-review");
  assert.match(changed.message, /ended approval cannot revive/);
});

test("a prepared body Agent Brief is not a contract before body-mode activation", () => {
  for (const labels of [[], ["type:enhancement"]]) {
    const s = authenticatedSnapshot();
    s.comments = [];
    s.issue.body = completeAgentBrief;
    s.issue.labels = labels;
    const decision = decideIssueContract(s);
    assert.equal(decision.exitCode, 1);
    assert.match(decision.message, /Use one supported issue contract/);
  }
});

test("deleting the only brief falls back to the intake body without approval", () => {
  const s = approvedSnapshot();
  s.comments = s.comments.filter((comment) => comment.id !== brief.id);
  s.event = {
    kind: "commentDeleted",
    actor: { login: "reporter" },
    comment: brief,
  };
  const decision = decideIssueContract(s);
  assert.equal(decision.exitCode, 1);
  assert.match(
    decision.message,
    /Add a reviewed Agent Brief before applying a readiness label/,
  );
});

test("deleted feedback and missing authenticated history cannot reuse an old ready event", () => {
  const s = approvedSnapshot();
  delete s.sourceHistory.I42;
  assert.equal(state(decideIssueContract(s)).status, "awaiting-review");
  s.comments = [brief];
  assert.equal(state(decideIssueContract(s)).status, "awaiting-review");
});

test("specification recognition and a direct wontfix body's kind ignore all category labels", () => {
  for (const labels of [[], ["type:bug"], ["type:bug", "type:enhancement"]]) {
    assert.equal(
      isSpecification({ body: "## Problem Statement\n\nIncomplete", labels }),
      true,
    );
    const s = snapshot(ticketBody, [...labels, "wontfix"]);
    assert.equal(state(decideIssueContract(s)).kind, "implementation ticket");
  }
  assert.equal(
    isSpecification({
      body: "## Problem Statement\n\nContext",
      labels: ["wayfinder:map"],
    }),
    false,
  );
});

test("recorded #920 and #1156 grants retain their literal unchanged-source revisions", () => {
  // #1156 is closed now. This reconstructs its last approved open state from
  // the retained notice and authenticated unedited publication history.
  const examples = JSON.parse(
    readFileSync(
      new URL("./fixtures/contract-grant-continuity.json", import.meta.url),
      "utf8",
    ),
  );
  for (const example of examples) {
    const { brief: historical } = example;
    const s = authenticatedSnapshot();
    s.repository = "lutzseverino/repo-canon";
    s.issue.number = example.issue;
    s.issue.body = example.body;
    s.issue.labels = ["state:ready"];
    s.comments = [
      {
        id: historical.databaseId,
        node_id: historical.id,
        body: historical.body,
        created_at: historical.createdAt,
        updated_at: historical.updatedAt,
        user: { login: historical.author.login },
      },
      {
        id: 90,
        node_id: "N90",
        user: bot,
        body: example.notice.body,
        updated_at: example.notice.updatedAt,
      },
    ];
    s.sourceEdits = {
      I42: { id: "created:I42", editedAt: null },
      [historical.id]: { id: `created:${historical.id}`, editedAt: null },
    };
    s.sourceHistory = {
      I42: { complete: true, edits: [] },
      [historical.id]: { complete: true, edits: [] },
    };
    s.issueEvents = [
      {
        id: example.review.id,
        event: "labeled",
        label: { name: "state:ready" },
        actor: { login: example.review.reviewer },
        created_at: example.review.at,
      },
    ];
    s.permissions = { [example.review.reviewer]: { role: "admin" } };
    s.evaluatedAt = "2026-11-28T00:00:00Z";
    if (example.boundary) s.seamsBoundary = example.boundary;
    const decision = decideIssueContract(s);
    assert.equal(
      decision.exitCode,
      0,
      `#${example.issue}: ${decision.message}`,
    );
    assert.equal(state(decision).revision, example.expectedRevision);
    assert.equal(state(decision).status, "approved");
    assert.deepEqual(decision.removeLabels, []);
  }
});
