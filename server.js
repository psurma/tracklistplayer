'use strict';

const express = require('express');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = 3123;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://sdk.scdn.co"],
      connectSrc: ["'self'", "https://api.spotify.com", "https://sdk.scdn.co"],
      imgSrc: ["'self'", "data:", "https://i.scdn.co", "https://*.sndcdn.com", "https://coverartarchive.org", "https://*.archive.org"],
      mediaSrc: ["'self'", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.use(express.json());

// ── Origin guard ─────────────────────────────────────────────────────────────
// Block cross-origin requests to /api/* from non-localhost origins.
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin || '';
  if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
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

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Tracklist Player running at http://127.0.0.1:${PORT}`);
  if (cliDir) {
    console.log(`Auto-loading directory: ${cliDir}`);
  } else {
    console.log('Usage: node server.js /path/to/music/directory');
  }
});

module.exports = server;
