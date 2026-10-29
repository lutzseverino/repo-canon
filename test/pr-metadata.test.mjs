import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { installedValidator } from "./helpers/installed-validator.mjs";
import { renderedAdoptionRecord } from "./fixtures/adoption-record.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const validator = join(repositoryRoot, ".github/scripts/validate.mjs");

function validBody(extra = "") {
  return `## Summary

Validate the pull request metadata before merge.

## Evidence

\`npm test\` passed with all event fixtures.

## Merge Danger

**Door:** two-way; the validator can be reverted.

**Blast Radius:** metadata checks.

## Related issue

Closes #6
${extra}`;
}

function runEvent({
  title = "feat(metadata): validate pull requests",
  body = validBody(),
  validatorPath = validator,
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), "repo-canon-pr-metadata-"));
  const eventPath = join(directory, "event.json");
  const summaryPath = join(directory, "summary.md");
  writeFileSync(
    eventPath,
    JSON.stringify({ action: "opened", pull_request: { title, body } }),
  );
  const result = spawnSync(process.execPath, [validatorPath, "pr-metadata"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_STEP_SUMMARY: summaryPath,
    },
  });
  const summary = existsSync(summaryPath)
    ? readFileSync(summaryPath, "utf8")
    : "";
  rmSync(directory, { recursive: true, force: true });
  return { ...result, summary };
}

test("passes valid metadata and fails invalid metadata", () => {
  const valid = runEvent();
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /validation passed/);
  assert.match(valid.summary, /validation passed/);

  const invalid = runEvent({ body: "Unstructured description" });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Add a Summary section/);
});

test("requires meaningful content in all four PR sections", () => {
  for (const section of [
    "Summary",
    "Evidence",
    "Merge Danger",
    "Related issue",
  ]) {
    const region = new RegExp(`## ${section}\\n[\\s\\S]*?(?=\\n## |$)`);
    const missing = runEvent({ body: validBody().replace(region, "") });
    assert.equal(missing.status, 1, section);
    assert.match(missing.stderr, new RegExp(`Add (?:a|an) ${section} section`));

    for (const content of [
      "",
      "TODO",
      "Not applicable",
      "---",
      "<br>",
      "<span hidden>Useful visible content</span>",
      "<!-- Explain this section -->",
      "Later",
    ]) {
      const meaningless = runEvent({
        body: validBody().replace(region, `## ${section}\n\n${content}\n`),
      });
      assert.equal(meaningless.status, 1, `${section}: ${content}`);
      assert.match(
        meaningless.stderr,
        section === "Related issue"
          ? /Link a related GitHub issue/
          : new RegExp(`Replace the ${section} placeholder`),
      );
    }
  }
});

test("publishes the four-section template in the required order", () => {
  const template = readFileSync(
    join(repositoryRoot, ".github/PULL_REQUEST_TEMPLATE.md"),
    "utf8",
  );
  assert.deepEqual(
    [...template.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
    ["Summary", "Evidence", "Merge Danger", "Related issue"],
  );
  const result = runEvent({ body: template });
  assert.equal(result.status, 1);
  for (const section of ["Summary", "Evidence", "Merge Danger"]) {
    assert.match(
      result.stderr,
      new RegExp(`Replace the ${section} placeholder`),
    );
  }
  assert.match(result.stderr, /Link a related GitHub issue/);
});

test("runs from the exact installed workflow layout", (t) => {
  const result = runEvent({
    validatorPath: installedValidator(t, ".github/scripts/validate.mjs"),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /validation passed/);
});

test("accepts harmless heading casing and formatting variations", () => {
  const body = `### **sUMMary:**

Fix a typo in the contributor instructions.

# EVIDENCE

Manual link inspection completed successfully.

## **mERGe dANGER:**

The contributor text can be reverted without affecting runtime behavior.

#### Related Issue

Direct change: fix a typo in contributor-facing text.
`;
  const result = runEvent({ title: "docs: fix contributor typo", body });
  assert.equal(result.status, 0, result.stderr);
});

test("accepts any meaningful Direct change reason", () => {
  for (const reason of [
    "fix a typo in contributor-facing text",
    "add a new authorization system",
  ]) {
    const result = runEvent({
      title: "docs: correct contributor guidance",
      body: validBody().replace("Closes #6", `Direct change: ${reason}.`),
    });
    assert.equal(result.status, 0, `${reason}: ${result.stderr}`);
  }
});

test("rejects a Direct change reason that is not meaningful", () => {
  for (const relatedIssue of [
    "Direct change:",
    "Direct change: TODO",
    "Direct change: TBD: explain later",
    "Direct change: typo",
    "Direct change: <!-- explain the correction -->",
    "Direct change: <span hidden>fix a typo in the guide</span>",
    "Direct change: `fix a typo in the guide`",
  ]) {
    const result = runEvent({
      title: "docs: correct contributor guidance",
      body: validBody().replace("Closes #6", relatedIssue),
    });
    assert.equal(result.status, 1, relatedIssue);
    assert.match(result.stderr, /Link a related GitHub issue/, relatedIssue);
  }
});

test("rejects the retired exception marker", () => {
  const marker = ["Small", "correction"].join(" ");
  const result = runEvent({
    body: validBody().replace(
      "Closes #6",
      `${marker}: fix a typo in the guide`,
    ),
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Link a related GitHub issue/);
});

const adoptionTitle = "chore: adopt repo-canon v0.4.0 with CLI 7.0.0";

function adoptionRecord({
  deferredRemoteSetup = false,
  abandonedRuns = false,
} = {}) {
  return `# Repository Standards adoption record

## Ready to commit

Ready to commit: yes.

## Selection

| Component | Value |
| --- | --- |
| CLI | \`7.0.0\` |
| Standards source | \`https://github.com/lutzseverino/repo-canon\` |
| Standards version | \`v0.4.0\` |
| Standards commit | \`0123456789abcdef0123456789abcdef01234567\` |
| Profile | \`standard\` |

## Operations

| Phase | Declaration | Operation | Result | Message |
| --- | --- | --- | --- | --- |
| verification | \`documentation\` | \`documentation-navigation\` | passed | Documentation navigation is complete. |
${deferredRemoteSetup ? "| fixes | `github-repository-configuration` | `canonical-labels` | deferred | GitHub authentication is unavailable. |\n" : ""}

## Changed paths

| Path | Phases |
| --- | --- |
| \`.github/scripts/validate-pr-metadata.mjs\` | installation |

## Scope changes

No scope changes.

## Identities

| Record | Value |
| --- | --- |
| Run | \`run-1\` |
| Inspection | \`sha256:abc\` |
| HEAD at start | \`0123456789abcdef0123456789abcdef01234567\` |
| Completed at | 2026-10-01T00:00:00.000Z |
${
  abandonedRuns
    ? `
## Abandoned runs

| Run | Inspection | Phase | Reason |
| --- | --- | --- | --- |
| \`run-0\` | \`sha256:def\` | fixes | The maintainer abandoned the run. |
`
    : ""
}`;
}

test("accepts a complete, ready adoption record under its adoption title", () => {
  const record = adoptionRecord();
  for (const [variant, title, body] of [
    ["record", adoptionTitle, record],
    [
      "record with deferred remote setup",
      adoptionTitle,
      adoptionRecord({ deferredRemoteSetup: true }),
    ],
    ["CRLF record", adoptionTitle, record.replace(/\n/g, "\r\n")],
    ["record after blank lines", adoptionTitle, `\n \t\n${record}`],
    [
      "record heading with trailing spaces",
      adoptionTitle,
      record.replace("record\n", "record \t\n"),
    ],
    [
      "record with abandoned runs",
      adoptionTitle,
      adoptionRecord({ abandonedRuns: true }),
    ],
    [
      "record rendered by the CLI",
      "chore: adopt repo-canon v0.16.0 with CLI 8.0.0",
      renderedAdoptionRecord,
    ],
    [
      "record whose source URL ends in .git and a slash",
      adoptionTitle,
      record.replace("repo-canon`", "repo-canon.git/`"),
    ],
  ]) {
    const result = runEvent({ title, body });
    assert.equal(result.status, 0, `${variant}: ${result.stderr}`);
    assert.match(result.stdout, /validation passed/, variant);
    assert.match(result.summary, /adoption record/, variant);
  }
});

test("still validates the title of an adoption record body", () => {
  const result = runEvent({
    title: "Update Repo Canon",
    body: adoptionRecord(),
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Conventional Commit title/);
  assert.doesNotMatch(result.stderr, /Add a Summary section/);

  const breaking = runEvent({
    title: "chore!: adopt repo-canon v0.4.0 with CLI 7.0.0",
    body: adoptionRecord(),
  });
  assert.equal(breaking.status, 1);
  assert.match(breaking.stderr, /under an Impact/);
  assert.match(breaking.stderr, /under a Migration/);
  assert.doesNotMatch(breaking.stderr, /Add a Summary section/);
  assert.doesNotMatch(breaking.stderr, /Title the adoption pull request/);
});

test("accepts a trailing issue relationship after the complete adoption record", () => {
  for (const [title, record] of [
    [adoptionTitle, adoptionRecord()],
    [adoptionTitle, adoptionRecord({ abandonedRuns: true })],
    ["chore: adopt repo-canon v0.16.0 with CLI 8.0.0", renderedAdoptionRecord],
    [
      "chore: adopt repo-canon v0.16.0 with CLI 8.0.0",
      renderedAdoptionRecord.replace(/\n/g, "\r\n"),
    ],
  ]) {
    for (const reference of [
      "Closes #123",
      "Part of owner/repository#123",
      "[Related work](https://github.com/owner/repository/issues/123)",
    ]) {
      const body = `${record}\n## Related issue\n\n${reference}\n`;
      const result = runEvent({ title, body });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.summary, /adoption record/);
    }
  }
});

test("validates a trailing adoption relationship in the installed layout", (t) => {
  const result = runEvent({
    title: adoptionTitle,
    body: `${adoptionRecord()}\n## Related issue\n\nCloses #123\n`,
    validatorPath: installedValidator(t, ".github/scripts/validate.mjs"),
  });
  assert.equal(result.status, 0, result.stderr);
});

test("accepts a breaking adoption record followed by Impact and Migration", () => {
  for (const record of [
    adoptionRecord(),
    adoptionRecord({ abandonedRuns: true }),
  ]) {
    for (const relationship of ["", "\n## Related issue\n\nCloses #123\n"]) {
      const result = runEvent({
        title: "chore!: adopt repo-canon v0.4.0 with CLI 7.0.0",
        body: `${record}
## Impact

The factory's claim labels change, so open claims need relabelling.

## Migration

Relabel each open factory:running issue before the factory restarts.
${relationship}`,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.summary, /adoption record/);
    }
  }
});

test("rejects empty, placeholder or invisible adoption relationships", () => {
  for (const reference of [
    "",
    "TODO",
    "See the original issue",
    "`Closes #123`",
    "```markdown\nCloses #123\n```",
    "<!-- Closes #123 -->",
    "<span hidden>Closes #123</span>",
    '<span title="Closes #123">No relationship here</span>',
  ]) {
    const result = runEvent({
      title: adoptionTitle,
      body: `${adoptionRecord()}\n## Related issue\n\n${reference}\n`,
    });
    assert.equal(result.status, 1, reference);
    assert.match(result.stderr, /Link a related GitHub issue/, reference);
  }
});

test("rejects duplicate or misplaced adoption relationship sections", () => {
  const record = adoptionRecord();
  const relationship = "\n## Related issue\n\nCloses #123\n";
  const impact = "\n## Impact\n\nLabels change.\n";
  const migration = "\n## Migration\n\nRelabel open issues.\n";
  for (const body of [
    `${record}${relationship}${relationship}`,
    record.replace("## Identities", `${relationship}\n## Identities`),
    adoptionRecord({ abandonedRuns: true }).replace(
      "## Abandoned runs",
      `${relationship}\n## Abandoned runs`,
    ),
    `${record}${relationship}${impact}${migration}`,
    `${record}${impact}${relationship}${migration}`,
    `${record}${relationship}\n## Notes\n\nExtra record section.\n`,
    `${record}${relationship.replace("## Related", "# Related")}`,
    `${record}${relationship.replace("## Related", "### Related")}`,
    `${record}${relationship}${relationship.replace("## Related", "### Related")}`,
  ]) {
    const result = runEvent({ title: adoptionTitle, body });
    assert.equal(result.status, 1, body);
    assert.match(result.stderr, sectionOrderError);
  }
});

const sectionOrderError =
  /List the adoption record's level-2 sections as Ready to commit, Selection, Operations, Changed paths, Scope changes and Identities/;
const readyError = /State Ready to commit: yes\. in the adoption record/;
const selectionError =
  /Give the adoption record's Selection section one Markdown table with one CLI, one Standards source and one Standards version row/;

function assertRecordFailure(result, variant, expected) {
  assert.equal(result.status, 1, variant);
  for (const pattern of expected) assert.match(result.stderr, pattern, variant);
  for (const pattern of [sectionOrderError, readyError, selectionError]) {
    if (!expected.includes(pattern))
      assert.doesNotMatch(result.stderr, pattern, variant);
  }
  assert.doesNotMatch(result.stderr, /Add a Summary section/, variant);
  assert.doesNotMatch(result.stderr, /validation passed/, variant);
}

test("rejects a heading-first body that is not an adoption record", () => {
  for (const [variant, body] of [
    ["record heading alone", "# Repository Standards adoption record\n"],
    [
      "record heading followed by other text",
      `# Repository Standards adoption record

## Summary

Fix an unrelated bug.
`,
    ],
  ]) {
    const result = runEvent({ title: "fix: unrelated change", body });
    assertRecordFailure(result, variant, [
      sectionOrderError,
      readyError,
      selectionError,
    ]);
  }
});

test("rejects an adoption record that is not complete and ready to commit", () => {
  const record = adoptionRecord();
  const notReady = record.replace(
    "Ready to commit: yes.",
    "Ready to commit: no.\n\n- The working tree has unrelated changes.",
  );
  assertRecordFailure(
    runEvent({ title: adoptionTitle, body: notReady }),
    "no",
    [readyError],
  );
  assertRecordFailure(
    runEvent({
      title: adoptionTitle,
      body: record.replace("Ready to commit: yes.", "Ready to commit: yes"),
    }),
    "missing period",
    [readyError],
  );
  assertRecordFailure(
    runEvent({
      title: adoptionTitle,
      body: record.replace("Ready to commit: yes.", "> Ready to commit: yes."),
    }),
    "statement in a quote",
    [readyError],
  );

  const incomplete = runEvent({
    title: adoptionTitle,
    body: `# Repository Standards adoption record

## Ready to commit

Ready to commit: no.

- No complete adoption is recorded.

No complete adoption is recorded.
`,
  });
  assertRecordFailure(incomplete, "incomplete", [
    sectionOrderError,
    readyError,
    selectionError,
  ]);
});

test("rejects an adoption record without its sections once and in order", () => {
  const record = adoptionRecord();
  const variants = [
    ...[
      "Ready to commit",
      "Selection",
      "Operations",
      "Changed paths",
      "Scope changes",
      "Identities",
    ].map((section) => [
      `missing ${section}`,
      record.replace(`## ${section}\n`, ""),
    ]),
    [
      "duplicated Operations",
      record.replace(
        "## Changed paths",
        "## Operations\n\nAgain.\n\n## Changed paths",
      ),
    ],
    [
      "reordered Operations and Changed paths",
      record
        .replace("## Operations", "## Placeholder")
        .replace("## Changed paths", "## Operations")
        .replace("## Placeholder", "## Changed paths"),
    ],
    ["extra Notes section", `${record}\n## Notes\n\nReviewed by hand.\n`],
    [
      "Notes between record sections",
      record.replace("## Identities", "## Notes\n\nReviewed.\n\n## Identities"),
    ],
    ["second level-1 heading", `${record}\n# Notes\n\nReviewed by hand.\n`],
    [
      "Abandoned runs before Identities",
      record.replace(
        "## Identities",
        "## Abandoned runs\n\nNone.\n\n## Identities",
      ),
    ],
    ["level-1 Identities", record.replace("## Identities", "# Identities")],
    ["Impact without Migration", `${record}\n## Impact\n\nLabels change.\n`],
    [
      "Migration without Impact",
      `${record}\n## Migration\n\nRelabel issues.\n`,
    ],
    [
      "Migration before Impact",
      `${record}\n## Migration\n\nRelabel issues.\n\n## Impact\n\nLabels change.\n`,
    ],
    [
      "Identities only in a code fence",
      record.replace("## Identities\n", "```markdown\n## Identities\n```\n"),
    ],
    [
      "Identities only in an HTML comment",
      record.replace("## Identities\n", "<!--\n## Identities\n-->\n"),
    ],
    [
      "Identities only in hidden HTML",
      record.replace(
        "## Identities\n",
        "<div hidden>\n\n## Identities\n\n</div>\n",
      ),
    ],
  ];
  for (const [variant, body] of variants) {
    for (const relationship of ["", "\n## Related issue\n\nCloses #123\n"]) {
      const result = runEvent({
        title: adoptionTitle,
        body: body + relationship,
      });
      const expected = [sectionOrderError];
      if (variant === "missing Ready to commit") expected.push(readyError);
      // Without its heading, the next section's table joins the Selection.
      if (["missing Selection", "missing Operations"].includes(variant))
        expected.push(selectionError);
      assertRecordFailure(result, variant, expected);
    }
  }

  const readyInComment = runEvent({
    title: adoptionTitle,
    body: record.replace(
      "## Ready to commit\n\nReady to commit: yes.\n",
      "<!--\n## Ready to commit\n\nReady to commit: yes.\n-->\n",
    ),
  });
  assertRecordFailure(readyInComment, "Ready to commit in a comment", [
    sectionOrderError,
    readyError,
  ]);
});

test("rejects an adoption record without the Selection values its title needs", () => {
  const record = adoptionRecord();
  for (const [variant, body] of [
    ["missing CLI row", record.replace("| CLI | `7.0.0` |\n", "")],
    [
      "missing Standards source row",
      record.replace(/\| Standards source \|[^\n]*\n/, ""),
    ],
    [
      "missing Standards version row",
      record.replace("| Standards version | `v0.4.0` |\n", ""),
    ],
    [
      "CLI value outside inline code",
      record.replace("| CLI | `7.0.0` |", "| CLI | 7.0.0 |"),
    ],
    [
      "Standards version with text beside its code",
      record.replace("`v0.4.0` |", "`v0.4.0` (latest) |"),
    ],
    [
      "duplicated CLI row",
      record.replace(
        "| CLI | `7.0.0` |",
        "| CLI | `7.0.0` |\n| CLI | `7.0.0` |",
      ),
    ],
    [
      "Standards source without a repository name",
      record.replace("`https://github.com/lutzseverino/repo-canon`", "`.git`"),
    ],
    [
      "CLI name in hidden HTML",
      record.replace("| CLI |", "| <span hidden>x</span>CLI |"),
    ],
    [
      "Selection rows in a hidden table",
      record.replace(
        /\| CLI \|[\s\S]*?\| Standards version \|[^\n]*\n/,
        (rows) =>
          `\n<div hidden>\n\n| Component | Value |\n| --- | --- |\n${rows}\n</div>\n`,
      ),
    ],
    [
      "Selection with text beside its table",
      record.replace(
        "## Selection\n",
        "## Selection\n\nThe selected source.\n",
      ),
    ],
    [
      "Selection rows only in a code fence",
      record.replace(
        /\| Component \| Value \|[\s\S]*?\| Profile [^\n]*\n/,
        (table) => `\`\`\`markdown\n${table}\`\`\`\n`,
      ),
    ],
  ]) {
    const result = runEvent({ title: adoptionTitle, body });
    assertRecordFailure(result, variant, [selectionError]);
    assert.doesNotMatch(result.stderr, /Title the adoption pull request/);
  }
});

test("rejects an adoption record whose title does not match its Selection", () => {
  for (const title of [
    "fix: adopt repo-canon v0.4.0 with CLI 7.0.0",
    "chore(standards): adopt repo-canon v0.4.0 with CLI 7.0.0",
    "chore: adopt repo-standards v0.4.0 with CLI 7.0.0",
    "chore: adopt repo-canon v0.5.0 with CLI 7.0.0",
    "chore: adopt repo-canon v0.4.0 with CLI 7.1.0",
    "chore: update Repo Canon to v0.4.0",
    "fix: unrelated change",
  ]) {
    const result = runEvent({ title, body: adoptionRecord() });
    assertRecordFailure(result, title, []);
    assert.match(
      result.stderr,
      /Title the adoption pull request chore: adopt repo-canon v0\.4\.0 with CLI 7\.0\.0, or chore!: adopt repo-canon v0\.4\.0 with CLI 7\.0\.0 for a breaking adoption/,
      title,
    );
    assert.equal(
      result.stderr.match(/Title the adoption pull request/g).length,
      1,
      title,
    );
  }
});

test("validates a body whose record heading is not its first content as an ordinary body", () => {
  const record = adoptionRecord();
  for (const [variant, body] of [
    ["text before the record", `Update Repo Canon.\n\n${record}`],
    ["comment before the record", `<!-- adoption -->\n${record}`],
    [
      "hidden text before the record",
      `<span hidden>adoption</span>\n\n${record}`,
    ],
    ["record in a code fence", `\`\`\`markdown\n${record}\`\`\`\n`],
    ["indented record heading", `  ${record}`],
    ["non-breaking space before the record", `\u00a0\n${record}`],
    ["second-level record heading", `#${record}`],
    [
      "differently cased record heading",
      record.replace("adoption record", "Adoption Record"),
    ],
    [
      "longer record heading",
      record.replace("adoption record", "adoption record draft"),
    ],
  ]) {
    const result = runEvent({ title: adoptionTitle, body });
    assert.equal(result.status, 1, variant);
    assert.match(result.stderr, /Add a Summary section/, variant);
    assert.match(result.stderr, /Add an Evidence section/, variant);
    assert.match(result.stderr, /Add a Related issue section/, variant);
    assert.doesNotMatch(result.stderr, /adoption/, variant);
  }

  const ordinary = runEvent({ body: `${validBody()}\n${record}` });
  assert.equal(ordinary.status, 0, ordinary.stderr);
});

test("accepts every allowed lowercase Conventional Commit type", () => {
  for (const type of [
    "feat",
    "fix",
    "docs",
    "refactor",
    "perf",
    "test",
    "build",
    "ci",
    "style",
    "chore",
    "revert",
  ]) {
    const result = runEvent({
      title: `${type}(metadata): validate pull requests`,
    });
    assert.equal(result.status, 0, `${type}: ${result.stderr}`);
  }
});

test("accepts a concise one-word title description", () => {
  const result = runEvent({ title: "style: reformat" });
  assert.equal(result.status, 0, result.stderr);
});

test("reports missing and placeholder PR sections together", () => {
  const body = `## Summary

TODO

## Evidence

<!-- List checks here. -->

## Merge Danger

The metadata validator can be reverted; only pull request checks are affected.

## Related issue

Later
`;
  const result = runEvent({ body });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Replace the Summary placeholder/);
  assert.match(result.stderr, /Replace the Evidence placeholder/);
  assert.match(result.stderr, /Link a related GitHub issue/);
  assert.match(result.summary, /PR metadata validation failed/);
});

test("rejects empty sections and headings hidden in comments", () => {
  const body = `## Summary

<!--
## Evidence
Hidden validation text passed.
## Merge Danger

The metadata validator can be reverted; only pull request checks are affected.

## Related issue
Closes #6
-->
`;
  const result = runEvent({ body });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Replace the Summary placeholder/);
  assert.match(result.stderr, /Add an Evidence section/);
  assert.match(result.stderr, /Add a Related issue section/);
});

test("rejects common placeholder variants and rendered-empty HTML", () => {
  for (const placeholder of [
    "Not applicable",
    "Not applicable.",
    "No tests",
    "Same as title",
    "<br><br>",
    "&nbsp;&nbsp;",
  ]) {
    const result = runEvent({
      body: `## Summary

${placeholder}

## Evidence

${placeholder}

## Merge Danger

The metadata validator can be reverted; only pull request checks are affected.

## Related issue

Closes #6
`,
    });
    assert.equal(result.status, 1, placeholder);
    assert.match(result.stderr, /Replace the Summary placeholder/, placeholder);
    assert.match(
      result.stderr,
      /Replace the Evidence placeholder/,
      placeholder,
    );
  }
});

test("rejects required pull request metadata hidden from rendered HTML", () => {
  const result = runEvent({
    body: `## Summary

<span hidden>Correct the metadata validator behavior.</span>

## Evidence

<span hidden>The focused validator tests passed.</span>

## Merge Danger

The metadata validator can be reverted; only pull request checks are affected.

## Related issue

<span hidden><a href="https://github.com/lutzseverino/repo-canon/issues/36">Closes #36</a></span>
`,
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Replace the Summary placeholder/);
  assert.match(result.stderr, /Replace the Evidence placeholder/);
  assert.match(result.stderr, /Link a related GitHub issue/);
});

test("accepts visible metadata alongside hidden HTML", () => {
  const result = runEvent({
    title: "fix(metadata)!: reject hidden pull request content",
    body: `## Summary

<span hidden>Ignore this decoy.</span> Reject hidden pull request metadata.

## Evidence

<span hidden>Ignore this decoy.</span> \`node --test test/pr-metadata.test.mjs\` passed.

## Merge Danger

The metadata validator can be reverted; only pull request checks are affected.

## Related issue

<span hidden><a href="https://github.com/example/example/issues/999">Ignore this link</a></span>
Closes #36

## Impact

<span hidden>Ignore this decoy.</span> Previously accepted descriptions will fail validation.

## Migration

<span hidden>Ignore this decoy.</span> Move required metadata into visible content.
`,
  });

  assert.equal(result.status, 0, result.stderr);
});

test("preserves visible title and fragment-head text in pull request sections", () => {
  const result = runEvent({
    body: `## Summary

<title>Correct the metadata validator behavior.</title>

## Evidence

<head>The focused validator tests passed.</head>

## Merge Danger

The metadata validator can be reverted; only pull request checks are affected.

## Related issue

Closes #45
`,
  });

  assert.equal(result.status, 0, result.stderr);
});

test("ignores headings inside fenced Markdown examples", () => {
  const onlyExample = runEvent({
    body: `\`\`\`markdown
## Summary
Example summary text.
## Evidence
Example validation passed.
## Merge Danger

The metadata validator can be reverted; only pull request checks are affected.

## Related issue
Closes #6
\`\`\`
`,
  });
  assert.equal(onlyExample.status, 1);
  assert.match(onlyExample.stderr, /Add a Summary section/);

  const realSectionsWithExample = runEvent({
    body: `${validBody()}

\`\`\`markdown
## Summary
Example summary text.
\`\`\`
`,
  });
  assert.equal(
    realSectionsWithExample.status,
    0,
    realSectionsWithExample.stderr,
  );
});

test("treats HTML comment syntax inside fenced code as inert", () => {
  const result = runEvent({
    body: `\`\`\`html
<!-- an intentionally unterminated example
\`\`\`

${validBody()}
`,
  });
  assert.equal(result.status, 0, result.stderr);
});

test("rejects code fences whose only content is an info string", () => {
  const result = runEvent({
    body: `## Summary

\`\`\`text
\`\`\`

## Evidence

\`\`\`shell session
\`\`\`

## Merge Danger

The metadata validator can be reverted; only pull request checks are affected.

## Related issue

Closes #6
`,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Replace the Summary placeholder/);
  assert.match(result.stderr, /Replace the Evidence placeholder/);

  const codeEvidence = runEvent({
    body: validBody().replace(
      "`npm test` passed with all event fixtures.",
      "<pre>npm test\npassed all fixtures</pre>",
    ),
  });
  assert.equal(codeEvidence.status, 0, codeEvidence.stderr);
});

test("keeps nested subsections attached to required sections", () => {
  const result = runEvent({
    body: `## Summary

### Problem and change

Pull requests need consistent metadata, so this adds validation.

## Evidence

### Automated checks

The complete Node test suite passed.

## Merge Danger

The metadata validator can be reverted; only pull request checks are affected.

## Related issue

### Tracking issue

Closes #6
`,
  });
  assert.equal(result.status, 0, result.stderr);
});

test("does not accept issue references or exceptions inside code examples", () => {
  for (const relatedIssue of [
    "Use `#123` as the example format.",
    "Use `Direct change: explain the typo here` as the exception format.",
    "<code>#123</code>",
    "<pre>#123</pre>",
    "<code>Direct change: explain the typo here</code>",
  ]) {
    const result = runEvent({
      body: `## Summary

Validate pull request metadata before merge.

## Evidence

The complete Node test suite passed.

## Merge Danger

The metadata validator can be reverted; only pull request checks are affected.

## Related issue

${relatedIssue}
`,
    });
    assert.equal(result.status, 1, relatedIssue);
    assert.match(result.stderr, /Link a related GitHub issue/, relatedIssue);
  }
});

test("uses rendered issue text and actual link destinations", () => {
  const inertAttribute = runEvent({
    body: `## Summary

Validate pull request metadata before merge.

## Evidence

The complete Node test suite passed.

## Merge Danger

The metadata validator can be reverted; only pull request checks are affected.

## Related issue

<span data-example="#123"></span>
`,
  });
  assert.equal(inertAttribute.status, 1);
  assert.match(inertAttribute.stderr, /Link a related GitHub issue/);

  for (const reference of [
    "[Tracking issue](https://github.com/lutzseverino/repo-canon/issues/6)",
    '<a href="https://github.com/lutzseverino/repo-canon/issues/6">Tracking issue</a>',
  ]) {
    const linked = runEvent({
      body: `## Summary

Validate pull request metadata before merge.

## Evidence

The complete Node test suite passed.

## Merge Danger

The metadata validator can be reverted; only pull request checks are affected.

## Related issue

${reference}
`,
    });
    assert.equal(linked.status, 0, `${reference}: ${linked.stderr}`);
  }
});

test("rejects duplicate required PR sections", () => {
  for (const section of [
    "Summary",
    "Evidence",
    "Merge Danger",
    "Related issue",
  ]) {
    const result = runEvent({
      body: `${validBody()}\n## ${section}\n\nA duplicate section is ambiguous.\n`,
    });
    assert.equal(result.status, 1, section);
    assert.match(result.stderr, new RegExp(`exactly one ${section} section`));
  }
});

test("rejects invalid Conventional Commit title structure", () => {
  /** @type {[string, RegExp][]} */
  const cases = [
    ["Feature(metadata): validate pull requests", /allowed lowercase type/],
    ["feature(metadata): validate pull requests", /allowed lowercase type/],
    [
      "feat(metadata) validate pull requests",
      /form type\(scope\): description/,
    ],
    ["feat(): validate pull requests", /form type\(scope\): description/],
    ["feat: ---", /letter or number/],
    ["feat(metadata): validate pull requests.", /trailing period/],
  ];

  for (const [title, expected] of cases) {
    const result = runEvent({ title });
    assert.equal(result.status, 1, title);
    assert.match(result.stderr, expected, title);
  }
});

test("requires impact and migration explanations for marked breaking changes", () => {
  const explanation = `Impact: old clients stop working after this change.
Migration: clients must use the replacement response field.`;
  for (const { name, body, status } of [
    { name: "no explanation", body: validBody(), status: 1 },
    {
      name: "an Impact heading and a Migration label",
      body: `${validBody()}
## Impact

Clients using the legacy response will stop receiving that field.

Migration: read the replacement response field before upgrading.
`,
      status: 0,
    },
    {
      name: "hidden HTML",
      body: `${validBody()}\n<span hidden>\n${explanation}\n</span>\n`,
      status: 1,
    },
    {
      name: "a code example",
      body: `${validBody()}\n\`\`\`text\n${explanation}\n\`\`\`\n`,
      status: 1,
    },
  ]) {
    const result = runEvent({
      title: "feat(api)!: remove legacy response",
      body,
    });
    assert.equal(result.status, status, `${name}: ${result.stderr}`);
    if (status === 1) {
      assert.match(result.stderr, /under an Impact/, name);
      assert.match(result.stderr, /under a Migration/, name);
    }
  }
});

test("requires the title marker for an explicit breaking-change footer", () => {
  const result = runEvent({
    title: "feat(api): remove legacy response",
    body: `${validBody()}
BREAKING CHANGE: legacy clients must migrate to the replacement field.
`,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Add ! before the title colon/);

  const fenced = runEvent({
    title: "feat(api): document a migration example",
    body: `${validBody()}
\`\`\`text
BREAKING CHANGE: example footer text stays inert.
\`\`\`
`,
  });
  assert.equal(fenced.status, 0, fenced.stderr);

  const htmlCode = runEvent({
    title: "feat(api): document a migration example",
    body: `${validBody()}
<code>BREAKING CHANGE: example footer text stays inert.</code>
`,
  });
  assert.equal(htmlCode.status, 0, htmlCode.stderr);
});

test("rejects co-author trailers in titles and raw bodies of every kind", (t) => {
  const validatorPath = installedValidator(t, ".github/scripts/validate.mjs");
  for (const line of [
    "Co-authored-by: Example Person <person@example.com>",
    "  co-authored-by: build-worker[bot] <bot@example.com>",
    "\tCO-AUTHORED-BY: Imaginary Model",
  ]) {
    for (const [title, body] of [
      [undefined, validBody(line)],
      [undefined, validBody(`\n\`\`\`text\n${line}\n\`\`\``)],
      [adoptionTitle, `${adoptionRecord()}\n${line}`],
    ]) {
      const result = runEvent({ title, body, validatorPath });
      assert.equal(result.status, 1, line);
      assert.doesNotMatch(result.stderr, /adoption/, line);
      assert.match(
        result.stderr,
        /Remove the co-author trailer.*CONTRIBUTING\.md/,
      );
      assert.match(result.summary, /Remove the co-author trailer/);
    }
    const result = runEvent({ title: line });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Remove the co-author trailer.*title/);
  }
});

test("rejects attribution lines after Markdown markers and symbols", () => {
  for (const line of [
    "🤖 Generated with [Nebula Scribe](https://example.com)",
    "Generated by comet-agent",
    "  > - **gEnErAtEd By** unknown-writer",
    "### ✨ Generated with [Orbit Studio](https://example.org)",
    "1. Generated by another-agent",
    "* Generated with unknown-tool",
  ]) {
    for (const [title, body] of [
      [undefined, validBody(line)],
      [undefined, validBody(`\n\`\`\`text\n${line}\n\`\`\``)],
      [adoptionTitle, `${adoptionRecord()}\n${line}`],
    ]) {
      const result = runEvent({ title, body });
      assert.equal(result.status, 1, line);
      assert.doesNotMatch(result.stderr, /adoption/, line);
      assert.match(
        result.stderr,
        /Remove the attribution line.*CONTRIBUTING\.md/,
      );
    }
    const result = runEvent({ title: line });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Remove the attribution line.*title/);
  }
});

test("accepts mid-sentence mentions of attribution and trailer keys", () => {
  const result = runEvent({
    title: "test: cover generated by text and Co-authored-by: mentions",
    body: validBody(
      "The fixtures generated by the drafter passed. The `Co-authored-by:` key is an example. A generated with phrase is mentioned here.\nGenerated bytes are fixture output.",
    ),
  });
  assert.equal(result.status, 0, result.stderr);
});
