import { state, STORAGE } from './state.js';
import { escapeHtml, favKey, currentDisc, formatTime } from './helpers.js';
import { discList, npTitle } from './dom-refs.js';

// ── Favorites ─────────────────────────────────────────────────────────────────

function _favsFromArray(arr) {
  const map = new Map();
  for (const item of arr) {
    if (typeof item === 'object' && item.mp3File && item.trackNumber != null) {
      map.set(favKey(item.mp3File, item.trackNumber), item);
    }
  }
  return map;
}

function _mergeFavSources(...arrays) {
  const merged = new Map();
  for (const arr of arrays) {
    for (const item of arr) {
      if (typeof item === 'object' && item.mp3File && item.trackNumber != null) {
        merged.set(favKey(item.mp3File, item.trackNumber), item);
      }
    }
  }
  return merged;
}

async function loadFavorites() {
  const localMain = STORAGE.getFavs();
  const localBackup = JSON.parse(localStorage.getItem('tlp_favorites_backup') || '[]');

  let serverFavs = [];
  try {
    const res = await fetch('/api/favorites');
    if (res.ok) serverFavs = await res.json();
  } catch (_) {}

  state.favorites = _mergeFavSources(localMain, localBackup, serverFavs);

  const mergedArr = [...state.favorites.values()];
  if (mergedArr.length > localMain.length) {
    console.info(`loadFavorites: recovered ${mergedArr.length - localMain.length} entries from backup/server`);
    STORAGE.setFavs(mergedArr);
  }

  console.info(`loadFavorites: ${mergedArr.length} total (local=${localMain.length}, backup=${localBackup.length}, server=${serverFavs.length})`);
}

function saveFavorites() {
  const current = [...state.favorites.values()];
  const prev = STORAGE.getFavs();

  if (prev.length > 0 && current.length === 0) {
    console.warn('saveFavorites: refusing to wipe all favourites; existing count =', prev.length);
    return;
  }

  STORAGE.setFavs(current);
  localStorage.setItem('tlp_favorites_backup', JSON.stringify(current));

  fetch('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(current),
  }).catch(err => console.warn('saveFavorites: server sync failed', err));
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
  const activeDisc = currentDisc();
  if (activeDisc && activeDisc.id === disc.id) {
    npTitle.classList.toggle('is-fav', state.favorites.has(key));
  }
  const favsPanel = document.getElementById('favs-panel');
  if (favsPanel && !favsPanel.classList.contains('hidden')) renderFavsList();
}

// ── Starred tracks panel ──────────────────────────────────────────────────────
const favsPanel  = document.getElementById('favs-panel');
const favsBtn    = document.getElementById('favs-btn');
const favsClose  = document.getElementById('favs-close');
const favsList   = document.getElementById('favs-list');
const favsCount  = document.getElementById('favs-count');

// Registration pattern for playback dependency
let _playDiscAtTrack = null;
let _scanDirectory = null;
let _loadDisc = null;

function registerPlayback(fns) {
  _playDiscAtTrack = fns.playDiscAtTrack;
  _scanDirectory = fns.scanDirectory;
  _loadDisc = fns.loadDisc;
}

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
    favsList.innerHTML = '<div class="search-empty">No starred tracks yet. Click \u2605 on any track.</div>';
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
      header.innerHTML = `<span>${escapeHtml(fav.albumTitle || fav.mp3File || '\u2014')}</span>`;
      frag.appendChild(header);
    }

    const row = document.createElement('div');
    row.className = 'search-result';
    row.innerHTML = `<span class="search-result-num">${String(fav.trackNumber).padStart(2, '0')}</span>`
      + `<span class="search-result-title">${escapeHtml(fav.title || '\u2014')}</span>`
      + (fav.performer ? `<span class="search-result-artist">${escapeHtml(fav.performer)}</span>` : '')
      + `<button class="fav-remove" title="Unstar">\u2605</button>`;

    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('fav-remove')) {
        const key = favKey(fav.mp3File, fav.trackNumber);
        state.favorites.delete(key);
        saveFavorites();
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
  if (!disc && fav.dir && _scanDirectory) {
    await _scanDirectory(fav.dir);
    disc = state.discs.find((d) => d.mp3Path === fav.mp3Path);
  }
  if (!disc) return;
  const trackIdx = disc.tracks.findIndex((t) => t.track === fav.trackNumber);
  if (trackIdx >= 0 && _playDiscAtTrack) {
    _playDiscAtTrack(disc, trackIdx);
  } else if (_loadDisc) {
    _loadDisc(disc);
    const audio = document.getElementById('audio');
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

export {
  loadFavorites, saveFavorites, toggleFavorite, favKey,
  openFavsPanel, closeFavsPanel, renderFavsList,
  registerPlayback,
};
