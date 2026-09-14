import { marked } from '../../vendor/marked/marked.esm.js';
import { parseFragment } from '../../vendor/parse5/parse5.esm.js';
import { lstatSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, posix, relative, sep } from 'node:path';

const renderedElementsWithoutText = new Set([
  'audio', 'canvas', 'embed', 'hr', 'iframe', 'img', 'input', 'math', 'object', 'picture', 'svg', 'video',
]);
const nonRenderedElements = new Set(['script', 'style', 'template']);

function attribute(node, name) {
  return node.attrs?.find(candidate => candidate.name === name)?.value ?? null;
}

function isHidden(node) {
  return nonRenderedElements.has(node.tagName) || attribute(node, 'hidden') !== null;
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

export function renderedMarkdown(markdown) {
  const events = [];
  const visitTargets = node => {
    if (isHidden(node)) return;
    if (node.tagName === 'a') {
      events.push({
        type: 'link',
        text: renderedText(node).trim(),
        target: attribute(node, 'href') ?? '',
        insideHeading: true,
      });
    } else if (node.tagName === 'img') {
      events.push({
        type: 'image',
        text: attribute(node, 'alt') ?? '',
        target: attribute(node, 'src') ?? '',
        insideHeading: true,
      });
      return;
    }
    for (const child of node.childNodes ?? []) visitTargets(child);
  };
  const visit = (node, centered = false) => {
    if (isHidden(node)) return;
    if (node.nodeName === '#text') {
      if (node.value.trim()) events.push({ type: 'text', text: node.value });
      return;
    }

    const ownCenter = attribute(node, 'align')?.toLocaleLowerCase('en-US') === 'center';
    if (/^h[1-6]$/.test(node.tagName)) {
      const text = renderedText(node).trim();
      if (text) events.push({
        type: 'heading',
        level: Number(node.tagName[1]),
        name: text,
        text,
        centered: ownCenter || centered,
        folded: text.toLocaleLowerCase('en-US'),
      });
      for (const child of node.childNodes ?? []) visitTargets(child);
      return;
    }
    if (node.tagName === 'a') {
      events.push({ type: 'link', text: renderedText(node).trim(), target: attribute(node, 'href') ?? '' });
      if (containsHeading(node)) {
        for (const child of node.childNodes ?? []) visit(child, centered);
      }
      return;
    }
    if (node.tagName === 'img') {
      events.push({ type: 'image', text: attribute(node, 'alt') ?? '', target: attribute(node, 'src') ?? '' });
      return;
    }
    if (renderedElementsWithoutText.has(node.tagName)) events.push({ type: 'content' });
    const insideCenter = centered || (node.tagName === 'div' && ownCenter);
    for (const child of node.childNodes ?? []) visit(child, insideCenter);
  };
  visit(parseFragment(marked.parse(markdown)));
  return events;
}

export function resolvedLocalPath(sourcePath, target) {
  if (/^(?:[a-z][a-z+.-]*:|\/|\\)/i.test(target)) return null;
  try {
    const root = new URL('https://repository.invalid/project/');
    const source = new URL(sourcePath, root);
    const destination = new URL(target, source);
    if (destination.origin !== root.origin) return null;
    if (!destination.pathname.startsWith(root.pathname)) return undefined;
    const decoded = decodeURIComponent(destination.pathname.slice(root.pathname.length));
    if (decoded.includes('\\')) return undefined;
    const normalized = posix.normalize(decoded);
    if (posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) return undefined;
    return normalized;
  } catch {
    return undefined;
  }
}

function pathExists(projectRoot, path) {
  try {
    const root = realpathSync(projectRoot);
    let current = root;
    const segments = path.split('/');
    for (const [index, segment] of segments.entries()) {
      if (!readdirSync(current).includes(segment)) return false;
      const candidate = join(current, segment);
      const entry = lstatSync(candidate);
      current = entry.isSymbolicLink() ? realpathSync(candidate) : candidate;
      const fromRoot = relative(root, current);
      if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) return false;
      if (index < segments.length - 1 && !statSync(current).isDirectory()) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function brokenLocalLinks(projectRoot, sourcePath, events) {
  const broken = [];
  for (const event of events) {
    if (!['link', 'image'].includes(event.type)) continue;
    const path = resolvedLocalPath(sourcePath, event.target);
    if (path === null || (path !== undefined && pathExists(projectRoot, path))) continue;
    broken.push({ target: event.target, path });
  }
  return broken;
}
