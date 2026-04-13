import { state, STORAGE } from './state.js';
import { escapeHtml } from './helpers.js';
import { queuePanel, queueList, queueCount, bookmarksPanel } from './dom-refs.js';
import { showToast } from './export.js';

// Registration pattern for playback dependency
let _playDiscAtTrack = null;

function registerPlayback(fn) {
  _playDiscAtTrack = fn;
}

function addToQueue(disc, trackIdx) {
  const t = disc.tracks[trackIdx];
  if (!t) return;
  state.queue.push({
    discId: disc.id,
    trackIdx,
    title: t.title || disc.albumTitle,
    performer: t.performer || disc.albumPerformer || '',
  });
  STORAGE.setQueue(state.queue);
  renderQueue();
  showToast('Added to queue');
}

function renderQueue() {
  queueList.innerHTML = '';
  queueCount.textContent = state.queue.length ? `(${state.queue.length})` : '';
  state.queue.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'queue-item';
    row.innerHTML = `<span class="queue-item-title">${escapeHtml(item.title)}</span>
      <span class="queue-item-artist">${escapeHtml(item.performer)}</span>
      <button class="queue-item-remove" title="Remove">&#x2715;</button>`;
    row.querySelector('.queue-item-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      state.queue.splice(i, 1);
      STORAGE.setQueue(state.queue);
      renderQueue();
    });
    row.addEventListener('click', () => {
      const entry = state.queue.splice(i, 1)[0];
      STORAGE.setQueue(state.queue);
      renderQueue();
      const disc = state.discs.find((d) => d.id === entry.discId);
      if (disc && _playDiscAtTrack) _playDiscAtTrack(disc, entry.trackIdx);
    });
    queueList.appendChild(row);
  });
}

function playFromQueue() {
  if (!state.queue.length) return false;
  const entry = state.queue.shift();
  STORAGE.setQueue(state.queue);
  renderQueue();
  const disc = state.discs.find((d) => d.id === entry.discId);
  if (disc && _playDiscAtTrack) { _playDiscAtTrack(disc, entry.trackIdx); return true; }
  return false;
}

document.getElementById('queue-btn').addEventListener('click', () => {
  queuePanel.classList.toggle('hidden');
  bookmarksPanel.classList.add('hidden');
});
document.getElementById('queue-close').addEventListener('click', () => queuePanel.classList.add('hidden'));
document.getElementById('queue-clear').addEventListener('click', () => {
  state.queue = [];
  STORAGE.setQueue([]);
  renderQueue();
});

export { addToQueue, renderQueue, playFromQueue, registerPlayback };
