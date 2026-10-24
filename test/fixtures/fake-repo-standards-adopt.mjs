// The `adopt` and `status` commands of a fake Repository Standards CLI, for
// release verification's fixture adoption. It walks the answers-file stages
// as the real `adopt` does: the template, the discovery scopes with the
// documentation and stack drafts proposed, the remote setup deferral and the inspection,
// the start, and the contextual assessments. `FAKE_ADOPT` selects a scenario:
// `complete` (the default), `blocked` (an inspection blocker), `undeferred`
// (a remote setup that is ready, so not offered for deferral),
// `confirmation` (a confirmation-required change), or `failed-checks`. Each
// call's answers are appended to `FAKE_ADOPT_LOG` when it is set.
import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const scenario = process.env.FAKE_ADOPT ?? "complete";
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const project = option("--project") ?? process.cwd();
const statePath = join(project, ".repo-standards/fake-run.json");
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, "utf8"))
  : null;
const save = (value) => {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(value));
};
const source = "https://github.com/lutzseverino/repo-canon";
const remoteSetup = ["canonical-labels", "pull-request-integration"].map(
  (id) => ({
    declaration: "github-repository-configuration",
    id,
    reason: "No unambiguous github.com repository was found in Git remotes.",
  }),
);
const draft = {
  coverage: "Drafted from the repository tree.",
  candidates: [
    {
      path: "docs/README.md",
      decision: "include",
      reason: "A file under the documentation root `docs`.",
      evidence: ["docs/README.md"],
    },
  ],
  unresolved: [],
};
const stackDraft = {
  coverage: "Drafted from manifests and workspace configuration.",
  candidates: [],
  unresolved: [],
  noScope: true,
};
const recordedDraft = {
  ...draft,
  coverage: "The previous adoption scope, proposed for validation.",
};
const drafts = { documentation: draft, "typescript-node-stack": stackDraft };

function print(report, status = 1) {
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exit(status);
}

function reject(message) {
  print({ valid: false, errors: [{ code: "FAKE_REJECTED", message }] });
}

if (args[0] === "status") {
  print(
    state?.phase === "complete"
      ? {
          format: "repo-standards/status/v9",
          readyToCommit: !(
            state.version === "v1.0.0" &&
            process.env.STUB_CLI_VERSION === "10.0.0" &&
            process.env.FAKE_UPDATE === "not-ready"
          ),
          readinessReasons: [],
          deferred:
            state.version === "v1.0.0" &&
            process.env.STUB_CLI_VERSION === "10.0.0" &&
            process.env.FAKE_UPDATE === "undeferred"
              ? []
              : state.deferred,
          selection: {
            cli: { version: process.env.STUB_CLI_VERSION },
            standards: {
              repository: source,
              version: state.version,
              commit:
                process.env.FAKE_UPDATE === "wrong-commit" &&
                process.env.STUB_CLI_VERSION === "10.0.0"
                  ? "0".repeat(40)
                  : process.env.STUB_RESOLVED_COMMIT,
            },
            profile: state.profile,
          },
          impact: {
            derived:
              process.env.FAKE_UPDATE === "missing-line" &&
              process.env.STUB_CLI_VERSION === "10.0.0"
                ? null
                : (state.line ??
                  "Exact update: the run asks for no contextual work."),
          },
        }
      : {
          format: "repo-standards/status/v9",
          readyToCommit: false,
          readinessReasons: ["No complete adoption is recorded."],
          deferred: [],
        },
    0,
  );
}

const answersPath = option("--answers");
const questions = answersPath
  ? JSON.parse(readFileSync(answersPath, "utf8")).questions
  : [];
const given = new Map(
  questions.map((question) => [question.id, question.answer]),
);
if (process.env.FAKE_ADOPT_LOG)
  appendFileSync(
    process.env.FAKE_ADOPT_LOG,
    `${JSON.stringify(Object.fromEntries(given))}\n`,
  );

const profile = state?.profile ?? given.get("profile") ?? null;
const discovered = [
  "documentation",
  "github-repository-configuration",
  "project-readmes",
  "typescript-node-stack",
  ...(profile === "factory" ? ["factory-workflow"] : []),
];
const report = (outcome, asked, rest = {}) => ({
  format:
    process.env.STUB_CLI_VERSION === "6.0.0"
      ? "repo-standards/adopt/v1"
      : "repo-standards/adopt/v2",
  outcome,
  selection: {
    cli: process.env.STUB_CLI_VERSION,
    source,
    version: state?.version ?? given.get("version") ?? "v9.9.9",
    profile,
  },
  missing: asked
    .filter((question) => question.answer === null)
    .map((question) => question.id),
  blockers: [],
  answers: {
    format: "repo-standards/answers/v1",
    source,
    questions: asked,
  },
  nextSteps: [],
  ...rest,
});

if (
  state?.phase === "complete" &&
  !answersPath &&
  process.env.STUB_CLI_VERSION === "10.0.0"
) {
  const count = execFileSync(
    "git",
    ["-C", project, "rev-list", "--count", "HEAD"],
    { encoding: "utf8" },
  ).trim();
  const dirty = execFileSync("git", ["-C", project, "status", "--porcelain"], {
    encoding: "utf8",
  }).trim();
  if (count !== "2" || dirty)
    reject("The previous adoption must be committed before the update.");
  if (args.join(" ") !== "adopt --json")
    reject("The update must start without flags or answers.");
  if (process.env.FAKE_ADOPT_LOG)
    appendFileSync(
      process.env.FAKE_ADOPT_LOG,
      JSON.stringify({ update: true, profile, args }) + "\n",
    );
  const updateScenario = process.env.FAKE_UPDATE ?? "complete";
  const line =
    updateScenario === "complete"
      ? "Exact update: the run asks for no contextual work."
      : "Contextual update: the run asks for contextual work on repository-readme, which needs review before it is committed.";
  save({
    ...state,
    phase: [
      "questions",
      "fallback-scope",
      "rejected-scope",
      "scope-repeat",
    ].includes(updateScenario)
      ? "update-questions"
      : ["contextual", "contextual-repeat", "extra-assessment"].includes(
            updateScenario,
          )
        ? "update-contextual"
        : "complete",
    version: "v1.0.0",
    line,
  });
  const rest = {
    selection: { cli: "10.0.0", source, version: "v1.0.0", profile },
    inspection: { summary: "## Adopter action\n\n" + line },
  };
  if (updateScenario === "blocked")
    print(
      report("blocked", [], { ...rest, blockers: [{ message: "A blocker." }] }),
    );
  if (
    ["questions", "fallback-scope", "rejected-scope", "scope-repeat"].includes(
      updateScenario,
    )
  ) {
    const asked = [
      {
        id: "scope:documentation",
        answer: recordedDraft,
        details: { unresolved: [], draft },
      },
      {
        id: "scope:typescript-node-stack",
        answer: stackDraft,
        details: { unresolved: [] },
      },
      { id: "remote-setup", answer: null, details: remoteSetup },
    ];
    if (updateScenario === "fallback-scope")
      asked.push({ id: "scope:project-readmes", answer: null });
    print(
      report(
        "answers-required",
        [
          { id: "version", answer: "v1.0.0" },
          { id: "profile", answer: profile },
          ...asked,
          { id: "inspection", answer: "sha256:update" },
        ],
        { ...rest, missing: asked.map((entry) => entry.id) },
      ),
    );
  }
  if (updateScenario === "confirmation" || updateScenario === "question")
    print(
      report(
        "answers-required",
        [
          {
            id:
              updateScenario === "confirmation"
                ? "confirmation"
                : "surprise:documentation",
            answer: null,
          },
        ],
        rest,
      ),
    );
  if (
    [
      "contextual",
      "contextual-repeat",
      "extra-assessment",
      "missing-assessment",
      "failed-checks",
    ].includes(updateScenario)
  ) {
    const asked =
      updateScenario === "missing-assessment"
        ? []
        : [{ id: "assessment:repository-readme", answer: null }];
    if (updateScenario === "extra-assessment")
      asked.push({ id: "assessment:documentation", answer: null });
    print(
      report("contextual", asked, {
        ...rest,
        contextual: [{ id: "repository-readme" }],
        ...(updateScenario === "failed-checks"
          ? { failedChecks: [{ message: "A failed check." }] }
          : {}),
      }),
    );
  }
  if (updateScenario === "wrong-version") rest.selection.version = "v1.0.1";
  print(report("complete", [], rest), updateScenario === "nonzero" ? 1 : 0);
}

if (state?.phase === "update-questions") {
  if (process.env.FAKE_UPDATE === "rejected-scope")
    reject("The CLI rejected the scope answer.");
  if (process.env.FAKE_UPDATE === "scope-repeat")
    print(
      report("answers-required", [{ id: "scope:documentation", answer: null }]),
    );
  if (
    process.env.FAKE_UPDATE === "fallback-scope" &&
    given.get("scope:project-readmes")?.candidates.length !== 0
  )
    reject("Missing fixture scope for a declaration without a draft.");
  for (const [id, expected] of Object.entries({
    documentation: recordedDraft,
    "typescript-node-stack": stackDraft,
  })) {
    if (JSON.stringify(given.get(`scope:${id}`)) !== JSON.stringify(expected))
      reject(`The ${id} scope must preserve its proposed answer unchanged.`);
  }
  if (given.get("remote-setup") !== "defer")
    reject("Remote setup must be deferred.");
  save({ ...state, phase: "update-contextual" });
  print(
    report(
      "contextual",
      [{ id: "assessment:repository-readme", answer: null }],
      {
        contextual: [{ id: "repository-readme" }],
      },
    ),
  );
}

if (state?.phase === "update-contextual") {
  const requested =
    process.env.FAKE_UPDATE === "extra-assessment"
      ? ["repository-readme", "documentation"]
      : ["repository-readme"];
  if (
    questions.length !== requested.length ||
    requested.some((id) => !given.has(`assessment:${id}`))
  )
    reject("Only the requested assessments may be submitted.");
  if (
    requested.some((id) => given.get(`assessment:${id}`).status !== "satisfied")
  )
    reject("Missing fixture assessment.");
  if (process.env.FAKE_UPDATE === "contextual-repeat")
    print(
      report("contextual", [
        { id: "assessment:repository-readme", answer: null },
      ]),
    );
  save({ ...state, phase: "complete" });
  print(report("complete", []), 0);
}

if (state === null) {
  if (!answersPath) {
    const git = (...gitArgs) =>
      execFileSync("git", ["-C", project, ...gitArgs], {
        encoding: "utf8",
      }).trim();
    if (
      git("rev-list", "--count", "HEAD") !== "1" ||
      git("status", "--porcelain")
    )
      reject("The fixture must be one clean commit.");
    if (!existsSync(join(project, "README.md")))
      reject("The fixture has no README.md.");
  }
  const asked = [
    {
      id: "version",
      question: "Version?",
      answer: given.get("version") ?? "v9.9.9",
    },
    {
      id: "profile",
      question: "Profile?",
      answer: given.get("profile") ?? null,
    },
  ];
  if (!answersPath || profile === null)
    print(report("answers-required", asked), answersPath ? 1 : 0);

  const missing = [];
  for (const id of discovered) {
    const answer = given.get(`scope:${id}`) ?? drafts[id] ?? null;
    if (given.get(`scope:${id}`) == null) missing.push(`scope:${id}`);
    asked.push({
      id: `scope:${id}`,
      question: "Scope?",
      details: { unresolved: [] },
      answer,
    });
  }
  const complete = missing.length === 0;
  if (complete && scenario === "blocked")
    print(
      report("blocked", asked, {
        blockers: [
          {
            code: "DIRTY_PROJECT",
            message: "The project has uncommitted changes.",
          },
        ],
      }),
    );
  if (complete) {
    asked.push({
      id: "remote-setup",
      question: "Defer?",
      choices: ["defer", "resolve"],
      details:
        scenario === "undeferred" ? remoteSetup.slice(0, 1) : remoteSetup,
      answer: given.get("remote-setup") ?? null,
    });
    if (scenario === "confirmation")
      asked.push({
        id: "confirmation",
        question: "Does the maintainer confirm discarding these edits?",
        context: "The run replaces README.md, discarding its edits.",
        answer: given.get("confirmation") ?? null,
      });
  }
  const identity = complete ? "sha256:complete" : "sha256:draft";
  asked.push({ id: "inspection", question: "Inspection?", answer: identity });
  if (given.get("inspection") !== identity) missing.push("inspection");
  const result = report("answers-required", asked);
  result.missing = [...new Set([...result.missing, ...missing])];
  if (result.missing.length > 0) print(result);

  save({
    phase: "contextual",
    version: given.get("version"),
    profile,
    deferred: given.get("remote-setup") === "defer" ? remoteSetup : [],
  });
  print(contextual(false));
}

function contextual(advance) {
  const declarations = [
    ...discovered,
    "repository-license",
    "repository-readme",
    ...(profile === "factory" ? ["factory-sandbox-image"] : []),
  ];
  const asked = declarations.map((id) => ({
    id: `assessment:${id}`,
    question: "Satisfied?",
    answer: advance ? (given.get(`assessment:${id}`) ?? null) : null,
  }));
  return report("contextual", asked, {
    contextual: declarations.map((id) => ({ id, allowedTargets: [] })),
  });
}

const renewed = contextual(true);
if (renewed.missing.length > 0) print(renewed);
for (const { id, answer } of renewed.answers.questions) {
  const name = id.slice("assessment:".length);
  if (answer.status !== "satisfied" || !answer.evidence?.length)
    reject(`The ${name} assessment is not a satisfied judgment with evidence.`);
  if (discovered.includes(name) !== Boolean(answer.scopeValidity))
    reject(
      `The ${name} assessment's scopeValidity does not match its discovery.`,
    );
}
if (scenario === "failed-checks")
  print({
    ...renewed,
    failedChecks: [
      {
        declaration: "repository-readme",
        id: "repository-readme-structure",
        message:
          "Make the Repository README description after its title one sentence.",
      },
    ],
  });
save({ ...state, phase: "complete" });
print(report("complete", []), 0);
