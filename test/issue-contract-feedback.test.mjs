// The issue-contract validator's feedback comment leads with its outcome: a
// lead line, anything a person must act on, then the explanation and the full
// revision collapsed. These tests check that layout for every outcome, not its
// wording.
import assert from "node:assert/strict";
import test from "node:test";
import { decideIssueContract } from "./helpers/contract-decision.mjs";
import {
  awaitingTicketFeedback,
  bot,
  featureBody,
  feedbackLayout,
  neutralEvent,
  publishedState,
  repository,
  role,
  ticketBody,
} from "./helpers/issue-contracts.mjs";

const noticeAt = "2026-09-14T16:59:00Z";
const reviewAt = "2026-09-14T17:00:00Z";
const reviewBy = (login) => ({
  id: 101,
  event: "labeled",
  label: { name: "state:ready" },
  actor: { login },
  created_at: reviewAt,
});

/** @param {Record<string, any>} options */
function snapshot({
  body = ticketBody,
  labels = [],
  comments = [],
  event = { action: "edited", issue: { number: 42 } },
  issueEvents = [],
  permissions = {},
}) {
  return {
    repository,
    event: neutralEvent(event),
    issue: {
      number: 42,
      node_id: "ISSUE_42",
      body,
      labels: labels.map((name) => ({ name })),
      state: "open",
      user: { login: "author" },
      created_at: "2026-09-14T15:00:00Z",
    },
    comments,
    blockedBy: [],
    parent: null,
    bodyRevision: { id: "ISSUE_42", lastEditedAt: null },
    issueEvents,
    permissions,
  };
}

const issue = { node_id: "ISSUE_42", body: ticketBody };
// The awaiting-review notice for the ticket, published before its review,
// with `state` merged into its result.
const awaiting = (state = {}) => {
  const comment = awaitingTicketFeedback(issue);
  const recorded = { ...publishedState(comment.body), ...state };
  return {
    ...comment,
    body: comment.body.replace(
      /(<!-- repo-canon:issue-contract-state ).*( -->)/,
      `$1${JSON.stringify(recorded).replaceAll("$", "$$$$")}$2`,
    ),
    updated_at: noticeAt,
  };
};
const labeled = (login) => ({
  action: "labeled",
  issue: { number: 42 },
  label: { name: "state:ready" },
  sender: { login },
});

const outcomes = [
  {
    name: "needs attention lists the corrections, visible",
    snapshot: snapshot({ body: ticketBody.replace("Add caching.", "") }),
    marker: "👤",
    visible: /^- /,
  },
  {
    name: "awaiting review",
    snapshot: snapshot({}),
    marker: "👤",
  },
  {
    name: "readiness recorded",
    snapshot: snapshot({
      labels: ["state:ready"],
      comments: [awaiting()],
      event: labeled("maintainer"),
      issueEvents: [reviewBy("maintainer")],
      permissions: { maintainer: role("admin") },
    }),
    marker: "✅",
  },
  {
    name: "readiness removed",
    snapshot: snapshot({
      labels: ["state:ready"],
      comments: [awaiting()],
      event: labeled("writer"),
      issueEvents: [reviewBy("writer")],
      permissions: { writer: role("write") },
    }),
    marker: "❌",
  },
  {
    name: "readiness refused, with no label to remove",
    snapshot: snapshot({
      comments: [awaiting({ rejectionReason: "The review was refused." })],
    }),
    marker: "❌",
  },
  {
    name: "contract not required",
    snapshot: snapshot({
      body: featureBody,
      labels: ["type:enhancement", "wontfix"],
      comments: [awaiting()],
    }),
    marker: "⏭️",
  },
  {
    name: "structure corrected",
    snapshot: snapshot({
      body: featureBody,
      labels: ["type:enhancement", "wontfix"],
      comments: [
        {
          id: 13,
          body: decideIssueContract(
            snapshot({ body: ticketBody.replace("Add caching.", "") }),
          ).feedback.body,
          user: bot,
          updated_at: noticeAt,
        },
      ],
    }),
    marker: "✅",
  },
];

test("every feedback outcome leads with its outcome and collapses its explanation", async (t) => {
  const leads = new Set();
  for (const outcome of outcomes) {
    await t.test(outcome.name, () => {
      const { feedback } = decideIssueContract(outcome.snapshot);
      const layout = feedbackLayout(feedback.body);
      assert.equal(layout.marker, outcome.marker);
      assert.notEqual(layout.summary.trim(), "");
      if (outcome.visible) assert.match(layout.visible, outcome.visible);
      else assert.equal(layout.visible, null);
      leads.add(layout.outcome);
    });
  }
  // Each outcome is told apart by its lead line alone.
  assert.equal(leads.size, outcomes.length);
});

test("a refusal leads with a short reason and keeps the full reason collapsed", () => {
  const reason = `${"A long refusal reason ".repeat(8)}with \`code\` at its end. A second sentence.`;
  const { feedback } = decideIssueContract(
    snapshot({ comments: [awaiting({ rejectionReason: reason })] }),
  );
  const layout = feedbackLayout(feedback.body);
  const [, short] = layout.facts;
  assert.ok(reason.startsWith(short.replace(/…$/, "")), short);
  assert.ok(short.length < reason.indexOf(". "), short);
  assert.equal((short.match(/`/g) ?? []).length % 2, 0);
  assert.ok(layout.details.includes(reason));
  assert.equal(publishedState(feedback.body).rejectionReason, reason);
});
