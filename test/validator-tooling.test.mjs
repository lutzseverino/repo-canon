import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
// Verbatim configurations at the audit's commits, not a new tool preset.
const samples = JSON.parse(
  readFileSync(
    new URL("fixtures/validator-tooling.json", import.meta.url),
    "utf8",
  ),
);
const retired = ["scripts/validate.mjs", "scripts/validate-issue-contract.mjs"];
const owned = "scripts/validate-project.mjs";
const project = "scripts/project.mjs";
const namespace = [
  ...retired.map((path) => path.replace("scripts/", "vendor/repo-canon/")),
  "vendor/repo-canon/another-command.mjs",
];
const poison = "export const = ;\n";

// Fixture contextual work: only remove an established old-validator pattern
// when no remaining code needs it. This is not a shipped configuration writer.
function cleanup(text, remaining) {
  return text
    .split(/(?<=\n)/)
    .filter((line) => {
      const path = line
        .trim()
        .replace(/^"|",?$/g, "")
        .replace(/^\//, "");
      if (![...retired, "scripts/validate*.mjs"].includes(path)) return true;
      const matches = (file) =>
        path === file ||
        (path === "scripts/validate*.mjs" &&
          /^scripts\/validate.*\.mjs$/.test(file));
      return remaining.some(matches);
    })
    .join("");
}

for (const sample of samples) {
  test(`${sample.repository}@${sample.revision}: vendor treatment needs no executable inventory`, async (t) => {
    for (const remaining of [[], [retired[1], owned]]) {
      const directory = mkdtempSync(join(tmpdir(), "validator-tooling-"));
      t.after(() => rmSync(directory, { recursive: true, force: true }));
      for (const [path, text] of Object.entries(sample.configs)) {
        const cleaned = cleanup(text, remaining);
        // Cleanup removes whole validator-specific lines, preserving every
        // unrelated byte, including the other exact installed-file exclusions.
        assert.equal(cleanup(cleaned, remaining), cleaned);
        assert.equal(
          cleaned.includes("scripts/**"),
          text.includes("scripts/**"),
        );
        assert.ok(!cleaned.includes("vendor/repo-canon/"));
        writeFileSync(join(directory, path), cleaned);
      }
      for (const path of [...namespace, project, ...remaining]) {
        mkdirSync(dirname(join(directory, path)), { recursive: true });
        writeFileSync(join(directory, path), poison);
      }
      const prettier = await import("prettier");
      for (const path of [...namespace, project, ...remaining]) {
        const { ignored } = await prettier.getFileInfo(join(directory, path), {
          ignorePath: join(directory, ".prettierignore"),
        });
        const broad = sample.configs[".prettierignore"].includes(
          "/scripts/validate*.mjs",
        );
        const expected =
          namespace.includes(path) ||
          (remaining.includes(path) && (path === retired[1] || broad));
        assert.equal(ignored, expected, `${path}: ${remaining}`);
      }
      const lint = spawnSync(
        join(root, "node_modules/.bin/oxlint"),
        ["--format=json", "."],
        { cwd: directory, encoding: "utf8" },
      );
      assert.equal(lint.status, 1, lint.stderr + lint.stdout);
      const result = JSON.parse(lint.stdout);
      const reported = result.diagnostics.map(({ filename }) => filename);
      assert.ok(reported.includes(project), lint.stdout);
      for (const path of namespace)
        assert.ok(!reported.includes(path), lint.stdout);
      if (remaining.length) {
        assert.ok(!reported.includes(retired[1]), lint.stdout);
        const broad = sample.configs[".oxlintrc.json"].includes(
          '"scripts/validate*.mjs"',
        );
        assert.equal(reported.includes(owned), !broad, lint.stdout);
      }
    }
  });
}

// Canon authors the two validators: exercise its real source configuration
// with a disposable new module, so an exclusion regression cannot silently
// drop all checks just because the files moved under vendor/.
test("Canon's authored validator namespace remains in formatter and lint scope", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "canon-validator-tooling-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const file of [".prettierignore", ".oxlintrc.json"])
    writeFileSync(join(directory, file), readFileSync(join(root, file)));
  const path = "vendor/repo-canon/another-command.mjs";
  mkdirSync(dirname(join(directory, path)), { recursive: true });
  writeFileSync(join(directory, path), poison);
  const prettier = await import("prettier");
  assert.equal(
    (
      await prettier.getFileInfo(join(directory, path), {
        ignorePath: join(directory, ".prettierignore"),
      })
    ).ignored,
    false,
  );
  const lint = spawnSync(
    join(root, "node_modules/.bin/oxlint"),
    ["--format=json", "."],
    { cwd: directory, encoding: "utf8" },
  );
  assert.equal(lint.status, 1, lint.stderr + lint.stdout);
  assert.ok(
    JSON.parse(lint.stdout).diagnostics.some(
      ({ filename }) => filename === path,
    ),
    lint.stdout,
  );
});
