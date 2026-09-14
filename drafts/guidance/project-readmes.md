# Monorepo project README guidance

Each maintained app, service, library, or tool with its own responsibility and
development commands is a Project and has a Project README, including internal
packages. Fixtures, generated code, and directories that only organize other
content are not Projects.

Use a plain Markdown title and a concise developer-facing description. Explain
the project's purpose, development commands, important configuration, and
relevant documentation. State the working directory for commands when it is
not apparent; link shared setup and contribution instructions instead of
duplicating them.

Discover Projects from repository evidence, including manifests, workspace and
build configuration, existing documentation, maintained source, and meaningful
component boundaries. Directory names and conventional layouts alone do not
define Project membership. Apply the same evidence test in unfamiliar layouts.

Use a v2 repository declaration with this assessment guidance and separate
discovery guidance to identify individual Project README paths. In the scope
proposal, give the declaration coverage rationale and repository evidence;
record every relevant candidate with an explicit include or exclude decision
and reason, and list unresolved membership questions. Include intended paths
for missing READMEs with both absence evidence and positive file or directory
evidence of a maintained Project.

Keep exact-owned files and other declarations' paths out of this contextual
scope so ownership remains disjoint. The adopter reviews the evidence,
candidate decisions, unresolved questions, coverage, and concrete paths in the
complete inspection before confirmation. Newly discovered targets require
confirmed scope before editing; existing scope never implies coverage of an
unrepresented Project.
