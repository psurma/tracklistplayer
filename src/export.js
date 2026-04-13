import { currentDisc, formatTime, escapeHtml } from './helpers.js';
import { exportBtn } from './dom-refs.js';

function showToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:var(--bg2);border:1px solid var(--accent);color:var(--text);padding:6px 14px;border-radius:var(--radius);font-size:12px;z-index:9999;pointer-events:none;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function exportTracklistAsText() {
  const disc = currentDisc();
  if (!disc || !disc.tracks.length) return;
  const lines = disc.tracks.map((t) => {
    const num = String(t.track).padStart(2, '0');
    const time = formatTime(t.startSeconds);
    const artist = t.performer ? `${t.performer} - ` : '';
    return `${num}. ${artist}${t.title} [${time}]`;
  });
  const header = disc.albumTitle ? `${disc.albumTitle}\n${'─'.repeat(disc.albumTitle.length)}\n` : '';
  navigator.clipboard.writeText(header + lines.join('\n')).then(() => {
    showToast('Tracklist copied to clipboard');
  });
}

function exportTracklistAsM3U() {
  const disc = currentDisc();
  if (!disc || !disc.tracks.length) return;
  let m3u = '#EXTM3U\n';
  disc.tracks.forEach((t) => {
    const dur = Math.round(t.durationSeconds || 0);
    const artist = t.performer || disc.albumPerformer || 'Unknown';
    m3u += `#EXTINF:${dur},${artist} - ${t.title}\n`;
    m3u += `${disc.mp3File}\n`;
  });
  const blob = new Blob([m3u], { type: 'audio/x-mpegurl' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (disc.albumTitle || disc.mp3File).replace(/\.[^.]+$/, '') + '.m3u';
  a.click();
  URL.revokeObjectURL(a.href);
}

let _exportDropdown = null;
exportBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (_exportDropdown) { _exportDropdown.remove(); _exportDropdown = null; return; }
  const dd = document.createElement('div');
  dd.id = 'export-dropdown';
  const b1 = document.createElement('button');
  b1.textContent = 'Copy as text';
  b1.addEventListener('click', () => { exportTracklistAsText(); dd.remove(); _exportDropdown = null; });
  const b2 = document.createElement('button');
  b2.textContent = 'Download M3U';
  b2.addEventListener('click', () => { exportTracklistAsM3U(); dd.remove(); _exportDropdown = null; });
  dd.append(b1, b2);
  exportBtn.style.position = 'relative';
  exportBtn.appendChild(dd);
  _exportDropdown = dd;
});
document.addEventListener('click', () => { if (_exportDropdown) { _exportDropdown.remove(); _exportDropdown = null; } });

export { exportTracklistAsText, exportTracklistAsM3U, showToast };
