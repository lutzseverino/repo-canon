import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  fixture,
  invokeCheck,
  retainedCheck,
  snapshot,
} from "./helpers/operation.mjs";

const target = ".github/factory-model-policy.json";
const base = { version: 1, fallback: "wait", runKinds: {} };
const explicit = { provider: "provider-a", model: "model-a" };
const label = { source: "issue-label" };
const request = {
  profile: "factory",
  operation: {
    declaration: "factory-workflow",
    phase: "checks",
    id: "factory-model-policy",
  },
  allowedTargets: { paths: [], directories: [] },
};

function check(t, value, executable) {
  const project = fixture(
    value === undefined
      ? {}
      : {
          [target]:
            typeof value === "string"
              ? value
              : JSON.stringify(value, null, 2) + "\n",
        },
  );
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(executable, project.root, request);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(
    snapshot(project.root),
    before,
    "check preserves policy bytes and all files",
  );
  return outcome.result;
}

test("optional model policy uses only retained resources and preserves configured and absent files", (t) => {
  const executable = retainedCheck(
    t,
    "operations/check-factory-model-policy.mjs",
  );
  assert.match(
    check(t, undefined, executable).message,
    /No factory model policy/,
  );
  for (const fallback of ["wait", "host-default"]) {
    for (const selection of [
      explicit,
      { ...explicit, effort: "custom-effort" },
      label,
    ]) {
      for (const runKinds of [
        {},
        { implement: {} },
        { triage: selection },
        { review: selection },
        { implement: { initial: selection } },
        { implement: { retry: selection } },
        {
          triage: selection,
          implement: { initial: selection, retry: selection },
          review: selection,
        },
      ]) {
        const outcome = check(t, { ...base, fallback, runKinds }, executable);
        assert.equal(outcome.status, "passed", outcome.message);
      }
    }
  }
});

test("invalid policy structure fails with an actionable path without modifying it", (t) => {
  const executable = retainedCheck(
    t,
    "operations/check-factory-model-policy.mjs",
  );
  const invalid = [
    "{",
    "null",
    "[]",
    '"text"',
    "true",
    "1",
    {},
    { fallback: "wait", runKinds: {} },
    { ...base, version: 2 },
    { ...base, version: "1" },
    { version: 1, runKinds: {} },
    { ...base, fallback: "other" },
    { ...base, fallback: null },
    { version: 1, fallback: "wait" },
    { ...base, extra: true },
  ];
  for (const runKinds of [
    null,
    [],
    true,
    "triage",
    { unknown: {} },
    { implement: null },
    { implement: [] },
    { implement: { unknown: label } },
    { implement: explicit },
  ])
    invalid.push({ ...base, runKinds });
  for (const selection of [
    null,
    [],
    true,
    "model",
    {},
    { provider: "a" },
    { model: "b" },
    { ...explicit, extra: true },
    { source: "other" },
    { ...label, ...explicit },
    { ...label, effort: "high" },
  ]) {
    for (const runKinds of [
      { triage: selection },
      { review: selection },
      { implement: { initial: selection } },
      { implement: { retry: selection } },
    ])
      invalid.push({ ...base, runKinds });
  }
  for (const key of ["provider", "model", "effort"]) {
    for (const value of [
      null,
      1,
      false,
      {},
      [],
      "",
      " ",
      " untrimmed",
      "untrimmed ",
    ])
      invalid.push({
        ...base,
        runKinds: { review: { ...explicit, [key]: value } },
      });
  }
  for (const value of invalid) {
    const outcome = check(t, value, executable);
    assert.equal(outcome.status, "failed", JSON.stringify(value));
    assert.ok(
      outcome.message.startsWith(
        `Correct ${target} to match the factory-workflow rules: `,
      ),
      outcome.message,
    );
    assert.equal(outcome.message.split(target).length - 1, 1);
  }
});

test("unreadable present policy fails explicitly", (t) => {
  const executable = retainedCheck(
    t,
    "operations/check-factory-model-policy.mjs",
  );
  const project = fixture({});
  t.after(project.close);
  mkdirSync(join(project.root, target), { recursive: true });
  const before = snapshot(project.root);
  const outcome = invokeCheck(executable, project.root, request);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(
    outcome.result.message,
    /Correct .*factory-model-policy.json.*cannot read file.*EISDIR/,
  );
  assert.deepEqual(snapshot(project.root), before);
});
