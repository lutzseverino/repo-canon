import assert from "node:assert/strict";
import test from "node:test";
import {
  decideIssueContract,
  readinessTriggerUnrecorded,
} from "../scripts/validate-issue-contract.mjs";
import {
  approvedTicketFeedback,
  awaitingTicketFeedback,
  blockerLinksBody,
  bodyRevision,
  bugBody,
  bot,
  briefRevision,
  completeAgentBrief,
  createdWithReadiness,
  creationLabel,
  featureBody,
  feedbackState,
  ignoredBlockerReferences,
  labeledBy,
  laggingReapplicationEvents,
  laggingSwapEvents,
  mapBody,
  reapplicationEvents,
  reapplicationRun,
  readinessRetryEvents,
  readinessReview,
  recordedState,
  repository,
  role,
  specificationBody,
  swapEvents,
  swapRun,
  ticketBody,
} from "./helpers/issue-contracts.mjs";

function withNoticeTimes(comments) {
  return comments.map((comment) =>
    comment.body?.includes("repo-canon:issue-contract-state") &&
    !comment.updated_at
      ? { ...comment, updated_at: "2026-09-14T16:59:00Z" }
      : comment,
  );
}

// Builds the snapshot the adapter would fetch for issue 42. A row without
// `issueEvents` has an empty timeline.
function snapshotFor({
  issue,
  comments = [],
  commentPages,
  blockedBy = [],
  parent = null,
  event = {},
  relatedIssues = {},
  permissions = {},
  bodyLastEditedAt = null,
  issueEvents = [],
}) {
  return {
    repository,
    event: { issue: { number: 42 }, ...event },
    issue,
    comments: withNoticeTimes(commentPages?.flat() ?? comments),
    blockedBy,
    parent,
    relatedIssues,
    bodyRevision: {
      id: issue.node_id ?? "ISSUE_42",
      lastEditedAt: bodyLastEditedAt,
    },
    issueEvents,
    permissions,
  };
}

// Asserts the complete decision: exit code, label changes, and feedback write
// are exact; message and feedback patterns are checked when given.
function assertDecision(decision, expected) {
  assert.equal(decision.exitCode, expected.exitCode, decision.message);
  assert.deepEqual(decision.removeLabels, expected.remove ?? []);
  assert.deepEqual(decision.addLabels, expected.add ?? []);
  const feedback = expected.feedback ?? null;
  if (feedback === null) assert.equal(decision.feedback, null);
  else
    assert.equal(
      decision.feedback?.commentId,
      feedback === "create" ? null : feedback,
    );
  for (const pattern of [expected.message ?? []].flat())
    assert.match(decision.message, pattern);
  for (const pattern of [expected.notMessage ?? []].flat())
    assert.doesNotMatch(decision.message, pattern);
  for (const pattern of [expected.feedbackBody ?? []].flat())
    assert.match(decision.feedback.body, pattern);
  for (const pattern of [expected.notFeedbackBody ?? []].flat())
    assert.doesNotMatch(decision.feedback.body, pattern);
}

function decisionTable(title, rows) {
  test(title, async (context) => {
    for (const row of rows) {
      await context.test(row.name, async () => {
        if (row.run) return row.run();
        const decision = decideIssueContract(snapshotFor(row.snapshot));
        assertDecision(decision, row.expected);
        await row.check?.(decision);
      });
    }
  });
}

// Timeline events beside `readinessReview`: a workflow state the reporter
// labeled before the review, the review by another actor or with another
// readiness label, and its removal a minute later.
const stateLabeled = (id, name) => ({
  id,
  event: "labeled",
  label: { name },
  actor: { login: "reporter" },
  created_at: "2026-09-14T16:00:00Z",
});
const reviewBy = (login, label = "ready-for-agent") => ({
  ...readinessReview,
  label: { name: label },
  actor: { login },
});
const readinessRemoved = {
  ...readinessReview,
  id: 102,
  event: "unlabeled",
  created_at: "2026-09-14T17:01:00Z",
};

function applyFeedback(comments, decision) {
  const feedback = decision.feedback;
  if (!feedback) return;
  const existing = comments.find(({ id }) => id === feedback.commentId);
  if (existing) existing.body = feedback.body;
  else comments.push({ id: 99, body: feedback.body, user: bot });
}

decisionTable("issue structure decides the contract and its corrections", [
  {
    name: "a complete public bug report is accepted without changing the issue",
    snapshot: {
      issue: {
        number: 42,
        body: bugBody,
        labels: [{ name: "bug" }, { name: "needs-triage" }],
        state: "open",
      },
    },
    expected: { exitCode: 0, message: /valid bug report/i },
  },
  {
    name: "an incomplete ready bug report loses readiness and receives actionable feedback",
    snapshot: {
      issue: {
        number: 42,
        body: "## Steps to reproduce\n\n_No response_\n\n## Expected behavior\n\nWorks.\n\n## Actual behavior\n\nBroken.",
        labels: [{ name: "bug" }, { name: "ready-for-agent" }],
        state: "open",
      },
    },
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: "create",
      message: /Steps to reproduce/,
      feedbackBody: /Replace the placeholder under `Steps to reproduce`/,
    },
  },
  ...[
    {
      name: "feature request",
      body: "### PROBLEM\n\nSearch is slow.\n\n### Desired Outcome\n\nSearch finishes quickly.",
      labels: [{ name: "enhancement" }, { name: "needs-triage" }],
      expected: { exitCode: 0, message: /valid feature request/i },
    },
    {
      name: "feature request with CRLF",
      body: "### Problem\r\n\r\nSearch is slow.\r\n\r\n### Desired outcome\r\n\r\nSearch finishes quickly.",
      labels: [{ name: "enhancement" }, { name: "needs-triage" }],
      expected: { exitCode: 0, message: /valid feature request/i },
    },
    {
      name: "implementation ticket",
      body: "#### What To Build\n\nAdd caching.\n\n#### ACCEPTANCE CRITERIA\n\n- [ ] Search is fast.\n\n#### Blocked By\n\nNone.",
      labels: [],
      expected: {
        exitCode: 0,
        feedback: "create",
        message: /valid implementation ticket/i,
      },
    },
    {
      name: "specification",
      body: "#### Problem Statement\n\nSearch is slow.\n\n#### SOLUTION\n\nAdd caching.\n\n#### User Stories\n\n1. As a user, I want fast search.\n\n#### Implementation Decisions\n\n_No response_\n\n#### Testing Decisions\n\n_No response_\n\n#### Out Of Scope\n\nNone.\n\n#### Further Notes\n\n_No response_",
      labels: [],
      expected: {
        exitCode: 0,
        feedback: "create",
        message: /valid specification/i,
      },
    },
  ].map((example) => ({
    name: `all public forms accept harmless heading variations and absent optional answers: ${example.name}`,
    snapshot: {
      issue: {
        number: 42,
        body: example.body,
        labels: example.labels,
        state: "open",
      },
    },
    expected: example.expected,
  })),
  {
    name: "headings inside form answers do not change the recognized contract",
    snapshot: {
      issue: {
        number: 42,
        body: "### Problem\n\nSearch is slow.\n\n#### What to build\n\nThis heading is supporting detail, not a ticket.\n\n### Desired outcome\n\nSearch finishes quickly.",
        labels: [{ name: "enhancement" }, { name: "needs-triage" }],
        state: "open",
      },
    },
    expected: { exitCode: 0, message: /valid feature request/i },
  },
  {
    name: "a nested heading can begin a required form answer",
    snapshot: {
      issue: {
        number: 42,
        body: "### Problem\n\n#### Actual behavior\n\nSearch is slow.\n\n### Desired outcome\n\nSearch finishes quickly.",
        labels: [{ name: "enhancement" }, { name: "needs-triage" }],
        state: "open",
      },
    },
    expected: { exitCode: 0 },
  },
  {
    name: "contract-like headings inside fenced examples remain answer content",
    snapshot: {
      issue: {
        number: 42,
        body: "### Problem\n\nSearch is slow.\n\n```md\n### Problem\n\n_No response_\n\n### Desired outcome\n\n_No response_\n```\n\n### Desired outcome\n\nSearch finishes quickly.",
        labels: [{ name: "enhancement" }, { name: "needs-triage" }],
        state: "open",
      },
    },
    expected: { exitCode: 0 },
  },
  {
    name: "an empty checklist is rejected as a required-field placeholder",
    snapshot: {
      issue: {
        number: 42,
        body: "## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ]\n\n## Blocked by\n\nNone.",
        labels: [{ name: "ready-for-agent" }],
        state: "open",
      },
    },
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: "create",
      message: /Acceptance criteria/,
    },
  },
  ...[
    { name: "empty HTML", value: "<br><br>", valid: false },
    {
      name: "hidden HTML",
      value: "<span hidden>Secret text.</span><title>Secret title.</title>",
      valid: false,
    },
    {
      name: "fragment head wrapper",
      value: "<head>Add caching.</head>",
      valid: true,
    },
    { name: "HTML text", value: "<p>Add caching.</p>", valid: true },
    { name: "code example", value: "```js\ncache.enable();\n```", valid: true },
  ].map((example) => ({
    name: `required sections use rendered visible content: ${example.name}`,
    snapshot: {
      issue: {
        number: 42,
        body: `## What to build\n\n${example.value}\n\n## Acceptance criteria\n\n- [ ] Search is fast.\n\n## Blocked by\n\nNone.`,
        labels: example.valid ? [] : [{ name: "ready-for-agent" }],
        state: "open",
      },
    },
    expected: example.valid
      ? { exitCode: 0, feedback: "create" }
      : {
          exitCode: 1,
          remove: ["ready-for-agent"],
          add: ["needs-triage"],
          feedback: "create",
          message: /What to build/,
        },
  })),
  {
    name: "a Wayfinder map accepts an empty initial Decisions so far section",
    snapshot: {
      issue: {
        number: 42,
        body: "## Destination\n\nChoose a cache.\n\n## Notes\n\nUse the domain model.\n\n## Decisions so far\n\n<!-- none yet -->\n\n## Not yet specified\n\nEviction policy.\n\n## Out of scope\n\nNone.",
        labels: [{ name: "wayfinder:map" }],
        state: "open",
      },
    },
    expected: { exitCode: 0, message: /valid Wayfinder map/i },
  },
  {
    name: "a Wayfinder child reads its parent map from native relationships",
    snapshot: {
      issue: {
        number: 42,
        body: "## Question\n\nWhich cache meets the latency target?",
        labels: [{ name: "wayfinder:research" }],
        state: "open",
      },
      blockedBy: [{ number: 41, state: "open" }],
      parent: { number: 7, state: "open", labels: [{ name: "wayfinder:map" }] },
    },
    expected: { exitCode: 0, message: /valid Wayfinder child/i },
  },
  {
    name: "a Wayfinder map only permits its initial decisions section to be empty",
    snapshot: {
      issue: {
        number: 42,
        body: "## Destination\n\nChoose a cache.\n\n## Notes\n\n<!-- none -->\n\n## Decisions so far\n\n<!-- none yet -->\n\n## Not yet specified\n\n_No response_\n\n## Out of scope\n\n",
        labels: [{ name: "wayfinder:map" }],
        state: "open",
      },
    },
    expected: {
      exitCode: 1,
      feedback: "create",
      message: [/Notes/, /Not yet specified/, /Out of scope/],
      notMessage: /Decisions so far/,
    },
  },
  {
    name: "Wayfinder planning labels cannot preserve an unreviewed readiness state",
    snapshot: {
      issue: {
        number: 42,
        body: mapBody,
        labels: [{ name: "wayfinder:map" }, { name: "ready-for-agent" }],
        state: "open",
      },
      event: {
        action: "labeled",
        issue: { number: 42 },
        label: { name: "ready-for-agent" },
        sender: { login: "reporter" },
      },
    },
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      feedback: "create",
      message: /Wayfinder planning issues/i,
      feedbackBody: /eligibility uses open state, assignment, and blockers/i,
    },
  },
  {
    name: "a Wayfinder child rejects an empty parent fallback",
    snapshot: {
      issue: {
        number: 42,
        body: "## Parent\n\n_No response_\n\n## Question\n\nWhich cache meets the latency target?",
        labels: [{ name: "wayfinder:research" }],
        state: "open",
      },
    },
    expected: { exitCode: 1, feedback: "create", message: /parent map/i },
  },
  {
    name: "a native specification missing one of its seven headings is incomplete",
    snapshot: {
      issue: {
        number: 42,
        body: "## Problem Statement\n\nA problem.\n\n## Solution\n\nA solution.\n\n## User Stories\n\n1. As a user, I want a result.\n\n## Implementation Decisions\n\nNone.\n\n## Testing Decisions\n\nNone.\n\n## Out of Scope\n\nNone.",
        labels: [{ name: "ready-for-agent" }],
        state: "open",
      },
    },
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: "create",
      message: /Further Notes/,
    },
  },
  {
    name: "an Agent Brief comment must start with its preamble",
    snapshot: {
      issue: {
        number: 42,
        body: featureBody,
        labels: [{ name: "enhancement" }, { name: "needs-triage" }],
        state: "open",
      },
      comments: [
        {
          id: 12,
          user: { login: "maintainer" },
          body: `Unrelated text must not precede the preamble.\n\n${completeAgentBrief}`,
        },
      ],
    },
    expected: {
      exitCode: 1,
      feedback: "create",
      message: /Start the Agent Brief comment/,
    },
  },
  {
    name: "the latest Agent Brief is found across the complete discussion",
    snapshot: {
      issue: {
        number: 42,
        body: featureBody,
        labels: [{ name: "enhancement" }, { name: "needs-triage" }],
        state: "open",
      },
      commentPages: [
        [{ id: 1, body: "Earlier discussion", user: { login: "reporter" } }],
        [{ id: 2, body: completeAgentBrief, user: { login: "maintainer" } }],
      ],
    },
    expected: {
      exitCode: 0,
      feedback: "create",
      message: /valid triaged Agent Brief/i,
    },
  },
  ...[
    {
      name: "specification",
      body: "## Problem Statement\n\nA problem.\n\n## Solution\n\nA solution.\n\n## User Stories\n\nA user gets a result.\n\n## Implementation Decisions\n\nNone.\n\n## Testing Decisions\n\nNone.\n\n## Out of Scope\n\nNone.\n\n## Further Notes\n\nNone.",
      labels: [],
      feedback: "create",
    },
    {
      name: "implementation ticket",
      body: ticketBody,
      labels: [],
      feedback: "create",
    },
    {
      name: "triaged Agent Brief",
      body: "Free-form intake context.\n\n## Solution\n\nTry a cache.\n\n## Acceptance criteria\n\nThe result should be fast.",
      labels: [{ name: "enhancement" }, { name: "needs-triage" }],
      feedback: "create",
    },
    {
      name: "Wayfinder map",
      body: `${mapBody}\n\n## Solution\n\nA misleading native heading.`,
      labels: [{ name: "wayfinder:map" }],
      feedback: null,
    },
    {
      name: "triaged wontfix request",
      body: "Free-form request declined with an explanation.",
      labels: [{ name: "enhancement" }, { name: "wontfix" }],
      comments: [],
      state: "closed",
      feedback: null,
    },
  ].map((example) => ({
    name: `contract authority follows the planning, native-body, and triaged-brief decision matrix: ${example.name}`,
    snapshot: {
      issue: {
        number: 42,
        body: example.body,
        labels: example.labels,
        state: example.state ?? "open",
      },
      comments: example.comments ?? [
        { id: 1, body: completeAgentBrief, user: { login: "reporter" } },
      ],
    },
    expected: {
      exitCode: 0,
      feedback: example.feedback,
      message: new RegExp(`valid ${example.name}`, "i"),
    },
  })),
  {
    name: "a triage category cannot make a native body bypass the Agent Brief",
    snapshot: {
      issue: {
        number: 42,
        body: specificationBody,
        labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
        state: "open",
      },
    },
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: "create",
      message: /Agent Brief/,
    },
  },
  {
    name: "trailing peer sections do not complete required contract answers: implementation ticket",
    snapshot: {
      issue: {
        number: 42,
        body: "## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ] Search is fast.\n\n## Blocked by\n\n_No response_\n\n## Review notes\n\nNone means no blockers.",
        labels: [{ name: "ready-for-agent" }],
        state: "open",
      },
    },
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: "create",
      message: /Blocked by/,
    },
  },
  {
    name: "trailing peer sections do not complete required contract answers: Agent Brief",
    snapshot: {
      issue: {
        number: 42,
        body: "Free-form intake context.",
        labels: [{ name: "enhancement" }, { name: "needs-triage" }],
        state: "open",
      },
      comments: [
        {
          id: 1,
          body: completeAgentBrief.replace(
            "**Out of scope:**\n- Changing storage",
            "**Out of scope:** _No response_\n\n## Review notes\n\nReviewed.",
          ),
          user: { login: "maintainer" },
        },
      ],
    },
    expected: { exitCode: 1, feedback: "create", message: /Out of scope/ },
  },
  {
    name: "an Agent Brief heading inside a fenced discussion example is ignored",
    snapshot: {
      issue: {
        number: 42,
        body: featureBody,
        labels: [{ name: "enhancement" }, { name: "needs-triage" }],
        state: "open",
      },
      comments: [
        { id: 1, body: completeAgentBrief, user: { login: "maintainer" } },
        {
          id: 2,
          body: "Example only:\n\n```md\n## Agent Brief\n\n**Summary:** Do not select this.\n```",
          user: { login: "reporter" },
        },
      ],
    },
    expected: { exitCode: 0, feedback: "create" },
  },
  {
    name: "HTML-commented contract syntax remains inert: body heading",
    snapshot: {
      issue: {
        number: 42,
        body: "## Problem\n\n<!--\n## Desired outcome\n\nHidden example.\n-->\n\n_No response_\n\n## Desired outcome\n\nSearch finishes quickly.",
        labels: [{ name: "enhancement" }, { name: "needs-triage" }],
        state: "open",
      },
    },
    expected: { exitCode: 1, feedback: "create", message: /Problem/ },
  },
  {
    name: "HTML-commented contract syntax remains inert: discussion heading",
    snapshot: {
      issue: {
        number: 42,
        body: featureBody,
        labels: [{ name: "enhancement" }, { name: "needs-triage" }],
        state: "open",
      },
      comments: [
        { id: 1, body: completeAgentBrief, user: { login: "maintainer" } },
        {
          id: 2,
          body: "Example only:\n\n<!--\n## Agent Brief\n\n**Summary:** Hidden.\n-->",
          user: { login: "reporter" },
        },
      ],
    },
    expected: { exitCode: 0, feedback: "create" },
  },
  {
    name: "HTML-commented contract syntax remains inert: brief field",
    snapshot: {
      issue: {
        number: 42,
        body: "Free-form intake context.",
        labels: [{ name: "enhancement" }, { name: "needs-triage" }],
        state: "open",
      },
      comments: [
        {
          id: 1,
          body: completeAgentBrief
            .replace(
              "**Summary:** Make search fast",
              "**Summary:** _No response_",
            )
            .replace(
              "**Out of scope:**",
              "<!--\n**Summary:** Hidden replacement\n-->\n\n**Out of scope:**",
            ),
          user: { login: "maintainer" },
        },
      ],
    },
    expected: { exitCode: 1, feedback: "create", message: /Summary/ },
  },
  {
    name: "HTML delimiters inside inline code remain ordinary contract content: issue body",
    snapshot: {
      issue: {
        number: 42,
        body: "## Problem\n\nDocument the literal `<!--` delimiter.\n\n## Desired outcome\n\nThe documentation is clear.",
        labels: [{ name: "enhancement" }, { name: "needs-triage" }],
        state: "open",
      },
    },
    expected: { exitCode: 0 },
  },
  {
    name: "HTML delimiters inside inline code remain ordinary contract content: Agent Brief",
    snapshot: {
      issue: {
        number: 42,
        body: "Free-form intake context.",
        labels: [{ name: "enhancement" }, { name: "needs-triage" }],
        state: "open",
      },
      comments: [
        {
          id: 1,
          body: completeAgentBrief.replace(
            "Make search fast",
            "Document the `<!--` delimiter",
          ),
          user: { login: "maintainer" },
        },
      ],
    },
    expected: { exitCode: 0, feedback: "create" },
  },
  {
    name: "an approved direct contract edited into no recognizable contract returns to review",
    snapshot: {
      issue: {
        number: 42,
        body: "Caching notes without any contract headings.",
        labels: [{ name: "ready-for-agent" }],
        state: "open",
      },
      bodyLastEditedAt: "2026-09-14T17:02:00Z",
      event: { action: "edited", issue: { number: 42 } },
    },
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: "create",
      message: /Use one supported issue contract/,
    },
  },
  {
    name: "event payload content cannot override re-fetched authoritative state",
    snapshot: {
      issue: {
        number: 42,
        body: "## Steps to reproduce\n\n_No response_\n\n## Expected behavior\n\nWorks.\n\n## Actual behavior\n\nBroken.",
        labels: [{ name: "bug" }, { name: "needs-triage" }],
        state: "open",
      },
      event: {
        action: "edited",
        issue: {
          number: 42,
          body: "## Steps to reproduce\n\nComplete stale payload.\n\n## Expected behavior\n\nWorks.\n\n## Actual behavior\n\nBroken.",
        },
      },
    },
    expected: {
      exitCode: 1,
      feedback: "create",
      message: /Steps to reproduce/,
    },
  },
  {
    name: "created, edited, and deleted comment events use the authoritative discussion, not the event's comment",
    run: () => {
      for (const action of ["created", "edited", "deleted"]) {
        const decision = decideIssueContract(
          snapshotFor({
            issue: {
              number: 42,
              body: featureBody,
              labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
              state: "open",
            },
            comments: [
              {
                id: 1,
                body: completeAgentBrief.replace(
                  "**Summary:** Make search fast",
                  "**Summary:** _No response_",
                ),
                user: { login: "maintainer" },
              },
            ],
            event: {
              action,
              issue: { number: 42 },
              comment: { id: 1, body: completeAgentBrief },
            },
          }),
        );
        assertDecision(decision, {
          exitCode: 1,
          remove: ["ready-for-agent"],
          add: ["needs-triage"],
          feedback: "create",
          message: /Summary/,
        });
      }

      const createdWithStalePayload = decideIssueContract(
        snapshotFor({
          issue: {
            number: 42,
            body: featureBody,
            labels: [{ name: "enhancement" }, { name: "needs-triage" }],
            state: "open",
          },
          comments: [
            { id: 1, body: completeAgentBrief, user: { login: "maintainer" } },
          ],
          event: {
            action: "created",
            issue: { number: 42 },
            comment: { id: 1, body: "stale payload" },
          },
        }),
      );
      assertDecision(createdWithStalePayload, {
        exitCode: 0,
        feedback: "create",
        message: /valid triaged Agent Brief/i,
      });

      const deletedOnlyBrief = decideIssueContract(
        snapshotFor({
          issue: {
            number: 42,
            body: featureBody,
            labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
            state: "open",
          },
          event: {
            action: "deleted",
            issue: { number: 42 },
            comment: { id: 1, body: completeAgentBrief },
          },
        }),
      );
      assertDecision(deletedOnlyBrief, {
        exitCode: 1,
        remove: ["ready-for-agent"],
        add: ["needs-triage"],
        feedback: "create",
        message: /Add a reviewed Agent Brief/,
      });
    },
  },
]);

decisionTable(
  "parent and blocker relationships come from native links or explicit references",
  [
    {
      name: "a native ticket can use relationships and remain valid with an open blocker",
      snapshot: (() => {
        const issue = {
          number: 42,
          body: "## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ] Search is fast.\n\n## Blocked by\n\n_No response_",
          labels: [{ name: "ready-for-agent" }],
          state: "open",
          updated_at: "2026-09-14T17:00:00Z",
        };
        return {
          issue,
          comments: [awaitingTicketFeedback(issue)],
          blockedBy: [
            {
              number: 41,
              state: "open",
              html_url: "https://github.com/example/repository/issues/41",
            },
          ],
          parent: { number: 7, state: "open", labels: [] },
          issueEvents: [readinessReview],
          event: {
            action: "labeled",
            issue: {
              number: 42,
              body: issue.body,
              updated_at: issue.updated_at,
            },
            label: { name: "ready-for-agent" },
            sender: { login: "maintainer" },
          },
          permissions: { maintainer: role("admin") },
        };
      })(),
      expected: {
        exitCode: 0,
        feedback: 13,
        message: /valid implementation ticket with ready-for-agent bound/i,
      },
    },
    {
      name: "explicit parent and blocker links are read when native relationships are absent",
      snapshot: {
        issue: {
          number: 42,
          body: "## Parent\n\n[Parent](#7) and #8\n\n## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ] Search is fast.\n\n## Blocked by\n\nhttps://github.com/example/repository/issues/41",
          labels: [],
          state: "open",
        },
        relatedIssues: {
          "/repos/example/repository/issues/7": {
            number: 7,
            state: "open",
            labels: [],
          },
          "/repos/example/repository/issues/41": {
            number: 41,
            state: "open",
            labels: [],
          },
        },
      },
      expected: { exitCode: 0, feedback: "create" },
    },
    {
      name: "only the first link under Parent is the parent reference",
      snapshot: {
        issue: {
          number: 42,
          body: "## Parent\n\n[Parent](#7) and #8\n\n## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ] Search is fast.\n\n## Blocked by\n\nhttps://github.com/example/repository/issues/41",
          labels: [],
          state: "open",
        },
        relatedIssues: {
          "/repos/example/repository/issues/8": {
            number: 8,
            state: "open",
            labels: [],
          },
          "/repos/example/repository/issues/41": {
            number: 41,
            state: "open",
            labels: [],
          },
        },
      },
      expected: {
        exitCode: 1,
        feedback: "create",
        message:
          /^Could not resolve the `Parent` issue reference \/repos\/example\/repository\/issues\/7\.$/,
      },
    },
    {
      name: "only visible links under Blocked by are blocker references",
      snapshot: {
        issue: {
          number: 42,
          body: `## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ] Search is fast.\n\n## Blocked by\n\n${blockerLinksBody}`,
          labels: [],
          state: "open",
        },
      },
      expected: {
        exitCode: 1,
        feedback: "create",
        message: new RegExp(
          ["993", "41", "43"]
            .map(
              (number) =>
                `Could not resolve the \`Blocked by\` issue reference /repos/example/repository/issues/${number}\\.`,
            )
            .join("\n"),
        ),
        notMessage: ignoredBlockerReferences.map(
          (reference) => new RegExp(`${reference}\\b`),
        ),
      },
    },
    {
      name: "an unresolvable blocker link removes readiness with actionable feedback",
      snapshot: {
        issue: {
          number: 42,
          body: "## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ] Search is fast.\n\n## Blocked by\n\nhttps://github.com/example/repository/issues/999",
          labels: [{ name: "ready-for-agent" }],
          state: "open",
        },
      },
      expected: {
        exitCode: 1,
        remove: ["ready-for-agent"],
        add: ["needs-triage"],
        feedback: "create",
        feedbackBody: /could not resolve.*Blocked by/i,
      },
    },
    {
      name: "native relationship changes do not revise already reviewed contract bytes",
      snapshot: (() => {
        const issue = {
          number: 42,
          body: "## What to build\n\nAdd caching.\n\n## Acceptance criteria\n\n- [ ] Search is fast.\n\n## Blocked by\n\n_No response_",
          labels: [{ name: "ready-for-agent" }],
          state: "open",
        };
        return {
          issue,
          comments: [approvedTicketFeedback(issue)],
          blockedBy: [{ id: "BLOCKER_44", number: 44, state: "open" }],
          permissions: { maintainer: role("admin") },
          issueEvents: [readinessReview],
          event: { action: "reopened", issue: { number: 42 } },
        };
      })(),
      expected: {
        exitCode: 0,
        message: /valid implementation ticket with ready-for-agent bound/i,
      },
    },
  ],
);

decisionTable("the feedback comment is maintained once", [
  {
    name: "repeated invalid events maintain one feedback comment",
    snapshot: {
      issue: {
        number: 42,
        body: "## Problem\n\n_No response_\n\n## Desired outcome\n\nFast search.",
        labels: [{ name: "enhancement" }, { name: "needs-triage" }],
        state: "open",
      },
      comments: [
        {
          id: 9,
          body: "<!-- repo-canon:issue-contract-feedback -->\n## Issue contract needs attention\n\n- Replace the placeholder under `Problem` with the required information.\n\nFix the items above. Structural validation will re-run, but only an authorized reviewer can grant readiness.",
          user: bot,
        },
      ],
    },
    expected: { exitCode: 1, feedback: null },
  },
  {
    name: "a correction updates existing feedback without restoring readiness",
    snapshot: {
      issue: { number: 42, body: ticketBody, labels: [], state: "open" },
      comments: [
        {
          id: 9,
          body: "<!-- repo-canon:issue-contract-feedback -->\n## Issue contract needs attention\n\n- Fix it.",
          user: bot,
        },
      ],
    },
    expected: {
      exitCode: 0,
      feedback: 9,
      feedbackBody: /fresh authorized review/i,
    },
  },
]);

decisionTable("an authorized review binds readiness to the exact revision", [
  {
    name: "an authorized maintainer can bind a direct contract readiness label to the event revision",
    snapshot: (() => {
      const issue = {
        number: 42,
        node_id: "ISSUE_42",
        body: ticketBody,
        labels: [{ name: "ready-for-agent" }],
        state: "open",
        updated_at: "2026-09-14T17:00:00Z",
      };
      return {
        issue,
        comments: [awaitingTicketFeedback(issue)],
        issueEvents: [readinessReview],
        event: labeledBy("maintainer", "ready-for-agent", issue),
        permissions: { maintainer: role("admin") },
      };
    })(),
    expected: {
      exitCode: 0,
      feedback: 13,
      feedbackBody: [
        new RegExp(
          bodyRevision({ body: ticketBody, node_id: "ISSUE_42" }).replace(
            ":",
            "\\:",
          ),
        ),
        /reviewed by @maintainer/i,
      ],
    },
  },
  ...[
    ["specification", specificationBody, "ready-for-agent"],
    ["implementation ticket", ticketBody, "ready-for-human"],
  ].map(([kind, body, readinessLabel]) => {
    const issue = {
      number: 42,
      node_id: "ISSUE_42",
      body,
      labels: [
        { name: "needs-triage" },
        { name: "needs-info" },
        { name: readinessLabel },
      ],
      state: "open",
      updated_at: "2026-09-14T17:00:00Z",
    };
    return {
      name: `an accepted review of a direct contract replaces every superseded workflow state: ${kind}`,
      snapshot: {
        issue,
        comments: [
          {
            id: 13,
            body: feedbackState({
              status: "awaiting-review",
              revision: bodyRevision(issue, null, kind),
              kind,
            }),
            user: bot,
          },
        ],
        issueEvents: [
          stateLabeled(50, "needs-triage"),
          stateLabeled(51, "needs-info"),
          reviewBy("maintainer", readinessLabel),
        ],
        event: labeledBy("maintainer", readinessLabel, issue),
        permissions: { maintainer: role("admin") },
      },
      expected: {
        exitCode: 0,
        remove: ["needs-triage", "needs-info"],
        feedback: 13,
        message: new RegExp(`valid ${kind} with ${readinessLabel} bound`, "i"),
      },
    };
  }),
  {
    name: "a repeated event removes needs-triage left beside an approved direct contract",
    snapshot: (() => {
      const issue = {
        number: 42,
        body: ticketBody,
        labels: [{ name: "needs-triage" }, { name: "ready-for-agent" }],
        state: "open",
      };
      return {
        issue,
        comments: [approvedTicketFeedback(issue)],
        permissions: { maintainer: role("admin") },
        issueEvents: [stateLabeled(50, "needs-triage"), readinessReview],
        event: { action: "reopened", issue: { number: 42 } },
      };
    })(),
    expected: { exitCode: 0, remove: ["needs-triage"] },
  },
  {
    name: "a triage-role reviewer can bind the latest Agent Brief after the exact revision is published",
    snapshot: (() => {
      const brief = {
        id: 12,
        node_id: "COMMENT_12",
        body: completeAgentBrief,
        created_at: "2026-09-14T16:58:00Z",
        updated_at: "2026-09-14T16:58:00Z",
        user: { login: "triager" },
      };
      const issue = {
        number: 42,
        body: featureBody,
        labels: [
          { name: "enhancement" },
          { name: "needs-triage" },
          { name: "ready-for-human" },
        ],
        state: "open",
        updated_at: "2026-09-14T17:00:00Z",
      };
      return {
        issue,
        comments: [
          brief,
          {
            id: 13,
            body: feedbackState({
              status: "awaiting-review",
              revision: briefRevision(brief),
            }),
            user: bot,
          },
        ],
        issueEvents: [
          stateLabeled(50, "needs-triage"),
          reviewBy("triager", "ready-for-human"),
        ],
        event: labeledBy("triager", "ready-for-human", issue),
        permissions: { triager: role("triage") },
      };
    })(),
    expected: {
      exitCode: 0,
      remove: ["needs-triage"],
      feedback: 13,
      feedbackBody: [/ready-for-human/, /reviewed by @triager/i],
    },
  },
  {
    name: "a triaged Agent Brief cannot gain readiness before its exact revision is published",
    snapshot: (() => {
      const brief = {
        id: 12,
        node_id: "COMMENT_12",
        body: completeAgentBrief,
        created_at: "2026-09-14T16:58:00Z",
        updated_at: "2026-09-14T16:58:00Z",
        user: { login: "triager" },
      };
      const issue = {
        number: 42,
        body: "Intake context.",
        labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
        state: "open",
        updated_at: "2026-09-14T17:00:00Z",
      };
      return {
        issue,
        comments: [brief],
        issueEvents: [reviewBy("triager")],
        event: labeledBy("triager", "ready-for-agent", issue),
        permissions: { triager: role("triage") },
      };
    })(),
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: "create",
      feedbackBody: /wait for the validator to publish/i,
    },
  },
  ...[
    {
      name: "write collaborator",
      login: "writer",
      permission: role("write"),
      rejection: /@writer is not authorized to grant readiness/,
    },
    {
      name: "unprivileged bot",
      login: "automation[bot]",
      permission: role("none"),
      rejection: /@automation\[bot\] is not authorized to grant readiness/,
    },
  ].map((example) => {
    const issue = {
      number: 42,
      body: ticketBody,
      labels: [{ name: "ready-for-agent" }],
      state: "open",
      updated_at: "2026-09-14T17:00:00Z",
    };
    return {
      name: `write access, a readiness label, and bot identity do not establish review authority: ${example.name}`,
      snapshot: {
        issue,
        // The revision notice precedes the label by a second, so only the
        // role check can reject the review.
        comments: [
          {
            ...awaitingTicketFeedback(issue),
            updated_at: "2026-09-14T16:59:59Z",
          },
        ],
        issueEvents: [reviewBy(example.login)],
        event: labeledBy(example.login, "ready-for-agent", issue),
        permissions: { [example.login]: example.permission },
      },
      expected: {
        exitCode: 1,
        remove: ["ready-for-agent"],
        add: ["needs-triage"],
        feedback: 13,
        feedbackBody: example.rejection,
      },
    };
  }),
  {
    name: "a permission lookup failure cannot leave an unverified readiness label",
    snapshot: (() => {
      const issue = {
        number: 42,
        body: ticketBody,
        labels: [{ name: "ready-for-agent" }],
        state: "open",
        updated_at: "2026-09-14T17:00:00Z",
      };
      return {
        issue,
        comments: [awaitingTicketFeedback(issue)],
        issueEvents: [readinessReview],
        event: labeledBy("maintainer", "ready-for-agent", issue),
        permissions: {
          maintainer: {
            error:
              "GitHub API GET /repos/example/repository/collaborators/maintainer/permission returned 403: Resource not accessible by integration",
          },
        },
      };
    })(),
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: 13,
      message: /could not verify/i,
    },
  },
  {
    name: "an unauthorized re-add cannot reuse approval when the removal workflow is delayed",
    snapshot: (() => {
      const issue = {
        number: 42,
        body: ticketBody,
        labels: [{ name: "ready-for-agent" }],
        state: "open",
        updated_at: "2026-09-14T17:02:00Z",
      };
      return {
        issue,
        comments: [approvedTicketFeedback(issue)],
        event: {
          action: "unlabeled",
          issue: {
            number: 42,
            body: issue.body,
            updated_at: "2026-09-14T17:01:00Z",
          },
          label: { name: "ready-for-agent" },
          sender: { login: "maintainer" },
        },
        issueEvents: [
          {
            id: 101,
            event: "labeled",
            label: { name: "ready-for-agent" },
            actor: { login: "maintainer" },
            created_at: "2026-09-14T17:00:00Z",
          },
          {
            id: 102,
            event: "unlabeled",
            label: { name: "ready-for-agent" },
            actor: { login: "maintainer" },
            created_at: "2026-09-14T17:01:00Z",
          },
          {
            id: 103,
            event: "labeled",
            label: { name: "ready-for-agent" },
            actor: { login: "writer" },
            created_at: "2026-09-14T17:02:00Z",
          },
        ],
        permissions: { maintainer: role("admin"), writer: role("write") },
      };
    })(),
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: 13,
      message: /@writer is not authorized/,
      feedbackBody: /"observedEventId":"103"/,
    },
  },
  {
    name: "an authorized re-add establishes a fresh Agent Brief approval before the delayed removal runs",
    snapshot: (() => {
      const brief = {
        id: 12,
        node_id: "COMMENT_12",
        body: completeAgentBrief,
        updated_at: "2026-09-14T17:00:00Z",
        user: { login: "triager" },
      };
      const issue = {
        number: 42,
        body: "Intake context.",
        labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
        state: "open",
        updated_at: "2026-09-14T17:02:00Z",
      };
      return {
        issue,
        comments: [
          brief,
          {
            id: 13,
            body: feedbackState({
              status: "approved",
              revision: briefRevision(brief),
              label: "ready-for-agent",
              reviewer: "triager",
              kind: "triaged Agent Brief",
            }),
            user: bot,
          },
        ],
        issueEvents: [
          {
            id: 101,
            event: "labeled",
            label: { name: "ready-for-agent" },
            actor: { login: "triager" },
            created_at: "2026-09-14T17:00:00Z",
          },
          {
            id: 102,
            event: "unlabeled",
            label: { name: "ready-for-agent" },
            actor: { login: "maintainer" },
            created_at: "2026-09-14T17:01:00Z",
          },
          {
            id: 103,
            event: "labeled",
            label: { name: "ready-for-agent" },
            actor: { login: "second-triager" },
            created_at: "2026-09-14T17:02:00Z",
          },
        ],
        event: {
          action: "unlabeled",
          issue: {
            number: 42,
            body: issue.body,
            updated_at: "2026-09-14T17:01:00Z",
          },
          label: { name: "ready-for-agent" },
          sender: { login: "maintainer" },
        },
        permissions: { "second-triager": role("triage") },
      };
    })(),
    expected: {
      exitCode: 0,
      feedback: 13,
      feedbackBody: [/reviewed by @second-triager/i, /"reviewEventId":"103"/],
    },
  },
  {
    name: "a repeated Agent Brief readiness event preserves its active approval",
    snapshot: (() => {
      const brief = {
        id: 12,
        node_id: "COMMENT_12",
        body: completeAgentBrief,
        updated_at: "2026-09-14T17:00:00Z",
        user: { login: "triager" },
      };
      const issue = {
        number: 42,
        body: "Intake context.",
        labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
        state: "open",
        updated_at: "2026-09-14T17:01:00Z",
      };
      return {
        issue,
        comments: [
          brief,
          {
            id: 13,
            body: feedbackState({
              status: "approved",
              revision: briefRevision(brief),
              label: "ready-for-agent",
              reviewer: "triager",
              kind: "triaged Agent Brief",
            }),
            user: bot,
          },
        ],
        permissions: { triager: role("triage") },
        issueEvents: [reviewBy("triager")],
        event: labeledBy("triager", "ready-for-agent", issue),
      };
    })(),
    expected: {
      exitCode: 0,
      message: /valid triaged Agent Brief with ready-for-agent bound/i,
    },
  },
]);

// Records a run's label changes as the validator's later timeline events.
function applyLabelChanges(state, removeLabels, addLabels) {
  const changes = [
    ...removeLabels.map((name) => ["unlabeled", name]),
    ...addLabels.map((name) => ["labeled", name]),
  ];
  for (const [action, name] of changes) {
    state.issueEvents.push({
      id: 200 + state.issueEvents.length,
      event: action,
      label: { name },
      actor: bot,
      created_at: "2026-09-14T17:00:05Z",
    });
  }
  state.labels = state.labels
    .filter((name) => !removeLabels.includes(name))
    .concat(addLabels);
}

// The labels and timeline of an issue that `opener` created with readiness,
// before any validator run.
const creationState = (opener) => ({
  labels: ["ready-for-agent"],
  issueEvents: [creationLabel({ actor: { login: opener } })],
});

// Decides the `opened` and `labeled` runs of an issue that `opener` created
// with readiness, in `order`. Each run sees the labels, timeline, and feedback
// the previous run left, as the per-issue concurrency group serializes them.
function decideCreationRuns(
  order,
  {
    opener = "maintainer",
    permissions = { [opener]: role("admin") },
    firstRunIssueEvents,
    runIssueEvents,
    labeledPayloadUpdatedAt,
  } = {},
) {
  const comments = [];
  const state = creationState(opener);
  const decisions = order.map((run, index) => {
    const snapshot = createdWithReadiness({
      run,
      opener,
      currentLabels: state.labels,
      comments,
      issueEvents:
        runIssueEvents?.[index] ??
        (index === 0 && firstRunIssueEvents
          ? firstRunIssueEvents
          : [...state.issueEvents]),
      permissions,
    });
    if (run === "labeled" && labeledPayloadUpdatedAt !== undefined)
      snapshot.event.issue.updated_at = labeledPayloadUpdatedAt;
    const decision = decideIssueContract(snapshotFor(snapshot));
    applyFeedback(comments, decision);
    applyLabelChanges(state, decision.removeLabels, decision.addLabels);
    return decision;
  });
  return { decisions, comments, labels: state.labels };
}

const runOrders = [
  ["labeled", "opened"],
  ["opened", "labeled"],
];
const notAuthorized = /@reporter is not authorized to grant readiness/;
const unauthorizedOpeners = [
  {
    name: "an opener with the write role",
    permission: role("write"),
    rejection: notAuthorized,
  },
  {
    name: "an opener without a repository role",
    permission: null,
    rejection: notAuthorized,
  },
  {
    name: "an opener whose role lookup fails",
    permission: {
      error:
        "GitHub API GET /repos/example/repository/collaborators/reporter/permission returned 403: Resource not accessible by integration",
    },
    rejection: /Could not verify @reporter's review authority/,
  },
];

const lostCreationReadiness = (message, remove = ["ready-for-agent"]) => ({
  exitCode: 1,
  remove,
  add: ["needs-triage"],
  feedback: "create",
  message,
});

decisionTable(
  "the creation review binds a readiness label applied at creation, whichever run arrives first",
  [
    ...[
      ["no recorded history", []],
      [
        "both label applications recorded in the creation second",
        [
          creationLabel(),
          creationLabel({ id: 102, label: { name: "needs-triage" } }),
        ],
      ],
    ].map(([history, issueEvents]) => ({
      name: `an authorized native issue creation with needs-triage keeps only its readiness state: ${history}`,
      snapshot: (() => {
        const issue = {
          number: 42,
          node_id: "ISSUE_42",
          body: ticketBody,
          labels: [{ name: "needs-triage" }, { name: "ready-for-agent" }],
          state: "open",
          created_at: "2026-09-14T17:00:00Z",
          updated_at: "2026-09-14T17:00:00Z",
        };
        return {
          issue,
          issueEvents,
          event: {
            action: "opened",
            issue: {
              number: 42,
              body: issue.body,
              labels: issue.labels,
              created_at: issue.created_at,
              updated_at: issue.updated_at,
            },
            sender: { login: "maintainer" },
          },
          permissions: { maintainer: role("admin") },
        };
      })(),
      expected: {
        exitCode: 0,
        remove: ["needs-triage"],
        feedback: "create",
        message: /valid implementation ticket with ready-for-agent bound/i,
      },
    })),
    {
      name: "an authorized native issue creation preserves its reviewed readiness",
      snapshot: (() => {
        const issue = {
          number: 42,
          node_id: "ISSUE_42",
          body: specificationBody,
          labels: [{ name: "ready-for-agent" }],
          state: "open",
          created_at: "2026-09-14T17:00:00Z",
          updated_at: "2026-09-14T17:00:00Z",
        };
        return {
          issue,
          issueEvents: [],
          event: {
            action: "opened",
            issue: {
              number: 42,
              body: issue.body,
              labels: issue.labels,
              created_at: issue.created_at,
              updated_at: issue.updated_at,
            },
            sender: { login: "maintainer" },
          },
          permissions: { maintainer: role("admin") },
        };
      })(),
      expected: {
        exitCode: 0,
        feedback: "create",
        message: /valid specification with ready-for-agent bound/i,
      },
    },
    {
      name: "a repeated multiply-ready opening cannot approve the one remaining label",
      snapshot: {
        issue: {
          number: 42,
          node_id: "ISSUE_42",
          body: ticketBody,
          labels: [{ name: "ready-for-agent" }],
          state: "open",
          created_at: "2026-09-14T17:00:00Z",
          updated_at: "2026-09-14T17:01:00Z",
        },
        issueEvents: [
          {
            id: 102,
            event: "unlabeled",
            label: { name: "ready-for-human" },
            actor: { login: "maintainer" },
            created_at: "2026-09-14T17:01:00Z",
          },
        ],
        event: {
          action: "opened",
          issue: {
            number: 42,
            body: ticketBody,
            labels: [{ name: "ready-for-agent" }, { name: "ready-for-human" }],
            created_at: "2026-09-14T17:00:00Z",
            updated_at: "2026-09-14T17:00:00Z",
          },
          sender: { login: "maintainer" },
        },
        permissions: { maintainer: role("admin") },
      },
      expected: {
        exitCode: 1,
        remove: ["ready-for-agent"],
        add: ["needs-triage"],
        feedback: "create",
      },
    },
    {
      name: "a delayed opening cannot treat a later same-actor re-add as the creation review",
      snapshot: (() => {
        const issue = {
          number: 42,
          node_id: "ISSUE_42",
          body: ticketBody,
          labels: [{ name: "ready-for-agent" }],
          state: "open",
          created_at: "2026-09-14T17:00:00Z",
          updated_at: "2026-09-14T17:02:00Z",
        };
        return {
          issue,
          issueEvents: [
            {
              id: 101,
              event: "labeled",
              label: { name: "ready-for-agent" },
              actor: { login: "maintainer" },
              created_at: "2026-09-14T17:00:00Z",
            },
            {
              id: 102,
              event: "unlabeled",
              label: { name: "ready-for-agent" },
              actor: { login: "maintainer" },
              created_at: "2026-09-14T17:01:00Z",
            },
            {
              id: 103,
              event: "labeled",
              label: { name: "ready-for-agent" },
              actor: { login: "maintainer" },
              created_at: "2026-09-14T17:02:00Z",
            },
          ],
          event: {
            action: "opened",
            issue: {
              number: 42,
              body: issue.body,
              labels: issue.labels,
              created_at: issue.created_at,
              updated_at: issue.created_at,
            },
            sender: { login: "maintainer" },
          },
          permissions: { maintainer: role("admin") },
        };
      })(),
      expected: {
        exitCode: 1,
        remove: ["ready-for-agent"],
        add: ["needs-triage"],
        feedback: "create",
      },
    },
    {
      name: "a creation-time workflow label event is replaced by the same-second review",
      snapshot: {
        ...supersessionSnapshot({
          labels: ["needs-triage", "ready-for-agent"],
          created_at: "2026-09-14T17:00:00Z",
          issueEvents: [readinessReview],
          event: labeledBy("maintainer", "needs-triage", {
            body: ticketBody,
            updated_at: "2026-09-14T17:00:00Z",
          }),
        }),
      },
      expected: {
        exitCode: 0,
        remove: ["needs-triage"],
        message: /valid implementation ticket with ready-for-agent bound/i,
      },
    },
    ...[null, "2026-09-14T17:00:04Z"].map((updatedAt) => ({
      name: `the rejected creation-label replay retains its reason with payload updated_at ${updatedAt}`,
      run: () => {
        const { comments, labels } = decideCreationRuns(["opened", "labeled"], {
          opener: "reporter",
          permissions: { reporter: role("write") },
          labeledPayloadUpdatedAt: updatedAt,
        });
        assert.match(comments[0].body, notAuthorized);
        assert.deepEqual(labels, ["needs-triage"]);
        assert.equal(comments.length, 1);
      },
    })),
    {
      name: "an unauthorized opened-first rejection survives empty history in both runs",
      run: () => {
        const {
          decisions: [first, second],
          comments,
          labels,
        } = decideCreationRuns(["opened", "labeled"], {
          opener: "reporter",
          permissions: { reporter: role("write") },
          runIssueEvents: [[], []],
        });
        assertDecision(first, {
          ...lostCreationReadiness(notAuthorized),
          feedbackBody: [notAuthorized, /"observedEventId":null/],
        });
        assertDecision(second, { exitCode: 0 });
        assert.match(comments[0].body, notAuthorized);
        assert.deepEqual(labels, ["needs-triage"]);
        assert.equal(comments.length, 1);
      },
    },
    {
      name: "an unauthorized opened-first rejection survives creation-timeline catch-up",
      run: () => {
        const {
          decisions: [first, second],
          comments,
          labels,
        } = decideCreationRuns(["opened", "labeled"], {
          opener: "reporter",
          permissions: { reporter: role("write") },
          firstRunIssueEvents: [],
        });
        assertDecision(first, {
          ...lostCreationReadiness(notAuthorized),
          feedbackBody: [notAuthorized, /"observedEventId":null/],
        });
        assertDecision(second, {
          exitCode: 0,
          feedback: 99,
          feedbackBody: notAuthorized,
        });
        assert.match(comments[0].body, notAuthorized);
        assert.deepEqual(labels, ["needs-triage"]);
        assert.equal(comments.length, 1);
      },
    },
    {
      name: "the labeled run for a workflow state created beside readiness keeps only the readiness state",
      snapshot: createdWithReadiness({
        run: "labeled",
        labels: ["needs-triage", "ready-for-agent"],
        trigger: "needs-triage",
        issueEvents: [
          creationLabel(),
          creationLabel({ id: 102, label: { name: "needs-triage" } }),
        ],
      }),
      expected: {
        exitCode: 0,
        remove: ["needs-triage"],
        feedback: "create",
        feedbackBody: /"reviewEventId":"101"/,
      },
    },
    ...[
      {
        name: "an authorized opener keeps the label",
        options: {},
        check: ({ decisions: [first, second], comments, labels }) => {
          assertDecision(first, {
            exitCode: 0,
            feedback: "create",
            message: /valid implementation ticket with ready-for-agent bound/i,
          });
          assertDecision(second, {
            exitCode: 0,
            message: /valid implementation ticket with ready-for-agent bound/i,
          });
          assert.deepEqual(recordedState(comments[0].body), {
            status: "approved",
            revision: bodyRevision(
              createdWithReadiness({ run: "opened" }).issue,
            ),
            label: "ready-for-agent",
            reviewer: "maintainer",
            reviewEventId: "101",
            sourceInvalidation: null,
          });
          assert.deepEqual(labels, ["ready-for-agent"]);
          assert.equal(comments.length, 1);
        },
      },
      ...unauthorizedOpeners.map((opener) => ({
        name: `${opener.name} is rejected as unauthorized`,
        options: {
          opener: "reporter",
          permissions: { reporter: opener.permission },
        },
        check: ({ decisions: [first, second], comments, labels }) => {
          assertDecision(first, {
            ...lostCreationReadiness(opener.rejection),
            notMessage: /wait for the validator to publish/i,
            feedbackBody: [opener.rejection, /"observedEventId":"101"/],
          });
          assertDecision(second, {
            exitCode: 0,
            feedback: 99,
            message: /awaiting authorized review/i,
            feedbackBody: /awaiting review/i,
          });
          if (opener.permission?.error) {
            assert.doesNotMatch(comments[0].body, opener.rejection);
            assert.doesNotMatch(
              comments[0].body,
              /last readiness attempt was rejected|rejectionReason/,
            );
          } else {
            assert.match(comments[0].body, opener.rejection);
          }
          assert.deepEqual(labels, ["needs-triage"]);
          assert.equal(comments.length, 1);
        },
      })),
    ].map(({ name, options, check }) => ({
      name: `${name}, with the same decisions, feedback, and labels in either run order`,
      run: () => {
        const [labeledFirst, openedFirst] = runOrders.map((order) =>
          decideCreationRuns(order, options),
        );
        assert.deepEqual(labeledFirst, openedFirst);
        check(labeledFirst);
      },
    })),
    {
      name: "an edited body loses readiness when the labeled run arrives first",
      snapshot: createdWithReadiness({
        run: "labeled",
        bodyLastEditedAt: "2026-09-14T17:00:30Z",
      }),
      expected: lostCreationReadiness(/wait for the validator to publish/i),
    },
    {
      name: "two readiness labels lose readiness when the labeled run arrives first",
      snapshot: createdWithReadiness({
        run: "labeled",
        labels: ["ready-for-agent", "ready-for-human"],
        issueEvents: [
          creationLabel(),
          creationLabel({ id: 102, label: { name: "ready-for-human" } }),
        ],
      }),
      expected: lostCreationReadiness(/only one readiness label/i, [
        "ready-for-agent",
        "ready-for-human",
      ]),
    },
    {
      name: "a later re-add without a revision notice loses readiness",
      snapshot: createdWithReadiness({
        run: "labeled",
        issueEvents: [
          creationLabel(),
          creationLabel({
            id: 102,
            event: "unlabeled",
            created_at: "2026-09-14T17:01:00Z",
          }),
          creationLabel({ id: 103, created_at: "2026-09-14T17:02:00Z" }),
        ],
      }),
      expected: lostCreationReadiness(/wait for the validator to publish/i),
    },
    {
      name: "a label the opener applied after the creation second loses readiness",
      snapshot: createdWithReadiness({
        run: "labeled",
        issueEvents: [creationLabel({ created_at: "2026-09-14T17:00:01Z" })],
      }),
      expected: lostCreationReadiness(/wait for the validator to publish/i),
    },
    {
      name: "a label the timeline has not recorded loses readiness when the labeled run arrives first",
      snapshot: createdWithReadiness({ run: "labeled", issueEvents: [] }),
      expected: lostCreationReadiness(
        /timeline does not contain the current readiness label event/i,
      ),
    },
    {
      name: "a label the timeline has not recorded loses readiness whatever the opener's role",
      snapshot: createdWithReadiness({
        run: "labeled",
        opener: "reporter",
        issueEvents: [],
        permissions: { reporter: role("write") },
      }),
      expected: lostCreationReadiness(
        /timeline does not contain the current readiness label event/i,
      ),
    },
    {
      name: "a label another actor applied in the creation second loses readiness",
      snapshot: createdWithReadiness({
        run: "labeled",
        labeler: "triager",
        issueEvents: [creationLabel({ actor: { login: "triager" } })],
        permissions: { maintainer: role("admin"), triager: role("triage") },
      }),
      expected: lostCreationReadiness(/wait for the validator to publish/i),
    },
  ],
);

// A rejection followed by the validator's label cleanup, as a later run sees it.
function rejectedCreationSnapshot() {
  const comments = [];
  const state = creationState("reporter");
  const snapshot = createdWithReadiness({
    run: "labeled",
    opener: "reporter",
    issueEvents: state.issueEvents,
    comments,
    permissions: { reporter: role("write") },
  });
  const rejection = decideIssueContract(snapshotFor(snapshot));
  applyFeedback(comments, rejection);
  comments[0].updated_at = "2026-09-14T17:00:05Z";
  applyLabelChanges(state, rejection.removeLabels, rejection.addLabels);
  snapshot.issue.labels = state.labels.map((name) => ({ name }));
  snapshot.event = { action: "reopened", issue: { number: 42 } };
  return snapshot;
}

// A maintainer's fresh readiness label after the opener's rejected creation
// grant and its cleanup, with the timeline that run reads.
function freshGrantSnapshot() {
  const snapshot = rejectedCreationSnapshot();
  snapshot.issue.labels.push({ name: "ready-for-agent" });
  snapshot.issue.updated_at = "2026-09-14T17:01:00Z";
  snapshot.event = labeledBy("maintainer", "ready-for-agent", snapshot.issue);
  snapshot.permissions.maintainer = role("admin");
  return snapshot;
}

// A ticket that `author` opened without readiness, after its revision notice,
// with the readiness label present when `sender`'s labeled run reads it.
function laterGrantSnapshot({ feedback, issueEvents, sender }) {
  const issue = {
    number: 42,
    node_id: "ISSUE_42",
    body: ticketBody,
    labels: [{ name: "ready-for-agent" }],
    state: "open",
    user: { login: "author" },
    created_at: "2026-09-14T16:00:00Z",
    updated_at: "2026-09-14T17:03:00Z",
  };
  return {
    issue,
    comments: [feedback(issue)],
    issueEvents,
    event: labeledBy(sender, "ready-for-agent", issue),
    permissions: {
      author: role("admin"),
      maintainer: role("admin"),
      triager: role("triage"),
    },
  };
}

// The maintainer applied and removed `ready-for-human`, the author applied
// `ready-for-agent`, and the maintainer's removal and reapplication of
// `ready-for-agent` are unrecorded when the maintainer's labeled run reads it.
function crossLabelSnapshot() {
  const maintainerHuman = creationLabel({
    id: 201,
    label: { name: "ready-for-human" },
    created_at: "2026-09-14T17:01:00Z",
  });
  return laterGrantSnapshot({
    feedback: awaitingTicketFeedback,
    issueEvents: [
      maintainerHuman,
      {
        ...maintainerHuman,
        id: 202,
        event: "unlabeled",
        created_at: "2026-09-14T17:01:30Z",
      },
      creationLabel({
        id: 203,
        actor: { login: "author" },
        created_at: "2026-09-14T17:02:00Z",
      }),
    ],
    sender: "maintainer",
  });
}

// The author's application of readiness after the revision notice.
const authorGrant = creationLabel({
  id: 201,
  actor: { login: "author" },
  created_at: "2026-09-14T17:01:00Z",
});

const maintainerGrant = creationLabel({
  id: 300,
  created_at: "2026-09-14T17:01:00Z",
});

decisionTable(
  "a human readiness trigger is reviewed only from a timeline that records its application",
  [
    ...[
      ["only the opener's creation label", ([creation]) => [creation]],
      ["the bot's cleanup", (issueEvents) => issueEvents],
      [
        "the sender's application followed by the label's removal",
        (issueEvents) => [
          ...issueEvents,
          maintainerGrant,
          { ...maintainerGrant, id: 301, event: "unlabeled", actor: bot },
        ],
      ],
    ].map(([name, timeline]) => ({
      name: `the maintainer's trigger is unrecorded in a timeline holding ${name}`,
      run: () => {
        const snapshot = freshGrantSnapshot();
        snapshot.issueEvents = timeline(snapshot.issueEvents);
        assert.equal(readinessTriggerUnrecorded(snapshotFor(snapshot)), true);
      },
    })),
    {
      name: "the maintainer's trigger stays unrecorded while another person's reapplication is the label's latest change",
      run: () => {
        const snapshot = freshGrantSnapshot();
        snapshot.issueEvents.push(
          maintainerGrant,
          { ...maintainerGrant, id: 301, event: "unlabeled" },
          { ...maintainerGrant, id: 302, actor: { login: "triager" } },
        );
        assert.equal(readinessTriggerUnrecorded(snapshotFor(snapshot)), true);
      },
    },
    {
      name: "the maintainer's recorded trigger binds readiness to the maintainer's review event",
      run: () => {
        const snapshot = freshGrantSnapshot();
        snapshot.issueEvents.push(maintainerGrant);
        assert.equal(readinessTriggerUnrecorded(snapshotFor(snapshot)), false);
        const decision = decideIssueContract(snapshotFor(snapshot));
        assertDecision(decision, {
          exitCode: 0,
          remove: ["needs-triage"],
          feedback: 99,
          message: /valid implementation ticket with ready-for-agent bound/i,
        });
        assert.deepEqual(recordedState(decision.feedback.body), {
          status: "approved",
          revision: bodyRevision(snapshot.issue),
          label: "ready-for-agent",
          reviewer: "maintainer",
          reviewEventId: "300",
          sourceInvalidation: null,
        });
      },
    },
    ...[
      [
        "an opened run",
        () => createdWithReadiness({ run: "opened", issueEvents: [] }),
      ],
      [
        "a trigger by github-actions[bot]",
        () => ({
          ...freshGrantSnapshot(),
          event: labeledBy(bot.login, "ready-for-agent"),
        }),
      ],
      [
        "a non-readiness label",
        () => ({
          ...freshGrantSnapshot(),
          event: labeledBy("maintainer", "needs-triage"),
        }),
      ],
      [
        "a readiness trigger whose label is gone from the re-fetched issue",
        () => {
          const snapshot = freshGrantSnapshot();
          snapshot.issue.labels = [{ name: "needs-triage" }];
          return snapshot;
        },
      ],
    ].map(([name, snapshot]) => ({
      name: `${name} awaits no timeline application`,
      run: () => {
        assert.equal(
          readinessTriggerUnrecorded(snapshotFor(snapshot())),
          false,
        );
      },
    })),
    ...[
      ["a pending review", awaitingTicketFeedback],
      [
        "a recorded approval of that application",
        (issue) =>
          approvedTicketFeedback(issue, {
            reviewer: "author",
            reviewEventId: "201",
          }),
      ],
    ].map(([name, feedback]) => ({
      name: `a trigger whose removal and reapplication are unrecorded fails closed rather than binding the sender's earlier application, with ${name}`,
      snapshot: laterGrantSnapshot({
        feedback,
        issueEvents: [authorGrant],
        sender: "maintainer",
      }),
      expected: {
        exitCode: 1,
        remove: ["ready-for-agent"],
        add: ["needs-triage"],
        feedback: 13,
        message: /timeline does not contain the current readiness label event/,
      },
    })),
    {
      name: "the sender's application of the other readiness label leaves the trigger unrecorded",
      run: () =>
        assert.equal(
          readinessTriggerUnrecorded(snapshotFor(crossLabelSnapshot())),
          true,
        ),
    },
    {
      name: "the sender's application of the other readiness label fails closed rather than binding another person's application",
      snapshot: crossLabelSnapshot(),
      expected: {
        exitCode: 1,
        remove: ["ready-for-agent"],
        add: ["needs-triage"],
        feedback: 13,
        message: /timeline does not contain the current readiness label event/,
      },
    },
    {
      name: "a trigger whose label another person removed and a third reapplied fails closed rather than binding the third person's application",
      snapshot: laterGrantSnapshot({
        feedback: awaitingTicketFeedback,
        issueEvents: [
          authorGrant,
          {
            ...authorGrant,
            id: 202,
            event: "unlabeled",
            actor: { login: "maintainer" },
            created_at: "2026-09-14T17:02:00Z",
          },
          {
            ...authorGrant,
            id: 203,
            actor: { login: "triager" },
            created_at: "2026-09-14T17:03:00Z",
          },
        ],
        sender: "author",
      }),
      expected: {
        exitCode: 1,
        remove: ["ready-for-agent"],
        add: ["needs-triage"],
        feedback: 13,
        message: /timeline does not contain the current readiness label event/,
        notFeedbackBody: /reviewed by @triager/,
      },
    },
    {
      name: "a non-readiness label applied by another maintainer before any feedback keeps the creation review",
      snapshot: createdWithReadiness({
        run: "labeled",
        labeler: "documenter",
        currentLabels: ["ready-for-agent", "documentation"],
        trigger: "documentation",
        issueEvents: [
          creationLabel(),
          creationLabel({
            id: 102,
            label: { name: "documentation" },
            actor: { login: "documenter" },
            created_at: "2026-09-14T17:00:30Z",
          }),
        ],
        permissions: { maintainer: role("admin"), documenter: role("admin") },
      }),
      expected: {
        exitCode: 0,
        feedback: "create",
        message: /valid implementation ticket with ready-for-agent bound/i,
        feedbackBody: [/reviewed by @maintainer/, /"reviewEventId":"101"/],
      },
    },
    {
      name: "a creation label in the creation second never reviews another sender's trigger",
      snapshot: createdWithReadiness({
        run: "labeled",
        opener: "reporter",
        labeler: "maintainer",
        issueEvents: [creationLabel({ actor: { login: "reporter" } })],
        permissions: { reporter: role("write"), maintainer: role("admin") },
      }),
      expected: {
        ...lostCreationReadiness(
          /timeline does not contain the current readiness label event/,
        ),
        notMessage: notAuthorized,
      },
    },
    {
      name: "a creation labeled run that first reads an empty timeline records the opener's rejection, which the opened run keeps",
      run: () => {
        const comments = [];
        const state = creationState("reporter");
        const permissions = { reporter: role("write") };
        const labeled = createdWithReadiness({
          run: "labeled",
          opener: "reporter",
          comments,
          issueEvents: [],
          permissions,
        });
        assert.equal(readinessTriggerUnrecorded(snapshotFor(labeled)), true);
        labeled.issueEvents = [...state.issueEvents];
        assert.equal(readinessTriggerUnrecorded(snapshotFor(labeled)), false);
        const rejection = decideIssueContract(snapshotFor(labeled));
        assertDecision(rejection, {
          ...lostCreationReadiness(notAuthorized),
          feedbackBody: /"rejectedCreationLabel":"ready-for-agent"/,
        });
        applyFeedback(comments, rejection);
        applyLabelChanges(state, rejection.removeLabels, rejection.addLabels);

        const opened = createdWithReadiness({
          run: "opened",
          opener: "reporter",
          currentLabels: state.labels,
          comments,
          issueEvents: [...state.issueEvents],
          permissions,
        });
        assert.equal(readinessTriggerUnrecorded(snapshotFor(opened)), false);
        const kept = decideIssueContract(snapshotFor(opened));
        assertDecision(kept, { exitCode: 0, feedback: 99 });
        applyFeedback(comments, kept);
        assert.match(comments[0].body, notAuthorized);
        assert.deepEqual(state.labels, ["needs-triage"]);
      },
    },
  ],
);

// This issue's own opening barrier and another issue's.
const ownOpening = "opened:ISSUE_42:2026-09-14T16:00:00Z";
const otherOpening = "opened:ISSUE_99:2026-09-14T16:00:00Z";

const [rejectedGrant, rejectedGrantRemoved, retriedGrant] =
  readinessRetryEvents;

// The triager's reapplication of readiness after the maintainer's rejected
// application and its removal.
const otherRetryEvents = [
  rejectedGrant,
  rejectedGrantRemoved,
  { ...retriedGrant, actor: { login: "triager" } },
];

// A retry of readiness by `sender`, the maintainer unless stated, after the
// notice that observed 201, with the timeline its labeled run reads.
function retrySnapshot({
  issueEvents,
  observedEventId = "201",
  sender = "maintainer",
}) {
  return laterGrantSnapshot({
    feedback: (issue) => ({
      ...awaitingTicketFeedback(issue, { observedEventId }),
      updated_at: "2026-09-14T17:01:05Z",
    }),
    issueEvents,
    sender,
  });
}

decisionTable(
  "an awaiting-review notice's observed event is a barrier for the readiness trigger",
  [
    {
      name: "a retry whose timeline ends at the sender's application the notice observed is unrecorded",
      run: () =>
        assert.equal(
          readinessTriggerUnrecorded(
            snapshotFor(retrySnapshot({ issueEvents: [rejectedGrant] })),
          ),
          true,
        ),
    },
    {
      name: "a retry whose timeline ends at the sender's application the notice observed fails closed rather than rejecting that application again",
      snapshot: retrySnapshot({ issueEvents: [rejectedGrant] }),
      expected: {
        exitCode: 1,
        remove: ["ready-for-agent"],
        add: ["needs-triage"],
        feedback: 13,
        message: /timeline does not contain the current readiness label event/,
        notMessage: /wait for the validator to publish/i,
        feedbackBody: /"observedEventId":"201"/,
      },
    },
    {
      name: "a retry whose removal and reapplication are recorded binds the reapplication",
      run: () => {
        const snapshot = retrySnapshot({ issueEvents: readinessRetryEvents });
        assert.equal(readinessTriggerUnrecorded(snapshotFor(snapshot)), false);
        const decision = decideIssueContract(snapshotFor(snapshot));
        assertDecision(decision, {
          exitCode: 0,
          feedback: 13,
          message: /valid implementation ticket with ready-for-agent bound/i,
        });
        assert.deepEqual(recordedState(decision.feedback.body), {
          status: "approved",
          revision: bodyRevision(snapshot.issue),
          label: "ready-for-agent",
          reviewer: "maintainer",
          reviewEventId: "203",
          sourceInvalidation: null,
        });
      },
    },
    {
      name: "a redelivered trigger for an approved review stays recorded and keeps the approval",
      run: () => {
        const snapshot = laterGrantSnapshot({
          feedback: (issue) =>
            approvedTicketFeedback(issue, { reviewEventId: "203" }),
          issueEvents: readinessRetryEvents,
          sender: "maintainer",
        });
        assert.equal(readinessTriggerUnrecorded(snapshotFor(snapshot)), false);
        assertDecision(decideIssueContract(snapshotFor(snapshot)), {
          exitCode: 0,
          message: /valid implementation ticket with ready-for-agent bound/i,
        });
      },
    },
    {
      name: "a delayed trigger by the sender of the observed application fails closed rather than binding another person's reapplication after the barrier",
      run: () => {
        const snapshot = retrySnapshot({ issueEvents: otherRetryEvents });
        assert.equal(readinessTriggerUnrecorded(snapshotFor(snapshot)), true);
        assertDecision(decideIssueContract(snapshotFor(snapshot)), {
          exitCode: 1,
          remove: ["ready-for-agent"],
          add: ["needs-triage"],
          feedback: 13,
          message:
            /timeline does not contain the current readiness label event/,
          notFeedbackBody: /reviewed by @triager/,
        });
      },
    },
    ...[
      [
        "is unrecorded",
        (snapshot) =>
          assert.equal(readinessTriggerUnrecorded(snapshotFor(snapshot)), true),
      ],
      [
        "fails closed",
        (snapshot) =>
          assertDecision(decideIssueContract(snapshotFor(snapshot)), {
            exitCode: 1,
            remove: ["ready-for-agent"],
            add: ["needs-triage"],
            feedback: 13,
            message:
              /timeline does not contain the current readiness label event/,
          }),
      ],
    ].map(([name, check]) => ({
      name: `a retry whose sender applied the label only before the observed application ${name}`,
      run: () =>
        check(
          retrySnapshot({
            issueEvents: [
              {
                ...rejectedGrant,
                id: 150,
                actor: { login: "triager" },
                created_at: "2026-09-14T16:30:00Z",
              },
              rejectedGrant,
            ],
            sender: "triager",
          }),
        ),
    })),
    ...[
      ["an event the timeline does not hold", "999"],
      ["another issue's opening", otherOpening],
    ].flatMap(([name, observedEventId]) => [
      {
        name: `a barrier at ${name} never makes the trigger recorded`,
        run: () =>
          assert.equal(
            readinessTriggerUnrecorded(
              snapshotFor(
                retrySnapshot({
                  issueEvents: readinessRetryEvents,
                  observedEventId,
                }),
              ),
            ),
            true,
          ),
      },
      {
        name: `a barrier at ${name} fails the trigger closed`,
        snapshot: retrySnapshot({
          issueEvents: readinessRetryEvents,
          observedEventId,
        }),
        expected: {
          exitCode: 1,
          remove: ["ready-for-agent"],
          add: ["needs-triage"],
          feedback: 13,
          message:
            /timeline does not contain the current readiness label event/,
        },
      },
    ]),
  ],
);

// A reapplication run's fail-closed decision.
const reapplicationFailsClosed = {
  exitCode: 1,
  remove: ["ready-for-agent"],
  add: ["needs-triage"],
  feedback: 13,
  message: /timeline does not contain the current readiness label event/,
};

// Whether a decision's feedback records no approval.
function keepsNoApproval(decision) {
  const state = recordedState(decision.feedback.body);
  assert.equal(state.status, "awaiting-review");
  assert.equal(state.reviewer, null);
}

decisionTable(
  "a readiness trigger is recorded only when the label's latest application is the sender's",
  [
    ...[
      ["awaits review", {}],
      ["records Bob's approval", { approved: true }],
    ].flatMap(([name, options]) => [
      {
        name: `Alice's trigger over a timeline ending at Bob's application is unrecorded while the feedback ${name}`,
        run: () =>
          assert.equal(
            readinessTriggerUnrecorded(
              snapshotFor({
                ...reapplicationRun(options),
                issueEvents: laggingReapplicationEvents,
              }),
            ),
            true,
          ),
      },
      {
        name: `Alice's trigger over a timeline ending at Bob's application fails closed rather than binding Bob's review while the feedback ${name}`,
        snapshot: {
          ...reapplicationRun(options),
          issueEvents: laggingReapplicationEvents,
        },
        expected: reapplicationFailsClosed,
        check: keepsNoApproval,
      },
      {
        name: `Alice's trigger over the complete timeline is rejected as unauthorized while the feedback ${name}`,
        run: () => {
          const snapshot = snapshotFor({
            ...reapplicationRun(options),
            issueEvents: reapplicationEvents,
          });
          assert.equal(readinessTriggerUnrecorded(snapshot), false);
          assertDecision(decideIssueContract(snapshot), {
            exitCode: 1,
            remove: ["ready-for-agent"],
            add: ["needs-triage"],
            feedback: 13,
            message: /@alice is not authorized/,
          });
        },
      },
    ]),
    {
      name: "the sender's own earlier application, the label's latest after the barrier, binds while the sender's removal and reapplication are unrecorded",
      run: () => {
        const snapshot = snapshotFor({
          ...reapplicationRun({ sender: "bob" }),
          issueEvents: laggingReapplicationEvents,
        });
        assert.equal(readinessTriggerUnrecorded(snapshot), false);
        const decision = decideIssueContract(snapshot);
        assertDecision(decision, {
          exitCode: 0,
          feedback: 13,
          message: /valid implementation ticket with ready-for-agent bound/i,
        });
        assert.deepEqual(recordedState(decision.feedback.body), {
          status: "approved",
          revision: bodyRevision(snapshot.issue),
          label: "ready-for-agent",
          reviewer: "bob",
          reviewEventId: "203",
          sourceInvalidation: null,
        });
      },
    },
  ],
);

// A swap run's fail-closed decision.
const swapFailsClosed = {
  ...reapplicationFailsClosed,
  remove: ["ready-for-human"],
};

decisionTable(
  "a readiness trigger whose label is gone is checked against the readiness label the issue carries",
  [
    ...[
      ["awaits review", {}],
      ["records Bob's approval", { approved: true }],
    ].flatMap(([name, options]) => [
      {
        name: `Alice's ready-for-agent trigger over a timeline ending at Bob's ready-for-human is unrecorded while the feedback ${name}`,
        run: () =>
          assert.equal(
            readinessTriggerUnrecorded(
              snapshotFor({
                ...swapRun(options),
                issueEvents: laggingSwapEvents,
              }),
            ),
            true,
          ),
      },
      {
        name: `Alice's ready-for-agent trigger over a timeline ending at Bob's ready-for-human fails closed rather than binding Bob's review while the feedback ${name}`,
        snapshot: { ...swapRun(options), issueEvents: laggingSwapEvents },
        expected: swapFailsClosed,
        check: keepsNoApproval,
      },
      {
        name: `Alice's ready-for-agent trigger over the complete swap is rejected as unauthorized while the feedback ${name}`,
        run: () => {
          const snapshot = snapshotFor({
            ...swapRun(options),
            issueEvents: swapEvents(),
          });
          assert.equal(readinessTriggerUnrecorded(snapshot), false);
          assertDecision(decideIssueContract(snapshot), {
            exitCode: 1,
            remove: ["ready-for-human"],
            add: ["needs-triage"],
            feedback: 13,
            message: /@alice is not authorized/,
          });
        },
      },
    ]),
    {
      name: "Alice's ready-for-agent trigger over her own ready-for-human at the barrier is unrecorded and fails closed",
      run: () => {
        const snapshot = snapshotFor({
          ...swapRun(),
          issueEvents: swapEvents().slice(0, 1),
        });
        assert.equal(readinessTriggerUnrecorded(snapshot), true);
        assertDecision(decideIssueContract(snapshot), swapFailsClosed);
      },
    },
    {
      name: "Alice's delayed ready-for-agent trigger over Bob's recorded swap to ready-for-human is unrecorded and fails closed",
      run: () => {
        const snapshot = snapshotFor({
          ...swapRun(),
          issueEvents: swapEvents({ swapper: "bob" }),
        });
        assert.equal(readinessTriggerUnrecorded(snapshot), true);
        const decision = decideIssueContract(snapshot);
        assertDecision(decision, {
          ...swapFailsClosed,
          notFeedbackBody: /reviewed by @bob/,
        });
        keepsNoApproval(decision);
      },
    },
    {
      name: "Bob's ready-for-agent trigger over his own recorded swap binds his ready-for-human application",
      run: () => {
        const snapshot = snapshotFor({
          ...swapRun({ sender: "bob" }),
          issueEvents: swapEvents({ applier: "bob" }),
        });
        assert.equal(readinessTriggerUnrecorded(snapshot), false);
        const decision = decideIssueContract(snapshot);
        assertDecision(decision, {
          exitCode: 0,
          feedback: 13,
          message: /valid implementation ticket with ready-for-human bound/i,
        });
        assert.deepEqual(recordedState(decision.feedback.body), {
          status: "approved",
          revision: bodyRevision(snapshot.issue),
          label: "ready-for-human",
          reviewer: "bob",
          reviewEventId: "207",
          sourceInvalidation: null,
        });
      },
    },
    {
      name: "Alice's ready-for-agent trigger stays recorded over a lagging timeline when the issue carries no readiness label",
      run: () => {
        const run = swapRun();
        run.issue.labels = [{ name: "needs-triage" }];
        assert.equal(
          readinessTriggerUnrecorded(
            snapshotFor({ ...run, issueEvents: laggingSwapEvents }),
          ),
          false,
        );
      },
    },
    ...[
      ["ready-for-agent", "ready-for-human"],
      ["ready-for-human", "ready-for-agent"],
    ].flatMap(([trigger, other]) =>
      [
        [trigger, other],
        [other, trigger],
      ].map((carried) => ({
        name: `Alice's ${trigger} trigger over an issue carrying ${carried.join(" and ")} is checked against her own ${trigger}, not Bob's ${other}`,
        run: () => {
          // Alice's ready-for-human (100) and the bot's removal (101), then
          // Alice's application of the trigger's label (300) and Bob's of the
          // other (301).
          const issueEvents = [
            ...swapEvents().slice(0, 2),
            creationLabel({
              id: 300,
              label: { name: trigger },
              actor: { login: "alice" },
              created_at: "2026-09-14T17:02:00Z",
            }),
            creationLabel({
              id: 301,
              label: { name: other },
              actor: { login: "bob" },
              created_at: "2026-09-14T17:02:10Z",
            }),
          ];
          const run = reapplicationRun({ trigger });
          const carrying = (labels) =>
            snapshotFor({
              ...run,
              issue: { ...run.issue, labels: labels.map((name) => ({ name })) },
              issueEvents,
            });
          assert.equal(readinessTriggerUnrecorded(carrying(carried)), false);
          assert.equal(readinessTriggerUnrecorded(carrying([other])), true);
        },
      })),
    ),
  ],
);

decisionTable(
  "a recorded readiness rejection lasts until another review or contract change",
  [
    {
      name: "a multiple-labels rejection is replaced by the next run's plain revision notice, unchanged by #157",
      run: () => {
        const comments = [];
        const state = {
          labels: ["ready-for-agent", "ready-for-human"],
          issueEvents: [
            creationLabel(),
            creationLabel({ id: 102, label: { name: "ready-for-human" } }),
          ],
        };
        const snapshot = createdWithReadiness({
          run: "labeled",
          labels: state.labels,
          issueEvents: state.issueEvents,
          comments,
        });
        const rejection = decideIssueContract(snapshotFor(snapshot));
        assertDecision(
          rejection,
          lostCreationReadiness(/only one readiness label/, state.labels),
        );
        applyFeedback(comments, rejection);
        applyLabelChanges(state, rejection.removeLabels, rejection.addLabels);
        snapshot.issue.labels = state.labels.map((name) => ({ name }));
        snapshot.event = { action: "reopened", issue: { number: 42 } };
        const next = decideIssueContract(snapshotFor(snapshot));
        assertDecision(next, { exitCode: 0, feedback: 99 });
        assert.deepEqual(recordedState(next.feedback.body), {
          status: "awaiting-review",
          revision: bodyRevision(snapshot.issue),
          label: null,
          reviewer: null,
          observedEventId: "203",
          sourceInvalidation: null,
        });
      },
    },
    {
      name: "a previous validator's record without rejectionReason keeps the plain notice unchanged",
      run: () => {
        const issue = createdWithReadiness({
          run: "opened",
          currentLabels: ["needs-triage"],
        }).issue;
        const previous = awaitingTicketFeedback(issue, {
          observedEventId: "101",
        });
        const comments = [previous];
        const decision = decideIssueContract(
          snapshotFor({ issue, comments, issueEvents: [creationLabel()] }),
        );
        assertDecision(decision, { exitCode: 0 });
        assert.doesNotMatch(previous.body, /rejectionReason/);
        applyFeedback(comments, decision);
        assert.equal(comments[0].body, previous.body);
      },
    },
    {
      name: "unrelated and repeated runs retain the rejection after bot cleanup",
      run: () => {
        const snapshot = rejectedCreationSnapshot();
        const cleanup = decideIssueContract(snapshotFor(snapshot));
        assertDecision(cleanup, {
          exitCode: 0,
          feedback: 99,
          feedbackBody: notAuthorized,
        });
        applyFeedback(snapshot.comments, cleanup);
        const retained = snapshot.comments[0].body;
        for (const event of [
          {
            action: "unlabeled",
            label: { name: "ready-for-agent" },
            sender: bot,
          },
          { action: "created", comment: { id: 100, body: "Discussion." } },
          { action: "reopened" },
        ]) {
          snapshot.event = { issue: { number: 42 }, ...event };
          assertDecision(decideIssueContract(snapshotFor(snapshot)), {
            exitCode: 0,
          });
          assert.equal(snapshot.comments[0].body, retained);
        }
      },
    },
    {
      name: "an authorized readiness event replaces the rejection with approval",
      run: () => {
        const snapshot = rejectedCreationSnapshot();
        snapshot.issue.labels.push({ name: "ready-for-agent" });
        snapshot.issue.updated_at = "2026-09-14T17:01:00Z";
        snapshot.issueEvents.push(
          creationLabel({ id: 300, created_at: snapshot.issue.updated_at }),
        );
        snapshot.event = labeledBy(
          "maintainer",
          "ready-for-agent",
          snapshot.issue,
        );
        snapshot.permissions.maintainer = role("admin");
        const decision = decideIssueContract(snapshotFor(snapshot));
        assertDecision(decision, {
          exitCode: 0,
          remove: ["needs-triage"],
          feedback: 99,
          feedbackBody: /reviewed by @maintainer/,
        });
        assert.doesNotMatch(
          decision.feedback.body,
          /not authorized|last readiness attempt was rejected|rejectionReason/,
        );
      },
    },
    ...[
      {
        name: "only the creation label recorded",
        creationOnly: true,
        feedback: 99,
      },
      {
        name: "bot cleanup recorded",
        creationOnly: false,
        feedback: 99,
      },
    ].map(({ name, creationOnly, feedback }) => ({
      name: `a maintainer's fresh label decided from a timeline that has not recorded it fails closed without blaming the opener, with ${name}`,
      run: () => {
        const snapshot = freshGrantSnapshot();
        if (creationOnly)
          snapshot.issueEvents = [
            creationLabel({ actor: { login: "reporter" } }),
          ];
        assertDecision(decideIssueContract(snapshotFor(snapshot)), {
          exitCode: 1,
          remove: ["ready-for-agent"],
          feedback,
          message:
            /timeline does not contain the current readiness label event/,
          notMessage: notAuthorized,
        });
      },
    })),
    ...[
      {
        name: "changed contract bytes",
        change: (snapshot) => {
          snapshot.issue.body = ticketBody.replace(
            "Add caching.",
            "Add an index.",
          );
        },
      },
      {
        name: "an edit with unchanged contract bytes",
        change: (snapshot) => {
          snapshot.bodyLastEditedAt = "2026-09-14T17:01:00Z";
        },
      },
      {
        name: "a later readiness removal by a maintainer",
        change: (snapshot) => {
          snapshot.issueEvents.push(
            creationLabel({
              id: 300,
              event: "unlabeled",
              created_at: "2026-09-14T17:01:00Z",
            }),
          );
        },
      },
      {
        name: "a different readiness label triggered by the opener",
        change: (snapshot) => {
          snapshot.event = labeledBy("reporter", "ready-for-human");
        },
      },
      {
        name: "a readiness removal triggered by the opener",
        change: (snapshot) => {
          snapshot.event = { ...labeledBy("reporter"), action: "unlabeled" };
        },
      },
      {
        name: "a later recorded readiness application by the opener",
        change: (snapshot) => {
          snapshot.issueEvents.push(
            creationLabel({
              id: 300,
              actor: { login: "reporter" },
              created_at: "2026-09-14T17:01:00Z",
            }),
          );
          snapshot.event = labeledBy("reporter");
        },
      },
      {
        name: "a maintainer's unlabeled event absent from the timeline",
        change: (snapshot) => {
          snapshot.event = {
            ...labeledBy("maintainer", "ready-for-agent", {
              updated_at: "2026-09-14T17:01:00Z",
            }),
            action: "unlabeled",
          };
        },
      },
    ].map(({ name, change }) => ({
      name: `${name} replaces the rejection with a plain revision notice`,
      run: () => {
        const snapshot = rejectedCreationSnapshot();
        change(snapshot);
        const decision = decideIssueContract(snapshotFor(snapshot));
        assertDecision(decision, {
          exitCode: 0,
          feedback: 99,
          feedbackBody: /awaiting review/,
        });
        assert.doesNotMatch(
          decision.feedback.body,
          /not authorized|last readiness attempt was rejected|rejectionReason/,
        );
      },
    })),
  ],
);

// An approved direct ticket whose review is event 101 at 17:00:00.
function supersessionSnapshot({
  labels,
  issueEvents,
  event,
  created_at: createdAt,
}) {
  const issue = {
    number: 42,
    body: ticketBody,
    labels: labels.map((name) => ({ name })),
    state: "open",
    ...(createdAt ? { created_at: createdAt } : {}),
  };
  return {
    issue,
    comments: [approvedTicketFeedback(issue)],
    issueEvents,
    permissions: { maintainer: role("admin") },
    event,
  };
}

const supersededBy = (state) => ({
  exitCode: 0,
  remove: ["ready-for-agent"],
  feedback: 13,
  message: new RegExp(`\`${state}\` superseded ready-for-agent`),
  feedbackBody: [
    /awaiting review/i,
    new RegExp(
      `\`${state}\` was applied after the review and supersedes its readiness`,
    ),
  ],
});

decisionTable("workflow states are ordered against the review", [
  ...["wontfix", "needs-info", "needs-triage"].map((state) => ({
    name: `a workflow state applied after a direct contract's review supersedes its readiness: ${state}`,
    snapshot: supersessionSnapshot({
      labels: ["ready-for-agent", state],
      issueEvents: [
        readinessReview,
        {
          id: 102,
          event: "labeled",
          label: { name: state },
          actor: { login: "maintainer" },
          created_at: "2026-09-14T17:05:00Z",
        },
      ],
      event: {
        action: "labeled",
        issue: { number: 42, body: ticketBody },
        label: { name: state },
        sender: { login: "maintainer" },
      },
    }),
    expected: supersededBy(state),
  })),
  {
    name: "a superseding workflow state becomes the only workflow state",
    snapshot: supersessionSnapshot({
      labels: ["needs-triage", "ready-for-agent", "wontfix"],
      issueEvents: [
        {
          id: 100,
          event: "labeled",
          label: { name: "needs-triage" },
          actor: { login: "reporter" },
          created_at: "2026-09-14T16:59:00Z",
        },
        readinessReview,
        {
          id: 102,
          event: "labeled",
          label: { name: "wontfix" },
          actor: { login: "maintainer" },
          created_at: "2026-09-14T17:05:00Z",
        },
      ],
      event: labeledBy("maintainer", "wontfix", {
        body: ticketBody,
        updated_at: "2026-09-14T17:05:00Z",
      }),
    }),
    expected: {
      ...supersededBy("wontfix"),
      remove: ["needs-triage", "ready-for-agent"],
    },
  },
  ...[
    ["with a later payload time", "2026-09-14T17:05:00Z"],
    ["with a payload time in the review's second", "2026-09-14T17:00:00Z"],
    ["without a payload time", undefined],
  ].map(([name, updatedAt]) => ({
    name: `a workflow state labeled after the review survives a lagging event timeline: ${name}`,
    snapshot: supersessionSnapshot({
      labels: ["ready-for-agent", "needs-info"],
      issueEvents: [readinessReview],
      event: labeledBy("maintainer", "needs-info", {
        body: ticketBody,
        updated_at: updatedAt,
      }),
    }),
    expected: supersededBy("needs-info"),
  })),
  ...[
    ["never recorded", []],
    [
      "re-applied after a recorded removal",
      [
        {
          id: 99,
          event: "labeled",
          label: { name: "wontfix" },
          actor: { login: "maintainer" },
          created_at: "2026-09-14T16:00:00Z",
        },
        {
          id: 100,
          event: "unlabeled",
          label: { name: "wontfix" },
          actor: { login: "maintainer" },
          created_at: "2026-09-14T16:30:00Z",
        },
      ],
    ],
  ].map(([name, stateEvents]) => ({
    name: `a workflow state the timeline has not recorded supersedes the review in another event's run: ${name}`,
    snapshot: supersessionSnapshot({
      labels: ["ready-for-agent", "wontfix"],
      issueEvents: [...stateEvents, readinessReview],
      event: { action: "reopened", issue: { number: 42 } },
    }),
    expected: supersededBy("wontfix"),
  })),
  {
    name: "a workflow state applied after a triaged review is not removed by a delayed readiness event",
    snapshot: (() => {
      const brief = {
        id: 12,
        node_id: "COMMENT_12",
        body: completeAgentBrief,
        updated_at: "2026-09-14T16:58:00Z",
        user: { login: "triager" },
      };
      const issue = {
        number: 42,
        body: "Intake context.",
        labels: [
          { name: "enhancement" },
          { name: "ready-for-agent" },
          { name: "wontfix" },
        ],
        state: "open",
      };
      return {
        issue,
        comments: [
          brief,
          {
            id: 13,
            body: feedbackState({
              status: "approved",
              revision: briefRevision(brief),
              label: "ready-for-agent",
              reviewer: "triager",
              kind: "triaged Agent Brief",
            }),
            user: bot,
          },
        ],
        issueEvents: [
          {
            id: 101,
            event: "labeled",
            label: { name: "ready-for-agent" },
            actor: { login: "triager" },
            created_at: "2026-09-14T17:00:00Z",
          },
          {
            id: 102,
            event: "labeled",
            label: { name: "wontfix" },
            actor: { login: "maintainer" },
            created_at: "2026-09-14T17:05:00Z",
          },
        ],
        permissions: { triager: role("triage") },
        event: {
          action: "labeled",
          issue: { number: 42, body: issue.body },
          label: { name: "ready-for-agent" },
          sender: { login: "triager" },
        },
      };
    })(),
    expected: supersededBy("wontfix"),
  },
  ...["needs-info", "ready-for-agent"].map((trigger) => {
    const state = "needs-info";
    return {
      name: `a workflow state recorded after the review in the same second supersedes it: in the run for ${trigger}`,
      snapshot: supersessionSnapshot({
        labels: ["ready-for-agent", state],
        created_at: "2026-09-14T16:00:00Z",
        issueEvents: [
          readinessReview,
          {
            id: 102,
            event: "labeled",
            label: { name: state },
            actor: { login: "maintainer" },
            created_at: "2026-09-14T17:00:00Z",
          },
        ],
        event: labeledBy("maintainer", trigger, {
          body: ticketBody,
          updated_at: "2026-09-14T17:00:00Z",
        }),
      }),
      expected: supersededBy(state),
    };
  }),
  ...["needs-info", "ready-for-agent"].map((trigger) => ({
    name: `a workflow state recorded before the review in the same second is replaced: in the run for ${trigger}`,
    snapshot: supersessionSnapshot({
      labels: ["needs-info", "ready-for-agent"],
      created_at: "2026-09-14T16:00:00Z",
      issueEvents: [
        {
          id: 101,
          event: "labeled",
          label: { name: "needs-info" },
          actor: { login: "maintainer" },
          created_at: "2026-09-14T17:00:00Z",
        },
        {
          id: 102,
          event: "labeled",
          label: { name: "ready-for-agent" },
          actor: { login: "maintainer" },
          created_at: "2026-09-14T17:00:00Z",
        },
      ],
      event: labeledBy("maintainer", trigger, {
        body: ticketBody,
        updated_at: "2026-09-14T17:00:00Z",
      }),
    }),
    expected: {
      exitCode: 0,
      remove: ["needs-info"],
      feedback: 13,
      message: /valid implementation ticket with ready-for-agent bound/i,
    },
  })),
  ...[
    [
      "re-applied in the review's second after a recorded removal",
      [
        {
          id: 99,
          event: "labeled",
          label: { name: "needs-info" },
          actor: { login: "maintainer" },
          created_at: "2026-09-14T17:00:00Z",
        },
        {
          id: 100,
          event: "unlabeled",
          label: { name: "needs-info" },
          actor: { login: "maintainer" },
          created_at: "2026-09-14T17:00:00Z",
        },
      ],
      "2026-09-14T17:00:00Z",
      true,
    ],
    [
      "recorded before the review with a delayed payload in the review's second",
      [
        {
          id: 100,
          event: "labeled",
          label: { name: "needs-info" },
          actor: { login: "maintainer" },
          created_at: "2026-09-14T16:59:59Z",
        },
      ],
      "2026-09-14T17:00:00Z",
      false,
    ],
    [
      "re-applied after an unrecorded removal with a strictly later payload",
      [
        {
          id: 100,
          event: "labeled",
          label: { name: "needs-info" },
          actor: { login: "maintainer" },
          created_at: "2026-09-14T16:00:00Z",
        },
      ],
      "2026-09-14T17:00:04Z",
      true,
    ],
    [
      "recorded before the review without a payload time",
      [
        {
          id: 100,
          event: "labeled",
          label: { name: "needs-info" },
          actor: { login: "maintainer" },
          created_at: "2026-09-14T16:59:59Z",
        },
      ],
      undefined,
      true,
    ],
  ].map(([name, stateEvents, payloadAt, superseded]) => ({
    name: `a triggering workflow state is ordered by its latest recorded change: ${name}`,
    snapshot: supersessionSnapshot({
      labels: ["ready-for-agent", "needs-info"],
      created_at: "2026-09-14T15:00:00Z",
      issueEvents: [...stateEvents, readinessReview],
      event: labeledBy("maintainer", "needs-info", {
        body: ticketBody,
        updated_at: payloadAt,
      }),
    }),
    expected: superseded
      ? supersededBy("needs-info")
      : {
          exitCode: 0,
          remove: ["needs-info"],
          feedback: null,
          message: /valid implementation ticket with ready-for-agent bound/i,
        },
  })),
  {
    name: "removing readiness returns a direct contract to review",
    snapshot: (() => {
      const issue = { number: 42, body: ticketBody, labels: [], state: "open" };
      return {
        issue,
        comments: [approvedTicketFeedback(issue)],
        issueEvents: [readinessReview, readinessRemoved],
        event: {
          action: "unlabeled",
          issue: { number: 42, body: issue.body },
          label: { name: "ready-for-agent" },
          sender: { login: "maintainer" },
        },
      };
    })(),
    expected: {
      exitCode: 0,
      add: ["needs-triage"],
      feedback: 13,
      feedbackBody: /awaiting review/i,
    },
  },
  {
    name: "removing readiness keeps a direct contract's remaining workflow state",
    snapshot: (() => {
      const issue = {
        number: 42,
        body: ticketBody,
        labels: [{ name: "needs-info" }],
        state: "open",
      };
      return {
        issue,
        comments: [approvedTicketFeedback(issue)],
        issueEvents: [
          stateLabeled(50, "needs-info"),
          readinessReview,
          readinessRemoved,
        ],
        event: {
          action: "unlabeled",
          issue: { number: 42, body: issue.body },
          label: { name: "ready-for-agent" },
          sender: { login: "maintainer" },
        },
      };
    })(),
    expected: { exitCode: 0, feedback: 13, feedbackBody: /awaiting review/i },
  },
  {
    name: "removing readiness revokes the recorded approval and returns a triaged request to review",
    snapshot: (() => {
      const brief = {
        id: 12,
        node_id: "COMMENT_12",
        body: completeAgentBrief,
        updated_at: "2026-09-14T17:00:00Z",
        user: { login: "triager" },
      };
      return {
        issue: {
          number: 42,
          body: "Intake context.",
          labels: [{ name: "enhancement" }],
          state: "open",
        },
        comments: [
          brief,
          {
            id: 13,
            body: feedbackState({
              status: "approved",
              revision: briefRevision(brief),
              label: "ready-for-agent",
              reviewer: "triager",
              kind: "triaged Agent Brief",
            }),
            user: bot,
          },
        ],
        issueEvents: [reviewBy("triager"), readinessRemoved],
        event: {
          action: "unlabeled",
          issue: { number: 42, body: "Intake context." },
          label: { name: "ready-for-agent" },
          sender: { login: "maintainer" },
        },
      };
    })(),
    expected: {
      exitCode: 0,
      add: ["needs-triage"],
      feedback: 13,
      feedbackBody: /awaiting review/i,
    },
  },
]);

decisionTable("edits, replacements, and stale events invalidate readiness", [
  {
    name: "stale readiness events cannot approve a newer direct contract revision",
    // The label reviewed the revision whose notice preceded it; the body
    // changed after the label, so only the revision decides.
    snapshot: (() => {
      const reviewed = { number: 42, body: ticketBody };
      const issue = {
        ...reviewed,
        body: ticketBody.replace("Add caching.", "Add the revised cache."),
        labels: [{ name: "ready-for-agent" }],
        state: "open",
        updated_at: "2026-09-14T17:01:00Z",
      };
      return {
        issue,
        comments: [
          {
            ...awaitingTicketFeedback(reviewed),
            updated_at: "2026-09-14T16:59:00Z",
          },
        ],
        bodyLastEditedAt: "2026-09-14T17:01:00Z",
        issueEvents: [readinessReview],
        event: labeledBy("maintainer", "ready-for-agent", {
          body: reviewed.body,
          updated_at: "2026-09-14T17:00:00Z",
        }),
        permissions: { maintainer: role("admin") },
      };
    })(),
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: 13,
      message: /wait for the validator to publish/i,
    },
  },
  {
    name: "a restored direct body cannot make an old label event review the newer edit revision",
    // The label reviewed the unedited revision whose notice preceded it; an
    // edit restored the same bytes after the label, so only the revision
    // decides.
    snapshot: (() => {
      const issue = {
        number: 42,
        body: ticketBody,
        labels: [{ name: "ready-for-agent" }],
        state: "open",
        updated_at: "2026-09-14T17:02:00Z",
      };
      return {
        issue,
        comments: [
          {
            ...awaitingTicketFeedback(issue),
            updated_at: "2026-09-14T16:59:00Z",
          },
        ],
        bodyLastEditedAt: "2026-09-14T17:02:00Z",
        issueEvents: [readinessReview],
        event: labeledBy("maintainer", "ready-for-agent", {
          body: ticketBody,
          updated_at: "2026-09-14T17:00:00Z",
        }),
        permissions: { maintainer: role("admin") },
      };
    })(),
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: 13,
      message: /wait for the validator to publish/i,
    },
  },
  {
    name: "direct body edits invalidate an approval even when the visible bytes are restored",
    snapshot: (() => {
      const issue = {
        number: 42,
        node_id: "ISSUE_42",
        body: ticketBody,
        labels: [{ name: "ready-for-agent" }],
        state: "open",
      };
      return {
        issue,
        comments: [
          approvedTicketFeedback(issue, {
            revision: bodyRevision(issue, "2026-09-14T17:00:00Z"),
          }),
        ],
        bodyLastEditedAt: "2026-09-14T17:02:00Z",
        permissions: { maintainer: role("admin") },
        issueEvents: [readinessReview],
        event: { action: "edited", issue: { number: 42, body: issue.body } },
      };
    })(),
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: 13,
      feedbackBody: /fresh authorized review/i,
    },
  },
  {
    name: "a direct edit after re-review cannot preserve the newer readiness event",
    snapshot: (() => {
      const oldIssue = { number: 42, body: ticketBody };
      const issue = {
        ...oldIssue,
        body: ticketBody.replace("Add caching.", "Add bounded caching."),
        labels: [{ name: "ready-for-agent" }],
        state: "open",
      };
      return {
        issue,
        comments: [
          approvedTicketFeedback(issue, {
            revision: bodyRevision(oldIssue, "2026-09-14T17:00:00Z"),
          }),
        ],
        bodyLastEditedAt: "2026-09-14T17:03:00Z",
        issueEvents: [
          readinessReview,
          {
            id: 102,
            event: "unlabeled",
            label: { name: "ready-for-agent" },
            actor: { login: "maintainer" },
            created_at: "2026-09-14T17:01:00Z",
          },
          {
            id: 103,
            event: "labeled",
            label: { name: "ready-for-agent" },
            actor: { login: "maintainer" },
            created_at: "2026-09-14T17:02:00Z",
          },
        ],
        event: { action: "edited", issue: { number: 42, body: issue.body } },
        permissions: { maintainer: role("admin") },
      };
    })(),
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: 13,
    },
  },
  {
    name: "replacing an Agent Brief invalidates approval even when its text is identical",
    snapshot: (() => {
      const oldBrief = {
        id: 11,
        node_id: "COMMENT_11",
        body: completeAgentBrief,
        updated_at: "2026-09-14T17:00:00Z",
        user: { login: "triager" },
      };
      const newBrief = {
        id: 12,
        node_id: "COMMENT_12",
        body: completeAgentBrief,
        updated_at: "2026-09-14T17:01:00Z",
        user: { login: "triager" },
      };
      return {
        issue: {
          number: 42,
          body: "Intake context.",
          labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
          state: "open",
        },
        comments: [
          newBrief,
          {
            id: 13,
            body: feedbackState({
              status: "approved",
              revision: briefRevision(oldBrief),
              label: "ready-for-agent",
              reviewer: "triager",
            }),
            user: bot,
          },
        ],
        permissions: { triager: role("triage") },
        issueEvents: [reviewBy("triager")],
        event: {
          action: "created",
          issue: { number: 42 },
          comment: { id: 12 },
        },
      };
    })(),
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: 13,
    },
  },
  {
    name: "editing an Agent Brief invalidates approval even when its visible bytes are restored",
    snapshot: (() => {
      const oldBrief = {
        id: 12,
        node_id: "COMMENT_12",
        body: completeAgentBrief,
        updated_at: "2026-09-14T17:00:00Z",
        user: { login: "triager" },
      };
      return {
        issue: {
          number: 42,
          body: "Intake context.",
          labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
          state: "open",
        },
        comments: [
          { ...oldBrief, updated_at: "2026-09-14T17:02:00Z" },
          {
            id: 13,
            body: feedbackState({
              status: "approved",
              revision: briefRevision(oldBrief),
              label: "ready-for-agent",
              reviewer: "triager",
              kind: "triaged Agent Brief",
            }),
            user: bot,
          },
        ],
        permissions: { triager: role("triage") },
        issueEvents: [reviewBy("triager")],
        event: { action: "edited", issue: { number: 42 }, comment: { id: 12 } },
      };
    })(),
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: 13,
    },
  },
  {
    name: "a same-second direct edit requires a revision notice before authorized re-add",
    run() {
      const oldIssue = { number: 42, body: ticketBody };
      const issue = {
        ...oldIssue,
        body: ticketBody.replace("Add caching.", "Add bounded caching."),
        labels: [{ name: "ready-for-agent" }],
        state: "open",
        updated_at: "2026-09-14T17:02:00Z",
      };
      const comments = [
        approvedTicketFeedback(issue, {
          revision: bodyRevision(oldIssue, "2026-09-14T17:00:00Z"),
        }),
      ];
      const issueEvents = [
        readinessReview,
        {
          id: 102,
          event: "unlabeled",
          label: { name: "ready-for-agent" },
          actor: { login: "maintainer" },
          created_at: "2026-09-14T17:01:00Z",
        },
        {
          id: 103,
          event: "labeled",
          label: { name: "ready-for-agent" },
          actor: { login: "second-maintainer" },
          created_at: "2026-09-14T17:02:00Z",
        },
      ];
      const common = {
        issue,
        bodyLastEditedAt: "2026-09-14T17:02:00Z",
        permissions: { "second-maintainer": role("maintain") },
      };

      const delayedRemoval = decideIssueContract(
        snapshotFor({
          ...common,
          comments,
          issueEvents,
          event: {
            action: "unlabeled",
            issue: {
              number: 42,
              body: oldIssue.body,
              updated_at: "2026-09-14T17:01:00Z",
            },
            label: { name: "ready-for-agent" },
            sender: { login: "maintainer" },
          },
        }),
      );
      assertDecision(delayedRemoval, {
        exitCode: 1,
        remove: ["ready-for-agent"],
        add: ["needs-triage"],
        feedback: 13,
        feedbackBody: /"observedEventId":"103"/,
      });
      applyFeedback(comments, delayedRemoval);
      comments[0].updated_at = "2026-09-14T17:02:00Z";

      const freshReview = decideIssueContract(
        snapshotFor({
          ...common,
          comments,
          issueEvents: [
            ...issueEvents,
            {
              id: 104,
              event: "unlabeled",
              label: { name: "ready-for-agent" },
              actor: bot,
              created_at: "2026-09-14T17:02:00Z",
            },
            {
              id: 105,
              event: "labeled",
              label: { name: "ready-for-agent" },
              actor: { login: "second-maintainer" },
              created_at: "2026-09-14T17:03:00Z",
            },
          ],
          event: labeledBy("second-maintainer", "ready-for-agent", {
            body: issue.body,
            updated_at: "2026-09-14T17:02:00Z",
          }),
        }),
      );
      assertDecision(freshReview, {
        exitCode: 0,
        feedback: 13,
        feedbackBody: [
          /"reviewEventId":"105"/,
          /reviewed by @second-maintainer/i,
        ],
      });
    },
  },
  {
    name: "a delayed removal replay cannot revoke a genuinely newer approval",
    snapshot: (() => {
      const issue = {
        number: 42,
        body: ticketBody,
        labels: [{ name: "ready-for-agent" }],
        state: "open",
      };
      return {
        issue,
        comments: [
          approvedTicketFeedback(issue, {
            reviewer: "second-maintainer",
            reviewEventId: "103",
          }),
        ],
        issueEvents: [
          readinessReview,
          {
            id: 102,
            event: "unlabeled",
            label: { name: "ready-for-agent" },
            actor: { login: "maintainer" },
            created_at: "2026-09-14T17:01:00Z",
          },
          {
            id: 103,
            event: "labeled",
            label: { name: "ready-for-agent" },
            actor: { login: "second-maintainer" },
            created_at: "2026-09-14T17:02:00Z",
          },
        ],
        event: {
          action: "unlabeled",
          issue: {
            number: 42,
            body: issue.body,
            updated_at: "2026-09-14T17:01:00Z",
          },
          label: { name: "ready-for-agent" },
          sender: { login: "maintainer" },
        },
        permissions: { "second-maintainer": role("maintain") },
      };
    })(),
    expected: {
      exitCode: 0,
      message: /valid implementation ticket with ready-for-agent bound/i,
    },
  },
]);

// An Agent Brief of issue 42 created at `createdAt` by `triager`.
const agentBrief = (id, createdAt, body = completeAgentBrief) => ({
  id,
  node_id: `COMMENT_${id}`,
  body,
  created_at: createdAt,
  updated_at: createdAt,
  user: { login: "triager" },
});

// A triaged request whose current Brief, comment 20, was approved by event
// 101, seen by the run for deleting `deleted`.
function deletedBriefSnapshot(deleted) {
  const current = agentBrief(20, "2026-09-14T17:00:00Z");
  return {
    issue: {
      number: 42,
      body: "Intake context.",
      labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
      state: "open",
    },
    comments: [
      current,
      {
        id: 30,
        body: feedbackState({
          status: "approved",
          revision: briefRevision(current),
          label: "ready-for-agent",
          reviewer: "triager",
          kind: "triaged Agent Brief",
        }),
        user: bot,
      },
    ],
    issueEvents: [
      {
        id: 101,
        event: "labeled",
        label: { name: "ready-for-agent" },
        actor: { login: "triager" },
        created_at: "2026-09-14T17:10:00Z",
      },
    ],
    event: {
      action: "deleted",
      issue: { number: 42, body: "Intake context." },
      comment: deleted,
    },
    permissions: { triager: role("triage") },
  };
}

// A direct ticket opened at 16:00:00 whose feedback records `barrier` as its
// latest review or observed transition, seen by the run for readiness applied
// at 17:00:00 as `issueEvents` record it.
function openingBarrierSnapshot({
  status,
  barrier,
  issueEvents = [readinessReview],
}) {
  const issue = {
    number: 42,
    node_id: "ISSUE_42",
    body: ticketBody,
    labels: [{ name: "ready-for-agent" }],
    state: "open",
    created_at: "2026-09-14T16:00:00Z",
    updated_at: "2026-09-14T17:00:00Z",
  };
  return {
    issue,
    comments: [
      status === "approved"
        ? approvedTicketFeedback(issue, { reviewEventId: barrier })
        : awaitingTicketFeedback(issue, { observedEventId: barrier }),
    ],
    issueEvents,
    event: labeledBy("maintainer", "ready-for-agent", issue),
    permissions: { maintainer: role("admin") },
  };
}

decisionTable("issue-contract events are ordered by one timeline rule", [
  {
    name: "a readiness label in the revision notice's second is rejected",
    snapshot: (() => {
      const issue = {
        number: 42,
        body: ticketBody,
        labels: [{ name: "ready-for-agent" }],
        state: "open",
        updated_at: "2026-09-14T17:00:00Z",
      };
      return {
        issue,
        comments: [
          {
            ...awaitingTicketFeedback(issue),
            updated_at: "2026-09-14T17:00:00Z",
          },
        ],
        issueEvents: [readinessReview],
        event: labeledBy("maintainer", "ready-for-agent", issue),
        permissions: { maintainer: role("admin") },
      };
    })(),
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: 13,
      message: /wait for the validator to publish/i,
    },
  },
  {
    name: "a readiness label the revision notice already observed cannot approve it",
    snapshot: (() => {
      const issue = {
        number: 42,
        body: ticketBody,
        labels: [{ name: "ready-for-agent" }],
        state: "open",
        updated_at: "2026-09-14T17:00:00Z",
      };
      return {
        issue,
        comments: [awaitingTicketFeedback(issue, { observedEventId: "101" })],
        issueEvents: [readinessReview],
        event: labeledBy("maintainer", "ready-for-agent", issue),
        permissions: { maintainer: role("admin") },
      };
    })(),
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: 13,
      message: /timeline does not contain the current readiness label event/,
    },
  },
  ...["needs-info", "ready-for-agent"].map((trigger) => {
    const state = "needs-info";
    return {
      name: `a workflow state recorded after the review with an earlier timestamp supersedes it: in the run for ${trigger}`,
      snapshot: supersessionSnapshot({
        labels: ["ready-for-agent", state],
        created_at: "2026-09-14T16:00:00Z",
        issueEvents: [
          readinessReview,
          {
            id: 102,
            event: "labeled",
            label: { name: state },
            actor: { login: "maintainer" },
            created_at: "2026-09-14T16:59:59Z",
          },
        ],
        event: labeledBy("maintainer", trigger, {
          body: ticketBody,
          updated_at: "2026-09-14T16:59:59Z",
        }),
      }),
      expected: supersededBy(state),
    };
  }),
  {
    name: "a workflow state recorded after the review with an earlier timestamp supersedes it in another event's run",
    snapshot: supersessionSnapshot({
      labels: ["ready-for-agent", "wontfix"],
      created_at: "2026-09-14T16:00:00Z",
      issueEvents: [
        readinessReview,
        {
          id: 102,
          event: "labeled",
          label: { name: "wontfix" },
          actor: { login: "maintainer" },
          created_at: "2026-09-14T16:59:59Z",
        },
      ],
      event: { action: "reopened", issue: { number: 42 } },
    }),
    expected: supersededBy("wontfix"),
  },
  {
    name: "the newest Agent Brief is the highest comment ID, even when a lower ID was created later",
    snapshot: {
      issue: {
        number: 42,
        body: "Intake context.",
        labels: [{ name: "enhancement" }, { name: "needs-triage" }],
        state: "open",
      },
      comments: [
        agentBrief(20, "2026-09-14T17:00:00Z"),
        agentBrief(
          12,
          "2026-09-14T17:05:00Z",
          completeAgentBrief.replace(
            "**Summary:** Make search fast",
            "**Summary:** _No response_",
          ),
        ),
      ],
    },
    expected: {
      exitCode: 0,
      feedback: "create",
      message: /valid triaged Agent Brief/i,
    },
  },
  ...["awaiting-review", "approved"].flatMap((status) => [
    {
      name: `a readiness event follows this issue's own opening barrier: ${status}`,
      snapshot: openingBarrierSnapshot({ status, barrier: ownOpening }),
      expected: {
        exitCode: 0,
        feedback: 13,
        message: /valid implementation ticket with ready-for-agent bound/i,
        feedbackBody: /"reviewEventId":"101"/,
      },
    },
    {
      name: `another issue's opening barrier is not followed by a readiness event: ${status}`,
      snapshot: openingBarrierSnapshot({ status, barrier: otherOpening }),
      expected: {
        exitCode: 1,
        remove: ["ready-for-agent"],
        add: ["needs-triage"],
        feedback: 13,
        message:
          status === "awaiting-review"
            ? /timeline does not contain the current readiness label event/
            : /wait for the validator to publish/i,
      },
    },
  ]),
  {
    name: "a readiness label event missing from the timeline does not follow the opening barrier",
    snapshot: openingBarrierSnapshot({
      status: "awaiting-review",
      barrier: ownOpening,
      issueEvents: [],
    }),
    expected: {
      exitCode: 1,
      remove: ["ready-for-agent"],
      add: ["needs-triage"],
      feedback: 13,
      message: /timeline does not contain the current readiness label event/i,
    },
  },
]);

decisionTable(
  "deleting an Agent Brief invalidates readiness only when it was the newest Brief",
  [
    {
      name: "a repeated Brief deletion cannot revoke the restored source after fresh review",
      snapshot: (() => {
        const brief = {
          id: 12,
          node_id: "COMMENT_12",
          body: completeAgentBrief,
          created_at: "2026-09-14T17:00:00Z",
          updated_at: "2026-09-14T17:00:00Z",
          user: { login: "triager" },
        };
        return {
          issue: {
            number: 42,
            body: "Intake context.",
            labels: [{ name: "enhancement" }, { name: "ready-for-agent" }],
            state: "open",
          },
          comments: [
            brief,
            {
              id: 13,
              body: feedbackState({
                status: "approved",
                revision: briefRevision(brief),
                label: "ready-for-agent",
                reviewer: "triager",
                reviewEventId: "103",
                sourceInvalidation: "deleted-comment:COMMENT_14",
                kind: "triaged Agent Brief",
              }),
              user: bot,
            },
          ],
          issueEvents: [
            {
              id: 101,
              event: "labeled",
              label: { name: "ready-for-agent" },
              actor: { login: "triager" },
              created_at: "2026-09-14T17:01:00Z",
            },
            {
              id: 102,
              event: "unlabeled",
              label: { name: "ready-for-agent" },
              actor: bot,
              created_at: "2026-09-14T17:02:00Z",
            },
            {
              id: 103,
              event: "labeled",
              label: { name: "ready-for-agent" },
              actor: { login: "triager" },
              created_at: "2026-09-14T17:03:00Z",
            },
          ],
          event: {
            action: "deleted",
            issue: { number: 42, body: "Intake context." },
            comment: {
              id: 14,
              node_id: "COMMENT_14",
              body: completeAgentBrief,
              created_at: "2026-09-14T17:02:00Z",
            },
          },
          permissions: { triager: role("triage") },
        };
      })(),
      expected: {
        exitCode: 0,
        message: /valid triaged Agent Brief with ready-for-agent bound/i,
      },
    },
    {
      name: "deleting a Brief with a lower comment ID keeps the newest Brief's approval, even when it was created later",
      snapshot: deletedBriefSnapshot(agentBrief(12, "2026-09-14T17:05:00Z")),
      expected: {
        exitCode: 0,
        message: /valid triaged Agent Brief with ready-for-agent bound/i,
      },
    },
    {
      name: "deleting a Brief with a higher comment ID invalidates the restored source, even when it was created earlier",
      snapshot: deletedBriefSnapshot(agentBrief(25, "2026-09-14T16:55:00Z")),
      expected: {
        exitCode: 1,
        remove: ["ready-for-agent"],
        add: ["needs-triage"],
        feedback: 30,
        feedbackBody: /"sourceInvalidation":"deleted-comment:COMMENT_25"/,
      },
    },
  ],
);
