# Changelog

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
