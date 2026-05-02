'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Avoid importing the full library router (which loads helpers, music-index,
// etc.). Re-exec the module fresh and read the exported validator.
const { validateLibraryFolder } = require('../../routes/library');

describe('validateLibraryFolder', () => {
  const home = os.homedir();

  it('rejects empty / non-string input', async () => {
    assert.equal((await validateLibraryFolder('')).ok, false);
    assert.equal((await validateLibraryFolder(null)).ok, false);
    assert.equal((await validateLibraryFolder(undefined)).ok, false);
    assert.equal((await validateLibraryFolder(123)).ok, false);
  });

  it('rejects relative paths', async () => {
    const r = await validateLibraryFolder('./music');
    assert.equal(r.ok, false);
    assert.equal(r.code, 400);
  });

  it('rejects paths outside the user home', async () => {
    const r = await validateLibraryFolder('/etc');
    assert.equal(r.ok, false);
    assert.equal(r.code, 403);
  });

  it('rejects non-existent paths under home', async () => {
    const r = await validateLibraryFolder(path.join(home, 'definitely-does-not-exist-xyz-123'));
    assert.equal(r.ok, false);
    assert.equal(r.code, 404);
  });

  it('accepts an existing directory under home', async () => {
    const r = await validateLibraryFolder(home);
    assert.equal(r.ok, true);
    assert.equal(r.resolved, path.resolve(home));
  });

  it('rejects a file (not a directory) under home', async () => {
    const tmp = path.join(home, `.tlp-test-${Date.now()}.tmp`);
    fs.writeFileSync(tmp, 'x');
    try {
      const r = await validateLibraryFolder(tmp);
      assert.equal(r.ok, false);
      assert.equal(r.code, 400);
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});
