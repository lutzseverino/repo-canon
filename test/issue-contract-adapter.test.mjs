import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { githubValidation } from "../.github/scripts/validate.mjs";
import {
  decideIssueContract,
  runIssueContractValidation,
} from "../scripts/validate-issue-contract.mjs";
import {
  connect,
  PlatformError,
  platformErrorReasons,
} from "../vendor/postern/postern.mjs";
import { main as merge } from "../.agents/skills/babysit/merge.mjs";
import { installedValidator } from "./helpers/installed-validator.mjs";
import {
  approvedTicketFeedback,
  bugBody,
  ticketBody,
  completeAgentBrief,
  awaitingTicketFeedback,
  bodyRevision,
  briefRevision,
  feedbackState,
  recordedState,
  readinessReview,
  repository,
} from "./helpers/issue-contracts.mjs";

const time = "2026-09-14T16:00:00Z";
const page = (nodes) => ({
  nodes,
  pageInfo: { hasNextPage: false, endCursor: null },
});
const account = (login = "reporter") => ({ login, type: "User" });

/**
 * @param {any} t
 * @param {Record<string, any>} [options]
 */
async function exercise(
  t,
  {
    issue = {},
    event = {},
    comments = [],
    events = [],
    permissions = {},
    parent = null,
    blockedBy = [],
    failure = null,
    trigger,
    command,
    eventReads,
    pause,
    failurePath,
    bodyLastEditedAt = null,
  } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "postern-issue-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const eventPath = join(root, "event.json");
  const current = {
    number: 42,
    body: bugBody,
    labels: [{ name: "bug" }, { name: "needs-triage" }],
    state: "open",
    ...issue,
  };
  const payload = {
    action: "edited",
    changes: {},
    repository: { full_name: repository },
    sender: account(),
    issue: {
      ...current,
      labels: current.labels.map((label) =>
        typeof label === "string" ? { name: label } : label,
      ),
    },
    ...event,
  };
  await writeFile(eventPath, JSON.stringify(payload));
  const requests = [];
  let timelineRead = 0;
  const comment = (value, index = 0) => ({
    id: index + 1,
    node_id: `COMMENT_${index + 1}`,
    html_url: `https://github.com/${repository}/issues/42#issuecomment-${index + 1}`,
    created_at: time,
    updated_at: time,
    ...value,
    user: value.user ? { type: "User", ...value.user } : null,
  });
  const fetch = async (input, options = {}) => {
    const url = new URL(input);
    const path = url.pathname;
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({
      method: options.method ?? "GET",
      path,
      query: url.search,
      body,
    });
    const json = (value, status = 200, headers = {}) =>
      new Response(JSON.stringify(value), {
        status,
        headers: { "content-type": "application/json", ...headers },
      });
    if (failure && (!failurePath || failurePath(path, body)))
      return json({ message: `Read failed fixture-credential` }, failure);
    if (path === "/graphql") {
      const number = body.variables.number;
      const source = number === 42 ? current : parent;
      const ref = (value) => ({
        number: value.number,
        state: (value.state ?? "open").toUpperCase(),
        repository: { nameWithOwner: repository },
      });
      return json({
        data: {
          repository: {
            issue: source
              ? {
                  number,
                  fullDatabaseId: String(source.id ?? number),
                  id: source.node_id ?? `ISSUE_${number}`,
                  url: `https://github.com/${repository}/issues/${number}`,
                  state: (source.state ?? "open").toUpperCase(),
                  title: "Fixture issue",
                  body: source.body ?? "",
                  createdAt: source.created_at ?? time,
                  lastEditedAt: source.lastEditedAt ?? bodyLastEditedAt,
                  author: {
                    __typename: "User",
                    login: source.user?.login ?? "reporter",
                  },
                  labels: page(
                    (source.labels ?? []).map((label) =>
                      typeof label === "string" ? { name: label } : label,
                    ),
                  ),
                  parent: number === 42 && parent ? ref(parent) : null,
                  subIssues: page([]),
                  blockedBy: page(number === 42 ? blockedBy.map(ref) : []),
                  timelineItems: { nodes: [] },
                }
              : null,
          },
        },
      });
    }
    if (path.endsWith("/events")) {
      const currentEvents = eventReads
        ? eventReads[Math.min(timelineRead++, eventReads.length - 1)]
        : events;
      return json(
        currentEvents.map((entry) => ({
          ...entry,
          actor: entry.actor ? { type: "User", ...entry.actor } : null,
        })),
      );
    }
    if (path.endsWith("/permission")) {
      const login = decodeURIComponent(path.split("/").at(-2));
      return permissions[login]
        ? json({
            permission: permissions[login],
            role_name: permissions[login],
          })
        : json({ permission: "none" });
    }
    if (path.endsWith("/comments") && (options.method ?? "GET") === "GET") {
      const offset = Number(url.searchParams.get("page") ?? 1) - 1;
      const pages = Array.isArray(comments[0]) ? comments : [comments];
      const next = new URL(url);
      next.searchParams.set("page", String(offset + 2));
      return json(
        (pages[offset] ?? []).map(comment),
        200,
        offset + 1 < pages.length ? { link: `<${next}>; rel="next"` } : {},
      );
    }
    if (path.includes("/comments"))
      return json(
        comment({
          id: 99,
          body: body.body,
          user: account("github-actions[bot]"),
        }),
        201,
      );
    return json({});
  };
  let code;
  let error;
  let stdout = "";
  let stderr = "";
  const log = t.mock.method(console, "log", (message) => {
    stdout += `${message}\n`;
  });
  const warn = t.mock.method(console, "error", (message) => {
    stderr += `${message}\n`;
  });
  try {
    if (pause || command) {
      const connection = connect(`https://github.com/${repository}`, {
        credential: "fixture-credential",
        fetch,
        relationshipSections: { parent: "Parent", blockedBy: "Blocked by" },
      });
      const normalized = await connection.issueTracker.issueEvent({
        name: event.comment ? "issue_comment" : "issues",
        payload,
      });
      if (command) {
        const inputPath = join(root, "neutral.json");
        await writeFile(
          inputPath,
          JSON.stringify({
            kind: "issue-contract",
            repository: connection.repository,
            event: normalized,
          }),
        );
        code = await command([inputPath], {
          credential: "fixture-credential",
          fetch,
        });
      } else {
        code = await runIssueContractValidation(
          normalized,
          connection,
          (reference) =>
            connect(
              { ...connection.repository, path: reference.repository },
              { credential: "fixture-credential", fetch },
            ).issueTracker.issue(reference.number),
          pause,
        );
      }
    } else {
      code = await (trigger ?? githubValidation)(
        "issue-contract",
        {
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_EVENT_NAME: event.comment ? "issue_comment" : "issues",
          GITHUB_REPOSITORY: repository,
          GITHUB_TOKEN: "fixture-credential",
        },
        { fetch },
      );
    }
  } catch (caught) {
    error = caught;
  } finally {
    log.mock.restore();
    warn.mock.restore();
  }
  return { code, error, requests, stdout, stderr };
}
// The run's writes, with each result's evaluation time, which the adapter
// takes from the real clock, set to `null` as the pure decision leaves it.
const writes = (result) =>
  result.requests
    .filter(({ method, path }) => method !== "GET" && path !== "/graphql")
    .map((request) =>
      typeof request.body?.body === "string"
        ? {
            ...request,
            body: {
              ...request.body,
              body: request.body.body.replace(
                /"evaluatedAt":"[^"]+"/,
                '"evaluatedAt":null',
              ),
            },
          }
        : request,
    );

// Compare transport writes to the pure decision, including every payload byte.
function assertDecision(result, decision, expectedWrites) {
  assert.equal(result.error, undefined);
  // Closed issues return after their skip message without an explicit status.
  assert.equal(result.code ?? 0, decision.exitCode);
  assert.equal(
    result.stdout,
    decision.exitCode === 0 ? `${decision.message}\n` : "",
  );
  assert.equal(
    result.stderr,
    decision.exitCode === 0 ? "" : `${decision.message}\n`,
  );
  assert.deepEqual(
    writes(result).map(({ method, path, body }) => [method, path, body]),
    expectedWrites,
  );
}

/** @param {Record<string, any>} options */
function decisionFor({
  issue,
  comments = [],
  event = {},
  events = [],
  permissions = {},
  bodyLastEditedAt = null,
  blockedBy = [],
}) {
  return decideIssueContract({
    repository,
    issue: { number: 42, state: "open", ...issue },
    comments: comments.map((comment) => ({ updated_at: time, ...comment })),
    // The fixture payload's defaults: an edit by the reporter.
    event: {
      repository,
      issue: 42,
      kind: "edited",
      actor: { login: "reporter" },
      ...event,
    },
    parent: null,
    blockedBy,
    issueEvents: events,
    permissions: Object.fromEntries(
      Object.entries(permissions).map(([login, role]) => [login, { role }]),
    ),
    bodyRevision: { id: "ISSUE_42", lastEditedAt: bodyLastEditedAt },
  });
}
const issuePath = "/repos/example/repository/issues/42";

// Asserts that a run's only write rewrites the result of comment 13 with the
// decision it already recorded.
function assertResultOnly(result, decision) {
  assert.deepEqual(
    writes(result).map(({ method, path }) => [method, path]),
    [["PATCH", "/repos/example/repository/issues/comments/13"]],
  );
  assert.deepEqual(recordedState(writes(result)[0].body.body), decision);
}
const feedbackWrite = (decision, id) => [
  id == null ? "POST" : "PATCH",
  id == null
    ? `${issuePath}/comments`
    : `/repos/example/repository/issues/comments/${id}`,
  { body: decision.feedback.body },
];

test("trusted issue trigger runs from declared installed resources without npm", async (t) => {
  const installed = installedValidator(t, ".github/scripts/validate.mjs");
  const trigger = (await import(installed)).githubValidation;
  const result = await exercise(t, { trigger });
  assert.equal(result.error, undefined);
  assert.equal(result.code, 0);
  assert.deepEqual(writes(result), []);
});

test("Postern excludes pull request comments before any read", async (t) => {
  const result = await exercise(t, {
    event: {
      action: "created",
      issue: { number: 42, pull_request: {} },
      comment: { id: 17, body: "hostile" },
    },
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.requests, []);
});

test("a fetched closed issue clears workflow and factory labels on any trigger without context reads", async (t) => {
  for (const [action, reason, eventState, kindLabels] of [
    ["closed", "completed", "closed", []],
    ["closed", "not_planned", "closed", []],
    ["closed", "duplicate", "closed", []],
    ["created", "completed", "closed", []],
    ["edited", "completed", "open", []],
    ["closed", "completed", "closed", ["wayfinder:map"]],
    ["labeled", "completed", "closed", ["wayfinder:research"]],
  ]) {
    const issue = {
      state: "closed",
      state_reason: reason,
      body: "Incomplete contract.",
      labels: [
        ...kindLabels,
        "needs-triage",
        "ready-for-agent",
        "ready-for-human",
        "needs-info",
        "wontfix",
        "factory:failed",
        "factory:future",
        "model:x",
        "enhancement",
        "unrelated",
      ],
    };
    const result = await exercise(t, {
      issue,
      comments: [approvedTicketFeedback(issue)],
      event: {
        action,
        issue: { number: 42, state: eventState },
        ...(action === "created"
          ? { comment: { id: 14, body: "Finished." } }
          : {}),
        ...(action === "labeled" ? { label: { name: "ready-for-agent" } } : {}),
      },
    });
    assertDecision(result, decisionFor({ issue }), [
      ["DELETE", `${issuePath}/labels/needs-triage`, null],
      ["DELETE", `${issuePath}/labels/ready-for-agent`, null],
      ["DELETE", `${issuePath}/labels/ready-for-human`, null],
      ["DELETE", `${issuePath}/labels/needs-info`, null],
      ["DELETE", `${issuePath}/labels/factory%3Afailed`, null],
      ["DELETE", `${issuePath}/labels/factory%3Afuture`, null],
    ]);
    assert.equal(result.requests.length, 7);
    assert.equal(result.requests[0].path, "/graphql");
  }
});

test("current issue, complete discussion and role facts bind the unchanged revision", async (t) => {
  const issue = { number: 42, body: ticketBody, labels: ["ready-for-agent"] };
  const result = await exercise(t, {
    issue,
    comments: [[], [awaitingTicketFeedback(issue)]],
    events: [readinessReview],
    permissions: { maintainer: "admin" },
    event: {
      action: "labeled",
      sender: account("maintainer"),
      label: { name: "ready-for-agent" },
      issue: { number: 42, body: "stale and ignored" },
    },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.code, 0);
  const feedback = writes(result).find(({ path }) => path.includes("comments"));
  assert.match(
    feedback.body.body,
    /sha256:27ddd8f67b909c3b0ba371d17760064d32aaccca112259f74c269819ac4a33d0/,
  );
  assert.ok(result.requests.some(({ query }) => query.includes("page=2")));
});

test("native parent is resolved through the port and body-only links are not read", async (t) => {
  const issue = {
    body: "## Parent\n\n#7\n\n## Question\n\nWhich cache meets the latency target?",
    labels: ["wayfinder:task"],
  };
  const native = await exercise(t, {
    issue,
    parent: { number: 7, labels: ["wayfinder:map"] },
  });
  assert.equal(native.code, 0, native.error?.message);
  const bodyOnly = await exercise(t, { issue });
  assert.equal(bodyOnly.code, 1, bodyOnly.error?.message);
  assert.equal(
    bodyOnly.requests.filter(({ path }) => path === "/graphql").length,
    1,
  );
  assert.match(writes(bodyOnly)[0].body.body, /native parent relationship/);
});

test("failed published transport reads never write and redact credentials", async (t) => {
  for (const failure of [401, 403, 404, 409, 422, 429, 500]) {
    const result = await exercise(t, { failure });
    assert.ok(result.error instanceof PlatformError);
    assert.doesNotMatch(result.error.message, /fixture-credential/);
    assert.deepEqual(writes(result), []);
  }
});

test("every PlatformError reason fails issue and merge reads without mutation", async () => {
  for (const reason of platformErrorReasons) {
    let mutations = 0;
    const fail = async () => {
      throw new PlatformError(reason, "Fixture read failed.");
    };
    const connection = {
      issueTracker: { issue: fail, removeLabel: async () => mutations++ },
      pullRequests: { pullRequest: fail, squashMerge: async () => mutations++ },
    };
    await assert.rejects(
      runIssueContractValidation({ issue: 42 }, connection),
      { reason },
    );
    await assert.rejects(merge(["12", "a".repeat(40)], connection), { reason });
    assert.equal(mutations, 0, reason);
  }
});

test("missing body edit capability fails before any write", async () => {
  const connection = {
    issueTracker: { capabilities: {}, issue: async () => ({ state: "open" }) },
  };
  await assert.rejects(
    runIssueContractValidation({ issue: 42 }, connection),
    /edit time is unavailable/,
  );
});

test("unchanged direct and Agent Brief contracts keep pre-migration golden revisions", () => {
  const direct = decideIssueContract({
    repository,
    event: {},
    issue: { number: 42, state: "open", body: ticketBody, labels: [] },
    comments: [],
    parent: null,
    blockedBy: [],
    issueEvents: [],
    permissions: {},
    bodyRevision: { id: "ISSUE_42", lastEditedAt: null },
  });
  assert.match(
    direct.feedback.body,
    /sha256:27ddd8f67b909c3b0ba371d17760064d32aaccca112259f74c269819ac4a33d0/,
  );
  const brief = decideIssueContract({
    repository,
    event: {},
    issue: { number: 42, state: "open", body: "", labels: ["enhancement"] },
    comments: [
      {
        id: 17,
        node_id: "COMMENT_17",
        body: completeAgentBrief,
        updated_at: "2026-10-01T01:00:00Z",
      },
    ],
    parent: null,
    blockedBy: [],
    issueEvents: [],
    permissions: {},
  });
  assert.match(
    brief.feedback.body,
    /sha256:a3d73c28a7802d7c97278ec699b4f5a22760b3d0bb01f97354403e59dfa79d7c/,
  );
});

test("the installed neutral command resolves issue consumers without package installation", async (t) => {
  const command = (await import(installedValidator(t, "scripts/validate.mjs")))
    .main;
  const result = await exercise(t, { command });
  assert.equal(result.error, undefined);
  assert.equal(result.code, 0);
  assert.deepEqual(writes(result), []);
});

test("timeline lag retries authoritative label changes within the existing bound", async (t) => {
  const issue = { number: 42, body: ticketBody, labels: ["ready-for-agent"] };
  for (const recorded of [true, false]) {
    const waits = [];
    const result = await exercise(t, {
      issue,
      comments: [awaitingTicketFeedback(issue)],
      event: {
        action: "labeled",
        sender: account("maintainer"),
        label: { name: "ready-for-agent" },
      },
      permissions: { maintainer: "admin" },
      eventReads: recorded ? [[], [], [readinessReview]] : [[]],
      pause: async (duration) => {
        waits.push(duration);
      },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.code, recorded ? 0 : 1);
    assert.deepEqual(waits, Array(recorded ? 2 : 15).fill(2000));
    const decision = decisionFor({
      issue,
      comments: [awaitingTicketFeedback(issue)],
      event: {
        kind: "labeled",
        actor: account("maintainer"),
        label: "ready-for-agent",
      },
      events: recorded ? [readinessReview] : [],
      permissions: { maintainer: "admin" },
    });
    assertDecision(
      result,
      decision,
      recorded
        ? [feedbackWrite(decision, 13)]
        : [
            ["DELETE", `${issuePath}/labels/ready-for-agent`, null],
            ["POST", `${issuePath}/labels`, { labels: ["needs-triage"] }],
            feedbackWrite(decision, 13),
          ],
    );
    assert.match(
      decision.feedback.body,
      recorded ? /readiness recorded/ : /timeline does not contain/,
    );
  }
});

test("late prerequisite read failures abort before label or feedback mutation", async (t) => {
  for (const path of ["/comments", "/events"]) {
    const issue = { number: 42, body: ticketBody, labels: ["ready-for-agent"] };
    const result = await exercise(t, {
      issue,
      comments: [awaitingTicketFeedback(issue)],
      events: [readinessReview],
      event: {
        action: "labeled",
        sender: account("maintainer"),
        label: { name: "ready-for-agent" },
      },
      permissions: { maintainer: "admin" },
      failure: 403,
      failurePath: (candidate) => candidate.endsWith(path),
    });
    assert.ok(result.error instanceof PlatformError, path);
    assert.doesNotMatch(JSON.stringify(result.error), /fixture-credential/);
    assert.deepEqual(writes(result), [], path);
  }
  const parentFailure = await exercise(t, {
    issue: {
      labels: ["wayfinder:task"],
      body: "## Question\n\nWhich cache meets the target?",
    },
    parent: { number: 7, labels: ["wayfinder:map"] },
    failure: 503,
    failurePath: (path, body) =>
      path === "/graphql" && body.variables.number === 7,
  });
  assert.ok(parentFailure.error instanceof PlatformError);
  assert.deepEqual(writes(parentFailure), []);
});

test("comment global identifiers remain available through the actual published event adapter", async (t) => {
  const current = {
    id: 20,
    node_id: "COMMENT_20",
    body: completeAgentBrief,
    user: account("triager"),
  };
  for (const [identity, marker] of [
    ["COMMENT_25", "COMMENT_25"],
    [undefined, "25"],
  ]) {
    const result = await exercise(t, {
      issue: {
        body: "Intake context",
        labels: ["enhancement", "ready-for-agent"],
      },
      comments: [current],
      events: [readinessReview],
      permissions: { maintainer: "admin" },
      event: {
        action: "deleted",
        comment: {
          id: 25,
          body: completeAgentBrief,
          ...(identity === undefined ? {} : { node_id: identity }),
        },
      },
    });
    const decision = decisionFor({
      issue: {
        body: "Intake context",
        labels: ["enhancement", "ready-for-agent"],
      },
      comments: [{ ...current, updated_at: time }],
      events: [readinessReview],
      permissions: { maintainer: "admin" },
      event: {
        kind: "commentDeleted",
        comment: { id: "25", nodeId: identity, body: completeAgentBrief },
      },
    });
    assert.equal(decision.exitCode, 1);
    assert.match(
      decision.feedback.body,
      new RegExp(`deleted-comment:${marker}`),
    );
    assertDecision(result, decision, [
      ["DELETE", `${issuePath}/labels/ready-for-agent`, null],
      ["POST", `${issuePath}/labels`, { labels: ["needs-triage"] }],
      feedbackWrite(decision),
    ]);
  }
});

test("opening labels and author facts authorize only the existing creation review", async (t) => {
  const issue = { number: 42, body: ticketBody, labels: ["ready-for-agent"] };
  for (const role of ["admin", "write"]) {
    const result = await exercise(t, {
      issue,
      event: { action: "opened" },
      permissions: { reporter: role },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.code, role === "admin" ? 0 : 1);
    const decision = decisionFor({
      issue: {
        ...issue,
        user: account(),
        created_at: time,
        node_id: "ISSUE_42",
      },
      event: {
        kind: "opened",
        actor: account(),
        openingLabels: ["ready-for-agent"],
      },
      permissions: { reporter: role },
    });
    assertDecision(
      result,
      decision,
      role === "admin"
        ? [feedbackWrite(decision)]
        : [
            ["DELETE", `${issuePath}/labels/ready-for-agent`, null],
            ["POST", `${issuePath}/labels`, { labels: ["needs-triage"] }],
            feedbackWrite(decision),
          ],
    );
    if (role === "admin")
      assert.match(
        decision.feedback.body,
        /"reviewEventId":"opened:ISSUE_42:2026-09-14T16:00:00Z"/,
      );
  }
});

test("native blockers supply relationship facts while named-section requirements remain", async (t) => {
  const emptyBody = ticketBody.replace("None.", "_No response_");
  /** @type {[object, object[], number, RegExp][]} */
  const cases = [
    [
      { body: emptyBody, labels: [] },
      [{ number: 41, state: "open" }],
      0,
      /awaiting review/i,
    ],
    [{ body: emptyBody, labels: [] }, [], 1, /placeholder under `Blocked by`/],
    [
      { body: emptyBody.replace(/## Blocked by[\s\S]*/, ""), labels: [] },
      [{ number: 41, state: "open" }],
      1,
      /Add the `Blocked by` section/,
    ],
    [
      { body: ticketBody.replace("None.", "#999"), labels: [] },
      [],
      0,
      /awaiting review/i,
    ],
  ];
  for (const [issue, blockedBy, expectedCode, expectedMessage] of cases) {
    const result = await exercise(t, { issue, blockedBy });
    const decision = decisionFor({ issue, blockedBy });
    assert.equal(decision.exitCode, expectedCode);
    assert.match(decision.feedback.body, expectedMessage);
    assertDecision(result, decision, [
      ["POST", `${issuePath}/labels`, { labels: ["needs-triage"] }],
      feedbackWrite(decision),
    ]);
    assert.equal(
      result.requests.filter(({ path }) => path === "/graphql").length,
      1,
    );
  }
});

test("a retry read failure cannot apply a decision from an earlier timeline", async (t) => {
  let reads = 0;
  const issue = { number: 42, body: ticketBody, labels: ["ready-for-agent"] };
  const result = await exercise(t, {
    issue,
    comments: [awaitingTicketFeedback(issue)],
    events: [],
    event: {
      action: "labeled",
      sender: account("maintainer"),
      label: { name: "ready-for-agent" },
    },
    permissions: { maintainer: "admin" },
    pause: async () => {},
    failure: 503,
    failurePath: (path) => path.endsWith("/events") && reads++ > 0,
  });
  assert.ok(result.error instanceof PlatformError);
  assert.equal(reads, 2);
  assert.deepEqual(writes(result), []);
});

test("the adapter applies the decision's writes in order and exits with its status", async (t) => {
  const invalid = {
    number: 42,
    state: "open",
    body: "## Steps to reproduce\n\n_No response_\n\n## Expected behavior\n\nWorks.\n\n## Actual behavior\n\nBroken.",
    labels: ["bug", "ready-for-agent"],
  };
  const invalidDecision = decisionFor({ issue: invalid });
  assertDecision(await exercise(t, { issue: invalid }), invalidDecision, [
    ["DELETE", `${issuePath}/labels/ready-for-agent`, null],
    ["POST", `${issuePath}/labels`, { labels: ["needs-triage"] }],
    feedbackWrite(invalidDecision),
  ]);
  const issue = { number: 42, body: ticketBody, labels: [], state: "open" };
  const comments = [approvedTicketFeedback(issue)];
  const events = [
    readinessReview,
    {
      ...readinessReview,
      id: 102,
      event: "unlabeled",
      created_at: "2026-09-14T17:01:00Z",
    },
  ];
  const event = {
    action: "unlabeled",
    sender: account("maintainer"),
    label: { name: "ready-for-agent" },
  };
  const decision = decisionFor({
    issue,
    comments,
    events,
    event: {
      kind: "unlabeled",
      actor: account("maintainer"),
      label: "ready-for-agent",
    },
  });
  assertDecision(
    await exercise(t, { issue, comments, events, event }),
    decision,
    [
      ["POST", `${issuePath}/labels`, { labels: ["needs-triage"] }],
      feedbackWrite(decision, 13),
    ],
  );
});

test("a missing reviewer role is a definite unauthorized answer", async (t) => {
  const issue = { number: 42, body: ticketBody, labels: ["ready-for-agent"] };
  const comments = [awaitingTicketFeedback(issue)];
  const event = {
    action: "labeled",
    sender: account("maintainer"),
    label: { name: "ready-for-agent" },
  };
  const decision = decisionFor({
    issue,
    comments,
    events: [readinessReview],
    event: {
      kind: "labeled",
      actor: account("maintainer"),
      label: "ready-for-agent",
    },
  });
  assert.equal(decision.exitCode, 1);
  assert.match(decision.message, /@maintainer is not authorized/);
  const result = await exercise(t, {
    issue,
    comments,
    events: [readinessReview],
    event,
    failure: 404,
    failurePath: (path) => path.endsWith("/permission"),
  });
  assertDecision(result, decision, [
    ["DELETE", `${issuePath}/labels/ready-for-agent`, null],
    ["POST", `${issuePath}/labels`, { labels: ["needs-triage"] }],
    feedbackWrite(decision, 13),
  ]);
});

test("editing or commenting on a closed ready issue clears readiness and leaves feedback untouched", async (t) => {
  const before = {
    number: 42,
    body: ticketBody,
    labels: ["ready-for-agent"],
    state: "closed",
  };
  for (const action of ["edited", "created"]) {
    for (const hasFeedback of [false, true]) {
      const issue = { ...before, body: ticketBody.replace("- [ ]", "- [x]") };
      const result = await exercise(t, {
        issue,
        comments: hasFeedback ? [approvedTicketFeedback(before)] : [],
        bodyLastEditedAt: "2026-09-14T17:02:00Z",
        event: {
          action,
          ...(action === "created"
            ? { comment: { id: 14, body: "Finished." } }
            : {}),
          issue: { number: 42, state: "closed" },
        },
      });
      assertDecision(result, decisionFor({ issue }), [
        ["DELETE", `${issuePath}/labels/ready-for-agent`, null],
      ]);
      assert.equal(result.requests.length, 2);
      assert.equal(result.requests[0].path, "/graphql");
    }
  }
});

test("an edit received while open is skipped when the fetched issue is closed", async (t) => {
  const issue = {
    number: 42,
    body: ticketBody,
    labels: ["ready-for-agent"],
    state: "closed",
  };
  const result = await exercise(t, {
    issue,
    event: { action: "edited", issue: { number: 42, state: "open" } },
    comments: [approvedTicketFeedback(issue)],
  });
  assertDecision(result, decisionFor({ issue }), [
    ["DELETE", `${issuePath}/labels/ready-for-agent`, null],
  ]);
  assert.equal(result.requests.length, 2);
});

test("reopening an issue with a changed contract invalidates readiness", async (t) => {
  const before = {
    number: 42,
    body: ticketBody,
    labels: ["ready-for-agent"],
    state: "closed",
  };
  const issue = {
    ...before,
    state: "open",
    body: ticketBody.replace("- [ ]", "- [x]"),
  };
  const comments = [approvedTicketFeedback(before)];
  const bodyLastEditedAt = "2026-09-14T17:02:00Z";
  const decision = decisionFor({
    issue,
    comments,
    events: [readinessReview],
    bodyLastEditedAt,
    event: { kind: "reopened" },
    permissions: { maintainer: "admin" },
  });
  assert.match(decision.message, /exact contract revision/);
  const result = await exercise(t, {
    issue,
    comments,
    events: [readinessReview],
    bodyLastEditedAt,
    event: { action: "reopened" },
    permissions: { maintainer: "admin" },
  });
  assertDecision(result, decision, [
    ["DELETE", `${issuePath}/labels/ready-for-agent`, null],
    ["POST", `${issuePath}/labels`, { labels: ["needs-triage"] }],
    feedbackWrite(decision, 13),
  ]);
});

test("reopening a bare native issue restores needs-triage", async (t) => {
  const issue = { number: 42, body: ticketBody, labels: [], state: "open" };
  const decision = decisionFor({ issue, event: { kind: "reopened" } });
  const result = await exercise(t, { issue, event: { action: "reopened" } });
  assertDecision(result, decision, [
    ["POST", `${issuePath}/labels`, { labels: ["needs-triage"] }],
    feedbackWrite(decision),
  ]);
});

test("an already-clean closed issue causes no label or feedback writes", async (t) => {
  const issue = {
    state: "closed",
    labels: ["wontfix", "bug", "model:x", "unrelated"],
  };
  const result = await exercise(t, { issue, event: { action: "closed" } });
  assertDecision(result, decisionFor({ issue }), []);
});

test("reopening a cleaned issue restores no historical routing labels", async (t) => {
  const issue = {
    state: "open",
    body: ticketBody,
    labels: ["model:x", "unrelated"],
  };
  const result = await exercise(t, { issue, event: { action: "reopened" } });
  const decision = decisionFor({ issue, event: { kind: "reopened" } });
  assertDecision(result, decision, [
    ["POST", `${issuePath}/labels`, { labels: ["needs-triage"] }],
    feedbackWrite(decision),
  ]);
});

test("unavailable reviewer roles reject readiness with cleanup and useful feedback", async (t) => {
  for (const failure of [401, 403, 409, 422, 429, 500]) {
    const issue = { number: 42, body: ticketBody, labels: ["ready-for-agent"] };
    const result = await exercise(t, {
      issue,
      comments: [awaitingTicketFeedback(issue)],
      events: [readinessReview],
      event: {
        action: "labeled",
        sender: account("maintainer"),
        label: { name: "ready-for-agent" },
      },
      failure,
      failurePath: (path) => path.endsWith("/permission"),
    });
    assert.equal(result.error, undefined);
    assert.equal(result.code, 1);
    assert.deepEqual(
      writes(result).map(({ method, path }) => [method, path]),
      [
        ["DELETE", `${issuePath}/labels/ready-for-agent`],
        ["POST", `${issuePath}/labels`],
        ["PATCH", "/repos/example/repository/issues/comments/13"],
      ],
    );
    assert.deepEqual(writes(result)[1].body, { labels: ["needs-triage"] });
    const feedback = writes(result).at(-1).body.body;
    assert.match(feedback, /Issue contract awaiting review/);
    assert.match(feedback, /Could not verify @maintainer's review authority:/);
    assert.match(feedback, /A fresh authorized review is required/);
    assert.match(
      result.stderr,
      /Could not verify @maintainer's review authority:/,
    );
    assert.doesNotMatch(feedback + result.stderr, /fixture-credential/);
    assert.equal(result.stdout, "");
  }
});

test("role failures on an unchanged recorded approval publish the authority cause safely", async (t) => {
  const issue = { number: 42, body: ticketBody, labels: ["ready-for-agent"] };
  const result = await exercise(t, {
    issue,
    comments: [approvedTicketFeedback(issue)],
    events: [readinessReview],
    failure: 503,
    failurePath: (path) => path.endsWith("/permission"),
  });
  assert.equal(result.error, undefined);
  assert.equal(result.code, 1);
  assert.deepEqual(
    writes(result).map(({ method, path }) => [method, path]),
    [
      ["DELETE", `${issuePath}/labels/ready-for-agent`],
      ["POST", `${issuePath}/labels`],
      ["PATCH", "/repos/example/repository/issues/comments/13"],
    ],
  );
  assert.deepEqual(writes(result)[1].body, { labels: ["needs-triage"] });
  const feedback = writes(result).at(-1).body.body;
  const reason = /Could not verify @maintainer's review authority:/;
  assert.match(feedback, reason);
  assert.match(result.stderr, reason);
  assert.match(recordedState(feedback).rejectionReason, reason);
  assert.match(feedback, /A fresh authorized review is required/);
  assert.doesNotMatch(
    feedback + result.stderr,
    /Wait for the validator to publish/,
  );
  assert.doesNotMatch(feedback + result.stderr, /fixture-credential/);
  assert.equal(result.stdout, "");
});

test("role failures clean up edited approved contracts and recovery requires fresh review", async (t) => {
  for (const kind of ["brief", "direct"]) {
    for (const edit of ["body", "revision metadata"]) {
      for (const label of ["ready-for-agent", "ready-for-human"]) {
        await t.test(`${kind}, ${edit}, ${label}`, async (t) => {
          const before = {
            number: 42,
            body: kind === "brief" ? "Intake context" : ticketBody,
            labels: kind === "brief" ? ["enhancement", label] : [label],
          };
          const brief = {
            id: 20,
            node_id: "COMMENT_20",
            body: completeAgentBrief,
            user: account("triager"),
            updated_at: time,
          };
          const feedback = {
            id: 13,
            user: account("github-actions[bot]"),
            body: feedbackState({
              status: "approved",
              revision:
                kind === "brief" ? briefRevision(brief) : bodyRevision(before),
              label,
              reviewer: "maintainer",
              kind:
                kind === "brief"
                  ? "triaged Agent Brief"
                  : "implementation ticket",
            }),
          };
          const events = [{ ...readinessReview, label: { name: label } }];
          const approved = await exercise(t, {
            issue: before,
            comments: kind === "brief" ? [brief, feedback] : [feedback],
            events,
            permissions: { maintainer: "admin" },
          });
          assert.equal(approved.error, undefined);
          assert.equal(approved.code, 0);
          assertResultOnly(approved, recordedState(feedback.body));

          const editedAt = "2026-09-14T17:02:00Z";
          const changedBrief = {
            ...brief,
            body: edit === "body" ? `${brief.body} and indexing` : brief.body,
            updated_at: editedAt,
          };
          const issue = {
            ...before,
            body:
              kind === "direct" && edit === "body"
                ? before.body.replace("Add caching.", "Add indexing.")
                : before.body,
          };
          const context = {
            issue,
            comments: kind === "brief" ? [changedBrief, feedback] : [feedback],
            events,
            bodyLastEditedAt: kind === "direct" ? editedAt : null,
            event:
              kind === "brief"
                ? { action: "edited", comment: changedBrief }
                : { action: "edited" },
          };
          const failed = await exercise(t, {
            ...context,
            failure: 503,
            failurePath: (path) => path.endsWith("/permission"),
          });
          assert.equal(failed.error, undefined);
          assert.equal(failed.code, 1);
          assert.match(failed.stderr, /exact contract revision/);
          assert.deepEqual(
            writes(failed).map(({ method, path }) => [method, path]),
            [
              ["DELETE", `${issuePath}/labels/${label}`],
              ["POST", `${issuePath}/labels`],
              ["PATCH", "/repos/example/repository/issues/comments/13"],
            ],
          );
          assert.deepEqual(writes(failed)[1].body, {
            labels: ["needs-triage"],
          });
          const noticeBody = writes(failed).at(-1).body.body;
          assert.equal(recordedState(noticeBody).status, "awaiting-review");
          assert.notEqual(
            recordedState(noticeBody).revision,
            recordedState(feedback.body).revision,
          );
          assert.match(noticeBody, /A fresh authorized review is required/);
          const readPaths = failed.requests
            .filter(({ method }) => method === "GET")
            .map(({ path }) => path);
          assert.ok(
            readPaths.indexOf(`${issuePath}/comments`) < readPaths.length - 1,
          );
          assert.ok(
            readPaths.indexOf(`${issuePath}/events`) < readPaths.length - 1,
          );
          assert.ok(readPaths.at(-1).endsWith("/permission"));

          const notice = {
            ...feedback,
            body: noticeBody,
            updated_at: "2026-09-14T17:05:00Z",
          };
          const removed = {
            ...events[0],
            id: 102,
            event: "unlabeled",
            actor: account("github-actions[bot]"),
            created_at: editedAt,
          };
          const settled = {
            ...context,
            issue: {
              ...issue,
              labels: [
                ...(kind === "brief" ? ["enhancement"] : []),
                "needs-triage",
              ],
            },
            comments: kind === "brief" ? [changedBrief, notice] : [notice],
            events: [
              ...events,
              removed,
              {
                ...removed,
                id: 103,
                event: "labeled",
                label: { name: "needs-triage" },
              },
            ],
            permissions: { maintainer: "admin" },
          };
          const recovered = await exercise(t, settled);
          assert.equal(recovered.error, undefined);
          assert.equal(recovered.code, 0);
          assertResultOnly(recovered, recordedState(noticeBody));

          const reviewed = await exercise(t, {
            ...settled,
            issue: { ...issue, labels: [...settled.issue.labels, label] },
            events: [
              ...settled.events,
              {
                ...events[0],
                id: 104,
                created_at: "2026-09-14T17:10:00Z",
              },
            ],
            event: {
              action: "labeled",
              sender: account("maintainer"),
              label: { name: label },
            },
          });
          assert.equal(reviewed.error, undefined);
          assert.equal(reviewed.code, 0);
          const approval = recordedState(writes(reviewed).at(-1).body.body);
          assert.equal(approval.status, "approved");
          assert.equal(approval.revision, recordedState(noticeBody).revision);
          assert.equal(approval.label, label);
          assert.equal(approval.reviewEventId, "104");
        });
      }
    }
  }
});

test("mutation failures during permission-error cleanup remain visible", async (t) => {
  for (const failedWrite of [
    `${issuePath}/labels/ready-for-agent`,
    `${issuePath}/labels`,
    "/repos/example/repository/issues/comments/13",
  ]) {
    const issue = { number: 42, body: ticketBody, labels: ["ready-for-agent"] };
    const result = await exercise(t, {
      issue,
      comments: [approvedTicketFeedback(issue)],
      events: [readinessReview],
      failure: 503,
      failurePath: (path) =>
        path.endsWith("/permission") || path === failedWrite,
    });
    assert.ok(result.error instanceof PlatformError);
    assert.equal(result.error.status, 503);
    assert.equal(result.code, undefined);
    assert.equal(writes(result).at(-1).path, failedWrite);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  }
});
