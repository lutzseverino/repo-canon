import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { stringify } from "yaml";
import {
  declarations,
  parseStandards,
} from "../scripts/standards-declarations.mjs";

const manifest = `
defaults:
  declarations:
    skill-example:
      kind: skill
      name: example
      source: .agents/skills/example
    configuration:
      kind: file
      target: config.json
      exact: source/config.json
      rules: rules/config.md
    documentation:
      kind: repository
      checks:
        - id: structure
          run:
            script: operations/check.mjs
            resources: [operations/lib, vendor/parser]
            arguments: [--check, documentation]
      fixes:
        - id: repair
          run:
            script: operations/fix.mjs
            resources: []
            arguments: [--write]
profiles:
  standard:
    declarations: {}
  minimal:
    declarations:
      documentation: {exclude: true}
      configuration:
        kind: file
        target: config.json
        exact: source/minimal.json
      extra:
        kind: file
        target: extra.json
        exact: source/extra.json
`;

test("declarations resolve profile defaults, replacements and exclusions regardless of YAML layout", (t) => {
  const root = mkdtempSync(join(tmpdir(), "repo-canon-declarations-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const skill = {
    id: "skill-example",
    kind: "skill",
    name: "example",
    source: ".agents/skills/example",
  };
  const file = {
    id: "configuration",
    kind: "file",
    target: "config.json",
    exact: "source/config.json",
    rules: "rules/config.md",
  };
  const expected = {
    standard: [
      skill,
      file,
      {
        id: "documentation",
        kind: "repository",
        checks: [
          {
            id: "structure",
            run: {
              script: "operations/check.mjs",
              resources: ["operations/lib", "vendor/parser"],
              arguments: ["--check", "documentation"],
            },
          },
        ],
        fixes: [
          {
            id: "repair",
            run: {
              script: "operations/fix.mjs",
              resources: [],
              arguments: ["--write"],
            },
          },
        ],
      },
    ],
    minimal: [
      skill,
      {
        id: "configuration",
        kind: "file",
        target: "config.json",
        exact: "source/minimal.json",
      },
      {
        id: "extra",
        kind: "file",
        target: "extra.json",
        exact: "source/extra.json",
      },
    ],
  };
  for (const text of [
    manifest,
    stringify(parseStandards(manifest), { indent: 4 }),
    manifest
      .replace(
        "resources: [operations/lib, vendor/parser]",
        "resources: [\n              operations/lib,\n              vendor/parser,\n            ]",
      )
      .replace(
        "arguments: [--check, documentation]",
        "arguments:\n              - --check\n              - documentation",
      ),
  ]) {
    writeFileSync(join(root, "standards.yaml"), text);
    assert.deepEqual(declarations(root), expected);
  }
});
