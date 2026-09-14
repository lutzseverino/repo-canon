# Productivity skill runtime exercises

This record covers the seven pinned productivity skills required by issue #13.
The exercises use disposable, scenario-specific Git repositories and controlled
participants where a skill requires user decisions. They do not treat fixture
creation, inventory equality, or content review as runtime evidence.

The exact exercised upstream identity is commit
`3cca18b368ae95cdbdebbff572ccafa662551015`. Each repository links its
`.agents/skills` entries to the complete corresponding directory under
`vendor/mattpocock-skills/skills/productivity`; the fixture manifest records a
SHA-256 for each directory, the builder, and the Repo Canon commit used to
create it.

## Runtime evidence

Runtime sessions and exact outcomes will be recorded here after the generated
repositories have been exercised.

## Reproduce the fixture harness

Use Node.js 24 from the Repo Canon root:

```bash
node scripts/create-productivity-skill-fixtures.mjs
npm run test:productivity-skill-fixtures
```

The builder prints a `repo-canon/productivity-skill-fixtures/v1` manifest with
the temporary root, repository heads, scenario-to-skill mapping, source
identities, and complete-directory hashes. `--root <unused-path>` creates the
same repositories at a chosen location. The focused test verifies that every
repository has its scenario-specific guidance, domain language, development
instructions, required facts, intact skill links, and a clean initial Git
state.
