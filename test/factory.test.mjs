import assert from "node:assert/strict";
import test from "node:test";
import { decideFactory } from "../.sandcastle/factory.ts";

// The factory's decision core, driven by snapshots of the repository's open
// issues, the runs the factory host knows, provider usage, and host settings.
const now = "2026-10-09T12:00:00Z";

function issue(number, labels = ["ready-for-agent"], details = {}) {
  return {
    number,
    createdAt: `2026-10-0${Math.min(number, 9)}T00:00:00Z`,
    labels,
    parent: null,
    subIssues: [],
    blockedBy: [],
    ...details,
  };
}

function snapshot({ issues = [], runs = [], usage = {}, settings = {} } = {}) {
  return {
    now,
    issues,
    runs,
    usage,
    settings: {
      defaultModel: "claude-sonnet-5-5",
      retryModel: "claude-opus-5-5@xhigh",
      caps: { "claude-code": 3, codex: 2 },
      usageThreshold: 80,
      timeLimitMinutes: 240,
      ...settings,
    },
  };
}

function run(issueNumber, details = {}) {
  return {
    issue: issueNumber,
    mode: "direct",
    provider: "claude-code",
    model: "claude-sonnet-5-5",
    effort: "high",
    attempt: 1,
    startedAt: "2026-10-09T11:00:00Z",
    log: `/srv/factory/.sandcastle/logs/issue-${issueNumber}-attempt-1.log`,
    ended: null,
    ...details,
  };
}

function launches(decisions) {
  return decisions.filter((decision) => decision.kind === "launch");
}

function skipOf(decisions, number) {
  return decisions.find(
    (decision) => decision.kind === "skip" && decision.issue === number,
  )?.reason;
}

test("a ready issue runs directly on the host's default model", () => {
  const decisions = decideFactory(snapshot({ issues: [issue(4)] }));
  assert.deepEqual(decisions, [
    { kind: "claim", issue: 4 },
    {
      kind: "launch",
      issue: 4,
      mode: "direct",
      provider: "claude-code",
      model: "claude-sonnet-5-5",
      effort: "high",
      attempt: 1,
    },
  ]);
});

test("run:orchestrated starts an orchestrator over the ticket", () => {
  const [, launch] = decideFactory(
    snapshot({ issues: [issue(4, ["ready-for-agent", "run:orchestrated"])] }),
  );
  assert.equal(launch.mode, "orchestrated");
});

test("only issues carrying ready-for-agent reach the frontier", () => {
  const decisions = decideFactory(
    snapshot({ issues: [issue(4, ["needs-triage"]), issue(5, [])] }),
  );
  assert.deepEqual(decisions, []);
});

test("claimed, failed and blocked issues are skipped with their reasons", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(4, ["ready-for-agent", "factory:running"]),
        issue(5, ["ready-for-agent", "factory:failed"]),
        issue(6, ["ready-for-agent"], {
          blockedBy: [
            { number: 2, state: "open" },
            { number: 3, state: "closed" },
          ],
        }),
        issue(7, ["ready-for-agent"], {
          blockedBy: [{ number: 3, state: "closed" }],
        }),
      ],
    }),
  );
  assert.equal(skipOf(decisions, 4), "claimed by a running factory run");
  assert.equal(
    skipOf(decisions, 5),
    "labelled factory:failed; remove the label to run it again",
  );
  assert.equal(skipOf(decisions, 6), "blocked by #2");
  assert.deepEqual(
    launches(decisions).map((launch) => launch.issue),
    [7],
  );
});

test("a specification runs orchestrated once it and every open child are ready", () => {
  const child = (number, labels, state = "open") => ({ number, state, labels });
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(3, ["ready-for-agent"], {
          subIssues: [child(5, ["ready-for-agent"]), child(6, [], "closed")],
        }),
        issue(4, ["ready-for-agent"], {
          subIssues: [child(7, ["ready-for-agent"]), child(8, ["needs-info"])],
        }),
        issue(5, ["ready-for-agent"], { parent: 3 }),
        issue(7, ["ready-for-agent"], { parent: 4 }),
      ],
    }),
  );
  assert.deepEqual(
    launches(decisions).map(({ issue, mode }) => ({ issue, mode })),
    [{ issue: 3, mode: "orchestrated" }],
  );
  assert.equal(skipOf(decisions, 4), "children not ready for agent: #8");
  assert.equal(skipOf(decisions, 5), "child of specification #3");
  assert.equal(skipOf(decisions, 7), "child of specification #4");
});

test("the oldest ready issue launches first", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(9, undefined, { createdAt: "2026-10-03T00:00:00Z" }),
        issue(2, undefined, { createdAt: "2026-10-05T00:00:00Z" }),
        issue(5, undefined, { createdAt: "2026-10-01T00:00:00Z" }),
      ],
    }),
  );
  assert.deepEqual(
    launches(decisions).map((launch) => launch.issue),
    [5, 9, 2],
  );
});

test("model labels route by vendor prefix or named provider, with an effort suffix", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(1, ["ready-for-agent", "model:claude-opus-5-5"]),
        issue(2, ["ready-for-agent", "model:gpt-5.5@xhigh"]),
        issue(3, ["ready-for-agent", "model:codex/o5@low"]),
        issue(4, ["ready-for-agent", "model:claude-code/opus@max"]),
      ],
    }),
  );
  assert.deepEqual(
    launches(decisions).map(({ issue, provider, model, effort }) => ({
      issue,
      provider,
      model,
      effort,
    })),
    [
      {
        issue: 1,
        provider: "claude-code",
        model: "claude-opus-5-5",
        effort: "high",
      },
      { issue: 2, provider: "codex", model: "gpt-5.5", effort: "xhigh" },
      { issue: 3, provider: "codex", model: "o5", effort: "low" },
      { issue: 4, provider: "claude-code", model: "opus", effort: "max" },
    ],
  );
});

test("the host's default model may name its provider and effort", () => {
  const [, launch] = decideFactory(
    snapshot({
      issues: [issue(4)],
      settings: { defaultModel: "codex/o5@medium" },
    }),
  );
  assert.deepEqual(
    { provider: launch.provider, model: launch.model, effort: launch.effort },
    { provider: "codex", model: "o5", effort: "medium" },
  );
});

test("an unusable model label skips the issue with a correction", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(1, ["ready-for-agent", "model:gemini-3"]),
        issue(2, ["ready-for-agent", "model:cursor/composer-2"]),
        issue(3, ["ready-for-agent", "model:gpt-5.5@max"]),
        issue(4, ["ready-for-agent", "model:gpt-5.5", "model:claude-opus-5-5"]),
        issue(5, ["ready-for-agent", "model:codex/"]),
      ],
    }),
  );
  assert.deepEqual(launches(decisions), []);
  assert.equal(
    skipOf(decisions, 1),
    "model gemini-3 names no provider; label it model:<provider>/gemini-3 with claude-code or codex",
  );
  assert.equal(
    skipOf(decisions, 2),
    "provider cursor is not claude-code or codex",
  );
  assert.equal(
    skipOf(decisions, 3),
    "effort max is not one codex accepts: low, medium, high, xhigh",
  );
  assert.equal(
    skipOf(decisions, 4),
    "several model labels: model:gpt-5.5, model:claude-opus-5-5",
  );
  assert.equal(skipOf(decisions, 5), "model codex/ names no model");
});

test("a provider launches only while fewer agents than its cap run there", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(1, ["ready-for-agent", "factory:running"]),
        issue(4),
        issue(5),
        issue(6, ["ready-for-agent", "model:gpt-5.5"]),
      ],
      runs: [run(1)],
      settings: { caps: { "claude-code": 2, codex: 1 } },
    }),
  );
  assert.deepEqual(
    launches(decisions).map((launch) => launch.issue),
    [4, 6],
  );
  assert.equal(
    skipOf(decisions, 5),
    "claude-code already runs its cap of 2 agents",
  );
  assert.ok(
    !decisions.some(
      (decision) => decision.kind === "claim" && decision.issue === 5,
    ),
  );
});

test("a provider without a cap launches nothing", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(4, ["ready-for-agent", "model:gpt-5.5"])],
      settings: { caps: { "claude-code": 2 } },
    }),
  );
  assert.equal(skipOf(decisions, 4), "the host sets no cap for codex");
});

test("a provider launches only while its usage is below the threshold", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(4), issue(5, ["ready-for-agent", "model:gpt-5.5"])],
      usage: { "claude-code": 80, codex: 79.5 },
    }),
  );
  assert.deepEqual(
    launches(decisions).map((launch) => launch.issue),
    [5],
  );
  assert.equal(
    skipOf(decisions, 4),
    "claude-code usage 80% is at or above the 80% threshold",
  );
});

test("an unreadable usage reading gates by count only", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(4), issue(5)],
      usage: { "claude-code": null },
      settings: { caps: { "claude-code": 1 } },
    }),
  );
  assert.deepEqual(
    launches(decisions).map((launch) => launch.issue),
    [4],
  );
  assert.equal(
    skipOf(decisions, 5),
    "claude-code already runs its cap of 1 agent",
  );
});

const claimed = ["ready-for-agent", "factory:running"];

test("a run over the time limit is stopped", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(4, claimed), issue(5, claimed)],
      runs: [
        run(4, { startedAt: "2026-10-09T07:59:59Z" }),
        run(5, { startedAt: "2026-10-09T08:00:00Z" }),
      ],
    }),
  );
  assert.deepEqual(
    decisions.filter((decision) => decision.kind === "stop"),
    [
      {
        kind: "stop",
        issue: 4,
        reason: "exceeded the time limit of 240 minutes",
      },
    ],
  );
});

test("a failed first run retries once on the host's retry model, keeping its claim", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(4, [...claimed, "run:orchestrated", "model:gpt-5.5"])],
      runs: [
        run(4, {
          mode: "orchestrated",
          provider: "codex",
          model: "gpt-5.5",
          ended: { timedOut: false, pullRequest: "none" },
        }),
      ],
    }),
  );
  assert.deepEqual(decisions, [
    {
      kind: "launch",
      issue: 4,
      mode: "orchestrated",
      provider: "claude-code",
      model: "claude-opus-5-5",
      effort: "xhigh",
      attempt: 2,
    },
    { kind: "skip", issue: 4, reason: "claimed by a running factory run" },
  ]);
});

test("a retry waits for its provider's gate", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(4, claimed)],
      runs: [run(4, { ended: { timedOut: false, pullRequest: "none" } })],
      usage: { "claude-code": 95 },
    }),
  );
  assert.deepEqual(launches(decisions), []);
  assert.deepEqual(decisions[0], {
    kind: "skip",
    issue: 4,
    reason:
      "retry waits: claude-code usage 95% is at or above the 80% threshold",
  });
});

test("a run that ends without an open pull request fails once retried or unretryable", () => {
  const ended = { timedOut: false, pullRequest: "none" };
  const retried = decideFactory(
    snapshot({
      issues: [issue(4, claimed)],
      runs: [run(4, { attempt: 2, ended })],
    }),
  );
  assert.deepEqual(retried[0], {
    kind: "fail",
    issue: 4,
    failure: "the run ended without an open pull request",
    log: "/srv/factory/.sandcastle/logs/issue-4-attempt-1.log",
  });
  const unretryable = decideFactory(
    snapshot({
      issues: [issue(4, claimed)],
      runs: [run(4, { ended })],
      settings: { retryModel: null },
    }),
  );
  assert.equal(unretryable[0].kind, "fail");
});

test("a run that exceeded the time limit fails even with an open pull request", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(4, claimed)],
      runs: [
        run(4, { attempt: 2, ended: { timedOut: true, pullRequest: "open" } }),
      ],
    }),
  );
  assert.equal(decisions[0].kind, "fail");
  assert.equal(
    decisions[0].failure,
    "the run exceeded the time limit of 240 minutes",
  );
});

test("a run that opened its pull request keeps the claim until it merges", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(4, claimed)],
      runs: [
        run(4, { ended: { timedOut: false, pullRequest: "open" } }),
        run(5, { ended: { timedOut: false, pullRequest: "merged" } }),
      ],
    }),
  );
  assert.deepEqual(decisions, [
    { kind: "keep", issue: 4 },
    { kind: "release", issue: 5 },
    { kind: "skip", issue: 4, reason: "claimed by a running factory run" },
  ]);
});

test("an issue whose run is still on the host is not launched twice", () => {
  const decisions = decideFactory(
    snapshot({ issues: [issue(4)], runs: [run(4)] }),
  );
  assert.deepEqual(launches(decisions), []);
  assert.equal(
    skipOf(decisions, 4),
    "a factory run for it is still on the host",
  );
});
