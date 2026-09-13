# Squash reviewed changes into the default branch

PR titles and final commits use Conventional Commits, with squash merges taking
the reviewed PR title and description as the final message. This gives each
integrated change one coherent description with issue references and breaking
change information, while allowing temporary development commits. The trade-off
is losing intermediate commits from the default branch rather than requiring
contributors to curate every working commit before review.
