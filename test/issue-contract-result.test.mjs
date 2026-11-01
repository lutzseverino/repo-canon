// The issue-contract validator's published result: its format, its write on
// every evaluated event, and the rules that decide whether readiness holds.
// The shared examples run the validator's adapter and the `triage` readiness
// command on one issue, so both interpret the result the same way.
import assert from "node:assert/strict";
import test from "node:test";
import {
  decideIssueContract,
  issueContractResult,
  resultFormat,
} from "../scripts/validate-issue-contract.mjs";
import { main as ready } from "../.agents/skills/triage/ready.mjs";
import { contractWorld } from "./helpers/contract-world.mjs";
import {
  bodyRevision,
  bot,
  briefRevision,
  completeAgentBrief,
  featureBody,
  feedbackState,
  neutralEvent,
  publishedState,
  recordedState,
  repository,
  role,
  ticketBody,
} from "./helpers/issue-contracts.mjs";

const briefAt = "2026-09-14T16:58:00Z";
const noticeAt = "2026-09-14T16:59:00Z";
const reviewAt = "2026-09-14T17:00:00Z";
const brief = {
  id: 12,
  node_id: "COMMENT_12",
  body: completeAgentBrief,
  updated_at: briefAt,
  user: { login: "triager" },
};
const reviewOf = (
  label = "ready-for-agent",
  login = "maintainer",
  id = 101,
) => ({
  id,
  event: "labeled",
  label: { name: label },
  actor: { login },
  created_at: reviewAt,
});
const commentEvent = (action, comment = { id: 30, body: "Discussion." }) => ({
  action,
  issue: { number: 42 },
  comment,
  sender: { login: "reporter" },
});
const otherComment = {
  id: 30,
  node_id: "COMMENT_30",
  body: "Discussion.",
  updated_at: noticeAt,
  user: { login: "reporter" },
};

// The feedback comment recording `state` for a contract of `kind`.
const notice = (state, kind = "triaged Agent Brief") => ({
  id: 13,
  body: feedbackState({ kind, ...state }),
  user: bot,
  updated_at: noticeAt,
});

/** @param {Record<string, any>} options */
function snapshot({
  body = "Intake context.",
  labels = ["enhancement", "ready-for-agent"],
  comments,
  event = commentEvent("created"),
  issueEvents = [reviewOf()],
  permissions = { maintainer: role("admin") },
  bodyLastEditedAt = null,
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
      user: { login: "reporter" },
      created_at: "2026-09-14T15:00:00Z",
    },
    comments,
    blockedBy: [],
    parent: null,
    bodyRevision: { id: "ISSUE_42", lastEditedAt: bodyLastEditedAt },
    issueEvents,
    permissions,
  };
}

const approvedBrief = (target = brief, label = "ready-for-agent") =>
  notice({
    status: "approved",
    revision: briefRevision(target),
    label,
    reviewer: "maintainer",
    reviewEventId: "101",
  });
const approvedTicket = (issue = { body: ticketBody }) =>
  notice(
    {
      status: "approved",
      revision: bodyRevision({ node_id: "ISSUE_42", ...issue }),
      label: "ready-for-agent",
      reviewer: "maintainer",
      reviewEventId: "101",
    },
    "implementation ticket",
  );
// An approved triaged request, decided from `event` with `changes` applied.
const briefSnapshot = (changes = {}) =>
  snapshot({ comments: [brief, approvedBrief(), otherComment], ...changes });
const ticketSnapshot = (changes = {}) =>
  snapshot({
    body: ticketBody,
    labels: ["ready-for-agent"],
    comments: [approvedTicket()],
    ...changes,
  });

const evaluated = (kind, actor = "reporter", fields = {}) => ({
  kind,
  actor,
  label: null,
  commentId: null,
  ...fields,
});

test("the result line carries the published format with every field", () => {
  const decision = decideIssueContract(briefSnapshot());
  assert.equal(resultFormat, "repo-canon/issue-contract-state/v1");
  assert.equal(decision.feedback.commentId, 13);
  assert.deepEqual(publishedState(decision.feedback.body), {
    format: resultFormat,
    status: "approved",
    kind: "triaged Agent Brief",
    revision: briefRevision(brief),
    source: { type: "comment", id: "12", editedAt: briefAt },
    label: "ready-for-agent",
    reviewer: "maintainer",
    reviewEventId: "101",
    event: evaluated("commentCreated", "reporter", { commentId: "30" }),
    evaluatedAt: null,
    observedEventId: "101",
    sourceInvalidation: null,
    publishedAt: noticeAt,
    rejectionReason: null,
    rejectedCreationLabel: null,
  });
  assert.deepEqual(issueContractResult([]), {
    comment: null,
    state: null,
  });
});

test("the validator posts a current result on each evaluated event, even when its decision is unchanged", async (t) => {
  for (const [name, event, recorded] of /** @type {[string, any, any][]} */ ([
    [
      "issue edit",
      {
        action: "edited",
        issue: { number: 42 },
        sender: { login: "reporter" },
      },
      evaluated("edited"),
    ],
    [
      "reopening",
      {
        action: "reopened",
        issue: { number: 42 },
        sender: { login: "reporter" },
      },
      evaluated("reopened"),
    ],
    [
      "unrelated label",
      {
        action: "labeled",
        issue: { number: 42 },
        label: { name: "documentation" },
        sender: { login: "maintainer" },
      },
      evaluated("labeled", "maintainer", { label: "documentation" }),
    ],
    [
      "label removal",
      {
        action: "unlabeled",
        issue: { number: 42 },
        label: { name: "needs-info" },
        sender: { login: "maintainer" },
      },
      evaluated("unlabeled", "maintainer", { label: "needs-info" }),
    ],
    [
      "comment",
      commentEvent("created"),
      evaluated("commentCreated", "reporter", { commentId: "30" }),
    ],
    [
      "comment edit",
      commentEvent("edited"),
      evaluated("commentEdited", "reporter", { commentId: "30" }),
    ],
    [
      "comment deletion",
      commentEvent("deleted", { id: 31, body: "Removed discussion." }),
      evaluated("commentDeleted", "reporter", { commentId: "31" }),
    ],
  ])) {
    await t.test(name, () => {
      const first = decideIssueContract(briefSnapshot({ event }));
      assert.deepEqual(first.removeLabels, []);
      assert.deepEqual(first.addLabels, []);
      assert.equal(first.feedback.commentId, 13);
      const state = publishedState(first.feedback.body);
      assert.equal(state.status, "approved");
      assert.deepEqual(state.event, recorded);
      // The same event decided again, on the state the first write produced,
      // still writes the result.
      const again = decideIssueContract(
        briefSnapshot({
          event,
          comments: [
            brief,
            { ...approvedBrief(), body: first.feedback.body },
            otherComment,
          ],
        }),
      );
      assert.deepEqual(again.feedback, first.feedback);
    });
  }
});

test("an issue that has had a result keeps a current one when it carries no contract", () => {
  const decision = decideIssueContract(
    snapshot({
      labels: ["enhancement", "wontfix"],
      comments: [brief, approvedBrief()],
      issueEvents: [],
    }),
  );
  assert.equal(decision.feedback.commentId, 13);
  assert.deepEqual(recordedState(decision.feedback.body), {
    status: "no-contract",
    revision: null,
    label: null,
    reviewer: null,
    observedEventId: null,
    sourceInvalidation: null,
  });
  assert.match(decision.feedback.body, /## Issue contract not required/);
  // An intake form that never had a result gets none.
  const intake = decideIssueContract(
    snapshot({
      body: featureBody,
      labels: ["enhancement"],
      comments: [],
      issueEvents: [],
    }),
  );
  assert.equal(intake.feedback, null);
});

const kept = (decision) => {
  assert.equal(decision.exitCode, 0, decision.message);
  assert.deepEqual(decision.removeLabels, []);
  assert.equal(publishedState(decision.feedback.body).status, "approved");
};
const cancelled = (decision, status = "awaiting-review") => {
  assert.equal(decision.exitCode, 1, decision.message);
  assert.deepEqual(decision.removeLabels, ["ready-for-agent"]);
  assert.deepEqual(decision.addLabels, ["needs-triage"]);
  const state = publishedState(decision.feedback.body);
  assert.equal(state.status, status);
  assert.equal(state.label, null);
  assert.equal(state.reviewEventId, null);
  return state;
};

test("only an edit to the implementation contract cancels readiness", async (t) => {
  await t.test(
    "editing a triaged request's issue body keeps its readiness",
    () =>
      kept(
        decideIssueContract(
          briefSnapshot({
            body: "Revised intake context.",
            bodyLastEditedAt: "2026-09-14T17:05:00Z",
            event: {
              action: "edited",
              issue: { number: 42 },
              changes: { body: { from: "Intake context." } },
              sender: { login: "reporter" },
            },
          }),
        ),
      ),
  );
  await t.test("editing another comment keeps its readiness", () =>
    kept(
      decideIssueContract(
        briefSnapshot({
          comments: [
            brief,
            approvedBrief(),
            {
              ...otherComment,
              body: "Edited.",
              updated_at: "2026-09-14T17:05:00Z",
            },
          ],
          event: commentEvent("edited"),
        }),
      ),
    ),
  );
  await t.test("editing the latest Agent Brief cancels its readiness", () => {
    const edited = {
      ...brief,
      body: `${brief.body} and indexing`,
      updated_at: "2026-09-14T17:05:00Z",
    };
    const state = cancelled(
      decideIssueContract(
        briefSnapshot({
          comments: [edited, approvedBrief()],
          event: commentEvent("edited", edited),
        }),
      ),
    );
    assert.equal(state.revision, briefRevision(edited));
    assert.deepEqual(state.source, {
      type: "comment",
      id: "12",
      editedAt: "2026-09-14T17:05:00Z",
    });
  });
  await t.test("editing a direct ticket's body cancels its readiness", () => {
    const body = ticketBody.replace("Add caching.", "Add indexing.");
    const state = cancelled(
      decideIssueContract(
        ticketSnapshot({
          body,
          bodyLastEditedAt: "2026-09-14T17:05:00Z",
          event: { action: "edited", issue: { number: 42 } },
        }),
      ),
    );
    assert.equal(
      state.revision,
      bodyRevision({ node_id: "ISSUE_42", body }, "2026-09-14T17:05:00Z"),
    );
    assert.deepEqual(state.source, {
      type: "issue-body",
      editedAt: "2026-09-14T17:05:00Z",
    });
  });
  await t.test(
    "an Agent Brief on an uncategorized direct ticket leaves its body the contract",
    () => {
      const decision = decideIssueContract(
        ticketSnapshot({
          comments: [brief, approvedTicket()],
          event: commentEvent("created", brief),
        }),
      );
      kept(decision);
      assert.deepEqual(publishedState(decision.feedback.body).source, {
        type: "issue-body",
        editedAt: null,
      });
    },
  );
});

test("only current category labels count", async (t) => {
  await t.test(
    "removing a triaged request's category cancels readiness, and the result approves nothing",
    () => {
      const decision = decideIssueContract(
        briefSnapshot({
          labels: ["ready-for-agent"],
          issueEvents: [
            { ...reviewOf("enhancement"), id: 90 },
            reviewOf(),
            {
              ...reviewOf("enhancement"),
              id: 102,
              event: "unlabeled",
              created_at: "2026-09-14T17:05:00Z",
            },
          ],
          event: {
            action: "unlabeled",
            issue: { number: 42 },
            label: { name: "enhancement" },
            sender: { login: "maintainer" },
          },
        }),
      );
      const state = cancelled(decision, "needs-attention");
      assert.equal(state.revision, null);
      assert.equal(state.reviewer, null);
      assert.deepEqual(
        state.event,
        evaluated("unlabeled", "maintainer", { label: "enhancement" }),
      );
    },
  );
  await t.test(
    "a direct ticket whose category was removed needs no Agent Brief",
    () => {
      const decision = decideIssueContract(
        ticketSnapshot({
          issueEvents: [
            { ...reviewOf("enhancement"), id: 90, created_at: briefAt },
            {
              ...reviewOf("enhancement"),
              id: 91,
              event: "unlabeled",
              created_at: briefAt,
            },
            reviewOf(),
          ],
        }),
      );
      kept(decision);
      assert.equal(
        publishedState(decision.feedback.body).kind,
        "implementation ticket",
      );
    },
  );
});

test("readiness binds to one revision of one Agent Brief", async (t) => {
  const newer = {
    ...brief,
    id: 40,
    node_id: "COMMENT_40",
    updated_at: "2026-09-14T17:05:00Z",
  };
  await t.test("posting a newer Agent Brief cancels readiness", () => {
    const state = cancelled(
      decideIssueContract(
        briefSnapshot({
          comments: [brief, approvedBrief(), newer],
          event: commentEvent("created", newer),
        }),
      ),
    );
    assert.equal(state.revision, briefRevision(newer));
    assert.equal(state.source.id, "40");
  });
  await t.test(
    "deleting the approved Agent Brief cancels readiness, though an older one remains",
    () => {
      const state = cancelled(
        decideIssueContract(
          briefSnapshot({
            comments: [brief, approvedBrief(newer)],
            event: commentEvent("deleted", { id: 40, body: newer.body }),
          }),
        ),
      );
      assert.equal(state.revision, briefRevision(brief));
      assert.equal(state.source.id, "12");
    },
  );
  await t.test("deleting the only Agent Brief cancels readiness", () => {
    cancelled(
      decideIssueContract(
        briefSnapshot({
          comments: [approvedBrief()],
          event: commentEvent("deleted", { id: 12, body: brief.body }),
        }),
      ),
      "needs-attention",
    );
  });
  await t.test(
    "deleting an older, superseded Agent Brief keeps readiness",
    () => {
      kept(
        decideIssueContract(
          briefSnapshot({
            comments: [approvedBrief(newer), newer],
            event: commentEvent("deleted", { id: 12, body: brief.body }),
          }),
        ),
      );
    },
  );
});

test("the authorized roles are the rules' admin, maintain and triage roles", async (t) => {
  const awaiting = notice({
    status: "awaiting-review",
    revision: briefRevision(brief),
  });
  for (const [
    login,
    permission,
    authorized,
  ] of /** @type {[string, { role: string | null }, boolean][]} */ ([
    ["maintainer", role("admin"), true],
    ["maintainer", role("maintain"), true],
    ["maintainer", role("triage"), true],
    ["maintainer", role("write"), false],
    ["maintainer", role("read"), false],
    ["maintainer", role(null), false],
    ["helper[bot]", role(null), false],
    ["helper[bot]", role("write"), false],
  ])) {
    await t.test(`${login} with ${permission.role ?? "no"} role`, () => {
      const decision = decideIssueContract(
        snapshot({
          comments: [brief, awaiting],
          issueEvents: [reviewOf("ready-for-agent", login)],
          permissions: { [login]: permission },
          event: {
            action: "labeled",
            issue: { number: 42 },
            label: { name: "ready-for-agent" },
            sender: { login },
          },
        }),
      );
      if (authorized) kept(decision);
      else {
        const state = cancelled(decision);
        assert.match(state.rejectionReason, /is not authorized/);
      }
    });
  }
});

test("the result names the readiness label it approves", () => {
  for (const label of ["ready-for-agent", "ready-for-human"]) {
    const decision = decideIssueContract(
      briefSnapshot({
        labels: ["enhancement", label],
        comments: [brief, approvedBrief(brief, label)],
        issueEvents: [reviewOf(label)],
      }),
    );
    assert.deepEqual(decision.removeLabels, []);
    const state = publishedState(decision.feedback.body);
    assert.equal(state.label, label);
    assert.equal(state.reviewEventId, "101");
  }
});

test("results of an unknown format, or by another account, are not the validator's", () => {
  const unknown = {
    ...approvedBrief(),
    body: approvedBrief().body.replace(
      "{",
      `{"format":"repo-canon/issue-contract-state/v2",`,
    ),
  };
  assert.equal(issueContractResult([unknown]).state, null);
  const forged = { ...approvedBrief(), id: 50, user: { login: "mallory" } };
  assert.equal(issueContractResult([forged]).comment, null);
  // An unreadable recorded approval keeps no readiness.
  const decision = decideIssueContract(
    briefSnapshot({ comments: [brief, unknown] }),
  );
  cancelled(decision);
});

// Shared examples: the validator's adapter and the readiness command on one
// issue. The reviewer is a repository admin on a standard destination.
const stateOf = (world) =>
  issueContractResult(
    world.comments.map((comment) => ({
      ...comment,
      author: { login: comment.author },
    })),
  ).state;

async function readiness(world, revision, login = "maintainer") {
  try {
    const code = await ready(
      ["42", "ready-for-agent", revision],
      world.connectionAs(login),
      world.pause,
      world.now,
    );
    return { code };
  } catch (error) {
    return { error };
  }
}

async function briefed(world, text = completeAgentBrief, author = "triager") {
  const comment = world.comment(text, author);
  await world.deliver();
  world.wait();
  return comment;
}

const silenced = async (t, run) => {
  t.mock.method(console, "log", () => {});
  await run();
};

test("shared examples: the validator and the readiness command agree", async (t) => {
  await t.test(
    "the reviewed revision is approved for the command's label event",
    (t) =>
      silenced(t, async () => {
        const world = contractWorld();
        await briefed(world);
        const { revision } = stateOf(world);
        assert.deepEqual(await readiness(world, revision), { code: 0 });
        const state = stateOf(world);
        assert.equal(state.status, "approved");
        assert.equal(state.revision, revision);
        assert.equal(state.reviewer, "maintainer");
        assert.equal(state.reviewEventId, String(world.events.at(-2).id));
        assert.deepEqual(world.issue.labels, [
          "enhancement",
          "ready-for-agent",
        ]);
      }),
  );

  await t.test(
    "repeated events of one kind each write a result with new bytes",
    (t) =>
      silenced(t, async () => {
        const world = contractWorld();
        await briefed(world);
        const discussion = world.comment("Discussion.", "reporter");
        const bodies = [];
        for (let edit = 0; edit < 2; edit += 1) {
          world.editComment(discussion, "Same edit.", "reporter");
          await world.deliver();
          world.wait();
          bodies.push(
            world.comments.find(
              ({ author }) => author === "github-actions[bot]",
            ).body,
          );
        }
        assert.notEqual(bodies[0], bodies[1]);
        const states = bodies.map((body) => publishedState(body));
        assert.deepEqual(states[0].event, states[1].event);
        assert.ok(states[0].evaluatedAt < states[1].evaluatedAt);
      }),
  );

  await t.test("an edited Brief", (t) =>
    silenced(t, async () => {
      const world = contractWorld();
      const comment = await briefed(world);
      const reviewed = stateOf(world).revision;
      world.editComment(
        comment,
        `${completeAgentBrief} and indexing`,
        "triager",
      );
      await world.deliver();
      world.wait();
      const edited = stateOf(world).revision;
      assert.notEqual(edited, reviewed);
      const stale = await readiness(world, reviewed);
      assert.match(stale.error.message, /reviewed revision differs/);
      assert.equal(world.issue.labels.includes("ready-for-agent"), false);
      assert.deepEqual(await readiness(world, edited), { code: 0 });
      // An edit after approval cancels it, and the command refuses the old
      // revision.
      world.editComment(comment, `${completeAgentBrief} and paging`, "triager");
      assert.deepEqual(await world.deliver(), [1]);
      assert.equal(world.issue.labels.includes("ready-for-agent"), false);
      assert.equal(stateOf(world).status, "awaiting-review");
      world.wait();
      assert.match(
        (await readiness(world, edited)).error.message,
        /reviewed revision differs/,
      );
    }),
  );

  await t.test("a newer Brief", (t) =>
    silenced(t, async () => {
      const world = contractWorld();
      await briefed(world);
      const first = stateOf(world).revision;
      assert.deepEqual(await readiness(world, first), { code: 0 });
      const newer = await briefed(world, `${completeAgentBrief} and indexing`);
      const state = stateOf(world);
      assert.equal(state.status, "awaiting-review");
      assert.equal(state.source.id, String(newer.id));
      assert.equal(world.issue.labels.includes("ready-for-agent"), false);
      assert.match(
        (await readiness(world, first)).error.message,
        /reviewed revision differs/,
      );
      assert.deepEqual(await readiness(world, state.revision), { code: 0 });
    }),
  );

  await t.test("a deleted Brief", (t) =>
    silenced(t, async () => {
      const world = contractWorld();
      await briefed(world);
      const older = stateOf(world).revision;
      const newer = await briefed(world, `${completeAgentBrief} and indexing`);
      const newest = stateOf(world).revision;
      assert.deepEqual(await readiness(world, newest), { code: 0 });
      world.deleteComment(newer, "triager");
      assert.deepEqual(await world.deliver(), [1]);
      world.wait();
      const restored = stateOf(world);
      assert.equal(restored.revision, older);
      assert.equal(
        restored.sourceInvalidation,
        `deleted-comment:COMMENT_${newer.id}`,
      );
      assert.equal(world.issue.labels.includes("ready-for-agent"), false);
      assert.match(
        (await readiness(world, newest)).error.message,
        /reviewed revision differs/,
      );
      assert.deepEqual(await readiness(world, older), { code: 0 });
      // Deleting the only Brief leaves an incomplete contract.
      const only = contractWorld();
      const comment = await briefed(only);
      const revision = stateOf(only).revision;
      only.deleteComment(comment, "triager");
      await only.deliver();
      only.wait();
      assert.equal(stateOf(only).status, "needs-attention");
      assert.match(
        (await readiness(only, revision)).error.message,
        /Incomplete contract/,
      );
    }),
  );

  await t.test("bot authors", (t) =>
    silenced(t, async () => {
      // A Brief a bot posted is the contract.
      const world = contractWorld();
      const comment = await briefed(
        world,
        completeAgentBrief,
        "triage-agent[bot]",
      );
      const state = stateOf(world);
      assert.equal(state.source.id, String(comment.id));
      // A result posted by any other account, bot or person, is ignored.
      for (const forger of ["mallory", "other-app[bot]"])
        world.comment(
          `<!-- repo-canon:issue-contract-feedback -->\n<!-- repo-canon:issue-contract-state ${JSON.stringify({ ...state, revision: `sha256:${"f".repeat(64)}` })} -->\n## Issue contract awaiting review`,
          forger,
        );
      await world.deliver();
      world.wait();
      assert.equal(stateOf(world).revision, state.revision);
      assert.deepEqual(await readiness(world, state.revision), { code: 0 });
      // A bot reviewer without a repository role is rejected by both.
      const unauthorized = contractWorld();
      await briefed(unauthorized);
      const result = await readiness(
        unauthorized,
        stateOf(unauthorized).revision,
        "helper[bot]",
      );
      assert.match(result.error.message, /helper\[bot\] is not authorized/);
      assert.equal(
        unauthorized.issue.labels.includes("ready-for-agent"),
        false,
      );
    }),
  );

  await t.test("simultaneous events", async (t) => {
    await t.test(
      "readiness in the notice's second is rejected, and the command waits past it",
      (t) =>
        silenced(t, async () => {
          const world = contractWorld();
          world.comment(completeAgentBrief, "triager");
          await world.together(async () => {
            await world.deliver();
            world.label("ready-for-agent", "maintainer");
          });
          assert.deepEqual(await world.deliver(), [1]);
          const state = stateOf(world);
          assert.match(
            state.rejectionReason,
            /Wait for the validator to publish/,
          );
          assert.deepEqual(await readiness(world, state.revision), { code: 0 });
        }),
    );
    await t.test(
      "a Brief edited in the readiness label's second cancels it for both",
      (t) =>
        silenced(t, async () => {
          const world = contractWorld();
          const comment = await briefed(world);
          const reviewed = stateOf(world).revision;
          world.beforeDeliver = () =>
            world.editComment(
              comment,
              `${completeAgentBrief} and indexing`,
              "triager",
              world.events.at(-1).at,
            );
          const result = await readiness(world, reviewed);
          assert.match(result.error.message, /reviewed revision differs/);
          assert.equal(world.issue.labels.includes("ready-for-agent"), false);
          assert.notEqual(stateOf(world).revision, reviewed);
        }),
    );
    for (const order of ["label first", "comment first"]) {
      await t.test(
        `a comment in the readiness label's second, delivered ${order}`,
        (t) =>
          silenced(t, async () => {
            const world = contractWorld();
            await briefed(world);
            const { revision } = stateOf(world);
            world.beforeDeliver = () => {
              world.comment("Looks good.", "reporter", world.events.at(-1).at);
              if (order === "comment first") world.pending.reverse();
            };
            assert.deepEqual(await readiness(world, revision), { code: 0 });
            const state = stateOf(world);
            assert.equal(state.status, "approved");
            assert.equal(state.reviewEventId, String(world.events.at(-2).id));
          }),
      );
    }
  });
});
