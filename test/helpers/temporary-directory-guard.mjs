import { removeTemporaryDirectory } from "./temporary-directory-cleanup.mjs";
import { readFileSync, readdirSync } from "node:fs";
import { sep } from "node:path";

const [root, owner, parent] = process.argv.slice(2);

function stopCommands() {
  // Linux's process environment identifies only descendants started with this
  // test's private scratch root, including a spawnSync child orphaned when the
  // test process died. Never infer ownership from a directory's age or PID.
  // Reap this run's live commands before deleting scratch they may still write.
  if (process.platform !== "linux") return;
  let found;
  do {
    found = false;
    for (const entry of readdirSync("/proc")) {
      if (!/^\d+$/.test(entry)) continue;
      try {
        const environment = readFileSync(
          `/proc/${entry}/environ`,
          "utf8",
        ).split("\0");
        const value = environment
          .find((item) => item.startsWith("REPO_CANON_TEST_SCRATCH="))
          ?.slice("REPO_CANON_TEST_SCRATCH=".length);
        if (value !== root && !value?.startsWith(root + sep)) continue;
        process.kill(Number(entry), "SIGKILL");
        found = true;
      } catch (error) {
        // Processes may exit between listing, reading and signalling. Other
        // users' environments need not be readable on a shared host.
        if (!["ENOENT", "ESRCH", "EACCES"].includes(error.code)) throw error;
      }
    }
  } while (found);
}

// A runner stopped by SIGHUP can exit without stopping its file processes.
// Detect that orphaning as well as the owner's exit, including while it is
// blocked in spawnSync. The pipe is private to the owner, not its children.
function cleanup() {
  clearInterval(watch);
  stopCommands();
  removeTemporaryDirectory(root);
  process.exit();
}
const watch = setInterval(() => {
  if (process.platform !== "linux") return;
  try {
    const stat = readFileSync(`/proc/${owner}/stat`, "utf8");
    const [state, currentParent] = stat
      .slice(stat.lastIndexOf(")") + 2)
      .split(" ");
    if (state !== "Z" && currentParent === parent) return;
    process.kill(Number(owner), "SIGKILL");
  } catch (error) {
    if (!["ENOENT", "ESRCH"].includes(error.code)) throw error;
  }
  cleanup();
}, 25);
process.stdin.resume();
process.stdin.on("end", cleanup);
