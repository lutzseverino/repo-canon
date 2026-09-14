Object.defineProperty(process.versions, 'node', {
  configurable: true,
  enumerable: true,
  value: process.env.FAKE_NODE_VERSION,
});
