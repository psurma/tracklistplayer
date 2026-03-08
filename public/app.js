'use strict';

// Tag body when running inside Electron (for traffic-light padding CSS)
if (navigator.userAgent.includes('Electron')) {
  document.body.classList.add('electron');
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
const spotifyBtn       = document.getElementById('spotify-btn');
const spotifySearchBtn = document.getElementById('spotify-search-btn');
const soundcloudBtn    = document.getElementById('soundcloud-btn');
const finderBtn       = document.getElementById('finder-btn');
const nfoBtn        = document.getElementById('nfo-btn');
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
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(secs) {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
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

function renderFolderItems(dir, subdirs) {
  // Preserve up-row if present
  const upRow = folderBrowser.querySelector('.folder-up');
  const activeNames = new Set(
    [...folderBrowser.querySelectorAll('.folder-item.active')].map((el) => el.dataset.name)
  );
  // Remove all folder items
  folderBrowser.querySelectorAll('.folder-item').forEach((el) => el.remove());

  for (const entry of sortedSubdirs(subdirs)) {
    const item = document.createElement('div');
    item.className = 'folder-item';
    item.dataset.name = entry.name;
    if (activeNames.has(entry.name)) item.classList.add('active');
    item.innerHTML = `<span class="folder-label">${escapeHtml(entry.name)}</span>`;
    const fullPath = `${dir}/${entry.name}`;
    item.addEventListener('click', () => {
      folderBrowser.querySelectorAll('.folder-item.active').forEach((el) => el.classList.remove('active'));
      item.classList.add('active');
      STORAGE.setScanDir(fullPath);
      scanDirectory(fullPath);
    });
    item.addEventListener('dblclick', () => { scanDirectory(fullPath, true); });
    folderBrowser.appendChild(item);
  }

  applyFilter(filterInput.value);
}

async function loadFolderBrowser(dir) {
  state.browseDir = dir;
  folderBrowser.innerHTML = '<div class="status-msg">Loading...</div>';

  try {
    const res = await fetch(`/api/ls?dir=${encodeURIComponent(dir)}`);
    if (!res.ok) throw new Error('Failed to list directory');
    const data = await res.json();
    lastBrowseDir = dir;
    lastSubdirs = data.subdirs || [];

    folderBrowser.innerHTML = '';

    if (data.parent) {
      const up = document.createElement('div');
      up.className = 'folder-up';
      up.textContent = '↑  ..';
      up.addEventListener('click', () => loadFolderBrowser(data.parent));
      folderBrowser.appendChild(up);
    }

    if (!lastSubdirs.length && !data.parent) {
      folderBrowser.innerHTML = '<div class="status-msg">No subfolders.</div>';
      return;
    }

    renderFolderItems(dir, lastSubdirs);
  } catch (err) {
    folderBrowser.innerHTML = `<div class="status-msg" style="color:#c06060">${escapeHtml(err.message)}</div>`;
  }
}

// ── NFO / Tracklist pane ──────────────────────────────────────────────────────
const nfoPane         = document.getElementById('nfo-pane');
const mainResizeH     = document.getElementById('main-resize-h');
const mainTop         = document.getElementById('main-top');
const artworkPane     = document.getElementById('artwork-pane');
const artworkImg      = document.getElementById('artwork-img');
const nfoTabNfo       = document.getElementById('nfo-tab-nfo');
const nfoTabTracklist = document.getElementById('nfo-tab-tracklist');
const tracklistContent = document.getElementById('tracklist-content');

let activeInfoTab = 'nfo'; // 'nfo' | 'tracklist'

function switchInfoTab(tab) {
  activeInfoTab = tab;
  document.querySelectorAll('.nfo-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  nfoTabNfo.classList.toggle('hidden', tab !== 'nfo');
  nfoTabTracklist.classList.toggle('hidden', tab !== 'tracklist');
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
const nfoContent   = document.getElementById('nfo-content');
const nfoPaneClose = document.getElementById('nfo-pane-close');

let lastNfoDir = '';
let lastNfoText = '';

function highlightNfo() {
  if (!lastNfoText) return;
  const disc = currentDisc();
  const title = disc && state.currentTrackIndex >= 0
    ? (disc.tracks[state.currentTrackIndex] || {}).title
    : null;

  if (!title) {
    nfoContent.textContent = lastNfoText;
    return;
  }

  const escaped = escapeHtml(lastNfoText);
  const escapedTitle = escapeHtml(title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const highlighted = escaped.replace(
    new RegExp(escapedTitle, 'gi'),
    (m) => `<mark class="nfo-hl">${m}</mark>`
  );
  nfoContent.innerHTML = highlighted;

  const first = nfoContent.querySelector('.nfo-hl');
  if (first) first.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

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
    highlightNfo();
    const disc = currentDisc();
    if (disc) renderTracklist(disc);
    setNfoPaneVisible(true);
    switchInfoTab('nfo');
    nfoBtn.classList.add('hidden'); // hide toggle while pane is open
  } catch (_) {
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

finderBtn.addEventListener('click', () => {
  const p = finderBtn.dataset.path;
  if (p) fetch(`/api/reveal?path=${encodeURIComponent(p)}`).catch(() => {});
});

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
    soundcloudBtn.classList.add('hidden');
    finderBtn.classList.toggle('hidden', !disc.mp3Path);
    if (disc.mp3Path) finderBtn.dataset.path = disc.mp3Path;
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
    soundcloudBtn.href = `https://soundcloud.com/search?q=${encodeURIComponent(query)}`;
    soundcloudBtn.classList.remove('hidden');
  } else {
    spotifySearchBtn.classList.add('hidden');
    soundcloudBtn.classList.add('hidden');
  }

  if (disc.mp3Path) {
    finderBtn.dataset.path = disc.mp3Path;
    finderBtn.classList.remove('hidden');
  } else {
    finderBtn.classList.add('hidden');
  }

  if (isMini) updateMiniInfo();
}

function highlightTrackInSidebar(discId, trackIdx) {
  discList.querySelectorAll('.track-item').forEach((el) => el.classList.remove('active'));
  if (trackIdx >= 0) {
    const el = discList.querySelector(`.track-item[data-disc="${discId}"][data-track="${trackIdx}"]`);
    if (el) { el.classList.add('active'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }
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
function loadDisc(disc) {
  if (!disc.mp3Path) return;
  state.currentDiscId = disc.id;
  state.currentTrackIndex = -1;
  audio.src = fileUrl(disc.mp3Path);
  audio.load();
  updateNowPlaying(-1);
  highlightTrackInSidebar(disc.id, -1);
  loadWaveform(disc);
  loadArtwork(disc);
}

function playDiscAtTrack(disc, trackIdx) {
  if (!disc.mp3Path) return;

  const alreadyLoaded = state.currentDiscId === disc.id && audio.src;
  if (!alreadyLoaded || !audio.src.includes(encodeURIComponent(disc.mp3Path))) {
    state.currentDiscId = disc.id;
    audio.src = fileUrl(disc.mp3Path);
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
      item.innerHTML = `<span class="track-title" style="color:var(--text-dim)">${escapeHtml(disc.mp3File)}</span>`;
      item.addEventListener('click', () => { loadDisc(disc); audio.play().catch(() => {}); });
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
const searchPanel  = document.getElementById('search-panel');
const searchInput  = document.getElementById('search-input');
const searchCount  = document.getElementById('search-count');
const searchResults = document.getElementById('search-results');
const searchBtn    = document.getElementById('search-btn');
const searchClose  = document.getElementById('search-close');

let musicIndex = null;      // null = not yet loaded
let indexLoading = false;

function openSearchPanel() {
  searchPanel.classList.remove('hidden');
  searchBtn.classList.add('active');
  searchInput.focus();
  if (!musicIndex && !indexLoading) fetchMusicIndex();
}

function closeSearchPanel() {
  searchPanel.classList.add('hidden');
  searchBtn.classList.remove('active');
}

async function fetchMusicIndex() {
  const root = STORAGE.getDir();
  if (!root) { searchResults.innerHTML = '<div class="search-empty">Load a directory first.</div>'; return; }
  indexLoading = true;
  searchResults.innerHTML = '<div class="search-empty">Building index…</div>';
  try {
    const res = await fetch(`/api/index?root=${encodeURIComponent(root)}`);
    if (!res.ok) throw new Error(res.statusText);
    musicIndex = await res.json();
    runSearch(searchInput.value);
  } catch (e) {
    searchResults.innerHTML = `<div class="search-empty">Index failed: ${escapeHtml(e.message)}</div>`;
  } finally {
    indexLoading = false;
  }
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

  const totalTracks = groups.reduce((s, g) => s + g.tracksToShow.length, 0);
  searchCount.textContent = `${totalTracks} result${totalTracks !== 1 ? 's' : ''}`;

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
        row.innerHTML = `<span class="search-result-num">${String(track.track).padStart(2, '0')}</span>`
          + `<span class="search-result-title">${highlight(track.title || '—', words)}</span>`
          + (track.performer ? `<span class="search-result-artist">${highlight(track.performer, words)}</span>` : '');
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
  if (searchPanel.classList.contains('hidden')) openSearchPanel();
  else closeSearchPanel();
});
searchClose.addEventListener('click', closeSearchPanel);
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
let likedSongsOffset = 0;
let likedSongsTotal = 0;
let likedSongsLoading = false;

const spotifyPanel      = document.getElementById('panel-spotify');
const spotifyConnectPrompt = document.getElementById('spotify-connect-prompt');
const spotifyLikedList  = document.getElementById('spotify-liked-list');
const spotifyCount      = document.getElementById('spotify-count');
const spotifyClose      = document.getElementById('spotify-close');
const spotifyConnectBtnPanel = document.getElementById('spotify-connect-btn-panel');

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
  });
  spotifyPlayer.addListener('player_state_changed', (playerState) => {
    if (!playerState) return;
    // Update now-playing if a Spotify track is active
    const item = playerState.track_window && playerState.track_window.current_track;
    if (item) {
      const isPaused = playerState.paused;
      // Mark which spotify track item is active
      spotifyLikedList.querySelectorAll('.spotify-track-item').forEach((el) => {
        el.classList.toggle('spotify-track-active', el.dataset.uri === item.uri);
      });
      if (!isPaused) {
        btnPlay.innerHTML = '&#9646;&#9646;';
      } else {
        btnPlay.innerHTML = '&#9654;';
      }
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
  if (spotifyConnected) {
    spotifyConnectPrompt.classList.add('hidden');
    spotifyLikedList.classList.remove('hidden');
  } else {
    spotifyConnectPrompt.classList.remove('hidden');
    spotifyLikedList.classList.add('hidden');
  }
  // Update settings disconnect row
  const disconnectRow = document.getElementById('spotify-disconnect-row');
  if (disconnectRow) disconnectRow.classList.toggle('hidden', !spotifyConnected);
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
        if (typeof Spotify !== 'undefined') {
          initSpotifySDK(token);
        } else {
          window.onSpotifyWebPlaybackSDKReady = () => initSpotifySDK(token);
        }
      } catch (_) {}
    } else {
      // Set up SDK callback for when auth completes later
      if (typeof Spotify === 'undefined') {
        window.onSpotifyWebPlaybackSDKReady = () => {};
      }
    }
  } catch (_) {}
}

function openSpotifyPanel() {
  spotifyPanel.classList.remove('hidden');
  spotifyBtn.classList.add('active');
  if (spotifyConnected && likedSongsOffset === 0) loadLikedSongs(0);
}

function closeSpotifyPanel() {
  spotifyPanel.classList.add('hidden');
  spotifyBtn.classList.remove('active');
}

async function connectSpotify() {
  const urlRes = await fetch('/api/spotify/auth-url');
  if (!urlRes.ok) {
    alert('Please configure your Spotify Client ID and Secret in Settings first.');
    return;
  }
  const { url } = await urlRes.json();
  window.open(url, '_blank', 'width=500,height=700,noopener');

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
          if (typeof Spotify !== 'undefined') initSpotifySDK(token);
          else window.onSpotifyWebPlaybackSDKReady = () => initSpotifySDK(token);
        } catch (_) {}
        if (!spotifyPanel.classList.contains('hidden')) loadLikedSongs(0);
      }
    } catch (_) {}
  }, 2000);
}

async function loadLikedSongs(offset) {
  if (likedSongsLoading) return;
  likedSongsLoading = true;
  if (offset === 0) {
    spotifyLikedList.innerHTML = '<div class="spotify-loading">Loading liked songs...</div>';
    likedSongsOffset = 0;
    likedSongsTotal = 0;
  }
  try {
    const res = await fetch(`/api/spotify/liked?offset=${offset}&limit=50`);
    if (!res.ok) throw new Error('Failed to load liked songs');
    const data = await res.json();
    likedSongsTotal = data.total || 0;
    likedSongsOffset = offset + (data.items || []).length;

    if (offset === 0) spotifyLikedList.innerHTML = '';
    spotifyCount.textContent = likedSongsTotal ? `${likedSongsTotal} tracks` : '';

    const frag = document.createDocumentFragment();
    for (const { track } of (data.items || [])) {
      if (!track) continue;
      const item = document.createElement('div');
      item.className = 'spotify-track-item';
      item.dataset.uri = track.uri;
      const duration = formatTime(Math.floor((track.duration_ms || 0) / 1000));
      const artists = (track.artists || []).map((a) => a.name).join(', ');
      item.innerHTML = `
        <span class="spotify-play-icon">&#9654;</span>
        <span class="spotify-track-info">
          <div class="spotify-track-title">${escapeHtml(track.name || '')}</div>
          <div class="spotify-track-artist">${escapeHtml(artists)}</div>
        </span>
        <span class="spotify-track-album">${escapeHtml((track.album && track.album.name) || '')}</span>
        <span class="spotify-track-duration">${duration}</span>
      `;
      item.addEventListener('click', () => playSpotifyTrack(track.uri));
      frag.appendChild(item);
    }
    spotifyLikedList.appendChild(frag);

    if (likedSongsOffset < likedSongsTotal) {
      const loadMore = document.createElement('div');
      loadMore.className = 'spotify-load-more';
      loadMore.textContent = `Load more (${likedSongsOffset} of ${likedSongsTotal})`;
      loadMore.addEventListener('click', () => { loadMore.remove(); loadLikedSongs(likedSongsOffset); });
      spotifyLikedList.appendChild(loadMore);
    }
  } catch (err) {
    if (offset === 0) {
      spotifyLikedList.innerHTML = `<div class="spotify-loading" style="color:#c06060">Error: ${escapeHtml(err.message)}</div>`;
    }
  } finally {
    likedSongsLoading = false;
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
  likedSongsOffset = 0;
  likedSongsTotal = 0;
  if (spotifyPlayer) { spotifyPlayer.disconnect(); spotifyPlayer = null; }
  spotifyDeviceId = null;
  spotifyLikedList.innerHTML = '';
  spotifyCount.textContent = '';
  updateSpotifyUI();
}

spotifyBtn.addEventListener('click', () => {
  if (spotifyPanel.classList.contains('hidden')) openSpotifyPanel();
  else closeSpotifyPanel();
});

spotifyClose.addEventListener('click', closeSpotifyPanel);
spotifyConnectBtnPanel.addEventListener('click', connectSpotify);

// ── API ───────────────────────────────────────────────────────────────────────
async function scanDirectory(dir, autoplay = false) {
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
  timeCurrent.textContent = formatTime(ct);
  if (isFinite(dur)) {
    timeTotal.textContent = showRemaining ? `-${formatTime(dur - ct)}` : formatTime(dur);
    seekBar.value = (ct / dur) * 100;
  }
  const newIdx = detectCurrentTrack(ct);
  if (newIdx !== state.currentTrackIndex) {
    state.currentTrackIndex = newIdx;
    updateNowPlaying(newIdx);
    highlightTrackInSidebar(state.currentDiscId, newIdx);
    if (!nfoPane.classList.contains('hidden')) { highlightNfo(); highlightTracklist(); }
  }
  // Save play state every ~10 s
  if (!savePlayStateTimer) {
    savePlayStateTimer = setTimeout(() => {
      savePlayStateTimer = null;
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
  const disc = currentDisc();
  if (disc && disc.mp3Path) {
    STORAGE.setPlayState({ mp3Path: disc.mp3Path, trackIdx: state.currentTrackIndex, position: audio.currentTime });
  }
});
audio.addEventListener('ended', () => {
  btnPlay.innerHTML = '&#9654;';
  const disc = currentDisc();
  if (!disc) return;
  if (repeatMode === 'one') {
    const t = disc.tracks[state.currentTrackIndex];
    audio.currentTime = t ? t.startSeconds : 0;
    audio.play().catch(() => {});
  } else {
    const next = nextTrackIndex(disc, state.currentTrackIndex);
    if (next >= 0) playDiscAtTrack(disc, next);
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
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
});

btnPrev.addEventListener('click', () => {
  const disc = currentDisc();
  if (!disc) return;
  const idx = state.currentTrackIndex;
  if (idx > 0 && audio.currentTime - disc.tracks[idx].startSeconds < 3) playDiscAtTrack(disc, idx - 1);
  else if (idx >= 0) { const t = disc.tracks[idx].startSeconds; audio.currentTime = t; waveformRenderer.seekTo(t); }
});

btnNext.addEventListener('click', () => {
  const disc = currentDisc();
  if (!disc) return;
  const next = nextTrackIndex(disc, state.currentTrackIndex);
  if (next >= 0) playDiscAtTrack(disc, next);
});

seekBar.addEventListener('mousedown', () => { state.seeking = true; });
document.addEventListener('mouseup', () => { state.seeking = false; });

seekBar.addEventListener('input', () => {
  if (isFinite(audio.duration)) {
    const t = (seekBar.value / 100) * audio.duration;
    timeCurrent.textContent = formatTime(t);
    audio.currentTime = t;
    waveformRenderer.seekTo(t);
  }
});

seekBar.addEventListener('change', () => {
  if (isFinite(audio.duration)) audio.currentTime = (seekBar.value / 100) * audio.duration;
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
timeTotal.style.minWidth = '42px';
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
  STORAGE.setScanDir(dir); // reset to root when explicitly loading a new dir
  STORAGE.setFilter('');
  filterInput.value = '';
  musicIndex = null;
  loadFolderBrowser(dir);
  scanDirectory(dir);
}

dirLoadBtn.addEventListener('click', () => { const d = dirInput.value.trim(); if (d) loadRoot(d); });
dirInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const d = dirInput.value.trim(); if (d) loadRoot(d); } });

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
    wfSection.classList.add('hidden');
    // Let main-top shrink to now-playing only so the info pane fills the gap
    mainTop.style.height = '';
    return;
  }
  // Restore saved height when turning back on
  const saved = STORAGE.getMainTopH();
  if (saved) mainTop.style.height = `${saved}px`;
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
  if (mini) updateMiniInfo();
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
    startH = folderBrowser.offsetHeight;
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

  // Init Spotify integration
  initSpotify().catch(() => {});

  // Restore last dir + scan position + filter
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    const dir = config.dir || STORAGE.getDir();
    if (dir) {
      STORAGE.setDir(dir);
      dirInput.value = dir;
      musicIndex = null;

      // Restore filter text
      const savedFilter = STORAGE.getFilter();
      if (savedFilter) filterInput.value = savedFilter;

      // Load folder browser, then mark active subfolder
      const scanDir = STORAGE.getScanDir() || dir;
      await loadFolderBrowser(dir);
      if (savedFilter) applyFilter(savedFilter);
      // Highlight the active subfolder item in the browser
      if (scanDir !== dir) {
        const activeItem = folderBrowser.querySelector(`.folder-item[data-name="${CSS.escape(scanDir.split('/').pop())}"]`);
        if (activeItem) activeItem.classList.add('active');
      }

      await scanDirectory(scanDir);
    }
  } catch (_) {
    const dir = STORAGE.getDir();
    if (dir) { dirInput.value = dir; loadRoot(dir); }
  }
}

init();
