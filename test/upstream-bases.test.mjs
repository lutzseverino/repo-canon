import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
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
    "setup-file-bases.json",
    "scripts/upstream-bases.mjs",
    "docs/agents",
    snapshotPath,
    ...ownedSkills(root).map(({ source }) => source),
  ])
    cpSync(join(root, path), join(copy, path), { recursive: true });
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

test("a recorded base that differs from the vendored snapshot fails", (t) => {
  const copy = fixture(t);
  const other = "0".repeat(40);
  edit(copy, ".agents/skills/code-review/CREDITS.md", (text) =>
    text.replaceAll("24fe0ef7737efae15c87225755e9f6f5965e4888", other),
  );
  edit(copy, "setup-file-bases.json", (text) =>
    text.replace('"tag": "v1.3.1"', '"tag": "v1.3.0"'),
  );
  assert.deepEqual(checkUpstreamBases(copy), [
    `code-review (.agents/skills/code-review/CREDITS.md) records upstream base https://github.com/mattpocock/skills v1.3.1 (${other}), but the vendored snapshot is https://github.com/mattpocock/skills v1.3.1 (24fe0ef7737efae15c87225755e9f6f5965e4888)`,
    "docs/agents/domain.md (setup-file-bases.json) records upstream base https://github.com/mattpocock/skills v1.3.0 (24fe0ef7737efae15c87225755e9f6f5965e4888), but the vendored snapshot is https://github.com/mattpocock/skills v1.3.1 (24fe0ef7737efae15c87225755e9f6f5965e4888)",
  ]);
});

test("a replaced snapshot fails every base still recorded against the old one", (t) => {
  const copy = fixture(t);
  edit(copy, `${snapshotPath}/UPSTREAM.json`, (text) =>
    text.replace('"v1.3.1"', '"v1.4.0"'),
  );
  const problems = checkUpstreamBases(copy);
  // The 17 skills taken from upstream and the three setup files.
  assert.equal(problems.length, 20);
  for (const problem of problems)
    assert.match(problem, /but the vendored snapshot is .* v1\.4\.0/);
});

test("an owned file identical to its base that claims edits fails", (t) => {
  const copy = fixture(t);
  cpSync(
    join(copy, engineering, "tdd/SKILL.md"),
    join(copy, ".agents/skills/tdd/SKILL.md"),
  );
  edit(copy, "setup-file-bases.json", (text) => {
    const record = JSON.parse(text);
    record.files["docs/agents/triage-labels.md"].edits = "Renames a label.";
    return JSON.stringify(record);
  });
  assert.deepEqual(checkUpstreamBases(copy), [
    "tdd (.agents/skills/tdd/CREDITS.md) claims edits, but the skill is identical to its upstream base",
    "docs/agents/triage-labels.md (setup-file-bases.json) claims edits, but the file is identical to its upstream base",
  ]);
});

test("an owned file that differs from its base and claims none fails", (t) => {
  const copy = fixture(t);
  for (const name of ["tdd", "grilling"])
    edit(copy, `.agents/skills/${name}/CREDITS.md`, (text) =>
      text.replace(
        "The skill differs from its upstream base:",
        "The skill is identical to its upstream base:",
      ),
    );
  appendFileSync(join(copy, ".agents/skills/tdd/SKILL.md"), "\nEdited.\n");
  writeFileSync(join(copy, ".agents/skills/grilling/NOTES.md"), "Added.\n");
  appendFileSync(join(copy, "docs/agents/domain.md"), "\nEdited.\n");
  edit(copy, ".agents/skills/triage/CREDITS.md", (text) =>
    text.replace(
      "The skill differs from its upstream base as follows.",
      "The skill is identical to its upstream base.",
    ),
  );
  assert.deepEqual(checkUpstreamBases(copy), [
    "grilling (.agents/skills/grilling/CREDITS.md) claims the skill is identical to its upstream base, but it differs",
    "tdd (.agents/skills/tdd/CREDITS.md) claims the skill is identical to its upstream base, but it differs",
    "triage (.agents/skills/triage/CREDITS.md) claims the skill is identical to its upstream base, but it differs",
    "docs/agents/domain.md (setup-file-bases.json) claims no edits, but the file differs from its upstream base",
  ]);
});

test("missing credits, dropped upstream credits and snapshot sources fail", (t) => {
  const copy = fixture(t);
  rmSync(join(copy, ".agents/skills/babysit/CREDITS.md"));
  edit(copy, ".agents/skills/orchestrate/CREDITS.md", (text) =>
    text.replace(
      ": it was written for Repo Canon and has no upstream base",
      "",
    ),
  );
  edit(copy, ".agents/skills/pr/CREDITS.md", (text) =>
    text.replace("reproduced almost word for word", "reproduced"),
  );
  edit(copy, ".agents/skills/research/CREDITS.md", (text) =>
    text.replace(
      /The skill differs from its upstream base/,
      "The skill is changed",
    ),
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
    "orchestrate (.agents/skills/orchestrate/CREDITS.md) neither records an upstream base nor says the skill was written for Repo Canon and has no upstream base",
    "pr (.agents/skills/pr/CREDITS.md) must keep its upstream base's CREDITS.md text word for word",
    "research (.agents/skills/research/CREDITS.md) must say either that the skill is identical to its upstream base or that it differs from its upstream base",
    "docs/agents/issue-tracker.md (setup-file-bases.json) is not declared as an exact file installed from itself",
    `${engineering}/setup-matt-pocock-skills/issue-tracker-github.md installs from the vendored snapshot; install it from its owned copy`,
    `${engineering}/implement installs from the vendored snapshot; install it from its owned copy`,
  ]);
});

test("malformed records and declarations fail instead of passing unchecked", (t) => {
  const copy = fixture(t);
  edit(copy, "setup-file-bases.json", (text) => {
    const record = JSON.parse(text);
    delete record.files["docs/agents/domain.md"].edits;
    record.files["docs/agents/triage-labels.md"].edits = " ";
    return JSON.stringify(record);
  });
  edit(copy, "standards.yaml", (text) =>
    text.replace(
      "      name: tdd\n      source: .agents/skills/tdd",
      "      source: .agents/skills/tdd\n      name: tdd",
    ),
  );
  const declared = ownedSkills(root).length;
  assert.deepEqual(checkUpstreamBases(copy), [
    `standards.yaml declares ${declared} skills, but only ${declared - 1} read as kind, name and source in that order`,
    "docs/agents/domain.md (setup-file-bases.json) must record edits as null or a summary of how the file differs",
    "docs/agents/triage-labels.md (setup-file-bases.json) must record edits as null or a summary of how the file differs",
  ]);

  // Reconciliation still runs: these records name the right base.
  assert.deepEqual(reconcileUpstreamBases(copy, nextSnapshot(copy)), []);
});

test("reconciliation refuses to merge from a stale or unreadable base", (t) => {
  const copy = fixture(t);
  const other = "0".repeat(40);
  edit(copy, ".agents/skills/code-review/CREDITS.md", (text) =>
    text.replaceAll("24fe0ef7737efae15c87225755e9f6f5965e4888", other),
  );
  // A base sentence that no longer parses records no base at all.
  edit(copy, ".agents/skills/tdd/CREDITS.md", (text) =>
    text.replace("Its upstream base is", "Its upstrem base is"),
  );
  const next = nextSnapshot(copy);
  for (const name of ["code-review", "tdd"])
    appendFileSync(
      join(next, `skills/engineering/${name}/SKILL.md`),
      "\nUpstream addition.\n",
    );
  assert.deepEqual(reconcileUpstreamBases(copy, next, { write: true }), [
    {
      path: ".agents/skills/code-review",
      outcome: "conflict",
      reason: `.agents/skills/code-review records upstream base https://github.com/mattpocock/skills v1.3.1 (${other}), but the vendored snapshot is https://github.com/mattpocock/skills v1.3.1 (24fe0ef7737efae15c87225755e9f6f5965e4888)`,
    },
    {
      path: ".agents/skills/tdd",
      outcome: "conflict",
      reason:
        "its CREDITS.md records no upstream base and does not say it was written for Repo Canon",
    },
  ]);
  for (const name of ["code-review", "tdd"])
    assert.doesNotMatch(
      readFileSync(join(copy, `.agents/skills/${name}/SKILL.md`), "utf8"),
      /Upstream addition/,
    );
});

test("reconciliation three-way merges upstream changes into the owned files", (t) => {
  const copy = fixture(t);
  const next = nextSnapshot(copy);
  const skill = (name, path) => `skills/engineering/${name}/${path}`;

  // A nonconflicting owned skill takes the upstream change.
  edit(next, skill("code-review", "SKILL.md"), (text) =>
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
    "merged .agents/skills/code-review/SKILL.md",
    "removed .agents/skills/codebase-design/agents/openai.yaml",
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

  const mergedReview = readFileSync(
    join(copy, ".agents/skills/code-review/SKILL.md"),
    "utf8",
  );
  assert.match(
    mergedReview,
    /A prompt or brief naming this skill is its invocation\./,
  );
  assert.equal(
    mergedReview.replace(
      "\nA prompt or brief naming this skill is its invocation.\n",
      "",
    ),
    readFileSync(join(next, skill("code-review", "SKILL.md")), "utf8"),
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
  assert.match(child.stderr, /^tdd .* claims the skill is identical/m);
  const passing = spawnSync(process.execPath, [script, "check"], {
    encoding: "utf8",
  });
  assert.equal(passing.status, 0, passing.stderr);
});
