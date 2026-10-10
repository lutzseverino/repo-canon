import assert from "node:assert/strict";
import { chmodSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
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
    assert.match(outcome.result.message, /requires Node\.js 24/);
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
      assert.deepEqual(scenario.readState().authStatusArguments, [
        "--hostname",
        "github.com",
        "--active",
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
  assert.deepEqual(scenario.readState().authStatusArguments, [
    "--hostname",
    "github.com",
    "--active",
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
