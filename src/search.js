import { state, STORAGE } from './state.js';
import { escapeHtml, formatDuration } from './helpers.js';
import { audio } from './dom-refs.js';

const searchModalOverlay = document.getElementById('search-modal-overlay');
const searchInput  = document.getElementById('search-input');
const searchCount  = document.getElementById('search-count');
const searchResults = document.getElementById('search-results');
const searchBtn    = document.getElementById('search-btn');
const searchClose  = document.getElementById('search-close');

let musicIndex = null;
let indexLoading = false;
let indexEventSources = [];

// Registration pattern for deps
let _loadLibrary = null;
let _libraryFolders = [];
let _scanDirectory = null;
let _loadDisc = null;
let _playDiscAtTrack = null;

function registerDeps(deps) {
  _loadLibrary = deps.loadLibrary;
  _scanDirectory = deps.scanDirectory;
  _loadDisc = deps.loadDisc;
  _playDiscAtTrack = deps.playDiscAtTrack;
}

function setLibraryFolders(folders) { _libraryFolders = folders; }
function invalidateIndex() { musicIndex = null; }

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

function fetchMusicIndex() {
  for (const src of indexEventSources) src.close();
  indexEventSources = [];

  indexLoading = true;
  musicIndex = [];
  searchResults.innerHTML = '<div class="search-empty">Scanning\u2026 0 albums found</div>';
  searchCount.textContent = '';

  const doLoad = _loadLibrary ? _loadLibrary() : Promise.resolve();
  doLoad.then(() => {
    const currentRoot = STORAGE.getDir();
    const roots = [...new Set([..._libraryFolders, currentRoot].filter(Boolean))];
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
    searchResults.innerHTML = '<div class="search-empty">Type to search\u2026</div>';
    return;
  }

  const groups = [];
  for (const disc of musicIndex) {
    const discText = [disc.albumTitle, disc.albumPerformer, disc.year].join(' ').toLowerCase();
    const discMatch = words.every((w) => discText.includes(w));

    const matchingTracks = disc.tracks.filter((t) => {
      const tt = [t.title, t.performer].join(' ').toLowerCase();
      return words.every((w) => tt.includes(w));
    });

    if (!discMatch && matchingTracks.length === 0) continue;

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
    header.innerHTML = `<span>${highlight(disc.albumTitle || disc.mp3File || '\u2014', words)}</span>`
      + `<span style="color:var(--text-dim);font-weight:400">${highlight(disc.albumPerformer || '', words)}</span>`
      + (disc.year ? `<span class="search-disc-year">${disc.year}</span>` : '');
    frag.appendChild(header);

    if (disc.tracks.length === 0) {
      const row = document.createElement('div');
      row.className = 'search-result disc-result';
      row.innerHTML = `<span class="search-result-num">&#9654;</span>`
        + `<span class="search-result-title">${highlight(disc.mp3File || disc.albumTitle || '\u2014', words)}</span>`;
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
          + `<span class="search-result-title">${highlight(track.title || '\u2014', words)}</span>`
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
  if (_scanDirectory) await _scanDirectory(indexDisc.dir);
  const disc = state.discs.find((d) => d.mp3Path === targetMp3);
  if (!disc) return;
  if (trackIdx >= 0 && disc.tracks.length > trackIdx && _playDiscAtTrack) {
    _playDiscAtTrack(disc, trackIdx);
  } else if (_loadDisc) {
    _loadDisc(disc);
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

export { openSearchPanel, closeSearchPanel, fetchMusicIndex, highlight, runSearch, invalidateIndex, registerDeps, setLibraryFolders };
