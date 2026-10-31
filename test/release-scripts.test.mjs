import {
  execFixtureGit,
  fixtureGitEnvironment,
} from "../scripts/support/fixture-git.mjs";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import {
  assessments as adoptionAssessments,
  files as adoptionFixture,
} from "../scripts/release/adoption-fixture.mjs";
import { fileDeclarations } from "./helpers/documentation.mjs";
import { exactFiles } from "./helpers/installed-validator.mjs";
import { invokeCheck } from "./helpers/operation.mjs";

// The release scripts run against disposable repositories. The public CLI and
// `gh` are external boundaries, so stubs stand in for them: the CLI stub
// reports the declarations a commit's `declarations.json` lists and delegates
// `adopt` and `status` to the fake adoption, and the `gh` stub reports the
// release state it is given.
const scripts = join(
  resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  "scripts/release",
);
const fakeAdopt = pathToFileURL(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "fixtures/fake-repo-standards-adopt.mjs",
  ),
).href;

const cliStub = `#!/usr/bin/env node
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const [command, subcommand, ...rest] = process.argv.slice(2);
if (command === 'source' && subcommand === 'validate') {
  const declarations = JSON.parse(readFileSync(join(rest[0], 'declarations.json'), 'utf8'));
  if (declarations === 'invalid') {
    console.log(JSON.stringify({ valid: false, errors: [{ message: 'Stub rejected the source.' }] }));
    process.exit(1);
  }
  console.log(JSON.stringify({ valid: true, errors: [], profiles: { standard: { declarations } } }));
} else if (command === 'inspect') {
  const args = process.argv.slice(2);
  const version = args[args.indexOf('--standards-version') + 1];
  const profile = args[args.indexOf('--profile') + 1];
  console.log(JSON.stringify({
    format: 'repo-standards/inspection/v8',
    remoteSetup: [],
    selection: {
      cli: { version: process.env.STUB_CLI_VERSION },
      standards: { version, commit: process.env.STUB_RESOLVED_COMMIT },
      profile,
    },
    sourceResolved: { declarations: [{ id: 'agent-guidance' }] },
  }));
} else if (command === '--version') {
  console.log(process.env.STUB_CLI_VERSION);
} else if (command === 'adopt' || command === 'status') {
  if (command === 'adopt' && process.env.STUB_CLI_VERSION === '6.0.0' && !process.argv.includes('--answers') && !process.argv.includes('--standards-version')) {
    console.log(JSON.stringify({ errors: [{ message: 'The newest release requires a newer CLI; select the previous version explicitly.' }] }));
    process.exit(1);
  }
  import(${JSON.stringify(fakeAdopt)});
} else {
  process.exit(2);
}
`;

const ghStub = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === 'api') {
  console.log(process.env.STUB_RELEASES || '[]');
} else if (args[0] === 'release' && args[1] === 'view' && process.env.STUB_RELEASE) {
  console.log(process.env.STUB_RELEASE);
} else {
  console.error('release not found');
  process.exit(1);
}
`;

const npmStub = `#!/usr/bin/env node
const { mkdirSync, writeFileSync, chmodSync } = require('node:fs');
const { join } = require('node:path');
const args = process.argv.slice(2);
if (args[0] === 'view') {
  console.log(JSON.stringify('10.0.0'));
} else if (args[0] === 'install') {
  const version = args.at(-1).split('@').at(-1);
  const path = join(args[args.indexOf('--prefix') + 1], 'node_modules/.bin/repo-standards');
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, '#!/usr/bin/env node\\nprocess.env.STUB_CLI_VERSION = ' + JSON.stringify(version) + ';\\n' + ${JSON.stringify(cliStub.replace(/^#![^\n]*\n/, ""))});
  chmodSync(path, 0o755);
} else process.exit(2);
`;

// Fixture repositories ignore the maintainer's Git configuration, such as tag
// signing, so that they build the same everywhere.
const identity = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.com",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.com",
};

function executable(path, content) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
  chmodSync(path, 0o755);
}

function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), "repo-canon-release-scripts-"));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const repository = join(base, "repository");
  const prefix = join(base, "cli");
  const bin = join(base, "bin");
  executable(join(prefix, "node_modules/.bin/repo-standards"), cliStub);
  executable(join(bin, "gh"), ghStub);
  executable(join(bin, "npm"), npmStub);
  mkdirSync(repository);
  const git = (...args) =>
    execFixtureGit(args, {
      cwd: repository,
      encoding: "utf8",
      env: { ...fixtureGitEnvironment(), ...identity },
    }).trim();
  git("init", "--quiet", "--initial-branch=main");
  git("init", "--quiet", "--bare", join(base, "origin.git"));
  git("remote", "add", "origin", join(base, "origin.git"));

  const commit = (files, message) => {
    for (const [path, content] of Object.entries(files)) {
      const absolute = join(repository, path);
      if (content === null) {
        rmSync(absolute);
        continue;
      }
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(
        absolute,
        typeof content === "string" ? content : JSON.stringify(content),
      );
    }
    git("add", "--all");
    git("commit", "--quiet", "--message", message);
    return git("rev-parse", "HEAD");
  };

  const run = (script, args, environment = {}) => {
    const child = spawnSync(
      process.execPath,
      [join(scripts, script), ...args],
      {
        cwd: repository,
        encoding: "utf8",
        env: {
          ...fixtureGitEnvironment(),
          PATH: `${bin}:${process.env.PATH}`,
          REPO_STANDARDS_PREFIX: prefix,
          STUB_CLI_VERSION: "7.0.0",
          ...environment,
        },
      },
    );
    return { status: child.status, output: `${child.stdout}${child.stderr}` };
  };

  return { git, commit, run };
}

const previousDeclarations = [
  { id: "kept", kind: "file", target: "kept.md", exact: "kept.md" },
  { id: "dropped", kind: "file", target: "dropped.md", exact: "dropped.md" },
  { id: "skill", kind: "skill", name: "skill", source: "skill" },
  {
    id: "checked",
    kind: "repository",
    guidance: "guidance.md",
    rules: "rules.md",
    checks: [{ id: "check", run: { script: "check.mjs", resources: ["lib"] } }],
    fixes: [
      {
        id: "fix",
        run: { script: "fix.mjs" },
        "remote-setup": {
          probe: { run: { script: "probe.mjs", resources: ["probe-lib"] } },
        },
      },
    ],
    "discovery-script": {
      run: { script: "draft.mjs", resources: ["draft-lib"] },
    },
  },
];
const candidateDeclarations = previousDeclarations.filter(
  (declaration) => declaration.id !== "dropped",
);

function releasedSource(t) {
  const repository = fixture(t);
  repository.commit(
    {
      "declarations.json": previousDeclarations,
      "kept.md": "kept\n",
      "dropped.md": "dropped\n",
      "skill/SKILL.md": "skill\n",
      "guidance.md": "guidance\n",
      "rules.md": "rules\n",
      "check.mjs": "check\n",
      "lib/support.mjs": "support\n",
      "fix.mjs": "fix\n",
      "probe.mjs": "probe\n",
      "probe-lib/support.mjs": "probe support\n",
      "draft.mjs": "draft\n",
      "draft-lib/support.mjs": "draft support\n",
      "notes.md": "not an input\n",
    },
    "previous release",
  );
  repository.git(
    "tag",
    "--annotate",
    "v1.0.0",
    "--message",
    "Repo Canon v1.0.0",
  );
  return repository;
}

test("release:inputs lists the inputs, the dropped inputs, and the diff stat from the previous tag", (t) => {
  const repository = releasedSource(t);
  repository.commit(
    {
      "declarations.json": candidateDeclarations,
      "dropped.md": null,
      "lib/support.mjs": "changed support\n",
      "probe.mjs": "changed probe\n",
      "draft-lib/support.mjs": "changed draft support\n",
      "notes.md": "changed, but not an input\n",
    },
    "candidate",
  );

  const { status, output } = repository.run("inputs.mjs", ["v1.0.0"]);

  assert.equal(status, 0, output);
  for (const path of [
    "check.mjs",
    "draft-lib",
    "draft.mjs",
    "fix.mjs",
    "guidance.md",
    "kept.md",
    "lib",
    "probe-lib",
    "probe.mjs",
    "rules.md",
    "skill",
    "standards.yaml",
  ]) {
    assert.match(output, new RegExp(`^  ${path.replaceAll(".", "\\.")}$`, "m"));
  }
  assert.match(output, /no longer selects[^\n]*\n {2}dropped\.md$/m);
  assert.match(output, /^ lib\/support\.mjs\s+\| 2 \+-/m);
  assert.match(output, /probe\.mjs\s+\| 2 \+-/);
  assert.match(output, /draft-lib\/support\.mjs\s+\| 2 \+-/);
  assert.match(output, /dropped\.md\s+\| 1 -/);
  assert.doesNotMatch(output, /notes\.md/);
});

test("release:inputs reports an empty reviewed diff", (t) => {
  const repository = releasedSource(t);
  repository.commit(
    { "notes.md": "changed, but not an input\n" },
    "documentation only",
  );

  const { status, output } = repository.run("inputs.mjs", ["v1.0.0"]);

  assert.equal(status, 0, output);
  assert.match(output, /No source input changed since v1\.0\.0\./);
});

test("factory package changes are outside Repo Canon release inputs", (t) => {
  // The real manifest must not select the package as a file, skill, operation,
  // or retained resource. The release fixture then exercises the input command
  // with a tracked factory subtree and an independent version stream.
  const standards = readFileSync(join(scripts, "../../standards.yaml"), "utf8");
  assert.doesNotMatch(standards, /(?:[:-]\s+|\[)factory(?:\/|[\s\],])/);
  const repository = releasedSource(t);
  repository.commit(
    {
      "factory/package.json": { name: "factory", version: "99.0.0" },
      "factory/src/main.ts": "export const factory = 'new runner';\n",
      "factory/README.md": "# Factory\n",
      "factory/docs/development/release.md": "# Factory releases\n",
    },
    "factory release only",
  );

  const { status, output } = repository.run("inputs.mjs", ["v1.0.0"]);

  assert.equal(status, 0, output);
  assert.match(output, /No source input changed since v1\.0\.0\./);
  assert.doesNotMatch(output, /factory\//);
});

test("release:inputs fails clearly for a missing tag or CLI", (t) => {
  const repository = releasedSource(t);

  const missingTag = repository.run("inputs.mjs", ["v0.9.0"]);
  assert.notEqual(missingTag.status, 0);
  assert.match(missingTag.output, /v0\.9\.0 is not a tag in this repository/);

  const missingCli = repository.run("inputs.mjs", ["v1.0.0"], {
    REPO_STANDARDS_PREFIX: "",
  });
  assert.notEqual(missingCli.status, 0);
  assert.match(missingCli.output, /Set REPO_STANDARDS_PREFIX/);

  const noArgument = repository.run("inputs.mjs", []);
  assert.notEqual(noArgument.status, 0);
  assert.match(
    noArgument.output,
    /Usage: pnpm run release:inputs <previous-tag>/,
  );

  const emptyArgument = repository.run("inputs.mjs", [""]);
  assert.notEqual(emptyArgument.status, 0);
  assert.match(
    emptyArgument.output,
    /Usage: pnpm run release:inputs <previous-tag>/,
  );
});

test("release:inputs fails with the CLI errors when a commit does not validate", (t) => {
  const repository = releasedSource(t);
  repository.commit({ "declarations.json": '"invalid"' }, "broken candidate");

  const { status, output } = repository.run("inputs.mjs", ["v1.0.0"]);

  assert.notEqual(status, 0);
  assert.match(output, /does not validate[^\n]*\n.*Stub rejected the source\./);
});

test("release:check-merge passes when only files outside the inputs changed", (t) => {
  const repository = releasedSource(t);
  const reviewedHead = repository.git("rev-parse", "HEAD");
  const mergeCommit = repository.commit(
    { "notes.md": "merged alongside\n" },
    "merge",
  );

  const { status, output } = repository.run("check-merge.mjs", [
    reviewedHead,
    mergeCommit,
  ]);

  assert.equal(status, 0, output);
  assert.match(output, /carries exactly the reviewed source inputs/);
});

test("release:check-merge fails and names the input that changed after review", (t) => {
  const repository = releasedSource(t);
  const reviewedHead = repository.git("rev-parse", "HEAD");
  const mergeCommit = repository.commit(
    { "skill/SKILL.md": "changed after review\n" },
    "merge",
  );

  const { status, output } = repository.run("check-merge.mjs", [
    reviewedHead,
    mergeCommit,
  ]);

  assert.notEqual(status, 0);
  assert.match(output, /does not carry exactly the reviewed source inputs/);
  assert.match(output, /skill\/SKILL\.md/);
});

test("release:check-merge fails clearly for a commit that is not present", (t) => {
  const repository = releasedSource(t);
  const reviewedHead = repository.git("rev-parse", "HEAD");

  const { status, output } = repository.run("check-merge.mjs", [
    reviewedHead,
    "f".repeat(40),
  ]);

  assert.notEqual(status, 0);
  assert.match(
    output,
    /f{40} does not name a commit in this repository; fetch it first/,
  );
});

// The development and authoring documents, each naming the CLI version given.
function developmentDocuments(cliVersion) {
  return {
    "docs/development/README.md": `Install public Repository Standards CLI ${cliVersion}.\n`,
    "docs/development/source-profile.md": `Install \`@lutzseverino/repo-standards@${cliVersion}\` with Git 2.18.0.\n`,
    "authoring-notes.md": `Use installed public CLI ${cliVersion} as the current validation baseline.\n`,
  };
}

// A published v1.0.0 release; `documents` replaces files of its commit, and
// the previous release v0.9.0 declares `previousProfiles`.
function publishedRelease(
  t,
  documents = {},
  previousProfiles = ["standard", "factory"],
) {
  const repository = fixture(t);
  const previousCommit = repository.commit(
    {
      "standards.yaml":
        'format: repo-standards/v2\nrequires:\n  repo-standards: ">=6.0.0"\n\nprofiles:\n' +
        previousProfiles
          .map((name) => `  ${name}:\n    declarations: {}\n`)
          .join("\n"),
    },
    "previous",
  );
  repository.git("tag", "--annotate", "v0.9.0", "--message", "previous");
  const releaseCommit = repository.commit(
    {
      "declarations.json": previousDeclarations,
      "README.md":
        "Run `npx @lutzseverino/repo-standards adopt https://github.com/lutzseverino/repo-canon`.\n",
      "docs/usage/adopt-repo-canon.md":
        "See the CLI's [adoption guide](https://github.com/lutzseverino/repo-standards/blob/v7.0.0/docs/usage/adoption.md).\n",
      "standards.yaml":
        'format: repo-standards/v2\nrequires:\n  repo-standards: ">=7.0.0"\n',
      ...developmentDocuments("7.0.0"),
      ...documents,
    },
    "release",
  );
  repository.git(
    "tag",
    "--annotate",
    "v1.0.0",
    "--message",
    "Repo Canon v1.0.0",
  );
  repository.git(
    "tag",
    "--annotate",
    "v1.0.1",
    "--message",
    "Repo Canon v1.0.1",
  );
  repository.git("tag", "v1.0.2");
  repository.git("push", "--quiet", "origin", "v1.0.0", "v1.0.1", "v1.0.2");
  const environment = {
    STUB_RELEASE: JSON.stringify({ isDraft: false, isPrerelease: false }),
    STUB_RESOLVED_COMMIT: releaseCommit,
    STUB_RELEASES: JSON.stringify([
      [
        { tag_name: "v1.0.0", draft: false, prerelease: false },
        { tag_name: "v0.99.0", draft: true, prerelease: false },
      ],
      [
        { tag_name: "v0.9.0", draft: false, prerelease: false },
        { tag_name: "v0.8.0", draft: false, prerelease: false },
        { tag_name: "v0.10.0", draft: false, prerelease: true },
        { tag_name: "v0.11.0-rc.1", draft: false, prerelease: false },
      ],
    ]),
    STUB_PREVIOUS_COMMIT: previousCommit,
  };
  return { ...repository, releaseCommit, environment };
}

test("release:verify passes a published release that agrees with its commit", (t) => {
  const { run, releaseCommit, environment } = publishedRelease(t);

  const { status, output } = run(
    "verify.mjs",
    ["v1.0.0", releaseCommit],
    environment,
  );

  assert.equal(status, 0, output);
  assert.match(output, /pass: tag v1\.0\.0 peels to/);
  assert.match(
    output,
    /pass: GitHub release v1\.0\.0 is neither a draft nor a prerelease/,
  );
  for (const profile of ["standard", "factory", "workbench"])
    assert.match(
      output,
      new RegExp(
        `pass: CLI 7\\.0\\.0 inspected v1\\.0\\.0 in a disposable repository .* with the ${profile} profile`,
      ),
    );
  for (const profile of ["standard", "factory"])
    assert.match(
      output,
      new RegExp(
        `pass: CLI 7\\.0\\.0 adopted v1\\.0\\.0 with the ${profile} profile into a fixture repository ` +
          "through adopt with an answers file; status reports the run ready to commit, with remote setup " +
          "github-repository-configuration/canonical-labels and " +
          "github-repository-configuration/pull-request-integration deferred\\.",
      ),
    );
  assert.match(
    output,
    /pass: CLI 7\.0\.0 adopted v1\.0\.0 with the workbench profile into a fixture repository through adopt with an answers file; status reports the run ready to commit, with no remote setup, rules or \.github file\./,
  );
  assert.match(
    output,
    /pass: the public copy at the release commit names no Repo Canon version and its README no CLI version, and every CLI version the adoption guide and the development and authoring documents name is the required minimum 7\.0\.0\./,
  );
});

test("release:verify updates from the previous stable release per profile using the newest CLI", (t) => {
  const { status, output, calls } = verifyAdoption(t, "complete");

  assert.equal(status, 0, output);
  for (const profile of ["standard", "factory"]) {
    assert.match(
      output,
      new RegExp(
        `pass: CLI 6\\.0\\.0 adopted v0\\.9\\.0; CLI 10\\.0\\.0 updated to v1\\.0\\.0 with the ${profile} profile.*outcome complete`,
      ),
    );
  }
  assert.match(
    output,
    /Adopter action: Exact update: the run asks for no contextual work\./,
  );
  assert.match(
    output,
    /skip: v0\.9\.0 declares no workbench profile, so no workbench adoption precedes v1\.0\.0 to update\./,
  );
  assert.equal(
    calls.filter(
      (answers) =>
        answers.version === "v0.9.0" &&
        answers.inspection === "sha256:complete",
    ).length,
    2,
  );
});

test("release:verify updates the workbench profile once the previous release declares it", (t) => {
  const { status, output, calls } = verifyAdoption(t, "complete", {}, [
    "standard",
    "factory",
    "workbench",
  ]);

  assert.equal(status, 0, output);
  assert.match(
    output,
    /pass: CLI 6\.0\.0 adopted v0\.9\.0; CLI 10\.0\.0 updated to v1\.0\.0 with the workbench profile; questions none; outcome complete, ready to commit with no remote setup\./,
  );
  assert.doesNotMatch(output, /skip:/);
  const workbench = calls.find(
    (answers) => answers.update && answers.profile === "workbench",
  );
  assert.deepEqual(workbench.args, ["adopt", "--json"]);
});

for (const scenario of ["questions", "fallback-scope"]) {
  test(`release:verify answers renewed scope, new discovery and remote setup questions (${scenario})`, (t) => {
    const { status, output, calls } = verifyAdoption(t, "complete", {
      FAKE_UPDATE: scenario,
    });
    assert.equal(status, 0, output);
    for (const id of [
      "scope:documentation",
      "scope:typescript-node-stack",
      "scope:typescript-astro-stack",
      "scope:typescript-vite-stack",
      "remote-setup",
      "assessment:repository-readme",
    ])
      assert.match(output, new RegExp(id));
    const submitted = calls.filter(
      (entry) =>
        entry["scope:documentation"] &&
        entry["scope:typescript-node-stack"] &&
        entry["scope:typescript-astro-stack"] &&
        entry["scope:typescript-vite-stack"] &&
        entry["remote-setup"] === "defer" &&
        entry.inspection === "sha256:update",
    );
    assert.equal(
      submitted.length,
      2,
      "one scope and deferral submission per profile",
    );
    for (const entry of submitted) {
      assert.equal(
        entry["scope:documentation"].coverage,
        "The previous adoption scope, proposed for validation.",
      );
      for (const stack of ["node", "astro", "vite"])
        assert.equal(entry[`scope:typescript-${stack}-stack`].noScope, true);
      if (scenario === "fallback-scope")
        assert.deepEqual(entry["scope:project-readmes"].candidates, []);
    }
  });
}

for (const scenario of ["contextual", "extra-assessment"]) {
  test(`release:verify submits requested contextual assessments (${scenario}) and requires completion`, (t) => {
    const { status, output, calls } = verifyAdoption(t, "complete", {
      FAKE_UPDATE: scenario,
    });
    assert.equal(status, 0, output);
    assert.match(
      output,
      /outcome complete.*Adopter action: Contextual update: the run asks for contextual work on repository-readme/,
    );
    assert.equal(calls.filter((entry) => entry.update).length, 2);
    const submitted = calls.filter(
      (entry) =>
        entry["assessment:repository-readme"] &&
        Object.keys(entry).length === (scenario === "extra-assessment" ? 2 : 1),
    );
    assert.equal(submitted.length, 2, "one assessment submission per profile");
    if (scenario === "extra-assessment") {
      for (const entry of submitted)
        assert.deepEqual(
          entry["assessment:documentation"],
          adoptionAssessments.documentation,
        );
    }
  });
}

test("release:verify reports a stopped update's quota reason and retry time", (t) => {
  const { status, output } = verifyAdoption(t, "complete", {
    FAKE_UPDATE: "quota",
  });
  assert.equal(status, 1, output);
  assert.match(
    output,
    /the update stopped with outcome blocked; missing none\. The GitHub API quota is exhausted\. Retry at 2026-10-24T20:00:00Z\./,
  );
});

test("release:verify reports a stopped update without optional cause fields", (t) => {
  const { status, output } = verifyAdoption(t, "complete", {
    FAKE_UPDATE: "no-cause",
  });
  assert.equal(status, 1, output);
  assert.match(
    output,
    /the update stopped with outcome blocked; missing none\./,
  );
  assert.doesNotMatch(output, /undefined|TypeError/);
});

test("release:verify preserves blockers, failed checks and the update stop reason together", (t) => {
  const { status, output } = verifyAdoption(t, "complete", {
    FAKE_UPDATE: "all-diagnostics",
  });
  assert.equal(status, 1, output);
  assert.match(output, /outcome blocked; missing scope:documentation\./);
  assert.match(output, /A blocker\./);
  assert.match(output, /A failed check\./);
  assert.match(output, /The update could not continue\./);
});

for (const [scenario, message] of /** @type {[string, RegExp][]} */ ([
  ["rejected-scope", /CLI rejected the scope answer/],
  ["scope-repeat", /stopped again after answering scope:documentation/],
  ["question", /unexpected question surprise:documentation/],
  ["confirmation", /confirmation-required change/],
  ["blocked", /the update has blockers or failed checks:.*A blocker\./],
  [
    "failed-checks",
    /the update has blockers or failed checks:.*A failed check\./,
  ],
  ["missing-assessment", /stopped with outcome contextual/],
  ["nonzero", /the complete update exited 1/],
  ["not-ready", /status does not report the run ready to commit/],
  ["undeferred", /status does not list remote setup/],
  ["wrong-version", /the update selected/],
  ["wrong-commit", /the ready status does not identify the verified release/],
  ["missing-line", /did not report a derived adopter-action line/],
])) {
  test(`release:verify fails an update with ${scenario}`, (t) => {
    const { status, output, calls } = verifyAdoption(t, "complete", {
      FAKE_UPDATE: scenario,
    });
    assert.notEqual(status, 0, output);
    assert.match(output, message);
    assert.equal(calls.filter((entry) => entry.update).length, 2);
    assert.ok(
      !calls.some(
        (entry) =>
          entry["assessment:repository-readme"] &&
          Object.keys(entry).length === 1,
      ),
      "never answers unexpected stops",
    );
  });
}

test("release:verify fails if submitting the named contextual assessments does not complete", (t) => {
  const { status, output } = verifyAdoption(t, "complete", {
    FAKE_UPDATE: "contextual-repeat",
  });
  assert.notEqual(status, 0, output);
  assert.match(
    output,
    /stopped again after answering assessment:repository-readme/,
  );
});

test("release:verify fails when no previous stable release is published", (t) => {
  const { status, output } = verifyAdoption(t, "complete", {
    STUB_RELEASES: "[]",
  });
  assert.notEqual(status, 0, output);
  assert.match(output, /no published stable release precedes v1\.0\.0/);
});

// Runs release:verify of v1.0.0 with the fake adoption's scenario, and returns
// its result with the answers of each adopt call. The previous release declares
// `previousProfiles`, by default the standard and factory profiles.
function verifyAdoption(t, scenario, overrides = {}, previousProfiles) {
  const { run, releaseCommit, environment } = publishedRelease(
    t,
    {},
    previousProfiles,
  );
  const log = join(
    mkdtempSync(join(tmpdir(), "repo-canon-adopt-log-")),
    "answers.jsonl",
  );
  t.after(() => rmSync(dirname(log), { recursive: true, force: true }));
  writeFileSync(log, "");
  const result = run("verify.mjs", ["v1.0.0", releaseCommit], {
    ...environment,
    FAKE_ADOPT: scenario,
    FAKE_ADOPT_LOG: log,
    ...overrides,
  });
  const calls = readFileSync(log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return { ...result, calls };
}

test("release:verify adopts the release with the verified version, the drafted scope, and deferred remote setup", (t) => {
  const { status, output, calls } = verifyAdoption(t, "complete");

  assert.equal(status, 0, output);
  const started = calls.filter(
    (answers) =>
      answers.inspection === "sha256:complete" && answers.version === "v1.0.0",
  );
  assert.equal(started.length, 3, "one start per profile");
  for (const answers of started.filter(
    ({ profile }) => profile !== "workbench",
  )) {
    assert.equal(answers.version, "v1.0.0");
    assert.equal(answers["remote-setup"], "defer");
    assert.equal(
      answers["scope:documentation"].coverage,
      "Drafted from the repository tree.",
    );
  }
  assert.deepEqual(
    started.map((answers) => answers.profile),
    ["standard", "factory", "workbench"],
  );
  assert.deepEqual(
    Object.keys(started[2]).sort(),
    ["inspection", "profile", "version"],
    "the workbench adoption answers no scope, remote setup or assessment",
  );
  const factory = started.find((answers) => answers.profile === "factory");
  assert.deepEqual(factory["scope:factory-workflow"].candidates, []);
  assert.deepEqual(factory["scope:factory-workflow"].unresolved, []);
  assert.ok(calls.some((answers) => answers["assessment:factory-workflow"]));
  assert.ok(!started[0]["scope:factory-workflow"]);
  assert.ok(
    calls.some((answers) => answers["assessment:factory-sandbox-image"]),
    "the factory adoption assesses the toolchain image",
  );
});

test("release:verify fails an adoption that an inspection blocker stops", (t) => {
  const { status, output } = verifyAdoption(t, "blocked");

  assert.notEqual(status, 0);
  for (const profile of ["standard", "factory", "workbench"])
    assert.match(
      output,
      new RegExp(
        `fail: the ${profile} adoption of v1\\.0\\.0 failed: the adoption is blocked: The project has uncommitted changes\\.`,
      ),
    );
});

test("release:verify fails, without starting, an adoption that would apply remote setup", (t) => {
  const { status, output, calls } = verifyAdoption(t, "undeferred");

  assert.notEqual(status, 0);
  assert.match(
    output,
    /fail: the standard adoption of v1\.0\.0 failed: the inspection offers no deferral of remote setup github-repository-configuration\/pull-request-integration; starting would apply it\./,
  );
  // The workbench profile has no remote setup and no file to replace.
  assert.ok(
    calls
      .filter(({ profile }) => profile !== "workbench")
      .every((answers) => answers.inspection !== "sha256:complete"),
  );
});

test("release:verify fails an adoption that asks to confirm a confirmation-required change", (t) => {
  const { status, output, calls } = verifyAdoption(t, "confirmation");

  assert.notEqual(status, 0);
  assert.match(
    output,
    /fail: the standard adoption of v1\.0\.0 failed: the run asks to confirm a confirmation-required change \(confirmation\): The run replaces README\.md, discarding its edits\./,
  );
  assert.ok(calls.every((answers) => !answers.confirmation));
  // The workbench profile has no remote setup and no file to replace.
  assert.ok(
    calls
      .filter(({ profile }) => profile !== "workbench")
      .every((answers) => answers.inspection !== "sha256:complete"),
  );
});

test("release:verify fails an adoption whose checks fail after the assessment", (t) => {
  const { status, output } = verifyAdoption(t, "failed-checks");

  assert.notEqual(status, 0);
  assert.match(
    output,
    /fail: the standard adoption of v1\.0\.0 failed: the run's checks failed: repository-readme\/repository-readme-structure: Make the Repository README description after its title one sentence\./,
  );
});

test("release:verify fails a draft or prerelease", (t) => {
  const { run, releaseCommit, environment } = publishedRelease(t);

  const { status, output } = run("verify.mjs", ["v1.0.0", releaseCommit], {
    ...environment,
    STUB_RELEASE: JSON.stringify({ isDraft: true, isPrerelease: true }),
  });

  assert.notEqual(status, 0);
  assert.match(
    output,
    /fail: GitHub release v1\.0\.0 is a draft and a prerelease/,
  );
});

test("release:verify fails when the tag does not peel to the release commit", (t) => {
  const { run, commit, environment } = publishedRelease(t);
  const later = commit({ "notes.md": "later\n" }, "later");

  const { status, output } = run("verify.mjs", ["v1.0.0", later], {
    ...environment,
    STUB_RESOLVED_COMMIT: later,
  });

  assert.notEqual(status, 0);
  assert.match(
    output,
    /fail: tag v1\.0\.0 on origin peels to [0-9a-f]{40}, not the release commit/,
  );
});

test("release:verify fails a lightweight tag", (t) => {
  const { run, releaseCommit, environment } = publishedRelease(t);

  const { status, output } = run(
    "verify.mjs",
    ["v1.0.2", releaseCommit],
    environment,
  );

  assert.notEqual(status, 0);
  assert.match(output, /fail: tag v1\.0\.2 on origin is not an annotated tag/);
});

test("release:verify fails when the public copy names a Repo Canon or CLI version", (t) => {
  const { run, releaseCommit, environment } = publishedRelease(t, {
    "README.md":
      "Select the [`v1.0.0` release](https://github.com/lutzseverino/repo-canon/releases/tag/v1.0.0) with CLI 7.0.0.\n",
    "docs/usage/adopt-repo-canon.md":
      "This guide selects `v1.0.0` with public CLI 7.0.0.\n",
  });

  const { status, output } = run(
    "verify.mjs",
    ["v1.0.0", releaseCommit],
    environment,
  );

  assert.notEqual(status, 0);
  assert.match(
    output,
    /fail: README\.md:1 names Repo Canon v1\.0\.0; the public copy names no Repo Canon version\./,
  );
  assert.match(
    output,
    /fail: README\.md:1 names CLI 7\.0\.0; the Repository README names no CLI version\./,
  );
  assert.match(
    output,
    /fail: docs\/usage\/adopt-repo-canon\.md:1 names Repo Canon v1\.0\.0; the public copy names no Repo Canon version\./,
  );
});

test("release:verify fails when the adoption guide names another CLI version", (t) => {
  const { run, releaseCommit, environment } = publishedRelease(t, {
    "docs/usage/adopt-repo-canon.md":
      "See the CLI's [adoption guide](https://github.com/lutzseverino/repo-standards/blob/v7.1.0/docs/usage/adoption.md).\n",
  });

  const { status, output } = run(
    "verify.mjs",
    ["v1.0.0", releaseCommit],
    environment,
  );

  assert.notEqual(status, 0);
  assert.match(
    output,
    /fail: docs\/usage\/adopt-repo-canon\.md:1 names CLI 7\.1\.0, not the standards\.yaml floor 7\.0\.0\./,
  );
});

test("release:verify fails when a development or authoring document names another CLI version", (t) => {
  const { "docs/development/source-profile.md": sourceProfile } =
    developmentDocuments("7.1.0");
  const { run, releaseCommit, environment } = publishedRelease(t, {
    "docs/development/source-profile.md": sourceProfile,
  });

  const { status, output } = run(
    "verify.mjs",
    ["v1.0.0", releaseCommit],
    environment,
  );

  assert.notEqual(status, 0);
  assert.match(output, /pass: CLI 7\.0\.0 inspected v1\.0\.0/);
  assert.match(
    output,
    /fail: docs\/development\/source-profile\.md:1 names CLI 7\.1\.0, not the standards\.yaml floor 7\.0\.0\./,
  );
});

test("release:verify fails an inspection that does not resolve the release commit or uses another CLI", (t) => {
  const { run, releaseCommit, environment } = publishedRelease(t);

  const { status, output } = run("verify.mjs", ["v1.0.0", releaseCommit], {
    ...environment,
    STUB_RESOLVED_COMMIT: "e".repeat(40),
    STUB_CLI_VERSION: "7.1.0",
  });

  assert.notEqual(status, 0);
  assert.match(output, /fail: .*resolved commit e{40}, not the release commit/);
  assert.match(
    output,
    /fail: .*used CLI 7\.1\.0, not the required minimum 7\.0\.0/,
  );
});

test("release:verify rejects a version that is not a stable release tag", (t) => {
  const { run, releaseCommit, environment } = publishedRelease(t);

  const { status, output } = run(
    "verify.mjs",
    ["v1.0.0-rc.1", releaseCommit],
    environment,
  );

  assert.notEqual(status, 0);
  assert.match(
    output,
    /v1\.0\.0-rc\.1 is not a stable release version such as v1\.2\.3/,
  );
});

// Every declaration with adoption guidance is assessed during adoption, in
// one profile or both, so the fixture answers each of them.
test("the adoption fixture assesses every declaration with adoption guidance", () => {
  const lines = readFileSync(
    join(scripts, "../../standards.yaml"),
    "utf8",
  ).split("\n");
  const assessed = [];
  let declaration = null;
  for (const [index, line] of lines.entries()) {
    const name = line.match(/^\s+([a-z0-9-]+):$/)?.[1];
    if (name && /^\s+kind: /.test(lines[index + 1] ?? "")) declaration = name;
    if (/^\s+guidance: /.test(line)) assessed.push(declaration);
  }
  assert.ok(assessed.includes("project-agent-guidance"));
  assert.deepEqual(Object.keys(adoptionAssessments).sort(), assessed.sort());
});

// The real adoption runs only after publication, so the fixture is checked
// here against the shipped drafter and checks: the documentation draft of each
// profile has no open questions, and once the exact files are installed, every
// contextual check passes with the drafted and the fixture's empty scopes.
test("the adoption fixture passes the shipped contextual checks with its drafted scope", (t) => {
  const sourceRoot = resolve(scripts, "../..");
  const project = mkdtempSync(join(tmpdir(), "repo-canon-adoption-fixture-"));
  t.after(() => rmSync(project, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(adoptionFixture)) {
    mkdirSync(dirname(join(project, path)), { recursive: true });
    writeFileSync(join(project, path), content);
  }

  const drafts = ["standard", "factory"].map((profile) => {
    const child = spawnSync(
      process.execPath,
      [join(sourceRoot, "discovery/draft-documentation-scope.mjs")],
      {
        cwd: project,
        encoding: "utf8",
        input: JSON.stringify({
          format: "repo-standards/discovery/v1",
          declaration: "documentation",
          projectRoot: project,
          standards: {
            repository: "https://github.com/lutzseverino/repo-canon",
            version: "v0.0.0-test",
            commit: "0".repeat(40),
          },
          profile,
        }),
      },
    );
    assert.equal(child.status, 0, child.stderr);
    const [entry] = JSON.parse(child.stdout).declarations;
    assert.deepEqual(entry.unresolved, [], profile);
    return entry.candidates
      .filter((candidate) => candidate.decision === "include")
      .map((candidate) => candidate.path)
      .sort();
  });
  assert.deepEqual(drafts[0], drafts[1]);
  assert.deepEqual(drafts[0], ["docs/README.md", "docs/development/README.md"]);
  // Every stack drafts no scope in the release fixture.
  for (const kind of ["node", "astro", "vite"]) {
    const stack = spawnSync(
      process.execPath,
      [join(sourceRoot, `discovery/draft-typescript-${kind}-stack-scope.mjs`)],
      {
        cwd: project,
        encoding: "utf8",
        input: JSON.stringify({
          format: "repo-standards/discovery/v1",
          declaration: `typescript-${kind}-stack`,
          projectRoot: project,
        }),
      },
    );
    assert.equal(stack.status, 0, stack.stderr);
    const [stackEntry] = JSON.parse(stack.stdout).declarations;
    assert.equal(stackEntry.noScope, true);
    assert.deepEqual(stackEntry.candidates, []);
    assert.deepEqual(stackEntry.unresolved, []);
  }

  for (const [target, source] of exactFiles()) {
    mkdirSync(dirname(join(project, target)), { recursive: true });
    cpSync(join(sourceRoot, source), join(project, target), {
      recursive: true,
    });
  }
  for (const [
    script,
    declaration,
    id,
    paths,
    declarations,
  ] of /** @type {[string, string, string, string[], object[]][]} */ ([
    [
      "check-documentation.mjs",
      "documentation",
      "documentation-navigation",
      drafts[0],
      fileDeclarations(),
    ],
    [
      "check-repository-readme.mjs",
      "repository-readme",
      "repository-readme-structure",
      ["README.md"],
      [],
    ],
    [
      "check-project-readmes.mjs",
      "project-readmes",
      "project-readme-structure",
      [],
      [],
    ],
    [
      "check-pull-request-reviewer.mjs",
      "github-repository-configuration",
      "pull-request-reviewer",
      [],
      [],
    ],
  ])) {
    const outcome = invokeCheck(
      join(sourceRoot, "operations", script),
      project,
      {
        operation: { declaration, phase: "checks", id },
        declarations,
        allowedTargets: { paths, directories: [] },
      },
    );
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(
      outcome.result.status,
      "passed",
      `${script}: ${outcome.result.message}`,
    );
  }
});
