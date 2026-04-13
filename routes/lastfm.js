'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { serverEscapeHtml } = require('../lib/helpers');
const { getPendingLastfmAuth, setPendingLastfmAuth } = require('../lib/oauth');

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
router.get('/api/lastfm/config', async (_req, res) => {
  const config = await readLastfmConfig();
  const apiKey = config.api_key || '';
  res.json({
    api_key: apiKey ? apiKey.slice(0, 4) + '...' + apiKey.slice(-4) : '',
    connected: !!config.session_key,
    username: config.username || '',
  });
});

// POST /api/lastfm/credentials — save { apiKey, sharedSecret }
router.post('/api/lastfm/credentials', async (req, res) => {
  const { apiKey, sharedSecret } = req.body || {};
  if (!apiKey || !sharedSecret) return res.status(400).json({ error: 'apiKey and sharedSecret required' });
  const existing = await readLastfmConfig();
  await writeLastfmConfig({ ...existing, api_key: apiKey, shared_secret: sharedSecret });
  res.json({ ok: true });
});

// GET /api/lastfm/auth-url — generate Last.fm auth URL
router.get('/api/lastfm/auth-url', async (_req, res) => {
  const config = await readLastfmConfig();
  if (!config.api_key) return res.status(400).json({ error: 'No api_key configured' });
  setPendingLastfmAuth(Date.now() + 10 * 60 * 1000); // 10 min TTL
  const url = `http://www.last.fm/api/auth/?api_key=${encodeURIComponent(config.api_key)}`
    + `&cb=${encodeURIComponent('http://127.0.0.1:3123/auth/lastfm/callback')}`;
  res.json({ url });
});

// GET /auth/lastfm/callback?token=<token> — exchange token for session key
router.get('/auth/lastfm/callback', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('No token');
  const pendingLastfmAuth = getPendingLastfmAuth();
  if (!pendingLastfmAuth || Date.now() > pendingLastfmAuth) return res.status(400).send('No pending auth flow');
  setPendingLastfmAuth(0);
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
router.post('/api/lastfm/scrobble', async (req, res) => {
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
router.post('/api/lastfm/now-playing', async (req, res) => {
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

// POST /api/lastfm/disconnect — clear session_key
router.post('/api/lastfm/disconnect', async (_req, res) => {
  const config = await readLastfmConfig();
  await writeLastfmConfig({ api_key: config.api_key || '', shared_secret: config.shared_secret || '' });
  res.json({ ok: true });
});

module.exports = router;
