import "./helpers/temporary-directory.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parseStandards } from "../scripts/standards-declarations.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// The release the standards update workflow pins, from its tag comment.
function workflowRelease() {
  const pin =
    /uses: lutzseverino\/repo-standards@[0-9a-f]{40} # v(\d+\.\d+\.\d+)\n/.exec(
      read(".github/workflows/standards-update.yml"),
    );
  assert.ok(pin, "the workflow pins Repository Standards with a release tag");
  return pin[1];
}

test("the declared update command, the rules and the workflow name one Repository Standards release", () => {
  const { "update-command": command } = parseStandards(read("standards.yaml"));
  assert.equal(
    command,
    `npm exec --yes --package @lutzseverino/repo-standards@${workflowRelease()} -- repo-standards-update`,
  );
  for (const path of [
    "rules/github-repository-configuration.md",
    "docs/development/standards-update-workflow.md",
  ])
    assert.ok(
      read(path).includes(`\n${command}\n`),
      `${path} shows the command`,
    );
});

test("the declared update command launches the pinned executable in the adopter checkout with its token", () => {
  const { "update-command": command } = parseStandards(read("standards.yaml"));
  assert.equal(typeof command, "string");

  const checkout = realpathSync(
    mkdtempSync(join(tmpdir(), "adopter checkout ")),
  );
  const origin = "https://github.com/fixture/adopter.git";
  const token = "fixture-update-token";
  const modules = join(checkout, "node_modules");
  const packageDir = join(modules, "@lutzseverino/repo-standards");
  mkdirSync(packageDir, { recursive: true });
  mkdirSync(join(modules, ".bin"));
  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify({
      name: "@lutzseverino/repo-standards",
      version: workflowRelease(),
      bin: { "repo-standards-update": "update.cjs" },
    }),
  );
  writeFileSync(
    join(packageDir, "update.cjs"),
    `#!/usr/bin/env node
const { execFileSync } = require("node:child_process");
console.log(JSON.stringify({
  args: process.argv.slice(2),
  origin: execFileSync("git", ["config", "--get", "remote.origin.url"], { encoding: "utf8" }).trim(),
  checkout: process.cwd(),
  token: process.env.REPO_STANDARDS_TOKEN,
}));
`,
    { mode: 0o755 },
  );
  symlinkSync(
    "../@lutzseverino/repo-standards/update.cjs",
    join(modules, ".bin/repo-standards-update"),
  );
  execFileSync("git", ["init", "--quiet", "--initial-branch=main", checkout]);
  execFileSync("git", ["-C", checkout, "remote", "add", "origin", origin]);

  const output = execFileSync("sh", ["-c", command], {
    cwd: checkout,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      REPO_STANDARDS_TOKEN: token,
      npm_config_offline: "true",
      npm_config_cache: join(tmpdir(), "npm"),
    },
  });
  assert.deepEqual(JSON.parse(output), { args: [], origin, checkout, token });
});
