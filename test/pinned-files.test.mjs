import assert from "node:assert/strict";
import test from "node:test";
import { connect } from "../vendor/postern/postern.mjs";
import { pinnedFiles } from "../.agents/skills/babysit/platform.mjs";

const revision = "b".repeat(40);
const later = "c".repeat(40);
const blob = { __typename: "Blob", text: "trusted text", isTruncated: false };

function destination(files, options = {}) {
  let tip = revision;
  return connect("https://github.com/owner/repo", {
    credential: "fixture",
    fetch: async (_input, init) => {
      const { variables } = JSON.parse(init.body);
      const repository = variables.revision
        ? {
            commit: { __typename: "Commit", oid: variables.revision },
            ...Object.fromEntries(
              Object.entries(files).map(([key, value]) => {
                assert.equal(variables[key], `${revision}:${key}.txt`);
                return [key, value];
              }),
            ),
            ...options.response,
          }
        : {
            nameWithOwner: "owner/repo",
            defaultBranchRef: {
              name: "main",
              target: { __typename: "Commit", oid: tip },
            },
          };
      tip = later;
      return new Response(JSON.stringify({ data: { repository } }), {
        headers: { "content-type": "application/json" },
      });
    },
  });
}

test("pinned files returns present text and verified absence from one immutable tip", async () => {
  const result = await pinnedFiles(
    destination({ present: blob, absent: null }),
    {
      present: "present.txt",
      absent: "absent.txt",
    },
  );
  assert.deepEqual(result, {
    revision,
    evidence: `owner/repo default branch main@${revision}`,
    files: { present: "trusted text", absent: null },
  });
});

test("incomplete, truncated and oversized blobs never count as absence", async () => {
  for (const present of [
    undefined,
    {},
    { __typename: "Tree" },
    { ...blob, isTruncated: true },
    { ...blob, text: null },
  ]) {
    await assert.rejects(
      pinnedFiles(destination({ present }), { present: "present.txt" }),
      /Could not read complete present.txt/,
    );
  }
});

test("a missing or mismatched pinned commit never returns files", async () => {
  for (const commit of [null, { __typename: "Commit", oid: later }]) {
    await assert.rejects(
      pinnedFiles(destination({ present: blob }, { response: { commit } }), {
        present: "present.txt",
      }),
      /Could not read the pinned commit/,
    );
  }
});

test("permission refusals retain their platform classification", async () => {
  const connection = connect("https://github.com/owner/repo", {
    credential: "fixture",
    fetch: async () =>
      new Response(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
  });
  await assert.rejects(
    pinnedFiles(
      connection,
      { present: "present.txt" },
      { revision, evidence: "pinned" },
    ),
    { reason: "forbidden" },
  );
});
