import "./helpers/temporary-directory.mjs";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const lifecycle = new URL("./helpers/temporary-directory.mjs", import.meta.url)
  .href;
const runner = new URL("./helpers/child-runner.mjs", import.meta.url).href;
const release = new URL("../scripts/release/support.mjs", import.meta.url).href;
const cleanup = new URL(
  "./helpers/temporary-directory-cleanup.mjs",
  import.meta.url,
).href;
const hold = "await new Promise(() => {});";

test("every test-side temporary directory site imports the scratch lifecycle", () => {
  // Interrupted runs clean up only files that load the lifecycle module, so a
  // new fixture file must not create scratch in the inherited TMPDIR.
  const helpers = new URL("./helpers/", import.meta.url);
  const files = [
    ...readdirSync(new URL(".", import.meta.url)).map(
      (name) => new URL(name, import.meta.url),
    ),
    ...readdirSync(helpers).map((name) => new URL(name, helpers)),
  ].filter((file) => file.pathname.endsWith(".mjs") && file.href !== lifecycle);
  const missing = files
    .filter((file) => {
      const source = readFileSync(file, "utf8");
      return (
        /TMPDIR|mkdtemp|tmpdir/.test(source) &&
        !/"\.\.?\/(helpers\/)?temporary-directory\.mjs";$/m.test(source)
      );
    })
    .map((file) => file.pathname);
  assert.deepEqual(missing, []);
});

test("temporary cleanup confirms removal after a concurrent descendant disappears", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "repo-canon-cleanup-race-"));
  mkdirSync(join(directory, "descendant"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import assert from "node:assert/strict";
    import fs from "node:fs";
    import { syncBuiltinESMExports } from "node:module";
    import { removeTemporaryDirectory } from ${JSON.stringify(cleanup)};
    const directory = ${JSON.stringify(directory)};
    const remove = fs.rmSync;
    let first = true;
    fs.rmSync = (path, options) => {
      if (path === directory && first) {
        first = false;
        remove(directory + "/descendant", { recursive: true, force: true });
        return;
      }
      return remove(path, options);
    };
    syncBuiltinESMExports();
    removeTemporaryDirectory(directory);
    assert.equal(fs.existsSync(directory), false);
  `,
    ],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 0, child.stderr);
});

/** @param {(paths: {root: string, scratch: string, ready: string, commandReady: string}) => string} body */
function fixture(t, body = () => hold) {
  const root = mkdtempSync(join(tmpdir(), "repo-canon-cleanup-probe-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const scratch = join(root, "scratch");
  mkdirSync(scratch);
  const source = join(root, "hold.test.mjs");
  const ready = join(root, "ready");
  const commandReady = join(root, "command-ready");
  // Keep control files outside the private TMPDIR being observed.
  writeFileSync(
    source,
    `
    import ${JSON.stringify(lifecycle)};
    import test from "node:test";
    import { spawnSync } from "node:child_process";
    import { mkdtempSync, writeFileSync, rmSync, readdirSync } from "node:fs";
    import { tmpdir } from "node:os";
    import { join } from "node:path";
    test("fixture", async (t) => {
      t.after(() => clearInterval(held));
      const held = setInterval(() => {}, 1000);
      const directory = mkdtempSync(join(tmpdir(), "held-"));
      t.after(() => rmSync(directory, { recursive: true, force: true }));
      writeFileSync(${JSON.stringify(ready)}, JSON.stringify({ pid: process.pid, directory }));
      ${body({ root, scratch, ready, commandReady })}
    });
  `,
  );
  return { root, scratch, source, ready, commandReady };
}

async function until(predicate, message) {
  for (let i = 0; i < 1000; i++) {
    if (predicate()) return;
    await delay(10);
  }
  assert.fail(message);
}

function alive(pid) {
  // A dead process can remain a zombie until the container's init reaps it.
  return !/^\s*(Z|$)/.test(
    spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" })
      .stdout,
  );
}

function start(t, f, args = []) {
  /** @type {NodeJS.ProcessEnv} */
  const env = { ...process.env, TMPDIR: f.scratch };
  delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, ["--test", ...args, f.source], {
    env,
    detached: true,
    stdio: "pipe",
  });
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  t.after(() => {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  });
  return { child, closed: once(child, "close"), output: () => output };
}

async function cleaned(f) {
  // Node's signalled runner may exit before the file processes' guardians.
  // Wait for the run's cleanup processes, rather than sleeping after a signal.
  await until(
    () => readdirSync(f.scratch).length === 0,
    "scratch was not removed",
  );
  assert.deepEqual(readdirSync(f.scratch), []);
}

for (const signal of /** @type {NodeJS.Signals[]} */ ([
  "SIGTERM",
  "SIGINT",
  "SIGHUP",
])) {
  for (const group of [false, true]) {
    for (const command of [false, true]) {
      test(
        `${signal} to the ${group ? "process group" : "runner"} cleans ${command ? "a blocking release script" : "fixtures"}`,
        { timeout: 20000 },
        async (t) => {
          const f = fixture(t, ({ commandReady }) =>
            command
              ? `
          spawnSync(process.execPath, ["--input-type=module", "-e", ${JSON.stringify(`
            import { withTemporaryDirectory } from ${JSON.stringify(release)};
            import { writeFileSync } from "node:fs";
            withTemporaryDirectory("release-held-", (directory) => {
              writeFileSync(${JSON.stringify(commandReady)}, JSON.stringify({ pid: process.pid, directory }));
              // A synchronous release callback keeps its finally pending.
              Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
            });
          `)}]);`
              : hold,
          );
          const run = start(t, f);
          await until(
            () => existsSync(command ? f.commandReady : f.ready),
            "fixture did not start",
          );
          const { pid } = JSON.parse(readFileSync(f.ready, "utf8"));
          const childPid = command
            ? JSON.parse(readFileSync(f.commandReady, "utf8")).pid
            : undefined;
          if (group) process.kill(-run.child.pid, signal);
          else run.child.kill(signal);
          const [code, received] = await run.closed;
          assert.ok(
            code !== 0 || received,
            "the interruption must fail the run",
          );
          await cleaned(f);
          assert.equal(alive(pid), false, "test process stopped");
          if (command)
            assert.equal(alive(childPid), false, "release process stopped");
        },
      );
    }
  }
}

for (const ending of ["pass", "fail", "timeout"]) {
  test(`${ending} leaves no scratch`, { timeout: 20000 }, async (t) => {
    const f = fixture(t, () =>
      ending === "pass"
        ? ""
        : ending === "fail"
          ? 'throw new Error("expected failure");'
          : hold,
    );
    const run = start(
      t,
      f,
      ending === "timeout" ? ["--test-timeout=1000"] : [],
    );
    const [code] = await run.closed;
    assert.equal(code, ending === "pass" ? 0 : 1, run.output());
    await cleaned(f);
  });
}

test(
  "a nested bound leaves scratch only inside its caller's root, then removes it all",
  { timeout: 20000 },
  async (t) => {
    const f = fixture(
      t,
      ({ root, scratch }) => `
    const { runChild } = await import(${JSON.stringify(runner)});
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const result = await runChild(process.execPath, ["--test", ${JSON.stringify(join(root, "nested.test.mjs"))}], { kind: "nested", boundMs: 1000, env });
    if (result.timeout?.bound !== "no-progress") throw new Error(result.stderr);
    const top = readdirSync(${JSON.stringify(scratch)});
    if (top.length !== 1 || join(${JSON.stringify(scratch)}, top[0]) !== tmpdir()) throw new Error("nested scratch escaped the caller root");
    if (readdirSync(tmpdir()).some((name) => name.startsWith("nested-"))) throw new Error("nested invocation did not remove its scratch");
  `,
    );
    const nestedReady = join(f.root, "nested-ready");
    writeFileSync(
      join(f.root, "nested.test.mjs"),
      `
    import ${JSON.stringify(lifecycle)};
    import test from "node:test";
    import { mkdtempSync, writeFileSync } from "node:fs";
    import { tmpdir } from "node:os";
    import { join } from "node:path";
    test("held nested fixture", async () => {
      setInterval(() => {}, 1000);
      const directory = mkdtempSync(join(tmpdir(), "nested-held-"));
      writeFileSync(${JSON.stringify(nestedReady)}, directory);
      ${hold}
    });
  `,
    );
    const run = start(t, f);
    const [code] = await run.closed;
    assert.equal(code, 0, run.output());
    assert.ok(
      existsSync(nestedReady),
      "the bound interrupted an active fixture",
    );
    await cleaned(f);
  },
);

test(
  "SIGHUP to the runner stops a nested run with a minimal environment",
  { timeout: 20000 },
  async (t) => {
    const f = fixture(
      t,
      ({ root }) => `
      const { runChild } = await import(${JSON.stringify(runner)});
      const result = await runChild(process.execPath, ["--test", ${JSON.stringify(join(root, "nested.test.mjs"))}], { kind: "nested", boundMs: 5000, env: {} });
      if (result.timeout) throw new Error("nested run unexpectedly hit its bound");
    `,
    );
    const nestedReady = join(f.root, "nested-ready");
    writeFileSync(
      join(f.root, "nested.test.mjs"),
      `
      import ${JSON.stringify(lifecycle)};
      import test from "node:test";
      import { mkdtempSync, writeFileSync } from "node:fs";
      import { tmpdir } from "node:os";
      import { join } from "node:path";
      test("held nested fixture", async () => {
        mkdtempSync(join(tmpdir(), "nested-held-"));
        setInterval(() => {}, 1000);
        writeFileSync(${JSON.stringify(nestedReady)}, JSON.stringify({ pid: process.pid, runner: process.ppid }));
        ${hold}
      });
    `,
    );
    const run = start(t, f);
    await until(() => existsSync(nestedReady), "nested fixture did not start");
    const { pid, runner: nestedRunner } = JSON.parse(
      readFileSync(nestedReady, "utf8"),
    );
    t.after(() => {
      try {
        process.kill(-nestedRunner, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    });
    assert.equal(run.child.kill("SIGHUP"), true);
    const [code, signal] = await run.closed;
    assert.ok(code !== 0 || signal, "the interruption must fail the run");
    await cleaned(f);
    assert.equal(alive(pid), false, "nested test process stopped");
    assert.equal(alive(nestedRunner), false, "nested runner stopped");
  },
);
