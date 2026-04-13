import { state } from './state.js';
import { escapeHtml, formatDurationMs, formatTime, currentDisc } from './helpers.js';
import { nfoPane, mainResizeH, mainTop, artworkPane, artworkImg, nfoContent, localBtn } from './dom-refs.js';

const nfoTabNfo        = document.getElementById('nfo-tab-nfo');
const nfoTabTracklist  = document.getElementById('nfo-tab-tracklist');
const tracklistContent = document.getElementById('tracklist-content');
const nfoTabDetect     = document.getElementById('nfo-tab-detect');
const nfoDetectBtn     = document.getElementById('nfo-detect-btn');
const nfoTabDetectBtn  = document.getElementById('nfo-tab-detect-btn');
const detectStatus     = document.getElementById('detect-status');
const detectTracksList = document.getElementById('detect-tracks-list');
const detectApplyBtn   = document.getElementById('detect-apply-btn');
const streamInfoPanel  = document.getElementById('stream-info-panel');
const streamInfoContent = document.getElementById('stream-info-content');
const nfoPaneClose     = document.getElementById('nfo-pane-close');
const nfoPaneExpandBtn = document.getElementById('nfo-pane-expand');

let activeInfoTab = 'nfo';
let lastNfoDir = '';
let lastNfoText = '';
let currentArtworkUrl = null;
let nfoPaneIsExpanded = false;
let savedMainTopH = null;

// Registration patterns
let _playDiscAtTrack = null;
let _isSoundcloudMode = null;
let _isSpotifyMode = null;

function registerDeps(deps) {
  _playDiscAtTrack = deps.playDiscAtTrack;
  _isSoundcloudMode = deps.isSoundcloudMode;
  _isSpotifyMode = deps.isSpotifyMode;
}

function setCurrentArtworkUrl(url) { currentArtworkUrl = url; }
function getLastNfoText() { return lastNfoText; }
function setLastNfoText(v) { lastNfoText = v; }
function getLastNfoDir() { return lastNfoDir; }

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
  if (_isSoundcloudMode && _isSoundcloudMode()) return;
  if (_isSpotifyMode && _isSpotifyMode()) return;
  nfoPane.classList.toggle('hidden', !visible);
  artworkPane.classList.toggle('hidden', visible || !currentArtworkUrl);
}

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

function renderStreamInfo(rows, description, pageUrl) {
  const linkify = (text) => escapeHtml(text).replace(
    /https?:\/\/[^\s<>"]+/g,
    (url) => `<a class="nfo-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`
  );
  let html = '<table class="stream-info-table">';
  for (const [label, value] of rows) {
    if (!value) continue;
    html += `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(value))}</td></tr>`;
  }
  if (pageUrl && /^https?:\/\//i.test(pageUrl)) {
    const clean = pageUrl.replace(/[?&]utm_[^&]*/g, '').replace(/[?&]$/, '');
    html += `<tr><th>Link</th><td><a class="nfo-link" href="${escapeHtml(clean)}" target="_blank" rel="noopener noreferrer">${escapeHtml(clean)}</a></td></tr>`;
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
  ], track.description, track.permalink_url);
}

function showSpotifyTrackInfo(item) {
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

const URL_RE = /https?:\/\/[^\s\])"'>]+/g;
function linkifyNfo(html) {
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
      <span class="tl-time">${formatTime(t.startSeconds)}</span>
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
  if (_playDiscAtTrack) _playDiscAtTrack(disc, idx);
});

function setNfoPaneExpanded(expanded) {
  if (nfoPaneIsExpanded === expanded) return;
  nfoPaneIsExpanded = expanded;
  if (expanded) {
    savedMainTopH = mainTop.style.height || null;
    mainTop.style.height = '0px';
    mainTop.style.overflow = 'hidden';
    mainResizeH.style.display = 'none';
    nfoPaneExpandBtn.innerHTML = '&#x2923;';
    nfoPaneExpandBtn.title = 'Collapse tracklist pane';
  } else {
    mainTop.style.overflow = '';
    mainResizeH.style.display = '';
    if (savedMainTopH) {
      mainTop.style.height = savedMainTopH;
    } else {
      mainTop.style.height = '';
    }
    savedMainTopH = null;
    nfoPaneExpandBtn.innerHTML = '&#x2922;';
    nfoPaneExpandBtn.title = 'Expand tracklist pane';
  }
}

nfoPaneExpandBtn.addEventListener('click', () => {
  setNfoPaneExpanded(!nfoPaneIsExpanded);
});

nfoPaneClose.addEventListener('click', () => {
  setNfoPaneExpanded(false);
  setNfoPaneVisible(false);
  const nfoBtn = document.getElementById('nfo-btn');
  if (lastNfoDir || currentDisc()) nfoBtn.classList.remove('hidden');
});

document.getElementById('nfo-btn').addEventListener('click', () => {
  setNfoPaneVisible(true);
  document.getElementById('nfo-btn').classList.add('hidden');
});

export {
  switchInfoTab, setNfoPaneVisible, setNfoPaneExpanded,
  enterStreamingInfoMode, exitStreamingInfoMode,
  renderTracklist, highlightTracklist,
  showSpotifyTrackInfo, showSoundcloudTrackInfo,
  renderStreamInfo, linkifyNfo, highlightNfo,
  setCurrentArtworkUrl, getLastNfoText, setLastNfoText, getLastNfoDir,
  registerDeps, nfoDetectBtn, nfoTabDetectBtn,
  detectStatus, detectTracksList, detectApplyBtn,
  nfoPaneClose, tracklistContent,
};
