import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// A local participant relay only: no readiness, credentials or remote access.
const [path, id, editedAt] = process.argv.slice(2);
if (process.argv.length !== 5 || !path || !id || !editedAt)
  throw new Error(
    "Usage: node revision-notice.mjs <retained-brief.md> <simulated-comment-id> <edited-at-or-null>",
  );
if (editedAt !== "null" && !Number.isFinite(Date.parse(editedAt)))
  throw new Error("edited-at must be a timestamp or null");

// Match the issue-contract validator's comment revision convention, including
// the entire comment body (triage notes and whitespace included).
const source = {
  type: "comment",
  id,
  editedAt: editedAt === "null" ? null : editedAt,
};
const value = JSON.stringify({
  format: "repo-canon/issue-contract-revision/v1",
  kind: "triaged Agent Brief",
  source,
  body: readFileSync(path, "utf8"),
});
const revision = `sha256:${createHash("sha256").update(value).digest("hex")}`;
console.log(
  `Simulated issue-contract revision notice: \`${revision}\`.\n\nRetained contract: \`${path}\`. Source: \`${JSON.stringify(source)}\`.\n\nThis identifies exact local text only. Structural validity and independent acceptance must be checked separately. It grants no readiness and represents no GitHub event.`,
);
