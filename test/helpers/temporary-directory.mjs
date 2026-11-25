import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Value owner: repository test helpers. Every fixture and test-started command
// inherits this root. Nested runs may add roots inside it, outside fixture Git
// trees. No production entry point imports this module.
export const scratchRoot = mkdtempSync(join(tmpdir(), "repo-canon-test-"));
process.env.TMPDIR = scratchRoot;
process.env.TMP = scratchRoot;
process.env.TEMP = scratchRoot;
process.env.REPO_CANON_TEST_SCRATCH = scratchRoot;

const env = { ...process.env };
delete env.REPO_CANON_TEST_SCRATCH;
delete env.NODE_OPTIONS;
// A guardian must survive the test's process-group signal. It observes exit
// even if the file process was blocked in spawnSync. On normal exits, inherited
// output pipes also keep the runner waiting until cleanup has finished.
const guard = spawn(
  process.execPath,
  [
    fileURLToPath(new URL("./temporary-directory-guard.mjs", import.meta.url)),
    scratchRoot,
    String(process.pid),
    String(process.ppid),
  ],
  {
    env,
    detached: process.platform !== "win32",
    stdio: ["pipe", "inherit", "inherit"],
  },
);
guard.on("error", (error) => {
  throw error;
});
guard.unref();
/** @type {import("node:net").Socket} */ (guard.stdin).unref();
