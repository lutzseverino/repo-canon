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

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const validator = join(
  repositoryRoot,
  ".github/scripts/validate-pr-metadata.mjs",
);

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
  const result = spawnSync(process.execPath, [validatorPath, eventPath], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath },
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
    validatorPath: installedValidator(
      t,
      ".github/scripts/validate-pr-metadata.mjs",
    ),
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

function adoptionRecord() {
  return `# Repository Standards adoption record

## Selection

| Component | Value |
| --- | --- |
| CLI | \`4.0.0\` |
| Standards source | \`https://github.com/lutzseverino/repo-canon\` |
| Standards version | \`v0.4.0\` |
| Standards commit | \`0123456789abcdef0123456789abcdef01234567\` |
| Profile | \`node\` |

## Operations

| Phase | Declaration | Operation | Result | Message |
| --- | --- | --- | --- | --- |
| verification | \`documentation\` | \`documentation-navigation\` | passed | Documentation navigation is complete. |

## Changed paths

| Path | Phase | Operation |
| --- | --- | --- |
| \`.github/scripts/validate-pr-metadata.mjs\` | installation | none |

## Scope changes

No scope changes.

## Identities

| Record | Value |
| --- | --- |
| Run | \`run-1\` |
| Inspection | \`sha256:abc\` |
| HEAD at start | \`0123456789abcdef0123456789abcdef01234567\` |
| Completed at | 2026-10-01T00:00:00.000Z |
`;
}

test("accepts a body that is exactly an adoption record", () => {
  const record = adoptionRecord();
  for (const [variant, body] of [
    ["record", record],
    ["CRLF record", record.replace(/\n/g, "\r\n")],
    ["record after blank lines", `\n \t\n${record}`],
    [
      "record heading with trailing spaces",
      record.replace("record\n", "record \t\n"),
    ],
  ]) {
    const result = runEvent({
      title: "chore: update Repo Canon to v0.4.0",
      body,
    });
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
    title: "chore!: update Repo Canon to v0.4.0",
    body: adoptionRecord(),
  });
  assert.equal(breaking.status, 1);
  assert.match(breaking.stderr, /under an Impact/);
  assert.match(breaking.stderr, /under a Migration/);
  assert.doesNotMatch(breaking.stderr, /Add a Summary section/);
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
    const result = runEvent({
      title: "chore: update Repo Canon to v0.4.0",
      body,
    });
    assert.equal(result.status, 1, variant);
    assert.match(result.stderr, /Add a Summary section/, variant);
    assert.match(result.stderr, /Add an Evidence section/, variant);
    assert.match(result.stderr, /Add a Related issue section/, variant);
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
