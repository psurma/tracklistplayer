import { state, STORAGE } from './state.js';
import { formatTime, fileUrl, currentDisc, escapeHtml, favKey } from './helpers.js';
import {
  audio, discList, btnPlay, btnPrev, btnNext, btnShuffle, btnRepeat,
  seekBar, timeCurrent, timeTotal, volumeBar,
  npDisc, npTrackNumber, npTitle, npPerformer, npSection,
  spotifySearchBtn, soundcloudSearchBtn, finderBtn, nfoBtn, tlBtn,
  miniTrack, miniSub, seekTicks, wfSection, wfStatus,
  nfoPane, mainTop, artworkPane, artworkImg, exportBtn,
} from './dom-refs.js';
import { checkScrobble } from './lastfm.js';
import { updateDiscordPresence } from './discord.js';
import { playFromQueue } from './queue.js';
import { updateScrubberBookmarks } from './bookmarks.js';
import {
  highlightNfo, highlightTracklist, setCurrentArtworkUrl,
  getLastNfoText, setLastNfoText, renderTracklist, setNfoPaneVisible, switchInfoTab,
  nfoDetectBtn, nfoTabDetectBtn,
} from './nfo-pane.js';
import {
  parseNfoTracklist, showNfo, loadScrapedTracklist,
  getLastNfoParsedTracks, setLastNfoParsedTracks,
} from './tracklist-finder.js';
import { renderDiscList, highlightTrackInSidebar, updateTrackProgress, applyFilter, loadFolderBrowser } from './disc-list.js';
import { initEQ, getEqLowFilter } from './equalizer.js';
import { isSoundcloudMode, getSoundcloudActiveIdx, playSoundcloudTrack } from './soundcloud.js';
import { getSpotifyPlayer, getSpotifyCurrentUri, isSpotifyMode } from './spotify.js';
import { saveDiscProgress, getDiscProgress, showResumeBanner } from './playback-progress.js';

// ── Callback registration for circular dep avoidance ─────────────────────────
let _renderDiscList = null;
let _loadDiscCb = null;
let _loadScrapedTracklistCb = null;

export function onRenderDiscList(fn) { _renderDiscList = fn; }
export function onLoadDisc(fn) { _loadDiscCb = fn; }
export function onLoadScrapedTracklist(fn) { _loadScrapedTracklistCb = fn; }

// ── Dual FancyScrubber ───────────────────────────────────────────────────────
let ovScrubber, zmScrubber;

const onScrubberSeek = (t) => {
  if (!isFinite(audio.duration)) return;
  audio.currentTime = t;
  ovScrubber.seekTo(t);
  zmScrubber.seekTo(t);
  seekBar.value = (t / audio.duration) * 100;
  timeCurrent.textContent = formatTime(t);
};

export function initScrubbers() {
  ovScrubber = new FancyScrubber(
    document.getElementById('wf-overview'),
    onScrubberSeek,
    { showRuler: false }
  );

  zmScrubber = new FancyScrubber(
    document.getElementById('wf-zoom'),
    onScrubberSeek,
    { showRuler: true, centerPlayhead: true, panMode: true }
  );
}

// Thin proxy so all existing fancyScrubber.xxx references keep working
export const fancyScrubber = {
  load:             (d, t) => { ovScrubber.load(d, t); zmScrubber.load(d, t); },
  clear:            ()     => { ovScrubber.clear();     zmScrubber.clear();    },
  tick:             (t)    => { ovScrubber.tick(t);     zmScrubber.tick(t);    },
  seekTo:           (t)    => { ovScrubber.seekTo(t);   zmScrubber.seekTo(t);  },
  setVisibleSecs:   (v)    => zmScrubber.setVisibleSecs(v),
  _invalidateCache: ()     => { ovScrubber._invalidateCache(); zmScrubber._invalidateCache(); },
  _draw:            ()     => { ovScrubber._draw();     zmScrubber._draw();    },
  get peaks()    { return ovScrubber.peaks;    },
  get duration() { return zmScrubber.duration; },
};

export function getOvScrubber() { return ovScrubber; }
export function getZmScrubber() { return zmScrubber; }

// ── Live spectrum renderer ───────────────────────────────────────────────────
const liveSpectrumWrap = document.getElementById('live-spectrum-wrap');
const liveSpectrumCanvas = document.getElementById('live-spectrum');
let liveSpectrum;

export function initLiveSpectrum() {
  liveSpectrum = new LiveSpectrumRenderer(liveSpectrumCanvas);
}

export function getLiveSpectrum() { return liveSpectrum; }
export function getLiveSpectrumWrap() { return liveSpectrumWrap; }

const wfOverviewWrap = document.getElementById('wf-overview-wrap');
const wfResizeMid   = document.getElementById('wf-resize-mid');
const wfZoomWrap    = document.getElementById('wf-zoom-wrap');
const wfResizeBot   = document.getElementById('wf-resize-bot');

export function showLiveSpectrum() {
  wfSection.classList.remove('hidden');
  wfOverviewWrap.classList.add('hidden');
  wfResizeMid.classList.add('hidden');
  wfZoomWrap.classList.add('hidden');
  wfResizeBot.classList.add('hidden');
  liveSpectrumWrap.classList.remove('hidden');
  liveSpectrum.connectAudioElement(audio);
  if (audio._lsrCtx && audio._lsrSrc && !getEqLowFilter()) {
    initEQ(audio._lsrCtx, audio._lsrSrc, audio._lsrAnalyser);
  }
  liveSpectrum.start();
}

export function hideLiveSpectrum() {
  liveSpectrum.stop();
  liveSpectrumWrap.classList.add('hidden');
  wfOverviewWrap.classList.remove('hidden');
  wfResizeMid.classList.remove('hidden');
  wfZoomWrap.classList.remove('hidden');
  wfResizeBot.classList.remove('hidden');
}

// ── Artwork ──────────────────────────────────────────────────────────────────
let currentArtworkPath = null;
let currentArtworkUrl  = null;

export function getCurrentArtworkUrl() { return currentArtworkUrl; }

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
        setCurrentArtworkUrl(null);
        return;
      }
      currentArtworkUrl = URL.createObjectURL(blob);
      npSection.style.setProperty('--artwork', `url("${currentArtworkUrl}")`);
      npSection.classList.add('has-artwork');
      artworkImg.src = currentArtworkUrl;
      setCurrentArtworkUrl(currentArtworkUrl);
      if (nfoPane.classList.contains('hidden')) artworkPane.classList.remove('hidden');
    })
    .catch(() => {
      npSection.classList.remove('has-artwork');
      npSection.style.removeProperty('--artwork');
      artworkImg.src = '';
      artworkPane.classList.add('hidden');
      setCurrentArtworkUrl(null);
    });
}

function setCurrentArtworkUrlLocal(url) {
  currentArtworkUrl = url;
  setCurrentArtworkUrl(url);
}

// ── Waveform loading ─────────────────────────────────────────────────────────
let currentWfPath = null;
export let waveformVisible = true;

export function setWaveformVisibleFlag(v) { waveformVisible = v; }
export function getCurrentWfPath() { return currentWfPath; }
export function setCurrentWfPath(v) { currentWfPath = v; }

async function loadWaveform(disc) {
  if (!disc.mp3Path || disc.mp3Path === currentWfPath) return;
  currentWfPath = disc.mp3Path;

  const lastNfoText = getLastNfoText();
  if (lastNfoText) {
    const lastNfoParsedTracks = parseNfoTracklist(lastNfoText, disc.mp3Path);
    setLastNfoParsedTracks(lastNfoParsedTracks);
    const canDetect = lastNfoParsedTracks !== null && !disc.tracks.length;
    nfoDetectBtn.classList.toggle('hidden', !canDetect);
    nfoTabDetectBtn.classList.toggle('hidden', !canDetect);
  }

  hideLiveSpectrum();
  if (waveformVisible) wfSection.classList.remove('hidden');
  wfStatus.classList.remove('hidden');
  fancyScrubber.clear();
  try {
    const res = await fetch(`/api/waveform?path=${encodeURIComponent(disc.mp3Path)}&bucketMs=${STORAGE.getSpectrumRes()}`);
    if (!res.ok) throw new Error('waveform failed');
    const data = await res.json();
    const d = state.discs.find((x) => x.id === disc.id);

    const lastNfoParsedTracks = getLastNfoParsedTracks();
    if (d && !d.tracks.length && lastNfoParsedTracks && lastNfoParsedTracks.length >= 3) {
      d.tracks = lastNfoParsedTracks.map((t, i) => ({ ...t, track: i + 1 }));
      try { localStorage.setItem(`tlp_tl_${d.mp3Path}`, JSON.stringify(d.tracks)); } catch (_) {}
      renderDiscList();
    }

    fancyScrubber.load(data, d ? d.tracks : []);
    wfStatus.classList.add('hidden');
    zmScrubber.setVisibleSecs(30);
  } catch (_) {
    wfStatus.classList.add('hidden');
    currentWfPath = null;
  }
}

// ── Track detection ──────────────────────────────────────────────────────────
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

// ── Mini player ──────────────────────────────────────────────────────────────
let isMini = false;
let showRemaining = false;

export function getIsMini() { return isMini; }
export function setIsMini(v) { isMini = v; }

function updateMiniInfo() {
  const disc  = currentDisc();
  const track = disc && state.currentTrackIndex >= 0 ? disc.tracks[state.currentTrackIndex] : null;
  miniTrack.textContent = track ? (track.title || '\u2014') : (disc ? (disc.albumTitle || '\u2014') : '\u2014');
  miniSub.textContent   = track ? (track.performer || disc.albumPerformer || '') : (disc ? (disc.albumPerformer || '') : '');
}

function updateNowPlaying(trackIdx) {
  const disc = currentDisc();
  if (!disc) return;

  if (trackIdx < 0 || !disc.tracks.length) {
    npDisc.textContent = disc.albumTitle || disc.mp3File || '\u2014';
    npTrackNumber.textContent = '';
    npTitle.textContent = disc.albumTitle || '\u2014';
    npTitle.classList.remove('is-fav');
    npPerformer.textContent = disc.albumPerformer || '';
    spotifySearchBtn.classList.add('hidden');
    soundcloudSearchBtn.classList.add('hidden');
    finderBtn.classList.toggle('hidden', !disc.mp3Path);
    if (disc.mp3Path) finderBtn.dataset.path = disc.mp3Path;
    tlBtn.classList.toggle('hidden', !disc.mp3Path);
    return;
  }

  const track = disc.tracks[trackIdx];
  npDisc.textContent = disc.albumTitle || disc.mp3File || '\u2014';
  npTrackNumber.textContent = String(track.track).padStart(2, '0');
  npTitle.textContent = track.title || '(unknown title)';
  npTitle.classList.toggle('is-fav', state.favorites.has(favKey(disc.mp3File, track.track)));
  npPerformer.textContent = track.performer || disc.albumPerformer || '';

  const query = [track.performer || disc.albumPerformer, track.title].filter(Boolean).join(' ');
  if (query) {
    spotifySearchBtn.href = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
    spotifySearchBtn.classList.remove('hidden');
    soundcloudSearchBtn.href = `https://soundcloud.com/search?q=${encodeURIComponent(query)}`;
    soundcloudSearchBtn.classList.remove('hidden');
  } else {
    spotifySearchBtn.classList.add('hidden');
    soundcloudSearchBtn.classList.add('hidden');
  }

  if (disc.mp3Path) {
    finderBtn.dataset.path = disc.mp3Path;
    finderBtn.classList.remove('hidden');
    tlBtn.classList.remove('hidden');
  } else {
    finderBtn.classList.add('hidden');
    tlBtn.classList.add('hidden');
  }

  if (isMini) updateMiniInfo();
}

// ── Seek bar track markers ────────────────────────────────────────────────────
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
    if (track.startSeconds <= 0) continue;
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
    label.textContent = `${num} \u2014 ${track.title || ''}`;
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
  const MIN_GAP = 72;
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
  fancyScrubber.seekTo(t);
  if (audio.paused) audio.play().catch(() => {});
});

// ── Audio / disc loading ─────────────────────────────────────────────────────
function discAudioSrc(disc) {
  return disc.blobUrl || (disc.mp3Path ? fileUrl(disc.mp3Path) : null);
}

export function loadDisc(disc) {
  const src = discAudioSrc(disc);
  if (!src) return;
  state.currentDiscId = disc.id;
  state.currentTrackIndex = -1;
  audio.src = src;
  audio.load();
  updateNowPlaying(-1);
  highlightTrackInSidebar(disc.id, -1);
  if (disc.mp3Path) {
    loadWaveform(disc);
    loadArtwork(disc);
    exportBtn.classList.toggle('hidden', !disc.tracks.length);
    updateScrubberBookmarks();
    const prog = getDiscProgress(disc.mp3Path);
    if (prog && prog.position > 10) showResumeBanner(disc, prog);
  } else {
    fancyScrubber.clear();
    wfSection.classList.add('hidden');
    exportBtn.classList.add('hidden');
  }
}

export function playDiscAtTrack(disc, trackIdx) {
  const src = discAudioSrc(disc);
  if (!src) return;

  const alreadyLoaded = state.currentDiscId === disc.id && audio.src;
  const srcMatch = disc.mp3Path
    ? audio.src.includes(encodeURIComponent(disc.mp3Path))
    : audio.src === disc.blobUrl;
  if (!alreadyLoaded || !srcMatch) {
    state.currentDiscId = disc.id;
    audio.src = src;
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
    fancyScrubber.seekTo(startSecs);
    audio.play().catch(() => {});
    updateSeekTicks();
    audio.removeEventListener('loadedmetadata', seekAndPlay);
  }

  if (audio.readyState >= 1) seekAndPlay();
  else audio.addEventListener('loadedmetadata', seekAndPlay);
}

// ── Shuffle & repeat ─────────────────────────────────────────────────────────
let shuffleOn  = false;
let repeatMode = 'off';

export function getRepeatMode() { return repeatMode; }
export function getShuffleOn() { return shuffleOn; }

export function setShuffleOn(on) {
  shuffleOn = on;
  btnShuffle.classList.toggle('active', on);
  btnShuffle.title = on ? 'Shuffle on' : 'Shuffle';
}

export function cycleRepeat() {
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

// ── Track bounds (for mini player seek scoping) ──────────────────────────────
function getTrackBounds() {
  const disc = currentDisc();
  const dur = audio.duration;
  const fallback = { start: 0, end: isFinite(dur) ? dur : 0 };
  if (!disc || !disc.tracks || !disc.tracks.length) return fallback;
  const idx = state.currentTrackIndex >= 0 ? state.currentTrackIndex : 0;
  const track = disc.tracks[idx];
  if (!track) return fallback;
  const next = disc.tracks[idx + 1];
  return { start: track.startSeconds, end: next ? next.startSeconds : (isFinite(dur) ? dur : track.startSeconds) };
}

// ── Time remaining toggle ────────────────────────────────────────────────────
timeTotal.style.minWidth = '68px';
timeTotal.addEventListener('click', () => {
  showRemaining = !showRemaining;
  timeTotal.style.color = showRemaining ? 'var(--accent)' : '';
});

// ── Controls ─────────────────────────────────────────────────────────────────
function playAdjacentDisc(direction) {
  const discs = state.discs.filter((d) => d.mp3Path || d.blobUrl);
  const idx = discs.findIndex((d) => d.id === state.currentDiscId);
  if (idx < 0) return;
  const target = discs[direction === 'next' ? idx + 1 : idx - 1];
  if (!target) return;
  if (target.tracks.length > 0) {
    playDiscAtTrack(target, direction === 'next' ? 0 : target.tracks.length - 1);
  } else {
    loadDisc(target);
    audio.play().catch(() => {});
  }
}

btnPlay.addEventListener('click', () => {
  const spotifyPlayer = getSpotifyPlayer();
  const spotifyCurrentUri = getSpotifyCurrentUri();
  if (spotifyPlayer && spotifyCurrentUri) {
    spotifyPlayer.togglePlay().catch(() => {});
    return;
  }
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
});

btnPrev.addEventListener('click', () => {
  const disc = currentDisc();
  if (!disc) return;
  const idx = state.currentTrackIndex;
  if (disc.tracks.length > 0) {
    if (idx > 0 && audio.currentTime - disc.tracks[idx].startSeconds < 3) {
      playDiscAtTrack(disc, idx - 1);
    } else if (idx > 0) {
      const t = disc.tracks[idx].startSeconds; audio.currentTime = t; fancyScrubber.seekTo(t);
    } else {
      playAdjacentDisc('prev');
    }
  } else {
    if (audio.currentTime > 3) { audio.currentTime = 0; fancyScrubber.seekTo(0); }
    else playAdjacentDisc('prev');
  }
});

btnNext.addEventListener('click', () => {
  const disc = currentDisc();
  if (!disc) return;
  if (disc.tracks.length > 0) {
    const next = nextTrackIndex(disc, state.currentTrackIndex);
    if (next >= 0) playDiscAtTrack(disc, next);
    else playAdjacentDisc('next');
  } else {
    playAdjacentDisc('next');
  }
});

// ── Seek bar ─────────────────────────────────────────────────────────────────
seekBar.addEventListener('mousedown', () => { state.seeking = true; });
document.addEventListener('mouseup', () => { state.seeking = false; });

function seekBarToAbsoluteTime() {
  if (!isFinite(audio.duration)) return null;
  if (isMini) {
    const { start, end } = getTrackBounds();
    return start + (seekBar.value / 100) * (end - start);
  }
  return (seekBar.value / 100) * audio.duration;
}

seekBar.addEventListener('input', () => {
  const t = seekBarToAbsoluteTime();
  if (t === null) return;
  if (isMini) {
    const { start } = getTrackBounds();
    timeCurrent.textContent = formatTime(Math.max(0, t - start));
  } else {
    timeCurrent.textContent = formatTime(t);
  }
  audio.currentTime = t;
  fancyScrubber.seekTo(t);
});

seekBar.addEventListener('change', () => {
  const t = seekBarToAbsoluteTime();
  if (t !== null) audio.currentTime = t;
  state.seeking = false;
});

volumeBar.addEventListener('input', () => { audio.volume = volumeBar.value; });

// ── Finder button ────────────────────────────────────────────────────────────
finderBtn.addEventListener('click', () => {
  const p = finderBtn.dataset.path;
  if (!p) return;
  if (window.electronAPI?.revealFile) window.electronAPI.revealFile(p);
  else fetch(`/api/reveal?path=${encodeURIComponent(p)}`).catch(() => {});
});

// ── Audio events ─────────────────────────────────────────────────────────────
let savePlayStateTimer = null;

audio.addEventListener('timeupdate', () => {
  if (state.seeking) return;
  const ct = audio.currentTime;
  const dur = audio.duration;
  if (isMini && isFinite(dur)) {
    const { start, end } = getTrackBounds();
    const trackDur = end - start;
    const trackPos = ct - start;
    timeCurrent.textContent = formatTime(Math.max(0, trackPos));
    timeTotal.textContent = showRemaining
      ? `-${formatTime(Math.max(0, trackDur - trackPos))}`
      : formatTime(trackDur);
    seekBar.value = trackDur > 0 ? Math.max(0, Math.min(100, (trackPos / trackDur) * 100)) : 0;
  } else {
    timeCurrent.textContent = formatTime(ct);
    if (isFinite(dur)) {
      timeTotal.textContent = showRemaining ? `-${formatTime(dur - ct)}` : formatTime(dur);
      seekBar.value = (ct / dur) * 100;
    }
  }
  const newIdx = detectCurrentTrack(ct);
  if (newIdx !== state.currentTrackIndex) {
    state.currentTrackIndex = newIdx;
    updateNowPlaying(newIdx);
    highlightTrackInSidebar(state.currentDiscId, newIdx);
    if (!nfoPane.classList.contains('hidden')) { highlightNfo(); highlightTracklist(); }
    const _disc = currentDisc();
    if (_disc && newIdx >= 0) {
      checkScrobble(_disc, newIdx);
      updateDiscordPresence(_disc, newIdx);
    }
  }
  updateTrackProgress();
  if (!savePlayStateTimer) {
    savePlayStateTimer = setTimeout(() => {
      savePlayStateTimer = null;
      if (isSoundcloudMode() && getSoundcloudActiveIdx() >= 0) {
        STORAGE.setStreamSession({ mode: 'soundcloud', trackIdx: getSoundcloudActiveIdx(), position: audio.currentTime });
        return;
      }
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

audio.addEventListener('play',  () => {
  btnPlay.innerHTML = '&#9646;&#9646;';
  window.electronAPI?.fixAudioInput();
});
audio.addEventListener('pause', () => {
  btnPlay.innerHTML = '&#9654;';
  if (isSoundcloudMode() && getSoundcloudActiveIdx() >= 0) {
    STORAGE.setStreamSession({ mode: 'soundcloud', trackIdx: getSoundcloudActiveIdx(), position: audio.currentTime });
    return;
  }
  const disc = currentDisc();
  if (disc && disc.mp3Path) {
    STORAGE.setPlayState({ mp3Path: disc.mp3Path, trackIdx: state.currentTrackIndex, position: audio.currentTime });
    saveDiscProgress();
  }
});
// Pause Spotify whenever local audio starts
audio.addEventListener('play', () => {
  const spotifyPlayer = getSpotifyPlayer();
  if (spotifyPlayer) {
    spotifyPlayer.getCurrentState().then((s) => {
      if (s && !s.paused) spotifyPlayer.pause().catch(() => {});
    }).catch(() => {});
  }
});

audio.addEventListener('ended', () => {
  btnPlay.innerHTML = '&#9654;';
  if (isSoundcloudMode() && getSoundcloudActiveIdx() >= 0) {
    playSoundcloudTrack(getSoundcloudActiveIdx() + 1);
    return;
  }
  const disc = currentDisc();
  if (!disc) return;
  if (repeatMode === 'one') {
    const t = disc.tracks[state.currentTrackIndex];
    audio.currentTime = t ? t.startSeconds : 0;
    audio.play().catch(() => {});
  } else {
    if (playFromQueue()) return;
    const next = nextTrackIndex(disc, state.currentTrackIndex);
    if (next >= 0) {
      playDiscAtTrack(disc, next);
    } else {
      playAdjacentDisc('next');
    }
  }
});

window.addEventListener('beforeunload', () => {
  const disc = currentDisc();
  if (disc && disc.mp3Path) {
    STORAGE.setPlayState({ mp3Path: disc.mp3Path, trackIdx: state.currentTrackIndex, position: audio.currentTime });
  }
});

// ── Scan directory ───────────────────────────────────────────────────────────
let scanToken = 0;

export async function scanDirectory(dir, autoplay = false) {
  const token = ++scanToken;
  discList.innerHTML = '<div class="status-msg">Loading...</div>';
  currentWfPath = null;
  fancyScrubber.clear();
  wfSection.classList.add('hidden');

  try {
    const res = await fetch(`/api/scan?dir=${encodeURIComponent(dir)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText);
    }
    const data = await res.json();
    if (token !== scanToken) return;
    state.discs = data.discs;
    for (const disc of state.discs) loadScrapedTracklist(disc);
    renderDiscList();

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

    showNfo(dir);
  } catch (err) {
    discList.innerHTML = `<div class="status-msg" style="color:#c06060">Error: ${escapeHtml(err.message)}</div>`;
  }
}

// ── Load root directory ──────────────────────────────────────────────────────
export function loadRoot(dir) {
  STORAGE.setDir(dir);
  STORAGE.setScanDir('');
  STORAGE.setFilter('');
  const fi = document.getElementById('filter-input');
  if (fi) fi.value = '';
  invalidateSearchIndex();
  loadFolderBrowser(dir, true);
}

let invalidateSearchIndex = () => {};
export function setInvalidateSearchIndex(fn) { invalidateSearchIndex = fn; }

// ── Sync test ────────────────────────────────────────────────────────────────
document.getElementById('sync-test-btn').addEventListener('click', async (e) => {
  e.currentTarget.blur();
  const url = '/api/sync-test';
  audio.src = url;
  audio.load();

  const fakeTracks = Array.from({ length: 120 }, (_, i) => ({
    track: i + 1,
    title: `Second ${i + 1}`,
    startSeconds: i,
    performer: '',
  }));

  wfSection.classList.remove('hidden');
  wfStatus.classList.remove('hidden');
  fancyScrubber.clear();

  try {
    const res = await fetch(`/api/sync-test-waveform?bucketMs=${STORAGE.getSpectrumRes()}`);
    if (res.ok) {
      const data = await res.json();
      fancyScrubber.load(data, fakeTracks);
      wfStatus.classList.add('hidden');
    }
  } catch (_) {
    wfStatus.classList.add('hidden');
  }

  document.getElementById('np-disc').textContent = 'Sync Test Track';
  document.getElementById('np-title').textContent = 'Beep every second (1 kHz marker + pitch tone)';
  document.getElementById('np-performer').textContent = '';

  audio.addEventListener('canplay', function onCanPlay() {
    audio.removeEventListener('canplay', onCanPlay);
    audio.play().catch(() => {});
  });
});

// ── Waveform visibility ──────────────────────────────────────────────────────
export function setWaveformVisible(on) {
  waveformVisible = on;
  STORAGE.setWaveformOn(on);
  const waveformToggle = document.getElementById('waveform-toggle');
  waveformToggle.classList.toggle('off', !on);
  if (!on) {
    liveSpectrum.stop();
    wfSection.classList.add('hidden');
    mainTop.style.height = '';
    return;
  }
  const saved = STORAGE.getMainTopH();
  if (saved) mainTop.style.height = `${saved}px`;
  if (isSoundcloudMode() && getSoundcloudActiveIdx() >= 0) { showLiveSpectrum(); return; }
  if (isSpotifyMode() && getSpotifyCurrentUri()) { showLiveSpectrum(); return; }
  const disc = currentDisc();
  if (!disc || !disc.mp3Path) return;
  if (currentWfPath === disc.mp3Path && fancyScrubber.peaks) {
    wfSection.classList.remove('hidden');
    fancyScrubber._invalidateCache();
    fancyScrubber._draw();
  } else {
    currentWfPath = null;
    loadWaveform(disc);
  }
}

document.getElementById('waveform-toggle').addEventListener('click', () => setWaveformVisible(!waveformVisible));

// ── Star firework ────────────────────────────────────────────────────────────
function triggerStarFirework() {
  const textNode = Array.from(npTitle.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
  if (!textNode) return;
  const range = document.createRange();
  range.selectNode(textNode);
  const textRect = range.getBoundingClientRect();
  const midY = textRect.top + textRect.height * 0.5;
  const colors = ['#ffd700', '#ffed4a', '#ff8c00', '#fffbe8', '#ffffff'];
  const origins = [
    { x: textRect.left  - 22, y: midY },
    { x: textRect.right + 22, y: midY },
  ];
  for (const origin of origins) {
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.6;
      const dist  = 16 + Math.random() * 24;
      const spark = document.createElement('span');
      spark.className = 'star-spark';
      spark.style.left       = `${origin.x - 2}px`;
      spark.style.top        = `${origin.y - 2}px`;
      spark.style.background = colors[Math.floor(Math.random() * colors.length)];
      spark.style.setProperty('--spark-dx', `${(Math.cos(angle) * dist).toFixed(1)}px`);
      spark.style.setProperty('--spark-dy', `${(Math.sin(angle) * dist).toFixed(1)}px`);
      document.body.appendChild(spark);
      setTimeout(() => spark.remove(), 700);
    }
  }
}

export function startWaveformLoop() {
  let lastBeatMs = 0;
  (function waveformLoop() {
    requestAnimationFrame(waveformLoop);
    fancyScrubber.tick(audio.currentTime);

    if (!audio.paused && npTitle.classList.contains('is-fav') && ovScrubber.peaks) {
      const now = Date.now();
      if (now - lastBeatMs > 350) {
        const bi = Math.floor(audio.currentTime / (ovScrubber.bucketSecs || 1));
        const peak = ovScrubber.peaks[bi] || 0;
        const windowSize = 8;
        let sum = 0;
        for (let k = Math.max(0, bi - windowSize); k < bi; k++) sum += (ovScrubber.peaks[k] || 0);
        const avg = sum / Math.max(1, bi - Math.max(0, bi - windowSize));
        if (peak > 180 && peak > avg * 1.3) {
          lastBeatMs = now;
          triggerStarFirework();
        }
      }
    }
  }());
}

// Export everything needed by other modules
export {
  updateMiniInfo, setTrackLabelsVisible, updateSeekTicks,
  updateTickLabelVisibility, loadWaveform, loadArtwork,
  detectCurrentTrack, updateNowPlaying,
  discAudioSrc, playAdjacentDisc,
  nextTrackIndex,
  getTrackBounds,
  currentArtworkPath, currentArtworkUrl,
};
