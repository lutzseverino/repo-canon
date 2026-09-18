<div align="center">
  <h1>Repo Canon</h1>
  <p>Shared repository conventions for documentation, contribution, and agent workflows.</p>
  <p>
    <img src="https://img.shields.io/badge/Markdown-000000?logo=markdown&logoColor=white" alt="Markdown">
    <img src="https://img.shields.io/badge/YAML-CB171E?logo=yaml&logoColor=white" alt="YAML">
  </p>
</div>

## Installation

Repo Canon is a standards source rather than a package, so adopting maintainers
install the public Repository Standards CLI that applies it. `v0.2.0` requires
exactly CLI **1.3.0**. On macOS or Linux with Node.js 24, npm, and Git, install
it outside the adopting project and keep it there for inspection, adoption, and
recovery:

```sh
cli="$HOME/.local/share/repo-standards/cli-1.3.0"
npm install --prefix "$cli" --ignore-scripts --save-exact \
  @lutzseverino/repo-standards@1.3.0
"$cli/node_modules/.bin/repo-standards" --version
```

The [adoption guide](docs/usage/adopt-repo-canon.md) lists the remaining
prerequisites, including the authenticated `gh` access the two GitHub fixes
need.

## Features

- Exact shared contribution guidance, agent configuration, issue and pull
  request templates, and the issue-contract and pull request metadata workflows.
- Twenty-five engineering and productivity skills, installed as copies under
  `.agents/skills/`.
- Canonical triage labels, squash-only pull request integration, and a required
  `PR metadata` check on the default branch.
- Read-only checks for documentation navigation, Project READMEs, and the
  Repository README.
- Contextual guidance for the documentation tree, Project READMEs, and the
  Repository README.

## Usage

Select [v0.2.0](https://github.com/lutzseverino/repo-canon/releases/tag/v0.2.0)
with the `complete` profile and inspect it from the adopting repository. The
report is read-only and authorizes nothing:

```sh
"$cli/node_modules/.bin/repo-standards" inspect \
  --source https://github.com/lutzseverino/repo-canon \
  --standards-version v0.2.0 --profile complete \
  --project /path/to/adopting-project --json
```

Review the report, confirm the scope, and complete the adoption as the
[adoption guide](docs/usage/adopt-repo-canon.md) describes. Verify that the
release is published before starting; its initial-development version is an
ordinary GitHub release. Select only bytes the
[source acceptance record](docs/development/completion-record.md) covers.

## Documentation

- [Standards decisions](authoring-notes.md)
- [Complete design drafts](design-review.md)
- [Documentation index](docs/README.md)
- [Release versioning](docs/usage/versioning.md)
- [Adoption compatibility](docs/development/adoption-compatibility.md)
- [Complete source profile](docs/development/source-profile.md)
- [Complete source acceptance](docs/development/completion-record.md)
- [Adoption guide](docs/usage/adopt-repo-canon.md)
- [Complete adoption evidence](docs/development/adoption-evidence.md)
- [First real adoption](docs/development/real-adoption.md)
- [Self-adoption of v0.2.0](docs/development/self-adoption.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

[Repository Standards](https://github.com/lutzseverino/repo-standards) adopted
this profile from the published pins, and this repository adopts its own
published release through the same CLI; those two records state what each
delivery surfaced.

## Contributing

[Contribution guidelines](CONTRIBUTING.md)

## License

[MIT License](LICENSE)
