import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  adoptionGuidePath as adoptionGuide,
  authoringNotesPath as authoringNotes,
  ciWorkflowPath as ciWorkflow,
  developmentGuidePath as developmentGuide,
  readmePath as readme,
  sourceProfilePath as sourceProfile,
  standardsPath as standards,
  versionDisagreements,
} from "../scripts/release/named-versions.mjs";

// The documents that name versions, read from the working tree only: this test
// needs no network access and no tags.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The development and authoring documents that name the CLI as the validation
// baseline or the install version.
const developmentDocuments = [developmentGuide, sourceProfile, authoringNotes];

// A sentence naming versions that are not the CLI: other tools, the Node.js
// version constraint, and a stable baseline.
const otherVersionsSentence =
  "Use Git 99.0.0, GitHub CLI 99.0.0, Marked 99.0.0, parse5 99.0.0, and `node --version` constrained to `>=99.0.0 <100.0.0` since the stable `99.0.0` baseline.";

function workingTree() {
  const files = new Map();
  for (const path of [
    readme,
    adoptionGuide,
    ciWorkflow,
    standards,
    ...developmentDocuments,
  ]) {
    files.set(path, readFileSync(join(root, path), "utf8"));
  }
  return files;
}

function reader(files) {
  return (path) => files.get(path);
}

// Each variant changes exactly one occurrence of a literal version string. An
// occurrence inside a longer version, such as `4.0.0` in `24.0.0`, is not one.
function oneOccurrenceChanged(text, literal, replacement) {
  const variants = [];
  for (
    let index = text.indexOf(literal);
    index !== -1;
    index = text.indexOf(literal, index + 1)
  ) {
    const end = index + literal.length;
    const bounded =
      /(?:^|[^\w.])v?$/.test(text.slice(0, index)) &&
      !/^\.?\d/.test(text.slice(end));
    if (!bounded) continue;
    variants.push(text.slice(0, index) + replacement + text.slice(end));
  }
  return variants;
}

// The release the Repository README selects, read independently of the checker.
function selectedRelease(files) {
  return files.get(readme).match(/releases\/tag\/(v\d+\.\d+\.\d+)/)[1];
}

// The CLI floor, read independently of the checker.
function cliFloor(files) {
  return files.get(standards).match(/repo-standards: ">=(\d+\.\d+\.\d+)"/)[1];
}

test("the named Repo Canon and CLI versions agree on main", () => {
  assert.deepEqual(versionDisagreements(reader(workingTree())), []);
});

test("changing any one named Repo Canon or CLI version fails the agreement", () => {
  const files = workingTree();
  const release = selectedRelease(files);
  const floor = cliFloor(files);
  for (const { paths, named, literal, replacement } of [
    {
      paths: [readme, adoptionGuide],
      named: release,
      literal: release,
      replacement: "v99.0.0",
    },
    {
      paths: [adoptionGuide, ciWorkflow],
      named: `CLI ${floor}`,
      literal: floor,
      replacement: "99.0.0",
    },
  ]) {
    for (const path of paths) {
      const variants = oneOccurrenceChanged(
        files.get(path),
        literal,
        replacement,
      );
      assert.ok(variants.length > 0, `${path} names ${named}`);
      for (const variant of variants) {
        const changed = new Map(files).set(path, variant);
        assert.notDeepEqual(
          versionDisagreements(reader(changed)),
          [],
          `${path} with one ${literal} changed`,
        );
      }
    }
  }
});

test("changing any one CLI version in the development and authoring documents fails the agreement", () => {
  const files = workingTree();
  const floor = cliFloor(files);
  for (const path of developmentDocuments) {
    const variants = oneOccurrenceChanged(files.get(path), floor, "99.0.0");
    assert.ok(variants.length > 0, `${path} names CLI ${floor}`);
    for (const variant of variants) {
      const changed = new Map(files).set(path, variant);
      assert.notDeepEqual(
        versionDisagreements(reader(changed)),
        [],
        `${path} with one ${floor} changed`,
      );
    }
  }
});

test("versions of other tools and the stable baseline in the development and authoring documents keep the agreement", () => {
  const files = workingTree();
  for (const path of developmentDocuments) {
    const changed = new Map(files).set(
      path,
      `${files.get(path)}\n${otherVersionsSentence}\n`,
    );
    assert.deepEqual(versionDisagreements(reader(changed)), [], path);
  }
});

test("a version of a tool the agreement does not name fails as a CLI version", () => {
  const files = workingTree();
  for (const path of developmentDocuments) {
    const changed = new Map(files).set(
      path,
      `${files.get(path)}\nUse Docker 99.0.0 or newer.\n`,
    );
    const problems = versionDisagreements(reader(changed));
    assert.ok(
      problems.some(
        (problem) =>
          problem.startsWith(`${path}:`) &&
          problem.includes("names CLI 99.0.0"),
      ),
      `${path}: ${problems.join("\n")}`,
    );
  }
});

test("raising the requires floor alone fails the agreement", () => {
  const files = workingTree();
  const changed = new Map(files).set(
    standards,
    files.get(standards).replace(/>=\d+\.\d+\.\d+/, ">=99.0.0"),
  );
  assert.notDeepEqual(versionDisagreements(reader(changed)), []);
});

test("a requirement without an open-ended minimum fails the agreement", () => {
  const files = workingTree();
  const changed = new Map(files).set(
    standards,
    files.get(standards).replace(/">=(\d+\.\d+\.\d+)"/, '"$1"'),
  );
  assert.match(
    versionDisagreements(reader(changed)).join("\n"),
    /open-ended minimum/,
  );
});

test("the floor is read from any line of the requires block", () => {
  const files = workingTree();
  const changed = new Map(files).set(
    standards,
    files
      .get(standards)
      .replace(/^requires:\n/m, 'requires:\n  another-tool: ">=9.9.9"\n'),
  );
  assert.deepEqual(versionDisagreements(reader(changed)), []);
});

test("other tools named with versions are not taken for the CLI", () => {
  const files = workingTree();
  const guide = `${files.get(adoptionGuide)}\nUse Git 2.99.0 or newer and GitHub CLI 2.99.0 or newer.\n`;
  assert.deepEqual(
    versionDisagreements(reader(new Map(files).set(adoptionGuide, guide))),
    [],
  );
});

test("a document that names no Repo Canon version fails the agreement", () => {
  const files = workingTree();
  const release = selectedRelease(files);
  const changed = new Map(files).set(
    readme,
    files.get(readme).replaceAll(release, "the latest release"),
  );
  assert.match(
    versionDisagreements(reader(changed)).join("\n"),
    /README\.md names no Repo Canon version/,
  );
});
