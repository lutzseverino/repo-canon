#!/usr/bin/env node

// Wait for tracker/file/directory changes or a launch report's final marker.
// Explicit items retain first-read baselines unless JSON supplies expected facts.
// --from reloads template-owned records without resetting unchanged watches.
// Exit 0: event or maximum duration (re-arm); exit 1: usage/platform error.
// Usage: node wait.mjs --interval <seconds> --max-duration <seconds> <item>...
//        node wait.mjs --interval <seconds> --max-duration <seconds> --from now.md
//        node wait.mjs --status --from now.md
// Wait durations are required positive finite caller choices, without defaults.
// Tracker requests and upstream fetches retain their 45-second timeout.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { connectionFor, executedAsScript } from "../babysit/platform.mjs";

import {
  UsageError,
  parseItem,
  unionWatches,
  normalizeChecks,
  launchComplete,
  readRecords,
  renderStatus,
} from "./records.mjs";

const usage =
  "usage: wait.mjs --interval <seconds> --max-duration <seconds> <item>... | --from <now.md>; wait.mjs --status --from <now.md>";

const parseArguments = (argv) => {
  const options = {};
  const items = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--status" || argument === "--from") {
      const key = argument.slice(2);
      if (Object.hasOwn(options, key))
        throw new UsageError(`${argument} is given more than once`);
      options[key] = key === "status" ? true : argv[++index];
      if (key === "from" && (!options[key] || options[key].startsWith("--")))
        throw new UsageError("--from needs a records path");
      continue;
    }
    const flag = /^--(interval|max-duration)$/.exec(argument)?.[1];
    if (!flag) {
      if (argv[index].startsWith("--"))
        throw new UsageError(`unrecognized option ${argv[index]}; ${usage}`);
      const item = parseItem(argv[index]);
      items.push(item);
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
  if (options.status) {
    if (
      !options.from ||
      items.length ||
      options.interval ||
      options["max-duration"]
    )
      throw new UsageError("--status requires only --from <now.md>");
    return { status: true, from: options.from };
  }
  if (options.from && items.length)
    throw new UsageError("--from cannot be combined with explicit items");
  const missing = ["interval", "max-duration"]
    .filter((flag) => !Object.hasOwn(options, flag))
    .map((flag) => `--${flag} is required`);
  if (missing.length > 0)
    throw new UsageError(`${missing.join("; ")}; ${usage}`);
  if (items.length === 0 && !options.from) throw new UsageError(usage);
  return {
    interval: options.interval,
    maxDuration: options["max-duration"],
    items: unionWatches(items),
    from: options.from,
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
  let headFacts = {};
  if (pull) {
    const { data: detail } = await connection.access.request({
      path: `/repos/${item.repository}/pulls/${item.number}`,
    });
    const head = detail.head.sha;
    const [runPages, statusPages] = await Promise.all([
      connection.access.requestPages({
        path: `/repos/${item.repository}/commits/${head}/check-runs?filter=all`,
      }),
      connection.access.requestPages({
        path: `/repos/${item.repository}/commits/${head}/status`,
      }),
    ]);
    headFacts = {
      head,
      checks: normalizeChecks({
        runs: runPages
          .flatMap((page) => page.data.check_runs)
          .map(({ id, name, status, conclusion }) => ({
            id,
            name,
            status,
            conclusion,
          })),
        statuses: statusPages
          .flatMap((page) => page.data.statuses)
          .map(({ id, context, state }) => ({ id, context, state })),
      }),
    };
  } else if (item.expected?.head || item.expected?.checks)
    throw new UsageError(
      `${item.reference}: head/check expectations require a pull request`,
    );
  return {
    ...headFacts,
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
    launch: async (item) => launchComplete(item.path),
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
  if (Object.hasOwn(before, "head") && before.head !== after.head)
    found.push(`head changed from ${before.head} to ${after.head}`);
  if (
    Object.hasOwn(before, "checks") &&
    JSON.stringify(before.checks) !== JSON.stringify(after.checks)
  )
    found.push(
      `checks changed from ${JSON.stringify(before.checks)} to ${JSON.stringify(after.checks)}`,
    );
  if (Object.hasOwn(before, "state") && before.state !== after.state)
    found.push(`state changed from ${before.state} to ${after.state}`);
  const added = before.labels
    ? after.labels.filter((label) => !before.labels.includes(label))
    : [];
  const removed = (before.labels ?? []).filter(
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
  const seen = new Set(
    (before.comments ?? after.comments).map((comment) => comment.id),
  );
  for (const comment of after.comments)
    if (!seen.has(comment.id)) found.push(`new comment ${comment.url}`);
  const known = new Map(
    (before.linked ?? after.linked).map((pull) => [pull.url, pull.state]),
  );
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
    now: nowAt = Date.now,
  } = {},
) => {
  const startedAt = nowAt();
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }
  if (options.status) {
    try {
      stdout.write(renderStatus(readRecords(options.from)));
      return 0;
    } catch (error) {
      stderr.write(`wait.mjs: ${error.message}\n`);
      return 1;
    }
  }
  const connections = new Map();
  const connectionOf = (repository) => {
    const key = repository.toLowerCase();
    if (!connections.has(key)) connections.set(key, connectTo(repository));
    return connections.get(key);
  };
  const limitMs = options.maxDuration * 1000;
  const observations = new Map();
  try {
    for (;;) {
      // Re-read before polling so deletions stop participating immediately.
      const selected = options.from
        ? readRecords(options.from).watches
        : options.items;
      const active = new Set(selected.map((item) => item.key));
      for (const key of observations.keys())
        if (!active.has(key)) observations.delete(key);
      const items = await Promise.all(
        selected.map(async (item) => {
          const prior = observations.get(item.key);
          const signature = JSON.stringify(item.expected);
          if (prior && prior.signature === signature) return prior.item;
          if (item.kind === "dir") item.upstream = await upstreamOf(item.path);
          observations.set(item.key, { item, signature, facts: undefined });
          return item;
        }),
      );
      const fresh = items.filter(
        (item) => observations.get(item.key).facts === undefined,
      );
      const initial = await look(fresh, connectionOf, { readUpstream: false });
      const lines = [];
      for (const item of fresh) {
        const facts = initial.get(item.key);
        if (item.kind === "launch" && facts)
          lines.push(`finished: read ${item.report}`);
        else if (item.expected)
          lines.push(
            ...changes(item, item.expected, facts).map(
              (change) => `${item.reference}: ${change}`,
            ),
          );
        observations.get(item.key).facts = facts;
      }
      const continuing = items.filter((item) => !fresh.includes(item));
      const after = await look(continuing, connectionOf, {
        readUpstream: true,
      });
      for (const item of continuing) {
        const facts = after.get(item.key);
        if (item.kind === "launch") {
          if (facts) lines.push(`finished: read ${item.report}`);
        } else
          lines.push(
            ...changes(item, observations.get(item.key).facts, facts).map(
              (change) => `${item.reference}: ${change}`,
            ),
          );
        observations.get(item.key).facts = facts;
      }
      if (lines.length) {
        stdout.write(`${lines.join("\n")}\n`);
        return 0;
      }
      const remaining = startedAt + limitMs - nowAt();
      if (remaining <= 0) {
        stdout.write(
          `no item changed within the maximum duration of ${options.maxDuration} seconds; arm the wait again\n`,
        );
        return 0;
      }
      await pauseFor(Math.min(options.interval * 1000, remaining));
    }
  } catch (error) {
    stderr.write(`wait.mjs: ${error.message}\n`);
    return 1;
  }
};

if (import.meta.main ?? executedAsScript(import.meta.url)) {
  process.exitCode = await main();
}
