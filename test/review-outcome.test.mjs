import assert from "node:assert/strict";
import test from "node:test";
import {
  completeReview,
  holdingReview,
  reviewedHead,
} from "../.agents/skills/babysit/review-outcome.mjs";

const head = "a".repeat(40);
const review = `Head: ${head}
Standards: Passed; documented rules checked.
Spec: Passed; all acceptance criteria verified.
Fixed: Nothing
Findings: None`;
const excluded = [
  (text) => `\`\`\`markdown\n${text}\n\`\`\``,
  (text) => `~~~markdown\n${text}\n~~~`,
  (text) => `<!--\n${text}\n-->`,
  (text) =>
    text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n"),
];

test("separate evidence leaves a complete review's head and holding result intact", () => {
  for (const evidence of [
    "```text\nvalidation passed\n```",
    "~~~text\nvalidation passed\n~~~",
    "<!-- validation passed -->",
  ]) {
    for (const body of [`${evidence}\n${review}`, `${review}\n${evidence}`]) {
      assert.equal(reviewedHead(body), head, body);
      assert.equal(completeReview(body, head), true, body);
      assert.equal(holdingReview(body, head), true, body);
    }
  }
});

test("excluded fields and list items neither duplicate nor complete a review", () => {
  for (const wrap of excluded) {
    const example = wrap(`${review}\n- example.mjs:1 an example finding`);
    for (const body of [`${example}\n${review}`, `${review}\n${example}`]) {
      assert.equal(reviewedHead(body), head, body);
      assert.equal(completeReview(body, head), true, body);
      assert.equal(holdingReview(body, head), true, body);
    }
    assert.equal(reviewedHead(wrap(review)), null);
    assert.equal(completeReview(wrap(review), head), false);
    assert.equal(holdingReview(wrap(review), head), false);
    for (const field of ["Head", "Standards", "Spec", "Fixed", "Findings"]) {
      const incomplete = review
        .split("\n")
        .filter((line) => !line.startsWith(`${field}:`))
        .join("\n");
      const body = `${incomplete}\n${wrap(review)}`;
      assert.equal(reviewedHead(body), null, body);
      assert.equal(completeReview(body, head), false, body);
      assert.equal(holdingReview(body, head), false, body);
    }
    const findings = review.replace("Findings: None", "Findings:");
    assert.equal(
      completeReview(`${findings}\n${wrap("- src/a.mjs:1 hidden")}`, head),
      false,
    );
  }
});

test("excluded evidence cannot clear actual open findings", () => {
  const findings = review.replace(
    "Findings: None",
    "Findings:\n- `src/ledger.mjs:12` refunds remain missing",
  );
  for (const wrap of excluded) {
    const body = `${findings}\n${wrap("Findings: None")}`;
    assert.equal(reviewedHead(body), head, body);
    assert.equal(completeReview(body, head), true, body);
    assert.equal(holdingReview(body, head), false, body);
  }
});

test("fence delimiters and HTML comments retain their own literal contents", () => {
  for (const evidence of [
    `\`\`\`\`text\n\`\`\`\n${review}\n~~~\n<!--\n\`\`\`\``,
    `~~~text\n\`\`\`\n${review}\n~~\n<!--\n~~~~`,
    `<!--\n\`\`\`\n${review}\n~~~\n-->`,
    `> <!--\n> \`\`\``,
    `<!-- one --> <!-- two\n${review}\n-->`,
  ]) {
    const body = `${evidence}\n${review}`;
    assert.equal(reviewedHead(body), head, body);
    assert.equal(completeReview(body, head), true, body);
    assert.equal(holdingReview(body, head), true, body);
  }
  for (const open of ["```text", "~~~text", "<!--"]) {
    assert.equal(reviewedHead(`${open}\n${review}`), null);
    assert.equal(completeReview(`${open}\n${review}`, head), false);
    assert.equal(holdingReview(`${review}\n${open}\n${review}`, head), true);
  }
});

test("inline HTML comments cannot splice a required field or full head", () => {
  for (const body of [
    review.replace("Head:", "He<!-- example -->ad:"),
    review.replace(
      head,
      `${head.slice(0, 20)}<!-- marker -->${head.slice(20)}`,
    ),
  ]) {
    assert.equal(reviewedHead(body), null, body);
    assert.equal(completeReview(body, head), false, body);
    assert.equal(holdingReview(body, head), false, body);
  }
  assert.equal(holdingReview(`${review} <!-- marker -->`, head), true);
});

test("separate evidence preserves the existing rejection rules", () => {
  for (const body of [
    `${review}\nSpec: a second eligible field`,
    review.replace("Fixed: Nothing", "Fixed: TODO"),
    review.replace("Findings: None", "Findings:\n- no location"),
    review.replace("Findings: None", "Findings: None\n- src/a.mjs:1 open"),
    review.replace(head, "b".repeat(40)),
    review.replace(head, head.slice(0, 7)),
  ]) {
    const mixed = `${body}\n<!-- validation passed -->`;
    assert.equal(completeReview(mixed, head), false, mixed);
    assert.equal(holdingReview(mixed, head), false, mixed);
  }
});
