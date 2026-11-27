import "./helpers/temporary-directory.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  rmSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  runtimeFiles,
  runtimeContents,
  runtimeDirectory,
} from "../scripts/babysit-runtime.mjs";
import { skillProblems } from "../scripts/owned-skill-reads.mjs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

test("a standalone babysit copy starts every command without adoption or npm", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "babysit-standalone-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  cpSync(new URL(".agents/skills/babysit/", root), join(directory, "babysit"), {
    recursive: true,
  });
  for (const command of ["request", "wait", "merge", "branch-update"]) {
    const result = spawnSync(
      process.execPath,
      [join(directory, "babysit", `${command}.mjs`)],
      {
        cwd: directory,
        encoding: "utf8",
        timeout: 15000,
        env: { PATH: process.env.PATH },
      },
    );
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /usage:/i, command);
    assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND/);
  }
});

test("shipped runtime matches every canonical owner and retains all license notices", () => {
  const directory = new URL(`${runtimeDirectory}/`, root);
  const files = readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name).slice(fileURLToPath(directory).length),
    )
    .sort();
  assert.deepEqual(files, [...runtimeFiles, "package.json"].sort());
  for (const path of runtimeFiles) {
    assert.equal(
      readFileSync(new URL(path, directory), "utf8"),
      runtimeContents(fileURLToPath(root), path),
      path,
    );
  }
});

test("an edited runtime copy still undergoes standalone path checking", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "babysit-runtime-scan-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  cpSync(new URL(".agents/skills/babysit/", root), directory, {
    recursive: true,
  });
  const path = join(directory, "runtime/vendor/postern/postern.mjs");
  writeFileSync(
    path,
    readFileSync(path, "utf8") + "\n// Read secret/location.json\n",
  );
  assert.ok(
    skillProblems(directory, "babysit").some((problem) =>
      problem.includes("secret/location.json"),
    ),
  );
});

test("standalone request and wait retain trusted checks through the shipped adapter", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "babysit-standalone-adapter-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  cpSync(new URL(".agents/skills/babysit/", root), join(directory, "babysit"), {
    recursive: true,
  });
  const state = join(directory, "state.json");
  writeFileSync(
    state,
    JSON.stringify({
      head: "a".repeat(40),
      author: "owner",
      body: "",
      createdAt: "2026-10-11T05:00:00Z",
      pushedAt: "2026-10-11T05:00:00Z",
      reviewConfiguration: { policy: null, reviewer: null },
      checks: [
        {
          __typename: "StatusContext",
          context: "CI",
          state: "SUCCESS",
          targetUrl: "https://ci/1",
        },
      ],
    }),
  );
  const fixture = new URL("./fixtures/postern-babysit.mjs", import.meta.url);
  for (const command of ["request", "wait"]) {
    const script = new URL(
      `file://${join(directory, "babysit", `${command}.mjs`)}`,
    );
    const bundle = new URL("runtime/vendor/postern/postern.mjs", script);
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { main } from ${JSON.stringify(script.href)};
       import { connect } from ${JSON.stringify(bundle.href)};
       import { fixtureConnection } from ${JSON.stringify(fixture.href)};
       process.exitCode = await main(["12", ${command === "wait" ? '"--limit", "1", "--interval", "0.01"' : ""}], fixtureConnection(connect));`,
      ],
      {
        cwd: directory,
        encoding: "utf8",
        timeout: 15000,
        env: { PATH: process.env.PATH, FAKE_GH_STATE: state },
      },
    );
    assert.equal(result.status, 0, result.stderr);
  }
});
