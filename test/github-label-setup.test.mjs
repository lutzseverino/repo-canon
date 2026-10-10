import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertProjectUnchanged,
  githubLabelSetup,
  setup as githubSetup,
} from "./helpers/github-setup.mjs";
import { snapshot } from "./helpers/operation.mjs";

const canonicalLabels = [
  {
    name: "needs-triage",
    color: "fbca04",
    description: "Requires review or renewed review",
  },
  {
    name: "needs-info",
    color: "d4c5f9",
    description: "Waiting for information needed to evaluate the request",
  },
  {
    name: "ready-for-agent",
    color: "0e8a16",
    description: "Reviewed and sufficiently specified for agent implementation",
  },
  {
    name: "ready-for-human",
    color: "1d76db",
    description: "Reviewed and requires human implementation",
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
  {
    name: "factory:running",
    color: "0052cc",
    description: "Claimed by a factory run",
  },
  {
    name: "factory:failed",
    color: "b60205",
    description: "The factory run failed; remove to run it again",
  },
  {
    name: "run:orchestrated",
    color: "c5def5",
    description: "The factory runs an orchestrator over this ticket",
  },
];

function setup(t, options) {
  return githubSetup(t, githubLabelSetup, options);
}

test("provisions every canonical label in an empty repository and is unchanged on repeat", (t) => {
  const scenario = setup(t);
  const before = snapshot(scenario.project.root);
  const outcome = scenario.invoke();

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "changed");
  assert.match(outcome.result.message, /created 15 labels/);
  assert.deepEqual(scenario.readState().labels, canonicalLabels);
  assertProjectUnchanged(before, scenario);

  const repeat = scenario.invoke();
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.equal(repeat.result.status, "unchanged");
  assert.equal(scenario.readState().mutations, 15);
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
  assert.match(outcome.result.message, /updated needs-triage/);
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
    /could not inspect labels for acme\/widgets \(exit 1: gh: Resource not accessible by integration \(HTTP 403\)\)/,
  );
  assert.equal(scenario.readState().mutations ?? 0, 0);
});

test("reports partial effects and completes missing work after a transient API failure", (t) => {
  const scenario = setup(t, { state: { failAtMutation: 2 } });
  const first = scenario.invoke();

  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.result.status, "blocked");
  assert.match(first.result.message, /created needs-triage/);
  assert.match(first.result.message, /14 labels remain/);
  assert.equal(scenario.readState().labels.length, 1);

  const retry = scenario.invoke();
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.result.status, "changed");
  assert.match(retry.result.message, /created 14 labels/);
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
  assert.match(retry.result.message, /created 14 labels/);
  assert.deepEqual(scenario.readState().labels, canonicalLabels);
});

test("blocks when readback disagrees and reports the changes already applied", (t) => {
  const scenario = setup(t, { state: { readbackMismatch: true } });
  const outcome = scenario.invoke();

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "blocked");
  assert.match(outcome.result.message, /created 15 labels/);
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

test("treats hexadecimal colour casing as matching without confirmation", (t) => {
  const labels = canonicalLabels.map((label) => ({
    ...label,
    color: label.color.toUpperCase(),
  }));
  const scenario = setup(t, { state: { labels } });
  assert.equal(scenario.invoke().result.status, "unchanged");
  assert.equal(scenario.readState().mutations ?? 0, 0);
});
