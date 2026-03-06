'use strict';

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
const seekBar       = document.getElementById('seek-bar');
const timeCurrent   = document.getElementById('time-current');
const timeTotal     = document.getElementById('time-total');
const volumeBar     = document.getElementById('volume-bar');
const npDisc        = document.getElementById('np-disc');
const npTrackNumber = document.getElementById('np-track-number');
const npTitle       = document.getElementById('np-title');
const npPerformer   = document.getElementById('np-performer');
const spotifyBtn    = document.getElementById('spotify-btn');
const finderBtn     = document.getElementById('finder-btn');
const nfoBtn        = document.getElementById('nfo-btn');
const themeToggle   = document.getElementById('theme-toggle');

// ── Persistence ───────────────────────────────────────────────────────────────
const STORAGE = {
  getDir:      ()    => localStorage.getItem('tlp_dir') || '',
  setDir:      (v)   => localStorage.setItem('tlp_dir', v),
  getTheme:    ()    => localStorage.getItem('tlp_theme') || 'dark',
  setTheme:    (v)   => localStorage.setItem('tlp_theme', v),
  getSidebarW: ()    => localStorage.getItem('tlp_sidebar_w') || '340',
  setSidebarW: (v)   => localStorage.setItem('tlp_sidebar_w', String(v)),
  getBrowserH: ()    => localStorage.getItem('tlp_browser_h') || '40',
  setBrowserH: (v)   => localStorage.setItem('tlp_browser_h', String(v)),
  getFavs:     ()    => JSON.parse(localStorage.getItem('tlp_favorites') || '[]'),
  setFavs:     (arr) => localStorage.setItem('tlp_favorites', JSON.stringify(arr)),
  getPlayState: ()   => JSON.parse(localStorage.getItem('tlp_playstate') || 'null'),
  setPlayState: (v)  => localStorage.setItem('tlp_playstate', JSON.stringify(v)),
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
    themeToggle.textContent = theme === 'dark' ? 'Light' : 'Dark';
  }
}

// ── Favorites ─────────────────────────────────────────────────────────────────
function loadFavorites() {
  state.favorites = new Set(STORAGE.getFavs());
}

function saveFavorites() {
  STORAGE.setFavs([...state.favorites]);
}

function toggleFavorite(mp3File, trackNumber, starEl) {
  const key = favKey(mp3File, trackNumber);
  if (state.favorites.has(key)) {
    state.favorites.delete(key);
    starEl.classList.remove('fav-active');
    starEl.title = 'Add to favorites';
  } else {
    state.favorites.add(key);
    starEl.classList.add('fav-active');
    starEl.title = 'Remove from favorites';
  }
  saveFavorites();
}

// ── Filter ────────────────────────────────────────────────────────────────────
function applyFilter(query) {
  const q = query.trim().toLowerCase();
  filterClear.classList.toggle('hidden', !q);

  // Filter and highlight folder browser items
  folderBrowser.querySelectorAll('.folder-item').forEach((item) => {
    const name = item.dataset.name || '';
    const nameLower = name.toLowerCase();
    const matches = !q || nameLower.includes(q);
    item.classList.toggle('filter-hidden', !matches);

    const label = item.querySelector('.folder-label');
    if (!label) return;

    if (q && matches) {
      const idx = nameLower.indexOf(q);
      label.innerHTML =
        escapeHtml(name.slice(0, idx)) +
        `<mark>${escapeHtml(name.slice(idx, idx + q.length))}</mark>` +
        escapeHtml(name.slice(idx + q.length));
    } else {
      label.textContent = name;
    }
  });

}

// ── Folder browser ────────────────────────────────────────────────────────────
async function loadFolderBrowser(dir) {
  state.browseDir = dir;
  folderBrowser.innerHTML = '<div class="status-msg">Loading...</div>';

  try {
    const res = await fetch(`/api/ls?dir=${encodeURIComponent(dir)}`);
    if (!res.ok) throw new Error('Failed to list directory');
    const data = await res.json();

    folderBrowser.innerHTML = '';

    // Up row
    if (data.parent) {
      const up = document.createElement('div');
      up.className = 'folder-up';
      up.textContent = '↑  ..';
      up.addEventListener('click', () => loadFolderBrowser(data.parent));
      folderBrowser.appendChild(up);
    }

    if (!data.subdirs.length && !data.parent) {
      folderBrowser.innerHTML = '<div class="status-msg">No subfolders.</div>';
    }

    for (const name of data.subdirs) {
      const item = document.createElement('div');
      item.className = 'folder-item';
      item.dataset.name = name;
      item.innerHTML = `<span class="folder-label">${escapeHtml(name)}</span>`;
      const fullPath = `${dir}/${name}`;
      item.addEventListener('click', () => {
        // Load tracks from this folder in the bottom panel only
        scanDirectory(fullPath);
      });
      folderBrowser.appendChild(item);
    }

    applyFilter(filterInput.value);
  } catch (err) {
    folderBrowser.innerHTML = `<div class="status-msg" style="color:#c06060">${escapeHtml(err.message)}</div>`;
  }
}

// ── NFO pane ──────────────────────────────────────────────────────────────────
const nfoPane      = document.getElementById('nfo-pane');
const nfoContent   = document.getElementById('nfo-content');
const nfoPaneName  = document.getElementById('nfo-pane-name');
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

async function showNfo(dir) {
  try {
    const res = await fetch(`/api/nfo?dir=${encodeURIComponent(dir)}`);
    if (!res.ok) {
      nfoPane.classList.add('hidden');
      nfoBtn.classList.add('hidden');
      return;
    }
    const text = await res.text();
    lastNfoDir = dir;
    lastNfoText = text;
    nfoPaneName.textContent = dir.split('/').pop();
    highlightNfo();
    nfoPane.classList.remove('hidden');
    nfoBtn.classList.add('hidden'); // hide toggle while pane is open
  } catch (_) {
    nfoPane.classList.add('hidden');
    nfoBtn.classList.add('hidden');
  }
}

nfoPaneClose.addEventListener('click', () => {
  nfoPane.classList.add('hidden');
  if (lastNfoDir) nfoBtn.classList.remove('hidden');
});

nfoBtn.addEventListener('click', () => {
  nfoPane.classList.remove('hidden');
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
    npPerformer.textContent = disc.albumPerformer || '';
    spotifyBtn.classList.add('hidden');
    finderBtn.classList.toggle('hidden', !disc.mp3Path);
    if (disc.mp3Path) finderBtn.dataset.path = disc.mp3Path;
    return;
  }

  const track = disc.tracks[trackIdx];
  npDisc.textContent = disc.albumTitle || disc.mp3File || '—';
  npTrackNumber.textContent = String(track.track).padStart(2, '0');
  npTitle.textContent = track.title || '(unknown title)';
  npPerformer.textContent = track.performer || disc.albumPerformer || '';

  const query = [track.performer || disc.albumPerformer, track.title].filter(Boolean).join(' ');
  if (query) {
    spotifyBtn.href = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
    spotifyBtn.classList.remove('hidden');
  } else {
    spotifyBtn.classList.add('hidden');
  }

  if (disc.mp3Path) {
    finderBtn.dataset.path = disc.mp3Path;
    finderBtn.classList.remove('hidden');
  } else {
    finderBtn.classList.add('hidden');
  }
}

function highlightTrackInSidebar(discId, trackIdx) {
  discList.querySelectorAll('.track-item').forEach((el) => el.classList.remove('active'));
  if (trackIdx >= 0) {
    const el = discList.querySelector(`.track-item[data-disc="${discId}"][data-track="${trackIdx}"]`);
    if (el) { el.classList.add('active'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  }
}

// ── Audio / disc loading ──────────────────────────────────────────────────────
function loadDisc(disc) {
  if (!disc.mp3Path) return;
  state.currentDiscId = disc.id;
  state.currentTrackIndex = -1;
  audio.src = fileUrl(disc.mp3Path);
  audio.load();
  updateNowPlaying(-1);
  highlightTrackInSidebar(disc.id, -1);
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

  const startSecs = disc.tracks[trackIdx] ? disc.tracks[trackIdx].startSeconds : 0;

  function seekAndPlay() {
    audio.currentTime = startSecs;
    audio.play().catch(() => {});
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
        <button class="fav-btn${isFav ? ' fav-active' : ''}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">&#9733;</button>
        <span class="track-time">${formatTime(track.startSeconds)}</span>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.fav-btn')) return;
        playDiscAtTrack(disc, i);
      });

      item.querySelector('.fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(disc.mp3File, track.track, e.currentTarget);
      });

      section.appendChild(item);
    }

    discList.appendChild(section);
  }

  applyFilter(filterInput.value);
}

// ── API ───────────────────────────────────────────────────────────────────────
async function scanDirectory(dir) {
  discList.innerHTML = '<div class="status-msg">Loading...</div>';
  STORAGE.setDir(dir);

  try {
    const res = await fetch(`/api/scan?dir=${encodeURIComponent(dir)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText);
    }
    const data = await res.json();
    state.discs = data.discs;
    renderDiscList();

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
  if (isFinite(dur)) { timeTotal.textContent = formatTime(dur); seekBar.value = (ct / dur) * 100; }
  const newIdx = detectCurrentTrack(ct);
  if (newIdx !== state.currentTrackIndex) {
    state.currentTrackIndex = newIdx;
    updateNowPlaying(newIdx);
    highlightTrackInSidebar(state.currentDiscId, newIdx);
    if (!nfoPane.classList.contains('hidden')) highlightNfo();
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
  if (isFinite(audio.duration)) timeTotal.textContent = formatTime(audio.duration);
});

audio.addEventListener('play',  () => { btnPlay.innerHTML = '&#9646;&#9646;'; });
audio.addEventListener('pause', () => {
  btnPlay.innerHTML = '&#9654;';
  const disc = currentDisc();
  if (disc && disc.mp3Path) {
    STORAGE.setPlayState({ mp3Path: disc.mp3Path, trackIdx: state.currentTrackIndex, position: audio.currentTime });
  }
});
audio.addEventListener('ended', () => { btnPlay.innerHTML = '&#9654;'; });

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
  else if (idx >= 0) audio.currentTime = disc.tracks[idx].startSeconds;
});

btnNext.addEventListener('click', () => {
  const disc = currentDisc();
  if (!disc) return;
  const idx = state.currentTrackIndex;
  if (idx < disc.tracks.length - 1) playDiscAtTrack(disc, idx + 1);
});

seekBar.addEventListener('mousedown', () => { state.seeking = true; });
document.addEventListener('mouseup', () => { state.seeking = false; });

seekBar.addEventListener('input', () => {
  if (isFinite(audio.duration)) timeCurrent.textContent = formatTime((seekBar.value / 100) * audio.duration);
});

seekBar.addEventListener('change', () => {
  if (isFinite(audio.duration)) audio.currentTime = (seekBar.value / 100) * audio.duration;
  state.seeking = false;
});

volumeBar.addEventListener('input', () => { audio.volume = volumeBar.value; });

// ── Keyboard shortcuts ─────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === ' ') { e.preventDefault(); btnPlay.click(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); btnPrev.click(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); btnNext.click(); }
});

// ── Filter ────────────────────────────────────────────────────────────────────
filterInput.addEventListener('input', () => applyFilter(filterInput.value));
filterInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { filterInput.value = ''; applyFilter(''); }
});
filterClear.addEventListener('click', () => { filterInput.value = ''; applyFilter(''); filterInput.focus(); });

// ── Dir load ──────────────────────────────────────────────────────────────────
function loadRoot(dir) {
  STORAGE.setDir(dir);
  loadFolderBrowser(dir);
  scanDirectory(dir);
}

dirLoadBtn.addEventListener('click', () => { const d = dirInput.value.trim(); if (d) loadRoot(d); });
dirInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const d = dirInput.value.trim(); if (d) loadRoot(d); } });

// ── Theme ─────────────────────────────────────────────────────────────────────
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    STORAGE.setTheme(next);
  });
}

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

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  loadFavorites();
  applyTheme(STORAGE.getTheme());

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

  // Restore last dir
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    const dir = config.dir || STORAGE.getDir();
    if (dir) {
      dirInput.value = dir;
      loadRoot(dir);
    }
  } catch (_) {
    const dir = STORAGE.getDir();
    if (dir) { dirInput.value = dir; loadRoot(dir); }
  }
}

init();
