<div align="center">
  <h1>Repo Canon</h1>
  <p>Shared documentation, contribution, and coding-agent conventions for maintainers who want consistent repositories.</p>
  <p>
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
    <img src="https://img.shields.io/badge/Node.js-24-5FA04E?logo=node.js&logoColor=white" alt="Node.js 24">
  </p>
</div>

Applying Repo Canon installs contribution and agent instructions, skills,
templates, and validation workflows into a repository. This process is called
adoption.

## Installation

Repository Standards is the tool that applies Repo Canon to a repository;
use its CLI 6.0.0 or newer. On macOS
or Linux, use Node.js 24, npm, and Git 2.32.0 or newer, and install the CLI outside
the repository:

```sh
npm install --global --ignore-scripts @lutzseverino/repo-standards
repo-standards --version
```

Select an owner-published release compatible with that CLI, and the `standard`
profile, or the `factory` profile for a repository that a host-installed factory
serves. The latest [`v0.12.0` release](https://github.com/lutzseverino/repo-canon/releases/tag/v0.12.0)
requires CLI 6.0.0 or newer. Before updating an existing adoption, read the
breaking standards changes and migration steps of each release since the
adopted one.

## Features

- Install contribution guidance, agent configuration, and issue and PR templates.
- Validate issue contracts (a change's agreed scope and acceptance criteria) and pull request metadata in GitHub workflows.
- Copy seventeen of Matt Pocock's skills, those the shared workflow relies on, into `.agents/skills/`.
- Ship a `babysit` skill that takes an opened pull request through review to its merge.
- Offer a `factory` profile that adds the factory configuration and toolchain image a host-installed factory, an unattended ticket-running service, needs to serve the repository.
- Set up triage labels, squash-only merging, and a required `PR metadata` check where GitHub's plan offers one.
- Check the repository introduction, component introductions, and documentation navigation.
- Guide agents on the documentation tree and repository and component introductions.

## Usage

Inspect the published release before adoption. The report is read-only and
authorizes nothing:

```sh
repo-standards inspect \
  --source https://github.com/lutzseverino/repo-canon \
  --standards-version v0.12.0 --profile standard \
  --project /path/to/adopting-project --json
```

Review the report and scope, and complete the adoption as the
[adoption guide](docs/usage/adopt-repo-canon.md) describes. It lists the
remaining prerequisites, the exact CLI installation to retain through adoption,
and the authenticated `gh` access the two GitHub setup fixes need.

## Documentation

[Documentation](docs/README.md)

## Contributing

[Contribution guidelines](CONTRIBUTING.md)

## License

[MIT License](LICENSE)
