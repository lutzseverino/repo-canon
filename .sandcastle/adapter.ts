// The factory's adapter: it reads the snapshot through the GitHub CLI and the
// usage readers, asks the decision core what to do, and carries the decisions
// out through GitHub label edits, comments, and Sandcastle launches.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decideFactory,
  isProvider,
  labels,
  parseModel,
  unknownProvider,
  type Decision,
  type Issue,
  type Mode,
  type Provider,
  type Run,
  type Settings,
} from "./factory.ts";

export type LaunchRequest = {
  issue: number;
  prompt: string;
  provider: Provider;
  model: string;
  effort: string;
  log: string;
  // The repository's sandbox image, built from its `.sandcastle/Dockerfile`.
  image: string;
  signal: AbortSignal;
};

export type ImageBuild = { image: string; dockerfile: string };

export type Ports = {
  gh(args: string[]): Promise<string>;
  // Resolves or rejects when the run's agent exits.
  launch(request: LaunchRequest): Promise<void>;
  buildImage(request: ImageBuild): Promise<void>;
  readUsage(provider: Provider): Promise<number | null>;
  now(): Date;
  // The repository checkout the factory runs from.
  root: string;
  report(line: string): void;
};

type HostRun = Run & {
  controller: AbortController;
  exited: boolean;
  stopped: boolean;
};

// The factory host sets these; Repo Canon ships no values for them.
export function readSettings(
  env: Record<string, string | undefined>,
): Settings {
  const problems: string[] = [];
  const model = (name: string) => {
    const value = env[name]?.trim() ?? "";
    const parsed = parseModel(value);
    if (!value)
      problems.push(`- ${name}: set it to a model, as a model label names one`);
    else if ("error" in parsed) problems.push(`- ${name}: ${parsed.error}`);
    return value;
  };
  const number = (
    name: string,
    valid: (value: number) => boolean,
    fix: string,
  ) => {
    const value = Number(env[name]);
    if (!env[name]?.trim() || !valid(value)) problems.push(`- ${name}: ${fix}`);
    return value;
  };
  const defaultModel = model("FACTORY_DEFAULT_MODEL");
  const retryModel = env.FACTORY_RETRY_MODEL
    ? model("FACTORY_RETRY_MODEL")
    : null;
  const caps: Settings["caps"] = {};
  if (!env.FACTORY_CAPS?.trim())
    problems.push(
      "- FACTORY_CAPS: set it to <provider>=<count> entries, such as claude-code=2,codex=1",
    );
  else
    for (const entry of env.FACTORY_CAPS.split(",")) {
      const match = /^\s*([^=\s]+)\s*=\s*(\d+)\s*$/.exec(entry);
      if (!match)
        problems.push(
          `- FACTORY_CAPS: ${entry.trim() || "an empty entry"} is not <provider>=<count>`,
        );
      else if (!isProvider(match[1]))
        problems.push(`- FACTORY_CAPS: ${unknownProvider(match[1])}`);
      else caps[match[1]] = Number(match[2]);
    }
  const usageThreshold = number(
    "FACTORY_USAGE_THRESHOLD",
    (value) => value >= 0 && value <= 100,
    "set it to a percentage from 0 to 100",
  );
  const timeLimitMinutes = number(
    "FACTORY_TIME_LIMIT_MINUTES",
    (value) => value > 0,
    "set it to a positive number of minutes",
  );
  if (problems.length > 0)
    throw new Error(
      ["The factory host settings are unusable:", ...problems].join("\n"),
    );
  return { defaultModel, retryModel, caps, usageThreshold, timeLimitMinutes };
}

const templates: Record<Mode, string> = {
  direct: readFileSync(new URL("./direct-prompt.md", import.meta.url), "utf8"),
  orchestrated: readFileSync(
    new URL("./orchestrated-prompt.md", import.meta.url),
    "utf8",
  ),
};

export function prompt(mode: Mode, issue: number): string {
  return templates[mode].trim().replaceAll("{{ISSUE}}", String(issue));
}

const issuesQuery = `query($owner: String!, $name: String!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    issues(states: OPEN, first: 50, after: $endCursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        createdAt
        labels(first: 100) { nodes { name } }
        parent { number }
        subIssues(first: 100) { nodes { number state labels(first: 100) { nodes { name } } } }
        blockedBy(first: 100) { nodes { number state } }
      }
    }
  }
}`;

const pullRequestsQuery = `query($owner: String!, $name: String!, $number: Int!, $branch: String!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      state
      closedByPullRequestsReferences(first: 20, includeClosedPrs: true) { nodes { state } }
    }
    pullRequests(headRefName: $branch, first: 20) { nodes { state } }
  }
}`;

// The branch Sandcastle gives an issue's runs.
export function runBranch(issue: number): string {
  return `factory/issue-${issue}`;
}

export function createFactory(settings: Settings, ports: Ports) {
  const runs: HostRun[] = [];
  let repository: { owner: string; name: string } | null = null;

  async function readRepository() {
    if (!repository) {
      const view = JSON.parse(
        await ports.gh(["repo", "view", "--json", "owner,name"]),
      );
      repository = { owner: view.owner.login, name: view.name };
    }
    return repository;
  }

  async function identity() {
    const { owner, name } = await readRepository();
    return ["-F", `owner=${owner}`, "-F", `name=${name}`];
  }

  // Each pass that launches builds the image again, so runs start from the
  // Dockerfile the checkout holds now; Docker's cache keeps an unchanged
  // build quick.
  async function buildImage(): Promise<string> {
    const { owner, name } = await readRepository();
    const image = `factory-${owner}-${name}`
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, "-");
    await ports.buildImage({
      image,
      dockerfile: join(ports.root, ".sandcastle", "Dockerfile"),
    });
    return image;
  }

  async function readIssues(): Promise<Issue[]> {
    const pages = JSON.parse(
      await ports.gh([
        "api",
        "graphql",
        "--paginate",
        "--slurp",
        "-f",
        `query=${issuesQuery}`,
        ...(await identity()),
      ]),
    );
    const names = (connection: { nodes: { name: string }[] }) =>
      connection.nodes.map((label) => label.name);
    const state = (value: string) => (value === "OPEN" ? "open" : "closed");
    return pages.flatMap((page: any) =>
      page.data.repository.issues.nodes.map((node: any) => ({
        number: node.number,
        createdAt: node.createdAt,
        labels: names(node.labels),
        parent: node.parent?.number ?? null,
        subIssues: node.subIssues.nodes.map((child: any) => ({
          number: child.number,
          state: state(child.state),
          labels: names(child.labels),
        })),
        blockedBy: node.blockedBy.nodes.map((blocker: any) => ({
          number: blocker.number,
          state: state(blocker.state),
        })),
      })),
    );
  }

  // A run's pull request is one that closes its issue or comes from the run's
  // branch. A closed issue counts as merged work.
  async function pullRequestState(number: number) {
    const response = JSON.parse(
      await ports.gh([
        "api",
        "graphql",
        "-f",
        `query=${pullRequestsQuery}`,
        ...(await identity()),
        "-F",
        `number=${number}`,
        "-F",
        `branch=${runBranch(number)}`,
      ]),
    );
    const { issue, pullRequests } = response.data.repository;
    const states = [
      ...issue.closedByPullRequestsReferences.nodes,
      ...pullRequests.nodes,
    ].map((pullRequest: { state: string }) => pullRequest.state);
    if (issue.state === "CLOSED" || states.includes("MERGED")) return "merged";
    return states.includes("OPEN") ? "open" : "none";
  }

  async function readUsage() {
    const usage: Partial<Record<Provider, number | null>> = {};
    for (const provider of Object.keys(settings.caps) as Provider[]) {
      try {
        usage[provider] = await ports.readUsage(provider);
      } catch (error) {
        ports.report(`usage for ${provider} is unreadable: ${error}`);
        usage[provider] = null;
      }
    }
    return usage;
  }

  async function apply(decision: Decision, image: string) {
    const { issue } = decision;
    switch (decision.kind) {
      case "claim":
        await ports.gh([
          "issue",
          "edit",
          String(issue),
          "--add-label",
          labels.running,
        ]);
        return;
      case "launch": {
        forget(issue);
        const controller = new AbortController();
        const run: HostRun = {
          issue,
          mode: decision.mode,
          provider: decision.provider,
          model: decision.model,
          effort: decision.effort,
          attempt: decision.attempt,
          startedAt: ports.now().toISOString(),
          log: join(
            ports.root,
            ".sandcastle",
            "logs",
            `issue-${issue}-attempt-${decision.attempt}.log`,
          ),
          ended: null,
          controller,
          exited: false,
          stopped: false,
        };
        runs.push(run);
        ports
          .launch({
            issue,
            prompt: prompt(decision.mode, issue),
            provider: run.provider,
            model: run.model,
            effort: run.effort,
            log: run.log,
            image,
            signal: controller.signal,
          })
          .catch((error) =>
            ports.report(`run for #${issue} ended with an error: ${error}`),
          )
          .finally(() => {
            run.exited = true;
          });
        return;
      }
      case "stop": {
        const run = runs.find((candidate) => candidate.issue === issue);
        if (!run) return;
        run.stopped = true;
        run.controller.abort(new Error(decision.reason));
        return;
      }
      case "fail": {
        const run = runs.find((candidate) => candidate.issue === issue);
        await ports.gh([
          "issue",
          "edit",
          String(issue),
          "--remove-label",
          labels.running,
          "--add-label",
          labels.failed,
        ]);
        await ports.gh([
          "issue",
          "comment",
          String(issue),
          "--body",
          failureComment(decision.failure, decision.log, run),
        ]);
        forget(issue);
        return;
      }
      case "keep":
        forget(issue);
        return;
      case "release":
        await ports.gh([
          "issue",
          "edit",
          String(issue),
          "--remove-label",
          labels.running,
        ]);
        forget(issue);
        return;
      case "skip":
        ports.report(`#${issue} skipped: ${decision.reason}`);
        return;
    }
  }

  function forget(issue: number) {
    const index = runs.findIndex((run) => run.issue === issue);
    if (index !== -1) runs.splice(index, 1);
  }

  async function tick(): Promise<Decision[]> {
    for (const run of runs) {
      if (run.exited && run.ended === null)
        run.ended = {
          timedOut: run.stopped,
          pullRequest: await pullRequestState(run.issue),
        };
    }
    const issues = await readIssues();
    const usage = await readUsage();
    const decisions = decideFactory({
      now: ports.now().toISOString(),
      issues,
      runs: runs.map(
        ({ controller: _c, exited: _e, stopped: _s, ...run }) => run,
      ),
      usage,
      settings,
    });
    let image = "";
    let applied = decisions;
    if (decisions.some((decision) => decision.kind === "launch")) {
      try {
        image = await buildImage();
      } catch (error) {
        ports.report(
          `the sandbox image did not build, so nothing launches: ${error}`,
        );
        applied = decisions.filter(
          (decision) => decision.kind !== "claim" && decision.kind !== "launch",
        );
      }
    }
    for (const decision of applied) await apply(decision, image);
    return applied;
  }

  return { tick };
}

function failureComment(failure: string, log: string, run?: HostRun): string {
  const model = run ? `${run.provider}/${run.model}@${run.effort}` : "unknown";
  return [
    `The factory run failed: ${failure}.`,
    "",
    `- Model: \`${model}\`, attempt ${run?.attempt ?? "unknown"}`,
    `- Log: \`${log}\` on the factory host`,
    "",
    `Remove \`${labels.failed}\` to let the factory pick this issue up again.`,
  ].join("\n");
}

// Usage is the fullest window's percentage used, or null when unreadable.
function fullest(values: unknown[]): number | null {
  const readings = values.filter(
    (value): value is number => typeof value === "number",
  );
  return readings.length > 0 ? Math.max(...readings) : null;
}

// The result of the Codex app-server's `account/rateLimits/read`.
export function codexUsage(result: any): number | null {
  const limits = result?.rateLimits;
  return fullest([
    limits?.primary?.usedPercent,
    limits?.secondary?.usedPercent,
  ]);
}

// Claude Code's subscription usage, read best-effort.
export function claudeUsage(result: any): number | null {
  return fullest([
    result?.five_hour?.utilization,
    result?.seven_day?.utilization,
  ]);
}
