#!/usr/bin/env node

// A local stand-in for GitHub CLI in the deliver skill exercise. It serves the
// issues the builder wrote, records pull requests and comments instead of
// publishing them, and runs a pull request's checks from the fixture's local
// `origin`: the trusted PR metadata validator at the base branch and `npm test`
// at the head. Commands it does not support fail, so nothing reaches GitHub.

import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const githubRoot = join(fixtureRoot, "github");
const owner = "parcel";
const valueFlags = new Map([
  ["-t", "--title"],
  ["-b", "--body"],
  ["-F", "--body-file"],
  ["-B", "--base"],
  ["-H", "--head"],
  ["-q", "--jq"],
  ["-i", "--interval"],
  ["-R", "--repo"],
  ["-L", "--limit"],
  ["-s", "--state"],
  ["-l", "--label"],
  ["-a", "--assignee"],
  ["-r", "--reviewer"],
  ["-m", "--milestone"],
]);
const longValueFlags = new Set([...valueFlags.values(), "--json"]);

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function unsupported() {
  fail(
    `The exercise stand-in for gh does not support: gh ${process.argv.slice(2).join(" ")}`,
  );
}

function parse(args) {
  const positionals = [];
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    let argument = args[index];
    let inline = null;
    if (argument.startsWith("--") && argument.includes("=")) {
      inline = argument.slice(argument.indexOf("=") + 1);
      argument = argument.slice(0, argument.indexOf("="));
    }
    const name = valueFlags.get(argument) ?? argument;
    if (longValueFlags.has(name)) {
      const value = inline ?? args[(index += 1)];
      if (value === undefined) fail(`flag needs an argument: ${argument}`);
      flags[name] = value;
    } else if (argument.startsWith("-")) {
      flags[name] = true;
    } else {
      positionals.push(argument);
    }
  }
  return { positionals, flags };
}

function git(cwd, ...args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function repository() {
  let top;
  try {
    top = git(process.cwd(), "rev-parse", "--show-toplevel");
  } catch {
    fail(
      "failed to determine the repository: run gh inside an exercise repository",
    );
  }
  const name = basename(top);
  const remote = join(fixtureRoot, "remotes", `${name}.git`);
  if (!existsSync(remote)) fail(`no exercise remote for ${name}`);
  return {
    top,
    name,
    remote,
    nameWithOwner: `${owner}/${name}`,
    url: `https://github.example.invalid/${owner}/${name}`,
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function records(kind, repo) {
  const directory = join(githubRoot, repo.name, kind);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readJson(join(directory, name)))
    .sort((left, right) => left.number - right.number);
}

function savePull(repo, pull) {
  const directory = join(githubRoot, repo.name, "pulls");
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, `${pull.number}.json`),
    `${JSON.stringify(pull, null, 2)}\n`,
  );
}

function select(object, fields) {
  return Object.fromEntries(
    fields.split(",").map((field) => [field, object[field] ?? null]),
  );
}

function jq(value, expression) {
  if (expression === ".") return [value];
  const path = expression.replace(/^\.(?=\[)/, "");
  if (!/^(\.[A-Za-z_][A-Za-z0-9_]*|\[\d*\])+$/.test(path)) {
    fail(
      `The exercise stand-in supports only path expressions in --jq, not: ${expression}`,
    );
  }
  let values = [value];
  for (const [, key, index] of path.matchAll(
    /\.([A-Za-z_][A-Za-z0-9_]*)|\[(\d*)\]/g,
  )) {
    values = values.flatMap((current) => {
      if (key !== undefined) return [current?.[key] ?? null];
      if (!Array.isArray(current)) return [null];
      return index === "" ? current : [current[Number(index)] ?? null];
    });
  }
  return values;
}

function output(value, flags, text) {
  if (flags["--json"] === undefined) {
    process.stdout.write(text());
    return;
  }
  const selected = Array.isArray(value)
    ? value.map((item) => select(item, flags["--json"]))
    : select(value, flags["--json"]);
  if (flags["--jq"] === undefined) {
    process.stdout.write(`${JSON.stringify(selected, null, 2)}\n`);
    return;
  }
  for (const result of jq(selected, flags["--jq"])) {
    process.stdout.write(
      `${typeof result === "string" ? result : JSON.stringify(result)}\n`,
    );
  }
}

function findIssue(repo, reference) {
  const number = Number(
    String(reference ?? "")
      .replace(/^#/, "")
      .replace(/^.*\/issues\//, ""),
  );
  const issue = records("issues", repo).find(
    (candidate) => candidate.number === number,
  );
  if (!issue)
    fail(
      `GraphQL: Could not resolve to an issue or pull request with the number of ${reference}.`,
    );
  return issue;
}

function findPull(repo, reference) {
  const pulls = records("pulls", repo);
  if (reference === undefined) {
    const branch = git(process.cwd(), "branch", "--show-current");
    const pull = pulls.find(
      (candidate) =>
        candidate.headRefName === branch && candidate.state === "OPEN",
    );
    if (!pull) fail(`no pull requests found for branch "${branch}"`);
    return pull;
  }
  const number = Number(
    String(reference)
      .replace(/^#/, "")
      .replace(/^.*\/pull\//, ""),
  );
  const pull = pulls.find(
    (candidate) =>
      candidate.number === number || candidate.headRefName === reference,
  );
  if (!pull) fail(`no pull requests found for ${reference}`);
  return pull;
}

function bodyFrom(flags) {
  if (flags["--body-file"] !== undefined) {
    return readFileSync(
      flags["--body-file"] === "-" ? 0 : flags["--body-file"],
      "utf8",
    );
  }
  return flags["--body"];
}

function remoteHead(repo, branch) {
  try {
    return git(
      repo.top,
      "--git-dir",
      repo.remote,
      "rev-parse",
      "--verify",
      `refs/heads/${branch}^{commit}`,
    );
  } catch {
    return null;
  }
}

function clone(repo, branch) {
  const directory = mkdtempSync(join(tmpdir(), "repo-canon-exercise-check-"));
  execFileSync(
    "git",
    ["clone", "--quiet", "--branch", branch, repo.remote, directory],
    { stdio: "ignore" },
  );
  return directory;
}

function runCheck(repo, pull, name, branch, command, args) {
  const directory = clone(repo, branch);
  try {
    const result = spawnSync(command(directory), args(directory), {
      cwd: directory,
      encoding: "utf8",
    });
    const log = join(
      githubRoot,
      repo.name,
      "checks",
      `${pull.number}-${name.toLowerCase().replaceAll(" ", "-")}.log`,
    );
    mkdirSync(dirname(log), { recursive: true });
    writeFileSync(log, `${result.stdout ?? ""}${result.stderr ?? ""}`);
    const passed = result.status === 0;
    return {
      name,
      state: passed ? "SUCCESS" : "FAILURE",
      bucket: passed ? "pass" : "fail",
      link: `file://${log}`,
      description: passed ? "Successful" : "Failing",
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function checks(repo, pull) {
  const metadata = runCheck(
    repo,
    pull,
    "PR metadata",
    pull.baseRefName,
    () => process.execPath,
    () => {
      const event = join(
        githubRoot,
        repo.name,
        "checks",
        `${pull.number}-event.json`,
      );
      mkdirSync(dirname(event), { recursive: true });
      writeFileSync(
        event,
        JSON.stringify({
          pull_request: { title: pull.title, body: pull.body },
        }),
      );
      return [".github/scripts/validate-pr-metadata.mjs", event];
    },
  );
  const test = runCheck(
    repo,
    pull,
    "Test",
    pull.headRefName,
    () => "npm",
    () => ["test"],
  );
  return [metadata, test];
}

function issueText(issue) {
  const comments = issue.comments
    .map((comment) => `${comment.author.login} commented\n\n${comment.body}\n`)
    .join("\n");
  return `${issue.title} #${issue.number}\n${issue.state} • ${issue.author.login} opened\nLabels: ${issue.labels.map((label) => label.name).join(", ")}\n\n${issue.body}\n${comments ? `\n${comments}` : ""}\n${issue.url}\n`;
}

function pullText(pull) {
  return `${pull.title} #${pull.number}\n${pull.state} • ${pull.headRefName} into ${pull.baseRefName}\n\n${pull.body}\n\n${pull.url}\n`;
}

const [group, command, ...rest] = process.argv.slice(2);
appendFileSync(
  join(githubRoot, "calls.jsonl"),
  `${JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) })}\n`,
);
const { positionals, flags } = parse(rest);

if (group === "--version" || group === "version") {
  process.stdout.write("gh version 2.57.0 (exercise stand-in)\n");
} else if (group === "auth" && command === "status") {
  process.stdout.write(
    "github.example.invalid\n  ✓ Logged in as exercise-maintainer (exercise stand-in)\n",
  );
} else if (group === "repo" && command === "view") {
  const repo = repository();
  const view = {
    name: repo.name,
    nameWithOwner: repo.nameWithOwner,
    url: repo.url,
    defaultBranchRef: { name: "main" },
  };
  output(
    view,
    flags,
    () => `name:\t${repo.nameWithOwner}\ndefault branch:\tmain\n${repo.url}\n`,
  );
} else if (group === "issue" && command === "view") {
  const issue = findIssue(repository(), positionals[0]);
  output(issue, flags, () => issueText(issue));
} else if (group === "issue" && command === "list") {
  const issues = records("issues", repository());
  output(issues, flags, () =>
    issues
      .map((issue) => `${issue.number}\t${issue.state}\t${issue.title}\n`)
      .join(""),
  );
} else if (group === "pr" && command === "create") {
  const repo = repository();
  const title = flags["--title"];
  const body = bodyFrom(flags);
  if (
    flags["--web"] ||
    flags["--fill"] ||
    flags["--fill-first"] ||
    flags["--fill-verbose"]
  )
    unsupported();
  if (typeof title !== "string" || typeof body !== "string")
    fail("The exercise stand-in requires --title and --body or --body-file.");
  const head =
    flags["--head"] ?? git(process.cwd(), "branch", "--show-current");
  const base = flags["--base"] ?? "main";
  if (head === base)
    fail(
      `head branch "${head}" is the same as base branch "${base}", cannot create a pull request`,
    );
  const headRefOid = remoteHead(repo, head);
  if (!headRefOid)
    fail(
      "aborted: you must first push the current branch to a remote, or use the --head flag",
    );
  if (!remoteHead(repo, base))
    fail(`base branch "${base}" does not exist on the remote`);
  const existing = records("pulls", repo).find(
    (pull) => pull.headRefName === head && pull.state === "OPEN",
  );
  if (existing)
    fail(
      `a pull request for branch "${head}" into branch "${base}" already exists:\n${existing.url}`,
    );
  const number =
    Math.max(
      0,
      ...records("issues", repo).map((issue) => issue.number),
      ...records("pulls", repo).map((pull) => pull.number),
    ) + 1;
  const pull = {
    number,
    title,
    body,
    state: "OPEN",
    isDraft: Boolean(flags["--draft"] || flags["-d"]),
    baseRefName: base,
    headRefName: head,
    headRefOid,
    url: `${repo.url}/pull/${number}`,
    comments: [],
  };
  savePull(repo, pull);
  process.stdout.write(`${pull.url}\n`);
} else if (group === "pr" && command === "view") {
  const pull = findPull(repository(), positionals[0]);
  output(pull, flags, () => pullText(pull));
} else if (group === "pr" && command === "list") {
  const pulls = records("pulls", repository());
  output(pulls, flags, () =>
    pulls
      .map(
        (pull) =>
          `${pull.number}\t${pull.title}\t${pull.headRefName}\t${pull.state}\n`,
      )
      .join(""),
  );
} else if (group === "pr" && command === "edit") {
  const repo = repository();
  const pull = findPull(repo, positionals[0]);
  const body = bodyFrom(flags);
  if (flags["--title"] !== undefined) pull.title = flags["--title"];
  if (body !== undefined) pull.body = body;
  savePull(repo, pull);
  process.stdout.write(`${pull.url}\n`);
} else if (group === "pr" && command === "comment") {
  const repo = repository();
  const pull = findPull(repo, positionals[0]);
  const body = bodyFrom(flags);
  if (typeof body !== "string")
    fail("The exercise stand-in requires --body or --body-file.");
  pull.comments.push({ author: { login: "exercise-maintainer" }, body });
  savePull(repo, pull);
  process.stdout.write(`${pull.url}#issuecomment-${pull.comments.length}\n`);
} else if (group === "pr" && command === "checks") {
  const repo = repository();
  const pull = findPull(repo, positionals[0]);
  const pushed = remoteHead(repo, pull.headRefName);
  if (pushed !== pull.headRefOid) {
    pull.headRefOid = pushed;
    savePull(repo, pull);
  }
  const results = checks(repo, pull);
  output(results, flags, () =>
    results
      .map((check) => `${check.name}\t${check.bucket}\t1s\t${check.link}\n`)
      .join(""),
  );
  if (results.some((check) => check.bucket === "fail")) process.exitCode = 1;
} else {
  unsupported();
}
