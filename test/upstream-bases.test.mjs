import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkUpstreamBases,
  ownedSkills,
  reconcileUpstreamBases,
  snapshotPath,
} from "../scripts/upstream-bases.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = join(root, "scripts/upstream-bases.mjs");
const engineering = `${snapshotPath}/skills/engineering`;

// A disposable copy of the declarations, owned tree, setup files and snapshot.
function fixture(t) {
  const copy = mkdtempSync(join(tmpdir(), "repo-canon-upstream-bases-"));
  t.after(() => rmSync(copy, { recursive: true, force: true }));
  for (const path of [
    "standards.yaml",
    "upstream-bases.json",
    "scripts/upstream-bases.mjs",
    "scripts/standards-declarations.mjs",
    "docs/agents",
    snapshotPath,
    ...ownedSkills(root).map(({ source }) => source),
  ])
    cpSync(join(root, path), join(copy, path), { recursive: true });
  symlinkSync(join(root, "node_modules"), join(copy, "node_modules"), "dir");
  return copy;
}

function edit(directory, path, change) {
  const target = join(directory, path);
  writeFileSync(target, change(readFileSync(target, "utf8")));
}

function nextSnapshot(from) {
  const next = join(from, "next-snapshot");
  cpSync(join(from, snapshotPath), next, { recursive: true });
  return next;
}

test("every owned skill and setup file matches its recorded upstream base", () => {
  assert.deepEqual(checkUpstreamBases(root), []);
  const skills = ownedSkills(root);
  assert.ok(skills.length > 0);
  for (const { name, source } of skills)
    assert.equal(source, `.agents/skills/${name}`, `${name} is owned`);
});

test("write restores provenance from the record without changing notices", (t) => {
  const copy = fixture(t);
  const creditsPath = ".agents/skills/pr/CREDITS.md";
  const original = readFileSync(join(copy, creditsPath), "utf8");
  edit(copy, creditsPath, (text) =>
    text.replace("Its upstream base is", "Hand-edited base is"),
  );
  assert.ok(
    checkUpstreamBases(copy).some((problem) =>
      problem.includes("provenance differs"),
    ),
  );
  const child = spawnSync(
    process.execPath,
    [join(copy, "scripts/upstream-bases.mjs"), "write"],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.equal(readFileSync(join(copy, creditsPath), "utf8"), original);
  assert.deepEqual(checkUpstreamBases(copy), []);
});

test("a dry run against the current base changes no owned file", () => {
  assert.deepEqual(reconcileUpstreamBases(root, join(root, snapshotPath)), []);
  const child = spawnSync(
    process.execPath,
    [script, "reconcile", join(root, snapshotPath), "--dry-run"],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, "No owned file changes.\n");
});

function changeRecord(copy, change) {
  edit(copy, "upstream-bases.json", (text) => {
    const record = JSON.parse(text);
    change(record);
    return JSON.stringify(record);
  });
}

function write(copy) {
  const child = spawnSync(
    process.execPath,
    [join(copy, "scripts/upstream-bases.mjs"), "write"],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 0, child.stderr);
}

test("a replaced snapshot fails every base still recorded against the old one", (t) => {
  const copy = fixture(t);
  edit(copy, `${snapshotPath}/UPSTREAM.json`, (text) =>
    text.replace('"v1.3.1"', '"v1.4.0"'),
  );
  const record = JSON.parse(
    readFileSync(join(copy, "upstream-bases.json"), "utf8"),
  );
  const problems = checkUpstreamBases(copy);
  assert.equal(
    problems.length,
    Object.values(record.skills).filter((entry) => entry?.path).length +
      Object.keys(record.files).length,
  );
  for (const problem of problems)
    assert.match(problem, /but the vendored snapshot is .* v1\.4\.0/);
});

test("shared and own edits render from the record, retaining all notices", (t) => {
  const copy = fixture(t);
  const before = readFileSync(
    join(copy, ".agents/skills/pr/CREDITS.md"),
    "utf8",
  );
  changeRecord(copy, (record) => {
    record.skills.pr.edits = "Own edit from the record.";
    record.sharedSkillEdits[0].edits = "Shared edit from the record.";
  });
  write(copy);
  const after = readFileSync(
    join(copy, ".agents/skills/pr/CREDITS.md"),
    "utf8",
  );
  assert.ok(after.includes("Own edit from the record."));
  assert.ok(after.includes("Shared edit from the record."));
  assert.equal(
    after.slice(after.indexOf("\n## ")),
    before.slice(before.indexOf("\n## ")),
  );
  assert.deepEqual(checkUpstreamBases(copy), []);
  write(copy);
  assert.equal(
    readFileSync(join(copy, ".agents/skills/pr/CREDITS.md"), "utf8"),
    after,
  );
});

test("updating the shared upstream identity renders every derived base and tree link", (t) => {
  const copy = fixture(t);
  const identity = {
    repository: "https://github.com/mattpocock/skills",
    tag: "v2.0.0",
    commit: "a".repeat(40),
  };
  changeRecord(copy, (record) => {
    record.upstream = identity;
  });
  writeFileSync(
    join(copy, snapshotPath, "UPSTREAM.json"),
    JSON.stringify(identity),
  );
  write(copy);
  for (const { base, credits } of ownedSkills(copy).filter(
    ({ base }) => base,
  )) {
    assert.ok(credits.includes(identity.tag));
    assert.ok(
      credits.includes(
        `${identity.repository}/tree/${identity.commit}/${base.path}`,
      ),
    );
  }
  assert.deepEqual(checkUpstreamBases(copy), []);
});

test("an owned file identical to its base that claims edits fails", (t) => {
  const copy = fixture(t);
  cpSync(
    join(copy, engineering, "tdd/SKILL.md"),
    join(copy, ".agents/skills/tdd/SKILL.md"),
  );
  changeRecord(copy, (record) => {
    record.files["docs/agents/domain.md"].edits = "Renames a heading.";
  });
  assert.deepEqual(checkUpstreamBases(copy), [
    "tdd (.agents/skills/tdd/CREDITS.md) claims edits, but the skill is identical to its upstream base",
    "docs/agents/domain.md (upstream-bases.json) claims edits, but the file is identical to its upstream base",
  ]);
});

test("a record with no edits only permits an identical skill", (t) => {
  const copy = fixture(t);
  changeRecord(copy, (record) => {
    record.sharedSkillEdits = [];
    record.skills.tdd.edits = null;
  });
  write(copy);
  assert.ok(
    checkUpstreamBases(copy).some(
      (problem) =>
        problem.startsWith("tdd ") && problem.includes("claims no edits"),
    ),
  );
  cpSync(
    join(copy, engineering, "tdd/SKILL.md"),
    join(copy, ".agents/skills/tdd/SKILL.md"),
  );
  assert.ok(
    !checkUpstreamBases(copy).some((problem) => problem.startsWith("tdd ")),
  );
  appendFileSync(join(copy, "docs/agents/domain.md"), "\nEdited.\n");
  assert.ok(
    checkUpstreamBases(copy).some(
      (problem) =>
        problem.startsWith("docs/agents/domain.md ") &&
        problem.includes("claims no edits"),
    ),
  );
});

test("missing records, credits, upstream credits and snapshot sources fail", (t) => {
  const copy = fixture(t);
  rmSync(join(copy, ".agents/skills/babysit/CREDITS.md"));
  changeRecord(copy, (record) => {
    delete record.skills.orchestrate;
  });
  edit(copy, ".agents/skills/pr/CREDITS.md", (text) =>
    text.replace("reproduced almost word for word", "reproduced"),
  );
  edit(copy, "standards.yaml", (text) =>
    text
      .replace(
        "source: .agents/skills/implement",
        `source: ${engineering}/implement`,
      )
      .replace(
        "exact: docs/agents/issue-tracker.md",
        `exact: ${engineering}/setup-matt-pocock-skills/issue-tracker-github.md`,
      ),
  );
  assert.deepEqual(checkUpstreamBases(copy), [
    "babysit (.agents/skills/babysit/CREDITS.md) is missing",
    `implement installs from ${engineering}/implement, not the owned tree at .agents/skills/implement`,
    "orchestrate (.agents/skills/orchestrate/CREDITS.md) has no entry in upstream-bases.json",
    "pr (.agents/skills/pr/CREDITS.md) must keep its upstream base's CREDITS.md text word for word",
    "docs/agents/issue-tracker.md (upstream-bases.json) is not declared as an exact file installed from itself",
    `${engineering}/setup-matt-pocock-skills/issue-tracker-github.md installs from the vendored snapshot; install it from its owned copy`,
    `${engineering}/implement installs from the vendored snapshot; install it from its owned copy`,
  ]);
});

test("a skill taken from upstream without its license notice fails", (t) => {
  const copy = fixture(t);
  edit(copy, ".agents/skills/grilling/CREDITS.md", (text) =>
    text.replace("Copyright (c) 2026 Matt Pocock", "Copyright Matt Pocock"),
  );
  assert.deepEqual(checkUpstreamBases(copy), [
    `grilling (.agents/skills/grilling/CREDITS.md) must reproduce the upstream license notice from ${snapshotPath}/LICENSE`,
  ]);
});

test("malformed records fail while reordered declaration fields remain valid", (t) => {
  const copy = fixture(t);
  changeRecord(copy, (record) => {
    delete record.files["docs/agents/domain.md"].edits;
    record.files["docs/agents/triage-labels.md"].edits = " ";
  });
  edit(copy, "standards.yaml", (text) =>
    text.replace(
      "      name: tdd\n      source: .agents/skills/tdd",
      "      source: .agents/skills/tdd\n      name: tdd",
    ),
  );
  assert.deepEqual(checkUpstreamBases(copy), [
    "docs/agents/domain.md (upstream-bases.json) must record edits as null or a summary of how the file differs",
    "docs/agents/triage-labels.md (upstream-bases.json) must record edits as null or a summary of how the file differs",
  ]);
  assert.deepEqual(reconcileUpstreamBases(copy, nextSnapshot(copy)), []);
});

test("reconciliation refuses stale or missing records without reading prose bases", (t) => {
  const copy = fixture(t);
  changeRecord(copy, (record) => {
    record.upstream.tag = "v1.0.0";
    delete record.skills.tdd;
  });
  const next = nextSnapshot(copy);
  appendFileSync(
    join(next, "skills/engineering/tdd/SKILL.md"),
    "\nUpstream addition.\n",
  );
  const entries = reconcileUpstreamBases(copy, next, { write: true });
  assert.ok(entries.every(({ outcome }) => outcome === "conflict"));
  assert.ok(
    entries.some(
      ({ path, reason }) =>
        path === ".agents/skills/tdd" && reason.includes("no entry"),
    ),
  );
  assert.doesNotMatch(
    readFileSync(join(copy, ".agents/skills/tdd/SKILL.md"), "utf8"),
    /Upstream addition/,
  );
});

test("reconciliation three-way merges upstream changes into the owned files", (t) => {
  const copy = fixture(t);
  const next = nextSnapshot(copy);
  const skill = (name, path) => `skills/engineering/${name}/${path}`;
  const originalSkill = readFileSync(
    join(copy, ".agents/skills/grill-with-docs/SKILL.md"),
    "utf8",
  );

  // A nonconflicting owned skill takes the upstream change.
  edit(next, skill("grill-with-docs", "SKILL.md"), (text) =>
    text.replace(/\n/, "\nUpstream addition.\n"),
  );
  // A line Repo Canon rewrote in triage, changed upstream too, conflicts.
  const owned = readFileSync(
    join(copy, ".agents/skills/triage/SKILL.md"),
    "utf8",
  );
  const rewritten = readFileSync(
    join(next, skill("triage", "SKILL.md")),
    "utf8",
  )
    .split("\n")
    .find((line) => line.trim().length > 20 && !owned.includes(line));
  assert.ok(rewritten, "triage rewrites at least one upstream line");
  edit(next, skill("triage", "SKILL.md"), (text) =>
    text.replace(rewritten, `${rewritten} Upstream edit.`),
  );
  // Files added and removed upstream, upstream credits, and a setup seed.
  writeFileSync(join(next, skill("tdd", "NEW.md")), "New upstream file.\n");
  rmSync(join(next, skill("prototype", "UI.md")));
  rmSync(join(next, skill("codebase-design", "agents")), { recursive: true });
  appendFileSync(join(next, skill("pr", "CREDITS.md")), "\nMore credits.\n");
  appendFileSync(
    join(next, "skills/engineering/setup-matt-pocock-skills/domain.md"),
    "\nUpstream setup change.\n",
  );
  // A skill whose base path disappears upstream.
  rmSync(join(next, skill("wayfinder", "")), { recursive: true });

  const outcomes = (entries) =>
    entries.map(({ path, outcome }) => `${outcome} ${path}`);
  const expected = [
    "removed .agents/skills/codebase-design/agents/openai.yaml",
    "merged .agents/skills/grill-with-docs/SKILL.md",
    "conflict .agents/skills/pr/CREDITS.md",
    "removed .agents/skills/prototype/UI.md",
    "added .agents/skills/tdd/NEW.md",
    "conflict .agents/skills/triage/SKILL.md",
    "conflict .agents/skills/wayfinder",
    "merged docs/agents/domain.md",
  ];
  const sorted = (entries) =>
    outcomes(entries).sort((a, b) =>
      a.split(" ")[1].localeCompare(b.split(" ")[1]),
    );
  assert.deepEqual(sorted(reconcileUpstreamBases(copy, next)), expected);
  // A dry run writes nothing.
  assert.deepEqual(checkUpstreamBases(copy), []);

  const child = spawnSync(
    process.execPath,
    [join(copy, "scripts/upstream-bases.mjs"), "reconcile", next],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 2, child.stderr);
  assert.match(
    child.stdout,
    /^conflict \.agents\/skills\/triage\/SKILL\.md: 1 conflicting hunk\(s\)$/m,
  );
  // A rerun after writing, before the records are updated, still reconciles.
  const rerun = spawnSync(
    process.execPath,
    [join(copy, "scripts/upstream-bases.mjs"), "reconcile", next, "--dry-run"],
    { encoding: "utf8" },
  );
  assert.equal(rerun.status, 2, rerun.stderr);

  const mergedSkill = readFileSync(
    join(copy, ".agents/skills/grill-with-docs/SKILL.md"),
    "utf8",
  );
  assert.equal(
    mergedSkill,
    originalSkill.replace(/\n/, "\nUpstream addition.\n"),
  );
  assert.deepEqual(
    readFileSync(join(copy, ".agents/skills/tdd/NEW.md")),
    readFileSync(join(next, skill("tdd", "NEW.md"))),
  );
  assert.equal(
    readFileSync(join(copy, "docs/agents/domain.md"), "utf8"),
    readFileSync(
      join(next, "skills/engineering/setup-matt-pocock-skills/domain.md"),
      "utf8",
    ),
  );
  assert.throws(() =>
    readFileSync(join(copy, ".agents/skills/prototype/UI.md")),
  );
  // A removal leaves no empty directory behind.
  assert.equal(
    existsSync(join(copy, ".agents/skills/codebase-design/agents")),
    false,
  );
  assert.match(
    readFileSync(join(copy, ".agents/skills/triage/SKILL.md"), "utf8"),
    /^<<<<<<< owned$[\s\S]*Upstream edit\.[\s\S]*^>>>>>>> upstream$/m,
  );
});

test("the command rejects invalid arguments and reports check problems", (t) => {
  for (const args of [[], ["reconcile"], ["check", "extra"], ["merge", "x"]]) {
    const child = spawnSync(process.execPath, [script, ...args], {
      encoding: "utf8",
    });
    assert.equal(child.status, 1, args.join(" "));
    assert.match(child.stderr, /^Usage: node scripts\/upstream-bases\.mjs/);
  }
  const missing = spawnSync(
    process.execPath,
    [script, "reconcile", join(tmpdir(), "repo-canon-no-snapshot")],
    { encoding: "utf8" },
  );
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /is not a staged snapshot/);

  const copy = fixture(t);
  edit(copy, ".agents/skills/tdd/CREDITS.md", (text) =>
    text.replace(
      "The skill differs from its upstream base:",
      "The skill is identical to its upstream base:",
    ),
  );
  appendFileSync(join(copy, ".agents/skills/tdd/SKILL.md"), "\nEdited.\n");
  const child = spawnSync(
    process.execPath,
    [join(copy, "scripts/upstream-bases.mjs"), "check"],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 1);
  assert.match(child.stderr, /^tdd .* provenance differs/m);
  const passing = spawnSync(process.execPath, [script, "check"], {
    encoding: "utf8",
  });
  assert.equal(passing.status, 0, passing.stderr);
});
