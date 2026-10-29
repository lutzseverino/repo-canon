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
const policyRevision = "b".repeat(40);
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
  const actor = {
    login: "maintainer",
    type: "User",
    id: 7,
    ...options.actor,
  };
  // GraphQL names a Bot without the "[bot]" suffix that REST logins carry.
  const viewer =
    actor.type === "User"
      ? { __typename: "User", login: actor.login, databaseId: actor.id }
      : {
          __typename: "Bot",
          databaseId: actor.id,
          login:
            typeof actor.login === "string"
              ? actor.login.replace(/\[bot\]$/, "")
              : actor.login,
        };
  const repository = options.repository ?? "owner/repo";
  const [owner, name] = repository.split("/");
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
      return json({ message: "Resource not accessible by integration" }, 403);
    if (url.pathname.startsWith("/users/")) {
      if (Object.hasOwn(options, "identityResponse"))
        return json(options.identityResponse);
      return decodeURIComponent(url.pathname.slice("/users/".length)) ===
        actor.login
        ? json(actor)
        : json({ message: "Not Found" }, 404);
    }
    if (
      url.pathname === "/graphql" &&
      body.query.includes("TriageActingAccount")
    ) {
      if (options.viewerFailure)
        return json({ message: "Viewer unavailable" }, options.viewerFailure);
      if (options.viewerErrors)
        return json({
          data: { viewer: { login: actor.login } },
          errors: [{ message: "Viewer unavailable" }],
        });
      return json({
        data: {
          viewer: Object.hasOwn(options, "viewerResponse")
            ? options.viewerResponse
            : viewer,
        },
      });
    }
    if (
      url.pathname === "/graphql" &&
      body.query.includes("TriageReadinessPolicy")
    ) {
      assert.equal(body.variables.owner, owner);
      assert.equal(body.variables.name, name);
      if (options.policyFailure)
        return json({ message: "Policy unavailable" }, options.policyFailure);
      if (options.policyErrors)
        return json({ errors: [{ message: "Unavailable" }] });
      return json({
        data: {
          repository: {
            nameWithOwner: repository,
            defaultBranchRef: {
              name: "main",
              target: { __typename: "Commit", oid: policyRevision },
            },
            ...options.destination,
          },
        },
      });
    }
    if (
      url.pathname === "/graphql" &&
      body.query.includes("TriageFactoryRules")
    ) {
      assert.equal(body.variables.revision, policyRevision);
      assert.equal(
        body.variables.rules,
        `${policyRevision}:.repo-standards/rules/factory-workflow.md`,
      );
      if (options.rulesFailure)
        return json({ message: "Rules unavailable" }, options.rulesFailure);
      if (options.rulesErrors)
        return json({ errors: [{ message: "Rules unavailable" }] });
      return json({
        data: {
          repository: {
            commit: { __typename: "Commit", oid: policyRevision },
            rules: options.factory === false ? null : { __typename: "Blob" },
            ...options.policyFiles,
          },
        },
      });
    }
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
      return json(options.missingNotice ? [] : [feedback]);
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
        actor.login,
        "labeled",
        "2026-10-25T12:00:03Z",
      );
      ownEvent.actor = actor;
      events.push(ownEvent);
      phase = "applied";
      return json([]);
    }
    throw new Error(`Unexpected fixture request ${method} ${url.pathname}`);
  };
  const connection = connect(`https://github.com/${repository}`, {
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
        reviewer: actor.login,
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

test("factory destinations refuse conflicting model labels and non-person accounts without writes", async () => {
  for (const options of [
    { labels: ["enhancement", "model:other"] },
    { actor: { login: "helper[bot]", type: "Bot" } },
    { actor: { login: "helper[bot]", type: "App" } },
    { actor: { login: "helper[bot]", type: "User" } },
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
  for (const factory of [false, true]) {
    for (const actor of [
      { login: "maintainer", type: "User" },
      { login: "helper[bot]", type: "Bot" },
      { login: "helper[bot]", type: "App" },
    ]) {
      const result = await exercise({ factory, actor }, command);
      if (factory && actor.type !== "User") {
        assert.match(
          result.error?.message ?? "",
          /authorized person.*No factory work was started/,
        );
        assert.deepEqual(writes(result), []);
      } else {
        assert.equal(result.error, undefined);
        assert.equal(result.code, 0);
      }
    }
  }
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

test("standard destinations permit Bot and App reviewers with validator-confirmed readiness", async () => {
  for (const actor of [
    { login: "helper[bot]", type: "Bot" },
    { login: "helper[bot]", type: "App" },
  ]) {
    for (const selected of [label, "ready-for-human"]) {
      const result = await exercise({
        factory: false,
        actor,
        argv: ["42", selected, revision],
      });
      assert.equal(result.error, undefined);
      assert.equal(result.code, 0);
      assert.equal(writes(result).length, 1);
    }
  }
});

test("a person retains revision-bound readiness in both destination policies", async () => {
  for (const factory of [false, true]) {
    for (const selected of [label, "ready-for-human"]) {
      const result = await exercise({
        factory,
        argv: ["42", selected, revision],
      });
      assert.equal(result.error, undefined);
      assert.equal(result.code, 0);
    }
  }
});

test("eligibility follows the connected destination rather than this factory checkout", async () => {
  for (const factory of [false, true]) {
    const result = await exercise({
      factory,
      repository: "other/selected",
      actor: { login: "helper[bot]", type: "Bot" },
      args: ["--repo", "other/selected"],
    });
    if (factory) {
      assert.match(
        result.error?.message ?? "",
        /other\/selected default branch main@b{40}.*person/,
      );
      assert.deepEqual(writes(result), []);
    } else {
      assert.equal(result.error, undefined);
      assert.equal(
        writes(result)[0].path,
        "/repos/other/selected/issues/42/labels",
      );
    }
  }
});

test("unreadable identity or destination policy never authorizes readiness writes", async () => {
  for (const options of [
    { identityResponse: null },
    { identityResponse: { login: "another-reviewer", type: "User" } },
    { viewerResponse: null },
    { viewerResponse: {} },
    { viewerResponse: { login: "maintainer", databaseId: 7 } },
    {
      viewerResponse: {
        __typename: "Organization",
        login: "maintainer",
        databaseId: 7,
      },
    },
    { viewerResponse: { __typename: "User", login: "maintainer" } },
    { viewerErrors: true },
    ...[401, 403, 503].map((status) => ({ viewerFailure: status })),
    { actor: { login: null } },
    { actor: { login: 123 } },
    { actor: { login: " " } },
    { actor: { type: "Unknown" } },
    { destination: { nameWithOwner: "different/repo" } },
    { destination: { defaultBranchRef: null } },
    {
      destination: {
        defaultBranchRef: {
          name: "main",
          target: { __typename: "Tree", oid: policyRevision },
        },
      },
    },
    {
      destination: {
        defaultBranchRef: {
          name: "main",
          target: { __typename: "Commit", oid: "invalid" },
        },
      },
    },
    { policyErrors: true },
    { rulesErrors: true },
    { policyFiles: { commit: null } },
    { policyFiles: { commit: { __typename: "Commit", oid: "c".repeat(40) } } },
    { policyFiles: { rules: undefined } },
    { policyFiles: { rules: { __typename: "Tree" } } },
    ...[401, 403, 503].flatMap((status) => [
      { policyFailure: status },
      { rulesFailure: status },
    ]),
  ]) {
    const result = await exercise({ factory: false, ...options });
    assert.ok(result.error, JSON.stringify(options));
    assert.deepEqual(writes(result), []);
  }
});

test("standard Bot and App reviewers still require the validator's exact approval association", async () => {
  for (const type of ["Bot", "App"]) {
    for (const after of [
      { reviewer: "somebody-else" },
      { revision: `sha256:${"b".repeat(64)}` },
      { reviewEventId: "999", observedEventId: "300" },
      { label: "ready-for-human" },
      {
        status: "awaiting-review",
        observedEventId: "300",
        rejectionReason: "Not authorized for readiness.",
      },
      {
        status: "awaiting-review",
        observedEventId: "300",
        rejectionReason: "The brief's author cannot review it.",
      },
    ]) {
      const result = await exercise({
        factory: false,
        actor: { login: "helper[bot]", type },
        after,
      });
      assert.match(
        result.error?.message ?? "",
        /this account|reviewed revision|Not authorized|author cannot review/,
      );
      assert.equal(writes(result).length, 1);
    }
  }
});

test("standard Bot and App reviewers cannot bypass revision notices or stale parent readiness", async () => {
  for (const type of ["Bot", "App"]) {
    for (const options of [
      { state: { revision: `sha256:${"b".repeat(64)}` } },
      { incomplete: true },
      { labels: [label] },
      { state: null, heading: "No revision notice", missingNotice: true },
    ]) {
      const result = await exercise({
        factory: false,
        actor: { login: "helper[bot]", type },
        ...options,
      });
      assert.ok(result.error);
      assert.deepEqual(writes(result), []);
    }
    const parent = await exercise({
      factory: false,
      actor: { login: "helper[bot]", type },
      parent: true,
      linkTime: time,
      labels: [label],
      events: [event(100)],
      state: {
        status: "approved",
        label,
        reviewer: "maintainer",
        observedEventId: undefined,
        reviewEventId: "100",
      },
    });
    assert.equal(parent.error, undefined);
    assert.deepEqual(
      writes(parent).map(({ method }) => method),
      ["DELETE", "POST"],
    );
  }
});

test("an App installation reviewer resolves its authenticated viewer without the unsupported user endpoint", async () => {
  const result = await exercise({
    factory: false,
    actor: { login: "integration[bot]", type: "Bot" },
    // An installation token's viewer is typed User and keeps the suffix.
    viewerResponse: {
      __typename: "User",
      login: "integration[bot]",
      databaseId: 7,
    },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.code, 0);
  assert.equal(
    result.requests.some(({ path }) => path === "/user"),
    false,
  );
  assert.ok(
    result.requests.some(({ path }) => path === "/users/integration%5Bbot%5D"),
  );
  assert.equal(writes(result).length, 1);
});

test("a GraphQL Bot viewer resolves its suffixed account rather than a same-named person", async () => {
  for (const factory of [false, true]) {
    const result = await exercise({
      factory,
      actor: { login: "helper[bot]", type: "Bot" },
      viewerResponse: { __typename: "Bot", login: "helper", databaseId: 7 },
    });
    assert.equal(
      result.requests.some(({ path }) => path === "/users/helper"),
      false,
    );
    assert.equal(result.error === undefined, !factory);
    assert.equal(writes(result).length, factory ? 0 : 1);
  }
});

test("a viewer resolving to a same-named account with another ID applies no readiness", async () => {
  for (const factory of [false, true]) {
    const result = await exercise({
      factory,
      actor: { login: "helper[bot]", type: "Bot", id: 41 },
      viewerResponse: { __typename: "User", login: "helper", databaseId: 41 },
      identityResponse: { login: "helper", type: "User", id: 42 },
    });
    assert.match(result.error?.message ?? "", /acting account/);
    assert.deepEqual(writes(result), []);
  }
});
