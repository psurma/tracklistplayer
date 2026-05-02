import { state, STORAGE } from './state.js';
import { escapeHtml, formatTime, formatDurationMs, currentDisc } from './helpers.js';
import { audio, btnPlay, spotifyBtn, filterInput, filterClear, folderBrowser, discList, nfoPane, artworkPane } from './dom-refs.js';

// Registration patterns for cross-module deps
let _enterStreamingInfoMode = null;
let _exitStreamingInfoMode = null;
let _showSpotifyTrackInfo = null;
let _showLiveSpectrum = null;
let _fancyScrubber = null;
let _currentWfPath = null;
let _waveformVisible = false;
let _liveSpectrum = null;
let _liveSpectrumWrap = null;
let _applyFilter = null;
let _closeSettings = null;

function registerDeps(deps) {
  _enterStreamingInfoMode = deps.enterStreamingInfoMode;
  _exitStreamingInfoMode = deps.exitStreamingInfoMode;
  _showSpotifyTrackInfo = deps.showSpotifyTrackInfo;
  _showLiveSpectrum = deps.showLiveSpectrum;
  _fancyScrubber = deps.fancyScrubber;
  _liveSpectrum = deps.liveSpectrum;
  _liveSpectrumWrap = deps.liveSpectrumWrap;
  _applyFilter = deps.applyFilter;
  _closeSettings = deps.closeSettings;
}

function setWaveformVisible(v) { _waveformVisible = v; }
function setCurrentWfPath(v) { _currentWfPath = v; }

// ── Spotify state ─────────────────────────────────────────────────────────────
let spotifyPlayer = null;
let spotifyDeviceId = null;
let spotifyConnected = false;
let spotifyAccessToken = null;
let spotifyTokenExpiry = 0;
let spotifyPollTimer = null;
let spotifyWasPlaying = false;
let spotifyCurrentUri = null;
let spotifySDKReady = false;
let spotifySDKPendingToken = null;
let pendingSpotifyRestore = null;

window.onSpotifyWebPlaybackSDKReady = () => {
  spotifySDKReady = true;
  if (spotifySDKPendingToken) {
    initSpotifySDK(spotifySDKPendingToken);
    spotifySDKPendingToken = null;
  }
};

let spotifyMode = false;
let spotifyActiveSource   = null;
let spotifyTracksOffset   = 0;
let spotifyTracksTotal    = 0;
let spotifyTracksLoading  = false;

const spotifyBrowser           = document.getElementById('spotify-browser');
const spotifyBrowserPrompt     = document.getElementById('spotify-browser-prompt');
const spotifyBrowserConnectBtn = document.getElementById('spotify-browser-connect-btn');
const spotifyPlaylistList      = document.getElementById('spotify-playlist-list');
const spotifyTracksPanel       = document.getElementById('spotify-tracks-panel');
const spotifySourceName        = document.getElementById('spotify-source-name');
const spotifySourceCount       = document.getElementById('spotify-source-count');
const spotifyTracksList        = document.getElementById('spotify-tracks-list');
const spotifyTracksFooter      = document.getElementById('spotify-tracks-footer');
const spotifyTracksLoadMoreBtn = document.getElementById('spotify-tracks-load-more-btn');

async function getSpotifyToken() {
  if (spotifyAccessToken && Date.now() < spotifyTokenExpiry - 60000) return spotifyAccessToken;
  const res = await fetch('/api/spotify/refresh', { method: 'POST' });
  if (!res.ok) throw new Error('Token refresh failed');
  const data = await res.json();
  spotifyAccessToken = data.access_token;
  spotifyTokenExpiry = data.expires_at || (Date.now() + 3600000);
  return spotifyAccessToken;
}

function initSpotifySDK(token) {
  if (spotifyPlayer) { spotifyPlayer.disconnect(); spotifyPlayer = null; }
  spotifyAccessToken = token;
  spotifyPlayer = new Spotify.Player({
    name: 'Tracklist Player',
    getOAuthToken: (cb) => {
      getSpotifyToken().then(cb).catch(() => cb(token));
    },
    volume: 0.8,
  });
  spotifyPlayer.addListener('ready', ({ device_id }) => {
    spotifyDeviceId = device_id;
    if (pendingSpotifyRestore) {
      const { uri, position } = pendingSpotifyRestore;
      pendingSpotifyRestore = null;
      getSpotifyToken().then((tok) => {
        fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(device_id)}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ uris: [uri], position_ms: position || 0 }),
        }).catch((err) => console.warn('[spotify] restore play failed:', err?.message || err));
      }).catch((err) => console.warn('[spotify] restore token failed:', err?.message || err));
    }
  });
  spotifyPlayer.addListener('player_state_changed', (playerState) => {
    if (!playerState) return;
    const item = playerState.track_window && playerState.track_window.current_track;
    if (!item) return;

    const justEnded = spotifyWasPlaying && playerState.paused && playerState.position === 0;
    spotifyWasPlaying = !playerState.paused;
    spotifyCurrentUri = item.uri;

    spotifyTracksList.querySelectorAll('.spotify-track-item').forEach((el) => {
      el.classList.toggle('spotify-track-active', el.dataset.uri === item.uri);
    });
    btnPlay.innerHTML = playerState.paused ? '&#9654;' : '&#9646;&#9646;';

    if (!playerState.paused && _waveformVisible) {
      const spotifyAudio = [...document.querySelectorAll('audio')].find((el) => el !== audio);
      if (spotifyAudio) {
        _liveSpectrum.connectAudioElement(spotifyAudio);
        _fancyScrubber.clear();
        _currentWfPath = null;
        _showLiveSpectrum();
      }
    }

    if (_showSpotifyTrackInfo) _showSpotifyTrackInfo(item);

    if (!playerState.paused) {
      STORAGE.setStreamSession({ mode: 'spotify', uri: item.uri, position: playerState.position });
    }

    if (justEnded) {
      const items = [...spotifyTracksList.querySelectorAll('.spotify-track-item')];
      const idx = items.findIndex((el) => el.dataset.uri === item.uri);
      const next = items[idx + 1];
      if (next) playSpotifyTrack(next.dataset.uri);
    }
  });
  spotifyPlayer.addListener('initialization_error', ({ message }) => {
    console.error('Spotify init error:', message);
  });
  spotifyPlayer.addListener('authentication_error', ({ message }) => {
    console.error('Spotify auth error:', message);
    // Mid-playback recovery: token expired or revoked. Force a refresh and
    // reconnect the player; if that succeeds, transparently resume.
    spotifyAccessToken = null;
    spotifyTokenExpiry = 0;
    getSpotifyToken().then((tok) => {
      console.log('[spotify] reauthenticated; reinitializing player');
      try { spotifyPlayer.disconnect(); } catch (_) {}
      initSpotifySDK(tok);
    }).catch((err) => console.warn('[spotify] reauth failed:', err?.message || err));
  });
  spotifyPlayer.addListener('account_error', ({ message }) => {
    console.error('Spotify account error (Premium required):', message);
  });
  spotifyPlayer.connect();
}

function updateSpotifyUI() {
  const connected = spotifyConnected;
  spotifyBrowserPrompt.classList.toggle('hidden', connected);
  spotifyPlaylistList.classList.toggle('hidden', !connected);
  const disconnectRow = document.getElementById('spotify-disconnect-row');
  if (disconnectRow) disconnectRow.classList.toggle('hidden', !connected);
}

function openSpotifyMode() {
  // Import closeSoundcloudMode dynamically to avoid circular
  import('./soundcloud.js').then((sc) => {
    if (sc.isSoundcloudMode()) sc.closeSoundcloudMode();
  });
  filterInput.value = '';
  filterClear.classList.add('hidden');
  spotifyMode = true;
  spotifyBtn.classList.add('active');
  spotifyBtn.title = 'Exit Spotify mode';
  folderBrowser.classList.add('hidden');
  spotifyBrowser.classList.remove('hidden');
  discList.classList.add('hidden');
  spotifyTracksPanel.classList.remove('hidden');
  if (_enterStreamingInfoMode) _enterStreamingInfoMode();
  updateSpotifyUI();
  if (spotifyConnected) {
    loadSpotifyPlaylists();
    if (!spotifyActiveSource) {
      loadSpotifyTracks({ type: 'liked' }, 0);
    }
  }
}

function closeSpotifyMode() {
  spotifyMode = false;
  spotifyBtn.classList.remove('active');
  spotifyBtn.title = 'Spotify Liked Songs';
  spotifyBrowser.classList.add('hidden');
  folderBrowser.classList.remove('hidden');
  spotifyTracksPanel.classList.add('hidden');
  discList.classList.remove('hidden');
  if (_exitStreamingInfoMode) _exitStreamingInfoMode();
  if (_liveSpectrum) _liveSpectrum.stop();
  if (_liveSpectrumWrap) _liveSpectrumWrap.classList.add('hidden');
  STORAGE.clearStreamSession();
}

async function loadSpotifyPlaylists() {
  spotifyPlaylistList.innerHTML = '<div class="spotify-pl-loading">Loading playlists\u2026</div>';
  try {
    const res = await fetch('/api/spotify/playlists');
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    const playlists = data.items || [];

    const frag = document.createDocumentFragment();

    const liked = document.createElement('div');
    liked.className = 'spotify-pl-item';
    liked.dataset.type = 'liked';
    liked.innerHTML = `<span class="spotify-pl-icon">\u2665</span><span class="spotify-pl-name">Liked Songs</span>`;
    liked.addEventListener('click', () => loadSpotifyTracks({ type: 'liked' }, 0));
    frag.appendChild(liked);

    for (const pl of playlists) {
      const item = document.createElement('div');
      item.className = 'spotify-pl-item';
      item.dataset.id = pl.id;
      item.innerHTML = `<span class="spotify-pl-icon">\u266B</span><span class="spotify-pl-name">${escapeHtml(pl.name)}</span><span class="spotify-pl-count">${pl.tracks ? pl.tracks.total : ''}</span>`;
      item.addEventListener('click', () => loadSpotifyTracks({ type: 'playlist', id: pl.id, name: pl.name }, 0));
      frag.appendChild(item);
    }
    spotifyPlaylistList.innerHTML = '';
    spotifyPlaylistList.appendChild(frag);
  } catch (err) {
    spotifyPlaylistList.innerHTML = `<div class="spotify-pl-loading">Could not load playlists.<br><small>${escapeHtml(err.message)}</small></div>`;
  }
}

async function loadSpotifyTracks(source, offset) {
  if (spotifyTracksLoading && offset > 0) return;
  spotifyTracksLoading = true;

  if (offset === 0) {
    spotifyActiveSource = source;
    spotifyTracksOffset = 0;
    spotifyTracksTotal  = 0;
    spotifyTracksList.innerHTML = '<div class="spotify-loading">Loading\u2026</div>';
    spotifyTracksFooter.classList.add('hidden');
    spotifyPlaylistList.querySelectorAll('.spotify-pl-item').forEach((el) => {
      const isActive = source.type === 'liked'
        ? el.dataset.type === 'liked'
        : el.dataset.id === source.id;
      el.classList.toggle('spotify-pl-active', isActive);
    });
    spotifySourceName.textContent = source.type === 'liked' ? 'Liked Songs' : (source.name || 'Playlist');
    spotifySourceCount.textContent = '';
  }

  try {
    const url = source.type === 'liked'
      ? `/api/spotify/liked?offset=${offset}&limit=50`
      : `/api/spotify/playlist-tracks?id=${encodeURIComponent(source.id)}&offset=${offset}&limit=50`;
    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 403 && errData.error === 'quota_exceeded') {
        throw new Error('Playlist tracks require Spotify Extended Quota access.\nRequest it at developer.spotify.com \u2192 your app \u2192 Quota Extension.');
      }
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
    const data = await res.json();

    spotifyTracksTotal  = data.total || 0;
    spotifyTracksOffset = offset + (data.items || []).length;
    spotifySourceCount.textContent = spotifyTracksTotal ? `${spotifyTracksTotal} tracks` : '';

    if (offset === 0) spotifyTracksList.innerHTML = '';

    const frag = document.createDocumentFragment();
    for (const item of (data.items || [])) {
      const track = item.track;
      if (!track) continue;
      const el = document.createElement('div');
      el.className = 'spotify-track-item';
      el.dataset.uri = track.uri;
      const duration = formatTime(Math.floor((track.duration_ms || 0) / 1000));
      const artists   = (track.artists || []).map((a) => a.name).join(', ');
      el.innerHTML = `
        <span class="spotify-play-icon">&#9654;</span>
        <span class="spotify-track-info">
          <div class="spotify-track-title">${escapeHtml(track.name || '')}</div>
          <div class="spotify-track-artist">${escapeHtml(artists)}</div>
        </span>
        <span class="spotify-track-duration">${duration}</span>
      `;
      el.addEventListener('click', () => playSpotifyTrack(track.uri));
      frag.appendChild(el);
    }
    spotifyTracksList.appendChild(frag);

    if (_applyFilter && filterInput.value) _applyFilter(filterInput.value);

    if (spotifyTracksOffset < spotifyTracksTotal) {
      spotifyTracksFooter.classList.remove('hidden');
    } else {
      spotifyTracksFooter.classList.add('hidden');
    }
  } catch (err) {
    if (offset === 0) {
      const isQuota = err.message.includes('quota_exceeded') || err.message.includes('403');
      if (isQuota && spotifyActiveSource && spotifyActiveSource.type === 'playlist') {
        spotifyTracksList.innerHTML = `<div class="spotify-quota-notice">
          <p>Spotify restricts playlist track access for this app.</p>
          <p>You can still play this playlist directly:</p>
          <button id="spotify-play-playlist-btn">Play playlist</button>
        </div>`;
        document.getElementById('spotify-play-playlist-btn').addEventListener('click', () => {
          playSpotifyContext(`spotify:playlist:${spotifyActiveSource.id}`);
        });
      } else {
        spotifyTracksList.innerHTML = `<div class="spotify-loading" style="color:#c06060">Error: ${escapeHtml(err.message)}</div>`;
      }
    }
  } finally {
    spotifyTracksLoading = false;
  }
}

async function initSpotify() {
  try {
    const statusRes = await fetch('/api/spotify/status');
    if (!statusRes.ok) return;
    const status = await statusRes.json();
    spotifyConnected = status.connected;
    updateSpotifyUI();
    if (status.connected) {
      try {
        const token = await getSpotifyToken();
        if (spotifySDKReady) {
          initSpotifySDK(token);
        } else {
          spotifySDKPendingToken = token;
        }
      } catch (err) { console.warn('[spotify] init token/SDK:', err?.message || err); }
    }
  } catch (err) { console.warn('[spotify] init status:', err?.message || err); }
}

async function connectSpotify() {
  const popup = window.open('', 'spotify-auth', 'width=500,height=700,menubar=no,toolbar=no');
  if (!popup) { alert('Popup blocked. Please allow popups for this page.'); return; }

  try {
    const urlRes = await fetch('/api/spotify/auth-url');
    if (!urlRes.ok) {
      popup.close();
      alert('Please configure your Spotify Client ID and Secret in Settings first.');
      return;
    }
    const { url } = await urlRes.json();
    popup.location.href = url;
  } catch (_) {
    popup.close();
    return;
  }

  if (spotifyPollTimer) clearInterval(spotifyPollTimer);
  let attempts = 0;
  spotifyPollTimer = setInterval(async () => {
    attempts++;
    if (attempts > 30) { clearInterval(spotifyPollTimer); spotifyPollTimer = null; return; }
    try {
      const statusRes = await fetch('/api/spotify/status');
      if (!statusRes.ok) return;
      const status = await statusRes.json();
      if (status.connected) {
        clearInterval(spotifyPollTimer);
        spotifyPollTimer = null;
        spotifyConnected = true;
        updateSpotifyUI();
        try {
          const token = await getSpotifyToken();
          if (spotifySDKReady) initSpotifySDK(token);
          else spotifySDKPendingToken = token;
        } catch (_) {}
        if (spotifyMode) {
          loadSpotifyPlaylists();
          loadSpotifyTracks({ type: 'liked' }, 0);
        }
      }
    } catch (_) {}
  }, 2000);
}

async function playSpotifyContext(contextUri) {
  let deviceId = spotifyDeviceId;
  if (!deviceId) {
    try {
      const res = await fetch('/api/spotify/devices');
      if (res.ok) {
        const data = await res.json();
        const pick = (data.devices || []).find((d) => d.is_active) || (data.devices || [])[0];
        if (pick) deviceId = pick.id;
      }
    } catch (_) {}
  }
  if (!deviceId) return;
  try {
    const token = await getSpotifyToken();
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ context_uri: contextUri }),
    });
    if (!audio.paused) audio.pause();
  } catch (err) {
    console.error('Spotify context play error:', err);
  }
}

async function playSpotifyTrack(uri) {
  let deviceId = spotifyDeviceId;

  if (!deviceId) {
    try {
      const res = await fetch('/api/spotify/devices');
      if (res.ok) {
        const data = await res.json();
        const devices = data.devices || [];
        const pick = devices.find((d) => d.is_active) || devices[0];
        if (pick) deviceId = pick.id;
      }
    } catch (_) {}
  }

  if (!deviceId) {
    const trackId = uri.split(':').pop();
    window.open(`https://open.spotify.com/track/${trackId}`);
    return;
  }

  try {
    const token = await getSpotifyToken();
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri] }),
    });
    if (!audio.paused) audio.pause();
  } catch (err) {
    console.error('Spotify play error:', err);
  }
}

async function disconnectSpotify() {
  await fetch('/api/spotify/disconnect', { method: 'POST' }).catch(() => {});
  spotifyConnected = false;
  spotifyAccessToken = null;
  spotifyTokenExpiry = 0;
  if (spotifyPlayer) { spotifyPlayer.disconnect(); spotifyPlayer = null; }
  spotifyDeviceId = null;
  spotifyCurrentUri = null;
  spotifyTracksList.innerHTML = '';
  spotifyTracksFooter.classList.add('hidden');
  spotifySourceCount.textContent = '';
  spotifyPlaylistList.innerHTML = '';
  spotifyActiveSource = null;
  closeSpotifyMode();
}

// Event listeners
spotifyBtn.addEventListener('click', () => {
  if (spotifyMode) closeSpotifyMode();
  else openSpotifyMode();
});

spotifyBrowserConnectBtn.addEventListener('click', connectSpotify);
spotifyTracksLoadMoreBtn.addEventListener('click', () => {
  if (spotifyActiveSource) loadSpotifyTracks(spotifyActiveSource, spotifyTracksOffset);
});

function isSpotifyMode() { return spotifyMode; }
function isSpotifyConnected() { return spotifyConnected; }
function getSpotifyPlayer() { return spotifyPlayer; }
function getSpotifyCurrentUri() { return spotifyCurrentUri; }
function setPendingSpotifyRestore(v) { pendingSpotifyRestore = v; }
function getSpotifyTracksList() { return spotifyTracksList; }

export {
  initSpotify, connectSpotify, disconnectSpotify,
  openSpotifyMode, closeSpotifyMode,
  getSpotifyToken, updateSpotifyUI,
  loadSpotifyPlaylists, loadSpotifyTracks,
  playSpotifyTrack, playSpotifyContext,
  isSpotifyMode, isSpotifyConnected,
  getSpotifyPlayer, getSpotifyCurrentUri,
  setPendingSpotifyRestore, getSpotifyTracksList,
  registerDeps, setWaveformVisible, setCurrentWfPath,
};
