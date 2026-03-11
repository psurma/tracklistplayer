'use strict';

// Tag body when running inside Electron; also tag macOS for traffic-light padding
if (navigator.userAgent.includes('Electron')) {
  document.body.classList.add('electron');
  if (window.electronAPI?.platform === 'darwin') document.body.classList.add('darwin');
}

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  discs: [],
  currentDiscId: null,
  currentTrackIndex: -1,
  seeking: false,
  sidebarCollapsed: false,
  browseDir: '',          // currently browsed folder (folder browser)
  favorites: new Set(),   // keys: "mp3File:trackNumber"
};

// ── Waveform renderer ─────────────────────────────────────────────────────────
const wfSection  = document.getElementById('waveform-section');
const wfStatus   = document.getElementById('wf-status');
const waveformRenderer = new WaveformRenderer(
  document.getElementById('wf-overview'),
  document.getElementById('wf-zoom'),
  (t) => {
    if (!isFinite(audio.duration)) return;
    audio.currentTime = t;
    waveformRenderer.seekTo(t);
    seekBar.value = (t / audio.duration) * 100;
    timeCurrent.textContent = formatTime(t);
  }
);

// ── Live spectrum renderer (for streaming sources) ────────────────────────────
const liveSpectrumWrap = document.getElementById('live-spectrum-wrap');
const liveSpectrumCanvas = document.getElementById('live-spectrum');
const liveSpectrum = new LiveSpectrumRenderer(liveSpectrumCanvas);

function showLiveSpectrum() {
  // Show waveform section with live spectrum canvas; hide static wf canvases
  wfSection.classList.remove('hidden');
  document.getElementById('wf-overview-wrap').classList.add('hidden');
  document.getElementById('wf-resize-mid').classList.add('hidden');
  document.getElementById('wf-zoom-wrap').classList.add('hidden');
  document.getElementById('wf-resize-bot').classList.add('hidden');
  liveSpectrumWrap.classList.remove('hidden');
  liveSpectrum.connectAudioElement(audio);
  liveSpectrum.start();
}

function hideLiveSpectrum() {
  liveSpectrum.stop();
  liveSpectrumWrap.classList.add('hidden');
  document.getElementById('wf-overview-wrap').classList.remove('hidden');
  document.getElementById('wf-resize-mid').classList.remove('hidden');
  document.getElementById('wf-zoom-wrap').classList.remove('hidden');
  document.getElementById('wf-resize-bot').classList.remove('hidden');
}

let currentArtworkPath = null;
let currentArtworkUrl  = null;
function loadArtwork(disc) {
  if (!disc.mp3Path || disc.mp3Path === currentArtworkPath) return;
  currentArtworkPath = disc.mp3Path;
  fetch(`/api/artwork?path=${encodeURIComponent(disc.mp3Path)}`)
    .then((r) => (r.ok ? r.blob() : null))
    .then((blob) => {
      if (currentArtworkUrl) { URL.revokeObjectURL(currentArtworkUrl); currentArtworkUrl = null; }
      if (!blob) {
        npSection.classList.remove('has-artwork');
        npSection.style.removeProperty('--artwork');
        artworkImg.src = '';
        artworkPane.classList.add('hidden');
        return;
      }
      currentArtworkUrl = URL.createObjectURL(blob);
      npSection.style.setProperty('--artwork', `url("${currentArtworkUrl}")`);
      npSection.classList.add('has-artwork');
      artworkImg.src = currentArtworkUrl;
      // Show artwork pane only when NFO is not open
      if (nfoPane.classList.contains('hidden')) artworkPane.classList.remove('hidden');
    })
    .catch(() => {
      npSection.classList.remove('has-artwork');
      npSection.style.removeProperty('--artwork');
      artworkImg.src = '';
      artworkPane.classList.add('hidden');
    });
}

let currentWfPath = null;
async function loadWaveform(disc) {
  if (!disc.mp3Path || disc.mp3Path === currentWfPath) return;
  currentWfPath = disc.mp3Path;
  hideLiveSpectrum();
  if (waveformVisible) wfSection.classList.remove('hidden');
  wfStatus.classList.remove('hidden');
  waveformRenderer.clear();
  try {
    const res = await fetch(`/api/waveform?path=${encodeURIComponent(disc.mp3Path)}&bucketMs=${STORAGE.getSpectrumRes()}`);
    if (!res.ok) throw new Error('waveform failed');
    const data = await res.json();
    const d = state.discs.find((x) => x.id === disc.id);
    waveformRenderer.load(data, d ? d.tracks : []);
    wfStatus.classList.add('hidden');
  } catch (_) {
    wfStatus.classList.add('hidden');
    currentWfPath = null;
  }
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const audio         = document.getElementById('audio');
const discList      = document.getElementById('disc-list');
const folderBrowser = document.getElementById('folder-browser');
const panelResize   = document.getElementById('panel-resize');
const dirInput      = document.getElementById('dir-input');
const dirLoadBtn    = document.getElementById('dir-load-btn');
const filterInput   = document.getElementById('filter-input');
const filterClear   = document.getElementById('filter-clear');
const collapseBtn   = document.getElementById('collapse-btn');
const resizeHandle  = document.getElementById('resize-handle');
const sidebar       = document.getElementById('sidebar');
const btnPlay       = document.getElementById('btn-play');
const btnPrev       = document.getElementById('btn-prev');
const btnNext       = document.getElementById('btn-next');
const btnShuffle    = document.getElementById('btn-shuffle');
const btnRepeat     = document.getElementById('btn-repeat');
const seekBar       = document.getElementById('seek-bar');
const timeCurrent   = document.getElementById('time-current');
const timeTotal     = document.getElementById('time-total');
const volumeBar     = document.getElementById('volume-bar');
const npDisc        = document.getElementById('np-disc');
const npTrackNumber = document.getElementById('np-track-number');
const npTitle       = document.getElementById('np-title');
const npPerformer   = document.getElementById('np-performer');
const npSection     = document.getElementById('now-playing');
const spotifyBtn          = document.getElementById('spotify-btn');
const spotifySearchBtn    = document.getElementById('spotify-search-btn');
const soundcloudSearchBtn = document.getElementById('soundcloud-search-btn');
const finderBtn       = document.getElementById('finder-btn');
const nfoBtn          = document.getElementById('nfo-btn');
const tlBtn           = document.getElementById('tl-btn');
const themeToggle      = document.getElementById('theme-toggle');
const waveformToggle   = document.getElementById('waveform-toggle');
const miniBtn       = document.getElementById('mini-btn');
const miniTrack     = document.getElementById('mini-track');
const miniSub       = document.getElementById('mini-sub');

// ── Persistence ───────────────────────────────────────────────────────────────
const STORAGE = {
  getDir:      ()    => localStorage.getItem('tlp_dir') || '',
  setDir:      (v)   => localStorage.setItem('tlp_dir', v),
  getTheme:    ()    => localStorage.getItem('tlp_theme') || 'dark',
  setTheme:    (v)   => localStorage.setItem('tlp_theme', v),
  getSidebarW: ()    => localStorage.getItem('tlp_sidebar_w') || '340',
  setSidebarW: (v)   => localStorage.setItem('tlp_sidebar_w', String(v)),
  getBrowserH:    ()    => localStorage.getItem('tlp_browser_h') || '40',
  getWaveformOn:  ()    => localStorage.getItem('tlp_waveform') !== 'off',
  setWaveformOn:  (v)   => localStorage.setItem('tlp_waveform', v ? 'on' : 'off'),
  getMainTopH:    ()    => parseInt(localStorage.getItem('tlp_main_top_h'), 10) || 0,
  setMainTopH:    (v)   => localStorage.setItem('tlp_main_top_h', String(v)),
  setBrowserH: (v)   => localStorage.setItem('tlp_browser_h', String(v)),
  getFavs:     ()    => JSON.parse(localStorage.getItem('tlp_favorites') || '[]'),
  setFavs:     (arr) => localStorage.setItem('tlp_favorites', JSON.stringify(arr)),
  getPlayState: ()   => JSON.parse(localStorage.getItem('tlp_playstate') || 'null'),
  setPlayState: (v)  => localStorage.setItem('tlp_playstate', JSON.stringify(v)),
  getScanDir:   ()    => localStorage.getItem('tlp_scan_dir') || '',
  setScanDir:   (v)   => localStorage.setItem('tlp_scan_dir', v),
  getFilter:    ()    => localStorage.getItem('tlp_filter') || '',
  setFilter:    (v)   => localStorage.setItem('tlp_filter', v),
  getVolume:    ()    => parseFloat(localStorage.getItem('tlp_volume') ?? '1'),
  setVolume:    (v)   => localStorage.setItem('tlp_volume', String(v)),
  getShuffle:   ()    => localStorage.getItem('tlp_shuffle') === 'on',
  setShuffle:   (v)   => localStorage.setItem('tlp_shuffle', v ? 'on' : 'off'),
  getRepeat:    ()    => localStorage.getItem('tlp_repeat') || 'off',
  setRepeat:    (v)   => localStorage.setItem('tlp_repeat', v),
  getSpectrumRes: ()  => parseInt(localStorage.getItem('tlp_spectrum_res') || '100', 10),
  setSpectrumRes: (v) => localStorage.setItem('tlp_spectrum_res', String(v)),
  getTrackLabels: ()  => localStorage.getItem('tlp_track_labels') !== 'off',
  setTrackLabels: (v) => localStorage.setItem('tlp_track_labels', v ? 'on' : 'off'),
  getStreamSession: ()  => JSON.parse(localStorage.getItem('tlp_stream_session') || 'null'),
  setStreamSession: (v) => localStorage.setItem('tlp_stream_session', JSON.stringify(v)),
  clearStreamSession: () => localStorage.removeItem('tlp_stream_session'),
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(secs) {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(secs) {
  if (secs == null || !isFinite(secs) || secs < 0) return '';
  return formatTime(secs);
}

function fileUrl(absPath) {
  return `/file?path=${encodeURIComponent(absPath)}`;
}

function currentDisc() {
  return state.discs.find((d) => d.id === state.currentDiscId) || null;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function favKey(mp3File, trackNumber) {
  return `${mp3File}:${trackNumber}`;
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (themeToggle) {
    themeToggle.textContent = theme === 'dark' ? '☀' : '☾';
  }
}

// ── Favorites ─────────────────────────────────────────────────────────────────
// state.favorites: Map<key, {mp3Path, mp3File, dir, trackNumber, title, performer, albumTitle, startSeconds}>
function loadFavorites() {
  state.favorites = new Map();
  const saved = STORAGE.getFavs();
  for (const item of saved) {
    if (typeof item === 'object' && item.mp3File && item.trackNumber != null) {
      state.favorites.set(favKey(item.mp3File, item.trackNumber), item);
    }
  }
}

function saveFavorites() {
  STORAGE.setFavs([...state.favorites.values()]);
}

function toggleFavorite(disc, trackIdx, starEl) {
  const track = disc.tracks[trackIdx];
  const key = favKey(disc.mp3File, track.track);
  if (state.favorites.has(key)) {
    state.favorites.delete(key);
    starEl.classList.remove('fav-active');
    starEl.title = 'Add to favorites';
  } else {
    state.favorites.set(key, {
      mp3Path: disc.mp3Path,
      mp3File: disc.mp3File,
      dir: disc.mp3Path ? disc.mp3Path.slice(0, disc.mp3Path.lastIndexOf('/')) : '',
      trackNumber: track.track,
      title: track.title || '',
      performer: track.performer || disc.albumPerformer || '',
      albumTitle: disc.albumTitle || '',
      startSeconds: track.startSeconds,
    });
    starEl.classList.add('fav-active');
    starEl.title = 'Remove from favorites';
  }
  saveFavorites();
  const favsPanel = document.getElementById('favs-panel');
  if (favsPanel && !favsPanel.classList.contains('hidden')) renderFavsList();
}

// ── Filter ────────────────────────────────────────────────────────────────────
function applyFilter(query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  filterClear.classList.toggle('hidden', words.length === 0);

  folderBrowser.querySelectorAll('.folder-item').forEach((item) => {
    const name = item.dataset.name || '';
    const nameLower = name.toLowerCase();
    const matches = words.length === 0 || words.every((w) => nameLower.includes(w));
    item.classList.toggle('filter-hidden', !matches);

    const label = item.querySelector('.folder-label');
    if (!label) return;

    if (words.length && matches) {
      // Highlight each word; build a regex that matches any of them
      const pattern = new RegExp(
        words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
        'gi'
      );
      label.innerHTML = escapeHtml(name).replace(
        // Run the regex on the escaped string so tags don't break
        new RegExp(
          words.map((w) => escapeHtml(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
          'gi'
        ),
        (m) => `<mark>${m}</mark>`
      );
    } else {
      label.textContent = name;
    }
  });
}

// ── Folder browser ────────────────────────────────────────────────────────────
const SORT_KEY = 'tlp_folder_sort';
let folderSort = localStorage.getItem(SORT_KEY) || 'name'; // 'name' | 'date'
let lastSubdirs = []; // cache for re-sorting without re-fetching
let lastBrowseDir = '';

const sortToggle = document.getElementById('sort-toggle');
function applySortLabel() {
  sortToggle.textContent = folderSort === 'name' ? 'A–Z' : 'Date';
  sortToggle.title = folderSort === 'name' ? 'Sorted A–Z (click for date)' : 'Sorted by date (click for A–Z)';
}
applySortLabel();

sortToggle.addEventListener('click', () => {
  folderSort = folderSort === 'name' ? 'date' : 'name';
  localStorage.setItem(SORT_KEY, folderSort);
  applySortLabel();
  if (lastBrowseDir) renderFolderItems(lastBrowseDir, lastSubdirs);
});

function normEntry(e) { return typeof e === 'string' ? { name: e, mtime: 0 } : e; }
function sortedSubdirs(subdirs) {
  const copy = subdirs.map(normEntry);
  if (folderSort === 'date') {
    copy.sort((a, b) => b.mtime - a.mtime); // newest first
  } else {
    copy.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }
  return copy;
}

function makeFolderItem(dir, name, mtime, activeNames) {
  const item = document.createElement('div');
  item.className = 'folder-item';
  item.dataset.name = name;
  item.dataset.mtime = mtime || 0;
  if (activeNames && activeNames.has(name)) item.classList.add('active');
  item.innerHTML = `<span class="folder-label">${escapeHtml(name)}</span>`;
  const fullPath = `${dir}/${name}`;
  let clickTimer = null;
  item.addEventListener('click', () => {
    if (clickTimer) return; // dblclick will handle it
    clickTimer = setTimeout(() => {
      clickTimer = null;
      folderBrowser.querySelectorAll('.folder-item.active').forEach((el) => el.classList.remove('active'));
      item.classList.add('active');
      STORAGE.setScanDir(fullPath);
      scanDirectory(fullPath);
    }, 220);
  });
  item.addEventListener('dblclick', () => {
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
    folderBrowser.querySelectorAll('.folder-item.active').forEach((el) => el.classList.remove('active'));
    item.classList.add('active');
    STORAGE.setScanDir(fullPath);
    scanDirectory(fullPath, true);
  });
  return item;
}

function insertFolderItemSorted(dir, name, mtime, activeNames) {
  const item = makeFolderItem(dir, name, mtime, activeNames);
  const existing = [...folderBrowser.querySelectorAll('.folder-item')];
  if (folderSort === 'date') {
    const ref = existing.find((el) => mtime > Number(el.dataset.mtime || 0));
    ref ? folderBrowser.insertBefore(item, ref) : folderBrowser.appendChild(item);
  } else {
    const ref = existing.find((el) =>
      name.localeCompare(el.dataset.name || '', undefined, { sensitivity: 'base' }) < 0
    );
    ref ? folderBrowser.insertBefore(item, ref) : folderBrowser.appendChild(item);
  }
  return item;
}

function renderFolderItems(dir, subdirs) {
  const activeNames = new Set(
    [...folderBrowser.querySelectorAll('.folder-item.active')].map((el) => el.dataset.name)
  );
  folderBrowser.querySelectorAll('.folder-item').forEach((el) => el.remove());
  for (const entry of sortedSubdirs(subdirs)) {
    folderBrowser.appendChild(makeFolderItem(dir, entry.name, entry.mtime, activeNames));
  }
  applyFilter(filterInput.value);
}

function addUpRow(parent) {
  const up = document.createElement('div');
  up.className = 'folder-up';
  up.textContent = '↑  ..';
  up.addEventListener('click', () => loadFolderBrowser(parent));
  folderBrowser.prepend(up);
}

async function loadFolderBrowser(dir, bust = false) {
  state.browseDir = dir;
  lastBrowseDir = dir;
  lastSubdirs = [];

  return new Promise((resolve) => {
    folderBrowser.innerHTML = '<div class="status-msg">Loading…</div>';
    let metaDone = false;
    let parent = null;

    const url = `/api/ls-stream?dir=${encodeURIComponent(dir)}${bust ? '&bust=1' : ''}`;
    const source = new EventSource(url);

    const activeNames = new Set(
      [...folderBrowser.querySelectorAll('.folder-item.active')].map((el) => el.dataset.name)
    );

    source.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch (_) { return; }

      if (msg.type === 'batch') {
        // Cache hit — all data arrives at once
        source.close();
        parent = msg.parent;
        lastSubdirs = msg.subdirs || [];
        folderBrowser.innerHTML = '';
        if (parent) addUpRow(parent);
        if (!lastSubdirs.length && !parent) {
          folderBrowser.innerHTML = '<div class="status-msg">No subfolders.</div>';
        } else {
          renderFolderItems(dir, lastSubdirs);
        }
        resolve();
        return;
      }

      if (msg.type === 'meta') {
        parent = msg.parent;
        folderBrowser.innerHTML = '';
        if (parent) addUpRow(parent);
        metaDone = true;
        return;
      }

      if (msg.type === 'entry') {
        if (!metaDone) { folderBrowser.innerHTML = ''; metaDone = true; }
        const entry = { name: msg.name, mtime: msg.mtime };
        lastSubdirs.push(entry);
        insertFolderItemSorted(dir, msg.name, msg.mtime, activeNames);
        applyFilter(filterInput.value);
        return;
      }

      if (msg.type === 'done') {
        source.close();
        if (!lastSubdirs.length && !parent) {
          folderBrowser.innerHTML = '<div class="status-msg">No subfolders.</div>';
        }
        resolve();
        return;
      }

      if (msg.type === 'error') {
        source.close();
        folderBrowser.innerHTML = `<div class="status-msg" style="color:#c06060">${escapeHtml(msg.message)}</div>`;
        resolve();
      }
    };

    source.onerror = () => { source.close(); resolve(); };
  });
}

// ── NFO / Tracklist pane ──────────────────────────────────────────────────────
const nfoPane         = document.getElementById('nfo-pane');
const mainResizeH     = document.getElementById('main-resize-h');
const mainTop         = document.getElementById('main-top');
const artworkPane     = document.getElementById('artwork-pane');
const artworkImg      = document.getElementById('artwork-img');
const nfoTabNfo        = document.getElementById('nfo-tab-nfo');
const nfoTabTracklist  = document.getElementById('nfo-tab-tracklist');
const tracklistContent = document.getElementById('tracklist-content');
const nfoTabDetect     = document.getElementById('nfo-tab-detect');
const nfoDetectBtn     = document.getElementById('nfo-detect-btn');
const nfoTabDetectBtn  = document.getElementById('nfo-tab-detect-btn');
const detectStatus     = document.getElementById('detect-status');
const detectTracksList = document.getElementById('detect-tracks-list');
const detectApplyBtn   = document.getElementById('detect-apply-btn');

let activeInfoTab = 'nfo'; // 'nfo' | 'tracklist'

function switchInfoTab(tab) {
  activeInfoTab = tab;
  document.querySelectorAll('.nfo-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  nfoTabNfo.classList.toggle('hidden', tab !== 'nfo');
  nfoTabTracklist.classList.toggle('hidden', tab !== 'tracklist');
  nfoTabDetect.classList.toggle('hidden', tab !== 'detect');
}

document.getElementById('nfo-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.nfo-tab');
  if (btn) switchInfoTab(btn.dataset.tab);
});

function setNfoPaneVisible(visible) {
  nfoPane.classList.toggle('hidden', !visible);
  // Show artwork in the NFO slot when NFO is closed (if artwork is loaded)
  artworkPane.classList.toggle('hidden', visible || !currentArtworkUrl);
}
const nfoContent       = document.getElementById('nfo-content');
const nfoPaneClose     = document.getElementById('nfo-pane-close');
const streamInfoPanel  = document.getElementById('stream-info-panel');
const streamInfoContent = document.getElementById('stream-info-content');
const localBtn         = document.getElementById('local-btn');

// Switch NFO pane between local (NFO/DETECT tabs) and streaming (INFO panel) mode
function enterStreamingInfoMode() {
  document.getElementById('nfo-tabs').classList.add('hidden');
  document.getElementById('nfo-tab-nfo').classList.add('hidden');
  document.getElementById('nfo-tab-tracklist') && document.getElementById('nfo-tab-tracklist').classList.add('hidden');
  document.getElementById('nfo-tab-detect').classList.add('hidden');
  document.getElementById('nfo-detect-btn').classList.add('hidden');
  streamInfoPanel.classList.remove('hidden');
  nfoPane.classList.remove('hidden');
  artworkPane.classList.add('hidden');
  localBtn.classList.remove('hidden');
}

function exitStreamingInfoMode() {
  streamInfoPanel.classList.add('hidden');
  streamInfoContent.innerHTML = '';
  document.getElementById('nfo-tabs').classList.remove('hidden');
  document.getElementById('nfo-tab-nfo').classList.remove('hidden');
  nfoPane.classList.add('hidden');
  artworkPane.classList.toggle('hidden', !currentArtworkUrl);
  localBtn.classList.add('hidden');
}

function formatDurationMs(ms) {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

function renderStreamInfo(rows, description) {
  const escFn = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const linkify = (text) => escFn(text).replace(
    /https?:\/\/[^\s<>"]+/g,
    (url) => `<a class="nfo-link" href="${escFn(url)}" target="_blank" rel="noopener noreferrer">${escFn(url)}</a>`
  );
  let html = '<table class="stream-info-table">';
  for (const [label, value] of rows) {
    if (!value) continue;
    html += `<tr><th>${escFn(label)}</th><td>${escFn(String(value))}</td></tr>`;
  }
  html += '</table>';
  if (description && description.trim()) {
    html += `<div class="stream-info-desc">${linkify(description)}</div>`;
  }
  streamInfoContent.innerHTML = html;
}

function showSoundcloudTrackInfo(track) {
  const tags = (track.tag_list || '').split(/\s+/).filter(Boolean).join(', ');
  const plays = track.playback_count ? track.playback_count.toLocaleString() : null;
  const favs  = track.favoritings_count ? track.favoritings_count.toLocaleString() : null;
  const bpm   = track.bpm || null;
  const key   = track.key_signature || null;
  const date  = track.created_at ? track.created_at.slice(0, 10) : null;
  renderStreamInfo([
    ['Artist',  track.user && track.user.username],
    ['Genre',   track.genre],
    ['Tags',    tags || null],
    ['BPM',     bpm],
    ['Key',     key],
    ['Duration', formatDurationMs(track.duration)],
    ['Plays',   plays],
    ['Likes',   favs],
    ['Released', date],
    ['Label',   track.label_name],
  ], track.description);
}

function showSpotifyTrackInfo(item) {
  // item is track_window.current_track from player_state_changed
  const artists = (item.artists || []).map((a) => a.name).join(', ');
  const album   = item.album && item.album.name;
  const release = item.album && item.album.release_date;
  const duration = item.duration_ms ? formatDurationMs(item.duration_ms) : null;
  renderStreamInfo([
    ['Artists',  artists],
    ['Album',    album],
    ['Released', release],
    ['Duration', duration],
  ], null);
}

let lastNfoDir = '';
let lastNfoText = '';

const URL_RE = /https?:\/\/[^\s\])"'>]+/g;
function linkifyNfo(html) {
  // html is already escaped — wrap bare URLs in anchor tags
  return html.replace(URL_RE, (url) => `<a class="nfo-link" href="${url}" title="${url}">${url}</a>`);
}

function highlightNfo() {
  if (!lastNfoText) return;
  const disc = currentDisc();
  const title = disc && state.currentTrackIndex >= 0
    ? (disc.tracks[state.currentTrackIndex] || {}).title
    : null;

  const escaped = escapeHtml(lastNfoText);

  if (!title) {
    nfoContent.innerHTML = linkifyNfo(escaped);
    return;
  }

  const escapedTitle = escapeHtml(title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlighted = escaped.replace(
    new RegExp(escapedTitle, 'gi'),
    (m) => `<mark class="nfo-hl">${m}</mark>`
  );
  nfoContent.innerHTML = linkifyNfo(highlighted);

  const first = nfoContent.querySelector('.nfo-hl');
  if (first) first.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

nfoContent.addEventListener('click', (e) => {
  const link = e.target.closest('.nfo-link');
  if (!link) return;
  e.preventDefault();
  const url = link.href;
  if (window.electronAPI && window.electronAPI.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
});

function formatTimeShort(s) {
  if (!isFinite(s) || s < 0) return '';
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function renderTracklist(disc) {
  if (!disc || !disc.tracks || disc.tracks.length === 0) {
    tracklistContent.innerHTML = '<div style="padding:14px;font-size:12px;color:var(--text-muted)">No tracks</div>';
    return;
  }
  tracklistContent.innerHTML = disc.tracks.map((t, i) => `
    <div class="tl-track${i === state.currentTrackIndex ? ' active' : ''}" data-idx="${i}">
      <span class="tl-num">${String(t.track || i + 1).padStart(2, '0')}</span>
      <span class="tl-title">${escapeHtml(t.title || '')}</span>
      ${t.performer ? `<span class="tl-performer">${escapeHtml(t.performer)}</span>` : ''}
      <span class="tl-time">${formatTimeShort(t.startSeconds)}</span>
    </div>`).join('');
}

function highlightTracklist() {
  document.querySelectorAll('.tl-track').forEach((row) => {
    const active = parseInt(row.dataset.idx, 10) === state.currentTrackIndex;
    row.classList.toggle('active', active);
    if (active) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

tracklistContent.addEventListener('click', (e) => {
  const row = e.target.closest('.tl-track');
  if (!row) return;
  const disc = currentDisc();
  if (!disc) return;
  const idx = parseInt(row.dataset.idx, 10);
  playDiscAtTrack(disc, idx);
});

async function showNfo(dir) {
  try {
    const res = await fetch(`/api/nfo?dir=${encodeURIComponent(dir)}`);
    if (!res.ok) {
      lastNfoParsedTracks = null;
      nfoDetectBtn.classList.add('hidden');
      nfoTabDetectBtn.classList.add('hidden');
      // No NFO — show tracklist tab only if we have tracks; hide NFO tab
      const disc = currentDisc();
      if (disc && disc.tracks && disc.tracks.length > 0) {
        renderTracklist(disc);
        setNfoPaneVisible(true);
        switchInfoTab('tracklist');
        nfoBtn.classList.add('hidden');
      } else {
        nfoPane.classList.add('hidden');
        nfoBtn.classList.add('hidden');
      }
      return;
    }
    const text = await res.text();
    lastNfoDir = dir;
    lastNfoText = text;
    lastNfoParsedTracks = parseNfoTracklist(text);
    const disc = currentDisc();
    const canDetect = lastNfoParsedTracks !== null && disc && !disc.tracks.length;
    nfoDetectBtn.classList.toggle('hidden', !canDetect);
    nfoTabDetectBtn.classList.toggle('hidden', !canDetect);
    highlightNfo();
    if (disc) renderTracklist(disc);
    setNfoPaneVisible(true);
    switchInfoTab('nfo');
    nfoBtn.classList.add('hidden'); // hide toggle while pane is open
  } catch (_) {
    lastNfoParsedTracks = null;
    nfoDetectBtn.classList.add('hidden');
    nfoTabDetectBtn.classList.add('hidden');
    setNfoPaneVisible(false);
    nfoBtn.classList.add('hidden');
  }
}

nfoPaneClose.addEventListener('click', () => {
  setNfoPaneVisible(false);
  if (lastNfoDir || currentDisc()) nfoBtn.classList.remove('hidden');
});

nfoBtn.addEventListener('click', () => {
  setNfoPaneVisible(true);
  nfoBtn.classList.add('hidden');
});

nfoDetectBtn.addEventListener('click', () => {
  switchInfoTab('detect');
  runDetectTransitions();
});

detectApplyBtn.addEventListener('click', () => {
  if (!detectStagedTracks || !detectStagedTracks.length) return;
  tlTargetDisc   = currentDisc();
  // Strip internal _confidence field before applying
  tlStagedTracks = detectStagedTracks.map(({ _confidence, ...t }) => t);
  applyScrapedTracklist();
  lastNfoParsedTracks = null;
  detectStagedTracks  = null;
  nfoDetectBtn.classList.add('hidden');
  nfoTabDetectBtn.classList.add('hidden');
  switchInfoTab('tracklist');
});

finderBtn.addEventListener('click', () => {
  const p = finderBtn.dataset.path;
  if (!p) return;
  if (window.electronAPI?.revealFile) window.electronAPI.revealFile(p);
  else fetch(`/api/reveal?path=${encodeURIComponent(p)}`).catch(() => {});
});

// Returns {start, end} in seconds for the currently playing track (or whole file for raw discs).
// Used by mini-player to scope the seek bar to the current track only.
function getTrackBounds() {
  const disc = currentDisc();
  const dur = audio.duration;
  const fallback = { start: 0, end: isFinite(dur) ? dur : 0 };
  if (!disc || !disc.tracks || !disc.tracks.length) return fallback;
  const idx = state.currentTrackIndex >= 0 ? state.currentTrackIndex : 0;
  const track = disc.tracks[idx];
  if (!track) return fallback;
  const next = disc.tracks[idx + 1];
  return { start: track.startSeconds, end: next ? next.startSeconds : (isFinite(dur) ? dur : track.startSeconds) };
}

// ── Track detection ───────────────────────────────────────────────────────────
function detectCurrentTrack(currentTime) {
  const disc = currentDisc();
  if (!disc || !disc.tracks.length) return -1;
  let idx = 0;
  for (let i = 0; i < disc.tracks.length; i++) {
    if (disc.tracks[i].startSeconds <= currentTime) idx = i;
    else break;
  }
  return idx;
}

function updateNowPlaying(trackIdx) {
  const disc = currentDisc();
  if (!disc) return;

  if (trackIdx < 0 || !disc.tracks.length) {
    npDisc.textContent = disc.albumTitle || disc.mp3File || '—';
    npTrackNumber.textContent = '';
    npTitle.textContent = disc.albumTitle || '—';
    npTitle.classList.remove('is-fav');
    npPerformer.textContent = disc.albumPerformer || '';
    spotifySearchBtn.classList.add('hidden');
    soundcloudSearchBtn.classList.add('hidden');
    finderBtn.classList.toggle('hidden', !disc.mp3Path);
    if (disc.mp3Path) finderBtn.dataset.path = disc.mp3Path;
    tlBtn.classList.toggle('hidden', !disc.mp3Path);
    return;
  }

  const track = disc.tracks[trackIdx];
  npDisc.textContent = disc.albumTitle || disc.mp3File || '—';
  npTrackNumber.textContent = String(track.track).padStart(2, '0');
  npTitle.textContent = track.title || '(unknown title)';
  npTitle.classList.toggle('is-fav', state.favorites.has(favKey(disc.mp3File, track.track)));
  npPerformer.textContent = track.performer || disc.albumPerformer || '';

  const query = [track.performer || disc.albumPerformer, track.title].filter(Boolean).join(' ');
  if (query) {
    spotifySearchBtn.href = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
    spotifySearchBtn.classList.remove('hidden');
    soundcloudSearchBtn.href = `https://soundcloud.com/search?q=${encodeURIComponent(query)}`;
    soundcloudSearchBtn.classList.remove('hidden');
  } else {
    spotifySearchBtn.classList.add('hidden');
    soundcloudSearchBtn.classList.add('hidden');
  }

  if (disc.mp3Path) {
    finderBtn.dataset.path = disc.mp3Path;
    finderBtn.classList.remove('hidden');
    tlBtn.classList.remove('hidden');
  } else {
    finderBtn.classList.add('hidden');
    tlBtn.classList.add('hidden');
  }

  if (isMini) updateMiniInfo();
}

function highlightTrackInSidebar(discId, trackIdx) {
  discList.querySelectorAll('.track-item').forEach((el) => {
    el.classList.remove('active');
    el.style.removeProperty('--prog');
  });
  // trackIdx -1 means raw disc (no CUE) — still highlight the single file row
  const el = discList.querySelector(`.track-item[data-disc="${discId}"][data-track="${trackIdx}"]`);
  if (el) { el.classList.add('active'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

function updateTrackProgress() {
  const el = discList.querySelector('.track-item.active');
  if (!el || !isFinite(audio.duration) || audio.duration <= 0) return;
  const disc = currentDisc();
  if (!disc) return;
  const ct = audio.currentTime;
  let pct;
  const track = disc.tracks[state.currentTrackIndex];
  if (track) {
    // CUE-backed disc: progress within this specific track
    const next = disc.tracks[state.currentTrackIndex + 1];
    const trackEnd = next ? next.startSeconds : audio.duration;
    if (trackEnd <= track.startSeconds) return;
    pct = ((ct - track.startSeconds) / (trackEnd - track.startSeconds)) * 100;
  } else {
    // Raw file (no CUE): progress through the whole file
    pct = (ct / audio.duration) * 100;
  }
  el.style.setProperty('--prog', `${Math.min(100, Math.max(0, pct)).toFixed(1)}%`);
}

// ── Seek bar track markers ─────────────────────────────────────────────────────
const seekTicks = document.getElementById('seek-ticks');

function setTrackLabelsVisible(on) {
  STORAGE.setTrackLabels(on);
  seekTicks.classList.toggle('no-labels', !on);
  if (on) updateTickLabelVisibility();
}

function updateSeekTicks() {
  seekTicks.innerHTML = '';
  const disc = currentDisc();
  if (!disc || !disc.tracks.length || !isFinite(audio.duration)) return;
  let labelIdx = 0;
  for (const track of disc.tracks) {
    if (track.startSeconds <= 0) continue; // skip track 1 at 0:00
    const pct = (track.startSeconds / audio.duration) * 100;
    const tick = document.createElement('div');
    const above = (labelIdx % 2 === 0);
    tick.className = `seek-tick ${above ? 'seek-tick--above' : 'seek-tick--below'}`;
    tick.style.left = `${pct}%`;
    const num = String(track.track).padStart(2, '0');
    tick.dataset.startSeconds = track.startSeconds;
    const bar = document.createElement('div');
    bar.className = 'seek-tick-bar';
    tick.appendChild(bar);
    const label = document.createElement('span');
    label.className = 'seek-tick-label';
    label.textContent = `${num} — ${track.title || ''}`;
    tick.title = label.textContent;
    tick.appendChild(label);
    seekTicks.appendChild(tick);
    labelIdx++;
  }
  updateTickLabelVisibility();
}

function updateTickLabelVisibility() {
  if (seekTicks.classList.contains('no-labels')) return;
  const wrapWidth = seekBar.offsetWidth;
  if (wrapWidth === 0) return;
  const MIN_GAP = 72; // px — minimum space between label centres
  const ticks = Array.from(seekTicks.querySelectorAll('.seek-tick'));
  let lastX = -MIN_GAP;
  ticks.forEach((tick) => {
    const x = (parseFloat(tick.style.left) / 100) * wrapWidth;
    const label = tick.querySelector('.seek-tick-label');
    if (!label) return;
    if (x - lastX >= MIN_GAP) {
      label.style.display = '';
      lastX = x;
    } else {
      label.style.display = 'none';
    }
  });
}

window.addEventListener('resize', updateTickLabelVisibility);

seekTicks.addEventListener('click', (e) => {
  const tick = e.target.closest('.seek-tick');
  if (!tick || tick.dataset.startSeconds == null) return;
  e.stopPropagation();
  const t = parseFloat(tick.dataset.startSeconds);
  audio.currentTime = t;
  waveformRenderer.seekTo(t);
  if (audio.paused) audio.play().catch(() => {});
});

// ── Audio / disc loading ──────────────────────────────────────────────────────
function discAudioSrc(disc) {
  return disc.blobUrl || (disc.mp3Path ? fileUrl(disc.mp3Path) : null);
}

function loadDisc(disc) {
  const src = discAudioSrc(disc);
  if (!src) return;
  state.currentDiscId = disc.id;
  state.currentTrackIndex = -1;
  audio.src = src;
  audio.load();
  updateNowPlaying(-1);
  highlightTrackInSidebar(disc.id, -1);
  if (disc.mp3Path) {
    loadWaveform(disc);
    loadArtwork(disc);
  } else {
    waveformRenderer.clear();
    wfSection.classList.add('hidden');
  }
}

function playDiscAtTrack(disc, trackIdx) {
  const src = discAudioSrc(disc);
  if (!src) return;

  const alreadyLoaded = state.currentDiscId === disc.id && audio.src;
  const srcMatch = disc.mp3Path
    ? audio.src.includes(encodeURIComponent(disc.mp3Path))
    : audio.src === disc.blobUrl;
  if (!alreadyLoaded || !srcMatch) {
    state.currentDiscId = disc.id;
    audio.src = src;
    audio.load();
  } else {
    state.currentDiscId = disc.id;
  }

  state.currentTrackIndex = trackIdx;
  updateNowPlaying(trackIdx);
  highlightTrackInSidebar(disc.id, trackIdx);
  loadWaveform(disc);
  loadArtwork(disc);

  const startSecs = disc.tracks[trackIdx] ? disc.tracks[trackIdx].startSeconds : 0;

  function seekAndPlay() {
    audio.currentTime = startSecs;
    waveformRenderer.seekTo(startSecs);
    audio.play().catch(() => {});
    updateSeekTicks();
    audio.removeEventListener('loadedmetadata', seekAndPlay);
  }

  if (audio.readyState >= 1) seekAndPlay();
  else audio.addEventListener('loadedmetadata', seekAndPlay);
}

// ── Disc list rendering ───────────────────────────────────────────────────────
function renderDiscList() {
  discList.innerHTML = '';

  if (!state.discs.length) {
    discList.innerHTML = '<div class="status-msg">No MP3/CUE files here.</div>';
    return;
  }

  for (const disc of state.discs) {
    loadScrapedTracklist(disc); // inject persisted tracklist if disc has no CUE tracks
    const section = document.createElement('div');
    section.className = 'disc-section';

    const header = document.createElement('div');
    header.className = 'disc-header';
    const titleText = disc.albumTitle || disc.mp3File || `Disc ${disc.id + 1}`;
    const performer = disc.albumPerformer ? ` — <span>${escapeHtml(disc.albumPerformer)}</span>` : '';
    header.innerHTML = `${escapeHtml(titleText)}${performer}`;
    section.appendChild(header);

    if (!disc.mp3Path) {
      const warn = document.createElement('div');
      warn.className = 'disc-no-mp3';
      warn.textContent = 'No MP3 found for this CUE.';
      section.appendChild(warn);
      discList.appendChild(section);
      continue;
    }

    if (!disc.tracks.length) {
      const item = document.createElement('div');
      item.className = 'track-item';
      item.dataset.disc = disc.id;
      item.dataset.track = -1;
      const rawKey = favKey(disc.mp3File, 1);
      const rawIsFav = state.favorites.has(rawKey);
      item.innerHTML = `
        <span class="track-num"></span>
        <span class="track-info">
          <div class="track-title" style="color:var(--text-dim)">${escapeHtml(disc.mp3File)}</div>
        </span>
        <button class="fav-btn${rawIsFav ? ' fav-active' : ''}" data-key="${escapeHtml(rawKey)}" title="${rawIsFav ? 'Remove from favorites' : 'Add to favorites'}">&#9733;</button>
      `;
      item.addEventListener('click', (e) => {
        if (e.target.closest('.fav-btn')) return;
        loadDisc(disc);
        audio.play().catch(() => {});
      });
      item.querySelector('.fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const starEl = e.currentTarget;
        if (state.favorites.has(rawKey)) {
          state.favorites.delete(rawKey);
          starEl.classList.remove('fav-active');
          starEl.title = 'Add to favorites';
        } else {
          state.favorites.set(rawKey, {
            mp3File: disc.mp3File, mp3Path: disc.mp3Path, dir: disc.dir || '',
            trackNumber: 1, title: disc.albumTitle || disc.mp3File,
            performer: disc.albumPerformer || '', albumTitle: disc.albumTitle || '',
            startSeconds: 0,
          });
          starEl.classList.add('fav-active');
          starEl.title = 'Remove from favorites';
        }
        saveFavorites();
        const favsPanel = document.getElementById('favs-panel');
        if (favsPanel && !favsPanel.classList.contains('hidden')) renderFavsList();
      });
      section.appendChild(item);
      discList.appendChild(section);
      continue;
    }

    for (let i = 0; i < disc.tracks.length; i++) {
      const track = disc.tracks[i];
      const item = document.createElement('div');
      item.className = 'track-item';
      item.dataset.disc = disc.id;
      item.dataset.track = i;
      item.dataset.title = (track.title || '').toLowerCase();
      item.dataset.performer = (track.performer || disc.albumPerformer || '').toLowerCase();

      const isFav = state.favorites.has(favKey(disc.mp3File, track.track));

      item.innerHTML = `
        <span class="track-num">${String(track.track).padStart(2, '0')}</span>
        <span class="track-info">
          <div class="track-title">${escapeHtml(track.title || '(unknown)')}</div>
          ${track.performer ? `<div class="track-performer">${escapeHtml(track.performer)}</div>` : ''}
        </span>
        <button class="fav-btn${isFav ? ' fav-active' : ''}" data-key="${escapeHtml(favKey(disc.mp3File, track.track))}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">&#9733;</button>
        <span class="track-time">${formatTime(track.startSeconds)}</span>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.fav-btn')) return;
        playDiscAtTrack(disc, i);
      });

      item.querySelector('.fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(disc, i, e.currentTarget);
      });

      section.appendChild(item);
    }

    discList.appendChild(section);
  }

  applyFilter(filterInput.value);
}

// ── Search ────────────────────────────────────────────────────────────────────
// ── Library management ────────────────────────────────────────────────────────
const libraryModalOverlay = document.getElementById('library-modal-overlay');
const libraryFolderList   = document.getElementById('library-folder-list');
const libraryBtn          = document.getElementById('library-btn');
const libraryModalClose   = document.getElementById('library-modal-close');
const libraryAddBtn       = document.getElementById('library-add-btn');

let libraryFolders = [];  // in-memory copy, synced with server

async function loadLibrary() {
  try {
    const res = await fetch('/api/library');
    const data = await res.json();
    libraryFolders = data.folders || [];
  } catch (_) {
    libraryFolders = [];
  }
}

function renderLibraryList() {
  libraryFolderList.innerHTML = '';
  if (!libraryFolders.length) {
    libraryFolderList.innerHTML = '<div class="library-empty-msg">No folders in library yet.<br>Click "+ Add Folder" to get started.</div>';
    return;
  }
  for (const folder of libraryFolders) {
    const item = document.createElement('div');
    item.className = 'library-folder-item';
    const name = folder.split('/').filter(Boolean).pop() || folder;
    item.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="library-folder-name">${escapeHtml(name)}</div>
        <div class="library-folder-path">${escapeHtml(folder)}</div>
      </div>
      <button class="library-folder-remove" title="Remove from library">&#x2715;</button>
    `;
    item.querySelector('.library-folder-remove').addEventListener('click', async () => {
      await fetch('/api/library', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder }) });
      libraryFolders = libraryFolders.filter((f) => f !== folder);
      musicIndex = null;  // invalidate search index
      renderLibraryList();
    });
    libraryFolderList.appendChild(item);
  }
}

async function openLibraryModal() {
  await loadLibrary();
  renderLibraryList();
  libraryModalOverlay.classList.add('active');
  libraryBtn.classList.add('active');
}

function closeLibraryModal() {
  libraryModalOverlay.classList.remove('active');
  libraryBtn.classList.remove('active');
}

libraryBtn.addEventListener('click', () => {
  if (libraryModalOverlay.classList.contains('active')) closeLibraryModal();
  else openLibraryModal();
});
libraryModalClose.addEventListener('click', closeLibraryModal);
libraryModalOverlay.addEventListener('click', (e) => { if (e.target === libraryModalOverlay) closeLibraryModal(); });

libraryAddBtn.addEventListener('click', async () => {
  let folder = null;
  if (window.electronAPI?.pickDirectory) {
    folder = await window.electronAPI.pickDirectory();
  } else {
    folder = prompt('Enter folder path:');
  }
  if (!folder) return;
  const res = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder }) });
  const data = await res.json();
  libraryFolders = data.folders || [];
  musicIndex = null;  // invalidate search index
  renderLibraryList();
});

// ── Search ────────────────────────────────────────────────────────────────────
const searchModalOverlay = document.getElementById('search-modal-overlay');
const searchInput  = document.getElementById('search-input');
const searchCount  = document.getElementById('search-count');
const searchResults = document.getElementById('search-results');
const searchBtn    = document.getElementById('search-btn');
const searchClose  = document.getElementById('search-close');

let musicIndex = null;      // null = not yet loaded
let indexLoading = false;

function openSearchPanel() {
  searchModalOverlay.classList.add('active');
  searchBtn.classList.add('active');
  searchInput.focus();
  searchInput.select();
  if (!musicIndex && !indexLoading) fetchMusicIndex();
}

function closeSearchPanel() {
  searchModalOverlay.classList.remove('active');
  searchBtn.classList.remove('active');
}

let indexEventSources = []; // track open SSE streams so we can cancel them

function fetchMusicIndex() {
  // Cancel any in-progress streams
  for (const src of indexEventSources) src.close();
  indexEventSources = [];

  indexLoading = true;
  musicIndex = [];
  searchResults.innerHTML = '<div class="search-empty">Scanning… 0 albums found</div>';
  searchCount.textContent = '';

  loadLibrary().then(() => {
    const currentRoot = STORAGE.getDir();
    const roots = [...new Set([...libraryFolders, currentRoot].filter(Boolean))];
    if (!roots.length) {
      searchResults.innerHTML = '<div class="search-empty">Add folders to your library or load a directory first.</div>';
      indexLoading = false;
      return;
    }

    const seen = new Set();
    let pending = roots.length;
    let searchDebounce = null;

    function onEntry(entry) {
      const key = entry.mp3Path || entry.dir;
      if (seen.has(key)) return;
      seen.add(key);
      musicIndex.push(entry);
      const n = musicIndex.length;
      // Update counter and live-search every 25 entries
      if (n % 25 === 0 || n <= 5) {
        searchCount.textContent = `${n}+`;
        if (searchInput.value.trim()) {
          clearTimeout(searchDebounce);
          searchDebounce = setTimeout(() => runSearch(searchInput.value), 400);
        } else {
          searchResults.innerHTML = `<div class="search-empty">Scanning\u2026 ${n} albums found</div>`;
        }
      }
    }

    function onDone() {
      pending--;
      if (pending > 0) return;
      indexLoading = false;
      searchCount.textContent = `${musicIndex.length} albums`;
      runSearch(searchInput.value);
    }

    for (const root of roots) {
      const src = new EventSource(`/api/index-stream?root=${encodeURIComponent(root)}`);
      indexEventSources.push(src);
      src.onmessage = (e) => {
        let data;
        try { data = JSON.parse(e.data); } catch (_) { return; }
        if (data.done || data.error) { src.close(); onDone(); return; }
        onEntry(data);
      };
      src.onerror = () => { src.close(); onDone(); };
    }
  }).catch((e) => {
    searchResults.innerHTML = `<div class="search-empty">Index failed: ${escapeHtml(e.message)}</div>`;
    indexLoading = false;
  });
}

function highlight(text, words) {
  if (!words.length) return escapeHtml(text);
  let out = escapeHtml(text);
  for (const w of words) {
    const re = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    out = out.replace(re, '<mark>$1</mark>');
  }
  return out;
}

function runSearch(query) {
  if (!musicIndex) return;
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  if (!words.length) {
    searchCount.textContent = `${musicIndex.length} albums`;
    searchResults.innerHTML = '<div class="search-empty">Type to search…</div>';
    return;
  }

  // Build groups: disc header → matching tracks
  const groups = [];
  for (const disc of musicIndex) {
    const discText = [disc.albumTitle, disc.albumPerformer, disc.year].join(' ').toLowerCase();
    const discMatch = words.every((w) => discText.includes(w));

    const matchingTracks = disc.tracks.filter((t) => {
      const tt = [t.title, t.performer].join(' ').toLowerCase();
      return words.every((w) => tt.includes(w));
    });

    if (!discMatch && matchingTracks.length === 0) continue;

    // If disc matched but no specific track matched, show disc as a single result
    const tracksToShow = matchingTracks.length > 0 ? matchingTracks : (discMatch ? disc.tracks.slice(0, 1) : []);
    groups.push({ disc, tracksToShow, discMatch, matchingTracks });
  }

  const totalRows = groups.reduce((s, g) =>
    s + (g.disc.tracks.length === 0 ? 1 : g.tracksToShow.length), 0);
  searchCount.textContent = `${totalRows} result${totalRows !== 1 ? 's' : ''}`;

  if (groups.length === 0) {
    searchResults.innerHTML = '<div class="search-empty">No results.</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  for (const { disc, tracksToShow, discMatch } of groups) {
    const header = document.createElement('div');
    header.className = 'search-disc-header';
    header.innerHTML = `<span>${highlight(disc.albumTitle || disc.mp3File || '—', words)}</span>`
      + `<span style="color:var(--text-dim);font-weight:400">${highlight(disc.albumPerformer || '', words)}</span>`
      + (disc.year ? `<span class="search-disc-year">${disc.year}</span>` : '');
    frag.appendChild(header);

    if (disc.tracks.length === 0) {
      // No CUE — just the raw MP3
      const row = document.createElement('div');
      row.className = 'search-result disc-result';
      row.innerHTML = `<span class="search-result-num">&#9654;</span>`
        + `<span class="search-result-title">${highlight(disc.mp3File || disc.albumTitle || '—', words)}</span>`;
      row.addEventListener('click', () => playFromSearch(disc, -1));
      frag.appendChild(row);
    } else {
      for (const track of tracksToShow) {
        const trackIdx = disc.tracks.indexOf(track);
        const row = document.createElement('div');
        row.className = 'search-result';
        const dur = track.durationSeconds != null
          ? `<span class="search-result-dur">${formatDuration(track.durationSeconds)}</span>`
          : '';
        row.innerHTML = `<span class="search-result-num">${String(track.track).padStart(2, '0')}</span>`
          + `<span class="search-result-title">${highlight(track.title || '—', words)}</span>`
          + (track.performer ? `<span class="search-result-artist">${highlight(track.performer, words)}</span>` : '')
          + dur;
        row.addEventListener('click', () => playFromSearch(disc, trackIdx));
        frag.appendChild(row);
      }
    }
  }
  searchResults.innerHTML = '';
  searchResults.appendChild(frag);
}

async function playFromSearch(indexDisc, trackIdx) {
  closeSearchPanel();
  const targetMp3 = indexDisc.mp3Path;
  await scanDirectory(indexDisc.dir);
  const disc = state.discs.find((d) => d.mp3Path === targetMp3);
  if (!disc) return;
  if (trackIdx >= 0 && disc.tracks.length > trackIdx) {
    playDiscAtTrack(disc, trackIdx);
  } else {
    loadDisc(disc);
    audio.play().catch(() => {});
  }
}

searchBtn.addEventListener('click', () => {
  if (searchModalOverlay.classList.contains('active')) closeSearchPanel();
  else openSearchPanel();
});
searchClose.addEventListener('click', closeSearchPanel);
searchModalOverlay.addEventListener('click', (e) => {
  if (e.target === searchModalOverlay) closeSearchPanel();
});
searchInput.addEventListener('input', () => runSearch(searchInput.value));
searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSearchPanel(); });

// ── Starred tracks panel ──────────────────────────────────────────────────────
const favsPanel  = document.getElementById('favs-panel');
const favsBtn    = document.getElementById('favs-btn');
const favsClose  = document.getElementById('favs-close');
const favsList   = document.getElementById('favs-list');
const favsCount  = document.getElementById('favs-count');

function openFavsPanel() {
  favsPanel.classList.remove('hidden');
  favsBtn.classList.add('active');
  renderFavsList();
}

function closeFavsPanel() {
  favsPanel.classList.add('hidden');
  favsBtn.classList.remove('active');
}

function renderFavsList() {
  const items = [...state.favorites.values()];
  favsCount.textContent = `${items.length} track${items.length !== 1 ? 's' : ''}`;

  if (items.length === 0) {
    favsList.innerHTML = '<div class="search-empty">No starred tracks yet. Click ★ on any track.</div>';
    return;
  }

  items.sort((a, b) =>
    (a.albumTitle || '').localeCompare(b.albumTitle || '') || a.trackNumber - b.trackNumber
  );

  const frag = document.createDocumentFragment();
  let lastAlbum = null;
  for (const fav of items) {
    if (fav.albumTitle !== lastAlbum) {
      lastAlbum = fav.albumTitle;
      const header = document.createElement('div');
      header.className = 'search-disc-header';
      header.innerHTML = `<span>${escapeHtml(fav.albumTitle || fav.mp3File || '—')}</span>`;
      frag.appendChild(header);
    }

    const row = document.createElement('div');
    row.className = 'search-result';
    row.innerHTML = `<span class="search-result-num">${String(fav.trackNumber).padStart(2, '0')}</span>`
      + `<span class="search-result-title">${escapeHtml(fav.title || '—')}</span>`
      + (fav.performer ? `<span class="search-result-artist">${escapeHtml(fav.performer)}</span>` : '')
      + `<button class="fav-remove" title="Unstar">★</button>`;

    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('fav-remove')) {
        const key = favKey(fav.mp3File, fav.trackNumber);
        state.favorites.delete(key);
        saveFavorites();
        // Clear star in sidebar if visible
        const starBtn = discList.querySelector(`.fav-btn[data-key="${CSS.escape(key)}"]`);
        if (starBtn) starBtn.classList.remove('fav-active');
        renderFavsList();
        return;
      }
      playFromFav(fav);
    });
    frag.appendChild(row);
  }
  favsList.innerHTML = '';
  favsList.appendChild(frag);
}

async function playFromFav(fav) {
  closeFavsPanel();
  let disc = state.discs.find((d) => d.mp3Path === fav.mp3Path);
  if (!disc && fav.dir) {
    await scanDirectory(fav.dir);
    disc = state.discs.find((d) => d.mp3Path === fav.mp3Path);
  }
  if (!disc) return;
  const trackIdx = disc.tracks.findIndex((t) => t.track === fav.trackNumber);
  if (trackIdx >= 0) {
    playDiscAtTrack(disc, trackIdx);
  } else {
    loadDisc(disc);
    audio.addEventListener('canplay', function p() {
      audio.removeEventListener('canplay', p);
      audio.currentTime = fav.startSeconds;
      audio.play().catch(() => {});
    });
  }
}

favsBtn.addEventListener('click', () => {
  if (favsPanel.classList.contains('hidden')) openFavsPanel();
  else closeFavsPanel();
});
favsClose.addEventListener('click', closeFavsPanel);

// ── Spotify ───────────────────────────────────────────────────────────────────
let spotifyPlayer = null;
let spotifyDeviceId = null;
let spotifyConnected = false;
let spotifyAccessToken = null;
let spotifyTokenExpiry = 0;
let spotifyPollTimer = null;
let spotifyWasPlaying = false; // tracks previous paused state for end-of-track detection
let spotifyCurrentUri = null;  // URI of the currently loaded Spotify track
let spotifySDKReady = false;
let spotifySDKPendingToken = null;
let pendingSpotifyRestore = null; // { uri, position } set during startup restore

// Must be defined synchronously at module scope — the SDK script is async and may
// call this before initSpotify() has a chance to set it.
window.onSpotifyWebPlaybackSDKReady = () => {
  spotifySDKReady = true;
  if (spotifySDKPendingToken) {
    initSpotifySDK(spotifySDKPendingToken);
    spotifySDKPendingToken = null;
  }
};
let spotifyMode = false;
let spotifyActiveSource   = null; // { type:'liked' } | { type:'playlist', id, name }
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
  const res = await fetch('/api/spotify/refresh');
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
    // Restore session if one was pending (set during init)
    if (pendingSpotifyRestore) {
      const { uri, position } = pendingSpotifyRestore;
      pendingSpotifyRestore = null;
      getSpotifyToken().then((tok) => {
        fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(device_id)}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${tok}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ uris: [uri], position_ms: position || 0 }),
        }).catch(() => {});
      }).catch(() => {});
    }
  });
  spotifyPlayer.addListener('player_state_changed', (playerState) => {
    if (!playerState) return;
    const item = playerState.track_window && playerState.track_window.current_track;
    if (!item) return;

    const justEnded = spotifyWasPlaying && playerState.paused && playerState.position === 0;
    spotifyWasPlaying = !playerState.paused;
    spotifyCurrentUri = item.uri;

    // Mark which track is active in the tracks list
    spotifyTracksList.querySelectorAll('.spotify-track-item').forEach((el) => {
      el.classList.toggle('spotify-track-active', el.dataset.uri === item.uri);
    });
    btnPlay.innerHTML = playerState.paused ? '&#9654;' : '&#9646;&#9646;';

    // Show live spectrum when Spotify starts playing — find SDK's <audio> element
    if (!playerState.paused && waveformVisible) {
      const spotifyAudio = [...document.querySelectorAll('audio')].find((el) => el !== audio);
      if (spotifyAudio) {
        liveSpectrum.connectAudioElement(spotifyAudio);
        waveformRenderer.clear();
        currentWfPath = null;
        showLiveSpectrum();
      }
    }

    // Populate streaming info pane with Spotify track metadata
    showSpotifyTrackInfo(item);

    // Save Spotify session for restore on next launch
    if (!playerState.paused) {
      STORAGE.setStreamSession({ mode: 'spotify', uri: item.uri, position: playerState.position });
    }

    // Auto-advance to the next track when the current one finishes
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
  // Update settings disconnect row
  const disconnectRow = document.getElementById('spotify-disconnect-row');
  if (disconnectRow) disconnectRow.classList.toggle('hidden', !connected);
}

function openSpotifyMode() {
  if (soundcloudMode) closeSoundcloudMode();
  spotifyMode = true;
  spotifyBtn.classList.add('active');
  spotifyBtn.title = 'Exit Spotify mode';
  folderBrowser.classList.add('hidden');
  spotifyBrowser.classList.remove('hidden');
  discList.classList.add('hidden');
  spotifyTracksPanel.classList.remove('hidden');
  enterStreamingInfoMode();
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
  exitStreamingInfoMode();
  liveSpectrum.stop();
  liveSpectrumWrap.classList.add('hidden');
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

    // Liked Songs item always first
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
    // Mark active playlist in sidebar
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
        throw new Error('Playlist tracks require Spotify Extended Quota access.\nRequest it at developer.spotify.com → your app → Quota Extension.');
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
      const track = source.type === 'liked' ? item.track : item.track;
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
      } catch (_) {}
    }
  } catch (_) {}
}

async function connectSpotify() {
  // Open the popup synchronously (before any await) to avoid popup blockers
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

  // Poll for connection (every 2s, up to 60s)
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

  // Web Playback SDK not ready — find an active Spotify Connect device instead
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

  // No device at all — open track in Spotify app/browser as last resort
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
  await fetch('/api/spotify/disconnect').catch(() => {});
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

spotifyBtn.addEventListener('click', () => {
  if (spotifyMode) closeSpotifyMode();
  else openSpotifyMode();
});

spotifyBrowserConnectBtn.addEventListener('click', connectSpotify);
spotifyTracksLoadMoreBtn.addEventListener('click', () => {
  if (spotifyActiveSource) loadSpotifyTracks(spotifyActiveSource, spotifyTracksOffset);
});

// ── SoundCloud ────────────────────────────────────────────────────────────────
let soundcloudConnected   = false;
let soundcloudAccessToken = null;
let soundcloudTokenExpiry = 0;
let soundcloudPollTimer   = null;
let soundcloudMode        = false;
let soundcloudTracks      = [];
let soundcloudNextHref    = null;
let soundcloudActiveIdx   = -1;
let soundcloudActiveSource = 'liked';
let pendingScRestore      = null; // { trackIdx, position } set during startup restore

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
  const res = await fetch('/api/soundcloud/refresh');
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

    // Always show "Liked Tracks" entry at the top
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

function loadSoundcloudPlaylistTracks(pl) {
  soundcloudTracks = (pl.tracks || []).filter((t) => t && t.id);
  soundcloudNextHref = null;
  soundcloudTracksList.innerHTML = '';
  const frag = document.createDocumentFragment();
  soundcloudTracks.forEach((track, idx) => {
    const el = document.createElement('div');
    el.className = 'soundcloud-track-item';
    el.dataset.idx = String(idx);
    const dur = track.duration ? formatDuration(Math.round(track.duration / 1000)) : '';
    el.innerHTML = `<span class="soundcloud-play-icon">&#9654;</span>`
      + `<div class="soundcloud-track-info">`
      + `<div class="soundcloud-track-title">${escapeHtml(track.title || '—')}</div>`
      + `<div class="soundcloud-track-artist">${escapeHtml(track.user ? track.user.username : '')}</div>`
      + `</div>`
      + `<span class="soundcloud-track-duration">${escapeHtml(dur)}</span>`;
    el.addEventListener('click', () => playSoundcloudTrack(idx));
    frag.appendChild(el);
  });
  soundcloudTracksList.appendChild(frag);
  soundcloudTracksFooter.classList.add('hidden');
}

function openSoundcloudMode() {
  if (spotifyMode) closeSpotifyMode();
  soundcloudMode = true;
  soundcloudBtn.classList.add('active');
  soundcloudBtn.title = 'Exit SoundCloud mode';
  folderBrowser.classList.add('hidden');
  soundcloudBrowser.classList.remove('hidden');
  discList.classList.add('hidden');
  soundcloudTracksPanel.classList.remove('hidden');
  enterStreamingInfoMode();
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
  exitStreamingInfoMode();
  liveSpectrum.stop();
  liveSpectrumWrap.classList.add('hidden');
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
      const idx = startIdx + i;
      const el = document.createElement('div');
      el.className = 'soundcloud-track-item';
      el.dataset.idx = String(idx);
      const dur = track.duration ? formatDuration(Math.round(track.duration / 1000)) : '';
      el.innerHTML = `<span class="soundcloud-play-icon">&#9654;</span>`
        + `<div class="soundcloud-track-info">`
        + `<div class="soundcloud-track-title">${escapeHtml(track.title || '—')}</div>`
        + `<div class="soundcloud-track-artist">${escapeHtml(track.user ? track.user.username : '')}</div>`
        + `</div>`
        + `<span class="soundcloud-track-duration">${escapeHtml(dur)}</span>`;
      el.addEventListener('click', () => playSoundcloudTrack(idx));
      frag.appendChild(el);
    });
    soundcloudTracksList.appendChild(frag);

    soundcloudTracksFooter.classList.toggle('hidden', !soundcloudNextHref);

    // Restore session: play the saved track once the first page of tracks is loaded
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
  if (spotifyPlayer && spotifyCurrentUri) {
    spotifyPlayer.pause().catch(() => {});
  }

  // Clear local-track state (artwork, waveform, disc)
  state.currentDiscId = null;
  currentArtworkPath = null;
  if (currentArtworkUrl) { URL.revokeObjectURL(currentArtworkUrl); currentArtworkUrl = null; }
  artworkImg.src = '';
  artworkPane.classList.add('hidden');
  npSection.classList.remove('has-artwork');
  npSection.style.removeProperty('--artwork');
  currentWfPath = null;
  waveformRenderer.clear();
  showLiveSpectrum();

  audio.src = `/api/soundcloud/stream/${encodeURIComponent(track.id)}`;
  audio.play().catch(() => {});

  // Update now-playing display
  npDisc.textContent = track.user ? track.user.username : '';
  npTitle.textContent = track.title || '—';
  npPerformer.textContent = '';
  npTrackNumber.textContent = '';
  btnPlay.innerHTML = '&#9646;&#9646;';

  // Populate info pane with SoundCloud track metadata
  showSoundcloudTrackInfo(track);

  // Highlight active track
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
  // Open the popup synchronously (before any await) to avoid popup blockers
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
  await fetch('/api/soundcloud/disconnect').catch(() => {});
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

soundcloudBtn.addEventListener('click', () => {
  if (soundcloudMode) closeSoundcloudMode();
  else openSoundcloudMode();
});

localBtn.addEventListener('click', () => {
  if (spotifyMode) closeSpotifyMode();
  else if (soundcloudMode) closeSoundcloudMode();
});

soundcloudBrowserConnectBtn.addEventListener('click', connectSoundcloud);
soundcloudTracksLoadMoreBtn.addEventListener('click', () => {
  if (soundcloudNextHref) loadSoundcloudTracks(soundcloudNextHref);
});

// ── API ───────────────────────────────────────────────────────────────────────
let scanToken = 0;

async function scanDirectory(dir, autoplay = false) {
  const token = ++scanToken;
  discList.innerHTML = '<div class="status-msg">Loading...</div>';
  currentWfPath = null;
  waveformRenderer.clear();
  wfSection.classList.add('hidden');

  try {
    const res = await fetch(`/api/scan?dir=${encodeURIComponent(dir)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText);
    }
    const data = await res.json();
    if (token !== scanToken) return; // superseded by a newer scan
    state.discs = data.discs;
    renderDiscList();

    // Double-click: play first track from scratch
    if (autoplay) {
      const first = state.discs.find((d) => d.mp3Path && d.tracks.length);
      if (first) {
        playDiscAtTrack(first, 0);
      } else {
        const disc = state.discs.find((d) => d.mp3Path);
        if (disc) {
          loadDisc(disc);
          audio.addEventListener('canplay', function p() {
            audio.removeEventListener('canplay', p);
            audio.play().catch(() => {});
          });
        }
      }
      showNfo(dir);
      return;
    }

    // Restore saved playback position if it matches a disc in this scan
    const saved = STORAGE.getPlayState();
    const savedDisc = saved && state.discs.find((d) => d.mp3Path === saved.mp3Path);
    if (savedDisc) {
      state.currentDiscId = savedDisc.id;
      state.currentTrackIndex = saved.trackIdx;
      audio.src = fileUrl(savedDisc.mp3Path);
      audio.load();
      updateNowPlaying(saved.trackIdx);
      highlightTrackInSidebar(savedDisc.id, saved.trackIdx);
      audio.addEventListener('loadedmetadata', function restorePos() {
        audio.currentTime = saved.position || 0;
        audio.removeEventListener('loadedmetadata', restorePos);
      });
      loadWaveform(savedDisc);
      loadArtwork(savedDisc);
    } else {
      const first = state.discs.find((d) => d.mp3Path);
      if (first && !currentDisc()) loadDisc(first);
    }

    // Show NFO if present in this folder
    showNfo(dir);
  } catch (err) {
    discList.innerHTML = `<div class="status-msg" style="color:#c06060">Error: ${escapeHtml(err.message)}</div>`;
  }
}

// ── Audio events ──────────────────────────────────────────────────────────────
let savePlayStateTimer = null;

audio.addEventListener('timeupdate', () => {
  if (state.seeking) return;
  const ct = audio.currentTime;
  const dur = audio.duration;
  if (isMini && isFinite(dur)) {
    const { start, end } = getTrackBounds();
    const trackDur = end - start;
    const trackPos = ct - start;
    timeCurrent.textContent = formatTime(Math.max(0, trackPos));
    timeTotal.textContent = showRemaining
      ? `-${formatTime(Math.max(0, trackDur - trackPos))}`
      : formatTime(trackDur);
    seekBar.value = trackDur > 0 ? Math.max(0, Math.min(100, (trackPos / trackDur) * 100)) : 0;
  } else {
    timeCurrent.textContent = formatTime(ct);
    if (isFinite(dur)) {
      timeTotal.textContent = showRemaining ? `-${formatTime(dur - ct)}` : formatTime(dur);
      seekBar.value = (ct / dur) * 100;
    }
  }
  const newIdx = detectCurrentTrack(ct);
  if (newIdx !== state.currentTrackIndex) {
    state.currentTrackIndex = newIdx;
    updateNowPlaying(newIdx);
    highlightTrackInSidebar(state.currentDiscId, newIdx);
    if (!nfoPane.classList.contains('hidden')) { highlightNfo(); highlightTracklist(); }
  }
  updateTrackProgress();
  // Save play state every ~10 s
  if (!savePlayStateTimer) {
    savePlayStateTimer = setTimeout(() => {
      savePlayStateTimer = null;
      if (soundcloudMode && soundcloudActiveIdx >= 0) {
        STORAGE.setStreamSession({ mode: 'soundcloud', trackIdx: soundcloudActiveIdx, position: audio.currentTime });
        return;
      }
      const disc = currentDisc();
      if (disc && disc.mp3Path) {
        STORAGE.setPlayState({ mp3Path: disc.mp3Path, trackIdx: state.currentTrackIndex, position: audio.currentTime });
      }
    }, 10000);
  }
});

audio.addEventListener('loadedmetadata', () => {
  if (isFinite(audio.duration)) {
    timeTotal.textContent = formatTime(audio.duration);
    updateSeekTicks();
  }
});

audio.addEventListener('play',  () => { btnPlay.innerHTML = '&#9646;&#9646;'; });
audio.addEventListener('pause', () => {
  btnPlay.innerHTML = '&#9654;';
  if (soundcloudMode && soundcloudActiveIdx >= 0) {
    STORAGE.setStreamSession({ mode: 'soundcloud', trackIdx: soundcloudActiveIdx, position: audio.currentTime });
    return;
  }
  const disc = currentDisc();
  if (disc && disc.mp3Path) {
    STORAGE.setPlayState({ mp3Path: disc.mp3Path, trackIdx: state.currentTrackIndex, position: audio.currentTime });
  }
});
// Pause Spotify whenever local audio starts, so both can't play simultaneously
audio.addEventListener('play', () => {
  if (spotifyPlayer) {
    spotifyPlayer.getCurrentState().then((s) => {
      if (s && !s.paused) spotifyPlayer.pause().catch(() => {});
    }).catch(() => {});
  }
});

audio.addEventListener('ended', () => {
  btnPlay.innerHTML = '&#9654;';
  // SoundCloud auto-advance
  if (soundcloudMode && soundcloudActiveIdx >= 0) {
    playSoundcloudTrack(soundcloudActiveIdx + 1);
    return;
  }
  const disc = currentDisc();
  if (!disc) return;
  if (repeatMode === 'one') {
    const t = disc.tracks[state.currentTrackIndex];
    audio.currentTime = t ? t.startSeconds : 0;
    audio.play().catch(() => {});
  } else {
    const next = nextTrackIndex(disc, state.currentTrackIndex);
    if (next >= 0) {
      playDiscAtTrack(disc, next);
    } else {
      playAdjacentDisc('next'); // advance to next disc when CUE ends or for raw single files
    }
  }
});

window.addEventListener('beforeunload', () => {
  const disc = currentDisc();
  if (disc && disc.mp3Path) {
    STORAGE.setPlayState({ mp3Path: disc.mp3Path, trackIdx: state.currentTrackIndex, position: audio.currentTime });
  }
});

// ── Controls ──────────────────────────────────────────────────────────────────
btnPlay.addEventListener('click', () => {
  if (spotifyPlayer && spotifyCurrentUri) {
    spotifyPlayer.togglePlay().catch(() => {});
    return;
  }
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
});

function playAdjacentDisc(direction) {
  const discs = state.discs.filter((d) => d.mp3Path || d.blobUrl);
  const idx = discs.findIndex((d) => d.id === state.currentDiscId);
  if (idx < 0) return;
  const target = discs[direction === 'next' ? idx + 1 : idx - 1];
  if (!target) return;
  if (target.tracks.length > 0) {
    playDiscAtTrack(target, direction === 'next' ? 0 : target.tracks.length - 1);
  } else {
    loadDisc(target);
    audio.play().catch(() => {});
  }
}

btnPrev.addEventListener('click', () => {
  const disc = currentDisc();
  if (!disc) return;
  const idx = state.currentTrackIndex;
  if (disc.tracks.length > 0) {
    if (idx > 0 && audio.currentTime - disc.tracks[idx].startSeconds < 3) {
      playDiscAtTrack(disc, idx - 1);
    } else if (idx > 0) {
      const t = disc.tracks[idx].startSeconds; audio.currentTime = t; waveformRenderer.seekTo(t);
    } else {
      playAdjacentDisc('prev'); // already at first track — go to previous disc
    }
  } else {
    // Raw single-file disc — restart if > 3 s in, else go to prev disc
    if (audio.currentTime > 3) { audio.currentTime = 0; waveformRenderer.seekTo(0); }
    else playAdjacentDisc('prev');
  }
});

btnNext.addEventListener('click', () => {
  const disc = currentDisc();
  if (!disc) return;
  if (disc.tracks.length > 0) {
    const next = nextTrackIndex(disc, state.currentTrackIndex);
    if (next >= 0) playDiscAtTrack(disc, next);
    else playAdjacentDisc('next'); // end of CUE disc — go to next disc
  } else {
    playAdjacentDisc('next'); // single-file disc — go to next disc
  }
});

seekBar.addEventListener('mousedown', () => { state.seeking = true; });
document.addEventListener('mouseup', () => { state.seeking = false; });

function seekBarToAbsoluteTime() {
  if (!isFinite(audio.duration)) return null;
  if (isMini) {
    const { start, end } = getTrackBounds();
    return start + (seekBar.value / 100) * (end - start);
  }
  return (seekBar.value / 100) * audio.duration;
}

seekBar.addEventListener('input', () => {
  const t = seekBarToAbsoluteTime();
  if (t === null) return;
  if (isMini) {
    const { start, end } = getTrackBounds();
    timeCurrent.textContent = formatTime(Math.max(0, t - start));
  } else {
    timeCurrent.textContent = formatTime(t);
  }
  audio.currentTime = t;
  waveformRenderer.seekTo(t);
});

seekBar.addEventListener('change', () => {
  const t = seekBarToAbsoluteTime();
  if (t !== null) audio.currentTime = t;
  state.seeking = false;
});

volumeBar.addEventListener('input', () => { audio.volume = volumeBar.value; });

// ── Keyboard shortcuts ─────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select, [contenteditable]')) return;
  if (e.key === ' ') { e.preventDefault(); btnPlay.click(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); btnNext.click(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); btnPrev.click(); }
});

// ── Shuffle & repeat ──────────────────────────────────────────────────────────
let shuffleOn  = false;
let repeatMode = 'off'; // 'off' | 'all' | 'one'

function setShuffleOn(on) {
  shuffleOn = on;
  btnShuffle.classList.toggle('active', on);
  btnShuffle.title = on ? 'Shuffle on' : 'Shuffle';
}

function cycleRepeat() {
  repeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
  btnRepeat.classList.toggle('active', repeatMode !== 'off');
  btnRepeat.title = repeatMode === 'one' ? 'Repeat one' : repeatMode === 'all' ? 'Repeat all' : 'Repeat';
  btnRepeat.innerHTML = repeatMode === 'one' ? '&#x21BB;<sup style="font-size:8px">1</sup>' : '&#x21BB;';
}

function nextTrackIndex(disc, currentIdx) {
  if (shuffleOn && disc.tracks.length > 1) {
    let idx;
    do { idx = Math.floor(Math.random() * disc.tracks.length); } while (idx === currentIdx);
    return idx;
  }
  if (currentIdx < disc.tracks.length - 1) return currentIdx + 1;
  return repeatMode === 'all' ? 0 : -1;
}

btnShuffle.addEventListener('click', () => setShuffleOn(!shuffleOn));
btnRepeat.addEventListener('click', cycleRepeat);

// ── Time remaining toggle ──────────────────────────────────────────────────────
let showRemaining = false;
timeTotal.style.minWidth = '68px';
timeTotal.addEventListener('click', () => {
  showRemaining = !showRemaining;
  timeTotal.style.color = showRemaining ? 'var(--accent)' : '';
});

// ── Filter ────────────────────────────────────────────────────────────────────
filterInput.addEventListener('input', () => { applyFilter(filterInput.value); STORAGE.setFilter(filterInput.value); });
filterInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { filterInput.value = ''; applyFilter(''); }
});
filterClear.addEventListener('click', () => { filterInput.value = ''; applyFilter(''); filterInput.focus(); });

// ── Dir load ──────────────────────────────────────────────────────────────────
function loadRoot(dir) {
  STORAGE.setDir(dir);
  STORAGE.setScanDir(''); // clear saved scan dir so we don't auto-load old subfolder
  STORAGE.setFilter('');
  filterInput.value = '';
  musicIndex = null;
  loadFolderBrowser(dir, true); // bust cache — user explicitly requested a refresh
  // Don't call scanDirectory here: no need to disrupt playback or the disc list
}

dirLoadBtn.addEventListener('click', () => { const d = dirInput.value.trim(); if (d) loadRoot(d); });
dirInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const d = dirInput.value.trim(); if (d) loadRoot(d); } });

// ── Library folder dropdown on dir-input focus ────────────────────────────────
const dirLibDropdown = document.getElementById('dir-library-dropdown');

function showLibraryDropdown() {
  if (!libraryFolders.length) return;
  dirLibDropdown.innerHTML = '';
  for (const folder of libraryFolders) {
    const name = folder.split('/').filter(Boolean).pop() || folder;
    const item = document.createElement('div');
    item.className = 'dir-lib-item';
    item.innerHTML = `<strong>${escapeHtml(name)}</strong>${escapeHtml(folder)}`;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // prevent input blur before click
      dirLibDropdown.classList.add('hidden');
      dirInput.value = folder;
      loadRoot(folder);
    });
    dirLibDropdown.appendChild(item);
  }
  dirLibDropdown.classList.remove('hidden');
}

dirInput.addEventListener('focus', async () => {
  await loadLibrary();
  showLibraryDropdown();
});
dirInput.addEventListener('blur', () => {
  // Delay so mousedown on an item fires first
  setTimeout(() => dirLibDropdown.classList.add('hidden'), 150);
});

// ── Directory browser modal ───────────────────────────────────────────────────
const dirModal        = document.getElementById('dir-modal-overlay');
const dirModalEntries = document.getElementById('dir-modal-entries');
const dirFavList      = document.getElementById('dir-fav-list');
const dirModalFavsSection = document.getElementById('dir-modal-favourites');
const dirModalCwd     = document.getElementById('dir-modal-cwd');
const dirModalSelected = document.getElementById('dir-modal-selected');
const dirBrowseBtn    = document.getElementById('dir-browse-btn');

let dirModalPath = '';  // currently selected path

const DIR_FAVS_KEY = 'tlp_dir_favs';
function getDirFavs() { try { return JSON.parse(localStorage.getItem(DIR_FAVS_KEY) || '[]'); } catch(_) { return []; } }
function saveDirFavs(favs) { localStorage.setItem(DIR_FAVS_KEY, JSON.stringify(favs)); }

function renderDirFavs() {
  const favs = getDirFavs();
  dirModalFavsSection.classList.toggle('hidden', favs.length === 0);
  dirFavList.innerHTML = favs.map((f, i) => `
    <div class="dir-fav-item${f === dirModalPath ? ' selected' : ''}" data-path="${escapeHtml(f)}" data-idx="${i}">
      <span class="dir-entry-icon">&#9733;</span>
      <span>${escapeHtml(f.split('/').pop() || f)}</span>
      <button class="dir-fav-remove" data-idx="${i}" title="Remove">&#x2715;</button>
    </div>`).join('');
}

async function browseDir(dir) {
  dirModalCwd.textContent = dir;
  try {
    const res = await fetch(`/api/ls?dir=${encodeURIComponent(dir)}`);
    if (!res.ok) throw new Error('ls failed');
    const { parent, subdirs } = await res.json();
    let html = '';
    if (parent) html += `<div class="dir-entry dir-entry-up" data-path="${escapeHtml(parent)}"><span class="dir-entry-icon">&#x2191;</span> ..</div>`;
    const sorted = (subdirs || []).map(normEntry).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    html += sorted.map((d) => {
      const p = `${dir}/${d.name}`;
      return `<div class="dir-entry${p === dirModalPath ? ' selected' : ''}" data-path="${escapeHtml(p)}"><span class="dir-entry-icon">&#128193;</span>${escapeHtml(d.name)}</div>`;
    }).join('');
    dirModalEntries.innerHTML = html || '<div style="padding:8px 16px;font-size:12px;color:var(--text-muted)">No subfolders</div>';
  } catch (_) {
    dirModalEntries.innerHTML = '<div style="padding:8px 16px;font-size:12px;color:var(--text-muted)">Cannot read directory</div>';
  }
  renderDirFavs();
}

function selectDirPath(p) {
  dirModalPath = p;
  dirModalSelected.textContent = p;
  // Re-highlight entries
  dirModalEntries.querySelectorAll('.dir-entry').forEach((el) => el.classList.toggle('selected', el.dataset.path === p));
  dirFavList.querySelectorAll('.dir-fav-item').forEach((el) => el.classList.toggle('selected', el.dataset.path === p));
}

async function openDirModal(startDir) {
  const dir = startDir || dirInput.value.trim() || (getDirFavs()[0] || '/');
  dirModalPath = dir;
  dirModalSelected.textContent = dir;
  dirModal.classList.remove('hidden');
  await browseDir(dir);
}

dirModal.addEventListener('click', async (e) => {
  // Click on directory entry → navigate into it and select it
  const entry = e.target.closest('.dir-entry');
  if (entry) { selectDirPath(entry.dataset.path); await browseDir(entry.dataset.path); return; }
  // Click on favourite → select it (don't navigate)
  const fav = e.target.closest('.dir-fav-item');
  if (fav && !e.target.closest('.dir-fav-remove')) { selectDirPath(fav.dataset.path); await browseDir(fav.dataset.path); return; }
  // Remove favourite
  const rm = e.target.closest('.dir-fav-remove');
  if (rm) {
    const favs = getDirFavs();
    favs.splice(parseInt(rm.dataset.idx, 10), 1);
    saveDirFavs(favs);
    renderDirFavs();
    return;
  }
  // Click overlay backdrop → close
  if (e.target === dirModal) dirModal.classList.add('hidden');
});

document.getElementById('dir-modal-close').addEventListener('click', () => dirModal.classList.add('hidden'));

document.getElementById('dir-modal-add-fav').addEventListener('click', () => {
  if (!dirModalPath) return;
  const favs = getDirFavs();
  if (!favs.includes(dirModalPath)) { favs.push(dirModalPath); saveDirFavs(favs); }
  renderDirFavs();
});

document.getElementById('dir-modal-go').addEventListener('click', () => {
  if (!dirModalPath) return;
  dirModal.classList.add('hidden');
  dirInput.value = dirModalPath;
  loadRoot(dirModalPath);
});

dirBrowseBtn.addEventListener('click', async () => {
  // In Electron, use native folder picker; otherwise open the web modal
  if (window.electronAPI && window.electronAPI.pickDirectory) {
    const picked = await window.electronAPI.pickDirectory();
    if (picked) { dirInput.value = picked; loadRoot(picked); }
  } else {
    openDirModal();
  }
});

// Also open modal on double-click of the dir input (as convenience)
dirInput.addEventListener('dblclick', () => openDirModal());

// ── Theme ─────────────────────────────────────────────────────────────────────
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    STORAGE.setTheme(next);
    waveformRenderer._invalidateCache();
  });
}

// ── Waveform visibility ───────────────────────────────────────────────────────
let waveformVisible = true;

function setWaveformVisible(on) {
  waveformVisible = on;
  STORAGE.setWaveformOn(on);
  waveformToggle.classList.toggle('off', !on);
  if (!on) {
    liveSpectrum.stop();
    wfSection.classList.add('hidden');
    // Let main-top shrink to now-playing only so the info pane fills the gap
    mainTop.style.height = '';
    return;
  }
  // Restore saved height when turning back on
  const saved = STORAGE.getMainTopH();
  if (saved) mainTop.style.height = `${saved}px`;
  // If in streaming mode, restart live spectrum
  if (soundcloudMode && soundcloudActiveIdx >= 0) { showLiveSpectrum(); return; }
  if (spotifyMode && spotifyCurrentUri) { showLiveSpectrum(); return; }
  // Turning on: load or re-render for current disc
  const disc = currentDisc();
  if (!disc || !disc.mp3Path) return;
  if (currentWfPath === disc.mp3Path && waveformRenderer.peaks) {
    // Data already loaded — just show and re-render with correct canvas dims
    wfSection.classList.remove('hidden');
    waveformRenderer._invalidateCache();
    waveformRenderer._renderOverview();
    waveformRenderer._renderZoom();
  } else {
    // Not loaded or failed — force a fresh load
    currentWfPath = null;
    loadWaveform(disc);
  }
}

waveformToggle.addEventListener('click', () => setWaveformVisible(!waveformVisible));

// ── Sync test track ───────────────────────────────────────────────────────────
document.getElementById('sync-test-btn').addEventListener('click', async (e) => {
  e.currentTarget.blur(); // return focus to document so space bar works
  const url = '/api/sync-test';
  audio.src = url;
  audio.load();

  // Build fake disc with one track per second (0–119)
  const fakeTracks = Array.from({ length: 120 }, (_, i) => ({
    track: i + 1,
    title: `Second ${i + 1}`,
    startSeconds: i,
    performer: '',
  }));

  // Fetch waveform for the WAV via the waveform API (pass the URL as path)
  // The WAV is served from memory so use the server-side endpoint
  wfSection.classList.remove('hidden');
  wfStatus.classList.remove('hidden');
  waveformRenderer.clear();

  try {
    const res = await fetch(`/api/sync-test-waveform?bucketMs=${STORAGE.getSpectrumRes()}`);
    if (res.ok) {
      const data = await res.json();
      waveformRenderer.load(data, fakeTracks);
      wfStatus.classList.add('hidden');
    }
  } catch (_) {
    wfStatus.classList.add('hidden');
  }

  // Update now-playing header
  document.getElementById('np-disc').textContent = 'Sync Test Track';
  document.getElementById('np-title').textContent = 'Beep every second (1 kHz marker + pitch tone)';
  document.getElementById('np-performer').textContent = '';

  audio.addEventListener('canplay', function onCanPlay() {
    audio.removeEventListener('canplay', onCanPlay);
    audio.play().catch(() => {});
  });
});

// ── Settings modal ────────────────────────────────────────────────────────────
const settingsBtn     = document.getElementById('settings-btn');
const settingsOverlay = document.getElementById('settings-overlay');
const settingsClose   = document.getElementById('settings-close');
const settingsVolume  = document.getElementById('settings-volume');
const settingsVolVal  = document.getElementById('settings-volume-val');

function openSettings() {
  // Sync all seg-btn active states
  syncSettingsBtns('theme',       STORAGE.getTheme());
  syncSettingsBtns('spectrum',     waveformVisible ? 'on' : 'off');
  syncSettingsBtns('spectrumRes',  String(STORAGE.getSpectrumRes()));
  syncSettingsBtns('trackLabels',  STORAGE.getTrackLabels() ? 'on' : 'off');
  syncSettingsBtns('repeat',       repeatMode);
  syncSettingsBtns('shuffle',      shuffleOn ? 'on' : 'off');
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
  if (e.target === settingsOverlay) closeSettings();
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

settingsOverlay.addEventListener('click', (e) => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  const { setting, value } = btn.dataset;
  syncSettingsBtns(setting, value);
  if (setting === 'theme') {
    applyTheme(value);
    STORAGE.setTheme(value);
    waveformRenderer._invalidateCache();
    if (waveformVisible && currentWfPath) { waveformRenderer._renderOverview(); waveformRenderer._renderZoom(); }
  } else if (setting === 'spectrum') {
    setWaveformVisible(value === 'on');
  } else if (setting === 'spectrumRes') {
    const ms = parseInt(value, 10);
    STORAGE.setSpectrumRes(ms);
    // Invalidate waveform cache so it re-analyses at new resolution
    currentWfPath = null;
    const disc = currentDisc();
    if (disc) loadWaveform(disc);
  } else if (setting === 'repeat') {
    while (repeatMode !== value) cycleRepeat();
    STORAGE.setRepeat(repeatMode);
  } else if (setting === 'shuffle') {
    setShuffleOn(value === 'on');
    STORAGE.setShuffle(shuffleOn);
  } else if (setting === 'trackLabels') {
    setTrackLabelsVisible(value === 'on');
  }
});

// ── Reindex button ────────────────────────────────────────────────────────────
const reindexBtn    = document.getElementById('reindex-btn');
const reindexStatus = document.getElementById('reindex-status');

if (reindexBtn) {
  reindexBtn.addEventListener('click', async () => {
    reindexBtn.disabled = true;
    reindexStatus.textContent = 'Rebuilding…';
    musicIndex = null;
    // Bust server caches for library folders + currently loaded root
    try {
      const currentRoot = STORAGE.getDir();
      const rootsToBust = [...new Set([...libraryFolders, currentRoot].filter(Boolean))];
      await Promise.all([
        libraryFolders.length ? fetch('/api/library-index?bust=1') : null,
        ...rootsToBust.map((r) => fetch(`/api/index?root=${encodeURIComponent(r)}&bust=1`)),
      ].filter(Boolean));
      reindexStatus.textContent = 'Done — open search to use new index.';
    } catch (_) {
      reindexStatus.textContent = 'Failed — check console.';
    } finally {
      reindexBtn.disabled = false;
    }
  });
}

// ── Spotify settings handlers ─────────────────────────────────────────────────
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
      if (statusEl) { const el = statusEl; el.textContent = 'Save failed.'; }
    }
  });
}

if (spotifyConnectSettingsBtn) {
  spotifyConnectSettingsBtn.addEventListener('click', async () => {
    closeSettings();
    await connectSpotify();
  });
}

if (spotifyDisconnectBtn) {
  spotifyDisconnectBtn.addEventListener('click', async () => {
    await disconnectSpotify();
    const statusEl = document.getElementById('spotify-settings-status');
    if (statusEl) statusEl.textContent = 'Disconnected.';
    const disconnectRow = document.getElementById('spotify-disconnect-row');
    if (disconnectRow) disconnectRow.classList.add('hidden');
  });
}

// ── SoundCloud settings handlers ──────────────────────────────────────────────
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
    await connectSoundcloud();
  });
}

if (soundcloudDisconnectBtn) {
  soundcloudDisconnectBtn.addEventListener('click', async () => {
    await disconnectSoundcloud();
    const statusEl = document.getElementById('soundcloud-settings-status');
    if (statusEl) statusEl.textContent = 'Disconnected.';
    const disconnectRow = document.getElementById('soundcloud-disconnect-row');
    if (disconnectRow) disconnectRow.classList.add('hidden');
  });
}

// ── Mini player ───────────────────────────────────────────────────────────────
let isMini = false;

function updateMiniInfo() {
  const disc  = currentDisc();
  const track = disc && state.currentTrackIndex >= 0 ? disc.tracks[state.currentTrackIndex] : null;
  miniTrack.textContent = track ? (track.title || '—') : (disc ? (disc.albumTitle || '—') : '—');
  miniSub.textContent   = track ? (track.performer || disc.albumPerformer || '') : (disc ? (disc.albumPerformer || '') : '');
}

function setMiniPlayer(mini) {
  isMini = mini;
  document.body.classList.toggle('mini', mini);
  miniBtn.title     = mini ? 'Full player' : 'Mini player';
  miniBtn.innerHTML = mini ? '&#x229E;' : '&#x2296;'; // ⊞ restore / ⊖ mini
  if (mini) {
    updateMiniInfo();
  } else {
    // Restore full-file seek bar when leaving mini mode
    const ct = audio.currentTime;
    const dur = audio.duration;
    if (isFinite(dur)) {
      seekBar.value = (ct / dur) * 100;
      timeCurrent.textContent = formatTime(ct);
      timeTotal.textContent = showRemaining ? `-${formatTime(dur - ct)}` : formatTime(dur);
    }
  }
  if (window.electronAPI) window.electronAPI.setMiniPlayer(mini);
}

miniBtn.addEventListener('click', () => setMiniPlayer(!isMini));

// ── Sidebar collapse ──────────────────────────────────────────────────────────
function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  sidebar.classList.toggle('collapsed', collapsed);
  if (collapsed) {
    collapseBtn.innerHTML = '&#x25BA;';
    collapseBtn.title = 'Show sidebar';
    collapseBtn.style.left = '0';
    resizeHandle.style.display = 'none';
  } else {
    collapseBtn.innerHTML = '&#x25C4;';
    collapseBtn.title = 'Hide sidebar';
    const w = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'), 10);
    collapseBtn.style.left = `${w}px`;
    resizeHandle.style.display = '';
  }
}

collapseBtn.addEventListener('click', () => setSidebarCollapsed(!state.sidebarCollapsed));

// ── Sidebar width resize ──────────────────────────────────────────────────────
function initSidebarResize() {
  let startX = 0, startW = 0;

  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startX = e.clientX;
    startW = sidebar.offsetWidth;
    resizeHandle.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!resizeHandle.classList.contains('dragging')) return;
    const newW = Math.max(200, Math.min(600, startW + e.clientX - startX));
    document.documentElement.style.setProperty('--sidebar-width', `${newW}px`);
    sidebar.style.width = `${newW}px`;
    collapseBtn.style.left = `${newW}px`;
    STORAGE.setSidebarW(newW);
  });

  document.addEventListener('mouseup', () => {
    if (resizeHandle.classList.contains('dragging')) {
      resizeHandle.classList.remove('dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
  });
}

// ── Panel height resize (between folder browser and track list) ───────────────
function initPanelResize() {
  let startY = 0, startH = 0;

  panelResize.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startY = e.clientY;
    startH = soundcloudMode ? soundcloudBrowser.offsetHeight : spotifyMode ? spotifyBrowser.offsetHeight : folderBrowser.offsetHeight;
    panelResize.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!panelResize.classList.contains('dragging')) return;
    const sidebarH = sidebar.offsetHeight;
    const headerH = sidebar.querySelector('#sidebar-header').offsetHeight;
    const available = sidebarH - headerH - panelResize.offsetHeight;
    const newH = Math.max(60, Math.min(available - 60, startH + e.clientY - startY));
    const pct = Math.round((newH / available) * 100);
    document.documentElement.style.setProperty('--browser-height', `${newH}px`);
    folderBrowser.style.height = `${newH}px`;
    spotifyBrowser.style.height = `${newH}px`;
    soundcloudBrowser.style.height = `${newH}px`;
    STORAGE.setBrowserH(pct);
  });

  document.addEventListener('mouseup', () => {
    if (panelResize.classList.contains('dragging')) {
      panelResize.classList.remove('dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
  });
}

// ── Main pane resize (between top section and NFO) ────────────────────────────
function initMainResize() {
  const saved = STORAGE.getMainTopH();
  if (saved) mainTop.style.height = `${saved}px`;

  let startY = 0, startH = 0;

  mainResizeH.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startY = e.clientY;
    startH = mainTop.offsetHeight;
    mainResizeH.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!mainResizeH.classList.contains('dragging')) return;
    const main = document.getElementById('main');
    const newH = Math.max(80, Math.min(main.offsetHeight - 80, startH + e.clientY - startY));
    mainTop.style.height = `${newH}px`;
    STORAGE.setMainTopH(newH);
  });

  document.addEventListener('mouseup', () => {
    if (mainResizeH.classList.contains('dragging')) {
      mainResizeH.classList.remove('dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
  });
}

// ── Now-playing pane resize (between art and spectrum) ────────────────────────
function initNowPlayingResize() {
  const npPane  = document.getElementById('now-playing');
  const handle  = document.getElementById('np-resize-h');
  const saved   = parseInt(localStorage.getItem('tlp_np_h'), 10);
  if (saved) npPane.style.height = `${saved}px`;

  let startY = 0, startH = 0;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startY = e.clientY;
    startH = npPane.offsetHeight;
    handle.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!handle.classList.contains('dragging')) return;
    const newH = Math.max(60, Math.min(500, startH + e.clientY - startY));
    npPane.style.height = `${newH}px`;
    localStorage.setItem('tlp_np_h', newH);
  });

  document.addEventListener('mouseup', () => {
    if (!handle.classList.contains('dragging')) return;
    handle.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  });
}

// ── Waveform graph resize ─────────────────────────────────────────────────────
function initWaveformResize() {
  const ovWrap      = document.getElementById('wf-overview-wrap');
  const zmWrap      = document.getElementById('wf-zoom-wrap');
  const midHandle   = document.getElementById('wf-resize-mid');
  const botHandle   = document.getElementById('wf-resize-bot');

  // Restore persisted heights
  const savedOvH = parseInt(localStorage.getItem('tlp_wf_ov_h'), 10) || 50;
  const savedZmH = parseInt(localStorage.getItem('tlp_wf_zm_h'), 10) || 110;
  ovWrap.style.height = `${savedOvH}px`;
  zmWrap.style.height = `${savedZmH}px`;

  let dragging = null, startY = 0, startH = 0;

  function beginDrag(handle, wrap, e) {
    e.preventDefault();
    dragging = { handle, wrap };
    startY = e.clientY;
    startH = wrap.offsetHeight;
    handle.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  }

  midHandle.addEventListener('mousedown', (e) => beginDrag(midHandle, ovWrap, e));
  botHandle.addEventListener('mousedown', (e) => beginDrag(botHandle, zmWrap, e));

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const min = dragging.wrap === ovWrap ? 16 : 30;
    const max = dragging.wrap === ovWrap ? 200 : 400;
    const newH = Math.max(min, Math.min(max, startH + e.clientY - startY));
    dragging.wrap.style.height = `${newH}px`;
    const key = dragging.wrap === ovWrap ? 'tlp_wf_ov_h' : 'tlp_wf_zm_h';
    localStorage.setItem(key, newH);
    waveformRenderer._invalidateCache();
    if (dragging.wrap === ovWrap) waveformRenderer._renderOverview();
    else waveformRenderer._renderZoom();
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging.handle.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    dragging = null;
  });
}

// ── Online tracklist finder (MixesDB) ────────────────────────────────────────
const tlModalOverlay = document.getElementById('tl-modal-overlay');
const tlQueryInput   = document.getElementById('tl-query-input');
const tlSearchGo     = document.getElementById('tl-search-go');
const tlResults      = document.getElementById('tl-results');
const tlTracksPane   = document.getElementById('tl-tracks-pane');
const tlTracksList   = document.getElementById('tl-tracks-list');
const tlTracksTitle  = document.getElementById('tl-tracks-title');
const tlApplyBtn     = document.getElementById('tl-apply-btn');
const tlSourceLink   = document.getElementById('tl-source-link');
const tlBackBtn      = document.getElementById('tl-back-btn');

let tlTargetDisc        = null;
let tlStagedTracks      = null;
let lastNfoParsedTracks = null;
let detectStagedTracks  = null;

// Parse a numbered tracklist out of NFO text.
// Returns array of {track, title, performer, startSeconds:null} or null if not found.
function parseNfoTracklist(text) {
  if (!text) return null;
  const re = /^\s*(\d{1,3})[.)]\s+(.+)/gm;
  const entries = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    entries.push({ num: parseInt(m[1], 10), line: m[2].trim() });
  }
  if (entries.length < 3) return null;
  // Must start near track 1 (allow numbering from 0 or 1)
  if (entries[0].num > 2) return null;
  return entries.map((e, i) => {
    // Split on em-dash, en-dash, or space-hyphen-space to get performer / title
    const sepMatch = e.line.match(/^(.+?)\s+(?:–|—|-)\s+(.+)$/);
    return {
      track:        i + 1,
      performer:    sepMatch ? sepMatch[1].trim() : '',
      title:        sepMatch ? sepMatch[2].trim() : e.line,
      startSeconds: null,
    };
  });
}

// Fetch transition points from server and render the detect tab.
async function runDetectTransitions() {
  const disc = currentDisc();
  if (!disc || !disc.mp3Path || !lastNfoParsedTracks) return;

  detectStatus.textContent = 'Analyzing waveform\u2026';
  detectTracksList.innerHTML = '';
  detectApplyBtn.disabled = true;
  detectStagedTracks = null;

  try {
    const count    = lastNfoParsedTracks.length;
    const bucketMs = STORAGE.getSpectrumRes();
    const url = `/api/detect-transitions?path=${encodeURIComponent(disc.mp3Path)}&count=${count}&bucketMs=${bucketMs}`;
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || res.statusText);
    }
    const data = await res.json();

    // Merge detected transition seconds with NFO track names
    detectStagedTracks = data.transitions.map((tr, i) => {
      const nfoTrack = lastNfoParsedTracks[i] || { track: i + 1, title: '(unknown)', performer: '' };
      return {
        track:        nfoTrack.track,
        title:        nfoTrack.title,
        performer:    nfoTrack.performer,
        startSeconds: tr.seconds,
        _confidence:  tr.confidence,
      };
    });

    detectStatus.textContent = `Found ${detectStagedTracks.length} track${detectStagedTracks.length !== 1 ? 's' : ''}`;
    detectTracksList.innerHTML = detectStagedTracks.map((t) => {
      const mm        = Math.floor(t.startSeconds / 60);
      const ss        = String(t.startSeconds % 60).padStart(2, '0');
      const timeLabel = `${mm}:${ss}`;
      const confClass = t._confidence >= 0.6 ? 'detect-conf-high'
        : t._confidence >= 0.3 ? 'detect-conf-mid' : 'detect-conf-low';
      const label     = t.performer ? `${t.performer} - ${t.title}` : t.title;
      return `<div class="detect-track-item">
        <span class="detect-track-time">${timeLabel}</span>
        <span class="detect-conf-dot ${confClass}"></span>
        <span class="detect-track-name">${escapeHtml(label)}</span>
      </div>`;
    }).join('');
    detectApplyBtn.disabled = false;
  } catch (e) {
    detectStatus.textContent = `Error: ${escapeHtml(e.message)}`;
  }
}

// Derive a clean search query from folder name (strips release-group tags, dates)
function extractTlQuery(disc) {
  const folder = disc.mp3Path
    ? disc.mp3Path.replace(/\/[^/]+$/, '').split('/').pop()
    : disc.albumTitle || '';
  let q = folder.replace(/[_]/g, ' ').replace(/-/g, ' ');
  // Remove all-caps tokens (SAT, MOD, QMI, REPACK, etc.) but keep mixed-case words
  q = q.replace(/\b[A-Z]{2,10}\b/g, '');
  // Remove standalone day/month numbers (not 4-digit years)
  q = q.replace(/\b(?!\d{4}\b)\d{1,2}\b/g, '');
  return q.replace(/\s+/g, ' ').trim();
}

function openTlFinder(disc) {
  tlTargetDisc   = disc;
  tlStagedTracks = null;
  tlModalOverlay.classList.add('active');
  tlQueryInput.value = extractTlQuery(disc);
  tlResults.innerHTML = '';
  tlResults.classList.remove('hidden');
  tlTracksPane.classList.add('hidden');
  tlQueryInput.focus();
  tlQueryInput.select();
  if (tlQueryInput.value.length > 3) runTlSearch(tlQueryInput.value);
}

function closeTlFinder() {
  tlModalOverlay.classList.remove('active');
  tlTargetDisc   = null;
  tlStagedTracks = null;
}

async function runTlSearch(query) {
  tlResults.innerHTML = '<div class="tl-msg">Searching MixesDB…</div>';
  tlResults.classList.remove('hidden');
  tlTracksPane.classList.add('hidden');
  try {
    const res = await fetch(`/api/tracklist-search?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || res.statusText);
    }
    const { results } = await res.json();
    if (!results.length) {
      tlResults.innerHTML = '<div class="tl-msg">No results — try different search terms.</div>';
      return;
    }
    tlResults.innerHTML = results.map((r) =>
      `<div class="tl-result-item" data-url="${escapeHtml(r.url)}">
        <span class="tl-result-title">${escapeHtml(r.title)}</span>
        <span class="tl-result-arrow">&#x203A;</span>
      </div>`
    ).join('');
    tlResults.querySelectorAll('.tl-result-item').forEach((el) => {
      el.addEventListener('click', () =>
        showTlTracks(el.dataset.url, el.querySelector('.tl-result-title').textContent)
      );
    });
  } catch (e) {
    tlResults.innerHTML = `<div class="tl-msg">Search failed: ${escapeHtml(e.message)}</div>`;
  }
}

async function showTlTracks(url, title) {
  tlTracksPane.classList.remove('hidden');
  tlResults.classList.add('hidden');
  tlTracksTitle.textContent = title;
  tlTracksList.innerHTML = '<div class="tl-msg">Loading…</div>';
  tlSourceLink.href = url;
  tlStagedTracks = null;
  tlApplyBtn.disabled = true;
  try {
    const res = await fetch(`/api/tracklist-fetch?url=${encodeURIComponent(url)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || res.statusText);
    }
    const data = await res.json();
    if (!data.tracks.length) {
      tlTracksList.innerHTML = '<div class="tl-msg">No timed tracks found on this page.</div>';
      return;
    }
    tlStagedTracks = data.tracks;
    tlApplyBtn.disabled = false;
    const noTimes = !data.hasTimes;
    if (noTimes) {
      tlTracksList.innerHTML = '<div class="tl-msg" style="padding:6px 16px;font-size:11px;text-align:left;">No timecodes — track order only, no seek points.</div>';
    }
    tlTracksList.innerHTML += data.tracks.map((t, i) => {
      let timeLabel = '';
      if (t.startSeconds !== null) {
        const mm = Math.floor(t.startSeconds / 60);
        const ss = String(t.startSeconds % 60).padStart(2, '0');
        timeLabel = `${mm}:${ss}`;
      } else {
        timeLabel = String(i + 1).padStart(2, '0');
      }
      const label = t.performer ? `${t.performer} - ${t.title}` : t.title;
      return `<div class="tl-track-item">
        <span class="tl-track-time">${timeLabel}</span>
        <span class="tl-track-name">${escapeHtml(label)}</span>
      </div>`;
    }).join('');
  } catch (e) {
    tlTracksList.innerHTML = `<div class="tl-msg">Failed: ${escapeHtml(e.message)}</div>`;
  }
}

function applyScrapedTracklist() {
  if (!tlTargetDisc || !tlStagedTracks || !tlStagedTracks.length) return;
  const disc = tlTargetDisc;
  const hasTimes = tlStagedTracks.some((t) => t.startSeconds !== null);
  disc.tracks = tlStagedTracks.map((t, i) => ({
    ...t,
    track: i + 1,
    startSeconds: hasTimes ? (t.startSeconds ?? 0) : 0,
  }));
  try { localStorage.setItem(`tlp_tl_${disc.mp3Path}`, JSON.stringify(disc.tracks)); } catch (_) {}
  renderDiscList();
  loadDisc(disc);
  closeTlFinder();
}

// Called before rendering a disc: injects a previously saved scraped tracklist if disc has none
function loadScrapedTracklist(disc) {
  if (!disc.mp3Path || disc.tracks.length) return;
  try {
    const stored = localStorage.getItem(`tlp_tl_${disc.mp3Path}`);
    if (stored) disc.tracks = JSON.parse(stored);
  } catch (_) {}
}

tlBtn.addEventListener('click', () => { const d = currentDisc(); if (d) openTlFinder(d); });
tlModalOverlay.addEventListener('click', (e) => { if (e.target === tlModalOverlay) closeTlFinder(); });
document.getElementById('tl-modal-close').addEventListener('click', closeTlFinder);
tlSearchGo.addEventListener('click', () => runTlSearch(tlQueryInput.value));
tlQueryInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runTlSearch(tlQueryInput.value); });
tlBackBtn.addEventListener('click', () => {
  tlTracksPane.classList.add('hidden');
  tlResults.classList.remove('hidden');
});
tlApplyBtn.addEventListener('click', applyScrapedTracklist);

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  loadFavorites();
  applyTheme(STORAGE.getTheme());
  setWaveformVisible(STORAGE.getWaveformOn());
  setTrackLabelsVisible(STORAGE.getTrackLabels());
  setShuffleOn(STORAGE.getShuffle());
  const savedRepeat = STORAGE.getRepeat();
  while (repeatMode !== savedRepeat) cycleRepeat();
  const savedVol = STORAGE.getVolume();
  audio.volume = savedVol;
  volumeBar.value = savedVol;

  // Restore sidebar width
  const w = Math.max(200, Math.min(600, parseInt(STORAGE.getSidebarW(), 10)));
  document.documentElement.style.setProperty('--sidebar-width', `${w}px`);
  sidebar.style.width = `${w}px`;

  // Restore panel split height
  const browserPct = parseInt(STORAGE.getBrowserH(), 10);
  if (browserPct) {
    document.documentElement.style.setProperty('--browser-height', `${browserPct}%`);
    folderBrowser.style.height = `${browserPct}%`;
  }

  setSidebarCollapsed(false);
  initSidebarResize();
  initPanelResize();
  initMainResize();
  initNowPlayingResize();
  initWaveformResize();

  // 60 fps waveform loop — reads audio.currentTime directly for smooth scrolling
  (function waveformLoop() {
    requestAnimationFrame(waveformLoop);
    waveformRenderer.tick(audio.currentTime);
  }());

  // Init Spotify + SoundCloud integrations, then check for session restore
  const [,] = await Promise.all([
    initSpotify().catch(() => {}),
    initSoundcloud().catch(() => {}),
  ]);

  const streamSession = STORAGE.getStreamSession();
  if (streamSession) {
    if (streamSession.mode === 'soundcloud' && soundcloudConnected) {
      pendingScRestore = { trackIdx: streamSession.trackIdx, position: streamSession.position };
      openSoundcloudMode(); // loads tracks; restore fires inside loadSoundcloudTracks
    } else if (streamSession.mode === 'spotify' && spotifyConnected) {
      pendingSpotifyRestore = { uri: streamSession.uri, position: streamSession.position };
      openSpotifyMode(); // SDK ready listener will trigger playback
    } else {
      STORAGE.clearStreamSession(); // service no longer connected — discard
    }
  }

  // Restore last dir + scan position + filter — fetch config and library in parallel
  try {
    const [configRes] = await Promise.all([
      fetch('/api/config'),
      loadLibrary(),          // already called above but no-ops if cached
    ]);
    const config = await configRes.json();
    const dir = config.dir || STORAGE.getDir();
    if (dir) {
      STORAGE.setDir(dir);
      dirInput.value = dir;
      musicIndex = null;

      const savedFilter = STORAGE.getFilter();
      if (savedFilter) filterInput.value = savedFilter;

      const scanDir = STORAGE.getScanDir() || dir;

      // Load folder browser and scan the disc directory in parallel
      await Promise.all([
        loadFolderBrowser(dir).then(() => {
          if (savedFilter) applyFilter(savedFilter);
          if (scanDir !== dir) {
            const activeItem = folderBrowser.querySelector(`.folder-item[data-name="${CSS.escape(scanDir.split('/').pop())}"]`);
            if (activeItem) activeItem.classList.add('active');
          }
        }),
        scanDirectory(scanDir),
      ]);
    }
  } catch (_) {
    const dir = STORAGE.getDir();
    if (dir) { dirInput.value = dir; loadRoot(dir); }
  }
}

// ── Drag-and-drop MP3 playback ────────────────────────────────────────────────
const dropOverlay = document.getElementById('drop-overlay');
let dragEnterCount = 0;

document.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
  dragEnterCount++;
  dropOverlay.classList.add('active');
});

document.addEventListener('dragleave', () => {
  dragEnterCount = Math.max(0, dragEnterCount - 1);
  if (dragEnterCount === 0) dropOverlay.classList.remove('active');
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragEnterCount = 0;
  dropOverlay.classList.remove('active');

  const mp3s = [...(e.dataTransfer?.files || [])].filter((f) =>
    f.name.toLowerCase().endsWith('.mp3')
  );
  if (mp3s.length) loadDroppedFiles(mp3s);
});

function loadDroppedFiles(files) {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
  const DROP_ID_BASE = 90000;

  // Revoke any previous blob URLs to free memory
  state.discs.forEach((d) => { if (d.blobUrl) URL.revokeObjectURL(d.blobUrl); });

  const newDiscs = sorted.map((file, i) => {
    // Electron provides file.path; browsers don't
    const absPath = file.path || null;
    return {
      id: DROP_ID_BASE + i,
      mp3Path: absPath,
      mp3File: file.name,
      blobUrl: absPath ? null : URL.createObjectURL(file),
      cueFile: null,
      albumTitle: file.name.replace(/\.mp3$/i, ''),
      albumPerformer: '',
      tracks: [],
    };
  });

  state.discs = newDiscs;
  renderDiscList();

  const first = newDiscs[0];
  if (!first) return;
  loadDisc(first);
  audio.addEventListener('canplay', function p() {
    audio.removeEventListener('canplay', p);
    audio.play().catch(() => {});
  });
}

init();
