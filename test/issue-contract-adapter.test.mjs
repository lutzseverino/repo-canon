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
    issue: { ...current },
    ...event,
  };
  await writeFile(eventPath, JSON.stringify(payload));
  const requests = [];
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
    if (failure)
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
    if (path.endsWith("/events"))
      return json(
        events.map((entry) => ({
          ...entry,
          actor: entry.actor ? { type: "User", ...entry.actor } : null,
        })),
      );
    if (path.endsWith("/permission")) {
      const login = decodeURIComponent(path.split("/").at(-2));
      return permissions[login]
        ? json({
            permission: permissions[login],
            role_name: permissions[login],
          })
        : json({ message: "Not Found" }, 404);
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
