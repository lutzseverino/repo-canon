import "./helpers/temporary-directory.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFixtureGit } from "../scripts/support/fixture-git.mjs";
import { readsSection } from "../scripts/owned-skill-reads.mjs";
import { parse } from "yaml";
import {
  checkSkillWords,
  compareReadSets,
  directoryTree,
  gitTree,
  readSet,
} from "../scripts/read-set.mjs";

function tree(contents) {
  return {
    paths: Object.keys(contents),
    read: (path) => Buffer.from(contents[path]),
  };
}

test("read sets follow skills transitively, stop cycles and count shared source rules once", () => {
  const result = readSet(
    tree({
      ".agents/skills/start/SKILL.md":
        "## Reads\n- The `next` skill.\n- `.repo-standards/rules/shared.md`.\n- `GLOSSARY.md`, `docs/adr/` and `.scriptorium/config.json`.\n",
      ".agents/skills/start/references/detail.md": "é",
      ".agents/skills/start/CREDITS.md": "not counted",
      ".agents/skills/start/LICENSE.md": "not counted",
      ".agents/skills/start/run.mjs": "not counted",
      ".agents/skills/next/SKILL.md":
        "## Reads\n- The `start` skill.\n- The installed `shared` and `other` rules.\n- `CONTRIBUTING.md` and `AGENTS.md`.\n",
      "rules/shared.md": "shared",
      "rules/other.md": "other",
      ".repo-standards/rules/shared.md": "installed copy not counted",
      "CONTRIBUTING.md": "guide",
      "AGENTS.md": "map",
      "GLOSSARY.md": "not counted",
      "docs/adr/0001.md": "not counted",
      ".scriptorium/config.json": "{}",
    }),
    "start",
  );
  assert.deepEqual(result.members, [
    ".agents/skills/next/SKILL.md",
    ".agents/skills/start/SKILL.md",
    ".agents/skills/start/references/detail.md",
    "AGENTS.md",
    "CONTRIBUTING.md",
    "rules/other.md",
    "rules/shared.md",
  ]);
  assert.equal(result.bytes, 259);
});

test("byte counts measure UTF-8 and do not follow links out of rules or the guide", () => {
  assert.deepEqual(
    readSet(
      tree({
        ".agents/skills/start/SKILL.md": "é",
        ".agents/skills/start/references/detail.md": "文",
      }),
      "start",
    ),
    {
      members: [
        ".agents/skills/start/SKILL.md",
        ".agents/skills/start/references/detail.md",
      ],
      bytes: 5,
    },
  );
  const result = readSet(
    tree({
      ".agents/skills/start/SKILL.md":
        "## Reads\n- `CONTRIBUTING.md`.\n- The `present` rules.\n",
      "CONTRIBUTING.md": "Read [missing](missing.md).",
      "rules/present.md": "## Reads\n- The `absent` skill.\n",
    }),
    "start",
  );
  assert.equal(result.members.length, 3);
});

for (const [item, missing] of [
  ["The `absent` skill.", ".agents/skills/absent/SKILL.md"],
  ["The installed `absent` rules.", "rules/absent.md"],
  ["`.repo-standards/rules/absent.md`.", "rules/absent.md"],
  ["`CONTRIBUTING.md`.", "CONTRIBUTING.md"],
]) {
  test(`missing ${missing} names the entry point and naming skill`, () => {
    assert.throws(
      () =>
        readSet(
          tree({
            ".agents/skills/start/SKILL.md": "## Reads\n- The `next` skill.\n",
            ".agents/skills/next/SKILL.md": `## Reads\n- ${item}\n`,
          }),
          "start",
        ),
      (error) => {
        assert.ok(error instanceof Error);
        assert.equal(
          error.message,
          `start: next names missing member ${missing}`,
        );
        return true;
      },
    );
  });
}

test("a missing entry point fails explicitly", () => {
  assert.throws(
    () => readSet(tree({}), "start"),
    /start: start names missing member .agents\/skills\/start\/SKILL.md/,
  );
});

test("named rules extend the Reads parser without changing its paths or skills", () => {
  const [item] = readsSection(
    "## Reads\n- The installed `one`, `two`, and `three` rules and the `helper` skill; `.scriptorium/config.json`.\n",
  );
  assert.deepEqual(item.rules, ["one", "two", "three"]);
  assert.deepEqual(item.skills, ["helper"]);
  assert.deepEqual(item.paths, [".scriptorium/config.json"]);
});

test("a rule named in the singular is counted at its source", () => {
  const [item] = readsSection("## Reads\n- The installed `single` rule.\n");
  assert.deepEqual(item.rules, ["single"]);
  assert.deepEqual(
    readSet(
      tree({
        ".agents/skills/start/SKILL.md":
          "## Reads\n- The installed `single` rule.\n",
        "rules/single.md": "single",
      }),
      "start",
    ).members,
    [".agents/skills/start/SKILL.md", "rules/single.md"],
  );
});

const fixtureSkills = ["factory", "orchestrate", "review", "triage"];

function entryTree(overrides = {}, names = fixtureSkills, references = {}) {
  return tree({
    "upstream-bases.json": JSON.stringify({
      skills: Object.fromEntries(names.map((name) => [name, null])),
    }),
    ...Object.fromEntries(
      names.map((name) => [
        `.agents/skills/${name}/SKILL.md`,
        overrides[name] ?? "x",
      ]),
    ),
    ...references,
  });
}

test("the read-set ratchet counts references in any owned skill", () => {
  const base = entryTree({}, ["extra"]);
  const head = entryTree({}, ["extra"], {
    ".agents/skills/extra/references/detail.md": "more",
  });
  const result = compareReadSets(base, head);
  assert.deepEqual(result.rows, [
    { entryPoint: "extra", base: 1, head: 5, difference: 4 },
  ]);
  assert.equal(result.failures.length, 1);
});

test("growth fails with both byte counts; equal and smaller entry points pass", () => {
  const result = compareReadSets(
    entryTree({ review: "xx" }),
    entryTree({ factory: "é" }),
  );
  assert.deepEqual(result.rows, [
    { entryPoint: "factory", base: 1, head: 2, difference: 1 },
    { entryPoint: "orchestrate", base: 1, head: 1, difference: 0 },
    { entryPoint: "review", base: 2, head: 1, difference: -1 },
    { entryPoint: "triage", base: 1, head: 1, difference: 0 },
  ]);
  assert.deepEqual(result.failures, [
    "factory: read set grew from 1 to 2 bytes; add Read set: <reason> in Merge Danger.",
  ]);
  assert.deepEqual(
    compareReadSets(entryTree({ review: "xx" }), entryTree()).failures,
    [],
  );
});

test("a meaningful reason in Merge Danger permits growth, including a nested subsection", () => {
  for (const description of [
    "## Merge Danger\n\nRead set: Explain the new delivery rule.\n",
    "## Merge Danger\n\nRead set: Added `orchestrate`\n",
    "## Merge Danger\n\n### Budget\n\nRead set: Explain the new delivery rule.\n",
  ])
    assert.deepEqual(
      compareReadSets(entryTree(), entryTree({ triage: "xx" }), description)
        .failures,
      [],
    );
});

for (const description of [
  "## Merge Danger\n\nRead set: TBD\n",
  "## Merge Danger\n\nRead set: n/a\n",
  "## Merge Danger\n\nRead set: Not applicable.\n",
  "## Merge Danger\n\nRead set: TBD: explain later\n",
  "## Summary\n\nRead set: Explain the new delivery rule.\n\n## Merge Danger\n\nReversible change.\n",
  "## Merge Danger\n\nReversible change.\n\n## Related issue\n\nRead set: Explain the new delivery rule.\n",
  "## Merge Danger\n\n```text\nRead set: Explain the new delivery rule.\n```\n",
  "## Merge Danger\n\n<!-- Read set: Explain the new delivery rule. -->\n",
])
  test(`growth is not excused by ${JSON.stringify(description)}`, () => {
    assert.equal(
      compareReadSets(entryTree(), entryTree({ triage: "xx" }), description)
        .failures.length,
      1,
    );
  });

test("a base without an entry point has zero bytes; missing head or transitive base members fail", () => {
  const base = entryTree({}, ["factory", "orchestrate", "triage"]);
  const result = compareReadSets(base, entryTree());
  assert.deepEqual(
    result.rows.find(({ entryPoint }) => entryPoint === "review"),
    {
      entryPoint: "review",
      base: 0,
      head: 1,
      difference: 1,
    },
  );
  assert.equal(result.failures.length, 1);
  assert.equal(compareReadSets(entryTree(), base).failures.length, 0);
  const missing = entryTree();
  missing.paths = missing.paths.filter((path) => !path.includes("/review/"));
  assert.throws(
    () => compareReadSets(entryTree(), missing),
    /review.*missing member/,
  );
  assert.throws(
    () =>
      compareReadSets(
        entryTree({ factory: "## Reads\n- The `absent` skill.\n" }),
        entryTree(),
      ),
    /factory.*absent/,
  );
});

test("the local command compares working-tree edits with a Git ref and reports every entry point on failures", (t) => {
  const root = mkdtempSync(join(tmpdir(), "read-set-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function write(path, content) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  for (const name of fixtureSkills)
    write(`.agents/skills/${name}/SKILL.md`, "x");
  write("upstream-bases.json", entryTree().read("upstream-bases.json"));
  write(
    "scripts/skill-word-exceptions.json",
    JSON.stringify({ introductionBase: "a".repeat(40), allowances: {} }),
  );
  const git = (args) =>
    execFixtureGit(["-C", root, ...args], { encoding: "utf8" });
  git(["init", "-q"]);
  git(["add", "."]);
  git([
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "commit",
    "-qm",
    "base",
  ]);
  const base = gitTree(root, "HEAD");
  assert.equal(readSet(base, "triage").bytes, 1);
  write(".agents/skills/triage/reference.md", "é");
  assert.equal(readSet(directoryTree(root), "triage").bytes, 3);
  const script = fileURLToPath(
    new URL("../scripts/read-set.mjs", import.meta.url),
  );
  const run = (args) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: "utf8",
    });
  const failed = run(["compare", "HEAD"]);
  assert.equal(failed.status, 1, failed.stderr);
  assert.match(failed.stderr, /triage: read set grew from 1 to 3 bytes/);
  assert.equal(failed.stdout.trim().split("\n").length, 6);
  assert.ok(failed.stdout.startsWith(`Base commit: ${base.commit}\n`));
  assert.match(failed.stdout, /orchestrate \| 1 \| 1 \| 0/);
  assert.match(failed.stdout, /triage \| 1 \| 3 \| 2/);
  write(
    "description.md",
    "## Merge Danger\n\nRead set: Explain the new delivery rule.\n",
  );
  const passed = run(["compare", "HEAD", "--description", "description.md"]);
  assert.equal(passed.status, 0, passed.stderr);
  assert.equal(passed.stdout, failed.stdout);
  write(".agents/skills/triage/reference.md", words(1001));
  const oversized = run(["compare", "HEAD", "--description", "description.md"]);
  assert.equal(oversized.status, 1, oversized.stderr);
  assert.match(
    oversized.stderr,
    /triage\/reference.md: 1001 words exceeds the ceiling of 1000/,
  );
  assert.doesNotMatch(oversized.stderr, /read set grew/);
  assert.equal(run(["compare"]).status, 1);
  assert.equal(run(["compare", "not-a-ref"]).status, 1);
  write(".agents/skills/triage/SKILL.md", "## Reads\n- The `missing` rules.\n");
  const missing = run(["compare", "HEAD"]);
  assert.equal(missing.status, 1);
  assert.match(
    missing.stderr,
    /triage: triage names missing member rules\/missing.md/,
  );
});

const introductionBase = "a".repeat(40);
const exceptionPath = "scripts/skill-word-exceptions.json";
const words = (count) => "word ".repeat(count);

function wordTree(contents, allowances = {}, snapshot = {}) {
  const upstream = { commit: "b".repeat(40) };
  return tree({
    "upstream-bases.json": JSON.stringify({
      upstream,
      skills: { sample: { path: "skills/category/upstream" }, local: null },
    }),
    [exceptionPath]: JSON.stringify({ introductionBase, allowances }),
    "vendor/mattpocock-skills/UPSTREAM.json": JSON.stringify(upstream),
    ...Object.fromEntries(
      Object.entries(contents).map(([path, text]) => [
        `.agents/skills/${path}`,
        text,
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(snapshot).map(([path, text]) => [
        `vendor/mattpocock-skills/skills/category/upstream/${path}`,
        text,
      ]),
    ),
  });
}

test("the guard counts raw whitespace-delimited words in entry files and nested references", () => {
  const allowed = {
    "sample/SKILL.md": words(1000),
    "sample/nested/DETAIL.MD": words(1003),
    "local/nested/no-upstream.md": words(1000),
    "sample/nested/CREDITS.md": words(1400),
    "sample/nested/LICENCE.md": words(1400),
    "sample/nested/COPYING.md": words(1400),
    "sample/nested/script.js": words(1400),
    "unowned/SKILL.md": words(1400),
  };
  const upstream = { "SKILL.md": words(100), "nested/DETAIL.MD": words(836) };
  assert.deepEqual(
    checkSkillWords(wordTree(allowed, {}, upstream)).failures,
    [],
  );
  const head = wordTree(
    {
      ...allowed,
      "sample/SKILL.md": words(999) + "##\t<!-- -->\n",
      "sample/nested/DETAIL.MD": words(1004),
      "local/nested/no-upstream.md": words(1001),
    },
    {},
    upstream,
  );
  const { failures } = checkSkillWords(head);
  assert.equal(failures.length, 3);
  assert.match(failures.join("\n"), /sample\/SKILL.md: 1002 words.*1,?000/);
  assert.match(
    failures.join("\n"),
    /sample\/nested\/DETAIL.MD: 1004 words.*1,?003/,
  );
  assert.match(
    failures.join("\n"),
    /local\/nested\/no-upstream.md: 1001 words.*1,?000/,
  );
});

test("upstream reconciliation reports changed file ceilings", () => {
  const contents = { "sample/nested/detail.md": words(1000) };
  const base = wordTree(contents, {}, { "nested/detail.md": words(1000) });
  const head = wordTree(contents, {}, { "nested/detail.md": words(1101) });
  assert.deepEqual(checkSkillWords(head, base), {
    failures: [],
    ceilingChanges: [
      { path: "sample/nested/detail.md", base: 1200, head: 1321 },
    ],
  });
});

test("word exceptions freeze at introduction, shrink against Git history and leave permanently", (t) => {
  const root = mkdtempSync(join(tmpdir(), "skill-word-guard-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (args) =>
    execFixtureGit(["-C", root, ...args], { encoding: "utf8" });
  function commit() {
    git(["add", "-A"]);
    git([
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@example.test",
      "commit",
      "-qm",
      "record skill words",
    ]);
    return gitTree(root, "HEAD");
  }
  function write(path, content) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  const name = "local/SKILL.md";
  const skill = ".agents/skills/" + name;
  const contents = (count) => write(skill, words(count));
  const allowanceRecord = (allowances) =>
    write(
      exceptionPath,
      JSON.stringify({ introductionBase: introduction.commit, allowances }),
    );
  const check = (base) => checkSkillWords(directoryTree(root), base).failures;
  const readSetScript = fileURLToPath(
    new URL("../scripts/read-set.mjs", import.meta.url),
  );
  const compare = (...args) =>
    spawnSync(process.execPath, [readSetScript, "compare", ...args], {
      cwd: root,
      encoding: "utf8",
    });

  git(["init", "-q"]);
  write("upstream-bases.json", JSON.stringify({ skills: { local: null } }));
  contents(1050);
  const planBase = commit();
  contents(1100);
  const introduction = commit();
  allowanceRecord({ [name]: 1101 });
  assert.match(
    check(introduction).join("\n"),
    /frozen word allowance must remain 1100/,
  );
  allowanceRecord({ [name]: 1100 });
  assert.deepEqual(check(introduction), []);
  const original = commit();
  const planComparison = compare(planBase.commit);
  assert.equal(planComparison.status, 1);
  assert.match(planComparison.stdout, /local \| 5250 \| 5500 \| 250/);
  assert.match(planComparison.stderr, /read set grew/);
  assert.doesNotMatch(planComparison.stderr, /word exception/);
  write(
    "description.md",
    "## Merge Danger\n\nRead set: Cover the added instructions.\n",
  );
  const prComparison = compare(
    planBase.commit,
    "--description",
    "description.md",
  );
  assert.equal(prComparison.status, 1);
  assert.match(
    prComparison.stderr,
    /cannot add a word exception absent from the base/,
  );
  rmSync(join(root, "description.md"));

  contents(1101);
  assert.match(
    check().join("\n"),
    /1101 words exceeds the frozen allowance of 1100/,
  );
  contents(1050);
  assert.deepEqual(check(original), []);
  const trimmed = commit();
  contents(1075);
  assert.match(
    check(trimmed).join("\n"),
    /word exception grew from 1050 to 1075/,
  );
  allowanceRecord({ [name]: 1075 });
  assert.match(
    check(trimmed).join("\n"),
    /frozen word allowance must remain 1100/,
  );

  contents(1000);
  allowanceRecord({ [name]: 1100 });
  assert.match(check(trimmed).join("\n"), /remove the word exception/);
  rmSync(join(root, skill));
  assert.match(check(trimmed).join("\n"), /remove the word exception/);
  contents(1000);
  allowanceRecord({});
  assert.deepEqual(check(trimmed), []);
  const compliant = commit();

  contents(1001);
  assert.match(
    check(compliant).join("\n"),
    /1001 words exceeds the ceiling of 1000/,
  );
  allowanceRecord({ [name]: 1100 });
  assert.match(
    check(compliant).join("\n"),
    /cannot add a word exception absent from the base/,
  );
  allowanceRecord({ "local/added.md": 1100 });
  write(".agents/skills/local/added.md", words(1100));
  assert.match(
    check(compliant).join("\n"),
    /local\/added.md: cannot add a word exception absent from the base/,
  );
});

test("the PR check includes description edits and executes head code with read-only permissions", () => {
  const workflow = parse(
    readFileSync(
      new URL("../.github/workflows/read-set.yml", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(workflow.on, {
    pull_request: { types: ["opened", "edited", "synchronize", "reopened"] },
  });
  assert.deepEqual(workflow.permissions, { contents: "read" });
  const job = workflow.jobs["read-set"];
  assert.equal(job.name, "Read set");
  const checkout = job.steps.find((step) =>
    step.uses?.startsWith("actions/checkout@"),
  );
  assert.equal(checkout.with.ref, "${{ github.event.pull_request.head.sha }}");
  assert.equal(checkout.with["persist-credentials"], false);
  assert.equal(checkout.with["fetch-depth"], 0);
  const comparison = job.steps.find((step) => step.env?.BASE_SHA);
  assert.equal(
    comparison.env.BASE_SHA,
    "${{ github.event.pull_request.base.sha }}",
  );
  assert.match(comparison.run, /GITHUB_EVENT_PATH/);
  assert.match(
    comparison.run,
    /node scripts\/read-set\.mjs compare "\$BASE_SHA" --description/,
  );
});
