import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { installedValidator } from "./helpers/installed-validator.mjs";

const gh = execFileSync("which", ["gh"], { encoding: "utf8" }).trim();
const ssh = execFileSync("which", ["ssh"], { encoding: "utf8" }).trim();
const fixture = new URL("./fixtures/postern-babysit.mjs", import.meta.url);
const head = "a".repeat(40);
const revision = "b".repeat(40);
const reviewer = {
  version: 1,
  account: "trusted-reviewer[bot]",
  request: { comment: "@trusted-reviewer review", onOpen: false },
  unavailable: [],
  bounds: { responseMinutes: 5, reviewMinutes: 30 },
};

// Exercise installed entry points without injecting a connection: only the
// credential command and the HTTP transport are replaced at system boundaries.
/**
 * @param {import("node:test").TestContext} t
 * @param {string} entry
 * @param {{ configured?: boolean, environment?: string, explicit?: string,
 * destination?: string, selectionFails?: boolean, credentialFails?: boolean,
 * defaultHost?: string, resolution?: string, defaultRemote?: string, defaultName?: string, extraDefault?: string,
 * currentHead?: string }} [options]
 */
function run(
  t,
  entry,
  {
    configured = true,
    defaultName = "upstream",
    defaultHost = "github.com",
    resolution = "base",
    defaultRemote = `https://${defaultHost || "github.com"}/example/repository.git`,
    extraDefault,
    environment,
    explicit,
    destination = "example/repository",
    selectionFails = false,
    credentialFails = false,
    currentHead = head,
  } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), "babysit-destination-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: directory });
  git("init", "-q");
  git("remote", "add", "origin", "https://github.com/fork/repository.git");
  if (defaultName === "origin")
    git("remote", "set-url", "origin", defaultRemote);
  else git("remote", "add", defaultName, defaultRemote);
  if (configured)
    git("config", `remote.${defaultName}.gh-resolved`, resolution);
  if (extraDefault) {
    git("remote", "set-url", "origin", extraDefault);
    git("config", "remote.origin.gh-resolved", "base");
  }
  mkdirSync(join(directory, ".github"));
  // Local declarations disagree with the destination snapshot and cannot win.
  writeFileSync(
    join(directory, ".github/factory-review-policy.json"),
    JSON.stringify({ version: 1, author: "factory-app[bot]" }),
  );
  writeFileSync(join(directory, ".github/pull-request-reviewer.json"), "{");
  const statePath = join(directory, "state.json");
  writeFileSync(
    statePath,
    JSON.stringify({
      repository: destination,
      traceDestinations: true,
      traceReviewConfiguration: true,
      traceRequests: true,
      head: currentHead,
      author: "factory-app[bot]",
      createdAt: "2026-10-11T05:00:00Z",
      pushedAt: "2026-10-11T05:00:00Z",
      committedAt: "2026-10-11T05:00:00Z",
      checks: [
        {
          __typename: "StatusContext",
          context: "CI",
          state: "SUCCESS",
          targetUrl: "https://ci/1",
        },
      ],
      reviewConfiguration: {
        policy: { version: 1, author: "other-app[bot]" },
        reviewer,
      },
    }),
  );
  writeFileSync(
    join(directory, "gh"),
    `#!${process.execPath}
const { spawnSync } = require("node:child_process");
const args = process.argv.slice(2);
if (args.join(" ") === "auth token --hostname github.com") {
  if (${credentialFails}) process.exit(1);
  console.log("fixture-credential");
} else if (args.join(" ") === "repo set-default --view") {
  if (${selectionFails}) { console.error("fixture selection failure"); process.exit(1); }
  const result = spawnSync(${JSON.stringify(gh)}, args, { stdio: "inherit" });
  process.exit(result.status ?? 1);
} else process.exit(99);
`,
    { mode: 0o755 },
  );
  const sshConfig = join(directory, "ssh-config");
  writeFileSync(
    sshConfig,
    "Host github-work\n  HostName github.com\nHost enterprise-work\n  HostName ghe.example.com\n",
  );
  writeFileSync(
    join(directory, "ssh"),
    `#!${process.execPath}
const { spawnSync } = require("node:child_process");
const result = spawnSync(${JSON.stringify(ssh)}, ["-F", ${JSON.stringify(sshConfig)}, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 1);
`,
    { mode: 0o755 },
  );
  const target = pathToFileURL(
    installedValidator(
      t,
      entry === "ready"
        ? ".agents/skills/triage/ready.mjs"
        : `.agents/skills/babysit/${entry === "connection" ? "platform" : entry}.mjs`,
    ),
  );
  const inherited = { ...process.env };
  delete inherited.GH_REPO;
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { fixtureFetch } from ${JSON.stringify(fixture.href)};
     globalThis.fetch = fixtureFetch();
     const command = await import(${JSON.stringify(target.href)});
     try {
       if (${JSON.stringify(entry)} === "connection") console.log(JSON.stringify(command.connectionFor(${JSON.stringify(explicit)}).repository));
       else { const code = await command.main(process.argv.slice(1)); if (code != null) process.exitCode = code; }
     }
     catch (error) { console.error(error.message); process.exitCode = 1; }`,
      "--",
      "12",
      ...(entry === "ready"
        ? ["ready-for-agent", `sha256:${"a".repeat(64)}`]
        : []),
      ...(entry === "merge" ? [head] : []),
      ...(entry === "wait" ? ["--limit", "1", "--interval", "0.01"] : []),
      ...(explicit ? ["--repo", explicit] : []),
    ],
    {
      cwd: directory,
      encoding: "utf8",
      timeout: 20000,
      env: {
        ...inherited,
        PATH: `${directory}:${process.env.PATH}`,
        ...(environment == null ? {} : { GH_REPO: environment }),
        GH_HOST: defaultHost,
        GH_ENTERPRISE_TOKEN: "fixture-credential",
        GH_TOKEN: "fixture-credential",
        GITHUB_TOKEN: "fixture-credential",
        GH_CONFIG_DIR: join(directory, "gh-config"),
        FAKE_GH_STATE: statePath,
      },
    },
  );
  assert.ifError(result.error);
  return { ...result, state: JSON.parse(readFileSync(statePath, "utf8")) };
}

test("installed request honors the configured CLI default for reads, trusted files and mutations", (t) => {
  const result = run(t, "request");
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /review configuration: example\/repository default branch main@b{40}/,
  );
  assert.deepEqual(result.state.emitted, [reviewer.request.comment]);
  assert.ok(result.state.destinations.length > 0);
  assert.ok(
    result.state.destinations.every(
      (repository) => repository === "example/repository",
    ),
  );
  const files = result.state.configurationReads.find(
    (read) => read.kind === "files",
  );
  assert.equal(files.policy, `${revision}:.github/factory-review-policy.json`);
  assert.equal(
    files.reviewer,
    `${revision}:.github/pull-request-reviewer.json`,
  );
});

for (const entry of ["wait", "merge"]) {
  test(`installed ${entry} honors the configured CLI default`, (t) => {
    const result = run(t, entry);
    assert.equal(result.status, entry === "wait" ? 4 : 0, result.stderr);
    assert.ok(result.state.destinations.length > 0);
    assert.ok(
      result.state.destinations.every(
        (repository) => repository === "example/repository",
      ),
    );
    if (entry === "merge") {
      assert.equal(result.state.merge.expectedHead, head);
      assert.equal(result.state.merge.method, "squash");
    } else {
      assert.match(result.stdout, /review not requested for this head/);
      assert.match(
        result.stdout,
        /review configuration: example\/repository default branch main@b{40}/,
      );
      const files = result.state.configurationReads.find(
        (read) => read.kind === "files",
      );
      assert.equal(
        files.policy,
        `${revision}:.github/factory-review-policy.json`,
      );
      assert.equal(
        files.reviewer,
        `${revision}:.github/pull-request-reviewer.json`,
      );
    }
  });
}

for (const entry of ["request", "wait", "merge"]) {
  for (const selection of [
    {
      name: "origin without a configured default",
      options: { configured: false, destination: "fork/repository" },
    },
    {
      name: "GH_REPO before a configured default",
      options: {
        environment: "environment/repository",
        destination: "environment/repository",
      },
    },
    {
      name: "host-qualified GH_REPO before a configured default",
      options: {
        environment: "github.com/environment/repository",
        destination: "environment/repository",
      },
    },
    ...(entry === "merge"
      ? []
      : [
          {
            name: "an explicit repository before GH_REPO and a configured default",
            options: {
              explicit: "explicit/repository",
              environment: "environment/repository",
              destination: "explicit/repository",
            },
          },
          {
            name: "a host-qualified explicit repository before GH_REPO and a configured default",
            options: {
              explicit: "github.com/explicit/repository",
              environment: "ghe.example.com/environment/repository",
              destination: "explicit/repository",
            },
          },
        ]),
  ]) {
    test(`installed ${entry} selects ${selection.name}`, (t) => {
      const result = run(t, entry, selection.options);
      assert.equal(result.status, entry === "wait" ? 4 : 0, result.stderr);
      assert.ok(result.state.destinations.length > 0);
      assert.ok(
        result.state.destinations.every(
          (repository) => repository === selection.options.destination,
        ),
      );
      if (entry === "request")
        assert.deepEqual(result.state.emitted, [reviewer.request.comment]);
      if (entry === "merge")
        assert.equal(result.state.merge.expectedHead, head);
    });
  }

  test(`installed ${entry} stops when destination selection fails without falling back to origin`, (t) => {
    const result = run(t, entry, {
      selectionFails: true,
      destination: "fork/repository",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /gh repo set-default --view/);
    assert.deepEqual(result.state.destinations ?? [], []);
    assert.equal(result.state.merge, undefined);
    assert.deepEqual(result.state.emitted ?? [], []);
  });

  test(`installed ${entry} stops when the supplied credential is unavailable`, (t) => {
    const result = run(t, entry, { credentialFails: true });
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /currently authenticated GitHub CLI credential/,
    );
    assert.deepEqual(result.state.destinations ?? [], []);
  });
}

test("installed merge retains the expected-head gate on the configured destination", (t) => {
  const result = run(t, "merge", { currentHead: "d".repeat(40) });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /head changed.*wait again/i);
  assert.equal(result.state.merge, undefined);
  assert.deepEqual(result.state.destinations, ["example/repository"]);
});

for (const entry of ["connection", "request", "wait", "merge", "ready"]) {
  test(`installed ${entry} refuses an enterprise CLI default before any HTTP request`, (t) => {
    const result = run(t, entry, {
      defaultHost: "ghe.example.com",
      defaultName: "origin",
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(
      result.stderr,
      /No platform adapter serves the remote on host ghe\.example\.com/,
    );
    assert.deepEqual(result.state.destinations ?? [], []);
    assert.deepEqual(result.state.requests ?? [], []);
    assert.equal(result.state.merge, undefined);
    assert.deepEqual(result.state.emitted ?? [], []);
  });
}

for (const options of [
  { defaultHost: "" },
  { defaultHost: "", defaultRemote: "git@github-work:example/repository.git" },
  { defaultHost: "", extraDefault: "git@github.com:example/repository.git" },
  { defaultRemote: "git@github.com:example/repository.git" },
  { defaultRemote: "ssh://git@ssh.github.com:443/example/repository.git" },
  { resolution: "parent/repository", destination: "parent/repository" },
  {
    resolution: "github.com/parent/repository",
    destination: "parent/repository",
  },
  {
    defaultHost: "ghe.example.com",
    environment: "environment/repository",
    destination: "environment/repository",
  },
  {
    defaultHost: "ghe.example.com",
    explicit: "explicit/repository",
    environment: "environment/repository",
    destination: "explicit/repository",
  },
]) {
  test(`installed request preserves default identity and override precedence: ${JSON.stringify(options)}`, (t) => {
    const result = run(t, "request", options);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.state.destinations.length > 0);
    assert.ok(
      result.state.destinations.every(
        (repository) =>
          repository === (options.destination ?? "example/repository"),
      ),
    );
    assert.deepEqual(result.state.emitted, [reviewer.request.comment]);
  });
}

test("the shared installed resolver retains the configured github.com default identity", (t) => {
  const result = run(t, "connection");
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    platform: "github",
    host: "github.com",
    path: "example/repository",
  });
  assert.deepEqual(result.state.requests ?? [], []);
});

for (const repository of [
  "example/repository",
  "github.com/example/repository",
  "https://github.com/example/repository.git",
  "git@github.com:example/repository.git",
  "ssh://git@github.com/example/repository.git",
  "ssh://git@ssh.github.com:443/example/repository.git",
]) {
  for (const selector of ["environment", "explicit"]) {
    test(`the shared installed resolver accepts ${selector} repository ${repository}`, (t) => {
      const result = run(t, "connection", {
        environment: "ghe.example.com/other/repository",
        [selector]: repository,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), {
        platform: "github",
        host: "github.com",
        path: "example/repository",
      });
      assert.deepEqual(result.state.requests ?? [], []);
    });
  }
}

for (const entry of ["connection", "request", "wait", "merge", "ready"]) {
  for (const selector of entry === "merge"
    ? ["environment"]
    : ["environment", "explicit"]) {
    for (const repository of [
      "ghe.example.com/example/repository",
      "github.com/example/repository/extra",
      "github.com/example/repo?query",
      "github.com/example/repo#fragment",
      "github.com//repository",
      "example",
    ]) {
      test(`installed ${entry} refuses ${selector} repository ${repository} before HTTP`, (t) => {
        const result = run(t, entry, { [selector]: repository });
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr, /No platform adapter serves the remote/);
        if (repository.startsWith("ghe.example.com/"))
          assert.match(result.stderr, /on host ghe\.example\.com/);
        assert.deepEqual(result.state.requests ?? [], []);
        assert.equal(result.state.merge, undefined);
        assert.deepEqual(result.state.emitted ?? [], []);
      });
    }
  }
}

test("an SSH alias for an enterprise default is refused before HTTP", (t) => {
  const result = run(t, "connection", {
    defaultHost: "ghe.example.com",
    defaultRemote: "git@enterprise-work:example/repository.git",
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(
    result.stderr,
    /No platform adapter serves the remote on host ghe\.example\.com/,
  );
  assert.deepEqual(result.state.requests ?? [], []);
});
