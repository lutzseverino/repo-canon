// The factory's decision core: a pure function from a snapshot of the
// repository and the factory host to the decisions the adapter carries out.

export type Provider = "claude-code" | "codex";
export type Mode = "direct" | "orchestrated";

export type Issue = {
  number: number;
  createdAt: string;
  labels: string[];
  parent: number | null;
  subIssues: { number: number; state: "open" | "closed"; labels: string[] }[];
  blockedBy: { number: number; state: "open" | "closed" }[];
};

export type Settings = {
  defaultModel: string;
  retryModel: string | null;
  caps: Partial<Record<Provider, number>>;
  usageThreshold: number;
  timeLimitMinutes: number;
};

// A run the factory host started. `ended` is null while its agent runs.
export type Run = {
  issue: number;
  mode: Mode;
  provider: Provider;
  model: string;
  effort: string;
  attempt: 1 | 2;
  startedAt: string;
  log: string;
  ended: null | { timedOut: boolean; pullRequest: "open" | "merged" | "none" };
};

export type Snapshot = {
  now: string;
  issues: Issue[];
  runs: Run[];
  usage: Partial<Record<Provider, number | null>>;
  settings: Settings;
};

export type Launch = {
  kind: "launch";
  issue: number;
  mode: Mode;
  provider: Provider;
  model: string;
  effort: string;
  attempt: 1 | 2;
};

export type Decision =
  | { kind: "claim"; issue: number }
  | Launch
  | { kind: "skip"; issue: number; reason: string }
  | { kind: "stop"; issue: number; reason: string }
  | { kind: "fail"; issue: number; failure: string; log: string }
  | { kind: "keep"; issue: number }
  | { kind: "release"; issue: number };

export const labels = {
  ready: "ready-for-agent",
  running: "factory:running",
  failed: "factory:failed",
  orchestrated: "run:orchestrated",
};

// Each provider's agent CLI and the reasoning efforts it accepts.
const efforts: Record<Provider, string[]> = {
  "claude-code": ["low", "medium", "high", "xhigh", "max"],
  codex: ["low", "medium", "high", "xhigh"],
};

const vendorPrefixes: [string, Provider][] = [
  ["claude-", "claude-code"],
  ["gpt-", "codex"],
];

const defaultEffort = "high";

export function decideFactory(snapshot: Snapshot): Decision[] {
  const decisions: Decision[] = [];
  const running = new Map<Provider, number>();
  for (const run of snapshot.runs.filter((run) => run.ended === null))
    running.set(run.provider, (running.get(run.provider) ?? 0) + 1);
  for (const run of snapshot.runs)
    decisions.push(...settle(run, running, snapshot));
  for (const issue of oldestFirst(snapshot.issues)) {
    if (!issue.labels.includes(labels.ready)) continue;
    const reason =
      exclusion(issue) ??
      (snapshot.runs.some((run) => run.issue === issue.number)
        ? "a factory run for it is still on the host"
        : null);
    if (reason) {
      decisions.push({ kind: "skip", issue: issue.number, reason });
      continue;
    }
    const mode: Mode =
      issue.subIssues.length > 0 || issue.labels.includes(labels.orchestrated)
        ? "orchestrated"
        : "direct";
    const model = issueModel(issue, snapshot.settings);
    if ("error" in model) {
      decisions.push({
        kind: "skip",
        issue: issue.number,
        reason: model.error,
      });
      continue;
    }
    const gated = gate(model.provider, running, snapshot);
    if (gated) {
      decisions.push({ kind: "skip", issue: issue.number, reason: gated });
      continue;
    }
    running.set(model.provider, (running.get(model.provider) ?? 0) + 1);
    decisions.push(
      { kind: "claim", issue: issue.number },
      {
        kind: "launch",
        issue: issue.number,
        mode,
        ...model,
        attempt: 1,
      },
    );
  }
  return decisions;
}

// A running run over the time limit is stopped. An ended run releases its
// claim once its pull request merges and keeps it while the pull request is
// open. A failed first run retries once on the retry model, waiting for its
// gate; any other failure fails the issue.
function settle(
  run: Run,
  running: Map<Provider, number>,
  snapshot: Snapshot,
): Decision[] {
  const limit = snapshot.settings.timeLimitMinutes;
  const overtime = `the time limit of ${limit} minutes`;
  if (run.ended === null) {
    const elapsed = Date.parse(snapshot.now) - Date.parse(run.startedAt);
    return elapsed > limit * 60_000
      ? [{ kind: "stop", issue: run.issue, reason: `exceeded ${overtime}` }]
      : [];
  }
  if (!run.ended.timedOut && run.ended.pullRequest === "merged")
    return [{ kind: "release", issue: run.issue }];
  if (!run.ended.timedOut && run.ended.pullRequest === "open")
    return [{ kind: "keep", issue: run.issue }];
  const failure = run.ended.timedOut
    ? `the run exceeded ${overtime}`
    : "the run ended without an open pull request";
  const fail: Decision = {
    kind: "fail",
    issue: run.issue,
    failure,
    log: run.log,
  };
  const { retryModel } = snapshot.settings;
  if (run.attempt === 2 || retryModel === null) return [fail];
  const model = parseModel(retryModel);
  if ("error" in model) return [fail];
  const gated = gate(model.provider, running, snapshot);
  if (gated)
    return [
      { kind: "skip", issue: run.issue, reason: `retry waits: ${gated}` },
    ];
  running.set(model.provider, (running.get(model.provider) ?? 0) + 1);
  return [
    {
      kind: "launch",
      issue: run.issue,
      mode: run.mode,
      ...model,
      attempt: 2,
    },
  ];
}

// A launch needs fewer running agents than the provider's cap and, when its
// usage is readable, usage below the threshold.
function gate(
  provider: Provider,
  running: Map<Provider, number>,
  { settings, usage }: Snapshot,
): string | null {
  const cap = settings.caps[provider];
  if (cap === undefined) return `the host sets no cap for ${provider}`;
  if ((running.get(provider) ?? 0) >= cap)
    return `${provider} already runs its cap of ${cap} agent${cap === 1 ? "" : "s"}`;
  const used = usage[provider];
  if (typeof used === "number" && used >= settings.usageThreshold)
    return `${provider} usage ${used}% is at or above the ${settings.usageThreshold}% threshold`;
  return null;
}

type Model = { provider: Provider; model: string; effort: string };

function issueModel(
  issue: Issue,
  settings: Settings,
): Model | { error: string } {
  const named = issue.labels.filter((label) => label.startsWith("model:"));
  if (named.length > 1)
    return { error: `several model labels: ${named.join(", ")}` };
  if (named.length === 1) return parseModel(named[0].slice("model:".length));
  return parseModel(settings.defaultModel);
}

// A model is `<slug>` or `<provider>/<slug>`, with an optional `@<effort>`.
// A bare slug routes by its vendor prefix.
export function parseModel(value: string): Model | { error: string } {
  const at = value.lastIndexOf("@");
  const name = at === -1 ? value : value.slice(0, at);
  const effort = at === -1 ? defaultEffort : value.slice(at + 1);
  const slash = name.indexOf("/");
  let provider: string;
  let model: string;
  if (slash === -1) {
    model = name;
    const route = vendorPrefixes.find(([prefix]) => name.startsWith(prefix));
    if (!route)
      return {
        error: `model ${name} names no provider; label it model:<provider>/${name} with ${Object.keys(efforts).join(" or ")}`,
      };
    provider = route[1];
  } else {
    provider = name.slice(0, slash);
    model = name.slice(slash + 1);
  }
  if (!isProvider(provider)) return { error: unknownProvider(provider) };
  if (model === "") return { error: `model ${name} names no model` };
  if (!efforts[provider].includes(effort))
    return {
      error: `effort ${effort} is not one ${provider} accepts: ${efforts[provider].join(", ")}`,
    };
  return { provider, model, effort };
}

export function isProvider(value: string): value is Provider {
  return Object.hasOwn(efforts, value);
}

export function unknownProvider(value: string): string {
  return `provider ${value} is not ${Object.keys(efforts).join(" or ")}`;
}

function oldestFirst(issues: Issue[]): Issue[] {
  return issues.toSorted(
    (left, right) =>
      Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
      left.number - right.number,
  );
}

function exclusion(issue: Issue): string | null {
  if (issue.parent !== null) return `child of specification #${issue.parent}`;
  if (issue.labels.includes(labels.running))
    return "claimed by a running factory run";
  if (issue.labels.includes(labels.failed))
    return `labelled ${labels.failed}; remove the label to run it again`;
  const blockers = issue.blockedBy.filter(
    (blocker) => blocker.state === "open",
  );
  if (blockers.length > 0) return `blocked by ${references(blockers)}`;
  const unready = issue.subIssues.filter(
    (child) => child.state === "open" && !child.labels.includes(labels.ready),
  );
  if (unready.length > 0)
    return `children not ready for agent: ${references(unready)}`;
  return null;
}

function references(issues: { number: number }[]): string {
  return issues.map((issue) => `#${issue.number}`).join(", ");
}
