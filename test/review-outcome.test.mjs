import assert from "node:assert/strict";
import test from "node:test";
import {
  completeReview,
  holdingReview,
  reviewedHead,
  reviewTemplate,
} from "../.agents/skills/babysit/review-outcome.mjs";

const head = "a".repeat(40);
const review = `Head: ${head}
Standards: Passed; checked the documented rules.
Spec: Passed; verified every acceptance criterion of #815.
Fixed: Nothing
Findings: None`;
const finding = "- `src/ledger.mjs:12` Refunds are missing from the total.";
const withFinding = review.replace("Findings: None", `Findings:\n${finding}`);
const examples = [
  (body) => `\`\`\`markdown\n${body}\n\`\`\``,
  (body) => `~~~~markdown\n${body}\n~~~~`,
  (body) => body.replace(/^/gm, "> "),
  (body) => body.replace(/^/gm, "    "),
  (body) => body.replace(/^/gm, "\t"),
  (body) => `- > Example\n${body.replace(/^/gm, "  > ")}`,
  (body) => `1. > Example\n${body.replace(/^/gm, "   > ")}`,
  (body) => `- - > Example\n${body.replace(/^/gm, "    > ")}`,
  (body) => `- \`\`\`markdown\n${body.replace(/^/gm, "  ")}\n  \`\`\``,
  (body) => `1. ~~~markdown\n${body.replace(/^/gm, "   ")}\n   ~~~`,
  (body) => `- - \`\`\`markdown\n${body.replace(/^/gm, "    ")}\n    \`\`\``,
  (body) => `<pre>\n${body}\n</pre>`,
  (body) => `<details>\n${body}\n</details>`,
  (body) => `<script>\n${body}\n</script>`,
  (body) => `- <pre>\n${body.replace(/^/gm, "  ")}\n  </pre>`,
  (body) => `<!--\n${body}\n-->`,
];
const inlineExamples = [
  ...[
    "script",
    "style",
    "pre",
    "code",
    "kbd",
    "textarea",
    "title",
    "xmp",
    "iframe",
    "noembed",
    "noframes",
  ].map(
    (tag) => (body) =>
      `- prefix <${tag}>\n${body.replace(/^/gm, "  ")}\n  </${tag}>`,
  ),
  (body) => `- [label](/target "title\n${body.replace(/^/gm, "  ")}\n  end")`,
  (body) => `- [label](/target 'title\n${body.replace(/^/gm, "  ")}\n  end')`,
  (body) => `- [label](/target (title\n${body.replace(/^/gm, "  ")}\n  end))`,
  (body) => `- ![label](/target "title\n${body.replace(/^/gm, "  ")}\n  end")`,
  (body) => `- ![label\n${body.replace(/^/gm, "  ")}\n  end](/target)`,
  (body) =>
    `- <span title="title\n${body.replace(/^/gm, "  ")}\n  end">label</span>`,
  (body) => `- \`\`example\n${body.replace(/^/gm, "  ")}\n  end\`\``,
];

test("lazy blockquote continuations nested in lists cannot supply a review", () => {
  for (const opening of [
    "- > Example",
    "1. > Example",
    "- outer:\n  - > Example",
  ]) {
    const body = `${opening}\n${review}`;
    assert.equal(reviewedHead(body), null, body);
    assert.equal(completeReview(body, head), false, body);
    assert.equal(holdingReview(body, head), false, body);
  }
});

test("content omitted by tokenization cannot expose a nested example", () => {
  const definitions = `[r]: /a\n\n  [r]: /b\n  "${"title\n  ".repeat(4)}end"`;
  for (const opening of [
    `- example:\n\n  ${definitions}\n\n  > Example`,
    `- example:\n  ${definitions}\n  > Example`,
    `- outer:\n  - example:\n\n    ${definitions.replaceAll("\n  ", "\n    ")}\n\n    > Example`,
  ]) {
    const body = `${opening}\n${review}`;
    assert.equal(reviewedHead(body), null, body);
    assert.equal(completeReview(body, head), false, body);
    assert.equal(holdingReview(body, head), false, body);
    const visible = `${opening}\n\n${review}`;
    assert.equal(reviewedHead(visible), head, visible);
    assert.equal(completeReview(visible, head), true, visible);
    assert.equal(holdingReview(visible, head), true, visible);
  }
});

test("list continuations keep visible fields, and nested items are not findings", () => {
  for (const body of [
    `${withFinding}\nSpec: Passed again`,
    `${withFinding}\n  Spec: Passed again`,
  ]) {
    assert.equal(completeReview(body, head), false, body);
  }
  const nested = `${withFinding}\n  - a note on the finding\n  continued`;
  assert.equal(completeReview(nested, head), true);
  assert.equal(holdingReview(nested, head), false);
});

test("task-list findings retain their visible checkbox and cannot become holding evidence", () => {
  for (const checkbox of ["[ ]", "[x]"]) {
    for (const text of [
      "src/ledger.mjs:12 Refunds are missing.",
      "An invalid finding.",
      "<!-- hidden -->",
    ]) {
      for (const findings of ["None", ""]) {
        const body =
          review.replace("Findings: None", `Findings: ${findings}`) +
          `\n- ${checkbox} ${text}`;
        assert.equal(reviewedHead(body), head, body);
        assert.equal(completeReview(body, head), false, body);
        assert.equal(holdingReview(body, head), false, body);
      }
    }
    const body = `- ${checkbox} Spec: Example outcome\n\n${review}`;
    assert.equal(holdingReview(body, head), true, body);
  }
});

test("separate fenced verification output preserves a completed review", () => {
  for (const fence of ["```", "~~~"]) {
    const log = `${fence}text\npnpm check\nAll checks passed\n${fence}`;
    for (const body of [`${log}\n\n${review}`, `${review}\n\n${log}`]) {
      assert.equal(reviewedHead(body), head);
      assert.equal(completeReview(body, head), true);
      assert.equal(holdingReview(body, head), true);
    }
  }
});

test("HTML comments before, after and between fields leave visible evidence intact", () => {
  for (const body of [
    `<!-- verification marker -->\n${review}`,
    `${review}\n<!-- verification marker -->`,
    review.replace("Fixed:", "<!-- verification\nmarker -->\nFixed:"),
    review.replace("Fixed: Nothing", "Fixed: Nothing <!-- verified -->"),
    review.replaceAll("\n", "\r\n") + "\r\n<!-- marker -->",
  ]) {
    assert.equal(reviewedHead(body), head);
    assert.equal(completeReview(body, head), true);
    assert.equal(holdingReview(body, head), true);
  }
});

test("example fields and finding items neither duplicate nor alter visible evidence", () => {
  for (const example of examples) {
    for (const visible of [review, withFinding]) {
      for (const body of [
        `${example(withFinding)}\n\n${visible}`,
        `${visible}\n\n${example(withFinding)}`,
        `${visible}\n\n${example("- an invalid example finding")}`,
      ]) {
        assert.equal(reviewedHead(body), head, body);
        assert.equal(completeReview(body, head), true, body);
        assert.equal(holdingReview(body, head), visible === review, body);
      }
    }
  }
});

test("excluded examples cannot supply a review, a missing field or a missing finding", () => {
  for (const example of examples) {
    assert.equal(reviewedHead(example(review)), null);
    assert.equal(completeReview(example(review), head), false);
    assert.equal(holdingReview(example(review), head), false);
    for (const key of ["Head", "Standards", "Spec", "Fixed", "Findings"]) {
      const line = review
        .split("\n")
        .find((line) => line.startsWith(`${key}:`));
      const body = `${review.replace(line, "")}\n\n${example(line)}`;
      assert.equal(completeReview(body, head), false, body);
      assert.equal(holdingReview(body, head), false, body);
    }
    const body = `${review.replace("Findings: None", "Findings:")}\n\n${example(finding)}`;
    assert.equal(completeReview(body, head), false, body);
    assert.equal(holdingReview(body, head), false, body);
  }
});

test("nested examples preserve genuine findings in the same list", () => {
  for (const example of [
    "  > Example\n  Spec: Hidden duplicate\n  > - invalid example finding",
    "  ```text\n  <!-- unclosed\n  - invalid example finding\n  ```",
    "  - ```text\n    <!-- unclosed\n    - invalid example finding\n    ```",
  ]) {
    const body = `${withFinding}\n${example}\n\n- src/ledger.mjs:24 Another actual finding.`;
    assert.equal(reviewedHead(body), head, body);
    assert.equal(completeReview(body, head), true, body);
    assert.equal(holdingReview(body, head), false, body);
  }
});

test("unterminated fences and comments keep their contents excluded", () => {
  for (const opening of ["```markdown", "~~~text", "<!--"]) {
    const example = `${opening}\n${withFinding}`;
    assert.equal(reviewedHead(example), null);
    assert.equal(completeReview(example, head), false);
    assert.equal(holdingReview(example, head), false);
    const body = `${review}\n\n${example}`;
    assert.equal(reviewedHead(body), head);
    assert.equal(completeReview(body, head), true);
    assert.equal(holdingReview(body, head), true);
  }
});

test("fence kind and length determine where example content ends", () => {
  for (const example of [
    `\`\`\`\`markdown\n${withFinding}\n\`\`\`\n${withFinding}\n\`\`\`\`\``,
    `~~~~markdown\n${withFinding}\n~~~\n${withFinding}\n~~~~~`,
    `\`\`\`markdown\n${withFinding}\n~~~\n${withFinding}\n\`\`\``,
    `   ~~~markdown\n${withFinding}\n   ~~~`,
  ]) {
    const body = `${example}\n\n${review}`;
    assert.equal(reviewedHead(body), head, body);
    assert.equal(completeReview(body, head), true, body);
    assert.equal(holdingReview(body, head), true, body);
  }
});

test("comment and fence markers inside examples do not hide later visible fields", () => {
  for (const example of examples.slice(0, -1)) {
    const body = `${example("<!-- never closed\n~~~text")}\n\n${review}`;
    assert.equal(completeReview(body, head), true, body);
    assert.equal(holdingReview(body, head), true, body);
  }
  const body = `<!--\n\`\`\` never closed\n-->\n${review}`;
  assert.equal(completeReview(body, head), true);
  const nested = `- example:\n  \`\`\`text\n  <!-- unclosed\n  \`\`\`\n\n${review}`;
  assert.equal(reviewedHead(nested), head);
  assert.equal(completeReview(nested, head), true);
  assert.equal(holdingReview(nested, head), true);
});

test("comment markers rendered as text do not hide later visible fields", () => {
  for (const spec of [
    "Passed; the parser keeps `<!--` in code spans as text.",
    "Passed; `<!-- x -->` stays text too.",
    "Passed; an unclosed <!-- marker renders as text.",
  ]) {
    const body = review.replace(/^Spec:.*$/m, `Spec: ${spec}`);
    assert.equal(reviewedHead(body), head, body);
    assert.equal(completeReview(body, head), true, body);
    assert.equal(holdingReview(body, head), true, body);
  }
});

test("comments inside inline formatting stay hidden", () => {
  for (const wrap of [(c) => `**${c}**`, (c) => `[${c}](/a)`]) {
    const line = review.split("\n").find((line) => line.startsWith("Spec:"));
    const hidden = review.replace(line, wrap(`<!--\n${line}\n-->`));
    assert.equal(completeReview(hidden, head), false, hidden);
    assert.equal(holdingReview(hidden, head), false, hidden);
    const visible = review.replace(line, `${line} ${wrap("a <!-- b --> c")}`);
    assert.equal(completeReview(visible, head), true, visible);
    assert.equal(holdingReview(visible, head), true, visible);
  }
});

test("formatting around hidden content cannot supply an outcome", () => {
  for (const key of ["Standards", "Spec", "Fixed"]) {
    for (const value of [
      "**<!-- no outcome -->**",
      "*<!-- no outcome -->*",
      "~~<!-- no outcome -->~~",
      "**_<!-- no outcome -->_**",
      "**<code>hidden outcome</code>**",
      "**[<!-- no outcome -->](/target)**",
    ]) {
      const body = review.replace(
        new RegExp(`^${key}:.*$`, "m"),
        `${key}: ${value}`,
      );
      assert.equal(completeReview(body, head), false, body);
      assert.equal(holdingReview(body, head), false, body);
    }
    const body = review.replace(
      new RegExp(`^${key}:.*$`, "m"),
      `${key}: **Passed <!-- note -->**`,
    );
    assert.equal(holdingReview(body, head), true, body);
  }
});

test("quoted HTML keeps later code examples excluded until the matching close", () => {
  for (const tag of [
    "code",
    "script",
    "style",
    "textarea",
    "title",
    "xmp",
    "iframe",
    "noembed",
    "noframes",
  ]) {
    const body = `> prefix <${tag}>\n\n- wrapper\n${review.replace(/^/gm, "  ")}\n\n</${tag}>`;
    assert.equal(completeReview(body, head), false, body);
    assert.equal(holdingReview(body, head), false, body);
    const closeQuote = tag === "code" ? "" : "</blockquote>\n\n";
    assert.equal(
      holdingReview(`${body}\n\n${closeQuote}${review}`, head),
      true,
      body,
    );
  }
  for (const body of [
    `> prefix <pre><script>\n\n</script>\n\n${review}\n\n</pre></blockquote>`,
    `> prefix <code><!-- </code> -->\n\n${review}\n\n</code>`,
    `prefix [<code>](/target)\n\n${review}\n\n</code>`,
    `prefix [**<code>**](/target)\n\n${review}\n\n</code>`,
  ]) {
    assert.equal(holdingReview(body, head), false, body);
    assert.equal(holdingReview(`${body}\n\n${review}`, head), true, body);
  }
  for (const tag of ["pre", "kbd"]) {
    assert.equal(holdingReview(`> prefix <${tag}>\n\n${review}`, head), true);
  }
});

test("inline metadata and code spans cannot supply fields or duplicate visible evidence", () => {
  for (const example of inlineExamples) {
    const hidden = example(review);
    assert.equal(reviewedHead(hidden), null, hidden);
    assert.equal(completeReview(hidden, head), false, hidden);
    assert.equal(holdingReview(hidden, head), false, hidden);
    for (const visible of [review, withFinding]) {
      const body = `${hidden}\n\n${visible}`;
      assert.equal(reviewedHead(body), head, body);
      assert.equal(completeReview(body, head), true, body);
      assert.equal(holdingReview(body, head), visible === review, body);
    }
    const located = hidden.replace(
      /^- /,
      "- src/ledger.mjs:24 Actual finding. ",
    );
    const body = `${withFinding}\n\n${located}`;
    assert.equal(reviewedHead(body), head, body);
    assert.equal(completeReview(body, head), true, body);
    assert.equal(holdingReview(body, head), false, body);
    for (const field of review.split("\n")) {
      const body = `${review.replace(field, "")}\n\n${example(field)}`;
      assert.equal(completeReview(body, head), false, body);
      assert.equal(holdingReview(body, head), false, body);
    }
  }
});

test("visible link labels keep their fields and inline comments without exposing metadata", () => {
  for (const label of ["label", "label\\] with an escaped bracket"]) {
    const fields = review.replace("Fixed:", "<!-- hidden -->\nFixed:");
    const body = `- [${label}\n${fields.replace(/^/gm, "  ")}\n  end](/target "title")`;
    assert.equal(reviewedHead(body), head, body);
    assert.equal(completeReview(body, head), true, body);
    assert.equal(holdingReview(body, head), true, body);
  }
  for (const link of [
    "[a\\]b](/target)",
    "[**label** with <!-- hidden --> text](/target)",
    "[label][reference]",
    "<https://example.com?a=1&b=2>",
  ]) {
    const value = link.startsWith("<") ? `Passed; ${link}` : link;
    const body =
      review.replace(/^Spec:.*$/m, `Spec: ${value}`) +
      '\n\n[reference]: /target "title"';
    assert.equal(completeReview(body, head), true, body);
  }
  const malformed = `- [label](<destination\n${review.replace(/^/gm, "  ")}\n  end>)`;
  assert.equal(holdingReview(malformed, head), true);
  for (const label of [
    "<!-- hidden -->",
    "**<!-- hidden -->**",
    "![alt](/image)",
    "<code>Passed</code>",
    "<script>Passed</script>",
  ]) {
    const body = review.replace(
      /^Spec:.*$/m,
      `Spec: [${label}](/target "Passed")`,
    );
    assert.equal(completeReview(body, head), false, body);
  }
});

test("inline attributes cannot hide an item's visible finding text", () => {
  for (const item of [
    '- <span title="hidden\n  metadata">An invalid visible finding.</span>',
    '- ![alt](/target "hidden\n  metadata") An invalid visible finding.',
  ]) {
    const body = `${review}\n\n${item}`;
    assert.equal(reviewedHead(body), head, body);
    assert.equal(completeReview(body, head), false, body);
    assert.equal(holdingReview(body, head), false, body);
  }
});

test("inline raw-element context survives block boundaries and ends only at its matching tag", () => {
  for (const tag of [
    "script",
    "style",
    "pre",
    "code",
    "kbd",
    "textarea",
    "title",
    "xmp",
    "iframe",
    "noembed",
    "noframes",
  ]) {
    const opening = `prefix <${tag.toUpperCase()} class="example">`;
    const wrong = tag === "script" ? "style" : "script";
    const hidden = `${opening}\n\n${review}\n\n</${wrong}>\n\n${review}`;
    assert.equal(holdingReview(hidden, head), false, hidden);
    const visible = `${hidden}\n\n</${tag}>\n\n${review}`;
    assert.equal(holdingReview(visible, head), true, visible);
    const fenced = `\`\`\`text\n${opening}\n\`\`\`\n\n${review}`;
    assert.equal(holdingReview(fenced, head), true, fenced);
    const quoted = `> ${opening}\n\n${review}`;
    assert.equal(
      holdingReview(quoted, head),
      ["pre", "kbd"].includes(tag),
      quoted,
    );
  }
  for (const tag of ["span", "div"]) {
    const body = `- prefix <${tag}>\n${review.replace(/^/gm, "  ")}\n  </${tag}>`;
    assert.equal(holdingReview(body, head), true, body);
  }
});

test("nested code examples and HTML block chunks retain the correct excluded context", () => {
  for (const outer of ["code", "pre", "kbd"]) {
    for (const inner of [outer, "script", "style"]) {
      const hidden = `- prefix <${outer}><${inner}>inner</${inner}>\n${review.replace(/^/gm, "  ")}\n  </${outer}>`;
      assert.equal(holdingReview(hidden, head), false, hidden);
      assert.equal(holdingReview(`${hidden}\n\n${review}`, head), true, hidden);
    }
    for (const syntax of [
      "<!-- </code> </pre> </kbd> -->",
      '<span title="</code> </pre> </kbd>">inner</span>',
    ]) {
      const hidden = `- prefix <${outer}>${syntax}\n${review.replace(/^/gm, "  ")}\n  </${outer}>`;
      assert.equal(holdingReview(hidden, head), false, hidden);
    }
  }
  for (const tag of ["script", "style", "code", "pre", "title"]) {
    const body = `- prefix <${tag}>\n\n  <div>inner</${tag}></div>\n\n${review}`;
    assert.equal(holdingReview(body, head), true, body);
  }
  for (const tag of ["script", "style"]) {
    const body = `- prefix <${tag}><${tag}>inner</${tag}>\n${review.replace(/^/gm, "  ")}\n  </${tag}>`;
    assert.equal(holdingReview(body, head), true, body);
  }
});

test("hidden text cannot join fragments into a required field or head", () => {
  for (const body of [
    review.replace("Standards:", "Stan<!-- marker -->dards:"),
    review.replace(
      head,
      `${head.slice(0, 20)}<!-- marker -->${head.slice(20)}`,
    ),
  ]) {
    assert.equal(completeReview(body, head), false, body);
    assert.equal(holdingReview(body, head), false, body);
  }
});

test("visible duplicates, placeholders, invalid findings and other heads stay rejected", () => {
  for (const body of [
    `${review}\nSpec: Passed again`,
    ...[
      "TODO",
      "TBD",
      "<the Spec review's actual outcome>",
      "_No response_",
    ].map((value) => review.replace(/^Spec:.*$/m, `Spec: ${value}`)),
    review.replace("Findings: None", "Findings:"),
    review.replace("Findings: None", "Findings: Some"),
    `${review}\n${finding}`,
    withFinding.replace(finding, "- a finding without a location"),
    review.replace(head, "b".repeat(40)),
    review.replace(head, head.slice(0, 7)),
  ]) {
    assert.equal(completeReview(body, head), false, body);
    assert.equal(holdingReview(body, head), false, body);
  }
  assert.equal(reviewedHead(review.replace(head, head.slice(0, 7))), null);
  assert.equal(completeReview(withFinding, head), true);
  assert.equal(holdingReview(withFinding, head), false);
});

// The lead-line record the comment rules' Reviews section now describes.
const footer = `<sub>Generated by AI · round 2 · head ${head}</sub>`;
const verdict = "**Standards** ✅ Pass · **Spec** ✅ Pass";
const header = "| Axis | Where | Finding | State |\n| --- | --- | --- | --- |";
const rows = {
  open: "| Spec | `src/ledger.mjs:12` | Refunds are missing from the total. | 🔁 Open |",
  fixed:
    "| Standards | `src/ledger.mjs:30` | A helper was duplicated. | ✅ Fixed in 1a2b3c4 |",
  filed:
    "| Standards | `scripts/release.mjs:8` | The release script skips tags. | ↗️ Filed #1240 |",
};
const record = ({
  leadLine = "✅ **Round 2 holds: no findings.** Merging.",
  verdictLine = verdict,
  table = [],
  footerLine = footer,
} = {}) =>
  [
    leadLine,
    verdictLine,
    table.length ? `${header}\n${table.join("\n")}` : "",
    footerLine,
  ]
    .filter(Boolean)
    .join("\n\n");
const holds = record();
const settled = record({
  leadLine: "✅ **Round 2 holds: no open findings, 1 fixed.** Merging.",
  table: [rows.fixed, rows.filed],
});
const handBack = record({
  leadLine:
    "🔁 **Round 2 hands back: 1 open finding, 1 fixed.** Implement fixes the open ones on this PR.",
  verdictLine: "**Standards** ✅ Pass · **Spec** ❌ Fail, refunds are missing",
  table: [rows.open, rows.fixed, rows.filed],
});
// Examples the reader excludes; a type-6 HTML block such as `<details>` ends at
// the record's first blank line, so it is not one.
const recordExamples = examples.filter(
  (example) => !example("x").startsWith("<details>"),
);

test("a passing lead-line round without a table holds on the footer's head", () => {
  for (const body of [
    holds,
    `${holds}\n`,
    holds.replaceAll("\n", "\r\n"),
    holds.replace("✅", "✅️"),
    holds.replace(footer, footer.replace(/<\/?sub>/g, "")),
  ]) {
    assert.equal(reviewedHead(body), head, body);
    assert.equal(completeReview(body, head), true, body);
    assert.equal(holdingReview(body, head), true, body);
  }
  assert.equal(completeReview(holds, "b".repeat(40)), false);
  assert.equal(holdingReview(holds, "b".repeat(40)), false);
});

test("a hand-back with Open, Fixed and Filed rows is complete and does not hold", () => {
  assert.equal(reviewedHead(handBack), head);
  assert.equal(completeReview(handBack, head), true);
  assert.equal(holdingReview(handBack, head), false);
  for (const lead of [
    "❌ **Round 3 fails**",
    "👤 **Grill decides the scope**",
  ]) {
    const body = handBack.replace(/^🔁 .*$/m, lead);
    assert.equal(completeReview(body, head), true, body);
    assert.equal(holdingReview(body, head), false, body);
  }
});

test("a round whose rows are only Fixed or Filed holds", () => {
  for (const table of [[rows.fixed], [rows.filed], [rows.fixed, rows.filed]]) {
    const body = record({ table });
    assert.equal(reviewedHead(body), head, body);
    assert.equal(completeReview(body, head), true, body);
    assert.equal(holdingReview(body, head), true, body);
  }
  assert.equal(holdingReview(settled, head), true);
});

test("the head comes only from a full SHA in the record's footer", () => {
  for (const footerLine of [
    footer.replace(head, head.slice(0, 7)),
    footer.replace(head, head.toUpperCase()),
  ]) {
    const body = record({ footerLine });
    assert.equal(reviewedHead(body), null, body);
    assert.equal(completeReview(body, head), false, body);
  }
  for (const footerLine of [
    footer.replace("round 2", "round <N>"),
    footer.replace("round 2", "round 0"),
    footer.replace(" · round 2", ""),
    footer.replace("Generated by AI", "Generated by AI · review run, codex"),
  ]) {
    const body = record({ footerLine });
    assert.equal(completeReview(body, head), false, body);
    assert.equal(holdingReview(body, head), false, body);
  }
  const twice = `${holds}\n\n${footer}`;
  assert.equal(completeReview(twice, head), false);
});

test("a lead line, verdict line and findings table that disagree are incomplete", () => {
  for (const body of [
    // A passing lead line with an open finding, or a hand-back without one.
    record({ table: [rows.open] }),
    record({ leadLine: "🔁 **Round 2 hands back**", table: [rows.fixed] }),
    record({ leadLine: "🔁 **Round 2 hands back**" }),
    // A failing axis without an open finding.
    record({ verdictLine: "**Standards** ✅ Pass · **Spec** ❌ Fail, a note" }),
    // A failing axis whose open finding belongs to the other axis, or an
    // outcome that contradicts its marker.
    handBack.replace(
      "**Standards** ✅ Pass · **Spec** ❌ Fail",
      "**Standards** ❌ Fail · **Spec** ✅ Pass",
    ),
    record({ verdictLine: "**Standards** ✅ Fail · **Spec** ✅ Pass" }),
    // No lead line first, a lead line outside the review's markers, or one
    // whose round is not the footer's.
    record({ leadLine: "Round 2 holds: no findings." }),
    record({ leadLine: "✔️ **Round 2 holds**" }),
    handBack.replace(/^🔁 .*$/m, "⏸️ **Round 2 paused**"),
    record({ leadLine: "✅ **Round 3 holds: no findings.** Merging." }),
    record({ leadLine: "✅ **Looks good.** Merging." }),
    // A lead line whose words contradict its marker.
    record({
      leadLine: "✅ **Round 2 hands back: no open findings.** Merging.",
    }),
    handBack.replace("Round 2 hands back", "Round 2 holds"),
    `${verdict}\n\n${holds}`,
  ]) {
    assert.equal(reviewedHead(body), head, body);
    assert.equal(completeReview(body, head), false, body);
    assert.equal(holdingReview(body, head), false, body);
  }
});

test("missing, duplicated or placeholder parts are incomplete", () => {
  const template = reviewTemplate(head).join("\n");
  const filled = [
    template.split("\n")[0].replace("<✅ or 🔁>", "✅"),
    verdict,
    footer,
  ].join("\n\n");
  for (const body of [
    template,
    template.replace("round <N>", "round 2"),
    filled,
    record({ leadLine: "✅ **Round <N> holds: no findings.** Merging." }),
    handBack.replace("❌ Fail, refunds are missing", "❌ Fail, <note>"),
    handBack.replace("❌ Fail, refunds are missing", "❌ Fail,"),
    record({ verdictLine: "" }),
    record({ verdictLine: "**Standards** Pass · **Spec** Pass" }),
    record({ verdictLine: "**Standards** ✅ · **Spec** ✅ Pass" }),
    record({ verdictLine: "**Standards** ✅ <outcome> · **Spec** ✅ Pass" }),
    record({ verdictLine: "**Standards** ⏭️ Skipped · **Spec** ✅ Pass" }),
    `${holds.replace(footer, "")}${verdict}\n\n${footer}`,
    record({ table: [] }).replace(verdict, `${verdict}\n\n${header}`),
    `${record({ table: [rows.fixed] })}\n\n${header}\n${rows.filed}`.replace(
      /\n\n<sub>.*<\/sub>/,
      "",
    ) + `\n\n${footer}`,
    ...[
      "| Axis | `src/a.mjs:1` | A finding. | 🔁 Open |",
      "| Spec | src/a.mjs | A finding. | 🔁 Open |",
      "| Spec | `<path>:<line>` | A finding. | 🔁 Open |",
      "| Spec | `src/a.mjs:1` | <the finding> | 🔁 Open |",
      "| Spec | `src/a.mjs:1` | TODO | 🔁 Open |",
      "| Spec | `src/a.mjs:1` | A finding. | Open |",
      "| Spec | `src/a.mjs:1` | A finding. | ✅ Open |",
      "| Spec | `src/a.mjs:1` | A finding. | 🔁 Open since round 1 |",
      "| Spec | `src/a.mjs:1` | A finding. | ✅ Fixed in |",
      "| Spec | `src/a.mjs:1` | A finding. | ✅ Fixed in <commit> |",
      "| Spec | `src/a.mjs:1` | A finding. | ↗️ Filed |",
      "| Spec | `src/a.mjs:1` | A finding. | 🔁 Filed #12 |",
      "| Spec | `src/a.mjs:1` | A finding. |",
    ].map((row) => record({ table: [rows.fixed, row] })),
  ]) {
    assert.equal(completeReview(body, head), false, body);
    assert.equal(holdingReview(body, head), false, body);
  }
  for (const row of [
    "| Spec | src/a.mjs:1 | A finding. | ↗ Filed lutzseverino/scriptorium#9 |",
    "| Spec | `src/a.mjs:1-4` | A finding. | ✅ Fixed in [1a2b3c4](/c/1a2b3c4) |",
  ]) {
    const body = record({ table: [row] });
    assert.equal(holdingReview(body, head), true, body);
  }
});

test("other tables, evidence and retained history leave the record intact", () => {
  const evidence =
    "<details>\n<summary>Evidence: pnpm validate passed on the head</summary>\n\n| Check | Outcome |\n| --- | --- |\n| Test | Pass |\n\n</details>";
  const history = `Previous assessment (retained for traceability):\n\n${handBack.replace(/^/gm, "> ")}`;
  for (const visible of [holds, handBack]) {
    for (const body of [
      visible.replace(footer, `${evidence}\n\n${footer}`),
      `${visible}\n\n${history}`,
    ]) {
      assert.equal(reviewedHead(body), head, body);
      assert.equal(completeReview(body, head), true, body);
      assert.equal(holdingReview(body, head), visible === holds, body);
    }
  }
});

test("fences, quotes and HTML comments keep #815's visible evidence for the lead-line record", () => {
  for (const visible of [holds, handBack]) {
    for (const extra of [
      "```text\npnpm validate\nAll checks passed\n```",
      "~~~text\nGenerated by AI · round 9 · head " + "b".repeat(40) + "\n~~~",
      "<!-- verification marker -->",
      `> ${verdict}`,
    ]) {
      for (const body of [
        visible.replace(footer, `${extra}\n\n${footer}`),
        visible.replace(verdict, `${verdict}\n\n${extra}`),
        `${visible}\n\n${extra}`,
      ]) {
        assert.equal(reviewedHead(body), head, body);
        assert.equal(completeReview(body, head), true, body);
        assert.equal(holdingReview(body, head), visible === holds, body);
      }
    }
  }
});

test("record parts supplied only inside fences, quotes or HTML comments cannot complete it", () => {
  for (const example of recordExamples) {
    for (const visible of [holds, handBack]) {
      const hidden = example(visible);
      assert.equal(reviewedHead(hidden), null, hidden);
      assert.equal(completeReview(hidden, head), false, hidden);
      assert.equal(holdingReview(hidden, head), false, hidden);
    }
    const parts = [
      handBack.split("\n")[0],
      handBack.split("\n\n")[1],
      `${header}\n${rows.open}\n${rows.fixed}\n${rows.filed}`,
      footer,
    ];
    for (const part of parts) {
      const body = `${handBack.replace(part, "")}\n\n${example(part)}`;
      assert.equal(completeReview(body, head), false, body);
      assert.equal(holdingReview(body, head), false, body);
    }
    // A hidden open finding neither opens nor closes the visible round.
    const body = `${holds}\n\n${example(`${header}\n${rows.open}`)}`;
    assert.equal(holdingReview(body, head), true, body);
  }
});
