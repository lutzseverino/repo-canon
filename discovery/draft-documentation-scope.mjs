import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { isAbsolute, posix, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  declarationTargets,
  developmentGuide,
  documentationCategories,
  documentationModel,
  documentationTree,
  inferredRoots,
  repositoryDocumentationRoot,
} from '../operations/lib/documentation-model.mjs';

// Drafts the documentation scope of a repository from its tree, as a
// Repository Standards scope proposal for the `documentation` declaration.
// The agent runs it from the standards source at the selected commit; the CLI
// never runs it. It decides only what the documentation rules decide, through
// the documentation model the check uses, and lists every other case as an
// unresolved question. It reads the project and writes the proposal to
// standard output.

const usage = 'Usage: node discovery/draft-documentation-scope.mjs [--project <path>] [--root <path>]...';
const proposalFormat = 'repo-standards/scope/v2';
const declarationId = 'documentation';
// Paths Repository Standards reserves, which no declaration's scope can hold:
// its product state and its system skills.
const reservedPaths = ['.repo-standards', '.agents/skills/adopt-standards', '.agents/skills/author-standards'];
const glossary = 'CONTEXT.md';
const contextMap = 'CONTEXT-MAP.md';
const directoryIndex = 'README.md';

// The other declarations' targets come from the source manifest beside this
// script, the one the selected commit ships.
const manifestPath = fileURLToPath(new URL('../standards.yaml', import.meta.url));

function fail(message) {
  throw new Error(message);
}

function isInside(path, directory) {
  return path.startsWith(`${directory}/`);
}

function isWithin(path, directory) {
  return path === directory || isInside(path, directory);
}

function isReserved(path) {
  return reservedPaths.some(reserved => isWithin(path, reserved));
}

function isMarkdownPath(path) {
  return path.toLocaleLowerCase('en-US').endsWith('.md');
}

function baseName(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

function code(path) {
  return `\`${path}\``;
}

function series(items, conjunction = 'and') {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items.at(-1)}`;
}

function parseArguments(argv) {
  let project = process.cwd();
  const roots = [];
  for (let position = 0; position < argv.length; position += 1) {
    const option = argv[position];
    if (option !== '--project' && option !== '--root') fail(`Unknown argument ${option}. ${usage}`);
    const value = argv[position + 1];
    if (value === undefined || value === '') fail(`${option} needs a path. ${usage}`);
    position += 1;
    if (option === '--project') project = value;
    else roots.push(value);
  }
  return { project: resolve(project), roots };
}

function absolutePath(projectRoot, path) {
  return `${projectRoot}${sep}${path.split('/').join(sep)}`;
}

function entryAt(projectRoot, path) {
  return lstatSync(absolutePath(projectRoot, path), { throwIfNoEntry: false }) ?? null;
}

// The source's declarations with the fields that decide their targets. The
// manifest's one profile selects every default declaration unchanged.
function sourceDeclarations() {
  let text;
  try {
    text = readFileSync(manifestPath, 'utf8');
  } catch {
    fail(`Run the drafter from the standards source at the selected commit; ${manifestPath} cannot be read.`);
  }
  const declarations = [];
  let section = null;
  let subsection = null;
  let declaration = null;
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    if (/^\S/.test(line)) {
      section = line.trimEnd();
      subsection = null;
      declaration = null;
      continue;
    }
    if (section !== 'defaults:') continue;
    if (/^ {2}\S/.test(line)) {
      subsection = line.trimEnd();
      declaration = null;
      continue;
    }
    if (subsection !== '  declarations:') continue;
    const id = /^ {4}([A-Za-z0-9._-]+):\s*$/.exec(line);
    if (id) {
      declaration = { id: id[1] };
      declarations.push(declaration);
      continue;
    }
    const field = /^ {6}(kind|target|name):\s*(\S.*?)\s*$/.exec(line);
    if (field && declaration) declaration[field[1]] = field[2].replace(/^(["'])(.*)\1$/, '$2');
  }
  if (!declarations.some(candidate => candidate.id === declarationId && candidate.kind === 'repository')) {
    fail(`${manifestPath} declares no ${declarationId} repository declaration.`);
  }
  return declarations;
}

// The declaration that owns a path, by the targets each other declaration
// owns, or null.
function ownership(declarations) {
  const others = declarations.filter(declaration => declaration.id !== declarationId);
  const paths = new Map();
  const directories = [];
  for (const declaration of others) {
    const targets = declarationTargets([declaration]);
    for (const path of targets.paths) paths.set(path, declaration.id);
    for (const directory of targets.directories) directories.push([directory, declaration.id]);
  }
  return {
    declaredTargets: declarationTargets(others),
    owner: path => paths.get(path)
      ?? directories.find(([directory]) => isWithin(path, directory))?.[1]
      ?? null,
  };
}

// The regular files Git keeps: tracked and untracked files that no ignore rule
// excludes, outside the reserved paths. These are the files the CLI's discovery
// observation offers as evidence.
function keptFiles(projectRoot) {
  let output;
  try {
    output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    fail(`Cannot list the files Git keeps in ${projectRoot}; draft the scope of a Git repository.`);
  }
  const files = new Set();
  for (const path of output.split('\0')) {
    if (!path || isReserved(path)) continue;
    if (entryAt(projectRoot, path)?.isFile()) files.add(path);
  }
  return files;
}

function ancestors(files) {
  const directories = new Set();
  for (const path of files) {
    for (let end = path.lastIndexOf('/'); end > 0; end = path.lastIndexOf('/', end - 1)) {
      directories.add(path.slice(0, end));
    }
  }
  return directories;
}

// A documentation root the maintainer decided on: a repository-relative
// directory outside `docs`, which is always a root, and outside every other
// decided root, since a documentation root never lies inside another.
function decidedRoots(projectRoot, values) {
  const roots = [];
  for (const value of values) {
    const path = value.replace(/\/+$/, '');
    if (!path || isAbsolute(path) || path.includes('\\') || posix.normalize(path) !== path
        || path === '.' || path === '..' || path.startsWith('../')) {
      fail(`--root ${value} must be a repository-relative directory path.`);
    }
    if (isWithin(path, repositoryDocumentationRoot) || isInside(repositoryDocumentationRoot, path)) {
      fail(`--root ${value} cannot be used: ${repositoryDocumentationRoot} is always a documentation root, and a documentation root never lies inside another.`);
    }
    if (isReserved(path)) fail(`--root ${value} lies in a path Repository Standards reserves.`);
    if (!entryAt(projectRoot, path)?.isDirectory()) fail(`--root ${value} is not a directory in the project.`);
    if (!roots.includes(path)) roots.push(path);
  }
  for (const root of roots) {
    const outer = roots.find(other => isInside(root, other));
    if (outer) fail(`--root ${root} lies inside --root ${outer}; a documentation root never lies inside another.`);
  }
  return [repositoryDocumentationRoot, ...roots].sort();
}

const reasons = {
  file: root => `A file under the documentation root ${code(root)}.`,
  rootIndex: root => `The index of the documentation root ${code(root)}, to create.`,
  directoryIndex: directory => `The index of the documentation directory ${code(directory)}, to create.`,
  developmentGuide: 'The development guide, which the contribution guide requires, to create.',
  owned: id => `Owned by the ${code(id)} declaration.`,
  glossary: 'The domain glossary at the repository root.',
  contextMap: 'The context map at the repository root.',
  contextGlossary: `A context glossary that ${code(contextMap)} lists.`,
};

const questions = {
  root: (candidate, directories) => `Is ${code(candidate)} a documentation root? Its ${series(directories.map(code))} ${directories.length === 1 ? 'directory holds' : 'directories hold'} Markdown documents. If it is, draft again with ${code(`--root ${candidate}`)}.`,
  outside: (group, files) => `Which of these Markdown files ${group === '.' ? 'at the repository root' : `under ${code(group)}`} are documentation this scope must cover, such as a document to move into a documentation category: ${series(files.map(code))}? Include each one, with its destination when it moves.`,
  stray: (entry, root) => `${code(entry)} lies directly under the documentation root ${code(root)}, outside the ${series(documentationCategories)} categories. Which category does it move to? Include each destination path and any new directory's index; its current files are already included.`,
  unkept: (directory, root) => `${code(directory)} under the documentation root ${code(root)} holds no file that Git keeps, but the documentation check reads it. Should it be removed, or kept by Git and drafted again?`,
  ignored: (path, root) => `Git ignores ${code(path)} under the documentation root ${code(root)}, but the documentation check reads it. Should it be removed, moved outside the root, or kept by Git and drafted again?`,
  special: (path, root) => `${code(path)} under the documentation root ${code(root)} is a symbolic link or special file, which the scope cannot hold. Should it be replaced with a regular file or removed?`,
  glossary: path => `Is ${code(path)} a domain glossary or context map of this repository? Include it if it is.`,
  ambiguous: root => `The documentation check cannot tell that ${code(root)} is a documentation root without a ${series(documentationCategories, 'or')} directory index. Which category will hold its documents? Include that category's ${code(directoryIndex)}.`,
};

function coverage(roots) {
  const plural = roots.length > 1;
  return `Drafted from the repository tree by ${code('discovery/draft-documentation-scope.mjs')}: every file Git keeps under the documentation ${plural ? 'roots' : 'root'} ${series(roots.map(code))}, a new index for each of ${plural ? 'their' : 'its'} directories without one, the development guide, and the domain glossaries and context maps the rules identify. Paths other declarations own are left out, and ${directoryIndex} files outside the documentation roots are left to the Project README scope. Link-repair files and move destinations enter when the work needs them.`;
}

function draftDocumentationScope(projectRoot, rootArguments = []) {
  if (!entryAt(projectRoot, '.')?.isDirectory()) fail(`The project ${projectRoot} is not a directory.`);
  const { declaredTargets, owner } = ownership(sourceDeclarations());
  const kept = keptFiles(projectRoot);
  const keptDirectories = ancestors(kept);
  const roots = decidedRoots(projectRoot, rootArguments);
  const candidates = new Map();
  const createdIndexes = new Set();
  const unresolved = new Map();
  const include = (path, reason, evidence) => candidates.set(path, { path, decision: 'include', reason, evidence });
  const ask = (path, question) => {
    if (!unresolved.has(path)) unresolved.set(path, question);
  };
  const isUnderRoot = path => roots.some(root => isInside(path, root));

  const createIndex = (directory, root) => {
    const path = `${directory}/${directoryIndex}`;
    if (owner(path) || candidates.has(path)) return;
    let reason = reasons.directoryIndex(directory);
    if (path === developmentGuide) reason = reasons.developmentGuide;
    else if (directory === root) reason = reasons.rootIndex(root);
    include(path, reason, keptDirectories.has(directory) ? [directory] : []);
    createdIndexes.add(path);
  };

  // Every entry under each root, by the tree walk the check uses.
  for (const root of roots) {
    const { directories } = documentationTree(projectRoot, root);
    const skipped = [];
    for (const { path: directory, entries } of directories) {
      if (skipped.some(other => isInside(directory, other))) continue;
      if (directory !== root && owner(directory)) {
        skipped.push(directory);
        continue;
      }
      if (directory !== root && !keptDirectories.has(directory)) {
        ask(directory, questions.unkept(directory, root));
        skipped.push(directory);
        continue;
      }
      let indexed = false;
      for (const entry of entries) {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) continue;
        if (entry.name === directoryIndex) indexed = true;
        const declaration = owner(path);
        if (entry.isFile()) {
          if (declaration) {
            if (kept.has(path)) candidates.set(path, { path, decision: 'exclude', reason: reasons.owned(declaration), evidence: [path] });
          } else if (kept.has(path)) {
            include(path, reasons.file(root), [path]);
          } else if (isMarkdownPath(path)) {
            ask(path, questions.ignored(path, root));
          }
        } else if (!declaration) {
          ask(path, questions.special(path, root));
        }
      }
      if (!indexed) createIndex(directory, root);
    }
    if (directories.length === 0) createIndex(root, root);
  }
  const guideDirectory = developmentGuide.slice(0, developmentGuide.lastIndexOf('/'));
  if (!candidates.has(developmentGuide) && !owner(developmentGuide)
      && ![...unresolved.keys()].some(path => isWithin(guideDirectory, path) || path === developmentGuide)) {
    createIndex(guideDirectory, repositoryDocumentationRoot);
  }

  // Glossaries and context maps outside the roots. The repository root's are
  // decided; a context glossary is decided when the root context map lists it.
  const glossaries = [...kept].filter(path => (
    [glossary, contextMap].includes(baseName(path)) && !isUnderRoot(path) && !owner(path)
  )).sort();
  for (const path of glossaries) {
    if (path === glossary) include(path, reasons.glossary, [path]);
    if (path === contextMap) include(path, reasons.contextMap, [path]);
  }

  const model = documentationModel(projectRoot, [...candidates.values()]
    .filter(candidate => candidate.decision === 'include')
    .map(candidate => candidate.path), { declaredTargets });

  const listed = model.links
    .filter(link => link.source === contextMap && !link.broken && typeof link.path === 'string')
    .map(link => link.path.replace(/\/+$/, ''));
  for (const path of glossaries.filter(candidate => !candidates.has(candidate))) {
    const directory = path.slice(0, path.lastIndexOf('/'));
    if (baseName(path) === glossary && candidates.has(contextMap)
        && (listed.includes(path) || listed.includes(directory))) {
      include(path, reasons.contextGlossary, [path, contextMap]);
    } else {
      ask(path, questions.glossary(path));
    }
  }

  // Top-level entries outside the categories move into one; the destination
  // is the maintainer's. Their files are already included as move sources,
  // and a moved directory needs no new index where it is now.
  for (const root of model.roots) {
    for (const entry of root.strayEntries) {
      if ([...unresolved.keys()].some(path => isWithin(entry, path))) continue;
      ask(entry, questions.stray(entry, root.path));
      for (const path of createdIndexes) {
        if (isInside(path, entry)) candidates.delete(path);
      }
    }
  }
  for (const root of model.ambiguousRoots) ask(root, questions.ambiguous(root));

  // A directory outside the roots whose category-named directories hold
  // Markdown documents may be a documentation root; no rule decides it.
  const categoryIndexes = [...keptDirectories]
    .filter(directory => documentationCategories.includes(baseName(directory)))
    .filter(directory => !roots.some(root => isWithin(directory, root)) && !owner(directory))
    .filter(directory => [...kept].some(path => isInside(path, directory) && isMarkdownPath(path)))
    .map(directory => `${directory}/${directoryIndex}`);
  const candidateRoots = inferredRoots(categoryIndexes).candidatesWithCategories
    .filter(candidate => !roots.some(root => isWithin(candidate, root) || isInside(root, candidate)));
  for (const candidate of candidateRoots) {
    const directories = categoryIndexes
      .map(path => path.slice(0, -(directoryIndex.length + 1)))
      .filter(directory => directory.slice(0, directory.lastIndexOf('/')) === candidate)
      .sort();
    ask(candidate, questions.root(candidate, directories));
  }

  // Markdown files outside the roots may be documentation to move into a
  // category. A README outside the roots never is: the check reads every
  // README in this scope as a documentation root's index.
  const outside = new Map();
  for (const path of [...kept].sort()) {
    if (!isMarkdownPath(path) || isUnderRoot(path) || owner(path)) continue;
    if ([directoryIndex, glossary, contextMap].includes(baseName(path))) continue;
    const group = path.includes('/') ? path.slice(0, path.indexOf('/')) : '.';
    outside.set(group, [...outside.get(group) ?? [], path]);
  }
  for (const [group, files] of outside) ask(`${group}\0outside`, questions.outside(group, files));

  return {
    format: proposalFormat,
    declarations: [{
      id: declarationId,
      coverage: coverage(roots),
      candidates: [...candidates.values()].sort((left, right) => (
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0
      )),
      unresolved: [...unresolved.values()].sort(),
    }],
  };
}

try {
  const { project, roots } = parseArguments(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(draftDocumentationScope(project, roots), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
