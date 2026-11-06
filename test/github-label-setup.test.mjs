import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertProjectUnchanged,
  githubLabelSetup,
  setup as githubSetup,
} from "./helpers/github-setup.mjs";
import { retainedCheck, snapshot } from "./helpers/operation.mjs";

const canonicalLabels = [
  {
    name: "state:triage",
    color: "fbca04",
    description: "Waits on triage to review it, or review it again",
  },
  {
    name: "state:reporter",
    color: "d4c5f9",
    description: "Waits on its outside reporter for a fact only they hold",
  },
  {
    name: "state:grill",
    color: "d876e3",
    description: "Waits on a grilling session for the owner's intent",
  },
  {
    name: "state:owner",
    color: "1d76db",
    description: "Waits on the owner's answer or work only the owner can do",
  },
  {
    name: "state:ready",
    color: "0e8a16",
    description: "Reviewed; waits on an agent to implement it",
  },
  { name: "type:bug", color: "d73a4a", description: "Something isn't working" },
  {
    name: "type:enhancement",
    color: "a2eeef",
    description: "New feature or request",
  },
  {
    name: "priority:high",
    color: "d93f0b",
    description: "Picked up before normal and low priority work",
  },
  {
    name: "priority:normal",
    color: "bfdadc",
    description: "Picked up in the usual order; no priority label means this",
  },
  {
    name: "priority:low",
    color: "c2e0c6",
    description: "Picked up after high and normal priority work",
  },
  { name: "wontfix", color: "ffffff", description: "Will not be actioned" },
  {
    name: "wayfinder:map",
    color: "5319e7",
    description: "Planning map for related work",
  },
  {
    name: "wayfinder:research",
    color: "bfd4f2",
    description: "Research question in a planning map",
  },
  {
    name: "wayfinder:prototype",
    color: "bfd4f2",
    description: "Prototype question in a planning map",
  },
  {
    name: "wayfinder:grilling",
    color: "bfd4f2",
    description: "Design decision requiring discussion",
  },
  {
    name: "wayfinder:task",
    color: "bfd4f2",
    description: "Task in a planning map",
  },
];
const canonical = (name) =>
  canonicalLabels.find((label) => label.name === name);
const missing = canonicalLabels.length - 1;

function setup(t, options) {
  return githubSetup(t, githubLabelSetup, options);
}

const factorySkip = {
  name: "factory:skip",
  color: "c5def5",
  description: "Ready agent work the factory must not pick up",
};

const factoryReleaseHold = {
  name: "factory:release-hold",
  color: "c5def5",
  description: "Hold other merges while a release PR is open",
};

const factoryHold = {
  name: "factory:hold",
  color: "c5def5",
  description: "Pause factory pickups and other merges in this repository",
};
const factoryLabels = [
  {
    name: "gate:owner-review",
    color: "e99695",
    description: "Waits on the owner's review before its pull request merges",
  },
  {
    name: "gate:major-release",
    color: "e99695",
    description: "Waits on the owner's go-ahead for a major release",
  },
  {
    name: "factory:running",
    color: "0052cc",
    description: "Waits on the factory run that holds it",
  },
  {
    name: "factory:paused",
    color: "c5def5",
    description: "Waits on the factory to resume the run it paused",
  },
  {
    name: "factory:failed",
    color: "b60205",
    description: "Waits on a person to deal with the failed run",
  },
  factorySkip,
  factoryReleaseHold,
  factoryHold,
];

test("factory setup provisions and verifies the gate and factory labels, preserves unrelated labels and is repeat-safe", (t) => {
  const unrelated = {
    name: "factory:other",
    color: "0052cc",
    description: "Kept by the repository",
  };
  const scenario = githubSetup(
    t,
    {
      ...githubLabelSetup,
      script: retainedCheck(t, "operations/setup-github-labels.mjs"),
    },
    { state: { labels: [...structuredClone(canonicalLabels), unrelated] } },
  );
  const before = snapshot(scenario.project.root);
  const outcome = scenario.invoke({ profile: "factory" });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "changed");
  assert.match(
    outcome.result.message,
    new RegExp(`created ${factoryLabels.length} labels`),
  );
  assert.match(
    outcome.result.message,
    new RegExp(
      `Readback confirmed all ${canonicalLabels.length + factoryLabels.length} canonical labels`,
    ),
  );
  assert.deepEqual(scenario.readState().labels, [
    ...canonicalLabels,
    unrelated,
    ...factoryLabels,
  ]);
  assert.equal(scenario.readState().labelReads, 2);
  assert.equal(
    scenario.invoke({ profile: "factory" }).result.status,
    "unchanged",
  );
  assert.equal(scenario.readState().mutations, factoryLabels.length);
  assertProjectUnchanged(before, scenario);
});

test("factory setup confirms label drift before writes and verifies all factory labels on readback", (t) => {
  for (const desired of factoryLabels) {
    const drifted = { ...desired, color: "000000" };
    const scenario = setup(t, {
      state: { labels: [drifted], readbackMismatch: true },
    });
    const confirmation = scenario.invoke({ profile: "factory" });
    assert.equal(confirmation.status, 0, confirmation.stderr);
    assert.equal(confirmation.result.status, "confirmation-required");
    assert.ok(confirmation.result.message.includes(`${desired.name}.color`));
    assert.equal(scenario.readState().mutations ?? 0, 0);
    assert.deepEqual(scenario.readState().labels, [drifted]);

    scenario.updateState({ labelReads: 0 });
    const confirmed = scenario.invoke({
      profile: "factory",
      overwriteAllowed: true,
    });
    assert.equal(confirmed.status, 0, confirmed.stderr);
    assert.equal(confirmed.result.status, "blocked");
    assert.ok(
      confirmed.result.message.includes(
        `readback did not match ${desired.name}`,
      ),
    );
    assert.ok(confirmed.result.message.includes(`updated ${desired.name}`));
    const others = factoryLabels.filter((label) => label !== desired);
    assert.deepEqual(scenario.readState().labels, [
      desired,
      ...canonicalLabels,
      ...others,
    ]);
  }
});

test("provisions every canonical label in an empty repository and is unchanged on repeat", (t) => {
  const scenario = setup(t);
  const before = snapshot(scenario.project.root);
  const outcome = scenario.invoke();

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "changed");
  assert.equal(
    outcome.result.message,
    `GitHub label setup changed acme/widgets: created ${canonicalLabels.length} labels. Readback confirmed all ${canonicalLabels.length} canonical labels; unrelated labels were preserved.`,
  );
  assert.deepEqual(scenario.readState().labels, canonicalLabels);
  assertProjectUnchanged(before, scenario);

  const repeat = scenario.invoke();
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.equal(repeat.result.status, "unchanged");
  assert.equal(scenario.readState().mutations, canonicalLabels.length);
  assertProjectUnchanged(before, scenario);
});

test("reports unchanged after a successful matching setup", (t) => {
  const scenario = setup(t, {
    state: { labels: structuredClone(canonicalLabels) },
  });
  const outcome = scenario.invoke();

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(outcome.result, {
    format: "repo-standards/result/v2",
    status: "unchanged",
    message:
      "GitHub labels already match the canonical configuration for acme/widgets.",
  });
  assert.equal(scenario.readState().mutations ?? 0, 0);
});

// The factory no longer reads `run:orchestrated`, so setup stops provisioning
// it but leaves an adopter's existing label alone.
test("leaves the retired run:orchestrated label in place without provisioning it", (t) => {
  const retired = {
    name: "run:orchestrated",
    color: "c5def5",
    description: "The factory runs an orchestrator over this ticket",
  };
  const scenario = setup(t, {
    state: { labels: [...structuredClone(canonicalLabels), retired] },
  });
  const outcome = scenario.invoke();

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "unchanged");
  assert.deepEqual(scenario.readState().labels, [...canonicalLabels, retired]);
});

// The factory creates its own state labels from the repository's factory
// configuration. Standard-profile setup provisions no factory label and
// leaves all existing factory labels alone, including skip and release hold.
test("standard setup creates no gate or factory label and leaves existing ones in place", (t) => {
  const empty = setup(t);
  const created = empty.invoke();
  assert.equal(created.status, 0, created.stderr);
  assert.deepEqual(
    empty
      .readState()
      .labels.filter(({ name }) => /^(?:gate|factory):/.test(name)),
    [],
  );

  const existingFactoryLabels = [
    { ...factoryHold, color: "000000", description: "Keep hold metadata" },
    {
      ...factoryReleaseHold,
      color: "000000",
      description: "Keep chosen hold metadata",
    },
    {
      ...factorySkip,
      color: "000000",
      description: "Keep chosen skip metadata",
    },
    {
      name: "factory:running",
      color: "0052cc",
      description: "Claimed by a factory run",
    },
    {
      name: "factory:paused",
      color: "c5def5",
      description: "The factory paused this run and resumes it by itself",
    },
    {
      name: "gate:owner-review",
      color: "000000",
      description: "Keep chosen gate metadata",
    },
  ];
  const scenario = setup(t, {
    state: {
      labels: [...structuredClone(canonicalLabels), ...existingFactoryLabels],
    },
  });
  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "unchanged");
  assert.deepEqual(scenario.readState().labels, [
    ...canonicalLabels,
    ...existingFactoryLabels,
  ]);
  assert.equal(scenario.readState().mutations ?? 0, 0);
});

test("reconciles conflicting desired label values without replacing unrelated labels", (t) => {
  const labels = structuredClone(canonicalLabels);
  labels[0] = {
    name: "State:Triage",
    color: "000000",
    description: "Old meaning",
  };
  labels.push({
    name: "customer-report",
    color: "123456",
    description: "Keep me",
  });
  const scenario = setup(t, { state: { labels } });
  const outcome = scenario.invoke({ overwriteAllowed: true });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "changed");
  assert.equal(
    outcome.result.message,
    `GitHub label setup changed acme/widgets: updated state:triage. Readback confirmed all ${canonicalLabels.length} canonical labels; unrelated labels were preserved.`,
  );
  assert.deepEqual(scenario.readState().labels, [
    canonicalLabels[0],
    ...canonicalLabels.slice(1),
    { name: "customer-report", color: "123456", description: "Keep me" },
  ]);
});

test("blocks without label-management permission before changing labels", (t) => {
  const scenario = setup(t, {
    state: {
      permissions: {
        admin: false,
        maintain: false,
        push: false,
        triage: true,
        pull: true,
      },
    },
  });
  const outcome = scenario.invoke();

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "blocked");
  assert.match(outcome.result.message, /write, maintain, or admin access/);
  assert.equal(scenario.readState().mutations ?? 0, 0);
});

test("blocks with GitHub's reason when labels cannot be inspected", (t) => {
  const scenario = setup(t, { state: { failLabelInspection: true } });
  const outcome = scenario.invoke();

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "blocked");
  assert.match(
    outcome.result.message,
    /could not inspect labels for acme\/widgets \(Resource not accessible by integration \(HTTP 403\)\)/,
  );
  assert.equal(scenario.readState().mutations ?? 0, 0);
});

test("reports partial effects and completes missing work after a transient API failure", (t) => {
  const scenario = setup(t, { state: { failAtMutation: 2 } });
  const first = scenario.invoke();

  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.result.status, "blocked");
  assert.match(first.result.message, /created state:triage/);
  assert.match(first.result.message, new RegExp(`${missing} labels remain`));
  assert.equal(scenario.readState().labels.length, 1);

  const retry = scenario.invoke();
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.result.status, "changed");
  assert.match(retry.result.message, new RegExp(`created ${missing} labels`));
  assert.deepEqual(scenario.readState().labels, canonicalLabels);
});

test("recovers after interruption by applying only labels still missing", (t) => {
  const scenario = setup(t, { state: { interruptAtMutation: 2 } });
  const interrupted = scenario.invoke();

  assert.equal(interrupted.status, null);
  assert.equal(interrupted.signal, "SIGKILL");
  assert.deepEqual(scenario.readState().labels, [canonicalLabels[0]]);

  const retry = scenario.invoke();
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.result.status, "changed");
  assert.match(retry.result.message, new RegExp(`created ${missing} labels`));
  assert.deepEqual(scenario.readState().labels, canonicalLabels);
});

test("blocks when readback disagrees and reports the changes already applied", (t) => {
  const scenario = setup(t, { state: { readbackMismatch: true } });
  const outcome = scenario.invoke();

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "blocked");
  assert.match(
    outcome.result.message,
    new RegExp(`created ${canonicalLabels.length} labels`),
  );
  assert.match(outcome.result.message, /readback did not match/);
  assert.deepEqual(scenario.readState().labels, canonicalLabels);
});

test("asks before updating drifted labels and creates nothing until confirmed", (t) => {
  const labels = [
    { ...canonicalLabels[0], color: "000000", description: "Custom meaning" },
    { ...canonicalLabels[1], description: "Custom reporter" },
  ];
  const scenario = setup(t, { state: { labels } });
  const before = snapshot(scenario.project.root);
  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "confirmation-required");
  for (const value of [
    "state:triage",
    "000000",
    "fbca04",
    "Custom meaning",
    canonicalLabels[0].description,
    "state:reporter",
    "Custom reporter",
    canonicalLabels[1].description,
  ])
    assert.ok(outcome.result.message.includes(value), value);
  assert.equal(scenario.readState().mutations ?? 0, 0);
  assert.deepEqual(scenario.readState().labels, labels);
  assertProjectUnchanged(before, scenario);
  const confirmed = scenario.invoke({ overwriteAllowed: true });
  assert.equal(confirmed.result.status, "changed");
  assert.deepEqual(scenario.readState().labels, canonicalLabels);
});

test("updates a label still at GitHub's stock values without confirmation and creates missing labels", (t) => {
  const stock = {
    name: "wontfix",
    color: "ffffff",
    description: "This will not be worked on",
  };
  const scenario = setup(t, { state: { labels: [stock] } });
  const outcome = scenario.invoke({ overwriteAllowed: false });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "changed");
  assert.match(outcome.result.message, /updated wontfix/);
  assert.match(outcome.result.message, new RegExp(`created ${missing} labels`));
  assert.deepEqual(
    scenario.readState().labels.find(({ name }) => name === "wontfix"),
    canonical("wontfix"),
  );
  assert.equal(scenario.readState().labels.length, canonicalLabels.length);
});

test("asks about a label that differs from both the standard and GitHub's stock values", (t) => {
  for (const labels of [
    [{ ...canonical("wontfix"), description: "Closed without a fix" }],
    [
      {
        ...canonical("wontfix"),
        color: "000000",
        description: "This will not be worked on",
      },
    ],
    [
      {
        ...canonical("wontfix"),
        description: "This will not be worked on",
        color: "ffffff",
        name: "Wontfix",
      },
    ],
  ]) {
    const scenario = setup(t, { state: { labels } });
    const outcome = scenario.invoke({ overwriteAllowed: false });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, "confirmation-required");
    assert.match(outcome.result.message, /label wontfix\./i);
    assert.ok(outcome.result.message.includes("Will not be actioned"));
    assert.equal(scenario.readState().mutations ?? 0, 0);
    assert.deepEqual(scenario.readState().labels, labels);
  }
});

test("treats hexadecimal colour casing as matching without confirmation", (t) => {
  const labels = canonicalLabels.map((label) => ({
    ...label,
    color: label.color.toUpperCase(),
  }));
  const scenario = setup(t, { state: { labels } });
  assert.equal(scenario.invoke().result.status, "unchanged");
  assert.equal(scenario.readState().mutations ?? 0, 0);
});

test("reconciles a label on a later page and reads all pages back", (t) => {
  const labels = structuredClone(canonicalLabels);
  labels.at(-1).description = "Repository-chosen description";
  const scenario = setup(t, { state: { labels, pageSize: 2 } });
  const confirmation = scenario.invoke();
  assert.equal(confirmation.status, 0, confirmation.stderr);
  assert.equal(confirmation.result.status, "confirmation-required");
  assert.match(confirmation.result.message, /Repository-chosen description/);
  assert.equal(scenario.readState().mutations ?? 0, 0);
  const changed = scenario.invoke(
    { overwriteAllowed: true },
    { GH_HOST: "enterprise.example" },
  );
  assert.equal(changed.status, 0, changed.stderr);
  assert.equal(changed.result.status, "changed");
  assert.deepEqual(scenario.readState().labels, canonicalLabels);
  assert.equal(scenario.readState().mutations, 1);
  assert.equal(scenario.invoke().result.status, "unchanged");
  assert.deepEqual([...new Set(scenario.readState().apiHosts)], ["github.com"]);
});

// Labels named before ADR 0031's families, at the values Repo Canon or GitHub
// gave them, and the issues that carry them.
const formerLabels = [
  {
    name: "needs-triage",
    color: "fbca04",
    description: "Requires review or renewed review",
  },
  {
    name: "needs-info",
    color: "d4c5f9",
    description:
      "Missing information; the orchestrating agent answers or routes it",
  },
  {
    name: "ready-for-agent",
    color: "0e8a16",
    description: "Reviewed and sufficiently specified for agent implementation",
  },
  {
    name: "ready-for-human",
    color: "1d76db",
    description:
      "Reviewed; needs the owner's accounts, credentials or a reserved taste call",
  },
  { name: "bug", color: "d73a4a", description: "Something isn't working" },
  {
    name: "enhancement",
    color: "a2eeef",
    description: "New feature or request",
  },
  {
    name: "factory:needs-input",
    color: "fbca04",
    description: "Factory state: needsInput",
  },
];
const formerIssues = [
  { number: 1, labels: ["enhancement", "ready-for-agent", "model:x"] },
  { number: 2, labels: ["bug", "needs-triage"] },
  { number: 3, labels: ["enhancement", "ready-for-human"] },
  { number: 4, labels: ["bug", "needs-info"] },
  {
    number: 5,
    labels: ["enhancement", "ready-for-agent", "factory:needs-input"],
  },
];

test("renames former labels in place, so their issues keep them, and leaves split ones alone", (t) => {
  for (const profile of ["standard", "factory"]) {
    const scenario = setup(t, {
      state: {
        labels: structuredClone(formerLabels),
        issues: structuredClone(formerIssues),
      },
    });
    const outcome = scenario.invoke({ profile, overwriteAllowed: false });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, "changed");
    assert.match(outcome.result.message, /renamed 5 labels/);
    const { labels, issues, mutationLog } = scenario.readState();
    for (const name of ["needs-info", "factory:needs-input"])
      assert.deepEqual(
        labels.find((label) => label.name === name),
        formerLabels.find((label) => label.name === name),
      );
    for (const desired of canonicalLabels)
      assert.deepEqual(
        labels.find(({ name }) => name === desired.name),
        desired,
      );
    assert.equal(
      labels.length,
      canonicalLabels.length +
        2 +
        (profile === "factory" ? factoryLabels.length : 0),
    );
    assert.equal(
      mutationLog.filter((action) => action === "update label").length,
      5,
    );
    assert.deepEqual(issues, [
      { number: 1, labels: ["type:enhancement", "state:ready", "model:x"] },
      { number: 2, labels: ["type:bug", "state:triage"] },
      { number: 3, labels: ["type:enhancement", "state:owner"] },
      { number: 4, labels: ["type:bug", "needs-info"] },
      {
        number: 5,
        labels: ["type:enhancement", "state:ready", "factory:needs-input"],
      },
    ]);
    assert.equal(scenario.invoke({ profile }).result.status, "unchanged");
  }
});

test("asks before renaming a former label the repository changed", (t) => {
  const chosen = {
    name: "ready-for-agent",
    color: "000000",
    description: "Our own readiness",
  };
  const scenario = setup(t, {
    state: { labels: [chosen], issues: [{ number: 1, labels: [chosen.name] }] },
  });
  const confirmation = scenario.invoke();
  assert.equal(confirmation.result.status, "confirmation-required");
  for (const value of ["ready-for-agent", "state:ready", "Our own readiness"])
    assert.ok(confirmation.result.message.includes(value), value);
  assert.equal(scenario.readState().mutations ?? 0, 0);

  const confirmed = scenario.invoke({ overwriteAllowed: true });
  assert.equal(confirmed.result.status, "changed");
  assert.match(
    confirmed.result.message,
    /renamed ready-for-agent to state:ready/,
  );
  assert.deepEqual(scenario.readState().issues, [
    { number: 1, labels: ["state:ready"] },
  ]);
});

test("keeps a successor that already exists and leaves its former label alone", (t) => {
  const former = formerLabels.find(({ name }) => name === "ready-for-agent");
  const scenario = setup(t, {
    state: { labels: [...structuredClone(canonicalLabels), former] },
  });
  const outcome = scenario.invoke();
  assert.equal(outcome.result.status, "unchanged");
  assert.deepEqual(scenario.readState().labels, [...canonicalLabels, former]);
});

test("factory setup updates factory labels still at the factory's own values without confirmation", (t) => {
  const created = ["running", "paused", "failed"].map((role) => ({
    ...factoryLabels.find(({ name }) => name === `factory:${role}`),
    description: `Factory state: ${role}`,
  }));
  const scenario = setup(t, {
    state: { labels: [...structuredClone(canonicalLabels), ...created] },
  });
  const outcome = scenario.invoke({ profile: "factory" });
  assert.equal(outcome.result.status, "changed");
  assert.match(outcome.result.message, /updated 3 labels/);
  for (const desired of factoryLabels)
    assert.deepEqual(
      scenario.readState().labels.find(({ name }) => name === desired.name),
      desired,
    );
});
