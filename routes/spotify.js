'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const { serverEscapeHtml, ensureFreshToken } = require('../lib/helpers');
const { pendingSpotifyStates } = require('../lib/oauth');
const { TLP_DIR, createConfigStore, requireAuth } = require('../lib/oauth-helpers');
const { fetchWithTimeout } = require('../lib/http');
const { refreshOAuthToken } = require('../lib/refresh');
const { logWarn } = require('../lib/logger');

const spotifyConfig = createConfigStore(path.join(TLP_DIR, 'spotify.json'));
const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:3123/auth/spotify/callback';
const SPOTIFY_SCOPES = 'user-library-read streaming user-read-playback-state user-modify-playback-state user-read-email user-read-private playlist-read-private playlist-read-collaborative playlist-modify-public playlist-modify-private';

async function refreshSpotifyToken(config) {
  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', config.refresh_token);
  const credentials = Buffer.from(`${config.client_id}:${config.client_secret}`).toString('base64');
  return refreshOAuthToken({
    tokenUrl: 'https://accounts.spotify.com/api/token',
    config,
    store: spotifyConfig,
    headers: { 'Authorization': `Basic ${credentials}` },
    params,
    context: 'spotify',
  });
}

// GET /api/spotify/config — return client_id and auth status
router.get('/api/spotify/config', async (req, res) => {
  const config = await spotifyConfig.read();
  res.json({
    client_id: config.client_id || '',
    connected: !!(config.access_token && config.refresh_token),
  });
});

// POST /api/spotify/credentials — save client_id + client_secret
router.post('/api/spotify/credentials', async (req, res) => {
  const { client_id, client_secret } = req.body || {};
  if (!client_id || !client_secret) return res.status(400).json({ error: 'client_id and client_secret required' });
  const existing = await spotifyConfig.read();
  await spotifyConfig.write({ ...existing, client_id, client_secret });
  res.json({ ok: true });
});

// GET /api/spotify/auth-url — generate Spotify authorize URL
router.get('/api/spotify/auth-url', async (req, res) => {
  const config = await spotifyConfig.read();
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
router.get('/auth/spotify/callback', async (req, res) => {
  const { code, error, state } = req.query;
  if (error) return res.send(`<!DOCTYPE html><html><head><title>Spotify Auth</title></head><body style="font-family:sans-serif;background:#191414;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div><h2 style="color:#e05050">Auth failed</h2><p>${serverEscapeHtml(String(error))}</p></div></body></html>`);
  if (!code) return res.status(400).send('No code');
  const stateExpiry = state && pendingSpotifyStates.get(state);
  if (!stateExpiry || Date.now() > stateExpiry) return res.status(400).send('Invalid or expired state');
  pendingSpotifyStates.delete(state);

  const config = await spotifyConfig.read();
  if (!config.client_id || !config.client_secret) return res.status(400).send('Spotify credentials not configured');

  try {
    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('code', code);
    params.set('redirect_uri', SPOTIFY_REDIRECT_URI);
    const credentials = Buffer.from(`${config.client_id}:${config.client_secret}`).toString('base64');
    const tokenRes = await fetchWithTimeout('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }, 15000);
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return res.send(`<!DOCTYPE html><html><head><title>Spotify Auth</title></head><body style="font-family:sans-serif;background:#191414;color:#fff;padding:40px"><h2 style="color:#e05050">Token exchange failed</h2><pre>${serverEscapeHtml(err)}</pre></body></html>`);
    }
    const tokenData = await tokenRes.json();
    await spotifyConfig.write({
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
router.get('/api/spotify/status', async (req, res) => {
  const config = await spotifyConfig.read();
  if (!config.access_token || !config.refresh_token) return res.json({ connected: false });
  try {
    const meRes = await fetchWithTimeout('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${config.access_token}` },
    }, 10000);
    if (meRes.ok) {
      const me = await meRes.json();
      return res.json({ connected: true, displayName: me.display_name || me.id || 'Spotify User', granted_scope: config.granted_scope || '' });
    }
    // Token might be expired — try to check after refresh
    if (meRes.status === 401 && config.refresh_token) {
      try {
        const updated = await refreshSpotifyToken(config);
        const me2Res = await fetchWithTimeout('https://api.spotify.com/v1/me', {
          headers: { 'Authorization': `Bearer ${updated.access_token}` },
        }, 10000);
        if (me2Res.ok) {
          const me2 = await me2Res.json();
          return res.json({ connected: true, displayName: me2.display_name || me2.id || 'Spotify User' });
        }
      } catch (err) { logWarn('spotify', err, 'status refresh'); }
    }
  } catch (err) { logWarn('spotify', err, 'status'); }
  res.json({ connected: !!(config.access_token), displayName: '' });
});

// POST /api/spotify/refresh — refresh access token
router.post('/api/spotify/refresh', async (req, res) => {
  const config = await spotifyConfig.read();
  if (!config.refresh_token) return res.status(401).json({ error: 'No refresh token' });
  try {
    const updated = await refreshSpotifyToken(config);
    res.json({ access_token: updated.access_token, expires_at: updated.expires_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/spotify/liked?offset=&limit= — proxy liked tracks
router.get('/api/spotify/liked', requireAuth(spotifyConfig), async (req, res) => {
  let config = await ensureFreshToken(req.serviceConfig, refreshSpotifyToken, 'spotify');

  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
  try {
    const spotRes = await fetchWithTimeout(`https://api.spotify.com/v1/me/tracks?offset=${offset}&limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${config.access_token}` },
    }, 15000);
    if (!spotRes.ok) return res.status(spotRes.status).json({ error: 'Spotify API error' });
    const data = await spotRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/spotify/playlists — list user's playlists
router.get('/api/spotify/playlists', requireAuth(spotifyConfig), async (req, res) => {
  let config = await ensureFreshToken(req.serviceConfig, refreshSpotifyToken, 'spotify');
  try {
    const r = await fetchWithTimeout('https://api.spotify.com/v1/me/playlists?limit=50', {
      headers: { 'Authorization': `Bearer ${config.access_token}` },
    }, 15000);
    if (!r.ok) return res.status(r.status).json({ error: 'Spotify API error' });
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/spotify/playlist-tracks?id=&offset=&limit=
router.get('/api/spotify/playlist-tracks', requireAuth(spotifyConfig), async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'id required' });
  let config = await ensureFreshToken(req.serviceConfig, refreshSpotifyToken, 'spotify');
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 50));
  try {
    const r = await fetchWithTimeout(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(id)}/tracks?offset=${offset}&limit=${limit}`,
      { headers: { 'Authorization': `Bearer ${config.access_token}` } },
      15000
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
router.get('/api/spotify/devices', requireAuth(spotifyConfig), async (req, res) => {
  let config = await ensureFreshToken(req.serviceConfig, refreshSpotifyToken, 'spotify');
  try {
    const devRes = await fetchWithTimeout('https://api.spotify.com/v1/me/player/devices', {
      headers: { 'Authorization': `Bearer ${config.access_token}` },
    }, 10000);
    if (!devRes.ok) return res.status(devRes.status).json({ error: 'Spotify API error' });
    res.json(await devRes.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/spotify/disconnect — remove tokens
router.post('/api/spotify/disconnect', async (req, res) => {
  const config = await spotifyConfig.read();
  await spotifyConfig.write({ client_id: config.client_id || '', client_secret: config.client_secret || '' });
  res.json({ ok: true });
});

// GET /api/spotify/search?q=<query>&type=track
router.get('/api/spotify/search', requireAuth(spotifyConfig), async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'q required' });
  let config = await ensureFreshToken(req.serviceConfig, refreshSpotifyToken, 'spotify');
  const type = req.query.type || 'track';
  try {
    const spotRes = await fetchWithTimeout(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&limit=5`,
      { headers: { 'Authorization': `Bearer ${config.access_token}` } },
      15000
    );
    if (!spotRes.ok) return res.status(spotRes.status).json({ error: 'Spotify API error' });
    res.json(await spotRes.json());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/spotify/add-to-playlist — { playlistId, trackUri }
router.post('/api/spotify/add-to-playlist', requireAuth(spotifyConfig), async (req, res) => {
  const { playlistId, trackUri } = req.body || {};
  if (!playlistId || !trackUri) return res.status(400).json({ error: 'playlistId and trackUri required' });
  let config = await ensureFreshToken(req.serviceConfig, refreshSpotifyToken, 'spotify');
  try {
    const spotRes = await fetchWithTimeout(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uris: [trackUri] }),
      },
      15000
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

module.exports = router;
