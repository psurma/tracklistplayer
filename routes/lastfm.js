'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const { serverEscapeHtml } = require('../lib/helpers');
const { getPendingLastfmAuth, setPendingLastfmAuth } = require('../lib/oauth');
const { TLP_DIR, createConfigStore, requireAuth } = require('../lib/oauth-helpers');
const { fetchWithTimeout } = require('../lib/http');

const lastfmConfig = createConfigStore(path.join(TLP_DIR, 'lastfm.json'));
const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';

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
  const config = await lastfmConfig.read();
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
  const existing = await lastfmConfig.read();
  await lastfmConfig.write({ ...existing, api_key: apiKey, shared_secret: sharedSecret });
  res.json({ ok: true });
});

// GET /api/lastfm/auth-url — generate Last.fm auth URL
router.get('/api/lastfm/auth-url', async (_req, res) => {
  const config = await lastfmConfig.read();
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
  const config = await lastfmConfig.read();
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
    const lfmRes = await fetchWithTimeout(`${LASTFM_API_URL}?${qs}`, {}, 15000);
    if (!lfmRes.ok) {
      const err = await lfmRes.text();
      return res.send(`<!DOCTYPE html><html><head><title>Last.fm Auth</title></head><body style="font-family:sans-serif;background:#1a1a2e;color:#fff;padding:40px"><h2 style="color:#e05050">Session exchange failed</h2><pre>${serverEscapeHtml(err)}</pre></body></html>`);
    }
    const lfmData = await lfmRes.json();
    if (lfmData.error) {
      return res.send(`<!DOCTYPE html><html><head><title>Last.fm Auth</title></head><body style="font-family:sans-serif;background:#1a1a2e;color:#fff;padding:40px"><h2 style="color:#e05050">Error</h2><p>${serverEscapeHtml(lfmData.message || 'Unknown error')}</p></body></html>`);
    }
    const session = lfmData.session || {};
    await lastfmConfig.write({
      ...config,
      session_key: session.key,
      username: session.name || '',
    });
    res.send(`<!DOCTYPE html><html><head><title>Last.fm Connected</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#1a1a2e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh}.card{text-align:center;padding:40px}.logo{color:#d51007;font-size:48px;margin-bottom:16px}h2{color:#d51007;font-size:24px;margin-bottom:8px}p{color:#aaa;font-size:14px;margin-top:8px}</style></head><body><div class="card"><div class="logo">&#10003;</div><h2>Connected to Last.fm</h2><p>You can close this window.</p></div></body></html>`);
  } catch (err) {
    res.send(`<!DOCTYPE html><html><head><title>Last.fm Auth</title></head><body style="font-family:sans-serif;background:#1a1a2e;color:#fff;padding:40px"><h2 style="color:#e05050">Error</h2><p>${serverEscapeHtml(err.message)}</p></body></html>`);
  }
});

// Shared helper for the two scrobble endpoints (DRY)
async function callLastfmMethod(method, fields, config) {
  const params = {
    method,
    api_key: config.api_key,
    sk: config.session_key,
    ...fields,
  };
  params.api_sig = lastfmApiSig(params, config.shared_secret);
  params.format = 'json';
  return fetchWithTimeout(LASTFM_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  }, 10000);
}

// POST /api/lastfm/scrobble — { artist, track, timestamp, album }
router.post('/api/lastfm/scrobble', requireAuth(lastfmConfig, 'session_key'), async (req, res) => {
  const { artist, track, timestamp, album } = req.body || {};
  if (!artist || !track) return res.status(400).json({ error: 'artist and track required' });
  try {
    const fields = {
      artist,
      track,
      timestamp: String(timestamp || Math.floor(Date.now() / 1000)),
    };
    if (album) fields.album = album;
    const lfmRes = await callLastfmMethod('track.scrobble', fields, req.serviceConfig);
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
router.post('/api/lastfm/now-playing', requireAuth(lastfmConfig, 'session_key'), async (req, res) => {
  const { artist, track, album } = req.body || {};
  if (!artist || !track) return res.status(400).json({ error: 'artist and track required' });
  try {
    const fields = { artist, track };
    if (album) fields.album = album;
    const lfmRes = await callLastfmMethod('track.updateNowPlaying', fields, req.serviceConfig);
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
  const config = await lastfmConfig.read();
  await lastfmConfig.write({ api_key: config.api_key || '', shared_secret: config.shared_secret || '' });
  res.json({ ok: true });
});

module.exports = router;
