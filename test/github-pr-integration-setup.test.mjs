import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertProjectUnchanged,
  githubPrIntegrationSetup,
  setup as githubSetup,
} from "./helpers/github-setup.mjs";
import { snapshot } from "./helpers/operation.mjs";

const checkName = "PR metadata";
const rulesetName = "Repo Canon required PR checks";

const matchingSettings = {
  allow_squash_merge: true,
  allow_merge_commit: false,
  allow_rebase_merge: false,
  squash_merge_commit_title: "PR_TITLE",
  squash_merge_commit_message: "PR_BODY",
};

function canonicalRuleset(overrides = {}) {
  return {
    id: 50,
    name: rulesetName,
    target: "branch",
    enforcement: "active",
    bypass_actors: [],
    conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
    rules: [
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: false,
          required_status_checks: [{ context: checkName }],
        },
      },
    ],
    ...overrides,
  };
}

function classicProtection(statusChecks, overrides = {}) {
  return {
    url: "https://api.github.com/repos/acme/widgets/branches/main/protection",
    required_status_checks: statusChecks,
    enforce_admins: { enabled: true },
    required_pull_request_reviews: { required_approving_review_count: 2 },
    allow_force_pushes: { enabled: false },
    ...overrides,
  };
}

function setup(t, options) {
  return githubSetup(t, githubPrIntegrationSetup, options);
}

test("creates required-check enforcement, configures squash defaults, and is unchanged on repeat", (t) => {
  const scenario = setup(t);
  const before = snapshot(scenario.project.root);
  const first = scenario.invoke();

  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.result.status, "changed");
  assert.match(first.result.message, /created required-check ruleset/);
  assert.match(first.result.message, /updated squash merge settings/);
  const state = scenario.readState();
  assert.deepEqual(state.settings, {
    ...matchingSettings,
    delete_branch_on_merge: true,
  });
  assert.deepEqual(state.rulesets, [canonicalRuleset({ id: 100 })]);
  assertProjectUnchanged(before, scenario);

  const repeat = scenario.invoke();
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.equal(repeat.result.status, "unchanged");
  assert.equal(scenario.readState().mutations, 2);
  assertProjectUnchanged(before, scenario);
});

test("uses rulesets when classic protection is present but required checks are disabled", async (t) => {
  const protectionWithoutChecks = {
    url: "https://api.github.com/repos/acme/widgets/branches/main/protection",
    enforce_admins: { enabled: true },
    required_pull_request_reviews: { required_approving_review_count: 2 },
    allow_force_pushes: { enabled: false },
  };

  await t.test(
    "creates fallback enforcement and preserves classic policy",
    (st) => {
      const scenario = setup(st, {
        state: { branchProtection: protectionWithoutChecks },
      });
      const outcome = scenario.invoke();
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "changed");
      assert.match(outcome.result.message, /created required-check ruleset/);
      assert.deepEqual(
        scenario.readState().branchProtection,
        protectionWithoutChecks,
      );
      assert.deepEqual(scenario.readState().rulesets, [
        canonicalRuleset({ id: 100 }),
      ]);
    },
  );

  await t.test(
    "accepts active applicable ruleset enforcement as unchanged",
    (st) => {
      const scenario = setup(st, {
        state: {
          settings: matchingSettings,
          branchProtection: protectionWithoutChecks,
          rulesets: [canonicalRuleset()],
        },
      });
      const outcome = scenario.invoke();
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "unchanged");
      assert.equal(scenario.readState().mutations ?? 0, 0);
      assert.deepEqual(
        scenario.readState().branchProtection,
        protectionWithoutChecks,
      );
    },
  );
});

test("returns unchanged when branch protection and merge settings already match", (t) => {
  const unrelatedRuleset = {
    id: 7,
    name: "Require reviews",
    target: "branch",
    enforcement: "active",
    bypass_actors: [],
    conditions: { ref_name: { include: ["refs/heads/release"], exclude: [] } },
    rules: [
      {
        type: "pull_request",
        parameters: { required_approving_review_count: 2 },
      },
    ],
  };
  const scenario = setup(t, {
    state: {
      settings: { ...matchingSettings, web_commit_signoff_required: true },
      branchProtection: classicProtection({
        strict: true,
        contexts: ["build", checkName],
        checks: [{ context: "build", app_id: 123 }],
      }),
      rulesets: [unrelatedRuleset],
    },
  });

  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(outcome.result, {
    format: "repo-standards/result/v2",
    status: "unchanged",
    message:
      "GitHub PR integration already matches the canonical configuration for acme/widgets.",
  });
  assert.equal(scenario.readState().mutations ?? 0, 0);
  assert.deepEqual(scenario.readState().rulesets, [unrelatedRuleset]);
});

test("adds PR metadata to classic branch checks while preserving checks, rulesets, and settings", (t) => {
  const unrelatedRuleset = canonicalRuleset({
    id: 8,
    name: "Adopter security checks",
  });
  const scenario = setup(t, {
    state: {
      settings: { ...matchingSettings, allow_auto_merge: true },
      branchProtection: classicProtection({
        strict: true,
        contexts: ["build"],
        checks: [{ context: "security", app_id: 456 }],
      }),
      rulesets: [unrelatedRuleset],
    },
  });

  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "changed");
  assert.match(
    outcome.result.message,
    /required PR metadata through main branch protection/,
  );
  const state = scenario.readState();
  assert.deepEqual(state.branchProtection.required_status_checks, {
    strict: true,
    contexts: ["build", checkName],
    checks: [{ context: "security", app_id: 456 }],
  });
  assert.deepEqual(state.rulesets, [unrelatedRuleset]);
  assert.equal(state.settings.allow_auto_merge, true);
});

test("accepts GitHub classic status-check responses that omit the optional checks list", (t) => {
  const scenario = setup(t, {
    state: {
      settings: matchingSettings,
      branchProtection: classicProtection({
        strict: false,
        contexts: ["build"],
      }),
    },
  });

  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "changed");
  assert.deepEqual(
    scenario.readState().branchProtection.required_status_checks,
    {
      strict: false,
      contexts: ["build", checkName],
    },
  );
});

test("reconciles the dedicated ruleset and conflicting merge settings without removing adopter policy", (t) => {
  const managed = canonicalRuleset({
    enforcement: "evaluate",
    bypass_actors: [
      { actor_id: 5, actor_type: "Team", bypass_mode: "pull_request" },
    ],
    conditions: {
      ref_name: {
        include: ["refs/heads/release"],
        exclude: ["~DEFAULT_BRANCH", "refs/heads/legacy"],
      },
    },
    rules: [
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: true,
          do_not_enforce_on_create: true,
          required_status_checks: [
            { context: "adopter test", integration_id: 22 },
          ],
        },
      },
      { type: "non_fast_forward" },
    ],
  });
  const unrelated = canonicalRuleset({ id: 51, name: "Release policy" });
  const scenario = setup(t, {
    state: {
      rulesets: [managed, unrelated],
      settings: {
        allow_squash_merge: true,
        allow_merge_commit: false,
        allow_rebase_merge: true,
        squash_merge_commit_title: "COMMIT_OR_PR_TITLE",
        squash_merge_commit_message: "COMMIT_MESSAGES",
        delete_branch_on_merge: false,
      },
    },
  });

  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "changed");
  const state = scenario.readState();
  assert.deepEqual(
    state.rulesets[0],
    canonicalRuleset({
      enforcement: "active",
      bypass_actors: managed.bypass_actors,
      conditions: {
        ref_name: {
          include: ["refs/heads/release", "~DEFAULT_BRANCH"],
          exclude: ["refs/heads/legacy"],
        },
      },
      rules: [
        {
          type: "required_status_checks",
          parameters: {
            strict_required_status_checks_policy: true,
            do_not_enforce_on_create: true,
            required_status_checks: [
              { context: "adopter test", integration_id: 22 },
              { context: checkName },
            ],
          },
        },
        { type: "non_fast_forward" },
      ],
    }),
  );
  assert.deepEqual(state.rulesets[1], unrelated);
  assert.deepEqual(state.settings, {
    ...matchingSettings,
    delete_branch_on_merge: false,
  });
});

test("removes a concrete default-branch exclusion from the dedicated ruleset", (t) => {
  const managed = canonicalRuleset({
    conditions: {
      ref_name: {
        include: ["~DEFAULT_BRANCH"],
        exclude: ["refs/heads/main", "refs/heads/legacy"],
      },
    },
  });
  const scenario = setup(t, {
    state: {
      settings: matchingSettings,
      rulesets: [managed],
    },
  });

  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "changed");
  assert.deepEqual(
    scenario.readState().rulesets[0].conditions.ref_name.exclude,
    ["refs/heads/legacy"],
  );
});

test("removes a matching glob exclusion while preserving unrelated glob policy", (t) => {
  const managed = canonicalRuleset({
    conditions: {
      ref_name: {
        include: ["~DEFAULT_BRANCH"],
        exclude: ["refs/heads/*", "refs/heads/release/*"],
      },
    },
  });
  const scenario = setup(t, {
    state: { settings: matchingSettings, rulesets: [managed] },
  });

  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "changed");
  assert.deepEqual(
    scenario.readState().rulesets[0].conditions.ref_name.exclude,
    ["refs/heads/release/*"],
  );
});

test("accepts a direct default-branch include with an unrelated glob as unchanged", (t) => {
  const managed = canonicalRuleset({
    conditions: {
      ref_name: {
        include: ["refs/heads/main"],
        exclude: ["refs/heads/release/*"],
      },
    },
  });
  const scenario = setup(t, {
    state: { settings: matchingSettings, rulesets: [managed] },
  });

  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "unchanged");
  assert.equal(scenario.readState().mutations ?? 0, 0);
});

test("blocks when unsupported pattern syntax makes default-branch applicability ambiguous", (t) => {
  const managed = canonicalRuleset({
    conditions: {
      ref_name: {
        include: ["~DEFAULT_BRANCH"],
        exclude: ["refs/heads/[mr]ain"],
      },
    },
  });
  const scenario = setup(t, { state: { rulesets: [managed] } });

  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "blocked");
  assert.match(
    outcome.result.message,
    /applicability cannot be established safely/,
  );
  assert.equal(scenario.readState().mutations ?? 0, 0);
});

test("blocks without admin access or when rules cannot be inspected", async (t) => {
  await t.test("non-admin access", (st) => {
    const scenario = setup(st, {
      state: {
        permissions: {
          admin: false,
          maintain: true,
          push: true,
          triage: true,
          pull: true,
        },
      },
    });
    const outcome = scenario.invoke();
    assert.equal(outcome.result.status, "blocked");
    assert.match(outcome.result.message, /admin access/);
    assert.equal(scenario.readState().mutations ?? 0, 0);
  });
  await t.test("ruleset inspection failure", (st) => {
    const scenario = setup(st, { state: { failRulesetInspection: true } });
    const outcome = scenario.invoke();
    assert.equal(outcome.result.status, "blocked");
    assert.match(
      outcome.result.message,
      /could not inspect repository rulesets/,
    );
    assert.equal(scenario.readState().mutations ?? 0, 0);
  });
  await t.test("ambiguous branch-protection 404", (st) => {
    const scenario = setup(st, { state: { failBranchInspection: true } });
    const outcome = scenario.invoke();
    assert.equal(outcome.result.status, "blocked");
    assert.match(outcome.result.message, /could not inspect required checks/);
    assert.equal(scenario.readState().mutations ?? 0, 0);
  });
});

const planLimit =
  "Upgrade to GitHub Pro or make this repository public to enable this feature.";
const unavailableRequirement = new RegExp(
  [
    "matches what GitHub offers this repository: squash-only integration, PR-title subjects, and PR-body messages\\.",
    "Requiring `PR metadata` is unavailable because GitHub offers neither branch protection nor rulesets for this private repository on its current plan\\.",
    "Upgrade the plan or make the repository public; the next adoption or update then requires the check\\.",
  ].join(" "),
);

test("applies only merge settings when the plan offers neither branch protection nor rulesets", (t) => {
  const scenario = setup(t, {
    state: {
      private: true,
      forbidden: { protection: planLimit, rulesets: planLimit },
    },
  });
  const first = scenario.invoke();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.result.status, "changed");
  assert.match(first.result.message, /updated squash merge settings/);
  assert.match(first.result.message, unavailableRequirement);
  assert.doesNotMatch(first.result.message, /canonical configuration/);
  const state = scenario.readState();
  assert.deepEqual(state.mutationLog, ["update squash settings"]);
  assert.deepEqual(state.settings, {
    ...matchingSettings,
    delete_branch_on_merge: true,
  });
  assert.deepEqual(state.rulesets, []);
  assert.equal(state.branchProtection, null);
  assert.equal(state.branchReads, 1, "enforcement readback is skipped");

  const repeat = scenario.invoke();
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.equal(repeat.result.status, "unchanged");
  assert.match(repeat.result.message, unavailableRequirement);
  assert.equal(scenario.readState().mutations, 1);
  assert.equal(scenario.readState().branchReads, 2);
});

test("is unchanged when the plan offers no enforcement and merge settings already match", (t) => {
  const scenario = setup(t, {
    state: {
      private: true,
      settings: matchingSettings,
      forbidden: { protection: planLimit, rulesets: planLimit },
    },
  });
  for (const run of [scenario.invoke(), scenario.invoke()]) {
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.result.status, "unchanged");
    assert.match(
      run.result.message,
      /^GitHub PR integration for acme\/widgets matches what GitHub offers/,
    );
    assert.match(run.result.message, unavailableRequirement);
  }
  assert.equal(scenario.readState().mutations ?? 0, 0);
});

test("blocks with GitHub's reason unless both reads hit the plan limit on a private repository", async (t) => {
  for (const { name, state, message } of [
    {
      name: "only branch protection is plan-limited",
      state: { private: true, forbidden: { protection: planLimit } },
      message:
        /could not inspect required checks on main \(exit 1: gh: Upgrade to GitHub Pro .* \(HTTP 403\)\)/,
    },
    {
      name: "only rulesets are plan-limited",
      state: { private: true, forbidden: { rulesets: planLimit } },
      message:
        /could not inspect repository rulesets for acme\/widgets \(exit 1: gh: Upgrade to GitHub Pro .* \(HTTP 403\)\)/,
    },
    {
      name: "a public repository",
      state: { forbidden: { protection: planLimit, rulesets: planLimit } },
      message:
        /could not inspect required checks on main \(.*Upgrade to GitHub Pro/,
    },
    {
      name: "another 403",
      state: {
        private: true,
        forbidden: {
          protection: "Resource not accessible by integration",
          rulesets: "Resource not accessible by integration",
        },
      },
      message:
        /could not inspect required checks on main \(exit 1: gh: Resource not accessible by integration \(HTTP 403\)\)/,
    },
    {
      name: "a reworded plan limit",
      state: {
        private: true,
        forbidden: {
          protection: "This feature requires a paid plan.",
          rulesets: "This feature requires a paid plan.",
        },
      },
      message: /This feature requires a paid plan/,
    },
  ])
    await t.test(name, (st) => {
      const scenario = setup(st, { state });
      const outcome = scenario.invoke();
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "blocked");
      assert.match(outcome.result.message, message);
      assert.equal(scenario.readState().mutations ?? 0, 0);
    });
});

test("blocks with GitHub's reason when the merge-settings readback fails where the plan offers no enforcement", (t) => {
  const scenario = setup(t, {
    state: {
      private: true,
      failRepositoryReadback: true,
      forbidden: { protection: planLimit, rulesets: planLimit },
    },
  });
  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "blocked");
  assert.match(
    outcome.result.message,
    /final readback did not match squash merge settings \(exit 1: gh: Server Error \(HTTP 500\)\)\. Applied changes: updated squash merge settings\./,
  );
});

test("names Organisation plans in the recognised plan limit", (t) => {
  const teamLimit =
    "Upgrade to GitHub Team or make this repository public to enable this feature.";
  const scenario = setup(t, {
    state: {
      private: true,
      settings: matchingSettings,
      forbidden: { protection: teamLimit, rulesets: teamLimit },
    },
  });
  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "unchanged");
  assert.match(outcome.result.message, unavailableRequirement);
});

test("reports partial effects and retries only the missing squash change", (t) => {
  const scenario = setup(t, { state: { failAtMutation: 2 } });
  const first = scenario.invoke();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.result.status, "blocked");
  assert.match(
    first.result.message,
    /Confirmed partial effects: created required-check ruleset/,
  );
  assert.match(first.result.message, /squash merge settings remain/i);
  assert.equal(scenario.readState().rulesets.length, 1);

  const retry = scenario.invoke();
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.result.status, "changed");
  assert.match(retry.result.message, /updated squash merge settings/);
  assert.deepEqual(scenario.readState().mutationLog, [
    "create required-check ruleset",
    "update squash settings",
  ]);

  const repeat = scenario.invoke();
  assert.equal(repeat.result.status, "unchanged");
  assert.equal(scenario.readState().mutations, 2);
});

test("recovers after interruption by applying only the remaining change", (t) => {
  const scenario = setup(t, { state: { interruptAtMutation: 2 } });
  const interrupted = scenario.invoke();
  assert.equal(interrupted.status, null);
  assert.equal(interrupted.signal, "SIGKILL");
  assert.equal(scenario.readState().rulesets.length, 1);

  const retry = scenario.invoke();
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.result.status, "changed");
  assert.deepEqual(scenario.readState().mutationLog, [
    "create required-check ruleset",
    "update squash settings",
  ]);
});

test("blocks when final readback disagrees and reports applied effects", async (t) => {
  for (const mismatch of [
    "settings",
    "branch",
    "ruleset",
    "branch inspection",
  ]) {
    await t.test(mismatch, (st) => {
      const state =
        mismatch === "branch"
          ? {
              settings: matchingSettings,
              branchProtection: classicProtection({
                strict: true,
                contexts: ["build"],
                checks: [],
              }),
              readbackMismatch: mismatch,
            }
          : mismatch === "branch inspection"
            ? { failBranchReadback: true }
            : { readbackMismatch: mismatch };
      const scenario = setup(st, { state });
      const outcome = scenario.invoke();
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "blocked");
      assert.match(outcome.result.message, /final readback did not match/);
      assert.match(outcome.result.message, /Applied changes:/);
      if (mismatch === "branch inspection") {
        assert.match(
          outcome.result.message,
          /branch protection readback \(exit 1: gh: Not Found \(HTTP 404\)\)/,
        );
      }
    });
  }
});

const workflowRead =
  "GET repos/acme/widgets/contents/.github/workflows/pr-metadata.yml?ref=main";
const deferredRequirement = new RegExp(
  [
    "GitHub PR integration for acme/widgets applies squash-only integration, PR-title subjects, and PR-body messages\\.",
    "Requiring `PR metadata` is deferred because the default branch `main` does not carry the PR metadata validation workflow yet, so GitHub cannot report the check\\.",
    "Merge this adoption; the next adoption or update then requires the check\\.",
  ].join(" "),
);

// The requests other than reads that a run made.
function writes(state) {
  return state.requests.filter((request) => !request.startsWith("GET "));
}

test("defers requiring PR metadata while the default branch lacks the workflow", (t) => {
  const scenario = setup(t, { state: { workflow: "absent" } });
  const first = scenario.invoke();
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.result.status, "changed");
  assert.match(first.result.message, /updated squash merge settings/);
  assert.match(first.result.message, deferredRequirement);
  assert.doesNotMatch(first.result.message, /canonical configuration/);
  const state = scenario.readState();
  assert.ok(state.requests.includes(workflowRead));
  assert.deepEqual(state.mutationLog, ["update squash settings"]);
  assert.deepEqual(state.settings, {
    ...matchingSettings,
    delete_branch_on_merge: true,
  });
  assert.deepEqual(state.rulesets, []);
  assert.equal(state.branchProtection, null);

  const repeat = scenario.invoke();
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.equal(repeat.result.status, "unchanged");
  assert.match(
    repeat.result.message,
    new RegExp(`^${deferredRequirement.source}$`),
  );
  assert.equal(scenario.readState().mutations, 1);
});

test("leaves existing protection and rulesets untouched while the requirement is deferred", async (t) => {
  for (const { name, state } of [
    {
      name: "classic required checks without PR metadata",
      state: {
        branchProtection: classicProtection({
          strict: true,
          contexts: ["build"],
          checks: [{ context: "security", app_id: 456 }],
        }),
      },
    },
    {
      name: "an inactive managed ruleset",
      state: {
        rulesets: [
          canonicalRuleset({
            enforcement: "disabled",
            rules: [{ type: "non_fast_forward" }],
          }),
        ],
      },
    },
    {
      name: "ambiguous managed rulesets",
      state: {
        rulesets: [
          canonicalRuleset(),
          canonicalRuleset({ id: 51, name: rulesetName.toUpperCase() }),
        ],
      },
    },
  ])
    await t.test(name, (st) => {
      const scenario = setup(st, {
        state: { ...state, settings: matchingSettings, workflow: "absent" },
      });
      const outcome = scenario.invoke();
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "unchanged");
      assert.match(outcome.result.message, deferredRequirement);
      const after = scenario.readState();
      assert.deepEqual(writes(after), []);
      assert.deepEqual(after.branchProtection, state.branchProtection ?? null);
      assert.deepEqual(after.rulesets, state.rulesets ?? []);
      assert.equal(after.branchReads, 1, "enforcement readback is skipped");
    });
});

test("blocks with GitHub's reason when the workflow read fails", (t) => {
  const scenario = setup(t, { state: { workflow: "failed" } });
  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "blocked");
  assert.match(
    outcome.result.message,
    /could not read \.github\/workflows\/pr-metadata\.yml on main \(exit 1: gh: Server Error \(HTTP 500\)\)/,
  );
  assert.deepEqual(writes(scenario.readState()), []);
});

test("requires PR metadata on the run after the workflow reaches the default branch", async (t) => {
  await t.test("creates the ruleset", (st) => {
    const scenario = setup(st, { state: { workflow: "absent" } });
    assert.equal(scenario.invoke().result.status, "changed");
    scenario.updateState({ workflow: "present" });

    const next = scenario.invoke();
    assert.equal(next.status, 0, next.stderr);
    assert.equal(next.result.status, "changed");
    assert.match(next.result.message, /created required-check ruleset/);
    const state = scenario.readState();
    assert.deepEqual(state.mutationLog, [
      "update squash settings",
      "create required-check ruleset",
    ]);
    assert.deepEqual(state.rulesets, [canonicalRuleset({ id: 100 })]);
  });

  await t.test("reconciles an inactive managed ruleset", (st) => {
    const scenario = setup(st, {
      state: {
        settings: matchingSettings,
        rulesets: [canonicalRuleset({ enforcement: "disabled" })],
        workflow: "absent",
      },
    });
    assert.equal(scenario.invoke().result.status, "unchanged");
    scenario.updateState({ workflow: "present" });

    const next = scenario.invoke();
    assert.equal(next.status, 0, next.stderr);
    assert.equal(next.result.status, "changed");
    assert.match(next.result.message, /updated required-check ruleset/);
    assert.deepEqual(scenario.readState().rulesets, [canonicalRuleset()]);
  });
});

test("reports the plan limit regardless of the workflow read", async (t) => {
  for (const workflow of ["absent", "failed"])
    await t.test(workflow, (st) => {
      const scenario = setup(st, {
        state: {
          private: true,
          settings: matchingSettings,
          forbidden: { protection: planLimit, rulesets: planLimit },
          workflow,
        },
      });
      const outcome = scenario.invoke();
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "unchanged");
      assert.match(outcome.result.message, unavailableRequirement);
      assert.ok(!scenario.readState().requests.includes(workflowRead));
    });
});

test("different merge settings require confirmation before enforcement or settings change", (t) => {
  const scenario = setup(t);
  const before = scenario.readState();
  const outcome = scenario.invoke({ overwriteAllowed: false });
  assert.equal(outcome.result.status, "confirmation-required");
  assert.match(outcome.result.message, /allow_squash_merge.*false.*true/);
  assert.equal(scenario.readState().mutations ?? 0, 0);
  assert.deepEqual(scenario.readState().settings, before.settings);
  const resumed = scenario.invoke({ overwriteAllowed: true });
  assert.equal(resumed.result.status, "changed");
});
