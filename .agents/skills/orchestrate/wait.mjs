#!/usr/bin/env node

// Waits until any watched tracker item changes, polling GitHub through Postern
// and reading workbench files. It prints nothing while waiting and, when it
// exits, one line per change naming the item and how it changed. Its exit
// code names the outcome:
//
//   0  an item changed
//   1  usage or platform error
//   2  the maximum duration passed with no change; arm the wait again
//
// An item is an issue or pull request, as <owner>/<name>#<number> or its
// https://github.com link, or a file, as file:<path>. An issue changes when
// its state, labels, comments or linked pull requests do; a pull request when
// its state (including merging), labels or comments do; a file when it is
// created, edited or removed, as a report-back or a done mark in plan.md is.
// Changes are measured from the first read, when the wait is armed.
//
// Usage: node wait.mjs --interval <seconds> --max-duration <seconds> <item>...
//
// Both durations are required; the caller chooses them for each invocation.
// Each platform request has a 45-second timeout.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "../../../vendor/postern/postern.mjs";

const usage =
  "usage: wait.mjs --interval <seconds> --max-duration <seconds> <item>...";

class UsageError extends Error {}

const parseItem = (reference) => {
  if (reference.startsWith("file:")) {
    const path = reference.slice("file:".length);
    if (path === "") throw new UsageError(`unrecognized item ${reference}`);
    const absolute = resolve(path);
    return { reference, kind: "file", key: `file:${absolute}`, path: absolute };
  }
  const match =
    /^([a-z0-9_.-]+)\/([a-z0-9_.-]+)#([1-9]\d*)$/i.exec(reference) ??
    /^https:\/\/github\.com\/([a-z0-9_.-]+)\/([a-z0-9_.-]+)\/(?:issues|pull)\/([1-9]\d*)\/?$/i.exec(
      reference,
    );
  if (!match) throw new UsageError(`unrecognized item ${reference}`);
  const repository = `${match[1]}/${match[2]}`;
  return {
    reference,
    kind: "tracker",
    key: `${repository.toLowerCase()}#${match[3]}`,
    repository,
    number: Number(match[3]),
  };
};

const parseArguments = (argv) => {
  const options = {};
  const items = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = /^--(interval|max-duration)$/.exec(argv[index])?.[1];
    if (!flag) {
      if (argv[index].startsWith("--"))
        throw new UsageError(`unrecognized item ${argv[index]}; ${usage}`);
      const item = parseItem(argv[index]);
      if (!items.has(item.key)) items.set(item.key, item);
      continue;
    }
    if (Object.hasOwn(options, flag))
      throw new UsageError(`--${flag} is given more than once`);
    const value = argv[(index += 1)];
    if (value === undefined) throw new UsageError(`--${flag} needs a value`);
    const seconds = value.trim() === "" ? NaN : Number(value);
    if (!(seconds > 0) || !Number.isFinite(seconds * 1000)) {
      throw new UsageError(
        `--${flag} must be a finite positive number of seconds with finite milliseconds`,
      );
    }
    options[flag] = seconds;
  }
  const missing = ["interval", "max-duration"]
    .filter((flag) => !Object.hasOwn(options, flag))
    .map((flag) => `--${flag} is required`);
  if (missing.length > 0)
    throw new UsageError(`${missing.join("; ")}; ${usage}`);
  if (items.size === 0) throw new UsageError(usage);
  return {
    interval: options.interval,
    maxDuration: options["max-duration"],
    items: [...items.values()],
  };
};

// The only credential is the GitHub CLI's currently authenticated credential.
const cliConnection = (() => {
  let credential;
  return (repository) => {
    if (credential === undefined) {
      try {
        credential = execFileSync(
          "gh",
          ["auth", "token", "--hostname", "github.com"],
          {
            encoding: "utf8",
            timeout: 15_000,
            stdio: ["ignore", "pipe", "pipe"],
          },
        ).trim();
      } catch {
        throw new Error(
          "Could not read the currently authenticated GitHub CLI credential.",
        );
      }
    }
    if (!credential)
      throw new Error(
        "The currently authenticated GitHub CLI credential is empty.",
      );
    return connect(repository, { credential, timeoutMs: 45_000 });
  };
})();

const readFile = (path) => {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

const readTracker = async (item, connection) => {
  const { data } = await connection.access.request({
    path: `/repos/${item.repository}/issues/${item.number}`,
  });
  const pull = data.pull_request !== undefined;
  const [comments, linked] = await Promise.all([
    connection.issueTracker.comments(item.number),
    pull ? [] : connection.pullRequests.closing(item.number),
  ]);
  return {
    state: pull && data.pull_request.merged_at ? "merged" : data.state,
    labels: data.labels
      .map((label) => (typeof label === "string" ? label : label.name))
      .sort(),
    comments: comments.map((comment) => ({
      id: comment.id,
      url: comment.url,
    })),
    linked: linked.map((pullRequest) => ({
      url: pullRequest.url,
      state: pullRequest.state,
    })),
  };
};

// Every item's current facts, keyed as the items are.
const look = async (items, connectionFor) => {
  const facts = new Map();
  await Promise.all(
    items.map(async (item) => {
      facts.set(
        item.key,
        item.kind === "file"
          ? readFile(item.path)
          : await readTracker(item, connectionFor(item.repository)),
      );
    }),
  );
  return facts;
};

// How one item changed between two reads; empty when it did not.
export const changes = (item, before, after) => {
  if (item.kind === "file") {
    if (before === after) return [];
    if (before === null) return ["created"];
    if (after === null) return ["removed"];
    return ["changed"];
  }
  const found = [];
  if (before.state !== after.state)
    found.push(`state changed from ${before.state} to ${after.state}`);
  const added = after.labels.filter((label) => !before.labels.includes(label));
  const removed = before.labels.filter(
    (label) => !after.labels.includes(label),
  );
  if (added.length > 0 || removed.length > 0)
    found.push(
      `labels ${[
        added.length > 0 && `added ${added.join(", ")}`,
        removed.length > 0 && `removed ${removed.join(", ")}`,
      ]
        .filter(Boolean)
        .join("; ")}`,
    );
  const seen = new Set(before.comments.map((comment) => comment.id));
  for (const comment of after.comments)
    if (!seen.has(comment.id)) found.push(`new comment ${comment.url}`);
  const known = new Map(before.linked.map((pull) => [pull.url, pull.state]));
  for (const pull of after.linked) {
    const state = known.get(pull.url);
    if (state === undefined)
      found.push(`linked pull request ${pull.url} (${pull.state})`);
    else if (state !== pull.state)
      found.push(
        `linked pull request ${pull.url} changed from ${state} to ${pull.state}`,
      );
  }
  return found;
};

const pause = async (durationMs) => {
  const startedAt = Date.now();
  let remaining = durationMs;
  while (remaining > 0) {
    // Node turns delays above its signed 32-bit timer maximum into 1 ms.
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(remaining, 2_147_483_647)),
    );
    remaining = durationMs - (Date.now() - startedAt);
  }
};

// `connect` turns a repository link into a Postern connection; `pause`
// waits a number of milliseconds; `stdout` and `stderr` receive the lines.
// Each is replaceable for fixtures.
export const main = async (
  argv = process.argv.slice(2),
  {
    connect: connectTo = cliConnection,
    pause: wait = pause,
    stdout = process.stdout,
    stderr = process.stderr,
  } = {},
) => {
  const startedAt = Date.now();
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
  const connections = new Map();
  const connectionFor = (repository) => {
    const key = repository.toLowerCase();
    if (!connections.has(key))
      connections.set(key, connectTo(`https://github.com/${repository}`));
    return connections.get(key);
  };
  const limitMs = options.maxDuration * 1000;
  let before;
  try {
    before = await look(options.items, connectionFor);
  } catch (error) {
    stderr.write(`wait.mjs: ${error.message}\n`);
    return 1;
  }
  for (;;) {
    const remaining = startedAt + limitMs - Date.now();
    if (remaining <= 0) {
      stdout.write(
        `no item changed within the maximum duration of ${options.maxDuration} seconds; arm the wait again\n`,
      );
      return 2;
    }
    await wait(Math.min(options.interval * 1000, remaining));
    let after;
    try {
      after = await look(options.items, connectionFor);
    } catch (error) {
      stderr.write(`wait.mjs: ${error.message}\n`);
      return 1;
    }
    const lines = options.items.flatMap((item) =>
      changes(item, before.get(item.key), after.get(item.key)).map(
        (change) => `${item.reference}: ${change}`,
      ),
    );
    if (lines.length > 0) {
      stdout.write(`${lines.join("\n")}\n`);
      return 0;
    }
    before = after;
  }
};

const executedAsScript = () => {
  try {
    return (
      realpathSync(process.argv[1]) ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
};

if (import.meta.main ?? executedAsScript()) {
  process.exitCode = await main();
}
