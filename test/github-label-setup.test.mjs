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
  { name: "wontfix", color: "ffffff", description: "Will not be actioned" },
  { name: "bug", color: "d73a4a", description: "Something isn't working" },
  {
    name: "enhancement",
    color: "a2eeef",
    description: "New feature or request",
  },
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

function setup(t, options) {
  return githubSetup(t, githubLabelSetup, options);
}

const factorySkip = {
  name: "factory:skip",
  color: "c5def5",
  description: "Ready agent work the factory must not pick up",
};

test("factory setup provisions and verifies skip, preserves unrelated labels and is repeat-safe", (t) => {
  const unrelated = {
    name: "factory:running",
    color: "0052cc",
    description: "Claimed by a factory run",
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
  assert.match(outcome.result.message, /created factory:skip/);
  assert.match(
    outcome.result.message,
    /Readback confirmed all 13 canonical labels/,
  );
  assert.deepEqual(scenario.readState().labels, [
    ...canonicalLabels,
    unrelated,
    factorySkip,
  ]);
  assert.equal(scenario.readState().labelReads, 2);
  assert.equal(
    scenario.invoke({ profile: "factory" }).result.status,
    "unchanged",
  );
  assert.equal(scenario.readState().mutations, 1);
  assertProjectUnchanged(before, scenario);
});

test("factory setup confirms skip drift before any writes and blocks on mismatched skip readback", (t) => {
  const driftedSkip = { ...factorySkip, color: "000000" };
  const scenario = setup(t, {
    state: { labels: [driftedSkip], readbackMismatch: true },
  });
  const confirmation = scenario.invoke({ profile: "factory" });
  assert.equal(confirmation.status, 0, confirmation.stderr);
  assert.equal(confirmation.result.status, "confirmation-required");
  assert.match(confirmation.result.message, /factory:skip.color/);
  assert.equal(scenario.readState().mutations ?? 0, 0);
  assert.deepEqual(scenario.readState().labels, [driftedSkip]);

  // Reset the simulated readback failure so it occurs on the confirmed run's
  // final read, after the initial inspection.
  scenario.updateState({ labelReads: 0 });
  const confirmed = scenario.invoke({
    profile: "factory",
    overwriteAllowed: true,
  });
  assert.equal(confirmed.status, 0, confirmed.stderr);
  assert.equal(confirmed.result.status, "blocked");
  assert.match(confirmed.result.message, /readback did not match factory:skip/);
  assert.match(confirmed.result.message, /updated factory:skip/);
  assert.deepEqual(scenario.readState().labels, [
    factorySkip,
    ...canonicalLabels,
  ]);
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
  assert.equal(scenario.readState().mutations, 12);
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
// leaves all existing factory labels alone, including skip.
test("standard setup creates no factory label and leaves existing factory labels in place", (t) => {
  const empty = setup(t);
  const created = empty.invoke();
  assert.equal(created.status, 0, created.stderr);
  assert.deepEqual(
    empty.readState().labels.filter(({ name }) => name.startsWith("factory:")),
    [],
  );

  const factoryLabels = [
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
  ];
  const scenario = setup(t, {
    state: { labels: [...structuredClone(canonicalLabels), ...factoryLabels] },
  });
  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "unchanged");
  assert.deepEqual(scenario.readState().labels, [
    ...canonicalLabels,
    ...factoryLabels,
  ]);
  assert.equal(scenario.readState().mutations ?? 0, 0);
});

test("reconciles conflicting desired label values without replacing unrelated labels", (t) => {
  const labels = structuredClone(canonicalLabels);
  labels[0] = {
    name: "Needs-Triage",
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
    `GitHub label setup changed acme/widgets: updated needs-triage. Readback confirmed all ${canonicalLabels.length} canonical labels; unrelated labels were preserved.`,
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
  assert.match(first.result.message, /created needs-triage/);
  assert.match(first.result.message, /11 labels remain/);
  assert.equal(scenario.readState().labels.length, 1);

  const retry = scenario.invoke();
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.result.status, "changed");
  assert.match(retry.result.message, /created 11 labels/);
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
  assert.match(retry.result.message, /created 11 labels/);
  assert.deepEqual(scenario.readState().labels, canonicalLabels);
});

test("blocks when readback disagrees and reports the changes already applied", (t) => {
  const scenario = setup(t, { state: { readbackMismatch: true } });
  const outcome = scenario.invoke();

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "blocked");
  assert.match(outcome.result.message, /created 12 labels/);
  assert.match(outcome.result.message, /readback did not match/);
  assert.deepEqual(scenario.readState().labels, canonicalLabels);
});

test("asks before updating drifted labels and creates nothing until confirmed", (t) => {
  const labels = [
    { ...canonicalLabels[0], color: "000000", description: "Custom meaning" },
    { ...canonicalLabels[1], description: "Custom needs-info" },
  ];
  const scenario = setup(t, { state: { labels } });
  const before = snapshot(scenario.project.root);
  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "confirmation-required");
  for (const value of [
    "needs-triage",
    "000000",
    "fbca04",
    "Custom meaning",
    canonicalLabels[0].description,
    "needs-info",
    "Custom needs-info",
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
  assert.match(outcome.result.message, /created 11 labels/);
  assert.deepEqual(
    scenario.readState().labels.find(({ name }) => name === "wontfix"),
    canonicalLabels[4],
  );
  assert.equal(scenario.readState().labels.length, canonicalLabels.length);
});

test("asks about a label that differs from both the standard and GitHub's stock values", (t) => {
  for (const labels of [
    [{ ...canonicalLabels[4], description: "Closed without a fix" }],
    [
      {
        ...canonicalLabels[4],
        color: "000000",
        description: "This will not be worked on",
      },
    ],
    [
      {
        ...canonicalLabels[4],
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
