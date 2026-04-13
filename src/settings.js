import { state, STORAGE } from './state.js';
import { currentDisc } from './helpers.js';
import { audio, volumeBar, themeToggle } from './dom-refs.js';

// Registration pattern
let _applyTheme = null;
let _setWaveformVisible = null;
let _setTrackLabelsVisible = null;
let _setShuffleOn = null;
let _cycleRepeat = null;
let _getRepeatMode = null;
let _getShuffleOn = null;
let _fancyScrubber = null;
let _getCurrentWfPath = null;
let _loadWaveform = null;
let _connectSpotify = null;
let _disconnectSpotify = null;
let _connectSoundcloud = null;
let _disconnectSoundcloud = null;

function registerDeps(deps) {
  _applyTheme = deps.applyTheme;
  _setWaveformVisible = deps.setWaveformVisible;
  _setTrackLabelsVisible = deps.setTrackLabelsVisible;
  _setShuffleOn = deps.setShuffleOn;
  _cycleRepeat = deps.cycleRepeat;
  _getRepeatMode = deps.getRepeatMode;
  _getShuffleOn = deps.getShuffleOn;
  _fancyScrubber = deps.fancyScrubber;
  _getCurrentWfPath = deps.getCurrentWfPath;
  _loadWaveform = deps.loadWaveform;
  _connectSpotify = deps.connectSpotify;
  _disconnectSpotify = deps.disconnectSpotify;
  _connectSoundcloud = deps.connectSoundcloud;
  _disconnectSoundcloud = deps.disconnectSoundcloud;
}

// ── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (themeToggle) {
    themeToggle.textContent = theme === 'dark' ? '\u2600' : '\u263E';
  }
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    STORAGE.setTheme(next);
    if (_fancyScrubber) _fancyScrubber._invalidateCache();
  });
}

// ── Settings modal ───────────────────────────────────────────────────────────
const settingsBtn     = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsClose   = document.getElementById('settings-close');
const settingsVolume  = document.getElementById('settings-volume');
const settingsVolVal  = document.getElementById('settings-volume-val');

let waveformVisible = true;
function setWaveformVisibleLocal(v) { waveformVisible = v; }

function openSettings() {
  syncSettingsBtns('theme',       STORAGE.getTheme());
  syncSettingsBtns('spectrum',     waveformVisible ? 'on' : 'off');
  syncSettingsBtns('spectrumRes',  String(STORAGE.getSpectrumRes()));
  syncSettingsBtns('trackLabels',  STORAGE.getTrackLabels() ? 'on' : 'off');
  syncSettingsBtns('repeat',       _getRepeatMode ? _getRepeatMode() : STORAGE.getRepeat());
  syncSettingsBtns('shuffle',      _getShuffleOn ? (_getShuffleOn() ? 'on' : 'off') : (STORAGE.getShuffle() ? 'on' : 'off'));
  settingsVolume.value = audio.volume;
  settingsVolVal.textContent = Math.round(audio.volume * 100) + '%';
  // Populate Spotify credential fields
  fetch('/api/spotify/config').then((r) => r.json()).then((cfg) => {
    const cidInput = document.getElementById('spotify-client-id-input');
    if (cidInput) cidInput.value = cfg.client_id || '';
    const statusEl = document.getElementById('spotify-settings-status');
    if (statusEl) statusEl.textContent = cfg.connected ? 'Status: Connected' : '';
    const disconnectRow = document.getElementById('spotify-disconnect-row');
    if (disconnectRow) disconnectRow.classList.toggle('hidden', !cfg.connected);
  }).catch(() => {});
  settingsOverlay.classList.remove('hidden');
}

function closeSettings() {
  settingsOverlay.classList.add('hidden');
}

function syncSettingsBtns(setting, value) {
  settingsOverlay.querySelectorAll(`.seg-btn[data-setting="${setting}"]`).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}

settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) { closeSettings(); return; }
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  const { setting, value } = btn.dataset;
  syncSettingsBtns(setting, value);
  if (setting === 'theme') {
    applyTheme(value);
    STORAGE.setTheme(value);
    if (_fancyScrubber) {
      _fancyScrubber._invalidateCache();
      if (waveformVisible && _getCurrentWfPath && _getCurrentWfPath()) { _fancyScrubber._draw(); }
    }
  } else if (setting === 'spectrum') {
    if (_setWaveformVisible) _setWaveformVisible(value === 'on');
  } else if (setting === 'spectrumRes') {
    const ms = parseInt(value, 10);
    STORAGE.setSpectrumRes(ms);
    if (_loadWaveform) {
      const disc = currentDisc();
      if (disc) _loadWaveform(disc);
    }
  } else if (setting === 'repeat') {
    if (_cycleRepeat && _getRepeatMode) {
      while (_getRepeatMode() !== value) _cycleRepeat();
      STORAGE.setRepeat(_getRepeatMode());
    }
  } else if (setting === 'shuffle') {
    if (_setShuffleOn) {
      _setShuffleOn(value === 'on');
      STORAGE.setShuffle(value === 'on');
    }
  } else if (setting === 'trackLabels') {
    if (_setTrackLabelsVisible) _setTrackLabelsVisible(value === 'on');
  }
});
settingsClose.addEventListener('click', closeSettings);
settingsBtn.addEventListener('click', openSettings);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSettings(); });

settingsVolume.addEventListener('input', () => {
  const v = parseFloat(settingsVolume.value);
  audio.volume = v;
  volumeBar.value = v;
  STORAGE.setVolume(v);
  settingsVolVal.textContent = Math.round(v * 100) + '%';
});

// ── Reindex button ───────────────────────────────────────────────────────────
const reindexBtn    = document.getElementById('reindex-btn');
const reindexStatus = document.getElementById('reindex-status');

let _libraryFolders = [];
let _invalidateIndex = null;

function setLibraryFolders(v) { _libraryFolders = v; }
function setInvalidateIndex(fn) { _invalidateIndex = fn; }

if (reindexBtn) {
  reindexBtn.addEventListener('click', async () => {
    reindexBtn.disabled = true;
    reindexStatus.textContent = 'Rebuilding\u2026';
    if (_invalidateIndex) _invalidateIndex();
    try {
      const currentRoot = STORAGE.getDir();
      const rootsToBust = [...new Set([..._libraryFolders, currentRoot].filter(Boolean))];
      await Promise.all([
        _libraryFolders.length ? fetch('/api/library-index?bust=1') : null,
        ...rootsToBust.map((r) => fetch(`/api/index?root=${encodeURIComponent(r)}&bust=1`)),
      ].filter(Boolean));
      reindexStatus.textContent = 'Done \u2014 open search to use new index.';
    } catch (_) {
      reindexStatus.textContent = 'Failed \u2014 check console.';
    } finally {
      reindexBtn.disabled = false;
    }
  });
}

// ── Spotify settings handlers ────────────────────────────────────────────────
const spotifySaveCredsBtn      = document.getElementById('spotify-save-creds-btn');
const spotifyConnectSettingsBtn = document.getElementById('spotify-connect-settings-btn');
const spotifyDisconnectBtn      = document.getElementById('spotify-disconnect-btn');

if (spotifySaveCredsBtn) {
  spotifySaveCredsBtn.addEventListener('click', async () => {
    const clientId     = (document.getElementById('spotify-client-id-input') || {}).value || '';
    const clientSecret = (document.getElementById('spotify-client-secret-input') || {}).value || '';
    const statusEl = document.getElementById('spotify-settings-status');
    if (!clientId || !clientSecret) {
      if (statusEl) statusEl.textContent = 'Both Client ID and Client Secret are required.';
      return;
    }
    try {
      const res = await fetch('/api/spotify/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
      });
      if (res.ok) {
        if (statusEl) statusEl.textContent = 'Credentials saved.';
      } else {
        if (statusEl) statusEl.textContent = 'Save failed.';
      }
    } catch (_) {
      if (statusEl) { statusEl.textContent = 'Save failed.'; }
    }
  });
}

if (spotifyConnectSettingsBtn) {
  spotifyConnectSettingsBtn.addEventListener('click', async () => {
    closeSettings();
    if (_connectSpotify) await _connectSpotify();
  });
}

if (spotifyDisconnectBtn) {
  spotifyDisconnectBtn.addEventListener('click', async () => {
    if (_disconnectSpotify) await _disconnectSpotify();
    const statusEl = document.getElementById('spotify-settings-status');
    if (statusEl) statusEl.textContent = 'Disconnected.';
    const disconnectRow = document.getElementById('spotify-disconnect-row');
    if (disconnectRow) disconnectRow.classList.add('hidden');
  });
}

// ── SoundCloud settings handlers ─────────────────────────────────────────────
const soundcloudSaveCredsBtn       = document.getElementById('soundcloud-save-creds-btn');
const soundcloudConnectSettingsBtn = document.getElementById('soundcloud-connect-settings-btn');
const soundcloudDisconnectBtn      = document.getElementById('soundcloud-disconnect-btn');

if (soundcloudSaveCredsBtn) {
  soundcloudSaveCredsBtn.addEventListener('click', async () => {
    const clientId     = (document.getElementById('soundcloud-client-id-input') || {}).value || '';
    const clientSecret = (document.getElementById('soundcloud-client-secret-input') || {}).value || '';
    const statusEl = document.getElementById('soundcloud-settings-status');
    if (!clientId || !clientSecret) { if (statusEl) statusEl.textContent = 'Both fields required.'; return; }
    try {
      const res = await fetch('/api/soundcloud/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
      });
      if (statusEl) statusEl.textContent = res.ok ? 'Credentials saved.' : 'Save failed.';
    } catch (_) {
      if (statusEl) statusEl.textContent = 'Save failed.';
    }
  });
}

if (soundcloudConnectSettingsBtn) {
  soundcloudConnectSettingsBtn.addEventListener('click', async () => {
    closeSettings();
    if (_connectSoundcloud) await _connectSoundcloud();
  });
}

if (soundcloudDisconnectBtn) {
  soundcloudDisconnectBtn.addEventListener('click', async () => {
    if (_disconnectSoundcloud) await _disconnectSoundcloud();
    const statusEl = document.getElementById('soundcloud-settings-status');
    if (statusEl) statusEl.textContent = 'Disconnected.';
    const disconnectRow = document.getElementById('soundcloud-disconnect-row');
    if (disconnectRow) disconnectRow.classList.add('hidden');
  });
}

// ── Spotify save modal ───────────────────────────────────────────────────────
async function openSpotifySaveModal(title, performer) {
  const overlay = document.getElementById('spotify-save-overlay');
  const matchEl = document.getElementById('spotify-save-match');
  const statusEl = document.getElementById('spotify-save-status');
  const playlistsEl = document.getElementById('spotify-save-playlists');
  overlay.classList.remove('hidden');
  matchEl.innerHTML = '';
  statusEl.textContent = 'Searching Spotify...';
  playlistsEl.innerHTML = '';

  const { escapeHtml } = await import('./helpers.js');
  const q = encodeURIComponent(`${performer ? performer + ' ' : ''}${title}`);
  try {
    const searchRes = await fetch(`/api/spotify/search?q=${q}&type=track`);
    if (!searchRes.ok) { statusEl.textContent = 'Search failed'; return; }
    const data = await searchRes.json();
    const tracks = data.tracks?.items || [];
    if (!tracks.length) { statusEl.textContent = 'No matches found'; return; }
    const track = tracks[0];
    matchEl.innerHTML = `<div class="spotify-save-match">
      <div class="spotify-save-match-title">${escapeHtml(track.name)}</div>
      <div class="spotify-save-match-artist">${escapeHtml(track.artists.map((a) => a.name).join(', '))}</div>
    </div>`;
    statusEl.textContent = 'Select a playlist:';

    const plRes = await fetch('/api/spotify/playlists');
    if (!plRes.ok) { statusEl.textContent = 'Failed to load playlists'; return; }
    const plData = await plRes.json();
    const playlists = plData.items || plData || [];
    playlists.forEach((pl) => {
      const row = document.createElement('div');
      row.className = 'spotify-save-playlist';
      row.textContent = pl.name;
      row.addEventListener('click', async () => {
        statusEl.textContent = 'Adding...';
        const addRes = await fetch('/api/spotify/add-to-playlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playlistId: pl.id, trackUri: track.uri }),
        });
        statusEl.textContent = addRes.ok ? 'Added!' : 'Failed to add';
        STORAGE.setSpotifyTargetPlaylist(pl.id);
        setTimeout(() => overlay.classList.add('hidden'), 1500);
      });
      playlistsEl.appendChild(row);
    });
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
  }
}

document.getElementById('spotify-save-close')?.addEventListener('click', () => {
  document.getElementById('spotify-save-overlay').classList.add('hidden');
});
document.getElementById('spotify-save-overlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'spotify-save-overlay') e.target.classList.add('hidden');
});

export {
  applyTheme, openSettings, closeSettings, syncSettingsBtns,
  openSpotifySaveModal,
  registerDeps, setWaveformVisibleLocal, setLibraryFolders, setInvalidateIndex,
};
