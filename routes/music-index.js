'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { BoundedMap, resolveAndValidate } = require('../lib/helpers');
const { readLibrary } = require('./library');
const { scanDirAsync } = require('../lib/cueParser');
const { SPAWN_ENV } = require('../lib/env');

// Music index cache (keyed by root dir)
const indexCache = new BoundedMap(50);

// Artwork cache (keyed by absolute mp3 path)
const artworkCache = new BoundedMap(500);

// Core scanner — calls onEntry(entry) for each album found, returns full list when done
async function buildMusicIndexStreaming(rootDir, onEntry) {
  const yearRe = /\b(19\d{2}|20[012]\d)\b/;
  const results = [];
  const visited = new Set();
  const queue = [{ dir: rootDir, depth: 0 }];

  while (queue.length > 0) {
    const batch = queue.splice(0, 20);
    await Promise.all(batch.map(async ({ dir, depth }) => {
      if (visited.has(dir)) return;
      visited.add(dir);

      const pairs = await scanDirAsync(dir);
      if (pairs.length > 0) {
        const yearMatch = path.basename(dir).match(yearRe);
        const year = yearMatch ? yearMatch[1] : '';
        for (const pair of pairs) {
          const tracks = pair.tracks.map((t, i) => {
            const next = pair.tracks[i + 1];
            return next
              ? { ...t, durationSeconds: Math.round(next.startSeconds - t.startSeconds) }
              : t;
          });
          const entry = {
            dir,
            mp3Path: pair.mp3File || null,
            mp3File: pair.mp3File ? path.basename(pair.mp3File) : null,
            albumTitle: pair.albumTitle,
            albumPerformer: pair.albumPerformer,
            year,
            tracks,
          };
          results.push(entry);
          await onEntry(entry);
        }
      } else if (depth < 5) {
        try {
          const entries = await fs.promises.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
              queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
            }
          }
        } catch (err) { console.warn('[index] readdir failed:', dir, err.message); }
      }
    }));
  }
  return results;
}

async function buildMusicIndex(rootDir) {
  const results = [];
  await buildMusicIndexStreaming(rootDir, async (e) => results.push(e));
  return results;
}

// GET /api/index?root=<path> — full recursive index of music root
router.get('/api/index', async (req, res) => {
  const root = resolveAndValidate(req.query.root, readLibrary());
  if (!root) return res.status(400).json({ error: 'root required or not within a library folder' });

  if (!req.query.bust && indexCache.has(root)) return res.json(indexCache.get(root));

  try { await fs.promises.access(root); }
  catch (_) { return res.status(404).json({ error: 'Directory not found' }); }

  try {
    const index = await buildMusicIndex(root);
    indexCache.set(root, index);
    res.json(index);
  } catch (err) {
    console.error('[index]', err);
    res.status(500).json({ error: 'Failed to build index' });
  }
});

// GET /api/index-stream?root=<path> — SSE stream of index entries as they are found
router.get('/api/index-stream', async (req, res) => {
  const root = resolveAndValidate(req.query.root, readLibrary());
  if (!root) return res.status(400).json({ error: 'root required or not within a library folder' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // If already cached, flush immediately
  if (!req.query.bust && indexCache.has(root)) {
    for (const entry of indexCache.get(root)) {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    }
    res.write('data: {"done":true}\n\n');
    res.end();
    return;
  }

  try { await fs.promises.access(root); }
  catch (_) {
    res.write('data: {"done":true,"error":"Directory not found"}\n\n');
    res.end();
    return;
  }

  const results = [];
  try {
    await buildMusicIndexStreaming(root, async (entry) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(entry)}\n\n`);
      results.push(entry);
    });
    indexCache.set(root, results);
  } catch (err) {
    console.error('[index-stream]', err);
    if (!res.writableEnded) res.write('data: {"done":true,"error":"Indexing failed"}\n\n');
    res.end();
    return;
  }
  if (!res.writableEnded) { res.write('data: {"done":true}\n\n'); res.end(); }
});

// GET /api/artwork?path=<absolute mp3 path>
router.get('/api/artwork', async (req, res) => {
  const filePath = resolveAndValidate(req.query.path, readLibrary());
  if (!filePath) return res.status(400).end();

  if (artworkCache.has(filePath)) {
    const cached = artworkCache.get(filePath);
    if (!cached) return res.status(404).end();
    res.setHeader('Content-Type', cached.type);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(cached.data);
  }

  const dir = path.dirname(filePath);

  // 1. Check common cover image filenames in the same folder
  const candidates = ['cover.jpg','cover.jpeg','cover.png','folder.jpg','folder.jpeg',
    'folder.png','front.jpg','front.jpeg','artwork.jpg','artwork.jpeg','art.jpg'];
  for (const name of candidates) {
    try {
      const data = await fs.promises.readFile(path.join(dir, name));
      const type = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
      artworkCache.set(filePath, { data, type });
      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(data);
    } catch (_) {}
  }

  // 2. Any jpg/png in the folder
  try {
    const entries = await fs.promises.readdir(dir);
    const img = entries.find((e) => /\.(jpg|jpeg|png)$/i.test(e));
    if (img) {
      const data = await fs.promises.readFile(path.join(dir, img));
      const type = img.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      artworkCache.set(filePath, { data, type });
      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(data);
    }
  } catch (_) {}

  // 3. Extract embedded art via ffmpeg
  const ff = spawn('ffmpeg', [
    '-i', filePath, '-an', '-vcodec', 'copy', '-f', 'image2', 'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'ignore'], env: SPAWN_ENV });
  const bufs = [];
  ff.stdout.on('data', (c) => bufs.push(c));
  const code = await new Promise((r) => { ff.on('close', r); ff.on('error', () => r(-1)); });
  if (code === 0 && bufs.length) {
    const data = Buffer.concat(bufs);
    artworkCache.set(filePath, { data, type: 'image/jpeg' });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(data);
  }

  // 4. MusicBrainz Cover Art Archive fallback
  try {
    const folderName = path.basename(dir);
    const cleaned = folderName.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    const mbSearch = `https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(cleaned)}&limit=1&fmt=json`;
    const mbRes = await fetch(mbSearch, { headers: { 'User-Agent': 'TracklistPlayer/1.0 (local)' } });
    if (mbRes.ok) {
      const mbData = await mbRes.json();
      const releases = mbData.releases || [];
      if (releases.length > 0) {
        const mbid = releases[0].id;
        const caRes = await fetch(`https://coverartarchive.org/release/${mbid}/front-250`, {
          redirect: 'follow',
          headers: { 'User-Agent': 'TracklistPlayer/1.0 (local)' },
        });
        if (caRes.ok) {
          const buf = Buffer.from(await caRes.arrayBuffer());
          artworkCache.set(filePath, { data: buf, type: 'image/jpeg' });
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=3600');
          return res.send(buf);
        }
      }
    }
  } catch (_) {}

  artworkCache.set(filePath, null);
  res.status(404).end();
});

module.exports = router;
// Export buildMusicIndex for use by library.js (lazy-loaded to avoid circular dependency)
module.exports._buildMusicIndex = buildMusicIndex;
