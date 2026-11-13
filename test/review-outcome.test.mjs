import assert from "node:assert/strict";
import test from "node:test";
import {
  completeReview,
  holdingReview,
  reviewedHead,
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
  (body) => `<!--\n${body}\n-->`,
];

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
