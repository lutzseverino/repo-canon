# Usage

This directory helps maintainers apply Repo Canon's documentation, contribution,
and coding-agent conventions to their repositories.

Applying these conventions installs contribution and agent instructions, skills,
templates, and validation workflows; this process is called adoption.
Repository Standards is the tool that performs it. The factory is an unattended
service, installed on a host, that takes ready tickets through implementation
and pull request review to merge. It is a product of its own: the factory
profile installs the repository files and workflow rules a repository it serves needs, and
[the factory's usage documentation](https://github.com/lutzseverino/scriptorium/blob/main/docs/usage/README.md)
describes running it.

- [Adopt Repo Canon](adopt-repo-canon.md): choosing a profile, how adoption
  treats a Project's development tools, remote setup prerequisites and
  deferral, linking the `orchestrate` skill for sessions outside a checkout,
  and recommended personal skills.
- [Install a skill without adoption](install-skills.md): installing a
  Repo Canon skill from a release tag through the skills CLI, whether the listing
  pins a release, and what a skill needs on its own.
- [Release versioning](versioning.md): version increments, breaking standards
  changes, and selecting an adoptable release.
- [Recommended stacks](stacks.md): a stack is a named set of development tools;
  recommended tools for CLIs, libraries and web Projects, workspace scope, and
  the optional stack declaration and its check.
