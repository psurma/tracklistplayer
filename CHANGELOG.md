# Changelog

## [1.9.2] - 2026-03-08

### Fixed
- Sync test track: button now blurs after click so space bar toggles play/pause correctly; audio.play() now waits for canplay event instead of firing immediately
- Folder sort crash: `localeCompare` was called on plain strings when cached/old data arrived; normalised all entries to `{ name, mtime }` objects before sorting
- Tracklist tab removed from the info pane header (no CUE tracklist available in this context)

### Changed
- Resize handles (between now-playing/waveform and between waveform/info pane) are now 18 px tall with a visible background and border, much easier to grab

## [1.9.1] - 2026-03-08

### Added
- Folder sort toggle in the filter bar: click **A–Z** to switch to **Date** (newest first) and back; preference persisted to localStorage; re-sorts instantly without re-fetching

## [1.9.0] - 2026-03-08

### Added
- Native folder picker: the browse button (📁) next to the directory input opens macOS's native folder chooser dialog via Electron IPC; falls back to a web-based directory browser modal when running outside Electron
- Directory browser modal: navigable directory tree (click to select, double-click row navigates in), favourites list with ★ Save / ✕ remove; click Go to load, click the overlay to dismiss
- Favourite locations: saved to localStorage, always shown at the top of the browser modal
- Sync test track (⏱ toolbar button): loads a 120-second test WAV — a 1 kHz beep every second plus a pitch tone that rises each second; use it to visually verify spectrum ↔ audio alignment by seeking to any position; spectrum shows sharp peaks at each second boundary
- "Load" button renamed to "Go"

### Fixed
- Spectrum hidden → info pane now fills the blank area: when the waveform is toggled off, `#main-top` shrinks to just the now-playing panel so the NFO/Tracklist/artwork pane expands to use all available space; toggling back restores the saved height

## [1.8.6] - 2026-03-08

### Added
- Tracklist tab in the info pane (alongside NFO): shows all tracks from the CUE sheet with track number, title, performer, and start time; click any row to jump to that track; active track is highlighted in accent colour and auto-scrolls into view
- If a disc has no NFO file but does have CUE tracks, the pane opens directly to the Tracklist tab

## [1.8.5] - 2026-03-08

### Fixed
- Spectrum post-seek lag eliminated: replaced direct `waveformRenderer.currentTime` assignment with `waveformRenderer.seekTo(t)` which uses `performance.now()` to extrapolate position with the real-world clock during the window where `audio.currentTime` hasn't caught up yet; once the audio element's reported time converges within 0.3 s of the extrapolated position, the renderer hands back control to `audio.currentTime`

## [1.8.4] - 2026-03-08

### Fixed
- Spectrum desync after seeking: `waveformRenderer.currentTime` is now set immediately at every seek site (seek bar drag, track tick click, seekAndPlay on track switch, prev-button restart-track case) so the waveform snaps to the correct position before the browser updates `audio.currentTime`

### Changed
- Zoom canvas time counter now shows millisecond precision (`m:ss.mmm`) for accurate position reference

## [1.8.3] - 2026-03-08

### Fixed
- Zoom spectrum canvas text (time counter, track numbers, playhead) now uses the `--text` CSS variable instead of hardcoded white, so it is readable in light mode

## [1.8.2] - 2026-03-08

### Fixed
- Zoom canvas drag now scrolls 1:1 with the mouse: anchor time and X position are captured at mousedown and drag offset is computed from those fixed values, eliminating the feedback loop where `currentTime` advanced on each seek call causing runaway speed
- Waveform overview and zoom now instantly reflect position after any seek (clicking a track tick, prev/next, favourites, canvas drag) by writing `waveformRenderer.currentTime` alongside `audio.currentTime` — no more one-frame lag waiting for the RAF loop to pick up the new time

## [1.8.1] - 2026-03-08

### Fixed
- Dragging on either spectrum canvas now seeks live as you drag; previously only a click (mouseup) triggered a seek

## [1.8.0] - 2026-03-08

### Fixed
- Spectrum sync root cause identified and fixed: the previous formula `(b / numBuckets) * audio.duration` scaled decoded bucket positions by `audio.duration`, which for VBR files is often longer than the actual decoded content — causing the waveform to lag behind the playhead by 10–30+ seconds; the correct formula is `b * bucketSecs` (raw decoded time, no scaling), which keeps every bucket pixel-perfect with `audio.currentTime`

### Changed
- Spectrum colours now follow the DJay convention: red = bass, yellow = low-mid, green = high-mid, blue = highs; frequency-weighted hue centre-of-gravity per bucket, with per-track hue rotation still applied on top for track distinction

## [1.7.9] - 2026-03-08

### Fixed
- Seek bar now live-updates the waveform while dragging — `audio.currentTime` is set on every `input` event rather than waiting for `change` (mouse release)

## [1.7.8] - 2026-03-06

### Added
- Album artwork pane: when the NFO viewer is closed, the album art is displayed full-size in the space below the spectrum graphs; it hides automatically when the NFO pane opens

### Fixed
- Spectrum sync: `waveformRenderer.load()` now receives `audio.duration` immediately if the audio element already has it (common when re-loading a cached waveform), so the very first overview render uses the correct duration; added a `durationchange` listener that forces an instant overview re-render whenever the browser refines its duration estimate, eliminating the window where track markers could appear at wrong positions

## [1.7.7] - 2026-03-06

### Fixed
- Spectrum sync overhauled: removed the `timeScale` intermediate value entirely; bucket b now maps directly to audio time `(b / numBuckets) * audioDuration` in both the overview and zoom — this is the same linear mapping used for track markers and the playhead, so bars, markers, hue transitions, and playhead are all guaranteed to be consistent regardless of VBR drift

## [1.7.6] - 2026-03-06

### Changed
- Album artwork in the now-playing pane is now much more visible: blur reduced from 24px to 6px, brightness lifted from 0.28 to 0.55; a subtle gradient overlay (dark top/bottom) keeps text legible over bright cover art

## [1.7.5] - 2026-03-06

### Added
- Shimmering golden stars flank the track title in the now-playing pane whenever the current track is in your favourites; the two stars shimmer out of phase for a glittering effect

## [1.7.4] - 2026-03-06

### Added
- Resize handle above the spectrum graphs (between now-playing art pane and waveform section); height persisted to localStorage

## [1.7.3] - 2026-03-06

### Changed
- Top pane resize handle (between now-playing/waveform and the rest of the window) is now always visible, not only when the NFO pane is open; height is persisted to localStorage as before

## [1.7.2] - 2026-03-06

### Changed
- Spectrum graphs now render each track in a distinct colour: hues are spread using the golden angle (~137.5°) so consecutive tracks are always visually different; bass nudges the colour warmer (−40°) and treble cooler (+40°) within each track's palette; colours fade smoothly into the next track's hue over the final 10 seconds before each track boundary

## [1.7.1] - 2026-03-06

### Fixed
- Restored Spotify track search: a smaller green Spotify icon now appears alongside the SoundCloud button when a track is playing, opening the Spotify search page for the current track; the main Spotify toolbar button still toggles the Liked Songs panel
- Spectrum sync: waveform playhead, played-region overlay, and track markers now use `audio.duration` as the single fractional reference; the zoom view derives bucket-to-audio-time mapping via a `timeScale` factor (`decodedDuration / audioDuration`), eliminating drift between the HTML audio element time and ffmpeg-decoded duration on VBR files

## [1.7.0] - 2026-03-06

### Added
- Spotify in-app playback via Web Playback SDK (requires Spotify Premium)
- Spotify Liked Songs panel: click the Spotify toolbar button to browse all saved tracks; click any track to play it directly inside the app through the Web Playback SDK
- Spotify OAuth flow: enter Client ID and Client Secret in Settings → Spotify, click Connect — Spotify login opens in a new window, tokens are saved to `~/.tracklistplayer/spotify.json` and auto-refreshed on expiry
- New server routes: `/api/spotify/config`, `/api/spotify/credentials`, `/api/spotify/auth-url`, `/auth/spotify/callback`, `/api/spotify/status`, `/api/spotify/refresh`, `/api/spotify/liked`, `/api/spotify/disconnect`
- Spotify toolbar button now always visible and toggles the Liked Songs panel; playing a Spotify track highlights it in the list and pauses any local MP3 playback

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
