// The template-owned records reader shared by wait construction and status.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export class UsageError extends Error {}
const fail = (message) => {
  throw new UsageError(message);
};
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.trim() !== "";
const fields = (value, allowed, where) => {
  if (
    !object(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    fail(`${where}: invalid fields`);
};
const sorted = (values) =>
  [...values].sort((a, b) =>
    JSON.stringify(a).localeCompare(JSON.stringify(b)),
  );

// Only identities and raw observed values participate; response order does not.
export function normalizeChecks(value) {
  fields(value, ["runs", "statuses"], "checks");
  const normalize = (entries, names, nullable = []) => {
    if (!Array.isArray(entries))
      fail("checks: runs and statuses must be arrays");
    const seen = new Set();
    return sorted(
      entries.map((entry) => {
        fields(entry, names, "check");
        if (!(text(entry.id) || Number.isSafeInteger(entry.id)))
          fail("check: missing id");
        if (seen.has(String(entry.id))) fail(`check: duplicate id ${entry.id}`);
        seen.add(String(entry.id));
        return Object.fromEntries(
          names.map((name) => {
            const value = entry[name];
            if (
              name !== "id" &&
              !(nullable.includes(name) && value === null) &&
              !text(value)
            )
              fail(`check: invalid ${name}`);
            return [name, value];
          }),
        );
      }),
    );
  };
  return {
    runs: normalize(
      value.runs,
      ["id", "name", "status", "conclusion"],
      ["conclusion"],
    ),
    statuses: normalize(value.statuses, ["id", "context", "state"]),
  };
}

export function normalizeExpected(value) {
  fields(value, ["labels", "head", "checks"], "expected observation");
  if (Object.keys(value).length === 0) fail("expected observation is empty");
  const result = {};
  if (Object.hasOwn(value, "labels")) {
    if (!Array.isArray(value.labels) || !value.labels.every(text))
      fail("expected labels must be an array of names");
    result.labels = [...new Set(value.labels)].sort();
  }
  if (Object.hasOwn(value, "head")) {
    if (typeof value.head !== "string" || !/^[a-f0-9]{40}$/i.test(value.head))
      fail("expected head must be a full SHA");
    result.head = value.head.toLowerCase();
  }
  if (Object.hasOwn(value, "checks")) {
    if (!result.head) fail("expected checks require their observed head");
    result.checks = normalizeChecks(value.checks);
  }
  return result;
}

/** @returns {any} */
export function parseItem(reference, base = process.cwd()) {
  if (!text(reference)) fail("unrecognized item: missing reference");
  if (reference.startsWith("{")) {
    let spec;
    try {
      spec = JSON.parse(reference);
    } catch {
      fail(`invalid watch JSON ${reference}`);
    }
    fields(spec, ["item", "expected"], "watch");
    const item = parseItem(spec.item, base);
    if (Object.hasOwn(spec, "expected")) {
      if (item.kind !== "tracker")
        fail("expected observations require a tracker item");
      item.expected = normalizeExpected(spec.expected);
    }
    return item;
  }
  const local = /^(file|dir|launch):/.exec(reference)?.[1];
  if (local) {
    const path = reference.slice(local.length + 1);
    if (!text(path)) fail(`unrecognized item ${reference}`);
    const absolute = resolve(base, path);
    return {
      reference,
      kind: local,
      key: `${local}:${absolute}`,
      path: absolute,
      report: path,
    };
  }
  const match =
    /^([a-z0-9_.-]+)\/([a-z0-9_.-]+)#([1-9]\d*)$/i.exec(reference) ??
    /^https:\/\/github\.com\/([a-z0-9_.-]+)\/([a-z0-9_.-]+)\/(?:issues|pull)\/([1-9]\d*)\/?$/i.exec(
      reference,
    );
  if (!match) fail(`unrecognized item ${reference}`);
  const repository = `${match[1]}/${match[2]}`;
  return {
    reference,
    kind: "tracker",
    key: `${repository.toLowerCase()}#${match[3]}`,
    repository,
    number: Number(match[3]),
  };
}

export function unionWatches(items) {
  const union = new Map();
  for (const item of items) {
    const prior = union.get(item.key);
    if (
      prior &&
      JSON.stringify(prior.expected) !== JSON.stringify(item.expected)
    )
      fail(`conflicting expected observations for ${item.reference}`);
    if (!prior) union.set(item.key, item);
  }
  return [...union.values()];
}

export function launchComplete(path) {
  let report;
  try {
    report = readFileSync(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw new Error(`cannot read report ${path}: ${error.message}`, {
      cause: error,
    });
  }
  // Remove one normal terminal newline, preserving any later blank/content line.
  return (
    report
      .replace(/\r?\n$/, "")
      .split(/\r?\n/)
      .at(-1) === "status: done"
  );
}

const columns = {
  "In flight": [
    "Item",
    "Waiting on",
    "Since (UTC)",
    "Next check",
    "Evidence",
    "Watches",
  ],
  "Running launches": [
    "Host",
    "Kind",
    "Session",
    "Started (UTC)",
    "Item",
    "Report",
    "Next check",
  ],
  "Waiting on you": [
    "Item",
    "Decision/owner action",
    "Since (UTC)",
    "Next check",
  ],
};
const cells = (line) =>
  line
    .trim()
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replaceAll("\\|", "|"));
const literal = (value) =>
  /^`[^`]*`$/.test(value) ? value.slice(1, -1) : value;
const link = (value, where) => {
  const match = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(value);
  if (!match)
    fail(`${where}: expected linked Item or action, got ${value || "empty"}`);
  return match[2];
};
const time = (value, where) => {
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    fail(`${where}: invalid UTC time ${value}`);
};

// Each selected section must hold its table, even when there are no work rows.
export function readRecords(path) {
  try {
    const source = readFileSync(path, "utf8");
    const sections = new Map();
    let section;
    let fenced = false;
    for (const line of source.split(/\r?\n/)) {
      if (/^\s*```/.test(line)) {
        fenced = !fenced;
        continue;
      }
      if (fenced) continue;
      const heading = /^## (.+?)\s*$/.exec(line)?.[1];
      if (heading) {
        section = Object.hasOwn(columns, heading) ? heading : undefined;
        if (section) {
          if (sections.has(section)) fail(`duplicate ${section} section`);
          sections.set(section, []);
        }
        continue;
      }
      if (
        section &&
        line.trim() &&
        sections.get(section).length &&
        !line.trim().startsWith("|")
      )
        fail(`${section}: malformed table row ${line}`);
      if (section && line.trim().startsWith("|")) {
        if (!line.trim().endsWith("|"))
          fail(`${section}: malformed table row ${line}`);
        sections.get(section).push(cells(line));
      }
    }
    const tables = {};
    for (const [name, header] of Object.entries(columns)) {
      const table = sections.get(name);
      if (
        !table ||
        JSON.stringify(table[0]) !== JSON.stringify(header) ||
        table[1]?.length !== header.length ||
        !table[1].every((cell) => /^:?-+:?$/.test(cell))
      )
        fail(`${name}: missing or malformed table header`);
      tables[name] = table.slice(2).map((row, index) => {
        if (row.length !== header.length || row.some((cell) => !text(cell)))
          fail(`${name} row ${index + 1}: missing required field`);
        return Object.fromEntries(header.map((key, i) => [key, row[i]]));
      });
    }
    const items = new Map();
    const watches = [];
    const add = (row, kind) => {
      const identity = link(row.Item, `${kind} Item`);
      let item = items.get(identity);
      if (!item) {
        item = { item: row.Item };
        items.set(identity, item);
      }
      if (item[kind]) fail(`${kind}: duplicate Item ${row.Item}`);
      item[kind] = row;
      time(
        row[kind === "launch" ? "Started (UTC)" : "Since (UTC)"],
        `${kind} ${row.Item}`,
      );
      return item;
    };
    for (const row of tables["In flight"]) {
      const item = add(row, "flight");
      let specs;
      try {
        specs = JSON.parse(literal(row.Watches));
      } catch {
        fail(`In flight ${row.Item}: malformed Watches JSON`);
      }
      if (!Array.isArray(specs) || !specs.length)
        fail(`In flight ${row.Item}: no recorded wake mechanism`);
      for (const spec of specs) {
        if (object(spec) && Object.hasOwn(spec, "owner")) {
          fields(spec, ["owner"], "owner watch");
          if (spec.owner !== true || specs.length !== 1)
            fail(`In flight ${row.Item}: owner-only watch must stand alone`);
          item.ownerOnly = true;
        } else if (object(spec) && Object.hasOwn(spec, "event")) {
          fields(spec, ["event"], "harness event");
          if (!text(spec.event))
            fail(`In flight ${row.Item}: missing harness event`);
        } else {
          const watch = parseItem(JSON.stringify(spec), dirname(resolve(path)));
          if (watch.kind === "launch")
            fail(
              `In flight ${row.Item}: put launch reports in Running launches`,
            );
          if (watch.kind === "tracker" && !watch.expected)
            fail(`In flight ${row.Item}: tracker needs expected observation`);
          watches.push(watch);
        }
      }
    }
    for (const row of tables["Running launches"]) {
      const item = add(row, "launch");
      const report = literal(row.Report);
      if (!text(report))
        fail(`Running launches ${row.Item}: missing Report path`);
      item.launch.report = report;
      item.launch.path = resolve(dirname(resolve(path)), report);
      watches.push(parseItem(`launch:${report}`, dirname(resolve(path))));
    }
    for (const row of tables["Waiting on you"]) {
      add(row, "owner");
      link(row["Decision/owner action"], `owner ${row.Item}`);
    }
    for (const item of items.values())
      if (item.ownerOnly && !item.owner)
        fail(`${item.item}: owner-only wait needs a Waiting on you row`);
    watches.push(parseItem("dir:incoming", dirname(resolve(path))));
    return { items: [...items.values()], watches: unionWatches(watches) };
  } catch (error) {
    throw new UsageError(`${path}: ${error.message}`, { cause: error });
  }
}

// Scriptorium owns validation and projection. Preserve its facts, provenance,
// unavailable values and additive fields without deriving admission policy.
export function renderBudget(path) {
  try {
    const budget = JSON.parse(readFileSync(path, "utf8"));
    if (
      !object(budget) ||
      budget.version !== 1 ||
      !text(budget.observedAt) ||
      !Number.isFinite(Date.parse(budget.observedAt)) ||
      !object(budget.models) ||
      !object(budget.capacity) ||
      !Array.isArray(budget.providers)
    )
      fail(
        "expected Scriptorium status version 1 with models, capacity and providers",
      );
    return `\n## Launch budget\n\nObserved ${budget.observedAt}; not a launch grant or reservation.\n\n\`\`\`json\n${JSON.stringify(budget, null, 2)}\n\`\`\`\n`;
  } catch (error) {
    throw new UsageError(`${path}: ${error.message}`, { cause: error });
  }
}

export function renderStatus(records) {
  const rows = records.items.map((item) => {
    const { flight, launch, owner } = item;
    if (launch && launchComplete(launch.path))
      return [
        item.item,
        "turn ended; read report",
        "—",
        launch["Started (UTC)"],
        `read [${launch.report}](${launch.report})`,
      ];
    if (owner)
      return [
        item.item,
        "—",
        owner["Decision/owner action"],
        owner["Since (UTC)"],
        owner["Next check"],
      ];
    return [
      item.item,
      flight?.["Waiting on"] ?? launch.Kind,
      "—",
      launch?.["Started (UTC)"] ?? flight["Since (UTC)"],
      launch?.["Next check"] ?? flight["Next check"],
    ];
  });
  return (
    [
      "| Item | Running | Waiting on owner | Since (UTC) | Next check |",
      "| ---- | ------- | ---------------- | ----------- | ---------- |",
      ...rows.map(
        (row) =>
          `| ${row.map((cell) => cell.replaceAll("|", "\\|")).join(" | ")} |`,
      ),
    ].join("\n") + "\n"
  );
}
