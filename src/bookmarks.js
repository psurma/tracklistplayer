import { state, STORAGE } from './state.js';
import { currentDisc, formatTime, escapeHtml } from './helpers.js';
import { audio, bookmarksPanel, bookmarksList, bookmarksCount, queuePanel } from './dom-refs.js';
import { showToast } from './export.js';

// Registration pattern for scrubber access
let _ovScrubber = null;
let _zmScrubber = null;

function registerScrubbers(ov, zm) {
  _ovScrubber = ov;
  _zmScrubber = zm;
}

function loadBookmarks() {
  state.bookmarks = STORAGE.getBookmarks();
}

function saveBookmarks() {
  STORAGE.setBookmarks(state.bookmarks);
}

function addBookmark(label) {
  const disc = currentDisc();
  if (!disc || !disc.mp3Path) return;
  const key = disc.mp3Path;
  if (!state.bookmarks[key]) state.bookmarks[key] = [];
  state.bookmarks[key].push({ time: audio.currentTime, label: label || `Bookmark @ ${formatTime(audio.currentTime)}` });
  state.bookmarks[key].sort((a, b) => a.time - b.time);
  saveBookmarks();
  renderBookmarks();
  updateScrubberBookmarks();
  showToast('Bookmark added');
}

function renderBookmarks() {
  const disc = currentDisc();
  const key = disc?.mp3Path;
  const bms = key ? (state.bookmarks[key] || []) : [];
  bookmarksCount.textContent = bms.length ? `(${bms.length})` : '';
  bookmarksList.innerHTML = '';
  bms.forEach((bm, i) => {
    const row = document.createElement('div');
    row.className = 'bookmark-item';
    row.innerHTML = `<span class="bookmark-time">${formatTime(bm.time)}</span>
      <span class="bookmark-label">${escapeHtml(bm.label)}</span>
      <button class="bookmark-delete" title="Remove">&#x2715;</button>`;
    row.querySelector('.bookmark-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      state.bookmarks[key].splice(i, 1);
      if (!state.bookmarks[key].length) delete state.bookmarks[key];
      saveBookmarks();
      renderBookmarks();
      updateScrubberBookmarks();
    });
    row.addEventListener('click', () => {
      audio.currentTime = bm.time;
      if (audio.paused) audio.play().catch(() => {});
    });
    bookmarksList.appendChild(row);
  });
}

function updateScrubberBookmarks() {
  const disc = currentDisc();
  const key = disc?.mp3Path;
  const bms = key ? (state.bookmarks[key] || []) : [];
  if (_ovScrubber) _ovScrubber.setBookmarks(bms);
  if (_zmScrubber) _zmScrubber.setBookmarks(bms);
}

document.getElementById('bookmarks-btn').addEventListener('click', () => {
  bookmarksPanel.classList.toggle('hidden');
  queuePanel.classList.add('hidden');
  renderBookmarks();
});
document.getElementById('bookmarks-close').addEventListener('click', () => bookmarksPanel.classList.add('hidden'));

export { loadBookmarks, saveBookmarks, addBookmark, renderBookmarks, updateScrubberBookmarks, registerScrubbers };
