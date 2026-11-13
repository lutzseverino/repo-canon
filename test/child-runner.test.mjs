import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runChild } from "./helpers/child-runner.mjs";

test("a command exceeding its total bound returns its partial output and diagnosis", async () => {
  const result = await runChild(
    process.execPath,
    [
      "-e",
      `console.log("partial stdout"); console.error("partial stderr"); setInterval(() => console.log("still running"), 100);`,
    ],
    {
      kind: "command",
      boundMs: 1000,
    },
  );
  assert.equal(result.status, null);
  assert.equal(result.signal, "SIGKILL");
  assert.equal(result.timeout.bound, "total");
  assert.ok(result.elapsedMs >= 1000);
  assert.match(result.stdout, /partial stdout/);
  assert.match(result.stderr, /partial stderr/);
  assert.match(
    result.error.message,
    /total.*1000.*partial stdout.*partial stderr/s,
  );
  assert.match(result.error.message, /node/);
});

function nested(t, files, boundMs = 1000) {
  const cwd = mkdtempSync(join(tmpdir(), "child-runner-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  for (const [name, source] of Object.entries(files))
    writeFileSync(join(cwd, name), source);
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return runChild(
    process.execPath,
    ["--test", "--test-concurrency=2", ...Object.keys(files)],
    { kind: "nested", boundMs, cwd, env },
  );
}

test("a stalled nested run reports the last completion, all unfinished tests and partial output", async (t) => {
  const result = await nested(t, {
    "stall.mjs": `import test from "node:test";
      test("completed", () => {});
      test("unfinished", async () => { console.log("nested partial"); console.error("nested error"); await new Promise(() => setInterval(() => {}, 1000)); });`,
  });
  assert.equal(result.status, null);
  assert.equal(result.signal, "SIGKILL");
  assert.equal(result.timeout.bound, "no-progress");
  assert.equal(result.timeout.lastCompleted.name, "completed");
  assert.ok(
    result.timeout.unfinished.some((entry) => entry.name === "unfinished"),
  );
  assert.match(
    result.error.message,
    /completed.*unfinished.*nested partial.*nested error/s,
  );
});

test("completion progress survives buffered TAP and several no-progress periods of total runtime", async (t) => {
  const result = await nested(t, {
    "a-slow.mjs": `import test from "node:test";
      import { existsSync, writeFileSync } from "node:fs";
      import { setTimeout } from "node:timers/promises";
      test("earlier slow test", async () => {
        writeFileSync("started", "");
        while (!existsSync("finished")) await setTimeout(10);
      });`,
    "b-progress.mjs": `import test from "node:test";
      import { existsSync, writeFileSync } from "node:fs";
      import { setTimeout } from "node:timers/promises";
      while (!existsSync("started")) await setTimeout(10);
      for (let i = 0; i < 30; i++) {
        await test("later completion " + i, async () => { await setTimeout(100); });
      }
      writeFileSync("finished", "");
      process.exitCode = 7;`,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.timeout, undefined);
  assert.equal(result.status, 1, result.stderr);
  assert.ok(result.elapsedMs > 3000);
  assert.match(result.stdout, /earlier slow test/);
  assert.match(result.stdout, /later completion 29/);
});

test("nested output counts as progress and returns a passing exit status", async (t) => {
  const result = await nested(t, {
    "output.mjs": `import test from "node:test";
      import { setTimeout } from "node:timers/promises";
      test("verbose test", async () => {
        for (let i = 0; i < 20; i++) {
          console.log("stdout progress"); console.error("stderr progress");
          await setTimeout(100);
        }
      });`,
  });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  assert.equal(result.timeout, undefined);
  assert.ok(result.elapsedMs > 2000);
  assert.match(result.stdout, /stdout progress/);
  assert.match(result.stdout, /stderr progress/);
});
