# Self-reported reruns

`CONTRIBUTING.md`'s Worker handoff tells the check location from the pinned
trusted default-branch `.github/required-checks.json`; read no selection. At
`self-reported`, merge needs `Review rerun` and `PR metadata` on the exact
head, and only this skill posts `Review rerun`. In your own checkout of the
head, from the repository root and with the run's supplied GitHub credential as
`POSTERN_TOKEN`, run:

1. The check command the development guide names, through the check-command
   entry point's `review` role, which posts `Review rerun`:
   `node vendor/repo-canon/validate.mjs <file>` with
   `{"kind": "check-command", "repository": "https://github.com/<owner>/<repo>", "head": "<full SHA>", "checkout": ".", "command": "<command>", "role": "review"}`.
2. The PR metadata entry point, so `PR metadata` reflects the current title
   and body: the same command with
   `{"kind": "pr-metadata", "repository": "https://github.com/<owner>/<repo>", "pullRequest": <number>}`.
3. Where `vendor/repo-canon/sandbox-image.mjs` is installed, check Docker with
   `docker info`. When it answers, run
   `node vendor/repo-canon/sandbox-image.mjs <base SHA> <head SHA> <owner>/<repo>`
   with the PR's current base commit: it builds the toolchain image when its
   inputs changed and posts `Sandbox image`, which stays non-required for
   merge. When Docker is unavailable, skip it, post no `Sandbox image` status,
   and record in that head's review, or its carried-review record, that the
   sandbox image build did not run.

A nonzero exit after an entry point posts its status is a failure. One before
it posts, from its input, credential or a head mismatch, is an invocation
error: fix the cause and run it again. A permission refusal follows
`CONTRIBUTING.md`'s Credentials section.
