// Existing reader fixtures, shared with the independent YAML comparison.
/** @type {[string, string[] | null][]} */
export const workspaceYamlCases = [
  ['packages:\n  - "apps/*\u00a0"\n', ["apps/*\u00a0"]],
  ["packages:\n  - apps/*\u00a0\n", ["apps/*\u00a0"]],
  ["--- # workspace\npackages: [apps/*]\n... # end\n", ["apps/*"]],
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
  [
    'packages: [apps/*\u00a0, "libs/*\u00a0"]\n',
    ["apps/*\u00a0", "libs/*\u00a0"],
  ],
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
  'packages:\n  - "apps/*"\u00a0\n',
  'packages: ["apps/*"\u00a0]\n',
  "--- packages: [apps/*]\n",
  "... packages: [apps/*]\n",
  "packages #x: [apps/*]\n",
  "packages: [apps/*]\nsettings:\n  nested #x: value\n",
  // Supported member patterns do not make unsupported YAML elsewhere readable.
  "packages:\n  - packages/*\noverrides: {}\n",
  "packages:\n  - packages/*\nsettings: &settings\n  enabled: true\n",
  "packages:\n  - packages/*\nnotes: |\n  workspace notes\n",
  "packages:\n  - packages/*\nsettings:\n  - enabled: true\n",
  "packages:\n  - packages/*\n# unrelated\tcomment\n",
  "\uFEFFpackages:\n  - packages/*\n",
  "packages:\n  - true\n",
  "packages:\n  - 24\n",
  "packages:\n  - packages/*\n   - apps/*\n",
  "packages: [packages/*]\npackages: [apps/*]\n",
  "packages: [packages/*]\n  continued\n",
  "packages: [packages/*]\n---\npackages: [apps/*]\n",
];

// Expected discovery semantics, declared independently of the production reader.
export const unsupportedCatalogYamlGroups = {
  unreadableDocuments: [
    ['catalog:\n  oxlint: "1.86.0"\u00a0\n', "catalog:"],
    ['catalog:\n  "oxlint"\u00a0: 1.86.0\n', "catalog:"],
    ["--- packages: [apps/*]\ncatalog:\n  oxlint: 1.86.0\n", "catalog:"],
    ["catalog #x:\n  oxlint: 1.86.0\n", "catalog:"],
    ["catalog:\n  oxlint #x: 1.86.0\n", "catalog:"],
    ["catalogs #x:\n  tools:\n    oxlint: 1.86.0\n", "catalog:tools"],
    ["catalogs:\n  tools #x:\n    oxlint: 1.86.0\n", "catalog:tools"],
    ["catalogs:\n  tools:\n    oxlint #x: 1.86.0\n", "catalog:tools"],
    ["catalog:\n  oxlint: 0.9.0\n  oxlint: 1.86.0\n", "catalog:"],
  ],
  plainNonBreakingSpace: [
    ["catalog:\n  oxlint\u00a0: 1.86.0\n", "catalog:"],
    ["catalogs:\n  tools\u00a0:\n    oxlint: 1.86.0\n", "catalog:tools"],
  ],
  nestedMappings: [
    ["catalog:\n  wrapper:\n    oxlint: 1.86.0\n", "catalog:"],
    [
      "catalogs:\n  tools:\n    wrapper:\n      oxlint: 1.86.0\n",
      "catalog:tools",
    ],
  ],
};

export const unsupportedCatalogYaml = Object.values(
  unsupportedCatalogYamlGroups,
).flat();
