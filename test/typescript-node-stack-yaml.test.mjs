import assert from "node:assert/strict";
import { inspect } from "node:util";
import { test } from "node:test";
import { parseDocument } from "yaml";
import {
  pnpmWorkspacePackages,
  pnpmCatalogs,
} from "../operations/lib/typescript-node-stack.mjs";
import {
  workspaceYamlCases,
  flowYamlCases,
  catalogYaml,
  unsupportedWorkspaceYaml,
  unsupportedCatalogYaml,
} from "./helpers/stack-yaml.mjs";

function compare(text, label) {
  // Map keys and scalar values retain their YAML types. In particular, a
  // boolean or numeric pattern/version must never compare equal to a string.
  const document = parseDocument(text, { uniqueKeys: true });
  const errors = document.errors.map((error) => error.message);
  let reference;
  try {
    if (errors.length === 0) reference = document.toJS({ mapAsMap: true });
  } catch (error) {
    errors.push(error.message);
  }
  const patterns = pnpmWorkspacePackages(text);
  const catalogs = pnpmCatalogs(text);
  const context = `${label}\nInput: ${JSON.stringify(text)}\nReader: ${inspect({ patterns, catalogs }, { depth: null })}\nReference: ${inspect({ reference, errors }, { depth: null })}`;
  if (patterns !== null) {
    assert.equal(errors.length, 0, context);
    const expected =
      reference instanceof Map && reference.has("packages")
        ? reference.get("packages")
        : [];
    assert.ok(Array.isArray(expected), context);
    assert.ok(
      expected.every((pattern) => typeof pattern === "string"),
      context,
    );
    assert.deepEqual(patterns, expected, context);
  }
  for (const [name, entries] of catalogs) {
    for (const [key, value] of entries) {
      assert.equal(errors.length, 0, context);
      const expected =
        name === "default"
          ? (reference?.get?.("catalog") ??
            reference?.get?.("catalogs")?.get?.("default"))
          : reference?.get?.("catalogs")?.get?.(name);
      assert.ok(expected instanceof Map && expected.has(key), context);
      assert.equal(typeof expected.get(key), "string", context);
      assert.equal(value, expected.get(key), context);
    }
  }
}

test("accepted workspace and catalog fixtures agree with YAML", () => {
  for (const [index, [text]] of [
    ...workspaceYamlCases,
    ...flowYamlCases,
  ].entries())
    compare(text, `existing workspace fixture ${index}`);
  compare(catalogYaml, "existing catalog fixture");
});

test("accepted scalar patterns agree with YAML across block and flow lists", () => {
  const scalars = [
    "apps/*",
    "'apps/{a,b}'",
    '"a\\\"b"',
    "'it''s'",
    '"c\\\\d"',
    "true",
    "False",
    "null",
    "~",
    "24",
    "0x18",
    "1.5",
    ".inf",
    ".NaN",
    "'true'",
    '"24"',
    "!tag apps/*",
    "&members apps/*",
    "*members",
  ];
  for (const [index, scalar] of scalars.entries())
    for (const [form, text] of [
      ["block", `packages:\n  - ${scalar}\n`],
      ["indentationless", `packages:\n- ${scalar}\n`],
      ["flow", `packages: [${scalar},]\n`],
    ])
      compare(text, `scalar ${index}, ${form}`);
});

// Exhaustive small products give stable case identifiers, with no random seed
// or unbounded fuzzing. Each failing assertion includes the complete input.
test("workspace boundaries agree with YAML in a deterministic generated corpus", () => {
  const lists = [
    "packages:\n  - apps/*\n  - 'libs/*'\n",
    "packages:\n- apps/*\n- 'libs/*'\n",
    "packages: [apps/*, 'libs/*',]\n",
    "packages: [\n  apps/*, # member\n  'libs/*',\n]\n",
    "packages:\n  - apps/*\n   - libs/*\n",
    "packages:\n  - apps/*\n  continuation\n",
    "packages: [apps/*]\n  continuation\n",
    "packages:\n",
    "packages: # empty\n",
    "packages: null\n",
  ];
  const surroundings = [
    ["", ""],
    ["# before\n", "# after\n"],
    ["---\n", "...\n"],
    ["", "packages: [other/*]\n"],
    ["'packages': [other/*]\n", ""],
    ["", "catalog:\n  oxlint: 1.86.0\n"],
    ["", "onlyBuiltDependencies:\n  - esbuild\n"],
    ["", "---\npackages: [other/*]\n"],
    ["", "broken: [\n"],
  ];
  for (const [listIndex, list] of lists.entries())
    for (const [contextIndex, [before, after]] of surroundings.entries())
      compare(
        `${before}${list}${after}`,
        `workspace ${listIndex}, context ${contextIndex}`,
      );
});

test("catalog entries agree with YAML across generated names, values and nesting", () => {
  const names = [
    "default",
    "tools",
    "'tools'",
    '"tools"',
    "'it''s'",
    '"a\\\"b"',
    "true",
    "24",
  ];
  const keys = ["oxlint", "'@types/node'", '"prettier"', "true", "24"];
  const values = [
    "1.86.0",
    '"3.9.9"',
    "'^24.0.0' # version",
    "'it''s'",
    '"a\\\\b"',
    "true",
    "null",
    "24",
    "1e3",
    "~",
    "{nested: 1.86.0}",
    "\n    nested: 1.86.0",
    "\n    - 1.86.0",
    "|\n    1.86.0",
  ];
  for (const [nameIndex, name] of names.entries())
    for (const [keyIndex, key] of keys.entries())
      for (const [valueIndex, value] of values.entries()) {
        const entry = `  ${key}: ${value}\n`;
        compare(
          `catalog:\n${entry}`,
          `default catalog key ${keyIndex}, value ${valueIndex}`,
        );
        compare(
          `packages: [apps/*]\ncatalogs:\n  ${name}: # named header\n${entry
            .split("\n")
            .map((line) => (line ? `  ${line}` : line))
            .join("\n")}`,
          `named catalog ${nameIndex}, key ${keyIndex}, value ${valueIndex}`,
        );
      }
});

test("duplicate catalog keys and mapping boundaries never resolve a different entry", () => {
  const bodies = [
    "catalog:\n  oxlint: 1.86.0\n  oxlint: 1.99.0\n",
    "catalog:\n  oxlint: 1.86.0\ncatalog:\n  prettier: 3.9.9\n",
    "catalogs:\n  tools:\n    oxlint: 1.86.0\n  tools:\n    prettier: 3.9.9\n",
    "catalogs:\n  tools:\n    oxlint: 1.86.0\ncatalogs:\n  other:\n    prettier: 3.9.9\n",
    "catalog:\n  wrapper:\n    oxlint: 1.86.0\n  prettier: 3.9.9\n",
    "catalogs:\n  tools:\n    wrapper:\n      oxlint: 1.86.0\n    prettier: 3.9.9\n",
    "catalogs:\n  tools:\n    oxlint: 1.86.0\n  other: scalar\n    prettier: 3.9.9\n",
    "catalogs:\n  tools:\n    oxlint: 1.86.0\n   prettier: 3.9.9\n",
    "catalog: &tools\n  oxlint: 1.86.0\n",
    "catalogs: {tools: {oxlint: 1.86.0}}\n",
  ];
  for (const [index, body] of bodies.entries()) {
    compare(body, `catalog boundary ${index}, no packages`);
    compare(
      `packages: [apps/*]\n${body}`,
      `catalog boundary ${index}, with packages`,
    );
  }
});

test("quoted scalars and flow delimiters agree at generated rejection boundaries", () => {
  const scalars = [
    "apps/*",
    "'apps/*'",
    '"apps/*"',
    "'it''s'",
    '"a\\/b"',
    '"a\\tb"',
    '"a\\nb"',
    "'a\nb'",
    "a\tb",
    "'a\tb'",
    "[apps/*]",
    "{a: b}",
    "a: b",
    "? key",
    "- item",
    "@bad",
    "`bad",
  ];
  const endings = ["", " # comment", "#adjacent", " # comment [ ignored ]"];
  for (const [index, scalar] of scalars.entries())
    for (const [endingIndex, ending] of endings.entries()) {
      compare(
        `packages:\n  - ${scalar}${ending}\n`,
        `block quote ${index}, ending ${endingIndex}`,
      );
      compare(
        `packages: [${scalar}${ending}\n, 'libs/*',]\n`,
        `flow quote ${index}, ending ${endingIndex}`,
      );
      compare(
        `catalog:\n  oxlint: ${scalar}${ending}\n`,
        `catalog quote ${index}, ending ${endingIndex}`,
      );
    }
});

test("integration regression inputs obey the same differential contract", () => {
  for (const [index, text] of unsupportedWorkspaceYaml.entries())
    compare(text, `workspace regression ${index}`);
  for (const [index, [text]] of unsupportedCatalogYaml.entries())
    compare(text, `catalog regression ${index}`);
});

test("supported patterns and catalogs survive unrelated non-string settings", () => {
  const text = `packages: [apps/*]
autoInstallPeers: true
settings:
  retries: 3
catalog:
  oxlint: 1.86.0
  unsupported: 24
catalogs:
  tools:
    prettier: 3.9.9
    unsupported: false
`;
  compare(text, "unrelated non-string settings");
  assert.deepEqual(pnpmWorkspacePackages(text), ["apps/*"]);
  assert.deepEqual(
    pnpmCatalogs(text),
    new Map([
      ["default", new Map([["oxlint", "1.86.0"]])],
      ["tools", new Map([["prettier", "3.9.9"]])],
    ]),
  );
});
