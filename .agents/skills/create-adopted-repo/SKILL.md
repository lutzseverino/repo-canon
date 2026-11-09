---
name: create-adopted-repo
description: Create a new repository and adopt a standards source through Repository Standards, then route its vision. Use for creation with adoption already requested.
disable-model-invocation: false
---

A prompt or brief naming this skill is its invocation.

Invoke the installed `create-repository` skill with **adoption on**, skipping
its adoption question. Pass the person's supplied answers and any named
standards source unchanged. That skill owns the interview, creation, adoption
delivery and vision handoff.

## Dependencies

Requires `create-repository` and Repository Standards' separately distributed
`adopt-repository-standards`; Canon's `repository-standards` lookup skill cannot
start adoption. The chosen vision route also needs the dependencies named by
`create-repository`. If one is missing, report it and pause that step for
installation. Invoke installed skills without borrowing a private checkout.

## Reads

No repository files are read by this wrapper. `create-repository` owns its
repository Reads and missing-file fallbacks, and the delegated methods own
theirs.
