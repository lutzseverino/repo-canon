import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const resultFormat = 'repo-standards/result/v1';
const recognizedSections = [
  'Installation',
  'Features',
  'Usage',
  'Configuration',
  'Documentation',
  'Contributing',
  'License',
];

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
    failProcess('Repository README validation must run as a checks operation.');
  }
  const { paths, directories } = request.allowedTargets ?? {};
  if (!Array.isArray(paths) || paths.length !== 1 || paths[0] !== 'README.md'
      || !Array.isArray(directories) || directories.length !== 0) {
    failProcess('Repository README validation requires the exact README.md target and no directory targets.');
  }
  if (typeof request.projectRoot !== 'string' || request.projectRoot.length === 0) {
    failProcess('Operation input must identify the project root.');
  }
  return request;
}

function result(status, message) {
  process.stdout.write(`${JSON.stringify({ format: resultFormat, status, message })}\n`);
}

function rootLicense(projectRoot) {
  const candidates = readdirSync(projectRoot, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^licen[cs]e(?:\.(?:md|txt))?$/i.test(entry.name))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right));
  if (candidates.length === 0) {
    return { blocked: 'No root license file was found; identify the repository license and its file.' };
  }
  if (candidates.length > 1) {
    return { blocked: `Multiple root license files were found (${candidates.join(', ')}); identify which license and file the README must name.` };
  }

  const path = candidates[0];
  const firstLine = readFileSync(join(projectRoot, path), 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean);
  const name = firstLine
    ?.replace(/^#{1,6}\s+/, '')
    .replace(/^<h[1-6][^>]*>|<\/h[1-6]>$/gi, '')
    .trim();
  if (!name || !/\blicen[cs]e\b/i.test(name)) {
    return { blocked: `${path} does not identify a license name in its first nonempty line.` };
  }
  const licenseMentions = name.match(/\blicen[cs]e\b/gi)?.length ?? 0;
  if (licenseMentions > 1 || /\b(?:or|dual(?:ly)?|multiple)\b|\s(?:\/|&)\s/i.test(name)) {
    return { blocked: `${path} identifies ambiguous licensing (“${name}”).` };
  }
  return { path, name };
}

function headings(markdown) {
  const found = [];
  const pattern = /^##[ \t]+(.+?)[ \t]*#*[ \t]*$/gm;
  for (const match of markdown.matchAll(pattern)) {
    const name = match[1].trim();
    found.push({
      name,
      folded: name.toLocaleLowerCase('en-US'),
      index: match.index,
      end: match.index + match[0].length,
    });
  }
  return found;
}

function markdownStructure(markdown) {
  const mask = value => value.replace(/[^\r\n]/g, ' ');
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, mask);
  let fence = null;
  return withoutComments.split(/(?<=\n)/).map(line => {
    const marker = line.match(/^[ \t]{0,3}(`{3,}|~{3,})/);
    if (!fence && marker) {
      fence = { character: marker[1][0], length: marker[1].length };
      return mask(line);
    }
    if (fence) {
      const closing = line.match(/^[ \t]{0,3}(`+|~+)[ \t]*(?:\r?\n)?$/);
      if (closing && closing[1][0] === fence.character && closing[1].length >= fence.length) fence = null;
      return mask(line);
    }
    return line;
  }).join('');
}

function titleIsCentered(markdown) {
  const titleCandidates = [];
  const htmlTitle = /<h1\b([^>]*)>([\s\S]*?)<\/h1\s*>/gi;
  for (const match of markdown.matchAll(htmlTitle)) {
    const centered = /\balign\s*=\s*(?:"center"|'center'|center)(?:\s|$)/i.test(match[1]);
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    titleCandidates.push({ index: match.index, centered: centered && text.length > 0 });
  }

  const markdownTitle = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/gm;
  const centeredRanges = [...markdown.matchAll(/<div\b[^>]*\balign\s*=\s*(?:"center"|'center'|center)[^>]*>[\s\S]*?<\/div\s*>/gi)]
    .map(match => [match.index, match.index + match[0].length]);
  for (const match of markdown.matchAll(markdownTitle)) {
    titleCandidates.push({
      index: match.index,
      centered: match[1].trim().length > 0
        && centeredRanges.some(([start, end]) => start < match.index && match.index < end),
    });
  }
  titleCandidates.sort((left, right) => left.index - right.index);
  return titleCandidates[0]?.centered === true;
}

function sectionBody(markdown, allHeadings, name) {
  const index = allHeadings.findIndex(heading => heading.folded === name.toLocaleLowerCase('en-US'));
  if (index < 0) return null;
  const start = allHeadings[index].end;
  const end = allHeadings[index + 1]?.index ?? markdown.length;
  return markdown.slice(start, end).trim();
}

function linksTo(body, target) {
  if (body === null) return false;
  const links = [...body.matchAll(/\[[^\]]+\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)];
  return links.some(match => match[1].replace(/^\.\//, '') === target);
}

function checkStructure(projectRoot, markdown, license) {
  const corrections = [];
  const structuralMarkdown = markdownStructure(markdown);
  if (!titleIsCentered(structuralMarkdown)) {
    corrections.push('Center the Repository README title in a nonempty HTML h1 or a centered block.');
  }

  const allHeadings = headings(structuralMarkdown);
  const recognized = allHeadings.filter(heading => recognizedSections
    .some(name => name.toLocaleLowerCase('en-US') === heading.folded));
  for (const section of recognizedSections) {
    const occurrences = recognized.filter(heading => heading.folded === section.toLocaleLowerCase('en-US'));
    if (occurrences.length > 1) corrections.push(`Keep only one ${section} section.`);
  }
  let previous = null;
  for (const heading of recognized) {
    const current = recognizedSections.findIndex(name => name.toLocaleLowerCase('en-US') === heading.folded);
    if (previous && current < previous.position) {
      corrections.push(`Move ${recognizedSections[current]} before ${recognizedSections[previous.position]}.`);
      break;
    }
    previous = { position: current, heading };
  }
  const installation = allHeadings.find(heading => heading.folded === 'installation');
  if (installation && allHeadings[0] !== installation) {
    corrections.push(`Move Installation before ${allHeadings[0].name}; it is the first section when present.`);
  }

  const contributing = sectionBody(markdown, allHeadings, 'Contributing');
  if (lstatIsFile(join(projectRoot, 'CONTRIBUTING.md'))) {
    if (contributing === null) corrections.push('Add a Contributing section linking to CONTRIBUTING.md.');
    else if (!linksTo(contributing, 'CONTRIBUTING.md')) corrections.push('Link the Contributing section to CONTRIBUTING.md.');
  }

  const documentation = sectionBody(markdown, allHeadings, 'Documentation');
  if (lstatIsFile(join(projectRoot, 'docs/README.md'))) {
    if (documentation === null) corrections.push('Add a Documentation section linking to docs/README.md.');
    else if (!linksTo(documentation, 'docs/README.md')) corrections.push('Link the Documentation section to docs/README.md.');
  }

  const licenseBody = sectionBody(markdown, allHeadings, 'License');
  if (licenseBody === null) {
    corrections.push(`Add a License section containing only [${license.name}](${license.path}).`);
  } else {
    const match = licenseBody.match(/^\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)$/);
    if (!match) {
      corrections.push('Make the License section contain only the license link.');
    } else {
      if (match[1] !== license.name) corrections.push(`Use the repository license name: name the link “${license.name}”.`);
      if (match[2].replace(/^\.\//, '') !== license.path) corrections.push(`Make the License link target ${license.path}.`);
    }
  }
  return [...new Set(corrections)];
}

function lstatIsFile(path) {
  try {
    return lstatSync(path).isFile();
  } catch {
    return false;
  }
}

try {
  const request = readRequest();
  const readmePath = join(request.projectRoot, 'README.md');
  const markdown = lstatIsFile(readmePath) ? readFileSync(readmePath, 'utf8') : '';
  const license = rootLicense(request.projectRoot);
  if (license.blocked) {
    result('blocked', `Owner clarification required: ${license.blocked}`);
  } else {
    const corrections = checkStructure(request.projectRoot, markdown, license);
    result(
      corrections.length === 0 ? 'passed' : 'failed',
      corrections.length === 0
        ? 'Repository README structure is valid; factual content still requires maintainer or agent review.'
        : `Repository README structure needs correction: ${corrections.join(' ')}`,
    );
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
