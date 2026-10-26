import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { installedValidator } from "./helpers/installed-validator.mjs";

for (const command of ["request", "wait"]) {
  test(`the installed ${command} command rejects trusted malformed reviewer JSON before requesting review`, (t) => {
    const script = pathToFileURL(
      installedValidator(t, `.agents/skills/babysit/${command}.mjs`),
    );
    const bundle = new URL("../../../vendor/postern/postern.mjs", script);
    const directory = mkdtempSync(join(tmpdir(), "babysit-reviewer-config-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const fixture = new URL("./fixtures/postern-babysit.mjs", import.meta.url);
    const state = join(directory, "state.json");
    for (const { content, explanation } of [
      { content: "{x", explanation: /Expected property name/ },
      { content: "", explanation: /Unexpected end of JSON input/ },
    ]) {
      writeFileSync(
        state,
        JSON.stringify({ reviewConfiguration: { reviewer: content } }),
      );
      const child = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `
            import { main } from ${JSON.stringify(script.href)};
            import { connect } from ${JSON.stringify(bundle.href)};
            import { fixtureFetch } from ${JSON.stringify(fixture.href)};
            const connection = connect("https://github.com/example/repository", {
              credential: "fixture-credential",
              fetch: fixtureFetch(${JSON.stringify(state)}),
            });
            process.exitCode = await main(["12"], connection);
          `,
        ],
        { cwd: directory, encoding: "utf8", timeout: 15000 },
      );
      assert.ifError(child.error);
      assert.equal(child.status, 1, child.stderr);
      assert.equal(child.stdout, "");
      assert.match(child.stderr, /\.github\/pull-request-reviewer\.json:/);
      assert.match(child.stderr, explanation);
      assert.deepEqual(
        JSON.parse(readFileSync(state, "utf8")).emitted ?? [],
        [],
      );
    }
  });
}
