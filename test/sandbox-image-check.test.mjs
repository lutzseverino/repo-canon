import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  invokeCheck,
  fixture,
  retainedCheck,
  snapshot,
} from "./helpers/operation.mjs";

const script = fileURLToPath(
  new URL("../operations/check-sandbox-image.mjs", import.meta.url),
);
const base = readFileSync(
  new URL("../operations/sandbox-image-base.Dockerfile", import.meta.url),
  "utf8",
);
const request = {
  operation: {
    declaration: "factory-sandbox-image",
    phase: "checks",
    id: "sandbox-image-base",
  },
  allowedTargets: { paths: [".sandcastle/Dockerfile"], directories: [] },
};

function check(t, files, overrides = {}) {
  const project = fixture(files);
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(script, project.root, {
    ...request,
    ...overrides,
  });
  assert.deepEqual(
    snapshot(project.root),
    before,
    "the check must not change project content",
  );
  return outcome;
}

const toolchain = `USER root
RUN apt-get update && apt-get install -y python3 \\
  && rm -rf /var/lib/apt/lists/*
USER \${AGENT_UID}:\${AGENT_GID}
RUN pip install --user poetry
`;

test("passes an image that extends the base with the repository's toolchain", (t) => {
  const outcome = check(t, { ".sandcastle/Dockerfile": base + toolchain });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(outcome.result, {
    format: "repo-standards/result/v2",
    status: "passed",
    message:
      "The sandbox image extends the factory's base; the toolchain it adds still requires maintainer or agent review.",
  });
});

const restoreBase =
  "Restore the factory's base unchanged at the top of .sandcastle/Dockerfile, and add the toolchain after it.";

test("fails a missing image with a correction to create it from the base", (t) => {
  const outcome = check(t, { "README.md": "# Harbor\n" });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(outcome.result, {
    format: "repo-standards/result/v2",
    status: "failed",
    message:
      "The sandbox image needs correction: Create .sandcastle/Dockerfile from the factory's base, and add the repository's toolchain after it.",
  });
});

test("fails an image that removes, changes, or reorders base lines", (t) => {
  const lines = base.split("\n");
  const codex = lines.findIndex((line) => line.includes("@openai/codex"));
  const variants = {
    removed: lines.toSpliced(codex, 1).join("\n") + toolchain,
    changed: base.replace("node:24-bookworm", "python:3.13") + toolchain,
    reordered: toolchain + base,
    "toolchain inside the base": lines
      .toSpliced(codex, 0, "RUN apt-get install -y python3")
      .join("\n"),
  };
  for (const [name, image] of Object.entries(variants)) {
    const outcome = check(t, { ".sandcastle/Dockerfile": image });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, "failed", name);
    assert.equal(
      outcome.result.message,
      `The sandbox image needs correction: ${restoreBase}`,
      name,
    );
  }
});

test("fails a toolchain that undoes the base, naming each correction", (t) => {
  const cases = [
    [
      "FROM python:3.13\nRUN pip install poetry\n",
      "Remove FROM after the base; a new stage discards the base, so install the toolchain in the base's stage.",
    ],
    [
      "from python:3.13 AS tools\n",
      "Remove FROM after the base; a new stage discards the base, so install the toolchain in the base's stage.",
    ],
    [
      'ENTRYPOINT ["bash"]\n',
      "Remove ENTRYPOINT after the base; Sandcastle starts the base's entrypoint.",
    ],
    [
      "CMD \\\n  bash\n",
      "Remove CMD after the base; Sandcastle starts the base's entrypoint.",
    ],
    [
      "USER root\nRUN apt-get install -y python3\n",
      "End the toolchain as the base's user with USER ${AGENT_UID}:${AGENT_GID}; Sandcastle runs the agent as that user.",
    ],
  ];
  for (const [toolchain, correction] of cases) {
    const outcome = check(t, { ".sandcastle/Dockerfile": base + toolchain });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.deepEqual(
      outcome.result,
      {
        format: "repo-standards/result/v2",
        status: "failed",
        message: `The sandbox image needs correction: ${correction}`,
      },
      toolchain,
    );
  }
});

test("reads instructions, not lines that only look like them", (t) => {
  const outcome = check(t, {
    ".sandcastle/Dockerfile": `${base}# FROM python:3.13 is not used; the base already has Node.js.
USER root
RUN apt-get update && apt-get install -y python3
RUN echo installing \\
# A comment inside a continued instruction.

  from the toolchain
RUN <<EOT
cat > /etc/motd <<'MOTD'
FROM here on, the toolchain is installed.
MOTD
USER nobody
EOT
COPY <<-"CONFIG" /etc/tool.conf
	CMD stays inside the heredoc
	CONFIG
user \${AGENT_UID}:\${AGENT_GID}
`,
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed", outcome.result.message);
});

test("runs from its declared retained source layout", (t) => {
  const retainedScript = retainedCheck(t, "operations/check-sandbox-image.mjs");
  const project = fixture({ ".sandcastle/Dockerfile": base + toolchain });
  t.after(project.close);
  const outcome = invokeCheck(retainedScript, project.root, request);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed");
});

test("treats invalid public-protocol input as a process error", (t) => {
  const project = fixture({ ".sandcastle/Dockerfile": base });
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(script, project.root, {
    ...request,
    format: "repo-standards/operation/v99",
  });

  assert.notEqual(outcome.status, 0);
  assert.equal(outcome.stdout, "");
  assert.match(outcome.stderr, /Unsupported operation input format/);
  assert.deepEqual(snapshot(project.root), before);
});

test("rejects an unexpected operation target as a process error", (t) => {
  const project = fixture({ ".sandcastle/Dockerfile": base });
  t.after(project.close);
  const before = snapshot(project.root);
  for (const allowedTargets of [
    { paths: ["Dockerfile"], directories: [] },
    { paths: [".sandcastle/Dockerfile"], directories: [".sandcastle"] },
  ]) {
    const outcome = invokeCheck(script, project.root, {
      ...request,
      allowedTargets,
    });

    assert.notEqual(outcome.status, 0);
    assert.equal(outcome.stdout, "");
    assert.match(outcome.stderr, /exact \.sandcastle\/Dockerfile target/);
  }
  assert.deepEqual(snapshot(project.root), before);
});
