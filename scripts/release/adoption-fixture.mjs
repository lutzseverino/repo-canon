// The fixture repository that release verification adopts each published
// release into, with the answers its adoption needs. Its files already satisfy
// the rules of every contextual declaration once adoption installs the exact
// files, so adoption makes no contextual edit. It has no Git remote, so the
// GitHub remote setup probes report not ready and the run defers them.

const developmentGuide = "docs/development/README.md";

const mitLicense = `MIT License

Copyright (c) 2026 Wordtally contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

// The fixture's files, by repository-relative path.
export const files = {
  ".gitattributes": `* text=auto eol=lf
# BEGIN Repo Canon linguist-vendored
scripts/validate-issue-contract.mjs linguist-vendored
operations/lib/rendered-markdown.mjs linguist-vendored
.agents/skills/babysit/** linguist-vendored
.agents/skills/diagnosing-bugs/** linguist-vendored
# END Repo Canon linguist-vendored
`,
  "README.md": `<h1 align="center">Wordtally</h1>

Wordtally is a command-line word counter for writers who check the length of plain-text drafts.

[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)

## Installation

Install [Node.js](https://nodejs.org/), then clone the repository.

## Usage

Count the words of a draft from the repository root:

\`\`\`sh
node wordtally.mjs draft.txt
\`\`\`

## Documentation

[Documentation](docs/README.md)

## Contributing

[Contributing](CONTRIBUTING.md)

## License

[MIT License](LICENSE)
`,
  LICENSE: mitLicense,
  "wordtally.mjs": `import { readFileSync } from "node:fs";

export function countWords(text) {
  return text.split(/\\s+/).filter(Boolean).length;
}

if (import.meta.main) {
  const [path] = process.argv.slice(2);
  console.log(countWords(readFileSync(path, "utf8")));
}
`,
  "wordtally.test.mjs": `import assert from "node:assert/strict";
import { test } from "node:test";
import { countWords } from "./wordtally.mjs";

test("counts the words separated by whitespace", () => {
  assert.equal(countWords(" one two\\nthree "), 3);
});
`,
  "docs/README.md": `# Documentation

This directory documents how Wordtally is developed and how agents work in it.

- [Development](development/README.md): building, testing, and maintaining
  Wordtally.
- [Agents](agents/README.md): agent workflow configuration.
`,
  [developmentGuide]: `# Development

This directory explains how to set up and validate Wordtally.

## Setup and validation

Install Node.js 24. Wordtally has no dependencies to install. Run
\`node --test\` from the repository root before opening a pull request.
`,
  ".factory/Dockerfile": `FROM node:24-bookworm
`,
};

// Each discovery declaration's scope entry that no discovery script drafts.
// The documentation declaration's script drafts its entry, which the
// verification accepts.
export const scopes = {
  "factory-workflow": {
    coverage:
      "Factory workflow rules govern all work in the repository and own no project content, so the scope is intentionally empty.",
    candidates: [],
    unresolved: [],
  },
  "github-repository-configuration": {
    coverage:
      "The declaration configures GitHub remotely and owns no project files; the fixture has no Git remote and no pull request reviewer file, so its scope is intentionally empty.",
    candidates: [],
    unresolved: [],
  },
  "project-readmes": {
    coverage:
      "Wordtally is the repository's only project, and its Repository README describes it; no nested project needs a Project README.",
    candidates: [],
    unresolved: [],
  },
};

// The assessment of each contextual declaration, citing the fixture.
const unchangedScope = (explanation, evidence) => ({
  status: "valid",
  explanation,
  evidence,
  additionalPaths: [],
});

export const assessments = {
  "git-attributes": {
    status: "satisfied",
    explanation:
      "The root .gitattributes marks the installed counted files linguist-vendored with exact paths and individual installed skill directories, preserving the repository's text and line-ending setting.",
    evidence: [
      ".gitattributes covers scripts/validate-issue-contract.mjs, operations/lib/rendered-markdown.mjs, and the babysit and diagnosing-bugs skill directories.",
      "The block matches no Wordtally source or .repo-standards path; vendor/ and .github/ already have Linguist's default exclusion.",
    ],
  },
  "factory-workflow": {
    status: "satisfied",
    explanation:
      "The fixture has no tracker activity to reconcile; adoption installs the factory workflow rules for later work.",
    evidence: [
      "The disposable fixture has no Git remote or current tracker activity.",
      "Adoption installs the factory-workflow rules alongside the exact contribution guide.",
    ],
    scopeValidity: {
      afterFixes: unchangedScope(
        "The workflow owns no project content, so the empty scope is complete.",
        ["Factory policy governs tracker work, not content paths."],
      ),
      current: unchangedScope(
        "Contextual work changes no workflow scope; it remains empty.",
        ["No content path or directory belongs to this declaration."],
      ),
    },
  },
  documentation: {
    status: "satisfied",
    explanation:
      "The documentation root indexes its development and agents categories, and the development guide states the setup and validation.",
    evidence: [
      "docs/README.md lists docs/development/README.md and docs/agents/README.md.",
      "docs/development/README.md has its purpose, then a Setup and validation section naming Node.js 24 and node --test.",
    ],
    scopeValidity: {
      afterFixes: unchangedScope(
        "The drafted scope covers every document under docs that no exact file owns.",
        [
          "The fixture's documents under docs are docs/README.md and docs/development/README.md.",
        ],
      ),
      current: unchangedScope(
        "Adoption made no contextual edit, so the scope still covers every document.",
        ["The fixture's documents under docs are unchanged since the fixes."],
      ),
    },
  },
  "github-repository-configuration": {
    status: "satisfied",
    explanation:
      "The fixture has no Git remote, so its GitHub configuration is the deferred remote setup, and it keeps no pull request reviewer file.",
    evidence: [
      "The fixture repository has no Git remote.",
      "Without a GitHub repository, no visibility or REPO_CANON_RUNS_ON variable exists to read, so the variable is unset.",
      "No .github/pull-request-reviewer.json exists in the fixture.",
    ],
    scopeValidity: {
      afterFixes: unchangedScope(
        "The declaration owns no project files, so the empty scope is complete.",
        ["The declaration's fixes and checks read no fixture file."],
      ),
      current: unchangedScope(
        "Adoption made no contextual edit, so the empty scope is still complete.",
        ["The fixture has no pull request reviewer file."],
      ),
    },
  },
  "project-readmes": {
    status: "satisfied",
    explanation:
      "Wordtally is the fixture's only project, described by its Repository README.",
    evidence: [
      "wordtally.mjs and wordtally.test.mjs at the root are the only source files.",
    ],
    scopeValidity: {
      afterFixes: unchangedScope(
        "No nested project exists, so no Project README is missing.",
        ["The fixture has no manifest or source outside its root."],
      ),
      current: unchangedScope(
        "Adoption made no contextual edit, so no nested project appeared.",
        ["The fixture's source files are unchanged since the fixes."],
      ),
    },
  },
  "project-agent-guidance": {
    status: "satisfied",
    explanation:
      "The fixture's HEAD has no AGENTS.md, so adoption replaced no repository-specific agent instructions, and docs/agents/project.md stays absent.",
    evidence: [
      "The fixture's only commit has no AGENTS.md.",
      "The fixture has no docs/agents/project.md.",
    ],
  },
  "repository-license": {
    status: "satisfied",
    explanation:
      "LICENSE holds the MIT License text with the copyright notice of the Wordtally contributors.",
    evidence: [
      "LICENSE is the only root license file.",
      "README.md's License section links LICENSE as MIT License.",
    ],
  },
  "repository-readme": {
    status: "satisfied",
    explanation:
      "README.md has a centered title, a one-sentence description, a Node.js 24 badge, and Installation, Usage, Documentation, Contributing, and License sections in order.",
    evidence: [
      "README.md describes Wordtally as a command-line word counter for writers.",
      "Its Documentation, Contributing, and License sections each hold one link.",
    ],
  },
  "factory-sandbox-image": {
    status: "satisfied",
    explanation:
      "The toolchain image starts from node:24-bookworm, which provides the supported Node.js 24 selected by the development guide and compatible with the babysit scripts.",
    evidence: [
      ".factory/Dockerfile holds only FROM node:24-bookworm.",
      `${developmentGuide} requires only Node.js 24.`,
    ],
  },
};
