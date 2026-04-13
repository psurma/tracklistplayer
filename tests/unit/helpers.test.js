'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  resolveAndValidate,
  serverEscapeHtml,
  BoundedMap,
  ensureFreshToken,
} = require('../../lib/helpers');

// ---- resolveAndValidate ----

describe('resolveAndValidate', () => {
  it('returns resolved path within root', () => {
    const result = resolveAndValidate('/music/album/track.mp3', ['/music']);
    assert.equal(result, '/music/album/track.mp3');
  });

  it('returns null for path outside root', () => {
    const result = resolveAndValidate('/etc/passwd', ['/music']);
    assert.equal(result, null);
  });

  it('returns null for null input', () => {
    assert.equal(resolveAndValidate(null, ['/music']), null);
  });

  it('returns null for empty string input', () => {
    assert.equal(resolveAndValidate('', ['/music']), null);
  });

  it('returns null for empty roots array', () => {
    assert.equal(resolveAndValidate('/music/track.mp3', []), null);
  });

  it('returns null when allowedRoots is undefined', () => {
    assert.equal(resolveAndValidate('/music/track.mp3', undefined), null);
  });

  it('blocks path traversal attempts', () => {
    const result = resolveAndValidate('/music/../etc/passwd', ['/music']);
    assert.equal(result, null);
  });

  it('accepts path matching root exactly', () => {
    const result = resolveAndValidate('/music', ['/music']);
    assert.equal(result, '/music');
  });

  it('accepts path when any root matches', () => {
    const result = resolveAndValidate('/videos/clip.mp4', ['/music', '/videos']);
    assert.equal(result, '/videos/clip.mp4');
  });
});

// ---- serverEscapeHtml ----

describe('serverEscapeHtml', () => {
  it('escapes ampersand', () => {
    assert.equal(serverEscapeHtml('a&b'), 'a&amp;b');
  });

  it('escapes less-than', () => {
    assert.equal(serverEscapeHtml('<script>'), '&lt;script&gt;');
  });

  it('escapes greater-than', () => {
    assert.equal(serverEscapeHtml('a>b'), 'a&gt;b');
  });

  it('escapes double quotes', () => {
    assert.equal(serverEscapeHtml('"hello"'), '&quot;hello&quot;');
  });

  it('handles empty string', () => {
    assert.equal(serverEscapeHtml(''), '');
  });

  it('converts numbers to string', () => {
    assert.equal(serverEscapeHtml(42), '42');
  });

  it('escapes multiple special chars in one string', () => {
    assert.equal(serverEscapeHtml('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
  });
});

// ---- BoundedMap ----

describe('BoundedMap', () => {
  it('stores and retrieves values', () => {
    const m = new BoundedMap(3);
    m.set('a', 1);
    assert.equal(m.get('a'), 1);
  });

  it('respects max size by evicting oldest', () => {
    const m = new BoundedMap(2);
    m.set('a', 1);
    m.set('b', 2);
    m.set('c', 3);
    assert.equal(m.has('a'), false);
    assert.equal(m.get('b'), 2);
    assert.equal(m.get('c'), 3);
    assert.equal(m.size, 2);
  });

  it('refreshes position on re-set', () => {
    const m = new BoundedMap(2);
    m.set('a', 1);
    m.set('b', 2);
    m.set('a', 10); // refresh a -- b is now oldest
    m.set('c', 3);  // should evict b, not a
    assert.equal(m.has('b'), false);
    assert.equal(m.get('a'), 10);
    assert.equal(m.get('c'), 3);
  });

  it('returns the map from set() for chaining', () => {
    const m = new BoundedMap(5);
    const ret = m.set('x', 1);
    assert.equal(ret, m);
  });
});

// ---- ensureFreshToken ----

describe('ensureFreshToken', () => {
  it('returns config when token is not expired', async () => {
    const config = { access_token: 'tok', expires_at: Date.now() + 300000 };
    const result = await ensureFreshToken(config, () => { throw new Error('should not call'); });
    assert.equal(result, config);
  });

  it('returns config when expires_at is missing', async () => {
    const config = { access_token: 'tok' };
    const result = await ensureFreshToken(config, () => { throw new Error('should not call'); });
    assert.equal(result, config);
  });

  it('calls refreshFn when token is expired', async () => {
    const config = { access_token: 'old', expires_at: Date.now() - 1000 };
    const newConfig = { access_token: 'new', expires_at: Date.now() + 300000 };
    const result = await ensureFreshToken(config, () => Promise.resolve(newConfig));
    assert.equal(result, newConfig);
  });

  it('calls refreshFn when token expires within 60s', async () => {
    const config = { access_token: 'old', expires_at: Date.now() + 30000 };
    const newConfig = { access_token: 'new', expires_at: Date.now() + 300000 };
    const result = await ensureFreshToken(config, () => Promise.resolve(newConfig));
    assert.equal(result, newConfig);
  });

  it('returns original config when refreshFn fails', async () => {
    const config = { access_token: 'old', expires_at: Date.now() - 1000 };
    const result = await ensureFreshToken(config, () => Promise.reject(new Error('network error')));
    assert.equal(result, config);
  });
});
