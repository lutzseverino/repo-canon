import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  adoptionGuidePath as adoptionGuide,
  ciWorkflowPath as ciWorkflow,
  readmePath as readme,
  standardsPath as standards,
  versionDisagreements,
} from '../scripts/release/named-versions.mjs';

// The documents that name versions, read from the working tree only: this test
// needs no network access and no tags.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function workingTree() {
  const files = new Map();
  for (const path of [readme, adoptionGuide, ciWorkflow, standards]) {
    files.set(path, readFileSync(join(root, path), 'utf8'));
  }
  return files;
}

function reader(files) {
  return path => files.get(path);
}

// Each variant changes exactly one occurrence of a literal version string.
function oneOccurrenceChanged(text, literal, replacement) {
  const variants = [];
  for (let index = text.indexOf(literal); index !== -1; index = text.indexOf(literal, index + 1)) {
    variants.push(text.slice(0, index) + replacement + text.slice(index + literal.length));
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

test('the named Repo Canon and CLI versions agree on main', () => {
  assert.deepEqual(versionDisagreements(reader(workingTree())), []);
});

test('changing any one named Repo Canon version fails the agreement', () => {
  const files = workingTree();
  const release = selectedRelease(files);
  for (const path of [readme, adoptionGuide]) {
    const variants = oneOccurrenceChanged(files.get(path), release, 'v99.0.0');
    assert.ok(variants.length > 0, `${path} names ${release}`);
    for (const variant of variants) {
      const changed = new Map(files).set(path, variant);
      assert.notDeepEqual(versionDisagreements(reader(changed)), [], `${path} with one ${release} changed`);
    }
  }
});

test('changing any one named CLI version fails the agreement', () => {
  const files = workingTree();
  const floor = cliFloor(files);
  for (const path of [adoptionGuide, ciWorkflow]) {
    const variants = oneOccurrenceChanged(files.get(path), floor, '99.0.0');
    assert.ok(variants.length > 0, `${path} names CLI ${floor}`);
    for (const variant of variants) {
      const changed = new Map(files).set(path, variant);
      assert.notDeepEqual(versionDisagreements(reader(changed)), [], `${path} with one ${floor} changed`);
    }
  }
});

test('raising the requires floor alone fails the agreement', () => {
  const files = workingTree();
  const changed = new Map(files).set(standards, files.get(standards).replace(/>=\d+\.\d+\.\d+/, '>=99.0.0'));
  assert.notDeepEqual(versionDisagreements(reader(changed)), []);
});

test('a requirement without an open-ended minimum fails the agreement', () => {
  const files = workingTree();
  const changed = new Map(files).set(standards, files.get(standards).replace(/">=(\d+\.\d+\.\d+)"/, '"$1"'));
  assert.match(versionDisagreements(reader(changed)).join('\n'), /open-ended minimum/);
});

test('the floor is read from any line of the requires block', () => {
  const files = workingTree();
  const changed = new Map(files).set(standards, files.get(standards).replace(
    /^requires:\n/m,
    'requires:\n  another-tool: ">=9.9.9"\n',
  ));
  assert.deepEqual(versionDisagreements(reader(changed)), []);
});

test('other tools named with versions are not taken for the CLI', () => {
  const files = workingTree();
  const guide = `${files.get(adoptionGuide)}\nUse Git 2.99.0 or newer and GitHub CLI 2.99.0 or newer.\n`;
  assert.deepEqual(versionDisagreements(reader(new Map(files).set(adoptionGuide, guide))), []);
});

test('a document that names no Repo Canon version fails the agreement', () => {
  const files = workingTree();
  const release = selectedRelease(files);
  const changed = new Map(files).set(readme, files.get(readme).replaceAll(release, 'the latest release'));
  assert.match(versionDisagreements(reader(changed)).join('\n'), /README\.md names no Repo Canon version/);
});
