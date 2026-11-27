import "./helpers/temporary-directory.mjs";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { connect } from "../vendor/postern/postern.mjs";
import { marked } from "../vendor/marked/marked.esm.js";
import { main } from "../.agents/skills/orchestrate/workbench.mjs";

const script = fileURLToPath(
  new URL("../.agents/skills/orchestrate/workbench.mjs", import.meta.url),
);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const comment = (id) => ({
  id,
  node_id: `IC_${id}`,
  html_url: `https://github.com/example/tracker/issues/7#issuecomment-${id}`,
  user: { login: "owner", type: "User" },
  body: "An answer.",
  created_at: "2026-10-30T10:00:00Z",
  updated_at: "2026-10-30T10:00:00Z",
});

const pull = (number, state) => ({
  number,
  fullDatabaseId: String(9000 + number),
  id: `PR_${number}`,
  url: `https://github.com/example/tracker/pull/${number}`,
  state,
  title: "A fix",
  body: "",
  createdAt: "2026-10-30T10:00:00Z",
  author: { __typename: "User", login: "worker" },
  headRefName: `issue-${number}`,
  headRefOid: "a".repeat(40),
  baseRefName: "main",
  isCrossRepository: false,
  repository: { nameWithOwner: "example/tracker" },
});

const connection = (nodes) => ({
  nodes,
  pageInfo: { hasNextPage: false, endCursor: null },
});

// A stubbed tracker: the published Postern adapter reads the mutable `items`
// through an injected fetch transport, keyed by `owner/name#number`.
function tracker(items) {
  const requests = [];
  const fetch = async (input, options = {}) => {
    const path = new URL(input).pathname;
    requests.push(path);
    if (items.fail) return json({ message: "Server Error" }, 502);
    if (path === "/graphql") {
      const { query, variables } = JSON.parse(options.body);
      if (
        !query.includes("issueOrPullRequest") &&
        !query.includes("page0:node")
      ) {
        const item =
          items[`${variables.owner}/${variables.name}#${variables.number}`];
        return json({
          data: {
            repository: {
              issue: {
                closedByPullRequestsReferences: connection(item.linked ?? []),
              },
            },
          },
        });
      }
      const nodeFor = (id) => {
        const key = id.replace(/^(commit|suite):/, "").replace(/:\d+$/, "");
        const item = items[key];
        if (!item) return null;
        const page = (nodes) => {
          const size = item.pageSize ?? Infinity;
          return {
            nodes: nodes.slice(0, size),
            pageInfo: {
              hasNextPage: nodes.length > size,
              endCursor: nodes.length > size ? String(size) : null,
            },
            all: nodes,
            size,
          };
        };
        const suites = (item.suites ?? [item.runs ?? []]).map(
          (runs, index) => ({
            id: `suite:${key}:${index}`,
            checkRuns: page(
              runs.map((run) => ({
                ...run,
                databaseId: run.id,
                status: run.status.toUpperCase(),
                conclusion: run.conclusion?.toUpperCase() ?? null,
              })),
            ),
          }),
        );
        const commit = {
          id: `commit:${key}`,
          checkSuites: page(suites),
          status: {
            contexts: (item.statuses ?? []).map((entry) => ({
              ...entry,
              id: `SC_${entry.id}`,
              state: entry.state.toUpperCase(),
            })),
          },
        };
        if (id.startsWith("suite:"))
          return suites[Number(id.split(":").at(-1))];
        if (id.startsWith("commit:")) return commit;
        return {
          __typename: item.pull ? "PullRequest" : "Issue",
          id: key,
          state: item.mergedAt
            ? "MERGED"
            : (item.state ?? "open").toUpperCase(),
          updatedAt: item.updatedAt ?? "2026-11-19T00:00:00Z",
          labels: page((item.labels ?? []).map((name) => ({ name }))),
          comments: page(
            (item.comments ?? []).map((entry) => ({
              databaseId: entry.id,
              url: entry.html_url,
            })),
          ),
          ...(item.pull
            ? {
                headRefOid: item.head ?? "a".repeat(40),
                commits: { nodes: [{ commit }] },
              }
            : {
                closedByPullRequestsReferences: page(
                  (item.linked ?? []).map((entry) => ({
                    url: entry.url,
                    state: entry.state.toUpperCase(),
                  })),
                ),
              }),
        };
      };
      if (query.includes("page0:node")) {
        const data = {};
        for (const match of query.matchAll(
          /(page\d+):node\(id:("[^"]+")\) \{ \.\.\. on \w+ \{ id (\w+)\(first:\d+,after:("[^"]+")/g,
        )) {
          const [, alias, encoded, field, after] = match;
          const node = nodeFor(JSON.parse(encoded));
          const page = node[field];
          const start = Number(JSON.parse(after));
          const end = start + page.size;
          data[alias] = {
            id: node.id,
            [field]: {
              nodes: page.all.slice(start, end),
              pageInfo: {
                hasNextPage: end < page.all.length,
                endCursor: end < page.all.length ? String(end) : null,
              },
            },
          };
        }
        return json({ data });
      }
      const repository = {};
      const matches = [
        ...query.matchAll(/(item\d+):issueOrPullRequest\(number:(\d+)\)/g),
      ];
      for (const [index, match] of matches.entries()) {
        const [, alias, number] = match;
        const node = nodeFor(`${variables.owner}/${variables.name}#${number}`);
        const selection = query.slice(
          match.index,
          matches[index + 1]?.index ?? query.length,
        );
        if (node && !selection.includes("labels")) {
          for (const field of [
            "labels",
            "comments",
            "closedByPullRequestsReferences",
            "headRefOid",
            "commits",
          ])
            delete node[field];
        }
        repository[alias] = node;
      }
      return json({ data: { repository } });
    }
    const pr = /^\/repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)$/.exec(path);
    if (pr) {
      const item = items[`${pr[1]}/${pr[2]}#${pr[3]}`];
      return json({ head: { sha: item.head ?? "a".repeat(40) } });
    }
    const checks =
      /^\/repos\/([^/]+)\/([^/]+)\/commits\/([^/]+)\/(check-runs|status)$/.exec(
        path,
      );
    if (checks) {
      const item = Object.entries(items).find(
        ([key, value]) =>
          key.startsWith(`${checks[1]}/${checks[2]}#`) && value.pull,
      )?.[1];
      return json(
        checks[4] === "check-runs"
          ? { check_runs: item.runs ?? [] }
          : { statuses: item.statuses ?? [] },
      );
    }
    const match =
      /^\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)(\/comments)?$/.exec(path);
    const item = match && items[`${match[1]}/${match[2]}#${match[3]}`];
    if (!item) return json({ message: "Not Found" }, 404);
    if (match[4]) return json(item.comments ?? []);
    return json({
      number: Number(match[3]),
      state: item.state ?? "open",
      labels: (item.labels ?? []).map((name) => ({ name })),
      updated_at: item.updatedAt ?? "2026-11-19T00:00:00Z",
      ...(item.pull
        ? { pull_request: { merged_at: item.mergedAt ?? null } }
        : {}),
    });
  };
  return {
    requests,
    fetch,
    connect: (repository) =>
      connect(`https://github.com/${repository}`, { fetch }),
  };
}

// Collects the command's lines; `main` writes to the streams it is given.
function capture() {
  const output = { stdout: "", stderr: "" };
  const stream = (name) => ({
    write: (chunk) => {
      output[name] += chunk;
      return true;
    },
  });
  output.streams = { stdout: stream("stdout"), stderr: stream("stderr") };
  return output;
}

const unreachable = () => assert.fail("the command reached the tracker");

// Runs git with a fixed identity and no user or system configuration.
const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Sender",
      GIT_AUTHOR_EMAIL: "sender@example.com",
      GIT_COMMITTER_NAME: "Sender",
      GIT_COMMITTER_EMAIL: "sender@example.com",
    },
  }).trim();

const issue = (number, repository = "example/tracker") =>
  `https://github.com/${repository}/issues/${number}`;
const row = (code, links, state = "filed") =>
  `| ${code} | tracker | ${links} | ${state} |`;
const planText = ({ done = ["The guide is reviewed."], rows = [] } = {}) =>
  `# Review

**Goal:** review the guide.
**Done means:**

${done.map((clause, index) => `${index + 1}. ${clause}`).join("\n")}

**Close reviews:** retro

## Tickets

| Item | Repository | Issue | State |
| ---- | ---------- | ----- | ----- |
${rows.join("\n")}

## Current state

Reviewing.
`;
const emptyInbox = "# Inbox\n\n## Open\n\n## Answered\n";
const indexText = (plans, orchestrator = "thread-a") =>
  `# Workbench\n\nOrchestrator: ${orchestrator}\n\n## Repositories\n\n- example/tracker\n\n## Active\n\n${plans.map((name) => `- \`${name}/\`: a goal`).join("\n")}\n\n## Closed\n`;

// A workbench Git checkout holding the given plans' records.
/**
 * @param {import("node:test").TestContext} t
 * @param {{ plans?: Record<string, string>, root?: string }} [options]
 */
function workbench(t, { plans = { review: planText() }, root } = {}) {
  if (!root) {
    root = mkdtempSync(join(tmpdir(), "orchestrate-workbench-"));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    git(root, "init", "--quiet", "--initial-branch=main");
  }
  const write = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write("index.md", indexText(Object.keys(plans)));
  write("inbox.md", emptyInbox);
  for (const [name, text] of Object.entries(plans)) {
    write(`${name}/plan.md`, text);
    write(`${name}/log.md`, "# Log\n");
  }
  return { root, write, path: (path) => join(root, path) };
}

// A workbench watching the given issue links on one row.
const watching = (t, links) =>
  workbench(t, {
    plans: { review: planText({ rows: [row("check", links)] }) },
  });

const waitArgs = (root, interval = "0.01", maxDuration = "5") => [
  "wait",
  root,
  "--interval",
  interval,
  "--max-duration",
  maxDuration,
];

const transportConnection = (repository, options) =>
  connect(`https://github.com/${repository}`, options);

test("a tracker pass batches watched items per repository without per-item REST reads", async (t) => {
  for (const count of [1, 12]) {
    const items = Object.fromEntries(
      Array.from({ length: count }, (_, index) => [
        `example/tracker#${index + 1}`,
        {},
      ]),
    );
    const bench = watching(t, Object.keys(items).join(" "));
    const platform = tracker(items);
    const output = capture();
    assert.equal(
      await main(statusArgs(bench.root), {
        connect: transportConnection,
        fetch: platform.fetch,
        ...output.streams,
      }),
      0,
      output.stderr,
    );
    assert.deepEqual(
      platform.requests,
      ["/graphql"],
      `requests for ${count} watched items`,
    );
    assert.doesNotMatch(output.stdout, /unavailable:/);
  }
});

// The fixture transport is underneath the command queue, including every page.
test("tracker batches retain every connection page and chunk boundary", async (t) => {
  const items = {};
  for (let number = 1; number <= 43; number++) {
    items[`example/tracker#${number}`] = {
      pageSize: 1,
      labels: ["state:ready", "one", "two"],
      comments: [comment(1), comment(2), comment(3)],
      linked: [pull(81, "OPEN"), pull(82, "CLOSED"), pull(83, "MERGED")],
    };
  }
  items["example/tracker#20"] = {
    pull: true,
    pageSize: 1,
    comments: [comment(1), comment(2)],
    suites: [
      [
        { id: 1, name: "Test", status: "completed", conclusion: "success" },
        { id: 2, name: "Test", status: "completed", conclusion: "failure" },
      ],
      [{ id: 3, name: "Lint", status: "queued", conclusion: null }],
    ],
    statuses: [
      { id: 1, context: "deploy", state: "pending" },
      { id: 2, context: "scan", state: "success" },
    ],
  };
  const bench = watching(t, Object.keys(items).join(" "));
  const platform = tracker(items);
  const output = capture();
  const dependencies = {
    connect: transportConnection,
    fetch: platform.fetch,
    ...output.streams,
  };
  assert.equal(
    await main(statusArgs(bench.root), dependencies),
    0,
    output.stderr,
  );
  assert.doesNotMatch(output.stdout, /unavailable:/);
  const facts = observation(bench).facts;
  assert.deepEqual(facts["example/tracker#43"].labels, [
    "one",
    "state:ready",
    "two",
  ]);
  assert.deepEqual(
    facts["example/tracker#43"].comments.map(({ id }) => id),
    [1, 2, 3],
  );
  assert.equal(facts["example/tracker#43"].linked.length, 3);
  assert.deepEqual(
    facts["example/tracker#20"].checks.runs.map(({ id }) => id),
    [1, 2, 3],
  );
  assert.equal(facts["example/tracker#20"].checks.statuses.length, 2);
  let now = 0;
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "1", "2"), {
      ...dependencies,
      now: () => now,
      pause: async (ms) => {
        now += ms;
        items["example/tracker#20"].suites[1][0].status = "completed";
        items["example/tracker#40"].comments.push(comment(4));
        items["example/tracker#43"].labels.push("state:owner");
      },
    }),
    0,
    output.stderr,
  );
  assert.match(output.stdout, /pull\/20: checks changed/);
  assert.match(output.stdout, /issues\/40: new comment .*issuecomment-4/);
  assert.match(output.stdout, /issues\/43: labels added state:owner/);
  assert.ok(platform.requests.every((path) => path === "/graphql"));
});

test("closed tracker reads retain saved details and a reopen refreshes before comparison", async (t) => {
  for (const pull of [false, true]) {
    const item = {
      pull,
      state: "open",
      labels: ["state:ready"],
      comments: [comment(1)],
    };
    const bench = watching(t, "example/tracker#7");
    const platform = tracker({ "example/tracker#7": item });
    const output = capture();
    const queries = [];
    const dependencies = {
      connect: transportConnection,
      ...output.streams,
      fetch: async (input, options) => {
        queries.push(JSON.parse(options.body).query);
        return platform.fetch(input, options);
      },
    };
    assert.equal(
      await main(statusArgs(bench.root), dependencies),
      0,
      output.stderr,
    );
    item.state = "closed";
    assert.equal(
      await main(statusArgs(bench.root), dependencies),
      0,
      output.stderr,
    );
    const closedFacts = observation(bench).facts["example/tracker#7"];
    queries.length = 0;
    assert.equal(
      await main(statusArgs(bench.root), dependencies),
      0,
      output.stderr,
    );
    assert.equal(queries.length, 1);
    assert.doesNotMatch(
      queries[0],
      /comments|labels|checkSuites|contexts|commits|closedByPullRequests/,
    );
    assert.deepEqual(
      observation(bench).facts["example/tracker#7"],
      closedFacts,
    );
    item.state = "open";
    queries.length = 0;
    output.stdout = "";
    assert.equal(
      await main(waitArgs(bench.root, "1", "1"), dependencies),
      0,
      output.stderr,
    );
    assert.equal(
      queries.length,
      2,
      "state-only reopen is followed by a full observation",
    );
    assert.match(output.stdout, /state changed from closed to open/);
    assert.doesNotMatch(
      output.stdout,
      /new comment|labels (added|removed)|checks changed|head changed/,
    );
    assert.deepEqual(observation(bench).facts["example/tracker#7"].comments, [
      {
        id: 1,
        url: "https://github.com/example/tracker/issues/7#issuecomment-1",
      },
    ]);
  }
});

test("partial GraphQL responses and incomplete pages remain explicit failures", async (t) => {
  for (const fault of ["errors", "missing", "null", "page", "cursor"]) {
    await t.test(fault, async (t) => {
      const bench = watching(t, "example/tracker#7 example/tracker#8");
      const items = {
        "example/tracker#7": {
          comments: [comment(1), comment(2)],
          pageSize: 1,
        },
        "example/tracker#8": {},
      };
      const platform = tracker(items);
      const output = capture();
      const dependencies = {
        connect: transportConnection,
        fetch: platform.fetch,
        ...output.streams,
      };
      assert.equal(
        await main(statusArgs(bench.root), dependencies),
        0,
        output.stderr,
      );
      const saved = observation(bench).facts;
      let pauses = 0;
      const code = await main(waitArgs(bench.root, "1", "2"), {
        ...dependencies,
        pause: async () => {
          pauses++;
        },
        fetch: async (input, options) => {
          const response = await platform.fetch(input, options);
          const data = JSON.parse(await response.text());
          const query = JSON.parse(String(options.body)).query;
          if (fault === "errors")
            data.errors = [
              { type: "FORBIDDEN", message: "One alias is forbidden" },
            ];
          else if (query.includes("issueOrPullRequest")) {
            if (fault === "missing") delete data.data.repository.item0;
            if (fault === "null") data.data.repository.item0 = null;
          } else {
            if (fault === "page") data.data.page0.comments.nodes = null;
            if (fault === "cursor")
              data.data.page0.comments.pageInfo = {
                hasNextPage: true,
                endCursor: "1",
              };
          }
          return json(data);
        },
      });
      assert.equal(code, 1);
      assert.match(output.stderr, /GraphQL API answered|incomplete tracker/);
      assert.equal(pauses, 0);
      assert.deepEqual(
        observation(bench).facts,
        saved,
        "failed wait cannot save a partial observation",
      );
    });
  }
});

test("saved REST status-context identifiers cause only the accepted upgrade wake", async (t) => {
  const item = {
    pull: true,
    statuses: [{ id: 3, context: "deploy", state: "pending" }],
  };
  const bench = watching(t, "example/tracker#7");
  const platform = tracker({ "example/tracker#7": item });
  const output = capture();
  const dependencies = {
    connect: transportConnection,
    fetch: platform.fetch,
    ...output.streams,
  };
  assert.equal(
    await main(statusArgs(bench.root), dependencies),
    0,
    output.stderr,
  );
  const legacy = observation(bench);
  legacy.facts["example/tracker#7"].checks.statuses[0].id = 3;
  writeFileSync(
    bench.path(".git/workbench-observation.json"),
    JSON.stringify(legacy),
  );
  let now = 0;
  const waiting = {
    ...dependencies,
    now: () => now,
    pause: async (ms) => {
      now += ms;
    },
  };
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "1", "1"), waiting),
    0,
    output.stderr,
  );
  assert.match(output.stdout, /checks changed/);
  assert.equal(
    observation(bench).facts["example/tracker#7"].checks.statuses[0].id,
    "SC_3",
  );
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "1", "1"), waiting),
    0,
    output.stderr,
  );
  assert.doesNotMatch(output.stdout, /checks changed/);
  assert.match(output.stdout, /no item changed/);
});

test("status and wait cap batched and paginated requests across repository connections", async (t) => {
  const items = {};
  const rows = [];
  for (let repository = 0; repository < 10; repository++) {
    for (let number = 1; number <= 45; number++) {
      const key = `example/tracker${repository}#${number}`;
      items[key] =
        number === 1
          ? {
              pull: true,
              pageSize: 1,
              comments: [comment(1), comment(2)],
              runs: [1, 2].map((id) => ({
                id,
                name: "Test",
                status: "completed",
                conclusion: "success",
              })),
              statuses: [{ id: 3, context: "deploy", state: "success" }],
            }
          : {};
      rows.push(row(`tracker${repository}-${number}`, key));
    }
  }
  rows.push(row("duplicate", "example/tracker0#2"));
  const bench = workbench(t, { plans: { review: planText({ rows }) } });
  const platform = tracker(items);
  let active = 0;
  let peak = 0;
  const requests = [];
  const fetch = async (input, options) => {
    active++;
    peak = Math.max(peak, active);
    requests.push({
      path: new URL(input).pathname,
      ...JSON.parse(options.body),
    });
    await new Promise((resolve) => setTimeout(resolve, 1));
    const response = await platform.fetch(input, options);
    const body = await response.text();
    return new Response(
      new ReadableStream({
        async start(controller) {
          await new Promise((resolve) => setTimeout(resolve, 1));
          controller.enqueue(new TextEncoder().encode(body));
          active--;
          controller.close();
        },
      }),
      { status: response.status, headers: response.headers },
    );
  };
  const output = capture();
  const dependencies = {
    connect: transportConnection,
    fetch,
    ...output.streams,
  };
  assert.equal(
    await main(statusArgs(bench.root), dependencies),
    0,
    output.stderr,
  );
  assert.equal(peak, 8);
  assert.doesNotMatch(output.stdout, /unavailable:/);
  assert.ok(requests.every(({ path }) => path === "/graphql"));
  assert.equal(
    requests.filter(
      ({ query, variables }) =>
        variables.name === "tracker0" && query.includes("number:2)"),
    ).length,
    1,
    "duplicate watches share a read",
  );
  const perPass = requests.length;
  assert.ok(
    requests.some(({ query }) => query.includes("page0:node")),
    "follow-up pages are in the queue",
  );
  requests.length = 0;
  peak = 0;
  output.stdout = "";
  let elapsed = 0;
  assert.equal(
    await main(waitArgs(bench.root, "1", "2"), {
      ...dependencies,
      now: () => elapsed,
      pause: async (ms) => {
        assert.equal(requests.length, perPass, "first wait pass requests");
        elapsed += ms;
        items["example/tracker0#2"].labels = ["state:owner"];
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(peak, 8);
  assert.equal(requests.length, perPass * 2, "requests per complete wait pass");
  assert.match(output.stdout, /labels added state:owner/);
  assert.doesNotMatch(output.stdout, /unavailable:/);
});

const observation = (bench) =>
  JSON.parse(
    readFileSync(bench.path(".git/workbench-observation.json"), "utf8"),
  );
const statusArgs = (root) => [
  "status",
  root,
  "--stale-after",
  "60",
  "--stages",
  installedStages,
];

test("wait re-arms keep the full-poll cadence while reading only new items and status stays fresh", async (t) => {
  const bench = watching(t, "example/tracker#7");
  const items = { "example/tracker#7": {}, "example/tracker#8": {} };
  const platform = tracker(items);
  const output = capture();
  let now = 0;
  const requests = [];
  const dependencies = {
    ...output.streams,
    connect: transportConnection,
    fetch: async (input, options) => {
      requests.push({ path: new URL(input).pathname, at: now });
      return platform.fetch(input, options);
    },
    now: () => now,
    pause: async (ms) => {
      now += ms;
    },
  };
  assert.equal(
    await main(waitArgs(bench.root, "10", "1"), dependencies),
    0,
    output.stderr,
  );
  assert.equal(requests.length, 1);
  assert.equal(observation(bench).trackerPollAt, 0);
  now = 2000;
  requests.length = 0;
  assert.equal(
    await main(statusArgs(bench.root), dependencies),
    0,
    output.stderr,
  );
  assert.equal(requests.length, 1, "status always reads known items fresh");
  assert.equal(
    observation(bench).trackerPollAt,
    0,
    "status preserves the wait cadence",
  );
  bench.write(
    "review/plan.md",
    planText({
      rows: [row("old", "example/tracker#7"), row("new", "example/tracker#8")],
    }),
  );
  now = 3000;
  requests.length = 0;
  assert.equal(
    await main(waitArgs(bench.root, "10", "1"), dependencies),
    0,
    output.stderr,
  );
  assert.equal(requests.length, 1);
  assert.ok(
    requests.every(
      ({ path }) =>
        path.endsWith("/8") ||
        path.endsWith("/8/comments") ||
        path === "/graphql",
    ),
  );
  assert.equal(
    observation(bench).trackerPollAt,
    0,
    "new-item reads do not postpone the full poll",
  );
  now = 4000;
  requests.length = 0;
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "10", "10"), {
      ...dependencies,
      pause: async (ms) => {
        assert.equal(ms, 6000, "the next full poll remains at 10 seconds");
        now += ms;
        items["example/tracker#7"].labels = ["state:owner"];
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(requests.length, 1);
  assert.ok(requests.every(({ at }) => at === 10000));
  assert.match(output.stdout, /labels added state:owner/);
});

test("an armed wait adopts an overlapping status cooldown before its next tracker poll", async (t) => {
  const bench = watching(t, "example/tracker#7");
  const platform = tracker({ "example/tracker#7": {} });
  const output = capture();
  let now = 0;
  let limited = false;
  let requests = 0;
  const dependencies = {
    ...output.streams,
    connect: transportConnection,
    now: () => now,
    fetch: async (input, options) => {
      requests++;
      return limited
        ? new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
            status: 429,
            headers: {
              "content-type": "application/json",
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": "20",
            },
          })
        : platform.fetch(input, options);
    },
  };
  let pauses = 0;
  assert.equal(
    await main(waitArgs(bench.root, "1", "30"), {
      ...dependencies,
      pause: async (ms) => {
        pauses++;
        if (pauses === 1) {
          now = 500;
          limited = true;
          const statusOutput = capture();
          assert.equal(
            await main(statusArgs(bench.root), {
              ...dependencies,
              ...statusOutput.streams,
            }),
            0,
            statusOutput.stderr,
          );
          assert.match(statusOutput.stdout, /rate limited until/);
          limited = false;
          requests = 0;
          now = 1000;
        } else {
          assert.equal(requests, 0, "wait must observe status's refusal");
          assert.equal(ms, 1000);
          now = 2000;
          bench.write("review/log.md", "# Log\nA local answer.\n");
        }
        return "event";
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(requests, 0);
  assert.equal(observation(bench).cooldown.retryAt, "1970-01-01T00:00:20.000Z");
  assert.equal(observation(bench).trackerPollAt, 0);
  assert.match(output.stdout, /review\/log.md: changed/);
});

test("a slow status preserves a newer full poll completed by an overlapping wait", async (t) => {
  const bench = watching(t, "example/tracker#7");
  const platform = tracker({ "example/tracker#7": {} });
  const output = capture();
  let now = 0;
  const dependencies = {
    ...output.streams,
    connect: transportConnection,
    fetch: platform.fetch,
    now: () => now,
    pause: async (ms) => {
      now += ms;
    },
  };
  assert.equal(
    await main(waitArgs(bench.root, "10", "1"), dependencies),
    0,
    output.stderr,
  );
  let started;
  const starting = new Promise((resolve) => {
    started = resolve;
  });
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const statusOutput = capture();
  const pendingStatus = main(statusArgs(bench.root), {
    ...dependencies,
    ...statusOutput.streams,
    fetch: async (input, options) => {
      started();
      await held;
      return platform.fetch(input, options);
    },
  });
  await starting;
  try {
    now = 10000;
    assert.equal(
      await main(waitArgs(bench.root, "10", "1"), dependencies),
      0,
      output.stderr,
    );
    assert.equal(observation(bench).trackerPollAt, 10000);
  } finally {
    release();
    assert.equal(await pendingStatus, 0, statusOutput.stderr);
  }
  assert.equal(
    observation(bench).trackerPollAt,
    10000,
    "status must not restore its older schedule",
  );
});

test("an older status refusal completing last preserves wait's later cooldown and refused full-poll cadence", async (t) => {
  const bench = watching(t, "example/tracker#7");
  const items = { "example/tracker#7": {} };
  const platform = tracker(items);
  const output = capture();
  let now = 0;
  const dependencies = {
    ...output.streams,
    connect: transportConnection,
    fetch: platform.fetch,
    now: () => now,
    pause: async (ms) => {
      now += ms;
    },
  };
  assert.equal(
    await main(waitArgs(bench.root, "10", "1"), dependencies),
    0,
    output.stderr,
  );
  const refuse = (reset) =>
    new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
      status: 429,
      headers: {
        "content-type": "application/json",
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": reset,
      },
    });
  let started;
  const starting = new Promise((resolve) => {
    started = resolve;
  });
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const statusOutput = capture();
  const pendingStatus = main(statusArgs(bench.root), {
    ...dependencies,
    ...statusOutput.streams,
    fetch: async () => {
      started();
      await held;
      return refuse("20");
    },
  });
  await starting;
  try {
    now = 10000;
    assert.equal(
      await main(waitArgs(bench.root, "10", "1"), {
        ...dependencies,
        fetch: async () => refuse("40"),
      }),
      0,
      output.stderr,
    );
    assert.equal(
      observation(bench).trackerPollAt,
      0,
      "a refused full poll must not postpone its retry",
    );
  } finally {
    release();
    assert.equal(await pendingStatus, 0, statusOutput.stderr);
  }
  assert.equal(observation(bench).cooldown.retryAt, "1970-01-01T00:00:40.000Z");
  now = 40000;
  items["example/tracker#7"].labels = ["state:owner"];
  assert.equal(
    await main(waitArgs(bench.root, "10", "1"), dependencies),
    0,
    output.stderr,
  );
  assert.equal(observation(bench).trackerPollAt, 40000);
  assert.match(output.stdout, /labels added state:owner/);
});

test("an expired status cooldown does not advance an early re-arm's full poll", async (t) => {
  const bench = watching(t, "example/tracker#7");
  const items = { "example/tracker#7": {} };
  const platform = tracker(items);
  const output = capture();
  let now = 0;
  const dependencies = {
    ...output.streams,
    connect: transportConnection,
    fetch: platform.fetch,
    now: () => now,
    pause: async (ms) => {
      now += ms;
    },
  };
  assert.equal(
    await main(waitArgs(bench.root, "600", "1"), dependencies),
    0,
    output.stderr,
  );
  now = 10000;
  assert.equal(
    await main(statusArgs(bench.root), {
      ...dependencies,
      fetch: async () =>
        new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
          status: 429,
          headers: {
            "content-type": "application/json",
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": "20",
          },
        }),
    }),
    0,
    output.stderr,
  );
  now = 30000;
  platform.requests.length = 0;
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "600", "1"), dependencies),
    0,
    output.stderr,
  );
  assert.equal(
    platform.requests.length,
    0,
    "the saved full poll remains due at 600 seconds",
  );
  assert.equal(observation(bench).trackerPollAt, 0);
  now = 600000;
  items["example/tracker#7"].labels = ["state:owner"];
  assert.equal(
    await main(waitArgs(bench.root, "600", "1"), dependencies),
    0,
    output.stderr,
  );
  assert.equal(platform.requests.length, 1);
  assert.match(output.stdout, /labels added state:owner/);
});

test("a failed wait retains unreported local record and launch-report changes for its re-arm", async (t) => {
  const bench = watching(t, "example/tracker#7");
  bench.write("review/brief-01.md", brief("report-01.md"));
  const items = { "example/tracker#7": {} };
  const platform = tracker(items);
  const output = capture();
  const dependencies = {
    ...output.streams,
    connect: transportConnection,
    fetch: platform.fetch,
  };
  assert.equal(
    await main(statusArgs(bench.root), dependencies),
    0,
    output.stderr,
  );
  const saved = observation(bench).facts;
  bench.write("review/log.md", "# Log\nAn answer.\n");
  bench.write("review/report-01.md", "The findings.\n\nstatus: done\n");
  items.fail = true;
  output.stdout = "";
  assert.equal(await main(waitArgs(bench.root), dependencies), 1);
  assert.equal(output.stdout, "");
  assert.match(output.stderr, /502: Server Error/);
  assert.deepEqual(
    observation(bench).facts,
    saved,
    "unreported changes must not become the saved baseline",
  );
  items.fail = false;
  output.stderr = "";
  assert.equal(
    await main(waitArgs(bench.root), dependencies),
    0,
    output.stderr,
  );
  assert.match(output.stdout, /review\/log.md: changed/);
  assert.match(output.stdout, /finished: read review\/report-01.md/);
});

test("a launch report wakes an armed wait while an overlapping status establishes cooldown", async (t) => {
  const bench = watching(t, "example/tracker#7");
  bench.write("review/brief-01.md", brief("report-01.md"));
  const platform = tracker({ "example/tracker#7": {} });
  const output = capture();
  let now = 0;
  let requests = 0;
  const dependencies = {
    ...output.streams,
    connect: transportConnection,
    now: () => now,
    fetch: async (input, options) => {
      requests++;
      return platform.fetch(input, options);
    },
  };
  assert.equal(
    await main(waitArgs(bench.root, "60", "120"), {
      ...dependencies,
      pause: async () => {
        now = 1000;
        const statusOutput = capture();
        assert.equal(
          await main(statusArgs(bench.root), {
            ...dependencies,
            ...statusOutput.streams,
            fetch: async () =>
              new Response(
                JSON.stringify({ message: "API rate limit exceeded" }),
                {
                  status: 429,
                  headers: {
                    "content-type": "application/json",
                    "x-ratelimit-remaining": "0",
                    "x-ratelimit-reset": "120",
                  },
                },
              ),
          }),
          0,
          statusOutput.stderr,
        );
        requests = 0;
        now = 2000;
        bench.write("review/report-01.md", "The findings.\n\nstatus: done\n");
        return "event";
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(
    requests,
    0,
    "finishing the report must not cause tracker requests during cooldown",
  );
  assert.match(output.stdout, /finished: read review\/report-01.md/);
  assert.equal(observation(bench).cooldown.retryAt, "1970-01-01T00:02:00.000Z");
});

test("a later refusal without retryAt keeps its full interval after a timestamped cooldown", async (t) => {
  const bench = watching(t, "example/tracker#7");
  const items = { "example/tracker#7": {} };
  const platform = tracker(items);
  const output = capture();
  let now = 0;
  const dependencies = {
    ...output.streams,
    connect: transportConnection,
    fetch: platform.fetch,
    now: () => now,
    pause: async (ms) => {
      now += ms;
    },
  };
  assert.equal(
    await main(waitArgs(bench.root, "60", "1"), dependencies),
    0,
    output.stderr,
  );
  const refuse = (headers) => async () =>
    new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
      status: 429,
      headers: { "content-type": "application/json", ...headers },
    });
  now = 10000;
  assert.equal(
    await main(statusArgs(bench.root), {
      ...dependencies,
      fetch: refuse({
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "20",
      }),
    }),
    0,
    output.stderr,
  );
  now = 30000;
  assert.equal(
    await main(statusArgs(bench.root), {
      ...dependencies,
      fetch: refuse({}),
    }),
    0,
    output.stderr,
  );
  now = 31000;
  platform.requests.length = 0;
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "60", "120"), {
      ...dependencies,
      pause: async (ms) => {
        assert.equal(
          platform.requests.length,
          0,
          "the later refusal still blocks tracker requests",
        );
        assert.equal(ms, 59000);
        now += ms;
        items["example/tracker#7"].labels = ["state:owner"];
      },
    }),
    0,
    output.stderr,
  );
  assert.match(output.stdout, /^rate limited:/m);
  assert.doesNotMatch(output.stdout, /rate limited until/);
  assert.equal(platform.requests.length, 1);
  assert.equal(observation(bench).trackerPollAt, 90000);
  assert.match(output.stdout, /labels added state:owner/);
  assert.equal(
    await main(statusArgs(bench.root), {
      ...dependencies,
      fetch: refuse({
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": "120",
      }),
    }),
    0,
    output.stderr,
  );
  platform.requests.length = 0;
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "60", "1"), dependencies),
    0,
    output.stderr,
  );
  assert.equal(platform.requests.length, 0);
  assert.match(output.stdout, /^rate limited until 1970-01-01T00:02:00.000Z:/m);
});

test("retryAt cooldown survives status and wait writes, preserves facts and keeps local watching until recovery", async (t) => {
  const rows = [];
  const items = {};
  for (const repository of ["example/tracker", "example/other"]) {
    for (let number = 1; number <= 10; number++) {
      rows.push(
        row(`${repository.split("/")[1]}-${number}`, `${repository}#${number}`),
      );
      items[`${repository}#${number}`] = {};
    }
  }
  const bench = workbench(t, { plans: { review: planText({ rows }) } });
  const platform = tracker(items);
  const output = capture();
  const start = Date.parse("2026-11-26T20:00:00Z");
  const retryAt = "2026-11-26T20:00:10.000Z";
  let now = start;
  let limited = false;
  const requests = [];
  const dependencies = {
    ...output.streams,
    connect: transportConnection,
    now: () => now,
    fetch: async (input, options) => {
      requests.push({ path: new URL(input).pathname, at: now });
      if (limited)
        return new Response(
          JSON.stringify({ message: "API rate limit exceeded" }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": String((start + 10000) / 1000),
            },
          },
        );
      return platform.fetch(input, options);
    },
  };
  assert.equal(
    await main(statusArgs(bench.root), dependencies),
    0,
    output.stderr,
  );
  const saved = observation(bench).facts;
  limited = true;
  requests.length = 0;
  output.stdout = "";
  assert.equal(
    await main(statusArgs(bench.root), dependencies),
    0,
    output.stderr,
  );
  assert.ok(
    requests.length > 0 && requests.length <= 8,
    "the refusal stops queued dispatch across both repositories",
  );
  assert.equal(
    output.stdout.split(`rate limited until ${retryAt}`).length - 1,
    20,
  );
  assert.match(output.stdout, /example\/other\/issues\/10.*review\/other-10/);
  assert.doesNotMatch(output.stdout, /unavailable:/);
  assert.deepEqual(observation(bench).facts, saved);
  const cooldown = observation(bench).cooldown;
  assert.equal(cooldown.retryAt, retryAt);
  now += 1000;
  rows.push(row("new", "example/other#11"));
  items["example/other#11"] = {};
  bench.write("review/plan.md", planText({ rows }));
  requests.length = 0;
  assert.equal(
    await main(statusArgs(bench.root), dependencies),
    0,
    output.stderr,
  );
  assert.equal(
    requests.length,
    0,
    "cooldown includes items new to the baseline",
  );
  assert.deepEqual(observation(bench).cooldown, cooldown);
  for (const [key, facts] of Object.entries(saved))
    if (key.startsWith("tracker:"))
      assert.deepEqual(observation(bench).facts[key], facts);
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "60", "20"), {
      ...dependencies,
      pause: async (ms) => {
        assert.equal(requests.length, 0);
        assert.equal(ms, 9000);
        now += 1000;
        bench.write("review/log.md", "# Log\n\n- A local answer.\n");
        return "event";
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(requests.length, 0);
  assert.match(output.stdout, /rate limited until/);
  assert.match(output.stdout, /review\/log.md: changed/);
  assert.deepEqual(observation(bench).cooldown, cooldown);
  for (const [key, facts] of Object.entries(saved))
    if (key.startsWith("tracker:"))
      assert.deepEqual(observation(bench).facts[key], facts);
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "60", "20"), {
      ...dependencies,
      pause: async (ms) => {
        assert.equal(requests.length, 0);
        assert.equal(ms, 8000);
        now += ms;
        limited = false;
        items["example/tracker#7"].labels = ["state:owner"];
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(requests.length, 2);
  assert.ok(requests.every(({ at }) => at === start + 10000));
  assert.match(output.stdout, /labels added state:owner/);
  assert.equal(output.stderr, "");
});

test("queued exchanges receive a fresh forty-five-second timeout when dispatched", async (t) => {
  const items = {};
  const links = [];
  for (let number = 1; number <= 32; number++) {
    items[`example/tracker${number}#1`] = {};
    links.push(`example/tracker${number}#1`);
  }
  const bench = watching(t, links.join(" "));
  const platform = tracker(items);
  const output = capture();
  let elapsed = 0;
  const signals = new WeakMap();
  const scheduled = [];
  const budgets = [];
  t.mock.method(AbortSignal, "timeout", (milliseconds) => {
    const controller = new AbortController();
    const expires = elapsed + milliseconds;
    signals.set(controller.signal, expires);
    scheduled.push({ controller, expires });
    return controller.signal;
  });
  assert.equal(
    await main(statusArgs(bench.root), {
      ...output.streams,
      connect: transportConnection,
      fetch: async (input, options) => {
        budgets.push(signals.get(options.signal) - elapsed);
        assert.equal(options.signal.aborted, false);
        await new Promise((resolve) => setImmediate(resolve));
        elapsed += 2000;
        for (const { controller, expires } of scheduled)
          if (expires <= elapsed)
            controller.abort(new DOMException("Timed out", "TimeoutError"));
        return platform.fetch(input, options);
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(budgets.length, 32);
  assert.ok(elapsed > 45000, "queued work spans more than the request timeout");
  assert.ok(
    budgets.every((budget) => budget === 45000),
    "every transport dispatch starts with the full timeout",
  );
  assert.doesNotMatch(output.stdout, /unavailable:/);
});

test("rate limits without retryAt keep same-wait and re-armed polling one caller interval after refusal", async (t) => {
  for (const rearm of [false, true]) {
    await t.test(rearm ? "re-armed wait" : "same wait", async (t) => {
      const bench = watching(t, "example/tracker#7");
      const items = { "example/tracker#7": {} };
      const platform = tracker(items);
      const output = capture();
      let now = 0;
      let limited = false;
      const requests = [];
      const dependencies = {
        ...output.streams,
        connect: transportConnection,
        now: () => now,
        fetch: async (input, options) => {
          requests.push(now);
          return limited
            ? json({ message: "API rate limit exceeded" }, 429)
            : platform.fetch(input, options);
        },
      };
      assert.equal(
        await main(statusArgs(bench.root), dependencies),
        0,
        output.stderr,
      );
      const saved = observation(bench).facts;
      requests.length = 0;
      output.stdout = "";
      limited = true;
      let pauses = 0;
      const pause = async (ms) => {
        pauses++;
        if (rearm && pauses === 1) {
          assert.equal(ms, 1000);
          now += ms;
          return;
        }
        assert.equal(ms, rearm ? 9000 : 10000);
        assert.equal(
          requests.length,
          1,
          "there are no tracker reads during cooldown",
        );
        now += ms;
        limited = false;
        items["example/tracker#7"].labels = ["state:owner"];
      };
      assert.equal(
        await main(waitArgs(bench.root, "10", rearm ? "1" : "20"), {
          ...dependencies,
          pause,
        }),
        0,
        output.stderr,
      );
      if (rearm) {
        assert.deepEqual(observation(bench).facts, saved);
        assert.equal(observation(bench).cooldown.observedAt, 0);
        assert.equal(observation(bench).cooldown.retryAt, undefined);
        assert.equal(
          await main(waitArgs(bench.root, "10", "20"), {
            ...dependencies,
            pause,
          }),
          0,
          output.stderr,
        );
      }
      assert.deepEqual(requests, [0, 10000]);
      assert.match(output.stdout, /rate limited/);
      assert.doesNotMatch(output.stdout, /rate limited until|unavailable:/);
      assert.match(output.stdout, /labels added state:owner/);
      assert.equal(output.stderr, "");
    });
  }
});

test("status retries fresh without a supplied retryAt while preserving the wait poll time", async (t) => {
  const bench = watching(t, "example/tracker#7");
  const platform = tracker({ "example/tracker#7": {} });
  const output = capture();
  let limited = false;
  let now = 0;
  let requests = 0;
  const dependencies = {
    ...output.streams,
    connect: transportConnection,
    now: () => now,
    fetch: async (input, options) => {
      requests++;
      return limited
        ? json({ message: "API rate limit exceeded" }, 429)
        : platform.fetch(input, options);
    },
    pause: async (ms) => {
      now += ms;
    },
  };
  assert.equal(
    await main(waitArgs(bench.root, "10", "1"), dependencies),
    0,
    output.stderr,
  );
  limited = true;
  output.stdout = "";
  assert.equal(
    await main(statusArgs(bench.root), dependencies),
    0,
    output.stderr,
  );
  assert.match(output.stdout, /rate limited/);
  assert.doesNotMatch(output.stdout, /rate limited until|unavailable:/);
  assert.equal(observation(bench).trackerPollAt, 0);
  requests = 0;
  limited = false;
  assert.equal(
    await main(statusArgs(bench.root), dependencies),
    0,
    output.stderr,
  );
  assert.equal(requests, 1, "status has no interval and reads fresh on demand");
  assert.equal(observation(bench).trackerPollAt, 0);
});

test("ordinary transport failures retain unavailable status lines and fail wait", async (t) => {
  for (const command of ["status", "wait"]) {
    const bench = watching(t, "example/tracker#7");
    const output = capture();
    const code = await main(
      command === "status" ? statusArgs(bench.root) : waitArgs(bench.root),
      {
        ...output.streams,
        connect: transportConnection,
        fetch: async () => json({ message: "Server Error" }, 502),
        pause: unreachable,
      },
    );
    if (command === "status") {
      assert.equal(code, 0, output.stderr);
      assert.match(
        output.stdout,
        /unavailable: https:\/\/github.com\/example\/tracker\/issues\/7 \(GitHub answered POST .*502: Server Error\)/,
      );
      assert.doesNotMatch(output.stdout, /rate limited/);
    } else {
      assert.equal(code, 1);
      assert.match(output.stderr, /502: Server Error/);
      assert.equal(output.stdout, "");
    }
  }
});

test("GraphQL envelope and paginated rate limits stop queued batches and retain saved observations", async (t) => {
  for (const mode of [
    "initial batch",
    "follow-up page",
    "retry-after",
    "mixed envelope",
  ]) {
    const paginated = mode === "follow-up page";
    await t.test(mode, async (t) => {
      const items = {};
      const links = [];
      for (let index = 0; index < 24; index++) {
        const key = `example/tracker${index}#7`;
        links.push(key);
        items[key] = { comments: [comment(1), comment(2)], pageSize: 1 };
      }
      const bench = watching(t, links.join(" "));
      const platform = tracker(items);
      const output = capture();
      let limited = false;
      let refused = false;
      let afterRefusal = 0;
      let requests = 0;
      const dependencies = {
        ...output.streams,
        connect: transportConnection,
        now: () => Date.parse("2026-11-26T20:00:00Z"),
        fetch: async (input, options) => {
          requests++;
          if (refused) afterRefusal++;
          await new Promise((resolve) => setTimeout(resolve, 1));
          const { query } = JSON.parse(options.body);
          if (limited && (!paginated || query.includes("page0:node"))) {
            refused = true;
            return new Response(
              JSON.stringify({
                data: { repository: {} },
                errors: [
                  ...(mode === "mixed envelope"
                    ? [
                        {
                          type: "FORBIDDEN",
                          message: "One alias was forbidden",
                        },
                      ]
                    : []),
                  { type: "RATE_LIMITED", message: "API rate limit exceeded" },
                ],
              }),
              {
                status: 200,
                headers: {
                  "content-type": "application/json",
                  ...(mode === "retry-after"
                    ? { "retry-after": "10" }
                    : {
                        "x-ratelimit-remaining": "0",
                        "x-ratelimit-reset": "1795723210",
                      }),
                },
              },
            );
          }
          return platform.fetch(input, options);
        },
      };
      assert.equal(
        await main(statusArgs(bench.root), dependencies),
        0,
        output.stderr,
      );
      const saved = observation(bench).facts;
      limited = true;
      requests = 0;
      output.stdout = "";
      assert.equal(
        await main(statusArgs(bench.root), dependencies),
        0,
        output.stderr,
      );
      assert.equal(refused, true);
      assert.equal(
        afterRefusal,
        0,
        "refusal stops queued exchanges across repositories",
      );
      assert.ok(requests > 0);
      assert.match(
        output.stdout,
        /rate limited until 2026-11-26T20:00:10.000Z/,
      );
      assert.doesNotMatch(output.stdout, /unavailable:/);
      assert.deepEqual(observation(bench).facts, saved);
    });
  }
});

test("the production GitHub CLI connection forwards the supplied transport and retains its timeout", (t) => {
  const bench = workbench(t);
  const bin = bench.path("bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "gh"),
    `#!/bin/sh
[ "$*" = "auth token --hostname github.com" ] || exit 1
printf '%s\\n' 'fixture-workbench-credential'
`,
    { mode: 0o755 },
  );
  const platform = new URL(
    "../.agents/skills/babysit/platform.mjs",
    import.meta.url,
  ).href;
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `
    import assert from "node:assert/strict";
    import { connectionFor } from ${JSON.stringify(platform)};
    let requests = 0;
    let timeouts = 0;
    AbortSignal.timeout = (milliseconds) => {
      assert.equal(milliseconds, 45000);
      timeouts++;
      return new AbortController().signal;
    };
    const connection = connectionFor("example/tracker", {
      fetch: async (input, options) => {
        requests++;
        assert.equal(new URL(input).pathname, "/repos/example/tracker/issues/7");
        assert.equal(options.headers.authorization, "Bearer fixture-workbench-credential");
        return Response.json({ number: 7, state: "open" });
      },
    });
    const { data } = await connection.access.request({ path: "/repos/example/tracker/issues/7" });
    assert.equal(data.number, 7);
    assert.equal(requests, 1);
    assert.equal(timeouts, 1);
  `,
    ],
    {
      cwd: bench.root,
      encoding: "utf8",
      timeout: 5000,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.equal(result.stdout, "");
});

test("wait retries at retryAt even when its saved full-poll cadence is later", async (t) => {
  const bench = watching(t, "example/tracker#7");
  const items = { "example/tracker#7": {} };
  const platform = tracker(items);
  const output = capture();
  let now = Date.parse("2026-11-26T20:00:00Z");
  const start = now;
  let limited = false;
  const requests = [];
  const dependencies = {
    ...output.streams,
    connect: transportConnection,
    now: () => now,
    fetch: async (input, options) => {
      requests.push(now);
      return limited
        ? new Response(JSON.stringify({ message: "API rate limit exceeded" }), {
            status: 429,
            headers: {
              "content-type": "application/json",
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": String((start + 70000) / 1000),
            },
          })
        : platform.fetch(input, options);
    },
    pause: async (ms) => {
      now += ms;
    },
  };
  assert.equal(
    await main(waitArgs(bench.root, "60", "1"), dependencies),
    0,
    output.stderr,
  );
  assert.equal(observation(bench).trackerPollAt, start);
  now = start + 60000;
  limited = true;
  requests.length = 0;
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "60", "20"), {
      ...dependencies,
      pause: async (ms) => {
        assert.equal(
          ms,
          10000,
          "platform retryAt owns the next full-poll deadline",
        );
        now += ms;
        limited = false;
        items["example/tracker#7"].labels = ["state:owner"];
      },
    }),
    0,
    output.stderr,
  );
  assert.deepEqual(requests, [start + 60000, start + 70000]);
  assert.match(output.stdout, /rate limited until 2026-11-26T20:01:10.000Z/);
  assert.match(output.stdout, /labels added state:owner/);
});

test("without retryAt the refusal time owns the retry even when in-flight reads finish later", async (t) => {
  const bench = watching(t, "example/tracker#7 example/other#8");
  const items = { "example/tracker#7": {}, "example/other#8": {} };
  const platform = tracker(items);
  const output = capture();
  let now = 0;
  let limited = false;
  const requests = [];
  const dependencies = {
    ...output.streams,
    connect: transportConnection,
    now: () => now,
    fetch: async (input, options) => {
      requests.push(now);
      if (limited) {
        if (JSON.parse(options.body).variables.name === "tracker")
          return json({ message: "API rate limit exceeded" }, 429);
        await new Promise((resolve) => setImmediate(resolve));
        now += 5000;
      }
      return platform.fetch(input, options);
    },
  };
  assert.equal(
    await main(statusArgs(bench.root), dependencies),
    0,
    output.stderr,
  );
  limited = true;
  requests.length = 0;
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "10", "20"), {
      ...dependencies,
      pause: async (ms) => {
        assert.equal(
          now,
          5000,
          "another in-flight exchange completed after the refusal",
        );
        assert.equal(observation(bench).cooldown.observedAt, 0);
        assert.equal(
          ms,
          5000,
          "retry is refusal plus one interval, not pass completion plus interval",
        );
        now += ms;
        limited = false;
        items["example/tracker#7"].labels = ["state:owner"];
      },
    }),
    0,
    output.stderr,
  );
  assert.deepEqual(requests, [0, 0, 10000, 10000]);
  assert.match(output.stdout, /rate limited/);
  assert.doesNotMatch(output.stdout, /rate limited until|unavailable:/);
  assert.match(output.stdout, /labels added state:owner/);
});

test("both wait durations and the status stale threshold are required, with no built-in default", async (t) => {
  const { root } = workbench(t);
  const output = capture();
  for (const { flag, args } of [
    { flag: "--interval", args: ["wait", root, "--max-duration", "60"] },
    { flag: "--max-duration", args: ["wait", root, "--interval", "60"] },
    { flag: "--stale-after", args: ["status", root] },
  ]) {
    output.stderr = "";
    assert.equal(
      await main(args, { connect: unreachable, ...output.streams }),
      1,
    );
    assert.match(output.stderr, new RegExp(`${flag} is required`));
  }
  output.stderr = "";
  assert.equal(
    await main(["wait", root], { connect: unreachable, ...output.streams }),
    1,
  );
  assert.match(output.stderr, /--interval is required/);
  assert.match(output.stderr, /--max-duration is required/);
  for (const args of [
    [],
    ["next", root],
    ["wait", "--interval", "1", "--max-duration", "1"],
  ]) {
    output.stderr = "";
    assert.equal(
      await main(args, { connect: unreachable, ...output.streams }),
      1,
    );
    assert.match(output.stderr, /usage: workbench\.mjs/);
  }
  assert.equal(output.stdout, "");
});

test("invalid durations and options fail before reading any record", async () => {
  const output = capture();
  const missing = join(tmpdir(), "no-such-workbench");
  for (const flag of ["--interval", "--max-duration"]) {
    const other = flag === "--interval" ? "--max-duration" : "--interval";
    for (const value of [
      "0",
      "-1",
      "",
      "abc",
      "NaN",
      "Infinity",
      "-Infinity",
      "1e308",
      "--max-duration",
    ]) {
      output.stderr = "";
      assert.equal(
        await main(["wait", missing, flag, value, other, "60"], {
          connect: unreachable,
          ...output.streams,
        }),
        1,
        `${flag} ${value}`,
      );
      assert.match(
        output.stderr,
        new RegExp(`${flag} must be a finite positive number of seconds`),
        `${flag} ${value}`,
      );
    }
    output.stderr = "";
    assert.equal(
      await main(["wait", missing, other, "60", flag], {
        connect: unreachable,
        ...output.streams,
      }),
      1,
    );
    assert.match(output.stderr, new RegExp(`${flag} needs a value`));
    output.stderr = "";
    assert.equal(
      await main(["wait", missing, flag, "1", flag, "2", other, "60"], {
        connect: unreachable,
        ...output.streams,
      }),
      1,
    );
    assert.match(output.stderr, new RegExp(`${flag} is given more than once`));
  }
  for (const args of [
    ["wait", missing, "--interval", "1", "--max-duration", "1", "--budget"],
    ["status", missing, "--stale-after", "1", "--interval", "1"],
    ["status", missing, "other", "--stale-after", "1"],
  ]) {
    output.stderr = "";
    assert.equal(
      await main(args, { connect: unreachable, ...output.streams }),
      1,
    );
    assert.match(output.stderr, /unrecognized option|unexpected argument/);
  }
  assert.equal(output.stdout, "");
});

test("a row issue's state, labels, comments and linked pull requests each wake the wait", async (t) => {
  const output = capture();
  for (const { name, change, line } of [
    {
      name: "state",
      change: (item) => (item.state = "closed"),
      line: "state changed from open to closed",
    },
    {
      name: "labels",
      change: (item) => (item.labels = ["state:ready", "factory:running"]),
      line: "labels added factory:running; removed state:triage",
    },
    {
      name: "comments",
      change: (item) => item.comments.push(comment(2)),
      line: "new comment https://github.com/example/tracker/issues/7#issuecomment-2",
    },
    {
      name: "linked pull request",
      change: (item) => item.linked.push(pull(12, "OPEN")),
      line: "linked pull request https://github.com/example/tracker/pull/12 (open)",
    },
    {
      name: "linked pull request state",
      change: (item) => (item.linked[0].state = "MERGED"),
      line: "linked pull request https://github.com/example/tracker/pull/11 changed from open to merged",
    },
  ]) {
    output.stdout = "";
    const { root } = watching(t, `[#7](${issue(7)})`);
    const items = {
      "example/tracker#7": {
        labels: ["state:ready", "state:triage"],
        comments: [comment(1)],
        linked: [pull(11, "OPEN")],
      },
    };
    let pauses = 0;
    let elapsed = 0;
    const code = await main(waitArgs(root), {
      ...output.streams,
      connect: tracker(items).connect,
      now: () => elapsed,
      pause: async (ms) => {
        elapsed += ms;
        pauses += 1;
        if (pauses === 2) change(items["example/tracker#7"]);
      },
    });
    assert.equal(code, 0, name + output.stderr);
    assert.equal(output.stdout, `${issue(7)}: ${line}\n`, name);
    assert.equal(pauses, 2, name);
  }
});

test("a poll reports every removed link alongside additions and state changes", async (t) => {
  for (const { name, after, lines } of [
    {
      name: "all links removed",
      after: [],
      lines: [
        "linked pull request https://github.com/example/tracker/pull/11 removed",
        "linked pull request https://github.com/example/tracker/pull/12 removed",
        "linked pull request https://github.com/example/tracker/pull/13 removed",
      ],
    },
    {
      name: "removal, addition and state change",
      after: [pull(12, "MERGED"), pull(13, "OPEN"), pull(14, "OPEN")],
      lines: [
        "linked pull request https://github.com/example/tracker/pull/12 changed from open to merged",
        "linked pull request https://github.com/example/tracker/pull/14 (open)",
        "linked pull request https://github.com/example/tracker/pull/11 removed",
      ],
    },
  ]) {
    await t.test(name, async (t) => {
      const output = capture();
      const { root } = watching(t, `example/tracker#7`);
      const item = {
        linked: [pull(11, "OPEN"), pull(12, "OPEN"), pull(13, "OPEN")],
      };
      let elapsed = 0;
      let pauses = 0;
      assert.equal(
        await main(waitArgs(root, "1", "3"), {
          ...output.streams,
          connect: tracker({ "example/tracker#7": item }).connect,
          now: () => elapsed,
          pause: async (ms) => {
            elapsed += ms;
            pauses++;
            item.linked = after;
          },
        }),
        0,
        output.stderr,
      );
      assert.equal(
        output.stdout,
        lines.map((line) => `${issue(7)}: ${line}\n`).join(""),
      );
      assert.equal(pauses, 1);
    });
  }
});

test("unchanged links and order-only changes stay quiet until the deadline", async (t) => {
  const output = capture();
  const { root } = watching(t, `[#7](${issue(7)})`);
  const item = { linked: [pull(11, "OPEN"), pull(12, "MERGED")] };
  let elapsed = 0;
  let pauses = 0;
  assert.equal(
    await main(waitArgs(root, "1", "3"), {
      ...output.streams,
      connect: tracker({ "example/tracker#7": item }).connect,
      now: () => elapsed,
      pause: async (ms) => {
        elapsed += ms;
        pauses++;
        if (pauses === 2) item.linked.reverse();
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(pauses, 3);
  assert.equal(
    output.stdout,
    "no item changed within the maximum duration of 3 seconds; arm the wait again\n",
  );
});

test("a pull request on a row reports merging, labels and comments, and reads no linked pull requests", async (t) => {
  const output = capture();
  const { root } = watching(t, "https://github.com/example/tracker/pull/12");
  const items = {
    "example/tracker#12": { pull: true, labels: [], comments: [] },
  };
  const { connect, requests } = tracker(items);
  const code = await main(waitArgs(root), {
    ...output.streams,
    connect,
    pause: async () => {
      Object.assign(items["example/tracker#12"], {
        state: "closed",
        mergedAt: "2026-10-30T11:00:00Z",
        labels: ["released"],
        comments: [comment(3)],
      });
    },
  });
  assert.equal(code, 0, output.stderr);
  assert.deepEqual(output.stdout.trimEnd().split("\n"), [
    "https://github.com/example/tracker/pull/12: state changed from open to merged",
    "https://github.com/example/tracker/pull/12: labels added released",
    "https://github.com/example/tracker/pull/12: new comment https://github.com/example/tracker/issues/7#issuecomment-3",
  ]);
  assert.ok(requests.every((path) => path === "/graphql"));
});

test("pull request head and raw check and status sets wake without success policy", async (t) => {
  const head = "a".repeat(40);
  const run = (id, status = "in_progress", conclusion = null) => ({
    id,
    name: "Test",
    status,
    conclusion,
  });
  for (const change of [
    (item) => (item.head = "b".repeat(40)),
    (item) => item.runs.pop(),
    (item) => (item.runs[0] = run(2, "completed", "failure")),
    (item) => (item.statuses = []),
    (item) => (item.statuses[0].state = "success"),
  ]) {
    const output = capture();
    const { root } = watching(t, "example/tracker#12");
    const item = {
      pull: true,
      head,
      runs: [run(2), run(1)],
      statuses: [{ id: 3, context: "deploy", state: "pending" }],
    };
    let pauses = 0;
    let elapsed = 0;
    assert.equal(
      await main(waitArgs(root), {
        ...output.streams,
        connect: tracker({ "example/tracker#12": item }).connect,
        now: () => elapsed,
        pause: async (ms) => {
          elapsed += ms;
          pauses++;
          if (pauses === 1) item.runs.reverse();
          if (pauses === 2) change(item);
        },
      }),
      0,
      output.stderr,
    );
    assert.equal(pauses, 2);
    assert.match(output.stdout, /: (?:head|checks) changed from/);
  }
});

test("only the changed item is reported among several rows and plans", async (t) => {
  const output = capture();
  const { root } = workbench(t, {
    plans: {
      review: planText({ rows: [row("one", "example/tracker#7")] }),
      audit: planText({
        rows: [row("two", `[other#3](${issue(3, "example/other")})`)],
      }),
    },
  });
  const items = {
    "example/tracker#7": { comments: [] },
    "example/other#3": { comments: [] },
  };
  const code = await main(waitArgs(root), {
    ...output.streams,
    connect: tracker(items).connect,
    pause: async () => (items["example/other#3"].labels = ["state:reporter"]),
  });
  assert.equal(code, 0, output.stderr);
  assert.equal(
    output.stdout,
    `${issue(3, "example/other")}: labels added state:reporter\n`,
  );
});

test("record edits and incoming messages wake the wait; ended rows are not watched", async (t) => {
  const output = capture();
  for (const { name, change, line } of [
    {
      name: "plan",
      change: (bench) =>
        bench.write("review/plan.md", planText({ done: ["Edited."] })),
      line: "review/plan.md: changed",
    },
    {
      name: "log",
      change: (bench) => bench.write("review/log.md", "# Log\n\n- entry\n"),
      line: "review/log.md: changed",
    },
    {
      name: "inbox",
      change: (bench) =>
        bench.write("inbox.md", `${emptyInbox}\n### An answer\n`),
      line: "inbox.md: changed",
    },
    {
      name: "index",
      change: (bench) =>
        bench.write(
          "index.md",
          indexText(["review"]).replace("thread-a", "thread-b"),
        ),
      line: "index.md: changed",
    },
    {
      name: "incoming created with its directory",
      change: (bench) =>
        bench.write("incoming/20261103T100000Z-alice.md", "A message.\n"),
      line: "incoming/: file 20261103T100000Z-alice.md created",
    },
  ]) {
    output.stdout = "";
    const bench = workbench(t, {
      plans: {
        review: planText({
          rows: [row("ended", "example/tracker#7", "closed 2026-11-01")],
        }),
      },
    });
    const code = await main(waitArgs(bench.root), {
      ...output.streams,
      connect: unreachable,
      pause: async () => change(bench),
    });
    assert.equal(code, 0, name + output.stderr);
    assert.equal(output.stdout, `${line}\n`, name);
  }
  const bench = workbench(t);
  const message = "incoming/20261103T100000Z-alice.md";
  bench.write(message, "A message.\n");
  for (const { change, how } of [
    {
      change: () => bench.write(message, "A longer message.\n"),
      how: "changed",
    },
    { change: () => unlinkSync(bench.path(message)), how: "removed" },
  ]) {
    output.stdout = "";
    assert.equal(
      await main(waitArgs(bench.root), {
        ...output.streams,
        connect: unreachable,
        pause: async () => change(),
      }),
      0,
      output.stderr,
    );
    assert.equal(
      output.stdout,
      `incoming/: file 20261103T100000Z-alice.md ${how}\n`,
    );
  }
});

const brief = (report) =>
  `# Review launch\n\nLaunch report: \`${report}\`\n\n## Context\n\nCheck the guide.\n\nstatus: done\n`;

test("launch reports wake only at their exact final line until the plan's log names them", async (t) => {
  for (const ending of ["status: done", "status: done\n", "status: done\r\n"]) {
    const bench = workbench(t);
    bench.write("review/brief-01.md", brief("report-01.md"));
    const report = bench.path("review/report-01.md");
    const output = capture();
    let pauses = 0;
    assert.equal(
      await main(waitArgs(bench.root), {
        ...output.streams,
        connect: unreachable,
        pause: async () => {
          pauses++;
          if (pauses === 1) writeFileSync(report, "progress\n");
          if (pauses === 2)
            writeFileSync(report, "status: done\nlater content\n");
          if (pauses === 3) unlinkSync(report);
          if (pauses === 4) writeFileSync(report, "status: done\n\n");
          if (pauses === 5)
            writeFileSync(report, `Owner steps remain.\n${ending}`);
        },
      }),
      0,
      output.stderr,
    );
    assert.equal(pauses, 5);
    assert.equal(output.stdout, "finished: read review/report-01.md\n");
    // A finished report wakes at once until the log names it.
    output.stdout = "";
    assert.equal(
      await main(waitArgs(bench.root), {
        ...output.streams,
        connect: unreachable,
        pause: unreachable,
      }),
      0,
    );
    assert.equal(output.stdout, "finished: read review/report-01.md\n");
    bench.write("review/log.md", "# Log\n\n- Consumed report-01.md.\n");
    output.stdout = "";
    assert.equal(
      await main(waitArgs(bench.root), {
        ...output.streams,
        connect: unreachable,
        pause: unreachable,
      }),
      0,
    );
    assert.equal(output.stdout, "review/log.md: changed\n");
  }
});

test("a log consumes a report only by its whole file name", async (t) => {
  const bench = workbench(t);
  bench.write("review/brief-01.md", brief("report-01.md"));
  bench.write("review/report-01.md", "status: done\n");
  bench.write("review/log.md", "# Log\n\n- Consumed grill-report-01.md.\n");
  const output = capture();
  assert.equal(
    await main(waitArgs(bench.root), {
      ...output.streams,
      connect: unreachable,
      pause: unreachable,
    }),
    0,
    output.stderr,
  );
  assert.equal(output.stdout, "finished: read review/report-01.md\n");
});

test("reloading records drops an ended row's watch and keeps other baselines", async (t) => {
  const bench = workbench(t, {
    plans: {
      review: planText({
        rows: [row("a", "example/tracker#7"), row("b", "example/tracker#8")],
      }),
    },
  });
  const items = {
    "example/tracker#7": { comments: [] },
    "example/tracker#8": { comments: [] },
    "example/tracker#9": { comments: [] },
  };
  const { connect } = tracker(items);
  const output = capture();
  let pauses = 0;
  assert.equal(
    await main(waitArgs(bench.root), {
      ...output.streams,
      connect,
      pause: async () => {
        pauses++;
        if (pauses !== 1) return;
        bench.write(
          "review/plan.md",
          planText({
            rows: [
              row("a", "example/tracker#7"),
              row("b", "example/tracker#8", "closed"),
              row("c", "example/tracker#9"),
            ],
          }),
        );
        items["example/tracker#8"].labels = ["state:owner"];
      },
    }),
    0,
    output.stderr,
  );
  // The ended row's change is not reported; the added row starts its baseline.
  assert.equal(output.stdout, "review/plan.md: changed\n");
  output.stdout = "";
  pauses = 0;
  assert.equal(
    await main(waitArgs(bench.root), {
      ...output.streams,
      connect,
      pause: async () => {
        pauses++;
        if (pauses !== 1) return;
        items["example/tracker#7"].comments.push(comment(2));
        items["example/tracker#8"].comments.push(comment(3));
        items["example/tracker#9"].labels = ["state:ready"];
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(
    output.stdout,
    `${issue(7)}: new comment https://github.com/example/tracker/issues/7#issuecomment-2\n${issue(9)}: labels added state:ready\n`,
  );
});

test("reloading records watches new launches without restarting the deadline", async (t) => {
  const output = capture();
  const bench = watching(t, "example/tracker#7");
  const { connect } = tracker({ "example/tracker#7": { comments: [] } });
  let pauses = 0;
  assert.equal(
    await main(waitArgs(bench.root), {
      ...output.streams,
      connect,
      pause: async () => {
        pauses++;
        if (pauses === 1)
          bench.write("review/brief-02.md", brief("report-02.md"));
        if (pauses === 2) bench.write("review/report-02.md", "status: done\n");
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(pauses, 2);
  assert.equal(output.stdout, "finished: read review/report-02.md\n");
  // An added launch that already finished wakes at once.
  output.stdout = "";
  bench.write("review/brief-03.md", brief("report-03.md"));
  bench.write("review/report-03.md", "status: done\n");
  bench.write("review/log.md", "# Log\n\n- report-02.md consumed.\n");
  assert.equal(
    await main(waitArgs(bench.root), {
      ...output.streams,
      connect,
      pause: unreachable,
    }),
    0,
  );
  assert.equal(
    output.stdout,
    "review/log.md: changed\nfinished: read review/report-03.md\n",
  );
  // Reloads keep the overall deadline.
  bench.write("review/log.md", "# Log\n\n- report-02.md and report-03.md.\n");
  await main(
    ["status", bench.root, "--stale-after", "60", "--stages", installedStages],
    { connect },
  );
  let elapsed = 0;
  pauses = 0;
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "1", "3"), {
      ...output.streams,
      connect,
      now: () => elapsed,
      pause: async (ms) => {
        elapsed += ms;
        pauses++;
        bench.write(
          `review/brief-1${pauses}.md`,
          brief(`report-1${pauses}.md`),
        );
      },
    }),
    0,
    output.stderr,
  );
  assert.equal(pauses, 3);
  assert.match(output.stdout, /maximum duration of 3 seconds/);
});

test("invalid records fail the wait by name and show as unavailable in status", async (t) => {
  for (const { name, change, pattern } of [
    {
      name: "no index",
      change: (bench) => unlinkSync(bench.path("index.md")),
      pattern: /index\.md: missing/,
    },
    {
      name: "no Active section",
      change: (bench) => bench.write("index.md", "# Workbench\n"),
      pattern: /index\.md: no Active section/,
    },
    {
      name: "no plan",
      change: (bench) => unlinkSync(bench.path("review/plan.md")),
      pattern: /review\/plan\.md: missing/,
    },
    {
      name: "no Tickets table",
      change: (bench) =>
        bench.write("review/plan.md", "**Done means:**\n\n1. Done.\n"),
      pattern: /review\/plan\.md: no Tickets table/,
    },
    {
      name: "no numbered Done means",
      change: (bench) =>
        bench.write(
          "review/plan.md",
          planText().replace(/\*\*Done means:\*\*\n\n1\./, "**Done means:** a"),
        ),
      pattern: /review\/plan\.md: no numbered Done means/,
    },
    {
      name: "no Open inbox section",
      change: (bench) => bench.write("inbox.md", "# Inbox\n"),
      pattern: /inbox\.md: no Open section/,
    },
  ]) {
    const bench = workbench(t);
    change(bench);
    const output = capture();
    assert.equal(
      await main(waitArgs(bench.root), {
        ...output.streams,
        connect: unreachable,
        pause: unreachable,
      }),
      1,
      name,
    );
    assert.match(output.stderr, /^workbench\.mjs: /, name);
    assert.match(output.stderr, pattern, name);
    assert.equal(output.stdout, "", name);
    assert.equal(
      await main(
        [
          "status",
          bench.root,
          "--stale-after",
          "60",
          "--stages",
          installedStages,
        ],
        {
          ...output.streams,
          connect: unreachable,
        },
      ),
      0,
      name,
    );
    assert.match(output.stdout, /^Orchestrator: /, name);
    assert.match(
      output.stdout,
      new RegExp(`- unavailable: ${pattern.source.replace(": ", " \\(")}`),
      name,
    );
  }
  // A record broken while waiting is an error, never stale coverage.
  const bench = workbench(t);
  const output = capture();
  assert.equal(
    await main(waitArgs(bench.root), {
      ...output.streams,
      connect: unreachable,
      pause: async () => bench.write("index.md", "# broken\n"),
    }),
    1,
  );
  assert.match(output.stderr, /index\.md: no Active section/);
  assert.equal(output.stdout, "");
});

// A bare upstream, the orchestrator's workbench clone and a sender's clone.
function workbenches(t) {
  const root = mkdtempSync(join(tmpdir(), "orchestrate-workbench-git-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const upstream = join(root, "upstream.git");
  const bench = join(root, "workbench");
  const sender = join(root, "sender");
  git(root, "init", "--quiet", "--bare", "--initial-branch=main", upstream);
  git(root, "clone", "--quiet", upstream, bench);
  workbench(t, { root: bench });
  git(bench, "add", "--all");
  git(bench, "commit", "--quiet", "--message", "Seed the workbench");
  git(bench, "push", "--quiet", "--set-upstream", "origin", "main");
  git(root, "clone", "--quiet", upstream, sender);
  return { upstream, workbench: bench, sender };
}

// Commits a sender's file and pushes it, returning the commit.
function push(sender, path, text) {
  mkdirSync(join(sender, path, ".."), { recursive: true });
  writeFileSync(join(sender, path), text);
  git(sender, "add", path);
  git(sender, "commit", "--quiet", "--message", `Write ${path}`);
  git(sender, "push", "--quiet", "origin", "main");
  return git(sender, "rev-parse", "HEAD");
}

test("an upstream commit touching a watched record wakes the wait, and other commits do not", async (t) => {
  for (const path of ["incoming/20261103T100000Z-bob.md", "review/log.md"]) {
    const output = capture();
    const { workbench, sender } = workbenches(t);
    let pauses = 0;
    let elapsed = 0;
    let message;
    const code = await main(waitArgs(workbench), {
      ...output.streams,
      connect: unreachable,
      now: () => elapsed,
      pause: async (ms) => {
        elapsed += ms;
        pauses += 1;
        if (pauses === 1) push(sender, "wishes.md", "- A wish.\n");
        if (pauses === 2) message = push(sender, path, "Hi.\n");
      },
    });
    assert.equal(code, 0, output.stderr);
    assert.equal(pauses, 2);
    assert.equal(output.stdout, `upstream commit ${message} not yet pulled\n`);
    // The wait fetches but never merges into the workbench checkout.
    assert.notEqual(
      readFileSync(join(workbench, "review/log.md"), "utf8"),
      "Hi.\n",
    );
    assert.equal(existsSync(join(workbench, "incoming")), false);
  }
});

test("the maximum-duration pass still fetches the upstream between intervals", async (t) => {
  const output = capture();
  const { workbench, sender } = workbenches(t);
  const pauses = [];
  let elapsed = 0;
  let message;
  const code = await main(waitArgs(workbench, "10", "15"), {
    ...output.streams,
    connect: unreachable,
    now: () => elapsed,
    pause: async (ms) => {
      elapsed += ms;
      pauses.push(ms);
      if (pauses.length === 2) message = push(sender, "review/log.md", "Hi.\n");
    },
  });
  assert.equal(code, 0, output.stderr);
  assert.deepEqual(pauses, [10_000, 5_000]);
  assert.equal(output.stdout, `upstream commit ${message} not yet pulled\n`);
});

test("an upstream message fetched but not pulled before arming wakes the wait, and pulling it shows the message", async (t) => {
  const output = capture();
  const { workbench, sender } = workbenches(t);
  const earlier = push(sender, "incoming/20261103T090000Z-bob.md", "Hi.\n");
  git(workbench, "fetch", "--quiet", "origin");
  const code = await main(waitArgs(workbench), {
    ...output.streams,
    connect: unreachable,
    pause: unreachable,
  });
  assert.equal(code, 0, output.stderr);
  assert.equal(output.stdout, `upstream commit ${earlier} not yet pulled\n`);

  output.stdout = "";
  git(workbench, "pull", "--quiet", "--ff-only");
  const pulled = await main(waitArgs(workbench), {
    ...output.streams,
    connect: unreachable,
    pause: unreachable,
  });
  assert.equal(pulled, 0, output.stderr);
  assert.equal(
    output.stdout,
    "incoming/: file 20261103T090000Z-bob.md created\n",
  );
});

test("an upstream commit only below incoming's own files does not wake the wait", async (t) => {
  const output = capture();
  const { workbench, sender } = workbenches(t);
  let pauses = 0;
  const code = await main(waitArgs(workbench, "0.02", "0.3"), {
    ...output.streams,
    connect: unreachable,
    pause: async (milliseconds) => {
      pauses += 1;
      if (pauses === 1)
        push(sender, "incoming/archive/20261103T090000Z-bob.md", "Old.\n");
      await new Promise((resolve) => setTimeout(resolve, milliseconds));
    },
  });
  assert.equal(code, 0, output.stdout + output.stderr);
  assert.match(output.stdout, /^no item changed/);
});

test("a failed upstream fetch while polling is an error", async (t) => {
  const output = capture();
  const { upstream, workbench } = workbenches(t);
  const code = await main(waitArgs(workbench), {
    ...output.streams,
    connect: unreachable,
    pause: async () => rmSync(upstream, { recursive: true, force: true }),
  });
  assert.equal(code, 1);
  assert.match(output.stderr, /^workbench\.mjs: git fetch origin failed/);
  assert.equal(output.stdout, "");
});

test("the maximum duration ends an unchanged wait with exit zero", async (t) => {
  const output = capture();
  const { root } = watching(t, "example/tracker#7");
  const { connect } = tracker({ "example/tracker#7": { comments: [] } });
  const startedAt = Date.now();
  const code = await main(waitArgs(root, "0.02", "0.1"), {
    connect,
    ...output.streams,
  });
  assert.equal(code, 0, output.stderr);
  assert.ok(Date.now() - startedAt >= 100);
  assert.equal(
    output.stdout,
    "no item changed within the maximum duration of 0.1 seconds; arm the wait again\n",
  );
});

test("a platform failure at arming or while polling is an error", async (t) => {
  const output = capture();
  for (const failAt of [1, 2]) {
    output.stderr = "";
    const { root } = watching(t, "example/tracker#7");
    const items = { "example/tracker#7": { comments: [] } };
    if (failAt === 1) items.fail = true;
    const code = await main(waitArgs(root), {
      ...output.streams,
      connect: tracker(items).connect,
      pause: async () => (items.fail = true),
    });
    assert.equal(code, 1, `read ${failAt}`);
    assert.match(output.stderr, /^workbench\.mjs: /, `read ${failAt}`);
  }
  output.stderr = "";
  const { root } = watching(t, "example/missing#1");
  assert.equal(
    await main(waitArgs(root), {
      connect: tracker({}).connect,
      ...output.streams,
    }),
    1,
  );
  assert.match(output.stderr, /^workbench\.mjs: /);
  assert.equal(output.stdout, "");
});

test("the installed script runs with plain node and reports each exit", (t) => {
  const { root } = workbench(t);
  const run = (...args) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: "utf8",
      input: "Check the guide.\n",
      timeout: 30_000,
    });
  const usage = run();
  assert.equal(usage.status, 1);
  assert.match(usage.stderr, /^usage: workbench\.mjs/);
  const stages = fileURLToPath(
    new URL("../.repo-standards/rules/factory-workflow.md", import.meta.url),
  );
  const generated = run(
    "brief",
    "Review",
    "example/tracker",
    "--plan",
    "review",
    "--row",
    "check",
    "--model",
    "m@high",
    "--reason",
    "A reason.",
    "--stages",
    stages,
  );
  assert.equal(generated.status, 0, generated.stderr);
  assert.match(generated.stdout, /\n## Context\n\nCheck the guide\.\n/);
  const status = run(
    "status",
    ".",
    "--stale-after",
    "86400",
    "--stages",
    stages,
  );
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /^Orchestrator: thread-a\n/);
  const timeout = run(
    "wait",
    ".",
    "--interval",
    "0.05",
    "--max-duration",
    "0.2",
  );
  assert.equal(timeout.status, 0, timeout.stderr);
  assert.match(timeout.stdout, /^no item changed within the maximum duration/);
});

test("status groups every item by who moves next, with its link and plan/row", async (t) => {
  const done = [
    `The guide is reviewed. met [#10](${issue(10)})`,
    "The glossary is audited.",
    "The owner confirms the example. met <https://example.com/answer>",
  ];
  const bench = workbench(t, {
    plans: {
      review: planText({
        done,
        rows: [
          row("intake", `[#1](${issue(1)})`),
          row("grill", "example/tracker#2"),
          row("owner", issue(3)),
          row("pickup", issue(4)),
          row("delivery", `${issue(5)}, ${issue(6).replace("issues", "pull")}`),
          row("reporter", issue(8)),
          row("carried", issue(9)),
          row("finished", `${issue(10)} and ${issue(1)}#issuecomment-1`),
          row("ended", issue(11), "closed by PR 12"),
          row("unlabeled", issue(13)),
          row("broken", issue(14)),
          row("local", "[01](../issues/01.md)"),
        ],
      }),
      audit: planText({ done: ["Audited."] }),
    },
  });
  bench.write(
    "inbox.md",
    "# Inbox\n\n## Open\n\n### Approve staging access?\n\nPlan: review/pickup\nRecommendation: approve.\n\n### Pick a caption\n\n## Answered\n\n### Old question\n",
  );
  bench.write("incoming/20261120T100000Z-alice.md", "A message.\n");
  for (const name of ["a", "b", "c"])
    bench.write(`review/brief-${name}.md`, brief(`report-${name}.md`));
  bench.write("review/report-a.md", "Done.\nstatus: done\n");
  bench.write("review/report-b.md", "Working.\n");
  bench.write("review/report-c.md", "status: done\n");
  bench.write("review/log.md", "# Log\n\n- Consumed report-c.md.\n");
  const items = {
    "example/tracker#1": { labels: ["state:triage"] },
    "example/tracker#2": { labels: ["state:grill"] },
    "example/tracker#3": { labels: ["state:owner"] },
    "example/tracker#4": {
      labels: ["state:ready"],
      updatedAt: "2026-11-01T00:00:00Z",
    },
    "example/tracker#5": {
      labels: ["state:ready"],
      linked: [pull(15, "OPEN")],
    },
    "example/tracker#6": { pull: true },
    "example/tracker#8": { labels: ["state:reporter"] },
    "example/tracker#9": { labels: ["state:carried"] },
    "example/tracker#10": { state: "closed" },
    "example/tracker#13": {},
  };
  const output = capture();
  assert.equal(
    await main(
      [
        "status",
        bench.root,
        "--stale-after",
        "172800",
        "--stages",
        installedStages,
      ],
      {
        ...output.streams,
        connect: tracker(items).connect,
        now: () => Date.parse("2026-11-20T00:00:00Z"),
      },
    ),
    0,
    output.stderr,
  );
  assert.equal(
    output.stdout,
    `Orchestrator: thread-a
review/plan.md · Done means ●○●
audit/plan.md · Done means ○

My move
- ${issue(1)} state:triage · review/intake, review/finished
- ${issue(2)} start or resume its Grill session with \`grill-with-docs\` · review/grill
- ${issue(13)} no state the rules place · review/unlabeled
- unavailable: ${issue(14)} (GitHub returned incomplete tracker example/tracker#14) · review/broken
- review/report-a.md finished; read the report · review/brief-a.md
- incoming/20261120T100000Z-alice.md message · —
Owner's move
- ${issue(3)} state:owner · review/owner
- inbox.md#approve-staging-access Approve staging access? · review/pickup
- inbox.md#pick-a-caption Pick a caption · —
Running
- review/report-b.md report pending · review/brief-b.md
Waiting quietly: 1 state:ready (pickup), 2 open pull request (delivery), 2 state:reporter or state:carried (third party)
Stale (unchanged for over 172800 seconds)
- ${issue(4)} unchanged since 2026-11-01T00:00:00Z · review/pickup
`,
  );
  // Once every linked issue on a row closes, the row is the orchestrator's.
  items["example/tracker#1"].state = "closed";
  output.stdout = "";
  await main(
    [
      "status",
      bench.root,
      "--stale-after",
      "172800",
      "--stages",
      installedStages,
    ],
    {
      ...output.streams,
      connect: tracker(items).connect,
      now: () => Date.parse("2026-11-20T00:00:00Z"),
    },
  );
  for (const code of ["intake", "finished"])
    assert.match(
      output.stdout,
      new RegExp(
        `^- review/plan\\.md every linked issue closed; end the row · review/${code}$`,
        "m",
      ),
    );
  assert.doesNotMatch(output.stdout, /state:triage/);
});

test("status reads no tracker for local rows and names a missing orchestrator", async (t) => {
  const bench = workbench(t, {
    plans: { review: planText({ rows: [row("local", "[01](01.md)")] }) },
  });
  bench.write(
    "index.md",
    indexText(["review"]).replace(/^Orchestrator:.*\n/m, ""),
  );
  const output = capture();
  assert.equal(
    await main(
      [
        "status",
        bench.root,
        "--stale-after",
        "60",
        "--stages",
        installedStages,
      ],
      {
        ...output.streams,
        connect: unreachable,
      },
    ),
    0,
    output.stderr,
  );
  assert.equal(
    output.stdout,
    `Orchestrator: unavailable: index.md (no Orchestrator: line)
review/plan.md · Done means ○

My move
- none
Owner's move
- none
Running
- none
Waiting quietly: 0 state:ready (pickup), 0 open pull request (delivery), 0 state:reporter or state:carried (third party)
Stale (unchanged for over 60 seconds)
- none
`,
  );
});

test("status saves its observation, so the wait wakes at once for a change before arming", async (t) => {
  const bench = watching(t, "example/tracker#7");
  const items = { "example/tracker#7": { labels: ["state:ready"] } };
  const output = capture();
  const status = () =>
    main(
      [
        "status",
        bench.root,
        "--stale-after",
        "60",
        "--stages",
        installedStages,
      ],
      {
        ...output.streams,
        connect: tracker(items).connect,
      },
    );
  assert.equal(await status(), 0, output.stderr);
  assert.ok(existsSync(join(bench.root, ".git/workbench-observation.json")));
  assert.doesNotMatch(
    git(bench.root, "status", "--porcelain", "--untracked-files=all"),
    /observation/,
    "the observation file is never part of the checkout",
  );
  items["example/tracker#7"].labels = ["state:owner"];
  bench.write("incoming/20261120T100000Z-bob.md", "Hi.\n");
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root), {
      ...output.streams,
      connect: tracker(items).connect,
      pause: unreachable,
    }),
    0,
    output.stderr,
  );
  assert.deepEqual(output.stdout.trimEnd().split("\n"), [
    "incoming/: file 20261120T100000Z-bob.md created",
    `${issue(7)}: labels added state:owner; removed state:ready`,
  ]);
  // The wait saved what it saw: re-arming stays quiet.
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "0.01", "0.03"), {
      ...output.streams,
      connect: tracker(items).connect,
    }),
    0,
  );
  assert.match(output.stdout, /^no item changed/);
  // Without a saved observation, the wait takes first-read baselines.
  rmSync(join(bench.root, ".git/workbench-observation.json"));
  bench.write("incoming/20261120T110000Z-bob.md", "Again.\n");
  items["example/tracker#7"].labels = [];
  output.stdout = "";
  assert.equal(
    await main(waitArgs(bench.root, "0.01", "0.03"), {
      ...output.streams,
      connect: tracker(items).connect,
    }),
    0,
  );
  assert.match(output.stdout, /^no item changed/);
});

// Real file-system events wake the wait long before its 60-second poll.
test("file events wake the wait within a bound well below its interval", async (t) => {
  for (const { name, change, line } of [
    {
      name: "finished launch report",
      change: (bench) =>
        bench.write("review/report-01.md", "Done.\nstatus: done\n"),
      line: "finished: read review/report-01.md",
    },
    {
      name: "new incoming message",
      change: (bench) =>
        bench.write("incoming/20261120T100000Z-carol.md", "Hi.\n"),
      line: "incoming/: file 20261120T100000Z-carol.md created",
    },
    {
      name: "record edit",
      change: (bench) =>
        bench.write("review/plan.md", planText({ done: ["Edited."] })),
      line: "review/plan.md: changed",
    },
  ]) {
    const bench = workbench(t);
    bench.write("review/brief-01.md", brief("report-01.md"));
    const output = capture();
    const startedAt = Date.now();
    setTimeout(() => change(bench), 200);
    assert.equal(
      await main(waitArgs(bench.root, "60", "120"), {
        ...output.streams,
        connect: unreachable,
      }),
      0,
      name + output.stderr,
    );
    assert.equal(output.stdout, `${line}\n`, name);
    assert.ok(Date.now() - startedAt < 10_000, name);
  }
});

const installedStages = fileURLToPath(
  new URL("../.repo-standards/rules/factory-workflow.md", import.meta.url),
);

// The installed Canonical stages rows, as stage name and raw Hand skill cell.
const stageRows = () => {
  const table = marked
    .lexer(readFileSync(installedStages, "utf8"))
    .find((token) => token.type === "table");
  assert.ok(table?.type === "table");
  const skill = table.header.findIndex((cell) => cell.text === "Hand skill");
  return table.rows.map((row) => ({
    stage: row[0].text,
    skill: row[skill].text,
    named: row[skill].tokens.some((token) => token.type === "codespan"),
  }));
};

const briefArgs = (plan, stage, target, extra = {}) => {
  const options = {
    "--plan": plan,
    "--row": "routing",
    "--model": "claude-opus-5-5@high",
    "--reason": "Writing-heavy work the guidance gives Opus.",
    "--stages": installedStages,
    ...extra,
  };
  return [
    "brief",
    stage,
    target,
    ...Object.entries(options).flatMap(([flag, value]) =>
      value === undefined ? [] : [flag, value],
    ),
  ];
};

// Runs brief with the Context on its standard input on 2026-11-20.
const runBrief = async (
  args,
  context = "Route the guide's grill.\n",
  dependencies = {},
) => {
  const output = capture();
  const code = await main(args, {
    ...output.streams,
    connect: unreachable,
    input: async () => context,
    now: () => Date.parse("2026-11-20T09:30:00Z"),
    ...dependencies,
  });
  return { code, ...output };
};

// The header fields a generated brief starts with, by name.
const fields = (text) =>
  Object.fromEntries(
    text
      .split("\n## Context\n")[0]
      .split("\n")
      .flatMap((line) => {
        const match = /^([A-Z][\w/ ]*): (.*)$/.exec(line);
        return match ? [[match[1], match[2]]] : [];
      }),
  );

test("brief writes and prints each hand-skill stage's brief, copying its skill cell and deriving the report", async (t) => {
  const bench = workbench(t);
  const plan = bench.path("review");
  const stages = stageRows().filter(({ named }) => named);
  assert.ok(stages.length > 5);
  for (const { stage, skill } of stages) {
    const { code, stdout, stderr } = await runBrief(
      briefArgs(plan, stage, "example/tracker#12"),
      undefined,
      { connect: tracker({ "example/tracker#12": {} }).connect },
    );
    assert.equal(code, 0, `${stage}: ${stderr}`);
    const slug = stage.toLowerCase().replaceAll(" ", "-");
    const name = `brief-${slug}-example-tracker-12-2026-11-20`;
    assert.equal(readFileSync(join(plan, `${name}.md`), "utf8"), stdout);
    const header = fields(stdout);
    assert.equal(header.Operation, stage);
    assert.equal(header.Skill, skill);
    assert.equal(header.Target, "example/tracker#12");
    assert.equal(header["Plan/row"], "review/routing");
    assert.match(header.Workspace, /fresh worktree of example\/tracker\b/);
    assert.match(header.Model, /^claude-opus-5-5@high\b.*Writing-heavy work/);
    assert.equal(header["Launch report"], join(plan, `${name}-report.md`));
    assert.equal(header["Final line"], "status: done");
    assert.ok(!existsSync(header["Launch report"]));
    const [, context] = stdout.split("\n## Context\n");
    assert.equal(context, "\nRoute the guide's grill.\n\nstatus: done\n");
  }
});

test("brief never names an existing brief or report, numbering the name instead", async (t) => {
  const bench = workbench(t);
  const plan = bench.path("review");
  const name = "brief-grill-routing-2026-11-20";
  bench.write(`review/${name}.md`, "An earlier brief.\n");
  bench.write(`review/${name}-2-report.md`, "An orphaned report.\n");
  const { code, stdout, stderr } = await runBrief(
    briefArgs(plan, "Grill", "routing"),
  );
  assert.equal(code, 0, stderr);
  assert.equal(
    readFileSync(bench.path(`review/${name}.md`), "utf8"),
    "An earlier brief.\n",
  );
  assert.equal(
    fields(stdout)["Launch report"],
    join(plan, `${name}-3-report.md`),
  );
  assert.equal(readFileSync(join(plan, `${name}-3.md`), "utf8"), stdout);
  const again = await runBrief(briefArgs(plan, "Grill", "routing"));
  assert.equal(
    fields(again.stdout)["Launch report"],
    join(plan, `${name}-4-report.md`),
  );
});

test("a Close brief gives the retro no worktree and an architecture review its repository's worktree", async (t) => {
  const bench = workbench(t);
  const plan = bench.path("review");
  const close = { "--row": "Close reviews" };
  const retro = await runBrief(briefArgs(plan, "Close", "retro", close));
  assert.equal(retro.code, 0, retro.stderr);
  const header = fields(retro.stdout);
  assert.match(header.Skill, /`retro`/);
  assert.equal(header["Plan/row"], "review/Close reviews");
  assert.doesNotMatch(header.Workspace, /worktree of/);
  assert.match(header.Workspace, /^no worktree\b.*only the report/i);
  assert.ok(existsSync(join(plan, "brief-close-retro-2026-11-20.md")));
  const review = await runBrief(
    briefArgs(plan, "Close", "example/tracker", close),
  );
  assert.equal(review.code, 0, review.stderr);
  assert.match(
    fields(review.stdout).Workspace,
    /fresh worktree of example\/tracker on its default branch.*only the report/,
  );
  assert.ok(
    existsSync(join(plan, "brief-close-example-tracker-2026-11-20.md")),
  );
  const url = await runBrief(
    briefArgs(plan, "Review", "https://github.com/example/other/pull/7"),
    undefined,
    { connect: tracker({ "example/other#7": { pull: true } }).connect },
  );
  assert.match(fields(url.stdout).Workspace, /worktree of example\/other\b/);
});

test("brief refuses a stage without a hand skill, an unknown stage, a file without the table and an empty Context", async (t) => {
  const bench = workbench(t);
  const plan = bench.path("review");
  bench.write(
    "rules.md",
    `# Rules\n\n## Canonical stages\n\n| Stage | Configured factory coverage | Hand skill | Input |\n| --- | --- | --- | --- |\n| Draft | None. | \`to-spec\` | The record |\n| Ship | None. | None yet (gap) | The issue |\n\n## Run kinds\n`,
  );
  bench.write("plain.md", "# Rules\n\n## Run kinds\n\nNo stages here.\n");
  const fixture = { "--stages": bench.path("rules.md") };
  const accepted = await runBrief(briefArgs(plan, "Draft", "routing", fixture));
  assert.equal(accepted.code, 0, accepted.stderr);
  const plain = { "--stages": bench.path("plain.md") };
  for (const { args, context, reason } of [
    {
      args: briefArgs(plan, "Ship", "routing", fixture),
      reason: /names no skill/,
    },
    {
      args: briefArgs(plan, "draft", "routing", fixture),
      reason: /unknown stage/,
    },
    { args: briefArgs(plan, "Deploy", "routing"), reason: /unknown stage/ },
    {
      args: briefArgs(plan, "Grill", "routing", plain),
      reason: /no Canonical stages table/,
    },
    {
      args: briefArgs(plan, "Grill", "routing"),
      context: " \n\t\n",
      reason: /empty Context/,
    },
    {
      args: briefArgs(plan, "Grill", "routing"),
      context: "",
      reason: /empty Context/,
    },
  ]) {
    const { code, stdout, stderr } = await runBrief(args, context);
    assert.equal(code, 1, args.join(" "));
    assert.match(stderr, reason);
    assert.equal(stdout, "");
  }
  assert.deepEqual(
    readdirSync(plan).filter((name) => name.startsWith("brief-")),
    ["brief-draft-routing-2026-11-20.md"],
  );
});

test("brief requires each argument and refuses a malformed model or reason", async (t) => {
  const bench = workbench(t);
  const plan = bench.path("review");
  for (const flag of ["--plan", "--row", "--model", "--reason", "--stages"]) {
    const { code, stderr } = await runBrief(
      briefArgs(plan, "Grill", "routing", { [flag]: undefined }),
    );
    assert.equal(code, 1, flag);
    assert.match(stderr, new RegExp(`${flag} is required`));
  }
  for (const { args, reason } of [
    { args: ["brief", "Grill"], reason: /usage: workbench\.mjs/ },
    {
      args: briefArgs(plan, "Grill", "routing", { "--model": "opus" }),
      reason: /<model>@<effort>/,
    },
    {
      args: briefArgs(plan, "Grill", "routing", { "--reason": "two\nlines" }),
      reason: /one line/,
    },
    {
      args: briefArgs(plan, "Grill", "routing", {
        "--plan": bench.path("missing"),
      }),
      reason: /plan directory/,
    },
  ]) {
    const { code, stderr } = await runBrief(args);
    assert.equal(code, 1, args.join(" "));
    assert.match(stderr, reason);
  }
  assert.deepEqual(
    readdirSync(plan).filter((name) => name.startsWith("brief-")),
    [],
  );
});

test("a generated brief runs under status until its report finishes, then waits as my move until consumed", async (t) => {
  const bench = workbench(t);
  const { code, stdout } = await runBrief(
    briefArgs(bench.path("review"), "Grill", "routing"),
  );
  assert.equal(code, 0);
  const report = fields(stdout)["Launch report"];
  const name = "brief-grill-routing-2026-11-20";
  const status = async () => {
    const output = capture();
    assert.equal(
      await main(
        [
          "status",
          bench.root,
          "--stale-after",
          "60",
          "--stages",
          installedStages,
        ],
        {
          ...output.streams,
          connect: unreachable,
        },
      ),
      0,
      output.stderr,
    );
    return output.stdout;
  };
  assert.match(
    await status(),
    new RegExp(
      `^Running\n- review/${name}-report\\.md report pending · review/${name}\\.md$`,
      "m",
    ),
  );
  writeFileSync(report, "The decision record.\nstatus: done\n");
  assert.match(
    await status(),
    new RegExp(
      `^- review/${name}-report\\.md finished; read the report · review/${name}\\.md$`,
      "m",
    ),
  );
  bench.write("review/log.md", `# Log\n\n- Consumed ${name}-report.md.\n`);
  assert.doesNotMatch(await status(), new RegExp(`${name}-report`));
});

test("status routes a grill-only row through the supplied Grill hand skill", async (t) => {
  const bench = watching(t, "example/tracker#7");
  bench.write(
    "stages.md",
    "# Rules\n\n## Canonical stages\n\n| Stage | Hand skill |\n| --- | --- |\n| Grill | `local-grill` |\n",
  );
  const output = capture();
  assert.equal(
    await main(
      [
        "status",
        bench.root,
        "--stale-after",
        "60",
        "--stages",
        bench.path("stages.md"),
      ],
      {
        ...output.streams,
        connect: tracker({ "example/tracker#7": { labels: ["state:grill"] } })
          .connect,
      },
    ),
    0,
    output.stderr,
  );
  assert.match(
    output.stdout,
    /My move\n- https:\/\/github.com\/example\/tracker\/issues\/7 .*start or resume.*Grill session.*`local-grill`.*review\/check/,
  );
});

test("status reuses an unfinished Grill launch and restores its action when the report ends", async (t) => {
  const bench = watching(t, "example/tracker#7");
  const connect = tracker({
    "example/tracker#7": { labels: ["state:grill"] },
  }).connect;
  bench.write(
    "review/brief-grill.md",
    "Operation: Grill\nTarget: https://github.com/EXAMPLE/tracker/issues/7\nLaunch report: grill-report.md\n",
  );
  for (const finished of [false, true]) {
    if (finished)
      bench.write(
        "review/grill-report.md",
        "Decisions recorded.\nstatus: done\n",
      );
    const output = capture();
    assert.equal(
      await main(
        [
          "status",
          bench.root,
          "--stale-after",
          "60",
          "--stages",
          installedStages,
        ],
        {
          ...output.streams,
          connect,
        },
      ),
      0,
      output.stderr,
    );
    if (finished) {
      assert.match(output.stdout, /start or resume its Grill session/);
      assert.match(output.stdout, /grill-report.md finished; read the report/);
    } else {
      assert.doesNotMatch(output.stdout, /start or resume/);
      assert.match(
        output.stdout,
        /Running\n- review\/grill-report.md report pending/,
      );
    }
  }
});

test("status refuses an Open inbox entry for a watched grill issue or its exact row", async (t) => {
  for (const entry of [
    "### Decide the intent\n\nQuestion: [issue](https://github.com/EXAMPLE/tracker/issues/7)\n",
    "### Decide the intent\n\nQuestion: EXAMPLE/tracker#7\n",
    "### Decide the intent\n\nPlan: `review/check`\n",
    "### Decide the intent\n\n**Plan:** [review/check](review/plan.md#check)\n",
  ]) {
    const bench = watching(t, "example/tracker#7");
    bench.write("inbox.md", `# Inbox\n\n## Open\n\n${entry}\n## Answered\n`);
    const output = capture();
    assert.equal(
      await main(
        [
          "status",
          bench.root,
          "--stale-after",
          "60",
          "--stages",
          installedStages,
        ],
        {
          ...output.streams,
          connect: tracker({ "example/tracker#7": { labels: ["state:grill"] } })
            .connect,
        },
      ),
      1,
      entry,
    );
    assert.equal(output.stdout, "");
    assert.match(
      output.stderr,
      /https:\/\/github.com\/example\/tracker\/issues\/7/,
    );
    assert.match(output.stderr, /review\/check/);
    assert.match(output.stderr, /inbox.md#decide-the-intent/);
  }
});

test("status requires stages and refuses a Grill row without a hand skill", async (t) => {
  const bench = workbench(t);
  bench.write(
    "stages.md",
    "# Rules\n\n## Canonical stages\n\n| Stage | Hand skill |\n| --- | --- |\n| Grill | None yet (gap) |\n",
  );
  for (const { options, refusal } of [
    { options: [], refusal: /--stages is required/ },
    {
      options: ["--stages", bench.path("stages.md")],
      refusal: /stage Grill is refused.*names no skill/,
    },
  ]) {
    const output = capture();
    assert.equal(
      await main(["status", bench.root, "--stale-after", "60", ...options], {
        ...output.streams,
        connect: unreachable,
      }),
      1,
    );
    assert.equal(output.stdout, "");
    assert.match(output.stderr, refusal);
  }
});

test("brief refuses publication and implementation on closed or merged tracker targets before writing", async (t) => {
  for (const stage of ["Specification", "Tickets", "Implement"]) {
    for (const item of [
      { state: "closed" },
      { state: "closed", pull: true },
      { state: "closed", pull: true, mergedAt: "2026-11-20T00:00:00Z" },
    ]) {
      const bench = workbench(t);
      const plan = bench.path("review");
      const target = item.pull
        ? "https://github.com/example/tracker/pull/7"
        : "example/tracker#7";
      const output = await runBrief(briefArgs(plan, stage, target), undefined, {
        connect: tracker({ "example/tracker#7": item }).connect,
      });
      assert.equal(output.code, 1, `${stage}: ${JSON.stringify(item)}`);
      assert.equal(output.stdout, "");
      assert.ok(output.stderr.includes(stage), output.stderr);
      assert.ok(output.stderr.includes(target), output.stderr);
      assert.match(output.stderr, item.mergedAt ? /merged/ : /closed/);
      assert.deepEqual(
        readdirSync(plan).filter((name) => name.startsWith("brief-")),
        [],
      );
    }
  }
});

test("brief allows closed targets for Close and Grill, and open targets for publication", async (t) => {
  for (const [stage, target, item] of [
    ["Close", "example/tracker#7", { state: "closed" }],
    [
      "Grill",
      "https://github.com/example/tracker/issues/7",
      { state: "closed" },
    ],
    ["Specification", "example/tracker#7", {}],
    ["Tickets", "https://github.com/example/tracker/issues/7", {}],
    ["Implement", "https://github.com/example/tracker/pull/7", { pull: true }],
  ]) {
    const bench = workbench(t);
    const plan = bench.path("review");
    const connection = tracker({ "example/tracker#7": item });
    const output = await runBrief(
      briefArgs(plan, stage, target),
      undefined,
      connection,
    );
    assert.equal(output.code, 0, output.stderr);
    assert.equal(fields(output.stdout).Operation, stage);
    assert.equal(fields(output.stdout).Target, target);
    assert.ok(connection.requests.includes("/repos/example/tracker/issues/7"));
    const files = readdirSync(plan).filter((name) => name.startsWith("brief-"));
    assert.equal(files.length, 1);
    assert.equal(readFileSync(join(plan, files[0]), "utf8"), output.stdout);
  }
});

test("brief reports unreadable tracker targets and writes nothing, even for Grill and Close", async (t) => {
  for (const stage of ["Implement", "Grill", "Close"]) {
    const bench = workbench(t);
    const plan = bench.path("review");
    const output = await runBrief(
      briefArgs(plan, stage, "example/missing#7"),
      undefined,
      tracker({}),
    );
    assert.equal(output.code, 1);
    assert.equal(output.stdout, "");
    assert.match(
      output.stderr,
      /cannot read target example\/missing#7.*404: Not Found/,
    );
    assert.deepEqual(
      readdirSync(plan).filter((name) => name.startsWith("brief-")),
      [],
    );
  }
});
