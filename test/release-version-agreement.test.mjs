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

// Every version in the development and authoring documents that is not the CLI:
// the context locates the mention, and the version is the part to change.
const otherVersions = [
  { path: developmentGuide, context: "Git 2.32.0", version: "2.32.0" },
  { path: sourceProfile, context: "Marked 18.0.13", version: "18.0.13" },
  { path: sourceProfile, context: "parse5 8.0.1", version: "8.0.1" },
  { path: sourceProfile, context: "`>=24.0.0 <25.0.0`", version: "24.0.0" },
  { path: sourceProfile, context: "`>=24.0.0 <25.0.0`", version: "25.0.0" },
  { path: sourceProfile, context: "Git 2.18.0", version: "2.18.0" },
  { path: sourceProfile, context: "GitHub CLI 2.57.0", version: "2.57.0" },
  {
    path: authoringNotes,
    context: "stable `1.0.0` baseline",
    version: "1.0.0",
  },
];

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

// The offsets of every version in a text, found by the test itself rather than
// by the checker's classifier.
function versionOffsets(text) {
  return [...text.matchAll(/(?<![\w.])v?\d+\.\d+\.\d+(?!\.?\d)/g)].map(
    (match) => match.index,
  );
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

test("changing any one named Repo Canon version fails the agreement", () => {
  const files = workingTree();
  const release = selectedRelease(files);
  for (const path of [readme, adoptionGuide]) {
    const variants = oneOccurrenceChanged(files.get(path), release, "v99.0.0");
    assert.ok(variants.length > 0, `${path} names ${release}`);
    for (const variant of variants) {
      const changed = new Map(files).set(path, variant);
      assert.notDeepEqual(
        versionDisagreements(reader(changed)),
        [],
        `${path} with one ${release} changed`,
      );
    }
  }
});

test("changing any one named CLI version fails the agreement", () => {
  const files = workingTree();
  const floor = cliFloor(files);
  for (const path of [adoptionGuide, ciWorkflow]) {
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

test("changing another version in the development and authoring documents keeps the agreement", () => {
  const files = workingTree();
  for (const { path, context, version } of otherVersions) {
    const text = files.get(path);
    assert.equal(
      text.split(context).length,
      2,
      `${path} names ${context} once`,
    );
    const variant = text.replace(context, context.replace(version, "99.0.0"));
    const changed = new Map(files).set(path, variant);
    assert.deepEqual(
      versionDisagreements(reader(changed)),
      [],
      `${path} with ${version} in ${context} changed`,
    );
  }
});

test("every version in the development and authoring documents is the CLI floor or another listed version", () => {
  const files = workingTree();
  const floor = cliFloor(files);
  for (const path of developmentDocuments) {
    const text = files.get(path);
    const listed = new Set();
    for (const { context, version } of otherVersions.filter(
      (other) => other.path === path,
    )) {
      listed.add(text.indexOf(context) + context.indexOf(version));
    }
    for (const offset of versionOffsets(text)) {
      const version = text.slice(offset).match(/^v?\d+\.\d+\.\d+/)[0];
      const line = text.slice(0, offset).split("\n").length;
      assert.ok(
        version === floor || listed.has(offset),
        `${path}:${line} names ${version}, which the tests do not cover`,
      );
    }
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
