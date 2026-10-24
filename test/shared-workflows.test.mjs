import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repositoryRoot = new URL("..", import.meta.url).pathname;

function sharedWorkflows() {
  const profile = readFileSync(join(repositoryRoot, "standards.yaml"), "utf8");
  return [
    ...profile.matchAll(/^\s+exact: (\.github\/workflows\/\S+\.ya?ml)$/gm),
  ].map(([, path]) => path);
}

function workflow(path) {
  return readFileSync(join(repositoryRoot, path), "utf8");
}

function actionPins(workflow, action) {
  return [...workflow.matchAll(new RegExp(`uses: ${action}@(\\S+)`, "g"))].map(
    ([, pin]) => pin,
  );
}

test("every installed workflow job selects repository runner labels with the hosted default", () => {
  const expected =
    "${{ vars.REPO_CANON_RUNS_ON && fromJSON(vars.REPO_CANON_RUNS_ON) || 'ubuntu-latest' }}";
  for (const path of sharedWorkflows()) {
    const jobs = workflow(path).match(
      /^jobs:\n([\s\S]*?)(?=^\S|$(?![\s\S]))/m,
    )?.[1];
    assert.ok(jobs, `${path} declares jobs`);
    const blocks = jobs.split(/(?=^ {2}\S)/m).filter((block) => block.trim());
    assert.ok(blocks.length > 0, `${path} declares at least one job`);
    for (const block of blocks) {
      const job = block.split("\n", 1)[0].trim();
      const runners = [...block.matchAll(/^ {4}runs-on: (.*)$/gm)].map(
        ([, value]) => value,
      );
      assert.deepEqual(runners, [expected], `${path}: ${job}`);
    }
  }
});

test("shared workflows pin the same checkout and setup-node versions when used", () => {
  const paths = sharedWorkflows();
  for (const expected of [
    ".github/workflows/issue-contracts.yml",
    ".github/workflows/pr-metadata.yml",
    ".github/workflows/standards-update.yml",
    ".github/workflows/sandbox-image.yml",
  ]) {
    assert.ok(paths.includes(expected), `standards.yaml declares ${expected}`);
  }

  for (const action of ["actions/checkout", "actions/setup-node"]) {
    const pins = new Set();
    for (const path of paths) {
      const workflowPins = actionPins(workflow(path), action);
      if (action === "actions/checkout")
        assert.ok(workflowPins.length > 0, `${path} uses ${action}`);
      for (const pin of workflowPins) {
        assert.match(
          pin,
          /^[0-9a-f]{40}$/,
          `${path} pins ${action} to a full commit`,
        );
        pins.add(pin);
      }
    }
    assert.equal(
      pins.size,
      1,
      `${action} pins differ: ${[...pins].join(", ")}`,
    );
  }
});

test("every shared workflow disables package-manager caching", () => {
  for (const path of sharedWorkflows()) {
    const text = workflow(path);
    if (actionPins(text, "actions/setup-node").length > 0)
      assert.match(text, /package-manager-cache: false/, path);
    assert.doesNotMatch(text, /npm (?:ci|install)/, path);
  }
});

test("every installed action has a full commit pin and release tag comment", () => {
  for (const path of sharedWorkflows()) {
    for (const [line] of workflow(path).matchAll(/^\s+uses: .+$/gm))
      assert.match(line, /@[0-9a-f]{40} # v\d+(?:\.\d+)*\s*$/, path);
  }
});

test("standards updates run daily or manually only after opt-in, with serialized writes", () => {
  const text = workflow(".github/workflows/standards-update.yml");
  assert.match(
    text,
    /^on:\n {2}schedule:\n {4}- cron: "\d+ \d+ \* \* \*"\n {2}workflow_dispatch:\n/m,
  );
  assert.deepEqual(
    [...text.matchAll(/^ {2}([a-z-]+):\n {4}name:/gm)].map(([, job]) => job),
    ["update"],
  );
  assert.match(text, /^ {4}if: vars\.REPO_CANON_UPDATES == 'true'$/m);
  assert.match(
    text,
    /^concurrency:\n {2}group: standards-update\n {2}cancel-in-progress: false$/m,
  );
  assert.deepEqual(
    [...text.matchAll(/^ {6}([a-z-]+): (write|read|none)$/gm)]
      .map(([, permission, access]) => [permission, access])
      .sort(),
    [
      ["contents", "write"],
      ["issues", "write"],
      ["pull-requests", "write"],
    ],
  );
  assert.match(text, /^permissions: \{\}$/m);
  assert.match(
    text,
    /^ {4}permissions:\n {6}contents: write\n {6}pull-requests: write\n {6}issues: write$/m,
  );
  assert.equal([...text.matchAll(/^\s*permissions:/gm)].length, 2);
  assert.match(
    text,
    /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/,
  );
  assert.match(text, /persist-credentials: false/);
});

test("standards updates use an App token only with both credentials, else the workflow token", () => {
  const text = workflow(".github/workflows/standards-update.yml");
  assert.match(
    text,
    /HAS_UPDATE_APP_PRIVATE_KEY: \$\{\{ secrets\.REPO_CANON_UPDATE_APP_PRIVATE_KEY != '' \}\}/,
  );
  assert.match(
    text,
    /id: app-token\n\s+if: vars\.REPO_CANON_UPDATE_APP_CLIENT_ID != '' && env\.HAS_UPDATE_APP_PRIVATE_KEY == 'true'\n\s+uses: actions\/create-github-app-token@64ab729a6294000f5aa4a4bc0b73d1f32bc45510 # v3\.3\.0\n\s+with:\n\s+client-id: \$\{\{ vars\.REPO_CANON_UPDATE_APP_CLIENT_ID \}\}\n\s+private-key: \$\{\{ secrets\.REPO_CANON_UPDATE_APP_PRIVATE_KEY \}\}/,
  );
  const appToken = text
    .split("uses: actions/create-github-app-token@")[1]
    .split("- name:")[0];
  assert.deepEqual(
    [...appToken.matchAll(/^ {10}permission-([a-z-]+): (\S+)$/gm)]
      .map(([, permission, access]) => [permission, access])
      .sort(),
    [
      ["contents", "write"],
      ["issues", "write"],
      ["pull-requests", "write"],
      ["workflows", "write"],
    ],
  );
  const token = "token: ${{ steps.app-token.outputs.token || github.token }}";
  assert.ok(
    text.indexOf("id: app-token") < text.indexOf("uses: actions/checkout@"),
  );
  const checkout = text.split("uses: actions/checkout@")[1].split("- name:")[0];
  assert.ok(checkout.includes(token));
  assert.ok(
    text.endsWith(
      `uses: lutzseverino/repo-standards@8ae21e7fec4492397640ed459dfd7a8a4ad6f251 # v10.0.0\n        with:\n          ${token}\n`,
    ),
  );
  assert.doesNotMatch(text, /agent-command:/);
});

test("the pull request metadata workflow runs on every configured pull request update from the trusted base revision", () => {
  const text = workflow(".github/workflows/pr-metadata.yml");
  assert.deepEqual(
    text
      .match(/types:\s*\[([^\]]+)]/)?.[1]
      .split(",")
      .map((type) => type.trim()),
    ["opened", "edited", "synchronize", "reopened", "ready_for_review"],
  );
  assert.match(text, /pull_request_target:/);
  assert.match(text, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(text, /persist-credentials: false/);
  assert.doesNotMatch(text, /pull_request\.head\.(?:sha|ref)/);
  assert.doesNotMatch(text, /(?:issues|pull-requests):\s*write/);
});

// The expressions a workflow interpolates anywhere, with index syntax such as
// `github['event']` rewritten to property syntax. Reading the whole file, not
// only `run:` values, also covers anchors, aliases, and multi-line scalars.
function expressions(text) {
  return [...text.matchAll(/\$\{\{([\s\S]*?)\}\}/g)].map(([, expression]) =>
    expression.replace(/\s*\[\s*(['"])([^'"]*)\1\s*\]/g, ".$2"),
  );
}

test("no shared workflow interpolates a pull request title or body, so neither reaches a run step", () => {
  const untrustedText =
    /github\.event(?:\.pull_request)?(?:\.(?:title|body)\b|\s*(?:[),]|$))/;
  for (const path of sharedWorkflows())
    for (const expression of expressions(workflow(path)))
      assert.doesNotMatch(expression, untrustedText, `${path}: ${expression}`);
});

test("the issue contract workflow covers issue and comment changes using default-branch code", () => {
  const text = workflow(".github/workflows/issue-contracts.yml");
  for (const activity of [
    "opened",
    "edited",
    "reopened",
    "closed",
    "labeled",
    "unlabeled",
    "created",
    "deleted",
  ]) {
    assert.match(text, new RegExp(`\\b${activity}\\b`));
  }
  assert.match(
    text,
    /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/,
  );
  assert.match(text, /issues: write/);
  assert.match(
    text,
    /group: issue-contract-\$\{\{ github\.event\.issue\.number \}\}/,
  );
  assert.match(text, /cancel-in-progress: false/);
  assert.doesNotMatch(text, /github\.event\.issue\.body/);
});
