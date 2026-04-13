'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { resolveAndValidate } = require('../lib/helpers');
const { readLibrary, TLP_DIR } = require('./library');
const { SPAWN_ENV } = require('../lib/env');

const FAVS_FILE = path.join(TLP_DIR, 'favorites.json');
const FAVS_BACKUP_DIR = path.join(TLP_DIR, 'favorites_backups');
const MAX_BACKUPS = 20;

async function readFavsFile() {
  try { return JSON.parse(await fs.promises.readFile(FAVS_FILE, 'utf8')); }
  catch (_) { return []; }
}

async function writeFavsFile(arr) {
  try { await fs.promises.mkdir(TLP_DIR, { recursive: true, mode: 0o700 }); } catch (_) {}
  // Rotate backup before overwriting
  try {
    const existing = await fs.promises.readFile(FAVS_FILE, 'utf8');
    const parsed = JSON.parse(existing);
    if (parsed.length > 0) {
      try { await fs.promises.mkdir(FAVS_BACKUP_DIR, { recursive: true, mode: 0o700 }); } catch (_) {}
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await fs.promises.writeFile(path.join(FAVS_BACKUP_DIR, `favorites-${stamp}.json`), existing, { mode: 0o600 });
      // Prune old backups
      const files = (await fs.promises.readdir(FAVS_BACKUP_DIR)).filter(f => f.startsWith('favorites-')).sort();
      while (files.length > MAX_BACKUPS) {
        await fs.promises.unlink(path.join(FAVS_BACKUP_DIR, files.shift()));
      }
    }
  } catch (_) {}
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
router.get('/api/decode', async (req, res) => {
  const filePath = resolveAndValidate(req.query.path, readLibrary());
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const start = parseFloat(req.query.start) || 0;
  const end = parseFloat(req.query.end) || 0;
  if (end <= start) return res.status(400).json({ error: 'end must be greater than start' });

  try { await fs.promises.access(filePath); }
  catch (_) { return res.status(404).json({ error: 'File not found' }); }

  try {
    const ff = spawn('ffmpeg', [
      '-i', filePath,
      '-ss', String(start),
      '-to', String(end),
      '-ac', '1',
      '-ar', '22050',
      '-f', 'f32le',
      'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'], env: SPAWN_ENV });

    const bufs = [];
    ff.stdout.on('data', (c) => bufs.push(c));
    const code = await new Promise((r) => { ff.on('close', r); ff.on('error', () => r(-1)); });
    if (code !== 0) return res.status(500).json({ error: 'ffmpeg decode failed' });

    const pcm = Buffer.concat(bufs);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', pcm.length);
    res.send(pcm);
  } catch (err) {
    console.error('[decode]', err);
    res.status(500).json({ error: 'Audio decode failed' });
  }
});

module.exports = router;
