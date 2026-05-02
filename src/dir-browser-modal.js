import { escapeHtml } from './helpers.js';
import { dirInput } from './dom-refs.js';

const dirModal        = document.getElementById('dir-modal-overlay');
const dirModalEntries = document.getElementById('dir-modal-entries');
const dirFavList      = document.getElementById('dir-fav-list');
const dirModalFavsSection = document.getElementById('dir-modal-favourites');
const dirModalCwd     = document.getElementById('dir-modal-cwd');
const dirModalSelected = document.getElementById('dir-modal-selected');
const dirBrowseBtn    = document.getElementById('dir-browse-btn');

let dirModalPath = '';

const DIR_FAVS_KEY = 'tlp_dir_favs';
function getDirFavs() { try { return JSON.parse(localStorage.getItem(DIR_FAVS_KEY) || '[]'); } catch (_) { return []; } }
function saveDirFavs(favs) { localStorage.setItem(DIR_FAVS_KEY, JSON.stringify(favs)); }

// Registration pattern
let _loadRoot = null;
let _normEntry = null;

function registerDeps(deps) {
  _loadRoot = deps.loadRoot;
  _normEntry = deps.normEntry;
}

function normEntryFallback(e) {
  if (_normEntry) return _normEntry(e);
  return typeof e === 'string' ? { name: e, mtime: 0 } : e;
}

function renderDirFavs() {
  const favs = getDirFavs();
  dirModalFavsSection.classList.toggle('hidden', favs.length === 0);
  dirFavList.innerHTML = favs.map((f, i) => `
    <div class="dir-fav-item${f === dirModalPath ? ' selected' : ''}" data-path="${escapeHtml(f)}" data-idx="${i}">
      <span class="dir-entry-icon">&#9733;</span>
      <span>${escapeHtml(f.split('/').pop() || f)}</span>
      <button class="dir-fav-remove" data-idx="${i}" title="Remove">&#x2715;</button>
    </div>`).join('');
}

async function browseDir(dir) {
  dirModalCwd.textContent = dir || '(home)';
  try {
    const url = dir ? `/api/ls?dir=${encodeURIComponent(dir)}` : '/api/ls';
    const res = await fetch(url);
    if (!res.ok) throw new Error('ls failed');
    const { parent, subdirs, dir: resolvedDir } = await res.json();
    if (resolvedDir && resolvedDir !== dir) dirModalCwd.textContent = resolvedDir;
    dir = resolvedDir || dir;
    let html = '';
    if (parent) html += `<div class="dir-entry dir-entry-up" data-path="${escapeHtml(parent)}"><span class="dir-entry-icon">&#x2191;</span> ..</div>`;
    const sorted = (subdirs || []).map(normEntryFallback).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    html += sorted.map((d) => {
      const p = `${dir}/${d.name}`;
      return `<div class="dir-entry${p === dirModalPath ? ' selected' : ''}" data-path="${escapeHtml(p)}"><span class="dir-entry-icon">&#128193;</span>${escapeHtml(d.name)}</div>`;
    }).join('');
    dirModalEntries.innerHTML = html || '<div style="padding:8px 16px;font-size:12px;color:var(--text-muted)">No subfolders</div>';
  } catch (_) {
    dirModalEntries.innerHTML = '<div style="padding:8px 16px;font-size:12px;color:var(--text-muted)">Cannot read directory</div>';
  }
  renderDirFavs();
}

function selectDirPath(p) {
  dirModalPath = p;
  dirModalSelected.textContent = p;
  dirModalEntries.querySelectorAll('.dir-entry').forEach((el) => el.classList.toggle('selected', el.dataset.path === p));
  dirFavList.querySelectorAll('.dir-fav-item').forEach((el) => el.classList.toggle('selected', el.dataset.path === p));
}

async function openDirModal(startDir) {
  // Empty string => server defaults to $HOME (avoids the old '/' which now 403s).
  const dir = startDir || dirInput.value.trim() || getDirFavs()[0] || '';
  dirModalPath = dir;
  dirModalSelected.textContent = dir || '(home)';
  dirModal.classList.remove('hidden');
  await browseDir(dir);
}

dirModal.addEventListener('click', async (e) => {
  const entry = e.target.closest('.dir-entry');
  if (entry) { selectDirPath(entry.dataset.path); await browseDir(entry.dataset.path); return; }
  const fav = e.target.closest('.dir-fav-item');
  if (fav && !e.target.closest('.dir-fav-remove')) { selectDirPath(fav.dataset.path); await browseDir(fav.dataset.path); return; }
  const rm = e.target.closest('.dir-fav-remove');
  if (rm) {
    const favs = getDirFavs();
    favs.splice(parseInt(rm.dataset.idx, 10), 1);
    saveDirFavs(favs);
    renderDirFavs();
    return;
  }
  if (e.target === dirModal) dirModal.classList.add('hidden');
});

document.getElementById('dir-modal-close').addEventListener('click', () => dirModal.classList.add('hidden'));

document.getElementById('dir-modal-add-fav').addEventListener('click', () => {
  if (!dirModalPath) return;
  const favs = getDirFavs();
  if (!favs.includes(dirModalPath)) { favs.push(dirModalPath); saveDirFavs(favs); }
  renderDirFavs();
});

document.getElementById('dir-modal-go').addEventListener('click', () => {
  if (!dirModalPath) return;
  dirModal.classList.add('hidden');
  dirInput.value = dirModalPath;
  if (_loadRoot) _loadRoot(dirModalPath);
});

dirBrowseBtn.addEventListener('click', async () => {
  if (window.electronAPI && window.electronAPI.pickDirectory) {
    const picked = await window.electronAPI.pickDirectory();
    if (picked) { dirInput.value = picked; if (_loadRoot) _loadRoot(picked); }
  } else {
    openDirModal();
  }
});

dirInput.addEventListener('dblclick', () => openDirModal());

export { openDirModal, browseDir, getDirFavs, saveDirFavs, registerDeps };
