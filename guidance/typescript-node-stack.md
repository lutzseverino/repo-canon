# typescript-node stack adoption guidance

The `typescript-node-stack` declaration is optional. A repository without a
Project that uses the stack confirms no scope: its rules are not installed and
its check does not run.

## Membership

Settle each Project's membership from the repository's evidence: its
manifests, workspace configuration, lockfile, sources, workflows and
development guide. Do not ask the maintainer unless that evidence leaves
membership open.

- A Project new in this adoption or update joins the stack: include its
  `package.json` and bring it in line with the rules.
- An existing Project that differs from the rules stays out of the scope.
  Exclude it with its differences as the reason, and list each concrete
  difference in your handoff, so that a separate migration ticket brings it
  in.
- A Project that already matches stays in the scope.
- A workspace root is never a Project: exclude it, conforming or not, and
  assess its shared facts through its members.

When no Project is included, confirm no scope, with the reasons for each
exclusion.

## Assessment

Assess each covered Project against the `typescript-node-stack` rules. The
read-only check verifies, for each confirmed `package.json`, that the
workspace root sets `packageManager` to pnpm 11, keeps `pnpm-lock.yaml`, and
limits `engines.node` to Node.js 24 or 26; that the Project or its workspace
root declares oxlint 1 and Prettier 3; and that the Project has a `validate`
script. Assess what the check cannot see:

- TypeScript 7 compiles the Project's TypeScript sources, or type-checks its
  JavaScript sources with `checkJs`;
- its tests run with `node --test`;
- required pull request checks run `validate`, or every step it runs, on each
  of its Node.js majors;
- the development guide's Setup and validation section names these tools;
- the Project uses no other stack.

Cite the evidence for each judgment, such as the `tsconfig.json`, the
`validate` script's steps, and the workflow jobs that the repository requires.
