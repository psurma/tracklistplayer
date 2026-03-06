# Changelog

## [1.2.0] - 2026-03-06

### Added
- DJay-style waveform display: colorful overview (full track) + 30-second zoom view with scrolling playhead
  - Server-side analysis via ffmpeg: decodes MP3 to mono 2kHz PCM, computes per-bucket amplitude and bass/mid/high frequency energy
  - Frequency colour mapping: bass→red, mids→green, highs→blue (blended per bucket)
  - Track boundary markers with track numbers on the zoom view
  - Click either canvas to seek
  - Waveform data cached in memory (no re-analysis on replay)
- Electron window state persistence: size, position and maximized state saved across sessions
- Traffic lights no longer overlap the directory input (padding + `trafficLightPosition`)

## [1.1.1] - 2026-03-06

### Added
- SoundCloud search button alongside Spotify (opens `soundcloud.com/search`)
- Electron window draggable from any blank area in the main panel

## [1.1.0] - 2026-03-06

### Added
- Electron wrapper: run as a standalone desktop app via `npm run electron`
  - Server starts in-process; no terminal needed
  - Prevents accidental refresh/navigation
  - Global media key handlers (play/pause, next, prev)
  - External links (Spotify) open in default browser
- Keyboard shortcuts: Space = play/pause, Left arrow = prev track, Right arrow = next track
- Playback state persistence: position, disc and track index restored on relaunch
- NFO pane highlights the currently playing track title (green accent mark, auto-scrolls to it)

## [1.0.0] - 2026-03-05

### Initial release
- CUE/MP3 pair detection and parsing
- Real-time track detection via timeupdate
- Split-pane sidebar: folder browser + track list
- Resizable sidebar and panel heights, persisted to localStorage
- Filter bar with yellow highlight matches
- Sidebar collapse toggle
- Light/dark theme toggle, persisted
- Favorites (star) per track, persisted
- NFO viewer with CP437 decoding and MorePerfectDOSVGA font
- Spotify search button for current track
- Show in Finder button
- Full-width footer player controls
