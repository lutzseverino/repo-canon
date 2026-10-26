import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
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
  isWorkspaceMember,
  pnpmCatalogs,
  pnpmWorkspacePackages,
} from "../operations/lib/typescript-node-stack.mjs";

import {
  workspaceYamlCases,
  flowYamlCases,
  catalogYaml,
  unsupportedWorkspaceYaml,
  unsupportedCatalogYaml,
} from "./helpers/stack-yaml.mjs";

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

function failedMessage(result) {
  assert.equal(result.status, "failed", result.message);
  return result.message.replace(
    /^The typescript-node stack needs correction: /,
    "",
  );
}

// The corrections of a single-path result, with the path each one names
// removed: the message must open with that path, and name no other path.
function corrections(result) {
  const message = failedMessage(result);
  const [, path] = /^`([^`]+)`: /.exec(message) ?? [];
  assert.ok(path, message);
  const prefix = `\`${path}\`: `;
  for (const [named] of message.matchAll(/`[^`]+\/?package\.json`: /g))
    assert.equal(named, prefix, message);
  return message.replaceAll(prefix, "");
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
  for (const [
    engines,
    current,
  ] of /** @type {[{ node: string } | undefined, string][]} */ ([
    [undefined, "it is missing"],
    [{ node: "lts" }, "`lts` is not a version range the check reads"],
  ]))
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

test("resolves catalog specifiers through the workspace root's pnpm-workspace.yaml", async (t) => {
  const pnpmWorkspace = `packages:
  - packages/*
catalog:
  oxlint: 1.86.0
  prettier: "^3.0.0"
catalogs:
  legacy:
    prettier: 2.8.8
`;
  const files = (devDependencies) => ({
    ...workspace,
    "pnpm-workspace.yaml": pnpmWorkspace,
    "packages/cli/package.json": manifest({ devDependencies }),
  });
  await t.test("default and named catalogs", (st) => {
    const result = check(
      st,
      files({ oxlint: "catalog:", prettier: "catalog:default" }),
      ["packages/cli/package.json"],
    );
    assert.equal(result.status, "passed", result.message);
  });
  await t.test("a catalog with the wrong major", (st) => {
    assert.equal(
      corrections(
        check(st, files({ oxlint: "catalog:", prettier: "catalog:legacy" }), [
          "packages/cli/package.json",
        ]),
      ),
      "Declare `prettier` at major 3 in `packages/cli/package.json` or its workspace root `package.json`; `packages/cli/package.json` declares `catalog:legacy`, which its catalog resolves to `2.8.8`, which admits major 2.",
    );
  });
  await t.test("an undefined catalog entry", (st) => {
    assert.equal(
      corrections(
        check(st, files({ oxlint: "catalog:tools", prettier: "catalog:" }), [
          "packages/cli/package.json",
        ]),
      ),
      "Declare `oxlint` at major 1 in `packages/cli/package.json` or its workspace root `package.json`; `packages/cli/package.json` declares `catalog:tools`, which no catalog of the workspace root's `pnpm-workspace.yaml` defines for `oxlint`.",
    );
  });
});

// The pnpm-workspace.yaml forms pnpm workspaces commonly use. A form the
// reader does not decode reads as null, which the drafter asks about.
test("reads the packages of common pnpm-workspace.yaml forms", () => {
  for (const [text, expected] of workspaceYamlCases)
    assert.deepEqual(pnpmWorkspacePackages(text), expected, text);
});

test("splits flow sequences only at commas outside quotes and nesting", () => {
  for (const [text, expected] of flowYamlCases)
    assert.deepEqual(pnpmWorkspacePackages(text), expected, text);
});

// The reader's contract: a form it does not decode is unreadable, never a
// narrower or wider member list, so the drafter asks about the workspace and
// the check names the configuration instead of reading root facts elsewhere.
test("reads every unsupported pnpm-workspace.yaml form as an unreadable workspace", async (t) => {
  for (const text of [
    "packages: &members\n  - packages/*\n",
    "packages:\n  - *members\n",
    "packages: |\n  packages/*\n",
    "packages:\n  - packages/*\n    continued\n",
    "packages:\n  - key: value\n",
    "packages:\n  - - packages/*\n",
    '"packages":\n  - packages/*\n',
    "{packages: [packages/*]}\n",
  ])
    await t.test(text, (st) => {
      assert.equal(pnpmWorkspacePackages(text), null);
      assert.equal(
        corrections(
          check(st, { ...workspace, "pnpm-workspace.yaml": text }, [
            "packages/cli/package.json",
          ]),
        ),
        "Cannot read workspace configuration from `pnpm-workspace.yaml`: unsupported or malformed YAML anywhere in the document can prevent reading its members, even when `packages` is a supported list of plain or quoted patterns. Use supported YAML forms throughout the document.",
      );
    });
});

test("reads a member listed through a brace pattern in a flow sequence", (t) => {
  const result = check(
    t,
    {
      ...workspace,
      "pnpm-workspace.yaml": 'packages: ["packages/{cli,web}"]\n',
    },
    ["packages/cli/package.json"],
  );
  assert.equal(result.status, "passed", result.message);
});

test("matches workspace globs, a leading globstar matching zero directories", () => {
  for (const [patterns, directory, expected] of [
    [["**/*"], "cli", true],
    [["**/cli"], "cli", true],
    [["**/cli"], "tools/cli", true],
    [["packages/*"], "packages/a", true],
    [["packages/*"], "packages/a/b", false],
    [["packages/**"], "packages/a/b", true],
    [["./apps/"], "apps", true],
    [["packages/**", "!packages/old"], "packages/old", false],
    [["**", "!**/test/**"], "lib/test/fixture", false],
    [["**/*"], "lib/node_modules/x", false],
  ])
    assert.equal(
      isWorkspaceMember(patterns, directory),
      expected,
      `${patterns} ${directory}`,
    );
});

test("reads default and named catalogs with comments and quoted names", () => {
  const catalogs = pnpmCatalogs(catalogYaml);
  assert.deepEqual(
    Object.fromEntries(
      [...catalogs].map(([name, entries]) => [
        name,
        Object.fromEntries(entries),
      ]),
    ),
    {
      default: { oxlint: "1.86.0", "@types/node": "^24.0.0" },
      tools: { prettier: "3.9.9" },
      legacy: { prettier: "2.8.8" },
    },
  );
});

test("reads the root facts of an indentationless workspace sequence and a leading globstar", async (t) => {
  for (const [name, pnpmWorkspace, member] of [
    [
      "indentationless",
      "packages:\n- packages/*\n",
      "packages/cli/package.json",
    ],
    ["leading globstar", "packages:\n  - '**/cli'\n", "cli/package.json"],
  ])
    await t.test(name, (st) => {
      const { "packages/cli/package.json": memberManifest, ...root } =
        workspace;
      const result = check(
        st,
        {
          ...root,
          "pnpm-workspace.yaml": pnpmWorkspace,
          [member]: memberManifest,
        },
        [member],
      );
      assert.equal(result.status, "passed", result.message);
    });
});

test("resolves a named catalog whose header carries a comment", (t) => {
  const result = check(
    t,
    {
      ...workspace,
      "pnpm-workspace.yaml":
        "packages:\n  - packages/*\ncatalogs:\n  tools: # shared tools\n    oxlint: 1.86.0\n    prettier: 3.9.9\n",
      "packages/cli/package.json": manifest({
        devDependencies: { oxlint: "catalog:tools", prettier: "catalog:tools" },
      }),
    },
    ["packages/cli/package.json"],
  );
  assert.equal(result.status, "passed", result.message);
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

test("reports every correction for each path, including shared workspace-root ones", (t) => {
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
    failedMessage(result),
    ["apps/web/package.json", "libs/core/package.json"]
      .flatMap((path) => [
        `\`${path}\`: Set \`packageManager\` to \`pnpm@11.x.y\` in the workspace root \`package.json\`; it is missing.`,
        `\`${path}\`: Add \`pnpm-lock.yaml\` at the workspace root, \`pnpm-lock.yaml\`.`,
        `\`${path}\`: Add a \`validate\` script to \`${path}\` that runs the Project's checks.`,
      ])
      .join(" "),
  );
});

test("names a missing or unreadable confirmed manifest", (t) => {
  assert.equal(
    corrections(
      check(t, { "README.md": "# Fixture\n" }, ["tool/package.json"]),
    ),
    "`tool/package.json` is missing, or is not a regular file inside the project; a Project is one readable `package.json`.",
  );
  assert.equal(
    corrections(check(t, { "package.json": "[]\n" }, ["package.json"])),
    "`package.json` is not a JSON object; a Project is one readable `package.json`.",
  );
});

test("refuses a confirmed manifest under a symbolic link that leaves the project", (t) => {
  const outside = mkdtempSync(join(tmpdir(), "repo-canon-outside-"));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  mkdirSync(join(outside, "a"));
  writeFileSync(join(outside, "a/package.json"), manifest());
  writeFileSync(join(outside, "pnpm-lock.yaml"), "");
  const project = fixture(standalone);
  t.after(project.close);
  symlinkSync(outside, join(project.root, "pkgs"), "dir");
  const outcome = invokeCheck(script, project.root, {
    operation: {
      declaration: "typescript-node-stack",
      phase: "checks",
      id: "typescript-node-stack-manifests",
    },
    allowedTargets: { paths: ["pkgs/a/package.json"], directories: [] },
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(
    corrections(outcome.result),
    "`pkgs/a/package.json` is missing, or is not a regular file inside the project; a Project is one readable `package.json`.",
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
    "Cannot read workspace configuration from `pnpm-workspace.yaml`: unsupported or malformed YAML anywhere in the document can prevent reading its members, even when `packages` is a supported list of plain or quoted patterns. Use supported YAML forms throughout the document.",
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
    {
      ...workspace,
      "package.json": manifest({
        devDependencies: { oxlint: "catalog:", prettier: "catalog:tools" },
      }),
      "pnpm-workspace.yaml": `packages: ['packages/*']\n${catalogYaml}linkWorkspacePackages: true\nresolutionMode: 1\n`,
    },
    ["package.json", "packages/cli/package.json"],
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

test("differential workspace regressions stay unreadable through the retained check", (t) => {
  const retained = retainedCheck(t, scriptPath);
  for (const text of unsupportedWorkspaceYaml) {
    const result = check(
      t,
      { ...workspace, "pnpm-workspace.yaml": text },
      ["packages/cli/package.json"],
      retained,
    );
    assert.equal(result.status, "failed", text);
    assert.match(
      corrections(result),
      /Cannot read workspace configuration from `pnpm-workspace.yaml`: unsupported or malformed YAML anywhere in the document can prevent reading its members, even when `packages` is a supported list/,
      text,
    );
  }
});

test("nested and duplicate catalog entries stay unresolved through the retained check", (t) => {
  const retained = retainedCheck(t, scriptPath);
  for (const [text, specifier] of unsupportedCatalogYaml) {
    const result = check(
      t,
      {
        ...standalone,
        "package.json": manifest({
          devDependencies: { oxlint: specifier, prettier: "3.9.9" },
        }),
        "pnpm-workspace.yaml": text,
      },
      ["package.json"],
      retained,
    );
    assert.equal(result.status, "failed", text);
    assert.match(
      corrections(result),
      /no catalog.*defines for `oxlint`|Cannot read workspace configuration/,
      text,
    );
  }
});
