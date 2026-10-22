import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { installedValidator } from "./helpers/installed-validator.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const title = "feat: validate trusted metadata";
const body =
  "## Summary\n\nPreserve trusted metadata.\n\n## Evidence\n\nExecutable fixtures pass.\n\n## Merge Danger\n\nA reversible source change.\n\n## Related issue\n\nCloses #530";

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "validator-entry-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const preload = join(directory, "older-node.mjs");
  writeFileSync(
    preload,
    `import { registerHooks } from "node:module";
registerHooks({ load(url, context, next) {
  const result = next(url, context);
  if (!url.endsWith(".mjs") || !result.source) return result;
  return { ...result, source: String(result.source).replaceAll("import.meta.main", "undefined") };
} });
globalThis.fetch = () => { throw new Error("Unexpected network access"); };
`,
  );
  const event = join(directory, "event.json");
  const neutral = join(directory, "neutral.json");
  writeFileSync(
    event,
    JSON.stringify({
      pull_request: { title, body, head: { repo: { fork: true } } },
    }),
  );
  writeFileSync(
    neutral,
    JSON.stringify({ kind: "pr-metadata", pullRequest: { title, body } }),
  );
  return { directory, preload, event, neutral };
}

test("importing consumers never runs a trigger, including before import.meta.main", (t) => {
  const files = [
    "scripts/validate.mjs",
    ".github/scripts/validate.mjs",
    "scripts/validate-issue-contract.mjs",
    ".github/scripts/validate-pr-metadata.mjs",
    ".agents/skills/babysit/wait.mjs",
    ".agents/skills/babysit/merge.mjs",
  ];
  const { preload, directory } = fixture(t);
  for (const oldRuntime of [false, true]) {
    const code = `for (const url of ${JSON.stringify(files.map((path) => new URL(`../${path}`, import.meta.url).href))}) await import(url); console.log("Imports stayed inert");`;
    const result = spawnSync(
      process.execPath,
      [
        ...(oldRuntime ? ["--import", preload] : []),
        "--input-type=module",
        "-e",
        code,
        "unused-argument",
      ],
      {
        cwd: directory,
        encoding: "utf8",
        env: { ...process.env, GITHUB_EVENT_PATH: "/unreadable-event" },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "Imports stayed inert\n");
    assert.equal(result.stderr, "");
  }
});

test("installed trusted trigger and neutral command execute before import.meta.main", (t) => {
  const { directory, preload, event, neutral } = fixture(t);
  for (const [target, args] of [
    [".github/scripts/validate.mjs", ["pr-metadata"]],
    ["scripts/validate.mjs", [neutral]],
  ]) {
    const script = installedValidator(t, target);
    const result = spawnSync(
      process.execPath,
      ["--import", preload, script, ...args],
      {
        cwd: directory,
        encoding: "utf8",
        env: { ...process.env, GITHUB_EVENT_PATH: event },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PR metadata validation passed/);
    assert.equal(result.stderr, "");
  }
});

test("installed babysit entrypoints reject invalid arguments on the older runtime", (t) => {
  const { directory, preload } = fixture(t);
  for (const name of ["wait", "merge"]) {
    const script = installedValidator(t, `.agents/skills/babysit/${name}.mjs`);
    const result = spawnSync(process.execPath, ["--import", preload, script], {
      cwd: directory,
      encoding: "utf8",
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /usage:/i);
    assert.equal(result.stdout, "");
  }
});

test("common command consumes neutral PR data and does not reinterpret a GitHub payload", (t) => {
  const { directory, event, neutral } = fixture(t);
  const script = join(root, "scripts/validate.mjs");
  const valid = spawnSync(process.execPath, [script, neutral], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(valid.status, 0, valid.stderr);
  const raw = spawnSync(process.execPath, [script, event], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(raw.status, 1);
  assert.match(raw.stderr, /Choose issue-contract or pr-metadata/);
});

test("babysit reads only the current CLI credential and redacts acquisition failures", (t) => {
  const { directory } = fixture(t);
  const fake = join(directory, "gh");
  const calls = join(directory, "calls.json");
  const shim = join(directory, "credential.mjs");
  writeFileSync(
    fake,
    `#!/bin/sh\nexec '${process.execPath}' '${shim}' "$@"\n`,
    { mode: 0o755 },
  );
  writeFileSync(
    shim,
    `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2))); process[process.env.FIXTURE_FAIL ? "stderr" : "stdout"].write("fixture-private-token"); if (process.env.FIXTURE_FAIL) process.exit(1);`,
  );
  const code = `import { connectionFor } from ${JSON.stringify(new URL("../.agents/skills/babysit/platform.mjs", import.meta.url).href)}; try { console.log(connectionFor("example/repository").repository.path); } catch (error) { console.error(error.message); process.exitCode = 1; }`;
  for (const fail of [false, true]) {
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", code],
      {
        cwd: directory,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          FIXTURE_FAIL: fail ? "1" : "",
        },
      },
    );
    assert.equal(result.status, fail ? 1 : 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /fixture-private-token/);
    assert.deepEqual(JSON.parse(readFileSync(calls, "utf8")), [
      "auth",
      "token",
      "--hostname",
      "github.com",
    ]);
    if (fail)
      assert.match(
        result.stderr,
        /currently authenticated GitHub CLI credential/,
      );
    else assert.equal(result.stdout, "example/repository\n");
  }
});
