import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { sep } from 'node:path';
import { interpretMarkdown } from './rendered-markdown.mjs';
import { localLinks, resolvedLocalPath } from './local-markdown-links.mjs';

// The structure of a repository's documentation: its documentation roots and
// categories, its directories and their documentation indexes, its documents,
// their scope membership, and their local links. Roots are inferred from the
// confirmed paths, never from the tree alone, so the model does not draft
// scope. The model also defines the documentation rules that read this
// structure: index entry form, one index per document, the development
// guide's order, and scope coverage. The documentation check reports their
// violations together with its structural corrections.

const repositoryDocumentationRoot = 'docs';
const developmentGuide = `${repositoryDocumentationRoot}/development/README.md`;
const documentationCategories = new Set(['usage', 'development', 'adr', 'agents']);

// The installed agents index cites the optional project guidance in context
// rather than listing it as an entry.
const agentsIndex = `${repositoryDocumentationRoot}/agents/README.md`;
const projectGuidance = `${repositoryDocumentationRoot}/agents/project.md`;

const setupAndValidation = 'setup and validation';

// The documentation rules, by the name each failure cites.
export const documentationRules = Object.freeze({
  indexEntryForm: 'index entry form',
  oneIndex: 'one index per document',
  developmentGuideOrder: 'development guide order',
  scopeCoverage: 'scope coverage',
});

function absolutePath(projectRoot, path) {
  return `${projectRoot}${sep}${path.split('/').join(sep)}`;
}

// The errors that show no entry can exist at a path: it is absent, lies below
// a file or a symbolic link loop, or is too long.
const noEntryErrors = new Set(['ENOENT', 'ENOTDIR', 'ELOOP', 'ENAMETOOLONG']);

// The entry at a path, or null when no entry can exist there. Any other
// failure to inspect the path, such as inside a directory that cannot be
// searched, throws Node's error naming the path, which the check reports as a
// process error.
function entryAt(projectRoot, path) {
  try {
    return lstatSync(absolutePath(projectRoot, path));
  } catch (error) {
    if (noEntryErrors.has(error.code)) return null;
    throw error;
  }
}

function isFile(projectRoot, path) {
  return entryAt(projectRoot, path)?.isFile() ?? false;
}

function isDirectory(projectRoot, path) {
  return entryAt(projectRoot, path)?.isDirectory() ?? false;
}

// The content of a file, or null when no file exists at the path. A file that
// exists but cannot be read throws Node's read error naming its path, which
// the check reports as a process error.
function fileContent(projectRoot, path) {
  return isFile(projectRoot, path) ? readFileSync(absolutePath(projectRoot, path), 'utf8') : null;
}

function isInside(path, directory) {
  return path.startsWith(`${directory}/`);
}

// A confirmed `<dir>/<category>/README.md` names `<dir>` as a candidate root
// with categories, and any other confirmed README names a candidate root.
// A documentation root never lies inside another: `docs` and the outermost
// candidates with categories are the roots, and a candidate with categories
// inside a root is an ordinary directory of that root. A candidate without
// categories is ambiguous unless a root contains it.
export function inferredRoots(confirmedPaths) {
  const candidates = new Set([repositoryDocumentationRoot]);
  for (const path of confirmedPaths) {
    const segments = path.split('/');
    const fileName = segments.pop();
    if (fileName !== 'README.md' || segments.length === 0) continue;
    if (documentationCategories.has(segments.at(-1))) segments.pop();
    if (segments.length > 0) candidates.add(segments.join('/'));
  }

  const candidatesWithCategories = [...candidates].filter(candidate => (
    candidate === repositoryDocumentationRoot
    || [...documentationCategories].some(category => (
      confirmedPaths.includes(`${candidate}/${category}/README.md`)
    ))
  ));
  const roots = candidatesWithCategories.filter(candidate => (
    !candidatesWithCategories.some(other => isInside(candidate, other))
  ));
  return {
    roots: roots.sort(),
    candidatesWithCategories: candidatesWithCategories.sort(),
    ambiguous: [...candidates]
      .filter(candidate => !candidatesWithCategories.includes(candidate)
        && !roots.some(root => isInside(candidate, root)))
      .sort(),
  };
}

function isMarkdownPath(path) {
  return path.toLocaleLowerCase('en-US').endsWith('.md');
}

// Walks a root depth first. The first directory is the root itself when it
// exists as a directory; every directory below it exists because its parent
// lists it. A directory that exists but cannot be listed throws Node's read
// error naming its path, which the check reports as a process error.
export function documentationTree(projectRoot, root) {
  const directories = [];
  const markdownFiles = [];
  const visit = path => {
    const entries = readdirSync(absolutePath(projectRoot, path), { withFileTypes: true });
    directories.push({ path, entries });
    for (const entry of entries) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile() && isMarkdownPath(entry.name)) markdownFiles.push(child);
    }
  };
  if (isDirectory(projectRoot, root)) visit(root);
  return { directories, markdownFiles };
}

function isStrayEntry(entry) {
  return entry.name !== 'README.md'
    && !(entry.isDirectory() && documentationCategories.has(entry.name));
}

// The index that lists a document under a documentation root: its
// directory's README, or for a directory README, its parent's. A root's own
// index is listed in no index, so its index is null.
export function documentIndex(root, document) {
  const segments = document.split('/');
  const fileName = segments.pop();
  let directory = segments.join('/');
  if (fileName === 'README.md') {
    if (directory === root) return null;
    directory = directory.slice(0, directory.lastIndexOf('/'));
  }
  return `${directory}/README.md`;
}

// Whether a path is one of the declared targets: an explicit path, or a path
// inside a declared directory.
function isDeclared(path, declaredTargets) {
  return declaredTargets.paths.includes(path)
    || declaredTargets.directories.some(directory => isInside(path, directory));
}

const sentenceEnd = /[.!?]["'\u2019\u201d)\]]*$/u;
const sentenceBoundary = /[.!?]["'\u2019\u201d)\]]*\s+["'\u2018\u201c(\[]*\p{Lu}/u;

// Rendered text is one sentence when it ends a sentence and no sentence ends
// before a capitalized word inside it.
function isOneSentence(text) {
  return sentenceEnd.test(text) && !sentenceBoundary.test(text);
}

function headingLevel(block) {
  const match = /^h([1-6])$/.exec(block.tag);
  return match ? Number(match[1]) : null;
}

function foldedText(text) {
  return text.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US');
}

function listItems(blocks) {
  return blocks
    .filter(block => block.tag === 'ul' || block.tag === 'ol')
    .flatMap(list => list.blocks.filter(block => block.tag === 'li'));
}

// An index item. Its first link names the listed path, a directory meaning
// its README. The item is well formed when it is `[Title](path): description`:
// it opens with a titled local link, followed by a colon and a description.
function indexItem(indexPath, item, directories) {
  const [link] = item.links;
  let path = link ? resolvedLocalPath(indexPath, link.target) : null;
  if (typeof path === 'string') {
    path = path.replace(/\/+$/, '');
    if (directories.has(path)) path = `${path}/README.md`;
  } else {
    path = null;
  }
  return {
    text: item.text,
    target: link?.target ?? null,
    path,
    wellFormed: Boolean(link?.text) && path !== null && item.text.startsWith(link.text)
      && /^:\s+\S/.test(item.text.slice(link.text.length)),
  };
}

// The rendered structure of a present documentation index: its purpose, the
// first paragraph after its title, and the items of its top-level lists after
// that purpose. The development guide's index follows its Setup and validation
// section, so only items after that section are its index; the items before
// it, and whether it has the section, are recorded for its order.
function indexStructure(path, document, directories, isDevelopmentGuide) {
  const { blocks } = document;
  let start = blocks[0]?.tag === 'h1' ? 1 : 0;
  const purpose = blocks[start]?.tag === 'p' ? blocks[start] : null;
  if (purpose) start += 1;
  const structure = {
    path,
    purpose: purpose ? { text: purpose.text, oneSentence: isOneSentence(purpose.text) } : null,
  };
  let indexStart = start;
  if (isDevelopmentGuide) {
    const section = blocks.findIndex(block => (
      headingLevel(block) !== null && foldedText(block.text) === setupAndValidation
    ));
    if (section >= 0) {
      const level = headingLevel(blocks[section]);
      const next = blocks.findIndex((block, index) => (
        index > section && headingLevel(block) !== null && headingLevel(block) <= level
      ));
      indexStart = next < 0 ? blocks.length : next;
    }
    structure.setupAndValidation = section >= 0;
    structure.itemsBeforeIndex = listItems(blocks.slice(start, indexStart))
      .map(item => indexItem(path, item, directories));
  }
  structure.items = listItems(blocks.slice(indexStart)).map(item => indexItem(path, item, directories));
  return structure;
}

// Every rendered local link of a document. `path` is null when the target
// leaves the project, which makes the link broken.
function documentLinks(projectRoot, source, document) {
  return localLinks(projectRoot, source, document.content.elements).map(link => ({
    source,
    target: link.target,
    path: link.path ?? null,
    broken: link.broken,
  }));
}

// Builds the model from the project root, the confirmed paths, and the paths
// that other declarations own:
//
// - `roots`: each documentation root, sorted, with its `index`, its
//   `strayEntries` outside the documentation categories, its `directories`
//   below it in walk order with their `index`, and its `confirmedIndexes`
//   under a documentation category of the root or of a directory inside it
//   that a confirmed category index names;
// - `ambiguousRoots`: candidate roots the confirmed paths cannot resolve;
// - `developmentGuide`: the index of `docs/development`;
// - `documents`: the Markdown files under each root and the confirmed
//   Markdown files that exist, sorted;
// - `members`: each Markdown file under a root, sorted, as
//   `{ path, root, index, scope }`, where `index` is the index that lists it
//   (null for a root's own index) and `scope` is `confirmed`, `declared` when
//   another declaration owns it, or null;
// - `indexes`: each present index under a root, in root and walk order, as
//   `{ path, purpose, items }`, where `purpose` is `{ text, oneSentence }` or
//   null and each item is `{ text, target, path, wellFormed }`; the
//   development guide also records `setupAndValidation` and
//   `itemsBeforeIndex`;
// - `links`: each document's local links as `{ source, target, path, broken }`.
//
// Each index state is `{ path, state, confirmed }`, where `state` is
// `missing`, `empty`, or `present`. `declaredTargets` holds the explicit
// `paths` and `directories` that other declarations own.
export function documentationModel(projectRoot, confirmedPaths, {
  declaredTargets = { paths: [], directories: [] },
} = {}) {
  const rendered = new Map();
  const render = path => {
    if (!rendered.has(path)) {
      const content = fileContent(projectRoot, path);
      rendered.set(path, content === null ? null : interpretMarkdown(content));
    }
    return rendered.get(path);
  };
  const index = path => {
    const document = render(path);
    let state = 'missing';
    if (document !== null) state = document.content.hasContent ? 'present' : 'empty';
    return { path, state, confirmed: confirmedPaths.includes(path) };
  };

  const inference = inferredRoots(confirmedPaths);
  const documents = new Set();
  const members = [];
  const indexes = [];
  const roots = inference.roots.map(path => {
    const tree = documentationTree(projectRoot, path);
    const [rootDirectory, ...directories] = tree.directories;
    const candidatesInRoot = inference.candidatesWithCategories.filter(candidate => (
      candidate === path || isInside(candidate, path)
    ));
    const confirmedIndexes = new Set(confirmedPaths.filter(confirmedPath => (
      confirmedPath.endsWith('/README.md')
      && candidatesInRoot.some(candidate => (
        isInside(confirmedPath, candidate)
        && documentationCategories.has(confirmedPath.slice(candidate.length + 1).split('/')[0])
      ))
    )));
    for (const document of tree.markdownFiles) {
      documents.add(document);
      let scope = null;
      if (confirmedPaths.includes(document)) scope = 'confirmed';
      else if (isDeclared(document, declaredTargets)) scope = 'declared';
      members.push({ path: document, root: path, index: documentIndex(path, document), scope });
    }
    const root = {
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
    const directoryPaths = new Set(tree.directories.map(directory => directory.path));
    for (const { state, path: indexPath } of [root.index, ...root.directories.map(directory => directory.index)]) {
      if (state !== 'present') continue;
      indexes.push(indexStructure(indexPath, render(indexPath), directoryPaths, indexPath === developmentGuide));
    }
    return root;
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
    members: members.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0)),
    indexes,
    links: sortedDocuments.flatMap(source => documentLinks(projectRoot, source, render(source))),
  };
}

function itemLabel(item) {
  const [line] = item.text.split('\n');
  return line.length > 80 ? `${line.slice(0, 79)}\u2026` : line;
}

// The violations of the documentation rules in a model, as
// `{ rule, path, correction }`, grouped by rule in the order of
// `documentationRules` and by path within each rule. A document whose index
// is missing or empty gets no one-index violation for it; the structural
// correction to create or populate that index covers it.
export function documentationRuleViolations(model) {
  const violations = [];
  const violation = (rule, path, correction) => violations.push({ rule, path, correction });
  const indexes = new Map(model.indexes.map(structure => [structure.path, structure]));
  const sortedIndexes = [...indexes.keys()].sort();

  for (const path of sortedIndexes) {
    const { purpose, items } = indexes.get(path);
    if (purpose === null) {
      violation(documentationRules.indexEntryForm, path, 'start it with a one-sentence purpose after its title.');
    } else if (!purpose.oneSentence) {
      violation(documentationRules.indexEntryForm, path, 'make the purpose after its title one sentence.');
    }
    for (const item of items.filter(candidate => !candidate.wellFormed)) {
      violation(
        documentationRules.indexEntryForm,
        path,
        `write each entry as one "[Title](path): description" item; "${itemLabel(item)}" is not.`,
      );
    }
  }

  const listings = new Map();
  for (const path of sortedIndexes) {
    for (const item of indexes.get(path).items) {
      if (item.path === null) continue;
      const listing = listings.get(item.path) ?? [];
      listing.push(path);
      listings.set(item.path, listing);
    }
  }
  for (const member of model.members) {
    if (member.index === null) continue;
    const listing = listings.get(member.path) ?? [];
    const citedInContext = member.path === projectGuidance && member.index === agentsIndex;
    const ownListings = listing.filter(path => path === member.index).length;
    if (indexes.has(member.index) && ownListings === 0 && !citedInContext) {
      violation(documentationRules.oneIndex, member.path, `list it in ${member.index}.`);
    } else if (ownListings > 1) {
      violation(documentationRules.oneIndex, member.path, `list it once in ${member.index}.`);
    }
    for (const other of new Set(listing.filter(path => path !== member.index))) {
      violation(documentationRules.oneIndex, member.path, citedInContext
        ? `leave it to the in-context citation in ${member.index}; remove it from ${other}.`
        : `list it only in ${member.index}; remove it from ${other}.`);
    }
  }

  const guide = indexes.get(developmentGuide);
  if (guide) {
    if (!guide.setupAndValidation) {
      violation(
        documentationRules.developmentGuideOrder,
        guide.path,
        'give its purpose, then a Setup and validation section, then its index.',
      );
    } else if (guide.itemsBeforeIndex.some(item => item.wellFormed && model.members.some(member => (
      member.path === item.path && member.index === guide.path
    )))) {
      violation(
        documentationRules.developmentGuideOrder,
        guide.path,
        'list its entries after the Setup and validation section.',
      );
    }
  }

  for (const member of model.members.filter(candidate => candidate.scope === null)) {
    violation(
      documentationRules.scopeCoverage,
      member.path,
      'include it in the confirmed documentation scope.',
    );
  }
  return violations;
}
