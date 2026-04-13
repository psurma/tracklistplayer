import { state } from './state.js';

let _scrobbleState = { trackKey: '', startTime: 0, scrobbled: false };

function lastfmUpdateNowPlaying(disc, trackIdx) {
  const t = disc.tracks[trackIdx];
  if (!t) return;
  fetch('/api/lastfm/now-playing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      artist: t.performer || disc.albumPerformer || 'Unknown',
      track: t.title || 'Unknown',
      album: disc.albumTitle || '',
    }),
  }).catch(() => {});
}

function lastfmScrobble(disc, trackIdx) {
  const t = disc.tracks[trackIdx];
  if (!t) return;
  fetch('/api/lastfm/scrobble', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      artist: t.performer || disc.albumPerformer || 'Unknown',
      track: t.title || 'Unknown',
      album: disc.albumTitle || '',
      timestamp: Math.floor(Date.now() / 1000),
    }),
  }).catch(() => {});
}

function checkScrobble(disc, trackIdx) {
  const t = disc.tracks[trackIdx];
  if (!t) return;
  const key = `${disc.mp3Path}:${trackIdx}`;
  if (_scrobbleState.trackKey !== key) {
    if (_scrobbleState.trackKey && !_scrobbleState.scrobbled) {
      const elapsed = (Date.now() - _scrobbleState.startTime) / 1000;
      if (elapsed >= 30) {
        const [oldPath, oldIdx] = _scrobbleState.trackKey.split(':');
        const oldDisc = state.discs.find((d) => d.mp3Path === oldPath);
        if (oldDisc) lastfmScrobble(oldDisc, parseInt(oldIdx, 10));
      }
    }
    _scrobbleState = { trackKey: key, startTime: Date.now(), scrobbled: false };
    lastfmUpdateNowPlaying(disc, trackIdx);
  } else if (!_scrobbleState.scrobbled) {
    const elapsed = (Date.now() - _scrobbleState.startTime) / 1000;
    const trackDur = t.durationSeconds || 240;
    if (elapsed >= 30 && elapsed >= trackDur * 0.5) {
      lastfmScrobble(disc, trackIdx);
      _scrobbleState.scrobbled = true;
    }
  }
}

const lastfmApiKeyInput   = document.getElementById('lastfm-api-key-input');
const lastfmSecretInput   = document.getElementById('lastfm-shared-secret-input');
const lastfmStatusEl      = document.getElementById('lastfm-settings-status');
const lastfmDisconnectRow = document.getElementById('lastfm-disconnect-row');

async function initLastfmSettings() {
  try {
    const res = await fetch('/api/lastfm/config');
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg.api_key) lastfmApiKeyInput.value = cfg.api_key;
    if (cfg.connected) {
      lastfmStatusEl.textContent = `Connected as ${cfg.username}`;
      lastfmDisconnectRow.classList.remove('hidden');
    }
  } catch (_) {}
}

// Last.fm settings event handlers
document.getElementById('lastfm-save-creds-btn')?.addEventListener('click', async () => {
  const apiKey = lastfmApiKeyInput.value.trim();
  const sharedSecret = lastfmSecretInput.value.trim();
  if (!apiKey || !sharedSecret) return;
  const res = await fetch('/api/lastfm/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, sharedSecret }),
  });
  lastfmStatusEl.textContent = res.ok ? 'Credentials saved' : 'Failed to save';
});

document.getElementById('lastfm-connect-btn')?.addEventListener('click', async () => {
  const res = await fetch('/api/lastfm/auth-url');
  if (!res.ok) return;
  const { url } = await res.json();
  window.open(url, '_blank');
  lastfmStatusEl.textContent = 'Authorize in browser, then return here...';
  const poll = setInterval(async () => {
    const r = await fetch('/api/lastfm/config');
    if (!r.ok) return;
    const cfg = await r.json();
    if (cfg.connected) {
      clearInterval(poll);
      lastfmStatusEl.textContent = `Connected as ${cfg.username}`;
      lastfmDisconnectRow.classList.remove('hidden');
    }
  }, 3000);
  setTimeout(() => clearInterval(poll), 120000);
});

document.getElementById('lastfm-disconnect-btn')?.addEventListener('click', async () => {
  await fetch('/api/lastfm/disconnect', { method: 'POST' });
  lastfmStatusEl.textContent = 'Disconnected';
  lastfmDisconnectRow.classList.add('hidden');
});

export { lastfmUpdateNowPlaying, lastfmScrobble, checkScrobble, initLastfmSettings };
