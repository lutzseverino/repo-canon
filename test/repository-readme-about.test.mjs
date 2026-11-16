import assert from "node:assert/strict";
import { rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { setup } from "./helpers/github-setup.mjs";
import { retainedCheck, snapshot } from "./helpers/operation.mjs";

// The Repository README check's GitHub About comparison, run against the
// credential-only gh fixture and the stateful Postern transport fixture, so no
// request reaches GitHub.
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const checkScript = "operations/check-repository-readme.mjs";
const token = "fixture-secret-token";
const platformMessage = "fixture platform detail for fixture-account";
const description = "A delivery service for operators.";
const mit = "MIT License\n\nCopyright (c) 2026 Example\n";
const notCompared = /The GitHub About description was not compared: /;

function readme(paragraph = `<p align="center">${description}</p>`) {
  return `<div align="center">
<h1>Harbor</h1>
</div>
${paragraph}

## License

[MIT License](LICENSE)
`;
}

/**
 * @param {import("node:test").TestContext} t
 * @param {{ readmeText?: string, script?: string, state?: object, remotes?: Record<string, string> }} [options]
 */
function scenario(t, { readmeText = readme(), script, ...options } = {}) {
  const subject = {
    script: script ?? join(repositoryRoot, checkScript),
    fakeGh: join(repositoryRoot, "test/fixtures/fake-gh.mjs"),
    operation: {
      declaration: "repository-readme",
      phase: "checks",
      id: "repository-readme-structure",
    },
    state: { token },
  };
  const world = setup(t, subject, options);
  writeFileSync(join(world.project.root, "README.md"), readmeText);
  writeFileSync(join(world.project.root, "LICENSE"), mit);
  const invoke = (envOverrides = {}) => {
    const before = snapshot(world.project.root);
    const outcome = world.invoke(
      { allowedTargets: { paths: ["README.md"], directories: [] } },
      envOverrides,
    );
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.format, "repo-standards/result/v2");
    assert.deepEqual(
      snapshot(world.project.root),
      before,
      "the check must not change project content",
    );
    const requests = world.readState().requests ?? [];
    assert.deepEqual(
      requests.filter((request) => !request.startsWith("GET ")),
      [],
      "the check must not write GitHub settings",
    );
    for (const secret of [token, "fixture-account", platformMessage])
      assert.ok(
        !outcome.result.message.includes(secret),
        `the message must not contain ${secret}: ${outcome.result.message}`,
      );
    return outcome.result;
  };
  return { ...world, invoke };
}

const about = (value) => ({ state: { settings: { description: value } } });

test("passes when the About description equals the README description", (t) => {
  const result = scenario(t, about(description)).invoke();
  assert.equal(result.status, "passed", result.message);
  assert.match(result.message, /About description matches/);
  assert.doesNotMatch(result.message, notCompared);
});

test("passes when the texts differ only in surrounding or repeated whitespace", async (t) => {
  for (const [name, aboutText, paragraph] of [
    ["About padding", `  ${description}\n`, undefined],
    ["About newline", "A delivery\nservice for operators.", undefined],
    [
      "About repeated spaces",
      "A delivery   service  for operators.",
      undefined,
    ],
    [
      "README line break",
      description,
      '<p align="center">\n  A delivery\n  service for operators.\n</p>',
    ],
  ]) {
    await t.test(name, (t) => {
      const result = scenario(t, {
        ...about(aboutText),
        ...(paragraph ? { readmeText: readme(paragraph) } : {}),
      }).invoke();
      assert.equal(result.status, "passed", result.message);
      assert.match(result.message, /About description matches/);
    });
  }
});

test("fails and quotes both texts when they differ otherwise", async (t) => {
  for (const [name, aboutText] of [
    ["final period", "A delivery service for operators"],
    ["letter case", "a delivery service for operators."],
    ["word", "A delivery service for developers."],
  ]) {
    await t.test(name, (t) => {
      const result = scenario(t, about(aboutText)).invoke();
      assert.equal(result.status, "failed", result.message);
      assert.ok(result.message.includes(`"${description}"`), result.message);
      assert.ok(result.message.includes(`"${aboutText}"`), result.message);
      assert.match(result.message, /same sentence/);
    });
  }
});

test("fails and quotes the README description when the About description is empty", async (t) => {
  for (const [name, options] of /** @type {[string, object][]} */ ([
    ["empty", about("")],
    ["blank", about("  \n ")],
    ["null", about(null)],
    ["missing", { state: { settings: {} } }],
  ])) {
    await t.test(name, (t) => {
      const result = scenario(t, options).invoke();
      assert.equal(result.status, "failed", result.message);
      assert.ok(result.message.includes(`"${description}"`), result.message);
      assert.match(result.message, /About description is empty/);
    });
  }
});

test("reads no GitHub repository without a README description paragraph", (t) => {
  const world = scenario(t, {
    ...about(description),
    readmeText:
      '<h1 align="center">Harbor</h1>\n\n## License\n\n[MIT License](LICENSE)\n',
  });
  const result = world.invoke();
  assert.equal(result.status, "failed", result.message);
  assert.match(result.message, /description after its title one sentence/);
  assert.doesNotMatch(result.message, /About description/);
  assert.deepEqual(world.readState().requests ?? [], []);
});

// Each case: its name, scenario options, an optional environment change, and
// the expected reason.
/** @type {[string, object, ((world: any) => object) | undefined, RegExp][]} */
const unreadable = [
  [
    "gh unavailable",
    {},
    (world) => {
      rmSync(join(world.toolsRoot, "gh"));
      symlinkSync("/usr/bin/git", join(world.toolsRoot, "git"));
      return { PATH: world.toolsRoot };
    },
    /GitHub CLI \(gh\) is unavailable/,
  ],
  [
    "gh too old",
    { state: { version: "gh version 2.40.0 (fixture)" } },
    undefined,
    /requires gh 2\.57\.0 or newer/,
  ],
  [
    "gh not signed in",
    { state: { authenticated: false, token: platformMessage } },
    undefined,
    /requires authenticated github\.com access/,
  ],
  [
    "no github.com remote",
    { remotes: { origin: "https://gitlab.com/acme/widgets.git" } },
    undefined,
    /No unambiguous github\.com repository/,
  ],
  [
    "no remote",
    { remotes: {} },
    undefined,
    /No unambiguous github\.com repository/,
  ],
  [
    "several github.com remotes",
    {
      remotes: {
        origin: "https://github.com/acme/widgets.git",
        upstream: "git@github.com:other/widgets.git",
      },
    },
    undefined,
    /Multiple github\.com repositories.*resolve the target before Repository README check\./,
  ],
  .../** @type {[number, RegExp][]} */ ([
    [404, /HTTP 404/],
    [401, /sign in|Sign in/],
    [403, /HTTP 403/],
    [429, /HTTP 429/],
    [503, /HTTP 503/],
  ]).map(
    /** @returns {[string, object, undefined, RegExp]} */
    ([status, reason]) => [
      `repository request HTTP ${status}`,
      {
        state: {
          failure: { at: "repository", status, message: platformMessage },
        },
      },
      undefined,
      reason,
    ],
  ),
  [
    "account request failure",
    {
      state: {
        failure: { at: "account", status: 503, message: platformMessage },
      },
    },
    undefined,
    /HTTP 503/,
  ],
  [
    "invalid response",
    { state: { failure: { at: "repository", invalid: true } } },
    undefined,
    /invalid JSON response/,
  ],
  [
    "transport failure",
    {
      state: {
        failure: {
          at: "repository",
          transport: true,
          message: platformMessage,
        },
      },
    },
    undefined,
    /GitHub access failed|investigating the failure/,
  ],
];

test("skips the comparison without failing when the About description is unreadable", async (t) => {
  for (const [name, options, environment, reason] of unreadable) {
    await t.test(name, (t) => {
      const world = scenario(t, {
        ...about("A different sentence."),
        ...options,
      });
      const result = world.invoke(environment?.(world));
      assert.equal(result.status, "passed", result.message);
      assert.match(result.message, notCompared);
      assert.match(result.message, reason);
    });
  }
});

test("keeps structural corrections when the comparison is skipped", async (t) => {
  for (const [name, options, environment] of unreadable) {
    await t.test(name, (t) => {
      const world = scenario(t, {
        ...about(description),
        ...options,
        readmeText: readme(`<p>${description}</p>`),
      });
      const result = world.invoke(environment?.(world));
      assert.equal(result.status, "failed", result.message);
      assert.match(
        result.message,
        /Center the Repository README description paragraph\./,
      );
      assert.match(result.message, notCompared);
    });
  }
});

test("compares the About description from its declared retained source layout", async (t) => {
  const script = retainedCheck(t, checkScript);
  await t.test("match", (t) => {
    const result = scenario(t, { ...about(description), script }).invoke();
    assert.equal(result.status, "passed", result.message);
    assert.match(result.message, /About description matches/);
  });
  await t.test("difference", (t) => {
    const result = scenario(t, {
      ...about("Another sentence."),
      script,
    }).invoke();
    assert.equal(result.status, "failed", result.message);
    assert.match(result.message, /same sentence/);
  });
});
