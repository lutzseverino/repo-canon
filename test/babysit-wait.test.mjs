import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  checkStates,
  decide,
  report,
  reviewRequestedAt,
} from "../.agents/skills/babysit/wait.mjs";

const root = new URL("..", import.meta.url).pathname;
const script = join(root, ".agents/skills/babysit/wait.mjs");
const fakeGh = join(root, "test/fixtures/fake-gh-babysit-wait.mjs");

const codex = "chatgpt-codex-connector[bot]";
const minute = 60_000;

// Codex's summary comment as it appears on #233, #254 and #257.
const summary = (status, commit, trigger = "PR opened") => ({
  login: codex,
  createdAt: "2026-10-11T05:39:59Z",
  body: `<!-- codex-pull-request-review-summary -->

## Codex Review Summary

This comment shows the latest Codex review activity on this pull request.

| Review | Status | Commit | Review trigger |
| --- | --- | --- | --- |
| 📝 **Code Review** | ${status} | \`${commit}\` | ${trigger} |

<details> <summary>ℹ️ About Codex in GitHub</summary>

Comment "@codex review" or "@codex security review".

</details>`,
});
const completedCell = (datetime) =>
  `✅ **Completed** <relative-time datetime="${datetime}">${datetime}</relative-time>`;
const completed = completedCell("2026-10-11T05:42:32.812517Z");
const inProgress = "⏳ **In progress**";

// Codex's reply on #231 when the repository has no Codex environment.
const unavailable = (createdAt) => ({
  login: codex,
  createdAt,
  body: "To use Codex here, [create an environment for this repo](https://chatgpt.com/codex/cloud/settings/environments).",
});

const passed = [{ name: "check", state: "pass", link: "https://ci/1" }];

const decision = (overrides) =>
  decide({
    head: "f7bb671a07642acc7458fd7a885dfb0d7507f4c4",
    checks: passed,
    requestedAt: Date.parse("2026-10-11T05:39:50Z"),
    pushedAt: Date.parse("2026-10-11T05:39:50Z"),
    comments: [],
    now: Date.parse("2026-10-11T05:43:00Z"),
    startedAt: Date.parse("2026-10-11T05:40:00Z"),
    limitMs: 9 * minute,
    ...overrides,
  });

test("Completed for the head on a clean pass is reviewed (#257)", () => {
  const outcome = decision({ comments: [summary(completed, "f7bb671")] });
  assert.equal(outcome.code, 0);
  assert.equal(outcome.codex, "reviewed");
});

test("Completed for the head after a manual request is reviewed (#233)", () => {
  const outcome = decision({
    head: "322f254a37c73492dab5ca4a8b2566dcb48ae82f",
    requestedAt: Date.parse("2026-10-11T04:35:42Z"),
    pushedAt: Date.parse("2026-10-11T04:35:37Z"),
    comments: [
      summary(completed, "322f254", "Manual request"),
      {
        login: "lutzseverino",
        createdAt: "2026-10-11T04:35:42Z",
        body: "@codex review",
      },
    ],
    now: Date.parse("2026-10-11T04:40:00Z"),
    startedAt: Date.parse("2026-10-11T04:36:00Z"),
  });
  assert.equal(outcome.code, 0);
});

test("Completed for an older commit keeps waiting", () => {
  assert.equal(
    decision({ comments: [summary(completed, "61e9ca4")] }).code,
    null,
  );
});

test("a review in progress for the head keeps waiting", () => {
  const outcome = decision({ comments: [summary(inProgress, "f7bb671")] });
  assert.equal(outcome.code, null);
  assert.equal(outcome.codex, "reviewing");
});

test("a re-request on an unchanged head waits past the earlier Completed row", () => {
  const requestedAt = Date.parse("2026-10-11T05:50:00Z");
  const rerequest = {
    requestedAt,
    startedAt: requestedAt,
    now: requestedAt + 2 * minute,
  };
  assert.equal(
    decision({ ...rerequest, comments: [summary(completed, "f7bb671")] }).code,
    null,
  );
  const outcome = decision({
    ...rerequest,
    comments: [summary(completedCell("2026-10-11T05:50:00Z"), "f7bb671")],
  });
  assert.equal(outcome.code, 0);
  assert.equal(outcome.codex, "reviewed");
});

test("a Completed row without its datetime is not reviewed", () => {
  const outcome = decision({
    comments: [summary("✅ **Completed**", "f7bb671")],
  });
  assert.equal(outcome.code, null);
  assert.equal(outcome.codex, "pending");
});

test("a push and a later re-request wait for the review after it (#265)", () => {
  const head = "fa82ec7d5c1d1f2b8a6e0c4b3a2f1e0d9c8b7a65";
  const opened = Date.parse("2026-10-11T22:15:21Z");
  const comments = [
    {
      ...summary(completedCell("2026-10-11T22:18:00.000000Z"), "0b7bcb4"),
      createdAt: "2026-10-11T22:15:39Z",
    },
    {
      login: "lutzseverino",
      createdAt: "2026-10-11T22:18:04Z",
      body: "@codex review",
    },
  ];
  const requestedAt = reviewRequestedAt(opened, comments);
  assert.equal(requestedAt, Date.parse("2026-10-11T22:18:04Z"));
  const look = {
    head,
    requestedAt,
    pushedAt: Date.parse("2026-10-11T22:17:16Z"),
    startedAt: Date.parse("2026-10-11T22:18:10Z"),
  };
  assert.equal(
    decision({ ...look, comments, now: Date.parse("2026-10-11T22:20:00Z") })
      .code,
    null,
  );
  comments[0] = {
    ...summary(
      completedCell("2026-10-11T22:22:02.430104Z"),
      "fa82ec7",
      "Manual request",
    ),
    createdAt: "2026-10-11T22:15:39Z",
  };
  const outcome = decision({
    ...look,
    comments,
    now: Date.parse("2026-10-11T22:22:30Z"),
  });
  assert.equal(outcome.code, 0);
  assert.equal(outcome.codex, "reviewed");
});

test("a head pushed after the latest request is not requested, at once", () => {
  const pushed = {
    pushedAt: Date.parse("2026-10-11T05:45:00Z"),
    now: Date.parse("2026-10-11T05:45:30Z"),
    comments: [summary(completed, "61e9ca4")],
  };
  const outcome = decision(pushed);
  assert.equal(outcome.code, 4);
  assert.equal(outcome.codex, "not requested");
  assert.deepEqual(report(outcome, "f7bb671a07642acc"), [
    "f7bb671: checks passed, Codex review not requested for this head",
  ]);
  const failed = decision({
    ...pushed,
    checks: [{ name: "lint", state: "fail", link: "https://ci/2" }],
  });
  assert.equal(failed.code, 2);
  assert.deepEqual(report(failed, "f7bb671a07642acc"), [
    "f7bb671: 1 check failed, Codex review not requested for this head",
    "lint https://ci/2",
  ]);
});

test("no Codex comment 5 minutes after the request is no response", () => {
  const requestedAt = Date.parse("2026-10-11T05:39:50Z");
  assert.equal(decision({ now: requestedAt + 4 * minute }).code, null);
  const outcome = decision({ now: requestedAt + 5 * minute });
  assert.equal(outcome.code, 4);
  assert.equal(outcome.codex, "no response");
  assert.deepEqual(report(outcome, "f7bb671a07642acc"), [
    "f7bb671: checks passed, Codex did not respond within 5 minutes",
  ]);
  // Once Codex has commented on the pull request, only 30 minutes bound it.
  const answered = {
    comments: [summary(completed, "61e9ca4")],
    startedAt: requestedAt + 25 * minute,
  };
  assert.equal(
    decision({ ...answered, now: requestedAt + 29 * minute }).code,
    null,
  );
  const bounded = decision({ ...answered, now: requestedAt + 30 * minute });
  assert.equal(bounded.code, 4);
  assert.equal(bounded.codex, "not reviewing");
});

test("the unavailable reply after the latest request is unavailable (#231)", () => {
  const outcome = decision({
    head: "1bbe726cfa6e37b68a9ccb929e8c7c244f2a004f",
    requestedAt: Date.parse("2026-10-11T03:38:53Z"),
    comments: [unavailable("2026-10-11T03:39:00Z")],
    now: Date.parse("2026-10-11T03:39:30Z"),
    startedAt: Date.parse("2026-10-11T03:39:10Z"),
  });
  assert.equal(outcome.code, 3);
  assert.equal(outcome.codex, "unavailable");
});

test("an unavailable reply before the latest request is ignored", () => {
  assert.equal(
    decision({ comments: [unavailable("2026-10-11T05:00:00Z")] }).code,
    null,
  );
});

test("30 minutes after the latest request is not reviewing, across invocations", () => {
  const requestedAt = Date.parse("2026-10-11T05:39:50Z");
  const comments = [summary(inProgress, "f7bb671")];
  // An earlier invocation hit its limit; a later one starts 25 minutes in.
  assert.equal(
    decision({
      requestedAt,
      comments,
      startedAt: requestedAt,
      now: requestedAt + 9 * minute,
    }).code,
    5,
  );
  const later = { requestedAt, comments, startedAt: requestedAt + 25 * minute };
  assert.equal(
    decision({ ...later, now: requestedAt + 29 * minute }).code,
    null,
  );
  const outcome = decision({ ...later, now: requestedAt + 30 * minute });
  assert.equal(outcome.code, 4);
  assert.equal(outcome.codex, "not reviewing");
});

const failedChecks = [
  ...passed,
  { name: "lint", state: "fail", link: "https://ci/2" },
];

test("a failed check waits while Codex reviews, then is exit 2 once it settles", () => {
  assert.equal(
    decision({
      checks: failedChecks,
      comments: [summary(inProgress, "f7bb671")],
    }).code,
    null,
  );
  const outcome = decision({
    checks: failedChecks,
    comments: [summary(completed, "f7bb671")],
  });
  assert.equal(outcome.code, 2);
  assert.deepEqual(report(outcome, "f7bb671a07642acc"), [
    "f7bb671: 1 check failed, Codex reviewed",
    "lint https://ci/2",
  ]);
  const requestedAt = Date.parse("2026-10-11T05:39:50Z");
  // Past the 30-minute bound, a review still in progress no longer holds it.
  const late = decision({
    checks: failedChecks,
    comments: [summary(inProgress, "f7bb671")],
    startedAt: requestedAt + 25 * minute,
    now: requestedAt + 30 * minute,
  });
  assert.equal(late.code, 2);
  assert.equal(
    report(late, "f7bb671a07642acc")[0],
    "f7bb671: 1 check failed, Codex did not review within 30 minutes",
  );
});

test("a failed check with no summary row for the head is exit 2 at once", () => {
  const outcome = decision({
    checks: failedChecks,
    comments: [summary(completed, "61e9ca4")],
  });
  assert.equal(outcome.code, 2);
  assert.equal(outcome.codex, "pending");
  assert.deepEqual(report(outcome, "f7bb671a07642acc"), [
    "f7bb671: 1 check failed, Codex review pending",
    "lint https://ci/2",
  ]);
});

test("pending checks keep waiting after Codex settles", () => {
  const checks = [{ name: "test", state: "pending", link: "https://ci/3" }];
  assert.equal(
    decision({ checks, comments: [summary(completed, "f7bb671")] }).code,
    null,
  );
});

test("a head with no checks counts as passed", () => {
  assert.equal(
    decision({ checks: [], comments: [summary(completed, "f7bb671")] }).code,
    0,
  );
});

test("the invocation limit is exit 5 and names what is still pending", () => {
  const outcome = decision({
    comments: [summary(inProgress, "f7bb671")],
    now: Date.parse("2026-10-11T05:49:00Z"),
  });
  assert.equal(outcome.code, 5);
  assert.deepEqual(report(outcome, "f7bb671a07642acc"), [
    "f7bb671: still waiting on Codex; run again",
  ]);
});

test("the invocation limit lists checks that already failed", () => {
  const outcome = decision({
    checks: [{ name: "lint", state: "fail", link: "https://ci/2" }],
    comments: [summary(inProgress, "f7bb671")],
    now: Date.parse("2026-10-11T05:49:00Z"),
  });
  assert.equal(outcome.code, 5);
  assert.deepEqual(report(outcome, "f7bb671a07642acc"), [
    "f7bb671: 1 check failed, still waiting on Codex; run again",
    "lint https://ci/2",
  ]);
});

test("each settled outcome reports one line", () => {
  const head = "f7bb671a07642acc";
  assert.deepEqual(
    report(decision({ comments: [summary(completed, "f7bb671")] }), head),
    ["f7bb671: checks passed, Codex reviewed"],
  );
  assert.deepEqual(
    report(decision({ comments: [unavailable("2026-10-11T05:40:00Z")] }), head),
    ["f7bb671: checks passed, Codex unavailable"],
  );
  assert.deepEqual(
    report(
      decision({
        comments: [summary(inProgress, "f7bb671")],
        now: Date.parse("2026-10-11T06:10:00Z"),
      }),
      head,
    ),
    ["f7bb671: checks passed, Codex did not review within 30 minutes"],
  );
});

test("the latest request is the later of the opening and a re-request", () => {
  const opened = Date.parse("2026-10-11T04:20:00Z");
  const comments = [
    summary(completed, "322f254"),
    {
      login: "lutzseverino",
      createdAt: "2026-10-11T04:30:00Z",
      body: "@codex review",
    },
  ];
  // Codex's own summary quotes "@codex review" and is no request.
  assert.equal(
    reviewRequestedAt(opened, comments),
    Date.parse("2026-10-11T04:30:00Z"),
  );
  assert.equal(
    reviewRequestedAt(opened, [summary(completed, "322f254")]),
    opened,
  );
  comments.push({
    login: "factory-app[bot]",
    createdAt: "2026-10-11T04:40:00Z",
    body: "Fixed. @codex review",
  });
  comments.push({
    login: "lutzseverino",
    createdAt: "2026-10-11T04:45:00Z",
    body: "@codex security review",
  });
  assert.equal(
    reviewRequestedAt(opened, comments),
    Date.parse("2026-10-11T04:45:00Z"),
  );
});

test("check states follow the latest run of each check", () => {
  assert.deepEqual(
    checkStates([
      {
        __typename: "CheckRun",
        name: "test",
        workflowName: "ci",
        status: "COMPLETED",
        conclusion: "FAILURE",
        startedAt: "2026-10-11T05:00:00Z",
        detailsUrl: "https://ci/old",
      },
      {
        __typename: "CheckRun",
        name: "test",
        workflowName: "ci",
        status: "IN_PROGRESS",
        conclusion: "",
        startedAt: "2026-10-11T05:10:00Z",
        detailsUrl: "https://ci/new",
      },
      {
        __typename: "CheckRun",
        name: "docs",
        workflowName: "ci",
        status: "COMPLETED",
        conclusion: "SKIPPED",
        startedAt: "2026-10-11T05:00:00Z",
        detailsUrl: "https://ci/docs",
      },
      {
        __typename: "StatusContext",
        context: "deploy",
        state: "ERROR",
        startedAt: "2026-10-11T05:00:00Z",
        targetUrl: "https://deploy",
      },
    ]),
    [
      { name: "test", state: "pending", link: "https://ci/new" },
      { name: "docs", state: "pass", link: "https://ci/docs" },
      { name: "deploy", state: "fail", link: "https://deploy" },
    ],
  );
});

// Runs the script against a fake `gh` and returns everything it wrote, with
// the time of its first write.
const run = (state, args) => {
  const directory = mkdtempSync(join(tmpdir(), "babysit-wait-"));
  const statePath = join(directory, "state.json");
  writeFileSync(statePath, JSON.stringify(state));
  const gh = join(directory, "gh");
  writeFileSync(gh, `#!/bin/sh\nexec node ${fakeGh} "$@"\n`, { mode: 0o755 });
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [script, ...args], {
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        FAKE_GH_STATE: statePath,
      },
    });
    let stdout = "";
    let stderr = "";
    let firstWrite = null;
    const record = (chunk, append) => {
      firstWrite ??= Date.now() - started;
      append(chunk.toString());
    };
    child.stdout.on("data", (chunk) => record(chunk, (s) => (stdout += s)));
    child.stderr.on("data", (chunk) => record(chunk, (s) => (stderr += s)));
    child.on("close", (code) => {
      rmSync(directory, { recursive: true, force: true });
      resolve({
        code,
        stdout,
        stderr,
        firstWrite,
        elapsed: Date.now() - started,
      });
    });
  });
};

const openedNow = new Date().toISOString();
const pendingPullRequest = {
  head: "f7bb671a07642acc7458fd7a885dfb0d7507f4c4",
  branch: "feat/example",
  createdAt: openedNow,
  pushedAt: openedNow,
  checks: [
    {
      __typename: "CheckRun",
      name: "test",
      workflowName: "ci",
      status: "IN_PROGRESS",
      conclusion: "",
      startedAt: new Date().toISOString(),
      detailsUrl: "https://ci/1",
    },
  ],
  comments: [],
};

test("the script writes nothing while it waits, then one line at its limit", async () => {
  const result = await run(pendingPullRequest, [
    "12",
    "--limit",
    "2",
    "--interval",
    "0.2",
  ]);
  assert.equal(result.code, 5);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    "f7bb671: still waiting on checks and Codex; run again\n",
  );
  assert.ok(result.firstWrite >= 1900, `wrote after ${result.firstWrite} ms`);
});

test("an already-settled outcome exits at once", async () => {
  const result = await run(
    {
      ...pendingPullRequest,
      checks: [
        {
          ...pendingPullRequest.checks[0],
          status: "COMPLETED",
          conclusion: "FAILURE",
        },
      ],
      comments: [
        {
          ...summary(completedCell(new Date().toISOString()), "f7bb671"),
          createdAt: new Date().toISOString(),
        },
      ],
    },
    ["12", "--repo", "owner/name"],
  );
  assert.equal(result.code, 2);
  assert.equal(
    result.stdout,
    "f7bb671: 1 check failed, Codex reviewed\ntest https://ci/1\n",
  );
  assert.ok(result.elapsed < 5000);
});

test("the head's push time comes from GitHub's activity record", async () => {
  // Opened long ago, pushed just now with no re-request: not requested.
  const pushed = await run(
    { ...pendingPullRequest, checks: [], createdAt: "2026-10-11T05:00:00Z" },
    ["12"],
  );
  assert.equal(pushed.code, 4);
  assert.equal(
    pushed.stdout,
    "f7bb671: checks passed, Codex review not requested for this head\n",
  );
  // A later re-request makes the pushed head requested again.
  const rerequested = await run(
    {
      ...pendingPullRequest,
      checks: [],
      createdAt: "2026-10-11T05:00:00Z",
      pushedAt: new Date(Date.now() - minute).toISOString(),
      comments: [
        {
          login: "lutzseverino",
          createdAt: new Date().toISOString(),
          body: "@codex review",
        },
      ],
    },
    ["12", "--limit", "0.3", "--interval", "0.1"],
  );
  assert.equal(rerequested.code, 5);
  assert.equal(
    rerequested.stdout,
    "f7bb671: still waiting on Codex; run again\n",
  );
  // Without an activity record, the head's committer date stands in, and a
  // push is never before the opening.
  const committed = await run(
    {
      ...pendingPullRequest,
      checks: [],
      createdAt: "2026-10-11T05:00:00Z",
      pushedAt: null,
      committedAt: "2026-10-11T04:59:00Z",
    },
    ["12"],
  );
  assert.equal(committed.code, 4);
  assert.equal(
    committed.stdout,
    "f7bb671: checks passed, Codex did not respond within 5 minutes\n",
  );
});

test("usage and gh errors exit 1 with one line", async () => {
  const usage = await run(pendingPullRequest, []);
  assert.equal(usage.code, 1);
  assert.equal(usage.stdout, "");
  assert.equal(usage.stderr.trim().split("\n").length, 1);
  const failure = await run({ ...pendingPullRequest, fail: true }, ["12"]);
  assert.equal(failure.code, 1);
  assert.equal(failure.stderr.trim().split("\n").length, 1);
  assert.match(failure.stderr, /HTTP 502/);
});
