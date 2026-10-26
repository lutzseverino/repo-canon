import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  fixture,
  invokeCheck,
  retainedCheck,
  snapshot,
} from "./helpers/operation.mjs";

import {
  catalogYaml,
  unsupportedWorkspaceYaml,
  unsupportedCatalogYaml,
} from "./helpers/stack-yaml.mjs";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
const drafterPath = "discovery/draft-typescript-node-stack-scope.mjs";
const drafter = join(sourceRoot, drafterPath);
const check = join(sourceRoot, "operations/check-typescript-node-stack.mjs");

const coverage =
  "Drafted from manifests and workspace configuration by `discovery/draft-typescript-node-stack-scope.mjs`: one `package.json` per Project, included when it matches the stack's manifest facts and excluded naming its differences otherwise. A maintained workspace root package is a Project alongside its members; a shared-only root is not. Uncertain root membership stays unresolved. A root package without workspace members is a Project.";
const matches = (path) =>
  `The Project of \`${path}\` matches the typescript-node stack's manifest facts: pnpm 11, its lockfile, Node.js 24 or 26, oxlint 1, Prettier 3 and a validate script.`;
const workspaceRoot = (path) =>
  `\`${path}\` supplies shared workspace configuration without evidence of its own maintained package; its members are the Projects.`;
const differs = (path, differences) =>
  `The Project of \`${path}\` differs from the typescript-node stack, so it stays out of the scope until a migration brings it in: ${differences.join(" ")}`;

// The discovery request Repository Standards passes the drafter.
const request = (root, overrides = {}) => ({
  format: "repo-standards/discovery/v1",
  declaration: "typescript-node-stack",
  projectRoot: root,
  standards: {
    repository: "https://github.com/lutzseverino/repo-canon",
    version: "v0.0.0-test",
    commit: "0000000000000000000000000000000000000000",
  },
  profile: "standard",
  platform: "github",
  ...overrides,
});

function draft(
  root,
  { script = drafter, input = request(root), args = [] } = {},
) {
  const child = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    input: typeof input === "string" ? input : `${JSON.stringify(input)}\n`,
  });
  return {
    ...child,
    proposal: child.status === 0 ? JSON.parse(child.stdout) : null,
  };
}

// A project as Repository Standards copies it for a discovery script, without
// Git metadata.
function projectCopy(t, files) {
  const project = fixture(files);
  t.after(project.close);
  rmSync(join(project.root, ".git"), { recursive: true, force: true });
  return project.root;
}

// Drafts a copy's scope, asserting that drafting changes nothing and that the
// proposal has the scope proposal's shape, and returns its one entry.
function drafted(t, files, options = {}) {
  const root = projectCopy(t, files);
  const before = snapshot(root);
  const outcome = draft(root, options);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.stderr, "");
  assert.deepEqual(
    snapshot(root),
    before,
    "the drafter must not change the copy",
  );
  const { proposal } = outcome;
  assert.deepEqual(Object.keys(proposal).sort(), ["declarations", "format"]);
  assert.equal(proposal.format, "repo-standards/scope/v2");
  assert.equal(proposal.declarations.length, 1);
  const [entry] = proposal.declarations;
  assert.equal(entry.id, "typescript-node-stack");
  const included = entry.candidates.filter(
    (candidate) => candidate.decision === "include",
  );
  assert.equal(entry.noScope, included.length === 0 ? true : undefined);
  for (const candidate of entry.candidates) {
    assert.deepEqual(Object.keys(candidate).sort(), [
      "decision",
      "evidence",
      "path",
      "reason",
    ]);
    assert.ok(candidate.evidence.length > 0, candidate.path);
    for (const path of candidate.evidence)
      assert.ok(before[path] !== undefined, `evidence ${path} is a kept file`);
  }
  return { root, entry };
}

function manifest(overrides = {}) {
  return `${JSON.stringify(
    {
      name: "fixture",
      private: true,
      packageManager: "pnpm@11.1.2",
      engines: { node: "^24.0.0 || ^26.0.0" },
      scripts: { validate: "pnpm run lint && pnpm test" },
      devDependencies: { oxlint: "1.86.0", prettier: "3.9.9" },
      ...overrides,
    },
    null,
    2,
  )}\n`;
}

const member = (overrides = {}) =>
  manifest({
    packageManager: undefined,
    engines: undefined,
    devDependencies: undefined,
    ...overrides,
  });

test("includes a single conforming package", (t) => {
  const { entry } = drafted(t, {
    "package.json": manifest(),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    "src/index.ts": "export {};\n",
  });
  assert.deepEqual(entry, {
    id: "typescript-node-stack",
    coverage,
    candidates: [
      {
        path: "package.json",
        decision: "include",
        reason: matches("package.json"),
        evidence: ["package.json", "pnpm-lock.yaml"],
      },
    ],
    unresolved: [],
  });
});

test("includes a maintained workspace root package alongside its member", (t) => {
  const { root, entry } = drafted(t, {
    "package.json": manifest({
      name: "cli",
      bin: { cli: "dist/cli.js" },
      scripts: { build: "tsc", validate: "pnpm run build && node --test" },
    }),
    "src/cli.ts": "console.log('cli');\n",
    "pnpm-lock.yaml": "",
    "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
    "packages/core/package.json": member(),
    "packages/core/src/index.ts": "export {};\n",
  });
  const paths = entry.candidates
    .filter(({ decision }) => decision === "include")
    .map(({ path }) => path);
  assert.deepEqual(paths, ["package.json", "packages/core/package.json"]);
  assert.deepEqual(entry.unresolved, []);
  assert.ok(entry.candidates[0].evidence.includes("src/cli.ts"));
  const outcome = invokeCheck(check, root, {
    operation: {
      declaration: "typescript-node-stack",
      phase: "checks",
      id: "typescript-node-stack-manifests",
    },
    allowedTargets: { paths, directories: [] },
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed", outcome.result.message);
  assert.match(outcome.result.message, /valid for 2 Projects/);
});

test("excludes a differing maintained root while keeping its conforming member", (t) => {
  const { entry } = drafted(t, {
    "package.json": manifest({
      exports: "./dist/index.js",
      scripts: { build: "tsc" },
      workspaces: ["packages/*"],
    }),
    "src/index.ts": "export {};\n",
    "pnpm-lock.yaml": "",
    "packages/core/package.json": member(),
  });
  assert.equal(entry.candidates[0].decision, "exclude");
  assert.equal(
    entry.candidates[0].reason,
    differs("package.json", [
      "Add a `validate` script to `package.json` that runs the Project's checks.",
    ]),
  );
  assert.ok(entry.candidates[0].evidence.includes("src/index.ts"));
  assert.equal(entry.candidates[1].decision, "include");
  assert.deepEqual(entry.unresolved, []);
});

test("leaves incomplete root-package evidence unresolved", (t) => {
  for (const files of [
    { "package.json": manifest(), "src/index.ts": "export {};\n" },
    { "package.json": manifest({ main: "dist/index.js" }) },
    {
      "package.json": manifest({ main: "dist/index.js", scripts: {} }),
      "src/index.ts": "export {};\n",
    },
    { "package.json": "{ broken" },
  ]) {
    const { entry } = drafted(t, {
      ...files,
      "pnpm-lock.yaml": "",
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/core/package.json": member(),
      "packages/core/src/index.ts": "export {};\n",
    });
    assert.equal(entry.unresolved.length, 1);
    assert.match(
      entry.unresolved[0],
      /workspace root `package.json` itself a maintained package/,
    );
    assert.ok(entry.candidates.every(({ path }) => path !== "package.json"));
  }
});

test("does not mistake member sources, fixtures or tool configuration for a root package", (t) => {
  const { entry } = drafted(t, {
    "package.json": manifest({ workspaces: ["packages/*"] }),
    "pnpm-lock.yaml": "",
    "packages/core/package.json": member(),
    "packages/core/src/index.ts": "export {};\n",
    "test/fixtures/src/index.ts": "export {};\n",
    "prettier.config.js": "export default {};\n",
    ".config/tool.ts": "export {};\n",
  });
  assert.equal(entry.candidates[0].decision, "exclude");
  assert.equal(entry.candidates[0].reason, workspaceRoot("package.json"));
  assert.deepEqual(entry.unresolved, []);
});

test("includes only the conforming Projects of a pnpm workspace, naming each differing member's differences", (t) => {
  const { entry } = drafted(t, {
    "package.json": manifest({ name: "root" }),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    "pnpm-workspace.yaml":
      "# Members\npackages:\n  - 'packages/*'\n  - \"tools/*\" # tools\n",
    "packages/cli/package.json": member({ name: "cli" }),
    "packages/legacy/package.json": member({
      name: "legacy",
      scripts: { test: "jest" },
      devDependencies: { oxlint: "0.9.0" },
    }),
    "tools/report/package.json": member({
      name: "report",
      dependencies: { prettier: "2.8.8" },
    }),
  });
  assert.deepEqual(entry, {
    id: "typescript-node-stack",
    coverage,
    candidates: [
      {
        path: "package.json",
        decision: "exclude",
        reason: workspaceRoot("package.json"),
        evidence: ["package.json", "pnpm-workspace.yaml"],
      },
      {
        path: "packages/cli/package.json",
        decision: "include",
        reason: matches("packages/cli/package.json"),
        evidence: [
          "packages/cli/package.json",
          "package.json",
          "pnpm-lock.yaml",
          "pnpm-workspace.yaml",
        ],
      },
      {
        path: "packages/legacy/package.json",
        decision: "exclude",
        reason: differs("packages/legacy/package.json", [
          "Declare `oxlint` at major 1 in `packages/legacy/package.json` or its workspace root `package.json`; `packages/legacy/package.json` declares `0.9.0`, which admits major 0.",
          "Add a `validate` script to `packages/legacy/package.json` that runs the Project's checks.",
        ]),
        evidence: ["packages/legacy/package.json"],
      },
      {
        path: "tools/report/package.json",
        decision: "exclude",
        reason: differs("tools/report/package.json", [
          "Declare `prettier` at major 3 in `tools/report/package.json` or its workspace root `package.json`; `tools/report/package.json` declares `2.8.8`, which admits major 2.",
        ]),
        evidence: ["tools/report/package.json"],
      },
    ],
    unresolved: [],
  });
});

test("excludes a shared-only workspace root independently of stack conformity", (t) => {
  for (const root of [manifest({ name: "root" }), manifest({ scripts: {} })]) {
    const { entry } = drafted(t, {
      "package.json": root,
      "pnpm-lock.yaml": "",
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/cli/package.json": member(),
    });
    assert.deepEqual(
      entry.candidates.map(({ path, decision, reason }) => [
        path,
        decision,
        reason,
      ]),
      [
        ["package.json", "exclude", workspaceRoot("package.json")],
        [
          "packages/cli/package.json",
          "include",
          matches("packages/cli/package.json"),
        ],
      ],
    );
    assert.deepEqual(entry.unresolved, []);
  }
});

test("keeps a single package's root manifest as its Project when pnpm-workspace.yaml lists no members", (t) => {
  const { entry } = drafted(t, {
    "package.json": manifest({
      devDependencies: { oxlint: "catalog:", prettier: "catalog:" },
    }),
    "pnpm-lock.yaml": "",
    "pnpm-workspace.yaml":
      "catalog:\n  oxlint: 1.86.0\n  prettier: 3.9.9\nonlyBuiltDependencies: []\n",
  });
  assert.deepEqual(entry.candidates, [
    {
      path: "package.json",
      decision: "include",
      reason: matches("package.json"),
      evidence: ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"],
    },
  ]);
  assert.equal(entry.noScope, undefined);
});

test("reads package.json workspaces and their exclusions", (t) => {
  const { entry } = drafted(t, {
    "package.json": manifest({ workspaces: ["packages/**", "!packages/old"] }),
    "pnpm-lock.yaml": "",
    "packages/a/b/package.json": member(),
    "packages/old/package.json": member(),
  });
  assert.deepEqual(
    entry.candidates.map(({ path, decision }) => [path, decision]),
    [
      ["package.json", "exclude"],
      ["packages/a/b/package.json", "include"],
    ],
  );
  assert.equal(entry.unresolved.length, 1);
  assert.match(entry.unresolved[0], /`packages\/old\/package.json`/);
});

test("keeps a fixture package excluded despite its own pnpm settings or workspace", (t) => {
  const conforming = {
    "package.json": manifest(),
    "pnpm-lock.yaml": "",
  };
  const unmaintained = (path, directory) =>
    `\`${path}\` lies under \`${directory}\`, which holds fixtures, generated output, or copied code rather than a maintained Project, and no workspace outside it lists it.`;
  const { entry } = drafted(t, {
    ...conforming,
    // A settings-only fixture package with its own lockfile and catalog.
    "test/fixtures/app/package.json": manifest(),
    "test/fixtures/app/pnpm-lock.yaml": "",
    "test/fixtures/app/pnpm-workspace.yaml":
      "catalog:\n  oxlint: 1.86.0\nonlyBuiltDependencies: []\n",
    // A fixture workspace whose own configuration lists its member.
    "test/fixtures/mono/package.json": manifest(),
    "test/fixtures/mono/pnpm-lock.yaml": "",
    "test/fixtures/mono/pnpm-workspace.yaml": "packages:\n- packages/*\n",
    "test/fixtures/mono/packages/a/package.json": member(),
  });
  assert.deepEqual(entry.candidates, [
    {
      path: "package.json",
      decision: "include",
      reason: matches("package.json"),
      evidence: ["package.json", "pnpm-lock.yaml"],
    },
    ...[
      "test/fixtures/app/package.json",
      "test/fixtures/mono/package.json",
      "test/fixtures/mono/packages/a/package.json",
    ].map((path) => ({
      path,
      decision: "exclude",
      reason: unmaintained(path, "test/fixtures"),
      evidence: [path],
    })),
  ]);
  assert.deepEqual(entry.unresolved, []);
});

test("takes a fixture workspace's members as Projects when an outer workspace lists them", (t) => {
  const { entry } = drafted(t, {
    "package.json": manifest({ name: "root" }),
    "pnpm-lock.yaml": "",
    "pnpm-workspace.yaml": "packages:\n  - 'fixtures/**'\n",
    "fixtures/mono/package.json": manifest({ name: "mono" }),
    "fixtures/mono/pnpm-lock.yaml": "",
    "fixtures/mono/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
    "fixtures/mono/packages/a/package.json": member(),
  });
  assert.deepEqual(
    entry.candidates.map(({ path, decision, reason }) => [
      path,
      decision,
      reason,
    ]),
    [
      [
        "fixtures/mono/package.json",
        "exclude",
        workspaceRoot("fixtures/mono/package.json"),
      ],
      [
        "fixtures/mono/packages/a/package.json",
        "include",
        matches("fixtures/mono/packages/a/package.json"),
      ],
      ["package.json", "exclude", workspaceRoot("package.json")],
    ],
  );
  assert.deepEqual(entry.unresolved, []);
});

test("drafts members from common pnpm-workspace.yaml forms", async (t) => {
  for (const [
    name,
    pnpmWorkspace,
    members,
  ] of /** @type {[string, string, string[]][]} */ ([
    [
      "indentationless block",
      "packages:\n- apps/*\n- 'libs/*' # libs\n",
      ["apps/web", "libs/core"],
    ],
    [
      "flow sequence",
      'packages: [apps/*, "libs/*"] # members\n',
      ["apps/web", "libs/core"],
    ],
    [
      "leading globstar",
      "packages:\n  - '**/*'\n  - '!libs/**'\n",
      ["apps", "apps/web"],
    ],
    ["quoted negation", "packages:\n  - '*/*'\n  - '!libs/*'\n", ["apps/web"]],
    [
      "brace pattern in a flow sequence",
      'packages: ["{apps,libs}/*"]\n',
      ["apps/web", "libs/core"],
    ],
    [
      "multi-line flow sequence",
      "packages: [\n  'apps/*', # apps\n  \"libs/*\",\n]\n",
      ["apps/web", "libs/core"],
    ],
  ]))
    await t.test(name, (st) => {
      const { entry } = drafted(st, {
        "package.json": manifest({ name: "root" }),
        "pnpm-lock.yaml": "",
        "pnpm-workspace.yaml": pnpmWorkspace,
        "apps/package.json": member(),
        "apps/web/package.json": member(),
        "libs/core/package.json": member(),
      });
      assert.deepEqual(
        entry.candidates
          .filter((candidate) => candidate.decision === "include")
          .map((candidate) => candidate.path),
        members.map((directory) => `${directory}/package.json`),
      );
    });
});

test("excludes a fixture-only directory", (t) => {
  const { entry } = drafted(t, {
    "package.json": manifest(),
    "pnpm-lock.yaml": "",
    "test/fixtures/broken-app/package.json": '{"name":"broken-app"}\n',
    "dist/package.json": '{"type":"module"}\n',
  });
  assert.deepEqual(entry.candidates.slice(0, 2), [
    {
      path: "dist/package.json",
      decision: "exclude",
      reason:
        "`dist/package.json` lies under `dist`, which holds fixtures, generated output, or copied code rather than a maintained Project, and no workspace outside it lists it.",
      evidence: ["dist/package.json"],
    },
    {
      path: "package.json",
      decision: "include",
      reason: matches("package.json"),
      evidence: ["package.json", "pnpm-lock.yaml"],
    },
  ]);
  assert.deepEqual(entry.candidates[2], {
    path: "test/fixtures/broken-app/package.json",
    decision: "exclude",
    reason:
      "`test/fixtures/broken-app/package.json` lies under `test/fixtures`, which holds fixtures, generated output, or copied code rather than a maintained Project, and no workspace outside it lists it.",
    evidence: ["test/fixtures/broken-app/package.json"],
  });
  assert.deepEqual(entry.unresolved, []);
});

test("drafts no scope for a repository with no Node.js project", (t) => {
  const { entry } = drafted(t, {
    "README.md": "# Tool\n",
    "main.py": "print('hello')\n",
  });
  assert.deepEqual(entry, {
    id: "typescript-node-stack",
    coverage: `${coverage} The repository holds no Node.js Project, so the declaration has no scope.`,
    candidates: [],
    unresolved: [],
    noScope: true,
  });
});

test("drafts no scope, with the exclusions, when every Project differs", (t) => {
  const { entry } = drafted(t, {
    "package.json": manifest({ packageManager: "npm@11.6.0" }),
    "package-lock.json": "{}\n",
  });
  assert.deepEqual(entry, {
    id: "typescript-node-stack",
    coverage: `${coverage} No Project matches the stack, so the declaration has no scope; each differing Project stays out until a migration brings it in.`,
    candidates: [
      {
        path: "package.json",
        decision: "exclude",
        reason: differs("package.json", [
          "Set `packageManager` to `pnpm@11.x.y` in the workspace root `package.json`; it is `npm@11.6.0`.",
          "Add `pnpm-lock.yaml` at the workspace root, `pnpm-lock.yaml`.",
        ]),
        evidence: ["package.json"],
      },
    ],
    unresolved: [],
    noScope: true,
  });
});

test("asks about a manifest that no workspace lists and no rule decides", (t) => {
  const { entry } = drafted(t, {
    "package.json": manifest(),
    "pnpm-lock.yaml": "",
    "scripts/helper/package.json": manifest(),
  });
  assert.deepEqual(entry.unresolved, [
    "Is `scripts/helper/package.json` the manifest of a maintained Project? No workspace lists it. If it is, include it when it matches the stack, or exclude it naming its differences; otherwise exclude it as no maintained Project.",
  ]);
  assert.deepEqual(
    entry.candidates.map(({ path }) => path),
    ["package.json"],
  );
});

test("asks about a workspace configuration it cannot read", (t) => {
  const { entry } = drafted(t, {
    "package.json": manifest(),
    "pnpm-lock.yaml": "",
    "pnpm-workspace.yaml": "packages: &members\n  - apps/*\n",
    "apps/web/package.json": member(),
  });
  assert.deepEqual(entry.unresolved, [
    "`pnpm-workspace.yaml` states its workspace members in a form the drafter cannot read. Which manifests under it belong to maintained Projects? Include each one that matches the stack and exclude the rest with their reasons.",
  ]);
  assert.deepEqual(entry.candidates, [
    {
      path: "package.json",
      decision: "exclude",
      reason: differs("package.json", [
        "State the workspace members of `pnpm-workspace.yaml` as a list of plain or quoted patterns, which the check reads.",
      ]),
      evidence: ["package.json"],
    },
  ]);
  assert.equal(entry.noScope, true);
});

test("leaves out Repository Standards product state and node_modules", (t) => {
  const { entry } = drafted(t, {
    "package.json": manifest(),
    "pnpm-lock.yaml": "",
    ".repo-standards/runtime/package.json": "{}\n",
    "node_modules/oxlint/package.json": "{}\n",
  });
  assert.deepEqual(
    entry.candidates.map(({ path }) => path),
    ["package.json"],
  );
  assert.deepEqual(entry.unresolved, []);
});

test("every Project it includes passes the stack check", (t) => {
  const { root, entry } = drafted(t, {
    "package.json": manifest({ workspaces: ["packages/*"] }),
    "pnpm-lock.yaml": "",
    "packages/a/package.json": member(),
    "packages/b/package.json": member({ scripts: {} }),
  });
  const paths = entry.candidates
    .filter((candidate) => candidate.decision === "include")
    .map((candidate) => candidate.path);
  assert.deepEqual(paths, ["packages/a/package.json"]);
  const outcome = invokeCheck(check, root, {
    operation: {
      declaration: "typescript-node-stack",
      phase: "checks",
      id: "typescript-node-stack-manifests",
    },
    allowedTargets: { paths, directories: [] },
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed", outcome.result.message);
});

test("drafts the same proposal from its declared retained source layout", (t) => {
  const files = {
    "package.json": manifest({
      devDependencies: { oxlint: "catalog:", prettier: "catalog:tools" },
    }),
    "pnpm-lock.yaml": "",
    "pnpm-workspace.yaml": catalogYaml,
  };
  const acquired = drafted(t, files);
  const retained = drafted(t, files, {
    script: retainedCheck(t, drafterPath),
  });
  assert.deepEqual(retained.entry, acquired.entry);
});

test("retained discovery includes a nested maintained root alongside its member", (t) => {
  const { entry } = drafted(
    t,
    {
      "tools/package.json": manifest({ main: "dist/index.js" }),
      "tools/src/index.ts": "export {};\n",
      "tools/pnpm-lock.yaml": "",
      "tools/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "tools/packages/core/package.json": member(),
    },
    { script: retainedCheck(t, drafterPath) },
  );
  assert.deepEqual(
    entry.candidates.map(({ path, decision }) => [path, decision]),
    [
      ["tools/package.json", "include"],
      ["tools/packages/core/package.json", "include"],
    ],
  );
  assert.ok(entry.candidates[0].evidence.includes("tools/src/index.ts"));
  assert.deepEqual(entry.unresolved, []);
});

test("keeps noScope and the root question when no confirmed Project matches", (t) => {
  const { entry } = drafted(t, {
    "package.json": manifest(),
    "src/index.ts": "export {};\n",
    "pnpm-lock.yaml": "",
    "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
    "packages/core/package.json": member({ scripts: {} }),
  });
  assert.equal(entry.noScope, true);
  assert.equal(entry.unresolved.length, 1);
  assert.match(entry.unresolved[0], /workspace root `package.json`/);
  assert.deepEqual(
    entry.candidates.map(({ path, decision }) => [path, decision]),
    [["packages/core/package.json", "exclude"]],
  );
});

test("rejects arguments and requests it cannot read with a process error", async (t) => {
  const root = projectCopy(t, { "package.json": manifest() });
  for (const [
    name,
    options,
    message,
  ] of /** @type {[string, object, RegExp][]} */ ([
    ["an argument", { args: ["--fast"] }, /Unknown argument --fast/],
    [
      "text that is not JSON",
      { input: "draft" },
      /must hold a repo-standards\/discovery\/v1 request/,
    ],
    [
      "another format",
      { input: request(root, { format: "repo-standards/operation/v2" }) },
      /must hold a repo-standards\/discovery\/v1 request/,
    ],
    [
      "another declaration",
      { input: request(root, { declaration: "documentation" }) },
      /names the `documentation` declaration/,
    ],
    [
      "a relative project root",
      { input: request(root, { projectRoot: "project" }) },
      /projectRoot must be an absolute path/,
    ],
  ]))
    await t.test(name, () => {
      const outcome = draft(root, options);
      assert.equal(outcome.status, 1);
      assert.equal(outcome.stdout, "");
      assert.match(outcome.stderr, message);
    });
});

test("differential workspace regressions raise a discovery question through retained resources", (t) => {
  const retained = retainedCheck(t, drafterPath);
  for (const text of unsupportedWorkspaceYaml) {
    const { entry } = drafted(
      t,
      {
        "package.json": manifest(),
        "pnpm-lock.yaml": "",
        "pnpm-workspace.yaml": text,
        "packages/cli/package.json": member(),
      },
      { script: retained },
    );
    assert.equal(entry.noScope, true, text);
    assert.equal(entry.unresolved.length, 1, text);
    assert.match(
      entry.unresolved[0],
      /workspace members in a form the drafter cannot read/,
      text,
    );
    assert.ok(
      entry.candidates.every(({ decision }) => decision === "exclude"),
      text,
    );
  }
});

test("nested and duplicate catalogs never include a Project through retained discovery", (t) => {
  const retained = retainedCheck(t, drafterPath);
  for (const [text, specifier] of unsupportedCatalogYaml) {
    const { entry } = drafted(
      t,
      {
        "package.json": manifest({
          devDependencies: { oxlint: specifier, prettier: "3.9.9" },
        }),
        "pnpm-lock.yaml": "",
        "pnpm-workspace.yaml": text,
      },
      { script: retained },
    );
    assert.equal(entry.noScope, true, text);
    assert.ok(
      entry.candidates.every(({ decision }) => decision === "exclude"),
      text,
    );
    assert.match(
      entry.candidates[0].reason,
      /no catalog.*defines for `oxlint`|State the workspace members/,
      text,
    );
  }
});
