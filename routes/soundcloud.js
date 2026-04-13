'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { BoundedMap, serverEscapeHtml, ensureFreshToken } = require('../lib/helpers');
const { pendingSoundcloudStates } = require('../lib/oauth');

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

// SoundCloud web client_id scraper
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
    const assetUrls = [];
    const re = /src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g;
    let m;
    while ((m = re.exec(html)) !== null) assetUrls.push(m[1]);
    for (const url of assetUrls.slice(-5).reverse()) {
      const jsRes = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!jsRes.ok) continue;
      const js = await jsRes.text();
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

// CDN URL cache keyed by track id
const soundcloudCdnCache = new BoundedMap(200);

// GET /api/soundcloud/config
router.get('/api/soundcloud/config', async (_req, res) => {
  const config = await readSoundcloudConfig();
  res.json({ connected: !!(config.access_token && config.refresh_token) });
});

// POST /api/soundcloud/credentials
router.post('/api/soundcloud/credentials', async (req, res) => {
  const { client_id, client_secret } = req.body || {};
  if (!client_id || !client_secret) return res.status(400).json({ error: 'client_id and client_secret required' });
  const existing = await readSoundcloudConfig();
  await writeSoundcloudConfig({ ...existing, client_id, client_secret });
  res.json({ ok: true });
});

// GET /api/soundcloud/auth-url
router.get('/api/soundcloud/auth-url', async (_req, res) => {
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
router.get('/auth/soundcloud/callback', async (req, res) => {
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
router.get('/api/soundcloud/status', async (_req, res) => {
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

// POST /api/soundcloud/refresh
router.post('/api/soundcloud/refresh', async (_req, res) => {
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
router.get('/api/soundcloud/playlists', async (_req, res) => {
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
router.get('/api/soundcloud/liked', async (req, res) => {
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

// GET /api/soundcloud/stream/:id
router.get('/api/soundcloud/stream/:id', async (req, res) => {
  let config = await readSoundcloudConfig();
  if (!config.access_token) return res.status(401).json({ error: 'Not connected' });
  config = await ensureFreshToken(config, refreshSoundcloudToken);

  const id = req.params.id;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid track ID' });

  // Use cached CDN URL if still fresh
  let cdnUrl = null;
  const cached = soundcloudCdnCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    cdnUrl = cached.url;
  } else {
    // v2 API: find progressive (direct MP3) transcoding using web client_id
    const webCid = await getSoundcloudWebClientId();

    if (webCid) {
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

  // Proxy with Range support using https module
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

// POST /api/soundcloud/disconnect
router.post('/api/soundcloud/disconnect', async (_req, res) => {
  const config = await readSoundcloudConfig();
  await writeSoundcloudConfig({ client_id: config.client_id || '', client_secret: config.client_secret || '' });
  res.json({ ok: true });
});

module.exports = router;
