import { state } from './state.js';

function formatTime(secs) {
  if (!isFinite(secs) || secs < 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(secs) {
  if (secs == null || !isFinite(secs) || secs < 0) return '';
  return formatTime(secs);
}

function formatDurationMs(ms) {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
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

export { formatTime, formatDuration, formatDurationMs, fileUrl, currentDisc, escapeHtml, favKey };
