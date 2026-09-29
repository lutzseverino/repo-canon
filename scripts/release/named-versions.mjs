// Finds the Repo Canon and Repository Standards CLI versions that the
// maintained documents and CI name, and reports where they disagree.
//
// Every version in these files is classified, so a new mention is checked
// rather than skipped. A `v`-prefixed version names a Repo Canon release,
// except in a link to the CLI's own documentation. Any other version names the
// CLI, except one that follows the name of another tool. A version of a tool not
// yet named in `otherTool` therefore fails as a CLI version until it is added.

export const readmePath = 'README.md';
export const adoptionGuidePath = 'docs/usage/adopt-repo-canon.md';
export const ciWorkflowPath = '.github/workflows/ci.yml';
export const standardsPath = 'standards.yaml';

const versionPattern = /(?<![\w.])(v?)(\d+\.\d+\.\d+)(?!\.?\d)/g;
const cliDocumentationLink = /github\.com\/lutzseverino\/repo-standards\/(?:blob|tree)\/$/;
const otherTool = /(?:\bGit|\bGitHub CLI)\s+$/;
const requiresBlock = /^requires:[ \t]*\r?\n((?:[ \t]+\S.*(?:\r?\n|$))+)/m;
const requiresFloor = /^[ \t]+repo-standards:[ \t]*(["']?)>=[ \t]*(\d+\.\d+\.\d+)\1[ \t]*\r?$/m;

// Returns each named version with its kind, `repo-canon` or `cli`, and line.
export function namedVersions(path, text) {
  const versions = [];
  for (const match of text.matchAll(versionPattern)) {
    const before = text.slice(Math.max(0, match.index - 80), match.index);
    if (otherTool.test(before)) continue;
    const kind = match[1] === 'v' && !cliDocumentationLink.test(before) ? 'repo-canon' : 'cli';
    const line = text.slice(0, match.index).split('\n').length;
    versions.push({ kind, version: match[2], path, line });
  }
  return versions;
}

// Returns the CLI version floor of an open-ended `requires` minimum, or null.
export function cliFloor(standardsText) {
  const requires = standardsText.match(requiresBlock)?.[1] ?? '';
  return requires.match(requiresFloor)?.[2] ?? null;
}

function location(mention) {
  return `${mention.path}:${mention.line}`;
}

function repoCanonMentions(read) {
  const mentions = [];
  const problems = [];
  for (const path of [readmePath, adoptionGuidePath]) {
    const found = namedVersions(path, read(path)).filter(mention => mention.kind === 'repo-canon');
    if (found.length === 0) problems.push(`${path} names no Repo Canon version.`);
    mentions.push(...found);
  }
  return { mentions, problems };
}

// Reports every Repo Canon version named in the Repository README and the
// adoption guide that is not `expected`, a version such as `v0.3.1`.
export function repoCanonVersionMismatches(read, expected) {
  const { mentions, problems } = repoCanonMentions(read);
  for (const mention of mentions) {
    if (`v${mention.version}` !== expected) {
      problems.push(`${location(mention)} names Repo Canon v${mention.version}, not ${expected}.`);
    }
  }
  return problems;
}

// Reports every disagreement between the named versions. `read(path)` returns
// the text of a repository file. The Repository README and the adoption guide
// name one Repo Canon version; the CLI version they and CI name is the floor of
// the `requires` minimum in `standards.yaml`.
export function versionDisagreements(read) {
  const { mentions, problems } = repoCanonMentions(read);
  const repoCanonVersions = [...new Set(mentions.map(mention => mention.version))];
  if (repoCanonVersions.length > 1) {
    const named = repoCanonVersions.map(version => {
      const places = mentions.filter(mention => mention.version === version).map(location);
      return `v${version} at ${places.join(', ')}`;
    });
    problems.push(`The documents name more than one Repo Canon version: ${named.join('; ')}.`);
  }

  const floor = cliFloor(read(standardsPath));
  if (floor === null) {
    problems.push(`${standardsPath} does not declare requires.repo-standards as an open-ended minimum such as ">=2.0.0".`);
    return problems;
  }
  for (const path of [readmePath, adoptionGuidePath, ciWorkflowPath]) {
    const cliMentions = namedVersions(path, read(path)).filter(mention => mention.kind === 'cli');
    if (path !== readmePath && cliMentions.length === 0) problems.push(`${path} names no CLI version.`);
    for (const mention of cliMentions) {
      if (mention.version !== floor) {
        problems.push(`${location(mention)} names CLI ${mention.version}, not the ${standardsPath} floor ${floor}.`);
      }
    }
  }
  return problems;
}
