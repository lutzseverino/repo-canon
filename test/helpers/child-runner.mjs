import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

/** @typedef {{name: string, file?: string, line?: number, column?: number, testId?: number, entryFile?: string}} NestedTest */
/** @typedef {{bound: string, boundMs: number, command: string[], elapsedMs: number, lastCompleted?: NestedTest, unfinished: NestedTest[]}} Timeout */
/** @typedef {{status: number | null, signal: NodeJS.Signals | null, stdout: string, stderr: string, elapsedMs: number, error?: Error, timeout?: Timeout}} ChildResult */

/**
 * Run an awaited child with an explicit bound; callers own the bound's value.
 * Nested Node test runs receive a live reporter alongside their TAP reporter.
 * @param {string} command
 * @param {string[]} args
 * @param {{kind: "command" | "nested", boundMs: number, cwd?: string, env?: NodeJS.ProcessEnv}} options
 * @returns {Promise<ChildResult>}
 */
export async function runChild(command, args, { kind, boundMs, cwd, env }) {
  if (
    !["command", "nested"].includes(kind) ||
    !Number.isFinite(boundMs) ||
    boundMs <= 0
  )
    throw new Error("A child kind and a positive finite bound are required");
  const nested = kind === "nested";
  const childArgs = nested
    ? [
        "--test-reporter=tap",
        "--test-reporter-destination=stdout",
        `--test-reporter=${fileURLToPath(new URL("./child-progress-reporter.mjs", import.meta.url))}`,
        "--test-reporter-destination=stdout",
        ...args,
      ]
    : args;
  const started = performance.now();
  return await new Promise((resolve) => {
    const child = spawn(command, childArgs, {
      cwd,
      env,
      stdio: nested
        ? ["ignore", "pipe", "pipe", "pipe"]
        : ["ignore", "pipe", "pipe"],
      // A process group lets a timeout terminate descendants holding output pipes.
      // The child remains awaited through close; it never runs in the background.
      detached: process.platform !== "win32",
    });
    let stdout = "";
    let stderr = "";
    let liveStdout = "";
    let liveStderr = "";
    /** @type {Error | undefined} */
    let error;
    /** @type {Timeout | undefined} */
    let timeout;
    /** @type {NestedTest | undefined} */
    let lastCompleted;
    const unfinished = new Map();
    const timer = setTimeout(() => {
      timeout = {
        bound: nested ? "no-progress" : "total",
        boundMs,
        command: [command, ...childArgs],
        elapsedMs: performance.now() - started,
        lastCompleted,
        unfinished: [...unfinished.values()],
      };
      if (process.platform === "win32") child.kill("SIGKILL");
      else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (cause) {
          if (cause.code !== "ESRCH") throw cause;
        }
      }
    }, boundMs);
    const progress = () => {
      if (nested && !timeout) timer.refresh();
    };
    child.stdout.setEncoding("utf8").on("data", (data) => {
      stdout += data;
      progress();
    });
    child.stderr.setEncoding("utf8").on("data", (data) => {
      stderr += data;
      progress();
    });
    if (nested) {
      let pending = "";
      const events = /** @type {import("node:stream").Readable} */ (
        child.stdio[3]
      );
      events.setEncoding("utf8").on("data", (data) => {
        pending += data;
        let newline;
        while ((newline = pending.indexOf("\n")) !== -1) {
          const event = JSON.parse(pending.slice(0, newline));
          pending = pending.slice(newline + 1);
          if (event.test) {
            const key = JSON.stringify([
              event.test.entryFile,
              event.test.file,
              event.test.testId,
              event.test.line,
              event.test.column,
            ]);
            if (event.type === "test:dequeue") unfinished.set(key, event.test);
            else {
              unfinished.delete(key);
              lastCompleted = event.test;
              progress();
            }
          } else {
            if (event.type === "test:stdout") liveStdout += event.message;
            else liveStderr += event.message;
            progress();
          }
        }
      });
    }
    child.on("error", (cause) => {
      error = cause;
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      const elapsedMs = performance.now() - started;
      if (timeout)
        error = new Error(
          `${timeout.bound} bound (${boundMs} ms) tripped after ${timeout.elapsedMs.toFixed(1)} ms: ${JSON.stringify(timeout.command)}\n` +
            (nested
              ? `Last completed: ${JSON.stringify(lastCompleted ?? null)}\nStarted, unfinished: ${JSON.stringify(timeout.unfinished)}\n`
              : "") +
            `stdout:\n${stdout}\nstderr:\n${stderr}` +
            (nested
              ? `\nLive nested stdout:\n${liveStdout}\nLive nested stderr:\n${liveStderr}`
              : ""),
        );
      resolve({ status, signal, stdout, stderr, elapsedMs, error, timeout });
    });
  });
}
