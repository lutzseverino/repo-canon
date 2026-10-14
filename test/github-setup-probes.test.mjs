import assert from "node:assert/strict";
import { rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  assertProjectUnchanged,
  githubLabelSetup,
  githubPrIntegrationSetup,
  setup,
} from "./helpers/github-setup.mjs";
import { retainedCheck, snapshot } from "./helpers/operation.mjs";

// Each remote setup fix's readiness probe, run from a copy holding only the
// resources `standards.yaml` declares for it, against the same stateful
// GitHub CLI fixture as its fix.
const probes = [
  {
    name: "GitHub label setup",
    script: "operations/probe-github-labels.mjs",
    fix: githubLabelSetup,
    access: "write, maintain, or admin access",
    insufficient: {
      admin: false,
      maintain: false,
      push: false,
      triage: true,
      pull: true,
    },
    sufficient: {
      admin: false,
      maintain: false,
      push: true,
      triage: true,
      pull: true,
    },
  },
  {
    name: "GitHub PR integration setup",
    script: "operations/probe-github-pr-integration.mjs",
    fix: githubPrIntegrationSetup,
    access: "admin access",
    purpose: " to manage repository rules and merge settings",
    insufficient: {
      admin: false,
      maintain: true,
      push: true,
      triage: true,
      pull: true,
    },
    sufficient: {
      admin: true,
      maintain: true,
      push: true,
      triage: true,
      pull: true,
    },
  },
];

function probeScenario(t, probe, options = {}) {
  const scenario = setup(
    t,
    {
      ...probe.fix,
      script: retainedCheck(t, probe.script),
      operation: { ...probe.fix.operation, phase: "probes" },
    },
    options,
  );
  return { ...scenario, before: snapshot(scenario.project.root) };
}

// A probe writes nothing: no project content changes, and every call it makes
// to the GitHub API is a read.
function assertNoWrites(scenario) {
  assertProjectUnchanged(scenario.before, scenario);
  const state = scenario.readState();
  assert.equal(state.mutations ?? 0, 0);
  for (const request of state.requests ?? [])
    assert.match(request, /^GET /, request);
}

function assertProbe(outcome, status, message) {
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(outcome.result, {
    format: "repo-standards/result/v2",
    status,
    message,
  });
}

for (const probe of probes) {
  test(`${probe.name} probe reports not-ready with an actionable reason and writes nothing`, async (t) => {
    await t.test("missing gh", (st) => {
      const scenario = probeScenario(st, probe);
      rmSync(join(scenario.toolsRoot, "gh"));
      symlinkSync("/usr/bin/git", join(scenario.toolsRoot, "git"));
      const outcome = scenario.invoke({}, { PATH: scenario.toolsRoot });
      assertProbe(
        outcome,
        "not-ready",
        `GitHub CLI (gh) is unavailable; install gh 2.57.0 or newer before ${probe.name}.`,
      );
      assertNoWrites(scenario);
    });

    await t.test("ambiguous remote", (st) => {
      const scenario = probeScenario(st, probe, {
        remotes: {
          origin: "https://github.com/acme/widgets.git",
          upstream: "git@github.com:other/widgets.git",
        },
      });
      assertProbe(
        scenario.invoke(),
        "not-ready",
        "Multiple github.com repositories were found in Git remotes (acme/widgets, other/widgets); resolve the target before setup.",
      );
      assert.deepEqual(scenario.readState().apiHosts ?? [], []);
      assertNoWrites(scenario);
    });

    await t.test("no authentication", (st) => {
      const scenario = probeScenario(st, probe, {
        state: { authenticated: false },
      });
      assertProbe(
        scenario.invoke(),
        "not-ready",
        `${probe.name} requires authenticated github.com access through gh; sign in with gh auth login --hostname github.com.`,
      );
      assert.deepEqual(scenario.readState().apiHosts ?? [], []);
      assertNoWrites(scenario);
    });

    await t.test("insufficient role", (st) => {
      const scenario = probeScenario(st, probe, {
        state: { permissions: probe.insufficient },
      });
      assertProbe(
        scenario.invoke(),
        "not-ready",
        `${probe.name} requires ${probe.access} to acme/widgets${probe.purpose ?? ""}.`,
      );
      assertNoWrites(scenario);
    });
  });

  test(`${probe.name} probe reports ready for a sufficient role, repeatably and without writes`, (t) => {
    const scenario = probeScenario(t, probe, {
      state: { permissions: probe.sufficient },
    });
    const ready = `${probe.name} can run for acme/widgets with ${probe.access}.`;
    assertProbe(scenario.invoke(), "ready", ready);
    assertProbe(scenario.invoke(), "ready", ready);
    assert.deepEqual(
      [...new Set(scenario.readState().apiHosts)],
      ["github.com"],
    );
    assertNoWrites(scenario);
  });

  test(`${probe.name} probe runs only as a probe`, (t) => {
    const scenario = probeScenario(t, probe);
    for (const overrides of [
      { operation: { ...probe.fix.operation, phase: "fixes" } },
      { format: "repo-standards/operation/v1" },
      { allowedTargets: { paths: ["README.md"], directories: [] } },
    ]) {
      const invalid = scenario.invoke(overrides);
      assert.equal(invalid.status, 1);
      assert.equal(invalid.result, null);
      assert.match(invalid.stderr, new RegExp(probe.name));
    }
    assertNoWrites(scenario);
  });
}
