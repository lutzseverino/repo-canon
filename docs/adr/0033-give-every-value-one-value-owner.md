# Give every value one value owner

Status: amended by [ADR 0047](0047-read-nothing-scriptorium-owns.md):
Scriptorium, not Repo Canon, supplies the schema and check of the repository
model policy it reads.

Every value Repo Canon installs, checks or relies on has one value owner (the
standard, the repository, the host or the issue) and lives only in a file that
owner holds. Exact files carry only values the standard chooses for every
repository. A value a repository chooses lives in a repository-owned file
whose schema and check Repo Canon supplies but whose values it never ships.
Host configuration holds the host's capabilities, credentials and defaults,
never a per-repository value. A per-issue choice is a label. The decision came
from a model choice wanted for only some repositories: it went first into host
configuration, then into the exact factory configuration, so every adopting
repository would have shared it or forked an exact file. The design that
replaced it is on
[scriptorium#115](https://github.com/lutzseverino/scriptorium/issues/115#issuecomment-6693419305).

## Considered options

- Per-repository values in exact files: rejected, because every adopter
  receives the same bytes, so one repository's preference becomes everyone's.
- Per-repository entries in host configuration: rejected, because the
  repository could not change its own policy in its own pull request, and the
  host operator would hold every repository's policy.

## Consequences

- The factory configuration carries the factory's mechanics only. Model
  preferences and fallbacks move to an optional repository-owned model policy
  file, and without one the host's defaults apply.
- A new exact declaration, or a change to one, states that every value in it is
  the standard's.
