import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { installedValidator } from "./helpers/installed-validator.mjs";

for (const command of ["request", "wait"]) {
  test(`the installed ${command} command rejects malformed reviewer JSON before contacting the platform`, (t) => {
    const script = pathToFileURL(
      installedValidator(t, `.agents/skills/babysit/${command}.mjs`),
    );
    const bundle = new URL("../../../vendor/postern/postern.mjs", script);
    const directory = mkdtempSync(join(tmpdir(), "babysit-reviewer-config-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    mkdirSync(join(directory, ".github"));
    for (const { content, explanation } of [
      { content: "{x", explanation: /Expected property name/ },
      { content: "", explanation: /Unexpected end of JSON input/ },
    ]) {
      writeFileSync(
        join(directory, ".github/pull-request-reviewer.json"),
        content,
      );
      const child = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `
            import { main } from ${JSON.stringify(script.href)};
            import { connect } from ${JSON.stringify(bundle.href)};
            let requests = 0;
            const connection = connect("https://github.com/example/repository", {
              credential: "fixture-credential",
              fetch: async () => {
                requests++;
                return new Response("{}", { status: 400 });
              },
            });
            process.exitCode = await main(["12"], connection);
            if (requests) process.stderr.write("Unexpected hosting-platform request\\n");
          `,
        ],
        { cwd: directory, encoding: "utf8", timeout: 15000 },
      );
      assert.ifError(child.error);
      assert.equal(child.status, 1, child.stderr);
      assert.equal(child.stdout, "");
      assert.match(child.stderr, /\.github\/pull-request-reviewer\.json:/);
      assert.match(child.stderr, explanation);
      assert.doesNotMatch(child.stderr, /Unexpected hosting-platform request/);
    }
  });
}
