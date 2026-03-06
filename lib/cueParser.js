'use strict';

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

function cueTimeToSeconds(timeStr) {
  const parts = timeStr.split(':').map(Number);
  const [min, sec, frames] = parts;
  return min * 60 + sec + frames / 75;
}

function parseCueFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);

  const tracks = [];
  let currentTrack = null;
  let albumTitle = '';
  let albumPerformer = '';

  for (const line of lines) {
    const trimmed = line.trim();

    const titleMatch = trimmed.match(/^TITLE\s+"(.+)"$/i);
    const performerMatch = trimmed.match(/^PERFORMER\s+"(.+)"$/i);
    const trackMatch = trimmed.match(/^TRACK\s+(\d+)\s+AUDIO$/i);
    const indexMatch = trimmed.match(/^INDEX\s+01\s+(\d+:\d+:\d+)$/i);

    if (trackMatch) {
      if (currentTrack) tracks.push(currentTrack);
      currentTrack = { track: parseInt(trackMatch[1], 10), title: '', performer: '', startSeconds: 0 };
    } else if (titleMatch) {
      if (currentTrack) currentTrack.title = titleMatch[1];
      else albumTitle = titleMatch[1];
    } else if (performerMatch) {
      if (currentTrack) currentTrack.performer = performerMatch[1];
      else albumPerformer = performerMatch[1];
    } else if (indexMatch && currentTrack) {
      currentTrack.startSeconds = cueTimeToSeconds(indexMatch[1]);
    }
  }

  if (currentTrack) tracks.push(currentTrack);

  for (const track of tracks) {
    if (!track.performer && albumPerformer) track.performer = albumPerformer;
  }

  return { albumTitle, albumPerformer, tracks };
}

// Run up to `limit` async tasks concurrently
async function pLimit(tasks, limit) {
  const results = [];
  const queue = [...tasks];
  const active = [];

  while (queue.length > 0 || active.length > 0) {
    while (active.length < limit && queue.length > 0) {
      const task = queue.shift();
      const p = task().then((r) => {
        active.splice(active.indexOf(p), 1);
        results.push(r);
      });
      active.push(p);
    }
    if (active.length > 0) await Promise.race(active);
  }

  return results;
}

async function scanDirAsync(dir) {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (_) {
    return [];
  }

  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  const cueFiles = files.filter((f) => f.toLowerCase().endsWith('.cue'));
  const mp3Files = files.filter((f) => f.toLowerCase().endsWith('.mp3'));

  if (cueFiles.length === 0 && mp3Files.length === 0) return [];

  const pairs = [];

  for (const cueFile of cueFiles) {
    const baseName = path.basename(cueFile, path.extname(cueFile));
    let mp3Match = mp3Files.find(
      (f) => path.basename(f, path.extname(f)).toLowerCase() === baseName.toLowerCase()
    );
    if (!mp3Match) {
      mp3Match = mp3Files.find((f) => f.toLowerCase().includes(baseName.toLowerCase()));
    }

    let cueData;
    try {
      cueData = parseCueFile(path.join(dir, cueFile));
    } catch (_) {
      cueData = { albumTitle: '', albumPerformer: '', tracks: [] };
    }

    pairs.push({
      cueFile,
      mp3File: mp3Match ? path.join(dir, mp3Match) : null,
      albumTitle: cueData.albumTitle || path.basename(dir),
      albumPerformer: cueData.albumPerformer,
      tracks: cueData.tracks,
    });
  }

  for (const mp3File of mp3Files) {
    const alreadyPaired = pairs.some((p) => p.mp3File === path.join(dir, mp3File));
    if (!alreadyPaired) {
      pairs.push({
        cueFile: null,
        mp3File: path.join(dir, mp3File),
        albumTitle: path.basename(mp3File, path.extname(mp3File)),
        albumPerformer: '',
        tracks: [],
      });
    }
  }

  return pairs;
}

async function findCueMp3Pairs(dir) {
  // Scan the dir itself first
  const topPairs = await scanDirAsync(dir);

  // Only recurse one level if the dir itself had no CUE/MP3 files
  // (avoids exploding when pointed at a large root library folder)
  if (topPairs.length > 0) {
    return topPairs;
  }

  // No tracks in root — scan immediate subdirectories in parallel
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (_) {
    return [];
  }

  const subdirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => path.join(dir, e.name))
    .sort();

  // Limit to 50 concurrent reads so we don't hammer a network drive
  const tasks = subdirs.map((sub) => () => scanDirAsync(sub));
  const subResults = await pLimit(tasks, 50);

  return subResults.flat();
}

module.exports = { parseCueFile, findCueMp3Pairs, cueTimeToSeconds };
