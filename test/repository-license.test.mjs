import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { declarations } from "../scripts/standards-declarations.mjs";

test("the repository license has its own contextual file declaration", () => {
  const profiles = declarations(fileURLToPath(new URL("..", import.meta.url)));
  for (const profile of [profiles.standard, profiles.factory]) {
    assert.deepEqual(
      profile.find(({ id }) => id === "repository-license"),
      {
        id: "repository-license",
        kind: "file",
        target: "LICENSE",
        guidance: "guidance/repository-license.md",
        rules: "rules/repository-license.md",
      },
    );
    assert.equal(
      profile.filter(({ target }) => target === "LICENSE").length,
      1,
    );
    const readme = profile.find(({ id }) => id === "repository-readme");
    assert.equal(readme.kind, "file");
    assert.equal(readme.target, "README.md");
  }
});
