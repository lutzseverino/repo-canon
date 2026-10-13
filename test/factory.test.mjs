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
    specification: false,
    nativeParent: null,
    parentReference: null,
    subIssues: [],
    blockedBy: [],
    ...details,
  };
}

function snapshot({
  issues = [],
  runs = [],
  claims = [],
  usage = {},
  settings = {},
} = {}) {
  return {
    now,
    issues,
    runs,
    claims,
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
      provider: "claude-code",
      model: "claude-sonnet-5-5",
      effort: "high",
      attempt: 1,
    },
  ]);
});

test("a run:orchestrated label leaves the issue to run like any other", () => {
  assert.deepEqual(
    decideFactory(
      snapshot({ issues: [issue(4, ["ready-for-agent", "run:orchestrated"])] }),
    ),
    decideFactory(snapshot({ issues: [issue(4)] })),
  );
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

// A parent's readiness releases its tickets: it counts only when it was
// applied after the latest of its tickets was linked.
function parent(readyAt, details = {}) {
  return issue(3, ["ready-for-agent"], {
    specification: true,
    readyAt,
    latestLink: { ticket: 6, at: "2026-10-09T10:05:00Z" },
    subIssues: [
      { number: 5, state: "open" },
      { number: 6, state: "open" },
      { number: 4, state: "closed" },
    ],
    ...details,
  });
}

const released = "2026-10-09T10:06:00Z";

test("a ready parent closes once every native sub-issue is closed", () => {
  assert.deepEqual(
    decideFactory(
      snapshot({
        issues: [
          parent(released, {
            subIssues: [
              { number: 5, state: "closed" },
              { number: "acme/gadgets#6", state: "closed" },
            ],
          }),
        ],
      }),
    ),
    [{ kind: "close", issue: 3, tickets: [5, "acme/gadgets#6"] }],
  );
});

test("closing a parent takes precedence over settling its earlier run or claim", () => {
  for (const state of [
    { runs: [run(3, { ended: { timedOut: false, pullRequest: "none" } })] },
    {
      runs: [
        run(3, { attempt: 2, ended: { timedOut: true, pullRequest: "none" } }),
      ],
    },
    { runs: [run(3)] },
    { claims: [{ issue: 3, pullRequest: "none" }] },
  ]) {
    assert.deepEqual(
      decideFactory(
        snapshot({
          issues: [
            parent(released, { subIssues: [{ number: 5, state: "closed" }] }),
          ],
          ...state,
        }),
      ),
      [{ kind: "close", issue: 3, tickets: [5] }],
    );
  }
});

test("an open unlinked ticket holds a parent whose native sub-issues are closed", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        parent(released, {
          subIssues: [{ number: "acme/gadgets#6", state: "closed" }],
        }),
        issue(6, [], { parentReference: 3 }),
      ],
    }),
  );
  assert.equal(
    decisions.some((decision) => decision.kind === "close"),
    false,
  );
  assert.deepEqual(launches(decisions), []);
});

test("parents stay open without readiness, without tickets, or with an open ticket", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        parent(released, {
          labels: ["wayfinder:map"],
          subIssues: [{ number: 5, state: "closed" }],
        }),
        issue(4, ["ready-for-agent"], { specification: true }),
        parent(released, {
          number: 7,
          subIssues: [{ number: "acme/gadgets#8", state: "open" }],
        }),
      ],
    }),
  );
  assert.equal(
    decisions.some((decision) => decision.kind === "close"),
    false,
  );
  assert.deepEqual(launches(decisions), []);
});

test("closing any ready parent does not require pickup gates", () => {
  assert.deepEqual(
    decideFactory(
      snapshot({
        issues: [
          issue(3, ["ready-for-agent", "model:unusable"], {
            readyAt: null,
            latestLink: { ticket: 5, at: released },
            subIssues: [{ number: 5, state: "closed" }],
            blockedBy: [{ number: 2, state: "open" }],
          }),
        ],
        settings: { caps: {} },
      }),
    ),
    [{ kind: "close", issue: 3, tickets: [5] }],
  );
});

function tickets(labels = ["ready-for-agent"]) {
  return [
    issue(5, labels, { nativeParent: 3 }),
    issue(6, labels, { nativeParent: 3 }),
  ];
}

test("a specification or other parent with sub-issues never launches", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        parent(released),
        issue(4, ["ready-for-agent"], { specification: true }),
        issue(7, ["ready-for-agent", "wayfinder:map"], {
          subIssues: [{ number: 8, state: "open" }],
        }),
        issue(9, ["ready-for-agent"], {
          nativeParent: 3,
          subIssues: [{ number: 10, state: "open" }],
        }),
      ],
    }),
  );
  assert.deepEqual(launches(decisions), []);
  assert.ok(decisions.every((decision) => decision.kind === "skip"));
  for (const number of [3, 4])
    assert.equal(
      skipOf(decisions, number),
      "a specification never runs; its readiness releases its tickets",
    );
  for (const number of [7, 9])
    assert.equal(
      skipOf(decisions, number),
      "an issue with sub-issues never runs; its readiness releases its tickets",
    );
});

test("a ready sub-issue runs once its parent is ready after its latest ticket link", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        parent(released),
        ...tickets(),
        issue(7, ["needs-triage"], { nativeParent: 3 }),
      ],
    }),
  );
  assert.deepEqual(
    decisions.filter((decision) => decision.issue !== 3),
    [
      { kind: "claim", issue: 5 },
      {
        kind: "launch",
        issue: 5,
        provider: "claude-code",
        model: "claude-sonnet-5-5",
        effort: "high",
        attempt: 1,
      },
      { kind: "claim", issue: 6 },
      {
        kind: "launch",
        issue: 6,
        provider: "claude-code",
        model: "claude-sonnet-5-5",
        effort: "high",
        attempt: 1,
      },
    ],
  );
});

test("a sub-issue waits while its parent is not ready for agent", () => {
  for (const labels of [[], ["needs-triage"]]) {
    const decisions = decideFactory(
      snapshot({
        issues: [parent(released, { labels }), ...tickets()],
      }),
    );
    assert.deepEqual(launches(decisions), []);
    for (const number of [5, 6])
      assert.equal(
        skipOf(decisions, number),
        "sub-issue of specification #3, which is not ready for agent; apply ready-for-agent to #3 once its tickets are published",
      );
  }
});

// `to-tickets` labels a ticket ready before it links the next one, so a ticket
// can be ready while its parent's readiness covers only part of the set.
test("a ticket stays held until its parent's readiness is re-applied after its latest link", () => {
  for (const readyAt of [
    "2026-10-09T10:02:00Z",
    "2026-10-09T10:05:00Z",
    null,
  ]) {
    const decisions = decideFactory(
      snapshot({ issues: [parent(readyAt), ...tickets()] }),
    );
    assert.deepEqual(launches(decisions), [], `readiness at ${readyAt}`);
    for (const number of [5, 6])
      assert.equal(
        skipOf(decisions, number),
        "sub-issue of specification #3, whose readiness predates its latest ticket #6; remove and re-apply ready-for-agent on #3 once its tickets are published",
      );
  }
});

test("a sub-issue waits while its parent has an open native blocker", () => {
  const blocked = decideFactory(
    snapshot({
      issues: [
        parent(released, {
          blockedBy: [
            { number: 1, state: "open" },
            { number: 2, state: "closed" },
          ],
        }),
        ...tickets(),
      ],
    }),
  );
  assert.deepEqual(launches(blocked), []);
  assert.equal(
    skipOf(blocked, 5),
    "sub-issue of specification #3, which is blocked by #1; it waits until #3's blockers close",
  );
  const unblocked = decideFactory(
    snapshot({
      issues: [
        parent(released, { blockedBy: [{ number: 1, state: "closed" }] }),
        ...tickets(),
      ],
    }),
  );
  assert.deepEqual(
    launches(unblocked).map((launch) => launch.issue),
    [5, 6],
  );
});

// A ticket that names an open parent in its `Parent` section counts as its
// ticket before it is linked.
test("a ticket naming a parent it is not linked to holds itself and the parent's sub-issues", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        parent(released),
        ...tickets(),
        issue(7, ["ready-for-agent"], { parentReference: 3 }),
        issue(8, ["needs-triage"], { parentReference: 3 }),
        issue(9),
      ],
    }),
  );
  for (const number of [5, 6])
    assert.equal(
      skipOf(decisions, number),
      "sub-issue of specification #3, which tickets name as their parent without being linked to it: #7, #8; add them to #3 as sub-issues",
    );
  assert.equal(
    skipOf(decisions, 7),
    "names #3 as its parent but is not linked to it yet; add it to #3 as a sub-issue",
  );
  assert.deepEqual(
    launches(decisions).map((launch) => launch.issue),
    [9],
  );
});

test("a ticket naming an open parent with sub-issues is held until it is linked", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(4, ["wayfinder:map"], {
          subIssues: [{ number: 5, state: "open" }],
        }),
        issue(5, ["ready-for-agent"], { nativeParent: 4 }),
        issue(7, ["ready-for-agent"], { parentReference: 4 }),
      ],
    }),
  );
  assert.deepEqual(launches(decisions), []);
  assert.equal(
    skipOf(decisions, 7),
    "names #4 as its parent but is not linked to it yet; add it to #4 as a sub-issue",
  );
});

test("a ready ticket whose blocker edge exists runs only after its blocker closes", () => {
  const blocker = (state) =>
    issue(6, ["ready-for-agent"], {
      nativeParent: 3,
      blockedBy: [{ number: 5, state }],
    });
  const waiting = decideFactory(
    snapshot({
      issues: [
        parent(released),
        issue(5, ["ready-for-agent"], { nativeParent: 3 }),
        blocker("open"),
      ],
    }),
  );
  assert.deepEqual(
    launches(waiting).map((launch) => launch.issue),
    [5],
  );
  assert.equal(skipOf(waiting, 6), "blocked by #5");
  const after = decideFactory(
    snapshot({ issues: [parent(released), blocker("closed")] }),
  );
  assert.deepEqual(
    launches(after).map((launch) => launch.issue),
    [6],
  );
});

// Only an open parent in this repository holds the tickets that name it, so
// any other `Parent` reference leaves the ticket to run alone.
test("a ticket naming anything but an open parent runs directly", () => {
  for (const parentReference of [4, 5, "acme/gadgets#3"]) {
    const decisions = decideFactory(
      snapshot({
        issues: [
          issue(4, ["wayfinder:map"]),
          issue(7, ["ready-for-agent"], { parentReference }),
        ],
      }),
    );
    assert.deepEqual(
      launches(decisions).map((launch) => launch.issue),
      [7],
      `Parent ${parentReference}`,
    );
  }
});

test("a ready planning issue does not wait for the tickets that name it", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(4, ["ready-for-agent"]),
        issue(7, ["ready-for-agent"], { parentReference: 4 }),
      ],
    }),
  );
  assert.deepEqual(
    launches(decisions).map((launch) => launch.issue),
    [4, 7],
  );
});

// A sub-issue waits on its open native parent, whatever kind of issue that
// is, and the native parent outranks the `Parent` section.
test("a sub-issue of any open parent in this repository waits for that parent", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(4, ["wayfinder:map"], {
          subIssues: [
            { number: 7, state: "open" },
            { number: 8, state: "open" },
          ],
        }),
        issue(7, ["ready-for-agent"], { nativeParent: 4 }),
        issue(8, ["ready-for-agent"], { nativeParent: 4, parentReference: 9 }),
        issue(9, ["ready-for-agent"], { specification: true }),
      ],
    }),
  );
  for (const number of [7, 8])
    assert.equal(
      skipOf(decisions, number),
      "sub-issue of #4, which is not ready for agent; apply ready-for-agent to #4 once its tickets are published",
    );
  assert.deepEqual(launches(decisions), []);
});

test("a sub-issue of a closed parent or one in another repository runs directly", () => {
  for (const nativeParent of [4, "acme/gadgets#3"]) {
    const decisions = decideFactory(
      snapshot({
        issues: [
          parent(released, { labels: [] }),
          issue(7, ["ready-for-agent"], { nativeParent, parentReference: 3 }),
        ],
      }),
    );
    assert.deepEqual(
      launches(decisions).map((launch) => launch.issue),
      [7],
      `native parent ${nativeParent}`,
    );
  }
});

test("another repository's sub-issue does not stand in for a local ticket with its number", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        parent(released, {
          subIssues: [
            { number: 5, state: "open" },
            { number: "acme/gadgets#7", state: "open" },
          ],
        }),
        issue(5, ["ready-for-agent"], { nativeParent: 3 }),
        issue(7, ["ready-for-agent"], { parentReference: 3 }),
      ],
    }),
  );
  assert.equal(
    skipOf(decisions, 5),
    "sub-issue of specification #3, which tickets name as their parent without being linked to it: #7; add them to #3 as sub-issues",
  );
  assert.deepEqual(launches(decisions), []);
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

test("each ticket launches on its own model label or the host default", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        parent(released, {
          labels: ["ready-for-agent", "model:gpt-5.5"],
          subIssues: [
            { number: 5, state: "open" },
            { number: 6, state: "open" },
            { number: 7, state: "open" },
          ],
        }),
        issue(5, ["ready-for-agent", "model:claude-opus-5-5@xhigh"], {
          nativeParent: 3,
        }),
        issue(6, ["ready-for-agent", "model:codex/o5@low"], {
          nativeParent: 3,
        }),
        issue(7, ["ready-for-agent"], { nativeParent: 3 }),
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
        issue: 5,
        provider: "claude-code",
        model: "claude-opus-5-5",
        effort: "xhigh",
      },
      { issue: 6, provider: "codex", model: "o5", effort: "low" },
      {
        issue: 7,
        provider: "claude-code",
        model: "claude-sonnet-5-5",
        effort: "high",
      },
    ],
  );
});

test("a ticket's unusable model label skips only that ticket", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        parent(released),
        issue(5, ["ready-for-agent", "model:gemini-3"], { nativeParent: 3 }),
        issue(6, ["ready-for-agent"], { nativeParent: 3 }),
      ],
    }),
  );
  assert.equal(
    skipOf(decisions, 5),
    "model gemini-3 names no provider; label it model:<provider>/gemini-3 with claude-code or codex",
  );
  assert.deepEqual(
    launches(decisions).map((launch) => launch.issue),
    [6],
  );
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

for (const attempt of [1, 2])
  for (const timedOut of [false, true])
    for (const pullRequest of ["none", "closed", "merged-issue-open"])
      test(`attempt ${attempt} needing input releases its claim with ${pullRequest} pull request, timed out: ${timedOut}`, () => {
        const decisions = decideFactory(
          snapshot({
            issues: [issue(4, [...claimed, "factory:needs-input"])],
            runs: [run(4, { attempt, ended: { timedOut, pullRequest } })],
          }),
        );
        assert.deepEqual(decisions, [
          { kind: "release", issue: 4 },
          {
            kind: "skip",
            issue: 4,
            reason:
              "labelled factory:needs-input; answer the question and remove the label to run it again",
          },
        ]);
      });

test("a ready issue needing input is skipped until the owner answers and removes the label", () => {
  assert.deepEqual(
    decideFactory(
      snapshot({
        issues: [issue(4, ["ready-for-agent", "factory:needs-input"])],
      }),
    ),
    [
      {
        kind: "skip",
        issue: 4,
        reason:
          "labelled factory:needs-input; answer the question and remove the label to run it again",
      },
    ],
  );
  assert.deepEqual(
    launches(decideFactory(snapshot({ issues: [issue(4)] }))).map(
      ({ issue, attempt }) => ({ issue, attempt }),
    ),
    [{ issue: 4, attempt: 1 }],
  );
});

test("an ended run's open pull request keeps its claim with or without a needs-input label", () => {
  for (const attempt of [1, 2])
    for (const timedOut of [false, true])
      for (const needsInput of [false, true]) {
        const decisions = decideFactory(
          snapshot({
            issues: [
              issue(
                4,
                needsInput ? [...claimed, "factory:needs-input"] : claimed,
              ),
            ],
            runs: [
              run(4, { attempt, ended: { timedOut, pullRequest: "open" } }),
            ],
          }),
        );
        assert.deepEqual(decisions[0], { kind: "keep", issue: 4 });
        assert.deepEqual(launches(decisions), []);
      }
});

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
      issues: [issue(4, [...claimed, "model:gpt-5.5"])],
      runs: [
        run(4, {
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
      provider: "claude-code",
      model: "claude-opus-5-5",
      effort: "xhigh",
      attempt: 2,
      retry: {
        failure: "the run ended without an open pull request",
        log: "/srv/factory/.sandcastle/logs/issue-4-attempt-1.log",
      },
    },
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

test("a retried run that exceeded the time limit fails without an open pull request", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(4, claimed)],
      runs: [
        run(4, { attempt: 2, ended: { timedOut: true, pullRequest: "none" } }),
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

test("a claim no run holds stays while its pull request is open and is released once it merges", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(4, claimed)],
      claims: [
        { issue: 4, pullRequest: "open" },
        { issue: 5, pullRequest: "merged" },
      ],
    }),
  );
  assert.deepEqual(decisions, [
    { kind: "release", issue: 5 },
    { kind: "skip", issue: 4, reason: "claimed by a running factory run" },
  ]);
});

test("a needs-input claim left by an earlier factory process releases unless its pull request is open", () => {
  for (const pullRequest of ["none", "closed", "merged-issue-open", "open"]) {
    const decisions = decideFactory(
      snapshot({
        issues: [issue(4, [...claimed, "factory:needs-input"])],
        claims: [{ issue: 4, pullRequest }],
      }),
    );
    assert.deepEqual(
      decisions.filter(({ kind }) => kind !== "skip"),
      pullRequest === "open" ? [] : [{ kind: "release", issue: 4 }],
    );
  }
});

test("a claim that neither a run nor an open pull request holds fails its issue", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(6, claimed), issue(7, claimed)],
      claims: [
        { issue: 6, pullRequest: "closed" },
        { issue: 7, pullRequest: "none" },
      ],
    }),
  );
  assert.deepEqual(decisions.slice(0, 2), [
    {
      kind: "fail",
      issue: 6,
      failure: "its pull request closed without merging",
      log: null,
    },
    {
      kind: "fail",
      issue: 7,
      failure: "no factory run or open pull request holds its claim",
      log: null,
    },
  ]);
});

test("a run whose pull request merged without closing its issue fails it without a retry", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(4, claimed)],
      runs: [
        run(4, {
          ended: { timedOut: false, pullRequest: "merged-issue-open" },
        }),
      ],
    }),
  );
  assert.deepEqual(launches(decisions), []);
  assert.deepEqual(decisions[0], {
    kind: "fail",
    issue: 4,
    failure:
      "its pull request merged without closing the issue; close the issue if that finished it",
    log: "/srv/factory/.sandcastle/logs/issue-4-attempt-1.log",
  });
});

test("a claim whose pull request merged without closing its issue fails it", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(6, claimed)],
      claims: [{ issue: 6, pullRequest: "merged-issue-open" }],
    }),
  );
  assert.deepEqual(decisions[0], {
    kind: "fail",
    issue: 6,
    failure:
      "its pull request merged without closing the issue; close the issue if that finished it",
    log: null,
  });
});

test("a retry takes its turn in oldest-first order", () => {
  const ended = { timedOut: false, pullRequest: "none" };
  const decisions = decideFactory(
    snapshot({
      issues: [issue(4, claimed), issue(2)],
      runs: [run(4, { ended })],
      settings: { caps: { "claude-code": 1 } },
    }),
  );
  assert.deepEqual(
    launches(decisions).map(({ issue, attempt }) => ({ issue, attempt })),
    [{ issue: 2, attempt: 1 }],
  );
  assert.equal(
    skipOf(decisions, 4),
    "retry waits: claude-code already runs its cap of 1 agent",
  );
});

test("a retry whose issue is no longer eligible fails it instead", () => {
  const ended = { timedOut: false, pullRequest: "none" };
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(4, ["factory:running"]),
        issue(5, claimed, { blockedBy: [{ number: 2, state: "open" }] }),
        issue(6, [...claimed, "factory:failed"]),
      ],
      runs: [run(4, { ended }), run(5, { ended }), run(6, { ended })],
    }),
  );
  assert.deepEqual(launches(decisions), []);
  assert.deepEqual(
    decisions.map(({ kind, issue, failure }) => ({ kind, issue, failure })),
    [
      {
        kind: "fail",
        issue: 4,
        failure:
          "the run ended without an open pull request, and its retry did not launch: it no longer carries ready-for-agent",
      },
      {
        kind: "fail",
        issue: 5,
        failure:
          "the run ended without an open pull request, and its retry did not launch: blocked by #2",
      },
      {
        kind: "fail",
        issue: 6,
        failure:
          "the run ended without an open pull request, and its retry did not launch: labelled factory:failed; remove the label to run it again",
      },
    ],
  );
});

test("a retry follows the same parent rules as a first launch", () => {
  const ended = { timedOut: false, pullRequest: "none" };
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(4, ["wayfinder:map"], {
          subIssues: [{ number: 6, state: "open" }],
        }),
        issue(5, claimed, { parentReference: 9 }),
        issue(6, claimed, { nativeParent: 4 }),
      ],
      runs: [run(5, { ended }), run(6, { ended })],
    }),
  );
  assert.deepEqual(
    decisions.map(({ kind, issue, attempt, failure }) => ({
      kind,
      issue,
      attempt,
      failure,
    })),
    [
      { kind: "launch", issue: 5, attempt: 2, failure: undefined },
      {
        kind: "fail",
        issue: 6,
        attempt: undefined,
        failure:
          "the run ended without an open pull request, and its retry did not launch: sub-issue of #4, which is not ready for agent; apply ready-for-agent to #4 once its tickets are published",
      },
    ],
  );
});

test("a retry of a ticket whose parent's set changed since its readiness fails it", () => {
  const ended = { timedOut: false, pullRequest: "none" };
  const decisions = decideFactory(
    snapshot({
      issues: [
        parent("2026-10-09T10:02:00Z", {
          labels: ["ready-for-agent", "factory:running"],
        }),
        issue(5, claimed, { nativeParent: 3 }),
      ],
      runs: [run(3, { ended }), run(5, { ended })],
    }),
  );
  assert.deepEqual(
    decisions.map(({ kind, issue, failure }) => ({ kind, issue, failure })),
    [
      {
        kind: "fail",
        issue: 3,
        failure:
          "the run ended without an open pull request, and its retry did not launch: a specification never runs; its readiness releases its tickets",
      },
      {
        kind: "fail",
        issue: 5,
        failure:
          "the run ended without an open pull request, and its retry did not launch: sub-issue of specification #3, whose readiness predates its latest ticket #6; remove and re-apply ready-for-agent on #3 once its tickets are published",
      },
    ],
  );
});

test("an unavailable update launches no adoption", async () => {
  const { decideUpdate } = await import("../.sandcastle/factory.ts");
  assert.deepEqual(
    decideUpdate({ cli: { update: "none" }, standards: { update: "unknown" } }),
    { kind: "no-update" },
  );
});

const availableUpdate = {
  cli: { update: "available", newest: "6.0.0" },
  standards: { update: "available", newest: "v0.6.0" },
};
const inspectedUpdate = {
  format: "repo-standards/inspection/v7",
  identity: "sha256:candidate",
  selection: {
    cli: { package: "@lutzseverino/repo-standards", version: "6.0.0" },
    standards: {
      repository: "https://github.com/acme/standards",
      version: "v0.6.0",
    },
    profile: "complete",
  },
  confirmation: { required: false, reasons: [] },
};

test("a routine update is inspected then run without a ticket", async () => {
  const { decideUpdate } = await import("../.sandcastle/factory.ts");
  assert.deepEqual(decideUpdate(availableUpdate), { kind: "inspect-update" });
  assert.deepEqual(decideUpdate(availableUpdate, inspectedUpdate), {
    kind: "adopt-update",
    inspection: inspectedUpdate,
  });
});

test("an update that discards edits becomes triage with its inspection reasons", async () => {
  const { decideUpdate } = await import("../.sandcastle/factory.ts");
  const inspection = {
    ...inspectedUpdate,
    confirmation: {
      required: true,
      reasons: [{ change: "discarded-edit", target: "CONTRIBUTING.md" }],
    },
  };
  assert.deepEqual(decideUpdate(availableUpdate, inspection), {
    kind: "triage-update",
    inspection,
  });
});

test("a report without the confirmation contract cannot authorize adoption", async () => {
  const { decideUpdate } = await import("../.sandcastle/factory.ts");
  assert.equal(
    decideUpdate(availableUpdate, {
      ...inspectedUpdate,
      confirmation: undefined,
    }).kind,
    "wait-update",
  );
});

test("an unpushed workflow change fails either attempt without a retry", () => {
  for (const attempt of [1, 2]) {
    const decisions = decideFactory(
      snapshot({
        issues: [issue(4, ["ready-for-agent", "factory:running"])],
        runs: [
          run(4, {
            attempt,
            ended: {
              timedOut: false,
              pullRequest: "none",
              unpushedWorkflowChanges: [".github/workflows/ci.yml"],
            },
          }),
        ],
      }),
    );
    assert.deepEqual(
      decisions.filter((decision) => decision.kind !== "skip"),
      [
        {
          kind: "fail",
          issue: 4,
          failure:
            "the run's branch has workflow changes the factory's GitHub App can't push",
          workflowPaths: [".github/workflows/ci.yml"],
          log: "/srv/factory/.sandcastle/logs/issue-4-attempt-1.log",
        },
      ],
    );
  }
});

test("timeouts ignore an unpushed workflow change and keep their retry", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(4, ["ready-for-agent", "factory:running"])],
      runs: [
        run(4, {
          ended: {
            timedOut: true,
            pullRequest: "none",
            unpushedWorkflowChanges: [".github/workflows/ci.yml"],
          },
        }),
      ],
    }),
  );
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].kind, "launch");
  assert.equal(decisions[0].attempt, 2);
  const [failure] = decideFactory(
    snapshot({
      runs: [
        run(4, {
          attempt: 2,
          ended: {
            timedOut: true,
            pullRequest: "none",
            unpushedWorkflowChanges: [".github/workflows/ci.yml"],
          },
        }),
      ],
    }),
  );
  assert.equal(
    failure.failure,
    "the run exceeded the time limit of 240 minutes",
  );
});

test("workflow changes in update inspections go to the owner, while matches are adopted", async () => {
  const { decideUpdate } = await import("../.sandcastle/factory.ts");
  for (const [field, action] of [
    ["exact", "create"],
    ["exact", "replace"],
    ["systemSkills", "create"],
    ["systemSkills", "replace"],
    ["removed", "remove"],
  ]) {
    const inspection = {
      ...inspectedUpdate,
      [field]: [{ target: ".github/workflows/ci.yml", action }],
    };
    assert.equal(
      decideUpdate(availableUpdate, inspection).kind,
      "triage-update",
      `${field} ${action}`,
    );
  }
  assert.equal(
    decideUpdate(availableUpdate, {
      ...inspectedUpdate,
      exact: [
        { target: ".github/workflows/ci.yml", action: "match" },
        { target: "ci.yml", action: "replace" },
      ],
    }).kind,
    "adopt-update",
  );
});
