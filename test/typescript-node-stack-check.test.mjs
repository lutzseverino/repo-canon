import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  fixture,
  invokeCheck,
  retainedCheck,
  snapshot,
} from "./helpers/operation.mjs";

const scriptPath = "operations/check-typescript-node-stack.mjs";
const script = fileURLToPath(new URL(`../${scriptPath}`, import.meta.url));

// A manifest that matches the stack's manifest facts, with overrides.
function manifest(overrides = {}) {
  return `${JSON.stringify(
    {
      name: "fixture",
      private: true,
      packageManager: "pnpm@11.1.2",
      engines: { node: ">=24 <25 || >=26 <27" },
      scripts: { validate: "pnpm run lint && pnpm test" },
      devDependencies: { oxlint: "1.86.0", prettier: "3.9.9" },
      ...overrides,
    },
    null,
    2,
  )}\n`;
}

// A workspace root and its listed member, both matching.
const workspace = {
  "package.json": manifest({ name: "root" }),
  "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
  "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
  "packages/cli/package.json": manifest({
    name: "cli",
    packageManager: undefined,
    engines: undefined,
    devDependencies: undefined,
  }),
};

const standalone = {
  "package.json": manifest(),
  "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
};

function check(t, files, paths, script_ = script) {
  const project = fixture(files);
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(script_, project.root, {
    operation: {
      declaration: "typescript-node-stack",
      phase: "checks",
      id: "typescript-node-stack-manifests",
    },
    allowedTargets: { paths, directories: [] },
  });
  assert.deepEqual(
    snapshot(project.root),
    before,
    "the check must not change project content",
  );
  assert.equal(outcome.status, 0, outcome.stderr);
  return outcome.result;
}

function corrections(result) {
  assert.equal(result.status, "failed", result.message);
  return result.message.replace(
    /^The typescript-node stack needs correction: /,
    "",
  );
}

test("passes a conforming root package and a conforming workspace member", (t) => {
  assert.deepEqual(check(t, standalone, ["package.json"]), {
    format: "repo-standards/result/v2",
    status: "passed",
    message:
      "The pnpm, lockfile, Node.js, oxlint, Prettier and validate script facts of the typescript-node stack are valid for 1 Project; TypeScript 7, node --test, required pull request checks running validate, and each Project's Setup and validation section still require the contextual assessment.",
  });
  const result = check(t, workspace, [
    "package.json",
    "packages/cli/package.json",
  ]);
  assert.equal(result.status, "passed", result.message);
  assert.match(result.message, /valid for 2 Projects/);
});

test("reads a member of a package.json workspace at that root", (t) => {
  const result = check(
    t,
    {
      "package.json": manifest({
        workspaces: { packages: ["tools/**", "!tools/legacy"] },
      }),
      "pnpm-lock.yaml": "",
      "tools/nested/report/package.json": manifest({
        packageManager: undefined,
        engines: undefined,
      }),
    },
    ["tools/nested/report/package.json"],
  );
  assert.equal(result.status, "passed", result.message);
});

test("accepts both engines.node spellings and other ranges admitting only Node.js 24 or 26", async (t) => {
  for (const range of [
    ">=24 <25 || >=26 <27",
    "^24.0.0 || ^26.0.0",
    ">=24.0.0 <25.0.0 || >=26.0.0 <27.0.0",
    "24.x",
    "^26.1.0",
    "~24.3",
  ])
    await t.test(range, (st) => {
      const result = check(
        st,
        {
          ...standalone,
          "package.json": manifest({ engines: { node: range } }),
        },
        ["package.json"],
      );
      assert.equal(result.status, "passed", result.message);
    });
});

test("names a correction for a wrong or missing packageManager", async (t) => {
  for (const [packageManager, current] of [
    [undefined, "it is missing"],
    ["npm@11.6.0", "it is `npm@11.6.0`"],
    ["pnpm@10.18.0", "it is `pnpm@10.18.0`"],
    ["pnpm@11", "it is `pnpm@11`"],
  ])
    await t.test(String(packageManager), (st) => {
      assert.equal(
        corrections(
          check(
            st,
            { ...standalone, "package.json": manifest({ packageManager }) },
            ["package.json"],
          ),
        ),
        `Set \`packageManager\` to \`pnpm@11.x.y\` in the workspace root \`package.json\`; ${current}.`,
      );
    });
});

test("accepts a packageManager with a Corepack hash", (t) => {
  const result = check(
    t,
    {
      ...standalone,
      "package.json": manifest({ packageManager: "pnpm@11.1.2+sha512.abc123" }),
    },
    ["package.json"],
  );
  assert.equal(result.status, "passed", result.message);
});

test("names a correction for a missing pnpm-lock.yaml at the workspace root", (t) => {
  const { "pnpm-lock.yaml": _, ...files } = workspace;
  assert.equal(
    corrections(check(t, files, ["packages/cli/package.json"])),
    "Add `pnpm-lock.yaml` at the workspace root, `pnpm-lock.yaml`.",
  );
});

test("names a correction for engines.node admitting Node.js 22, 25, or later majors", async (t) => {
  for (const [range, admitted] of [
    ["^22.0.0 || ^24.0.0", "Node.js 22 and Node.js 24"],
    [">=24 <26", "Node.js 24 and Node.js 25"],
    ["^25.0.0 || ^26.0.0", "Node.js 25 and Node.js 26"],
    [">=24", "every major from Node.js 24 on"],
  ])
    await t.test(range, (st) => {
      assert.equal(
        corrections(
          check(
            st,
            {
              ...standalone,
              "package.json": manifest({ engines: { node: range } }),
            },
            ["package.json"],
          ),
        ),
        `Make \`engines.node\` in the workspace root \`package.json\` admit only Node.js 24 or 26; \`${range}\` admits ${admitted}.`,
      );
    });
});

test("names a correction for a missing or unreadable engines.node", async (t) => {
  for (const [engines, current] of [
    [undefined, "it is missing"],
    [{ node: "lts" }, "`lts` is not a version range the check reads"],
  ])
    await t.test(String(engines?.node), (st) => {
      assert.equal(
        corrections(
          check(st, { ...standalone, "package.json": manifest({ engines }) }, [
            "package.json",
          ]),
        ),
        `Make \`engines.node\` in the workspace root \`package.json\` admit only Node.js 24 or 26; ${current}.`,
      );
    });
});

test("reads workspace-shared facts at the root, not in the member", (t) => {
  const result = check(
    t,
    {
      ...workspace,
      "package.json": manifest({ packageManager: "npm@11.6.0" }),
      "packages/cli/package.json": manifest({ name: "cli" }),
    },
    ["packages/cli/package.json"],
  );
  assert.equal(
    corrections(result),
    "Set `packageManager` to `pnpm@11.x.y` in the workspace root `package.json`; it is `npm@11.6.0`.",
  );
});

test("names a correction for missing oxlint or prettier or the wrong major", async (t) => {
  for (const [devDependencies, expected] of [
    [
      { prettier: "3.9.9" },
      "Declare `oxlint` at major 1 in `package.json`; it is not declared.",
    ],
    [
      { oxlint: "1.86.0" },
      "Declare `prettier` at major 3 in `package.json`; it is not declared.",
    ],
    [
      { oxlint: "^0.16.0", prettier: "3.9.9" },
      "Declare `oxlint` at major 1 in `package.json`; `package.json` declares `^0.16.0`, which admits major 0.",
    ],
    [
      { oxlint: "1.86.0", prettier: "^2.8.0 || ^3.0.0" },
      "Declare `prettier` at major 3 in `package.json`; `package.json` declares `^2.8.0 || ^3.0.0`, which admits major 2 and major 3.",
    ],
    [
      { oxlint: "latest", prettier: "3.9.9" },
      "Declare `oxlint` at major 1 in `package.json`; `package.json` declares `latest`, which is not a version range the check reads.",
    ],
  ])
    await t.test(JSON.stringify(devDependencies), (st) => {
      assert.equal(
        corrections(
          check(
            st,
            { ...standalone, "package.json": manifest({ devDependencies }) },
            ["package.json"],
          ),
        ),
        expected,
      );
    });
});

test("takes tools from the member first, then from its workspace root", (t) => {
  const accepted = check(
    t,
    {
      ...workspace,
      "packages/cli/package.json": manifest({
        packageManager: undefined,
        dependencies: { prettier: "^3.0.0" },
        devDependencies: undefined,
      }),
    },
    ["packages/cli/package.json"],
  );
  assert.equal(accepted.status, "passed", accepted.message);
  assert.equal(
    corrections(
      check(
        t,
        {
          ...workspace,
          "packages/cli/package.json": manifest({
            devDependencies: { oxlint: "0.9.0" },
          }),
        },
        ["packages/cli/package.json"],
      ),
    ),
    "Declare `oxlint` at major 1 in `packages/cli/package.json` or its workspace root `package.json`; `packages/cli/package.json` declares `0.9.0`, which admits major 0.",
  );
  assert.equal(
    corrections(
      check(
        t,
        {
          ...workspace,
          "package.json": manifest({ devDependencies: { oxlint: "1.86.0" } }),
        },
        ["packages/cli/package.json"],
      ),
    ),
    "Declare `prettier` at major 3 in `packages/cli/package.json` or its workspace root `package.json`; neither declares it.",
  );
});

test("names a correction for a missing validate script", (t) => {
  assert.equal(
    corrections(
      check(
        t,
        {
          ...standalone,
          "package.json": manifest({ scripts: { test: "node --test" } }),
        },
        ["package.json"],
      ),
    ),
    "Add a `validate` script to `package.json` that runs the Project's checks.",
  );
});

test("reports every correction for each path, once each", (t) => {
  const result = check(
    t,
    {
      "package.json": manifest({ packageManager: undefined }),
      "pnpm-workspace.yaml": "packages: [apps/*, 'libs/*']\n",
      "apps/web/package.json": manifest({ scripts: {} }),
      "libs/core/package.json": manifest({ scripts: {} }),
    },
    ["apps/web/package.json", "libs/core/package.json"],
  );
  assert.equal(
    corrections(result),
    [
      "Set `packageManager` to `pnpm@11.x.y` in the workspace root `package.json`; it is missing.",
      "Add `pnpm-lock.yaml` at the workspace root, `pnpm-lock.yaml`.",
      "Add a `validate` script to `apps/web/package.json` that runs the Project's checks.",
      "Add a `validate` script to `libs/core/package.json` that runs the Project's checks.",
    ].join(" "),
  );
});

test("names a missing or unreadable confirmed manifest", (t) => {
  assert.equal(
    corrections(
      check(t, { "README.md": "# Fixture\n" }, ["tool/package.json"]),
    ),
    "`tool/package.json` is missing; a Project is one readable `package.json`.",
  );
  assert.equal(
    corrections(check(t, { "package.json": "[]\n" }, ["package.json"])),
    "`package.json` is not a JSON object; a Project is one readable `package.json`.",
  );
});

test("names a workspace configuration it cannot read", (t) => {
  assert.equal(
    corrections(
      check(
        t,
        {
          ...standalone,
          "pnpm-workspace.yaml": "packages: *members\n",
        },
        ["package.json"],
      ),
    ),
    "State the workspace members of `pnpm-workspace.yaml` as a list of plain or quoted patterns, which the check reads.",
  );
});

test("passes an empty scope, leaving coverage to the assessment", (t) => {
  const result = check(t, {}, []);
  assert.equal(result.status, "passed");
  assert.match(result.message, /valid for 0 Projects/);
});

test("runs from its declared retained source layout", (t) => {
  const result = check(
    t,
    standalone,
    ["package.json"],
    retainedCheck(t, scriptPath),
  );
  assert.equal(result.status, "passed", result.message);
});

test("refuses directory targets and paths that are not package.json as process errors", (t) => {
  const project = fixture(standalone);
  t.after(project.close);
  const before = snapshot(project.root);
  for (const allowedTargets of [
    { paths: ["package.json"], directories: ["packages"] },
    { paths: ["pnpm-lock.yaml"], directories: [] },
    { paths: ["packages/cli"], directories: [] },
    { paths: ["../package.json"], directories: [] },
    { paths: ["/package.json"], directories: [] },
    { paths: ["./package.json"], directories: [] },
  ]) {
    const outcome = invokeCheck(script, project.root, { allowedTargets });
    assert.notEqual(outcome.status, 0, JSON.stringify(allowedTargets));
    assert.equal(outcome.stdout, "");
    assert.match(
      outcome.stderr,
      /requires individual package\.json paths and no directory targets/,
    );
  }
  assert.deepEqual(snapshot(project.root), before);
});
