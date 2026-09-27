<div align="center">
  <h1>Repo Canon</h1>
  <p>A standards source of documentation, contribution, and agent-workflow conventions for Repository Standards.</p>
  <p>
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
    <img src="https://img.shields.io/badge/Node.js-24-5FA04E?logo=node.js&logoColor=white" alt="Node.js 24">
  </p>
</div>

## Installation

Repo Canon is applied through the Repository Standards CLI. On macOS or Linux,
use Node.js 24, npm, and Git, and install the CLI outside the adopting project:

```sh
npm install --global --ignore-scripts @lutzseverino/repo-standards
repo-standards --version
```

Point the CLI at Repo Canon from the adopting repository by selecting the
[latest published release](https://github.com/lutzseverino/repo-canon/releases/latest)
and the `complete` profile, with `tag` set to its version. The report is
read-only and authorizes nothing:

```sh
tag=REPLACE_WITH_PUBLISHED_TAG
repo-standards inspect \
  --source https://github.com/lutzseverino/repo-canon \
  --standards-version "$tag" --profile complete \
  --project /path/to/adopting-project --json
```

Until a release requiring CLI 2.0.0 is published, the latest release, `v0.2.0`,
requires exactly CLI 1.3.0, so adopting it needs that CLI version instead.

## Features

- Install contribution guidance, agent configuration, and issue and PR templates.
- Validate issue contracts and pull request metadata in GitHub workflows.
- Copy twenty-five engineering and productivity skills into `.agents/skills/`.
- Set up triage labels, squash-only merging, and a required `PR metadata` check.
- Check the Repository README, Project READMEs, and documentation navigation.
- Guide agents on the documentation tree, Project READMEs, and the Repository README.

## Usage

Review the report, confirm the scope, and complete the adoption as the
[adoption guide](docs/usage/adopt-repo-canon.md) describes. It lists the
remaining prerequisites, including the authenticated `gh` access the two GitHub
setup fixes need. Once adopted, check for newer Repo Canon and CLI releases:

```sh
repo-standards outdated --project /path/to/adopting-project
```

## Documentation

[Documentation](docs/README.md)

## Contributing

[Contribution guidelines](CONTRIBUTING.md)

## License

[MIT License](LICENSE)
