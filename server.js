'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { findCueMp3Pairs, scanDirAsync } = require('./lib/cueParser');

const app = express();
const PORT = 3123;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// GET /api/scan?dir=<absolute path>
// Scans the given dir + one level of subdirs for MP3/CUE pairs
app.get('/api/scan', async (req, res) => {
  const dir = req.query.dir;
  if (!dir) {
    return res.status(400).json({ error: 'dir query parameter required' });
  }

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
    const result = pairs.map((pair, index) => ({
      id: index,
      mp3Path: pair.mp3File || null,
      mp3File: pair.mp3File ? path.basename(pair.mp3File) : null,
      cueFile: pair.cueFile,
      albumTitle: pair.albumTitle,
      albumPerformer: pair.albumPerformer,
      tracks: pair.tracks,
    }));
    return res.json({ dir, discs: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/ls?dir=<path> — list subdirectories
app.get('/api/ls', async (req, res) => {
  const dir = req.query.dir;
  if (!dir) return res.status(400).json({ error: 'dir required' });

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const subdirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const parent = path.dirname(dir) !== dir ? path.dirname(dir) : null;
    return res.json({ dir, parent, subdirs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/nfo?dir=<path> — find and return NFO file in dir, decoded from CP437
app.get('/api/nfo', async (req, res) => {
  const dir = req.query.dir;
  if (!dir) return res.status(400).json({ error: 'dir required' });

  try {
    const entries = await fs.promises.readdir(dir);
    const nfoFile = entries.find((f) => f.toLowerCase().endsWith('.nfo'));
    if (!nfoFile) return res.status(404).json({ error: 'No NFO file found' });

    const filePath = path.join(dir, nfoFile);
    const raw = await fs.promises.readFile(filePath);

    // Decode CP437 (IBM PC character set used by scene NFOs)
    // Map the 128 extended CP437 characters to their Unicode equivalents
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
    res.status(500).json({ error: err.message });
  }
});

// Waveform cache (in-memory, keyed by absolute mp3 path)
const waveformCache = new Map();

// GET /api/waveform?path=<absolute mp3 path>
// Uses ffmpeg to decode audio at low sample rate, returns per-bucket amplitude + frequency data
app.get('/api/waveform', async (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const bucketMs = Math.max(25, Math.min(200, parseInt(req.query.bucketMs, 10) || 100));
  const cacheKey = `${filePath}@${bucketMs}`;
  if (waveformCache.has(cacheKey)) return res.json(waveformCache.get(cacheKey));

  try { await fs.promises.access(filePath); }
  catch (_) { return res.status(404).json({ error: 'File not found' }); }

  const { spawn } = require('child_process');
  const SAMPLE_RATE = 2000;
  const SAMPLES_PER_BUCKET = Math.round(SAMPLE_RATE * bucketMs / 1000);

  const ff = spawn('ffmpeg', [
    '-i', filePath,
    '-ac', '1', '-ar', String(SAMPLE_RATE),
    '-f', 'f32le', 'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'ignore'] });

  const bufs = [];
  ff.stdout.on('data', (c) => bufs.push(c));
  const code = await new Promise((r) => { ff.on('close', r); ff.on('error', () => r(-1)); });
  if (code !== 0) return res.status(500).json({ error: 'ffmpeg decode failed' });

  const raw = Buffer.concat(bufs);
  const numSamples = Math.floor(raw.length / 4);
  // Create a float32 view directly over the node Buffer's memory
  const floats = new Float32Array(raw.buffer, raw.byteOffset, numSamples);
  const duration = numSamples / SAMPLE_RATE;
  const numBuckets = Math.ceil(numSamples / SAMPLES_PER_BUCKET);

  const rPeaks = new Float32Array(numBuckets);
  const rBass  = new Float32Array(numBuckets);
  const rMids  = new Float32Array(numBuckets);
  const rHighs = new Float32Array(numBuckets);

  // One-pole IIR low-pass: y[n] = a*|x[n]| + (1-a)*y[n-1]
  // At 2 kHz: a=0.08 → fc≈25 Hz (bass), a=0.40 → fc≈175 Hz (bass/mid boundary)
  const A_BASS = 0.08;
  const A_MID  = 0.40;
  let loBass = 0, loMid = 0;

  for (let b = 0; b < numBuckets; b++) {
    const s = b * SAMPLES_PER_BUCKET;
    const e = Math.min(s + SAMPLES_PER_BUCKET, numSamples);
    let peak = 0, bSum = 0, mSum = 0, hSum = 0;
    for (let i = s; i < e; i++) {
      const x = Math.abs(floats[i]);
      if (x > peak) peak = x;
      loBass = A_BASS * x + (1 - A_BASS) * loBass;
      loMid  = A_MID  * x + (1 - A_MID)  * loMid;
      bSum += loBass;
      mSum += Math.max(0, loMid - loBass);
      hSum += Math.max(0, x - loMid);
    }
    const n = e - s;
    rPeaks[b] = peak;
    rBass[b]  = bSum / n;
    rMids[b]  = mSum / n;
    rHighs[b] = hSum / n;
  }

  // Normalise peaks to 95th percentile for better dynamic range
  const sorted = Float32Array.from(rPeaks).sort();
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
  const peakScale = 254 / p95;

  // Normalise each band independently to its own 95th percentile so all
  // three channels span the full 0-255 range and colours stay balanced.
  function bandScale(arr) {
    const s = Float32Array.from(arr).sort();
    const p = s[Math.floor(s.length * 0.95)] || 1;
    return 254 / p;
  }
  const bassScale  = bandScale(rBass);
  const midsScale  = bandScale(rMids);
  const highsScale = bandScale(rHighs);

  const peaks = new Uint8Array(numBuckets);
  const bass  = new Uint8Array(numBuckets);
  const mids  = new Uint8Array(numBuckets);
  const highs = new Uint8Array(numBuckets);
  for (let b = 0; b < numBuckets; b++) {
    peaks[b] = Math.min(255, Math.round(rPeaks[b] * peakScale));
    bass[b]  = Math.min(255, Math.round(rBass[b]  * bassScale));
    mids[b]  = Math.min(255, Math.round(rMids[b]  * midsScale));
    highs[b] = Math.min(255, Math.round(rHighs[b] * highsScale));
  }

  const result = {
    duration,
    numBuckets,
    bucketSecs: SAMPLES_PER_BUCKET / SAMPLE_RATE,
    peaks: Buffer.from(peaks).toString('base64'),
    bass:  Buffer.from(bass).toString('base64'),
    mids:  Buffer.from(mids).toString('base64'),
    highs: Buffer.from(highs).toString('base64'),
  };
  waveformCache.set(cacheKey, result);
  res.json(result);
});

// Music index cache (keyed by root dir)
const indexCache = new Map();

// Recursively scan rootDir (BFS, max depth 5) and build a flat array of disc records
async function buildMusicIndex(rootDir) {
  const yearRe = /\b(19\d{2}|20[012]\d)\b/;
  const results = [];
  const visited = new Set();
  const queue = [{ dir: rootDir, depth: 0 }];

  while (queue.length > 0) {
    // Process up to 20 dirs concurrently
    const batch = queue.splice(0, 20);
    await Promise.all(batch.map(async ({ dir, depth }) => {
      if (visited.has(dir)) return;
      visited.add(dir);

      const pairs = await scanDirAsync(dir);
      if (pairs.length > 0) {
        const yearMatch = path.basename(dir).match(yearRe);
        const year = yearMatch ? yearMatch[1] : '';
        for (const pair of pairs) {
          results.push({
            dir,
            mp3Path: pair.mp3File || null,
            mp3File: pair.mp3File ? path.basename(pair.mp3File) : null,
            albumTitle: pair.albumTitle,
            albumPerformer: pair.albumPerformer,
            year,
            tracks: pair.tracks,
          });
        }
      } else if (depth < 5) {
        try {
          const entries = await fs.promises.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
              queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
            }
          }
        } catch (_) {}
      }
    }));
  }
  return results;
}

// GET /api/index?root=<path> — full recursive index of music root
app.get('/api/index', async (req, res) => {
  const root = req.query.root;
  if (!root) return res.status(400).json({ error: 'root required' });

  if (indexCache.has(root)) return res.json(indexCache.get(root));

  try { await fs.promises.access(root); }
  catch (_) { return res.status(404).json({ error: 'Directory not found' }); }

  try {
    const index = await buildMusicIndex(root);
    indexCache.set(root, index);
    res.json(index);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Artwork cache (keyed by absolute mp3 path)
const artworkCache = new Map();

// GET /api/artwork?path=<absolute mp3 path>
// Returns album art: checks folder for common image files first, then ffmpeg embedded art
app.get('/api/artwork', async (req, res) => {
  const filePath = req.query.path;
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
  const { spawn } = require('child_process');
  const ff = spawn('ffmpeg', [
    '-i', filePath, '-an', '-vcodec', 'copy', '-f', 'image2', 'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'ignore'] });
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

  // 4. MusicBrainz Cover Art Archive fallback — search by folder name
  try {
    const folderName = path.basename(dir);
    // Extract artist and album from typical scene folder name patterns
    // e.g. "VA_-_Mellomania_Vol.01-2CD-2004-MOD" or "Artist_-_Album-2004"
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

// GET /api/reveal?path=<absolute path> — reveal file/folder in Finder (macOS)
app.get('/api/reveal', (req, res) => {
  const target = req.query.path;
  if (!target) return res.status(400).json({ error: 'path required' });
  const { spawn } = require('child_process');
  spawn('open', ['-R', target], { detached: true }).unref();
  res.json({ ok: true });
});

// GET /file?path=<absolute encoded path> — stream MP3 with range support
app.get('/file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).send('path query parameter required');
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Type', 'audio/mpeg');

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

// CLI: optional directory argument
const cliDir = process.argv[2];

const server = app.listen(PORT, () => {
  console.log(`Tracklist Player running at http://localhost:${PORT}`);
  if (cliDir) {
    console.log(`Auto-loading directory: ${cliDir}`);
  } else {
    console.log('Usage: node server.js /path/to/music/directory');
  }
});

// Pass CLI dir to frontend via a small API endpoint
app.get('/api/config', (req, res) => {
  res.json({ dir: cliDir || '' });
});

module.exports = server;
