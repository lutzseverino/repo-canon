import { readFileSync, writeFileSync } from "node:fs";
import { connect } from "../../vendor/postern/postern.mjs";

// The actual published adapter runs against an injected fetch transport. Each
// request reads current fixture state, including a head changed during merge.
export function fixtureFetch(statePath = process.env.FAKE_GH_STATE) {
  return async (input, options = {}) => {
    const state = JSON.parse(readFileSync(statePath, "utf8"));
    const url = new URL(input);
    const path = url.pathname;
    const body = options.body ? JSON.parse(options.body) : null;
    const json = (data, status = 200, headers = {}) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { "content-type": "application/json", ...headers },
      });
    const save = () => writeFileSync(statePath, JSON.stringify(state));
    if (state.fail) return json({ message: "Server Error" }, 502);
    const connection = (nodes) => ({
      nodes,
      pageInfo: { hasNextPage: false, endCursor: null },
    });
    if (path === "/graphql") {
      if (body.query.includes("PosternMergeQueue"))
        return json({
          data: {
            repository: {
              pullRequest: {
                isMergeQueueEnabled: state.isMergeQueueEnabled ?? false,
              },
            },
          },
        });
      if (body.query.includes("BabysitChecks"))
        return json({
          data: {
            repository: {
              object: {
                statusCheckRollup: { contexts: connection(state.checks ?? []) },
              },
            },
          },
        });
      const pull = {
        number: 12,
        fullDatabaseId: "120",
        id: "PR_12",
        url: "https://github.com/example/repository/pull/12",
        state: state.pullRequestState ?? "OPEN",
        title: state.title ?? "fix: fixture title",
        body: state.body ?? "",
        author: { __typename: "User", login: "owner" },
        createdAt: state.createdAt ?? "2026-10-11T05:00:00Z",
        headRefName: state.branch ?? "fixture",
        headRefOid: state.head,
        baseRefName: "main",
        isCrossRepository: false,
        repository: { nameWithOwner: "example/repository" },
      };
      return json({ data: { repository: { pullRequest: pull } } });
    }
    if (path.endsWith("/merge")) {
      state.merge = {
        body: body.commit_message,
        title: body.commit_title,
        expectedHead: body.sha,
        method: body.merge_method,
      };
      if (state.mergeHead) state.head = state.mergeHead;
      if (!state.mergeHead && !state.mergeFail)
        state.pullRequestState = state.mergeState ?? "MERGED";
      save();
      if (state.mergeHead || state.mergeFail)
        return json({ message: "merge refused" }, 409);
      return json({
        merged: state.pullRequestState === "MERGED",
        sha: "c".repeat(40),
      });
    }
    if (path.endsWith("/activity")) {
      const read = state.activityReads ?? 0;
      if (
        state.recordAfter !== undefined ||
        state.failActivityReads !== undefined
      ) {
        state.activityReads = read + 1;
        save();
      }
      if (state.failActivity || read < state.failActivityReads)
        return json({ message: "Server Error" }, 502);
      return json(
        state.pushedAt && read >= (state.recordAfter ?? 0)
          ? [{ after: state.head, timestamp: state.pushedAt }]
          : [],
      );
    }
    if (/\/commits\/[^/]+$/.test(path))
      return json({ commit: { committer: { date: state.committedAt } } });
    if (path.endsWith("/actions/runs"))
      return json({
        total_count: (state.runs ?? []).length,
        workflow_runs: state.runs ?? [],
      });
    let values;
    if (path.endsWith("/reviews")) {
      if (state.rejectReviewReads)
        return json({ message: "unexpected review read" }, 500);
      values = state.reviewPages ?? [state.reviews ?? []];
      values = values.map((page) =>
        page.map((review, index) => ({
          id: index + 1,
          submitted_at: "2026-10-11T05:40:00Z",
          ...review,
          user: review.user ? { type: "User", ...review.user } : null,
        })),
      );
    } else if (/\/pulls\/\d+\/comments$/.test(path)) {
      if (state.rejectReviewReads)
        return json({ message: "unexpected review comment read" }, 500);
      values = state.reviewCommentPages ?? [state.reviewComments ?? []];
    } else if (/\/issues\/\d+\/comments$/.test(path)) {
      values = [
        (state.comments ?? []).map(({ login, createdAt, body }, index) => ({
          id: index + 1,
          node_id: `COMMENT_${index + 1}`,
          html_url: `https://github.com/example/repository/pull/12#issuecomment-${index + 1}`,
          user: { login, type: "User" },
          created_at: createdAt,
          updated_at: createdAt,
          body,
        })),
      ];
    }
    if (values) {
      const page = Number(url.searchParams.get("page") ?? 1);
      const next = new URL(url);
      next.searchParams.set("page", String(page + 1));
      return json(
        values[page - 1] ?? [],
        200,
        page < values.length ? { link: `<${next}>; rel="next"` } : {},
      );
    }
    return json({ message: `Unhandled fixture request ${path}` }, 404);
  };
}

export function fixtureConnection(connectTo = connect) {
  return connectTo("https://github.com/example/repository", {
    credential: "fixture-credential",
    fetch: fixtureFetch(),
  });
}
