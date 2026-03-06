# Tracklist Player

A desktop MP3 player for DJ mixes that reads CUE sheet files to show you exactly which track is playing in real time.

![screenshot](https://github.com/psurma/tracklistplayer/assets/screenshot.png)

## Features

- **Real-time track detection** — reads `.cue` files and highlights the current track as the mix plays
- **Folder browser** — navigate your music library, filter by name
- **Spotify search** — one click to search for the current track on Spotify
- **NFO viewer** — reads `.nfo` files with correct CP437 (DOS) encoding and the MorePerfectDOSVGA font; highlights the currently playing track title in the text
- **Show in Finder** — reveals the MP3 file in macOS Finder
- **Favorites** — star tracks to mark them
- **Playback persistence** — remembers your position across sessions
- **Keyboard shortcuts** — `Space` play/pause, `←` prev track, `→` next track, plus media keys
- **Light/dark theme** — persisted per session
- **Resizable panels** — sidebar width and split-pane height both draggable and remembered
- **Electron desktop app** — runs as a native macOS app, no terminal needed

## Requirements

- [Node.js](https://nodejs.org) 18+
- macOS (Finder integration and `open -R` are macOS-specific; the web UI works on any OS)

## Install

```bash
git clone https://github.com/psurma/tracklistplayer.git
cd tracklistplayer
npm install
```

## Run

### As an Electron desktop app (recommended)

```bash
npm run electron
```

Or pass a directory to auto-load on launch:

```bash
npm run electron -- /Volumes/Music/VA_-_Mellomania_Vol.04
```

### As a web app in the browser

```bash
node server.js /path/to/music
```

Then open [http://localhost:3123](http://localhost:3123).

## How it works

Point it at a folder containing `.mp3` + `.cue` file pairs (or a parent folder with subdirectories of them). The CUE file contains precise timestamps (`MM:SS:FF`) for each track. As the mix plays, the app compares the audio `currentTime` against those timestamps to determine the current track and update the display.

## Music library structure

The scanner handles two layouts:

```
/music/
  mix.mp3
  mix.cue          ← flat: MP3+CUE in the same directory

/music/
  Mellomania_CD1/
    cd1.mp3
    cd1.cue        ← nested: one subfolder per disc
  Mellomania_CD2/
    cd2.mp3
    cd2.cue
```

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / pause |
| `←` | Previous track (or restart if > 3 s in) |
| `→` | Next track |
| Media Play/Pause | Play / pause (global, works in background) |
| Media Previous | Previous track (global) |
| Media Next | Next track (global) |

## Build a distributable macOS app

```bash
npm run build
```

Output goes to `dist/`. Produces a `.dmg` for both Apple Silicon and Intel.

## Tech stack

- **Backend**: Node.js + Express — serves files with HTTP range request support for seeking
- **Frontend**: Vanilla HTML/CSS/JS — no framework
- **Desktop**: Electron
- **Tests**: Playwright
