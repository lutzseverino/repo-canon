import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { authoredDiagnostics, vendoredFiles } from "../scripts/typecheck.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const vendored = `vendor/postern/postern.mjs(1271,36): error TS2339: Property 'botMarking' does not exist on type 'Readonly<{}>'.
vendor/marked/marked.esm.js(44,5129): error TS2322: Type '{ fences: { exec: () => any; }; }' is not assignable to type '{ fences: RegExp; }'.
  Types of property 'fences' are incompatible.
    Type '{ exec: () => any; }' is missing the following properties from type 'RegExp': test, source, global, ignoreCase, and 14 more.
`;

test("diagnostics located in a vendored bundle are not the authored code's", () => {
  assert.deepEqual(authoredDiagnostics(vendored), []);
  assert.deepEqual(authoredDiagnostics(""), []);
});

test("an authored diagnostic is reported with its continuation lines", () => {
  const authored = `operations/lib/github-operation.mjs(93,34): error TS2339: Property 'code' does not exist on type 'Error'.
test/helpers/stack-yaml.mjs(3,5): error TS2322: Type 'number' is not assignable to type 'string'.
  The expected type comes from this index signature.
`;
  assert.deepEqual(authoredDiagnostics(`${vendored}${authored}`), [
    "operations/lib/github-operation.mjs(93,34): error TS2339: Property 'code' does not exist on type 'Error'.",
    "test/helpers/stack-yaml.mjs(3,5): error TS2322: Type 'number' is not assignable to type 'string'.\n  The expected type comes from this index signature.",
  ]);
});

test("a diagnostic located in no file, or in a file beside a bundle, is authored", () => {
  const configuration =
    "error TS5023: Unknown compiler option 'checkJS'.\nvendor/postern/postern-types.mjs(1,1): error TS1005: ';' expected.\n";
  assert.deepEqual(authoredDiagnostics(configuration), [
    "error TS5023: Unknown compiler option 'checkJS'.",
    "vendor/postern/postern-types.mjs(1,1): error TS1005: ';' expected.",
  ]);
});

test("every file the type check treats as vendored exists", () => {
  for (const path of vendoredFiles)
    assert.ok(existsSync(join(root, path)), path);
});
