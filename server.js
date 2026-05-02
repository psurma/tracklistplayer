'use strict';

const express = require('express');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = 3123;
const HOST = '127.0.0.1';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // No 'unsafe-inline' — all scripts come from bundled files in /public.
      scriptSrc: ["'self'", "https://sdk.scdn.co"],
      // Spotify Web Playback SDK iframe loads sub-resources; its inline
      // scripts execute inside the sandboxed iframe served by sdk.scdn.co,
      // not the parent document.
      scriptSrcElem: ["'self'", "https://sdk.scdn.co"],
      connectSrc: ["'self'", "https://api.spotify.com", "https://sdk.scdn.co", "wss://dealer.spotify.com", "wss://*.spotify.com"],
      frameSrc: ["https://sdk.scdn.co"],
      imgSrc: ["'self'", "data:", "https://i.scdn.co", "https://*.sndcdn.com", "https://coverartarchive.org", "https://*.archive.org"],
      mediaSrc: ["'self'", "blob:", "https://cf-media.sndcdn.com", "https://*.sndcdn.com"],
      // 'unsafe-inline' for styles is retained: existing inline `style="…"`
      // attributes throughout app.bundle.js + many `el.style.x = …` writes
      // would otherwise break. Stylesheet sources still 'self'.
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  // Disable the Cross-Origin-Embedder-Policy default; the Spotify SDK iframe
  // would otherwise be blocked.
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: '2mb' }));

// ── Origin + Host guard ──────────────────────────────────────────────────────
// Defends against:
//   - cross-origin browser requests from a malicious tab (Origin header check)
//   - DNS rebinding to 127.0.0.1:3123 (Host header check)
// Applies to ALL routes (including /file and /auth/*), not just /api/*.
const ALLOWED_HOSTS = new Set([`${HOST}:${PORT}`, `localhost:${PORT}`]);
const ALLOWED_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (!ALLOWED_HOSTS.has(host)) {
    return res.status(403).json({ error: 'Forbidden host' });
  }
  const origin = req.headers.origin || '';
  if (origin && !ALLOWED_ORIGIN_RE.test(origin)) {
    return res.status(403).json({ error: 'Forbidden origin' });
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ── Route modules ────────────────────────────────────────────────────────────
app.use(require('./routes/library'));
app.use(require('./routes/spotify'));
app.use(require('./routes/soundcloud'));
app.use(require('./routes/lastfm'));
app.use(require('./routes/files'));
app.use(require('./routes/waveform'));
app.use(require('./routes/music-index'));
app.use(require('./routes/tracklist'));
app.use(require('./routes/favorites'));

// CLI: optional directory argument
const cliDir = process.argv[2];

// Pass CLI dir to frontend via a small API endpoint
app.get('/api/config', (req, res) => {
  res.json({ dir: cliDir || '' });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Tracklist Player running at http://${HOST}:${PORT}`);
  if (cliDir) {
    console.log(`Auto-loading directory: ${cliDir}`);
  } else {
    console.log('Usage: node server.js /path/to/music/directory');
  }
});

module.exports = server;
