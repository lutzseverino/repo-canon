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
// Postern-backed transport fixture as its fix.
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
  test(`${probe.name} gives stable neutral diagnostics for non-HTTP failures across probes and fixes`, (t) => {
    const scenario = probeScenario(t, probe);
    const expected = `${probe.name} could not verify acme/widgets; retry after investigating the failure. For full details, run gh api --hostname github.com repos/acme/widgets.`;
    for (const repositoryError of [
      "dial tcp 10.20.30.40:443: i/o timeout (at 12345)",
      "proxyconnect tcp: dial tcp 10.90.80.70:3128: connection refused (at 67890)",
      "gh failed for fixture-account via host-one.invalid (trace 12345)",
      "gh failed for another-account via host-two.invalid (trace 67890)",
    ]) {
      scenario.updateState({ repositoryError });
      assertProbe(
        scenario.invoke({}, { GH_HOST: "enterprise.example" }),
        "not-ready",
        expected,
      );
      const fix = setup(t, probe.fix, { state: { repositoryError } });
      fix.before = snapshot(fix.project.root);
      assertProbe(
        fix.invoke({}, { GH_HOST: "enterprise.example" }),
        "blocked",
        expected,
      );
      assertNoWrites(fix);
    }
    assertNoWrites(scenario);
  });

  test(`${probe.name} gives neutral diagnostics for transport timeouts without mutation`, (t) => {
    const state = {
      failure: {
        at: "repository",
        transport: true,
        message: "request timeout at fixture-host",
      },
    };
    const scenario = probeScenario(t, probe, { state });
    const fix = setup(t, probe.fix, { state });
    fix.before = snapshot(fix.project.root);
    const expected = `${probe.name} could not verify acme/widgets; retry after investigating the failure. For full details, run gh api --hostname github.com repos/acme/widgets.`;
    assertProbe(scenario.invoke(), "not-ready", expected);
    assertProbe(fix.invoke(), "blocked", expected);
    assertNoWrites(scenario);
    assertNoWrites(fix);
  });

  test(`${probe.name} pins stable HTTP failure diagnostics to github.com in probes and fixes`, async (t) => {
    for (const { error, status, next } of [
      {
        error: "gh: Not Found (HTTP 404)",
        status: 404,
        next: "Confirm the repository exists and the signed-in gh account can read it.",
      },
      {
        error: "gh: Bad credentials (HTTP 401)",
        status: 401,
        next: "Sign in again with gh auth login --hostname github.com.",
      },
      {
        error: "gh: API rate limit exceeded for fixture-account (HTTP 403)",
        status: 403,
        next: "Retry after the GitHub API rate limit resets.",
      },
      {
        error: "gh: Too Many Requests (HTTP 429)",
        status: 429,
        next: "Retry after the GitHub API rate limit resets.",
      },
      {
        error: "gh: Server Error (HTTP 503)",
        status: 503,
        next: "Retry later.",
      },
      {
        error: "gh: Resource not accessible by integration (HTTP 403)",
        status: 403,
        next: "Retry later.",
      },
    ]) {
      await t.test(error, (st) => {
        const scenario = probeScenario(st, probe);
        const fix = setup(st, probe.fix);
        fix.before = snapshot(fix.project.root);
        const expected = `${probe.name} could not verify acme/widgets: GitHub returned HTTP ${status}. ${next} For full details, run gh api --hostname github.com repos/acme/widgets.`;
        for (const detail of [
          "trace at 12345 via proxy-one.invalid:3128",
          "trace at 67890 via rate-limit-proxy.invalid:8080 (HTTP 401)",
        ]) {
          const repositoryError = `${detail}\n${error}`;
          scenario.updateState({ repositoryError });
          fix.updateState({ repositoryError });
          assertProbe(
            scenario.invoke({}, { GH_HOST: "enterprise.example" }),
            "not-ready",
            expected,
          );
          assertProbe(
            fix.invoke({}, { GH_HOST: "enterprise.example" }),
            "blocked",
            expected,
          );
        }
        assertNoWrites(scenario);
        assertNoWrites(fix);
      });
    }
  });

  test(`${probe.name} preserves the invalid JSON reason in probes and fixes`, (t) => {
    const state = { repositoryResponse: "unparseable response from proxy" };
    const scenario = probeScenario(t, probe, { state });
    const fix = setup(t, probe.fix, { state });
    fix.before = snapshot(fix.project.root);
    const expected = `${probe.name} could not verify acme/widgets; repository access is incomplete (invalid JSON response). For full details, run gh api --hostname github.com repos/acme/widgets.`;
    assertProbe(scenario.invoke(), "not-ready", expected);
    assertProbe(fix.invoke(), "blocked", expected);
    assertNoWrites(scenario);
    assertNoWrites(fix);
  });

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
    assertProbe(
      scenario.invoke({}, { GH_HOST: "enterprise.example" }),
      "ready",
      ready,
    );
    assertProbe(
      scenario.invoke({}, { GH_HOST: "enterprise.example" }),
      "ready",
      ready,
    );
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
