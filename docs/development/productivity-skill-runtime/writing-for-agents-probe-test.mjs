import assert from 'node:assert/strict';
import { test } from 'node:test';

const northstarSupplier = {
  name: 'Northstar',
  website: 'https://northstar.example',
};

test('fixture is runnable', () => assert.equal(1, 1));

test('Northstar supplier fixture is runnable', () => {
  assert.equal(northstarSupplier.website, 'https://northstar.example');
});
