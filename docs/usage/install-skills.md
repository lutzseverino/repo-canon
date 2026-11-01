# Install a skill without adoption

Every workflow skill Repo Canon installs is an owned skill, and each one also
works on its own: you can install it without adopting Repo Canon and use it in
a repository that has none of Repo Canon's files or rules. Each Repo Canon
release publishes the skills as one bundle at the same path at its tag,
`.agents/skills/`, one directory per skill, `.agents/skills/<name>`. The
bundle directory also holds the `repository-standards` skill, which Repository
Standards installs for Repo Canon's own adoption; it is not a Repo Canon skill.

## Install from a release

Use the [skills CLI](https://github.com/vercel-labs/skills/tree/v1.5.25), the
route that Repository Standards documents for its own skills and through which
the [skills.sh directory](https://skills.sh/docs/faq) counts installations.
Name a release tag and the bundle path, and select each skill with `--skill`:

```sh
npx skills@1.5.25 add https://github.com/lutzseverino/repo-canon/tree/<tag>/.agents/skills \
  --skill grilling --agent codex --copy
```

Replace `<tag>` with a published release tag. Releases after `v0.20.0` carry
the skills' Reads sections and license notices; an earlier tag installs the
skills without them. Add `--global` to install at user scope, and select
your agent with `--agent`. Name the bundle path, not the repository: the
repository also keeps the inputs of its own adoption under `.repo-standards/`,
which hold a second copy of every skill.

The listing pins a release only through such a URL. The CLI copies the tag's
skill files and records the tag as the skill's `ref` in `skills-lock.json`.
A listing's `lutzseverino/repo-canon` source name alone names no release and
follows the default branch. `skills update` skips a skill installed this way,
because more than one path in the repository matches it; to move to a later
release, run `add` again with the later tag. Without the
skills CLI, copy `.agents/skills/<name>` from a checkout of the tag instead.

## What a skill needs on its own

A skill's `SKILL.md` ends with a Reads section when the skill reads a
repository file outside itself, such as `CONTRIBUTING.md`, `GLOSSARY.md` or
`docs/agents/issue-tracker.md`. The section names each file and what the skill
does when the file is missing, so the skill works in a repository that lacks
it. A skill that invokes another names it, as `grill-with-docs` does
`grilling` and `domain-modeling`; install the skills it names with it.

Some bundled commands import files that only adoption installs: `babysit`'s
request, wait and merge commands import the Postern, marked and parse5 bundles
under `vendor/`, `triage`'s `ready.mjs` imports the issue-contract validator under
`scripts/`, and both `ready.mjs` and `orchestrate`'s wait script import
`babysit`'s GitHub connection. On their own, these commands cannot start; each
skill's Reads section says how to carry on without them.

Each skill taken from Matt Pocock's skills keeps the upstream MIT License
notice in its `CREDITS.md`, and `pr` also keeps HumanLayer's, so a copy
installed on its own carries them.
