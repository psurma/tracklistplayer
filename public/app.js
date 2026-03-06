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
    seekBar.value = (t / audio.duration) * 100;
    timeCurrent.textContent = formatTime(t);
  }
);

let currentWfPath = null;
async function loadWaveform(disc) {
  if (!disc.mp3Path || disc.mp3Path === currentWfPath) return;
  currentWfPath = disc.mp3Path;
  if (waveformVisible) wfSection.classList.remove('hidden');
  wfStatus.classList.remove('hidden');
  waveformRenderer.clear();
  try {
    const res = await fetch(`/api/waveform?path=${encodeURIComponent(disc.mp3Path)}`);
    if (!res.ok) throw new Error('waveform failed');
    const data = await res.json();
    const d = state.discs.find((x) => x.id === disc.id);
    waveformRenderer.load(data, d ? d.tracks : []);
    wfStatus.classList.add('hidden');
  } catch (_) {
    wfSection.classList.add('hidden');
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
const spotifyBtn      = document.getElementById('spotify-btn');
const soundcloudBtn   = document.getElementById('soundcloud-btn');
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
        folderBrowser.querySelectorAll('.folder-item.active').forEach((el) => el.classList.remove('active'));
        item.classList.add('active');
        scanDirectory(fullPath);
      });
      item.addEventListener('dblclick', () => {
        scanDirectory(fullPath, true);
      });
      folderBrowser.appendChild(item);
    }

    applyFilter(filterInput.value);
  } catch (err) {
    folderBrowser.innerHTML = `<div class="status-msg" style="color:#c06060">${escapeHtml(err.message)}</div>`;
  }
}

// ── NFO pane ──────────────────────────────────────────────────────────────────
const nfoPane       = document.getElementById('nfo-pane');
const mainResizeH   = document.getElementById('main-resize-h');
const mainTop       = document.getElementById('main-top');

function setNfoPaneVisible(visible) {
  nfoPane.classList.toggle('hidden', !visible);
  mainResizeH.classList.toggle('hidden', !visible);
}
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
    setNfoPaneVisible(true);
    nfoBtn.classList.add('hidden'); // hide toggle while pane is open
  } catch (_) {
    setNfoPaneVisible(false);
    nfoBtn.classList.add('hidden');
  }
}

nfoPaneClose.addEventListener('click', () => {
  setNfoPaneVisible(false);
  if (lastNfoDir) nfoBtn.classList.remove('hidden');
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
    npPerformer.textContent = disc.albumPerformer || '';
    spotifyBtn.classList.add('hidden');
    soundcloudBtn.classList.add('hidden');
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
    soundcloudBtn.href = `https://soundcloud.com/search?q=${encodeURIComponent(query)}`;
    soundcloudBtn.classList.remove('hidden');
  } else {
    spotifyBtn.classList.add('hidden');
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

function updateSeekTicks() {
  seekTicks.innerHTML = '';
  const disc = currentDisc();
  if (!disc || !disc.tracks.length || !isFinite(audio.duration)) return;
  for (const track of disc.tracks) {
    if (track.startSeconds <= 0) continue; // skip track 1 at 0:00
    const pct = (track.startSeconds / audio.duration) * 100;
    const tick = document.createElement('div');
    tick.className = 'seek-tick';
    tick.style.left = `${pct}%`;
    tick.title = `${String(track.track).padStart(2, '0')} — ${track.title || ''}`;
    seekTicks.appendChild(tick);
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
  loadWaveform(disc);
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

  const startSecs = disc.tracks[trackIdx] ? disc.tracks[trackIdx].startSeconds : 0;

  function seekAndPlay() {
    audio.currentTime = startSecs;
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
      if (first) playDiscAtTrack(first, 0);
      else if (state.discs.find((d) => d.mp3Path)) loadDisc(state.discs.find((d) => d.mp3Path));
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
  else if (idx >= 0) audio.currentTime = disc.tracks[idx].startSeconds;
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
  }
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

// ── Waveform visibility ───────────────────────────────────────────────────────
let waveformVisible = true;

function setWaveformVisible(on) {
  waveformVisible = on;
  STORAGE.setWaveformOn(on);
  waveformToggle.classList.toggle('off', !on);
  // Only touch wfSection if a waveform is actually loaded
  if (currentWfPath) wfSection.classList.toggle('hidden', !on);
}

waveformToggle.addEventListener('click', () => setWaveformVisible(!waveformVisible));

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

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  loadFavorites();
  applyTheme(STORAGE.getTheme());
  setWaveformVisible(STORAGE.getWaveformOn());

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

  // 60 fps waveform loop — reads audio.currentTime directly for smooth scrolling
  (function waveformLoop() {
    requestAnimationFrame(waveformLoop);
    waveformRenderer.tick(audio.currentTime);
  }());

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
