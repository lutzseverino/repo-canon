import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// A local participant relay only: no readiness, credentials or remote access.
const [path, id, editedAt, kind = "triaged Agent Brief"] =
  process.argv.slice(2);
if (
  ![5, 6].includes(process.argv.length) ||
  !path ||
  !id ||
  !editedAt ||
  !["triaged Agent Brief", "specification", "implementation ticket"].includes(
    kind,
  )
)
  throw new Error(
    "Usage: node revision-notice.mjs <retained-contract.md> <simulated-source-id> <edited-at-or-null> [kind]",
  );
if (editedAt !== "null" && !Number.isFinite(Date.parse(editedAt)))
  throw new Error("edited-at must be a timestamp or null");

// Match the validator's source convention and entire body, including notes.
const source = {
  type: kind === "triaged Agent Brief" ? "comment" : "issue-body",
  id,
  editedAt: editedAt === "null" ? null : editedAt,
};
const value = JSON.stringify({
  format: "repo-canon/issue-contract-revision/v1",
  kind,
  source,
  body: readFileSync(path, "utf8"),
});
const revision = `sha256:${createHash("sha256").update(value).digest("hex")}`;
console.log(
  `Simulated issue-contract revision notice: \`${revision}\`.\n\nRetained contract: \`${path}\`. Source: \`${JSON.stringify(source)}\`.\n\nThis identifies exact local text only. Structural validity and independent acceptance must be checked separately. It grants no readiness and represents no GitHub event.`,
);
