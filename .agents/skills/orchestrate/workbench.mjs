#!/usr/bin/env node

// The orchestrating agent's status and wait, read from the workbench records
// that references/templates.md shapes and from live tracker state.
// Usage: node workbench.mjs status <workbench> --stale-after <seconds> --stages <factory-workflow rules file>
//        node workbench.mjs brief <stage> <target> --plan <plan directory> --row <row>
//          --model <model>@<effort> --reason <one line> --stages <rules file> < <context>
//        node workbench.mjs wait <workbench> --interval <seconds> --max-duration <seconds>
// Durations are required positive finite caller choices, without defaults.
// Both save the facts they observed in the workbench's Git directory; wait
// compares against them, so a change after the last status or wait wakes it.
// Brief checks tracker targets live, then writes and prints a new launch brief.
// Exit 0: status or brief printed, or a change, finished report or maximum duration
// (re-arm); exit 1: usage, refusal, read or platform error.
// Tracker requests and upstream fetches retain their 45-second timeout.
// One command queues all tracker HTTP exchanges at 8 in flight; queue time
// does not consume the request timeout. Wait persists its tracker poll cadence
// across re-arms; status reads fresh without moving that cadence.
// Rate limits print `rate limited until <retryAt>` or `rate limited` and persist
// a cooldown apart from saved facts. Wait keeps watching local records during
// cooldown, using one interval after a refusal without retryAt.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  watch,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { text } from "node:stream/consumers";
import { promisify } from "node:util";
import { connectionFor, executedAsScript, requestTimeoutMs } from "../babysit/platform.mjs";

class UsageError extends Error {}
class TrackerPaused extends Error {
  name = "TrackerPaused";
}

// Seam (deferred): tracker batching and transport concurrency; consumers: 1; extract at 3
// Slots cover the response body too. Let each completed exchange be classified
// before dispatching queued work: Postern handles HTTP errors and the tracker
// adapter handles GraphQL envelopes, sharing the same rate-limit refusal.
const trackerReader = (connect, transport, now) => {
  const pending = [];
  const connections = new Map();
  let active = 0;
  let refusal;
  const dispatch = () => {
    while (pending.length && active < 8) {
      const { input, options, resolve, reject } = pending.shift();
      if (refusal) {
        reject(new TrackerPaused("Tracker reads paused by rate limit"));
        continue;
      }
      active += 1;
      const exchange = async () => {
        try {
          const response = await transport(input, {
            ...options,
            signal: AbortSignal.timeout(requestTimeoutMs),
          });
          const body = await response.text();
          resolve({
            status: response.status,
            headers: response.headers,
            text: async () => body,
          });
        } catch (error) {
          reject(error);
        } finally {
          setImmediate(() => {
            active -= 1;
            dispatch();
          });
        }
      };
      void exchange();
    }
  };
  const fetch = (input, options) =>
    new Promise((resolve, reject) => {
      pending.push({ input, options, resolve, reject });
      dispatch();
    });
  const connectionOf = (repository) => {
    const key = repository.toLowerCase();
    if (!connections.has(key))
      connections.set(key, connect(repository, { fetch }));
    return connections.get(key);
  };
  const paused = (error) =>
    error?.name === "TrackerPaused" || (error?.cause && paused(error.cause));
  const refused = (error) => {
    if (error.reason !== "rateLimited") return;
    refusal = mergeSchedule(
      { cooldown: refusal },
      { cooldown: { observedAt: now(), ...(error.retryAt ? { retryAt: error.retryAt } : {}) } },
    ).cooldown;
  };
  return async (items, cooldown, saved = {}) => {
    // Every pass settles before another starts; slots released on the next
    // event-loop turn are still counted across pass boundaries.
    refusal = cooldown;
    const reads = Array.from({ length: items.length });
    const repositories = new Map();
    for (const item of items) {
      const key = item.repository.toLowerCase();
      if (!repositories.has(key)) repositories.set(key, []);
      repositories.get(key).push(item);
    }
    const batches = [...repositories.values()].flatMap((group) =>
      Array.from({ length: Math.ceil(group.length / trackerBatchSize) }, (_, index) => group.slice(index * trackerBatchSize, (index + 1) * trackerBatchSize)),
    );
    await Promise.all(batches.map(async (batch) => {
      let result;
      try {
        result = refusal ? batch.map(() => ({ cooldown: refusal })) : await readTrackerBatch(batch, connectionOf(batch[0].repository), saved, refused, now);
      } catch (error) {
        result = batch.map(() => error.reason === "rateLimited" || paused(error) ? { cooldown: refusal } : { error });
      }
      batch.forEach((item, index) => { reads[items.indexOf(item)] = result[index]; });
    }));
    return { reads, cooldown: refusal };
  };
};

const cooldownUntil = (cooldown, interval) => Math.max(
  cooldown?.retryAt ? Date.parse(cooldown.retryAt) : 0,
  cooldown && interval !== undefined
    ? (cooldown.intervalAt ?? (cooldown.retryAt ? -Infinity : cooldown.observedAt)) + interval
    : 0,
);
const rateLimitLine = (item, cooldown, now) => {
  // An expired timestamp does not describe a later untimestamped refusal.
  const retryAt = cooldown.intervalAt !== undefined && Date.parse(cooldown.retryAt) <= now
    ? undefined
    : cooldown.retryAt;
  return `${retryAt ? `rate limited until ${retryAt}` : "rate limited"}: ${link(item)} · ${item.rows.join(", ")}`;
};

const usage =
  "usage: workbench.mjs status <workbench> --stale-after <seconds> --stages <factory-workflow rules file> | workbench.mjs brief <stage> <target> --plan <plan directory> --row <row> --model <model>@<effort> --reason <one line> --stages <factory-workflow rules file> < <context> | workbench.mjs wait <workbench> --interval <seconds> --max-duration <seconds>";
const commands = {
  status: { positional: ["workbench"], options: ["stale-after", "stages"] },
  brief: {
    positional: ["stage", "target"],
    options: ["plan", "row", "model", "reason", "stages"],
  },
  wait: { positional: ["workbench"], options: ["interval", "max-duration"] },
};

// Durations are seconds; stage rules and brief options are text.
const optionValue = (command, argument, value) => {
  if (command === "brief" || argument === "--stages") {
    if (!value.trim()) throw new UsageError(`${argument} needs a value`);
    return value;
  }
  const seconds = value.trim() === "" ? NaN : Number(value);
  if (!(seconds > 0) || !Number.isFinite(seconds * 1000))
    throw new UsageError(
      `${argument} must be a finite positive number of seconds with finite milliseconds`,
    );
  return seconds;
};

const parseArguments = (argv) => {
  const [command, ...rest] = argv;
  if (!Object.hasOwn(commands, command)) throw new UsageError(usage);
  const { positional, options: names } = commands[command];
  const options = { command };
  const given = [];
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    const flag = /^--(.+)$/.exec(argument)?.[1];
    if (!flag) {
      if (given.length === positional.length)
        throw new UsageError(`unexpected argument ${argument}; ${usage}`);
      given.push(argument);
      continue;
    }
    if (!names.includes(flag))
      throw new UsageError(`unrecognized option ${argument}; ${usage}`);
    if (Object.hasOwn(options, flag))
      throw new UsageError(`${argument} is given more than once`);
    const value = rest[(index += 1)];
    if (value === undefined) throw new UsageError(`${argument} needs a value`);
    options[flag] = optionValue(command, argument, value);
  }
  const missing = names
    .filter((flag) => !Object.hasOwn(options, flag))
    .map((flag) => `--${flag} is required`);
  for (const name of positional.slice(given.length).reverse())
    missing.unshift(
      `${name === "workbench" ? "the workbench directory" : `<${name}>`} is required`,
    );
  if (missing.length) throw new UsageError(`${missing.join("; ")}; ${usage}`);
  for (const [index, name] of positional.entries()) options[name] = given[index];
  if (options.workbench) options.workbench = resolve(options.workbench);
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
const trackerTarget = (target) => {
  const match = new RegExp(`^(?:${trackerPattern.source})$`).exec(target);
  if (!match) return null;
  const [owner, repository, number] = match[1] ? match.slice(1, 4) : match.slice(4, 7);
  return { repository: `${owner}/${repository}`, number: Number(number), key: `${owner}/${repository}#${number}`.toLowerCase() };
};
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

// Receipts belong to the brief's plan and name the complete resolved report path.
// Seam (deferred): plan-log receipts; consumers: 1 (launch scan); extract at 3.
const receiptPattern =
  /^[ \t]*(?:(?:[-*+]|\d+[.)])[ \t]+)?(?:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z[ \t]+)?Consumed:[ \t]+(?:`([^`]+)`|\[[^\]]*\]\(([^)]+)\)|(\S+))/;
const consumed = (log, directory, path) =>
  log.split(/\r?\n/).some((line) => {
    const receipt = receiptPattern.exec(line);
    return receipt && resolve(directory, receipt[1] ?? receipt[2] ?? receipt[3]) === path;
  });

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
          const { key, repository, number } = trackerTarget(match[0]);
          if (!trackers.has(key)) {
            trackers.set(key, { kind: "tracker", key, repository, number, rows: [] });
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
        const brief = readFileSync(join(directory, entry.name), "utf8");
        const named = reportOf(brief);
        if (!named) continue;
        const path = resolve(directory, named);
        const known = records.launches.some((launch) => launch.path === path);
        if (known || consumed(log, directory, path)) continue;
        records.launches.push(
          local("launch", path, {
            brief: `${name}/${entry.name}`,
            operation: /^Operation:[ \t]*(.+?)\s*$/m.exec(brief)?.[1],
            target: trackerTarget(/^Target:[ \t]*(.+?)\s*$/m.exec(brief)?.[1] ?? "")?.key,
          }),
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
        records.inbox.push((entry = { heading, link: `inbox.md#${anchor(heading)}`, plan: "—", keys: [] }));
      const plan = /^(?:[-*] +)?(?:\*\*)?Plan:(?:\*\*)?[ \t]*(\S.*?)\s*$/.exec(line)?.[1];
      if (entry && plan) entry.plan = plain(plan);
      if (entry)
        for (const match of line.matchAll(trackerPattern))
          entry.keys.push(trackerTarget(match[0]).key);
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

// Settle sibling reads before ending the pass, including when one fails.
/** @param {any[]} reads */
const together = async (reads) => {
  const settled = await Promise.allSettled(reads);
  const failed = settled.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
  return settled.map((result) =>
    result.status === "fulfilled" ? result.value : undefined,
  );
};

// Each batch stays below GitHub's node ceiling even at the nested suite/run
// maximum. These are page sizes, never observation limits.
const trackerBatchSize = 20;
const trackerPageSize = 50;
const trackerFields = {
  labels: "name",
  comments: "databaseId url",
  closedByPullRequestsReferences: "url state",
  checkRuns: "databaseId name status conclusion",
  checkSuites: `id checkRuns(first:${trackerPageSize},filterBy:{checkType:ALL}) { nodes { databaseId name status conclusion } pageInfo { hasNextPage endCursor } }`,
};
const trackerConnection = (field, after = null) =>
  `${field}(first:${trackerPageSize}${after === null ? "" : `,after:${JSON.stringify(after)}`}${field === "checkRuns" ? ",filterBy:{checkType:ALL}" : ""}${field === "closedByPullRequestsReferences" ? ",includeClosedPrs:true" : ""}) { nodes { ${trackerFields[field]} } pageInfo { hasNextPage endCursor } }`;
const trackerSelection = (details) => `
  __typename
  ... on Issue { id state updatedAt ${details ? `${trackerConnection("labels")} ${trackerConnection("comments")} ${trackerConnection("closedByPullRequestsReferences")}` : ""} }
  ... on PullRequest { id state updatedAt ${details ? `${trackerConnection("labels")} ${trackerConnection("comments")} headRefOid commits(last:1) { nodes { commit { id ${trackerConnection("checkSuites")} status { contexts { id context state } } } } }` : ""} }
`;
const incompleteTracker = (what) => new Error(`GitHub returned incomplete tracker ${what}`);
const trackerText = (value, what) => {
  if (typeof value !== "string" || !value) throw incompleteTracker(what);
  return value;
};
const trackerState = (value) => {
  if (!["OPEN", "CLOSED", "MERGED"].includes(value)) throw incompleteTracker("state");
  return value.toLowerCase();
};
// An aliased query may answer errors scoped to single aliases, such as a
// missing or forbidden number, beside the other aliases' complete data.
const trackerGraphql = async (connection, query, variables, refused, now, aliased = false) => {
  try {
    const { data: result, headers } = await connection.access.request({ path: "/graphql", method: "POST", body: { query, variables } });
    if (!result || (result.errors !== undefined && (!Array.isArray(result.errors) || result.errors.some((error) => !error || typeof error.message !== "string")))) throw incompleteTracker("GraphQL result");
    if (result.errors?.length) {
      const message = result.errors.map(({ message }) => message).join("; ");
      const error = new Error(`GitHub's GraphQL API answered: ${message}`);
      // Raw access requests retain GraphQL envelopes. Classify their errors at
      // this adapter; the existing command queue owns refusal and cooldown.
      const type = result.errors[0].type;
      const rateLimited = result.errors.some(({ type }) => ["RATE_LIMITED", "RATE_LIMIT"].includes(type)) ||
        (!["NOT_FOUND", "FORBIDDEN", "INSUFFICIENT_SCOPES"].includes(type) &&
          (headers["x-ratelimit-remaining"] === "0" || headers["retry-after"] !== undefined || /rate limit/i.test(message)));
      if (rateLimited) {
        Object.assign(error, { reason: "rateLimited" });
        const retry = headers["retry-after"]?.trim();
        const reset = headers["x-ratelimit-reset"]?.trim();
        const date = Date.parse(retry);
        const after = retry === undefined ? NaN : /^\d+$/.test(retry) ? now() + Number(retry) * 1000 : Number.isFinite(date) && new Date(date).toUTCString() === retry ? date : NaN;
        const at = Number.isFinite(after) ? after : headers["x-ratelimit-remaining"] === "0" && /^\d+$/.test(reset ?? "") ? Number(reset) * 1000 : NaN;
        if (Number.isFinite(at) && Math.abs(at) <= 864e13) Object.assign(error, { retryAt: new Date(at).toISOString() });
      }
      const alias = ({ path }) => Array.isArray(path) && path[0] === "repository" && /^item\d+$/.test(path[1]) ? path[1] : undefined;
      if (rateLimited || !aliased || !result.data?.repository || result.errors.some((entry) => alias(entry) === undefined)) throw error;
      const failed = new Map();
      for (const entry of result.errors) failed.set(alias(entry), [...(failed.get(alias(entry)) ?? []), entry.message]);
      return { data: result.data, failed };
    }
    if (!result.data || typeof result.data !== "object") throw incompleteTracker("GraphQL data");
    return { data: result.data, failed: new Map() };
  } catch (error) {
    refused(error);
    throw error;
  }
};

// A repository batch succeeds only after every nested page is complete. A
// failed alias/page never replaces the saved facts with a partial observation.
const readTrackerBatch = async (items, connection, saved, refused, now) => {
  const [owner, name] = items[0].repository.split("/");
  const detailed = (item) => !saved[item.key] || saved[item.key].state === "open";
  const query = `query($owner:String!,$name:String!) { repository(owner:$owner,name:$name) { ${items.map((item, index) => `item${index}:issueOrPullRequest(number:${item.number}) { ${trackerSelection(detailed(item))} }`).join("\n")} } }`;
  const { data, failed } = await trackerGraphql(connection, query, { owner, name }, refused, now, true);
  if (!data.repository) throw incompleteTracker("repository");
  const pages = [];
  const consume = (node, field, type, receive, after = null, cursors = new Set()) => {
    const page = node?.[field];
    if (!Array.isArray(page?.nodes) || page.nodes.some((entry) => !entry) || typeof page.pageInfo?.hasNextPage !== "boolean") throw incompleteTracker(field);
    page.nodes.forEach(receive);
    if (page.pageInfo.hasNextPage) {
      const cursor = trackerText(page.pageInfo.endCursor, `${field} cursor`);
      if (cursor === after || cursors.has(cursor)) throw incompleteTracker(`${field} repeated cursor`);
      cursors.add(cursor);
      pages.push({ id: trackerText(node.id, `${field} node id`), field, type, receive, after: cursor, cursors });
    }
  };
  const reads = items.map((item, index) => {
    try {
      if (failed.has(`item${index}`)) throw new Error(`GitHub's GraphQL API answered: ${failed.get(`item${index}`).join("; ")}`);
      const node = data.repository[`item${index}`];
      if (!node || !["Issue", "PullRequest"].includes(node.__typename)) throw incompleteTracker(`${item.repository}#${item.number}`);
      const state = trackerState(node.state);
      const pull = node.__typename === "PullRequest";
      const facts = { ...(saved[item.key] ?? { labels: [], comments: [], linked: [] }), pull, state };
      if (!detailed(item)) return { facts, updatedAt: node.updatedAt, reopened: state === "open" };
      facts.labels = [];
      facts.comments = [];
      facts.linked = [];
      consume(node, "labels", node.__typename, ({ name }) => facts.labels.push(trackerText(name, "label")));
      consume(node, "comments", node.__typename, ({ databaseId, url }) => {
        if (!Number.isSafeInteger(databaseId) || databaseId < 1) throw incompleteTracker("comment id");
        facts.comments.push({ id: databaseId, url: trackerText(url, "comment URL") });
      });
      if (!pull) consume(node, "closedByPullRequestsReferences", "Issue", ({ url, state }) => facts.linked.push({ url: trackerText(url, "closing pull URL"), state: trackerState(state) }));
      else {
        facts.head = trackerText(node.headRefOid, "pull head");
        facts.checks = { runs: [], statuses: [] };
        const commit = node.commits?.nodes?.[0]?.commit;
        if (!commit) throw incompleteTracker("head commit");
        const run = ({ databaseId, name, status, conclusion }) => {
          if (!Number.isSafeInteger(databaseId) || databaseId < 1) throw incompleteTracker("check id");
          if (conclusion !== null && typeof conclusion !== "string") throw incompleteTracker("check conclusion");
          facts.checks.runs.push({ id: databaseId, name: trackerText(name, "check name"), status: trackerText(status, "check status").toLowerCase(), conclusion: conclusion?.toLowerCase() ?? null });
        };
        consume(commit, "checkSuites", "Commit", (suite) => consume(suite, "checkRuns", "CheckSuite", run));
        if (commit.status !== null) {
          if (!Array.isArray(commit.status?.contexts)) throw incompleteTracker("status contexts");
          facts.checks.statuses = commit.status.contexts.map(({ id, context, state }) => ({ id: trackerText(id, "status id"), context: trackerText(context, "status context"), state: trackerText(state, "status state").toLowerCase() }));
        }
      }
      return { facts, updatedAt: trackerText(node.updatedAt, "updated time") };
    } catch (error) { return { error }; }
  });
  while (pages.length) {
    const batch = pages.splice(0, trackerBatchSize);
    const query = `{ ${batch.map((page, index) => `page${index}:node(id:${JSON.stringify(page.id)}) { ... on ${page.type} { id ${trackerConnection(page.field, page.after)} } }`).join("\n")} }`;
    const { data } = await trackerGraphql(connection, query, {}, refused, now);
    batch.forEach((page, index) => consume(data[`page${index}`], page.field, page.type, page.receive, page.after, page.cursors));
  }
  for (const read of reads) {
    if (!read.facts) continue;
    read.facts.labels.sort();
    if (read.facts.checks) {
      read.facts.checks.runs = byId(read.facts.checks.runs);
      read.facts.checks.statuses = byId(read.facts.checks.statuses);
    }
  }
  const reopens = items.filter((_item, index) => reads[index].reopened);
  if (reopens.length) {
    const refresh = await readTrackerBatch(reopens, connection, {}, refused, now);
    reopens.forEach((item, index) => { reads[items.indexOf(item)] = refresh[index]; });
  }
  return reads;
};

const readTracker = async (item, connection, refused = (_error) => {}) => {
  const read = (promise) =>
    promise.catch((error) => {
      refused(error);
      throw error;
    });
  const { data } = await read(
    connection.access.request({
      path: `/repos/${item.repository}/issues/${item.number}`,
    }),
  );
  const pull = data.pull_request !== undefined;
  const [comments, linked] = await together([
    read(connection.issueTracker.comments(item.number)),
    pull ? [] : read(connection.pullRequests.closing(item.number)),
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
    const { data: detail } = await read(
      connection.access.request({
        path: `/repos/${item.repository}/pulls/${item.number}`,
      }),
    );
    const head = detail.head.sha;
    const [runs, statuses] = await together(
      ["check-runs?filter=all", "status"].map((path) =>
        read(
          connection.access.requestPages({
            path: `/repos/${item.repository}/commits/${head}/${path}`,
          }),
        ),
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

const loadObservation = async (workbench) =>
  JSON.parse(readText(await observationPath(workbench)) ?? "{}");

// Re-read before decisions and writes: an armed wait and on-demand status share
// cadence and cooldown, but keep their own successful observation baselines.
const mergeSchedule = (...observations) => {
  const polls = observations.map(({ trackerPollAt }) => trackerPollAt).filter(Number.isFinite);
  const cooldowns = observations.map(({ cooldown }) => cooldown).filter(Boolean);
  const retryAt = cooldowns.map(({ retryAt }) => retryAt).filter(Boolean).sort().at(-1);
  // A supplied timestamp and a refusal without one impose independent bounds.
  const intervals = cooldowns.flatMap((cooldown) =>
    cooldown.intervalAt !== undefined ? [cooldown.intervalAt] : cooldown.retryAt ? [] : [cooldown.observedAt],
  );
  return {
    ...(polls.length ? { trackerPollAt: Math.max(...polls) } : {}),
    ...(cooldowns.length ? {
      cooldown: {
        observedAt: Math.max(...cooldowns.map(({ observedAt }) => observedAt)),
        ...(retryAt ? { retryAt } : {}),
        ...(retryAt && intervals.length ? { intervalAt: Math.max(...intervals) } : {}),
      },
    } : {}),
  };
};

const saveObservation = async (workbench, facts, schedule) => {
  const path = await observationPath(workbench);
  const saved = JSON.parse(readText(path) ?? "{}");
  schedule = mergeSchedule(saved, schedule);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify({ ...schedule, facts: facts ? Object.fromEntries(facts) : saved.facts ?? {} })}\n`,
  );
  return schedule;
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
  await git(upstream.top, ["fetch", upstream.remote], { timeout: requestTimeoutMs });
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

const status = async (options, { readTrackers, now, stdout }) => {
  const { workbench } = options;
  const grillSkill = handSkill(options.stages, "Grill");
  const records = readRecords(workbench);
  const { facts: saved = {}, ...initialSchedule } = await loadObservation(workbench);
  let schedule = initialSchedule;
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
  const trackers = records.watches.filter(({ kind }) => kind === "tracker");
  schedule = mergeSchedule(schedule, await loadObservation(workbench));
  const result = await readTrackers(
    trackers,
    now() < cooldownUntil(schedule.cooldown) ? schedule.cooldown : undefined,
    saved,
  );
  if (result.cooldown) schedule.cooldown = result.cooldown;
  for (const [index, item] of trackers.entries()) {
    const read = result.reads[index];
    reads.set(item.key, read);
    if (read.facts) observed.set(item.key, read.facts);
    else if (read.cooldown && Object.hasOwn(saved, item.key))
      observed.set(item.key, saved[item.key]);
  }
  for (const item of records.watches.filter(({ kind }) => kind === "tracker")) {
    const where = item.rows.join(", ");
    const { facts, updatedAt, error, cooldown } = reads.get(item.key);
    if (cooldown) {
      mine.push(`- ${rateLimitLine(item, result.cooldown, now())}`);
      continue;
    }
    if (error) {
      line(mine, `unavailable: ${link(item)} (${error.message})`, where);
      continue;
    }
    if (facts.state !== "open") continue;
    const grill = !facts.pull && facts.labels.includes("state:grill");
    if (grill) {
      const conflicts = records.inbox.filter((entry) => entry.keys.includes(item.key) || item.rows.includes(entry.plan));
      if (conflicts.length)
        throw new Error(`${link(item, facts)} (${where}) grill is in the Open inbox: ${conflicts.map((entry) => `${entry.link} ${entry.heading}`).join(", ")}; route it to its Grill session`);
    }
    const [group, what] = place(facts);
    if (group === "quiet") {
      quiet[what] += 1;
      if (now() - Date.parse(updatedAt) > options["stale-after"] * 1000)
        line(stale, `${link(item, facts)} unchanged since ${updatedAt}`, where);
    } else if (grill) {
      if (!records.launches.some((launch) => launch.operation === "Grill" && launch.target === item.key && observed.get(launch.key) === false))
        line(mine, `${link(item, facts)} start or resume its Grill session with ${grillSkill}`, where);
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
    await saveObservation(workbench, observed, schedule);
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

// Seam (deferred): skills declaring their inputs; consumers: 1 (brief); extract
// at a second launcher. The host owns capacity, guidance and effort; the
// standard owns the stages, read from the caller's rules file, never copied.
const duties = [
  "Run the hand skill the Skill line names, with this brief as its task context; where the line names more than one, run the one the Context names.",
  "Before an operation makes relay late, expose prerequisite owner steps in the report, with the preceding operation's timing and evidence and the actual latest start when one exists; complete the owner-wait report before that opportunity passes.",
  "Write the complete launch report, with open questions in it, commit the workbench writes and push when the workbench has a remote. Hand back through the report only; send no closing message to the orchestrating thread. End the report with the final line exactly: status: done",
];

// The Hand skill cell of the stage, named exactly as the rules file's
// Canonical stages table names it; refused when the cell names no skill.
const handSkill = (rules, stage) => {
  const table = (
    sections(readFileSync(rules, "utf8")).get("Canonical stages") ?? []
  ).filter((line) => line.trim().startsWith("|"));
  const header = table.length ? cells(table[0]) : [];
  const column = header.indexOf("Hand skill");
  if (header[0] !== "Stage" || column < 0)
    throw new Error(
      `${rules} has no Canonical stages table with Stage and Hand skill columns`,
    );
  const row = table.slice(2).map(cells).find(([name]) => name === stage);
  if (!row)
    throw new Error(
      `unknown stage ${stage}; name it exactly as the Canonical stages table in ${rules} does`,
    );
  if (!/`[^`]+`/.test(row[column] ?? ""))
    throw new Error(
      `stage ${stage} is refused: its Hand skill cell names no skill (${row[column]})`,
    );
  return row[column];
};

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/^https:\/\/github\.com\//, "")
    .replaceAll(/[^\p{L}\p{N}]+/gu, "-")
    .replaceAll(/^-|-$/g, "");

const brief = async (options, { connectionOf, input, now, stdout }) => {
  const { stage, target, plan, row, model, reason } = options;
  if (!/^[^@\s]+@[^@\s]+$/.test(model))
    throw new Error(
      `--model must take the model: label's <model>@<effort> form, not ${model}`,
    );
  if (/[\r\n]/.test(reason)) throw new Error("--reason must be one line");
  const directory = resolve(plan);
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory())
    throw new Error(`--plan names no plan directory: ${directory}`);
  if (!slug(target)) throw new Error(`<target> ${target} names nothing`);
  const skill = handSkill(options.stages, stage);
  const context = (await input()).replace(/^(?:[ \t]*\r?\n)+/, "").trimEnd();
  if (!context) throw new Error("refused: an empty Context on standard input");
  const tracked = trackerTarget(target);
  if (tracked) {
    let facts;
    try {
      ({ facts } = await readTracker(tracked, connectionOf(tracked.repository)));
      if (!["open", "closed", "merged"].includes(facts.state))
        throw new Error(`unavailable target state: ${facts.state}`);
    } catch (error) {
      throw new Error(`cannot read target ${target}: ${error.message}`, { cause: error });
    }
    if (["Specification", "Tickets", "Implement"].includes(stage) && facts.state !== "open")
      throw new Error(`stage ${stage} is refused for target ${target}: ${facts.state}`);
  }
  const repository = tracked
    ? tracked.repository
    : stage === "Close" &&
      row === "Close reviews" &&
      /^[\w.-]+\/[\w.-]+$/.test(target) &&
      target;
  // Numbered until neither the brief nor its report exists.
  const date = new Date(now()).toISOString().slice(0, 10);
  const stem = `brief-${slug(stage)}-${slug(target)}-${date}`;
  const taken = (name) =>
    [name, `${name}-report`].some((file) => existsSync(join(directory, `${file}.md`)));
  let name = stem;
  for (let number = 2; taken(name); number += 1) name = `${stem}-${number}`;
  const content = [
    `# ${stage}: ${target}`,
    "",
    `Operation: ${stage}`,
    `Skill: ${skill}`,
    `Target: ${target}`,
    `Plan/row: ${basename(directory)}/${row}`,
    `Workspace: ${
      repository
        ? `a fresh worktree of ${repository} on its default branch, removed when done; in the workbench, write only the report`
        : "no worktree; read the workbench and the tracker, and write in the workbench only the report"
    }`,
    `Model: ${model} — ${reason}`,
    `Launch report: ${join(directory, `${name}-report.md`)}`,
    "Final line: status: done",
    "",
    ...duties.flatMap((duty) => [duty, ""]),
    "## Context",
    "",
    context,
    "",
    "status: done",
    "",
  ].join("\n");
  writeFileSync(join(directory, `${name}.md`), content, { flag: "wx" });
  stdout.write(content);
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

const wait = async (
  options,
  { readTrackers, pause: pauseFor, now, stdout },
) => {
  const { workbench } = options;
  const startedAt = now();
  const limitMs = options["max-duration"] * 1000;
  const { facts: saved = {}, ...initialSchedule } = await loadObservation(workbench);
  let schedule = initialSchedule;
  const baseline = new Map(Object.entries(saved));
  const intervalMs = options.interval * 1000;
  const upstream = await upstreamOf(workbench);
  let held = [];
  const events = watchers();
  let upstreamPollAt = startedAt;
  const reportedLimits = new Set();
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
      schedule = mergeSchedule(schedule, await loadObservation(workbench));
      const retryAt = cooldownUntil(schedule.cooldown, intervalMs);
      const blocked = now() < retryAt;
      const fullPoll = schedule.trackerPollAt === undefined ||
        now() >= schedule.trackerPollAt + intervalMs;
      const polled = items.filter(
        (item) =>
          item.kind === "tracker" && (fullPoll || !baseline.has(item.key)),
      );
      const result = await readTrackers(
        polled,
        blocked ? schedule.cooldown : undefined,
        Object.fromEntries(baseline),
      );
      if (result.cooldown) schedule.cooldown = result.cooldown;
      const failure = result.reads.find((read) => read.error);
      if (failure) {
        await saveObservation(workbench, undefined, schedule);
        throw failure.error;
      }
      if (fullPoll && !blocked && !result.cooldown)
        schedule.trackerPollAt = now();
      for (const [index, item] of polled.entries()) {
        const read = result.reads[index];
        if (read.facts) compare(item, read.facts, link(item, read.facts));
      }
      if (blocked || result.cooldown) {
        for (const item of items.filter(({ kind }) => kind === "tracker")) {
          const index = polled.indexOf(item);
          if (index >= 0 && result.reads[index].facts) continue;
          const line = rateLimitLine(item, schedule.cooldown, now());
          if (!reportedLimits.has(line)) {
            stdout.write(`${line}\n`);
            reportedLimits.add(line);
          }
        }
      }
      const deadline = startedAt + limitMs;
      if (now() >= upstreamPollAt || now() >= deadline) {
        if (upstream) {
          const commits = await unheldCommits(upstream, local);
          for (const commit of commits)
            if (!held.includes(commit))
              lines.push(`upstream commit ${commit} not yet pulled`);
          held = commits;
        }
        upstreamPollAt = now() + intervalMs;
      }
      schedule = await saveObservation(workbench, baseline, schedule);
      if (!lines.length && now() >= deadline)
        lines.push(
          `no item changed within the maximum duration of ${options["max-duration"]} seconds; arm the wait again`,
        );
      if (lines.length) {
        stdout.write(`${lines.join("\n")}\n`);
        return 0;
      }
      const trackerPollAt = Math.max(
        cooldownUntil(schedule.cooldown, intervalMs),
        (schedule.trackerPollAt ?? -Infinity) + intervalMs,
      );
      await pauseFor(
        Math.max(Math.min(trackerPollAt, upstreamPollAt, deadline) - now(), 0),
        events.next(),
      );
    }
  } finally {
    events.close();
  }
};

// `connect` turns an <owner>/<name> selector into a Postern connection with
// the GitHub CLI's current credential; `pause` waits a number of
// milliseconds, resolving "event" early when the given file-event promise
// does; `input` reads brief's Context; `now` gives the time; `stdout` and `stderr` receive the lines. Each is
// replaceable for fixtures. For status and wait, `fetch` is the underlying
// transport behind the shared queue; `connect` forwards its fetch option to
// Postern. Brief retains its ordinary cached connections without the queue.
export const main = async (
  argv = process.argv.slice(2),
  {
    connect = connectionFor,
    fetch = globalThis.fetch,
    pause: pauseFor = pause,
    stdout = process.stdout,
    stderr = process.stderr,
    input = () => text(process.stdin),
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
  const readTrackers = trackerReader(connect, fetch, now);
  try {
    if (options.command === "brief") {
      const connections = new Map();
      const connectionOf = (repository) => {
        const key = repository.toLowerCase();
        if (!connections.has(key)) connections.set(key, connect(repository));
        return connections.get(key);
      };
      return await brief(options, { connectionOf, input, now, stdout });
    }
    return options.command === "status"
      ? await status(options, { readTrackers, now, stdout })
      : await wait(options, { readTrackers, pause: pauseFor, now, stdout });
  } catch (error) {
    stderr.write(`workbench.mjs: ${error.message}\n`);
    return 1;
  }
};

if (import.meta.main ?? executedAsScript(import.meta.url)) {
  process.exitCode = await main();
}
