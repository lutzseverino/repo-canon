import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from '../vendor/marked/marked.esm.js';

const resultFormat = 'repo-standards/result/v1';
const centerAttribute = /\balign\s*=\s*(?:"center"|'center'|center(?=[ \t]|$))/i;
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

function decodeEntities(value) {
  const namedWhitespace = { nbsp: '\u00a0', ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009' };
  return value
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (entity, hexadecimal, decimal) => {
      const codePoint = Number.parseInt(hexadecimal ?? decimal, hexadecimal ? 16 : 10);
      return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
    })
    .replace(/&(nbsp|ensp|emsp|thinsp);/gi, (_, name) => namedWhitespace[name.toLowerCase()]);
}

function inlineText(tokens) {
  const text = tokens.map(token => {
    if (Array.isArray(token.tokens)) return inlineText(token.tokens);
    if (token.type === 'html') return token.text.replace(/<[^>]*>/g, '');
    return typeof token.text === 'string' ? token.text : '';
  }).join('');
  return decodeEntities(text);
}

function renderedText(value) {
  return inlineText(marked.Lexer.lexInline(value)).trim();
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
  if (!readFileSync(join(projectRoot, path), 'utf8').trim()) {
    return { blocked: `${path} is empty and does not establish repository licensing.` };
  }
  return { path };
}

function htmlHeadings(markdown, tokenIndex) {
  const found = [];
  const centeredRanges = [...markdown.matchAll(/<div\b([^>]*)>[\s\S]*?<\/div\s*>/gi)]
    .filter(match => centerAttribute.test(match[1]))
    .map(match => [match.index, match.index + match[0].length, match[0]]);
  const isCentered = (index, attributes = '') => (
    centerAttribute.test(attributes)
      || centeredRanges.some(([start, end]) => start < index && index < end)
  );
  const html = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1\s*>/gi;
  for (const match of markdown.matchAll(html)) {
    const name = renderedText(match[3]);
    if (!name) continue;
    found.push({ level: Number(match[1]), name, tokenIndex, offset: match.index, centered: isCentered(match.index, match[2]) });
  }
  for (const [start, , range] of centeredRanges) {
    const openingEnd = range.indexOf('>') + 1;
    const closingStart = range.toLocaleLowerCase('en-US').lastIndexOf('</div');
    const inner = range.slice(openingEnd, closingStart);
    for (const token of marked.lexer(inner)) {
      if (token.type !== 'heading') continue;
      const name = inlineText(token.tokens).trim();
      if (name) found.push({ level: token.depth, name, tokenIndex, offset: start + openingEnd, centered: true });
    }
  }
  return found;
}

function headings(tokens) {
  const found = [];
  let centeredBlocks = 0;
  tokens.forEach((token, tokenIndex) => {
    if (token.type === 'heading') {
      const name = inlineText(token.tokens).trim();
      if (name) found.push({ level: token.depth, name, tokenIndex, offset: 0, centered: centeredBlocks > 0 });
    } else if (token.type === 'html') {
      found.push(...htmlHeadings(token.raw, tokenIndex));
      const centeredOpenings = [...token.raw.matchAll(/<div\b([^>]*)>/gi)]
        .filter(match => centerAttribute.test(match[1])).length;
      const closings = [...token.raw.matchAll(/<\/div\s*>/gi)].length;
      centeredBlocks = Math.max(0, centeredBlocks + centeredOpenings - closings);
    }
  });
  return found
    .sort((left, right) => left.tokenIndex - right.tokenIndex || left.offset - right.offset)
    .map(heading => ({ ...heading, folded: heading.name.toLocaleLowerCase('en-US') }));
}

function sectionTokens(tokens, allHeadings, name) {
  const index = allHeadings.findIndex(heading => heading.folded === name.toLocaleLowerCase('en-US'));
  if (index < 0) return null;
  const start = allHeadings[index].tokenIndex + 1;
  const nextSection = allHeadings.slice(index + 1)
    .find(heading => heading.level <= allHeadings[index].level);
  const end = nextSection?.tokenIndex ?? tokens.length;
  return tokens.slice(start, end);
}

function normalizeTarget(target) {
  return target.replace(/^\.\//, '');
}

function linksIn(token) {
  if (token.type === 'link') return [token];
  const children = [token.tokens, token.items].filter(Array.isArray).flat();
  return children.flatMap(linksIn);
}

function singleMarkdownLink(tokens) {
  const meaningful = tokens.filter(token => !['space', 'def'].includes(token.type));
  if (meaningful.length !== 1 || meaningful[0].type !== 'paragraph') return null;
  const inline = meaningful[0].tokens.filter(token => token.type !== 'text' || token.text.trim());
  if (inline.length !== 1 || inline[0].type !== 'link') return null;
  return { label: inlineText(inline[0].tokens).trim(), target: inline[0].href };
}

function linksTo(tokens, target) {
  if (tokens === null) return false;
  return tokens.flatMap(linksIn).some(link => normalizeTarget(link.href).split('#')[0] === target);
}

function checkNavigationLink(projectRoot, tokens, allHeadings, section, target, corrections) {
  if (!lstatIsFile(join(projectRoot, target))) return;
  const body = sectionTokens(tokens, allHeadings, section);
  if (body === null) corrections.push(`Add a ${section} section linking to ${target}.`);
  else if (!linksTo(body, target)) corrections.push(`Link the ${section} section to ${target}.`);
}

function checkStructure(projectRoot, markdown, license) {
  if (markdown === null) return ['Create the root README.md.'];
  const corrections = [];
  const tokens = marked.lexer(markdown);
  const parsedHeadings = headings(tokens);
  const title = parsedHeadings.find(heading => heading.level === 1) ?? null;
  if (!title?.centered) {
    corrections.push('Center the Repository README title in a nonempty HTML h1 or a centered block.');
  }

  const allHeadings = parsedHeadings.filter(heading => heading !== title);
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

  checkNavigationLink(projectRoot, tokens, allHeadings, 'Contributing', 'CONTRIBUTING.md', corrections);
  checkNavigationLink(projectRoot, tokens, allHeadings, 'Documentation', 'docs/README.md', corrections);

  const licenseBody = sectionTokens(tokens, allHeadings, 'License');
  if (license && licenseBody === null) {
    corrections.push(`Add a License section containing only [actual license name](${license.path}).`);
  } else if (license) {
    const link = singleMarkdownLink(licenseBody);
    if (!link) {
      corrections.push('Make the License section contain only the license link.');
    } else {
      if (!link.label) corrections.push('Name the License link for the actual repository license.');
      if (normalizeTarget(link.target) !== license.path) corrections.push(`Make the License link target ${license.path}.`);
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
