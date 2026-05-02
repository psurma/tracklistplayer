'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { withTimeout } = require('../../lib/helpers');

describe('withTimeout', () => {
  it('returns the original value if the promise resolves in time', async () => {
    const r = await withTimeout(Promise.resolve('ok'), 500, 'fallback');
    assert.equal(r, 'ok');
  });

  it('returns the fallback if the promise hangs past the timeout', async () => {
    const r = await withTimeout(new Promise(() => {}), 50, null);
    assert.equal(r, null);
  });

  it('lets a fast resolve win over the timeout', async () => {
    const r = await withTimeout(
      new Promise((res) => setTimeout(() => res('quick'), 5)),
      100,
      'fallback'
    );
    assert.equal(r, 'quick');
  });
});
