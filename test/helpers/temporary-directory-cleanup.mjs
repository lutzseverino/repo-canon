import { existsSync, rmSync } from "node:fs";

/** @param {string} directory */
export function removeTemporaryDirectory(directory) {
  // A descendant guardian can remove an entry during native recursive removal.
  // force suppresses that ENOENT even when the ancestor remains. Writers have
  // already stopped, so finish removing this owned root before returning.
  do {
    rmSync(directory, { recursive: true, force: true });
  } while (existsSync(directory));
}
