// Repository-owned names, shared by validation, wait and merge.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const requiredChecksTarget = ".github/required-checks.json";

// Seam (deferred): off-Actions status contexts, also posted by the neutral validator's check command; consumers: 2; extract at 3.
const locationContexts = {
  runner: "Runner checks",
  "self-reported": "Review rerun",
};

// The declaration tells the check location; no run reads the selection.
export const checkLocation = (names) =>
  Object.entries(locationContexts).find(([, context]) =>
    names.includes(context),
  )?.[0] ?? "github";

export const readRequiredChecks = (root = process.cwd()) =>
  parseRequiredChecks(readFileSync(join(root, requiredChecksTarget), "utf8"));

export function parseRequiredChecks(text) {
  const invalid = (field) => {
    throw new Error(`${requiredChecksTarget}: ${field}`);
  };
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    invalid(`invalid JSON: ${error.message}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("root must be an object.");
  if (value.version !== 1) invalid("version must be 1.");
  if (!Array.isArray(value.checks) || !value.checks.length)
    invalid("checks must be a nonempty array.");
  value.checks.forEach((name, index) => {
    if (typeof name !== "string" || !name.trim())
      invalid(`checks[${index}] must be a nonempty string.`);
  });
  if (
    Object.values(locationContexts).every((name) => value.checks.includes(name))
  )
    invalid(
      `checks must not name both ${Object.values(locationContexts).join(" and ")}; each names a different check location.`,
    );
  return value.checks;
}

const failedConclusions = new Set([
  "ACTION_REQUIRED",
  "CANCELLED",
  "FAILURE",
  "STALE",
  "STARTUP_FAILURE",
  "TIMED_OUT",
  "ERROR",
]);

// Turns GitHub's status check rollup, read through Access, into check states. Any unfinished
// run keeps its check pending; otherwise the latest-started run wins.
export const checkStates = (rollup, positiveOnly = false) => {
  const latest = new Map();
  for (const item of rollup ?? []) {
    const isRun = item.__typename === "CheckRun";
    const name = isRun ? item.name : item.context;
    const key = `${positiveOnly ? item.__typename : ""}/${item.workflowName ?? ""}/${name}`;
    const known = latest.get(key);
    const result = isRun
      ? item.status === "COMPLETED"
        ? item.conclusion
        : "PENDING"
      : item.state;
    const pending = ["PENDING", "EXPECTED"].includes(result);
    if (known) {
      const knownPending = known.check.state === "pending";
      if (knownPending && !pending) continue;
      if (
        knownPending === pending &&
        (known.startedAt ?? "") > (item.startedAt ?? "")
      )
        continue;
    }
    if (
      positiveOnly &&
      known &&
      known.startedAt === item.startedAt &&
      known.check.state === "fail"
    )
      continue;
    latest.set(key, {
      startedAt: item.startedAt,
      check: {
        name,
        state: pending
          ? "pending"
          : (
                positiveOnly
                  ? result !== "SUCCESS"
                  : failedConclusions.has(result)
              )
            ? "fail"
            : "pass",
        link: isRun ? item.detailsUrl : item.targetUrl,
        ...(isRun
          ? {
              workflowName: item.workflowName,
              checkRunStartedAt: item.startedAt,
            }
          : {}),
      },
    });
  }
  return [...latest.values()].map((entry) => entry.check);
};

// A trusted creator counts only the commit statuses that account created.
export function requiredCheckStates(
  rollup,
  names,
  creator = null,
  workflowChecks = [],
) {
  return names.flatMap((name) => {
    let matches = rollup.filter(
      (item) =>
        (item.name ?? item.context) === name &&
        (creator === null ||
          (item.__typename === "StatusContext" && item.creator === creator)),
    );
    const statuses = matches.filter(
      (item) => item.__typename === "StatusContext",
    );
    if (statuses.length > 1) {
      if (statuses.some((item) => !Number.isFinite(Date.parse(item.createdAt))))
        throw new Error(
          `Ambiguous commit-status attempts for required check ${name}.`,
        );
      const latest = statuses
        .map((item) => item.createdAt)
        .sort()
        .at(-1);
      matches = matches.filter(
        (item) =>
          item.__typename !== "StatusContext" || item.createdAt === latest,
      );
    }
    if (matches.length) return checkStates(matches, true);
    if (workflowChecks.some((check) => check.name === name)) return [];
    return [{ name, state: "pending" }];
  });
}

// Order distinct runs of one workflow by when their latest attempts started.
// A job's start time has no bearing on its membership in an attempt.
export function workflowAttempts(runs) {
  const byId = new Map();
  const latest = new Map();
  for (const run of runs) {
    if (byId.has(run.id)) throw new Error(`Ambiguous workflow run ${run.id}.`);
    byId.set(run.id, run);
    const start = Date.parse(run.run_started_at ?? run.created_at);
    const previous = latest.get(run.workflow_id);
    if (!previous || start > previous.start)
      latest.set(run.workflow_id, { run, start, ambiguous: false });
    else if (start === previous.start) previous.ambiguous = true;
  }
  const latestRuns = [];
  for (const { run, ambiguous } of latest.values()) {
    if (ambiguous)
      throw new Error(
        `Ambiguous latest workflow run for ${run.name} (workflow ${run.workflow_id}).`,
      );
    latestRuns.push(run);
  }
  return { byId, latestRuns };
}

function attemptJobs(pages, run) {
  const evidence = `jobs for workflow run ${run.id} attempt ${run.run_attempt}`;
  const count = pages[0]?.total_count;
  const jobs = new Map();
  if (!Number.isSafeInteger(count) || count < 0)
    throw new Error(`Could not read complete ${evidence}.`);
  for (const page of pages) {
    if (page?.total_count !== count || !Array.isArray(page.jobs))
      throw new Error(`Could not read complete ${evidence}.`);
    for (const job of page.jobs) {
      if (
        !Number.isSafeInteger(job?.id) ||
        job.id <= 0 ||
        job.run_id !== run.id ||
        typeof job.name !== "string" ||
        !job.name
      )
        throw new Error(`Could not read a job identity in ${evidence}.`);
      if (jobs.has(job.id))
        throw new Error(`Ambiguous ${evidence}: duplicate job ${job.id}.`);
      jobs.set(job.id, job.name);
    }
  }
  if (jobs.size !== count)
    throw new Error(`Could not read complete ${evidence}.`);
  return jobs;
}

const jobLink =
  /^https?:\/\/[^/]+\/[^/]+\/[^/]+\/(?:actions\/)?runs\/(\d+)\/jobs?\/(\d+)(?:[/?#]|$)/;

function workflowCheckStates(
  rollup,
  names,
  { byId, latestRuns },
  jobsByRun,
  creator,
) {
  const ordinary = [];
  const members = new Map(latestRuns.map((run) => [run.id, new Map()]));
  const requiredByWorkflow = new Map(
    latestRuns.map((run) => [run.workflow_id, new Set()]),
  );
  for (const item of rollup) {
    const required = names.includes(item.name);
    const link =
      item.__typename === "CheckRun" && jobLink.exec(item.detailsUrl ?? "");
    if (!link && !item.workflowName) {
      ordinary.push(item);
      continue;
    }
    if (required && creator !== null) continue;
    const run = link && byId.get(Number(link[1]));
    if (!run) {
      if (required)
        throw new Error(
          `Could not identify the workflow run and job for required check ${item.name}.`,
        );
      ordinary.push(item);
      continue;
    }
    if (required) requiredByWorkflow.get(run.workflow_id).add(item.name);
    const job = Number(link[2]);
    const current = members.get(run.id);
    const jobName = current && jobsByRun.get(run.id).get(job);
    if (!jobName) continue;
    const check = checkStates([item], required)[0];
    const previous = current.get(job);
    if (jobName !== check.name || (previous && previous.state !== check.state))
      throw new Error(
        `Ambiguous check evidence for workflow run ${run.id} attempt ${run.run_attempt} job ${job} (${item.name}).`,
      );
    current.set(job, check);
  }
  const checks = [];
  for (const run of latestRuns) {
    const observed = members.get(run.id);
    const expected = requiredByWorkflow.get(run.workflow_id);
    const jobNames = jobsByRun.get(run.id);
    for (const check of observed.values()) {
      checks.push(check);
      expected.delete(check.name);
    }
    for (const [id, name] of jobNames) {
      if (creator === null && names.includes(name) && !observed.has(id))
        expected.add(name);
    }
    for (const name of expected)
      checks.push({ name, state: "pending", link: run.html_url });
    if (
      run.status === "completed" &&
      failedConclusions.has(run.conclusion?.toUpperCase()) &&
      ![...observed.values()].some((check) => check.state === "fail")
    )
      checks.push({ name: run.name, state: "fail", link: run.html_url });
  }
  return { ordinary, checks };
}

export function validationCheckStates(
  rollup,
  names,
  workflows,
  jobsByRun,
  creator = null,
) {
  const { ordinary, checks } = workflowCheckStates(
    rollup,
    names,
    workflows,
    jobsByRun,
    creator,
  );
  return [
    ...checkStates(ordinary).filter((check) => !names.includes(check.name)),
    ...requiredCheckStates(ordinary, names, creator, checks),
    ...checks,
  ];
}

// Both delivery entry points use this verdict. Wait owns review and timing.
export function checkVerdict(checks, runs = []) {
  return {
    failing: checks.filter((check) => check.state === "fail"),
    checksPending:
      checks.length === 0 ||
      checks.some((check) => check.state === "pending") ||
      runs.some((run) => run.status !== "completed"),
  };
}

export async function currentHeadValidation(
  { rollup, runs, readAttemptJobs },
  names,
  creator,
) {
  const workflows = workflowAttempts(runs);
  const jobsByRun = new Map(
    await Promise.all(
      workflows.latestRuns.map(async (run) => {
        const jobs = attemptJobs(await readAttemptJobs(run), run);
        return /** @type {const} */ ([run.id, jobs]);
      }),
    ),
  );
  const checks = validationCheckStates(
    rollup,
    names,
    workflows,
    jobsByRun,
    creator,
  );
  return { checks, ...checkVerdict(checks, runs) };
}
