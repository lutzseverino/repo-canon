// Existing reader fixtures, shared with the independent YAML comparison.
/** @type {[string, string[] | null][]} */
export const workspaceYamlCases = [
  ["packages:\n  - packages/*\n  - 'apps/*'\n", ["packages/*", "apps/*"]],
  // An indentationless block sequence, with a comment between items.
  [
    'packages:\n- packages/*\n# apps\n- "apps/*" # apps\ncatalog:\n  oxlint: 1.86.0\n',
    ["packages/*", "apps/*"],
  ],
  [
    "packages: ['packages/*', \"apps/*\", tools/*] # members\n",
    ["packages/*", "apps/*", "tools/*"],
  ],
  ["packages: []\n", []],
  // Negated patterns are quoted, since a bare `!` starts a YAML tag.
  [
    "packages:\n  - 'packages/**'\n  - '!**/test/**'\n",
    ["packages/**", "!**/test/**"],
  ],
  ["packages:\n  - !**/test/**\n", null],
  ["# settings only\nonlyBuiltDependencies:\n  - esbuild\n", []],
  ["packages: *members\n", null],
];

/** @type {[string, string[] | null][]} */
export const flowYamlCases = [
  ['packages: ["packages/{cli,web}"]\n', ["packages/{cli,web}"]],
  [
    "packages: ['packages/{cli,web}', \"apps/{a,b}/*\", tools/*]\n",
    ["packages/{cli,web}", "apps/{a,b}/*", "tools/*"],
  ],
  ["packages: [packages/*, apps/*,]\n", ["packages/*", "apps/*"]],
  ["packages: [ ]\n", []],
  ["packages: [packages/*] # see [apps]\n", ["packages/*"]],
  ['packages: ["a\\"b", \'it\'\'s\', "c\\\\d"]\n', ['a"b', "it's", "c\\d"]],
  [
    "packages: [\n  'packages/*', # members\n  \"apps/*\",\n]\nonlyBuiltDependencies: []\n",
    ["packages/*", "apps/*"],
  ],
  // Forms YAML reads differently or rejects, which read as unreadable.
  ["packages: [packages/{cli,web}]\n", null],
  ["packages: [a,, b]\n", null],
  ["packages: [,]\n", null],
  ["packages: [a] extra\n", null],
  ['packages: ["a\\nb"]\n', null],
  ["packages: [\n  'packages/*'\n", null],
  ["packages: [[a], b]\n", null],
  ["packages: [a #b, c]\n", null],
];

export const catalogYaml = `catalog: # default
  oxlint: 1.86.0 # lint
  '@types/node': ^24.0.0
catalogs:
  # shared
  tools: # shared tools
    prettier: "3.9.9"
  legacy:
    prettier: 2.8.8
`;

export const unsupportedWorkspaceYaml = [
  "packages:\n  - true\n",
  "packages:\n  - 24\n",
  "packages:\n  - packages/*\n   - apps/*\n",
  "packages: [packages/*]\npackages: [apps/*]\n",
  "packages: [packages/*]\n  continued\n",
  "packages: [packages/*]\n---\npackages: [apps/*]\n",
];

export const unsupportedCatalogYaml = [
  ["catalog:\n  wrapper:\n    oxlint: 1.86.0\n", "catalog:"],
  [
    "catalogs:\n  tools:\n    wrapper:\n      oxlint: 1.86.0\n",
    "catalog:tools",
  ],
  ["catalog:\n  oxlint: 0.9.0\n  oxlint: 1.86.0\n", "catalog:"],
];
