<div align="center">
  <h1>Repo Canon</h1>
  <p>Shared documentation, contribution, and coding-agent conventions for maintainers who want consistent repositories.</p>
  <p>
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
    <img src="https://img.shields.io/badge/Node.js-24-5FA04E?logo=node.js&logoColor=white" alt="Node.js 24">
  </p>
</div>

Adopting Repo Canon installs contribution and agent instructions, rules,
skills, templates, and validation workflows into a repository. This process is
called adoption, and a profile is the set of conventions it applies. Rules are
the installed requirements that a repository's files keep satisfying after
adoption.

## Installation

On macOS or Linux, use Node.js 24, npm, and Git 2.32.0 or newer. Repository
Standards is the tool that applies Repo Canon, and `npx` runs it without a
separate installation. From a clean, committed working tree of your
repository, ask your agent to run this command, or run it yourself in a
terminal:

```sh
npx @lutzseverino/repo-standards adopt https://github.com/lutzseverino/repo-canon
```

In a terminal, `adopt` asks its questions and guides your edits. For an
agent, it prints an answers file to fill in with you and its next steps.

## Features

- Install contribution guidance, agent configuration, and issue and PR templates.
- Validate issue contracts (a change's agreed scope and acceptance criteria) and pull request metadata in GitHub workflows.
- Copy seventeen of Matt Pocock's skills, those the shared workflow relies on, into `.agents/skills/`.
- Ship a `babysit` skill that takes an opened pull request through review to its merge.
- Offer a `factory` profile that adds the factory configuration and toolchain image a host-installed factory, an unattended ticket-running service, needs to serve the repository.
- Set up triage labels, squash-only merging, and a required `PR metadata` check where GitHub's plan offers one.
- Check the repository introduction, component introductions, and documentation navigation.
- Install rules for the documentation tree, the repository and component introductions, the license, and the GitHub configuration.

## Usage

Adoption installs Repo Canon's files, skills, and rules, then has you or your
agent bring the README, license, documentation, and agent instructions in line
with the rules. Your repository-specific agent instructions move to
`docs/agents/project.md`. It also sets up GitHub labels and merge rules; this
remote setup can be deferred when GitHub access is missing, so adoption
completes locally. Review the changes `adopt` leaves and commit them.

Pick the `standard` profile, or `factory` for a repository a factory serves;
the [adoption guide](docs/usage/adopt-repo-canon.md) explains the choice and
what remote setup needs. To update, read the
[release notes](https://github.com/lutzseverino/repo-canon/releases) since your
adopted release, then run the command without the URL:

```sh
npx @lutzseverino/repo-standards adopt
```

## Documentation

[Documentation](docs/README.md)

## Contributing

[Contribution guidelines](CONTRIBUTING.md)

## License

[MIT License](LICENSE)
