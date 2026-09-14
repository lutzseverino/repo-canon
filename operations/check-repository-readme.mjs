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
    .filter(entry => entry.isFile() && /^license(?:\.(?:md|txt|rst))?$/i.test(entry.name))
    .map(entry => entry.name);
  if (!candidates.includes('LICENSE')) {
    const detail = candidates.length > 0 ? ` Found ${candidates.sort().join(', ')} instead.` : '';
    return { blocked: `No root LICENSE file was found; identify the repository license and use the required filename.${detail}` };
  }
  if (candidates.length > 1) {
    return { blocked: `Multiple root LICENSE variants were found (${candidates.sort().join(', ')}); identify which license applies and keep it in LICENSE.` };
  }

  const path = 'LICENSE';
  const firstLine = readFileSync(join(projectRoot, path), 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(Boolean);
  const name = firstLine
    ?.replace(/^#{1,6}\s+/, '')
    .replace(/^<h[1-6][^>]*>|<\/h[1-6]>$/gi, '')
    .trim();
  if (!name) {
    return { blocked: `${path} does not identify a license name in its first nonempty line.` };
  }
  return { path, name };
}

function headings(markdown) {
  const found = [];
  const record = (level, name, index, end, centered) => found.push({
    level,
    name,
    folded: name.toLocaleLowerCase('en-US'),
    index,
    end,
    centered,
  });
  const centeredRanges = [...markdown.matchAll(/<div\b[^>]*\balign\s*=\s*(?:"center"|'center'|center)[^>]*>[\s\S]*?<\/div\s*>/gi)]
    .map(match => [match.index, match.index + match[0].length]);
  const isCentered = (index, attributes = '') => (
    /\balign\s*=\s*(?:"center"|'center'|center)(?:\s|$)/i.test(attributes)
      || centeredRanges.some(([start, end]) => start < index && index < end)
  );
  const atx = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/gm;
  for (const match of markdown.matchAll(atx)) {
    const name = match[2].trim();
    record(match[1].length, name, match.index, match.index + match[0].length, isCentered(match.index));
  }
  const html = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1\s*>/gi;
  for (const match of markdown.matchAll(html)) {
    const name = match[3].replace(/<[^>]*>/g, '').trim();
    if (!name) continue;
    record(Number(match[1]), name, match.index, match.index + match[0].length, isCentered(match.index, match[2]));
  }
  const setext = /^[ \t]{0,3}([^\r\n]+?)[ \t]*\r?\n[ \t]{0,3}(=+|-+)[ \t]*(?:\r?\n|$)/gm;
  for (const match of markdown.matchAll(setext)) {
    const name = match[1].trim();
    record(match[2][0] === '=' ? 1 : 2, name, match.index, match.index + match[0].length, isCentered(match.index));
  }
  return found.sort((left, right) => left.index - right.index);
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

function sectionBody(markdown, allHeadings, name) {
  const index = allHeadings.findIndex(heading => heading.folded === name.toLocaleLowerCase('en-US'));
  if (index < 0) return null;
  const start = allHeadings[index].end;
  const nextSection = allHeadings.slice(index + 1)
    .find(heading => heading.level <= allHeadings[index].level);
  const end = nextSection?.index ?? markdown.length;
  return markdown.slice(start, end).trim();
}

function linksTo(body, target) {
  if (body === null) return false;
  const links = [...body.matchAll(/\[[^\]]+\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)];
  return links.some(match => match[1].replace(/^\.\//, '') === target);
}

function checkNavigationLink(projectRoot, markdown, allHeadings, section, target, corrections) {
  if (!lstatIsFile(join(projectRoot, target))) return;
  const body = sectionBody(markdown, allHeadings, section);
  if (body === null) corrections.push(`Add a ${section} section linking to ${target}.`);
  else if (!linksTo(body, target)) corrections.push(`Link the ${section} section to ${target}.`);
}

function checkStructure(projectRoot, markdown, license) {
  if (markdown === null) return ['Create the root README.md.'];
  const corrections = [];
  const structuralMarkdown = markdownStructure(markdown);
  const parsedHeadings = headings(structuralMarkdown);
  const title = parsedHeadings.find(heading => heading.level === 1) ?? null;
  if (!title?.centered) {
    corrections.push('Center the Repository README title in a nonempty HTML h1 or a centered block.');
  }

  const allHeadings = parsedHeadings.filter(heading => heading.index !== title?.index);
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

  checkNavigationLink(projectRoot, structuralMarkdown, allHeadings, 'Contributing', 'CONTRIBUTING.md', corrections);
  checkNavigationLink(projectRoot, structuralMarkdown, allHeadings, 'Documentation', 'docs/README.md', corrections);

  const licenseBody = sectionBody(structuralMarkdown, allHeadings, 'License');
  if (license && licenseBody === null) {
    corrections.push(`Add a License section containing only [${license.name}](${license.path}).`);
  } else if (license) {
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
  const markdown = lstatIsFile(readmePath) ? readFileSync(readmePath, 'utf8') : null;
  const license = rootLicense(request.projectRoot);
  const corrections = checkStructure(request.projectRoot, markdown, license.blocked ? null : license);
  if (license.blocked) {
    const otherCorrections = corrections.length > 0
      ? ` Other structural corrections: ${corrections.join(' ')}`
      : '';
    result('blocked', `Owner clarification required: ${license.blocked}${otherCorrections}`);
  } else {
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
