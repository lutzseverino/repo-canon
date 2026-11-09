import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  parseRequiredChecks,
  requiredCheckStates,
  requiredChecksTarget,
} from "../.agents/skills/babysit/required-checks.mjs";
import { declarations } from "../scripts/standards-declarations.mjs";
import {
  fixture,
  invokeCheck,
  retainedCheck,
  snapshot,
} from "./helpers/operation.mjs";

const valid = { version: 1, checks: ["PR metadata", "CI / Required"] };
const script = new URL(
  "../operations/check-required-checks.mjs",
  import.meta.url,
).pathname;
test("one schema validates JSON, shape, version, list and entries with named diagnostics", () => {
  assert.deepEqual(parseRequiredChecks(JSON.stringify(valid)), valid.checks);
  for (const [value, field] of [
    ["{", "JSON"],
    ["null", "root"],
    ["[]", "root"],
    ["1", "root"],
    ['{"checks":["Test"]}', "version"],
    ...["1", 2, null, false].map((version) => [
      JSON.stringify({ ...valid, version }),
      "version",
    ]),
    ...[undefined, [], "Test", null, {}].map((checks) => [
      JSON.stringify({ ...valid, checks }),
      "checks",
    ]),
    ...["", " ", 2, null, {}, []].map((entry) => [
      JSON.stringify({ ...valid, checks: ["Test", entry] }),
      "checks[1]",
    ]),
  ]) {
    assert.throws(
      () => parseRequiredChecks(value),
      (error) =>
        error instanceof Error &&
        error.message.includes(requiredChecksTarget) &&
        error.message.includes(field),
    );
  }
});

test("read-only check works from retained resources and never supplies repository names", (t) => {
  const retained = retainedCheck(t, "operations/check-required-checks.mjs");
  for (const executable of [script, retained]) {
    for (const content of [
      undefined,
      "{",
      JSON.stringify({ ...valid, checks: [] }),
      JSON.stringify(valid),
    ]) {
      const project = fixture(
        content === undefined ? {} : { [requiredChecksTarget]: content },
      );
      t.after(project.close);
      const before = snapshot(project.root);
      const result = invokeCheck(executable, project.root);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        result.result.status,
        content === JSON.stringify(valid) ? "passed" : "failed",
      );
      assert.match(result.result.message, /required-checks\.json/);
      assert.deepEqual(snapshot(project.root), before);
    }
  }
  const root = new URL("..", import.meta.url).pathname;
  assert.ok(
    !Object.values(declarations(root))
      .flat()
      .some(({ target }) => target === requiredChecksTarget),
  );
  assert.deepEqual(
    parseRequiredChecks(
      readFileSync(
        new URL("../.github/required-checks.json", import.meta.url),
        "utf8",
      ),
    ),
    ["PR metadata", "Test"],
  );
});

const status = (state = "SUCCESS", createdAt = "2026-11-09T10:00:00Z") => ({
  __typename: "StatusContext",
  context: "Test",
  state,
  createdAt,
});
const run = (conclusion = "SUCCESS", startedAt = "2026-11-09T10:00:00Z") => ({
  __typename: "CheckRun",
  name: "Test",
  status: "COMPLETED",
  conclusion,
  startedAt,
});
test("exact names require positive success from both check runs and statuses", () => {
  for (const result of [status(), run()])
    assert.equal(requiredCheckStates([result], ["Test"])[0].state, "pass");
  for (const conclusion of [
    "FAILURE",
    "CANCELLED",
    "TIMED_OUT",
    "SKIPPED",
    "NEUTRAL",
  ])
    assert.equal(
      requiredCheckStates([run(conclusion)], ["Test"])[0].state,
      "fail",
    );
  for (const state of ["FAILURE", "ERROR"])
    assert.equal(
      requiredCheckStates([status(state)], ["Test"])[0].state,
      "fail",
    );
  for (const name of ["test", "Test ", "Test / Required", "Other"])
    assert.equal(
      requiredCheckStates([run(), status()], [name])[0].state,
      "pending",
    );
  assert.equal(
    requiredCheckStates([status("PENDING")], ["Test"])[0].state,
    "pending",
  );
  assert.equal(
    requiredCheckStates([run(), status("FAILURE")], ["Test"]).at(-1).state,
    "fail",
  );
});

test("new attempts supersede old successes, in either order, and ambiguous evidence fails closed", () => {
  for (const make of [status, run]) {
    for (const state of ["FAILURE", "PENDING"]) {
      const later = make(state, "2026-11-09T11:00:00Z");
      if (make === run && state === "PENDING") later.status = "IN_PROGRESS";
      for (const values of [
        [make(), later],
        [later, make()],
      ])
        assert.notEqual(requiredCheckStates(values, ["Test"])[0].state, "pass");
    }
    assert.equal(
      requiredCheckStates(
        [make(), make("FAILURE", "2026-11-09T09:00:00Z")],
        ["Test"],
      )[0].state,
      "pass",
    );
    for (const values of [
      [make(), make("FAILURE")],
      [make("FAILURE"), make()],
    ])
      assert.equal(requiredCheckStates(values, ["Test"])[0].state, "fail");
  }
  assert.throws(
    () =>
      requiredCheckStates(
        [status(), { ...status(), createdAt: null }],
        ["Test"],
      ),
    /Ambiguous.*Test/,
  );
  const check = {
    ...run(),
    workflowName: "CI",
    detailsUrl: "https://github.com/x/y/actions/runs/1/job/2",
  };
  const attempt = {
    workflow_id: 1,
    name: "CI",
    html_url: "https://github.com/x/y/actions/runs/1",
    run_started_at: "2026-11-09T11:00:00Z",
    status: "completed",
    conclusion: "success",
  };
  assert.equal(
    requiredCheckStates([check], ["Test"], [attempt])[0].state,
    "pending",
  );
});
