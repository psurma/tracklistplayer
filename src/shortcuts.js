import { state } from './state.js';
import { audio, btnPlay, btnPrev, btnNext, volumeBar, queuePanel, bookmarksPanel, eqPanel, sleepPopover } from './dom-refs.js';
import { formatTime, currentDisc } from './helpers.js';
import { addBookmark } from './bookmarks.js';

// Registration pattern for playback
let _playDiscAtTrack = null;

function registerPlayback(fn) {
  _playDiscAtTrack = fn;
}

let _savedVolume = 1;

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea, select, [contenteditable]')) return;
  if (e.metaKey || e.ctrlKey) return;
  const shortcutsOverlay = document.getElementById('shortcuts-overlay');
  switch (e.key) {
    case ' ':
      e.preventDefault(); btnPlay.click(); break;
    case 'ArrowLeft':
      e.preventDefault(); btnPrev.click(); break;
    case 'ArrowRight':
      e.preventDefault(); btnNext.click(); break;
    case 'ArrowUp':
      if (e.shiftKey) { e.preventDefault(); audio.volume = Math.min(1, audio.volume + 0.05); volumeBar.value = audio.volume; } break;
    case 'ArrowDown':
      if (e.shiftKey) { e.preventDefault(); audio.volume = Math.max(0, audio.volume - 0.05); volumeBar.value = audio.volume; } break;
    case 'j': case 'J':
      e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 10); break;
    case 'l': case 'L':
      e.preventDefault(); if (isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, audio.currentTime + 10); break;
    case 'm': case 'M':
      e.preventDefault();
      if (audio.volume > 0) { _savedVolume = audio.volume; audio.volume = 0; }
      else { audio.volume = _savedVolume || 1; }
      volumeBar.value = audio.volume;
      break;
    case 'f': case 'F':
      e.preventDefault();
      { const disc = currentDisc(); if (disc && state.currentTrackIndex >= 0) {
          const el = document.querySelector(`.track-item[data-disc="${disc.id}"][data-track="${state.currentTrackIndex}"] .fav-btn`);
          if (el) el.click();
      }} break;
    case 'b': case 'B':
      e.preventDefault();
      { const label = prompt('Bookmark label:', `Bookmark @ ${formatTime(audio.currentTime)}`);
        if (label !== null) addBookmark(label); }
      break;
    case 'q': case 'Q':
      e.preventDefault(); queuePanel.classList.toggle('hidden'); bookmarksPanel.classList.add('hidden'); break;
    case '?':
      e.preventDefault(); shortcutsOverlay.classList.toggle('hidden'); break;
    case 'Escape':
      shortcutsOverlay.classList.add('hidden');
      eqPanel.classList.add('hidden');
      sleepPopover.classList.add('hidden');
      queuePanel.classList.add('hidden');
      bookmarksPanel.classList.add('hidden');
      break;
    default:
      if (e.key >= '1' && e.key <= '9') {
        const disc = currentDisc();
        if (disc && disc.tracks.length >= parseInt(e.key, 10) && _playDiscAtTrack) {
          e.preventDefault(); _playDiscAtTrack(disc, parseInt(e.key, 10) - 1);
        }
      }
  }
});
document.getElementById('shortcuts-close')?.addEventListener('click', () => {
  document.getElementById('shortcuts-overlay').classList.add('hidden');
});

export { registerPlayback };
