import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

// Release checks also read historical manifests supplied as text.
export const parseStandards = parse;

// Resolve defaults, replacements and exclusions without changing other fields.
export function declarations(root) {
  const { defaults = {}, profiles } = parseStandards(
    readFileSync(join(root, "standards.yaml"), "utf8"),
  );
  const inherited = defaults.declarations ?? {};
  return Object.fromEntries(
    Object.entries(profiles).map(([name, profile]) => [
      name,
      Object.entries({ ...inherited, ...profile.declarations })
        .filter(([, declaration]) => !declaration.exclude)
        .map(([id, declaration]) => ({ id, ...declaration })),
    ]),
  );
}
