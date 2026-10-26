import assert from "node:assert/strict";
import test from "node:test";
import { connect } from "../vendor/postern/postern.mjs";
import { pathToFileURL } from "node:url";
import { installedValidator } from "./helpers/installed-validator.mjs";
import { main } from "../.agents/skills/triage/ready.mjs";

const revision = `sha256:${"a".repeat(64)}`;
const label = "ready-for-agent";
const model = "model:gpt-6.1-sol@high";
const time = "2026-10-25T12:00:00Z";
const page = (nodes) => ({
  nodes,
  pageInfo: { hasNextPage: false, endCursor: null },
});
const event = (
  id,
  name = label,
  actor = "maintainer",
  action = "labeled",
  at = time,
) => ({
  id,
  event: action,
  label: { name },
  actor: { login: actor, type: "User" },
  created_at: at,
});

async function exercise(options = {}, command = main) {
  const selectedLabel = options.argv?.[1] ?? label;
  const requests = [];
  const labels = [...(options.labels ?? ["enhancement", "needs-triage"])];
  const events = [...(options.events ?? [])];
  let phase = "before";
  let waits = 0;
  let state = {
    status: "awaiting-review",
    revision,
    observedEventId: null,
    ...options.state,
  };
  let ownEvent;
  let clock = Date.parse(options.now ?? "2026-10-25T12:00:05Z");
  const json = (data, status = 200, headers = {}) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { "content-type": "application/json", ...headers },
    });
  const fetch = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ method, path: url.pathname, body });
    if (options.failure)
      return json({ message: "Fixture failure" }, options.failure);
    if (url.pathname === "/user")
      return json({ login: "maintainer", type: "User", ...options.actor });
    if (url.pathname === "/graphql")
      return json({
        data: {
          repository: {
            issue: {
              number: 42,
              fullDatabaseId: "42",
              id: "ISSUE_42",
              url: "https://github.com/owner/repo/issues/42",
              state: "OPEN",
              title: "Fixture request",
              body: "Intake",
              createdAt: time,
              lastEditedAt: null,
              author: { __typename: "User", login: "reporter" },
              labels: page(labels.map((name) => ({ name }))),
              parent: null,
              subIssues: page(
                options.parent
                  ? [
                      {
                        number: 43,
                        state: "OPEN",
                        repository: { nameWithOwner: "owner/repo" },
                      },
                    ]
                  : [],
              ),
              blockedBy: page([]),
              timelineItems: {
                nodes: options.linkTime
                  ? [{ createdAt: options.linkTime }]
                  : [],
              },
            },
          },
        },
      });
    if (url.pathname.endsWith("/events")) return json(events);
    if (url.pathname.endsWith("/comments")) {
      const heading =
        options.heading ??
        (options.incomplete
          ? "## Issue contract needs attention\n\n- Complete Acceptance criteria."
          : state.status === "approved"
            ? "## Issue contract readiness recorded"
            : "## Issue contract awaiting review");
      const feedback = {
        id: 10,
        node_id: "COMMENT_10",
        html_url: "https://github.com/owner/repo/issues/42#issuecomment-10",
        body: `<!-- repo-canon:issue-contract-feedback -->\n<!-- repo-canon:issue-contract-state ${JSON.stringify(state)} -->\n${heading}`,
        user: { login: "github-actions[bot]", type: "Bot" },
        created_at: time,
        updated_at: time,
      };
      return json([feedback]);
    }
    if (method === "DELETE" && url.pathname.endsWith(`/labels/${label}`)) {
      labels.splice(labels.indexOf(label), 1);
      events.push(
        event(200, label, "maintainer", "unlabeled", "2026-10-25T12:00:02Z"),
      );
      phase = "removed";
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && url.pathname.endsWith("/labels")) {
      for (const name of body.labels)
        if (!labels.includes(name)) labels.push(name);
      ownEvent = event(
        300,
        selectedLabel,
        "maintainer",
        "labeled",
        "2026-10-25T12:00:03Z",
      );
      events.push(ownEvent);
      phase = "applied";
      return json([]);
    }
    throw new Error(`Unexpected fixture request ${method} ${url.pathname}`);
  };
  const connection = connect("https://github.com/owner/repo", {
    credential: "fixture",
    fetch,
  });
  const pause = async () => {
    assert.ok(++waits < 10, "command did not settle within fixture snapshots");
    if (phase === "removed")
      state = { status: "awaiting-review", revision, observedEventId: "200" };
    else if (phase === "applied")
      state = {
        status: "approved",
        revision,
        label: selectedLabel,
        reviewer: "maintainer",
        reviewEventId: String(ownEvent.id),
        ...options.after,
      };
    clock += 2000;
    options.onWait?.({ phase, state, events, labels, waits, requests });
  };
  let code;
  let error;
  try {
    code = await command(
      options.argv ?? [
        "42",
        label,
        revision,
        model,
        "factory:skip",
        ...(options.args ?? []),
      ],
      connection,
      pause,
      () => clock,
    );
  } catch (caught) {
    error = caught;
  }
  return { code, error, requests, waits, labels };
}

const writes = (result) =>
  result.requests.filter(
    ({ method, path }) => method !== "GET" && path !== "/graphql",
  );

test("accepts the reviewed revision with companion labels and confirms the acting reviewer", async () => {
  const result = await exercise();
  assert.equal(result.error, undefined);
  assert.equal(result.code, 0);
  assert.deepEqual(writes(result), [
    {
      method: "POST",
      path: "/repos/owner/repo/issues/42/labels",
      body: { labels: [model, "factory:skip", label] },
    },
  ]);
  assert.ok(result.waits > 0);
});

test("refuses a changed revision without applying labels", async () => {
  const result = await exercise({
    state: { revision: `sha256:${"b".repeat(64)}` },
  });
  assert.match(
    result.error?.message ?? "",
    /reviewed revision.*current revision/i,
  );
  assert.deepEqual(writes(result), []);
});

test("refuses incomplete feedback even when it carries the old awaiting state", async () => {
  const result = await exercise({ incomplete: true });
  assert.match(result.error?.message ?? "", /Complete Acceptance criteria/);
  assert.deepEqual(writes(result), []);
});

test("refuses conflicting model labels and non-person acting accounts without writes", async () => {
  for (const options of [
    { labels: ["enhancement", "model:other"] },
    { actor: { login: "helper[bot]", type: "Bot" } },
    { actor: { login: "helper", type: "Bot" } },
    { actor: { login: "helper", type: "App" } },
  ]) {
    const result = await exercise(options);
    assert.match(result.error?.message ?? "", /model:|person|bot|App/);
    assert.deepEqual(writes(result), []);
  }
});

test("reports a rejection after its own event but ignores an earlier rejection", async () => {
  const stale = await exercise({
    state: { rejectionReason: "Old attempt rejected." },
  });
  assert.equal(stale.error, undefined);
  const rejected = await exercise({
    after: {
      status: "awaiting-review",
      observedEventId: "300",
      reviewEventId: undefined,
      rejectionReason: "Not authorized for readiness.",
    },
  });
  assert.match(rejected.error?.message ?? "", /Not authorized for readiness/);
  assert.equal(writes(rejected).length, 1);
});

test("reapplies a parent's approved readiness at or before its latest sub-issue link", async () => {
  for (const at of [time, "2026-10-25T11:59:59Z"]) {
    const result = await exercise({
      parent: true,
      linkTime: time,
      labels: [label],
      events: [event(100, label, "maintainer", "labeled", at)],
      state: {
        status: "approved",
        label,
        reviewer: "maintainer",
        observedEventId: undefined,
        reviewEventId: "100",
      },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.code, 0);
    assert.deepEqual(
      writes(result).map(({ method }) => method),
      ["DELETE", "POST"],
    );
  }
});

test("waits for the latest relevant timeline event before applying anything", async () => {
  const result = await exercise({
    events: [
      event(90, "model:ignored"),
      event(100, label, "maintainer", "unlabeled"),
    ],
    onWait({ phase, state, waits, requests }) {
      if (phase === "before") {
        assert.equal(
          requests.some(({ method }) => method === "DELETE"),
          false,
        );
        assert.equal(
          requests.some(({ path }) => path.endsWith("/labels")),
          false,
        );
        assert.equal(waits, 1);
        state.observedEventId = "100";
      }
    },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.code, 0);
  assert.equal(result.waits, 2);
});

test("waits beyond the notice's second before applying readiness", async () => {
  const result = await exercise({ now: time });
  assert.equal(result.error, undefined);
  assert.equal(result.waits, 2);
});

test("a parent waits until its latest sub-issue link appears", async () => {
  const options = {
    parent: true,
    onWait({ phase }) {
      if (phase === "before") options.linkTime = time;
    },
  };
  const result = await exercise(options);
  assert.equal(result.error, undefined);
  assert.equal(result.code, 0);
  assert.equal(result.waits, 2);
});

test("requires approval by the acting account at the same revision", async () => {
  for (const after of [
    { reviewer: "somebody-else" },
    { revision: `sha256:${"b".repeat(64)}` },
  ]) {
    const result = await exercise({ after });
    assert.match(result.error?.message ?? "", /this account|reviewed revision/);
  }
});

test("rejects invalid invocations and failed platform reads without writes", async () => {
  for (const argv of [
    [],
    ["42", label],
    ["42", "needs-triage", revision],
    ["42", label, "sha256:invalid"],
    ["42", label, revision, "--repo"],
    ["42", label, revision, "model:a", "model:b"],
  ]) {
    const result = await exercise({ argv });
    assert.ok(result.error);
    assert.deepEqual(writes(result), []);
  }
  for (const failure of [401, 403, 429, 503]) {
    const result = await exercise({ failure });
    assert.ok(result.error);
    assert.deepEqual(writes(result), []);
  }
});

test("the installed triage command resolves the declared bundle without npm", async (t) => {
  const target = installedValidator(t, ".agents/skills/triage/ready.mjs");
  const command = (await import(pathToFileURL(target).href)).main;
  const result = await exercise({}, command);
  assert.equal(result.error, undefined);
  assert.equal(result.code, 0);
});

test("refuses feedback that retains a state without reporting a complete contract", async () => {
  const result = await exercise({
    heading: "## Issue contract structure corrected",
  });
  assert.match(
    result.error?.message ?? "",
    /complete contract awaiting review/,
  );
  assert.deepEqual(writes(result), []);
});

test("accepts ready-for-human without a model label", async () => {
  const result = await exercise({ argv: ["42", "ready-for-human", revision] });
  assert.equal(result.error, undefined);
  assert.equal(result.code, 0);
  assert.deepEqual(writes(result)[0].body, { labels: ["ready-for-human"] });
});

test("validator cleanup does not hide a rejection of the command's label event", async () => {
  const result = await exercise({
    after: {
      status: "awaiting-review",
      observedEventId: "300",
      reviewEventId: undefined,
      rejectionReason: "Review authority refused.",
    },
    onWait({ phase, events, labels }) {
      if (phase === "applied") {
        labels.splice(labels.indexOf(label), 1);
        events.push(event(301, label, "github-actions[bot]", "unlabeled"));
      }
    },
  });
  assert.match(result.error?.message ?? "", /Review authority refused/);
});
