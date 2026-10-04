import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import {
  invokeCheck,
  fixture,
  retainedCheck,
  snapshot,
} from "./helpers/operation.mjs";

const script = fileURLToPath(
  new URL("../operations/check-repository-readme.mjs", import.meta.url),
);

function check(t, files, overrides) {
  const project = fixture(files);
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(script, project.root, overrides);
  assert.deepEqual(
    snapshot(project.root),
    before,
    "the check must not change project content",
  );
  return outcome;
}

const mit = "MIT License\n\nCopyright (c) 2026 Example\n";

// Usage, Features, then Installation breaks the general order rule only for
// Features before Usage, and the Installation-first rule only for Installation
// before Usage, so each correction names its own rule.
const generalOrderCorrection = "Move Features before Usage.";
const installationFirstCorrection =
  "Move Installation before Usage; it is the first section when present.";

function assertCorrections(message, corrections) {
  for (const correction of corrections)
    assert.ok(
      message.includes(correction),
      `expected ${JSON.stringify(correction)} in ${JSON.stringify(message)}`,
    );
}

test("passes an applicable Repository README without changing content", (t) => {
  const outcome = check(t, {
    "README.md": `<h1 align="center">Harbor</h1>

A queue-backed service for reliable message delivery.

![Node.js](https://img.shields.io/badge/Node.js-24-green)

[docs]: docs/README.md#usage
[license]: LICENSE

## Installation

\`npm install harbor\`

## Features

- Durable delivery

## Product details

The inspector is intentionally read-only.

### Usage

\`harbor send example\`

## Configuration

Set \`HARBOR_PORT\`.

## **Documentation**

[the documentation map][docs]

## _Contributing_

[the contribution guide](<CONTRIBUTING.md>)

## **License**

[MIT License][license]

<!-- License details are maintained in the linked file. -->
`,
    LICENSE: mit,
    "CONTRIBUTING.md": "# Contributing\n",
    "docs/README.md": "# Documentation\n",
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(outcome.result, {
    format: "repo-standards/result/v1",
    status: "passed",
    message:
      "Repository README structure is valid; factual content still requires maintainer or agent review.",
  });
});

test("runs from its declared retained source layout", (t) => {
  const retainedScript = retainedCheck(
    t,
    "operations/check-repository-readme.mjs",
  );
  const project = fixture({
    "README.md":
      '<h1 align="center">Harbor</h1>\n\n## License\n\n[MIT License](LICENSE)\n',
    LICENSE: mit,
  });
  t.after(project.close);
  const outcome = invokeCheck(retainedScript, project.root);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed");
});

test("allows omitted recognized sections and useful interleaved sections", (t) => {
  const outcome = check(t, {
    "README.md": `<div align="center">

# Harbor

</div>

A small tool for inspecting queues.

\`\`\`text
## License
\`\`\`

## Usage

Run \`harbor inspect\`.

#### Architecture

Harbor reads queues without modifying them.

### Contributing

[Contribution requirements](./CONTRIBUTING.md)

### License

[MIT License](./LICENSE)
`,
    LICENSE: mit,
    "CONTRIBUTING.md": "# Contributing\n",
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed");
});

test("reports concrete title and section-order corrections as a policy failure", (t) => {
  const outcome = check(t, {
    "README.md": `\`<h1 align="center">Example</h1>\`

# Harbor

A queue inspector.

## Usage

Run it.

## Features

- Small

## Installation

Install it.

## License

[MIT License](LICENSE)
`,
    LICENSE: mit,
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(outcome.result.message, /Center the Repository README title/);
  assertCorrections(outcome.result.message, [
    generalOrderCorrection,
    installationFirstCorrection,
  ]);
});

test("asks to keep one of each recognized section and to create a missing README", async (t) => {
  for (const example of [
    {
      name: "a repeated section",
      files: {
        "README.md": `<h1 align="center">Harbor</h1>

A queue inspector.

## Usage

Run it.

## Usage

Run it again.

## License

[MIT License](LICENSE)
`,
      },
      correction: "Keep only one Usage section.",
    },
    {
      name: "no README",
      files: {},
      correction: "Create the root README.md.",
    },
  ])
    await t.test(example.name, (st) => {
      const outcome = check(st, { ...example.files, LICENSE: mit });

      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "failed");
      assertCorrections(outcome.result.message, [example.correction]);
    });
});

test("orders recognized sections across Markdown heading forms", (t) => {
  const outcome = check(t, {
    "README.md": `<h1 align="center">Harbor</h1>

A queue inspector.

Usage
-----

Run it.

 # Features

- Small

Installation
============

Install it.

## License

[MIT License](LICENSE)
`,
    LICENSE: mit,
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assertCorrections(outcome.result.message, [
    generalOrderCorrection,
    installationFirstCorrection,
  ]);
});

test("orders and validates sections rendered with HTML headings", (t) => {
  const outcome = check(t, {
    "README.md": `<h1 align="center">Harbor</h1>

A queue inspector.

<h2>Usage</h2>

Run it.

<h2>Features</h2>

- Small

<h2>Installation</h2>

Install it.

<h2>License</h2>

[MIT](LICENSE)
`,
    LICENSE: "MIT\n",
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assertCorrections(outcome.result.message, [
    generalOrderCorrection,
    installationFirstCorrection,
  ]);
  assert.doesNotMatch(outcome.result.message, /Add a License section/);
});

test("leaves the repository license identity to semantic review", (t) => {
  const outcome = check(t, {
    "README.md": `<h1 align="center">Harbor</h1>

A queue inspector.

## License

[0BSD](<LICENSE>)
`,
    LICENSE: "BSD Zero Clause License\n",
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed");
});

test("rejects empty or uncentered rendered titles", async (t) => {
  for (const example of [
    { title: "# #", centeredBlock: true },
    { title: "# &Tab;", centeredBlock: true },
    { title: "# <script>Draft</script>", centeredBlock: true },
    { title: '<h1 align="center">&#32;</h1>' },
    { title: "<div align=centerpiece><h1>Harbor</h1></div>" },
    { title: '<div data-align="center"><h1>Harbor</h1></div>' },
  ])
    await t.test(example.title, (st) => {
      const readme = !example.centeredBlock
        ? `${example.title}

A queue inspector.

## License

[MIT License](LICENSE)
`
        : `<div align="center">

${example.title}

</div>

A queue inspector.

## License

[MIT License](LICENSE)
`;
      const outcome = check(st, { "README.md": readme, LICENSE: mit });

      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "failed");
      assert.match(
        outcome.result.message,
        /Center the Repository README title/,
      );
    });
});

test("ignores headings hidden in HTML comments and raw-text elements", (t) => {
  const outcome = check(t, {
    "README.md": `<!-- <h1 align="center">Draft</h1> -->

<script><h1 align="center">Draft</h1></script>

<h1 align="center"><script>Draft</script></h1>

A queue inspector.

<!-- <h2>License</h2> -->

[MIT License](LICENSE)
`,
    LICENSE: mit,
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(outcome.result.message, /Center the Repository README title/);
  assert.match(outcome.result.message, /Add a License section/);
});

test("preserves centering through nested HTML blocks", (t) => {
  const outcome = check(t, {
    "README.md": `<div align="center">

<div>Logo</div>

# Harbor

</div>

A queue inspector.

## License

[MIT License](LICENSE)
`,
    LICENSE: mit,
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed");
});

test("does not accept navigation links hidden in code or pointing elsewhere", async (t) => {
  for (const example of [
    {
      name: "fenced code",
      body: "```markdown\n[Documentation](docs/README.md)\n```\n",
    },
    { name: "inline code", body: "`[Documentation](docs/README.md)`\n" },
    { name: "indented code", body: "    [Documentation](docs/README.md)\n" },
    { name: "escaped link", body: "\\[Documentation](docs/README.md)\n" },
    {
      name: "external URL",
      body: "[External](https://repository.invalid/project/docs/README.md)\n",
    },
    { name: "parent directory", body: "[Parent](../docs/README.md)\n" },
    { name: "empty section", body: "" },
  ])
    await t.test(example.name, (st) => {
      const outcome = check(st, {
        "README.md": `<h1 align="center">Harbor</h1>

A queue inspector.

## Documentation

${example.body}
## License

[MIT License](LICENSE)
`,
        LICENSE: mit,
        "docs/README.md": "# Documentation\n",
      });

      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "failed");
      assert.match(
        outcome.result.message,
        /Make the Documentation section contain only a link to docs\/README\.md/,
      );
    });
});

test("asks for a label on an unnamed pointer link", (t) => {
  const outcome = check(t, {
    "README.md": `<h1 align="center">Harbor</h1>

A queue inspector.

## Documentation

[](docs/README.md)

## Contributing

[](CONTRIBUTING.md)

## License

[MIT License](LICENSE)
`,
    LICENSE: mit,
    "CONTRIBUTING.md": "# Contributing\n",
    "docs/README.md": "# Documentation\n",
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(outcome.result.message, /Name the Documentation link/);
  assert.match(outcome.result.message, /Name the Contributing link/);
});

test("rejects pointer sections holding anything besides their link", async (t) => {
  const pointers = [
    {
      section: "Contributing",
      target: "CONTRIBUTING.md",
      diagnostic:
        /Make the Contributing section contain only a link to CONTRIBUTING\.md\./,
    },
    {
      section: "Documentation",
      target: "docs/README.md",
      diagnostic:
        /Make the Documentation section contain only a link to docs\/README\.md\./,
    },
    {
      section: "License",
      target: "LICENSE",
      diagnostic: /Make the License section contain only the license link/,
    },
  ];
  for (const example of [
    {
      name: "surrounding prose",
      body: (target) => `Read [the guide](${target}) first.\n`,
    },
    {
      name: "a second link",
      body: (target) =>
        `[Guide](${target})\n\n[Issues](https://repository.invalid/issues)\n`,
    },
    {
      name: "a list of documents",
      body: (target) =>
        `- [Guide](${target})\n- [Usage](docs/usage/README.md)\n`,
    },
    {
      name: "a trailing paragraph",
      body: (target) => `[Guide](${target})\n\nWork is tracked in issues.\n`,
    },
    {
      name: "an image",
      body: (target) => `[Guide](${target}) ![status](status.svg)\n`,
    },
    {
      name: "a table",
      body: (target) =>
        `| Resource | Link |\n| --- | --- |\n| Guide | [Guide](${target}) |\n`,
    },
    {
      name: "a subsection",
      body: (target) => `[Guide](${target})\n\n### Details\n`,
    },
    { name: "a one-item list", body: (target) => `- [Guide](${target})\n` },
    { name: "a quotation", body: (target) => `> [Guide](${target})\n` },
    {
      name: "a one-cell table",
      body: (target) => `| [Guide](${target}) |\n| --- |\n`,
    },
    {
      name: "a linked image",
      body: (target) => `[![Guide](guide.svg)](${target})\n`,
    },
    {
      name: "an HTML list",
      body: (target) => `<ul><li><a href="${target}">Guide</a></li></ul>\n`,
    },
    {
      name: "a div without a paragraph",
      body: (target) => `<div><a href="${target}">Guide</a></div>\n`,
    },
    {
      name: "a bare HTML block",
      body: (target) => `<a href="${target}">\nGuide\n</a>\n`,
    },
  ])
    await t.test(example.name, (st) => {
      const outcome = check(st, {
        "README.md": `<h1 align="center">Harbor</h1>\n\nA queue inspector.\n\n${pointers
          .map(
            ({ section, target }) =>
              `## ${section}\n\n${example.body(target)}\n`,
          )
          .join("")}`,
        LICENSE: mit,
        "CONTRIBUTING.md": "# Contributing\n",
        "docs/README.md": "# Documentation\n",
      });

      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "failed");
      for (const { diagnostic } of pointers)
        assert.match(outcome.result.message, diagnostic);
    });
});

test("keeps pointer sections link-only even when their target is absent", (t) => {
  const outcome = check(t, {
    "README.md": `<h1 align="center">Harbor</h1>

A queue inspector.

## Documentation

- [Usage](docs/usage.md)

## Contributing

Pull requests are welcome.

## License

[MIT License](LICENSE)
`,
    LICENSE: mit,
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(
    outcome.result.message,
    /Make the Documentation section contain only a link to docs\/README\.md and create docs\/README\.md, or remove the section/,
  );
  assert.match(
    outcome.result.message,
    /Make the Contributing section contain only a link to CONTRIBUTING\.md and create CONTRIBUTING\.md, or remove the section/,
  );
});

test("passes pointer sections holding only their link in any rendered form", async (t) => {
  const pointerLinks = (body) =>
    `<h1 align="center">Harbor</h1>\n\nA queue inspector.\n\n## Documentation\n\n${body("docs/README.md")}\n## Contributing\n\n${body("CONTRIBUTING.md")}\n## License\n\n${body("LICENSE")}`;
  for (const example of [
    {
      name: "a Markdown paragraph",
      readme: pointerLinks((target) => `[Guide](${target})\n`),
    },
    {
      name: "an HTML paragraph",
      readme: pointerLinks(
        (target) => `<p><a href="${target}">Guide</a></p>\n`,
      ),
    },
    {
      name: "a centered div around a paragraph",
      readme: pointerLinks(
        (target) =>
          `<div align="center"><p><a href="${target}">Guide</a></p></div>\n`,
      ),
    },
    {
      name: "a comment, a fragment, an HTML heading, and emphasis",
      readme: `<h1 align="center">Harbor</h1>

A queue inspector.

## Documentation

<!-- The documentation map lists every document. -->
[Documentation](./docs/README.md#usage)

<h2>Contributing</h2>

<div><p><a href="CONTRIBUTING.md">Contribution <strong>guidelines</strong></a></p></div>

## License

[MIT License](LICENSE)
`,
    },
    {
      name: "one rendered HTML fragment",
      readme: `<div align="center"><a href="/"><h1>Harbor</h1></a></div>
<p>A queue inspector.</p>
<h2>Documentation</h2><p><a href="docs/README.md#usage">Documentation</a></p>
<h2>Contributing</h2><p><a href="CONTRIBUTING.md">Contributing</a></p>
<a href="#license"><h2>License</h2></a><p><a href="LICENSE">MIT License</a></p>
`,
    },
  ])
    await t.test(example.name, (st) => {
      const outcome = check(st, {
        "README.md": example.readme,
        LICENSE: mit,
        "CONTRIBUTING.md": "# Contributing\n",
        "docs/README.md": "# Documentation\n",
      });

      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "passed", outcome.result.message);
    });
});

test("judges pointer links by every block around them, including blocks shared with the heading", async (t) => {
  const pointers = [
    ["Documentation", "docs/README.md"],
    ["Contributing", "CONTRIBUTING.md"],
    ["License", "LICENSE"],
  ];
  for (const example of [
    {
      name: "a plain div around a paragraph",
      layout: (name, link) => `## ${name}\n\n<div>\n\n${link}\n\n</div>\n`,
      status: "passed",
    },
    {
      name: "nested divs around a paragraph",
      layout: (name, link) =>
        `## ${name}\n\n<div><div align="center">\n\n${link}\n\n</div></div>\n`,
      status: "passed",
    },
    {
      name: "a div around the heading and link",
      layout: (name, link) => `<div>\n\n## ${name}\n\n${link}\n\n</div>\n`,
      status: "passed",
    },
    {
      name: "a quotation around the heading and link",
      layout: (name, link) => `> ## ${name}\n>\n> ${link}\n`,
      status: "failed",
    },
    {
      name: "details around the heading and link",
      layout: (name, link) =>
        `<details open>\n\n## ${name}\n\n${link}\n\n</details>\n`,
      status: "failed",
    },
    {
      name: "a list nested in a paragraph through a button",
      layout: (name, link) =>
        `## ${name}\n\n<p><button><ul><li>\n\n${link}\n\n</li></ul></button></p>\n`,
      status: "failed",
    },
    {
      name: "a quotation nested in a paragraph through a marquee",
      layout: (name, link) =>
        `## ${name}\n\n<p><marquee><blockquote>\n\n${link}\n\n</blockquote></marquee></p>\n`,
      status: "failed",
    },
  ])
    await t.test(example.name, (st) => {
      const outcome = check(st, {
        "README.md": `<h1 align="center">Harbor</h1>\n\nA queue inspector.\n\n${pointers
          .map(([name, target]) => example.layout(name, `[Guide](${target})`))
          .join("\n")}`,
        LICENSE: mit,
        "CONTRIBUTING.md": "# Contributing\n",
        "docs/README.md": "# Documentation\n",
      });

      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(
        outcome.result.status,
        example.status,
        outcome.result.message,
      );
      if (example.status === "failed") {
        assert.match(
          outcome.result.message,
          /Make the Documentation section contain only a link to docs\/README\.md\./,
        );
        assert.match(
          outcome.result.message,
          /Make the Contributing section contain only a link to CONTRIBUTING\.md\./,
        );
        assert.match(
          outcome.result.message,
          /Make the License section contain only the license link/,
        );
      }
    });
});

test("a div shared by several sections holds each pointer link for its own section", (t) => {
  const outcome = check(t, {
    "README.md": `<h1 align="center">Harbor</h1>

A queue inspector.

<div>

## Documentation

[Documentation](docs/README.md)

## Contributing

[Contribution guidelines](CONTRIBUTING.md)

## License

[MIT License](LICENSE)

</div>
`,
    LICENSE: mit,
    "CONTRIBUTING.md": "# Contributing\n",
    "docs/README.md": "# Documentation\n",
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed", outcome.result.message);
});

test("assigns an anchor split around the next heading to that heading", (t) => {
  const outcome = check(t, {
    "README.md": `<h1 align="center">Harbor</h1>

A queue inspector.

## Contributing

[Contribution guidelines](CONTRIBUTING.md)

<a href="#license"><h2>License</h2></a>

[MIT License](LICENSE)
`,
    LICENSE: mit,
    "CONTRIBUTING.md": "# Contributing\n",
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed", outcome.result.message);
});

test("ignores named anchors and hidden media around pointer links", async (t) => {
  for (const example of [
    {
      name: "a named anchor before the next heading",
      contributing:
        '[Contribution guidelines](CONTRIBUTING.md)\n\n<a id="license"></a>\n',
    },
    {
      name: "a named anchor after the link",
      contributing:
        '[Contribution guidelines](CONTRIBUTING.md) <a name="contributing"></a>\n',
    },
    {
      name: "a hidden image inside the link",
      contributing:
        '<a href="CONTRIBUTING.md">Contribution guidelines<img hidden src="badge.svg"></a>\n',
    },
  ])
    await t.test(example.name, (st) => {
      const outcome = check(st, {
        "README.md": `<h1 align="center">Harbor</h1>\n\nA queue inspector.\n\n## Contributing\n\n${example.contributing}\n## License\n\n[MIT License](LICENSE) <a id="end"></a>\n`,
        LICENSE: mit,
        "CONTRIBUTING.md": "# Contributing\n",
      });

      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "passed", outcome.result.message);
    });
});

test("requires pointer sections whose targets exist", (t) => {
  const outcome = check(t, {
    "README.md": `<h1 align="center">Harbor</h1>

A queue inspector.

## License

[MIT License](LICENSE)
`,
    LICENSE: mit,
    "CONTRIBUTING.md": "# Contributing\n",
    "docs/README.md": "# Documentation\n",
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(
    outcome.result.message,
    /Add a Documentation section containing only a link to docs\/README\.md/,
  );
  assert.match(
    outcome.result.message,
    /Add a Contributing section containing only a link to CONTRIBUTING\.md/,
  );
});

test("does not treat links inside section headings as section content", (t) => {
  const outcome = check(t, {
    "README.md": `<h1 align="center">Harbor</h1>

A queue inspector.

## [Contributing](CONTRIBUTING.md)

## [License](LICENSE)
`,
    LICENSE: mit,
    "CONTRIBUTING.md": "# Contributing\n",
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(
    outcome.result.message,
    /Make the Contributing section contain only a link to CONTRIBUTING\.md/,
  );
  assert.match(
    outcome.result.message,
    /Make the License section contain only the license link/,
  );
});

test("reports malformed license sections against the repository license file", async (t) => {
  for (const example of [
    { name: "missing section", body: "", diagnostic: "Add a License section" },
    {
      name: "empty label",
      body: "## License\n\n[](LICENSE)\n",
      diagnostic: "Name the License link",
    },
    {
      name: "wrong target",
      body: "## License\n\n[MIT License](COPYING)\n",
      diagnostic: "target LICENSE",
    },
    {
      name: "extra prose",
      body: "## License\n\nReleased under [MIT License](LICENSE).\n",
      diagnostic: "contain only the license link",
    },
    {
      name: "extra image",
      body: "## License\n\n[MIT License](LICENSE) ![badge](badge.svg)\n",
      diagnostic: "contain only the license link",
    },
  ])
    await t.test(example.name, (st) => {
      const outcome = check(st, {
        "README.md": `<h1 align="center">Harbor</h1>\n\nA queue inspector.\n\n${example.body}`,
        LICENSE: mit,
      });
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "failed");
      assert.match(outcome.result.message, new RegExp(example.diagnostic));
    });
});

test("blocks when licensing is missing or ambiguous instead of selecting a license", async (t) => {
  for (const example of [
    {
      name: "missing, keeping other structural corrections",
      files: {},
      diagnostic: "No root LICENSE file",
      corrections: true,
    },
    {
      name: "another filename",
      files: {
        COPYING: "GNU General Public License\n\nVersion 3, 29 June 2007\n",
      },
      diagnostic: "No root LICENSE file",
    },
    {
      name: "multiple files",
      files: { LICENSE: mit, "LICENSE.md": mit },
      diagnostic: "Multiple root LICENSE variants",
    },
    {
      name: "multiple named licenses",
      files: { LICENSE: mit, "LICENSE-MIT": mit },
      diagnostic: "Multiple root LICENSE variants",
    },
    {
      name: "empty license",
      files: { LICENSE: "\n\n" },
      diagnostic: "is empty",
    },
  ])
    await t.test(example.name, (st) => {
      const outcome = check(st, {
        "README.md":
          "# Harbor\n\nA queue inspector.\n\n## Usage\n\nRun it.\n\n## Features\n\nFast.\n\n## Installation\n\nInstall it.\n",
        ...example.files,
      });
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "blocked");
      assert.match(outcome.result.message, /Owner clarification required/);
      assert.match(outcome.result.message, new RegExp(example.diagnostic));
      if (example.corrections) {
        assert.match(
          outcome.result.message,
          /Center the Repository README title/,
        );
        assertCorrections(outcome.result.message, [
          generalOrderCorrection,
          installationFirstCorrection,
        ]);
      }
    });
});

test("treats invalid public-protocol input as a process error", (t) => {
  const project = fixture({ README: "Project\n" });
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(script, project.root, {
    format: "repo-standards/operation/v2",
  });

  assert.notEqual(outcome.status, 0);
  assert.equal(outcome.stdout, "");
  assert.match(outcome.stderr, /Unsupported operation input format/);
  assert.deepEqual(snapshot(project.root), before);
});

test("rejects an unexpected operation target as a process error", (t) => {
  const project = fixture({ README: "Project\n" });
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(script, project.root, {
    allowedTargets: { paths: ["docs/README.md"], directories: [] },
  });

  assert.notEqual(outcome.status, 0);
  assert.equal(outcome.stdout, "");
  assert.match(outcome.stderr, /exact README.md target/);
  assert.deepEqual(snapshot(project.root), before);
});
