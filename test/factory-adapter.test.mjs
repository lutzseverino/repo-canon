import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { installedValidator } from "./helpers/installed-validator.mjs";
import { fixture } from "./helpers/operation.mjs";
import {
  claudeUsage,
  codexUsage,
  createFactory,
  createStandardsRunner,
  imageName,
  readCodexUsage,
  readSettings,
  sandboxMounts,
} from "../.sandcastle/adapter.ts";

// The factory's adapter, run against a stateful GitHub CLI fake and a fake
// Sandcastle launcher. The fake holds the repository's issues and applies the
// label edits and comments the adapter makes.
const settings = {
  defaultModel: "claude-sonnet-5-5",
  retryModel: null,
  caps: { "claude-code": 2, codex: 1 },
  usageThreshold: 80,
  timeLimitMinutes: 240,
};

// The most nodes GitHub lets one GraphQL query request: each connection
// counts its `first` or `last` times those of the connections around it.
const nodeLimit = 500_000;

function requestedNodes(query) {
  let total = 0;
  const scopes = [1];
  for (const [, args, close] of query.matchAll(
    /(?:\(([^()]*)\)\s*)?\{|(\})/g,
  )) {
    if (close) {
      scopes.pop();
      continue;
    }
    const limit = args?.match(/\b(?:first|last):\s*(\d+)/);
    const nodes = scopes.at(-1) * (limit ? Number(limit[1]) : 1);
    if (limit) total += nodes;
    scopes.push(nodes);
  }
  return total;
}

function fakeGitHub(issues) {
  const state = {
    created: [],
    pullRequests: [],
    pullRequestReads: 0,
    issues: issues.map((issue) => ({
      state: "OPEN",
      createdAt: `2026-10-0${issue.number}T00:00:00Z`,
      body: "",
      labels: ["ready-for-agent"],
      parent: null,
      subIssues: [],
      blockedBy: [],
      labelEvents: [],
      linkEvents: [],
      pullRequests: [],
      branchPullRequests: [],
      comments: [],
      ...issue,
    })),
  };
  const find = (number) =>
    state.issues.find((issue) => issue.number === Number(number));
  const names = (labels) => ({ nodes: labels.map((name) => ({ name })) });
  // A pull request is its state, or its state and when it was opened; a bare
  // state was opened at the fake clock's start of the run.
  const pullRequest = (pr) =>
    typeof pr === "string"
      ? { state: pr, createdAt: "2026-10-09T12:00:00Z" }
      : pr;
  const field = (args, name) =>
    args[
      args.findIndex(
        (arg, index) => args[index - 1] === "-F" && arg.startsWith(`${name}=`),
      )
    ]?.slice(name.length + 1);

  async function gh(args) {
    if (args[0] === "repo" && args[1] === "view") {
      return JSON.stringify({ owner: { login: "acme" }, name: "widgets" });
    }
    if (args[0] === "api" && args[1] === "graphql") {
      assert.equal(field(args, "owner"), "acme");
      assert.equal(field(args, "name"), "widgets");
      const query = args.find((arg) => arg.startsWith("query="));
      if (query.includes("closedByPullRequestsReferences")) {
        const issue = find(field(args, "number"));
        assert.equal(field(args, "branch"), `factory/issue-${issue.number}`);
        return JSON.stringify({
          data: {
            repository: {
              issue: {
                state: issue.state,
                closedByPullRequestsReferences: {
                  nodes: issue.pullRequests.map(pullRequest),
                },
              },
              pullRequests: {
                nodes: issue.branchPullRequests.map(pullRequest),
              },
            },
          },
        });
      }
      if (query.includes("pullRequests(")) {
        assert.ok(args.includes("--paginate"));
        assert.ok(args.includes("--slurp"));
        assert.match(query, /after: \$endCursor/);
        assert.match(query, /pageInfo \{ hasNextPage endCursor \}/);
        state.pullRequestReads += 1;
        if (state.pullRequestError) throw state.pullRequestError;
        const branch = field(args, "branch");
        const prs = state.pullRequests.filter((pr) =>
          branch ? pr.headRefName === branch : pr.state === "OPEN",
        );
        const pages = [];
        for (let start = 0; start < prs.length || start === 0; start += 100)
          pages.push({
            data: {
              repository: {
                pullRequests: {
                  pageInfo: {
                    hasNextPage: start + 100 < prs.length,
                    endCursor: String(start + 100),
                  },
                  nodes: prs.slice(start, start + 100),
                },
              },
            },
          });
        return JSON.stringify(pages);
      }
      assert.ok(
        requestedNodes(query) <= nodeLimit,
        "issue query over the node limit",
      );
      return JSON.stringify([
        {
          data: {
            repository: {
              issues: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: state.issues
                  .filter((issue) => issue.state === "OPEN")
                  .map((issue) => ({
                    number: issue.number,
                    createdAt: issue.createdAt,
                    body: issue.body,
                    labels: names(issue.labels),
                    parent: issue.parent && {
                      number: issue.parent,
                      repository: {
                        nameWithOwner: issue.parentRepository ?? "acme/widgets",
                      },
                    },
                    subIssues: {
                      nodes: issue.subIssues.map((child) => ({
                        number: child.number,
                        repository: {
                          nameWithOwner: child.repository ?? "acme/widgets",
                        },
                        state: child.state ?? "OPEN",
                        labels: names(child.labels),
                      })),
                    },
                    blockedBy: {
                      nodes: issue.blockedBy.map((blocker) => ({
                        number: blocker.number,
                        state: blocker.state,
                      })),
                    },
                    labelEvents: {
                      nodes: issue.labelEvents.map(({ label, at }) => ({
                        createdAt: at,
                        label: { name: label },
                      })),
                    },
                    linkEvents: {
                      nodes: issue.linkEvents.map(
                        ({ number, repository, at }) => ({
                          createdAt: at,
                          subIssue: {
                            number,
                            repository: {
                              nameWithOwner: repository ?? "acme/widgets",
                            },
                          },
                        }),
                      ),
                    },
                  })),
              },
            },
          },
        },
      ]);
    }
    if (args[0] === "issue" && args[1] === "create") {
      state.created.push({
        title: args[args.indexOf("--title") + 1],
        body: args[args.indexOf("--body") + 1],
        label: args[args.indexOf("--label") + 1],
      });
      return "https://github.com/acme/widgets/issues/10";
    }
    if (
      args[0] === "issue" &&
      args[1] === "list" &&
      args.includes("--search")
    ) {
      const marker = args[args.indexOf("--search") + 1].replace("in:body ", "");
      const requestedState = args[args.indexOf("--state") + 1];
      return JSON.stringify(
        state.created
          .filter(
            (issue) =>
              issue.body.includes(marker) &&
              (requestedState === "all" ||
                (issue.state ?? "OPEN").toLowerCase() === requestedState),
          )
          .map((_, index) => ({ number: 10 + index })),
      );
    }
    if (args[0] === "issue" && args[1] === "list") {
      assert.deepEqual(args.slice(2), [
        "--state",
        "closed",
        "--label",
        "factory:running",
        "--json",
        "number",
        "--limit",
        "1000",
      ]);
      return JSON.stringify(
        state.issues
          .filter(
            (issue) =>
              issue.state === "CLOSED" &&
              issue.labels.includes("factory:running"),
          )
          .map((issue) => ({ number: issue.number })),
      );
    }
    if (args[0] === "issue" && args[1] === "edit") {
      const issue = find(args[2]);
      for (let index = 3; index < args.length; index += 2) {
        if (args[index] === "--add-label") issue.labels.push(args[index + 1]);
        else if (args[index] === "--remove-label")
          issue.labels = issue.labels.filter(
            (label) => label !== args[index + 1],
          );
        else throw new Error(`unexpected gh issue edit flag ${args[index]}`);
      }
      return "";
    }
    if (args[0] === "issue" && args[1] === "comment") {
      assert.equal(args[3], "--body");
      find(args[2]).comments.push(args[4]);
      return "";
    }
    throw new Error(`unexpected gh ${args.join(" ")}`);
  }

  return { gh, state, find };
}

function fakeSandcastle() {
  const launched = [];
  async function launch(request) {
    let finish;
    const ended = new Promise((resolve, reject) => {
      finish = (error) => (error ? reject(error) : resolve());
      request.signal.addEventListener("abort", () =>
        reject(request.signal.reason),
      );
    });
    launched.push({ ...request, finish });
    return ended;
  }
  return { launch, launched };
}

// A fake image builder that records each build with the issue labels it saw.
function fakeDocker(github) {
  const builds = [];
  const failures = [];
  async function buildImage(request) {
    builds.push({
      ...request,
      labels: Object.fromEntries(
        github.state.issues.map((issue) => [issue.number, [...issue.labels]]),
      ),
    });
    if (failures.length > 0) throw failures.shift();
  }
  return { buildImage, builds, failures };
}

function factory({
  issues,
  usage = {},
  hostSettings = {},
  clock,
  updates = {},
  root = "/srv/factory",
  git = async (args) => (args[0] === "rev-parse" ? "fake-base" : ""),
}) {
  const github = fakeGitHub(issues);
  const sandcastle = fakeSandcastle();
  const docker = fakeDocker(github);
  const reports = [];
  const commands = [];
  const time = clock ?? { now: new Date("2026-10-09T12:00:00Z") };
  const instance = createFactory(
    { ...settings, ...hostSettings },
    {
      gh: github.gh,
      git,
      standards: async (args, version) => {
        commands.push({ args, version });
        if (updates.error) throw updates.error;
        if (args[0] === "outdated")
          return JSON.stringify(
            updates.outdated ?? {
              cli: { update: "none" },
              standards: { update: "none" },
            },
          );
        if (args[0] === "status")
          return JSON.stringify(
            updates.status ?? {
              active: null,
              selection: currentSelection,
              lastComplete: { inspection: "sha256:previous" },
            },
          );
        if (args[0] === "inspect")
          return JSON.stringify(updates.inspection ?? routineInspection);
        throw new Error(`unexpected standards ${args.join(" ")}`);
      },
      launch: sandcastle.launch,
      buildImage: docker.buildImage,
      readUsage: async (provider) => {
        if (usage[provider] instanceof Error) throw usage[provider];
        return usage[provider] ?? null;
      },
      now: () => time.now,
      root,
      report: (line) => reports.push(line),
    },
  );
  return { ...instance, github, sandcastle, docker, reports, time, commands };
}

test("a ready issue is claimed, then launched with exactly /implement #<n>", async () => {
  const run = factory({ issues: [{ number: 4 }] });
  await run.tick();
  assert.deepEqual(run.github.find(4).labels, [
    "ready-for-agent",
    "factory:running",
  ]);
  assert.equal(run.sandcastle.launched.length, 1);
  const [launch] = run.sandcastle.launched;
  assert.equal(launch.prompt, "/implement #4");
  assert.deepEqual(
    {
      issue: launch.issue,
      provider: launch.provider,
      model: launch.model,
      effort: launch.effort,
      log: launch.log,
    },
    {
      issue: 4,
      provider: "claude-code",
      model: "claude-sonnet-5-5",
      effort: "high",
      log: "/srv/factory/.sandcastle/logs/issue-4-attempt-1.log",
    },
  );
});

test("every launch runs in the repository's image, built before the claim", async () => {
  const run = factory({
    issues: [{ number: 4 }, { number: 5 }],
    hostSettings: { retryModel: "gpt-5.5" },
  });
  await run.tick();
  assert.deepEqual(run.docker.builds, [
    {
      image: "factory-acme-widgets-d782c8744023",
      dockerfile: "/srv/factory/.sandcastle/Dockerfile",
      labels: { 4: ["ready-for-agent"], 5: ["ready-for-agent"] },
    },
  ]);
  await run.tick();
  assert.equal(
    run.docker.builds.length,
    1,
    "a pass without launches builds nothing",
  );
  run.sandcastle.launched[0].finish(new Error("agent crashed"));
  await settled();
  await run.tick();
  assert.equal(run.docker.builds.length, 2, "a retry rebuilds the image");
  assert.deepEqual(
    run.sandcastle.launched.map(({ issue, image }) => ({ issue, image })),
    [
      { issue: 4, image: "factory-acme-widgets-d782c8744023" },
      { issue: 5, image: "factory-acme-widgets-d782c8744023" },
      { issue: 4, image: "factory-acme-widgets-d782c8744023" },
    ],
  );
});

test("an image that does not build leaves its issues unclaimed on the frontier", async () => {
  const run = factory({ issues: [{ number: 4 }] });
  run.docker.failures.push(new Error("apt-get exited with 100"));
  const decisions = await run.tick();
  assert.deepEqual(decisions, []);
  assert.deepEqual(run.github.find(4).labels, ["ready-for-agent"]);
  assert.equal(run.sandcastle.launched.length, 0);
  assert.ok(
    run.reports.includes(
      "the sandbox image did not build, so nothing launches: Error: apt-get exited with 100",
    ),
    run.reports.join("\n"),
  );
  await run.tick();
  assert.deepEqual(
    run.sandcastle.launched.map((launch) => launch.issue),
    [4],
  );
});

const settled = () => new Promise((resolve) => setImmediate(resolve));

for (const [provider, model, prefix] of [
  ["claude-code", "claude-sonnet-5-5", "/"],
  ["codex", "gpt-5.5", "$"],
]) {
  for (const [mode, skill] of [
    ["direct", "implement"],
    ["orchestrated", "implement-spec"],
  ]) {
    test(`${provider} launches a ${mode} run with exactly ${prefix}${skill} #<n>`, async () => {
      const run = factory({
        issues: [
          {
            number: 4,
            labels: [
              "ready-for-agent",
              ...(mode === "orchestrated" ? ["run:orchestrated"] : []),
            ],
          },
        ],
        hostSettings: { defaultModel: model },
      });
      await run.tick();
      assert.deepEqual(
        run.sandcastle.launched.map(({ provider, prompt }) => ({
          provider,
          prompt,
        })),
        [{ provider, prompt: `${prefix}${skill} #4` }],
      );
    });
  }
}

test("a specification is launched with exactly /implement-spec #<n>", async () => {
  const run = factory({
    issues: [
      { number: 3, subIssues: [{ number: 5, labels: ["ready-for-agent"] }] },
    ],
  });
  await run.tick();
  assert.deepEqual(
    run.sandcastle.launched.map((launch) => launch.prompt),
    ["/implement-spec #3"],
  );
});

const specificationBody = `## Problem Statement

Widgets cannot be exported.

## Solution

Export widgets as CSV.

## User Stories

1. As an owner, I want to export widgets, so that I can audit them.
`;

const ticketBody = `## What to build

Export widgets as CSV.

## Acceptance criteria

- [ ] Widgets export as CSV.

## Blocked by

None - can start immediately
`;

test("a specification body waits for its tickets, then launches /implement-spec #<n>", async () => {
  const run = factory({
    issues: [
      { number: 3, body: specificationBody },
      { number: 4, body: ticketBody },
      {
        number: 5,
        body: specificationBody,
        labels: ["ready-for-agent", "bug"],
      },
    ],
    hostSettings: { caps: { "claude-code": 3 } },
  });
  await run.tick();
  assert.deepEqual(run.github.find(3).labels, ["ready-for-agent"]);
  assert.deepEqual(
    run.sandcastle.launched.map(({ issue, prompt }) => ({ issue, prompt })),
    [
      { issue: 4, prompt: "/implement #4" },
      { issue: 5, prompt: "/implement #5" },
    ],
  );
  run.github.find(3).subIssues.push({
    number: 6,
    labels: ["ready-for-agent"],
  });
  await run.tick();
  assert.equal(run.sandcastle.launched.at(-1).prompt, "/implement-spec #3");
});

// A specification's readiness counts once it postdates its latest linked
// ticket, and a published ticket counts by its `Parent` section before it is
// linked. A native parent outranks the `Parent` section, and a parent in
// another repository holds nothing.
test("a specification waits for its published tickets to be linked and for readiness after them", async () => {
  const run = factory({
    issues: [
      {
        number: 3,
        body: specificationBody,
        labelEvents: [
          { label: "ready-for-agent", at: "2026-10-09T10:00:00Z" },
          { label: "documentation", at: "2026-10-09T11:00:00Z" },
        ],
        // Another repository's #6 is no stand-in for this repository's.
        subIssues: [
          { number: 5, labels: ["ready-for-agent"] },
          {
            number: 6,
            repository: "acme/gadgets",
            labels: ["ready-for-agent"],
          },
        ],
        linkEvents: [
          { number: 5, at: "2026-10-09T09:00:00Z" },
          { number: 6, repository: "acme/gadgets", at: "2026-10-09T09:30:00Z" },
        ],
      },
      {
        number: 6,
        body: `## Parent\n\nhttps://github.com/acme/widgets/issues/3\n\n${ticketBody}`,
      },
      { number: 7, body: `## Parent\n\n#3\n\n${ticketBody}` },
      { number: 8, body: ticketBody },
      {
        number: 9,
        body: `## Parent\n\nhttps://github.com/acme/gadgets/issues/3\n\n${ticketBody}`,
      },
      { number: 10, parent: 3, parentRepository: "acme/gadgets" },
      {
        number: 11,
        parent: 12,
        body: `## Parent\n\n#3\n\n${ticketBody}`,
      },
      {
        number: 12,
        labels: ["wayfinder:map"],
        subIssues: [{ number: 11, labels: ["ready-for-agent"] }],
      },
    ],
    hostSettings: { caps: { "claude-code": 4 } },
  });
  await run.tick();
  assert.deepEqual(
    run.sandcastle.launched.map(({ prompt }) => prompt),
    ["/implement #8", "/implement #9", "/implement #10"],
  );
  assert.ok(
    run.reports.includes(
      "#3 skipped: tickets name it as their parent but are not linked to it yet: #6, #7",
    ),
    run.reports.join("\n"),
  );
  for (const number of [6, 7])
    assert.ok(
      run.reports.includes(
        `#${number} skipped: names specification #3 as its parent but is not linked to it yet`,
      ),
      run.reports.join("\n"),
    );
  assert.ok(
    run.reports.includes(
      "#11 skipped: sub-issue of #12; it runs as part of #12 once #12 is ready for agent",
    ),
    run.reports.join("\n"),
  );

  const spec = run.github.find(3);
  for (const [number, at] of [
    [6, "2026-10-09T10:30:00Z"],
    [7, "2026-10-09T10:31:00Z"],
  ]) {
    spec.subIssues.push({ number, labels: ["ready-for-agent"] });
    spec.linkEvents.push({ number, at });
    run.github.find(number).parent = 3;
  }
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 3);
  assert.ok(
    run.reports.includes(
      "#3 skipped: readiness predates its latest ticket #7; remove and re-apply ready-for-agent once its tickets are published",
    ),
    run.reports.join("\n"),
  );

  spec.labelEvents.push({
    label: "ready-for-agent",
    at: "2026-10-09T11:30:00Z",
  });
  await run.tick();
  assert.equal(run.sandcastle.launched.at(-1).prompt, "/implement-spec #3");
});

// An adopter receives the adapter and every module it imports as exact files,
// so it reaches the issue-contract rule at the same relative path.
test("the adapter loads from an adopting repository's installed files", async (t) => {
  const adapter = installedValidator(t, ".sandcastle/adapter.ts");
  const { prompt } = await import(pathToFileURL(adapter).href);
  assert.equal(prompt("codex", "orchestrated", 3), "$implement-spec #3");
});

test("a run that exits without an open pull request fails its issue", async () => {
  const run = factory({ issues: [{ number: 4 }] });
  await run.tick();
  run.sandcastle.launched[0].finish();
  await settled();
  await run.tick();
  const issue = run.github.find(4);
  assert.deepEqual(issue.labels, ["ready-for-agent", "factory:failed"]);
  assert.equal(issue.comments.length, 1);
  assert.match(issue.comments[0], /the run ended without an open pull request/);
  assert.ok(
    issue.comments[0].includes(
      "`/srv/factory/.sandcastle/logs/issue-4-attempt-1.log`",
    ),
  );
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 1);
  assert.equal(issue.comments.length, 1);
});

test("a failed first run uses the retry provider's skill prefix", async () => {
  const run = factory({
    issues: [{ number: 4, labels: ["ready-for-agent", "run:orchestrated"] }],
    hostSettings: { retryModel: "gpt-5.5@xhigh" },
  });
  await run.tick();
  run.sandcastle.launched[0].finish(new Error("agent crashed"));
  await settled();
  await run.tick();
  assert.deepEqual(
    run.sandcastle.launched.map(({ prompt, provider, model, effort, log }) => ({
      prompt,
      provider,
      model,
      effort,
      log,
    })),
    [
      {
        prompt: "/implement-spec #4",
        provider: "claude-code",
        model: "claude-sonnet-5-5",
        effort: "high",
        log: "/srv/factory/.sandcastle/logs/issue-4-attempt-1.log",
      },
      {
        prompt: "$implement-spec #4",
        provider: "codex",
        model: "gpt-5.5",
        effort: "xhigh",
        log: "/srv/factory/.sandcastle/logs/issue-4-attempt-2.log",
      },
    ],
  );
  assert.deepEqual(run.github.find(4).labels, [
    "ready-for-agent",
    "run:orchestrated",
    "factory:running",
  ]);
});

test("a run over the time limit is aborted and fails its issue", async () => {
  const run = factory({ issues: [{ number: 4 }] });
  await run.tick();
  run.time.now = new Date("2026-10-09T16:00:01Z");
  await run.tick();
  assert.ok(run.sandcastle.launched[0].signal.aborted);
  await settled();
  run.github.find(4).pullRequests.push("OPEN");
  await run.tick();
  const issue = run.github.find(4);
  assert.deepEqual(issue.labels, ["ready-for-agent", "factory:failed"]);
  assert.match(
    issue.comments[0],
    /the run exceeded the time limit of 240 minutes/,
  );
});

test("a run that opened its pull request keeps the claim until it merges", async () => {
  const run = factory({ issues: [{ number: 4 }, { number: 5 }] });
  await run.tick();
  run.github.find(4).pullRequests.push("OPEN");
  run.github.find(5).pullRequests.push("CLOSED", "MERGED");
  run.github.find(5).state = "CLOSED";
  for (const launch of run.sandcastle.launched) launch.finish();
  await settled();
  await run.tick();
  await run.tick();
  assert.deepEqual(run.github.find(4).labels, [
    "ready-for-agent",
    "factory:running",
  ]);
  assert.deepEqual(run.github.find(5).labels, ["ready-for-agent"]);
  assert.equal(run.sandcastle.launched.length, 2);
  assert.deepEqual(run.github.find(4).comments, []);
});

test("an open pull request from the run's branch holds the claim without closing the issue", async () => {
  const run = factory({ issues: [{ number: 4 }] });
  await run.tick();
  run.github.find(4).branchPullRequests.push("OPEN");
  run.sandcastle.launched[0].finish();
  await settled();
  await run.tick();
  await run.tick();
  const issue = run.github.find(4);
  assert.deepEqual(issue.labels, ["ready-for-agent", "factory:running"]);
  assert.deepEqual(issue.comments, []);
  assert.equal(run.sandcastle.launched.length, 1);
});

test("an unreadable usage reading leaves the provider gated by count only", async () => {
  const run = factory({
    issues: [{ number: 4 }, { number: 5 }, { number: 6 }],
    usage: { "claude-code": new Error("usage endpoint unavailable") },
  });
  const decisions = await run.tick();
  assert.deepEqual(
    run.sandcastle.launched.map((launch) => launch.issue),
    [4, 5],
  );
  assert.deepEqual(decisions.at(-1), {
    kind: "skip",
    issue: 6,
    reason: "claude-code already runs its cap of 2 agents",
  });
});

test("the host's settings come from its environment", () => {
  assert.deepEqual(
    readSettings({
      FACTORY_DEFAULT_MODEL: "claude-sonnet-5-5",
      FACTORY_RETRY_MODEL: "claude-opus-5-5@xhigh",
      FACTORY_CAPS: "claude-code=2, codex=1",
      FACTORY_USAGE_THRESHOLD: "80",
      FACTORY_TIME_LIMIT_MINUTES: "240",
      FACTORY_POLL_SECONDS: "60",
    }),
    {
      defaultModel: "claude-sonnet-5-5",
      retryModel: "claude-opus-5-5@xhigh",
      caps: { "claude-code": 2, codex: 1 },
      usageThreshold: 80,
      timeLimitMinutes: 240,
      pollSeconds: 60,
      codexLogin: null,
    },
  );
  const defaults = readSettings({
    FACTORY_DEFAULT_MODEL: "gpt-5.5",
    FACTORY_CAPS: "codex=1",
    FACTORY_USAGE_THRESHOLD: "90",
    FACTORY_TIME_LIMIT_MINUTES: "60",
    FACTORY_CODEX_LOGIN: "",
  });
  assert.equal(defaults.retryModel, null);
  assert.equal(defaults.pollSeconds, 300);
  assert.equal(defaults.codexLogin, null);
});

const required = {
  FACTORY_DEFAULT_MODEL: "gpt-5.5",
  FACTORY_CAPS: "codex=1",
  FACTORY_USAGE_THRESHOLD: "90",
  FACTORY_TIME_LIMIT_MINUTES: "60",
};

// A Codex ChatGPT login whose refresh token is a placeholder, as the host
// writes it. Nothing here is a real credential.
const login = JSON.stringify({
  auth_mode: "chatgpt",
  tokens: {
    access_token: "secret-access-token",
    id_token: "secret-id-token",
    account_id: "secret-account",
    refresh_token: "placeholder",
  },
});

// A host directory holding the Codex login file, removed after the test.
function loginFile(t) {
  const host = fixture({ "codex/auth.json": login });
  t.after(host.close);
  return { host, path: join(host.root, "codex", "auth.json") };
}

test("a readable Codex login file at an absolute path is accepted", (t) => {
  const { path } = loginFile(t);
  assert.equal(
    readSettings({ ...required, FACTORY_CODEX_LOGIN: path }).codexLogin,
    path,
  );
});

test("an unusable Codex login file is refused by its path", (t) => {
  const { host } = loginFile(t);
  const refusal = (path) => {
    try {
      readSettings({ ...required, FACTORY_CODEX_LOGIN: path });
    } catch (error) {
      assert.match(error.message, /^The factory host settings are unusable:/);
      assert.doesNotMatch(error.message, /secret/);
      return error.message.split("\n").slice(1);
    }
    assert.fail(`${path} was accepted`);
  };
  assert.deepEqual(refusal("codex/auth.json"), [
    "- FACTORY_CODEX_LOGIN: set it to an absolute path, not codex/auth.json",
  ]);
  const missing = join(host.root, "codex", "missing.json");
  assert.deepEqual(refusal(missing), [
    `- FACTORY_CODEX_LOGIN: ${missing} does not exist; set it to the Codex login file`,
  ]);
  const directory = join(host.root, "codex");
  assert.deepEqual(refusal(directory), [
    `- FACTORY_CODEX_LOGIN: ${directory} is not a regular file; set it to the Codex login file`,
  ]);
});

test("a Codex login file the factory's user cannot read is refused", (t) => {
  if (process.getuid?.() === 0) return t.skip("root reads every file");
  const { path } = loginFile(t);
  chmodSync(path, 0o000);
  assert.throws(
    () => readSettings({ ...required, FACTORY_CODEX_LOGIN: path }),
    {
      message: [
        "The factory host settings are unusable:",
        `- FACTORY_CODEX_LOGIN: ${path} is not readable by the factory's user; let it read the file`,
      ].join("\n"),
    },
  );
});

test("only a run on Codex mounts the Codex login, read-only in its default home", () => {
  const path = "/run/factory/codex/auth.json";
  assert.deepEqual(sandboxMounts("codex", path), [
    {
      hostPath: path,
      sandboxPath: "/home/agent/.codex/auth.json",
      readonly: true,
    },
  ]);
  assert.deepEqual(sandboxMounts("claude-code", path), []);
  assert.deepEqual(sandboxMounts("codex", null), []);
});

// A stand-in for `codex app-server` that records the Codex home it was given,
// writes state there as Codex does, and answers, refuses, or never replies.
function fakeCodex(root, behavior) {
  const seen = join(root, "seen.json");
  const executable = join(root, "fake-codex");
  writeFileSync(
    executable,
    `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const home = process.env.CODEX_HOME ?? null;
// Only the factory's own copies are read, never a real Codex home.
const copied = home !== null && path.basename(home).startsWith("factory-codex-");
const auth = copied && path.join(home, "auth.json");
fs.writeFileSync(${JSON.stringify(seen)}, JSON.stringify(copied ? {
  home,
  args: process.argv.slice(2),
  homeMode: fs.statSync(home).mode & 0o777,
  authMode: fs.statSync(auth).mode & 0o777,
  auth: fs.readFileSync(auth, "utf8"),
} : { home, args: process.argv.slice(2) }));
if (copied) fs.mkdirSync(path.join(home, "sessions"));
const reply = (message) => process.stdout.write(JSON.stringify(message) + "\\n");
require("node:readline").createInterface({ input: process.stdin }).on("line", (line) => {
  const message = JSON.parse(line);
  if (${JSON.stringify(behavior)} === "hang") return;
  if (message.method === "initialize") reply({ id: 0, result: {} });
  else if (message.method !== "account/rateLimits/read") return;
  else if (${JSON.stringify(behavior)} === "refuse")
    reply({ id: 1, error: { message: "not signed in" } });
  else reply({ id: 1, result: { rateLimits: { primary: { usedPercent: 42 } } } });
});
`,
  );
  chmodSync(executable, 0o755);
  return {
    executable,
    seen: () => JSON.parse(readFileSync(seen, "utf8")),
  };
}

test("each Codex usage read signs in from a private copy of the login that it removes", async (t) => {
  const { host, path } = loginFile(t);
  chmodSync(path, 0o444);
  const codex = fakeCodex(host.root, "answer");
  assert.equal(await readCodexUsage(path, codex.executable), 42);
  const first = codex.seen();
  assert.deepEqual(first.args, ["app-server"]);
  assert.equal(first.homeMode, 0o700);
  assert.equal(first.authMode, 0o600);
  assert.equal(first.auth, login);
  assert.equal(existsSync(first.home), false);
  assert.equal(readFileSync(path, "utf8"), login);

  assert.equal(await readCodexUsage(path, codex.executable), 42);
  assert.notEqual(codex.seen().home, first.home);
  assert.equal(existsSync(codex.seen().home), false);
});

test("a Codex usage read removes its login copy after an error or a timeout", async (t) => {
  const { host, path } = loginFile(t);
  for (const [behavior, message] of [
    ["refuse", /not signed in/],
    ["hang", /timed out/],
  ]) {
    const codex = fakeCodex(host.root, behavior);
    await assert.rejects(
      readCodexUsage(path, codex.executable, 500),
      (error) => {
        assert.match(error.message, message);
        assert.doesNotMatch(error.message, /secret/);
        return true;
      },
    );
    assert.equal(existsSync(codex.seen().home), false, behavior);
  }
});

test("without a Codex login the usage read keeps the host's Codex home", async (t) => {
  const host = fixture({});
  t.after(host.close);
  const codex = fakeCodex(host.root, "answer");
  assert.equal(await readCodexUsage(null, codex.executable), 42);
  assert.equal(codex.seen().home, process.env.CODEX_HOME ?? null);
});

test("unusable host settings are refused with every correction", () => {
  assert.throws(
    () =>
      readSettings({
        FACTORY_DEFAULT_MODEL: "gemini-3",
        FACTORY_RETRY_MODEL: "gpt-5.5@max",
        FACTORY_CAPS: "claude-code=two,cursor=1",
        FACTORY_POLL_SECONDS: "soon",
      }),
    {
      message: [
        "The factory host settings are unusable:",
        "- FACTORY_DEFAULT_MODEL: model gemini-3 names no provider; label it model:<provider>/gemini-3 with claude-code or codex",
        "- FACTORY_RETRY_MODEL: effort max is not one codex accepts: low, medium, high, xhigh",
        "- FACTORY_CAPS: claude-code=two is not <provider>=<count>",
        "- FACTORY_CAPS: provider cursor is not claude-code or codex",
        "- FACTORY_USAGE_THRESHOLD: set it to a percentage from 0 to 100",
        "- FACTORY_TIME_LIMIT_MINUTES: set it to a positive number of minutes",
        "- FACTORY_POLL_SECONDS: set it to a positive number of seconds, or leave it unset for 300",
      ].join("\n"),
    },
  );
});

test("Codex usage is the fuller of its rate-limit windows", () => {
  // The documented app-server `account/rateLimits/read` result.
  assert.equal(
    codexUsage({
      rateLimits: {
        limitId: "codex",
        primary: { usedPercent: 31, windowDurationMins: 300, resetsAt: 1 },
        secondary: { usedPercent: 64, windowDurationMins: 10080, resetsAt: 2 },
      },
    }),
    64,
  );
  assert.equal(
    codexUsage({ rateLimits: { primary: { usedPercent: 12 } } }),
    12,
  );
  assert.equal(codexUsage({ rateLimits: {} }), null);
});

test("Claude usage is read best-effort and otherwise unreadable", () => {
  assert.equal(
    claudeUsage({
      five_hour: { utilization: 42, resets_at: "2026-10-09T15:00:00Z" },
      seven_day: { utilization: 17.5, resets_at: "2026-10-12T00:00:00Z" },
    }),
    42,
  );
  assert.equal(claudeUsage({ five_hour: null, seven_day: null }), null);
  assert.equal(claudeUsage("unexpected"), null);
});

test("the factory refuses unset host settings before it installs anything", () => {
  const result = spawnSync(
    process.execPath,
    [new URL("../.sandcastle/main.ts", import.meta.url).pathname],
    { encoding: "utf8", env: { PATH: "" } },
  );
  assert.equal(result.status, 1);
  for (const line of [
    "- FACTORY_DEFAULT_MODEL: set it to a model, as a model label names one",
    "- FACTORY_CAPS: set it to <provider>=<count> entries, such as claude-code=2,codex=1",
    "- FACTORY_USAGE_THRESHOLD: set it to a percentage from 0 to 100",
    "- FACTORY_TIME_LIMIT_MINUTES: set it to a positive number of minutes",
  ])
    assert.ok(result.stderr.includes(line), line);
});

test("a run handed to its open pull request leaves the host", async () => {
  const run = factory({ issues: [{ number: 4 }] });
  await run.tick();
  run.github.find(4).pullRequests.push("OPEN");
  run.sandcastle.launched[0].finish();
  await settled();
  await run.tick();
  // Triage removes the claim, for example after closing the pull request.
  run.github.find(4).pullRequests = ["CLOSED"];
  run.github.find(4).labels = ["ready-for-agent"];
  await run.tick();
  assert.deepEqual(
    run.sandcastle.launched.map((launch) => launch.log),
    [
      "/srv/factory/.sandcastle/logs/issue-4-attempt-1.log",
      "/srv/factory/.sandcastle/logs/issue-4-attempt-1.log",
    ],
  );
});

test("a claim left by an earlier factory process is settled by its pull request", async () => {
  const claimed = ["ready-for-agent", "factory:running"];
  const run = factory({
    issues: [
      { number: 4, labels: [...claimed] },
      { number: 5, labels: [...claimed], branchPullRequests: ["OPEN"] },
      { number: 6, labels: [...claimed], pullRequests: ["CLOSED"] },
      {
        number: 7,
        labels: [...claimed],
        state: "CLOSED",
        pullRequests: ["MERGED"],
      },
    ],
  });
  await run.tick();
  assert.deepEqual(run.github.find(4).labels, [
    "ready-for-agent",
    "factory:failed",
  ]);
  assert.deepEqual(run.github.find(4).comments, [
    [
      "The factory run failed: no factory run or open pull request holds its claim.",
      "",
      "Remove `factory:failed` to let the factory pick this issue up again.",
    ].join("\n"),
  ]);
  assert.deepEqual(run.github.find(5).labels, claimed);
  assert.deepEqual(run.github.find(6).labels, [
    "ready-for-agent",
    "factory:failed",
  ]);
  assert.match(
    run.github.find(6).comments[0],
    /its pull request closed without merging/,
  );
  assert.deepEqual(run.github.find(7).labels, ["ready-for-agent"]);
  assert.equal(run.sandcastle.launched.length, 0);
});

test("a run's claim is released when its pull request merges after the run ends", async () => {
  const run = factory({ issues: [{ number: 4 }] });
  await run.tick();
  run.github.find(4).pullRequests.push("OPEN");
  run.sandcastle.launched[0].finish();
  await settled();
  await run.tick();
  await run.tick();
  assert.deepEqual(run.github.find(4).labels, [
    "ready-for-agent",
    "factory:running",
  ]);
  run.github.find(4).pullRequests = ["MERGED"];
  run.github.find(4).state = "CLOSED";
  await run.tick();
  assert.deepEqual(run.github.find(4).labels, ["ready-for-agent"]);
  assert.deepEqual(run.github.find(4).comments, []);
});

test("a run whose pull request merged without closing its issue fails it and never retries", async () => {
  const run = factory({
    issues: [{ number: 4 }],
    hostSettings: { retryModel: "gpt-5.5@xhigh" },
  });
  await run.tick();
  run.github.find(4).branchPullRequests.push("MERGED");
  run.sandcastle.launched[0].finish();
  await settled();
  await run.tick();
  await run.tick();
  const issue = run.github.find(4);
  assert.deepEqual(issue.labels, ["ready-for-agent", "factory:failed"]);
  assert.equal(issue.comments.length, 1);
  assert.match(
    issue.comments[0],
    /its pull request merged without closing the issue/,
  );
  assert.equal(run.sandcastle.launched.length, 1);
});

test("a claim whose pull request merged without closing its issue is failed, not released", async () => {
  const run = factory({
    issues: [
      {
        number: 4,
        labels: ["ready-for-agent", "factory:running"],
        pullRequests: ["MERGED"],
      },
    ],
  });
  await run.tick();
  await run.tick();
  const issue = run.github.find(4);
  assert.deepEqual(issue.labels, ["ready-for-agent", "factory:failed"]);
  assert.deepEqual(issue.comments, [
    [
      "The factory run failed: its pull request merged without closing the issue; close the issue if that finished it.",
      "",
      "Remove `factory:failed` to let the factory pick this issue up again.",
    ].join("\n"),
  ]);
  assert.equal(run.sandcastle.launched.length, 0);
});

test("a merged pull request from an earlier run does not decide a later run's outcome", async () => {
  const earlier = { state: "MERGED", createdAt: "2026-10-01T00:00:00Z" };
  const kept = factory({
    issues: [{ number: 4, branchPullRequests: [earlier] }],
  });
  await kept.tick();
  kept.github.find(4).branchPullRequests.push("OPEN");
  kept.sandcastle.launched[0].finish();
  await settled();
  await kept.tick();
  assert.deepEqual(kept.github.find(4).labels, [
    "ready-for-agent",
    "factory:running",
  ]);
  assert.deepEqual(kept.github.find(4).comments, []);

  const retried = factory({
    issues: [{ number: 4, branchPullRequests: [earlier] }],
    hostSettings: { retryModel: "gpt-5.5@xhigh" },
  });
  await retried.tick();
  retried.sandcastle.launched[0].finish();
  await settled();
  await retried.tick();
  assert.equal(retried.sandcastle.launched.length, 2);
  assert.match(retried.sandcastle.launched[1].log, /attempt-2\.log$/);
  assert.deepEqual(retried.github.find(4).comments, []);
});

test("a retry keeps the open pull request from its timed-out first attempt", async () => {
  const run = factory({
    issues: [{ number: 4 }],
    hostSettings: { retryModel: "gpt-5.5", timeLimitMinutes: 1 },
  });
  await run.tick();
  const issue = run.github.find(4);
  issue.branchPullRequests.push({
    state: "OPEN",
    createdAt: "2026-10-09T12:00:30Z",
  });
  run.time.now = new Date("2026-10-09T12:02:00Z");
  await run.tick();
  assert.equal(run.sandcastle.launched[0].signal.aborted, true);
  await settled();
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 2);
  assert.equal(run.sandcastle.launched[1].branch, "factory/issue-4");
  run.time.now = new Date("2026-10-09T12:02:30Z");
  run.sandcastle.launched[1].finish();
  await settled();
  await run.tick();
  assert.deepEqual(issue.labels, ["ready-for-agent", "factory:running"]);
  assert.deepEqual(issue.comments, []);
});

for (const branchPullRequests of [
  [],
  [{ state: "OPEN", createdAt: "2026-10-09T11:59:59Z" }],
])
  test(`a retry fails with ${branchPullRequests.length ? "only an earlier run's" : "no"} pull request`, async () => {
    const run = factory({
      issues: [{ number: 4, branchPullRequests }],
      hostSettings: { retryModel: "gpt-5.5" },
    });
    await run.tick();
    run.sandcastle.launched[0].finish();
    await settled();
    await run.tick();
    assert.equal(run.sandcastle.launched.length, 2);
    run.sandcastle.launched[1].finish();
    await settled();
    await run.tick();
    const issue = run.github.find(4);
    assert.deepEqual(issue.labels, ["ready-for-agent", "factory:failed"]);
    assert.equal(issue.comments.length, 1);
    assert.match(
      issue.comments[0],
      /the run ended without an open pull request/,
    );
    assert.match(issue.comments[0], /attempt-2\.log/);
  });

test("a retry's time limit starts at its own launch even with an open pull request", async () => {
  const run = factory({
    issues: [{ number: 4 }],
    hostSettings: { retryModel: "gpt-5.5", timeLimitMinutes: 1 },
  });
  await run.tick();
  const issue = run.github.find(4);
  issue.branchPullRequests.push({
    state: "OPEN",
    createdAt: "2026-10-09T12:00:30Z",
  });
  run.time.now = new Date("2026-10-09T12:02:00Z");
  await run.tick();
  await settled();
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 2);
  run.time.now = new Date("2026-10-09T12:02:30Z");
  await run.tick();
  assert.equal(run.sandcastle.launched[1].signal.aborted, false);
  run.time.now = new Date("2026-10-09T12:03:01Z");
  await run.tick();
  assert.equal(run.sandcastle.launched[1].signal.aborted, true);
  await settled();
  await run.tick();
  assert.deepEqual(issue.labels, ["ready-for-agent", "factory:failed"]);
  assert.equal(issue.comments.length, 1);
  assert.match(
    issue.comments[0],
    /the run exceeded the time limit of 1 minutes/,
  );
  assert.match(issue.comments[0], /attempt-2\.log/);
});

test("an open pull request holds a claim even beside an earlier merged one", async () => {
  const run = factory({
    issues: [
      {
        number: 4,
        labels: ["ready-for-agent", "factory:running"],
        branchPullRequests: [
          { state: "MERGED", createdAt: "2026-10-01T00:00:00Z" },
          "OPEN",
        ],
      },
    ],
  });
  await run.tick();
  assert.deepEqual(run.github.find(4).labels, [
    "ready-for-agent",
    "factory:running",
  ]);
  assert.deepEqual(run.github.find(4).comments, []);
});

test("a poll interval a timer cannot wait is refused", () => {
  for (const seconds of ["Infinity", "2147484"])
    assert.throws(
      () =>
        readSettings({
          FACTORY_DEFAULT_MODEL: "gpt-5.5",
          FACTORY_CAPS: "codex=1",
          FACTORY_USAGE_THRESHOLD: "90",
          FACTORY_TIME_LIMIT_MINUTES: "60",
          FACTORY_POLL_SECONDS: seconds,
        }),
      /FACTORY_POLL_SECONDS: set it to a positive number of seconds/,
    );
  assert.equal(
    readSettings({
      FACTORY_DEFAULT_MODEL: "gpt-5.5",
      FACTORY_CAPS: "codex=1",
      FACTORY_USAGE_THRESHOLD: "90",
      FACTORY_TIME_LIMIT_MINUTES: "60",
      FACTORY_POLL_SECONDS: "2147483",
    }).pollSeconds,
    2147483,
  );
});

test("a time limit a timer cannot wait is refused", () => {
  for (const minutes of ["Infinity", "1e309", "35792"])
    assert.throws(
      () =>
        readSettings({
          FACTORY_DEFAULT_MODEL: "gpt-5.5",
          FACTORY_CAPS: "codex=1",
          FACTORY_USAGE_THRESHOLD: "90",
          FACTORY_TIME_LIMIT_MINUTES: minutes,
        }),
      /FACTORY_TIME_LIMIT_MINUTES: set it to a positive number of minutes/,
    );
  assert.equal(
    readSettings({
      FACTORY_DEFAULT_MODEL: "gpt-5.5",
      FACTORY_CAPS: "codex=1",
      FACTORY_USAGE_THRESHOLD: "90",
      FACTORY_TIME_LIMIT_MINUTES: "35791",
    }).timeLimitMinutes,
    35791,
  );
});

test("a run that Sandcastle ends at the time limit fails even with an open pull request", async () => {
  const run = factory({ issues: [{ number: 4 }] });
  await run.tick();
  run.github.find(4).pullRequests.push("OPEN");
  run.time.now = new Date("2026-10-09T16:00:00Z");
  run.sandcastle.launched[0].finish(new Error("idle timeout"));
  await settled();
  await run.tick();
  const issue = run.github.find(4);
  assert.deepEqual(issue.labels, ["ready-for-agent", "factory:failed"]);
  assert.match(
    issue.comments[0],
    /the run exceeded the time limit of 240 minutes/,
  );
});

test("a pull request from a fork never counts as the run's", async () => {
  const run = factory({ issues: [{ number: 4 }] });
  await run.tick();
  const fork = {
    state: "OPEN",
    createdAt: "2026-10-09T12:30:00Z",
    isCrossRepository: true,
  };
  run.github.find(4).branchPullRequests.push(fork);
  run.github.find(4).pullRequests.push(fork);
  run.sandcastle.launched[0].finish();
  await settled();
  await run.tick();
  const issue = run.github.find(4);
  assert.deepEqual(issue.labels, ["ready-for-agent", "factory:failed"]);
  assert.match(issue.comments[0], /the run ended without an open pull request/);
});

test("a cap too large to count is refused", () => {
  assert.throws(
    () =>
      readSettings({
        FACTORY_DEFAULT_MODEL: "gpt-5.5",
        FACTORY_CAPS: `codex=${"9".repeat(400)}`,
        FACTORY_USAGE_THRESHOLD: "90",
        FACTORY_TIME_LIMIT_MINUTES: "60",
      }),
    /FACTORY_CAPS: codex=9+ is not <provider>=<count>/,
  );
});

test("a run whose retry waits settles on the issue's latest state", async () => {
  const run = factory({
    issues: [{ number: 4 }],
    hostSettings: {
      retryModel: "gpt-5.5",
      caps: { "claude-code": 2, codex: 0 },
    },
  });
  await run.tick();
  run.sandcastle.launched[0].finish();
  await settled();
  await run.tick();
  assert.deepEqual(run.github.find(4).labels, [
    "ready-for-agent",
    "factory:running",
  ]);
  run.github.find(4).state = "CLOSED";
  await run.tick();
  assert.deepEqual(run.github.find(4).labels, ["ready-for-agent"]);
  assert.deepEqual(run.github.find(4).comments, []);
  assert.equal(run.sandcastle.launched.length, 1);
});

test("repositories whose names flatten alike get different images", () => {
  assert.equal(
    imageName("acme", "widgets"),
    "factory-acme-widgets-d782c8744023",
  );
  assert.notEqual(imageName("a-b", "c"), imageName("a", "b-c"));
  assert.match(
    imageName("Acme", "Wid.gets_2"),
    /^factory-acme-wid-gets-2-[0-9a-f]{12}$/,
  );
});

const currentSelection = {
  cli: { package: "@lutzseverino/repo-standards", version: "5.1.0" },
  standards: {
    repository: "https://github.com/acme/standards",
    version: "v0.5.6",
  },
  profile: "complete",
};
const available = {
  cli: { update: "available", newest: "6.0.0" },
  standards: { update: "available", newest: "v0.6.0" },
};
const candidateSelection = {
  ...currentSelection,
  cli: { ...currentSelection.cli, version: "6.0.0" },
  standards: { ...currentSelection.standards, version: "v0.6.0" },
};
const routineInspection = {
  format: "repo-standards/inspection/v7",
  identity: "sha256:candidate",
  selection: candidateSelection,
  confirmation: { required: false, reasons: [] },
};

test("the factory checks outdated once per 24 hours and inspects only available updates", async () => {
  const run = factory({ issues: [] });
  await run.tick();
  run.time.now = new Date("2026-10-10T11:59:59Z");
  await run.tick();
  assert.deepEqual(run.commands, [
    { args: ["outdated", "--json"], version: undefined },
  ]);
  run.time.now = new Date("2026-10-10T12:00:00Z");
  await run.tick();
  assert.equal(run.commands.length, 2);
  assert.equal(run.sandcastle.launched.length, 0);
});

test("a routine update inspects with the exact candidate CLI and runs adoption to merge without a ticket", async () => {
  const run = factory({ issues: [], updates: { outdated: available } });
  await run.tick();
  assert.deepEqual(run.commands, [
    { args: ["outdated", "--json"], version: undefined },
    { args: ["status", "--json"], version: undefined },
    {
      args: [
        "inspect",
        "--source",
        "https://github.com/acme/standards",
        "--standards-version",
        "v0.6.0",
        "--profile",
        "complete",
        "--json",
      ],
      version: "6.0.0",
    },
  ]);
  const [launch] = run.sandcastle.launched;
  assert.equal(launch.issue, undefined);
  assert.match(launch.branch, /^factory\/update-standards-update-/);
  assert.match(launch.prompt, /adopt-standards/);
  assert.match(launch.prompt, /babysit.*merge/);
  assert.match(launch.prompt, /"version":"6.0.0"/);
  assert.match(launch.prompt, /fresh discovery proposal/);
  assert.match(launch.prompt, /Never pass --confirmed unattended/);
  assert.equal(run.github.state.created.length, 0);
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 1);
  launch.finish();
  await new Promise((resolve) => setImmediate(resolve));
});

test("confirmation-required updates file one triage issue naming every reason instead of adopting", async () => {
  const inspection = {
    ...routineInspection,
    confirmation: {
      required: true,
      reasons: [
        { change: "discarded-edit", target: "CONTRIBUTING.md" },
        { change: "discarded-edit", target: "AGENTS.md" },
      ],
    },
  };
  const run = factory({
    issues: [],
    updates: { outdated: available, inspection },
  });
  await run.tick();
  const [issue] = run.github.state.created;
  assert.equal(issue.label, "needs-triage");
  assert.match(issue.title, /v0.6.0 with CLI 6.0.0/);
  assert.match(issue.body, /This update requires confirmation\./);
  assert.match(issue.body, /### Confirmation reasons\n/);
  assert.match(
    issue.body,
    /Triage whether to accept these changes before adopting the update\./,
  );
  assert.doesNotMatch(issue.body, /Workflows permission|### Workflow changes/);
  assert.match(issue.body, /discarded-edit: `CONTRIBUTING.md`/);
  assert.match(issue.body, /discarded-edit: `AGENTS.md`/);
  assert.match(issue.body, /sha256:candidate/);
  run.time.now = new Date("2026-10-10T12:00:00Z");
  await run.tick();
  assert.equal(run.github.state.created.length, 1);
  assert.equal(run.sandcastle.launched.length, 0);
});

test("CLI-only updates inspect retained standards without source flags", async () => {
  const run = factory({
    issues: [],
    updates: { outdated: { ...available, standards: { update: "none" } } },
  });
  await run.tick();
  assert.deepEqual(run.commands.at(-1), {
    args: ["inspect", "--json"],
    version: "6.0.0",
  });
  run.sandcastle.launched[0].finish();
});

test("standards-only updates inspect with the pinned confirmation-aware CLI", async () => {
  const run = factory({
    issues: [],
    updates: {
      outdated: { ...available, cli: { update: "none" } },
      status: {
        active: null,
        lastComplete: { inspection: "sha256:previous" },
        selection: { ...currentSelection, cli: candidateSelection.cli },
      },
    },
  });
  await run.tick();
  assert.equal(run.commands.at(-1).version, "6.0.0");
  run.sandcastle.launched[0].finish();
});

test("daily lookup failures are logged once and do not stop issue launches", async () => {
  const run = factory({
    issues: [{ number: 4 }],
    updates: { error: new Error("offline") },
  });
  await run.tick();
  await run.tick();
  assert.equal(run.commands.length, 1);
  assert.match(run.reports.join("\n"), /daily update check failed.*offline/);
  assert.equal(run.sandcastle.launched[0].issue, 4);
  run.sandcastle.launched[0].finish();
});

test("an active adoption or an old inspection report cannot launch an unattended update", async () => {
  for (const updates of [
    {
      outdated: available,
      status: { active: {}, selection: currentSelection },
    },
    {
      outdated: available,
      inspection: {
        ...routineInspection,
        format: "repo-standards/inspection/v6",
        confirmation: undefined,
      },
    },
  ]) {
    const run = factory({ issues: [], updates });
    await run.tick();
    assert.equal(run.sandcastle.launched.length, 0);
    assert.equal(run.github.state.created.length, 0);
  }
});

test("updates wait behind issue runs at the provider cap and then use released capacity", async () => {
  const run = factory({
    issues: [{ number: 4 }],
    hostSettings: { caps: { "claude-code": 1 } },
    updates: { outdated: available },
  });
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 1);
  run.github.find(4).pullRequests = ["OPEN"];
  run.sandcastle.launched[0].finish();
  await new Promise((resolve) => setImmediate(resolve));
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 2);
  assert.equal(run.sandcastle.launched[1].issue, undefined);
  run.sandcastle.launched[1].finish();
});

test("an adoption agent counts against the provider cap and is stopped at its time limit", async () => {
  const run = factory({
    issues: [],
    hostSettings: { caps: { "claude-code": 1 } },
    updates: { outdated: available },
  });
  await run.tick();
  run.github.state.issues.push({
    number: 4,
    state: "OPEN",
    createdAt: "2026-10-09T12:00:00Z",
    labels: ["ready-for-agent"],
    parent: null,
    subIssues: [],
    blockedBy: [],
    labelEvents: [],
    linkEvents: [],
    pullRequests: [],
    branchPullRequests: [],
    comments: [],
  });
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 1);
  assert.deepEqual(run.github.find(4).labels, ["ready-for-agent"]);
  run.time.now = new Date("2026-10-09T16:01:00Z");
  await run.tick();
  assert.equal(run.sandcastle.launched[0].signal.aborted, true);
});

test("an existing open adoption PR prevents another update launch after restart", async () => {
  const run = factory({ issues: [], updates: { outdated: available } });
  run.github.state.pullRequests.push({
    state: "OPEN",
    headRefName: "factory/update-earlier",
    isCrossRepository: false,
  });
  await run.tick();
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 0);
  assert.equal(run.docker.builds.length, 0);
  assert.equal(run.github.state.pullRequestReads, 2);
});

test("daily checks continue during long adoptions without requeueing the same candidate", async () => {
  const run = factory({
    issues: [],
    hostSettings: { timeLimitMinutes: 2880 },
    updates: { outdated: available },
  });
  await run.tick();
  run.time.now = new Date("2026-10-10T12:00:00Z");
  await run.tick();
  assert.equal(
    run.commands.filter(({ args }) => args[0] === "outdated").length,
    2,
  );
  assert.equal(run.sandcastle.launched.length, 1);
  assert.equal(run.sandcastle.launched[0].signal.aborted, false);
  run.time.now = new Date("2026-10-10T12:05:00Z");
  run.sandcastle.launched[0].finish();
  await new Promise((resolve) => setImmediate(resolve));
  await run.tick();
  assert.match(
    run.reports.join("\n"),
    /update run ended without a pull request/,
  );
  assert.equal(run.sandcastle.launched.length, 1);
  assert.equal(run.docker.builds.length, 1);
  run.time.now = new Date("2026-10-11T11:59:00Z");
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 1);
  run.time.now = new Date("2026-10-11T12:00:00Z");
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 2);
  run.sandcastle.launched[1].finish();
});

test("a fork PR cannot reserve the factory's update slot", async () => {
  const run = factory({ issues: [], updates: { outdated: available } });
  run.github.state.pullRequests.push({
    state: "OPEN",
    headRefName: "factory/update-contributor",
    isCrossRepository: true,
  });
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 1);
  run.sandcastle.launched[0].finish();
});

test("a retained selection without a completed adoption cannot schedule an update", async () => {
  const run = factory({
    issues: [],
    updates: {
      outdated: available,
      status: { active: null, selection: currentSelection, lastComplete: null },
    },
  });
  await run.tick();
  assert.equal(
    run.commands.some(({ args }) => args[0] === "inspect"),
    false,
  );
  assert.equal(run.sandcastle.launched.length, 0);
  assert.equal(run.github.state.created.length, 0);
});

test("a closed candidate PR holds the update without image builds or repeated PR reads", async () => {
  const earlier = factory({ issues: [], updates: { outdated: available } });
  await earlier.tick();
  const branch = earlier.sandcastle.launched[0].branch;
  earlier.sandcastle.launched[0].finish();
  const run = factory({ issues: [], updates: { outdated: available } });
  run.github.state.pullRequests.push({
    state: "CLOSED",
    headRefName: branch,
    isCrossRepository: false,
  });
  await run.tick();
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 0);
  assert.equal(run.docker.builds.length, 0);
  assert.equal(run.github.state.pullRequestReads, 1);
});

test("a failed update PR lookup does not prevent ready issue launches", async () => {
  const run = factory({
    issues: [{ number: 4 }],
    updates: { outdated: available },
  });
  run.github.state.pullRequestError = new Error("PR lookup offline");
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 1);
  assert.equal(run.sandcastle.launched[0].issue, 4);
  assert.match(
    run.reports.join("\n"),
    /update prerequisite lookup failed.*offline/,
  );
  run.sandcastle.launched[0].finish();
});

test("the running host restores the CLI when adoption changes its runtime pin", async (t) => {
  const packageName = "@example/standards-cli";
  const manifest = (version) =>
    JSON.stringify({ dependencies: { [packageName]: version } });
  const lock = (version) =>
    JSON.stringify({
      packages: {
        "": { dependencies: { [packageName]: version } },
        [`node_modules/${packageName}`]: { version },
      },
    });
  const runtime = ".repo-standards/runtime";
  const installed = `${runtime}/node_modules/${packageName}/package.json`;
  const repo = fixture({
    [`${runtime}/package.json`]: manifest("6.0.0"),
    [`${runtime}/package-lock.json`]: lock("6.0.0"),
    [installed]: JSON.stringify({ version: "6.0.0" }),
    [`${runtime}/node_modules/.bin/repo-standards`]: "",
    [`${runtime}/node_modules/.bin/repo-standards-bootstrap`]: "",
  });
  t.after(repo.close);
  const commands = [];
  const standards = createStandardsRunner(
    repo.root,
    async (executable, args) => {
      commands.push({ executable, args });
      if (executable === "npm")
        writeFileSync(
          join(repo.root, installed),
          JSON.stringify({ version: "7.0.0" }),
        );
      return "result";
    },
  );
  assert.equal(await standards(["outdated", "--json"]), "result");
  assert.equal(commands.length, 1);
  writeFileSync(join(repo.root, runtime, "package.json"), manifest("7.0.0"));
  writeFileSync(join(repo.root, runtime, "package-lock.json"), lock("7.0.0"));
  await standards(["status", "--json"]);
  assert.equal(commands[1].executable, "npm");
  assert.deepEqual(commands[1].args, [
    "ci",
    "--ignore-scripts",
    "--prefix",
    join(repo.root, runtime),
  ]);
  assert.equal(
    commands[2].executable,
    join(repo.root, runtime, "node_modules/.bin/repo-standards"),
  );
  await standards(["inspect", "--json"], "8.0.0");
  assert.equal(commands.length, 4);
  assert.equal(
    commands[3].executable,
    join(repo.root, runtime, "node_modules/.bin/repo-standards-bootstrap"),
  );
  assert.deepEqual(commands[3].args, [
    "--cli-version",
    "8.0.0",
    "inspect",
    "--json",
  ]);
});

test("a normal update exit without a PR reports its log and waits until the next daily check", async () => {
  const run = factory({ issues: [], updates: { outdated: available } });
  await run.tick();
  const launch = run.sandcastle.launched[0];
  launch.finish();
  await new Promise((resolve) => setImmediate(resolve));
  await run.tick();
  assert.match(
    run.reports.join("\n"),
    /update run ended without a pull request/,
  );
  assert.ok(run.reports.some((line) => line.includes(launch.log)));
  assert.equal(run.sandcastle.launched.length, 1);
  run.time.now = new Date("2026-10-10T12:00:00Z");
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 2);
  run.sandcastle.launched[1].finish();
});

test("old candidate PRs beyond 1,000 unrelated PRs still prevent a duplicate adoption", async () => {
  const earlier = factory({ issues: [], updates: { outdated: available } });
  await earlier.tick();
  const branch = earlier.sandcastle.launched[0].branch;
  earlier.sandcastle.launched[0].finish();
  const run = factory({ issues: [], updates: { outdated: available } });
  run.github.state.pullRequests = Array.from({ length: 1001 }, (_, index) => ({
    state: "CLOSED",
    headRefName: `topic-${index}`,
    isCrossRepository: false,
  }));
  run.github.state.pullRequests.push({
    state: "CLOSED",
    headRefName: branch,
    isCrossRepository: false,
  });
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 0);
  assert.equal(run.docker.builds.length, 0);
});

test("an open adoption beyond the first page of open PRs still holds the update", async () => {
  const run = factory({ issues: [], updates: { outdated: available } });
  run.github.state.pullRequests = Array.from({ length: 1001 }, (_, index) => ({
    state: "OPEN",
    headRefName: `topic-${index}`,
    isCrossRepository: false,
  }));
  run.github.state.pullRequests.push({
    state: "OPEN",
    headRefName: "factory/update-earlier",
    isCrossRepository: false,
  });
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 0);
  assert.equal(run.docker.builds.length, 0);
});

test("successful update exits inspect the exact branch and ignore fork lookalikes", async () => {
  for (const isCrossRepository of [false, true]) {
    const run = factory({ issues: [], updates: { outdated: available } });
    await run.tick();
    const launch = run.sandcastle.launched[0];
    run.github.state.pullRequests.push({
      state: "MERGED",
      headRefName: launch.branch,
      isCrossRepository,
    });
    launch.finish();
    await new Promise((resolve) => setImmediate(resolve));
    await run.tick();
    assert.equal(
      run.reports.some((line) => line.includes("without a pull request")),
      isCrossRepository,
    );
  }
});

test("a different daily update candidate waits for the active adoption to exit", async () => {
  const updates = { outdated: available, inspection: routineInspection };
  const run = factory({
    issues: [],
    hostSettings: { timeLimitMinutes: 2880 },
    updates,
  });
  await run.tick();
  const first = run.sandcastle.launched[0];
  updates.outdated = {
    ...available,
    cli: { update: "available", newest: "7.0.0" },
  };
  updates.inspection = {
    ...routineInspection,
    selection: {
      ...routineInspection.selection,
      cli: { ...routineInspection.selection.cli, version: "7.0.0" },
    },
  };
  run.time.now = new Date("2026-10-10T12:00:00Z");
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 1);
  first.finish();
  await new Promise((resolve) => setImmediate(resolve));
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 2);
  assert.notEqual(run.sandcastle.launched[1].branch, first.branch);
  assert.match(run.sandcastle.launched[1].prompt, /7\.0\.0/);
  run.sandcastle.launched[1].finish();
});

test("an agent-filed triage issue holds a routine candidate on later daily checks and remains held after closure and restart", async () => {
  const run = factory({ issues: [], updates: { outdated: available } });
  await run.tick();
  const launch = run.sandcastle.launched[0];
  const marker = launch.prompt.match(/standards-update-[a-f0-9]{16}/)[0];
  const issue = {
    title: "Confirm remote settings change",
    label: "needs-triage",
    body: `<!-- ${marker} -->\nThe fresh fix requires confirmation.`,
  };
  run.github.state.created.push(issue);
  launch.finish();
  await new Promise((resolve) => setImmediate(resolve));
  await run.tick();
  run.time.now = new Date("2026-10-10T12:00:00Z");
  await run.tick();
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 1);
  assert.equal(run.docker.builds.length, 1);
  const restarted = factory({ issues: [], updates: { outdated: available } });
  restarted.github.state.created.push({ ...issue, state: "CLOSED" });
  await restarted.tick();
  assert.equal(restarted.sandcastle.launched.length, 0);
  assert.equal(restarted.docker.builds.length, 0);
});

test("triage issues filed while a candidate waits for capacity hold it before image builds", async () => {
  const earlier = factory({ issues: [], updates: { outdated: available } });
  await earlier.tick();
  const marker = earlier.sandcastle.launched[0].prompt.match(
    /standards-update-[a-f0-9]{16}/,
  )[0];
  earlier.sandcastle.launched[0].finish();
  const usage = { "claude-code": 90 };
  const run = factory({ issues: [], usage, updates: { outdated: available } });
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 0);
  run.github.state.created.push({
    label: "needs-triage",
    body: `<!-- ${marker} -->`,
  });
  usage["claude-code"] = 10;
  await run.tick();
  await run.tick();
  assert.equal(run.sandcastle.launched.length, 0);
  assert.equal(run.docker.builds.length, 0);
  assert.match(run.reports.join("\n"), /update held by triage issue #10/);
});

test("workflow-only updates ask for owner delivery without confirmation", async () => {
  const run = factory({
    issues: [],
    updates: {
      outdated: available,
      inspection: {
        ...routineInspection,
        exact: [
          { target: ".github/workflows/new.yml", action: "create" },
          { target: ".github/workflows/ci.yml", action: "replace" },
        ],
        systemSkills: [
          { target: ".github/workflows/skill.yml", action: "replace" },
        ],
        removed: [{ target: ".github/workflows/old.yml" }],
      },
    },
  });
  await run.tick();
  const [issue] = run.github.state.created;
  assert.ok(issue, "workflow changes need an owner issue");
  for (const reason of [
    "create: `.github/workflows/new.yml`",
    "replace: `.github/workflows/ci.yml`",
    "replace: `.github/workflows/skill.yml`",
    "remove: `.github/workflows/old.yml`",
  ])
    assert.ok(issue.body.includes(reason));
  assert.match(issue.body, /Workflows permission/);
  assert.match(
    issue.body,
    /person with Workflows permission must deliver this update/,
  );
  assert.match(issue.body, /factory's GitHub App has no Workflows permission/);
  assert.match(issue.body, /### Workflow changes\n/);
  assert.doesNotMatch(
    issue.body,
    /confirmation|confirming|Triage whether to accept/,
  );
  assert.match(issue.body, /Inspection identity: `sha256:candidate`/);
  assert.match(issue.body, /Reinspect before adopting/);
  run.time.now = new Date("2026-10-10T12:00:00Z");
  await run.tick();
  assert.equal(run.github.state.created.length, 1);
  assert.equal(run.sandcastle.launched.length, 0);
});

test("updates needing confirmation and owner delivery keep their reasons and instructions apart", async () => {
  const run = factory({
    issues: [],
    updates: {
      outdated: available,
      inspection: {
        ...routineInspection,
        confirmation: {
          required: true,
          reasons: [{ change: "discarded-edit", target: "AGENTS.md" }],
        },
        exact: [{ target: ".github/workflows/ci.yml", action: "replace" }],
      },
    },
  });
  await run.tick();
  const [issue] = run.github.state.created;
  assert.match(issue.body, /This update requires confirmation\./);
  assert.match(issue.body, /factory's GitHub App has no Workflows permission/);
  const confirmation = issue.body.match(
    /### Confirmation reasons\n([\s\S]*?)\n### Workflow changes/,
  )[1];
  const workflows = issue.body.match(
    /### Workflow changes\n([\s\S]*?)\n### Desired outcome/,
  )[1];
  assert.match(confirmation, /discarded-edit: `AGENTS.md`/);
  assert.doesNotMatch(confirmation, /\.github\/workflows|Workflows permission/);
  assert.match(workflows, /replace: `\.github\/workflows\/ci.yml`/);
  assert.doesNotMatch(workflows, /discarded-edit|AGENTS\.md/);
  assert.match(
    issue.body,
    /Triage whether to accept these changes before adopting the update\.\n\nA person with Workflows permission must deliver this update\./,
  );
});

function gitRepositories(t) {
  const checkout = fixture({
    "README.md": "base\n",
    ".github/workflows/old.yml": "old\n",
  });
  const remote = fixture({});
  t.after(checkout.close);
  t.after(remote.close);
  const git = (args) =>
    execFileSync("git", args, {
      cwd: checkout.root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  execFileSync("git", ["init", "--bare", "--quiet", remote.root]);
  git(["config", "user.email", "factory@example.test"]);
  git(["config", "user.name", "Factory fixture"]);
  git(["add", "."]);
  git(["commit", "--quiet", "-m", "base"]);
  git(["remote", "add", "origin", remote.root]);
  return { root: checkout.root, git: async (args) => git(args), command: git };
}

for (const scenario of [
  "absent",
  "behind",
  "pushed",
  "contains",
  "ordinary",
  "removed",
  "reverted",
  "base advanced",
]) {
  test(`ended issue detection reads real Git with remote ${scenario}`, async (t) => {
    const repo = gitRepositories(t);
    const run = factory({
      issues: [{ number: 4 }],
      root: repo.root,
      git: repo.git,
      hostSettings: { retryModel: "gpt-5.5" },
    });
    await run.tick();
    repo.command(["checkout", "--quiet", "-b", "factory/issue-4"]);
    if (scenario === "behind")
      repo.command(["push", "--quiet", "origin", "HEAD"]);
    writeFileSync(
      join(
        repo.root,
        scenario === "ordinary" ? "README.md" : ".github/workflows/new.yml",
      ),
      "changed\n",
    );
    repo.command(["add", "."]);
    repo.command(["commit", "--quiet", "-m", "change"]);
    if (scenario === "removed") {
      repo.command(["rm", ".github/workflows/old.yml"]);
      repo.command(["commit", "--quiet", "-m", "delete workflow"]);
    }
    if (scenario === "reverted") repo.command(["revert", "--no-edit", "HEAD"]);
    if (scenario === "base advanced") {
      repo.command(["checkout", "--quiet", "--detach", "factory/issue-4"]);
    }
    if (["pushed", "contains"].includes(scenario))
      repo.command(["push", "--quiet", "origin", "HEAD"]);
    if (scenario === "contains") {
      const head = repo.command(["rev-parse", "HEAD"]).trim();
      repo.command([
        "commit",
        "--quiet",
        "--allow-empty",
        "-m",
        "remote successor",
      ]);
      repo.command(["push", "--quiet", "origin", "HEAD"]);
      repo.command(["reset", "--hard", head]);
    }
    run.sandcastle.launched[0].finish();
    await settled();
    const decisions = await run.tick();
    if (
      ["absent", "behind", "removed", "reverted", "base advanced"].includes(
        scenario,
      )
    ) {
      assert.equal(decisions[0].kind, "fail");
      assert.deepEqual(decisions[0].workflowPaths, [
        ".github/workflows/new.yml",
        ...(scenario === "removed" ? [".github/workflows/old.yml"] : []),
      ]);
      const issue = run.github.find(4);
      assert.ok(issue.labels.includes("factory:failed"));
      assert.match(issue.comments[0], /GitHub App can't push/);
      assert.match(issue.comments[0], /\.github\/workflows\/new.yml/);
      assert.match(issue.comments[0], /claude-code\/claude-sonnet-5-5@high/);
      assert.ok(issue.comments[0].includes(run.sandcastle.launched[0].log));
      assert.match(issue.comments[0], /person with Workflows permission/);
      assert.equal(run.sandcastle.launched.length, 1);
    } else {
      assert.equal(decisions[0].kind, "launch");
      assert.equal(decisions[0].attempt, 2);
      run.sandcastle.launched[1].finish();
    }
  });
}

test("an update's uninspected workflow changes file an owner issue and hold the next daily check", async (t) => {
  const repo = gitRepositories(t);
  const run = factory({
    issues: [],
    root: repo.root,
    git: repo.git,
    updates: { outdated: available },
  });
  await run.tick();
  const [launch] = run.sandcastle.launched;
  repo.command(["checkout", "--quiet", "-b", launch.branch]);
  writeFileSync(join(repo.root, ".github/workflows/old.yml"), "changed\n");
  writeFileSync(join(repo.root, ".github/workflows/new.yml"), "new\n");
  repo.command(["add", "."]);
  repo.command(["commit", "--quiet", "-m", "operation changes workflow"]);
  launch.finish();
  await settled();
  await run.tick();
  assert.equal(run.github.state.created.length, 1);
  const { body } = run.github.state.created[0];
  const workflows = body.match(
    /### Workflow changes\n([\s\S]*?)\n### Desired outcome/,
  )[1];
  assert.match(
    workflows,
    /refused workflow push: `\.github\/workflows\/old.yml`/,
  );
  assert.match(
    workflows,
    /refused workflow push: `\.github\/workflows\/new.yml`/,
  );
  assert.match(
    body,
    /person with Workflows permission must deliver this update/,
  );
  assert.match(body, /factory's GitHub App has no Workflows permission/);
  assert.doesNotMatch(body, /confirmation|confirming|Triage whether to accept/);
  run.time.now = new Date("2026-10-10T12:00:00Z");
  await run.tick();
  assert.equal(run.github.state.created.length, 1);
  assert.equal(run.sandcastle.launched.length, 1);
});
