---
name: repository-standards
description: Look up installed rules before any work in a disposable planning exercise, including tracker work and file changes.
---

This is the planning exercise's local lookup adapter. From the fixture root,
run this once before any work:

```sh
node .agents/skills/repository-standards/rules.mjs
```

Before changing a file, run the same command with its path. Follow the printed
repository-wide rules. The local index at `.repo-standards/rules/README.md`
also links every applicable rule and identifies the selected profile.

The adapter uses only the fixture's copied rules and Node.js. It exercises
rules discovery, not adoption or update discovery. Keep all activity local as
`docs/agents/project.md` directs; no production CLI runtime is needed.
