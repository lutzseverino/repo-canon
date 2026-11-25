import "./helpers/temporary-directory.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { ticketBody } from "./helpers/issue-contracts.mjs";
import { installedValidator } from "./helpers/installed-validator.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const title = "feat: validate trusted metadata";
const body =
  "## Summary\n\nPreserve trusted metadata.\n\n## Evidence\n\nExecutable fixtures pass.\n\n## Merge Danger\n\nA reversible source change.\n\n## Related issue\n\nCloses #530";

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "validator-entry-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const preload = join(directory, "older-node.mjs");
  writeFileSync(
    preload,
    `import { registerHooks } from "node:module";
registerHooks({ load(url, context, next) {
  const result = next(url, context);
  if (!url.endsWith(".mjs") || !result.source) return result;
  return { ...result, source: String(result.source).replaceAll("import.meta.main", "undefined") };
} });
globalThis.fetch = () => { throw new Error("Unexpected network access"); };
`,
  );
  const event = join(directory, "event.json");
  const neutral = join(directory, "neutral.json");
  writeFileSync(
    event,
    JSON.stringify({
      pull_request: { title, body, head: { repo: { fork: true } } },
    }),
  );
  writeFileSync(
    neutral,
    JSON.stringify({ kind: "pr-metadata", pullRequest: { title, body } }),
  );
  return { directory, preload, event, neutral };
}

test("importing consumers never runs a trigger, including before import.meta.main", (t) => {
  const files = [
    "vendor/repo-canon/validate.mjs",
    ".github/scripts/validate.mjs",
    "vendor/repo-canon/validate-issue-contract.mjs",
    "scripts/issue-contract-sources.mjs",
    "scripts/issue-contract-store.mjs",
    ".agents/skills/triage/ready.mjs",
    ".github/scripts/validate-pr-metadata.mjs",
    ".agents/skills/babysit/wait.mjs",
    ".agents/skills/babysit/merge.mjs",
  ];
  const { preload, directory, event } = fixture(t);
  for (const oldRuntime of [false, true]) {
    const code = `for (const url of ${JSON.stringify(files.map((path) => new URL(`../${path}`, import.meta.url).href))}) await import(url); console.log("Imports stayed inert");`;
    const result = spawnSync(
      process.execPath,
      [
        ...(oldRuntime ? ["--import", preload] : []),
        "--input-type=module",
        "-e",
        code,
        event,
      ],
      {
        cwd: directory,
        encoding: "utf8",
        env: { ...process.env, GITHUB_EVENT_PATH: "/unreadable-event" },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "Imports stayed inert\n");
    assert.equal(result.stderr, "");
  }
});

test("installed trusted trigger and neutral command execute before import.meta.main", (t) => {
  const { directory, preload, event, neutral } = fixture(t);
  for (const [target, args] of [
    [".github/scripts/validate.mjs", ["pr-metadata"]],
    ["vendor/repo-canon/validate.mjs", [neutral]],
  ]) {
    const script = installedValidator(t, target);
    const result = spawnSync(
      process.execPath,
      ["--import", preload, script, ...args],
      {
        cwd: directory,
        encoding: "utf8",
        env: { ...process.env, GITHUB_EVENT_PATH: event },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PR metadata validation passed/);
    assert.equal(result.stderr, "");
  }
});

test("installed babysit entrypoints reject invalid arguments on the older runtime", (t) => {
  const { directory, preload } = fixture(t);
  for (const name of ["wait", "merge"]) {
    const script = installedValidator(t, `.agents/skills/babysit/${name}.mjs`);
    const result = spawnSync(process.execPath, ["--import", preload, script], {
      cwd: directory,
      encoding: "utf8",
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /usage:/i);
    assert.equal(result.stdout, "");
  }
});

test("common command consumes neutral PR data and does not reinterpret a GitHub payload", (t) => {
  const { directory, event, neutral } = fixture(t);
  const script = join(root, "vendor/repo-canon/validate.mjs");
  const valid = spawnSync(process.execPath, [script, neutral], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(valid.status, 0, valid.stderr);
  const raw = spawnSync(process.execPath, [script, event], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(raw.status, 1);
  assert.match(raw.stderr, /Choose issue-contract or pr-metadata/);
});

test("babysit reads only the current CLI credential and redacts acquisition failures", (t) => {
  const { directory } = fixture(t);
  const fake = join(directory, "gh");
  const calls = join(directory, "calls.json");
  const shim = join(directory, "credential.mjs");
  writeFileSync(
    fake,
    `#!/bin/sh\nexec '${process.execPath}' '${shim}' "$@"\n`,
    { mode: 0o755 },
  );
  writeFileSync(
    shim,
    `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2))); process[process.env.FIXTURE_FAIL ? "stderr" : "stdout"].write("fixture-private-token"); if (process.env.FIXTURE_FAIL) process.exit(1);`,
  );
  const code = `import { connectionFor } from ${JSON.stringify(new URL("../.agents/skills/babysit/platform.mjs", import.meta.url).href)}; try { console.log(connectionFor("example/repository").repository.path); } catch (error) { console.error(error.message); process.exitCode = 1; }`;
  for (const fail of [false, true]) {
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", code],
      {
        cwd: directory,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          FIXTURE_FAIL: fail ? "1" : "",
        },
      },
    );
    assert.equal(result.status, fail ? 1 : 0, result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /fixture-private-token/);
    assert.deepEqual(JSON.parse(readFileSync(calls, "utf8")), [
      "auth",
      "token",
      "--hostname",
      "github.com",
    ]);
    if (fail)
      assert.match(
        result.stderr,
        /currently authenticated GitHub CLI credential/,
      );
    else assert.equal(result.stdout, "example/repository\n");
  }
});

test("script detection throws when either compared path cannot be resolved", (t) => {
  const { directory, event } = fixture(t);
  for (const path of [
    "vendor/repo-canon/validate.mjs",
    ".agents/skills/babysit/platform.mjs",
  ]) {
    const url = new URL(`../${path}`, import.meta.url).href;
    for (const missing of ["script", "module"]) {
      const code = `import { executedAsScript } from ${JSON.stringify(url)};
process.argv[1] = ${JSON.stringify(missing === "script" ? join(directory, "missing.mjs") : event)};
executedAsScript(${JSON.stringify(missing === "module" ? new URL("file:///unresolvable/module.mjs").href : url)});
console.log("Skipped validation");`;
      const result = spawnSync(
        process.execPath,
        ["--input-type=module", "-e", code],
        {
          cwd: directory,
          encoding: "utf8",
        },
      );
      assert.equal(result.status, 1, `${path}: ${missing}`);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /ENOENT/);
    }
  }
});

test("documented runner input evaluates through the real standalone command without dispatch or readiness", (t) => {
  const { directory, neutral } = fixture(t);
  const documentation = readFileSync(
    join(root, "docs/development/issue-contract-validation.md"),
    "utf8",
  );
  const section = documentation.split("### Runner evaluation")[1];
  const input = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(section)[1]);
  writeFileSync(neutral, JSON.stringify(input));
  const statePath = join(directory, "state.json");
  writeFileSync(
    statePath,
    JSON.stringify({ comments: [], emitted: [], requests: [] }),
  );
  const preload = join(directory, "runner-fetch.mjs");
  writeFileSync(
    preload,
    `
import { readFileSync, writeFileSync } from "node:fs";
const statePath = ${JSON.stringify(statePath)};
const page = (nodes) => ({ nodes, pageInfo: { hasNextPage: false, endCursor: null } });
const repository = ${JSON.stringify(input.event.repository)};
const login = ${JSON.stringify(input.event.actor.login)};
const time = "2026-11-09T00:00:00Z";
globalThis.fetch = async (input, options = {}) => {
  const url = new URL(input);
  const body = options.body ? JSON.parse(options.body) : null;
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const method = options.method ?? "GET";
  state.requests.push({ method, path: url.pathname });
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
  let response;
  if (url.pathname === "/graphql" && body.query.includes("TriageActingAccount")) {
    response = json({ data: { viewer: { __typename: "Bot", login: login.slice(0, -5) } } });
  } else if (url.pathname === "/graphql" && body.variables.number === 42) {
    response = json({ data: { repository: { issue: {
      number: 42, fullDatabaseId: "42", id: "I42", url: "https://github.com/" + repository + "/issues/42",
      state: "OPEN", title: "Fixture ticket", body: ${JSON.stringify(ticketBody)}, createdAt: time, lastEditedAt: null,
      author: { __typename: "User", login: "reporter" }, labels: page([{name: "state:triage"}]),
      parent: null, subIssues: page([]), blockedBy: page([]), timelineItems: { nodes: [] }
    } } } });
  } else if (url.pathname.endsWith("/comments")) {
    if (method === "POST") {
      const comment = { id: 99, node_id: "C99", html_url: "https://github.com/" + repository + "/issues/42#issuecomment-99", body: body.body, user: { login, type: "Bot" }, created_at: time, updated_at: time };
      state.comments.push(comment);
      state.emitted.push(body.body);
      response = json(comment, 201);
    } else response = json(state.comments);
  } else if (url.pathname.endsWith("/labels") || url.pathname.endsWith("/events")) {
    if (method !== "GET") throw new Error("Unexpected label mutation");
    response = json([]);
  } else if (url.pathname.endsWith("/permission")) response = json({ permission: "none" });
  else throw new Error("Unexpected runner request " + method + " " + url.pathname);
  writeFileSync(statePath, JSON.stringify(state));
  return response;
};
`,
  );
  const script = installedValidator(t, "vendor/repo-canon/validate.mjs");
  const result = spawnSync(
    process.execPath,
    ["--import", preload, script, neutral],
    {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, POSTERN_TOKEN: "fixture-runner-token" },
      timeout: 10000,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  assert.equal(state.comments.length, 1);
  assert.equal(state.comments[0].user.login, "contract-runner[bot]");
  const notice = JSON.parse(
    /<!-- repo-canon:issue-contract-state (.*) -->/.exec(state.emitted[0])[1],
  );
  assert.equal(notice.format, "repo-canon/issue-contract-state/v1");
  assert.equal(notice.kind, "implementation ticket");
  assert.equal(notice.status, "awaiting-review");
  assert.equal(notice.source.type, "issue-body");
  assert.equal(notice.reviewer, null);
  assert.equal(notice.reviewEventId, null);
  assert.equal(
    state.requests.some(({ path }) =>
      /dispatches|actions\/variables/.test(path),
    ),
    false,
  );
  assert.equal(
    state.requests.filter(({ method }) => method !== "GET").length,
    state.requests.filter(({ path }) => path === "/graphql").length + 1,
  );
});

test("cutoff commands exit nonzero at runner without success output or activation writes", (t) => {
  const { directory } = fixture(t);
  const statePath = join(directory, "state.json");
  const preload = join(directory, "cutoff-fetch.mjs");
  writeFileSync(
    statePath,
    JSON.stringify({
      repository: "example/repository",
      requiredChecks: { version: 1, checks: ["Runner checks"] },
      traceRequests: true,
    }),
  );
  writeFileSync(
    preload,
    `
import { fixtureFetch } from ${JSON.stringify(new URL("./fixtures/postern-babysit.mjs", import.meta.url).href)};
const fetch = fixtureFetch(${JSON.stringify(statePath)});
globalThis.fetch = (input, options = {}) => {
  const body = options.body ? JSON.parse(options.body) : null;
  if (body?.query?.includes("query PosternIssues(")) return Promise.resolve(new Response(JSON.stringify({ data: { repository: { issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } } }), { headers: { "content-type": "application/json" } }));
  return fetch(input, options);
};
`,
  );
  writeFileSync(
    join(directory, "gh"),
    "#!/bin/sh\nprintf '%s' fixture-credential\n",
    { mode: 0o755 },
  );
  const script = join(root, "scripts/issue-contract-cutoff.mjs");
  for (const args of [
    ["evaluate", "--issue", "42"],
    [
      "activate",
      "--release",
      "v1",
      "--sha",
      "a".repeat(40),
      "--epoch",
      "2026-11-09T00:00:00Z",
      "--publication-frozen",
    ],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["--import", preload, script, ...args, "--repo", "example/repository"],
      {
        cwd: directory,
        encoding: "utf8",
        env: { ...process.env, PATH: `${directory}:${process.env.PATH}` },
        timeout: 10000,
      },
    );
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /no runner receiver/);
    if (args[0] === "activate")
      assert.match(result.stderr, /Activation did not occur/);
  }
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  assert.equal(
    state.requests.some(
      (request) =>
        request.startsWith("PUT ") ||
        request.includes("/git/refs") ||
        request.includes("/dispatches"),
    ),
    false,
  );
});
