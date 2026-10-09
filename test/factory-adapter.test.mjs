import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  claudeUsage,
  codexUsage,
  createFactory,
  readSettings,
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

function fakeGitHub(issues) {
  const state = {
    issues: issues.map((issue) => ({
      state: "OPEN",
      createdAt: `2026-10-0${issue.number}T00:00:00Z`,
      labels: ["ready-for-agent"],
      parent: null,
      subIssues: [],
      blockedBy: [],
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
                    labels: names(issue.labels),
                    parent: issue.parent && { number: issue.parent },
                    subIssues: {
                      nodes: issue.subIssues.map((child) => ({
                        number: child.number,
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
                  })),
              },
            },
          },
        },
      ]);
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

function factory({ issues, usage = {}, hostSettings = {}, clock }) {
  const github = fakeGitHub(issues);
  const sandcastle = fakeSandcastle();
  const docker = fakeDocker(github);
  const reports = [];
  const time = clock ?? { now: new Date("2026-10-09T12:00:00Z") };
  const instance = createFactory(
    { ...settings, ...hostSettings },
    {
      gh: github.gh,
      launch: sandcastle.launch,
      buildImage: docker.buildImage,
      readUsage: async (provider) => {
        if (usage[provider] instanceof Error) throw usage[provider];
        return usage[provider] ?? null;
      },
      now: () => time.now,
      root: "/srv/factory",
      report: (line) => reports.push(line),
    },
  );
  return { ...instance, github, sandcastle, docker, reports, time };
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
      image: "factory-acme-widgets",
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
      { issue: 4, image: "factory-acme-widgets" },
      { issue: 5, image: "factory-acme-widgets" },
      { issue: 4, image: "factory-acme-widgets" },
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

test("a failed first run relaunches its prompt on the retry model", async () => {
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
        prompt: "/implement-spec #4",
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
    },
  );
  const defaults = readSettings({
    FACTORY_DEFAULT_MODEL: "gpt-5.5",
    FACTORY_CAPS: "codex=1",
    FACTORY_USAGE_THRESHOLD: "90",
    FACTORY_TIME_LIMIT_MINUTES: "60",
  });
  assert.equal(defaults.retryModel, null);
  assert.equal(defaults.pollSeconds, 300);
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
