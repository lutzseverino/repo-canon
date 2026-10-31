import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isRegularFile,
  joinPath,
  manifestName,
  parentOf,
  pnpmCatalogs,
  pnpmWorkspaceName,
  readManifest,
  stackDifferences,
  toolDifference,
  workspaceRootOf,
} from "./typescript-node-stack.mjs";

function catalogsAt(projectRoot, root) {
  const path = joinPath(root, pnpmWorkspaceName);
  return isRegularFile(projectRoot, path)
    ? pnpmCatalogs(readFileSync(join(projectRoot, path), "utf8"))
    : new Map();
}

// Workspace dependency edges are evidence of a centralized shadcn holder.
// Only manifests in this same workspace participate; names in unrelated trees
// cannot establish a relationship. Consumers can reach a holder transitively.
export function workspacePackages(projectRoot, root, files) {
  return [...files]
    .filter(
      (path) => path === manifestName || path.endsWith(`/${manifestName}`),
    )
    .flatMap((path) => {
      const workspace = workspaceRootOf(projectRoot, path);
      const { manifest } = readManifest(projectRoot, path);
      return manifest && workspace.root === root ? [{ path, manifest }] : [];
    });
}
export function packageDependencies(manifest) {
  return Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies,
  });
}
function holderPaths(projectRoot, path, packages) {
  const visited = new Set();
  const holders = [];
  const visit = (current) => {
    if (visited.has(current.path)) return;
    visited.add(current.path);
    if (
      isRegularFile(
        projectRoot,
        joinPath(parentOf(current.path), "components.json"),
      )
    ) {
      holders.push(current.path);
      return;
    }
    for (const name of packageDependencies(current.manifest)) {
      const matches = packages.filter((entry) => entry.manifest.name === name);
      if (matches.length === 1) visit(matches[0]);
    }
  };
  const project = packages.find((entry) => entry.path === path);
  if (project) visit(project);
  return holders;
}

// This check adds only the formatter plugin and shadcn manifest/configuration
// facts to Node's boundary. It does not resolve frameworks through consumers.
export function webStackDifferences(
  projectRoot,
  path,
  stack,
  files,
  memberships = undefined,
) {
  const result = stackDifferences(projectRoot, path);
  if (result.workspaceRoot === null) return result;
  const { manifest } = readManifest(projectRoot, path);
  const rootPath = joinPath(result.workspaceRoot, manifestName);
  const root = {
    path: rootPath,
    manifest: readManifest(projectRoot, rootPath).manifest,
    catalogs: catalogsAt(projectRoot, result.workspaceRoot),
  };
  if (stack === "astro") {
    const difference = toolDifference(
      { name: "prettier-plugin-astro" },
      { path, manifest },
      root,
    );
    if (difference) result.differences.push(difference);
  }
  const packages = workspacePackages(projectRoot, result.workspaceRoot, files);
  const ownConfig = joinPath(parentOf(path), "components.json");
  const classification = (
    memberships ?? classifyWebPackages(projectRoot, files)
  ).get(path);
  // Confirmed shared packages without UI need no shadcn declaration of their own.
  const shared = classification?.kind === "shared";
  const holders =
    shared && !isRegularFile(projectRoot, ownConfig)
      ? []
      : holderPaths(projectRoot, path, packages);
  if (!shared && holders.length === 0)
    result.differences.push(
      `Establish a shadcn holder for \`${path}\`: keep components.json here or evidence a workspace dependency on its holder.`,
    );
  for (const holder of holders) {
    const config = joinPath(parentOf(holder), "components.json");
    result.evidence.push(holder, config);
    let value;
    try {
      value = JSON.parse(readFileSync(join(projectRoot, config), "utf8"));
    } catch {
      /* A correction below names the unreadable configuration. */
    }
    if (typeof value?.style !== "string" || !value.style.startsWith("base-"))
      result.differences.push(
        `Set \`${config}\` style to a base-* style (Base UI).`,
      );
    if (value?.iconLibrary !== "lucide")
      result.differences.push(`Set \`${config}\` iconLibrary to lucide.`);
    const holderManifest = readManifest(projectRoot, holder).manifest;
    let pin = holderManifest?.devDependencies?.shadcn;
    const declaredPin = pin;
    if (typeof pin === "string" && pin.startsWith("catalog:"))
      pin = root.catalogs.get(pin.slice(8) || "default")?.get("shadcn");
    if (
      typeof pin !== "string" ||
      !/^4\.\d+\.\d+(?:\+[0-9A-Za-z.-]+)?$/.test(pin)
    )
      result.differences.push(
        `Declare shadcn as an exact major-4 devDependency in \`${holder}\`; ${JSON.stringify(declaredPin) ?? "missing"}${declaredPin?.startsWith?.("catalog:") ? ` resolves to ${JSON.stringify(pin) ?? "an unresolved catalog"}` : ""} is not an exact pin.`,
      );
    for (const script of ["ui:add", "ui:update", "ui:check"])
      if (
        typeof holderManifest?.scripts?.[script] !== "string" ||
        holderManifest.scripts[script].trim() === ""
      )
        result.differences.push(
          `Add \`${script}\` to shadcn holder \`${holder}\`.`,
        );
  }
  result.evidence = [...new Set(result.evidence)];
  return result;
}

// Kept regular files only, also used by installed command entry points.
export { keptFiles } from "./stack-files.mjs";

// Framework configuration is candidate evidence. README semantics or source
// behavior must distinguish a browser-owned interface from a Vite-built Site.
export function classifyWebPackages(projectRoot, files) {
  const entries = [...files]
    .filter(
      (path) => path === manifestName || path.endsWith(`/${manifestName}`),
    )
    .map((path) => ({
      path,
      manifest: readManifest(projectRoot, path).manifest,
    }));
  const classified = new Map();
  for (const { path, manifest } of entries) {
    if (!manifest) continue;
    const directory = parentOf(path);
    const ownFiles = [...files]
      .filter(
        (file) =>
          (directory === "" || file.startsWith(`${directory}/`)) &&
          !entries.some(
            (other) =>
              other.path !== path &&
              parentOf(other.path) !== "" &&
              (directory === "" ||
                parentOf(other.path).startsWith(`${directory}/`)) &&
              file.startsWith(`${parentOf(other.path)}/`),
          ),
      )
      .map((file) => ({
        path: file,
        relative: directory ? file.slice(directory.length + 1) : file,
      }));
    const dependencies = packageDependencies(manifest);
    const configs = ownFiles.filter((file) =>
      /^(astro|vite)\.config\.[cm]?[jt]s$/.test(file.relative),
    );
    const astro =
      dependencies.includes("astro") &&
      configs.some((file) => file.relative.startsWith("astro."));
    const vite =
      dependencies.includes("vite") &&
      dependencies.includes("react") &&
      configs.some((file) => file.relative.startsWith("vite."));
    const readmes = ownFiles.filter((file) =>
      /^(README|readme)\.md$/.test(file.relative),
    );
    const descriptions = [
      manifest.description ?? "",
      ...readmes.map((file) =>
        readFileSync(join(projectRoot, file.path), "utf8"),
      ),
    ].join("\n");
    const sources = ownFiles.filter(
      (file) =>
        /\.(?:[cm]?[jt]sx?|astro|html)$/.test(file.relative) &&
        !/(?:^|\/)(?:test|tests|fixtures|vendor|node_modules)\//.test(
          file.relative,
        ) &&
        !/\.config\./.test(file.relative),
    );
    const sourceText = sources
      .map((file) => readFileSync(join(projectRoot, file.path), "utf8"))
      .join("\n");
    const site =
      /\b(?:static|content|marketing|landing) (?:web)?site\b|\bbuilt ahead of time\b/i.test(
        descriptions,
      );
    const app =
      /\b(?:client-side|browser-rendered|single-page) (?:web )?app(?:lication)?\b/i.test(
        descriptions,
      ) ||
      (/\bcreateRoot\s*\(/.test(sourceText) &&
        /\b(?:RouterProvider|BrowserRouter|createBrowserRouter|createRouter|useRoutes)\b/.test(
          sourceText,
        ) &&
        /\b(?:useState|useReducer|createStore|configureStore)\b/.test(
          sourceText,
        ));
    const evidence = [
      path,
      ...configs.map((file) => file.path),
      ...readmes.map((file) => file.path),
      ...sources.map((file) => file.path),
    ];
    if (astro && !app)
      classified.set(path, {
        kind: "site",
        stack: "astro",
        evidence,
        reason:
          "Astro dependency and configuration evidence pages built ahead of time; confirm Site semantics from sources and assessment.",
      });
    else if ((vite || dependencies.includes("astro")) && site)
      classified.set(path, {
        kind: "site",
        stack: null,
        evidence,
        reason:
          "Site in no web stack: a Vite-built Site needs a separate migration; preserve its existing build.",
      });
    else if (vite && app && !site)
      classified.set(path, {
        kind: "app",
        stack: "vite",
        evidence,
        reason:
          "Browser-owned routing and state evidence an App using Vite and React.",
      });
    else if (
      astro ||
      vite ||
      configs.length ||
      ownFiles.some((file) => file.relative === "components.json") ||
      /\bshared web package\b/i.test(descriptions) ||
      dependencies.some((name) =>
        [
          "astro",
          "vite",
          "react",
          "react-dom",
          "next",
          "@angular/core",
          "vue",
          "svelte",
          "tailwindcss",
        ].includes(name),
      )
    )
      classified.set(path, {
        kind: configs.length || vite || astro ? "unresolved" : "package",
        stack: null,
        evidence,
        reason:
          "Web candidate membership is unresolved: framework tools alone do not distinguish a Site from an App or select a stack.",
      });
  }
  // A differing existing consumer stays out of its stack. Keep its intended
  // stack for explanations, but do not let it choose shared membership.
  for (const [path, membership] of classified) {
    membership.eligible =
      membership.stack !== null &&
      webStackDifferences(
        projectRoot,
        path,
        membership.stack,
        files,
        classified,
      ).differences.length === 0;
  }
  // Iterate dependency propagation so framework-less shared packages inherit
  // through other shared packages. A non-web consumer keeps a package in Node.
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of entries) {
      if (
        !entry.manifest ||
        (classified.has(entry.path) &&
          classified.get(entry.path).kind !== "package")
      )
        continue;
      const workspace = workspaceRootOf(projectRoot, entry.path);
      if (workspace.root === undefined) continue;
      const consumers = entries.filter(
        (other) =>
          other.path !== entry.path &&
          other.manifest &&
          packageDependencies(other.manifest).includes(entry.manifest.name) &&
          workspaceRootOf(projectRoot, other.path).root === workspace.root,
      );
      if (!consumers.length) continue;
      if (
        consumers.every(
          (other) =>
            classified.has(other.path) &&
            classified.get(other.path).kind !== "package",
        )
      ) {
        const memberships = consumers.map((other) =>
          classified.get(other.path),
        );
        const stack = memberships.some(
          (value) => value.eligible && value.stack === "astro",
        )
          ? "astro"
          : memberships.some(
                (value) => value.eligible && value.stack === "vite",
              )
            ? "vite"
            : null;
        const unresolved = memberships.some(
          (value) => value.kind === "unresolved",
        );
        classified.set(entry.path, {
          kind: unresolved ? "unresolved" : "shared",
          stack: unresolved ? null : stack,
          evidence: [
            entry.path,
            ...consumers.flatMap(
              (other) => classified.get(other.path).evidence,
            ),
          ],
          reason:
            unresolved || !stack
              ? "Shared web package has no established in-stack consumers; membership remains unresolved."
              : `Shared web package follows typescript-${stack}; only in-stack web consumers choose its stack.`,
        });
        const membership = classified.get(entry.path);
        membership.eligible =
          membership.stack !== null &&
          webStackDifferences(
            projectRoot,
            entry.path,
            membership.stack,
            files,
            classified,
          ).differences.length === 0;
        changed = true;
      }
    }
  }
  for (const membership of classified.values())
    if (membership.kind === "package") membership.kind = "unresolved";
  return classified;
}
