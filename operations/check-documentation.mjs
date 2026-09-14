import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { isAbsolute, posix, sep } from 'node:path';
import { brokenLocalLinks, renderedMarkdown } from './lib/rendered-markdown.mjs';

const resultFormat = 'repo-standards/result/v1';
const documentationIndex = 'docs/README.md';
const developmentGuide = 'docs/development/README.md';
const documentationCategories = new Set(['usage', 'development', 'adr', 'agents']);

function failProcess(message) {
  throw new Error(message);
}

function isSafeFilePath(projectRoot, path) {
  if (typeof path !== 'string' || path.length === 0 || isAbsolute(path)
      || path === '.' || path.endsWith('/') || path.includes('\\')
      || posix.normalize(path) !== path || path.startsWith('../')) return false;
  let existingDirectory = false;
  try {
    existingDirectory = lstatSync(absolutePath(projectRoot, path)).isDirectory();
  } catch {
    // Missing intended files are valid concrete targets.
  }
  return !existingDirectory;
}

function readRequest() {
  let request;
  try {
    request = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    failProcess('Operation input must be one JSON object.');
  }
  if (request?.format !== 'repo-standards/operation/v1') {
    failProcess('Unsupported operation input format; expected repo-standards/operation/v1.');
  }
  if (request.operation?.phase !== 'checks') {
    failProcess('Documentation validation must run as a checks operation.');
  }
  if (typeof request.projectRoot !== 'string' || request.projectRoot.length === 0) {
    failProcess('Operation input must identify the project root.');
  }
  const { paths, directories } = request.allowedTargets ?? {};
  if (!Array.isArray(paths) || paths.some(path => !isSafeFilePath(request.projectRoot, path))
      || !Array.isArray(directories) || directories.length !== 0) {
    failProcess('Documentation validation requires individual repository-relative file paths and no directory targets.');
  }
  return request;
}

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

function documentationTree(projectRoot) {
  const directories = [];
  const markdownFiles = [];
  const visit = path => {
    const entries = directoryEntries(projectRoot, path);
    if (entries === null) return;
    directories.push(path);
    for (const entry of entries) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) visit(child);
      else if (entry.isFile() && entry.name.toLocaleLowerCase('en-US').endsWith('.md')) markdownFiles.push(child);
    }
  };
  visit('docs');
  return { directories, markdownFiles };
}

function validate(projectRoot, allowedPaths) {
  const corrections = [];
  const index = fileContent(projectRoot, documentationIndex);
  if (index === null) {
    corrections.push(`Create ${documentationIndex} to map the documentation categories and their placement rules.`);
  } else if (renderedMarkdown(index).length === 0) {
    corrections.push(`Populate ${documentationIndex} with the documentation map and placement rules.`);
  }
  if (!allowedPaths.includes(documentationIndex)) {
    corrections.push(`Include ${documentationIndex} in the confirmed documentation scope.`);
  }
  const guide = fileContent(projectRoot, developmentGuide);
  if (guide === null) {
    corrections.push(`Create ${developmentGuide} with the project's prerequisites, setup, development commands, and required validation.`);
  } else if (renderedMarkdown(guide).length === 0) {
    corrections.push(`Populate ${developmentGuide} with the project's prerequisites, setup, development commands, and required validation.`);
  }
  if (!allowedPaths.includes(developmentGuide)) {
    corrections.push(`Include ${developmentGuide} in the confirmed documentation scope.`);
  }

  const tree = documentationTree(projectRoot);
  for (const entry of directoryEntries(projectRoot, 'docs') ?? []) {
    if (entry.name === 'README.md' || (entry.isDirectory() && documentationCategories.has(entry.name))) continue;
    corrections.push(`Move docs/${entry.name} into usage, development, adr, or agents, preserving useful content and affected links.`);
  }
  for (const directory of tree.directories) {
    if (directory === 'docs') continue;
    const directoryIndex = `${directory}/README.md`;
    const content = fileContent(projectRoot, directoryIndex);
    if (content === null) corrections.push(`Create ${directoryIndex} to explain this documentation directory and link its useful contents.`);
    else if (renderedMarkdown(content).length === 0) corrections.push(`Populate ${directoryIndex} with the directory purpose and links to useful contents.`);
  }

  const markdownFiles = new Set(tree.markdownFiles);
  for (const path of allowedPaths) {
    if (path.toLocaleLowerCase('en-US').endsWith('.md') && fileContent(projectRoot, path) !== null) {
      markdownFiles.add(path);
    }
  }
  for (const path of [...markdownFiles].sort()) {
    const events = renderedMarkdown(fileContent(projectRoot, path));
    for (const link of brokenLocalLinks(projectRoot, path, events)) {
      corrections.push(`${path} links to missing ${link.target}.`);
    }
  }
  return [...new Set(corrections)];
}

function result(status, message) {
  process.stdout.write(`${JSON.stringify({ format: resultFormat, status, message })}\n`);
}

try {
  const request = readRequest();
  const corrections = validate(request.projectRoot, request.allowedTargets.paths);
  result(
    corrections.length === 0 ? 'passed' : 'failed',
    corrections.length === 0
      ? 'Documentation navigation is valid; content placement and usefulness still require maintainer or agent review.'
      : `Documentation navigation needs correction: ${corrections.join(' ')}`,
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
