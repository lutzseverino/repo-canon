// The factory: takes each ready issue on the frontier to a pull request that
// `babysit` merges. The factory host runs `node .sandcastle/main.ts` from the
// repository's checkout; it re-runs itself under a pinned `npx` of Sandcastle,
// so the repository needs no dependency.
import { execFile, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  claudeUsage,
  codexUsage,
  createFactory,
  readSettings,
  runBranch,
  type ImageBuild,
  type LaunchRequest,
} from "./adapter.ts";
import type { Provider } from "./factory.ts";

const sandcastleVersion = "0.12.0";
const root = fileURLToPath(new URL("..", import.meta.url));
const pollSeconds = Number(process.env.FACTORY_POLL_SECONDS ?? 300);
const settings = readSettings(process.env);
const sandcastle = await loadSandcastle();

// Sandcastle is resolved from the `npx` install on PATH. Without it, the
// factory runs itself again under `npx` with the pinned version.
async function loadSandcastle() {
  for (const bin of (process.env.PATH ?? "").split(delimiter)) {
    const directory = join(bin, "..", "@ai-hero", "sandcastle");
    let version;
    try {
      version = JSON.parse(
        readFileSync(join(directory, "package.json"), "utf8"),
      ).version;
    } catch {
      continue;
    }
    if (version !== sandcastleVersion) continue;
    const module = (path: string) =>
      import(pathToFileURL(join(directory, path)).href);
    const [core, docker] = await Promise.all([
      module("dist/index.js"),
      module("dist/sandboxes/docker.js"),
    ]);
    return { ...core, docker: docker.docker };
  }
  if (process.env.FACTORY_SANDCASTLE_EXEC)
    throw new Error(
      `npx did not provide @ai-hero/sandcastle@${sandcastleVersion}`,
    );
  const result = spawnSync(
    "npx",
    [
      "--yes",
      `--package=@ai-hero/sandcastle@${sandcastleVersion}`,
      "--",
      process.execPath,
      fileURLToPath(import.meta.url),
    ],
    { stdio: "inherit", env: { ...process.env, FACTORY_SANDCASTLE_EXEC: "1" } },
  );
  process.exit(result.status ?? 1);
}

async function gh(args: string[]): Promise<string> {
  const { stdout } = await promisify(execFile)("gh", args, {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

async function launch(request: LaunchRequest): Promise<void> {
  const options = { effort: request.effort };
  await sandcastle.run({
    name: `issue-${request.issue}`,
    cwd: root,
    agent:
      request.provider === "codex"
        ? sandcastle.codex(request.model, options)
        : sandcastle.claudeCode(request.model, options),
    sandbox: sandcastle.docker({ imageName: request.image }),
    prompt: request.prompt,
    branchStrategy: { type: "branch", branch: runBranch(request.issue) },
    logging: { type: "file", path: request.log },
    idleTimeoutSeconds: settings.timeLimitMinutes * 60,
    signal: request.signal,
  });
}

// The Dockerfile arrives on standard input, so the build has no context, and
// the agent user takes the host user's IDs, as Sandcastle requires.
async function buildImage(request: ImageBuild): Promise<void> {
  const build = spawn(
    "docker",
    [
      "build",
      "--quiet",
      "--tag",
      request.image,
      "--build-arg",
      `AGENT_UID=${process.getuid?.() ?? 1000}`,
      "--build-arg",
      `AGENT_GID=${process.getgid?.() ?? 1000}`,
      "-",
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let errors = "";
  build.stderr.on("data", (chunk) => (errors += chunk));
  build.stdin.end(readFileSync(request.dockerfile));
  const [status] = await once(build, "close");
  if (status !== 0)
    throw new Error(`docker build exited with ${status}: ${errors.trim()}`);
}

async function readUsage(provider: Provider): Promise<number | null> {
  return provider === "codex" ? readCodexUsage() : readClaudeUsage();
}

// The Codex app-server's documented rate-limit read, over stdio JSONL.
async function readCodexUsage(): Promise<number | null> {
  const server = spawn("codex", ["app-server"], {
    stdio: ["pipe", "pipe", "ignore"],
  });
  const send = (message: object) =>
    server.stdin.write(`${JSON.stringify(message)}\n`);
  try {
    const responses = createInterface({ input: server.stdout });
    const reply = async (id: number) => {
      for await (const line of responses) {
        const message = JSON.parse(line);
        if (message.id !== id) continue;
        if (message.error) throw new Error(message.error.message);
        return message.result;
      }
      throw new Error("codex app-server closed before replying");
    };
    send({
      method: "initialize",
      id: 0,
      params: {
        clientInfo: { name: "factory", title: "Factory", version: "1.0.0" },
      },
    });
    await Promise.race([reply(0), sleep(30_000).then(timeout)]);
    send({ method: "initialized", params: {} });
    send({ method: "account/rateLimits/read", id: 1 });
    return codexUsage(
      await Promise.race([reply(1), sleep(30_000).then(timeout)]),
    );
  } finally {
    server.kill();
  }
}

function timeout(): never {
  throw new Error("timed out");
}

// Claude Code publishes no usage read; this one is best-effort.
async function readClaudeUsage(): Promise<number | null> {
  const token = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (!token) return null;
  const response = await fetch("https://api.anthropic.com/api/oauth/usage", {
    headers: {
      authorization: `Bearer ${token}`,
      "anthropic-beta": "oauth-2025-04-20",
    },
    signal: AbortSignal.timeout(30_000),
  });
  return response.ok ? claudeUsage(await response.json()) : null;
}

function report(line: string) {
  console.log(`${new Date().toISOString()} ${line}`);
}

const factory = createFactory(settings, {
  gh,
  launch,
  buildImage,
  readUsage,
  now: () => new Date(),
  root,
  report,
});

for (;;) {
  // Runs branch from the checkout, so it follows the default branch.
  const pull = spawnSync("git", ["pull", "--ff-only", "--quiet"], {
    cwd: root,
  });
  if (pull.status !== 0) report(`git pull failed: ${pull.stderr}`);
  try {
    for (const decision of await factory.tick())
      if (decision.kind !== "skip") report(JSON.stringify(decision));
  } catch (error) {
    report(`tick failed: ${error}`);
  }
  await sleep(pollSeconds * 1000);
}
