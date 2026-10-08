import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fixture, invokeOperation, snapshot } from "./operation.mjs";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export const fakeNodeVersion = join(
  repositoryRoot,
  "test/fixtures/fake-node-version.mjs",
);

// The GitHub operations under test: the script, the stateful GitHub CLI
// fixture that answers its endpoints, its operation as `standards.yaml`
// declares it, and the remote state the fixture starts from.
export const githubLabelSetup = {
  script: join(repositoryRoot, "operations/setup-github-labels.mjs"),
  fakeGh: join(repositoryRoot, "test/fixtures/fake-gh.mjs"),
  operation: {
    declaration: "github-repository-configuration",
    phase: "fixes",
    id: "canonical-labels",
  },
  state: { labels: [] },
};

export const githubPrIntegrationSetup = {
  script: join(repositoryRoot, "operations/setup-github-pr-integration.mjs"),
  fakeGh: join(repositoryRoot, "test/fixtures/fake-gh-pr-settings.mjs"),
  operation: {
    declaration: "github-repository-configuration",
    phase: "fixes",
    id: "pull-request-integration",
  },
  state: {
    settings: {
      allow_squash_merge: false,
      allow_merge_commit: true,
      allow_rebase_merge: true,
      squash_merge_commit_title: "COMMIT_OR_PR_TITLE",
      squash_merge_commit_message: "COMMIT_MESSAGES",
      delete_branch_on_merge: true,
    },
    branchProtection: null,
    rulesets: [],
  },
};

export function operationRequest(projectRoot, operation, overrides = {}) {
  return {
    format: "repo-standards/operation/v1",
    operation,
    projectRoot,
    standards: {
      repository: "https://github.com/lutzseverino/repo-canon",
      version: "v0.0.0-test",
      commit: "0000000000000000000000000000000000000000",
    },
    profile: "complete",
    declarations: [],
    allowedTargets: { paths: [], directories: [] },
    ...overrides,
  };
}

// A disposable project with Git remotes and a `gh` on PATH that answers from a
// state file, so a GitHub operation runs without contacting GitHub.
export function setup(t, subject, options = {}) {
  const project = fixture({ "README.md": "# Fixture\n" });
  t.after(project.close);
  for (const [name, url] of Object.entries(
    options.remotes ?? { origin: "git@github.com:acme/widgets.git" },
  )) {
    execFileSync("git", ["remote", "add", name, url], { cwd: project.root });
  }
  for (const [name, url] of Object.entries(options.pushUrls ?? {})) {
    execFileSync("git", ["remote", "set-url", "--add", "--push", name, url], {
      cwd: project.root,
    });
  }

  const toolsRoot = mkdtempSync(join(tmpdir(), "repo-canon-github-tools-"));
  t.after(() => rmSync(toolsRoot, { recursive: true, force: true }));
  chmodSync(subject.fakeGh, 0o755);
  symlinkSync(subject.fakeGh, join(toolsRoot, "gh"));
  const statePath = join(toolsRoot, "state.json");
  writeFileSync(
    statePath,
    `${JSON.stringify({
      repo: "acme/widgets",
      authenticated: true,
      ...subject.state,
      ...options.state,
    })}\n`,
  );
  const env = {
    PATH: `${toolsRoot}:${dirname(process.execPath)}:/usr/bin:/bin`,
    FAKE_GH_STATE: statePath,
  };
  const invoke = (
    requestOverrides = {},
    envOverrides = {},
    nodeArguments = [],
  ) =>
    invokeOperation(
      subject.script,
      operationRequest(project.root, subject.operation, requestOverrides),
      { env: { ...env, ...envOverrides }, nodeArguments },
    );
  return {
    project,
    toolsRoot,
    invoke,
    readState: () => JSON.parse(readFileSync(statePath, "utf8")),
    updateState: (changes) =>
      writeFileSync(
        statePath,
        `${JSON.stringify({
          ...JSON.parse(readFileSync(statePath, "utf8")),
          ...changes,
        })}\n`,
      ),
  };
}

export function assertProjectUnchanged(before, scenario) {
  assert.deepEqual(
    snapshot(scenario.project.root),
    before,
    "remote setup must not change project content",
  );
}
