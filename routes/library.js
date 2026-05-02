'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const { TLP_DIR } = require('../lib/oauth-helpers');
const { logError, logWarn } = require('../lib/logger');
const LIBRARY_FILE = path.join(TLP_DIR, 'library.json');

let _libraryCache = null;
let libraryIndexCache = null;

function readLibrary() {
  if (_libraryCache !== null) return _libraryCache;
  try { _libraryCache = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8')); }
  catch (err) {
    if (err.code !== 'ENOENT') logWarn('library', err, 'failed to read library file');
    _libraryCache = [];
  }
  return _libraryCache;
}

function writeLibrary(folders) {
  _libraryCache = folders; // update cache immediately
  try { fs.mkdirSync(TLP_DIR, { recursive: true, mode: 0o700 }); }
  catch (err) { logWarn('library', err, 'mkdir TLP_DIR'); }
  fs.writeFileSync(LIBRARY_FILE, JSON.stringify(folders));
}

function invalidateLibraryIndex() {
  libraryIndexCache = null;
}

// Lazy-loaded to avoid circular dependency — buildMusicIndex lives in routes/music-index.js
let _buildMusicIndex = null;
function getBuildMusicIndex() {
  if (!_buildMusicIndex) {
    _buildMusicIndex = require('./music-index')._buildMusicIndex;
  }
  return _buildMusicIndex;
}

// Validate that a candidate library folder is safe to add:
//   - non-empty string
//   - absolute path (no relative ../traversal tricks)
//   - exists and is a directory
//   - lives under the user's home directory (defense against an attacker
//     persuading us to register `/` and exfiltrating arbitrary files)
async function validateLibraryFolder(folder) {
  if (typeof folder !== 'string' || !folder.trim()) return { ok: false, code: 400, error: 'folder required' };
  if (!path.isAbsolute(folder)) return { ok: false, code: 400, error: 'folder must be an absolute path' };

  const resolved = path.resolve(folder);
  const home = path.resolve(os.homedir());
  if (resolved !== home && !resolved.startsWith(home + path.sep)) {
    return { ok: false, code: 403, error: 'folder must be under your home directory' };
  }
  let stat;
  try { stat = await fs.promises.stat(resolved); }
  catch (_) { return { ok: false, code: 404, error: 'folder does not exist' }; }
  if (!stat.isDirectory()) return { ok: false, code: 400, error: 'folder is not a directory' };
  return { ok: true, resolved };
}

router.get('/api/library', (_req, res) => res.json({ folders: readLibrary() }));

router.post('/api/library', async (req, res) => {
  const v = await validateLibraryFolder((req.body || {}).folder);
  if (!v.ok) return res.status(v.code).json({ error: v.error });
  const lib = readLibrary();
  if (!lib.includes(v.resolved)) { lib.push(v.resolved); writeLibrary(lib); }
  libraryIndexCache = null;
  res.json({ folders: lib });
});

router.delete('/api/library', (req, res) => {
  const { folder } = req.body || {};
  if (typeof folder !== 'string' || !folder) return res.status(400).json({ error: 'folder required' });
  const lib = readLibrary().filter((f) => f !== folder);
  writeLibrary(lib);
  libraryIndexCache = null;
  res.json({ folders: lib });
});

router.get('/api/library-index', async (req, res) => {
  if (!req.query.bust && libraryIndexCache) return res.json(libraryIndexCache);
  const folders = readLibrary();
  if (!folders.length) return res.json([]);
  try {
    const buildMusicIndex = getBuildMusicIndex();
    const results = await Promise.all(folders.map((f) => buildMusicIndex(f)));
    libraryIndexCache = results.flat();
    res.json(libraryIndexCache);
  } catch (err) {
    logError('library-index', err);
    res.status(500).json({ error: 'Failed to build library index' });
  }
});

module.exports = router;
module.exports.readLibrary = readLibrary;
module.exports.LIBRARY_FILE = LIBRARY_FILE;
module.exports.invalidateLibraryIndex = invalidateLibraryIndex;
module.exports.validateLibraryFolder = validateLibraryFolder;
