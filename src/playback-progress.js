import { state, STORAGE } from './state.js';
import { formatTime, currentDisc } from './helpers.js';
import { audio } from './dom-refs.js';

function saveDiscProgress() {
  const disc = currentDisc();
  if (!disc || !disc.mp3Path || !isFinite(audio.duration)) return;
  const prog = STORAGE.getDiscProgress();
  prog[disc.mp3Path] = {
    position: audio.currentTime,
    duration: audio.duration,
    trackIdx: state.currentTrackIndex,
    ts: Date.now(),
  };
  const keys = Object.keys(prog);
  if (keys.length > 200) {
    keys.sort((a, b) => prog[a].ts - prog[b].ts);
    keys.slice(0, keys.length - 200).forEach((k) => delete prog[k]);
  }
  STORAGE.setDiscProgress(prog);
}

function getDiscProgress(mp3Path) {
  const prog = STORAGE.getDiscProgress();
  return prog[mp3Path] || null;
}

function showResumeBanner(disc, progress) {
  const existing = document.getElementById('resume-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'resume-banner';
  banner.innerHTML = `Resume from ${formatTime(progress.position)}?
    <button class="primary" id="resume-yes">Resume</button>
    <button id="resume-no">Start Over</button>`;
  document.body.appendChild(banner);
  document.getElementById('resume-yes').addEventListener('click', () => {
    audio.currentTime = progress.position;
    audio.play().catch(() => {});
    banner.remove();
  });
  document.getElementById('resume-no').addEventListener('click', () => {
    audio.play().catch(() => {});
    banner.remove();
  });
  setTimeout(() => { if (banner.parentNode) banner.remove(); }, 10000);
}

export { saveDiscProgress, getDiscProgress, showResumeBanner };
