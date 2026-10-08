import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the repository license has its own contextual file declaration", () => {
  const manifest = readFileSync(
    new URL("../standards.yaml", import.meta.url),
    "utf8",
  );
  const declaration = manifest.match(
    /^ {4}repository-license:\n((?: {6}.+\n|\n)+)/m,
  )?.[1];

  assert.ok(declaration, "the complete profile declares repository-license");
  assert.deepEqual(
    declaration
      .trim()
      .split("\n")
      .map((line) => line.trim()),
    [
      "kind: file",
      "target: LICENSE",
      "guidance: guidance/repository-license.md",
    ],
    "the license is contextual, with guidance only and no checks or fixes",
  );
  assert.equal(
    [...manifest.matchAll(/^\s+target: LICENSE$/gm)].length,
    1,
    "only repository-license owns LICENSE",
  );
  assert.match(
    manifest,
    /^ {4}repository-readme:\n {6}kind: file\n {6}target: README\.md\n/m,
    "the Repository README retains its separate README.md target",
  );
});
