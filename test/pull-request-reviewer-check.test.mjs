import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { readReviewer as readOperationReviewer } from "../operations/lib/pull-request-reviewer.mjs";
import { readReviewer as readInstalledReviewer } from "../.agents/skills/babysit/pull-request-reviewer.mjs";
import {
  fixture,
  invokeCheck,
  retainedCheck,
  snapshot,
} from "./helpers/operation.mjs";

const script = new URL(
  "../operations/check-pull-request-reviewer.mjs",
  import.meta.url,
).pathname;
const target = ".github/pull-request-reviewer.json";
const malformedCases = [
  { content: "{x", explanation: /Expected property name/ },
  { content: "", explanation: /Unexpected end of JSON input/ },
];
const valid = readFileSync(
  new URL("./fixtures/reviewers/github-review.json", import.meta.url),
  "utf8",
);
const request = {
  operation: {
    declaration: "github-repository-configuration",
    phase: "checks",
    id: "pull-request-reviewer",
  },
  allowedTargets: { paths: [], directories: [] },
};

const check = (t, files, executable = script) => {
  const project = fixture(files);
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(executable, project.root, request);
  assert.deepEqual(snapshot(project.root), before);
  return outcome;
};

test("both reviewer readers identify malformed JSON and retain the parse explanation", (t) => {
  for (const readReviewer of [readOperationReviewer, readInstalledReviewer]) {
    for (const { content, explanation } of malformedCases) {
      const project = fixture({ [target]: content });
      t.after(project.close);
      assert.throws(
        () => readReviewer(project.root),
        (error) => {
          assert.ok(error instanceof Error);
          assert.ok(error.message.includes(target), error.message);
          assert.match(error.message, explanation);
          return true;
        },
      );
    }
  }
});

test("both reviewer readers reject completion patterns that only compile inside a wrapper", (t) => {
  const reviewer = JSON.parse(valid);
  reviewer.finished = {
    commentMarker: "done",
    line: "x)(?<sha>[0-9a-f]+)(?<at>\\S+)(",
  };
  const project = fixture({ [target]: JSON.stringify(reviewer) });
  t.after(project.close);
  for (const readReviewer of [readOperationReviewer, readInstalledReviewer])
    assert.throws(
      () => readReviewer(project.root),
      /reviewer\.finished\.line must be a valid regular expression/,
    );
});

test("the optional reviewer check passes without a file", (t) => {
  const outcome = check(t, {});
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed");
});

test("the optional reviewer check passes a valid review-only file", (t) => {
  assert.equal(check(t, { [target]: valid }).result.status, "passed");
});

test("the optional reviewer check accepts a positive review request bound", (t) => {
  const reviewer = JSON.parse(valid);
  reviewer.bounds.reviewRequests = 4;
  assert.equal(
    check(t, { [target]: JSON.stringify(reviewer) }).result.status,
    "passed",
  );
});

test("the optional reviewer check rejects invalid review request bounds", (t) => {
  for (const reviewRequests of [0, -1, 1.5, "4", null, true, [], {}]) {
    const reviewer = JSON.parse(valid);
    reviewer.bounds.reviewRequests = reviewRequests;
    const outcome = check(t, { [target]: JSON.stringify(reviewer) });
    assert.equal(outcome.result.status, "failed");
    assert.match(
      outcome.result.message,
      /reviewRequests must be a positive integer/,
    );
  }
});

test("the optional reviewer check rejects invalid schema", (t) => {
  const outcome = check(t, {
    [target]: JSON.stringify({ ...JSON.parse(valid), version: 2 }),
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(outcome.result.message, /version/);
  assert.match(
    outcome.result.message,
    /match the github-repository-configuration rules/,
  );
  assert.doesNotMatch(outcome.result.message, /babysit/);
});

test("malformed reviewer JSON has an actionable validation correction", (t) => {
  for (const { content, explanation } of malformedCases) {
    const outcome = check(t, { [target]: content });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, "failed");
    assert.match(
      outcome.result.message,
      /Correct \.github\/pull-request-reviewer\.json/,
    );
    assert.match(outcome.result.message, explanation);
  }
});

test("reviewer validation works using only retained resources", (t) => {
  const retained = retainedCheck(
    t,
    "operations/check-pull-request-reviewer.mjs",
  );
  const codex = readFileSync(
    new URL("./fixtures/reviewers/codex.json", import.meta.url),
    "utf8",
  );
  assert.equal(check(t, { [target]: codex }, retained).result.status, "passed");
});

test("invalid field types and completion patterns fail with corrections", (t) => {
  const reviewer = JSON.parse(valid);
  const cases = [
    ["JSON", "{"],
    ["object", "null"],
    ["account", { ...reviewer, account: "" }],
    ["account", { ...reviewer, account: 12 }],
    ["unknown", { ...reviewer, executable: "script.sh" }],
    ["request", { ...reviewer, request: undefined }],
    ["onOpen", { ...reviewer, request: { comment: "review", onOpen: "true" } }],
    [
      "trimmed",
      { ...reviewer, request: { comment: " review ", onOpen: true } },
    ],
    ["unavailable", { ...reviewer, unavailable: "offline" }],
    ["unavailable", { ...reviewer, unavailable: [""] }],
    [
      "reviewMinutes",
      { ...reviewer, bounds: { responseMinutes: 2, reviewMinutes: "10" } },
    ],
    [
      "responseMinutes",
      { ...reviewer, bounds: { responseMinutes: -1, reviewMinutes: 10 } },
    ],
    [
      "commentMarker",
      { ...reviewer, finished: { commentMarker: "", line: "x" } },
    ],
    [
      "regular expression",
      { ...reviewer, finished: { commentMarker: "done", line: "[" } },
    ],
    [
      "reviewer.finished.line must be a valid regular expression",
      {
        ...reviewer,
        finished: {
          commentMarker: "done",
          line: "x)(?<sha>[0-9a-f]+)(?<at>\\S+)(",
        },
      },
    ],
    [
      "named sha and at",
      { ...reviewer, finished: { commentMarker: "done", line: "(?<sha>.*)" } },
    ],
    [
      "named sha and at",
      {
        ...reviewer,
        finished: {
          commentMarker: "done",
          line: "\\(\\?<sha>\\)\\(\\?<at>\\)",
        },
      },
    ],
  ];
  for (const [field, content] of cases) {
    const outcome = check(t, {
      [target]: typeof content === "string" ? content : JSON.stringify(content),
    });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, "failed", field);
    if (field !== "JSON")
      assert.ok(outcome.result.message.includes(field), outcome.result.message);
  }
});

test("Repo Canon keeps its own reviewer data outside standards ownership", () => {
  const sourceRoot = new URL("..", import.meta.url).pathname;
  const outcome = invokeCheck(script, sourceRoot, request);
  assert.equal(outcome.result.status, "passed", outcome.result.message);
  const configured = JSON.parse(
    readFileSync(
      new URL("../.github/pull-request-reviewer.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(configured.account, "chatgpt-codex-connector[bot]");
  const declarations = readFileSync(
    new URL("../standards.yaml", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(declarations, /pull-request-reviewer\.json/);
});
