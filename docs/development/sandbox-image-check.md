# Sandbox image check

The factory starts every run in the image that the adopting repository's
`.sandcastle/Dockerfile` builds. The contextual `factory-sandbox-image`
declaration owns only that file. Repo Canon ships its base,
`operations/sandbox-image-base.Dockerfile`: Node.js 24, Git, `jq`, the GitHub
CLI, Codex, Claude Code, and Sandcastle's non-root `agent` user, whose IDs the
factory sets to the host user's at build time. Its
[guidance](../../guidance/factory-sandbox-image.md) has the adopting agent start
the file with the base and add the repository's toolchain from its development
guide after it.

`operations/check-sandbox-image.mjs` is the read-only check that the file still
builds from the base. It consumes `repo-standards/operation/v1` on standard
input, accepts only a checks operation whose allowed target is
`.sandcastle/Dockerfile`, and returns one `repo-standards/result/v1` object on
standard output. It requires Node.js 24, with the same `node --version`
prerequisite and 30-second timeout as the other checks, and retains the base
as its only resource.

The result statuses have distinct meanings:

- `passed` means the file starts with the base, byte for byte, and its
  additions keep the base's stage, entrypoint, and user. Whether they install
  the toolchain the development guide requires remains an agent judgment.
- `failed` is a policy failure with concrete corrections: create a missing or
  non-regular file from the base, restore a base that was changed, shortened,
  reordered, or interleaved with additions, remove `FROM`, `ENTRYPOINT`, or
  `CMD` after it, or end the additions as the base's user.
- A malformed request or an unexpected target writes an error to standard error,
  exits nonzero, and emits no result.

The check reads the additions as Dockerfile instructions: it joins continued
lines, skipping comment and blank lines inside them, compares keywords without
regard to case, and leaves out heredoc bodies of `RUN`, `COPY`, and `ADD`. A
line that only looks like an instruction, inside a comment, continuation, or
heredoc, therefore never fails it. A new base reaches adopters through a Repo
Canon release, and their update's contextual work replaces the old base above
their additions.

Run the public-boundary fixtures with Node.js 24:

```sh
node --test test/sandbox-image-check.test.mjs
```

The fixtures cover an image extending the base, a missing image, a base with a
line removed, changed, reordered, or interleaved, each instruction that undoes
the base, lines that only look like instructions, invalid protocol input and
targets, and byte-for-byte preservation of the disposable project. One fixture
executes the check from a retained layout containing only its declared script
and resource. The adapter suite proves that every launch runs in the image
built from the checkout's `.sandcastle/Dockerfile`, and the repository
conformance suite runs the check against this repository's own image.
