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
        issue(5, ["ready-for-agent"], { nativeParent: 3 }),
        issue(7, ["ready-for-agent"], { nativeParent: 4 }),
      ],
    }),
  );
  assert.deepEqual(
    launches(decisions).map(({ issue, mode }) => ({ issue, mode })),
    [{ issue: 3, mode: "orchestrated" }],
  );
  assert.equal(skipOf(decisions, 4), "children not ready for agent: #8");
  assert.equal(
    skipOf(decisions, 5),
    "sub-issue of #3; it runs as part of #3 once #3 is ready for agent",
  );
  assert.equal(
    skipOf(decisions, 7),
    "sub-issue of #4; it runs as part of #4 once #4 is ready for agent",
  );
});

test("a specification without tickets waits for them instead of running directly", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(3, ["ready-for-agent"], { specification: true }),
        issue(4, ["ready-for-agent"]),
      ],
    }),
  );
  assert.equal(skipOf(decisions, 3), "specification has no tickets yet");
  assert.ok(
    !decisions.some(
      (decision) => decision.kind !== "skip" && decision.issue === 3,
    ),
  );
  assert.deepEqual(
    launches(decisions).map(({ issue, mode }) => ({ issue, mode })),
    [{ issue: 4, mode: "direct" }],
  );
});

test("a specification runs orchestrated once its tickets exist and are ready", () => {
  const [, launch] = decideFactory(
    snapshot({
      issues: [
        issue(3, ["ready-for-agent"], {
          specification: true,
          subIssues: [
            { number: 5, state: "open", labels: ["ready-for-agent"] },
          ],
        }),
      ],
    }),
  );
  assert.equal(launch.mode, "orchestrated");
});

// A specification's readiness covers its ticket graph: it counts only when it
// was applied after the latest of its tickets was linked.
function graph(readyAt, subIssues = []) {
  return issue(3, ["ready-for-agent"], {
    specification: true,
    readyAt,
    latestLink: { ticket: 6, at: "2026-10-09T10:05:00Z" },
    subIssues: [
      { number: 5, state: "open", labels: ["ready-for-agent"] },
      { number: 6, state: "open", labels: ["ready-for-agent"] },
      { number: 4, state: "closed", labels: [] },
      ...subIssues,
    ],
  });
}

test("a specification whose readiness predates its latest ticket waits for readiness again", () => {
  for (const readyAt of [
    "2026-10-09T10:02:00Z",
    "2026-10-09T10:05:00Z",
    null,
  ]) {
    const decisions = decideFactory(snapshot({ issues: [graph(readyAt)] }));
    assert.deepEqual(decisions, [
      {
        kind: "skip",
        issue: 3,
        reason:
          "readiness predates its latest ticket #6; remove and re-apply ready-for-agent once its tickets are published",
      },
    ]);
  }
});

test("a specification made ready after its latest ticket was linked runs orchestrated", () => {
  const decisions = decideFactory(
    snapshot({ issues: [graph("2026-10-09T10:06:00Z")] }),
  );
  assert.deepEqual(decisions[0], { kind: "claim", issue: 3 });
  assert.deepEqual(
    launches(decisions).map(({ issue, mode }) => ({ issue, mode })),
    [{ issue: 3, mode: "orchestrated" }],
  );
});

// A ticket that names an open specification in its `Parent` section counts as
// its ticket before it is linked.
test("a ticket naming a specification it is not linked to holds both back", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        graph("2026-10-09T10:06:00Z"),
        issue(7, ["ready-for-agent"], { parentReference: 3 }),
        issue(8, ["needs-triage"], { parentReference: 3 }),
        issue(9),
      ],
    }),
  );
  assert.equal(
    skipOf(decisions, 3),
    "tickets name it as their parent but are not linked to it yet: #7, #8",
  );
  assert.equal(
    skipOf(decisions, 7),
    "names specification #3 as its parent but is not linked to it yet",
  );
  assert.deepEqual(
    launches(decisions).map(({ issue, mode }) => ({ issue, mode })),
    [{ issue: 9, mode: "direct" }],
  );
});

// Only an open specification in this repository runs over the tickets that
// name it, so any other `Parent` reference leaves the ticket to run alone.
test("a ticket naming anything but an open specification runs directly", () => {
  for (const parentReference of [4, 5]) {
    const decisions = decideFactory(
      snapshot({
        issues: [
          issue(4, ["wayfinder:map"]),
          issue(7, ["ready-for-agent"], { parentReference }),
        ],
      }),
    );
    assert.deepEqual(
      launches(decisions).map(({ issue, mode }) => ({ issue, mode })),
      [{ issue: 7, mode: "direct" }],
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
    launches(decisions).map(({ issue, mode }) => ({ issue, mode })),
    [
      { issue: 4, mode: "direct" },
      { issue: 7, mode: "direct" },
    ],
  );
});

// A sub-issue runs as part of its open native parent, whatever kind of issue
// that is, and the native parent outranks the `Parent` section.
test("a sub-issue of an open parent in this repository waits for the parent", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        graph("2026-10-09T10:06:00Z"),
        issue(4, ["wayfinder:map"], {
          subIssues: [{ number: 8, state: "open", labels: [] }],
        }),
        issue(5, ["ready-for-agent"], { nativeParent: 3 }),
        issue(7, ["ready-for-agent"], { nativeParent: 4 }),
        issue(8, ["ready-for-agent"], { nativeParent: 4, parentReference: 9 }),
        issue(9, ["needs-triage"], { specification: true }),
      ],
    }),
  );
  assert.equal(
    skipOf(decisions, 5),
    "sub-issue of specification #3; it runs as part of #3 once #3 is ready for agent",
  );
  for (const number of [7, 8])
    assert.equal(
      skipOf(decisions, number),
      "sub-issue of #4; it runs as part of #4 once #4 is ready for agent",
    );
  assert.deepEqual(
    launches(decisions).map(({ issue, mode }) => ({ issue, mode })),
    [{ issue: 3, mode: "orchestrated" }],
  );
});

test("a sub-issue of a closed parent or one in another repository runs directly", () => {
  for (const nativeParent of [4, "acme/gadgets#3"]) {
    const decisions = decideFactory(
      snapshot({
        issues: [
          graph("2026-10-09T10:06:00Z"),
          issue(7, ["ready-for-agent"], { nativeParent, parentReference: 3 }),
        ],
      }),
    );
    assert.deepEqual(
      launches(decisions).map(({ issue, mode }) => ({ issue, mode })),
      [
        { issue: 3, mode: "orchestrated" },
        { issue: 7, mode: "direct" },
      ],
      `native parent ${nativeParent}`,
    );
  }
});

test("another repository's sub-issue does not stand in for a local ticket with its number", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        graph("2026-10-09T10:06:00Z", [
          {
            number: "acme/gadgets#7",
            state: "open",
            labels: ["ready-for-agent"],
          },
        ]),
        issue(7, ["ready-for-agent"], { parentReference: 3 }),
      ],
    }),
  );
  assert.equal(
    skipOf(decisions, 3),
    "tickets name it as their parent but are not linked to it yet: #7",
  );
  assert.deepEqual(launches(decisions), []);
});

test("an unready sub-issue in another repository is named by its repository", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        graph("2026-10-09T10:06:00Z", [
          { number: "acme/gadgets#7", state: "open", labels: [] },
        ]),
      ],
    }),
  );
  assert.equal(
    skipOf(decisions, 3),
    "children not ready for agent: acme/gadgets#7",
  );
});

test("a ticket naming another repository's issue as its parent runs directly", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        graph("2026-10-09T10:06:00Z"),
        issue(7, ["ready-for-agent"], { parentReference: "acme/gadgets#3" }),
      ],
    }),
  );
  assert.deepEqual(
    launches(decisions).map(({ issue, mode }) => ({ issue, mode })),
    [
      { issue: 3, mode: "orchestrated" },
      { issue: 7, mode: "direct" },
    ],
  );
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

test("an open ticket naming another provider, model or effort holds its parent unclaimed", () => {
  for (const ticketModel of [
    "codex/claude-opus-5-5@high",
    "claude-sonnet-5-5",
    "claude-opus-5-5@xhigh",
  ]) {
    for (const specification of [false, true]) {
      const decisions = decideFactory(
        snapshot({
          issues: [
            issue(3, ["ready-for-agent", "model:claude-opus-5-5"], {
              specification,
              subIssues: [
                {
                  number: 5,
                  state: "open",
                  labels: ["ready-for-agent", `model:${ticketModel}`],
                },
              ],
            }),
          ],
        }),
      );
      assert.equal(decisions.length, 1);
      assert.equal(decisions[0].kind, "skip");
      const reason = skipOf(decisions, 3);
      assert.match(reason, /#5/);
      assert.ok(reason.includes(ticketModel));
      assert.ok(reason.includes("claude-code/claude-opus-5-5@high"));
      assert.match(
        reason,
        /label the parent and its tickets with one model, or remove the tickets' model: labels/,
      );
    }
  }
});

test("unlabelled tickets and equivalent model labels let the parent launch", () => {
  for (const [parentModel, ticketModel] of [
    ["claude-opus-5-5", "claude-code/claude-opus-5-5@high"],
    ["claude-code/claude-opus-5-5@high", "claude-opus-5-5"],
    ["gpt-5.5", "codex/gpt-5.5@high"],
    ["codex/gpt-5.5@low", "gpt-5.5@low"],
    [null, "claude-code/claude-sonnet-5-5@high"],
  ]) {
    const decisions = decideFactory(
      snapshot({
        issues: [
          issue(
            3,
            [
              "ready-for-agent",
              ...(parentModel ? [`model:${parentModel}`] : []),
            ],
            {
              specification: true,
              subIssues: [
                { number: 5, state: "open", labels: ["ready-for-agent"] },
                {
                  number: "owner/other#6",
                  state: "open",
                  labels: ["ready-for-agent", `model:${ticketModel}`],
                },
              ],
            },
          ),
        ],
      }),
    );
    assert.equal(decisions[0].kind, "claim");
    assert.equal(launches(decisions)[0].mode, "orchestrated");
  }
});

test("closed tickets' conflicting or unusable model labels never hold the parent", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(3, ["ready-for-agent"], {
          specification: true,
          subIssues: [
            { number: 5, state: "open", labels: ["ready-for-agent"] },
            { number: 6, state: "closed", labels: ["model:gpt-5.5"] },
            { number: 7, state: "closed", labels: ["model:gemini-3"] },
            {
              number: 8,
              state: "closed",
              labels: ["model:gpt-5.5", "model:claude-opus-5-5"],
            },
          ],
        }),
      ],
    }),
  );
  assert.equal(decisions[0].kind, "claim");
  assert.equal(launches(decisions)[0].issue, 3);
});

test("an open ticket's unusable or several model labels give its direct-issue correction", () => {
  for (const modelLabels of [
    ["model:gemini-3"],
    ["model:cursor/composer-2"],
    ["model:gpt-5.5@max"],
    ["model:codex/"],
    ["model:gpt-5.5", "model:claude-opus-5-5"],
  ]) {
    const decisions = decideFactory(
      snapshot({
        issues: [
          issue(3, ["ready-for-agent"], {
            subIssues: [
              {
                number: "owner/other#5",
                state: "open",
                labels: ["ready-for-agent", ...modelLabels],
              },
            ],
          }),
          issue(5, ["ready-for-agent", ...modelLabels]),
        ],
      }),
    );
    assert.deepEqual(launches(decisions), []);
    assert.equal(decisions.length, 2);
    assert.ok(skipOf(decisions, 3).includes("owner/other#5"));
    assert.ok(skipOf(decisions, 3).includes(skipOf(decisions, 5)));
  }
});

test("one skip reason lists every conflicting ticket against the host default", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(3, ["ready-for-agent"], {
          subIssues: [
            {
              number: 5,
              state: "open",
              labels: ["ready-for-agent", "model:gpt-5.5"],
            },
            {
              number: "owner/other#6",
              state: "open",
              labels: ["ready-for-agent", "model:claude-sonnet-5-5@low"],
            },
            {
              number: 7,
              state: "open",
              labels: ["ready-for-agent", "model:gemini-3"],
            },
          ],
        }),
      ],
    }),
  );
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].kind, "skip");
  const reason = skipOf(decisions, 3);
  for (const detail of [
    "#5",
    "codex/gpt-5.5@high",
    "owner/other#6",
    "claude-code/claude-sonnet-5-5@low",
    "#7",
    "model gemini-3 names no provider",
    "claude-code/claude-sonnet-5-5@high",
  ])
    assert.ok(reason.includes(detail), reason);
});

test("an orchestrated ticket without sub-issues runs on its own labelled model", () => {
  const [, launch] = decideFactory(
    snapshot({
      issues: [
        issue(3, ["ready-for-agent", "run:orchestrated", "model:gpt-5.5"]),
      ],
    }),
  );
  assert.equal(launch.mode, "orchestrated");
  assert.equal(launch.model, "gpt-5.5");
});

test("a parent retry still launches on the retry model despite its tickets' labels", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [
        issue(3, ["ready-for-agent", "factory:running"], {
          subIssues: [
            {
              number: 5,
              state: "open",
              labels: ["ready-for-agent", "model:claude-sonnet-5-5"],
            },
          ],
        }),
      ],
      runs: [
        run(3, {
          mode: "orchestrated",
          ended: { timedOut: false, pullRequest: "none" },
        }),
      ],
    }),
  );
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].kind, "launch");
  assert.equal(decisions[0].attempt, 2);
  assert.equal(decisions[0].model, "claude-opus-5-5");
  assert.equal(decisions[0].effort, "xhigh");
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
        issue(4, ["wayfinder:map"]),
        issue(5, claimed, { parentReference: 4 }),
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
          "the run ended without an open pull request, and its retry did not launch: sub-issue of #4; it runs as part of #4 once #4 is ready for agent",
      },
    ],
  );
});

test("a retry over a ticket graph that changed since its readiness fails it", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [graph("2026-10-09T10:02:00Z")],
      runs: [
        run(3, {
          mode: "orchestrated",
          ended: { timedOut: false, pullRequest: "none" },
        }),
      ],
    }),
  );
  assert.deepEqual(
    decisions.map(({ kind, issue, failure }) => ({ kind, issue, failure })),
    [
      {
        kind: "fail",
        issue: 3,
        failure:
          "the run ended without an open pull request, and its retry did not launch: readiness predates its latest ticket #6; remove and re-apply ready-for-agent once its tickets are published",
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

test("a refused workflow push fails either attempt without a retry", () => {
  for (const attempt of [1, 2]) {
    const decisions = decideFactory(
      snapshot({
        runs: [
          run(4, {
            attempt,
            ended: {
              timedOut: false,
              pullRequest: "none",
              refusedWorkflowPush: [".github/workflows/ci.yml"],
            },
          }),
        ],
      }),
    );
    assert.deepEqual(decisions, [
      {
        kind: "fail",
        issue: 4,
        failure:
          "the factory's GitHub App can't push changes to GitHub workflow files",
        workflowPaths: [".github/workflows/ci.yml"],
        log: "/srv/factory/.sandcastle/logs/issue-4-attempt-1.log",
      },
    ]);
  }
});

test("timeouts ignore a refused workflow push and keep their retry", () => {
  const decisions = decideFactory(
    snapshot({
      issues: [issue(4, ["ready-for-agent", "factory:running"])],
      runs: [
        run(4, {
          ended: {
            timedOut: true,
            pullRequest: "none",
            refusedWorkflowPush: [".github/workflows/ci.yml"],
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
            refusedWorkflowPush: [".github/workflows/ci.yml"],
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
