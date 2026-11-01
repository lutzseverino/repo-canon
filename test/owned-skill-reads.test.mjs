import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkOwnedSkillReads,
  namedPaths,
  skillProblems,
} from "../scripts/owned-skill-reads.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

// A disposable fixture skill from a map of relative paths to contents.
function fixtureSkill(t, files) {
  const directory = mkdtempSync(join(tmpdir(), "repo-canon-skill-reads-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), content);
  }
  return directory;
}

const frontmatter = "---\nname: fixture\ndescription: A fixture.\n---\n\n";

test("every owned skill names only its own files and the files its Reads section lists, and no host", () => {
  assert.deepEqual(checkOwnedSkillReads(root), []);
  const run = spawnSync(
    process.execPath,
    [join(root, "scripts/owned-skill-reads.mjs"), "check"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
});

test("a fixture skill naming an undeclared repository path fails", (t) => {
  const directory = fixtureSkill(t, {
    "SKILL.md": `${frontmatter}Read \`CONTRIBUTING.md\` before merging.\n`,
  });
  assert.deepEqual(skillProblems(directory, "fixture"), [
    "fixture/SKILL.md:6: names CONTRIBUTING.md, which is outside the skill and not in its Reads section",
  ]);
});

test("a fixture skill naming T3 Code or another host application fails", (t) => {
  for (const [host, text] of [
    ["T3 Code", "Map these steps to T3 Code's tools."],
    ["t3_", "Call t3_delegate_task for each launch."],
    ["Claude Code", "Run this in Claude Code."],
    ["Codex", "Use the Codex app's schedule."],
    ["Cursor", "Open the plan in Cursor."],
  ]) {
    const directory = fixtureSkill(t, {
      "SKILL.md": `${frontmatter}${text}\n`,
    });
    assert.deepEqual(
      skillProblems(directory, "fixture"),
      [`fixture/SKILL.md:6: names the host ${host}`],
      host,
    );
  }
  const pagination = fixtureSkill(t, {
    "page.mjs": "const cursor = page.pageInfo.endCursor;\n",
  });
  assert.deepEqual(skillProblems(pagination, "fixture"), []);
});

test("a Reads section declares the paths it lists, each with its behavior when missing", (t) => {
  const directory = fixtureSkill(t, {
    "SKILL.md": `${frontmatter}Read \`CONTRIBUTING.md\`, \`docs/adr/0001-slug.md\` and \`.out-of-scope/dark-mode.md\`.

## Reads

- \`CONTRIBUTING.md\`: the merge conditions. When it is missing, merge once
  the required checks pass.
- \`docs/adr/\`: the decisions. When it is missing, proceed without them.
- \`.out-of-scope/<concept>.md\`: rejected requests, such as \`dark-mode.md\`.
  When the directory is missing, there are none.
`,
  });
  assert.deepEqual(skillProblems(directory, "fixture"), []);

  const silent = fixtureSkill(t, {
    "SKILL.md": `${frontmatter}## Reads\n\n- \`CONTRIBUTING.md\`: the merge conditions.\n`,
  });
  assert.deepEqual(skillProblems(silent, "fixture"), [
    "fixture/SKILL.md: Reads item does not say what the skill does when the file is missing: `CONTRIBUTING.md`: the merge conditions.",
  ]);
});

test("the skill's own files, examples, URLs and slash commands name no repository path", (t) => {
  const directory = fixtureSkill(t, {
    "SKILL.md": `${frontmatter}See [the format](./FORMAT.md), \`scripts/run.sh\` and \`FORMAT.md\`.
Run \`/setup-matt-pocock-skills\`, read <https://example.com/docs/guide.md>,
and run \`node <this skill's directory>/run.mjs\` on Node.js 24.

- **Bad:** "Open src/types/skill.ts and add a field"

\`\`\`text
src/
└── commands/show-me.ts
\`\`\`
`,
    "FORMAT.md": "A format.\n",
    "scripts/run.sh": "#!/bin/sh\n",
    "run.mjs": 'import { readFileSync } from "node:fs";\n',
  });
  assert.deepEqual(skillProblems(directory, "fixture"), []);
});

test("a script's paths and imports outside the skill need a Reads entry or a named skill", (t) => {
  const script = `import { connect } from "../babysit/platform.mjs";
import { parse } from "../../../vendor/parse5/parse5.esm.js";
const policy = ".github/factory-review-policy.json";
`;
  const undeclared = fixtureSkill(t, {
    "SKILL.md": frontmatter,
    "wait.mjs": script,
  });
  assert.deepEqual(skillProblems(undeclared, "fixture"), [
    "fixture/wait.mjs:1: depends on the babysit skill, which its Reads section does not name: ../babysit/platform.mjs",
    "fixture/wait.mjs:2: names vendor/parse5/parse5.esm.js, which is outside the skill and not in its Reads section: ../../../vendor/parse5/parse5.esm.js",
    "fixture/wait.mjs:3: names .github/factory-review-policy.json, which is outside the skill and not in its Reads section",
  ]);

  const declared = fixtureSkill(t, {
    "SKILL.md": `${frontmatter}## Reads

- The \`babysit\` skill: \`wait.mjs\` imports its connection. When it is
  missing, the script cannot start.
- \`vendor/parse5/parse5.esm.js\`: the parser. When it is missing, the script
  cannot start.
- \`.github/factory-review-policy.json\`: the optional policy. When it is
  missing, no author is exempt.
`,
    "wait.mjs": script,
  });
  assert.deepEqual(skillProblems(declared, "fixture"), []);
});

test("Markdown paths outside fences and quotations are found with their lines", () => {
  assert.deepEqual(
    namedPaths(
      'Read `GLOSSARY.md`.\n```\ndocs/adr/\n```\n"see docs/x.md" and [guide](../../../CONTRIBUTING.md#credentials)\n',
      { markdown: true },
    ),
    [
      { path: "GLOSSARY.md", line: 1 },
      { path: "../../../CONTRIBUTING.md", line: 5 },
    ],
  );
});
