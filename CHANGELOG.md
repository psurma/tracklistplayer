# Changelog

## [1.6.4] - 2026-03-06

### Fixed
- Spectrum overview sync: waveform bars, playhead, and track markers now all use the ffmpeg-decoded duration (numBuckets × bucketSecs) as a single shared timescale, eliminating drift on VBR files where audio.duration differs from the actual decoded content length; overview click-to-seek updated to match

## [1.6.3] - 2026-03-06

### Fixed
- Scrubber track labels now adapt to window width: labels that would overlap are hidden, and visibility recalculates on every resize so the maximum number of non-overlapping labels is always shown

## [1.6.2] - 2026-03-06

### Added
- Clicking a scrubber tick or its label jumps to that track and starts playback

### Fixed
- Spectrum display now correctly re-renders when toggled back on (canvas cache was holding stale 0×0 dimensions from when the section was hidden)

## [1.6.1] - 2026-03-06

### Added
- Track name labels on the scrubber: each track boundary tick now shows the track number and title, alternating above and below the seek bar; toggle via Settings → Scrubber Track Labels

### Fixed
- Spectrum toggle button now re-renders the waveform canvases after un-hiding (canvases had zero dimensions while hidden, so the first paint was blank)
- Spotify and SoundCloud toolbar brand colors now correctly override the generic toolbar style (specificity fix)
- Space bar no longer captured when focus is on select or contenteditable elements

## [1.6.0] - 2026-03-06

### Added
- Settings modal (⚙ toolbar icon): theme, spectrum analyser on/off, spectrum resolution (Detailed/Normal/Fast), default volume, repeat mode (Off/All/One), and shuffle — all persisted to localStorage and restored on relaunch
- Spectrum resolution configurable: bucket sizes of 25 ms (Detailed), 50 ms (Normal), or 100 ms (Fast); server caches waveform data per-resolution so switching is instant on replay
- Default volume, repeat mode, and shuffle now persist across sessions

## [1.5.1] - 2026-03-06

### Changed
- Toolbar icons enlarged (36×36, brand icons 38×38): Spotify uses the real logo SVG on a green circle, SoundCloud uses its logo SVG on an orange rounded square; search replaced with a magnifying-glass SVG
- Track number moved inline beside album/mix title in now-playing panel
- Disc list section headers larger (12px, bold, full text colour) with performer in dimmer secondary style

## [1.5.0] - 2026-03-06

### Added
- Starred tracks panel (★ toolbar icon): lists all favourited tracks grouped by album, click to play, click ★ to unstar; favourites now store full track metadata (title, artist, album, position) so the panel works without re-scanning
- MusicBrainz Cover Art Archive fallback: when no local image exists and no embedded art is found, queries MusicBrainz by folder name to fetch album artwork

### Changed
- Toolbar buttons are now uniform 30×30 icon buttons (no text labels): ♫ Spotify, ☁ SoundCloud, ⌘ Finder, ☰ NFO, ★ Starred, ⌕ Search, ☀/☾ Theme, ≋ Spectrum — large pill buttons removed from now-playing panel
- Album/mix title is now the prominent headline in now-playing; track number reduced to a small accent label
- Spectrum sync improved: overview playhead now uses live `audio.duration` (corrects VBR drift); bucket size halved to 50 ms for sharper time resolution

### Fixed
- Session restore now remembers the active subfolder and filter text, not just the root directory
- Window drag restored: only specific text fields are no-drag, blank areas of now-playing are draggable again

## [1.4.1] - 2026-03-06

### Added
- Full session restore on relaunch: remembers the active subfolder (disc list context), filter text, and playback position — restores all three on next launch without re-scanning root

### Fixed
- Now-playing layout: album/mix title is now the prominent headline (17px bold); track number reduced to a small accent label above the track title; no longer dominated by a giant "02"
- Window dragging restored: `#now-playing` blank area is draggable again; only the individual text fields (disc, title, artist) are no-drag for text selection

## [1.4.0] - 2026-03-06

### Added
- Collection search panel (Search button in toolbar): recursively indexes entire music root on first open, then instant client-side filtering as you type across artist, album title, track title, and release year; results grouped by album with highlighted matches; click any result to navigate directly to that track

## [1.3.2] - 2026-03-06

### Added
- Album artwork backdrop: when a disc loads, art is sourced from folder images (cover.jpg/png, folder.jpg, front.jpg, etc.) or extracted from MP3 ID3 tags via ffmpeg, then displayed as a blurred, darkened background behind the now-playing panel

### Fixed
- Spectrum colours: switched from RGB with additive bleed (causing white/purple) to HSL — hue now maps bass→orange/warm, treble→cyan/cool; never blows out to white

## [1.3.1] - 2026-03-06

### Fixed
- Double-clicking a folder with no CUE tracks (raw MP3 only) now begins playback immediately

## [1.2.1] - 2026-03-06

### Added
- Mini player button (⊖ in toolbar): collapses window to 80 px showing only controls + seek bar + current track info; floats on top; ⊞ restores full view

### Fixed
- Waveform scroll choppiness: replaced timeupdate-driven updates (4 fps) with a dedicated 60 fps requestAnimationFrame loop reading audio.currentTime directly
- Canvas dimensions now cached between frames (no per-frame getBoundingClientRect)
- Overview redraws only when playhead moves >1 s; zoom canvas redraws every frame for smooth scrolling

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
