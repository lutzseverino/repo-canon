import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from '../vendor/marked/marked.esm.js';
import { parseFragment } from '../vendor/parse5/parse5.esm.js';

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
const renderedElementsWithoutText = new Set([
  'audio', 'canvas', 'embed', 'hr', 'iframe', 'img', 'input', 'math', 'object', 'picture', 'svg', 'video',
]);
const nonRenderedElements = new Set(['script', 'style', 'template']);

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

function attribute(node, name) {
  return node.attrs?.find(candidate => candidate.name === name)?.value ?? null;
}

function isHidden(node) {
  return nonRenderedElements.has(node.tagName) || attribute(node, 'hidden') !== null;
}

function rootLicense(projectRoot) {
  const candidates = readdirSync(projectRoot, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^license(?:[._-].+)?$/i.test(entry.name))
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

function renderedText(node) {
  if (node.nodeName === '#text') return node.value;
  if (isHidden(node)) return '';
  if (node.tagName === 'img') return attribute(node, 'alt') ?? '';
  return (node.childNodes ?? []).map(renderedText).join('');
}

function containsHeading(node) {
  if (isHidden(node)) return false;
  return (node.childNodes ?? []).some(child => /^h[1-6]$/.test(child.tagName) || containsHeading(child));
}

function renderedStructure(markdown) {
  const events = [];
  const visit = (node, centered = false) => {
    if (isHidden(node)) return;
    if (node.nodeName === '#text') {
      if (node.value.trim()) events.push({ type: 'text', text: node.value });
      return;
    }

    const ownCenter = attribute(node, 'align')?.toLocaleLowerCase('en-US') === 'center';
    if (/^h[1-6]$/.test(node.tagName)) {
      const name = renderedText(node).trim();
      if (name) events.push({
        type: 'heading',
        level: Number(node.tagName[1]),
        name,
        centered: ownCenter || centered,
        folded: name.toLocaleLowerCase('en-US'),
      });
      return;
    }
    if (node.tagName === 'a') {
      events.push({ type: 'link', label: renderedText(node).trim(), target: attribute(node, 'href') ?? '' });
      if (containsHeading(node)) {
        for (const child of node.childNodes ?? []) visit(child, centered);
      }
      return;
    }
    if (renderedElementsWithoutText.has(node.tagName)) {
      events.push({ type: 'content' });
    }
    const insideCenter = centered || (node.tagName === 'div' && ownCenter);
    for (const child of node.childNodes ?? []) visit(child, insideCenter);
  };
  visit(parseFragment(marked.parse(markdown)));
  return events;
}

function sectionEvents(events, allHeadings, name) {
  const index = allHeadings.findIndex(heading => heading.folded === name.toLocaleLowerCase('en-US'));
  if (index < 0) return null;
  const start = events.indexOf(allHeadings[index]) + 1;
  const end = events.findIndex((event, eventIndex) => eventIndex >= start
    && event.type === 'heading' && event.level <= allHeadings[index].level);
  return events.slice(start, end < 0 ? events.length : end);
}

function localPath(target) {
  try {
    if (/^(?:[a-z][a-z+.-]*:|\/|\\)/i.test(target)) return null;
    const base = new URL('https://repository.invalid/project/');
    const destination = new URL(target, base);
    const rootPath = base.pathname;
    return destination.origin === base.origin && destination.pathname.startsWith(rootPath)
      ? destination.pathname.slice(rootPath.length)
      : null;
  } catch {
    return null;
  }
}

function singleLink(events) {
  return events.length === 1 && events[0].type === 'link' ? events[0] : null;
}

function linksTo(events, target) {
  if (events === null) return false;
  return events.some(event => event.type === 'link'
    && event.label && localPath(event.target) === target);
}

function checkNavigationLink(projectRoot, events, allHeadings, section, target, corrections) {
  if (!lstatIsFile(join(projectRoot, target))) return;
  const body = sectionEvents(events, allHeadings, section);
  if (body === null) corrections.push(`Add a ${section} section linking to ${target}.`);
  else if (!linksTo(body, target)) corrections.push(`Link the ${section} section to ${target}.`);
}

function checkStructure(projectRoot, markdown, license) {
  if (markdown === null) return ['Create the root README.md.'];
  const corrections = [];
  const events = renderedStructure(markdown);
  const parsedHeadings = events.filter(event => event.type === 'heading');
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

  checkNavigationLink(projectRoot, events, allHeadings, 'Contributing', 'CONTRIBUTING.md', corrections);
  checkNavigationLink(projectRoot, events, allHeadings, 'Documentation', 'docs/README.md', corrections);

  const licenseBody = sectionEvents(events, allHeadings, 'License');
  if (license && licenseBody === null) {
    corrections.push(`Add a License section containing only [actual license name](${license.path}).`);
  } else if (license) {
    const link = singleLink(licenseBody);
    if (!link) {
      corrections.push('Make the License section contain only the license link.');
    } else {
      if (!link.label) corrections.push('Name the License link for the actual repository license.');
      if (localPath(link.target) !== license.path) corrections.push(`Make the License link target ${license.path}.`);
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
