import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { sep } from 'node:path';
import { interpretMarkdown } from './rendered-markdown.mjs';
import { localLinks } from './local-markdown-links.mjs';

// The structure of a repository's documentation: its documentation roots and
// categories, its directories and their documentation indexes, its documents,
// and their local links. Roots are inferred from the confirmed paths, never
// from the tree alone, so the model does not draft scope. It records structure
// only; the documentation check decides which parts need correction.

const repositoryDocumentationRoot = 'docs';
const developmentGuide = `${repositoryDocumentationRoot}/development/README.md`;
const documentationCategories = new Set(['usage', 'development', 'adr', 'agents']);

function absolutePath(projectRoot, path) {
  return `${projectRoot}${sep}${path.split('/').join(sep)}`;
}

function isFile(projectRoot, path) {
  try {
    return lstatSync(absolutePath(projectRoot, path)).isFile();
  } catch {
    return false;
  }
}

// The content of a file, or null when no file exists at the path. A file that
// exists but cannot be read throws Node's read error naming its path, which
// the check reports as a process error.
function fileContent(projectRoot, path) {
  return isFile(projectRoot, path) ? readFileSync(absolutePath(projectRoot, path), 'utf8') : null;
}

function directoryEntries(projectRoot, path) {
  try {
    const absolute = absolutePath(projectRoot, path);
    if (!lstatSync(absolute).isDirectory()) return null;
    return readdirSync(absolute, { withFileTypes: true });
  } catch {
    return null;
  }
}

// A confirmed `<dir>/<category>/README.md` marks `<dir>` as a root, even when
// `<dir>` lies inside another root. Any other confirmed README names a
// candidate root, which is ambiguous unless a root contains it.
function inferredRoots(confirmedPaths) {
  const candidates = new Set([repositoryDocumentationRoot]);
  for (const path of confirmedPaths) {
    const segments = path.split('/');
    const fileName = segments.pop();
    if (fileName !== 'README.md' || segments.length === 0) continue;
    if (documentationCategories.has(segments.at(-1))) segments.pop();
    if (segments.length > 0) candidates.add(segments.join('/'));
  }

  const roots = new Set([repositoryDocumentationRoot]);
  for (const candidate of candidates) {
    if ([...documentationCategories].some(category => (
      confirmedPaths.includes(`${candidate}/${category}/README.md`)
    ))) roots.add(candidate);
  }

  const containedIndex = candidate => [...roots].some(root => (
    candidate !== root && candidate.startsWith(`${root}/`)
  ));
  return {
    roots: [...roots].sort(),
    ambiguous: [...candidates]
      .filter(candidate => !roots.has(candidate) && !containedIndex(candidate))
      .sort(),
  };
}

function isMarkdownPath(path) {
  return path.toLocaleLowerCase('en-US').endsWith('.md');
}

// Walks a root depth first. The first directory is the root itself when it
// exists as a directory.
function documentationTree(projectRoot, root) {
  const directories = [];
  const markdownFiles = [];
  const visit = path => {
    const entries = directoryEntries(projectRoot, path);
    if (entries === null) return;
    directories.push({ path, entries });
    for (const entry of entries) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile() && isMarkdownPath(entry.name)) markdownFiles.push(child);
    }
  };
  visit(root);
  return { directories, markdownFiles };
}

function isStrayEntry(entry) {
  return entry.name !== 'README.md'
    && !(entry.isDirectory() && documentationCategories.has(entry.name));
}

// Every rendered local link of a document. `path` is null when the target
// leaves the project, which makes the link broken.
function documentLinks(projectRoot, source) {
  const document = interpretMarkdown(fileContent(projectRoot, source));
  return localLinks(projectRoot, source, document.content.elements).map(link => ({
    source,
    target: link.target,
    path: link.path ?? null,
    broken: link.broken,
  }));
}

// Builds the model from the project root and the confirmed paths:
//
// - `roots`: each documentation root, sorted, with its `index`, its
//   `strayEntries` outside the documentation categories, its `directories`
//   below it in walk order with their `index`, and its `confirmedIndexes`
//   under a documentation category;
// - `ambiguousRoots`: candidate roots the confirmed paths cannot resolve;
// - `developmentGuide`: the index of `docs/development`;
// - `documents`: the Markdown files under each root and the confirmed
//   Markdown files that exist, sorted;
// - `links`: each document's local links as `{ source, target, path, broken }`.
//
// Each index is `{ path, state, confirmed }`, where `state` is `missing`,
// `empty`, or `present`.
export function documentationModel(projectRoot, confirmedPaths) {
  const index = path => {
    const content = fileContent(projectRoot, path);
    let state = 'missing';
    if (content !== null) state = interpretMarkdown(content).content.hasContent ? 'present' : 'empty';
    return { path, state, confirmed: confirmedPaths.includes(path) };
  };

  const inference = inferredRoots(confirmedPaths);
  const documents = new Set();
  const roots = inference.roots.map(path => {
    const tree = documentationTree(projectRoot, path);
    const [rootDirectory, ...directories] = tree.directories;
    const confirmedIndexes = new Set(confirmedPaths.filter(confirmedPath => (
      confirmedPath.startsWith(`${path}/`)
      && confirmedPath.endsWith('/README.md')
      && documentationCategories.has(confirmedPath.slice(path.length + 1).split('/')[0])
    )));
    for (const document of tree.markdownFiles) documents.add(document);
    return {
      path,
      index: index(`${path}/README.md`),
      strayEntries: (rootDirectory?.entries ?? [])
        .filter(isStrayEntry)
        .map(entry => `${path}/${entry.name}`),
      directories: directories.map(directory => ({
        path: directory.path,
        index: index(`${directory.path}/README.md`),
      })),
      confirmedIndexes: [...confirmedIndexes].map(index),
    };
  });
  for (const path of confirmedPaths) {
    if (isMarkdownPath(path) && isFile(projectRoot, path)) documents.add(path);
  }
  const sortedDocuments = [...documents].sort();

  return {
    roots,
    ambiguousRoots: inference.ambiguous,
    developmentGuide: index(developmentGuide),
    documents: sortedDocuments,
    links: sortedDocuments.flatMap(source => documentLinks(projectRoot, source)),
  };
}
