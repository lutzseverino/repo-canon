import assert from "node:assert/strict";
import {
  existsSync,
  chmodSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { retainedCheck } from "./helpers/operation.mjs";
import {
  fakeNodeVersion,
  githubLabelSetup,
  githubPrIntegrationSetup,
  setup,
} from "./helpers/github-setup.mjs";

// The preparation that every GitHub operation shares, run through a fixture
// that calls it as the operations do.
const preparation = {
  script: fileURLToPath(
    new URL("./fixtures/github-operation.mjs", import.meta.url),
  ),
  fakeGh: githubLabelSetup.fakeGh,
  operation: { declaration: "github-fixture", phase: "fixes", id: "prepare" },
  state: {},
};

function prepare(t, options) {
  return setup(t, preparation, options);
}

function globalRemote(scenario) {
  const globalConfig = join(scenario.toolsRoot, "global.gitconfig");
  writeFileSync(
    globalConfig,
    '[remote "injected"]\n\turl = git@github.com:other/widgets.git\n',
  );
  return { GIT_CONFIG_GLOBAL: globalConfig };
}

test("prepares the one repository-local github.com identity that GitHub confirms", async (t) => {
  await t.test("a global remote does not conflict with the local one", (st) => {
    const scenario = prepare(st);
    const outcome = scenario.invoke({}, globalRemote(scenario));
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, "unchanged");
  });

  for (const { name, options, global, message } of [
    {
      name: "a global remote without a repository-local target",
      options: { remotes: {} },
      global: true,
      message: [/No unambiguous github.com repository/],
    },
    {
      name: "no GitHub remote",
      options: { remotes: { origin: "https://example.com/acme/widgets.git" } },
      message: [/No unambiguous github.com repository/],
    },
    {
      name: "different GitHub remotes",
      options: {
        remotes: {
          origin: "https://github.com/acme/widgets.git",
          upstream: "git@github.com:other/widgets.git",
        },
      },
      message: [
        /Multiple github.com repositories/,
        /acme\/widgets/,
        /other\/widgets/,
      ],
    },
    {
      name: "different fetch and push targets",
      options: { pushUrls: { origin: "git@github.com:other/widgets.git" } },
      message: [/Multiple github.com repositories/],
    },
  ])
    await t.test(`blocks for ${name} before any API call`, (st) => {
      const scenario = prepare(st, options);
      const outcome = scenario.invoke({}, global ? globalRemote(scenario) : {});
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "blocked");
      for (const pattern of message)
        assert.match(outcome.result.message, pattern);
      assert.deepEqual(scenario.readState().apiHosts ?? [], []);
    });

  await t.test("blocks when GitHub resolves another repository", (st) => {
    const scenario = prepare(st, { state: { repo: "acme/renamed-widgets" } });
    const outcome = scenario.invoke();
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, "blocked");
    assert.match(
      outcome.result.message,
      /resolved acme\/widgets as acme\/renamed-widgets/,
    );
  });
});

test("blocks for unavailable or incompatible tools and unauthenticated access", async (t) => {
  await t.test("incompatible Node.js runtime", (st) => {
    const scenario = prepare(st);
    const outcome = scenario.invoke({}, { FAKE_NODE_VERSION: "23.11.0" }, [
      "--import",
      fakeNodeVersion,
    ]);
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, "blocked");
    assert.match(outcome.result.message, /requires stable Node\.js 24 or 26/);
  });

  await t.test("missing Git", (st) => {
    const scenario = prepare(st);
    const outcome = scenario.invoke({}, { PATH: scenario.toolsRoot });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, "blocked");
    assert.match(outcome.result.message, /Git is unavailable/);
  });

  await t.test("incompatible Git", (st) => {
    const scenario = prepare(st);
    const git = join(scenario.toolsRoot, "git");
    writeFileSync(git, "#!/bin/sh\nprintf 'git version 2.17.9\\n'\n");
    chmodSync(git, 0o755);
    const outcome = scenario.invoke();
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, "blocked");
    assert.match(outcome.result.message, /requires Git 2\.18\.0 or newer/);
  });

  await t.test("missing gh", (st) => {
    const scenario = prepare(st);
    rmSync(join(scenario.toolsRoot, "gh"));
    symlinkSync("/usr/bin/git", join(scenario.toolsRoot, "git"));
    const outcome = scenario.invoke({}, { PATH: scenario.toolsRoot });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, "blocked");
    assert.match(outcome.result.message, /GitHub CLI \(gh\) is unavailable/);
  });

  await t.test("incompatible gh", (st) => {
    const scenario = prepare(st, { state: { version: "gh version 2.56.0" } });
    const outcome = scenario.invoke();
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, "blocked");
    assert.match(outcome.result.message, /requires gh 2\.57\.0 or newer/);
  });

  await t.test("not authenticated", (st) => {
    const scenario = prepare(st, { state: { authenticated: false } });
    const outcome = scenario.invoke();
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, "blocked");
    assert.match(outcome.result.message, /authenticated github.com access/);
  });

  await t.test(
    "an invalid inactive account does not block the authenticated active account",
    (st) => {
      const scenario = prepare(st, { state: { inactiveAuthInvalid: true } });
      const outcome = scenario.invoke();
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "unchanged");
      assert.deepEqual(scenario.readState().tokenArguments, [
        "--hostname",
        "github.com",
      ]);
    },
  );
});

test("pins API requests and authentication to github.com when the environment selects another host", (t) => {
  const scenario = prepare(t);
  const outcome = scenario.invoke({}, { GH_HOST: "enterprise.example" });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "unchanged");
  assert.deepEqual([...new Set(scenario.readState().apiHosts)], ["github.com"]);
  assert.deepEqual(scenario.readState().tokenArguments, [
    "--hostname",
    "github.com",
  ]);
});

test("each GitHub operation stops at a blocked preparation and rejects protocol errors", async (t) => {
  for (const [name, subject] of [
    ["GitHub label setup", githubLabelSetup],
    ["GitHub PR integration setup", githubPrIntegrationSetup],
  ])
    await t.test(name, (st) => {
      const blocked = setup(st, subject, {
        remotes: {
          origin: "https://github.com/acme/widgets.git",
          upstream: "git@github.com:other/widgets.git",
        },
      });
      const outcome = blocked.invoke();
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "blocked");
      assert.match(outcome.result.message, /Multiple github.com repositories/);
      assert.equal(blocked.readState().mutations ?? 0, 0);

      const scenario = setup(st, subject);
      for (const overrides of [
        { format: "repo-standards/operation/v1" },
        { overwriteAllowed: undefined },
        { overwriteAllowed: "true" },
        { operation: { ...subject.operation, phase: "checks" } },
        { allowedTargets: { paths: ["README.md"], directories: [] } },
      ]) {
        const invalid = scenario.invoke(overrides);
        assert.equal(invalid.status, 1);
        assert.equal(invalid.result, null);
        assert.match(invalid.stderr, new RegExp(name));
      }
      assert.equal(scenario.readState().mutations ?? 0, 0);
    });
});

// Run the public fixes and their retained probes through the same runtime gate.
for (const fix of [githubLabelSetup, githubPrIntegrationSetup]) {
  for (const phase of ["fixes", "probes"]) {
    test(`${fix.operation.id} ${phase} accepts only stable Node.js 24 and 26`, async (t) => {
      for (const version of [
        "24.0.0",
        "24.21.0",
        "26.0.0",
        "26.12.0",
        "22.22.0",
        "23.11.0",
        "25.0.0",
        "27.0.0",
        "28.0.0",
        "24.0.0-rc.1",
        "26.0.0-rc.1",
        "26.12.0-nightly20261017",
      ]) {
        await t.test(version, (st) => {
          const supported = ["24.0.0", "24.21.0", "26.0.0", "26.12.0"].includes(
            version,
          );
          const subject = {
            ...fix,
            script: retainedCheck(
              st,
              phase === "fixes"
                ? `operations/${fix === githubLabelSetup ? "setup-github-labels" : "setup-github-pr-integration"}.mjs`
                : `operations/${fix === githubLabelSetup ? "probe-github-labels" : "probe-github-pr-integration"}.mjs`,
            ),
            operation: { ...fix.operation, phase },
          };
          const scenario = setup(st, subject);
          const outcome = scenario.invoke(
            { overwriteAllowed: true },
            { FAKE_NODE_VERSION: version },
            ["--import", fakeNodeVersion],
          );
          assert.equal(outcome.status, 0, outcome.stderr);
          assert.equal(
            outcome.result.status,
            supported
              ? phase === "fixes"
                ? "changed"
                : "ready"
              : phase === "fixes"
                ? "blocked"
                : "not-ready",
          );
          if (supported) {
            assert.ok(scenario.readState().apiHosts.length > 0);
          } else {
            assert.match(
              outcome.result.message,
              /requires stable Node\.js 24 or 26/,
            );
            assert.deepEqual(scenario.readState().apiHosts ?? [], []);
            assert.equal(scenario.readState().mutations ?? 0, 0);
          }
          if (phase === "probes")
            assert.equal(scenario.readState().mutations ?? 0, 0);
        });
      }
    });
  }
}

test("uses gh only for the version and the current github.com token", (t) => {
  const scenario = prepare(t);
  const outcome = scenario.invoke();
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "unchanged");
  assert.deepEqual(scenario.readState().ghCalls, [
    ["--version"],
    ["auth", "token", "--hostname", "github.com"],
  ]);
});

// Exercise the actual adapter's closed error reasons at every operation stage.
const platformFailures = [
  { name: "notFound", status: 404, recovery: /Confirm the repository exists/ },
  { name: "unauthenticated", status: 401, recovery: /Sign in again/ },
  { name: "forbidden", status: 403, recovery: /Retry later/ },
  { name: "rateLimited", status: 429, recovery: /rate limit resets/ },
  {
    name: "rateLimited 403",
    status: 403,
    message: "API rate limit exceeded",
    recovery: /rate limit resets/,
  },
  { name: "rejected", status: 422, recovery: /Retry later/ },
  { name: "conflict", status: 409, recovery: /Retry later/ },
  { name: "unavailable HTTP", status: 503, recovery: /Retry later/ },
  {
    name: "unavailable transport",
    transport: true,
    recovery: /investigating the failure/,
  },
  {
    name: "unavailable timeout",
    timeout: true,
    recovery: /investigating the failure/,
  },
  { name: "invalidResponse", invalid: true, recovery: /invalid JSON response/ },
];

for (const fix of [githubLabelSetup, githubPrIntegrationSetup]) {
  test(`${fix.operation.id} blocks on every PlatformError without mutating after a failed read`, async (t) => {
    for (const failure of platformFailures) {
      for (const at of ["repository", "read", "mutation"]) {
        await t.test(`${failure.name}: ${at}`, (st) => {
          const scenario = setup(st, fix, {
            state: { failure: { ...failure, at } },
          });
          const outcome = scenario.invoke({ overwriteAllowed: true });
          assert.equal(outcome.status, 0, outcome.stderr);
          assert.equal(outcome.result.status, "blocked");
          if (at === "repository")
            assert.match(outcome.result.message, failure.recovery);
          if (at === "mutation")
            assert.match(outcome.result.message, /No changes were confirmed/);
          assert.equal(scenario.readState().mutations ?? 0, 0);
          if (at !== "mutation")
            assert.ok(
              scenario
                .readState()
                .requests.every((request) => request.startsWith("GET ")),
            );
          assert.equal(outcome.stderr, "");
        });
      }
    }
  });

  test(`${fix.operation.id} never exposes its current token, including echoed failures`, async (t) => {
    const token = "recognizable-current-token-541";
    const probe = {
      ...fix,
      operation: { ...fix.operation, phase: "probes" },
      script: retainedCheck(
        t,
        fix === githubLabelSetup
          ? "operations/probe-github-labels.mjs"
          : "operations/probe-github-pr-integration.mjs",
      ),
    };
    for (const subject of [fix, probe]) {
      for (const state of [
        { authenticated: false },
        { failure: { at: "account", status: 401, message: token } },
        { failure: { at: "repository", status: 403, message: token } },
        { failure: { at: "repository", transport: true, message: token } },
        ...(subject === fix
          ? [
              { failure: { at: "read", status: 403, message: token } },
              { failure: { at: "mutation", status: 422, message: token } },
              { failure: { at: "mutation", transport: true, message: token } },
              // A successful response can also echo the credential.
              { repo: token },
            ]
          : []),
      ]) {
        await t.test(
          `${subject.operation.phase}: ${JSON.stringify(state).replaceAll(token, "<token>")}`,
          (st) => {
            const scenario = setup(st, subject, { state: { ...state, token } });
            const outcome = scenario.invoke({ overwriteAllowed: true });
            assert.equal(outcome.status, 0, outcome.stderr);
            assert.equal(
              outcome.result.status,
              subject === fix ? "blocked" : "not-ready",
            );
            assert.ok(
              !`${outcome.stdout}${outcome.stderr}`.includes(token),
              "token must not appear in operation output",
            );
          },
        );
      }
    }
  });

  test(`${fix.operation.id} requires a current token and an authenticated account report`, async (t) => {
    for (const state of [
      { token: "" },
      { accountError: "gh: Bad credentials (HTTP 401)" },
    ]) {
      await t.test(JSON.stringify(state), (st) => {
        const scenario = setup(st, fix, { state });
        const outcome = scenario.invoke();
        assert.equal(outcome.status, 0, outcome.stderr);
        assert.equal(outcome.result.status, "blocked");
        assert.match(
          outcome.result.message,
          /requires authenticated github.com access through gh; sign in/,
        );
        assert.equal(scenario.readState().mutations ?? 0, 0);
        assert.ok(
          !(scenario.readState().requests ?? []).some((request) =>
            request.startsWith("GET repos/"),
          ),
        );
      });
    }
  });
}

test("all four remote-setup entry points retain the one bundle, license and provenance", (t) => {
  for (const script of [
    "setup-github-labels",
    "probe-github-labels",
    "setup-github-pr-integration",
    "probe-github-pr-integration",
  ]) {
    const retained = retainedCheck(t, `operations/${script}.mjs`);
    for (const file of ["postern.mjs", "LICENSE", "README.md"])
      assert.ok(
        existsSync(join(dirname(retained), "../vendor/postern", file)),
        `${script} must retain Postern ${file}`,
      );
  }
});
