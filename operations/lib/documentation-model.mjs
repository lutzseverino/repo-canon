import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { sep } from 'node:path';
import { interpretMarkdown } from './rendered-markdown.mjs';
import { localPathExists, resolvedLocalPath } from './local-markdown-links.mjs';

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

function fileContent(projectRoot, path) {
  try {
    const absolute = absolutePath(projectRoot, path);
    return lstatSync(absolute).isFile() ? readFileSync(absolute, 'utf8') : null;
  } catch {
    return null;
  }
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
      else if (entry.isFile() && entry.name.toLocaleLowerCase('en-US').endsWith('.md')) markdownFiles.push(child);
    }
  };
  visit(root);
  return { directories, markdownFiles };
}

function isStrayEntry(entry) {
  return entry.name !== 'README.md'
    && !(entry.isDirectory() && documentationCategories.has(entry.name));
}

function isMarkdownPath(path) {
  return path.toLocaleLowerCase('en-US').endsWith('.md');
}

// Every rendered link or image whose target resolves inside the project. A
// target that leaves the project has no path and is broken. A document that
// cannot be read throws here, which the check reports as a process error.
function localLinks(projectRoot, source) {
  const document = interpretMarkdown(fileContent(projectRoot, source));
  const links = [];
  for (const element of document.content.elements) {
    if (!['link', 'image'].includes(element.type)) continue;
    const path = resolvedLocalPath(source, element.target);
    if (path === null) continue;
    links.push({
      source,
      target: element.target,
      path: path ?? null,
      broken: path === undefined || !localPathExists(projectRoot, path),
    });
  }
  return links;
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
    if (isMarkdownPath(path) && fileContent(projectRoot, path) !== null) documents.add(path);
  }
  const sortedDocuments = [...documents].sort();

  return {
    roots,
    ambiguousRoots: inference.ambiguous,
    developmentGuide: index(developmentGuide),
    documents: sortedDocuments,
    links: sortedDocuments.flatMap(source => localLinks(projectRoot, source)),
  };
}
