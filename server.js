'use strict';

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { findCueMp3Pairs, scanDirAsync } = require('./lib/cueParser');
const { spawn } = require('child_process');
const https = require('https');

// Augment PATH so ffmpeg is found when running as a packaged Electron app,
// which inherits a minimal macOS PATH that excludes Homebrew (/opt/homebrew/bin).
const SPAWN_ENV = {
  ...process.env,
  PATH: [process.env.PATH, '/opt/homebrew/bin', '/usr/local/bin'].filter(Boolean).join(':'),
};

const app = express();
const PORT = 3123;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Path safety helper ────────────────────────────────────────────────────────
// Returns the resolved absolute path only if it falls within one of the allowed roots.
// Returns null if the path escapes all roots (path traversal attempt).
const AUDIO_FILE_EXTS = new Set(['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.wav', '.opus', '.wma', '.cue']);

function resolveAndValidate(inputPath, allowedRoots) {
  if (!inputPath) return null;
  const resolved = path.resolve(inputPath);
  if (!allowedRoots || allowedRoots.length === 0) return null;
  const ok = allowedRoots.some((root) => {
    const r = path.resolve(root);
    return resolved === r || resolved.startsWith(r + path.sep);
  });
  return ok ? resolved : null;
}

// ── Library (multi-root folder collection) ────────────────────────────────────
const TLP_DIR = path.join(os.homedir(), '.tracklistplayer');
const LIBRARY_FILE = path.join(TLP_DIR, 'library.json');

let _libraryCache = null;

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

let libraryIndexCache = null;

app.get('/api/library', (_req, res) => res.json({ folders: readLibrary() }));

app.post('/api/library', (req, res) => {
  const { folder } = req.body || {};
  if (!folder) return res.status(400).json({ error: 'folder required' });
  const lib = readLibrary();
  if (!lib.includes(folder)) { lib.push(folder); writeLibrary(lib); }
  libraryIndexCache = null;
  res.json({ folders: lib });
});

app.delete('/api/library', (req, res) => {
  const { folder } = req.body || {};
  const lib = readLibrary().filter((f) => f !== folder);
  writeLibrary(lib);
  libraryIndexCache = null;
  res.json({ folders: lib });
});

app.get('/api/library-index', async (req, res) => {
  if (!req.query.bust && libraryIndexCache) return res.json(libraryIndexCache);
  const folders = readLibrary();
  if (!folders.length) return res.json([]);
  try {
    const results = await Promise.all(folders.map((f) => buildMusicIndex(f)));
    libraryIndexCache = results.flat();
    res.json(libraryIndexCache);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Spotify OAuth helpers ─────────────────────────────────────────────────────
const SPOTIFY_CONFIG_PATH = path.join(os.homedir(), '.tracklistplayer', 'spotify.json');
const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:3123/auth/spotify/callback';
const SPOTIFY_SCOPES = 'user-library-read streaming user-read-playback-state user-modify-playback-state user-read-email user-read-private playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private';

function serverEscapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function readSpotifyConfig() {
  try {
    const data = await fs.promises.readFile(SPOTIFY_CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (_) {
    return {};
  }
}

async function writeSpotifyConfig(data) {
  const dir = path.dirname(SPOTIFY_CONFIG_PATH);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(SPOTIFY_CONFIG_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

async function refreshSpotifyToken(config) {
  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', config.refresh_token);
  const credentials = Buffer.from(`${config.client_id}:${config.client_secret}`).toString('base64');
  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!tokenRes.ok) throw new Error('Refresh failed');
  const tokenData = await tokenRes.json();
  console.log('Token refresh — scopes returned by Spotify:', tokenData.scope || '(none)');
  const updated = { ...config, access_token: tokenData.access_token, expires_at: Date.now() + tokenData.expires_in * 1000 };
  if (tokenData.refresh_token) updated.refresh_token = tokenData.refresh_token;
  await writeSpotifyConfig(updated);
  return updated;
}

// Shared helper: auto-refresh an access token if it expires within 60 s
async function ensureFreshToken(config, refreshFn) {
  if (config.expires_at && Date.now() > config.expires_at - 60000) {
    try { return await refreshFn(config); } catch (_) {}
  }
  return config;
}

// GET /api/spotify/config — return client_id and auth status
app.get('/api/spotify/config', async (req, res) => {
  const config = await readSpotifyConfig();
  res.json({
    client_id: config.client_id || '',
    connected: !!(config.access_token && config.refresh_token),
  });
});

// POST /api/spotify/credentials — save client_id + client_secret
app.post('/api/spotify/credentials', async (req, res) => {
  const { client_id, client_secret } = req.body || {};
  if (!client_id || !client_secret) return res.status(400).json({ error: 'client_id and client_secret required' });
  const existing = await readSpotifyConfig();
  await writeSpotifyConfig({ ...existing, client_id, client_secret });
  res.json({ ok: true });
});

// Pending OAuth state tokens — prevent CSRF on callbacks (M4)
const pendingSpotifyStates = new Map();
const pendingSoundcloudStates = new Map();

// Periodically remove expired OAuth state tokens to prevent unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [st, expiry] of pendingSpotifyStates) {
    if (now > expiry) pendingSpotifyStates.delete(st);
  }
  for (const [st, expiry] of pendingSoundcloudStates) {
    if (now > expiry) pendingSoundcloudStates.delete(st);
  }
}, 15 * 60 * 1000);

// GET /api/spotify/auth-url — generate Spotify authorize URL
app.get('/api/spotify/auth-url', async (req, res) => {
  const config = await readSpotifyConfig();
  if (!config.client_id) return res.status(400).json({ error: 'No client_id configured' });
  const state = crypto.randomBytes(16).toString('hex');
  pendingSpotifyStates.set(state, Date.now() + 10 * 60 * 1000); // 10 min TTL
  const url = `https://accounts.spotify.com/authorize?response_type=code`
    + `&client_id=${encodeURIComponent(config.client_id)}`
    + `&scope=${encodeURIComponent(SPOTIFY_SCOPES)}`
    + `&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}`
    + `&state=${state}`
    + `&show_dialog=true`;
  res.json({ url });
});

// GET /auth/spotify/callback — receive OAuth code, exchange for tokens
app.get('/auth/spotify/callback', async (req, res) => {
  const { code, error, state } = req.query;
  if (error) return res.send(`<!DOCTYPE html><html><head><title>Spotify Auth</title></head><body style="font-family:sans-serif;background:#191414;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div><h2 style="color:#e05050">Auth failed</h2><p>${serverEscapeHtml(String(error))}</p></div></body></html>`);
  if (!code) return res.status(400).send('No code');
  const stateExpiry = state && pendingSpotifyStates.get(state);
  if (!stateExpiry || Date.now() > stateExpiry) return res.status(400).send('Invalid or expired state');
  pendingSpotifyStates.delete(state);

  const config = await readSpotifyConfig();
  if (!config.client_id || !config.client_secret) return res.status(400).send('Spotify credentials not configured');

  try {
    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('code', code);
    params.set('redirect_uri', SPOTIFY_REDIRECT_URI);
    const credentials = Buffer.from(`${config.client_id}:${config.client_secret}`).toString('base64');
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return res.send(`<!DOCTYPE html><html><head><title>Spotify Auth</title></head><body style="font-family:sans-serif;background:#191414;color:#fff;padding:40px"><h2 style="color:#e05050">Token exchange failed</h2><pre>${serverEscapeHtml(err)}</pre></body></html>`);
    }
    const tokenData = await tokenRes.json();
    console.log('Spotify token granted scopes:', tokenData.scope);
    await writeSpotifyConfig({
      ...config,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
      granted_scope: tokenData.scope || '',
    });
    res.send(`<!DOCTYPE html><html><head><title>Spotify Connected</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#191414;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh}.card{text-align:center;padding:40px}.logo{color:#1db954;font-size:48px;margin-bottom:16px}h2{color:#1db954;font-size:24px;margin-bottom:8px}p{color:#aaa;font-size:14px;margin-top:8px}</style></head><body><div class="card"><div class="logo">&#10003;</div><h2>Connected to Spotify</h2><p>You can close this window.</p></div></body></html>`);
  } catch (err) {
    res.send(`<!DOCTYPE html><html><head><title>Spotify Auth</title></head><body style="font-family:sans-serif;background:#191414;color:#fff;padding:40px"><h2 style="color:#e05050">Error</h2><p>${serverEscapeHtml(err.message)}</p></body></html>`);
  }
});

// GET /api/spotify/status — return { connected, displayName }
app.get('/api/spotify/status', async (req, res) => {
  const config = await readSpotifyConfig();
  if (!config.access_token || !config.refresh_token) return res.json({ connected: false });
  try {
    const meRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${config.access_token}` },
    });
    if (meRes.ok) {
      const me = await meRes.json();
      return res.json({ connected: true, displayName: me.display_name || me.id || 'Spotify User', granted_scope: config.granted_scope || '' });
    }
    // Token might be expired — try to check after refresh
    if (meRes.status === 401 && config.refresh_token) {
      try {
        const updated = await refreshSpotifyToken(config);
        const me2Res = await fetch('https://api.spotify.com/v1/me', {
          headers: { 'Authorization': `Bearer ${updated.access_token}` },
        });
        if (me2Res.ok) {
          const me2 = await me2Res.json();
          return res.json({ connected: true, displayName: me2.display_name || me2.id || 'Spotify User' });
        }
      } catch (_) {}
    }
  } catch (_) {}
  res.json({ connected: !!(config.access_token), displayName: '' });
});

// GET /api/spotify/refresh — refresh access token
app.get('/api/spotify/refresh', async (req, res) => {
  const config = await readSpotifyConfig();
  if (!config.refresh_token) return res.status(401).json({ error: 'No refresh token' });
  try {
    const updated = await refreshSpotifyToken(config);
    res.json({ access_token: updated.access_token, expires_at: updated.expires_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/spotify/liked?offset=&limit= — proxy liked tracks
app.get('/api/spotify/liked', async (req, res) => {
  let config = await readSpotifyConfig();
  if (!config.access_token) return res.status(401).json({ error: 'Not connected' });
  config = await ensureFreshToken(config, refreshSpotifyToken);

  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
  try {
    const spotRes = await fetch(`https://api.spotify.com/v1/me/tracks?offset=${offset}&limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${config.access_token}` },
    });
    if (!spotRes.ok) return res.status(spotRes.status).json({ error: 'Spotify API error' });
    const data = await spotRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/spotify/playlists — list user's playlists
app.get('/api/spotify/playlists', async (req, res) => {
  let config = await readSpotifyConfig();
  if (!config.access_token) return res.status(401).json({ error: 'Not connected' });
  config = await ensureFreshToken(config, refreshSpotifyToken);
  try {
    const r = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { 'Authorization': `Bearer ${config.access_token}` },
    });
    if (!r.ok) return res.status(r.status).json({ error: 'Spotify API error' });
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/spotify/playlist-tracks?id=&offset=&limit=
app.get('/api/spotify/playlist-tracks', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  let config = await readSpotifyConfig();
  if (!config.access_token) return res.status(401).json({ error: 'Not connected' });
  config = await ensureFreshToken(config, refreshSpotifyToken);
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
  try {
    const r = await fetch(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(id)}/tracks?offset=${offset}&limit=${limit}`,
      { headers: { 'Authorization': `Bearer ${config.access_token}` } }
    );
    if (r.status === 403) {
      return res.status(403).json({ error: 'quota_exceeded' });
    }
    if (!r.ok) {
      const body = await r.text();
      return res.status(r.status).json({ error: `Spotify API error ${r.status}: ${body}` });
    }
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /api/spotify/devices — list available Spotify Connect devices
app.get('/api/spotify/devices', async (req, res) => {
  let config = await readSpotifyConfig();
  if (!config.access_token) return res.status(401).json({ error: 'Not connected' });
  config = await ensureFreshToken(config, refreshSpotifyToken);
  try {
    const devRes = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { 'Authorization': `Bearer ${config.access_token}` },
    });
    if (!devRes.ok) return res.status(devRes.status).json({ error: 'Spotify API error' });
    res.json(await devRes.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/spotify/disconnect — remove tokens
app.get('/api/spotify/disconnect', async (req, res) => {
  const config = await readSpotifyConfig();
  await writeSpotifyConfig({ client_id: config.client_id || '', client_secret: config.client_secret || '' });
  res.json({ ok: true });
});

// GET /api/scan?dir=<absolute path>&bust=1
// Scans the given dir + one level of subdirs for MP3/CUE pairs.
// Results are cached in memory; pass bust=1 to force a fresh scan.
app.get('/api/scan', async (req, res) => {
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
    return res.status(500).json({ error: err.message });
  }
});

// Session-scoped caches for directory listings and scans
const lsCache   = new Map();
const scanCache = new Map();

async function hasMusic(dirPath) {
  try {
    const files = await fs.promises.readdir(dirPath);
    return files.some((f) => AUDIO_FILE_EXTS.has(f.slice(f.lastIndexOf('.')).toLowerCase()));
  } catch (_) {
    return false;
  }
}

// GET /api/ls?dir=<path>&bust=1
// Returns cached JSON instantly if available; otherwise falls through to SSE stream.
app.get('/api/ls', async (req, res) => {
  if (!req.query.dir) return res.status(400).json({ error: 'dir required' });
  const dir = path.resolve(req.query.dir); // canonicalise; prevents ../.. traversal
  if (!req.query.bust && lsCache.has(dir)) return res.json(lsCache.get(dir));
  return res.status(204).end(); // not cached — client should use /api/ls-stream
});

// GET /api/ls-stream?dir=<path>  — SSE: streams one entry per subdirectory as soon
// as its hasMusic check resolves; the client inserts items in sorted order live.
// When the cache is already warm the whole batch is sent in a single 'batch' event.
app.get('/api/ls-stream', async (req, res) => {
  if (!req.query.dir) { res.status(400).end(); return; }
  const dir = path.resolve(req.query.dir); // canonicalise; prevents ../.. traversal

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

    // Limit concurrent hasMusic checks so network-drive I/O isn't saturated,
    // keeping bandwidth free for simultaneous /api/scan requests.
    const LIMIT = 8;
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
        const entry = { name: e.name, mtime: st ? st.mtimeMs : 0 };
        collected.push(entry);
        send({ type: 'entry', ...entry });
      }
    }
    await Promise.all(Array.from({ length: Math.min(LIMIT, candidates.length) }, worker));

    lsCache.set(dir, { dir, parent, subdirs: collected });
    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  }
  res.end();
});

// GET /api/nfo?dir=<path> — find and return NFO file in dir, decoded from CP437
app.get('/api/nfo', async (req, res) => {
  const dir = resolveAndValidate(req.query.dir, readLibrary());
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

// Shared helper: decode audio via ffmpeg, bucket into amplitude arrays, cache result.
// Both /api/waveform and /api/detect-transitions call this to avoid re-decoding.
async function getOrComputeWaveform(filePath, bucketMs) {
  const cacheKey = `${filePath}@${bucketMs}`;
  if (waveformCache.has(cacheKey)) return waveformCache.get(cacheKey);

  const SAMPLE_RATE = 2000;
  const SAMPLES_PER_BUCKET = Math.round(SAMPLE_RATE * bucketMs / 1000);

  const ff = spawn('ffmpeg', [
    '-i', filePath,
    '-ac', '1', '-ar', String(SAMPLE_RATE),
    '-f', 'f32le', 'pipe:1',
  ], { stdio: ['ignore', 'pipe', 'ignore'], env: SPAWN_ENV });

  const bufs = [];
  ff.stdout.on('data', (c) => bufs.push(c));
  const code = await new Promise((r) => { ff.on('close', r); ff.on('error', () => r(-1)); });
  if (code !== 0) throw new Error('ffmpeg decode failed');

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
  return result;
}

// GET /api/waveform?path=<absolute mp3 path>
// Uses ffmpeg to decode audio at low sample rate, returns per-bucket amplitude + frequency data
app.get('/api/waveform', async (req, res) => {
  const filePath = resolveAndValidate(req.query.path, readLibrary());
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const bucketMs = Math.max(25, Math.min(200, parseInt(req.query.bucketMs, 10) || 100));

  try { await fs.promises.access(filePath); }
  catch (_) { return res.status(404).json({ error: 'File not found' }); }

  try {
    res.json(await getOrComputeWaveform(filePath, bucketMs));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/detect-transitions?path=&count=&bucketMs=
// Analyses waveform energy to find N-1 likely track transition points.
// count = number of tracks from NFO (0 = return all detected minima)
app.get('/api/detect-transitions', async (req, res) => {
  const filePath = resolveAndValidate(req.query.path, readLibrary());
  if (!filePath) return res.status(400).json({ error: 'path required' });

  const count    = parseInt(req.query.count, 10) || 0;
  const bucketMs = Math.max(25, Math.min(200, parseInt(req.query.bucketMs, 10) || 100));

  try { await fs.promises.access(filePath); }
  catch (_) { return res.status(404).json({ error: 'File not found' }); }

  try {
    const wf = await getOrComputeWaveform(filePath, bucketMs);
    const peaksRaw = Buffer.from(wf.peaks, 'base64');
    const peaks    = new Uint8Array(peaksRaw);
    const n        = peaks.length;

    // Box-blur with 20-second window using prefix sums (O(n))
    const windowBuckets  = Math.max(3, Math.round(20000 / bucketMs));
    const half           = Math.floor(windowBuckets / 2);
    const prefix         = new Float32Array(n + 1);
    for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + peaks[i];

    const smoothed       = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const lo     = Math.max(0, i - half);
      const hi     = Math.min(n - 1, i + half);
      smoothed[i]  = (prefix[hi + 1] - prefix[lo]) / (hi - lo + 1);
    }

    // Prefix sum over smoothed (for confidence computation)
    const sPrefix = new Float32Array(n + 1);
    for (let i = 0; i < n; i++) sPrefix[i + 1] = sPrefix[i] + smoothed[i];

    const skipBuckets    = Math.round(60000  / bucketMs); // skip first/last 60 s
    const contextBuckets = Math.round(120000 / bucketMs); // ±2-min window for confidence

    // Find all local minima in smoothed signal (i is lower than both immediate neighbours)
    const allMinima = [];
    for (let i = skipBuckets + 1; i < n - skipBuckets - 1; i++) {
      if (smoothed[i] > smoothed[i - 1] || smoothed[i] > smoothed[i + 1]) continue;

      // Compute confidence: depth of dip vs surrounding ±2-min average
      const ctxLo   = Math.max(0, i - contextBuckets);
      const ctxHi   = Math.min(n - 1, i + contextBuckets);
      const localAvg = (sPrefix[ctxHi + 1] - sPrefix[ctxLo]) / (ctxHi - ctxLo + 1);
      const confidence = localAvg > 0 ? Math.max(0, 1 - smoothed[i] / localAvg) : 0;
      allMinima.push({ i, confidence });
    }

    // Greedily select count-1 candidates by descending confidence,
    // enforcing a minimum 3-minute separation between picks.
    const minSep  = Math.round(180000 / bucketMs);
    const wantN   = count > 0 ? count - 1 : allMinima.length;
    const byCconf = allMinima.slice().sort((a, b) => b.confidence - a.confidence);
    const selected = [];
    for (const cand of byCconf) {
      if (selected.length >= wantN) break;
      if (selected.some((s) => Math.abs(s.i - cand.i) < minSep)) continue;
      selected.push(cand);
    }
    selected.sort((a, b) => a.i - b.i);

    const bucketSecs  = bucketMs / 1000;
    const transitions = [
      { index: 0, seconds: 0, confidence: 1.0 },
      ...selected.map((c, idx) => ({
        index:      idx + 1,
        seconds:    Math.round(c.i * bucketSecs),
        confidence: Math.round(c.confidence * 100) / 100,
      })),
    ];

    res.json({ duration: Math.round(wf.duration), transitions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /api/sync-test-waveform
// Returns pre-computed waveform data for the sync test track (no ffmpeg needed).
// Sharp peaks at every second boundary so the spectrum aligns visually with the beeps.
app.get('/api/sync-test-waveform', (req, res) => {
  const bucketMs   = Math.max(25, Math.min(200, parseInt(req.query.bucketMs, 10) || 100));
  const bucketSecs = bucketMs / 1000;
  const DURATION   = 120;
  const numBuckets = Math.ceil(DURATION / bucketSecs);

  const peaks = new Uint8Array(numBuckets);
  const bass  = new Uint8Array(numBuckets);
  const mids  = new Uint8Array(numBuckets);
  const highs = new Uint8Array(numBuckets);

  for (let b = 0; b < numBuckets; b++) {
    const t = b * bucketSecs; // start time of this bucket
    // How close is the nearest second boundary?
    const nearestSec = Math.round(t);
    const dist = Math.abs(t - nearestSec); // seconds from nearest boundary
    // Marker beep (1 kHz) lasts 80 ms — if this bucket overlaps it, show peak + highs
    if (dist < 0.08) {
      const amp = Math.round(220 * (1 - dist / 0.08));
      peaks[b] = amp;
      highs[b] = amp;
    }
    // Number tone (pitch rises with second number) lasts 40 ms after the marker
    const secNum = Math.floor(t); // which second we're in
    const offsetInSec = t - secNum;
    if (offsetInSec >= 0.08 && offsetInSec < 0.12) {
      const amp = 180;
      peaks[b] = Math.max(peaks[b], amp);
      // Low seconds → bass, high seconds → treble
      const frac = Math.min(1, secNum / 100);
      bass[b]  = Math.round(amp * (1 - frac));
      mids[b]  = Math.round(amp * Math.sin(Math.PI * frac));
      highs[b] = Math.max(highs[b], Math.round(amp * frac));
    }
  }

  const toB64 = (arr) => Buffer.from(arr).toString('base64');
  res.json({
    duration:   DURATION,
    numBuckets,
    bucketSecs,
    peaks: toB64(peaks),
    bass:  toB64(bass),
    mids:  toB64(mids),
    highs: toB64(highs),
  });
});

// GET /api/sync-test
// Returns a 120-second WAV with a 1 kHz beep + lower tone every second.
// Each second N has: 0.08 s of 1 kHz (marker) + 0.04 s of N*100 Hz (number tone).
// Use this to visually confirm spectrum ↔ audio alignment.
app.get('/api/sync-test', (req, res) => {
  const RATE      = 44100;
  const DURATION  = 120; // seconds
  const numSamples = RATE * DURATION;
  const pcm = Buffer.alloc(numSamples * 2); // 16-bit mono

  for (let s = 0; s < DURATION; s++) {
    // marker beep: 1000 Hz for first 80 ms
    const markerSamples = Math.round(0.08 * RATE);
    for (let i = 0; i < markerSamples; i++) {
      const n = s * RATE + i;
      const v = Math.round(28000 * Math.sin(2 * Math.PI * 1000 * n / RATE));
      pcm.writeInt16LE(Math.max(-32768, Math.min(32767, v)), n * 2);
    }
    // number tone: (s+1)*80 Hz for next 40 ms, clamped to 8000 Hz
    const freq = Math.min(8000, (s + 1) * 80);
    const numToneSamples = Math.round(0.04 * RATE);
    const toneStart = s * RATE + markerSamples;
    for (let i = 0; i < numToneSamples; i++) {
      const n = toneStart + i;
      const v = Math.round(20000 * Math.sin(2 * Math.PI * freq * n / RATE));
      pcm.writeInt16LE(Math.max(-32768, Math.min(32767, v)), n * 2);
    }
  }

  // Build WAV header
  const dataLen = pcm.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLen, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);   // PCM
  header.writeUInt16LE(1, 22);   // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32);   // block align
  header.writeUInt16LE(16, 34);  // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(dataLen, 40);

  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Content-Length', header.length + dataLen);
  res.setHeader('Content-Disposition', 'inline; filename="sync-test.wav"');
  res.end(Buffer.concat([header, pcm]));
});

// Music index cache (keyed by root dir)
const indexCache = new Map();

// Recursively scan rootDir (BFS, max depth 5) and build a flat array of disc records
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
        } catch (_) {}
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
app.get('/api/index', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// GET /api/index-stream?root=<path> — SSE stream of index entries as they are found
app.get('/api/index-stream', async (req, res) => {
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
    if (!res.writableEnded) res.write(`data: {"done":true,"error":${JSON.stringify(err.message)}}\n\n`);
    res.end();
    return;
  }
  if (!res.writableEnded) { res.write('data: {"done":true}\n\n'); res.end(); }
});

// Artwork cache (keyed by absolute mp3 path)
const artworkCache = new Map();

// GET /api/artwork?path=<absolute mp3 path>
// Returns album art: checks folder for common image files first, then ffmpeg embedded art
app.get('/api/artwork', async (req, res) => {
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

// GET /api/reveal?path=<absolute path> — reveal file in the OS file manager
app.get('/api/reveal', (req, res) => {
  const target = resolveAndValidate(req.query.path, readLibrary());
  if (!target) return res.status(400).json({ error: 'path required' });
  const plat = process.platform;
  if (plat === 'darwin') {
    spawn('open', ['-R', target], { detached: true }).unref();
  } else if (plat === 'win32') {
    spawn('explorer', [`/select,${target}`], { detached: true }).unref();
  } else {
    // Linux: open the parent directory
    spawn('xdg-open', [path.dirname(target)], { detached: true }).unref();
  }
  res.json({ ok: true });
});

// GET /file?path=<absolute encoded path> — stream MP3 with range support
app.get('/file', (req, res) => {
  const filePath = resolveAndValidate(req.query.path, readLibrary());
  if (!filePath) {
    return res.status(400).send('path query parameter required');
  }

  const ext = path.extname(filePath).toLowerCase();
  if (!AUDIO_FILE_EXTS.has(ext)) {
    return res.status(400).send('File type not allowed');
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  const stat = fs.statSync(filePath);
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

// CLI: optional directory argument
const cliDir = process.argv[2];

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Tracklist Player running at http://127.0.0.1:${PORT}`);
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

// ── Online tracklist scraping (MixesDB) ───────────────────────────────────────
const TL_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function stripTags(str) {
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

// Search MixesDB for DJ mix tracklists matching a query
app.get('/api/tracklist-search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q required' });
  const url = `https://www.mixesdb.com/w/index.php?title=Special%3ASearch&search=${encodeURIComponent(q)}&fulltext=1&limit=20`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': TL_UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();

    // Limit to the search results list to avoid nav/sidebar/language links
    const sectionMatch = html.match(/class="mw-search-results"[\s\S]*?<\/ul>/);
    const section = sectionMatch ? sectionMatch[0] : '';
    if (!section) { res.json({ results: [] }); return; }

    const results = [];
    // Each result heading: mw-search-result-heading"><a href="/w/..." title="...">
    const re = /mw-search-result-heading[\s\S]{1,400}?href="(\/w\/[^"?#:]+)"[^>]*title="([^"]+)"/g;
    let m;
    while ((m = re.exec(section)) !== null) {
      results.push({ title: m[2], url: 'https://www.mixesdb.com' + m[1] });
    }
    const seen = new Set();
    const deduped = results.filter((r) => { if (seen.has(r.url)) return false; seen.add(r.url); return true; });
    res.json({ results: deduped.slice(0, 20) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fetch and parse a MixesDB tracklist page
app.get('/api/tracklist-fetch', async (req, res) => {
  const url = (req.query.url || '').trim();
  if (!url.startsWith('https://www.mixesdb.com/w/')) {
    return res.status(400).json({ error: 'invalid url' });
  }
  try {
    const r = await fetch(url, { headers: { 'User-Agent': TL_UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();

    // Extract the main content area (stop before "Related mixes" and "Comments")
    const contentMatch = html.match(/id="mw-content-text"([\s\S]*?)(?:id="relatedPages"|id="comments"|<\/div>\s*<div id="bodyBottom)/);
    const content = contentMatch ? contentMatch[1] : html;

    // Find the first <ol> in the content (the tracklist)
    const olMatch = content.match(/<ol>([\s\S]*?)<\/ol>/);
    const tracks = [];
    if (olMatch) {
      const liRe = /<li>([\s\S]*?)<\/li>/g;
      let m;
      while ((m = liRe.exec(olMatch[1])) !== null) {
        const text = stripTags(m[1]).trim();
        if (!text) continue;
        // Some pages include [MMM] minute timecodes; most don't
        const timedMatch = text.match(/^\[(\d+)\]\s+(.+)$/);
        if (timedMatch) {
          const rest = timedMatch[2].trim();
          const dash = rest.indexOf(' - ');
          tracks.push({
            startSeconds: parseInt(timedMatch[1], 10) * 60,
            performer: dash > 0 ? rest.slice(0, dash).trim() : '',
            title: dash > 0 ? rest.slice(dash + 3).trim() : rest,
          });
        } else {
          const dash = text.indexOf(' - ');
          tracks.push({
            startSeconds: null, // no timecode on this page
            performer: dash > 0 ? text.slice(0, dash).trim() : '',
            title: dash > 0 ? text.slice(dash + 3).trim() : text,
          });
        }
      }
    }

    const titleM = html.match(/<h1[^>]*id="firstHeading"[^>]*>([\s\S]*?)<\/h1>/);
    const pageTitle = titleM ? stripTags(titleM[1]) : url.split('/w/')[1]?.replace(/_/g, ' ') || '';
    const hasTimes = tracks.some((t) => t.startSeconds !== null);
    res.json({ title: pageTitle, tracks, hasTimes, sourceUrl: url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── SoundCloud web client_id scraper ─────────────────────────────────────────
// SoundCloud's v2 API (api-v2.soundcloud.com) requires the web app's own
// client_id, not the registered-app client_id which is blocked from streaming.
// We scrape it from their JS bundle once per day and cache it in memory.
let scWebClientId = null;
let scWebClientIdFetchedAt = 0;

async function getSoundcloudWebClientId() {
  if (scWebClientId && Date.now() - scWebClientIdFetchedAt < 24 * 60 * 60 * 1000) {
    return scWebClientId;
  }
  const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  try {
    const homeRes = await fetch('https://soundcloud.com', { headers: { 'User-Agent': UA } });
    if (!homeRes.ok) return null;
    const html = await homeRes.text();
    // Collect asset script URLs
    const assetUrls = [];
    const re = /src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g;
    let m;
    while ((m = re.exec(html)) !== null) assetUrls.push(m[1]);
    // Check last few scripts — the main bundle is usually near the end
    for (const url of assetUrls.slice(-5).reverse()) {
      const jsRes = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!jsRes.ok) continue;
      const js = await jsRes.text();
      // Various patterns SoundCloud has used across bundle versions
      const patterns = [
        /,client_id:"([a-zA-Z0-9]{20,})"/,
        /"client_id":"([a-zA-Z0-9]{20,})"/,
        /client_id=([a-zA-Z0-9]{20,})/,
        /\bclientId\s*:\s*"([a-zA-Z0-9]{20,})"/,
      ];
      for (const pat of patterns) {
        const hit = js.match(pat);
        if (hit && hit[1]) {
          scWebClientId = hit[1];
          scWebClientIdFetchedAt = Date.now();
          console.log('[SC] web client_id scraped:', scWebClientId.slice(0, 8) + '...');
          return scWebClientId;
        }
      }
    }
  } catch (e) {
    console.log('[SC] web client_id scrape error:', e.message);
  }
  return null;
}

// ── SoundCloud OAuth helpers ──────────────────────────────────────────────────
const SOUNDCLOUD_CONFIG_PATH = path.join(os.homedir(), '.tracklistplayer', 'soundcloud.json');
const SOUNDCLOUD_REDIRECT_URI = 'http://127.0.0.1:3123/auth/soundcloud/callback';

async function readSoundcloudConfig() {
  try {
    const data = await fs.promises.readFile(SOUNDCLOUD_CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (_) {
    return {};
  }
}

async function writeSoundcloudConfig(data) {
  const dir = path.dirname(SOUNDCLOUD_CONFIG_PATH);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(SOUNDCLOUD_CONFIG_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

async function refreshSoundcloudToken(config) {
  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('client_id', config.client_id);
  params.set('client_secret', config.client_secret);
  params.set('refresh_token', config.refresh_token);
  const tokenRes = await fetch('https://api.soundcloud.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json; charset=utf-8' },
    body: params.toString(),
  });
  if (!tokenRes.ok) throw new Error('SoundCloud refresh failed');
  const tokenData = await tokenRes.json();
  const updated = {
    ...config,
    access_token: tokenData.access_token,
    expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
  };
  if (tokenData.refresh_token) updated.refresh_token = tokenData.refresh_token;
  await writeSoundcloudConfig(updated);
  return updated;
}

// GET /api/soundcloud/config
app.get('/api/soundcloud/config', async (_req, res) => {
  const config = await readSoundcloudConfig();
  res.json({ connected: !!(config.access_token && config.refresh_token) });
});

// POST /api/soundcloud/credentials
app.post('/api/soundcloud/credentials', async (req, res) => {
  const { client_id, client_secret } = req.body || {};
  if (!client_id || !client_secret) return res.status(400).json({ error: 'client_id and client_secret required' });
  const existing = await readSoundcloudConfig();
  await writeSoundcloudConfig({ ...existing, client_id, client_secret });
  res.json({ ok: true });
});

// GET /api/soundcloud/auth-url
app.get('/api/soundcloud/auth-url', async (_req, res) => {
  const config = await readSoundcloudConfig();
  if (!config.client_id) return res.status(400).json({ error: 'No client_id configured' });
  const state = crypto.randomBytes(16).toString('hex');
  pendingSoundcloudStates.set(state, Date.now() + 10 * 60 * 1000); // 10 min TTL
  const url = 'https://soundcloud.com/connect'
    + `?client_id=${encodeURIComponent(config.client_id)}`
    + `&redirect_uri=${encodeURIComponent(SOUNDCLOUD_REDIRECT_URI)}`
    + `&response_type=code`
    + `&scope=*`
    + `&state=${state}`
    + `&display=popup`;
  res.json({ url });
});

// GET /auth/soundcloud/callback
app.get('/auth/soundcloud/callback', async (req, res) => {
  const { code, error, state } = req.query;
  if (error) return res.send(`<!DOCTYPE html><html><head><title>SoundCloud Auth</title></head><body style="font-family:sans-serif;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div><h2 style="color:#e05050">Auth failed</h2><p>${serverEscapeHtml(String(error))}</p></div></body></html>`);
  if (!code) return res.status(400).send('No code');
  const stateExpiry = state && pendingSoundcloudStates.get(state);
  if (!stateExpiry || Date.now() > stateExpiry) return res.status(400).send('Invalid or expired state');
  pendingSoundcloudStates.delete(state);
  const config = await readSoundcloudConfig();
  if (!config.client_id || !config.client_secret) return res.status(400).send('SoundCloud credentials not configured');
  try {
    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('client_id', config.client_id);
    params.set('client_secret', config.client_secret);
    params.set('redirect_uri', SOUNDCLOUD_REDIRECT_URI);
    params.set('code', code);
    const tokenRes = await fetch('https://api.soundcloud.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json; charset=utf-8' },
      body: params.toString(),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return res.send(`<!DOCTYPE html><html><head><title>SoundCloud Auth</title></head><body style="font-family:sans-serif;background:#111;color:#fff;padding:40px"><h2 style="color:#e05050">Token exchange failed</h2><pre>${serverEscapeHtml(err)}</pre></body></html>`);
    }
    const tokenData = await tokenRes.json();
    await writeSoundcloudConfig({
      ...config,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
    });
    res.send(`<!DOCTYPE html><html><head><title>SoundCloud Connected</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh}.card{text-align:center;padding:40px}.logo{color:#f50;font-size:48px;margin-bottom:16px}h2{color:#f50;font-size:24px;margin-bottom:8px}p{color:#aaa;font-size:14px;margin-top:8px}</style></head><body><div class="card"><div class="logo">&#10003;</div><h2>Connected to SoundCloud</h2><p>You can close this window.</p></div></body></html>`);
  } catch (err) {
    res.send(`<!DOCTYPE html><html><head><title>SoundCloud Auth</title></head><body style="font-family:sans-serif;background:#111;color:#fff;padding:40px"><h2 style="color:#e05050">Error</h2><p>${serverEscapeHtml(err.message)}</p></body></html>`);
  }
});

// GET /api/soundcloud/status
app.get('/api/soundcloud/status', async (_req, res) => {
  let config = await readSoundcloudConfig();
  if (!config.access_token) return res.json({ connected: false });
  try {
    let meRes = await fetch('https://api.soundcloud.com/me', {
      headers: { 'Authorization': `OAuth ${config.access_token}`, 'Accept': 'application/json; charset=utf-8' },
    });
    if (meRes.status === 401 && config.refresh_token) {
      try { config = await refreshSoundcloudToken(config); } catch (_) {}
      meRes = await fetch('https://api.soundcloud.com/me', {
        headers: { 'Authorization': `OAuth ${config.access_token}`, 'Accept': 'application/json; charset=utf-8' },
      });
    }
    if (meRes.ok) {
      const me = await meRes.json();
      return res.json({ connected: true, displayName: me.username || me.full_name || 'SoundCloud User' });
    }
  } catch (_) {}
  res.json({ connected: !!(config.access_token) });
});

// GET /api/soundcloud/refresh
app.get('/api/soundcloud/refresh', async (_req, res) => {
  const config = await readSoundcloudConfig();
  if (!config.refresh_token) return res.status(401).json({ error: 'No refresh token' });
  try {
    const updated = await refreshSoundcloudToken(config);
    res.json({ access_token: updated.access_token, expires_at: updated.expires_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/soundcloud/playlists — user's own playlists (sets)
app.get('/api/soundcloud/playlists', async (_req, res) => {
  let config = await readSoundcloudConfig();
  if (!config.access_token) return res.status(401).json({ error: 'Not connected' });
  config = await ensureFreshToken(config, refreshSoundcloudToken);
  try {
    const scRes = await fetch('https://api.soundcloud.com/me/playlists?limit=50', {
      headers: { 'Authorization': `OAuth ${config.access_token}`, 'Accept': 'application/json; charset=utf-8' },
    });
    if (!scRes.ok) return res.status(scRes.status).json({ error: `SoundCloud API error ${scRes.status}` });
    const data = await scRes.json();
    res.json(Array.isArray(data) ? data : []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/soundcloud/liked?next_href=
app.get('/api/soundcloud/liked', async (req, res) => {
  let config = await readSoundcloudConfig();
  if (!config.access_token) return res.status(401).json({ error: 'Not connected' });
  config = await ensureFreshToken(config, refreshSoundcloudToken);
  try {
    const nextHref = req.query.next_href;
    if (nextHref && !nextHref.startsWith('https://api.soundcloud.com/')) {
      return res.status(400).json({ error: 'Invalid next_href' });
    }
    const url = nextHref
      ? nextHref
      : 'https://api.soundcloud.com/me/favorites?limit=50&linked_partitioning=1';
    const scRes = await fetch(url, {
      headers: {
        'Authorization': `OAuth ${config.access_token}`,
        'Accept': 'application/json; charset=utf-8',
      },
    });
    if (!scRes.ok) return res.status(scRes.status).json({ error: `SoundCloud API error ${scRes.status}` });
    const data = await scRes.json();
    res.json({ collection: data.collection || [], next_href: data.next_href || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CDN URL cache keyed by track id (avoids re-resolving on every range request)
const soundcloudCdnCache = new Map();

// GET /api/soundcloud/stream/:id
app.get('/api/soundcloud/stream/:id', async (req, res) => {
  let config = await readSoundcloudConfig();
  if (!config.access_token) return res.status(401).json({ error: 'Not connected' });
  config = await ensureFreshToken(config, refreshSoundcloudToken);

  const id = req.params.id;

  // Use cached CDN URL if still fresh
  let cdnUrl = null;
  const cached = soundcloudCdnCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    cdnUrl = cached.url;
  } else {
    // v2 API: find progressive (direct MP3) transcoding using web client_id
    const webCid = await getSoundcloudWebClientId();

    if (webCid) {
      // Use browser-like headers WITHOUT OAuth token — mixing OAuth + web client_id causes 403
      const browserHeaders = {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Origin': 'https://soundcloud.com',
        'Referer': 'https://soundcloud.com/',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      };
      try {
        const v2Res = await fetch(
          `https://api-v2.soundcloud.com/tracks/${encodeURIComponent(id)}?client_id=${encodeURIComponent(webCid)}`,
          { headers: browserHeaders }
        );
        if (v2Res.ok) {
          const td = await v2Res.json();
          const transcodings = (td.media && td.media.transcodings) || [];
          const prog = transcodings.find((t) => t.format && t.format.protocol === 'progressive');
          if (prog && prog.url) {
            const resolveUrl = `${prog.url}${prog.url.includes('?') ? '&' : '?'}client_id=${encodeURIComponent(webCid)}`;
            const sr = await fetch(resolveUrl, { headers: browserHeaders });
            if (sr.ok) {
              const sd = await sr.json();
              cdnUrl = sd.url || null;
            }
          }
        }
      } catch (e) {
        console.log('[SC stream] v2 error:', e.message);
      }
    }

    if (cdnUrl) {
      soundcloudCdnCache.set(id, { url: cdnUrl, expiresAt: Date.now() + 4 * 60 * 1000 });
    } else {
      try {
        const r = await fetch(
          `https://api.soundcloud.com/tracks/${encodeURIComponent(id)}/stream`,
          { redirect: 'follow', headers: { 'Authorization': `OAuth ${config.access_token}` } }
        );
        if (!r.ok) return res.status(r.status).json({ error: 'SoundCloud stream error' });
        cdnUrl = r.url;
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  }

  // Proxy with Range support using https module (reliable Node.js stream piping)
  try {
    const urlObj = new URL(cdnUrl);
    const upstreamHeaders = {};
    if (req.headers.range) upstreamHeaders['Range'] = req.headers.range;
    https.get({ hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, headers: upstreamHeaders }, (upstream) => {
      const outHeaders = { 'Accept-Ranges': 'bytes' };
      if (upstream.headers['content-type']) outHeaders['Content-Type'] = upstream.headers['content-type'];
      if (upstream.headers['content-length']) outHeaders['Content-Length'] = upstream.headers['content-length'];
      if (upstream.headers['content-range']) outHeaders['Content-Range'] = upstream.headers['content-range'];
      res.writeHead(upstream.statusCode, outHeaders);
      upstream.pipe(res);
      req.on('close', () => upstream.destroy());
    }).on('error', (err) => {
      console.log('[SC stream] https error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    });
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// GET /api/soundcloud/disconnect
app.get('/api/soundcloud/disconnect', async (_req, res) => {
  const config = await readSoundcloudConfig();
  await writeSoundcloudConfig({ client_id: config.client_id || '', client_secret: config.client_secret || '' });
  res.json({ ok: true });
});

// ── Spotify search & add-to-playlist ─────────────────────────────────────────

// GET /api/spotify/search?q=<query>&type=track
app.get('/api/spotify/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q required' });
  let config = await readSpotifyConfig();
  if (!config.access_token) return res.status(401).json({ error: 'Not connected' });
  config = await ensureFreshToken(config, refreshSpotifyToken);
  const type = req.query.type || 'track';
  try {
    const spotRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&limit=5`,
      { headers: { 'Authorization': `Bearer ${config.access_token}` } }
    );
    if (!spotRes.ok) return res.status(spotRes.status).json({ error: 'Spotify API error' });
    res.json(await spotRes.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/spotify/add-to-playlist — { playlistId, trackUri }
app.post('/api/spotify/add-to-playlist', async (req, res) => {
  const { playlistId, trackUri } = req.body || {};
  if (!playlistId || !trackUri) return res.status(400).json({ error: 'playlistId and trackUri required' });
  let config = await readSpotifyConfig();
  if (!config.access_token) return res.status(401).json({ error: 'Not connected' });
  config = await ensureFreshToken(config, refreshSpotifyToken);
  try {
    const spotRes = await fetch(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: [trackUri] }),
      }
    );
    if (!spotRes.ok) {
      const errBody = await spotRes.text();
      return res.status(spotRes.status).json({ error: `Spotify API error ${spotRes.status}: ${errBody}` });
    }
    res.json(await spotRes.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Last.fm config & scrobbling ──────────────────────────────────────────────
const LASTFM_CONFIG_PATH = path.join(os.homedir(), '.tracklistplayer', 'lastfm.json');
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

async function readLastfmConfig() {
  try {
    const data = await fs.promises.readFile(LASTFM_CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (_) {
    return {};
  }
}

async function writeLastfmConfig(data) {
  const dir = path.dirname(LASTFM_CONFIG_PATH);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(LASTFM_CONFIG_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

// Build Last.fm api_sig: md5 of sorted params (excluding format) concatenated + shared secret
function lastfmApiSig(params, sharedSecret) {
  const keys = Object.keys(params).filter((k) => k !== 'format').sort();
  let sig = '';
  for (const k of keys) {
    sig += k + params[k];
  }
  sig += sharedSecret;
  return crypto.createHash('md5').update(sig, 'utf8').digest('hex');
}

// GET /api/lastfm/config — return { api_key (masked), connected, username }
app.get('/api/lastfm/config', async (_req, res) => {
  const config = await readLastfmConfig();
  const apiKey = config.api_key || '';
  res.json({
    api_key: apiKey ? apiKey.slice(0, 4) + '...' + apiKey.slice(-4) : '',
    connected: !!config.session_key,
    username: config.username || '',
  });
});

// POST /api/lastfm/credentials — save { apiKey, sharedSecret }
app.post('/api/lastfm/credentials', async (req, res) => {
  const { apiKey, sharedSecret } = req.body || {};
  if (!apiKey || !sharedSecret) return res.status(400).json({ error: 'apiKey and sharedSecret required' });
  const existing = await readLastfmConfig();
  await writeLastfmConfig({ ...existing, api_key: apiKey, shared_secret: sharedSecret });
  res.json({ ok: true });
});

// GET /api/lastfm/auth-url — generate Last.fm auth URL
app.get('/api/lastfm/auth-url', async (_req, res) => {
  const config = await readLastfmConfig();
  if (!config.api_key) return res.status(400).json({ error: 'No api_key configured' });
  const url = `http://www.last.fm/api/auth/?api_key=${encodeURIComponent(config.api_key)}`
    + `&cb=${encodeURIComponent('http://127.0.0.1:3123/auth/lastfm/callback')}`;
  res.json({ url });
});

// GET /auth/lastfm/callback?token=<token> — exchange token for session key
app.get('/auth/lastfm/callback', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('No token');
  const config = await readLastfmConfig();
  if (!config.api_key || !config.shared_secret) return res.status(400).send('Last.fm credentials not configured');
  try {
    const params = {
      method: 'auth.getSession',
      api_key: config.api_key,
      token: token,
    };
    params.api_sig = lastfmApiSig(params, config.shared_secret);
    params.format = 'json';
    const qs = new URLSearchParams(params).toString();
    const lfmRes = await fetch(`${LASTFM_API_URL}?${qs}`);
    if (!lfmRes.ok) {
      const err = await lfmRes.text();
      return res.send(`<!DOCTYPE html><html><head><title>Last.fm Auth</title></head><body style="font-family:sans-serif;background:#1a1a2e;color:#fff;padding:40px"><h2 style="color:#e05050">Session exchange failed</h2><pre>${serverEscapeHtml(err)}</pre></body></html>`);
    }
    const lfmData = await lfmRes.json();
    if (lfmData.error) {
      return res.send(`<!DOCTYPE html><html><head><title>Last.fm Auth</title></head><body style="font-family:sans-serif;background:#1a1a2e;color:#fff;padding:40px"><h2 style="color:#e05050">Error</h2><p>${serverEscapeHtml(lfmData.message || 'Unknown error')}</p></body></html>`);
    }
    const session = lfmData.session || {};
    await writeLastfmConfig({
      ...config,
      session_key: session.key,
      username: session.name || '',
    });
    res.send(`<!DOCTYPE html><html><head><title>Last.fm Connected</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh}.card{text-align:center;padding:40px}.logo{color:#d51007;font-size:48px;margin-bottom:16px}h2{color:#d51007;font-size:24px;margin-bottom:8px}p{color:#aaa;font-size:14px;margin-top:8px}</style></head><body><div class="card"><div class="logo">&#10003;</div><h2>Connected to Last.fm</h2><p>You can close this window.</p></div></body></html>`);
  } catch (err) {
    res.send(`<!DOCTYPE html><html><head><title>Last.fm Auth</title></head><body style="font-family:sans-serif;background:#1a1a2e;color:#fff;padding:40px"><h2 style="color:#e05050">Error</h2><p>${serverEscapeHtml(err.message)}</p></body></html>`);
  }
});

// POST /api/lastfm/scrobble — { artist, track, timestamp, album }
app.post('/api/lastfm/scrobble', async (req, res) => {
  const { artist, track, timestamp, album } = req.body || {};
  if (!artist || !track) return res.status(400).json({ error: 'artist and track required' });
  const config = await readLastfmConfig();
  if (!config.session_key) return res.status(401).json({ error: 'Not connected to Last.fm' });
  try {
    const params = {
      method: 'track.scrobble',
      api_key: config.api_key,
      sk: config.session_key,
      artist: artist,
      track: track,
      timestamp: String(timestamp || Math.floor(Date.now() / 1000)),
    };
    if (album) params.album = album;
    params.api_sig = lastfmApiSig(params, config.shared_secret);
    params.format = 'json';
    const lfmRes = await fetch(LASTFM_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    if (!lfmRes.ok) {
      const err = await lfmRes.text();
      return res.status(lfmRes.status).json({ error: `Last.fm API error: ${err}` });
    }
    res.json(await lfmRes.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/lastfm/now-playing — { artist, track, album }
app.post('/api/lastfm/now-playing', async (req, res) => {
  const { artist, track, album } = req.body || {};
  if (!artist || !track) return res.status(400).json({ error: 'artist and track required' });
  const config = await readLastfmConfig();
  if (!config.session_key) return res.status(401).json({ error: 'Not connected to Last.fm' });
  try {
    const params = {
      method: 'track.updateNowPlaying',
      api_key: config.api_key,
      sk: config.session_key,
      artist: artist,
      track: track,
    };
    if (album) params.album = album;
    params.api_sig = lastfmApiSig(params, config.shared_secret);
    params.format = 'json';
    const lfmRes = await fetch(LASTFM_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    if (!lfmRes.ok) {
      const err = await lfmRes.text();
      return res.status(lfmRes.status).json({ error: `Last.fm API error: ${err}` });
    }
    res.json(await lfmRes.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/lastfm/disconnect — clear session_key
app.get('/api/lastfm/disconnect', async (_req, res) => {
  const config = await readLastfmConfig();
  await writeLastfmConfig({ api_key: config.api_key || '', shared_secret: config.shared_secret || '' });
  res.json({ ok: true });
});

// ── Audio decode endpoint (for BPM detection) ───────────────────────────────

// GET /api/decode?path=<mp3>&start=<seconds>&end=<seconds>
app.get('/api/decode', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = server;
