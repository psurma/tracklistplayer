'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { resolveAndValidate } = require('../lib/helpers');
const { readLibrary } = require('./library');
const { TLP_DIR } = require('../lib/oauth-helpers');
const { runWithTimeout } = require('../lib/spawnUtil');
const { logError, logWarn } = require('../lib/logger');

const FAVS_FILE = path.join(TLP_DIR, 'favorites.json');
const FAVS_BACKUP_DIR = path.join(TLP_DIR, 'favorites_backups');
const MAX_BACKUPS = 20;

async function readFavsFile() {
  try { return JSON.parse(await fs.promises.readFile(FAVS_FILE, 'utf8')); }
  catch (err) {
    if (err.code !== 'ENOENT') logWarn('favorites', err, 'read');
    return [];
  }
}

async function writeFavsFile(arr) {
  try { await fs.promises.mkdir(TLP_DIR, { recursive: true, mode: 0o700 }); }
  catch (err) { logWarn('favorites', err, 'mkdir TLP_DIR'); }
  // Rotate backup before overwriting
  try {
    const existing = await fs.promises.readFile(FAVS_FILE, 'utf8');
    const parsed = JSON.parse(existing);
    if (parsed.length > 0) {
      try { await fs.promises.mkdir(FAVS_BACKUP_DIR, { recursive: true, mode: 0o700 }); }
      catch (err) { logWarn('favorites', err, 'mkdir backup dir'); }
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await fs.promises.writeFile(path.join(FAVS_BACKUP_DIR, `favorites-${stamp}.json`), existing, { mode: 0o600 });
      // Prune old backups
      const files = (await fs.promises.readdir(FAVS_BACKUP_DIR)).filter(f => f.startsWith('favorites-')).sort();
      while (files.length > MAX_BACKUPS) {
        await fs.promises.unlink(path.join(FAVS_BACKUP_DIR, files.shift()));
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') logWarn('favorites', err, 'backup rotation');
  }
  await fs.promises.writeFile(FAVS_FILE, JSON.stringify(arr, null, 2), { mode: 0o600 });
}

router.get('/api/favorites', async (_req, res) => {
  res.json(await readFavsFile());
});

router.post('/api/favorites', async (req, res) => {
  const arr = req.body;
  if (!Array.isArray(arr)) return res.status(400).json({ error: 'expected array' });
  const existing = await readFavsFile();
  // Safety: refuse to wipe a non-empty file with an empty save
  if (existing.length > 0 && arr.length === 0) {
    return res.status(409).json({ error: 'refusing to delete all favorites', existing: existing.length });
  }
  await writeFavsFile(arr);
  res.json({ ok: true, count: arr.length });
});

// GET /api/decode?path=<mp3>&start=<seconds>&end=<seconds>
const MAX_DECODE_DURATION = 600; // 10 min — guards against ffmpeg memory blowup

router.get('/api/decode', async (req, res) => {
  const filePath = resolveAndValidate(req.query.path, readLibrary());
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const start = Math.max(0, parseFloat(req.query.start) || 0);
  const end = parseFloat(req.query.end) || 0;
  if (end <= start) return res.status(400).json({ error: 'end must be greater than start' });
  if (end - start > MAX_DECODE_DURATION) {
    return res.status(400).json({ error: `range exceeds ${MAX_DECODE_DURATION}s limit` });
  }

  try { await fs.promises.access(filePath); }
  catch (_) { return res.status(404).json({ error: 'File not found' }); }

  try {
    const result = await runWithTimeout('ffmpeg', [
      '-i', filePath,
      '-ss', String(start),
      '-to', String(end),
      '-ac', '1',
      '-ar', '22050',
      '-f', 'f32le',
      'pipe:1',
    ], { timeoutMs: 90000 });
    if (result.code !== 0) return res.status(500).json({ error: result.killed ? 'ffmpeg decode timeout' : 'ffmpeg decode failed' });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', result.stdout.length);
    res.send(result.stdout);
  } catch (err) {
    logError('decode', err);
    res.status(500).json({ error: 'Audio decode failed' });
  }
});

module.exports = router;
