import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { installedValidator } from "./helpers/installed-validator.mjs";
import { fixtureFetch } from "./fixtures/postern-babysit.mjs";
import { connect } from "../vendor/postern/postern.mjs";
import {
  checkStates,
  decide,
  main,
  report,
  reviewRequestedAt,
} from "../.agents/skills/babysit/wait.mjs";

test("invalid durations fail before accessing the connection", async (t) => {
  let stderr = "";
  t.mock.method(process.stderr, "write", (chunk) => {
    stderr += chunk;
    return true;
  });
  const connection = new Proxy(
    {},
    {
      get() {
        assert.fail("invalid duration accessed the connection");
      },
    },
  );
  for (const flag of ["--limit", "--interval"]) {
    for (const value of ["Infinity", "-Infinity", "NaN", "0", "-1", "1e308"]) {
      stderr = "";
      assert.equal(await main(["12", flag, value], connection), 1);
      assert.match(stderr, new RegExp(`${flag} must be .*positive.*seconds`));
    }
  }
});

test("accepted durations preserve polling intervals and invocation deadlines", async (t) => {
  for (const scenario of [
    {
      name: "defaults",
      installed: false,
      args: [],
      polls: Array.from({ length: 19 }, (_, index) => index * 30_000),
      pauses: Array(18).fill(30_000),
    },
    {
      name: "fractional seconds",
      installed: false,
      args: ["--limit", "0.25", "--interval", "0.1"],
      polls: [0, 100, 200, 250],
      pauses: [100, 100, 50],
    },
    {
      name: "integer seconds",
      installed: false,
      args: ["--limit", "2", "--interval", "1"],
      polls: [0, 1000, 2000],
      pauses: [1000, 1000],
    },
    ...[false, true].map((installed) => ({
      name: `long waits (${installed ? "installed" : "source"})`,
      installed,
      args: ["--limit", "5500000", "--interval", "3000000"],
      polls: [0, 3_000_000_000, 5_500_000_000],
      pauses: [2_147_483_647, 852_516_353, 2_147_483_647, 352_516_353],
    })),
  ]) {
    await t.test(scenario.name, async (t) => {
      const waitMain = scenario.installed
        ? (
            await import(
              pathToFileURL(
                installedValidator(t, ".agents/skills/babysit/wait.mjs"),
              ).href
            )
          ).main
        : main;
      const directory = mkdtempSync(join(tmpdir(), "babysit-wait-clock-"));
      t.after(() => rmSync(directory, { recursive: true, force: true }));
      const statePath = join(directory, "state.json");
      writeFileSync(
        statePath,
        JSON.stringify({
          head: "a".repeat(40),
          createdAt: "2026-10-11T05:00:00Z",
          pushedAt: "2026-10-11T05:00:00Z",
          checks: [
            { __typename: "StatusContext", context: "CI", state: "PENDING" },
          ],
        }),
      );
      const startedAt = Date.parse("2026-10-11T05:00:00Z");
      let now = startedAt;
      const pauses = [];
      t.mock.method(Date, "now", () => now);
      t.mock.method(globalThis, "setTimeout", (callback, delay) => {
        assert.ok(
          delay > 0 && delay <= 2_147_483_647,
          `unsafe timer delay: ${delay}`,
        );
        assert.ok(
          pauses.length < scenario.pauses.length,
          "polling did not reach its deadline",
        );
        pauses.push(delay);
        now += delay;
        queueMicrotask(callback);
      });
      let stdout = "";
      t.mock.method(process.stdout, "write", (chunk) => {
        stdout += chunk;
        return true;
      });
      const fetch = fixtureFetch(statePath);
      const polls = [];
      const connection = connect("https://github.com/example/repository", {
        credential: "fixture-credential",
        fetch: async (input, options) => {
          if (
            options.body &&
            JSON.parse(options.body).query?.includes("PosternPullRequest(")
          )
            polls.push(now - startedAt);
          return fetch(input, options);
        },
      });
      assert.equal(await waitMain(["12", ...scenario.args], connection), 5);
      assert.deepEqual(polls, scenario.polls);
      assert.deepEqual(pauses, scenario.pauses);
      assert.match(stdout, /still waiting on checks; run again/);
    });
  }
});

const root = new URL("..", import.meta.url).pathname;
const fakePlatform = new URL("./fixtures/postern-babysit.mjs", import.meta.url)
  .href;

const reviewerFixture = (name) =>
  JSON.parse(
    readFileSync(join(root, `test/fixtures/reviewers/${name}.json`), "utf8"),
  );
const codexReviewer = reviewerFixture("codex");
const githubReviewer = reviewerFixture("github-review");
const codex = codexReviewer.account;
const minute = 60_000;
const head = "f7bb671a07642acc7458fd7a885dfb0d7507f4c4";

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

// A "@codex security review" row as Codex adds it to the same summary table.
const securityRow = (status, commit) =>
  `| 🔒 **Security Review** | ${status} | \`${commit}\` | Manual request |`;
const codeReviewRow = (comment) =>
  comment.body.split("\n").find((line) => line.includes("**Code Review**"));
const withSecurityReview = (
  comment,
  status,
  commit,
  { keepCode = true } = {},
) => ({
  ...comment,
  body: comment.body.replace(
    codeReviewRow(comment),
    [keepCode ? codeReviewRow(comment) : null, securityRow(status, commit)]
      .filter(Boolean)
      .join("\n"),
  ),
});

// Codex's reply on #231 when the repository has no Codex environment.
const unavailable = (createdAt) => ({
  login: codex,
  createdAt,
  body: "To use Codex here, [create an environment for this repo](https://chatgpt.com/codex/cloud/settings/environments).",
});

// Codex's reply on lutzseverino/homelab#115 when the requester has no linked account.
const accountRequired = (createdAt) => ({
  login: codex,
  createdAt,
  body: "To use Codex here, [create a Codex account and connect to github](https://chatgpt.com/codex/cloud/settings/connectors).",
});

const passed = [{ name: "check", state: "pass", link: "https://ci/1" }];

/** @returns {Record<string, any>} */
const decision = (overrides) =>
  decide({
    head,
    reviewer: codexReviewer,
    checks: passed,
    requestedAt: Date.parse("2026-10-11T05:39:50Z"),
    pushedAt: Date.parse("2026-10-11T05:39:50Z"),
    pushRecorded: true,
    comments: [],
    now: Date.parse("2026-10-11T05:43:00Z"),
    startedAt: Date.parse("2026-10-11T05:40:00Z"),
    limitMs: 9 * minute,
    ...overrides,
  });

test("the declared app skips external review on initial and resumed heads", () => {
  for (const author of ["factory-app[bot]", "app/FACTORY-APP"]) {
    for (const pushedAt of [0, Date.parse("2026-10-11T05:42:00Z")]) {
      const outcome = decision({
        policy: { version: 1, author: "Factory-App[bot]" },
        author,
        pushedAt,
      });
      assert.equal(outcome.code, 6);
      assert.equal(outcome.reviewer, "skipped");
      assert.match(
        report(outcome, head)[0],
        /external review skipped by app-author policy/,
      );
    }
  }
});

test("policy skips preserve check failures, pending checks, workflow waits and arriving findings", () => {
  const policy = { version: 1, author: "app/factory-app" };
  const context = { policy, author: "FACTORY-APP[bot]" };
  assert.equal(
    decision({ ...context, checks: [{ name: "test", state: "fail" }] }).code,
    2,
  );
  for (const pending of [
    { checks: [{ name: "test", state: "pending" }] },
    { runs: [{ status: "queued" }] },
    { checks: [], pushRecorded: false },
    { checks: [], pushedAt: Date.parse("2026-10-11T05:42:59Z") },
  ]) {
    assert.equal(decision({ ...context, ...pending }).code, null);
  }
  const arrived = decision({
    ...context,
    reviews: [
      {
        user: { login: codex },
        commit_id: head,
        state: "CHANGES_REQUESTED",
        body: "Fix this defect.",
      },
    ],
  });
  assert.equal(arrived.code, 6);
  assert.equal(arrived.reviewer, "skipped");
  assert.equal(decision({ ...context, reviewer: null }).code, 6);
  assert.equal(
    reviewRequestedAt(
      123,
      [{ body: codexReviewer.request.comment, createdAt: openedNow }],
      codexReviewer,
      context,
    ),
    null,
  );
});

test("a different or missing author and supported absence preserve review waits", () => {
  for (const context of [
    { policy: { version: 1, author: "factory-app[bot]" }, author: "owner" },
    {
      policy: { version: 1, author: "factory-app[bot]" },
      author: "factory-app",
    },
    { policy: { version: 1, author: "factory-app[bot]" } },
    { policy: null, author: "factory-app[bot]" },
  ]) {
    assert.equal(decision(context).code, null);
    assert.equal(decision(context).reviewer, "pending");
  }
});

test("Completed for the head on a clean pass is reviewed (#257)", () => {
  const outcome = decision({ comments: [summary(completed, "f7bb671")] });
  assert.equal(outcome.code, 0);
  assert.equal(outcome.reviewer, "reviewed");
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
  assert.equal(outcome.reviewer, "pending");
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
  assert.equal(outcome.reviewer, "reviewed");
});

test("a completed Security Review row does not finish the review", () => {
  const securityDone = completedCell("2026-10-11T05:42:32.812517Z");
  for (const code of [inProgress, completedCell("2026-10-11T05:42:32Z")]) {
    const stale = code === inProgress ? "f7bb671" : "61e9ca4";
    const outcome = decision({
      comments: [
        withSecurityReview(summary(code, stale), securityDone, "f7bb671"),
      ],
    });
    assert.equal(outcome.code, null);
    assert.equal(outcome.reviewer, "pending");
  }
  const absent = decision({
    comments: [
      withSecurityReview(
        summary(completed, "f7bb671"),
        securityDone,
        "f7bb671",
        { keepCode: false },
      ),
    ],
  });
  assert.equal(absent.code, null);
  assert.equal(absent.reviewer, "pending");
});

test("completed Code Review and Security Review rows finish on the Code Review row", () => {
  const codeAt = "2026-10-11T05:42:32.812517Z";
  const comment = withSecurityReview(
    summary(completedCell(codeAt), "f7bb671"),
    completedCell("2026-10-11T05:41:00.000000Z"),
    "61e9ca4",
  );
  const outcome = decision({ comments: [comment] });
  assert.equal(outcome.code, 0);
  assert.equal(outcome.reviewer, "reviewed");
  const pattern = new RegExp(codexReviewer.finished.line, "u");
  const matches = comment.body
    .split("\n")
    .map((line) => pattern.exec(line)?.groups)
    .filter(Boolean);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].sha, "f7bb671");
  assert.equal(matches[0].at, codeAt);
});

test("the Codex fixture keeps the configured completion pattern", () => {
  const configured = JSON.parse(
    readFileSync(join(root, ".github/pull-request-reviewer.json"), "utf8"),
  );
  assert.equal(codexReviewer.finished.line, configured.finished.line);
  assert.equal(
    codexReviewer.finished.commentMarker,
    configured.finished.commentMarker,
  );
});

test("a Completed row without its datetime is not reviewed", () => {
  const outcome = decision({
    comments: [summary("✅ **Completed**", "f7bb671")],
  });
  assert.equal(outcome.code, null);
  assert.equal(outcome.reviewer, "pending");
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
  const requestedAt = reviewRequestedAt(opened, comments, codexReviewer);
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
  assert.equal(outcome.reviewer, "reviewed");
});

test("a head pushed after the latest request is not requested, at once", () => {
  const pushed = {
    pushedAt: Date.parse("2026-10-11T05:45:00Z"),
    now: Date.parse("2026-10-11T05:45:30Z"),
    comments: [summary(completed, "61e9ca4")],
  };
  const outcome = decision(pushed);
  assert.equal(outcome.code, 4);
  assert.equal(outcome.reviewer, "not requested");
  assert.deepEqual(report(outcome, head), [
    `${head}: checks passed, review not requested for this head`,
  ]);
  const failed = decision({
    ...pushed,
    checks: [{ name: "lint", state: "fail", link: "https://ci/2" }],
  });
  assert.equal(failed.code, 2);
  assert.deepEqual(report(failed, head), [
    `${head}: 1 check failed, review not requested for this head`,
    "lint https://ci/2",
  ]);
});

test("no Codex comment 5 minutes after the request is no response", () => {
  const requestedAt = Date.parse("2026-10-11T05:39:50Z");
  assert.equal(decision({ now: requestedAt + 4 * minute }).code, null);
  const outcome = decision({ now: requestedAt + 5 * minute });
  assert.equal(outcome.code, 4);
  assert.equal(outcome.reviewer, "no response");
  assert.deepEqual(report(outcome, head), [
    `${head}: checks passed, reviewer did not respond within 5 minutes`,
  ]);
  // A response after the latest request leaves only the review bound.
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
  assert.equal(bounded.reviewer, "not reviewing");
});

test("an account reply in the request's second is a response (#423)", () => {
  const requestedAt = Date.parse("2026-10-13T23:00:00Z");
  const at = {
    requestedAt,
    pushedAt: requestedAt,
    now: Date.parse("2026-10-13T23:05:00Z"),
    startedAt: requestedAt + minute,
  };
  const acknowledged = decision({
    ...at,
    comments: [{ login: codex, createdAt: "2026-10-13T23:00:00Z", body: "👀" }],
  });
  assert.equal(acknowledged.code, null);
  assert.equal(acknowledged.reviewer, "pending");
  assert.equal(decision(at).reviewer, "no response");
  // The account's own request comment is a request, not its response.
  const selfRequested = decision({
    ...at,
    comments: [
      {
        login: codex,
        createdAt: "2026-10-13T23:00:00Z",
        body: " @codex review\n",
      },
    ],
  });
  assert.equal(selfRequested.code, 4);
  assert.equal(selfRequested.reviewer, "no response");
  // A reply before the latest request still isn't a response.
  const earlier = decision({
    ...at,
    comments: [{ login: codex, createdAt: "2026-10-13T22:59:59Z", body: "👀" }],
  });
  assert.equal(earlier.reviewer, "no response");
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
  assert.equal(outcome.reviewer, "unavailable");
});

test("an unavailable reply before the latest request is ignored", () => {
  assert.equal(
    decision({ comments: [unavailable("2026-10-11T05:00:00Z")] }).code,
    null,
  );
});

test("the account reply at or after the latest request is unavailable (#299)", () => {
  for (const createdAt of ["2026-10-12T16:35:03Z", "2026-10-12T16:35:08Z"]) {
    const outcome = decision({
      requestedAt: Date.parse("2026-10-12T16:35:03Z"),
      comments: [accountRequired(createdAt)],
      now: Date.parse("2026-10-12T16:35:30Z"),
      startedAt: Date.parse("2026-10-12T16:35:10Z"),
    });
    assert.equal(outcome.code, 3);
    assert.equal(outcome.reviewer, "unavailable");
    assert.deepEqual(report(outcome, head), [
      `${head}: checks passed, reviewer unavailable`,
    ]);
  }
});

test("an account reply before the latest request is ignored", () => {
  const outcome = decision({
    requestedAt: Date.parse("2026-10-12T16:36:00Z"),
    comments: [accountRequired("2026-10-12T16:35:08Z")],
    now: Date.parse("2026-10-12T16:36:30Z"),
    startedAt: Date.parse("2026-10-12T16:36:10Z"),
  });
  assert.equal(outcome.code, null);
  assert.equal(outcome.reviewer, "pending");
});

test("an account reply from someone other than Codex is ignored", () => {
  const outcome = decision({
    comments: [
      { ...accountRequired("2026-10-11T05:40:00Z"), login: "someone-else" },
    ],
  });
  assert.equal(outcome.code, null);
  assert.equal(outcome.reviewer, "pending");
});

test("an account reply waits until pending checks settle", () => {
  const outcome = decision({
    checks: [{ name: "check", state: "pending", link: "https://ci/1" }],
    comments: [accountRequired("2026-10-11T05:40:00Z")],
  });
  assert.equal(outcome.code, null);
  assert.equal(outcome.reviewer, "unavailable");
  assert.equal(outcome.checksPending, true);
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
  assert.equal(outcome.reviewer, "not reviewing");
});

const failedChecks = [
  ...passed,
  { name: "lint", state: "fail", link: "https://ci/2" },
];

test("a failed check exits 2 while the reviewer is mid-review", () => {
  assert.equal(
    decision({
      checks: failedChecks,
      comments: [summary(inProgress, "f7bb671")],
    }).code,
    2,
  );
  const outcome = decision({
    checks: failedChecks,
    comments: [summary(completed, "f7bb671")],
  });
  assert.equal(outcome.code, 2);
  assert.deepEqual(report(outcome, head), [
    `${head}: 1 check failed, reviewer reviewed`,
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
    report(late, head)[0],
    `${head}: 1 check failed, reviewer did not review within 30 minutes`,
  );
});

test("a failed check with no summary row for the head is exit 2 at once", () => {
  const outcome = decision({
    checks: failedChecks,
    comments: [summary(completed, "61e9ca4")],
  });
  assert.equal(outcome.code, 2);
  assert.equal(outcome.reviewer, "pending");
  assert.deepEqual(report(outcome, head), [
    `${head}: 1 check failed, review pending`,
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

// One comment set per Codex state the wait can see, with the time it is seen.
const reviewerStates = {
  reviewed: { comments: [summary(completed, "f7bb671")] },
  unavailable: { comments: [unavailable("2026-10-11T05:40:00Z")] },
  "not requested": {
    pushedAt: Date.parse("2026-10-11T05:45:00Z"),
    now: Date.parse("2026-10-11T05:45:30Z"),
  },
  "no response": { now: Date.parse("2026-10-11T05:44:50Z") },
  "not reviewing": {
    comments: [summary(inProgress, "f7bb671")],
    startedAt: Date.parse("2026-10-11T06:05:00Z"),
    now: Date.parse("2026-10-11T06:10:00Z"),
  },

  pending: {},
};

test("each Codex state fixture reaches its state with passed checks", () => {
  for (const [state, overrides] of Object.entries(reviewerStates)) {
    assert.equal(decision(overrides).reviewer, state);
  }
});

test("no recorded push keeps empty checks pending in every Codex state", () => {
  for (const [state, overrides] of Object.entries(reviewerStates)) {
    const now = overrides.now ?? Date.parse("2026-10-11T05:43:00Z");
    for (const age of [60 * minute, 24 * 60 * minute]) {
      /** @type {Record<string, any>} */
      const look = {
        ...overrides,
        pushedAt: now - age,
        pushRecorded: false,
        checks: [],
        runs: [],
      };
      // An old fallback still follows the existing Codex request rules.
      if (state === "not requested") look.requestedAt = now - age - minute;
      const outcome = decision(look);
      assert.equal(outcome.reviewer, state);
      assert.equal(outcome.code, null);
      assert.equal(outcome.checksPending, true);
      const limited = decision({ ...look, startedAt: now - 9 * minute });
      assert.equal(limited.code, 5);
      assert.match(report(limited, head)[0], /still waiting on checks/);
    }
  }
});

test("no recorded push preserves non-empty checks and unfinished run outcomes", () => {
  for (const overrides of Object.values(reviewerStates)) {
    for (const checks of [
      passed,
      failedChecks,
      [{ name: "test", state: "pending", link: "https://ci/3" }],
    ]) {
      for (const runs of [[], [{ status: "queued" }]]) {
        const look = { ...overrides, checks, runs };
        assert.deepEqual(
          decision({ ...look, pushRecorded: false }),
          decision(look),
        );
      }
    }
    const unfinished = {
      ...overrides,
      checks: [],
      runs: [{ status: "queued" }],
    };
    assert.deepEqual(
      decision({ ...unfinished, pushRecorded: false }),
      decision(unfinished),
    );
  }
});

test("a fresh head with no checks keeps the checks pending", () => {
  for (const overrides of Object.values(reviewerStates)) {
    const now = overrides.now ?? Date.parse("2026-10-11T05:43:00Z");
    for (const runs of [[], [{ status: "completed" }]]) {
      for (const age of [0, 5 * minute - 1]) {
        const look = { ...overrides, checks: [], runs, pushedAt: now - age };
        assert.equal(decision(look).code, null);
        const limited = decision({ ...look, startedAt: now - 9 * minute });
        assert.equal(limited.code, 5);
        assert.match(report(limited, head)[0], /still waiting on checks/);
      }
    }
  }
});

test("no checks after 5 minutes settles like passed checks in every Codex state", () => {
  for (const [state, overrides] of Object.entries(reviewerStates)) {
    const pushedAt = overrides.pushedAt ?? Date.parse("2026-10-11T05:39:50Z");
    const now = Math.max(
      overrides.now ?? Date.parse("2026-10-11T05:43:00Z"),
      pushedAt + 5 * minute,
    );
    /** @type {Record<string, any>} */
    const look = { ...overrides, now, startedAt: now };
    // Keep the pending fixture inside its reviewer bounds.
    if (state === "pending") look.requestedAt = now - minute;
    const passed = decision(look);
    assert.equal(passed.reviewer, state);
    for (const runs of [[], [{ status: "completed" }]]) {
      const outcome = decision({ ...look, checks: [], runs });
      assert.equal(outcome.code, passed.code);
      assert.equal(outcome.reviewer, state);
      assert.deepEqual(outcome.failing, []);
      if (passed.code === null) {
        const limited = decision({
          ...look,
          checks: [],
          runs,
          startedAt: now - 9 * minute,
        });
        assert.equal(limited.code, 5);
        assert.deepEqual(report(limited, head), [
          `${head}: still waiting on reviewer; run again`,
        ]);
      } else {
        assert.deepEqual(
          report(outcome, head),
          report(passed, head).map((line) =>
            line.replace(
              "checks passed",
              "no checks within 5 minutes of the push",
            ),
          ),
        );
      }
    }
  }
});

const workflowRun = (name, event, status, overrides = {}) => ({
  name,
  workflow_id: { CI: 1, "PR metadata validation": 2, Other: 3 }[name],
  event,
  status,
  conclusion: status === "completed" ? "success" : null,
  run_started_at: "2026-10-11T05:40:00Z",
  html_url: `https://ci/runs/${encodeURIComponent(name)}`,
  ...overrides,
});

const failedRun = workflowRun("CI", "pull_request", "completed", {
  conclusion: "failure",
});
const failedWorkflow = { name: "CI", state: "fail", link: failedRun.html_url };

test("a failed workflow without checks fails in every Codex state", () => {
  for (const [state, overrides] of Object.entries(reviewerStates)) {
    const now = overrides.now ?? Date.parse("2026-10-11T05:43:00Z");
    for (const pushRecorded of [true, false]) {
      for (const conclusion of [
        "action_required",
        "cancelled",
        "failure",
        "stale",
        "startup_failure",
        "timed_out",
      ]) {
        /** @type {Record<string, any>} */
        const look = {
          ...overrides,
          checks: [],
          runs: [{ ...failedRun, conclusion }],
          pushedAt: Math.min(
            now - 5 * minute,
            Date.parse("2026-10-11T05:39:50Z"),
          ),
          pushRecorded,
        };
        if (state === "not requested")
          look.requestedAt = look.pushedAt - minute;
        const outcome = decision(look);
        assert.equal(outcome.reviewer, state);
        assert.equal(outcome.code, 2);
        assert.deepEqual(outcome.failing, [failedWorkflow]);
        assert.equal(outcome.noChecks, undefined);
      }
    }
  }
});

test("a failed workflow makes a fresh head's checks non-empty", () => {
  assert.equal(decision({ checks: [], runs: [failedRun] }).code, 2);
});

test("only the latest-started workflow run can fail, in either order", () => {
  for (const [earlierConclusion, laterConclusion] of [
    ["failure", "success"],
    ["success", "failure"],
  ]) {
    const earlier = { ...failedRun, conclusion: earlierConclusion };
    const later = {
      ...failedRun,
      conclusion: laterConclusion,
      // A rerun's latest attempt can start after a newer run was created.
      created_at: "2026-10-11T05:00:00Z",
      run_attempt: 2,
      run_started_at: "2026-10-11T05:41:00Z",
      html_url: "https://ci/runs/later",
    };
    for (const runs of [
      [earlier, later],
      [later, earlier],
    ]) {
      const outcome = decision({
        runs,
        comments: reviewerStates.reviewed.comments,
      });
      assert.equal(outcome.code, laterConclusion === "failure" ? 2 : 0);
      assert.deepEqual(
        outcome.failing,
        laterConclusion === "failure"
          ? [{ ...failedWorkflow, link: later.html_url }]
          : [],
      );
    }
  }
});

test("workflows sharing a display name do not supersede each other", () => {
  const successful = {
    ...failedRun,
    workflow_id: 4,
    conclusion: "success",
    run_started_at: "2026-10-11T05:41:00Z",
  };
  for (const runs of [
    [failedRun, successful],
    [successful, failedRun],
  ]) {
    const outcome = decision({ checks: [], runs });
    assert.equal(outcome.code, 2);
    assert.deepEqual(outcome.failing, [failedWorkflow]);
  }
});

const runUrl = (id) => `https://github.com/owner/repo/actions/runs/${id}`;

test("an older passing check does not hide a later run's startup failure", () => {
  const older = { ...failedRun, conclusion: "success", html_url: runUrl(21) };
  const latest = {
    ...failedRun,
    conclusion: "startup_failure",
    run_started_at: "2026-10-11T05:41:00Z",
    html_url: runUrl(23),
  };
  const outcome = decision({
    checks: [
      {
        name: "test",
        workflowName: "CI",
        state: "pass",
        link: `${runUrl(21)}/job/1`,
        checkRunStartedAt: "2026-10-11T05:40:01Z",
      },
    ],
    runs: [older, latest],
    comments: reviewerStates.unavailable.comments,
  });
  assert.equal(outcome.code, 2);
  assert.deepEqual(outcome.failing, [
    { name: "CI", state: "fail", link: runUrl(23) },
  ]);
});

test("a prior attempt's passing check does not hide a failed rerun", () => {
  const latest = {
    ...failedRun,
    conclusion: "startup_failure",
    run_attempt: 2,
    run_started_at: "2026-10-11T05:41:00Z",
    html_url: runUrl(21),
  };
  const outcome = decision({
    checks: [
      {
        name: "test",
        workflowName: "CI",
        state: "pass",
        link: `${runUrl(21)}/job/1`,
        checkRunStartedAt: "2026-10-11T05:40:01Z",
      },
    ],
    runs: [latest],
  });
  assert.equal(outcome.code, 2);
  assert.deepEqual(outcome.failing, [
    { name: "CI", state: "fail", link: runUrl(21) },
  ]);
});

test("a failed check from the latest run or attempt is listed once", () => {
  const older = { ...failedRun, conclusion: "success", html_url: runUrl(21) };
  for (const id of [21, 23]) {
    const latest = {
      ...failedRun,
      run_started_at: "2026-10-11T05:41:00Z",
      html_url: runUrl(id),
    };
    for (const checkRunStartedAt of [
      "2026-10-11T05:41:00Z",
      "2026-10-11T05:41:01Z",
    ]) {
      const checks = [
        {
          name: "test",
          workflowName: "CI",
          state: "fail",
          link: `${runUrl(id)}/job/2`,
          checkRunStartedAt,
        },
      ];
      const outcome = decision({
        checks,
        runs: id === 21 ? [latest] : [older, latest],
      });
      assert.equal(outcome.code, 2);
      assert.deepEqual(outcome.failing, checks);
    }
  }
});

test("a latest successful run clears an older failure alongside leftover checks", () => {
  const older = { ...failedRun, html_url: runUrl(21) };
  const latest = {
    ...failedRun,
    conclusion: "success",
    run_started_at: "2026-10-11T05:41:00Z",
    html_url: runUrl(23),
  };
  const outcome = decision({
    checks: [
      {
        name: "test",
        workflowName: "CI",
        state: "pass",
        link: `${runUrl(21)}/job/1`,
        checkRunStartedAt: "2026-10-11T05:40:01Z",
      },
    ],
    runs: [older, latest],
    comments: reviewerStates.reviewed.comments,
  });
  assert.equal(outcome.code, 0);
  assert.deepEqual(outcome.failing, []);
});

test("a check with no start time does not settle a failed run", () => {
  for (const link of [`${runUrl(21)}/job/1`, "https://ci/job"]) {
    const outcome = decision({
      checks: [{ name: "test", workflowName: "CI", state: "pass", link }],
      runs: [{ ...failedRun, html_url: runUrl(21) }],
    });
    assert.equal(outcome.code, 2);
    assert.deepEqual(outcome.failing, [
      { name: "CI", state: "fail", link: runUrl(21) },
    ]);
  }
});

test("checks represent only their own workflow when display names are shared", () => {
  const failed = { ...failedRun, html_url: runUrl(21) };
  const successful = {
    ...failedRun,
    workflow_id: 4,
    conclusion: "success",
    html_url: runUrl(22),
  };
  for (const runs of [
    [failed, successful],
    [successful, failed],
  ]) {
    for (const state of ["pass", "fail", "pending"]) {
      for (const id of [21, 22]) {
        const checks = [
          {
            name: "test",
            workflowName: "CI",
            state,
            link: `${runUrl(id)}/job/1`,
            checkRunStartedAt: "2026-10-11T05:40:00Z",
          },
        ];
        const outcome = decision({ checks, runs });
        assert.deepEqual(outcome.failing, [
          ...checks.filter((check) => check.state === "fail"),
          ...(id === 22 ? [{ ...failedWorkflow, link: failed.html_url }] : []),
        ]);
        assert.equal(outcome.code, id === 22 || state === "fail" ? 2 : null);
      }
    }
  }
});

test("a check from an older run still represents its workflow ID", () => {
  const older = { ...failedRun, conclusion: "success", html_url: runUrl(21) };
  const latest = {
    ...failedRun,
    html_url: runUrl(23),
    run_started_at: "2026-10-11T05:41:00Z",
  };
  const unrelated = {
    ...failedRun,
    workflow_id: 4,
    conclusion: "success",
    html_url: runUrl(22),
  };
  const checks = [
    {
      name: "test",
      workflowName: "CI",
      state: "fail",
      link: `${runUrl(21)}/attempts/1`,
      checkRunStartedAt: "2026-10-11T05:41:00Z",
    },
  ];
  const outcome = decision({ checks, runs: [older, latest, unrelated] });
  assert.equal(outcome.code, 2);
  assert.deepEqual(outcome.failing, checks);
});

test("an ambiguous workflow name alone does not hide a failed run", () => {
  const successful = { ...failedRun, workflow_id: 4, conclusion: "success" };
  const outcome = decision({
    checks: [{ ...passed[0], workflowName: "CI" }],
    runs: [failedRun, successful],
  });
  assert.equal(outcome.code, 2);
  assert.deepEqual(outcome.failing, [failedWorkflow]);
});

test("a workflow with a check uses only that check's outcome", () => {
  for (const state of ["pass", "fail", "pending"]) {
    const checks = [
      {
        name: "test",
        workflowName: "CI",
        state,
        link: "https://ci/job",
        checkRunStartedAt: "2026-10-11T05:40:00Z",
      },
    ];
    const look = { checks, comments: reviewerStates.reviewed.comments };
    assert.deepEqual(decision({ ...look, runs: [failedRun] }), decision(look));
  }
});

test("another workflow's checks or a status context do not hide a failed run", () => {
  for (const workflowName of ["Other CI", undefined]) {
    const outcome = decision({
      checks: [
        { name: "CI", workflowName, state: "pass", link: "https://ci/job" },
      ],
      runs: [failedRun],
    });
    assert.equal(outcome.code, 2);
    assert.deepEqual(outcome.failing, [failedWorkflow]);
  }
});

test("non-failing workflow conclusions preserve the no-check outcomes", () => {
  for (const conclusion of ["success", "neutral", "skipped"]) {
    for (const overrides of Object.values(reviewerStates)) {
      for (const pushRecorded of [true, false]) {
        const look = { ...overrides, checks: [], pushRecorded };
        assert.deepEqual(
          decision({ ...look, runs: [{ ...failedRun, conclusion }] }),
          decision(look),
        );
      }
    }
  }
});

test("a failed workflow exits despite any unfinished run", () => {
  const earlier = { ...failedRun, status: "in_progress", conclusion: null };
  const later = { ...failedRun, run_started_at: "2026-10-11T05:41:00Z" };
  for (const runs of [
    [earlier, later],
    [later, earlier],
  ]) {
    const outcome = decision({ checks: [], runs });
    assert.equal(outcome.code, 2);
    assert.deepEqual(outcome.failing, [failedWorkflow]);
  }
});
const unfinishedStatuses = [
  "queued",
  "requested",
  "waiting",
  "pending",
  "in_progress",
];

test("an unfinished run keeps an empty rollup pending however old the push", () => {
  for (const status of unfinishedStatuses) {
    const now = Date.parse("2026-10-11T10:00:00Z");
    for (const age of [5 * minute, 4 * 60 * minute]) {
      const look = {
        checks: [],
        runs: [{ status }],
        now,
        pushedAt: now - age,
        startedAt: now,
        comments: [summary(completed, "f7bb671")],
      };
      assert.equal(decision(look).code, null);
      const limited = decision({ ...look, startedAt: now - 9 * minute });
      assert.equal(limited.code, 5);
      assert.deepEqual(report(limited, head), [
        `${head}: still waiting on checks; run again`,
      ]);
    }
  }
});

test("an unfinished workflow run for the head keeps passed checks pending", () => {
  for (const status of unfinishedStatuses) {
    for (const unfinished of [
      workflowRun("CI", "pull_request", status),
      workflowRun("PR metadata validation", "pull_request_target", status),
    ]) {
      const runs = [
        workflowRun("Other", "pull_request", "completed"),
        unfinished,
      ];
      for (const overrides of Object.values(reviewerStates)) {
        assert.equal(decision({ ...overrides, runs }).code, null);
      }
      const limited = decision({
        ...reviewerStates.reviewed,
        runs,
        now: Date.parse("2026-10-11T05:49:00Z"),
      });
      assert.equal(limited.code, 5);
      assert.deepEqual(report(limited, head), [
        `${head}: still waiting on checks; run again`,
      ]);
    }
  }
});

test("completed workflow runs for the head leave the outcome unchanged", () => {
  const runs = [
    workflowRun("CI", "pull_request", "completed"),
    workflowRun("PR metadata validation", "pull_request_target", "completed"),
  ];
  for (const overrides of Object.values(reviewerStates)) {
    assert.deepEqual(decision({ ...overrides, runs }), decision(overrides));
  }
});

test("an unfinished workflow run does not defer a failed check", () => {
  const settled = {
    checks: failedChecks,
    comments: [summary(completed, "61e9ca4")],
  };
  assert.equal(
    decision({
      ...settled,
      runs: [workflowRun("CI", "pull_request", "completed")],
    }).code,
    2,
  );
  assert.equal(
    decision({
      ...settled,
      runs: [
        workflowRun("PR metadata validation", "pull_request_target", "queued"),
      ],
    }).code,
    2,
  );
});

test("the invocation limit is exit 5 and names what is still pending", () => {
  const outcome = decision({
    comments: [summary(inProgress, "f7bb671")],
    now: Date.parse("2026-10-11T05:49:00Z"),
  });
  assert.equal(outcome.code, 5);
  assert.deepEqual(report(outcome, head), [
    `${head}: still waiting on reviewer; run again`,
  ]);
});

test("failed checks exit 2 even at the invocation limit", () => {
  const outcome = decision({
    checks: [{ name: "lint", state: "fail", link: "https://ci/2" }],
    comments: [summary(inProgress, "f7bb671")],
    now: Date.parse("2026-10-11T05:49:00Z"),
  });
  assert.equal(outcome.code, 2);
  assert.deepEqual(report(outcome, head), [
    `${head}: 1 check failed, review pending`,
    "lint https://ci/2",
  ]);
});

test("each settled outcome reports one line", () => {
  assert.deepEqual(
    report(decision({ comments: [summary(completed, "f7bb671")] }), head),
    [`${head}: checks passed, reviewer reviewed`],
  );
  assert.deepEqual(
    report(decision({ comments: [unavailable("2026-10-11T05:40:00Z")] }), head),
    [`${head}: checks passed, reviewer unavailable`],
  );
  assert.deepEqual(
    report(
      decision({
        comments: [summary(inProgress, "f7bb671")],
        now: Date.parse("2026-10-11T06:10:00Z"),
      }),
      head,
    ),
    [`${head}: checks passed, reviewer did not review within 30 minutes`],
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
    reviewRequestedAt(opened, comments, codexReviewer),
    Date.parse("2026-10-11T04:30:00Z"),
  );
  assert.equal(
    reviewRequestedAt(opened, [summary(completed, "322f254")], codexReviewer),
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
    reviewRequestedAt(opened, comments, codexReviewer),
    Date.parse("2026-10-11T04:30:00Z"),
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
      {
        name: "test",
        state: "pending",
        link: "https://ci/new",
        workflowName: "ci",
        checkRunStartedAt: "2026-10-11T05:10:00Z",
      },
      {
        name: "docs",
        state: "pass",
        link: "https://ci/docs",
        workflowName: "ci",
        checkRunStartedAt: "2026-10-11T05:00:00Z",
      },
      { name: "deploy", state: "fail", link: "https://deploy" },
    ],
  );
});

const checkRun = (overrides) => ({
  __typename: "CheckRun",
  name: "Validate example",
  workflowName: "CI",
  startedAt: "2026-10-11T23:00:00Z",
  status: "COMPLETED",
  conclusion: "SUCCESS",
  detailsUrl: "fixture:previous",
  ...overrides,
});

test("queued reruns keep prior successes and failures pending in either order", () => {
  for (const startedAt of [null, undefined, "", "0001-01-01T00:00:00Z"]) {
    const queued = checkRun({
      startedAt,
      status: "QUEUED",
      conclusion: null,
      detailsUrl: "fixture:queued",
    });
    for (const conclusion of ["SUCCESS", "FAILURE"]) {
      const previous = checkRun({ conclusion });
      for (const rollup of [
        [previous, queued],
        [queued, previous],
      ]) {
        assert.deepEqual(checkStates(rollup), [
          {
            name: "Validate example",
            state: "pending",
            link: "fixture:queued",
            workflowName: "CI",
            checkRunStartedAt: startedAt,
          },
        ]);
      }
    }
  }
});

test("an older unfinished run keeps a newer completed run pending", () => {
  const unfinished = checkRun({
    status: "IN_PROGRESS",
    conclusion: null,
    detailsUrl: "fixture:unfinished",
  });
  const completed = checkRun({ startedAt: "2026-10-11T23:10:00Z" });
  for (const rollup of [
    [unfinished, completed],
    [completed, unfinished],
  ]) {
    assert.deepEqual(checkStates(rollup), [
      {
        name: "Validate example",
        state: "pending",
        link: "fixture:unfinished",
        workflowName: "CI",
        checkRunStartedAt: "2026-10-11T23:00:00Z",
      },
    ]);
  }
});

test("completed runs use the later start's state and link in either order", () => {
  for (const [earlierConclusion, laterConclusion, state] of [
    ["FAILURE", "SUCCESS", "pass"],
    ["SUCCESS", "FAILURE", "fail"],
  ]) {
    const later = checkRun({
      startedAt: "2026-10-11T23:10:00Z",
      conclusion: laterConclusion,
      detailsUrl: "fixture:later",
    });
    for (const startedAt of [
      "2026-10-11T23:00:00Z",
      null,
      undefined,
      "",
      "0001-01-01T00:00:00Z",
    ]) {
      const earlier = checkRun({ startedAt, conclusion: earlierConclusion });
      for (const rollup of [
        [earlier, later],
        [later, earlier],
      ]) {
        assert.deepEqual(checkStates(rollup), [
          {
            name: "Validate example",
            state,
            link: "fixture:later",
            workflowName: "CI",
            checkRunStartedAt: "2026-10-11T23:10:00Z",
          },
        ]);
      }
    }
  }
});

test("pending and expected commit statuses hold their context pending", () => {
  const completed = {
    __typename: "StatusContext",
    context: "deploy",
    state: "SUCCESS",
    startedAt: "2026-10-11T23:00:00Z",
    targetUrl: "fixture:previous",
  };
  for (const state of ["PENDING", "EXPECTED"]) {
    const unfinished = {
      ...completed,
      state,
      startedAt: null,
      targetUrl: "fixture:unfinished",
    };
    for (const rollup of [
      [completed, unfinished],
      [unfinished, completed],
    ]) {
      assert.deepEqual(checkStates(rollup), [
        { name: "deploy", state: "pending", link: "fixture:unfinished" },
      ]);
    }
  }
});

test("unfinished runs hold only their own workflow and check", () => {
  assert.deepEqual(
    checkStates([
      checkRun({ status: "QUEUED", startedAt: null }),
      checkRun({ workflowName: "Other CI", conclusion: "FAILURE" }),
      checkRun({ name: "Other check" }),
    ]),
    [
      {
        name: "Validate example",
        state: "pending",
        link: "fixture:previous",
        workflowName: "CI",
        checkRunStartedAt: null,
      },
      {
        name: "Validate example",
        state: "fail",
        link: "fixture:previous",
        workflowName: "Other CI",
        checkRunStartedAt: "2026-10-11T23:00:00Z",
      },
      {
        name: "Other check",
        state: "pass",
        link: "fixture:previous",
        workflowName: "CI",
        checkRunStartedAt: "2026-10-11T23:00:00Z",
      },
    ],
  );
});

// Runs the script against a fake `gh` and returns everything it wrote, with
// the time of its first write.
/** @param {string | URL} [target] */
const run = (
  state,
  args,
  reviewer = codexReviewer,
  target = new URL("../.agents/skills/babysit/wait.mjs", import.meta.url),
  policy = null,
) => {
  const targetURL = typeof target === "string" ? pathToFileURL(target) : target;
  const bundleURL = new URL("../../../vendor/postern/postern.mjs", targetURL);
  const directory = mkdtempSync(join(tmpdir(), "babysit-wait-"));
  mkdirSync(join(directory, ".github"));
  if (policy !== null) {
    writeFileSync(
      join(directory, ".github/factory-review-policy.json"),
      typeof policy === "string" ? policy : JSON.stringify(policy),
    );
  }
  if (reviewer) {
    writeFileSync(
      join(directory, ".github/pull-request-reviewer.json"),
      JSON.stringify(reviewer),
    );
  }
  const statePath = join(directory, "state.json");
  writeFileSync(
    statePath,
    JSON.stringify({
      reviewConfiguration: { policy, reviewer },
      ...state,
    }),
  );
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { main } from ${JSON.stringify(targetURL.href)}; import { connect } from ${JSON.stringify(bundleURL.href)}; import { fixtureConnection } from ${JSON.stringify(fakePlatform)}; process.exitCode = await main(process.argv.slice(1), fixtureConnection(connect));`,
        "--",
        ...args,
      ],
      {
        cwd: directory,
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          FAKE_GH_STATE: statePath,
        },
      },
    );
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
      const finalState = JSON.parse(readFileSync(statePath, "utf8"));
      if (!Object.hasOwn(state, "reviewConfiguration"))
        delete finalState.reviewConfiguration;
      rmSync(directory, { recursive: true, force: true });
      resolve({
        code,
        activityReads: finalState.activityReads,
        finalState,
        stdout,
        stderr,
        firstWrite,
        elapsed: Date.now() - started,
      });
    });
  });
};

test("the installed wait applies the declaration without delaying for external review", async (t) => {
  const target = installedValidator(t, ".agents/skills/babysit/wait.mjs");
  const result = await run(
    {
      head,
      author: "factory-app[bot]",
      createdAt: "2026-10-11T05:00:00Z",
      pushedAt: "2026-10-11T05:00:00Z",
    },
    ["12", "--limit", "0.1"],
    codexReviewer,
    target,
    { version: 1, author: "app/FACTORY-APP" },
  );
  assert.equal(result.code, 6, result.stderr);
  assert.match(result.stdout, /external review skipped by app-author policy/);
});

test("policy-skip wait prints a copyable full-head outcome template with or without a reviewer", async (t) => {
  const target = installedValidator(t, ".agents/skills/babysit/wait.mjs");
  for (const reviewer of [codexReviewer, null]) {
    const result = await run(
      {
        head,
        author: "factory-app[bot]",
        createdAt: "2026-10-11T05:00:00Z",
        pushedAt: "2026-10-11T05:00:00Z",
      },
      ["12", "--limit", "0.1"],
      reviewer,
      target,
      { version: 1, author: "app/factory-app" },
    );
    assert.equal(result.code, 6, result.stderr);
    assert.ok(result.stdout.includes(`Head: ${head}\n`));
    assert.ok(
      result.stdout.includes("Standards: <actual Standards review outcome>\n"),
    );
    assert.ok(result.stdout.includes("Spec: <actual Spec review outcome>\n"));
    assert.ok(
      result.stdout.includes(
        "No external reviewer runs on app-authored PRs.\n",
      ),
    );
  }
});

test("invalid policy declarations fail the wait rather than exempting the author", async () => {
  for (const policy of [
    "{",
    { version: 2, author: "factory-app[bot]" },
    { version: 1, author: " factory-app[bot]" },
    { version: 1, author: "" },
    { version: 1, author: "factory-app[bot]", extra: true },
  ]) {
    const result = await run(
      { head, author: "factory-app[bot]" },
      ["12"],
      codexReviewer,
      undefined,
      policy,
    );
    assert.equal(result.code, 7);
    assert.match(result.stderr, /\.github\/factory-review-policy\.json:/);
  }
});

test("installed waits reject human declarations for every author with or without a reviewer", async (t) => {
  const target = installedValidator(t, ".agents/skills/babysit/wait.mjs");
  for (const declared of ["lutzseverino", "LutzSeverino"]) {
    for (const author of [declared, "lutzseverino", "other", null]) {
      for (const reviewer of [codexReviewer, null]) {
        const state = { head, author };
        const result = await run(state, ["12"], reviewer, target, {
          version: 1,
          author: declared,
        });
        assert.equal(result.code, 7, result.stderr);
        assert.match(
          result.stderr,
          /\.github\/factory-review-policy\.json: author must be an app identity/,
        );
        assert.equal(result.stdout, "");
        assert.deepEqual(result.finalState, state);
      }
    }
  }
});

const openedNow = new Date().toISOString();
const pendingPullRequest = {
  head,
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

test("the wait names the reached request bound after a later push", async () => {
  const reviewer = {
    ...githubReviewer,
    request: { ...githubReviewer.request, onOpen: true },
    bounds: { ...githubReviewer.bounds, reviewRequests: 4 },
  };
  const result = await run(
    {
      ...pendingPullRequest,
      createdAt: "2026-10-11T05:00:00Z",
      pushedAt: "2026-10-11T05:10:00Z",
      checks: [checkRun()],
      comments: ["owner", "another-user", "automation[bot]"].map((login) => ({
        login,
        createdAt: "2026-10-11T05:05:00Z",
        body: ` \n${reviewer.request.comment}\n `,
      })),
    },
    ["12"],
    reviewer,
  );
  assert.equal(result.code, 4);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    `${head}: checks passed, review not requested for this head; review request bound reached (4); review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
  );
});

test("only exact request comments and enabled opening requests reach the bound", () => {
  const comments = [
    { login: "owner", createdAt: "2026-10-11T05:40:00Z", body: "review" },
    { login: "other", createdAt: "2026-10-11T05:41:00Z", body: " \nreview\n " },
    { login: "bot", createdAt: "2026-10-11T05:42:00Z", body: "Fixed. review" },
  ];
  for (const onOpen of [false, true]) {
    const reviewer = {
      ...githubReviewer,
      request: { comment: "review", onOpen },
      bounds: { ...githubReviewer.bounds, reviewRequests: 3 },
    };
    const look = {
      reviewer,
      comments,
      requestedAt: reviewRequestedAt(
        Date.parse("2026-10-11T05:39:00Z"),
        comments,
        reviewer,
      ),
      pushedAt: Date.parse("2026-10-11T05:42:00Z"),
    };
    assert.equal(decision(look).code, 4);
    assert.equal(
      decision(look).reviewer,
      onOpen ? "request bound reached" : "not requested",
    );
    assert.equal(
      decision({ ...look, reviewer: githubReviewer }).reviewer,
      "not requested",
    );
  }
});

test("a reached bound still waits for checks and honors reviews and later requests", () => {
  const reviewer = {
    ...githubReviewer,
    request: { ...githubReviewer.request, onOpen: true },
    bounds: { ...githubReviewer.bounds, reviewRequests: 1 },
  };
  const look = {
    reviewer,
    pushedAt: Date.parse("2026-10-11T05:40:00Z"),
  };
  assert.equal(
    decision({ ...look, checks: [{ ...passed[0], state: "pending" }] }).code,
    null,
  );
  assert.equal(
    decision({
      ...look,
      reviews: [
        {
          user: { login: reviewer.account },
          commit_id: head,
          state: "APPROVED",
        },
      ],
    }).code,
    0,
  );
  const comments = [
    {
      login: "owner",
      createdAt: "2026-10-11T05:41:00Z",
      body: reviewer.request.comment,
    },
  ];
  const requestedAt = reviewRequestedAt(look.pushedAt, comments, reviewer);
  assert.equal(
    decision({ ...look, comments, requestedAt, now: requestedAt + 30_000 })
      .reviewer,
    "pending",
  );
});

test("the wait rejects invalid review request bounds", async () => {
  for (const reviewRequests of [0, -1, 1.5, "4", null, true, [], {}]) {
    const reviewer = {
      ...githubReviewer,
      bounds: { ...githubReviewer.bounds, reviewRequests },
    };
    const result = await run(pendingPullRequest, ["12"], reviewer);
    assert.equal(result.code, 7);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /reviewRequests must be a positive integer/);
  }
});

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
    `${head}: still waiting on checks and reviewer; run again; review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
  );
  assert.ok(result.firstWrite >= 1900, `wrote after ${result.firstWrite} ms`);
});

test("a reviewed head with a queued rerun waits silently until its limit", async () => {
  const result = await run(
    {
      ...pendingPullRequest,
      checks: [
        checkRun(),
        checkRun({
          status: "QUEUED",
          conclusion: null,
          startedAt: null,
          detailsUrl: "fixture:queued",
        }),
      ],
      comments: [summary(completedCell(new Date().toISOString()), "f7bb671")],
    },
    ["12", "--limit", "2", "--interval", "0.2"],
  );
  assert.equal(result.code, 5);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    `${head}: still waiting on checks; run again; review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
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
    `${head}: 1 check failed, reviewer reviewed; review configuration: example/repository default branch main@${"b".repeat(40)}\ntest https://ci/1\n`,
  );
  assert.ok(result.elapsed < 5000);
});

test("a fresh push with no checks yet waits silently until its limit", async () => {
  // Opened long ago, pushed just now with no re-request: Codex is settled,
  // but GitHub has not attached the head's checks or runs.
  const result = await run(
    { ...pendingPullRequest, checks: [], createdAt: "2026-10-11T05:00:00Z" },
    ["12", "--limit", "2", "--interval", "0.2"],
  );
  assert.equal(result.code, 5);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    `${head}: still waiting on checks; run again; review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
  );
  assert.ok(result.firstWrite >= 1900, `wrote after ${result.firstWrite} ms`);
});

test("an old push with no checks or runs settles at once", async () => {
  const result = await run(
    {
      ...pendingPullRequest,
      checks: [],
      runs: [],
      createdAt: new Date(Date.now() - 10 * minute).toISOString(),
      pushedAt: new Date(Date.now() - 6 * minute).toISOString(),
    },
    ["12", "--limit", "2", "--interval", "0.2"],
  );
  assert.equal(result.code, 4);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    `${head}: no checks within 5 minutes of the push, review not requested for this head; review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
  );
  assert.ok(result.firstWrite < 1900, `wrote after ${result.firstWrite} ms`);
});

test("the script reports a completed failed workflow with no check (#293)", async () => {
  const result = await run(
    {
      ...pendingPullRequest,
      checks: [],
      runs: [failedRun],
      createdAt: "2026-10-11T05:00:00Z",
      pushedAt: "2026-10-11T05:20:00Z",
      comments: [unavailable("2026-10-11T05:40:00Z")],
    },
    ["12", "--limit", "0.4", "--interval", "0.1"],
  );
  assert.equal(result.code, 2);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    `${head}: 1 check failed, reviewer unavailable; review configuration: example/repository default branch main@${"b".repeat(40)}\nCI ${failedRun.html_url}\n`,
  );
});

test("the script uses check start times to settle later runs and attempts (#296)", async () => {
  const older = { ...failedRun, conclusion: "success", html_url: runUrl(21) };
  for (const id of [21, 23]) {
    for (const currentCheck of [false, true]) {
      const latest = {
        ...failedRun,
        conclusion: currentCheck ? "failure" : "startup_failure",
        run_started_at: "2026-10-11T05:41:00Z",
        html_url: runUrl(id),
      };
      const checkLink = `${runUrl(currentCheck ? id : 21)}/job/1`;
      const result = await run(
        {
          ...pendingPullRequest,
          checks: [
            checkRun({
              startedAt: currentCheck
                ? "2026-10-11T05:41:01Z"
                : "2026-10-11T05:40:01Z",
              conclusion: currentCheck ? "FAILURE" : "SUCCESS",
              detailsUrl: checkLink,
            }),
          ],
          runs: id === 21 ? [latest] : [older, latest],
          createdAt: "2026-10-11T05:00:00Z",
          pushedAt: "2026-10-11T05:20:00Z",
          comments: [unavailable("2026-10-11T05:40:00Z")],
        },
        ["12", "--limit", "0.4", "--interval", "0.1"],
      );
      assert.equal(result.code, 2);
      assert.equal(result.stderr, "");
      assert.equal(
        result.stdout,
        `${head}: 1 check failed, reviewer unavailable; review configuration: example/repository default branch main@${"b".repeat(40)}\n${currentCheck ? `Validate example ${checkLink}` : `CI ${runUrl(id)}`}\n`,
      );
    }
  }
});

test("the script keeps failures of workflows sharing a display name", async () => {
  const result = await run(
    {
      ...pendingPullRequest,
      checks: [],
      runs: [
        failedRun,
        {
          ...failedRun,
          workflow_id: 4,
          conclusion: "success",
          run_started_at: "2026-10-11T05:41:00Z",
        },
      ],
      createdAt: "2026-10-11T05:00:00Z",
      pushedAt: "2026-10-11T05:20:00Z",
      comments: [unavailable("2026-10-11T05:40:00Z")],
    },
    ["12", "--limit", "0.4", "--interval", "0.1"],
  );
  assert.equal(result.code, 2);
  assert.equal(
    result.stdout,
    `${head}: 1 check failed, reviewer unavailable; review configuration: example/repository default branch main@${"b".repeat(40)}\nCI ${failedRun.html_url}\n`,
  );
});

test("the script matches checks to same-named workflows by their run links", async () => {
  for (const id of [21, 22]) {
    const result = await run(
      {
        ...pendingPullRequest,
        checks: [
          checkRun({
            detailsUrl: `${runUrl(id)}/job/1`,
            conclusion: id === 21 ? "FAILURE" : "SUCCESS",
          }),
        ],
        runs: [
          { ...failedRun, html_url: runUrl(21) },
          {
            ...failedRun,
            workflow_id: 4,
            conclusion: "success",
            html_url: runUrl(22),
          },
        ],
        createdAt: "2026-10-11T05:00:00Z",
        pushedAt: "2026-10-11T05:20:00Z",
        comments: [unavailable("2026-10-11T05:40:00Z")],
      },
      ["12", "--limit", "0.4", "--interval", "0.1"],
    );
    assert.equal(result.code, 2);
    assert.equal(result.stderr, "");
    assert.equal(
      result.stdout,
      `${head}: 1 check failed, reviewer unavailable; review configuration: example/repository default branch main@${"b".repeat(40)}\n${id === 21 ? `Validate example ${runUrl(21)}/job/1` : `CI ${runUrl(21)}`}\n`,
    );
  }
});

test("the script uses a workflow's checks without hiding another workflow's failure", async () => {
  for (const [checks, expected] of [
    [[checkRun({ workflowName: "Other CI" })], `CI ${failedRun.html_url}`],
    [
      [checkRun({ conclusion: "FAILURE" })],
      "Validate example fixture:previous",
    ],
  ]) {
    const result = await run(
      {
        ...pendingPullRequest,
        checks,
        runs: [failedRun],
        createdAt: "2026-10-11T05:00:00Z",
        pushedAt: "2026-10-11T05:20:00Z",
        comments: [unavailable("2026-10-11T05:40:00Z")],
      },
      ["12", "--limit", "0.4", "--interval", "0.1"],
    );
    assert.equal(result.code, 2);
    assert.equal(result.stderr, "");
    assert.equal(
      result.stdout,
      `${head}: 1 check failed, reviewer unavailable; review configuration: example/repository default branch main@${"b".repeat(40)}\n${expected}\n`,
    );
  }
});

test("an unrecorded push with old dates waits silently until its limit", async () => {
  for (const failActivity of [false, true]) {
    const result = await run(
      {
        ...pendingPullRequest,
        checks: [],
        runs: [],
        createdAt: "2026-10-11T05:00:00Z",
        committedAt: "2026-10-11T05:10:00Z",
        pushedAt: failActivity ? "2026-10-11T05:20:00Z" : null,
        failActivity,
      },
      ["12", "--limit", "2", "--interval", "0.2"],
    );
    assert.equal(result.code, 5);
    assert.equal(result.stderr, "");
    assert.equal(
      result.stdout,
      `${head}: still waiting on checks; run again; review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
    );
    assert.ok(result.firstWrite >= 1900, `wrote after ${result.firstWrite} ms`);
  }
});

test("a push recorded after the first look settles within the invocation", async () => {
  for (const failActivityReads of [0, 1]) {
    const result = await run(
      {
        ...pendingPullRequest,
        checks: [],
        runs: [],
        createdAt: "2026-10-11T05:00:00Z",
        committedAt: "2026-10-11T05:10:00Z",
        pushedAt: "2026-10-11T05:20:00Z",
        activityReads: 0,
        recordAfter: 1,
        failActivityReads,
      },
      ["12", "--limit", "3", "--interval", "0.2"],
    );
    assert.equal(result.code, 4, result.stderr);
    assert.equal(result.stderr, "");
    assert.equal(
      result.stdout,
      `${head}: no checks within 5 minutes of the push, review not requested for this head; review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
    );
    assert.equal(result.activityReads, 2);
    assert.ok(result.elapsed < 2900, `settled after ${result.elapsed} ms`);
  }
});

const metadataCheck = checkRun({
  name: "PR metadata",
  workflowName: "PR metadata validation",
});
const metadataRun = (status) =>
  workflowRun("PR metadata validation", "pull_request_target", status);
const testRun = (status) => workflowRun("CI", "pull_request", status);

test("a queued rerun missing from the rollup waits silently until its limit", async () => {
  // The rollup drops a check while its rerun is queued; its run still lists it.
  for (const [checks, runs] of [
    [[metadataCheck], [metadataRun("completed"), testRun("queued")]],
    [[checkRun()], [metadataRun("queued"), testRun("completed")]],
  ]) {
    const result = await run(
      {
        ...pendingPullRequest,
        checks,
        runs,
        comments: [summary(completedCell(new Date().toISOString()), "f7bb671")],
      },
      ["12", "--limit", "2", "--interval", "0.2"],
    );
    assert.equal(result.code, 5);
    assert.equal(result.stderr, "");
    assert.equal(
      result.stdout,
      `${head}: still waiting on checks; run again; review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
    );
    assert.ok(result.firstWrite >= 1900, `wrote after ${result.firstWrite} ms`);
  }
});

test("the head's push time comes from GitHub's activity record", async () => {
  const finished = {
    checks: [metadataCheck, checkRun()],
    runs: [metadataRun("completed"), testRun("completed")],
  };
  // Opened long ago, pushed just now with no re-request: not requested.
  const pushed = await run(
    {
      ...pendingPullRequest,
      ...finished,
      createdAt: "2026-10-11T05:00:00Z",
    },
    ["12"],
  );
  assert.equal(pushed.code, 4);
  assert.equal(
    pushed.stdout,
    `${head}: checks passed, review not requested for this head; review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
  );
  // A later re-request makes the pushed head requested again.
  const rerequested = await run(
    {
      ...pendingPullRequest,
      ...finished,
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
    `${head}: still waiting on reviewer; run again; review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
  );
  // Without an activity record, the head's committer date stands in, and a
  // push is never before the opening.
  const committed = await run(
    {
      ...pendingPullRequest,
      ...finished,
      createdAt: "2026-10-11T05:00:00Z",
      pushedAt: null,
      committedAt: "2026-10-11T04:59:00Z",
    },
    ["12"],
  );
  assert.equal(committed.code, 4);
  assert.equal(
    committed.stdout,
    `${head}: checks passed, reviewer did not respond within 5 minutes; review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
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
  assert.match(failure.stderr, /502/);
});

test("without a reviewer, settled checks exit 0 and report no reviewer state", () => {
  const outcome = decision({ reviewer: null });
  assert.equal(outcome.code, 0);
  assert.equal(outcome.reviewer, undefined);
  assert.deepEqual(report(outcome, head), [`${head}: checks passed`]);
});

test("a GitHub review by the configured account finishes only the exact head", () => {
  const review = {
    user: { login: githubReviewer.account },
    commit_id: head,
    state: "APPROVED",
    body: "",
  };
  assert.equal(
    decision({
      reviewer: githubReviewer,
      now: Date.parse("2026-10-11T05:40:50Z"),
      reviews: [review],
    }).code,
    0,
  );
  assert.equal(
    decision({
      reviewer: githubReviewer,
      now: Date.parse("2026-10-11T05:40:50Z"),
      reviews: [{ ...review, commit_id: "older" }],
    }).code,
    null,
  );
  assert.equal(
    decision({
      reviewer: githubReviewer,
      now: Date.parse("2026-10-11T05:40:50Z"),
      reviews: [{ ...review, user: { login: "someone-else" } }],
    }).code,
    null,
  );
});

test("the script with no file finishes settled checks without a reviewer", async () => {
  const result = await run(
    { ...pendingPullRequest, checks: [checkRun()], rejectReviewReads: true },
    ["12"],
    null,
  );
  assert.equal(result.code, 0);
  assert.equal(
    result.stdout,
    `${head}: checks passed; review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
  );
});

test("the script reads a GitHub-review-only fixture and its paginated reviews", async () => {
  const state = { ...pendingPullRequest, checks: [checkRun()] };
  const unrequested = await run(state, ["12"], githubReviewer);
  assert.equal(unrequested.code, 4);
  const reviewed = await run(
    {
      ...state,
      reviews: [
        {
          user: { login: githubReviewer.account },
          commit_id: head,
          state: "APPROVED",
          body: "",
        },
      ],
    },
    ["12"],
    githubReviewer,
  );
  assert.equal(reviewed.code, 0);
  assert.equal(
    reviewed.stdout,
    `${head}: checks passed, reviewer reviewed; review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
  );
});

test("a failed check exits immediately while other checks are pending", () => {
  const outcome = decision({
    checks: [...failedChecks, { name: "slow", state: "pending" }],
  });
  assert.equal(outcome.code, 2);
});

test("only a whole trimmed request comment moves the request time", () => {
  const opened = Date.parse("2026-10-11T05:39:50Z");
  const comment = { login: "maintainer", createdAt: "2026-10-11T05:40:50Z" };
  assert.equal(
    reviewRequestedAt(
      opened,
      [{ ...comment, body: "Fixed; @codex review" }],
      codexReviewer,
    ),
    opened,
  );
  assert.equal(
    reviewRequestedAt(
      opened,
      [{ ...comment, body: " \n@codex review\n " }],
      codexReviewer,
    ),
    Date.parse(comment.createdAt),
  );
  assert.equal(reviewRequestedAt(opened, [], githubReviewer), null);
  assert.equal(
    reviewRequestedAt(
      opened,
      [{ ...comment, body: githubReviewer.request.comment }],
      githubReviewer,
    ),
    Date.parse(comment.createdAt),
  );
});

test("responses before a request do not satisfy the configured response bound", () => {
  const requestedAt = Date.parse("2026-10-11T05:39:50Z");
  const look = {
    reviewer: githubReviewer,
    requestedAt,
    now: requestedAt + 2 * minute,
    comments: [
      {
        login: githubReviewer.account,
        body: "Working",
        createdAt: "2026-10-11T05:38:00Z",
      },
    ],
  };
  assert.equal(decision(look).reviewer, "no response");
  const answered = {
    ...look,
    comments: [{ ...look.comments[0], createdAt: "2026-10-11T05:40:00Z" }],
  };
  assert.equal(decision(answered).code, null);
  const bounded = decision({
    ...answered,
    startedAt: requestedAt + 9 * minute,
    now: requestedAt + 10 * minute,
  });
  assert.equal(bounded.code, 4);
  assert.deepEqual(report(bounded, head), [
    `${head}: checks passed, reviewer did not review within 10 minutes`,
  ]);
});

test("completion lines need the configured account, marker, head and timestamp", () => {
  const valid = summary(completed, "f7bb671");
  for (const comment of [
    { ...valid, login: "someone-else" },
    {
      ...valid,
      body: valid.body.replace(codexReviewer.finished.commentMarker, ""),
    },
    summary(completedCell("invalid"), "f7bb671"),
  ])
    assert.equal(decision({ comments: [comment] }).code, null);
  const noRequest = decision({ requestedAt: null, comments: [valid] });
  assert.equal(noRequest.code, 4);
});

test("without a reviewer the check grace period and invocation limit still apply", () => {
  const now = Date.parse("2026-10-11T05:43:00Z");
  assert.equal(
    decision({ reviewer: null, checks: [], pushedAt: now - 5 * minute }).code,
    0,
  );
  assert.equal(
    decision({ reviewer: null, checks: [], pushedAt: now }).code,
    null,
  );
  const limited = decision({
    reviewer: null,
    checks: [],
    pushedAt: now,
    startedAt: now - 9 * minute,
  });
  assert.deepEqual(report(limited, head), [
    `${head}: still waiting on checks; run again`,
  ]);
  assert.equal(decision({ reviewer: null, checks: failedChecks }).code, 2);
});

test("an invalid reviewer file requires an owner handoff with actionable feedback", async () => {
  const result = await run(pendingPullRequest, ["12"], {
    ...githubReviewer,
    bounds: { responseMinutes: 0, reviewMinutes: 10 },
  });
  assert.equal(result.code, 7);
  assert.match(result.stderr, /responseMinutes/);
  assert.equal(result.stdout, "");
});

test("a response at the request timestamp satisfies the response bound (#423)", () => {
  const requestedAt = Date.parse("2026-10-11T05:39:50Z");
  const outcome = decision({
    reviewer: githubReviewer,
    requestedAt,
    now: requestedAt + 2 * minute,
    comments: [
      {
        login: githubReviewer.account,
        body: "Working",
        createdAt: "2026-10-11T05:39:50Z",
      },
    ],
  });
  assert.equal(outcome.code, null);
  assert.equal(outcome.reviewer, "pending");
});

const replyOnlyReview = {
  id: 42,
  user: { login: githubReviewer.account },
  commit_id: head,
  state: "COMMENTED",
  body: "",
  comments: [{ in_reply_to_id: 1 }, { in_reply_to_id: 2 }],
};

test("reply-only and empty reviews leave every reviewer state unchanged", () => {
  for (const overrides of Object.values(reviewerStates)) {
    for (const comments of [replyOnlyReview.comments, []]) {
      const review = {
        ...replyOnlyReview,
        user: { login: codex },
        comments,
      };
      assert.deepEqual(
        decision({ ...overrides, reviews: [review] }),
        decision(overrides),
      );
    }
  }
});

test("submitted reviews complete with a verdict, body or new thread", () => {
  for (const change of [
    { state: "APPROVED" },
    { state: "CHANGES_REQUESTED" },
    { body: "Reviewed the change." },
    { comments: [...replyOnlyReview.comments, {}] },
  ]) {
    const outcome = decision({
      reviewer: githubReviewer,
      pushedAt: Date.parse("2026-10-11T05:45:00Z"),
      reviews: [{ ...replyOnlyReview, ...change }],
    });
    assert.equal(outcome.code, 0);
    assert.equal(outcome.reviewer, "reviewed");
  }
});

test("pending reviews never complete, even with a body and new thread", () => {
  const look = { reviewer: githubReviewer };
  assert.deepEqual(
    decision({
      ...look,
      reviews: [
        { ...replyOnlyReview, state: "PENDING", body: "Draft", comments: [{}] },
      ],
    }),
    decision(look),
  );
});

test("the script excludes a reply-only review after a push with no later request", async () => {
  const review = { ...replyOnlyReview };
  delete review.comments;
  const state = {
    ...pendingPullRequest,
    createdAt: "2026-10-11T05:00:00Z",
    checks: [checkRun()],
    comments: [
      {
        login: "maintainer",
        createdAt: "2026-10-11T05:01:00Z",
        body: githubReviewer.request.comment,
      },
    ],
    reviewPages: [
      [{ ...review, id: 41, user: { login: "someone-else" } }],
      [review],
    ],
    reviewCommentPages: [
      [
        { pull_request_review_id: 41 },
        { pull_request_review_id: 42, in_reply_to_id: 1 },
      ],
      [{ pull_request_review_id: 42, in_reply_to_id: 2 }],
    ],
  };
  const result = await run(state, ["12"], githubReviewer);
  assert.equal(result.code, 4);
  assert.equal(
    result.stdout,
    `${head}: checks passed, review not requested for this head; review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
  );
  assert.equal(result.stderr, "");
  // A new thread on a later page must belong to this review to complete it.
  const reviewed = await run(
    {
      ...state,
      reviewCommentPages: [
        ...state.reviewCommentPages,
        [{ pull_request_review_id: 42 }],
      ],
    },
    ["12"],
    githubReviewer,
  );
  assert.equal(reviewed.code, 0);
  assert.equal(
    reviewed.stdout,
    `${head}: checks passed, reviewer reviewed; review configuration: example/repository default branch main@${"b".repeat(40)}\n`,
  );
});

test("the installed wait runs against the published adapter without runtime packages", async (t) => {
  const target = installedValidator(t, ".agents/skills/babysit/wait.mjs");
  const result = await run(
    { ...pendingPullRequest, checks: [checkRun()] },
    ["12"],
    null,
    target,
  );
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /checks passed/);
});

test("a proposed self-exemption cannot disable the trusted wait", async () => {
  const result = await run(
    {
      head,
      author: "factory-app[bot]",
      createdAt: "2026-10-11T05:00:00Z",
      pushedAt: "2026-10-11T05:00:00Z",
      reviewConfiguration: {
        policy: { version: 1, author: "other-app[bot]" },
        reviewer: codexReviewer,
      },
    },
    ["12", "--limit", "0.1"],
    codexReviewer,
    undefined,
    { version: 1, author: "factory-app[bot]" },
  );
  assert.equal(result.code, 4, result.stderr);
  assert.match(result.stdout, /reviewer did not respond/);
  assert.match(
    result.stdout,
    /review configuration: example\/repository default branch main@b{40}/,
  );
});
