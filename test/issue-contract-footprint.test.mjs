// A direct contract's footprint and the supersession refusal (ADR 0045): the
// validator parses `Supersedes:`, `Adds:` and `Deletes:`, shows the adds and
// deletes tally, and, with the `triage` readiness command, refuses readiness
// to a specification while an open issue it supersedes has no fate.
import assert from "node:assert/strict";
import test from "node:test";
import {
  contractFootprint,
  issueContractResult,
  supersededWithoutFate,
} from "../vendor/repo-canon/validate-issue-contract.mjs";
import { main as ready } from "../.agents/skills/triage/ready.mjs";
import { decideIssueContract } from "./helpers/contract-decision.mjs";
import { contractWorld } from "./helpers/contract-world.mjs";
import {
  approvedTicketFeedback,
  bot,
  createdWithReadiness,
  neutralEvent,
  publishedState,
  readinessReview,
  repository,
  role,
  specificationBody,
  ticketBody,
} from "./helpers/issue-contracts.mjs";

const fields = (supersedes, adds = "none", deletes = "none") =>
  `\n\nSupersedes: ${supersedes}\nAdds: ${adds}\nDeletes: ${deletes}`;

test("the footprint fields are parsed from rendered prose", () => {
  const footprint = contractFootprint(
    `${ticketBody}\n\n**Supersedes:** ADR 0040, #12; other/name#3, other/name ADR 11, https://github.com/a/b/issues/9\nAdds: label \`state:carried\`; configuration key \`runKinds.release\`.\nDeletes: none\n\n\`\`\`md\nAdds: an example\n\`\`\`\n\n> Deletes: a quotation\n\n<!-- Supersedes: #99 -->`,
    repository,
  );
  assert.deepEqual(footprint, {
    known: true,
    missing: [],
    supersedes: {
      issues: [
        { repository, number: 12 },
        { repository: "other/name", number: 3 },
        { repository: "a/b", number: 9 },
      ],
      adrs: [
        { repository, number: 40 },
        { repository: "other/name", number: 11 },
      ],
    },
    adds: ["label state:carried", "configuration key runKinds.release"],
    deletes: [],
    errors: [],
  });
});

test("a contract without the footprint fields has an unknown footprint", () => {
  const footprint = contractFootprint(
    `${ticketBody}\n\nAdds: label \`state:carried\``,
    repository,
  );
  assert.equal(footprint.known, false);
  assert.deepEqual(footprint.missing, ["Supersedes", "Deletes"]);
  assert.deepEqual(contractFootprint(ticketBody, repository).missing, [
    "Supersedes",
    "Adds",
    "Deletes",
  ]);
});

test("prose, repeated and code-quoted field lines keep the footprint readable", () => {
  const footprint = (lines) =>
    contractFootprint(`${ticketBody}\n\n${lines}`, repository);
  const prose = footprint(
    "- `Supersedes:`, holding ADR and issue ids;\n- `Adds:` and `Deletes:`, each holding durable surfaces.\n\nSupersedes: #888's broad wake behavior, and other/name#784's removal only; their correctness remains. No ADR is superseded.\n**Adds:** a\n\n**Adds:** b; c\n\nDeletes: `now.md` prose above its first section",
  );
  assert.deepEqual(prose.supersedes, {
    issues: [
      { repository, number: 888 },
      { repository: "other/name", number: 784 },
    ],
    adrs: [],
  });
  assert.deepEqual(prose.adds, ["a", "b", "c"]);
  assert.deepEqual(prose.errors, [
    "Name durable surfaces in `Deletes:`, never file paths: `now.md prose above its first section`.",
  ]);
  for (const supersedes of [
    "None. Implements ADRs 0040 and 0046; it replaces no ADR or other issue.",
    "none; closed #1087 delivered only the unneeded-read exception",
    "the owner's reservation of every close-or-hold disposition",
  ]) {
    const parsed = footprint(
      `Supersedes: ${supersedes}\nAdds: none\nDeletes: none`,
    );
    assert.deepEqual(parsed.supersedes, { issues: [], adrs: [] }, supersedes);
    assert.deepEqual(parsed.errors, [], supersedes);
  }
  assert.deepEqual(
    footprint(
      "Supersedes: ADRs 0040 and 0046, other/name adr 11\nAdds: none\nDeletes: none",
    ).supersedes.adrs,
    [
      { repository, number: 40 },
      { repository, number: 46 },
      { repository: "other/name", number: 11 },
    ],
  );
});

test("a malformed footprint refuses a new readiness grant without a structural error", () => {
  const created = createdWithReadiness({ run: "opened" });
  created.issue.body = `${ticketBody}${fields(
    "ADR 0040, docs/adr/0040-watch.md",
    "`scripts/read-set.mjs`; skill `orchestrate`",
    "docs/adr/; CONTRIBUTING.md",
  )}`;
  created.event.issue.body = created.issue.body;
  const decision = decideIssueContract({
    ...created,
    repository,
    event: neutralEvent(created.event),
    blockedBy: [],
    parent: null,
    bodyRevision: { id: "ISSUE_42", lastEditedAt: null },
  });
  assert.deepEqual(decision.removeLabels, ["state:ready"]);
  const state = publishedState(decision.feedback.body);
  assert.equal(state.status, "awaiting-review");
  for (const item of [
    "docs/adr/0040-watch.md",
    "scripts/read-set.mjs",
    "docs/adr/",
    "CONTRIBUTING.md",
  ]) {
    assert.ok(state.rejectionReason.includes(`\`${item}\``), item);
    assert.ok(decision.feedback.body.includes(`\`${item}\``), item);
  }
  assert.ok(!state.rejectionReason.includes("orchestrate"));
});

test("an approved ready contract keeps readiness with a footprint it would now refuse", () => {
  const issue = {
    number: 42,
    node_id: "ISSUE_42",
    state: "open",
    body: `${ticketBody}\n\n**Deletes:**\n\n- an old step\n\nSupersedes: #888's broad behavior\nAdds: a\nDeletes: \`now.md\` prose`,
    labels: [{ name: "state:ready" }],
    user: { login: "maintainer" },
  };
  const decision = decideIssueContract({
    repository,
    issue,
    comments: [
      { ...approvedTicketFeedback(issue), updated_at: "2026-09-14T16:59:00Z" },
    ],
    blockedBy: [],
    parent: null,
    bodyRevision: { id: "ISSUE_42", lastEditedAt: null },
    issueEvents: [readinessReview],
    permissions: { maintainer: role("admin") },
    event: neutralEvent({
      action: "edited",
      issue: { number: 42 },
      sender: { login: "maintainer" },
    }),
  });
  assert.equal(decision.exitCode, 0);
  assert.deepEqual(decision.removeLabels ?? [], []);
  assert.deepEqual(decision.addLabels ?? [], []);
  assert.equal(publishedState(decision.feedback.body).status, "approved");
});

test("the result shows adds against deletes and lists unknown footprints", () => {
  const snapshot = (body, tickets) => {
    const issue = { number: 42, state: "open", body, labels: [] };
    return {
      repository,
      issue,
      comments: [],
      blockedBy: [],
      parent: null,
      bodyRevision: { id: "ISSUE_42", lastEditedAt: null },
      issueEvents: [],
      event: neutralEvent({
        action: "reopened",
        issue: { number: 42 },
        sender: { login: "reporter" },
      }),
      tickets,
    };
  };
  const ticket = decideIssueContract(
    snapshot(`${ticketBody}${fields("none", "a; b", "c")}`),
  );
  assert.match(
    ticket.feedback.body,
    /\nFootprint: 2 adds against 1 delete, shown and never gated\.$/m,
  );
  const unknown = decideIssueContract(snapshot(ticketBody));
  assert.match(
    unknown.feedback.body,
    /\nFootprint: unknown, without `Supersedes:`, `Adds:` and `Deletes:` lines\.$/m,
  );
  const specification = decideIssueContract(
    snapshot(`${specificationBody}${fields("none", "a", "b; c")}`, [
      { repository, number: 7, body: `${ticketBody}${fields("none", "d")}` },
      { repository: "other/name", number: 8, body: ticketBody },
    ]),
  );
  assert.match(
    specification.feedback.body,
    /\nFootprint: 2 adds against 2 deletes over this specification and 1 of its 2 tickets, shown and never gated\. Unknown footprint, without `Supersedes:`, `Adds:` and `Deletes:` lines: other\/name#8\.$/m,
  );
});

test("the decision refuses a specification's readiness while a superseded issue has no fate", () => {
  const created = createdWithReadiness({ run: "opened" });
  created.issue.body = `${specificationBody}${fields("#7")}`;
  created.event.issue.body = created.issue.body;
  const decide = (supersession) =>
    decideIssueContract({
      ...created,
      repository,
      event: neutralEvent(created.event),
      blockedBy: [],
      parent: null,
      bodyRevision: { id: "ISSUE_42", lastEditedAt: null },
      supersession,
    });
  const refused = decide({ unfated: [{ repository, number: 7 }] });
  assert.deepEqual(refused.removeLabels, ["state:ready"]);
  assert.match(publishedState(refused.feedback.body).rejectionReason, /#7\.$/);
  const unread = decide({ error: "Issue #7 was not found." });
  assert.match(
    publishedState(unread.feedback.body).rejectionReason,
    /Could not read .*#7 was not found/,
  );
  assert.equal(
    publishedState(decide({ unfated: [] }).feedback.body).status,
    "approved",
  );
});

// Shared examples: the validator's adapter and the readiness command on one
// specification, #42, among the repository's other issues.
const fate = (line, specification = "#42") =>
  `> _This was generated by AI._\n\nFate: ${line}\nSource: ${specification}`;

const stateOf = (world) =>
  issueContractResult(
    world.comments.map((comment) => ({
      ...comment,
      author: { login: comment.author },
    })),
  ).state;

async function published(world) {
  world.comment("Discussion.", "reporter");
  await world.deliver();
  world.wait();
  return stateOf(world).revision;
}

async function readiness(world, revision) {
  try {
    return {
      code: await ready(
        ["42", revision],
        world.connectionAs("maintainer"),
        world.pause,
        world.now,
      ),
    };
  } catch (error) {
    return { error };
  }
}

// Runs `check` against both programs: the readiness command, and the
// validator deciding a label a reviewer applies by hand.
async function bothRefuse(t, options, check) {
  for (const program of ["the readiness command", "the validator"])
    await t.test(program, async (t) => {
      t.mock.method(console, "log", () => {});
      const world = contractWorld({ labels: ["state:triage"], ...options });
      const revision = await published(world);
      let reason;
      if (program === "the readiness command") {
        const before = world.events.length;
        reason = (await readiness(world, revision)).error?.message ?? "";
        assert.equal(world.events.length, before, "no label write");
      } else {
        world.label("state:ready", "maintainer");
        await world.deliver();
        reason = stateOf(world).rejectionReason ?? "";
        assert.equal(stateOf(world).status, "awaiting-review");
      }
      assert.equal(world.issue.labels.includes("state:ready"), false);
      check(reason);
    });
}

test("a superseding specification with one fated issue and one unfated issue is refused, naming the unfated one", async (t) => {
  await bothRefuse(
    t,
    {
      body: `${specificationBody}${fields("#7, #8, #9, #10")}`,
      others: [
        {
          number: 7,
          body: ticketBody,
          comments: [
            {
              author: "maintainer",
              body: fate("kept, still needed for the CLI path"),
            },
          ],
        },
        {
          number: 8,
          body: ticketBody,
          comments: [
            {
              author: "maintainer",
              body: fate("kept, for another plan", "#41"),
            },
          ],
        },
        { number: 9, state: "closed", body: ticketBody },
        {
          number: 10,
          body: ticketBody,
          comments: [
            { author: "maintainer", body: fate("closed as superseded") },
          ],
        },
      ],
    },
    (reason) => {
      assert.match(reason, /fate/);
      assert.match(reason, /#8\b/);
      assert.doesNotMatch(reason, /#7\b|#9\b|#10\b/);
    },
  );
});

test("an issue citing a superseded ADR without a fate is refused", async (t) => {
  await bothRefuse(
    t,
    {
      body: `${specificationBody}${fields("ADR 0040")}`,
      others: [
        { number: 7, body: `${ticketBody}\n\nAs ADR 0040 decides.` },
        {
          number: 8,
          body: `${ticketBody}\n\nSee [the decision](../docs/adr/0040-watch.md).`,
        },
        { number: 9, body: `${ticketBody}\n\nAs ADR 0041 decides.` },
        { number: 10, state: "closed", body: `${ticketBody}\n\nADR 0040.` },
        { number: 11, body: "```\nADR 0040\n```" },
        { number: 12, body: `${ticketBody}\n\nAs adr 0040 decides.` },
      ],
    },
    (reason) => {
      assert.match(reason, /#7, #8, #12\.$/);
    },
  );
});

test("with every fate posted, readiness proceeds", async (t) => {
  t.mock.method(console, "log", () => {});
  const world = contractWorld({
    labels: ["state:triage"],
    body: `${specificationBody}${fields("#7, ADR 0040", "a", "b")}`,
    others: [
      {
        number: 7,
        body: ticketBody,
        comments: [{ author: "maintainer", body: fate("rescoped") }],
      },
      {
        number: 8,
        body: `${ticketBody}\n\nAs ADR 0040 decides.`,
        comments: [
          {
            author: "maintainer",
            body: fate(
              "kept, it only reads the old record",
              "https://github.com/owner/repo/issues/42",
            ),
          },
        ],
      },
    ],
  });
  const revision = await published(world);
  assert.deepEqual(await readiness(world, revision), { code: 0 });
  assert.equal(stateOf(world).status, "approved");
  assert.ok(world.issue.labels.includes("state:ready"));
  assert.match(
    world.comments.find(({ author }) => author === bot.login).body,
    /\nFootprint: 1 add against 1 delete, shown and never gated\.$/m,
  );
});

test("supersession reads each repository of the specification and its tickets", async () => {
  const issues = {
    "owner/repo": [
      { number: 5, body: "Under Scriptorium ADR 0011 and ADR 0011." },
      { number: 6, body: "Under Scriptorium ADR 0011." },
    ],
    "owner/scriptorium": [
      { number: 20, body: "As ADR 0011 says." },
      { number: 21, body: "As repo ADR 0011 says." },
      { number: 22, body: "Our own ticket citing ADR 0011." },
    ],
  };
  const comments = {
    "owner/scriptorium#20": [{ body: fate("rescoped", "owner/repo#42") }],
  };
  const reads = [];
  const trackerFor = (path) => ({
    issue: async (number) => ({ number, state: "open" }),
    issues: async () => {
      reads.push(path);
      return issues[path].map((issue) => ({ ...issue, state: "open" }));
    },
    comments: async (number) => comments[`${path}#${number}`] ?? [],
  });
  const unfated = await supersededWithoutFate({
    specification: { repository: "owner/repo", number: 42 },
    footprint: contractFootprint(
      `${specificationBody}${fields("owner/scriptorium ADR 0011")}`,
      "owner/repo",
    ),
    tickets: [{ repository: "owner/scriptorium", number: 22 }],
    trackerFor,
  });
  assert.deepEqual(reads, ["owner/repo", "owner/scriptorium"]);
  assert.deepEqual(unfated, [
    { repository: "owner/repo", number: 5 },
    { repository: "owner/repo", number: 6 },
  ]);
});
