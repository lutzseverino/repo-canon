#!/usr/bin/env node

// The orchestrating agent's status and wait, read from the workbench records
// that references/templates.md shapes and from live tracker state.
// Usage: node workbench.mjs status <workbench> --stale-after <seconds>
//        node workbench.mjs wait <workbench> --interval <seconds> --max-duration <seconds>
// Durations are required positive finite caller choices, without defaults.
// Both save the facts they observed in the workbench's Git directory; wait
// compares against them, so a change after the last status or wait wakes it.
// Exit 0: status printed, or a change, finished report or maximum duration
// (re-arm); exit 1: usage, read or platform error.
// Tracker requests and upstream fetches retain their 45-second timeout.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  watch,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { connectionFor, executedAsScript } from "../babysit/platform.mjs";

class UsageError extends Error {}

const usage =
  "usage: workbench.mjs status <workbench> --stale-after <seconds> | workbench.mjs wait <workbench> --interval <seconds> --max-duration <seconds>";
const durations = {
  status: ["stale-after"],
  wait: ["interval", "max-duration"],
};

const parseArguments = (argv) => {
  const [command, ...rest] = argv;
  if (!Object.hasOwn(durations, command)) throw new UsageError(usage);
  const options = { command, workbench: undefined };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    const flag = /^--(.+)$/.exec(argument)?.[1];
    if (!flag) {
      if (options.workbench)
        throw new UsageError(`unexpected argument ${argument}; ${usage}`);
      options.workbench = resolve(argument);
      continue;
    }
    if (!durations[command].includes(flag))
      throw new UsageError(`unrecognized option ${argument}; ${usage}`);
    if (Object.hasOwn(options, flag))
      throw new UsageError(`${argument} is given more than once`);
    const value = rest[(index += 1)];
    if (value === undefined) throw new UsageError(`${argument} needs a value`);
    const seconds = value.trim() === "" ? NaN : Number(value);
    if (!(seconds > 0) || !Number.isFinite(seconds * 1000))
      throw new UsageError(
        `${argument} must be a finite positive number of seconds with finite milliseconds`,
      );
    options[flag] = seconds;
  }
  const missing = durations[command]
    .filter((flag) => !Object.hasOwn(options, flag))
    .map((flag) => `--${flag} is required`);
  if (!options.workbench) missing.unshift("the workbench directory is required");
  if (missing.length) throw new UsageError(`${missing.join("; ")}; ${usage}`);
  return options;
};

// Each level-two section's lines by heading, ignoring headings in fences.
const sections = (text) => {
  const found = new Map();
  let lines;
  let fenced = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const heading = !fenced && /^## (.+?)\s*$/.exec(line)?.[1];
    if (heading) found.set(heading, (lines = []));
    else lines?.push(line);
  }
  return found;
};

const cells = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());

const plain = (text) =>
  text
    .replaceAll(/<[^>]*>/g, "")
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replaceAll("`", "")
    .trim();

// GitHub's heading anchor: lowercase, punctuation dropped, spaces hyphenated.
const anchor = (heading) =>
  heading
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\s-]/gu, "")
    .replaceAll(/\s/g, "-");

const trackerPattern =
  /https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/(?:issues|pull)\/([1-9]\d*)\b|(?<![\w./-])([\w.-]+)\/([\w.-]+)#([1-9]\d*)\b/g;
const metPattern =
  / met (?:\[[^\]]+\]\([^)\s]+\)|<[^>\s]+>|https?:\/\/\S+)$/;
const ending = /^(?:closed|merged|moved|dropped \(owner\))(?![\w-])/;

const readText = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

// The report a brief names, relative to the brief's own directory.
const reportOf = (brief) => {
  const named = /^Launch report:[ \t]*(\S.*?)\s*$/m.exec(brief)?.[1];
  if (!named) return null;
  return named.replace(/^\[[^\]]*\]\((.+)\)$/, "$1").replaceAll("`", "");
};

// The workbench's records, their watches and every record status could not
// read. Local item keys are workbench-relative, so saved facts survive a move.
function readRecords(workbench) {
  const records = {
    orchestrator: undefined,
    plans: [],
    rows: [],
    launches: [],
    inbox: [],
    incoming: [],
    unavailable: [],
    watches: [],
  };
  const trackers = new Map();
  const local = (kind, path, extra = {}) => {
    const label = relative(workbench, path) || ".";
    const item = { kind, key: `${kind}:${label}`, path, label, ...extra };
    records.watches.push(item);
    return item;
  };
  const record = (label, read) => {
    try {
      return read();
    } catch (error) {
      records.unavailable.push({ item: label, reason: error.message });
    }
  };
  local("file", join(workbench, "index.md"));
  local("file", join(workbench, "inbox.md"));
  local("dir", join(workbench, "incoming"), { label: "incoming/" });
  const plans =
    record("index.md", () => {
      const text = readText(join(workbench, "index.md"));
      if (text === null) throw new Error("missing");
      records.orchestrator = /^Orchestrator:[ \t]*(\S.*?)\s*$/m.exec(
        text,
      )?.[1];
      const active = sections(text).get("Active");
      if (!active) throw new Error("no Active section");
      return active.flatMap((line) => {
        const name = /^[-*] +`([^`]+)`/.exec(line)?.[1].replace(/\/+$/, "");
        return name ? [name] : [];
      });
    }) ?? [];
  for (const name of plans) {
    const directory = resolve(workbench, name);
    local("file", join(directory, "plan.md"));
    local("file", join(directory, "log.md"));
    const plan = { name, done: undefined };
    records.plans.push(plan);
    record(`${name}/plan.md`, () => {
      const text = readText(join(directory, "plan.md"));
      if (text === null) throw new Error("missing");
      const lines = text.split(/\r?\n/);
      const start = lines.findIndex((line) =>
        /^\*\*Done means:\*\*\s*$/.test(line),
      );
      const clauses = [];
      for (const line of start < 0 ? [] : lines.slice(start + 1)) {
        if (!line.trim() && !clauses.length) continue;
        const clause = /^\d+\.\s+(.*?)\s*$/.exec(line)?.[1];
        if (clause === undefined) break;
        clauses.push(metPattern.test(clause));
      }
      if (clauses.length) plan.done = clauses;
      const table = (sections(text).get("Tickets") ?? []).filter((line) =>
        line.trim().startsWith("|"),
      );
      const header = table.length ? cells(table[0]) : [];
      const item = header.indexOf("Item");
      const state = header.indexOf("State");
      if (item < 0 || state < 0)
        throw new Error("no Tickets table with Item and State columns");
      for (const line of table.slice(2)) {
        const row = cells(line);
        if (ending.test(row[state] ?? "")) continue;
        const where = `${name}/${plain(row[item] ?? "")}`;
        const keys = new Set();
        for (const match of line.matchAll(trackerPattern)) {
          const [owner, repository, number] = match[1]
            ? match.slice(1, 4)
            : match.slice(4, 7);
          const key = `${owner}/${repository}#${number}`.toLowerCase();
          if (!trackers.has(key)) {
            trackers.set(key, {
              kind: "tracker",
              key,
              repository: `${owner}/${repository}`,
              number: Number(number),
              rows: [],
            });
            records.watches.push(trackers.get(key));
          }
          if (!keys.has(key)) trackers.get(key).rows.push(where);
          keys.add(key);
        }
        if (keys.size) records.rows.push({ plan: name, where, keys: [...keys] });
      }
      if (!clauses.length) throw new Error("no numbered Done means");
    });
    record(name, () => {
      const log = readText(join(directory, "log.md")) ?? "";
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
        if (["plan.md", "log.md"].includes(entry.name)) continue;
        const named = reportOf(readFileSync(join(directory, entry.name), "utf8"));
        if (!named) continue;
        const path = resolve(directory, named);
        const known = records.launches.some((launch) => launch.path === path);
        if (known || log.includes(basename(path))) continue;
        records.launches.push(
          local("launch", path, { brief: `${name}/${entry.name}` }),
        );
      }
    });
  }
  record("inbox.md", () => {
    const text = readText(join(workbench, "inbox.md"));
    if (text === null) throw new Error("missing");
    const open = sections(text).get("Open");
    if (!open) throw new Error("no Open section");
    let entry;
    for (const line of open) {
      const heading = /^### (.+?)\s*$/.exec(line)?.[1];
      if (heading)
        records.inbox.push((entry = { heading, link: `inbox.md#${anchor(heading)}`, plan: "—" }));
      const plan = /^(?:[-*] +)?(?:\*\*)?Plan:(?:\*\*)?[ \t]*(\S.*?)\s*$/.exec(line)?.[1];
      if (entry && plan) entry.plan = plain(plan);
    }
  });
  record("incoming/", () => {
    try {
      records.incoming = readdirSync(join(workbench, "incoming"), {
        withFileTypes: true,
      })
        .filter((entry) => entry.isFile())
        .map((entry) => `incoming/${entry.name}`)
        .sort();
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  });
  return records;
}

// The file's content digest, or null when it does not exist.
const fileDigest = (path) => {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

// Each file's digest directly in the directory, by name.
const directoryDigests = (path) => {
  const digests = {};
  let entries = [];
  try {
    entries = readdirSync(path, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) continue;
    const digest = fileDigest(join(path, entry.name));
    if (digest !== null) digests[entry.name] = digest;
  }
  return digests;
};

// A report is finished at its exact final line, with or without a newline.
const launchFinished = (path) =>
  readText(path)
    ?.replace(/\r?\n$/, "")
    .split(/\r?\n/)
    .at(-1) === "status: done";

const byId = (entries) => entries.toSorted((a, b) => String(a.id).localeCompare(String(b.id)));

const readTracker = async (item, connection) => {
  const { data } = await connection.access.request({
    path: `/repos/${item.repository}/issues/${item.number}`,
  });
  const pull = data.pull_request !== undefined;
  const [comments, linked] = await Promise.all([
    connection.issueTracker.comments(item.number),
    pull ? [] : connection.pullRequests.closing(item.number),
  ]);
  const facts = {
    pull,
    state: pull && data.pull_request.merged_at ? "merged" : data.state,
    labels: data.labels
      .map((label) => (typeof label === "string" ? label : label.name))
      .sort(),
    comments: comments.map(({ id, url }) => ({ id, url })),
    linked: linked.map(({ url, state }) => ({ url, state })),
  };
  if (pull) {
    const { data: detail } = await connection.access.request({
      path: `/repos/${item.repository}/pulls/${item.number}`,
    });
    const head = detail.head.sha;
    const [runs, statuses] = await Promise.all(
      ["check-runs?filter=all", "status"].map((path) =>
        connection.access.requestPages({
          path: `/repos/${item.repository}/commits/${head}/${path}`,
        }),
      ),
    );
    facts.head = head;
    facts.checks = {
      runs: byId(
        runs
          .flatMap((page) => page.data.check_runs)
          .map(({ id, name, status, conclusion }) => ({ id, name, status, conclusion })),
      ),
      statuses: byId(
        statuses
          .flatMap((page) => page.data.statuses)
          .map(({ id, context, state }) => ({ id, context, state })),
      ),
    };
  }
  return { facts, updatedAt: data.updated_at };
};

const link = (item, facts) =>
  `https://github.com/${item.repository}/${facts?.pull ? "pull" : "issues"}/${item.number}`;

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

// The observation file, in the workbench's Git directory so it is never
// committed.
const observationPath = async (workbench) => {
  const path = await git(workbench, ["rev-parse", "--git-path", "workbench-observation.json"]);
  return resolve(workbench, path.trim());
};

const saveObservation = async (workbench, facts) => {
  const path = await observationPath(workbench);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ facts: Object.fromEntries(facts) })}\n`);
};

// The workbench checkout's upstream, or null without a branch upstream.
const upstreamOf = async (workbench) => {
  const top = (
    await git(workbench, ["rev-parse", "--show-toplevel"], { optional: true })
  )?.trim();
  if (!top) return null;
  const branch = (
    await git(top, ["symbolic-ref", "--quiet", "HEAD"], { optional: true })
  )?.trim();
  if (!branch) return null;
  const [ref, remote] = (
    await git(top, ["for-each-ref", "--format=%(upstream)%00%(upstream:remotename)", branch])
  )
    .trim()
    .split("\0");
  return ref && remote ? { top, ref, remote } : null;
};

// Upstream commits the checkout lacks that touch a local item, oldest first.
// A directory's glob `*` matches no `/`, so it covers only direct files.
const unheldCommits = async (upstream, items) => {
  const pathspecs = items.flatMap((item) => {
    const path = relative(upstream.top, item.path);
    if (path.startsWith("..")) return [];
    const escaped = path.replaceAll(/[*?[\\]/g, "\\$&");
    return [item.kind === "dir" ? `:(glob)${escaped}/*` : `:(literal)${path}`];
  });
  if (!pathspecs.length) return [];
  await git(upstream.top, ["fetch", upstream.remote], { timeout: fetchTimeoutMs });
  const listed = await git(upstream.top, [
    "rev-list",
    "--reverse",
    "--ignore-missing",
    upstream.ref,
    "--not",
    "HEAD",
    "--",
    ...pathspecs,
  ]);
  return listed.split("\n").filter(Boolean);
};

const readLocal = (item) =>
  ({ file: fileDigest, dir: directoryDigests, launch: launchFinished })[item.kind](item.path);

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
  if (item.kind === "dir")
    return [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .sort()
      .flatMap((name) => {
        const how = fileChange(before[name] ?? null, after[name] ?? null);
        return how ? [`file ${name} ${how}`] : [];
      });
  const found = [];
  if (before.head !== after.head)
    found.push(`head changed from ${before.head} to ${after.head}`);
  if (JSON.stringify(before.checks) !== JSON.stringify(after.checks))
    found.push(
      `checks changed from ${JSON.stringify(before.checks)} to ${JSON.stringify(after.checks)}`,
    );
  if (before.state !== after.state)
    found.push(`state changed from ${before.state} to ${after.state}`);
  const added = after.labels.filter((label) => !before.labels.includes(label));
  const removed = before.labels.filter((label) => !after.labels.includes(label));
  if (added.length || removed.length)
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
      found.push(`linked pull request ${pull.url} changed from ${state} to ${pull.state}`);
  }
  const linked = new Set(after.linked.map((pull) => pull.url));
  for (const url of known.keys())
    if (!linked.has(url)) found.push(`linked pull request ${url} removed`);
  return found;
};

// Where an open tracker item's next move lies, from its observed facts.
const place = (facts) => {
  const has = (label) => facts.labels.includes(label);
  if (has("state:triage")) return ["mine", "state:triage"];
  if (has("state:grill")) return ["mine", "state:grill"];
  if (has("state:owner")) return ["owner", "state:owner"];
  if (facts.pull || facts.linked.some(({ state }) => state === "open"))
    return ["quiet", "delivery"];
  if (has("state:ready")) return ["quiet", "pickup"];
  if (has("state:reporter") || has("state:carried")) return ["quiet", "third party"];
  return ["mine", "no state the rules place"];
};

const status = async (options, { connectionOf, now, stdout }) => {
  const { workbench } = options;
  const records = readRecords(workbench);
  const observed = new Map();
  const reads = new Map();
  const mine = [];
  const owner = [];
  const running = [];
  const stale = [];
  const quiet = { pickup: 0, delivery: 0, "third party": 0 };
  const line = (target, what, where) => target.push(`- ${what} · ${where}`);
  for (const item of records.watches.filter(({ kind }) => kind !== "tracker"))
    try {
      observed.set(item.key, readLocal(item));
    } catch (error) {
      if (item.kind !== "launch")
        records.unavailable.push({ item: item.label, reason: error.message });
      else line(running, `unavailable: ${item.label} (${error.message})`, item.brief);
    }
  await Promise.all(
    records.watches
      .filter(({ kind }) => kind === "tracker")
      .map(async (item) => {
        try {
          reads.set(item.key, await readTracker(item, connectionOf(item.repository)));
          observed.set(item.key, reads.get(item.key).facts);
        } catch (error) {
          reads.set(item.key, { error });
        }
      }),
  );
  for (const item of records.watches.filter(({ kind }) => kind === "tracker")) {
    const where = item.rows.join(", ");
    const { facts, updatedAt, error } = reads.get(item.key);
    if (error) {
      line(mine, `unavailable: ${link(item)} (${error.message})`, where);
      continue;
    }
    if (facts.state !== "open") continue;
    const [group, what] = place(facts);
    if (group === "quiet") {
      quiet[what] += 1;
      if (now() - Date.parse(updatedAt) > options["stale-after"] * 1000)
        line(stale, `${link(item, facts)} unchanged since ${updatedAt}`, where);
    } else line(group === "owner" ? owner : mine, `${link(item, facts)} ${what}`, where);
  }
  for (const row of records.rows)
    if (row.keys.every((key) => reads.get(key).facts && reads.get(key).facts.state !== "open"))
      line(mine, `${row.plan}/plan.md every linked issue closed; end the row`, row.where);
  for (const launch of records.launches) {
    if (!observed.has(launch.key)) continue;
    if (observed.get(launch.key))
      line(mine, `${launch.label} finished; read the report`, launch.brief);
    else line(running, `${launch.label} report pending`, launch.brief);
  }
  for (const name of records.incoming) line(mine, `${name} message`, "—");
  for (const entry of records.inbox)
    line(owner, `${entry.link} ${entry.heading}`, entry.plan);
  try {
    await saveObservation(workbench, observed);
  } catch (error) {
    records.unavailable.push({ item: "observation file", reason: error.message });
  }
  for (const { item, reason } of records.unavailable)
    line(mine, `unavailable: ${item} (${reason})`, "—");
  const group = (name, lines) => [name, ...(lines.length ? lines : ["- none"])];
  stdout.write(
    [
      `Orchestrator: ${records.orchestrator ?? "unavailable: index.md (no Orchestrator: line)"}`,
      ...records.plans.map(
        ({ name, done }) =>
          `${name}/plan.md · Done means ${done ? done.map((met) => (met ? "●" : "○")).join("") : "unavailable"}`,
      ),
      "",
      ...group("My move", mine),
      ...group("Owner's move", owner),
      ...group("Running", running),
      `Waiting quietly: ${quiet.pickup} state:ready (pickup), ${quiet.delivery} open pull request (delivery), ${quiet["third party"]} state:reporter or state:carried (third party)`,
      ...group(`Stale (unchanged for over ${options["stale-after"]} seconds)`, stale),
    ].join("\n") + "\n",
  );
  return 0;
};

// Resolves "time" after the duration, or with the event's value first.
const pause = (durationMs, event) =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    let timeout;
    const tick = () => {
      const remaining = durationMs - (Date.now() - startedAt);
      if (remaining <= 0) return resolve("time");
      // Node turns delays above its signed 32-bit timer maximum into 1 ms.
      timeout = setTimeout(tick, Math.min(remaining, 2_147_483_647));
    };
    tick();
    event?.then((value) => {
      clearTimeout(timeout);
      resolve(value);
    });
  });

// File-system events in the directories holding local items. `next` settles
// once an event has arrived since the last `consume`.
const watchers = () => {
  const open = new Map();
  let fired = false;
  let settle;
  let pending;
  const fire = () => {
    fired = true;
    settle?.("event");
  };
  return {
    next: () =>
      (pending ??= new Promise((resolve) => {
        settle = resolve;
        if (fired) resolve("event");
      })),
    consume: () => {
      fired = false;
      settle = pending = undefined;
    },
    cover: (directories) => {
      for (const [directory, watcher] of open)
        if (!directories.has(directory)) {
          watcher.close();
          open.delete(directory);
        }
      for (const directory of directories)
        if (!open.has(directory)) {
          const watcher = watch(directory, fire);
          watcher.on("error", () => {
            watcher.close();
            open.delete(directory);
            fire();
          });
          open.set(directory, watcher);
        }
    },
    close: () => {
      for (const watcher of open.values()) watcher.close();
    },
  };
};

const existingAncestor = (path) => {
  while (!existsSync(path) && dirname(path) !== path) path = dirname(path);
  return path;
};

const wait = async (options, { connectionOf, pause: pauseFor, now, stdout }) => {
  const { workbench } = options;
  const startedAt = now();
  const limitMs = options["max-duration"] * 1000;
  const baseline = new Map(
    Object.entries(
      JSON.parse(readText(await observationPath(workbench)) ?? "{}").facts ?? {},
    ),
  );
  const upstream = await upstreamOf(workbench);
  let held = [];
  const events = watchers();
  let reason = "poll";
  let pollAt;
  try {
    for (;;) {
      events.consume();
      const records = readRecords(workbench);
      if (records.unavailable.length)
        throw new Error(
          records.unavailable
            .map(({ item, reason }) => `${item}: ${reason}`)
            .join("; "),
        );
      const items = records.watches;
      const local = items.filter(({ kind }) => kind !== "tracker");
      events.cover(
        new Set([
          workbench,
          ...local.map(({ kind, path }) =>
            existingAncestor(kind === "dir" ? path : dirname(path)),
          ),
        ]),
      );
      const keys = new Set(items.map(({ key }) => key));
      for (const key of baseline.keys())
        if (!keys.has(key)) baseline.delete(key);
      const lines = [];
      const compare = (item, facts, label) => {
        if (item.kind === "launch") {
          if (facts) lines.push(`finished: read ${item.label}`);
        } else if (baseline.has(item.key))
          lines.push(
            ...changes(item, baseline.get(item.key), facts).map(
              (change) => `${label}: ${change}`,
            ),
          );
        baseline.set(item.key, facts);
      };
      for (const item of local) compare(item, readLocal(item), item.label);
      const polled = items.filter(
        (item) =>
          item.kind === "tracker" &&
          (reason === "poll" || !baseline.has(item.key)),
      );
      const read = await Promise.all(
        polled.map((item) => readTracker(item, connectionOf(item.repository))),
      );
      for (const [index, item] of polled.entries())
        compare(item, read[index].facts, link(item, read[index].facts));
      if (upstream && reason === "poll") {
        const commits = await unheldCommits(upstream, local);
        for (const commit of commits)
          if (!held.includes(commit))
            lines.push(`upstream commit ${commit} not yet pulled`);
        held = commits;
      }
      if (reason === "poll") pollAt = now() + options.interval * 1000;
      const deadline = startedAt + limitMs;
      if (!lines.length && now() >= deadline)
        lines.push(
          `no item changed within the maximum duration of ${options["max-duration"]} seconds; arm the wait again`,
        );
      if (lines.length) {
        await saveObservation(workbench, baseline);
        stdout.write(`${lines.join("\n")}\n`);
        return 0;
      }
      const woke = await pauseFor(
        Math.max(Math.min(pollAt, deadline) - now(), 0),
        events.next(),
      );
      reason = woke === "event" ? "event" : "poll";
    }
  } finally {
    events.close();
  }
};

// `connect` turns an <owner>/<name> selector into a Postern connection with
// the GitHub CLI's current credential; `pause` waits a number of
// milliseconds, resolving "event" early when the given file-event promise
// does; `now` gives the time; `stdout` and `stderr` receive the lines. Each is
// replaceable for fixtures.
export const main = async (
  argv = process.argv.slice(2),
  {
    connect = connectionFor,
    pause: pauseFor = pause,
    stdout = process.stdout,
    stderr = process.stderr,
    now = Date.now,
  } = {},
) => {
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
    if (!connections.has(key)) connections.set(key, connect(repository));
    return connections.get(key);
  };
  try {
    return options.command === "status"
      ? await status(options, { connectionOf, now, stdout })
      : await wait(options, { connectionOf, pause: pauseFor, now, stdout });
  } catch (error) {
    stderr.write(`workbench.mjs: ${error.message}\n`);
    return 1;
  }
};

if (import.meta.main ?? executedAsScript(import.meta.url)) {
  process.exitCode = await main();
}
