import { escapeHtml } from './helpers.js';

const libraryModalOverlay = document.getElementById('library-modal-overlay');
const libraryFolderList   = document.getElementById('library-folder-list');
const libraryBtn          = document.getElementById('library-btn');
const libraryModalClose   = document.getElementById('library-modal-close');
const libraryAddBtn       = document.getElementById('library-add-btn');

let libraryFolders = [];

// Registration pattern
let _invalidateIndex = null;

function registerDeps(deps) {
  if (deps.invalidateIndex) _invalidateIndex = deps.invalidateIndex;
}

function getLibraryFolders() { return libraryFolders; }

async function loadLibrary() {
  try {
    const res = await fetch('/api/library');
    const data = await res.json();
    libraryFolders = data.folders || [];
  } catch (_) {
    libraryFolders = [];
  }
}

function renderLibraryList() {
  libraryFolderList.innerHTML = '';
  if (!libraryFolders.length) {
    libraryFolderList.innerHTML = '<div class="library-empty-msg">No folders in library yet.<br>Click "+ Add Folder" to get started.</div>';
    return;
  }
  for (const folder of libraryFolders) {
    const item = document.createElement('div');
    item.className = 'library-folder-item';
    const name = folder.split('/').filter(Boolean).pop() || folder;
    item.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="library-folder-name">${escapeHtml(name)}</div>
        <div class="library-folder-path">${escapeHtml(folder)}</div>
      </div>
      <button class="library-folder-remove" title="Remove from library">&#x2715;</button>
    `;
    item.querySelector('.library-folder-remove').addEventListener('click', async () => {
      await fetch('/api/library', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder }) });
      libraryFolders = libraryFolders.filter((f) => f !== folder);
      if (_invalidateIndex) _invalidateIndex();
      renderLibraryList();
    });
    libraryFolderList.appendChild(item);
  }
}

async function openLibraryModal() {
  await loadLibrary();
  renderLibraryList();
  libraryModalOverlay.classList.add('active');
  libraryBtn.classList.add('active');
}

function closeLibraryModal() {
  libraryModalOverlay.classList.remove('active');
  libraryBtn.classList.remove('active');
}

libraryBtn.addEventListener('click', () => {
  if (libraryModalOverlay.classList.contains('active')) closeLibraryModal();
  else openLibraryModal();
});
libraryModalClose.addEventListener('click', closeLibraryModal);
libraryModalOverlay.addEventListener('click', (e) => { if (e.target === libraryModalOverlay) closeLibraryModal(); });

libraryAddBtn.addEventListener('click', async () => {
  let folder = null;
  if (window.electronAPI?.pickDirectory) {
    folder = await window.electronAPI.pickDirectory();
  } else {
    folder = prompt('Enter folder path:');
  }
  if (!folder) return;
  const res = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder }) });
  const data = await res.json();
  libraryFolders = data.folders || [];
  if (_invalidateIndex) _invalidateIndex();
  renderLibraryList();
});

export { loadLibrary, getLibraryFolders, openLibraryModal, closeLibraryModal, registerDeps };
