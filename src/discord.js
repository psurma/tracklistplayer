import { audio } from './dom-refs.js';

function updateDiscordPresence(disc, trackIdx) {
  if (!window.electronAPI?.updateDiscordPresence) return;
  const t = disc?.tracks?.[trackIdx];
  window.electronAPI.updateDiscordPresence({
    track: t?.title || disc?.albumTitle || '',
    artist: t?.performer || disc?.albumPerformer || '',
    mix: disc?.albumTitle || '',
    playing: !audio.paused,
    elapsed: audio.currentTime,
  });
}

export { updateDiscordPresence };
