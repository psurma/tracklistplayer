import { state, STORAGE } from './state.js';
import { escapeHtml, formatTime, favKey, currentDisc } from './helpers.js';
import { audio, discList, folderBrowser, filterInput, filterClear } from './dom-refs.js';
import { saveFavorites, toggleFavorite, renderFavsList } from './favorites.js';
import { addToQueue } from './queue.js';
import { npTitle } from './dom-refs.js';

// Registration pattern for cross-module deps
let _loadDisc = null;
let _playDiscAtTrack = null;
let _openSpotifySaveModal = null;
let _getDiscProgress = null;
let _showResumeBanner = null;
let _applyFilter = null;
let _isSoundcloudMode = null;
let _isSpotifyMode = null;
let _getSoundcloudTracks = null;
let _getSoundcloudTracksList = null;
let _getSpotifyTracksList = null;

function registerDeps(deps) {
  _loadDisc = deps.loadDisc;
  _playDiscAtTrack = deps.playDiscAtTrack;
  _openSpotifySaveModal = deps.openSpotifySaveModal;
  _getDiscProgress = deps.getDiscProgress;
  _showResumeBanner = deps.showResumeBanner;
  _applyFilter = deps.applyFilter;
  if (deps.isSoundcloudMode) _isSoundcloudMode = deps.isSoundcloudMode;
  if (deps.isSpotifyMode) _isSpotifyMode = deps.isSpotifyMode;
  if (deps.getSoundcloudTracks) _getSoundcloudTracks = deps.getSoundcloudTracks;
  if (deps.getSoundcloudTracksList) _getSoundcloudTracksList = deps.getSoundcloudTracksList;
  if (deps.getSpotifyTracksList) _getSpotifyTracksList = deps.getSpotifyTracksList;
}

// ── Filter ────────────────────────────────────────────────────────────────────
function applyFilter(query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  filterClear.classList.toggle('hidden', words.length === 0);

  // SoundCloud mode: filter track list by title + artist
  if (_isSoundcloudMode && _isSoundcloudMode()) {
    const scTracksList = _getSoundcloudTracksList ? _getSoundcloudTracksList() : null;
    const scTracks = _getSoundcloudTracks ? _getSoundcloudTracks() : [];
    if (scTracksList) {
      scTracksList.querySelectorAll('.soundcloud-track-item').forEach((item) => {
        const track = scTracks[Number(item.dataset.idx)];
        if (!track) return;
        const hay = `${track.title || ''} ${track.user ? track.user.username : ''}`.toLowerCase();
        item.classList.toggle('filter-hidden', words.length > 0 && !words.every((w) => hay.includes(w)));
      });
    }
    return;
  }

  // Spotify mode: filter track list by title + artist
  if (_isSpotifyMode && _isSpotifyMode()) {
    const spTracksList = _getSpotifyTracksList ? _getSpotifyTracksList() : null;
    if (spTracksList) {
      spTracksList.querySelectorAll('.spotify-track-item').forEach((item) => {
        const title  = (item.querySelector('.spotify-track-title')  || {}).textContent || '';
        const artist = (item.querySelector('.spotify-track-artist') || {}).textContent || '';
        const hay = `${title} ${artist}`.toLowerCase();
        item.classList.toggle('filter-hidden', words.length > 0 && !words.every((w) => hay.includes(w)));
      });
    }
    return;
  }

  folderBrowser.querySelectorAll('.folder-item').forEach((item) => {
    const name = item.dataset.name || '';
    const nameLower = name.toLowerCase();
    const matches = words.length === 0 || words.every((w) => nameLower.includes(w));
    item.classList.toggle('filter-hidden', !matches);

    const label = item.querySelector('.folder-label');
    if (!label) return;

    if (words.length && matches) {
      label.innerHTML = escapeHtml(name).replace(
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
let folderSort = localStorage.getItem(SORT_KEY) || 'name';
let lastSubdirs = [];
let lastBrowseDir = '';

const sortToggle = document.getElementById('sort-toggle');
function applySortLabel() {
  sortToggle.textContent = folderSort === 'name' ? 'A\u2013Z' : 'Date';
  sortToggle.title = folderSort === 'name' ? 'Sorted A\u2013Z (click for date)' : 'Sorted by date (click for A\u2013Z)';
}
applySortLabel();

sortToggle.addEventListener('click', () => {
  folderSort = folderSort === 'name' ? 'date' : 'name';
  localStorage.setItem(SORT_KEY, folderSort);
  applySortLabel();
  if (lastBrowseDir) renderFolderItems(lastBrowseDir, lastSubdirs);
});

function refreshDiscListView() {
  renderDiscList();
  highlightTrackInSidebar(state.currentDiscId, state.currentTrackIndex);
}

document.getElementById('expand-all-btn').addEventListener('click', () => {
  state.collapsedDiscs.clear();
  refreshDiscListView();
});
document.getElementById('collapse-all-btn').addEventListener('click', () => {
  for (const disc of state.discs) state.collapsedDiscs.add(disc.id);
  refreshDiscListView();
});

function normEntry(e) { return typeof e === 'string' ? { name: e, mtime: 0 } : e; }
function sortedSubdirs(subdirs) {
  const copy = subdirs.map(normEntry);
  if (folderSort === 'date') {
    copy.sort((a, b) => b.mtime - a.mtime);
  } else {
    copy.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }
  return copy;
}

// Registration pattern for scanDirectory
let _scanDirectory = null;
function registerScanDirectory(fn) { _scanDirectory = fn; }

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
    if (clickTimer) return;
    clickTimer = setTimeout(() => {
      clickTimer = null;
      folderBrowser.querySelectorAll('.folder-item.active').forEach((el) => el.classList.remove('active'));
      item.classList.add('active');
      STORAGE.setScanDir(fullPath);
      if (_scanDirectory) _scanDirectory(fullPath);
    }, 220);
  });
  item.addEventListener('dblclick', () => {
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
    folderBrowser.querySelectorAll('.folder-item.active').forEach((el) => el.classList.remove('active'));
    item.classList.add('active');
    STORAGE.setScanDir(fullPath);
    if (_scanDirectory) _scanDirectory(fullPath, true);
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
  up.textContent = '\u2191  ..';
  up.addEventListener('click', () => loadFolderBrowser(parent));
  folderBrowser.prepend(up);
}

async function loadFolderBrowser(dir, bust) {
  state.browseDir = dir;
  lastBrowseDir = dir;
  lastSubdirs = [];

  return new Promise((resolve) => {
    folderBrowser.innerHTML = '<div class="status-msg">Loading\u2026</div>';
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

// ── Disc list rendering ───────────────────────────────────────────────────────
let _activeTrackEl = null;

function renderDiscList() {
  _activeTrackEl = null;
  discList.innerHTML = '';

  if (!state.discs.length) {
    discList.innerHTML = '<div class="status-msg">No MP3/CUE files here.</div>';
    return;
  }

  for (const disc of state.discs) {
    const section = document.createElement('div');
    section.className = 'disc-section';

    const isCollapsed = state.collapsedDiscs.has(disc.id);
    if (isCollapsed) section.classList.add('disc-collapsed');

    const header = document.createElement('div');
    header.className = 'disc-header';
    const titleText = disc.albumTitle || disc.mp3File || `Disc ${disc.id + 1}`;
    const performer = disc.albumPerformer ? ` \u2014 <span>${escapeHtml(disc.albumPerformer)}</span>` : '';
    const arrow = `<span class="disc-toggle">${isCollapsed ? '\u25B6' : '\u25BC'}</span>`;
    header.innerHTML = `${arrow}${escapeHtml(titleText)}${performer}`;
    header.style.cursor = 'pointer';
    header.addEventListener('click', () => {
      const nowCollapsed = !state.collapsedDiscs.has(disc.id);
      if (nowCollapsed) state.collapsedDiscs.add(disc.id);
      else state.collapsedDiscs.delete(disc.id);
      section.classList.toggle('disc-collapsed', nowCollapsed);
      section.querySelector('.disc-toggle').textContent = nowCollapsed ? '\u25B6' : '\u25BC';
    });
    section.appendChild(header);

    if (disc.mp3Path && _getDiscProgress) {
      const prog = _getDiscProgress(disc.mp3Path);
      if (prog && prog.duration > 0) {
        const pct = Math.min(100, (prog.position / prog.duration) * 100);
        const bar = document.createElement('div');
        bar.className = 'disc-progress';
        bar.innerHTML = `<div class="disc-progress-fill" style="width:${pct.toFixed(1)}%"></div>`;
        section.appendChild(bar);
      }
    }

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
        if (_loadDisc) _loadDisc(disc);
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
        if (currentDisc() && currentDisc().id === disc.id) {
          npTitle.classList.toggle('is-fav', state.favorites.has(rawKey));
        }
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
        <span class="track-actions">
          <button class="track-action-btn track-queue-btn" title="Add to queue">+</button>
          <button class="track-action-btn track-spotify-btn" title="Save to Spotify">&#9834;</button>
        </span>
        <button class="fav-btn${isFav ? ' fav-active' : ''}" data-key="${escapeHtml(favKey(disc.mp3File, track.track))}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">&#9733;</button>
        <span class="track-time">${formatTime(track.startSeconds)}</span>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.closest('.fav-btn') || e.target.closest('.track-action-btn')) return;
        if (_playDiscAtTrack) _playDiscAtTrack(disc, i);
      });

      item.querySelector('.fav-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(disc, i, e.currentTarget);
      });

      item.querySelector('.track-queue-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        addToQueue(disc, i);
      });

      item.querySelector('.track-spotify-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (_openSpotifySaveModal) _openSpotifySaveModal(track.title, track.performer || disc.albumPerformer);
      });

      section.appendChild(item);
    }

    discList.appendChild(section);
  }

  applyFilter(filterInput.value);
}

function highlightTrackInSidebar(discId, trackIdx) {
  discList.querySelectorAll('.track-item').forEach((el) => {
    el.classList.remove('active');
    el.style.removeProperty('--prog');
  });
  const el = discList.querySelector(`.track-item[data-disc="${discId}"][data-track="${trackIdx}"]`);
  _activeTrackEl = el || null;
  if (el) { el.classList.add('active'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}

function updateTrackProgress() {
  const el = _activeTrackEl;
  if (!el || !isFinite(audio.duration) || audio.duration <= 0) return;
  const disc = currentDisc();
  if (!disc) return;
  const ct = audio.currentTime;
  let pct;
  const track = disc.tracks[state.currentTrackIndex];
  if (track) {
    const next = disc.tracks[state.currentTrackIndex + 1];
    const trackEnd = next ? next.startSeconds : audio.duration;
    if (trackEnd <= track.startSeconds) return;
    pct = ((ct - track.startSeconds) / (trackEnd - track.startSeconds)) * 100;
  } else {
    pct = (ct / audio.duration) * 100;
  }
  el.style.setProperty('--prog', `${Math.min(100, Math.max(0, pct)).toFixed(1)}%`);
}

export {
  applyFilter, renderDiscList, highlightTrackInSidebar, updateTrackProgress,
  loadFolderBrowser, renderFolderItems, normEntry,
  registerDeps, registerScanDirectory,
};
