import { state, STORAGE } from './state.js';
import { escapeHtml, currentDisc, formatTime } from './helpers.js';
import { audio, nfoBtn, tlBtn } from './dom-refs.js';
import {
  switchInfoTab, setNfoPaneVisible, highlightNfo,
  renderTracklist, setCurrentArtworkUrl, getLastNfoText, setLastNfoText, getLastNfoDir,
  nfoDetectBtn, nfoTabDetectBtn, detectStatus, detectTracksList, detectApplyBtn,
} from './nfo-pane.js';

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

// Registration pattern for cross-module deps
let _renderDiscList = null;
let _loadDisc = null;
let _isSoundcloudMode = null;
let _isSpotifyMode = null;

function registerDeps(deps) {
  _renderDiscList = deps.renderDiscList;
  _loadDisc = deps.loadDisc;
  if (deps.isSoundcloudMode) _isSoundcloudMode = deps.isSoundcloudMode;
  if (deps.isSpotifyMode) _isSpotifyMode = deps.isSpotifyMode;
}

function getLastNfoParsedTracks() { return lastNfoParsedTracks; }
function setLastNfoParsedTracks(v) { lastNfoParsedTracks = v; }
function getTlTargetDisc() { return tlTargetDisc; }
function setTlTargetDisc(v) { tlTargetDisc = v; }
function getTlStagedTracks() { return tlStagedTracks; }
function setTlStagedTracks(v) { tlStagedTracks = v; }
function getDetectStagedTracks() { return detectStagedTracks; }
function setDetectStagedTracks(v) { detectStagedTracks = v; }

// Parse a numbered tracklist out of NFO text.
function parseNfoTracklist(text, mp3Path) {
  if (!text) return null;

  let targetDisc = 1;
  if (mp3Path) {
    const fname = mp3Path.split('/').pop().toLowerCase();
    const cdMatch    = fname.match(/(?:cd|dis[ck])[-_]?(\d+)/i);
    const prefixMatch = !cdMatch && fname.match(/^(\d)(?=\d{2}[-_])/);
    if (cdMatch)       targetDisc = parseInt(cdMatch[1], 10);
    else if (prefixMatch) targetDisc = parseInt(prefixMatch[1], 10);
  }

  let parseText = text;
  if (/^Disc\s+\d+\/\d+/im.test(text)) {
    const positions = [];
    const sRe = /^Disc\s+(\d+)\/\d+/gim;
    let sm;
    while ((sm = sRe.exec(text)) !== null) {
      positions.push({ disc: parseInt(sm[1], 10), index: sm.index });
    }
    if (positions.length > 0) {
      const chosenIdx = positions.findIndex((p) => p.disc === targetDisc);
      const ci  = chosenIdx >= 0 ? chosenIdx : 0;
      const end = ci + 1 < positions.length ? positions[ci + 1].index : text.length;
      parseText = text.slice(positions[ci].index, end);
    }
  }

  const re = /^\s*(\d{1,3})(?:[.)]\s+|\s+)([A-Za-z].+)/gm;
  const entries = [];
  let m;
  while ((m = re.exec(parseText)) !== null) {
    const raw = m[2].trim();
    const durMatch = raw.match(/\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*$/);
    const durStr   = durMatch ? durMatch[1] : null;
    const line     = raw.replace(/\s+\d{1,2}:\d{2}(?::\d{2})?\s*$/, '').trim();
    if (!line) continue;
    entries.push({ num: parseInt(m[1], 10), line, durStr });
  }

  if (entries.length < 3) return null;
  if (entries[0].num > 2) return null;

  const parseDur = (s) => {
    if (!s) return null;
    const parts = s.split(':').map(Number);
    return parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts[0] * 60 + parts[1];
  };

  let cumSecs = 0;
  return entries.map((e, i) => {
    const startSeconds = cumSecs;
    const trackSecs    = parseDur(e.durStr);
    if (trackSecs !== null) cumSecs += trackSecs;
    const sepMatch = e.line.match(/^(.+?)\s+(?:–|—|-)\s+(.+)$/);
    return {
      track:        i + 1,
      performer:    sepMatch ? sepMatch[1].trim() : '',
      title:        sepMatch ? sepMatch[2].trim() : e.line,
      startSeconds,
    };
  });
}

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

function extractTlQuery(disc) {
  const folder = disc.mp3Path
    ? disc.mp3Path.replace(/\/[^/]+$/, '').split('/').pop()
    : disc.albumTitle || '';
  let q = folder.replace(/[_]/g, ' ').replace(/-/g, ' ');
  q = q.replace(/\b[A-Z]{2,10}\b/g, '');
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
  tlResults.innerHTML = '<div class="tl-msg">Searching MixesDB\u2026</div>';
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
      tlResults.innerHTML = '<div class="tl-msg">No results \u2014 try different search terms.</div>';
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
  tlTracksList.innerHTML = '<div class="tl-msg">Loading\u2026</div>';
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
      tlTracksList.innerHTML = '<div class="tl-msg" style="padding:6px 16px;font-size:11px;text-align:left;">No timecodes \u2014 track order only, no seek points.</div>';
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
  if (_renderDiscList) _renderDiscList();
  if (_loadDisc) _loadDisc(disc);
  closeTlFinder();
}

function loadScrapedTracklist(disc) {
  if (!disc.mp3Path || disc.tracks.length) return;
  try {
    const stored = localStorage.getItem(`tlp_tl_${disc.mp3Path}`);
    if (stored) disc.tracks = JSON.parse(stored);
  } catch (_) {}
}

async function showNfo(dir) {
  if ((_isSoundcloudMode && _isSoundcloudMode()) || (_isSpotifyMode && _isSpotifyMode())) return;
  try {
    const res = await fetch(`/api/nfo?dir=${encodeURIComponent(dir)}`);
    if (!res.ok) {
      lastNfoParsedTracks = null;
      nfoDetectBtn.classList.add('hidden');
      nfoTabDetectBtn.classList.add('hidden');
      const disc = currentDisc();
      if (disc && disc.tracks && disc.tracks.length > 0) {
        renderTracklist(disc);
        setNfoPaneVisible(true);
        switchInfoTab('tracklist');
        nfoBtn.classList.add('hidden');
      } else {
        document.getElementById('nfo-pane').classList.add('hidden');
        nfoBtn.classList.add('hidden');
      }
      return;
    }
    const text = await res.text();
    setLastNfoText(text);
    const disc = currentDisc();
    lastNfoParsedTracks = parseNfoTracklist(text, disc?.mp3Path);
    const canDetect = lastNfoParsedTracks !== null && disc && !disc.tracks.length;
    nfoDetectBtn.classList.toggle('hidden', !canDetect);
    nfoTabDetectBtn.classList.toggle('hidden', !canDetect);
    highlightNfo();
    if (disc) renderTracklist(disc);
    setNfoPaneVisible(true);
    switchInfoTab('nfo');
    nfoBtn.classList.add('hidden');
  } catch (_) {
    lastNfoParsedTracks = null;
    nfoDetectBtn.classList.add('hidden');
    nfoTabDetectBtn.classList.add('hidden');
    setNfoPaneVisible(false);
    nfoBtn.classList.add('hidden');
  }
}

// Event listeners
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

nfoDetectBtn.addEventListener('click', () => {
  switchInfoTab('detect');
  runDetectTransitions();
});

detectApplyBtn.addEventListener('click', () => {
  if (!detectStagedTracks || !detectStagedTracks.length) return;
  tlTargetDisc   = currentDisc();
  tlStagedTracks = detectStagedTracks.map(({ _confidence, ...t }) => t);
  applyScrapedTracklist();
  lastNfoParsedTracks = null;
  detectStagedTracks  = null;
  nfoDetectBtn.classList.add('hidden');
  nfoTabDetectBtn.classList.add('hidden');
  switchInfoTab('tracklist');
});

export {
  parseNfoTracklist, runDetectTransitions, extractTlQuery,
  openTlFinder, closeTlFinder, runTlSearch, showTlTracks,
  applyScrapedTracklist, loadScrapedTracklist, showNfo,
  getLastNfoParsedTracks, setLastNfoParsedTracks,
  getTlTargetDisc, setTlTargetDisc,
  getTlStagedTracks, setTlStagedTracks,
  getDetectStagedTracks, setDetectStagedTracks,
  registerDeps,
};
