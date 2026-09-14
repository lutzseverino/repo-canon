import { lstatSync, readFileSync } from 'node:fs';
import { isAbsolute, posix, sep } from 'node:path';
import { brokenLocalLinks, renderedMarkdown } from './lib/rendered-markdown.mjs';

const resultFormat = 'repo-standards/result/v1';

function failProcess(message) {
  throw new Error(message);
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
    failProcess('Project README validation must run as a checks operation.');
  }
  const { paths, directories } = request.allowedTargets ?? {};
  if (!Array.isArray(paths) || !Array.isArray(directories) || directories.length !== 0
      || paths.some(path => !isProjectReadmePath(path))) {
    failProcess('Project README validation requires individual non-root README.md paths and no directory targets.');
  }
  if (typeof request.projectRoot !== 'string' || request.projectRoot.length === 0) {
    failProcess('Operation input must identify the project root.');
  }
  return request;
}

function isProjectReadmePath(path) {
  return typeof path === 'string' && path !== 'README.md' && !isAbsolute(path)
    && !path.includes('\\') && posix.normalize(path) === path
    && !path.startsWith('../') && posix.basename(path) === 'README.md';
}

function isFile(path) {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

function result(status, message) {
  process.stdout.write(`${JSON.stringify({ format: resultFormat, status, message })}\n`);
}

function validate(projectRoot, paths) {
  const corrections = [];
  for (const path of paths) {
    const absolute = `${projectRoot}${sep}${path.split('/').join(sep)}`;
    if (!isFile(absolute)) {
      corrections.push(`Create ${path} for the maintained Project.`);
      continue;
    }
    const events = renderedMarkdown(readFileSync(absolute, 'utf8'));
    const renderedHeadings = events.filter(event => event.type === 'heading');
    const headings = renderedHeadings.filter(event => event.level === 1);
    if (headings.length !== 1 || headings[0].centered || renderedHeadings[0] !== headings[0]) {
      corrections.push(`Give ${path} one non-centered level-one title as its first heading.`);
    }
    for (const link of brokenLocalLinks(projectRoot, path, events)) {
      corrections.push(`${path} links to missing ${link.target}.`);
    }
  }
  return [...new Set(corrections)];
}

try {
  const request = readRequest();
  const corrections = validate(request.projectRoot, request.allowedTargets.paths);
  result(
    corrections.length === 0 ? 'passed' : 'failed',
    corrections.length === 0
      ? `Project README structure is valid for ${request.allowedTargets.paths.length} concrete target${request.allowedTargets.paths.length === 1 ? '' : 's'}; purpose, commands, configuration, and documentation still require maintainer or agent review.`
      : `Project README structure needs correction: ${corrections.join(' ')}`,
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
