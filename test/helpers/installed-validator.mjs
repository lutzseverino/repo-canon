import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));

// The source of each exact file that `standards.yaml` installs, by its target.
function exactFiles() {
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

// Installs a validator into a fresh tree as an adopting repository receives
// it: the exact file that `standards.yaml` declares at `target`, then each
// exact file it reaches through relative imports. A module that no declaration
// installs fails here rather than resolving through the source checkout.
export function installedValidator(t, target) {
  const files = exactFiles();
  const root = mkdtempSync(join(tmpdir(), "repo-canon-installed-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pending = [target];
  const installed = new Set();
  while (pending.length > 0) {
    const path = pending.pop();
    if (installed.has(path)) continue;
    const source = files.get(path);
    if (source === undefined)
      throw new Error(`standards.yaml installs no exact file at ${path}.`);
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
