'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');

const TLP_DIR = path.join(os.homedir(), '.tracklistplayer');
const LIBRARY_FILE = path.join(TLP_DIR, 'library.json');

let _libraryCache = null;
let libraryIndexCache = null;

function readLibrary() {
  if (_libraryCache !== null) return _libraryCache;
  try { _libraryCache = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8')); }
  catch (_) { _libraryCache = []; }
  return _libraryCache;
}

function writeLibrary(folders) {
  _libraryCache = folders; // update cache immediately
  try { fs.mkdirSync(TLP_DIR, { recursive: true, mode: 0o700 }); } catch (_) {}
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

router.get('/api/library', (_req, res) => res.json({ folders: readLibrary() }));

router.post('/api/library', (req, res) => {
  const { folder } = req.body || {};
  if (!folder) return res.status(400).json({ error: 'folder required' });
  const lib = readLibrary();
  if (!lib.includes(folder)) { lib.push(folder); writeLibrary(lib); }
  libraryIndexCache = null;
  res.json({ folders: lib });
});

router.delete('/api/library', (req, res) => {
  const { folder } = req.body || {};
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
    console.error('[library-index]', err);
    res.status(500).json({ error: 'Failed to build library index' });
  }
});

module.exports = router;
module.exports.readLibrary = readLibrary;
module.exports.TLP_DIR = TLP_DIR;
module.exports.LIBRARY_FILE = LIBRARY_FILE;
module.exports.invalidateLibraryIndex = invalidateLibraryIndex;
