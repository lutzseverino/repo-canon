import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
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

const script = new URL(
  "../.agents/skills/babysit/request.mjs",
  import.meta.url,
);
const fixture = new URL("./fixtures/postern-babysit.mjs", import.meta.url);
const branch = "factory/issue-719";
const link = `https://github.com/example/repository/blob/${branch}/docs/file.md`;
const summary = `# Repository Standards adoption record\n\n## Ready to commit\n\nReady to commit: yes.\n\n## Impact\n\n[generated impact](${link})\n\n## Migration\n\n[generated migration](${link}#migration)\n\n[generated-file]: ${link}#reference\n`;

function setup(t, adoption = false) {
  const directory = mkdtempSync(join(tmpdir(), "body-links-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const checkout = join(directory, "author");
  mkdirSync(checkout);
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: checkout,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  git("init", "-b", "main");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.test");
  mkdirSync(join(checkout, "docs"));
  writeFileSync(join(checkout, "docs/file.md"), "before\n");
  git("add", ".");
  git("commit", "-m", "fixture base");
  const baseCommit = git("rev-parse", "HEAD");
  git("checkout", "-b", branch);
  writeFileSync(join(checkout, "docs/file.md"), "after\n");
  if (adoption) {
    const runtime = join(checkout, ".repo-standards/runtime");
    mkdirSync(runtime, { recursive: true });
    writeFileSync(
      join(runtime, "package-lock.json"),
      '{"lockfileVersion":3}\n',
    );
    writeFileSync(join(runtime, "summary.txt"), summary);
    writeFileSync(
      join(runtime, "cli.mjs"),
      `#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
if (process.argv.slice(2).join(" ") !== "status --summary") process.exit(22);
if (process.env.FAIL_SUMMARY) { process.stdout.write(${JSON.stringify(summary)}); process.exit(23); }
const changed = execFileSync("git", ["diff", "HEAD", "--", "docs/file.md"], { encoding: "utf8" });
process.stdout.write(changed ? readFileSync(".repo-standards/runtime/summary.txt", "utf8") : "Ready to commit: no.\\n- docs/file.md\\n");
`,
    );
  }
  git("add", ".");
  git("commit", "-m", "fixture adoption");
  const head = git("rev-parse", "HEAD");
  const bin = join(directory, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "npm"),
    `#!/usr/bin/env node
import { chmodSync, copyFileSync, mkdirSync } from "node:fs";
if (process.argv.slice(2).join(" ") !== "ci --ignore-scripts --prefix .repo-standards/runtime") process.exit(20);
if (process.cwd() === process.env.AUTHOR_CHECKOUT) process.exit(21);
if (process.env.FAIL_INSTALL) process.exit(24);
mkdirSync(".repo-standards/runtime/node_modules/.bin", {recursive:true});
copyFileSync(".repo-standards/runtime/cli.mjs", ".repo-standards/runtime/node_modules/.bin/repo-standards");
chmodSync(".repo-standards/runtime/node_modules/.bin/repo-standards", 0o755);
`,
  );
  chmodSync(join(bin, "npm"), 0o755);
  const statePath = join(directory, "state.json");
  return {
    checkout,
    git,
    run(body, options = {}, env = {}, target = script) {
      writeFileSync(
        statePath,
        JSON.stringify({
          head,
          baseCommit,
          branch,
          body,
          comments: [],
          reviewConfiguration: {},
          ...options,
        }),
      );
      const bundle = new URL("../../../vendor/postern/postern.mjs", target);
      const child = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `import { main } from ${JSON.stringify(target.href)}; import { connect } from ${JSON.stringify(bundle.href)}; import { fixtureConnection } from ${JSON.stringify(fixture.href)}; process.exitCode = await main(["12"], fixtureConnection(connect));`,
        ],
        {
          cwd: checkout,
          encoding: "utf8",
          timeout: 15000,
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            FAKE_GH_STATE: statePath,
            AUTHOR_CHECKOUT: checkout,
            ...env,
          },
        },
      );
      assert.ifError(child.error);
      assert.equal(JSON.parse(readFileSync(statePath, "utf8")).body, body);
      assert.equal(
        git("worktree", "list", "--porcelain").match(/^worktree /gm).length,
        1,
      );
      return {
        code: child.status,
        stderr: child.stderr,
        stdout: child.stdout,
        emitted: JSON.parse(readFileSync(statePath, "utf8")).emitted ?? [],
      };
    },
  };
}

test("only the complete rebuilt pre-commit summary is exempt, preserving the author's checkout", (t) => {
  const repository = setup(t, true);
  const clean = execFileSync(
    process.execPath,
    [".repo-standards/runtime/cli.mjs", "status", "--summary"],
    { cwd: repository.checkout, encoding: "utf8" },
  );
  assert.equal(clean, "Ready to commit: no.\n- docs/file.md\n");
  writeFileSync(join(repository.checkout, "staged.txt"), "preserve staged\n");
  repository.git("add", "staged.txt");
  writeFileSync(join(repository.checkout, "docs/file.md"), "author edit\n");
  writeFileSync(
    join(repository.checkout, "untracked.txt"),
    "preserve untracked\n",
  );
  const before = repository.git("status", "--porcelain=v1");
  for (let repeat = 0; repeat < 2; repeat++) {
    const result = repository.run(summary);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(result.emitted, []);
    assert.equal(repository.git("status", "--porcelain=v1"), before);
    assert.equal(
      readFileSync(join(repository.checkout, "docs/file.md"), "utf8"),
      "author edit\n",
    );
  }
});

test("appended Impact, Migration and Related issue are checked after the complete generated prefix", (t) => {
  const repository = setup(t, true);
  for (const heading of ["Impact", "Migration", "Related issue"]) {
    const appended = `${link}#appended-${heading.replaceAll(" ", "-")}`;
    const result = repository.run(
      `${summary}\n## ${heading}\n\n[appended](${appended})\n`,
    );
    assert.equal(result.code, 8, result.stderr);
    assert.ok(result.stderr.includes(appended));
    assert.ok(!result.stderr.includes(`${link}#migration\n`));
    assert.ok(!result.stderr.includes("No adoption-summary exemption"));
    assert.deepEqual(result.emitted, []);
  }
});

test("a partial, normalized or displaced summary grants no exemption", (t) => {
  const repository = setup(t, true);
  for (const body of [
    summary.trimEnd(),
    summary.replaceAll("\n", "\r\n"),
    summary.replace("Ready to commit: yes.", "Ready to commit:  yes."),
    `preamble\n${summary}`,
    `${summary.slice(0, -10)}different\n`,
  ]) {
    const result = repository.run(body);
    assert.equal(result.code, 8, result.stderr);
    assert.match(
      result.stderr,
      /No adoption-summary exemption applied.*complete rebuilt summary byte for byte/,
    );
    assert.ok(result.stderr.includes(link));
  }
});

test("failed installs, partial failed stdout and unavailable base commits check the whole body and clean up", (t) => {
  const repository = setup(t, true);
  for (const { options = {}, env = {}, reason } of [
    { env: { FAIL_INSTALL: "1" }, reason: /npm ci .*failed/ },
    { env: { FAIL_SUMMARY: "1" }, reason: /status --summary failed/ },
    {
      options: { baseCommit: "f".repeat(40) },
      reason: /PR base commit .*unavailable locally/,
    },
  ]) {
    const result = repository.run(summary, options, env);
    assert.equal(result.code, 8, result.stderr);
    assert.match(result.stderr, /No adoption-summary exemption applied/);
    assert.match(result.stderr, reason);
    assert.ok(result.stderr.includes(`${link}#migration`));
    assert.deepEqual(result.emitted, []);
    assert.equal(
      repository.run("ordinary link-free body", options, env).code,
      0,
    );
  }
});

test("non-adoption repositories explain missing runtime evidence and still accept link-free bodies", (t) => {
  const repository = setup(t);
  const result = repository.run(`[file](${link})`);
  assert.equal(result.code, 8, result.stderr);
  assert.match(
    result.stderr,
    /no pinned runtime lockfile.*Checking the whole body/s,
  );
  assert.equal(repository.run("ordinary body").code, 0);
});

test("slash refs, URI-encoded refs, references, autolinks, images and HTML links are reported as supplied", (t) => {
  const repository = setup(t);
  const target = pathToFileURL(
    installedValidator(t, ".agents/skills/babysit/request.mjs"),
  );
  const encoded = link.replace(branch, encodeURIComponent(branch));
  const partiallyEncoded = link.replace("issue-719", "issue%2D719");
  const links = [link, encoded, partiallyEncoded];
  for (const ownLink of links) {
    for (const body of [
      `[file](${ownLink})`,
      `[file][ref]\n\n[ref]: ${ownLink}`,
      `<${ownLink}>`,
      ownLink,
      `![file](${ownLink})`,
      `<a href="${ownLink}">file</a>`,
    ]) {
      const result = repository.run(body, {}, {}, target);
      assert.equal(result.code, 8, result.stderr);
      assert.ok(result.stderr.includes(ownLink));
      assert.deepEqual(result.emitted, []);
    }
  }
});

test("commit permalinks, external repositories, assets and code examples pass unchanged", (t) => {
  const repository = setup(t);
  for (const body of [
    `[commit](${link.replace(branch, "a".repeat(40))})`,
    `[external](${link.replace("example/repository", "other/repository")})`,
    `[asset](${link.replace(branch, "pr-assets/example")})`,
    `[similar](${link.replace(branch, `${branch}-other`)})`,
    `[external](https://example.test/example/repository/blob/${branch}/docs/file.md)`,
    `\`${link}\``,
    `\n\`\`\`text\n${link}\n\`\`\`\n`,
  ]) {
    const result = repository.run(body);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(result.emitted, []);
  }
});

test("fork PRs check the actual source repository, and incomplete or changing identity permits no request", (t) => {
  const repository = setup(t);
  const forkLink = link.replace("example/repository", "contributor/fork");
  const options = { crossRepository: true, headRepository: "contributor/fork" };
  const result = repository.run(`[fork](${forkLink})`, options);
  assert.equal(result.code, 8, result.stderr);
  assert.ok(result.stderr.includes(forkLink));
  assert.equal(repository.run(`[destination](${link})`, options).code, 0);
  for (const pullDetails of [
    {},
    {
      head: {
        sha: "e".repeat(40),
        ref: branch,
        repo: { full_name: "example/repository" },
      },
    },
  ]) {
    const failed = repository.run(`[file](${link})`, { pullDetails });
    assert.equal(failed.code, 1, failed.stderr);
    assert.match(failed.stderr, /Could not establish.*head repository and ref/);
    assert.deepEqual(failed.emitted, []);
  }
});

test("appended references are checked even when their URL definition is in the exempt summary", (t) => {
  const repository = setup(t, true);
  const result = repository.run(
    `${summary}\n## Related issue\n\n[appended][generated-file]\n`,
  );
  assert.equal(result.code, 8, result.stderr);
  assert.ok(result.stderr.includes(`${link}#reference`));
});

test("a failing checkout hook cannot leave a registered temporary worktree", (t) => {
  const repository = setup(t, true);
  const hooks = join(repository.checkout, ".git/hooks");
  writeFileSync(join(hooks, "post-checkout"), "#!/bin/sh\nexit 1\n");
  chmodSync(join(hooks, "post-checkout"), 0o755);
  const result = repository.run(summary);
  assert.equal(result.code, 8, result.stderr);
  assert.match(result.stderr, /worktree add .*failed/);
  assert.match(result.stderr, /Checking the whole body/);
});
