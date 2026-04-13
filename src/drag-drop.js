import { state } from './state.js';
import { audio } from './dom-refs.js';
import { loadDisc } from './playback.js';
import { renderDiscList } from './disc-list.js';
import { loadScrapedTracklist } from './tracklist-finder.js';

const dropOverlay = document.getElementById('drop-overlay');
let dragEnterCount = 0;

document.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
  dragEnterCount++;
  dropOverlay.classList.add('active');
});

document.addEventListener('dragleave', () => {
  dragEnterCount = Math.max(0, dragEnterCount - 1);
  if (dragEnterCount === 0) dropOverlay.classList.remove('active');
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragEnterCount = 0;
  dropOverlay.classList.remove('active');

  const mp3s = [...(e.dataTransfer?.files || [])].filter((f) =>
    f.name.toLowerCase().endsWith('.mp3')
  );
  if (mp3s.length) loadDroppedFiles(mp3s);
});

function loadDroppedFiles(files) {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
  const DROP_ID_BASE = 90000;

  // Revoke any previous blob URLs to free memory
  state.discs.forEach((d) => { if (d.blobUrl) URL.revokeObjectURL(d.blobUrl); });

  const newDiscs = sorted.map((file, i) => {
    const absPath = file.path || null;
    return {
      id: DROP_ID_BASE + i,
      mp3Path: absPath,
      mp3File: file.name,
      blobUrl: absPath ? null : URL.createObjectURL(file),
      cueFile: null,
      albumTitle: file.name.replace(/\.mp3$/i, ''),
      albumPerformer: '',
      tracks: [],
    };
  });

  state.discs = newDiscs;
  for (const disc of state.discs) loadScrapedTracklist(disc);
  renderDiscList();

  const first = newDiscs[0];
  if (!first) return;
  loadDisc(first);
  audio.addEventListener('canplay', function p() {
    audio.removeEventListener('canplay', p);
    audio.play().catch(() => {});
  });
}
