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

function entryReadme(description, { wrapped = true } = {}) {
  const introduction = `<h1 align="center">Harbor</h1>
<p align="center">${description}</p>`;
  return `${wrapped ? `<div align="center">\n${introduction}\n</div>` : introduction}

## License

[MIT License](LICENSE)
`;
}

test("returns a centering correction for a linked image in a heading before the title", (t) => {
  const outcome = check(t, {
    "README.md": `<h1><a href="https://example.com"><img src="harbor.svg" alt=""></a></h1>\n\n${entryReadme("A delivery service for operators.")}`,
    LICENSE: mit,
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.format, "repo-standards/result/v2");
  assert.equal(outcome.result.status, "failed");
  assert.match(outcome.result.message, /Center.*project image.*harbor\.svg/);
});

test("heading wrappers preserve prefix image counting, centering, and visible content", async (t) => {
  for (const [
    name,
    prefix,
    diagnostic,
  ] of /** @type {[string, string, RegExp?][]} */ ([
    [
      "centered image",
      '<div align="center"><h1><img src="harbor.svg" alt=""></h1></div>',
    ],
    [
      "centered linked image",
      '<div align="center"><h1><a href="https://example.com"><img src="harbor.svg" alt=""></a></h1></div>',
    ],
    [
      "linked picture",
      '<div align="center"><h2><a href="https://example.com"><picture><source srcset="dark.svg"><img src="harbor.svg" alt=""></picture></a></h2></div>',
    ],
    [
      "hidden targets",
      '<div align="center"><h1><a href="https://example.com"><span hidden>Hidden</span><img hidden src="hidden.svg"><img src="harbor.svg" alt=""></a></h1></div>',
    ],
    [
      "uncentered image",
      '<h1><img src="harbor.svg" alt=""></h1>',
      /Center.*project image.*harbor\.svg/,
    ],
    [
      "two linked images",
      '<div align="center"><h1><a href="https://example.com"><img src="one.svg" alt=""><img src="two.svg" alt=""></a></h1></div>',
      /Keep at most one project image.*one\.svg.*two\.svg/,
    ],
    [
      "separately linked images",
      '<div align="center"><h2><a href="https://example.com/one"><img src="one.svg" alt=""></a><a href="https://example.com/two"><img src="two.svg" alt=""></a></h2></div>',
      /Keep at most one project image.*one\.svg.*two\.svg/,
    ],
    [
      "Markdown text link",
      "## [Website](https://example.com)",
      /Remove rendered content "Website" before.*title/,
    ],
    [
      "linked non-image media",
      '<h2><a href="https://example.com"><video src="tour.mp4"></video></a></h2>',
      /Remove rendered content "video" before.*title/,
    ],
  ])) {
    await t.test(name, (t) => {
      const outcome = check(t, {
        "README.md": `${prefix}\n\n${entryReadme("A delivery service for operators.")}`,
        LICENSE: mit,
      });
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.format, "repo-standards/result/v2");
      assert.equal(
        outcome.result.status,
        diagnostic ? "failed" : "passed",
        outcome.result.message,
      );
      if (diagnostic) assert.match(outcome.result.message, diagnostic);
    });
  }
});

test("rejects an uncentered project image before the title", (t) => {
  const outcome = check(t, {
    "README.md": `<img src="harbor.svg" alt="">\n\n${entryReadme("A delivery service for operators.")}`,
    LICENSE: mit,
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(outcome.result.message, /Center.*project image.*harbor\.svg/);
});

test("rejects unrelated rendered content and extra images before the title", async (t) => {
  for (const [
    name,
    prefix,
    diagnostic,
  ] of /** @type {[string, string, RegExp][]} */ ([
    ["prose", "Welcome aboard.\n\n", /Welcome aboard/],
    ["heading", "## Welcome\n\n", /Welcome/],
    ["media", '<video src="tour.mp4"></video>\n\n', /video/],
    ["rule", "---\n\n", /hr/],
    [
      "two images",
      '<img align="center" src="one.svg"><img align="center" src="two.svg">\n\n',
      /one\.svg.*two\.svg/,
    ],
    [
      "image and prose",
      '<p align="center"><img src="harbor.svg">Welcome aboard.</p>\n\n',
      /Welcome aboard/,
    ],
    [
      "linked prose",
      '<a href="https://example.com/">Welcome aboard.</a>\n\n',
      /Welcome aboard/,
    ],
  ])) {
    await t.test(name, (t) => {
      const outcome = check(t, {
        "README.md": `${prefix}${entryReadme("A delivery service for operators.")}`,
        LICENSE: mit,
      });
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "failed");
      assert.match(outcome.result.message, /before.*title/);
      assert.match(outcome.result.message, diagnostic);
    });
  }
});

test("accepts one centered project image, including theme alternatives", async (t) => {
  const picture = `<picture>
<source media="(prefers-color-scheme: dark)" srcset="harbor-dark.svg">
<source media="(prefers-color-scheme: light)" srcset="harbor-light.svg">
<img src="harbor-light.svg" alt="">
</picture>`;
  for (const [name, image] of [
    ["plain", '<img src="harbor.svg" alt="">'],
    ["picture", picture],
    ["linked picture", `<a href="https://example.com/">${picture}</a>`],
    ["Markdown", "![Harbor](harbor.svg)"],
  ]) {
    for (const wrapped of [true, false]) {
      await t.test(`${name}, shared wrapper: ${wrapped}`, (t) => {
        const separateImage =
          name === "Markdown"
            ? `<div align="center">\n\n${image}\n\n</div>`
            : `<p align="CENTER">${image}</p>`;
        const header = wrapped
          ? `<div align="center">\n\n${image}\n\n<h1>Harbor</h1>\n<p>A delivery service for operators.</p>\n<p><img src="node.svg" alt="Node.js 24"></p>\n</div>`
          : `${separateImage}\n<h1 align="center">Harbor</h1>\n<p align="center">A delivery service for operators.</p>\n<p align="center"><img src="node.svg" alt="Node.js 24"></p>`;
        const outcome = check(t, {
          "README.md": `${header}\n\n## License\n\n[MIT License](LICENSE)\n`,
          LICENSE: mit,
        });
        assert.equal(outcome.status, 0, outcome.stderr);
        assert.equal(outcome.result.status, "passed", outcome.result.message);
      });
    }
  }
});

test("project images use rendered centering rather than misleading or hidden markup", async (t) => {
  for (const [name, prefix] of [
    ["image data-align", '<img data-align="center" src="harbor.svg">'],
    ["image centerpiece", '<img align="centerpiece" src="harbor.svg">'],
    [
      "wrapper data-align",
      '<div data-align="center"><img src="harbor.svg"></div>',
    ],
    [
      "paragraph centerpiece",
      '<p align="centerpiece"><img src="harbor.svg"></p>',
    ],
    [
      "comment",
      '<!-- <div align="center"> --><img src="harbor.svg"><!-- </div> -->',
    ],
    [
      "hidden duplicate",
      '<div hidden align="center"><img src="harbor.svg"></div><img src="harbor.svg">',
    ],
    [
      "picture",
      '<picture><source media="(prefers-color-scheme: dark)" srcset="dark.svg"><img src="harbor.svg"></picture>',
    ],
    [
      "picture data-align",
      '<picture data-align="center"><img src="harbor.svg"></picture>',
    ],
  ]) {
    await t.test(name, (t) => {
      const outcome = check(t, {
        "README.md": `${prefix}\n\n${entryReadme("A delivery service for operators.")}`,
        LICENSE: mit,
      });
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "failed");
      assert.match(
        outcome.result.message,
        /Center.*project image.*harbor\.svg/,
      );
    });
  }
});

test("only rendered project images count, and a picture needs one visible fallback", async (t) => {
  for (const [name, prefix, status] of [
    ["comments", '<!-- <img src="ignored.svg"> -->', "passed"],
    [
      "nonrendered content",
      '<script>Ignored</script><style>Ignored</style><template><img src="ignored.svg"></template><div hidden>Ignored</div>',
      "passed",
    ],
    [
      "one visible image",
      '<img hidden src="ignored.svg"><img align="center" src="harbor.svg">',
      "passed",
    ],
    ["own centering", '<img align="CENTER" src="harbor.svg">', "passed"],
    [
      "fallback centering",
      '<picture><source srcset="dark.svg"><img align="center" src="harbor.svg"></picture>',
      "passed",
    ],
    [
      "hidden picture",
      '<picture hidden><img src="ignored.svg"></picture>',
      "passed",
    ],
    [
      "picture without fallback",
      '<p align="center"><picture><source srcset="dark.svg"></picture></p>',
      "failed",
    ],
    [
      "picture with hidden fallback",
      '<p align="center"><picture><img hidden src="harbor.svg"></picture></p>',
      "failed",
    ],
    [
      "picture with empty fallback",
      '<p align="center"><picture><img src=""></picture></p>',
      "failed",
    ],
    [
      "picture with prose",
      '<p align="center"><picture><img src="harbor.svg">Welcome</picture></p>',
      "failed",
    ],
    [
      "picture with two images",
      '<p align="center"><picture><img src="one.svg"><img src="two.svg"></picture></p>',
      "failed",
    ],
    [
      "two pictures",
      '<p align="center"><picture><img src="one.svg"></picture><picture><img src="two.svg"></picture></p>',
      "failed",
    ],
    [
      "linked images",
      '<p align="center"><a href="https://example.com/"><img src="one.svg"><img src="two.svg"></a></p>',
      "failed",
    ],
  ]) {
    await t.test(name, (t) => {
      const outcome = check(t, {
        "README.md": `${prefix}\n\n${entryReadme("A delivery service for operators.")}`,
        LICENSE: mit,
      });
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, status, outcome.result.message);
      if (status === "failed")
        assert.match(outcome.result.message, /before.*title/);
    });
  }
});

test("a project image does not supply the description or hide uncentered badges", (t) => {
  const outcome = check(t, {
    "README.md": `<img align="center" src="harbor.svg" alt="This is an image, not the description.">
<h1 align="center">Harbor</h1>
<p align="center">A service. Another service.</p>
<img src="node.svg" alt="Node.js 24">

## License

[MIT License](LICENSE)
`,
    LICENSE: mit,
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(outcome.result.message, /description.*one sentence/);
  assert.match(outcome.result.message, /Center.*badges/);
  assert.doesNotMatch(outcome.result.message, /project image/);
});

test("rejects Postern's title-only centered header with a description correction", (t) => {
  // Postern at 3ff9017ebf9384e5e27d4790519d03511c9ab2c7, before postern#10.
  const outcome = check(t, {
    "README.md": `<h1 align="center">Postern</h1>

Postern is a Node.js library that gives developers building tools one interface to code hosting platforms such as GitHub, for issues, pull requests, releases and access, and reports only facts the platform states.

[![Node.js 24 or 26](https://img.shields.io/badge/Node.js-24%20or%2026-339933?logo=nodedotjs)](https://nodejs.org/)

## License

[MIT License](LICENSE)
`,
    LICENSE: mit,
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(
    outcome.result.message,
    /Center the Repository README description/,
  );
  assert.match(outcome.result.message, /Center the Repository README badges/);
});

test("rejects left-aligned badges after a centered description", async (t) => {
  for (const badges of [
    "[![Node.js](node.svg)](https://nodejs.org/)",
    '<p><img src="typescript.svg" alt="TypeScript"></p>',
    '<p><img align="center" src="typescript.svg"><a href="https://nodejs.org/"><img src="node.svg"></a></p>',
    '<p align="center"><img src="typescript.svg"></p>\n\n![Node.js](node.svg)',
  ]) {
    await t.test(badges, (t) => {
      const outcome = check(t, {
        "README.md": entryReadme("A delivery service for operators.", {
          wrapped: false,
        }).replace("## License", `${badges}\n\n## License`),
        LICENSE: mit,
      });
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "failed");
      assert.match(
        outcome.result.message,
        /Center the Repository README badges/,
      );
      assert.doesNotMatch(
        outcome.result.message,
        /Center the Repository README description/,
      );
    });
  }
});

test("accepts centered header blocks in HTML, Markdown and mixed forms", async (t) => {
  for (const header of [
    `<div align="center"><h1>Harbor</h1><p>A delivery service for operators.</p>
<p><img src="typescript.svg" alt="TypeScript"><a href="https://nodejs.org/"><img src="node.svg" alt="Node.js 24"></a></p></div>`,
    `<h1 align="center">Harbor</h1><p align="CENTER">A delivery service for operators.</p>
<p align="CeNtEr"><img src="typescript.svg" alt="TypeScript"><a href="https://nodejs.org/"><img src="node.svg" alt="Node.js 24"></a></p>`,
    `<div align="CENTER">

# Harbor

<p align="center">A delivery service for operators.</p>

![TypeScript](typescript.svg) [![Node.js 24](node.svg)](https://nodejs.org/)

<div><p><img src="other.svg" alt="Other"></p></div>

</div>`,
    `<div align="center"><h1>Harbor</h1><p>A delivery service for operators.</p>
<img src="typescript.svg" alt="TypeScript"><a href="https://nodejs.org/"><img src="node.svg" alt="Node.js 24"></a></div>`,
    `<h1 align="center">Harbor</h1><p align="center">A delivery service for operators.</p>
<p><img align="CENTER" src="typescript.svg" alt="TypeScript"></p>
<p align="center"><a href="https://nodejs.org/"><img src="node.svg" alt="Node.js 24"></a></p>`,
    `<div align="center"><h1>Harbor</h1><p>A delivery service for operators.</p></div>`,
  ]) {
    await t.test(header, (t) => {
      const outcome = check(t, {
        "README.md": `${header}\n\n## License\n\n[MIT License](LICENSE)\n`,
        LICENSE: mit,
      });
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "passed", outcome.result.message);
    });
  }
});

test("rejects misleading or hidden centering for descriptions and badges", async (t) => {
  for (const [name, wrap] of /** @type {[string, Function][]} */ ([
    ["centerpiece", (content) => `<div align="centerpiece">${content}</div>`],
    [
      "paragraph centerpiece",
      (content) => content.replaceAll("<p>", '<p align="centerpiece">'),
    ],
    [
      "paragraph data-align",
      (content) => content.replaceAll("<p>", '<p data-align="center">'),
    ],
    ["data-align", (content) => `<div data-align="center">${content}</div>`],
    [
      "comment",
      (content) => `<!-- <div align="center"> -->${content}<!-- </div> -->`,
    ],
    [
      "hidden",
      (content) => `<div hidden align="center">${content}</div>${content}`,
    ],
    [
      "hidden paragraph",
      (content) => `<p hidden align="center">Ignored</p>${content}`,
    ],
  ])) {
    await t.test(name, (t) => {
      const outcome = check(t, {
        "README.md": `<h1 align="center">Harbor</h1>\n${wrap('<p>A delivery service for operators.</p><p><a href="https://nodejs.org/"><img src="node.svg" alt="Node.js 24"></a></p>')}\n\n## License\n\n[MIT License](LICENSE)\n`,
        LICENSE: mit,
      });
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "failed");
      assert.match(
        outcome.result.message,
        /Center the Repository README description/,
      );
      assert.match(
        outcome.result.message,
        /Center the Repository README badges/,
      );
    });
  }
});

test("stops checking badges at the next heading or other rendered content", async (t) => {
  for (const content of [
    "More information.",
    "## Details",
    '<a href="guide.md">Guide</a>',
    '<a href="guide.md"><img src="guide.svg"> Guide</a>',
    "---",
    "`![Example](example.svg)`",
  ]) {
    await t.test(content, (t) => {
      const outcome = check(t, {
        "README.md": entryReadme("A delivery service for operators.").replace(
          "## License",
          `${content}\n\n![Example](example.svg)\n\n## License`,
        ),
        LICENSE: mit,
      });
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "passed", outcome.result.message);
    });
  }
});

test("requires the Repository README description to be one sentence", (t) => {
  const outcome = check(t, {
    "README.md": entryReadme("A delivery service. It serves operators."),
    LICENSE: mit,
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(outcome.result.message, /description.*one sentence/);
});

test("names a root glossary term used in the description regardless of case", (t) => {
  const outcome = check(t, {
    "README.md": entryReadme("A FRONTIER explorer for operators."),
    LICENSE: mit,
    "GLOSSARY.md":
      "# Harbor\n\n## Language\n\n**Frontier**:\nThe work awaiting a run.\n",
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "failed");
  assert.match(outcome.result.message, /Frontier.*GLOSSARY\.md/);
});

test("checks only whole glossary terms from the root and mapped contexts", async (t) => {
  const glossaries = {
    "GLOSSARY.md": `# Harbor

## Language

**Project**:
A maintained service.
_Avoid_: App

**C++**:
Our delivery dialect.

**C&amp;D**:
Our delivery grouping.
`,
    "GLOSSARY-MAP.md": `# Glossary map

## Contexts

- [Harbor](./GLOSSARY.md): shared language.
- [Runs](runs/GLOSSARY.md#language): execution language.

## Relationships

- [Unlisted](other/GLOSSARY.md): unrelated reference.
`,
    "runs/GLOSSARY.md":
      "# Runs\n\n## Language\n\n**Run outcome**:\nHow a run ended.\n",
    "other/GLOSSARY.md": "# Other\n\n**Delivery**:\nAn unrelated definition.\n",
    "unmapped/GLOSSARY.md":
      "# Unmapped\n\n**Service**:\nAn unmapped definition.\n",
  };
  for (const [
    description,
    status,
    diagnostic,
  ] of /** @type {[string, string, RegExp?][]} */ ([
    [
      "A RUN\nOUTCOME viewer for operators.",
      "failed",
      /Run outcome.*runs\/GLOSSARY\.md/,
    ],
    ["A project for operators.", "failed", /Project.*GLOSSARY\.md/],
    ["A C++ delivery service for operators.", "failed", /C\+\+.*GLOSSARY\.md/],
    [
      "A C&amp;D delivery service for operators.",
      "failed",
      /C&D.*GLOSSARY\.md/,
    ],
    ["A projection and run outcomes delivery service for operators.", "passed"],
    ["A project-based, multi‐project service for operators.", "passed"],
    ["A service for operators, one per project.", "failed", /Project/],
    ["A per_project service for operators.", "failed", /Project/],
    ["A \u20acproject fund for operators.", "passed"],
  ])) {
    await t.test(description, (t) => {
      const outcome = check(t, {
        ...glossaries,
        "README.md": entryReadme(description),
        LICENSE: mit,
      });
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, status, outcome.result.message);
      if (diagnostic) assert.match(outcome.result.message, diagnostic);
    });
  }
});

test("requires a rendered description immediately after the title", async (t) => {
  for (const description of [
    null,
    "A service for operators",
    "A service! Another service?",
  ]) {
    await t.test(String(description), (t) => {
      const readme =
        description === null
          ? entryReadme("ignored").replace(
              '<p align="center">ignored</p>',
              "<!-- A service for operators. -->",
            )
          : entryReadme(description);
      const outcome = check(t, { "README.md": readme, LICENSE: mit });
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "failed");
      assert.match(outcome.result.message, /description.*one sentence/);
    });
  }
});

test("passes a description in a repository without a glossary", (t) => {
  const outcome = check(t, {
    "README.md": entryReadme("A delivery service for operators."),
    LICENSE: mit,
  });
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed", outcome.result.message);
});

test("passes descriptions captured from existing repository introductions", async (t) => {
  const cases = JSON.parse(
    readFileSync(
      new URL("./fixtures/entry-document-descriptions.json", import.meta.url),
      "utf8",
    ),
  );
  for (const {
    repository,
    commit,
    source,
    description,
    wrapped,
    glossaries,
  } of cases) {
    await t.test(`${repository} at ${commit ?? source}`, (t) => {
      const outcome = check(t, {
        ...glossaries,
        "README.md": entryReadme(description, { wrapped }),
        LICENSE: mit,
      });
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(outcome.result.status, "passed", outcome.result.message);
    });
  }
});

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

<p align="center">A queue-backed service for reliable message delivery.</p>

<p align="center"><img src="https://img.shields.io/badge/Node.js-24-green" alt="Node.js 24"></p>

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
    format: "repo-standards/result/v2",
    status: "passed",
    message:
      "Repository README structure is valid; factual content still requires maintainer or agent review.",
  });
});

test("passes an all-rights-reserved notice with its matching License link", (t) => {
  const outcome = check(t, {
    "README.md":
      '<h1 align="center">Harbor</h1>\n\n<p align="center">A delivery service for operators.</p>\n\n## License\n\n[All rights reserved](LICENSE)\n',
    LICENSE: "Copyright (c) 2026 Example\n\nAll rights reserved.\n",
  });

  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed");
});

test("runs from its declared retained source layout", (t) => {
  const retainedScript = retainedCheck(
    t,
    "operations/check-repository-readme.mjs",
  );
  const project = fixture({
    "README.md":
      '<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="harbor-dark.svg"><img src="harbor-light.svg" alt=""></picture></p>\n<h1 align="center">Harbor</h1>\n\n<p align="center">A delivery service for operators.</p>\n\n## License\n\n[MIT License](LICENSE)\n',
    LICENSE: mit,
  });
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(retainedScript, project.root);
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.equal(outcome.result.status, "passed");
  assert.deepEqual(snapshot(project.root), before);
});

test("allows omitted recognized sections and useful interleaved sections", (t) => {
  const outcome = check(t, {
    "README.md": `<div align="center">

# Harbor

</div>

<p align="center">A small tool for inspecting queues.</p>

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

<p align="center">A queue inspector.</p>

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

<p align="center">A queue inspector.</p>

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

<p align="center">A queue inspector.</p>

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

<p align="center">A queue inspector.</p>

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

<p align="center">A queue inspector.</p>

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

<p align="center">A queue inspector.</p>

## License

[MIT License](LICENSE)
`
        : `<div align="center">

${example.title}

</div>

<p align="center">A queue inspector.</p>

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

<p align="center">A queue inspector.</p>

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

<div><img src="harbor.svg" alt=""></div>

# Harbor

</div>

<p align="center">A queue inspector.</p>

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

<p align="center">A queue inspector.</p>

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

<p align="center">A queue inspector.</p>

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
        "README.md": `<h1 align="center">Harbor</h1>\n\n<p align="center">A queue inspector.</p>\n\n${pointers
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

<p align="center">A queue inspector.</p>

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
    `<h1 align="center">Harbor</h1>\n\n<p align="center">A queue inspector.</p>\n\n## Documentation\n\n${body("docs/README.md")}\n## Contributing\n\n${body("CONTRIBUTING.md")}\n## License\n\n${body("LICENSE")}`;
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

<p align="center">A queue inspector.</p>

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
<p align="center">A queue inspector.</p>
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
        "README.md": `<h1 align="center">Harbor</h1>\n\n<p align="center">A queue inspector.</p>\n\n${pointers
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

<p align="center">A queue inspector.</p>

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

<p align="center">A queue inspector.</p>

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
        "README.md": `<h1 align="center">Harbor</h1>\n\n<p align="center">A queue inspector.</p>\n\n## Contributing\n\n${example.contributing}\n## License\n\n[MIT License](LICENSE) <a id="end"></a>\n`,
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

<p align="center">A queue inspector.</p>

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

<p align="center">A queue inspector.</p>

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
        "README.md": `<h1 align="center">Harbor</h1>\n\n<p align="center">A queue inspector.</p>\n\n${example.body}`,
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
      name: "another filename linked from the License section",
      readme: `<h1 align="center">Harbor</h1>

<p align="center">A queue inspector.</p>

## License

[GNU General Public License](COPYING)
`,
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
          example.readme ??
          '# Harbor\n\n<p align="center">A queue inspector.</p>\n\n## Usage\n\nRun it.\n\n## Features\n\nFast.\n\n## Installation\n\nInstall it.\n',
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
    format: "repo-standards/operation/v1",
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
