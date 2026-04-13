'use strict';

// ── Electron detection + media keys ──────────────────────────────────────────
if (navigator.userAgent.includes('Electron')) {
  document.body.classList.add('electron');
  if (window.electronAPI?.platform === 'darwin') document.body.classList.add('darwin');
  window.electronAPI?.onMediaKey?.((key) => {
    if (key === 'play-pause') document.getElementById('btn-play')?.click();
    else if (key === 'next') document.getElementById('btn-next')?.click();
    else if (key === 'prev') document.getElementById('btn-prev')?.click();
  });
}

// ── Imports ──────────────────────────────────────────────────────────────────
import { state, STORAGE } from './state.js';
import { formatTime, currentDisc, escapeHtml } from './helpers.js';
import { audio, dirInput, filterInput, sidebar, volumeBar, folderBrowser } from './dom-refs.js';

import {
  initScrubbers, initLiveSpectrum,
  fancyScrubber, getOvScrubber, getZmScrubber,
  getLiveSpectrum, getLiveSpectrumWrap,
  showLiveSpectrum, hideLiveSpectrum,
  loadDisc, playDiscAtTrack, scanDirectory, loadRoot,
  setShuffleOn, cycleRepeat, getRepeatMode, getShuffleOn,
  setTrackLabelsVisible, setWaveformVisible,
  startWaveformLoop, setInvalidateSearchIndex,
  getCurrentWfPath, setCurrentWfPath, loadWaveform,
} from './playback.js';

import { saveDiscProgress, getDiscProgress, showResumeBanner } from './playback-progress.js';

import {
  setMiniPlayer, updateMiniInfo,
  setSidebarCollapsed,
  initSidebarResize, initPanelResize, setBrowserPanelHeight,
  initMainResize, initNowPlayingResize, initWaveformResize,
  registerDeps as registerLayoutDeps,
} from './layout.js';

import {
  applyTheme, openSettings, closeSettings, syncSettingsBtns,
  openSpotifySaveModal,
  registerDeps as registerSettingsDeps, setWaveformVisibleLocal,
  setLibraryFolders as setSettingsLibraryFolders,
  setInvalidateIndex as setSettingsInvalidateIndex,
} from './settings.js';

import { loadFavorites } from './favorites.js';
import { registerPlayback as registerFavsPlayback } from './favorites.js';
import { loadBookmarks, registerScrubbers as registerBookmarkScrubbers } from './bookmarks.js';
import { renderQueue, registerPlayback as registerQueuePlayback } from './queue.js';
import { registerPlayback as registerShortcutsPlayback } from './shortcuts.js';
import { initLastfmSettings } from './lastfm.js';

import {
  initSpotify, connectSpotify, disconnectSpotify,
  openSpotifyMode, closeSpotifyMode,
  isSpotifyMode, isSpotifyConnected,
  setPendingSpotifyRestore, getSpotifyTracksList,
  registerDeps as registerSpotifyDeps,
  setWaveformVisible as setSpotifyWaveformVisible,
  setCurrentWfPath as setSpotifyCurrentWfPath,
} from './spotify.js';

import {
  initSoundcloud, connectSoundcloud, disconnectSoundcloud,
  openSoundcloudMode, closeSoundcloudMode,
  isSoundcloudMode, isSoundcloudConnected,
  getSoundcloudActiveIdx, getSoundcloudTracks, getSoundcloudTracksList,
  setPendingScRestore, registerDeps as registerSoundcloudDeps,
} from './soundcloud.js';

import {
  registerDeps as registerSearchDeps,
  setLibraryFolders as setSearchLibraryFolders,
  invalidateIndex,
} from './search.js';

import {
  enterStreamingInfoMode, exitStreamingInfoMode,
  showSpotifyTrackInfo, showSoundcloudTrackInfo,
  registerDeps as registerNfoDeps,
} from './nfo-pane.js';

import {
  showNfo, loadScrapedTracklist,
  registerDeps as registerTlDeps,
} from './tracklist-finder.js';

import {
  renderDiscList, highlightTrackInSidebar, applyFilter,
  loadFolderBrowser, normEntry,
  registerDeps as registerDiscListDeps, registerScanDirectory,
} from './disc-list.js';

import { loadLibrary, getLibraryFolders, registerDeps as registerLibraryDeps } from './library.js';
import { registerDeps as registerDirBrowserDeps } from './dir-browser-modal.js';

// Import side-effect modules (event listeners register themselves)
import './sleep-timer.js';
import './equalizer.js';
import './export.js';
import './discord.js';
import './drag-drop.js';
import './shortcuts.js';

// ── Initialize global components ─────────────────────────────────────────────
// FancyScrubber and LiveSpectrumRenderer are loaded as globals from separate scripts
initScrubbers();
initLiveSpectrum();

// ── Wire up cross-module dependencies ────────────────────────────────────────

// disc-list needs playback functions
registerDiscListDeps({
  loadDisc,
  playDiscAtTrack,
  openSpotifySaveModal,
  getDiscProgress,
  showResumeBanner,
  applyFilter,
  isSoundcloudMode,
  isSpotifyMode,
  getSoundcloudTracks,
  getSoundcloudTracksList,
  getSpotifyTracksList,
});
registerScanDirectory(scanDirectory);

// favorites need playback
registerFavsPlayback({ playDiscAtTrack, scanDirectory, loadDisc });

// queue needs playback
registerQueuePlayback(playDiscAtTrack);

// shortcuts need playback
registerShortcutsPlayback(playDiscAtTrack);

// search needs playback + library
registerSearchDeps({
  loadLibrary,
  scanDirectory,
  loadDisc,
  playDiscAtTrack,
});

// nfo-pane needs playback + streaming modes
registerNfoDeps({
  playDiscAtTrack,
  isSoundcloudMode,
  isSpotifyMode,
});

// tracklist-finder needs disc-list + playback + streaming
registerTlDeps({
  renderDiscList,
  loadDisc,
  isSoundcloudMode,
  isSpotifyMode,
});

// spotify needs streaming info + live spectrum
registerSpotifyDeps({
  enterStreamingInfoMode,
  exitStreamingInfoMode,
  showSpotifyTrackInfo,
  showLiveSpectrum,
  fancyScrubber,
  liveSpectrum: getLiveSpectrum(),
  liveSpectrumWrap: getLiveSpectrumWrap(),
  applyFilter,
  closeSettings,
});

// soundcloud needs streaming info + live spectrum
registerSoundcloudDeps({
  enterStreamingInfoMode,
  exitStreamingInfoMode,
  showSoundcloudTrackInfo,
  showLiveSpectrum,
  fancyScrubber,
  liveSpectrum: getLiveSpectrum(),
  liveSpectrumWrap: getLiveSpectrumWrap(),
  applyFilter,
  closeSettings,
});

// layout needs scrubbers for waveform resize
registerLayoutDeps({
  fancyScrubber,
  ovScrubber: getOvScrubber(),
  zmScrubber: getZmScrubber(),
});

// settings needs playback + streaming
registerSettingsDeps({
  applyTheme,
  setWaveformVisible,
  setTrackLabelsVisible,
  setShuffleOn,
  cycleRepeat,
  getRepeatMode,
  getShuffleOn,
  fancyScrubber,
  getCurrentWfPath,
  loadWaveform,
  connectSpotify,
  disconnectSpotify,
  connectSoundcloud,
  disconnectSoundcloud,
});

// library needs search index invalidation
registerLibraryDeps({ invalidateIndex });

// dir-browser-modal needs loadRoot + normEntry
registerDirBrowserDeps({ loadRoot, normEntry });

// bookmarks need scrubbers
registerBookmarkScrubbers(getOvScrubber(), getZmScrubber());

// search index invalidation for playback
setInvalidateSearchIndex(invalidateIndex);

// ── Dir load ─────────────────────────────────────────────────────────────────
const dirLoadBtn = document.getElementById('dir-load-btn');
dirLoadBtn.addEventListener('click', () => { const d = dirInput.value.trim(); if (d) loadRoot(d); });
dirInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const d = dirInput.value.trim(); if (d) loadRoot(d); } });

// ── Library folder dropdown on dir-input focus ───────────────────────────────
const dirLibDropdown = document.getElementById('dir-library-dropdown');

function showLibraryDropdown() {
  const folders = getLibraryFolders();
  if (!folders.length) return;
  dirLibDropdown.innerHTML = '';
  for (const folder of folders) {
    const name = folder.split('/').filter(Boolean).pop() || folder;
    const item = document.createElement('div');
    item.className = 'dir-lib-item';
    item.innerHTML = `<strong>${escapeHtml(name)}</strong>${escapeHtml(folder)}`;
    item.addEventListener('mousedown', (e) => {
      e.preventDefault();
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
  setTimeout(() => dirLibDropdown.classList.add('hidden'), 150);
});

// ── Filter ───────────────────────────────────────────────────────────────────
const filterClear = document.getElementById('filter-clear');
const FILTER_HISTORY_KEY = 'tlp_filter_history';
const FILTER_HISTORY_MAX = 30;

function loadFilterHistory() {
  try { return JSON.parse(localStorage.getItem(FILTER_HISTORY_KEY)) || []; }
  catch (_) { return []; }
}

function saveFilterHistory(history) {
  try { localStorage.setItem(FILTER_HISTORY_KEY, JSON.stringify(history)); } catch (_) {}
}

function pushFilterHistory(value) {
  if (!value.trim()) return;
  const history = loadFilterHistory().filter((s) => s !== value);
  history.unshift(value);
  saveFilterHistory(history.slice(0, FILTER_HISTORY_MAX));
}

let filterHistoryIndex = -1;
let filterLiveValue    = '';

filterInput.addEventListener('input', () => {
  filterHistoryIndex = -1;
  filterLiveValue    = filterInput.value;
  applyFilter(filterInput.value);
  STORAGE.setFilter(filterInput.value);
});

filterInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    filterInput.value  = '';
    filterHistoryIndex = -1;
    filterLiveValue    = '';
    applyFilter('');
    return;
  }
  if (e.key === 'Enter' && filterInput.value.trim()) {
    pushFilterHistory(filterInput.value.trim());
    filterHistoryIndex = -1;
    return;
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    const history = loadFilterHistory();
    if (!history.length) return;
    if (filterHistoryIndex === -1) filterLiveValue = filterInput.value;
    if (e.key === 'ArrowUp') {
      filterHistoryIndex = Math.min(filterHistoryIndex + 1, history.length - 1);
    } else {
      filterHistoryIndex = filterHistoryIndex - 1;
    }
    const val = filterHistoryIndex < 0 ? filterLiveValue : history[filterHistoryIndex];
    filterInput.value = val;
    filterInput.setSelectionRange(val.length, val.length);
    applyFilter(val);
    STORAGE.setFilter(val);
  }
});

filterClear.addEventListener('click', () => {
  filterInput.value  = '';
  filterHistoryIndex = -1;
  filterLiveValue    = '';
  applyFilter('');
  filterInput.focus();
});

// ── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  await loadFavorites();
  applyTheme(STORAGE.getTheme());
  setWaveformVisible(STORAGE.getWaveformOn());
  setTrackLabelsVisible(STORAGE.getTrackLabels());
  setShuffleOn(STORAGE.getShuffle());
  const savedRepeat = STORAGE.getRepeat();
  while (getRepeatMode() !== savedRepeat) cycleRepeat();
  const savedVol = STORAGE.getVolume();
  audio.volume = savedVol;
  volumeBar.value = savedVol;

  // Restore sidebar width
  const w = Math.max(200, Math.min(600, parseInt(STORAGE.getSidebarW(), 10)));
  document.documentElement.style.setProperty('--sidebar-width', `${w}px`);
  sidebar.style.width = `${w}px`;

  // Restore panel split height
  const browserPct = parseInt(STORAGE.getBrowserH(), 10);
  if (browserPct) setBrowserPanelHeight(browserPct, '%');

  setSidebarCollapsed(false);
  initSidebarResize();
  initPanelResize();
  initMainResize();
  initNowPlayingResize();
  initWaveformResize();

  // 60 fps waveform loop
  startWaveformLoop();

  // Init Spotify + SoundCloud integrations
  const [,] = await Promise.all([
    initSpotify().catch(() => {}),
    initSoundcloud().catch(() => {}),
  ]);

  const streamSession = STORAGE.getStreamSession();
  if (streamSession) {
    if (streamSession.mode === 'soundcloud' && isSoundcloudConnected()) {
      setPendingScRestore({ trackIdx: streamSession.trackIdx, position: streamSession.position });
      openSoundcloudMode();
    } else if (streamSession.mode === 'spotify' && isSpotifyConnected()) {
      setPendingSpotifyRestore({ uri: streamSession.uri, position: streamSession.position });
      openSpotifyMode();
    } else {
      STORAGE.clearStreamSession();
    }
  }

  // Restore last dir + scan position + filter
  try {
    const [configRes] = await Promise.all([
      fetch('/api/config'),
      loadLibrary(),
    ]);
    const config = await configRes.json();
    const dir = config.dir || STORAGE.getDir();
    if (dir) {
      STORAGE.setDir(dir);
      dirInput.value = dir;

      // Update search with library folders
      setSearchLibraryFolders(getLibraryFolders());
      setSettingsLibraryFolders(getLibraryFolders());
      setSettingsInvalidateIndex(invalidateIndex);

      const savedFilter = STORAGE.getFilter();
      if (savedFilter) filterInput.value = savedFilter;

      const scanDir = STORAGE.getScanDir() || dir;

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

init();

// ── Deferred init (after init) ───────────────────────────────────────────────
loadBookmarks();
state.queue = STORAGE.getQueue();
renderQueue();
initLastfmSettings();
