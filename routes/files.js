'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { BoundedMap, AUDIO_FILE_EXTS, resolveAndValidate, hasMusic } = require('../lib/helpers');
const { readLibrary } = require('./library');
const { findCueMp3Pairs } = require('../lib/cueParser');

// Session-scoped caches for directory listings and scans
const lsCache   = new BoundedMap(200);
const scanCache = new BoundedMap(200);

// GET /api/scan?dir=<absolute path>&bust=1
router.get('/api/scan', async (req, res) => {
  const dir = resolveAndValidate(req.query.dir, readLibrary());
  if (!dir) {
    return res.status(400).json({ error: 'dir query parameter required' });
  }
  if (!req.query.bust && scanCache.has(dir)) return res.json(scanCache.get(dir));

  try {
    await fs.promises.access(dir);
    const stat = await fs.promises.stat(dir);
    if (!stat.isDirectory()) {
      return res.status(404).json({ error: `Not a directory: ${dir}` });
    }
  } catch (_) {
    return res.status(404).json({ error: `Directory not found: ${dir}` });
  }

  try {
    const pairs = await findCueMp3Pairs(dir);
    const discs = pairs.map((pair, index) => ({
      id: index,
      mp3Path: pair.mp3File || null,
      mp3File: pair.mp3File ? path.basename(pair.mp3File) : null,
      cueFile: pair.cueFile,
      albumTitle: pair.albumTitle,
      albumPerformer: pair.albumPerformer,
      tracks: pair.tracks,
    }));
    const result = { dir, discs };
    scanCache.set(dir, result);
    return res.json(result);
  } catch (err) {
    console.error('[scan]', err);
    return res.status(500).json({ error: 'Failed to scan directory' });
  }
});

// GET /api/ls?dir=<path>&bust=1
router.get('/api/ls', async (req, res) => {
  if (!req.query.dir) return res.status(400).json({ error: 'dir required' });
  const dir = path.resolve(req.query.dir);
  if (!req.query.bust && lsCache.has(dir)) return res.json(lsCache.get(dir));
  return res.status(204).end();
});

// GET /api/ls-stream?dir=<path>  — SSE stream
router.get('/api/ls-stream', async (req, res) => {
  if (!req.query.dir) { res.status(400).end(); return; }
  const dir = path.resolve(req.query.dir);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  // Fast path — already cached
  if (!req.query.bust && lsCache.has(dir)) {
    send({ type: 'batch', ...lsCache.get(dir) });
    res.end();
    return;
  }

  const parent = path.dirname(dir) !== dir ? path.dirname(dir) : null;
  send({ type: 'meta', parent });

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const candidates = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));
    const collected = [];

    // Batch entries and flush periodically to avoid per-entry overhead on network drives
    const LIMIT = 16;
    let pendingBatch = [];
    const BATCH_INTERVAL = 80; // ms
    let batchTimer = null;

    function flushBatch() {
      if (pendingBatch.length === 0) return;
      send({ type: 'entries', items: pendingBatch });
      pendingBatch = [];
    }

    function queueEntry(entry) {
      collected.push(entry);
      pendingBatch.push(entry);
      if (pendingBatch.length >= 50) {
        clearTimeout(batchTimer);
        flushBatch();
      } else if (!batchTimer) {
        batchTimer = setTimeout(() => { batchTimer = null; flushBatch(); }, BATCH_INTERVAL);
      }
    }

    let ci = 0;
    async function worker() {
      while (ci < candidates.length) {
        const e = candidates[ci++];
        const subPath = path.join(dir, e.name);
        const [music, st] = await Promise.all([
          hasMusic(subPath),
          fs.promises.stat(subPath).catch(() => null),
        ]);
        if (!music) continue;
        queueEntry({ name: e.name, mtime: st ? st.mtimeMs : 0 });
      }
    }
    await Promise.all(Array.from({ length: Math.min(LIMIT, candidates.length) }, worker));
    clearTimeout(batchTimer);
    flushBatch();

    lsCache.set(dir, { dir, parent, subdirs: collected });
    send({ type: 'done' });
  } catch (err) {
    console.error('[ls-stream]', err);
    send({ type: 'error', message: 'Failed to read directory' });
  }
  res.end();
});

// GET /api/nfo?dir=<path> — find and return NFO file in dir, decoded from CP437
router.get('/api/nfo', async (req, res) => {
  const dir = resolveAndValidate(req.query.dir, readLibrary());
  if (!dir) return res.status(400).json({ error: 'dir required' });

  try {
    const entries = await fs.promises.readdir(dir);
    const nfoFile = entries.find((f) => f.toLowerCase().endsWith('.nfo'));
    if (!nfoFile) return res.status(404).json({ error: 'No NFO file found' });

    const filePath = path.join(dir, nfoFile);
    const raw = await fs.promises.readFile(filePath);

    // Decode CP437 (IBM PC character set used by scene NFOs)
    const cp437map = [
      0x00C7,0x00FC,0x00E9,0x00E2,0x00E4,0x00E0,0x00E5,0x00E7,
      0x00EA,0x00EB,0x00E8,0x00EF,0x00EE,0x00EC,0x00C4,0x00C5,
      0x00C9,0x00E6,0x00C6,0x00F4,0x00F6,0x00F2,0x00FB,0x00F9,
      0x00FF,0x00D6,0x00DC,0x00A2,0x00A3,0x00A5,0x20A7,0x0192,
      0x00E1,0x00ED,0x00F3,0x00FA,0x00F1,0x00D1,0x00AA,0x00BA,
      0x00BF,0x2310,0x00AC,0x00BD,0x00BC,0x00A1,0x00AB,0x00BB,
      0x2591,0x2592,0x2593,0x2502,0x2524,0x2561,0x2562,0x2556,
      0x2555,0x2563,0x2551,0x2557,0x255D,0x255C,0x255B,0x2510,
      0x2514,0x2534,0x252C,0x251C,0x2500,0x253C,0x255E,0x255F,
      0x255A,0x2554,0x2569,0x2566,0x2560,0x2550,0x256C,0x2567,
      0x2568,0x2564,0x2565,0x2559,0x2558,0x2552,0x2553,0x256B,
      0x256A,0x2518,0x250C,0x2588,0x2584,0x258C,0x2590,0x2580,
      0x03B1,0x00DF,0x0393,0x03C0,0x03A3,0x03C3,0x00B5,0x03C4,
      0x03A6,0x0398,0x03A9,0x03B4,0x221E,0x03C6,0x03B5,0x2229,
      0x2261,0x00B1,0x2265,0x2264,0x2320,0x2321,0x00F7,0x2248,
      0x00B0,0x2219,0x00B7,0x221A,0x207F,0x00B2,0x25A0,0x00A0,
    ];

    let text = '';
    for (const byte of raw) {
      if (byte < 128) {
        text += String.fromCharCode(byte);
      } else {
        text += String.fromCharCode(cp437map[byte - 128]);
      }
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(text);
  } catch (err) {
    console.error('[nfo]', err);
    res.status(500).json({ error: 'Failed to read NFO file' });
  }
});

// GET /api/reveal?path=<absolute path> — reveal file in the OS file manager
router.get('/api/reveal', (req, res) => {
  const target = resolveAndValidate(req.query.path, readLibrary());
  if (!target) return res.status(400).json({ error: 'path required' });
  const plat = process.platform;
  if (plat === 'darwin') {
    spawn('open', ['-R', target], { detached: true }).unref();
  } else if (plat === 'win32') {
    spawn('explorer', [`/select,${target}`], { detached: true }).unref();
  } else {
    spawn('xdg-open', [path.dirname(target)], { detached: true }).unref();
  }
  res.json({ ok: true });
});

// GET /file?path=<absolute encoded path> — stream MP3 with range support
router.get('/file', async (req, res) => {
  const filePath = resolveAndValidate(req.query.path, readLibrary());
  if (!filePath) {
    return res.status(400).send('path query parameter required');
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!AUDIO_FILE_EXTS.has(ext)) {
    return res.status(400).send('File type not allowed');
  }

  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch (_) {
    return res.status(404).send('File not found');
  }

  const fileSize = stat.size;
  const range = req.headers.range;

  const MIME = { '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.m4a': 'audio/mp4',
    '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
    '.opus': 'audio/ogg; codecs=opus', '.wma': 'audio/x-ms-wma' };
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', MIME[ext] || 'audio/mpeg');

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);
    res.status(206);

    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
  } else {
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  }
});

module.exports = router;
