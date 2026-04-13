import { state, STORAGE } from './state.js';
import { escapeHtml, formatDuration, formatDurationMs, currentDisc } from './helpers.js';
import { audio, btnPlay, filterInput, filterClear, folderBrowser, discList, npDisc, npTitle, npPerformer, npTrackNumber, npSection, artworkPane, artworkImg } from './dom-refs.js';

// Registration patterns for cross-module deps
let _enterStreamingInfoMode = null;
let _exitStreamingInfoMode = null;
let _showSoundcloudTrackInfo = null;
let _showLiveSpectrum = null;
let _fancyScrubber = null;
let _liveSpectrum = null;
let _liveSpectrumWrap = null;
let _currentArtworkPath = null;
let _currentArtworkUrl = null;
let _currentWfPath = null;
let _applyFilter = null;
let _closeSettings = null;

function registerDeps(deps) {
  _enterStreamingInfoMode = deps.enterStreamingInfoMode;
  _exitStreamingInfoMode = deps.exitStreamingInfoMode;
  _showSoundcloudTrackInfo = deps.showSoundcloudTrackInfo;
  _showLiveSpectrum = deps.showLiveSpectrum;
  _fancyScrubber = deps.fancyScrubber;
  _liveSpectrum = deps.liveSpectrum;
  _liveSpectrumWrap = deps.liveSpectrumWrap;
  _applyFilter = deps.applyFilter;
  _closeSettings = deps.closeSettings;
}

function setArtworkRefs(path, url) { _currentArtworkPath = path; _currentArtworkUrl = url; }

// ── SoundCloud state ──────────────────────────────────────────────────────────
let soundcloudConnected   = false;
let soundcloudAccessToken = null;
let soundcloudTokenExpiry = 0;
let soundcloudPollTimer   = null;
let soundcloudMode        = false;
let soundcloudTracks      = [];
let soundcloudNextHref    = null;
let soundcloudActiveIdx   = -1;
let soundcloudActiveSource = 'liked';
let pendingScRestore      = null;

const soundcloudBtn               = document.getElementById('soundcloud-btn');
const soundcloudBrowser           = document.getElementById('soundcloud-browser');
const soundcloudBrowserPrompt     = document.getElementById('soundcloud-browser-prompt');
const soundcloudBrowserConnectBtn = document.getElementById('soundcloud-browser-connect-btn');
const soundcloudPlaylistList      = document.getElementById('soundcloud-playlist-list');
const soundcloudTracksPanel       = document.getElementById('soundcloud-tracks-panel');
const soundcloudTracksList        = document.getElementById('soundcloud-tracks-list');
const soundcloudTracksFooter      = document.getElementById('soundcloud-tracks-footer');
const soundcloudTracksLoadMoreBtn = document.getElementById('soundcloud-tracks-load-more-btn');

async function getSoundcloudToken() {
  if (soundcloudAccessToken && Date.now() < soundcloudTokenExpiry - 60000) return soundcloudAccessToken;
  const res = await fetch('/api/soundcloud/refresh', { method: 'POST' });
  if (!res.ok) throw new Error('SoundCloud token refresh failed');
  const data = await res.json();
  soundcloudAccessToken = data.access_token;
  soundcloudTokenExpiry = data.expires_at || (Date.now() + 3600000);
  return soundcloudAccessToken;
}

function updateSoundcloudUI() {
  soundcloudBrowserPrompt.classList.toggle('hidden', soundcloudConnected);
  soundcloudPlaylistList.classList.toggle('hidden', !soundcloudConnected);
  const disconnectRow = document.getElementById('soundcloud-disconnect-row');
  if (disconnectRow) disconnectRow.classList.toggle('hidden', !soundcloudConnected);
}

async function loadSoundcloudPlaylists() {
  try {
    const res = await fetch('/api/soundcloud/playlists');
    if (!res.ok) return;
    const playlists = await res.json();
    const frag = document.createDocumentFragment();

    const liked = document.createElement('div');
    liked.className = 'soundcloud-pl-item soundcloud-pl-active';
    liked.dataset.type = 'liked';
    liked.innerHTML = `<span class="soundcloud-pl-icon">&#9829;</span><span class="soundcloud-pl-name">Liked Tracks</span>`;
    liked.addEventListener('click', () => {
      soundcloudPlaylistList.querySelectorAll('.soundcloud-pl-item').forEach((el) => el.classList.remove('soundcloud-pl-active'));
      liked.classList.add('soundcloud-pl-active');
      soundcloudTracks = [];
      soundcloudNextHref = null;
      soundcloudActiveSource = 'liked';
      loadSoundcloudTracks(null);
    });
    frag.appendChild(liked);

    for (const pl of playlists) {
      const item = document.createElement('div');
      item.className = 'soundcloud-pl-item';
      item.dataset.id = pl.id;
      const count = pl.track_count != null ? pl.track_count : (pl.tracks ? pl.tracks.length : '');
      item.innerHTML = `<span class="soundcloud-pl-icon">&#9835;</span><span class="soundcloud-pl-name">${escapeHtml(pl.title || '')}</span><span class="soundcloud-pl-count">${count}</span>`;
      item.addEventListener('click', () => {
        soundcloudPlaylistList.querySelectorAll('.soundcloud-pl-item').forEach((el) => el.classList.remove('soundcloud-pl-active'));
        item.classList.add('soundcloud-pl-active');
        soundcloudActiveSource = { type: 'playlist', id: pl.id, tracks: pl.tracks || [] };
        loadSoundcloudPlaylistTracks(pl);
      });
      frag.appendChild(item);
    }
    soundcloudPlaylistList.innerHTML = '';
    soundcloudPlaylistList.appendChild(frag);
  } catch (_) {}
}

function createSoundcloudTrackEl(track, idx) {
  const el = document.createElement('div');
  el.className = 'soundcloud-track-item';
  el.dataset.idx = String(idx);
  const dur = track.duration ? formatDuration(Math.round(track.duration / 1000)) : '';
  el.innerHTML = `<span class="soundcloud-play-icon">&#9654;</span>`
    + `<div class="soundcloud-track-info">`
    + `<div class="soundcloud-track-title">${escapeHtml(track.title || '\u2014')}</div>`
    + `<div class="soundcloud-track-artist">${escapeHtml(track.user ? track.user.username : '')}</div>`
    + `</div>`
    + `<span class="soundcloud-track-duration">${escapeHtml(dur)}</span>`;
  el.addEventListener('click', () => playSoundcloudTrack(idx));
  return el;
}

function loadSoundcloudPlaylistTracks(pl) {
  soundcloudTracks = (pl.tracks || []).filter((t) => t && t.id);
  soundcloudNextHref = null;
  soundcloudTracksList.innerHTML = '';
  const frag = document.createDocumentFragment();
  soundcloudTracks.forEach((track, idx) => frag.appendChild(createSoundcloudTrackEl(track, idx)));
  soundcloudTracksList.appendChild(frag);
  soundcloudTracksFooter.classList.add('hidden');
}

function openSoundcloudMode() {
  import('./spotify.js').then((sp) => {
    if (sp.isSpotifyMode()) sp.closeSpotifyMode();
  });
  filterInput.value = '';
  filterClear.classList.add('hidden');
  soundcloudMode = true;
  soundcloudBtn.classList.add('active');
  soundcloudBtn.title = 'Exit SoundCloud mode';
  folderBrowser.classList.add('hidden');
  soundcloudBrowser.classList.remove('hidden');
  discList.classList.add('hidden');
  soundcloudTracksPanel.classList.remove('hidden');
  if (_enterStreamingInfoMode) _enterStreamingInfoMode();
  updateSoundcloudUI();
  if (soundcloudConnected) {
    loadSoundcloudPlaylists();
    if (soundcloudTracks.length === 0) loadSoundcloudTracks(null);
  }
}

function closeSoundcloudMode() {
  soundcloudMode = false;
  soundcloudBtn.classList.remove('active');
  soundcloudBtn.title = 'SoundCloud Liked Tracks';
  soundcloudBrowser.classList.add('hidden');
  folderBrowser.classList.remove('hidden');
  soundcloudTracksPanel.classList.add('hidden');
  discList.classList.remove('hidden');
  if (_exitStreamingInfoMode) _exitStreamingInfoMode();
  if (_liveSpectrum) _liveSpectrum.stop();
  if (_liveSpectrumWrap) _liveSpectrumWrap.classList.add('hidden');
  STORAGE.clearStreamSession();
}

async function loadSoundcloudTracks(nextHref) {
  try {
    const url = nextHref
      ? `/api/soundcloud/liked?next_href=${encodeURIComponent(nextHref)}`
      : '/api/soundcloud/liked';
    if (!nextHref) {
      soundcloudTracksList.innerHTML = '<div class="soundcloud-loading">Loading\u2026</div>';
      soundcloudTracksFooter.classList.add('hidden');
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!nextHref) {
      soundcloudTracks = [];
      soundcloudTracksList.innerHTML = '';
    }

    const startIdx = soundcloudTracks.length;
    soundcloudTracks.push(...(data.collection || []));
    soundcloudNextHref = data.next_href || null;

    const frag = document.createDocumentFragment();
    (data.collection || []).forEach((track, i) => {
      frag.appendChild(createSoundcloudTrackEl(track, startIdx + i));
    });
    soundcloudTracksList.appendChild(frag);

    soundcloudTracksFooter.classList.toggle('hidden', !soundcloudNextHref);

    if (_applyFilter && filterInput.value) _applyFilter(filterInput.value);

    if (pendingScRestore && !nextHref) {
      const { trackIdx, position } = pendingScRestore;
      pendingScRestore = null;
      if (soundcloudTracks[trackIdx]) {
        playSoundcloudTrack(trackIdx);
        audio.addEventListener('canplay', function seekOnce() {
          audio.removeEventListener('canplay', seekOnce);
          audio.currentTime = position || 0;
        });
      }
    }
  } catch (err) {
    soundcloudTracksList.innerHTML = `<div class="soundcloud-loading" style="color:#c06060">Error: ${escapeHtml(err.message)}</div>`;
  }
}

async function playSoundcloudTrack(idx) {
  const track = soundcloudTracks[idx];
  if (!track) return;
  soundcloudActiveIdx = idx;

  // Pause Spotify if playing
  import('./spotify.js').then((sp) => {
    const player = sp.getSpotifyPlayer();
    if (player && sp.getSpotifyCurrentUri()) {
      player.pause().catch(() => {});
    }
  });

  state.currentDiscId = null;
  artworkImg.src = '';
  artworkPane.classList.add('hidden');
  npSection.classList.remove('has-artwork');
  npSection.style.removeProperty('--artwork');
  if (_fancyScrubber) _fancyScrubber.clear();
  if (_showLiveSpectrum) _showLiveSpectrum();

  audio.src = `/api/soundcloud/stream/${encodeURIComponent(track.id)}`;
  audio.play().catch(() => {});

  npDisc.textContent = track.user ? track.user.username : '';
  npTitle.textContent = track.title || '\u2014';
  npPerformer.textContent = '';
  npTrackNumber.textContent = '';
  btnPlay.innerHTML = '&#9646;&#9646;';

  if (_showSoundcloudTrackInfo) _showSoundcloudTrackInfo(track);

  soundcloudTracksList.querySelectorAll('.soundcloud-track-item').forEach((el) => {
    el.classList.toggle('soundcloud-track-active', Number(el.dataset.idx) === idx);
  });
}

async function initSoundcloud() {
  try {
    const statusRes = await fetch('/api/soundcloud/status');
    if (!statusRes.ok) return;
    const status = await statusRes.json();
    soundcloudConnected = status.connected;
    updateSoundcloudUI();
  } catch (_) {}
}

async function connectSoundcloud() {
  const popup = window.open('', 'soundcloud-auth', 'width=500,height=700,menubar=no,toolbar=no');
  if (!popup) { alert('Popup blocked. Please allow popups for this page.'); return; }

  try {
    const urlRes = await fetch('/api/soundcloud/auth-url');
    if (!urlRes.ok) {
      popup.close();
      alert('Please configure your SoundCloud Client ID and Secret in Settings first.');
      return;
    }
    const { url } = await urlRes.json();
    popup.location.href = url;
  } catch (_) {
    popup.close();
    return;
  }

  soundcloudPollTimer = setInterval(async () => {
    try {
      const status = await fetch('/api/soundcloud/status').then((r) => r.json());
      if (status.connected) {
        clearInterval(soundcloudPollTimer);
        soundcloudPollTimer = null;
        soundcloudConnected = true;
        updateSoundcloudUI();
        if (soundcloudMode) {
          loadSoundcloudPlaylists();
          loadSoundcloudTracks(null);
        }
      }
    } catch (_) {}
  }, 2000);
}

async function disconnectSoundcloud() {
  await fetch('/api/soundcloud/disconnect', { method: 'POST' }).catch(() => {});
  soundcloudConnected = false;
  soundcloudAccessToken = null;
  soundcloudTokenExpiry = 0;
  soundcloudTracks = [];
  soundcloudNextHref = null;
  soundcloudActiveIdx = -1;
  soundcloudTracksList.innerHTML = '';
  soundcloudTracksFooter.classList.add('hidden');
  soundcloudPlaylistList.innerHTML = '';
  closeSoundcloudMode();
}

// Event listeners
soundcloudBtn.addEventListener('click', () => {
  if (soundcloudMode) closeSoundcloudMode();
  else openSoundcloudMode();
});

document.getElementById('local-btn').addEventListener('click', () => {
  import('./spotify.js').then((sp) => {
    if (sp.isSpotifyMode()) sp.closeSpotifyMode();
    else if (soundcloudMode) closeSoundcloudMode();
  });
});

soundcloudBrowserConnectBtn.addEventListener('click', connectSoundcloud);
soundcloudTracksLoadMoreBtn.addEventListener('click', () => {
  if (soundcloudNextHref) loadSoundcloudTracks(soundcloudNextHref);
});

function isSoundcloudMode() { return soundcloudMode; }
function isSoundcloudConnected() { return soundcloudConnected; }
function getSoundcloudActiveIdx() { return soundcloudActiveIdx; }
function getSoundcloudTracks() { return soundcloudTracks; }
function getSoundcloudTracksList() { return soundcloudTracksList; }
function setPendingScRestore(v) { pendingScRestore = v; }

export {
  initSoundcloud, connectSoundcloud, disconnectSoundcloud,
  openSoundcloudMode, closeSoundcloudMode,
  getSoundcloudToken, updateSoundcloudUI,
  loadSoundcloudPlaylists, loadSoundcloudTracks,
  playSoundcloudTrack, createSoundcloudTrackEl, loadSoundcloudPlaylistTracks,
  isSoundcloudMode, isSoundcloudConnected,
  getSoundcloudActiveIdx, getSoundcloudTracks, getSoundcloudTracksList,
  setPendingScRestore, registerDeps, setArtworkRefs,
};
