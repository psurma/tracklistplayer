import { state, STORAGE } from './state.js';
import { formatTime, currentDisc } from './helpers.js';
import {
  audio, sidebar, collapseBtn, resizeHandle, folderBrowser,
  miniBtn, miniTrack, miniSub, seekBar, timeCurrent, timeTotal,
  mainTop,
} from './dom-refs.js';

// Registration pattern
let _fancyScrubber = null;
let _ovScrubber = null;
let _zmScrubber = null;
let _setMiniPlayer = null;
let _setBrowserPanelHeight = null;

function registerDeps(deps) {
  if (deps.fancyScrubber) _fancyScrubber = deps.fancyScrubber;
  if (deps.ovScrubber) _ovScrubber = deps.ovScrubber;
  if (deps.zmScrubber) _zmScrubber = deps.zmScrubber;
}

// ── Mini player ──────────────────────────────────────────────────────────────
let isMini = false;
let showRemaining = false;

function updateMiniInfo() {
  const disc  = currentDisc();
  const track = disc && state.currentTrackIndex >= 0 ? disc.tracks[state.currentTrackIndex] : null;
  miniTrack.textContent = track ? (track.title || '\u2014') : (disc ? (disc.albumTitle || '\u2014') : '\u2014');
  miniSub.textContent   = track ? (track.performer || disc.albumPerformer || '') : (disc ? (disc.albumPerformer || '') : '');
}

function setMiniPlayer(mini) {
  isMini = mini;
  document.body.classList.toggle('mini', mini);
  miniBtn.title     = mini ? 'Full player' : 'Mini player';
  miniBtn.innerHTML = mini ? '&#x229E;' : '&#x2296;';
  if (mini) {
    updateMiniInfo();
  } else {
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

// ── Sidebar collapse ─────────────────────────────────────────────────────────
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

// ── Sidebar width resize ─────────────────────────────────────────────────────
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

// ── Panel height resize ──────────────────────────────────────────────────────
const MIN_PANEL_H = 60;
const DEFAULT_BROWSER_RATIO = 0.4;
const panelResize = document.getElementById('panel-resize');
const sidebarHeader = sidebar.querySelector('#sidebar-header');
const soundcloudBrowser = document.getElementById('soundcloud-browser');
const spotifyBrowser    = document.getElementById('spotify-browser');

function getAvailablePanelHeight() {
  return sidebar.offsetHeight - sidebarHeader.offsetHeight - panelResize.offsetHeight;
}

function setBrowserPanelHeight(value, unit = 'px') {
  const v = `${value}${unit}`;
  folderBrowser.style.height = v;
  soundcloudBrowser.style.height = v;
  spotifyBrowser.style.height = v;
  document.documentElement.style.setProperty('--browser-height', v);
}

function persistBrowserH() {
  const h = folderBrowser.offsetHeight;
  STORAGE.setBrowserH(Math.round((h / getAvailablePanelHeight()) * 100));
}

function initPanelResize() {
  let startY = 0, startH = 0;

  panelResize.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    startY = e.clientY;
    // Determine which browser panel is visible
    const isSc = !soundcloudBrowser.classList.contains('hidden') && soundcloudBrowser.offsetHeight > 0;
    const isSp = !spotifyBrowser.classList.contains('hidden') && spotifyBrowser.offsetHeight > 0;
    startH = isSc ? soundcloudBrowser.offsetHeight : isSp ? spotifyBrowser.offsetHeight : folderBrowser.offsetHeight;
    panelResize.classList.add('dragging');
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!panelResize.classList.contains('dragging')) return;
    const available = getAvailablePanelHeight();
    const newH = Math.max(MIN_PANEL_H, Math.min(available - MIN_PANEL_H, startH + e.clientY - startY));
    setBrowserPanelHeight(newH);
  });

  document.addEventListener('mouseup', () => {
    if (panelResize.classList.contains('dragging')) {
      panelResize.classList.remove('dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      persistBrowserH();
    }
  });
}

// Panel maximize/minimize
document.getElementById('panel-maximize-tracks').addEventListener('click', (e) => {
  e.stopPropagation();
  setBrowserPanelHeight(MIN_PANEL_H);
  persistBrowserH();
});

document.getElementById('panel-maximize-browser').addEventListener('click', (e) => {
  e.stopPropagation();
  setBrowserPanelHeight(getAvailablePanelHeight() - MIN_PANEL_H);
  persistBrowserH();
});

panelResize.addEventListener('dblclick', () => {
  setBrowserPanelHeight(Math.round(getAvailablePanelHeight() * DEFAULT_BROWSER_RATIO));
  persistBrowserH();
});

// ── Main pane resize ─────────────────────────────────────────────────────────
const mainResizeH = document.getElementById('main-resize-h');

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

// ── Now-playing pane resize ──────────────────────────────────────────────────
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

// ── Waveform resize handles ──────────────────────────────────────────────────
function initWaveformResize() {
  const ovWrap    = document.getElementById('wf-overview-wrap');
  const zmWrap    = document.getElementById('wf-zoom-wrap');
  const midHandle = document.getElementById('wf-resize-mid');
  const botHandle = document.getElementById('wf-resize-bot');

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
    localStorage.setItem(dragging.wrap === ovWrap ? 'tlp_wf_ov_h' : 'tlp_wf_zm_h', newH);
    if (_ovScrubber && _zmScrubber) {
      if (dragging.wrap === ovWrap) { _ovScrubber._invalidateCache(); _ovScrubber._draw(); }
      else                          { _zmScrubber._invalidateCache(); _zmScrubber._draw(); }
    }
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging.handle.classList.remove('dragging');
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    dragging = null;
  });
}

export {
  setMiniPlayer, updateMiniInfo,
  setSidebarCollapsed,
  initSidebarResize, initPanelResize, setBrowserPanelHeight, persistBrowserH,
  initMainResize, initNowPlayingResize, initWaveformResize,
  registerDeps,
};
