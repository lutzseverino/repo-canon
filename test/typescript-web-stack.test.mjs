import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { fixture, invokeCheck, snapshot } from "./helpers/operation.mjs";

const manifest = (overrides = {}) =>
  JSON.stringify({
    name: "web",
    packageManager: "pnpm@11.1.2",
    engines: { node: "^24.0.0 || ^26.0.0" },
    scripts: {
      validate: "pnpm run ui:check",
      "ui:add": "shadcn add",
      "ui:update": "shadcn add --overwrite",
      "ui:check": "node integrity.mjs",
    },
    devDependencies: {
      oxlint: "1.86.0",
      prettier: "3.9.9",
      shadcn: "4.1.0",
      "prettier-plugin-astro": "0.14.0",
    },
    ...overrides,
  });
const components = JSON.stringify({
  style: "base-nova",
  iconLibrary: "lucide",
});
const standalone = {
  "package.json": manifest(),
  "pnpm-lock.yaml": "",
  "components.json": components,
};
function check(t, stack, files, paths = ["package.json"]) {
  const project = fixture(files);
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = invokeCheck(
    fileURLToPath(
      new URL(
        `../operations/check-typescript-${stack}-stack.mjs`,
        import.meta.url,
      ),
    ),
    project.root,
    {
      operation: {
        declaration: `typescript-${stack}-stack`,
        phase: "checks",
        id: "manifests",
      },
      allowedTargets: { paths, directories: [] },
    },
  );
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(snapshot(project.root), before);
  return outcome.result;
}
test("conforming Sites and testless Apps pass manifest checks with assessment limits", (t) => {
  for (const stack of ["astro", "vite"]) {
    const result = check(t, stack, standalone);
    assert.equal(result.status, "passed", result.message);
    assert.match(result.message, /assessment/);
  }
});

import { spawnSync } from "node:child_process";
function draft(t, stack, files, script) {
  const project = fixture(files);
  t.after(project.close);
  const before = snapshot(project.root);
  const outcome = spawnSync(
    process.execPath,
    [
      script ??
        fileURLToPath(
          new URL(
            `../discovery/draft-typescript-${stack}-stack-scope.mjs`,
            import.meta.url,
          ),
        ),
    ],
    {
      encoding: "utf8",
      input: JSON.stringify({
        format: "repo-standards/discovery/v1",
        declaration: `typescript-${stack}-stack`,
        projectRoot: project.root,
      }),
    },
  );
  assert.equal(outcome.status, 0, outcome.stderr);
  assert.deepEqual(snapshot(project.root), before);
  return JSON.parse(outcome.stdout).declarations[0];
}
const webFiles = (stack, directory = "", overrides = {}) =>
  Object.fromEntries(
    Object.entries({
      "package.json": manifest({
        description:
          stack === "astro"
            ? "A content site built ahead of time"
            : "A client-side app owning routing and state",
        dependencies:
          stack === "astro"
            ? { astro: "7.0.0" }
            : { vite: "8.0.0", react: "19.0.0" },
        ...overrides,
      }),
      [`${stack}.config.mjs`]: "export default {};\n",
      "components.json": components,
      "src/index.ts": "export {};\n",
    }).map(([path, content]) => [
      directory ? `${directory}/${path}` : path,
      content,
    ]),
  );
test("discovery proposes an Astro Site and excludes it from Node and Vite", (t) => {
  const files = { ...webFiles("astro"), "pnpm-lock.yaml": "" };
  assert.equal(draft(t, "astro", files).candidates[0].decision, "include");
  for (const stack of ["vite", "node"]) {
    const entry = draft(t, stack, files);
    assert.equal(entry.noScope, true);
    assert.equal(entry.candidates[0].decision, "exclude");
    assert.match(entry.candidates[0].reason, /typescript-astro/);
  }
});

const workspace = {
  "package.json": manifest({ name: "root" }),
  "pnpm-lock.yaml": "",
  "pnpm-workspace.yaml": "packages: [apps/*, packages/*, services/*]\n",
};
const decisions = (entry) =>
  Object.fromEntries(
    entry.candidates.map((candidate) => [candidate.path, candidate.decision]),
  );
test("an App assigns framework-less UI and non-UI packages to Vite with a centralized holder", (t) => {
  const files = {
    ...workspace,
    ...webFiles("vite", "apps/web", {
      dependencies: {
        vite: "8.0.0",
        react: "19.0.0",
        "@fixture/ui": "workspace:*",
        "@fixture/design": "workspace:*",
      },
    }),
    "packages/ui/package.json": manifest({
      name: "@fixture/ui",
      dependencies: { react: "19.0.0" },
    }),
    "packages/ui/components.json": components,
    "packages/design/package.json": manifest({ name: "@fixture/design" }),
  };
  delete files["apps/web/components.json"];
  const entry = draft(t, "vite", files);
  assert.equal(decisions(entry)["apps/web/package.json"], "include");
  assert.equal(decisions(entry)["packages/ui/package.json"], "include");
  assert.equal(decisions(entry)["packages/design/package.json"], "include");
  assert.equal(
    check(t, "vite", files, [
      "apps/web/package.json",
      "packages/ui/package.json",
      "packages/design/package.json",
    ]).status,
    "passed",
  );
  assert.equal(
    decisions(draft(t, "node", files))["packages/design/package.json"],
    "exclude",
  );
});

test("Astro wins shared membership, while a no-stack landing Site does not compete", (t) => {
  const files = {
    ...workspace,
    ...webFiles("vite", "apps/web", {
      dependencies: { vite: "8.0.0", react: "19.0.0", shared: "workspace:*" },
    }),
    ...webFiles("astro", "apps/site", {
      dependencies: { astro: "7.0.0", shared: "workspace:*" },
    }),
    "packages/shared/package.json": manifest({ name: "shared" }),
  };
  assert.equal(
    decisions(draft(t, "astro", files))["packages/shared/package.json"],
    "include",
  );
  assert.equal(
    decisions(draft(t, "vite", files))["packages/shared/package.json"],
    "exclude",
  );
  delete files["apps/site/astro.config.mjs"];
  files["apps/site/vite.config.mjs"] = "export default {};";
  files["apps/site/package.json"] = manifest({
    description: "A static landing site",
    dependencies: { vite: "8.0.0", react: "19.0.0", shared: "workspace:*" },
  });
  for (const stack of ["node", "astro", "vite"]) {
    const entry = draft(t, stack, files);
    assert.equal(decisions(entry)["apps/site/package.json"], "exclude");
    assert.match(
      entry.candidates.find(
        (candidate) => candidate.path === "apps/site/package.json",
      ).reason,
      /Site in no web stack/,
    );
  }
  assert.equal(
    decisions(draft(t, "vite", files))["packages/shared/package.json"],
    "include",
  );
});

test("synthetic mixed App/API consumers leave protocol in Node; unknown web evidence stays unresolved", (t) => {
  const files = {
    ...workspace,
    ...webFiles("vite", "apps/web", {
      dependencies: { vite: "8.0.0", react: "19.0.0", protocol: "workspace:*" },
    }),
    "services/api/package.json": manifest({
      name: "api",
      dependencies: { protocol: "workspace:*" },
    }),
    "packages/protocol/package.json": manifest({ name: "protocol" }),
    "packages/orphan/package.json": manifest({
      name: "orphan",
      dependencies: { react: "19.0.0" },
    }),
  };
  const node = draft(t, "node", files);
  assert.equal(decisions(node)["packages/protocol/package.json"], "include");
  assert.equal(decisions(node)["services/api/package.json"], "include");
  assert.equal(decisions(node)["apps/web/package.json"], "exclude");
  for (const stack of ["node", "astro", "vite"]) {
    const entry = draft(t, stack, files);
    assert.equal(decisions(entry)["packages/orphan/package.json"], "exclude");
    assert.ok(
      entry.unresolved.some((question) =>
        question.includes("packages/orphan/package.json"),
      ),
    );
  }
});

test("web workspace roots, shared-only roots and standalone catalog roots have independent membership", (t) => {
  const files = {
    ...workspace,
    ...webFiles("astro"),
    ...webFiles("vite", "apps/web"),
  };
  assert.equal(decisions(draft(t, "astro", files))["package.json"], "include");
  files["package.json"] = manifest({
    description: "A content site built ahead of time",
    dependencies: { astro: "7.0.0" },
    scripts: {},
  });
  const differs = draft(t, "astro", files).candidates.find(
    (candidate) => candidate.path === "package.json",
  );
  assert.equal(differs.decision, "exclude");
  assert.match(differs.reason, /validate/);
  assert.equal(
    decisions(draft(t, "vite", files))["apps/web/package.json"],
    "include",
  );
  const sharedRoot = draft(t, "vite", workspace).candidates.find(
    (candidate) => candidate.path === "package.json",
  );
  assert.equal(sharedRoot.decision, "exclude");
  const standaloneRoot = {
    ...webFiles("astro"),
    "pnpm-lock.yaml": "",
    "pnpm-workspace.yaml": "catalog:\n  oxlint: 1.86.0\n",
  };
  assert.equal(
    decisions(draft(t, "astro", standaloneRoot))["package.json"],
    "include",
  );
});

test("Vite and React without Site/App evidence never become a Node fallback or an assumed App", (t) => {
  const files = {
    ...webFiles("vite", "", { description: undefined }),
    "pnpm-lock.yaml": "",
  };
  for (const stack of ["astro", "vite", "node"]) {
    const entry = draft(t, stack, files);
    assert.equal(entry.noScope, true);
    assert.equal(entry.candidates[0].decision, "exclude");
    assert.ok(entry.unresolved.length);
  }
});

test("web checks report tool, script and holder corrections, leaving framework and runner majors to assessment", (t) => {
  /** @type {[object, RegExp][]} */
  const cases = [
    [
      {
        ...standalone,
        "package.json": manifest({ packageManager: "pnpm@10.0.0" }),
      },
      /pnpm/,
    ],
    [
      {
        ...standalone,
        "package.json": manifest({ engines: { node: ">=24" } }),
      },
      /engines.node/,
    ],
    [
      {
        ...standalone,
        "package.json": manifest({
          devDependencies: { oxlint: "2.0.0", prettier: "2.0.0" },
        }),
      },
      /oxlint.*major 1/,
    ],
    [{ ...standalone, "package.json": manifest({ scripts: {} }) }, /validate/],
    [
      {
        ...standalone,
        "components.json": JSON.stringify({
          style: "radix-nova",
          iconLibrary: "other",
        }),
      },
      /base-.*lucide/,
    ],
    [
      {
        ...standalone,
        "package.json": manifest({
          devDependencies: {
            oxlint: "1.0.0",
            prettier: "3.0.0",
            shadcn: "^4.0.0",
          },
        }),
      },
      /exact major-4/,
    ],
  ];
  for (const [files, expected] of cases) {
    const result = check(t, "vite", files);
    assert.equal(result.status, "failed", result.message);
    assert.match(result.message, expected);
  }
  const noHolder = { ...standalone };
  delete noHolder["components.json"];
  assert.match(check(t, "vite", noHolder).message, /Establish a shadcn holder/);
  const noPlugin = {
    ...standalone,
    "package.json": manifest({
      devDependencies: { oxlint: "1.0.0", prettier: "3.0.0", shadcn: "4.0.0" },
    }),
  };
  assert.equal(check(t, "vite", noPlugin).status, "passed");
  assert.match(check(t, "astro", noPlugin).message, /prettier-plugin-astro/);
  const assessedMajors = {
    ...standalone,
    "package.json": manifest({
      dependencies: {
        astro: "1.0.0",
        react: "1.0.0",
        tailwindcss: "1.0.0",
        typescript: "1.0.0",
        vitest: "1.0.0",
      },
    }),
  };
  assert.equal(check(t, "astro", assessedMajors).status, "passed");
});

test("default and named catalogs resolve checked tools and exact shadcn pins", (t) => {
  const files = {
    ...standalone,
    "package.json": manifest({
      devDependencies: {
        oxlint: "catalog:",
        prettier: "catalog:tools",
        shadcn: "catalog:",
        "prettier-plugin-astro": "catalog:tools",
      },
    }),
    "pnpm-workspace.yaml":
      "catalog:\n  oxlint: 1.86.0\n  shadcn: 4.1.0\ncatalogs:\n  tools:\n    prettier: 3.9.9\n    prettier-plugin-astro: 0.14.0\n",
  };
  assert.equal(check(t, "astro", files).status, "passed");
  for (const [
    from,
    to,
    expected,
  ] of /** @type {[string, string, RegExp][]} */ ([
    ["4.1.0", "^4.1.0", /exact major-4/],
    ["3.9.9", "2.0.0", /prettier.*major 3/],
    ["shadcn: 4.1.0", "other: 4.1.0", /unresolved catalog/],
    [
      "prettier-plugin-astro: 0.14.0",
      "other: 0.14.0",
      /prettier-plugin-astro.*no catalog/,
    ],
  ])) {
    const result = check(t, "astro", {
      ...files,
      "pnpm-workspace.yaml": files["pnpm-workspace.yaml"].replace(from, to),
    });
    assert.equal(result.status, "failed", result.message);
    assert.match(result.message, expected);
  }
});

import { retainedCheck } from "./helpers/operation.mjs";
test("installed web checks and all three drafters retain their shared resources", (t) => {
  for (const stack of ["astro", "vite"]) {
    const script = retainedCheck(
      t,
      `operations/check-typescript-${stack}-stack.mjs`,
    );
    const project = fixture(standalone);
    t.after(project.close);
    const outcome = invokeCheck(script, project.root, {
      allowedTargets: { paths: ["package.json"], directories: [] },
    });
    assert.equal(outcome.status, 0, outcome.stderr);
    assert.equal(outcome.result.status, "passed", outcome.result.message);
    const refused = invokeCheck(script, project.root, {
      allowedTargets: { paths: ["src/main.ts"], directories: [] },
    });
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /package.json/);
    const entry = draft(
      t,
      stack,
      { ...webFiles(stack), "pnpm-lock.yaml": "" },
      retainedCheck(t, `discovery/draft-typescript-${stack}-stack-scope.mjs`),
    );
    assert.equal(entry.candidates[0].decision, "include");
    const empty = draft(t, stack, { "README.md": "No web projects." });
    assert.equal(empty.noScope, true);
    assert.deepEqual(empty.unresolved, []);
  }
});

test("a differing Site cannot choose the stack of a shared package used by a matching App", (t) => {
  const files = {
    ...workspace,
    ...webFiles("vite", "apps/web", {
      dependencies: { vite: "8.0.0", react: "19.0.0", shared: "workspace:*" },
    }),
    ...webFiles("astro", "apps/site", {
      scripts: {},
      dependencies: { astro: "7.0.0", shared: "workspace:*" },
    }),
    "packages/shared/package.json": manifest({ name: "shared" }),
  };
  assert.equal(
    decisions(draft(t, "vite", files))["packages/shared/package.json"],
    "include",
  );
  const astro = draft(t, "astro", files);
  assert.equal(decisions(astro)["packages/shared/package.json"], "exclude");
  assert.match(
    astro.candidates.find(
      (candidate) => candidate.path === "apps/site/package.json",
    ).reason,
    /validate/,
  );
});

test("a shared-only root supplies facts without joining its member's web stack", (t) => {
  const files = { ...workspace, ...webFiles("vite", "apps/web") };
  const entry = draft(t, "vite", files);
  const root = entry.candidates.find(
    (candidate) => candidate.path === "package.json",
  );
  assert.equal(root.decision, "exclude");
  assert.match(root.reason, /shared workspace configuration/);
  assert.equal(decisions(entry)["apps/web/package.json"], "include");
});

test("a missing holder script is named and mixed-consumer Node differences are retained", (t) => {
  const parsed = JSON.parse(standalone["package.json"]);
  for (const script of ["ui:add", "ui:update", "ui:check"]) {
    const scripts = { ...parsed.scripts };
    delete scripts[script];
    const result = check(t, "vite", {
      ...standalone,
      "package.json": manifest({ scripts }),
    });
    assert.equal(result.status, "failed");
    assert.ok(result.message.includes(script));
  }
  const files = {
    ...workspace,
    ...webFiles("vite", "apps/web", {
      dependencies: { vite: "8.0.0", react: "19.0.0", protocol: "workspace:*" },
    }),
    "services/api/package.json": manifest({
      name: "api",
      dependencies: { protocol: "workspace:*" },
    }),
    "packages/protocol/package.json": manifest({
      name: "protocol",
      scripts: {},
    }),
  };
  const entry = draft(t, "node", files);
  const protocol = entry.candidates.find(
    (candidate) => candidate.path === "packages/protocol/package.json",
  );
  assert.equal(protocol.decision, "exclude");
  assert.match(protocol.reason, /validate/);
});
