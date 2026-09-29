import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interpretMarkdown, markdownInlineText, markdownTokenSpans } from '../operations/lib/rendered-markdown.mjs';
import { lexer } from '../vendor/marked/marked.esm.js';

function shape(blocks) {
  return blocks.map(block => ({
    tag: block.tag,
    text: block.text,
    links: block.links.map(link => link.target),
    blocks: shape(block.blocks),
  }));
}

function section(document, name) {
  return document.headings.find(heading => heading.folded === name).body;
}

test('each heading section exposes its ordered top-level blocks', () => {
  const document = interpretMarkdown(`# Harbor

## Usage

Read [the guide](guide.md) first.

- [Queues](queues.md)
- Topics

<div align="center"><p><a href="status.md">Status</a></p></div>

### Details

## License
`);
  const usage = section(document, 'usage');

  assert.deepEqual(shape(usage.blocks), [
    { tag: 'p', text: 'Read the guide first.', links: ['guide.md'], blocks: [] },
    {
      tag: 'ul',
      text: 'Queues\nTopics',
      links: ['queues.md'],
      blocks: [
        { tag: 'li', text: 'Queues', links: ['queues.md'], blocks: [] },
        { tag: 'li', text: 'Topics', links: [], blocks: [] },
      ],
    },
    {
      tag: 'div',
      text: 'Status',
      links: ['status.md'],
      blocks: [{ tag: 'p', text: 'Status', links: ['status.md'], blocks: [] }],
    },
    { tag: 'h3', text: 'Details', links: [], blocks: [] },
  ]);
  assert.equal(usage.blocks[0].links[0], usage.elements.find(element => element.target === 'guide.md'),
    'block links are the section elements themselves');
  assert.deepEqual(section(document, 'license').blocks, []);
});

test('section blocks hold only the section content of a block they share', () => {
  const document = interpretMarkdown(`<div>

## Contributing

[Guide](CONTRIBUTING.md)

## License

[MIT License](LICENSE)

</div>
`);

  assert.deepEqual(shape(section(document, 'contributing').blocks), [{
    tag: 'div',
    text: 'Guide',
    links: ['CONTRIBUTING.md'],
    blocks: [{ tag: 'p', text: 'Guide', links: ['CONTRIBUTING.md'], blocks: [] }],
  }]);
  assert.deepEqual(shape(section(document, 'license').blocks), [{
    tag: 'div',
    text: 'MIT License',
    links: ['LICENSE'],
    blocks: [{ tag: 'p', text: 'MIT License', links: ['LICENSE'], blocks: [] }],
  }]);
});

test('section blocks omit hidden and empty blocks and heading-owned links', () => {
  const document = interpretMarkdown(`## Contributing

<p hidden>Hidden</p>

<div></div>

[Guide](CONTRIBUTING.md) <a href="#license">

## License

</a>

[MIT License](LICENSE)
`);

  assert.deepEqual(shape(section(document, 'contributing').blocks), [
    { tag: 'p', text: 'Guide', links: ['CONTRIBUTING.md'], blocks: [] },
  ]);
});

test('section blocks include a non-div block the section shares with its heading', () => {
  const document = interpretMarkdown('> ## Summary\n>\n> Quoted [link](a.md).\n');

  assert.deepEqual(shape(section(document, 'summary').blocks), [{
    tag: 'blockquote',
    text: 'Quoted link.',
    links: ['a.md'],
    blocks: [{ tag: 'p', text: 'Quoted link.', links: ['a.md'], blocks: [] }],
  }]);
});

test('exports the Markdown token-span and inline-text helpers', () => {
  const markdown = '# Title\n\nSome **bold `code`** <b>html</b>.\n';
  const spans = markdownTokenSpans(markdown, lexer(markdown));

  assert.deepEqual(spans.map(({ token, index }) => [token.type, index]), [
    ['heading', 0],
    ['space', 7],
    ['paragraph', 9],
  ]);
  assert.equal(markdownInlineText(spans[2].token.tokens), 'Some bold code html.');
  assert.deepEqual(markdownTokenSpans(markdown.replace(/\n/g, '\r\n')).map(({ index }) => index), [0, 7, 9],
    'indexes refer to the Markdown with normalized line endings');
  assert.throws(() => markdownTokenSpans('abc', [{ raw: 'xyz' }]), /Could not locate parsed Markdown token after offset 0/);
});
