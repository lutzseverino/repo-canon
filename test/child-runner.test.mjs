import "./helpers/temporary-directory.mjs";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { runChild } from "./helpers/child-runner.mjs";

const boundMs = 1000;

/** @typedef {(ms: number) => void} Advance */
/** @typedef {(event: import("./helpers/child-runner.mjs").ProgressEvent, advance: Advance) => void} ObserveNested */

/**
 * Advance time from observed child I/O, independently of the runner's refreshes.
 * @param {{observeChild?: (child: import("node:child_process").ChildProcess, advance: Advance) => void, observeNested?: ObserveNested}} observers
 * @returns {import("./helpers/child-runner.mjs").Timing}
 */
function controlledTime({ observeChild, observeNested }) {
  let now = 0;
  return {
    now: () => now,
    startTimer(expire, bound, child) {
      let deadline = now + bound;
      const advance = (/** @type {number} */ ms) => {
        now += ms;
        if (now >= deadline) {
          deadline = Infinity;
          expire();
        }
      };
      // The runner's listeners consume command output before the clock advances.
      if (observeChild) child.once("spawn", () => observeChild(child, advance));
      return {
        refresh: () => {
          deadline = now + bound;
        },
        clear: () => {
          deadline = Infinity;
        },
        afterNestedEvent: (event) => observeNested?.(event, advance),
      };
    },
  };
}

test("a command exceeding its total bound returns its partial output and diagnosis", async () => {
  const result = await runChild(
    process.execPath,
    [
      "-e",
      `console.log("partial stdout"); console.error("partial stderr"); setInterval(() => {}, 1000);`,
    ],
    {
      kind: "command",
      boundMs,
      timing: controlledTime({
        observeChild(child, advance) {
          for (const input of [child.stdout, child.stderr])
            createInterface({ input }).once("line", () => advance(boundMs / 2));
        },
      }),
    },
  );
  assert.equal(result.status, null);
  assert.equal(result.signal, "SIGKILL");
  assert.equal(result.timeout.bound, "total");
  assert.equal(result.elapsedMs, boundMs);
  assert.match(result.stdout, /partial stdout/);
  assert.match(result.stderr, /partial stderr/);
  assert.match(
    result.error.message,
    /total.*1000.*partial stdout.*partial stderr/s,
  );
  assert.match(result.error.message, /node/);
});

test("the default timer ends a command that never exits at its total bound", async () => {
  // Only the default timer can end this child, however slowly the host runs it.
  const result = await runChild(
    process.execPath,
    ["-e", "setInterval(() => {}, 1000);"],
    { kind: "command", boundMs: 100 },
  );
  assert.equal(result.status, null);
  assert.equal(result.signal, "SIGKILL");
  assert.equal(result.timeout.bound, "total");
  assert.match(result.error.message, /total bound \(100 ms\)/);
});

test("a signal ending the awaiting process also ends its detached child", async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), "child-runner-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const pidPath = join(cwd, "pid");
  const parent = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { runChild } from ${JSON.stringify(new URL("./helpers/child-runner.mjs", import.meta.url).href)};
      await runChild(process.execPath, ["-e", ${JSON.stringify(
        `const { renameSync, writeFileSync } = require("node:fs");
        const pidPath = ${JSON.stringify(pidPath)};
        writeFileSync(pidPath + ".new", String(process.pid));
        renameSync(pidPath + ".new", pidPath);
        setInterval(() => {}, 1000);`,
      )}], { kind: "command", boundMs: 60000 });`,
    ],
    { stdio: "ignore" },
  );
  const exited = once(parent, "exit");
  while (!existsSync(pidPath)) await delay(10);
  const pid = readFileSync(pidPath, "utf8");
  parent.kill("SIGTERM");
  assert.deepEqual(await exited, [null, "SIGTERM"]);
  // A killed child may linger as a zombie until init reaps it.
  const alive = () =>
    !/^\s*(Z|$)/.test(
      spawnSync("ps", ["-o", "stat=", "-p", pid], { encoding: "utf8" }).stdout,
    );
  for (let i = 0; alive() && i < 100; i++) await delay(50);
  assert.equal(alive(), false);
});

/** @param {ObserveNested} observeNested */
function nested(t, files, observeNested) {
  const cwd = mkdtempSync(join(tmpdir(), "child-runner-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  for (const [name, source] of Object.entries(files))
    writeFileSync(join(cwd, name), source);
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return runChild(
    process.execPath,
    ["--test", "--test-concurrency=2", ...Object.keys(files)],
    {
      kind: "nested",
      boundMs,
      cwd,
      env,
      timing: controlledTime({ observeNested }),
    },
  );
}

test("a stalled nested run reports the last completion, all unfinished tests and partial output", async (t) => {
  const pending = new Set([
    "test:complete:completed",
    "test:dequeue:unfinished",
    "test:stdout:nested partial",
    "test:stderr:nested error",
  ]);
  const result = await nested(
    t,
    {
      "stall.mjs": `import test from "node:test";
      test("completed", () => {});
      test("unfinished", async () => { console.log("nested partial"); console.error("nested error"); await new Promise(() => setInterval(() => {}, 1000)); });`,
    },
    (event, advance) => {
      const record = `${event.type}:${event.test?.name ?? event.message?.trim()}`;
      if (pending.delete(record) && pending.size === 0) advance(boundMs);
    },
  );
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

// Each record advances less than one bound, but six records span several.
const progressStepMs = 600;

test("completion progress survives buffered TAP and several no-progress periods of total runtime", async (t) => {
  const result = await nested(
    t,
    {
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
      for (let i = 0; i < 6; i++) {
        await test("later completion " + i, () => {});
      }
      writeFileSync("finished", "");
      process.exitCode = 7;`,
    },
    (event, advance) => {
      if (
        event.type === "test:complete" &&
        event.test?.name.startsWith("later completion ")
      )
        advance(progressStepMs);
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.timeout, undefined);
  assert.equal(result.status, 1, result.stderr);
  assert.ok(result.elapsedMs > 3000);
  assert.match(result.stdout, /earlier slow test/);
  assert.match(result.stdout, /later completion 5/);
});

test("nested output counts as progress and returns a passing exit status", async (t) => {
  const result = await nested(
    t,
    {
      "output.mjs": `import test from "node:test";
      test("verbose test", () => {
        for (let i = 0; i < 6; i++) {
          console.log("stdout progress"); console.error("stderr progress");
        }
      });`,
    },
    (event, advance) => {
      // Node emits stderr as lines and can combine stdout writes in one event.
      if (
        event.type === "test:stderr" &&
        event.message?.trim() === "stderr progress"
      )
        advance(progressStepMs);
    },
  );
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  assert.equal(result.timeout, undefined, result.error?.message);
  assert.ok(result.elapsedMs > 2000);
  assert.match(result.stdout, /stdout progress/);
  assert.match(result.stdout, /stderr progress/);
});
