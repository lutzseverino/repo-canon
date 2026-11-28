import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { compareSourceInventory } from "../scripts/issue-contract-source-inventory.mjs";
import { sourceContentHistories as completeSourceHistory } from "../scripts/issue-contract-store.mjs";
import { decideIssueContract } from "../vendor/repo-canon/validate-issue-contract.mjs";
import { ticketBody } from "./helpers/issue-contracts.mjs";

const first = {
  id: "EDIT2",
  editedAt: "2026-11-01T00:00:02Z",
  deletedAt: null,
  diff: "Current body.",
};
const second = {
  id: "EDIT1",
  editedAt: "2026-11-01T00:00:01Z",
  deletedAt: null,
  diff: "Prior body.",
};

function historyConnection(pages) {
  const cursors = [];
  return {
    cursors,
    access: {
      async request({ body }) {
        cursors.push(body.variables.after);
        return { data: { data: { node: pages.shift() } } };
      },
    },
  };
}
function historyPage(nodes, next = false, totalCount = 2) {
  return {
    id: "ISSUE",
    lastEditedAt: first.editedAt,
    userContentEdits: {
      totalCount,
      nodes,
      pageInfo: { hasNextPage: next, endCursor: next ? "next" : null },
    },
  };
}

test("source inventory traverses every authenticated edit page", async () => {
  const connection = historyConnection([
    historyPage([first], true),
    historyPage([second]),
  ]);
  const result = await completeSourceHistory(connection, ["ISSUE", "ISSUE"]);
  assert.deepEqual(connection.cursors, [null, "next"]);
  assert.deepEqual(result, {
    ISSUE: { complete: true, edits: [first, second] },
  });
});

test("source inventory refuses redacted, truncated and changing edit histories", async () => {
  for (const pages of [
    [historyPage([{ ...first, deletedAt: first.editedAt }], false, 1)],
    [historyPage([{ ...first, diff: null }], false, 1)],
    [historyPage([first])],
    [historyPage([first], true), historyPage([second], false, 3)],
    [historyPage([first], true), historyPage([first])],
  ]) {
    await assert.rejects(
      completeSourceHistory(historyConnection(pages), ["ISSUE"]),
      /unavailable|repeats|changed/,
    );
  }
});

function capture() {
  const snapshots = [
    {
      repository: "owner/repo",
      validatorLogin: "github-actions[bot]",
      issue: {
        number: 1,
        node_id: "ISSUE",
        body: ticketBody,
        labels: ["state:triage", "factory:skip"],
      },
      comments: [],
      blockedBy: [],
      parent: null,
      issueEvents: [],
      permissions: {},
      repositoryLabels: [],
      contractSources: { mode: "prepared" },
      bodyRevision: {
        id: "ISSUE",
        lastEditedAt: null,
        editId: "created:ISSUE",
      },
      sourceEdits: { ISSUE: { id: "created:ISSUE", editedAt: null } },
      sourceHistory: { ISSUE: { complete: true, edits: [] } },
    },
  ];
  return {
    format: "repo-canon/source-selection-inventory/v1",
    repository: "owner/repo",
    complete: true,
    snapshots,
    digest: `sha256:${createHash("sha256").update(JSON.stringify(snapshots)).digest("hex")}`,
  };
}

test("inventory compares the complete production decisions without skipping held issues", () => {
  const result = compareSourceInventory(capture(), decideIssueContract);
  assert.equal(result.issueCount, 1);
  assert.deepEqual(result.switches, []);
  assert.equal(result.issues[0].before.kind, "implementation ticket");
  assert.match(result.issues[0].before.revision, /^sha256:/);
  assert.equal(result.issues[0].before.source.type, "issue-body");
});

test("inventory refuses a modified or partial capture", () => {
  const value = capture();
  value.snapshots[0].comments.push({ id: 99 });
  assert.throws(
    () => compareSourceInventory(value, decideIssueContract),
    /Complete unmodified/,
  );
  assert.throws(
    () =>
      compareSourceInventory(
        { ...capture(), complete: false },
        decideIssueContract,
      ),
    /Complete unmodified/,
  );
});
