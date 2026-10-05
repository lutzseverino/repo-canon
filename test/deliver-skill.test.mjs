import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const skill = new URL("../.agents/skills/deliver/", import.meta.url);

test("the deliver skill is manual only in both invocation settings", () => {
  const frontmatter =
    /^---\n([\s\S]*?)\n---\n/.exec(
      readFileSync(new URL("SKILL.md", skill), "utf8"),
    )?.[1] ?? "";
  assert.match(frontmatter, /^name: deliver$/m);
  assert.match(frontmatter, /^disable-model-invocation: true$/m);
  const policy = readFileSync(new URL("agents/openai.yaml", skill), "utf8");
  assert.match(policy, /^policy:\n {2}allow_implicit_invocation: false$/m);
});
