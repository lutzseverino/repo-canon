import { declarations } from "../../scripts/standards-declarations.mjs";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));

// A documentation index that follows the index entry form: a title, a
// one-sentence purpose, then one `[Title](path): description` item per entry.
export function index(title, purpose, entries = []) {
  const items = entries.map(
    ([entryTitle, path, description]) =>
      `- [${entryTitle}](${path}): ${description}`,
  );
  return `# ${title}\n\n${purpose}\n${items.length > 0 ? `\n${items.join("\n")}\n` : ""}`;
}

// A development guide in the required order: its purpose, a Setup and
// validation section, then its index.
export function developmentGuide(
  entries = [],
  setup = "Install Node.js 24 or 26, then run `npm test` from the repository root.",
) {
  const items = entries.map(
    ([entryTitle, path, description]) =>
      `- [${entryTitle}](${path}): ${description}`,
  );
  return `# Development

This directory explains how to build and validate the project.

## Setup and validation

${setup}
${items.length > 0 ? `\n## Documents\n\n${items.join("\n")}\n` : ""}`;
}

// `discovery/documentation.md` keeps the exact-owned shared agent configuration
// outside documentation scope, and `standards.yaml` declares each of those files
// separately.
export const exactOwnedAgentConfiguration = [
  "docs/agents/README.md",
  "docs/agents/domain.md",
  "docs/agents/issue-tracker.md",
  "docs/agents/triage-labels.md",
];

// The CLI passes every active declaration to each operation. The documentation
// check counts a document that another declaration owns, such as the exact-owned
// agent configuration, as covered by scope, so the file declarations of
// `standards.yaml` are passed as the CLI would.
export function fileDeclarations() {
  return [
    ...new Set(
      Object.values(declarations(sourceRoot))
        .flat()
        .filter(({ kind }) => kind === "file")
        .map(({ target }) => target),
    ),
  ].map((target) => ({ kind: "file", target, checks: [], fixes: [] }));
}
