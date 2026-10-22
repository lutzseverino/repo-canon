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
  bugBody,
  ticketBody,
  completeAgentBrief,
  awaitingTicketFeedback,
  readinessReview,
  repository,
} from "./helpers/issue-contracts.mjs";

const time = "2026-09-14T16:00:00Z";
const page = (nodes) => ({
  nodes,
  pageInfo: { hasNextPage: false, endCursor: null },
});
const account = (login = "reporter") => ({ login, type: "User" });

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
                  lastEditedAt: source.lastEditedAt ?? null,
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
  }
  return { code, error, requests };
}
const writes = (result) =>
  result.requests.filter(
    ({ method, path }) => method !== "GET" && path !== "/graphql",
  );

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

test("fetched closed issue loses only needs-triage without context reads", async (t) => {
  const result = await exercise(t, {
    issue: { state: "closed", labels: ["needs-triage", "ready-for-agent"] },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.requests.length, 2);
  assert.deepEqual(
    writes(result).map(({ method, path }) => [method, path]),
    [["DELETE", "/repos/example/repository/issues/42/labels/needs-triage"]],
  );
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
    const applied = writes(result);
    if (recorded) assert.match(applied.at(-1).body.body, /readiness recorded/);
    else {
      assert.equal(applied[0].method, "DELETE");
      assert.match(applied.at(-1).body.body, /timeline does not contain/);
    }
  }
});

test("late read failures abort before label or feedback mutation", async (t) => {
  for (const path of ["/comments", "/events", "/permission"]) {
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
    assert.equal(result.error, undefined);
    assert.equal(result.code, 1);
    assert.match(
      writes(result).at(-1).body.body,
      new RegExp(`deleted-comment:${marker}`),
    );
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
    const applied = writes(result);
    if (role === "admin") {
      assert.match(
        applied.at(-1).body.body,
        /"reviewEventId":"opened:ISSUE_42:2026-09-14T16:00:00Z"/,
      );
      assert.ok(!applied.some(({ method }) => method === "DELETE"));
    } else assert.equal(applied[0].method, "DELETE");
  }
});

test("native blockers supply relationship facts while named-section requirements remain", async (t) => {
  const emptyBody = ticketBody.replace("None.", "_No response_");
  const native = await exercise(t, {
    issue: { body: emptyBody, labels: [] },
    blockedBy: [{ number: 41, state: "open" }],
  });
  assert.equal(native.error, undefined);
  assert.equal(native.code, 0);
  const absent = await exercise(t, { issue: { body: emptyBody, labels: [] } });
  assert.equal(absent.code, 1);
  assert.match(
    writes(absent).at(-1).body.body,
    /placeholder under `Blocked by`/,
  );
  const missingSection = await exercise(t, {
    issue: { body: emptyBody.replace(/## Blocked by[\s\S]*/, ""), labels: [] },
    blockedBy: [{ number: 41, state: "open" }],
  });
  assert.equal(missingSection.code, 1);
  assert.match(
    writes(missingSection).at(-1).body.body,
    /Add the `Blocked by` section/,
  );
  const bodyOnly = await exercise(t, {
    issue: { body: ticketBody.replace("None.", "#999"), labels: [] },
  });
  assert.equal(bodyOnly.code, 0);
  assert.equal(
    bodyOnly.requests.filter(({ path }) => path === "/graphql").length,
    1,
  );
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
