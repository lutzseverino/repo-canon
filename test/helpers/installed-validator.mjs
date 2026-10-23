import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));

// The source of each exact file that `standards.yaml` installs, by its target.
export function exactFiles() {
  const lines = readFileSync(join(sourceRoot, "standards.yaml"), "utf8").split(
    "\n",
  );
  const files = new Map();
  for (const [index, line] of lines.entries()) {
    const target = /^\s+target: (\S+)$/.exec(line);
    const exact = /^\s+exact: (\S+)$/.exec(lines[index + 1] ?? "");
    if (target && exact) files.set(target[1], exact[1]);
  }
  return files;
}

// Installs a consumer into a fresh tree from exact file and skill declarations,
// following relative imports and retaining the platform bundle's notices.
// Undeclared modules fail here instead of resolving through the source checkout.
export function installedValidator(t, target) {
  const files = exactFiles();
  const root = mkdtempSync(join(tmpdir(), "repo-canon-installed-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pending = [target];
  const installed = new Set();
  while (pending.length > 0) {
    const path = pending.pop();
    if (installed.has(path)) continue;
    let source = files.get(path);
    if (source === undefined) {
      const manifest = readFileSync(join(sourceRoot, "standards.yaml"), "utf8");
      for (const [, name, directory] of manifest.matchAll(
        /kind: skill\n\s+name: (\S+)\n\s+source: (\S+)/g,
      )) {
        const prefix = `.agents/skills/${name}/`;
        if (path.startsWith(prefix)) {
          const candidate = posix.join(directory, path.slice(prefix.length));
          if (existsSync(join(sourceRoot, candidate))) source = candidate;
        }
      }
    }
    if (source === undefined)
      throw new Error(
        `standards.yaml installs no exact file or skill resource at ${path}.`,
      );
    if (path === "vendor/postern/postern.mjs")
      pending.push("vendor/postern/LICENSE", "vendor/postern/README.md");
    installed.add(path);
    const destination = join(root, path);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(sourceRoot, source), destination);
    for (const [, specifier] of readFileSync(destination, "utf8").matchAll(
      /^import\s[^;]*?from\s+"(\.{1,2}\/[^"]+)";/gm,
    ))
      pending.push(posix.join(posix.dirname(path), specifier));
  }
  return join(root, target);
}
