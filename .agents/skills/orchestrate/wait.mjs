#!/usr/bin/env node

// Waits until any watched tracker item changes, polling GitHub through Postern
// and reading workbench files and directories. It prints nothing while
// waiting and, when it exits, one line per change naming the item and how it
// changed. Its exit code names the outcome:
//
//   0  an item changed
//   1  usage or platform error
//   2  the maximum duration passed with no change; arm the wait again
//
// An item is an issue or pull request, as <owner>/<name>#<number> or its
// https://github.com link, a file, as file:<path>, or a directory, as
// dir:<path>. An issue changes when its state, labels or linked pull requests
// do or it gets a new comment; a pull request when its state (including
// merging) or labels do or it gets a new comment; a file when it is created,
// edited or removed, as a report-back or a done mark in plan.md is; a
// directory when a file directly in it is, as a message in incoming/ is. A
// missing directory holds no files.
//
// When a directory lies in a git checkout whose current branch has an
// upstream, each poll also fetches that upstream's remote, and the directory
// changes when an upstream commit touching a file directly in it is not yet
// in the checkout, as a message another host pushed is until it is pulled. A
// failed fetch is a platform error. A checkout without an upstream, or a
// directory outside any checkout, is read only on disk.
// Other changes are measured from the first read, when the wait is armed.
//
// Usage: node wait.mjs --interval <seconds> --max-duration <seconds> <item>...
//
// Both durations are required; the caller chooses them for each invocation.
// Each platform request and each fetch has a 45-second timeout.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { connectionFor, executedAsScript } from "../babysit/platform.mjs";

const usage =
  "usage: wait.mjs --interval <seconds> --max-duration <seconds> <item>..., where an item is <owner>/<name>#<number>, its https://github.com link, file:<path> or dir:<path>";

class UsageError extends Error {}

const parseItem = (reference) => {
  const local = /^(file|dir):/.exec(reference)?.[1];
  if (local) {
    const path = reference.slice(`${local}:`.length);
    if (path === "") throw new UsageError(`unrecognized item ${reference}`);
    const absolute = resolve(path);
    return {
      reference,
      kind: local,
      key: `${local}:${absolute}`,
      path: absolute,
    };
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
        throw new UsageError(`unrecognized option ${argv[index]}; ${usage}`);
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

// The file's content digest, or null when it does not exist.
const fileDigest = (path) => {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

// Each file's digest directly in the directory, by name; empty when the
// directory does not exist.
const directoryDigests = (path) => {
  let entries;
  try {
    entries = readdirSync(path, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return new Map();
    throw error;
  }
  const digests = new Map();
  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    const digest = fileDigest(join(path, entry.name));
    if (digest !== null) digests.set(entry.name, digest);
  }
  return digests;
};

const runGit = promisify(execFile);
const fetchTimeoutMs = 45_000;

// Git's output in a directory. With `optional`, an unsuccessful exit gives
// null; any other failure, such as a missing git or a timeout, is an error.
const git = async (directory, args, { optional = false, timeout = 0 } = {}) => {
  try {
    const { stdout } = await runGit("git", ["-C", directory, ...args], {
      timeout,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return stdout;
  } catch (error) {
    if (optional && typeof error.code === "number") return null;
    const detail = error.stderr?.trim().split("\n")[0] || error.message;
    throw new Error(`git ${args.join(" ")} failed in ${directory}: ${detail}`, {
      cause: error,
    });
  }
};

// The checkout holding a directory item and its branch's upstream, or null
// when the directory lies in no checkout or the branch has no upstream.
const upstreamOf = async (path) => {
  let existing = path;
  while (!existsSync(existing) && dirname(existing) !== existing)
    existing = dirname(existing);
  const located = await git(
    existing,
    ["rev-parse", "--show-toplevel", "--show-prefix"],
    { optional: true },
  );
  if (located === null) return null;
  const [top, prefix] = located.split("\n");
  const branch = (
    await git(top, ["symbolic-ref", "--quiet", "HEAD"], { optional: true })
  )?.trim();
  if (!branch) return null;
  const [ref, remote] = (
    await git(top, [
      "for-each-ref",
      "--format=%(upstream)%00%(upstream:remotename)",
      branch,
    ])
  )
    .trim()
    .split("\0");
  if (!ref || !remote) return null;
  const below = path.slice(existing.length).split(/[\\/]/).filter(Boolean);
  const directory = [prefix.replace(/\/$/, ""), ...below]
    .filter(Boolean)
    .map((segment) => segment.replaceAll(/[*?[\\]/g, "\\$&"));
  // A glob's `*` matches no `/`, so the pathspec holds only direct files.
  return {
    top,
    ref,
    remote,
    pathspec: `:(glob)${[...directory, "*"].join("/")}`,
  };
};

// The upstream commits touching a file directly in the directory that the
// checkout's HEAD does not hold, oldest first.
const unheldCommits = async (upstream) => {
  const listed = await git(upstream.top, [
    "rev-list",
    "--reverse",
    "--ignore-missing",
    upstream.ref,
    "--not",
    "HEAD",
    "--",
    upstream.pathspec,
  ]);
  return listed.split("\n").filter(Boolean);
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

// Every item's current facts, keyed as the items are. With `readUpstream`,
// directory items fetch their upstream, once per checkout, and list the
// commits the checkout lacks; arming lists none, so any such commit wakes.
const look = async (items, connectionOf, { readUpstream }) => {
  const facts = new Map();
  const fetches = new Map();
  const fetched = (upstream) => {
    if (!fetches.has(upstream.top))
      fetches.set(
        upstream.top,
        git(upstream.top, ["fetch", upstream.remote], {
          timeout: fetchTimeoutMs,
        }),
      );
    return fetches.get(upstream.top);
  };
  const read = {
    file: async (item) => fileDigest(item.path),
    dir: async (item) => {
      if (!item.upstream || !readUpstream)
        return { files: directoryDigests(item.path), commits: [] };
      await fetched(item.upstream);
      return {
        files: directoryDigests(item.path),
        commits: await unheldCommits(item.upstream),
      };
    },
    tracker: (item) => readTracker(item, connectionOf(item.repository)),
  };
  await Promise.all(
    items.map(async (item) => facts.set(item.key, await read[item.kind](item))),
  );
  return facts;
};

// How a file changed between two digests; null when it did not.
const fileChange = (before, after) => {
  if (before === after) return null;
  if (before === null) return "created";
  if (after === null) return "removed";
  return "changed";
};

// How one item changed between two reads; empty when it did not.
const changes = (item, before, after) => {
  if (item.kind === "file") return [fileChange(before, after)].filter(Boolean);
  if (item.kind === "dir") {
    const names = new Set([...before.files.keys(), ...after.files.keys()]);
    const found = [...names].sort().flatMap((name) => {
      const how = fileChange(
        before.files.get(name) ?? null,
        after.files.get(name) ?? null,
      );
      return how ? [`file ${name} ${how}`] : [];
    });
    for (const commit of after.commits)
      if (!before.commits.includes(commit))
        found.push(`upstream commit ${commit} not yet pulled`);
    return found;
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

// `connect` turns an <owner>/<name> selector into a Postern connection with
// the GitHub CLI's current credential; `pause` waits a number of
// milliseconds; `stdout` and `stderr` receive the lines. Each is replaceable
// for fixtures.
export const main = async (
  argv = process.argv.slice(2),
  {
    connect: connectTo = connectionFor,
    pause: pauseFor = pause,
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
  const connectionOf = (repository) => {
    const key = repository.toLowerCase();
    if (!connections.has(key)) connections.set(key, connectTo(repository));
    return connections.get(key);
  };
  const limitMs = options.maxDuration * 1000;
  let before;
  try {
    for (const item of options.items)
      if (item.kind === "dir") item.upstream = await upstreamOf(item.path);
    before = await look(options.items, connectionOf, { readUpstream: false });
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
    await pauseFor(Math.min(options.interval * 1000, remaining));
    let after;
    try {
      after = await look(options.items, connectionOf, { readUpstream: true });
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

if (import.meta.main ?? executedAsScript(import.meta.url)) {
  process.exitCode = await main();
}
