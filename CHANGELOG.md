# Changelog

## [1.21.0] - 2026-04-13

### Changed
- **Server modularization**: split server.js (1,867 lines) into 9 Express Router modules in `routes/` plus shared helpers in `lib/helpers.js` and `lib/oauth.js`. server.js is now 64 lines of setup and route registration.
- **Frontend modularization**: split app.js (4,717 lines) into 26 ES modules in `src/` bundled with esbuild. Modules organized by feature domain (playback, spotify, soundcloud, lastfm, search, favorites, bookmarks, queue, layout, settings, etc.).
- **Build system**: added esbuild for frontend bundling (`npm run build:js`, `npm run watch:js`). Bundle output: public/app.bundle.js (190kb).

### Server route modules
- `routes/library.js` -- library CRUD + index
- `routes/spotify.js` -- Spotify OAuth + API proxy
- `routes/soundcloud.js` -- SoundCloud OAuth + streaming
- `routes/lastfm.js` -- Last.fm auth + scrobbling
- `routes/files.js` -- scan, ls, nfo, file streaming
- `routes/waveform.js` -- waveform analysis, transition detection
- `routes/music-index.js` -- recursive indexing + artwork
- `routes/tracklist.js` -- MixesDB scraping
- `routes/favorites.js` -- favorites persistence + audio decode

## [1.20.0] - 2026-04-13

### Security
- **Origin guard**: API requests from non-localhost origins are now blocked, preventing cross-origin CSRF attacks
- **Security headers**: added helmet middleware (CSP, X-Content-Type-Options, X-Frame-Options, etc.)
- **POST for state changes**: disconnect and token-refresh endpoints now require POST (prevents `<img>` tag / prefetch attacks)
- **SoundCloud stream ID validation**: `/api/soundcloud/stream/:id` now rejects non-numeric IDs
- **Last.fm CSRF protection**: callback now requires a pending auth flow initiated by the app
- **Error message sanitization**: filesystem error responses no longer leak internal paths
- **Dependency audit**: resolved all npm audit vulnerabilities (0 remaining)
- **Removed unused `cors` dependency**

### Fixed
- **Async file I/O**: `/file` endpoint and favorites persistence now use non-blocking `fs.promises` instead of sync I/O
- **CUE parser async**: `parseCueFile` converted from `fs.readFileSync` to `fs.promises.readFile`
- **Dead code**: removed redundant ternary in Spotify track rendering, removed duplicate `formatTimeShort` function
- **Stale cache-bust versions**: script tags in index.html now match package.json version
- **Waveform loop**: scrubber `tick()` skips redundant redraws when audio time hasn't changed (reduces idle CPU)
- **Cache eviction**: all in-memory caches now have max-size limits (BoundedMap) to prevent unbounded memory growth
- **Token refresh logging**: auth token refresh failures are now logged instead of silently swallowed
- **Index scan logging**: directory read failures during indexing are now logged

### Changed
- **Media keys via IPC**: Electron media key handlers now use IPC messages instead of `executeJavaScript`, following Electron security best practices
- **Shared PATH env**: extracted `SPAWN_ENV` to `lib/env.js`, shared between server and Electron main process
- **SoundCloud track rendering**: deduplicated into shared `createSoundcloudTrackEl()` helper
- **Audio input config**: preferred audio input device now read from `~/.tracklistplayer/audio-settings.json` instead of hardcoded

## [1.19.3] - 2026-04-07

### Added
- **Expand/collapse tracklist**: click any album header in the sidebar to expand or collapse its tracks
- Expand-all and collapse-all buttons in the filter bar for quick toggling of all albums
- Visual arrow indicator on album headers showing expand/collapse state
- **Expand/collapse lower pane**: arrow button in the NFO/tracklist pane header to toggle between full-height and normal view
- **Maximize/minimize sidebar panels**: arrow buttons on the panel resize bar to maximize the tracklist or folder browser; double-click to reset to default split

### Fixed
- **Graceful error handling**: EIO/ENOENT/EPERM errors (e.g. external drive disconnects) are now caught and logged instead of crashing the app; other uncaught exceptions show a non-fatal warning dialog

## [1.19.2] - 2026-04-02

### Fixed
- **Favourites resilience**: favourites now saved to disk (`~/.tracklistplayer/favorites.json`) in addition to localStorage
- On load, merges localStorage + localStorage backup + server file — the union of all sources, so entries are never lost
- Server keeps up to 20 timestamped backup files in `~/.tracklistplayer/favorites_backups/`
- Empty-save guard on both client and server: refuses to overwrite non-empty data with an empty array
- localStorage backup copy (`tlp_favorites_backup`) kept as additional safety net

## [1.19.1] - 2026-04-01

### Fixed
- **Toolbar layout**: toolbar buttons no longer overlap album title text; moved from absolute positioning to a proper flex row layout
- Reduced toolbar button size (36px -> 30px) for a cleaner, more compact look
- Toolbar wraps gracefully on smaller windows instead of overflowing

## [1.19.0] - 2026-03-28

### Added
- **Sleep Timer**: countdown timer (15/30/45/60/90 min presets) that pauses playback when it expires
- **Keyboard Shortcuts**: expanded shortcuts (J/L seek, Shift+arrows volume, M mute, F star, B bookmark, Q queue, 1-9 jump to track, ? help overlay)
- **Tracklist Export**: copy tracklist as text or download as M3U file
- **Play Queue / Up Next**: queue tracks from any mix, plays before auto-advancing; queue panel with reorder/remove
- **3-Band EQ**: low shelf (200Hz), peaking mid (1kHz), high shelf (8kHz) via Web Audio BiquadFilterNodes; persisted settings
- **Timestamped Bookmarks**: mark moments in a mix with B key, rendered as red markers on waveform; bookmarks panel to manage
- **Playback Progress Per Mix**: remembers position for each mix, shows progress bars on disc headers, offers resume prompt
- **Last.fm Scrobbling**: full auth flow, scrobbles individual tracks from CUE-detected boundaries (30s/50% rule), now-playing updates
- **Save to Spotify Playlist**: per-track save button, searches Spotify for matching track, pick target playlist
- **Discord Rich Presence**: shows current track/artist/mix in Discord status (Electron only, requires discord-rpc)
- Audio decode endpoint (`GET /api/decode`) for future BPM detection
- Added `playlist-modify-public` and `playlist-modify-private` to Spotify OAuth scopes

## [1.18.2] - 2026-03-24

### Added
- On macOS, when playback starts, automatically switches audio input away from AirPods Max back to the preferred input device (Elgato Wave:3). Requires `SwitchAudioSource` installed via `brew install switchaudio-osx`; silently skips if not present.

## [1.18.1] - 2026-03-23

### Fixed
- Spectrum graphs failed to load in the packaged Electron app because macOS gives bundled apps a minimal PATH that excludes Homebrew (`/opt/homebrew/bin`). All `ffmpeg` spawns now explicitly augment the process PATH with `/opt/homebrew/bin` and `/usr/local/bin`.

## [1.18.0] - 2026-03-20

### Security
- Fixed path traversal: `/api/ls` and `/api/ls-stream` now canonicalise the `dir` parameter via `path.resolve()` to prevent `../..` bypass
- Fixed path traversal: `/api/index` and `/api/index-stream` now validate the `root` parameter against library roots via `resolveAndValidate()`
- Fixed potential `javascript:` URI injection in `renderStreamInfo` — `pageUrl` is now checked for an `https?://` scheme before being rendered as a link
- Replaced inline `escFn` in `renderStreamInfo` with the top-level `escapeHtml` to eliminate a third duplicate implementation

### Fixed
- OAuth state maps (`pendingSpotifyStates`, `pendingSoundcloudStates`) are now purged of expired entries every 15 minutes to prevent unbounded memory growth
- `state.favorites` initial value corrected from `new Set()` to `new Map()` to match its actual runtime type
- Two separate `click` listeners on `settingsOverlay` merged into one handler
- `loadScrapedTracklist` moved out of `renderDiscList` (render-time mutation) into the two sites where `state.discs` is assigned
- Active track DOM reference cached in `_activeTrackEl`; `updateTrackProgress` no longer queries the DOM on every `timeupdate` event
- Removed duplicate `AUDIO_EXTS` constant; `hasMusic()` now uses the top-level `AUDIO_FILE_EXTS`

### Changed
- `readLibrary()` now caches the library in memory; `writeLibrary()` updates the cache inline — eliminates repeated synchronous disk reads on every API request
- `require('child_process')` and `require('https')` moved to top-level imports in `server.js`
- Token refresh boilerplate (9 occurrences across Spotify and SoundCloud routes) consolidated into `ensureFreshToken(config, refreshFn)` helper

## [1.17.11] - 2026-03-19

### Added
- Filter input now remembers up to 30 previously used search strings; press Up/Down arrows to navigate history. Strings are saved to localStorage on Enter.
- macOS app icon (purple waveform bars on dark background) added to `build/icon.icns`

## [1.17.10] - 2026-03-16

### Fixed
- Zoom waveform no longer drifts out of sync with audio playback; removed the seek-smoothing mechanism (`_seekActive`) whose wall-clock elapsed timer could permanently desync from `audio.currentTime` if the browser took >300 ms to process a seek (rebuffering). `tick()` now uses `audio.currentTime` directly, and `seekTo()` immediately re-centres the zoom viewport.

## [1.17.9] - 2026-03-16

### Changed
- Played region of both waveform canvases is now significantly darker (dark mode: 65% black overlay, light mode: 40% black overlay) to make the played/unplayed split clearly visible

## [1.17.8] - 2026-03-16

### Fixed
- Star firework particles now originate from the actual star pseudo-elements (using Range API on the text node) instead of the full-width block container edges
- Beat detection for fireworks now uses onset detection (peak must exceed trailing 8-bucket average by 30%), lowers the loudness threshold to 180/255, and shortens the cooldown to 350 ms so more beats trigger effects

## [1.17.7] - 2026-03-16

### Added
- Starred tracks emit a small gold/orange firework burst from each star on loud waveform peaks (peak > 210/255, max once per 800 ms)

## [1.17.6] - 2026-03-16

### Changed
- Favourite stars in the now-playing header now slowly rotate (one clockwise, one counter-clockwise) in addition to the gold shimmer

## [1.17.5] - 2026-03-16

### Fixed
- Starring a track now immediately updates the shimmer stars in the now-playing header without requiring the track to be reselected
- Favourite stars in the header are now larger (28px) with correct vertical alignment

## [1.17.4] - 2026-03-14

### Fixed
- Waveform canvases now respect the active theme: light mode uses a white background with dark text/ticks, pale tinted track sections, and darker waveform bars; dark mode behaviour unchanged

## [1.17.3] - 2026-03-14

### Changed
- Zoom canvas: replaced footer zoom slider with Cmd+drag-to-zoom on the waveform itself — drag right to zoom in, drag left to zoom out; regular drag still pans, click still seeks

## [1.17.2] - 2026-03-14

### Added
- NFO tracks with per-track durations are now **automatically applied** to the waveform scrubber when a disc has no CUE sheet — no clicking required; cumulative start times are calculated from the NFO duration column and persisted to localStorage

## [1.17.1] - 2026-03-14

### Fixed
- NFO track parsing now matches space-separated formats (`1  Artist - Title  4:03`) in addition to the existing dot/paren formats (`1. title`, `1) title`)
- Trailing duration strings (e.g. `4:03`, `1:22:05`) are now stripped from parsed track titles
- Multi-disc NFOs with `Disc 1/2` / `Disc 2/2` sections are now handled: the correct disc's track list is extracted based on the active MP3 filename (detects `cd1`/`cd2`, `disc1`/`disc2`, and `1XX-`/`2XX-` prefixes)
- Re-parses NFO for the correct disc section when switching between discs in the same directory

## [1.17.0] - 2026-03-14

### Changed
- **Dual FancyScrubber layout**: restored the original two-canvas waveform layout (overview on top, zoom below) replacing the single-canvas design
  - Overview canvas (`#wf-overview`, 50px): always shows the full track, no ruler, colour-coded sections, click to seek — playhead is a simple vertical line
  - Zoom canvas (`#wf-zoom`, 110px): shows a configurable time window, has the time ruler, auto-scrolls keeping the playhead centred
- **FancyScrubber** now accepts an `opts` parameter (`showRuler`, `centerPlayhead`) to support both canvas modes from the same class
- **Zoom control moved to footer** (`#volume-row`): the Zoom range slider is now inline in the footer bar next to the volume slider
- **Waveform resize handles** restored: drag the mid handle to resize the overview height, drag the bottom handle to resize the zoom height; sizes are persisted in `localStorage`

## [1.16.0] - 2026-03-13

### Added
- **Fancy scrubber** (`FancyScrubber` class in `public/fancy-scrubber.js`): replaces the dual-canvas waveform (overview + 30-second zoom) with a single ElevenLabs-style timeline scrubber
  - Time ruler at top with major/minor tick marks and time labels
  - Colour-coded track sections (one hue per track, golden-angle spacing) spanning the full track duration
  - Waveform bars (bass/mids/highs) drawn symmetrically inside each track section
  - Floating playhead pill showing the current time in M:SS format
  - Auto-scrolls to keep the playhead at ~30% from the left edge during playback
  - Click or drag anywhere on the scrubber to seek
  - Touch support for mobile/tablet
  - DPR-correct canvas rendering via ResizeObserver
- **Zoom slider** (`#zoom-slider`): `<input type="range">` below the scrubber with exponential mapping; drag right to zoom in (fewer seconds visible), drag left to see the full track
- Zoom resets to full-track view whenever a new waveform loads

## [1.15.8] - 2026-03-12

### Security
- **H1 (Path Traversal)**: All file-serving endpoints (`/file`, `/api/artwork`, `/api/waveform`, `/api/detect-transitions`, `/api/nfo`, `/api/scan`, `/api/reveal`) now validate that the requested path falls within a registered library root using `resolveAndValidate()`; arbitrary filesystem reads are rejected with 400
- **H1**: `/file` endpoint now also enforces an audio file extension whitelist (`.mp3 .flac .m4a .aac .ogg .wav .opus .wma .cue`)
- **H2 (SSRF)**: `/api/soundcloud/liked` now validates that the `next_href` cursor starts with `https://api.soundcloud.com/` before forwarding the request
- **M1**: Express server now binds to `127.0.0.1` instead of `0.0.0.0`, preventing access from other network hosts
- **M2**: Removed `cors` middleware — wildcard CORS headers are no longer sent; requests are same-origin only
- **M4 (OAuth CSRF)**: Spotify and SoundCloud auth-url endpoints now generate a `crypto.randomBytes(16)` state token stored server-side; the OAuth callback validates and consumes the token before proceeding
- **L4**: OAuth config files (`spotify.json`, `soundcloud.json`) are now written with `mode: 0o600` (owner read/write only)
- **M5**: Removed verbose CDN URL logging from the SoundCloud stream proxy to prevent token/URL leakage in server logs

## [1.15.7] - 2026-03-11

### Fixed
- Filter/search bar now works in SoundCloud and Spotify modes, filtering track items by title and artist
- Filter is re-applied automatically when new tracks load (including Load More)
- Filter is cleared when switching between local/SC/Spotify modes to avoid stale state

## [1.15.6] - 2026-03-11

### Fixed
- In SC/Spotify mode, local NFO content no longer bleeds into the info pane: `setNfoPaneVisible` and `showNfo` now no-op while a streaming mode is active

## [1.15.5] - 2026-03-11

### Added
- SoundCloud track info pane now shows a Link row with a clickable URL to the track page (utm tracking params stripped)

## [1.15.4] - 2026-03-11

### Added
- Session restore for SoundCloud and Spotify: on quit the current track and position are saved to `localStorage`; on next launch the app re-enters the streaming mode and resumes from where it left off
- SoundCloud: position saved every ~10 s during `timeupdate` and immediately on `pause`; restored after the first page of liked tracks loads
- Spotify: URI + position (ms) saved on every `player_state_changed` while playing; restored via `PUT /v1/me/player/play` with `position_ms` once the SDK player is ready
- Switching back to local music (⌂ button or re-clicking the active SC/Spotify button) clears the saved stream session

## [1.15.3] - 2026-03-11

### Added
- Stream info pane: NFO pane switches to a track info view in SoundCloud/Spotify mode, showing genre, tags, BPM, key, duration, play count, description (SC) or album, artists, release date (Spotify)
- "Home" button (⌂) appears in toolbar-left when in a streaming mode — click it to return to local music
- SC and Spotify buttons update their tooltip to "Exit … mode" while active for discoverability

## [1.15.2] - 2026-03-11

### Added
- Live spectrum analyzer for SoundCloud and Spotify: real-time FFT bars drawn via Web Audio API AnalyserNode, shown in the waveform section when streaming music is playing
- `spectrum.js` — `LiveSpectrumRenderer` class; connects to the `<audio>` element (SoundCloud) or the Spotify SDK's injected audio element, renders frequency bars with green gradient
- Waveform visibility toggle now also controls the live spectrum for streaming sources

## [1.15.1] - 2026-03-11

### Fixed
- SoundCloud full-track streaming: removed OAuth token from v2 API calls; using web client_id with browser-like headers (Origin/Referer) now returns full CDN URLs (`cf-media.sndcdn.com`) instead of 30-second previews (`cf-preview-media.sndcdn.com/preview/0/30/`)

## [1.15.0] - 2026-03-10

### Added
- SoundCloud liked tracks integration: OAuth flow, credential storage, and liked track browser in the sidebar
- SC button in toolbar-left opens the SoundCloud sidebar panel (orange brand color)
- Server-side proxy endpoints: `/api/soundcloud/liked`, `/api/soundcloud/stream/:id`, `/auth/soundcloud/callback`, status, refresh, config, credentials, disconnect
- SoundCloud playback via the existing `<audio>` element — no additional SDK required
- Auto-advance to next liked track when a SoundCloud track ends
- Mutual exclusion with Spotify: opening one mode closes the other
- SoundCloud settings section in Settings modal with Client ID/Secret inputs and Connect/Disconnect buttons
- Load More pagination for liked tracks using SoundCloud's cursor-based `linked_partitioning` API

## [1.14.4] - 2026-03-10

### Changed
- Playlist tracks show a "Play playlist" button instead of an error when Spotify's API restricts track listing (Development Mode limitation)
- Added `playSpotifyContext()` to play an entire playlist as a Spotify context URI

## [1.14.3] - 2026-03-10

### Changed
- Playlist tracks now show a clear message explaining Spotify's Extended Quota restriction instead of a generic error
- Removed diagnostic debug endpoints
- "Could not load playlists" now shows the actual error reason

## [1.14.2] - 2026-03-10

### Fixed
- Play/pause button now toggles the Spotify player when a Spotify track is active, instead of starting/stopping local audio
- Added `show_dialog=true` to Spotify OAuth URL so re-authorizing always shows the full consent screen with updated scopes
- Improved Spotify playlist-tracks error logging (server logs full Spotify response body)

## [1.14.1] - 2026-03-10

### Fixed
- Spotify tracks list moved from the central NFO pane to the lower-left disc list area (sidebar), matching the intended layout
- Removed the SPOTIFY tab from the NFO pane entirely — Spotify playlists stay upper-left, tracks stay lower-left
- Added `playlist-read-private` and `playlist-read-collaborative` OAuth scopes so "Could not load playlists" error is resolved (requires re-authenticating Spotify)
- Panel resize handle now works correctly in Spotify mode (resizes the `#spotify-browser` upper panel)

## [1.14.0] - 2026-03-10

### Changed
- Refactored Spotify integration from a full-screen overlay into the existing app chrome
- Left sidebar now shows a `#spotify-browser` panel (replaces the folder browser) when Spotify mode is active, listing the user's playlists and a "Liked Songs" item at the top
- Spotify tracks are now shown in a new SPOTIFY tab in the right NFO pane instead of the old `#panel-spotify` overlay
- Added two new server endpoints: `GET /api/spotify/playlists` and `GET /api/spotify/playlist-tracks?id=`
- Clicking any playlist or Liked Songs loads its tracks into the SPOTIFY tab with a Load More button for pagination
- Removed the `#panel-spotify` overlay entirely

## [1.13.1] - 2026-03-10

### Fixed
- Spotify and local audio are now mutually exclusive: starting local playback pauses the Spotify player, and starting a Spotify track pauses local audio (was already the case; now the reverse is also handled via an `audio 'play'` event listener)
- Spotify liked songs now auto-advance: when a track finishes naturally (position resets to 0 while paused), the next track in the visible list plays automatically

## [1.13.0] - 2026-03-09

### Added
- Auto-detect track transitions from NFO + waveform energy analysis
  - When a folder has an NFO with a numbered tracklist (e.g. `01. Artist – Title`) but no CUE file, a "Detect" button appears in the NFO pane header
  - Clicking "Detect" switches to a new DETECT tab and calls `/api/detect-transitions` which box-blurs the waveform peaks and finds N-1 local energy minima as track boundaries
  - Each detected transition is shown with a timecode and a colour-coded confidence dot (green/amber/red)
  - "Apply tracklist" reuses the existing `applyScrapedTracklist()` mechanism — saves to localStorage and updates the sidebar track list with seek points
  - Detect button only appears when the disc has no existing tracklist; hidden after applying
- New `/api/detect-transitions` server endpoint: box-blurs waveform peaks with a 20-second sliding window, finds local energy minima with ≥3-minute separation, ranks by confidence, returns top N-1 transitions
- `getOrComputeWaveform()` shared helper extracted from `/api/waveform` — both endpoints now share the decode/cache logic, avoiding redundant ffmpeg calls

## [1.12.0] - 2026-03-09

### Fixed
- Windows/Linux: title bar is now visible with native close/minimize/maximize buttons; `titleBarStyle: 'hiddenInset'` and `trafficLightPosition` now only applied on macOS
- Windows/Linux: traffic-light CSS padding (`padding-left: 76px` on the dir bar) now only applied on macOS via `body.darwin` class instead of `body.electron`
- "Reveal file" button now works on all platforms: routes through Electron IPC (`shell.showItemInFolder`) in the Electron app; server-side `/api/reveal` falls back to `explorer /select,` on Windows and `xdg-open` on Linux
- Spotify SDK script moved from blocking `<head>` to async load at end of `<body>` — prevents the entire app from hanging on startup when Spotify's CDN is slow or unavailable
- Build config now includes Windows (NSIS installer) and Linux (AppImage) targets in addition to macOS DMG
- "Show in Finder" button tooltip renamed to "Reveal file" for cross-platform clarity

## [1.11.0] - 2026-03-08

### Fixed
- Search "Building index..." no longer blocks: replaced blocking `/api/index` fetch with a streaming SSE endpoint (`/api/index-stream`) that emits each album as it is found; search panel now shows "Scanning… N albums found" and updates live as the scan progresses — you can start typing and get partial results immediately
- MixesDB tracklist search regex now scoped to the `mw-search-results` section only, eliminating false matches from navigation/language/sidebar links (previously returned "MixesDB (en)" etc.)
- MixesDB tracklist fetch now correctly parses plain `<ol><li>Artist - Title</li></ol>` format (most MixesDB pages have no timecodes); shows track numbers instead of timecodes and notes "track order only" when no cue points are available
- `buildMusicIndex` refactored into a streaming callback form so both the blocking and streaming endpoints share the same scan logic

## [1.10.9] - 2026-03-08

### Added
- Online tracklist finder: click the new `≣` toolbar button (shown whenever an MP3 is loaded) to search MixesDB for the mix's tracklist; results auto-fill from the folder name, timecoded tracks are shown in a preview list, and "Use this tracklist" applies them to the disc — tracks then appear in the sidebar with proper cue points and persist across restarts via localStorage
- Server routes `/api/tracklist-search` and `/api/tracklist-fetch` that proxy MixesDB (MediaWiki search + `[MMM] Artist - Title` parsing); no API key required

## [1.10.8] - 2026-03-08

### Fixed
- Search now always includes the currently loaded root directory alongside library folders; previously if you browsed a root that wasn't in the library the search returned no results even though the folder browser showed the content
- "Rebuild Index" button now also busts the per-root server cache for the currently loaded directory, not just the library-index cache

## [1.10.7] - 2026-03-08

### Changed
- Mini player shows no waveform/spectrum — just the footer strip (80 px) with play controls and a seek scrubber
- Seek scrubber in mini mode is "zoomed" to the current CUE track: 0% = track start, 100% = track end; time display shows elapsed/remaining within that track only; raw single-file discs use the full file duration as before
- Seek scrubber is slightly thicker (6 px) in mini mode for easier interaction
- Mini player window allows horizontal width resizing while height is locked at 80 px

## [1.10.6] - 2026-03-08

### Fixed
- Active track text contrast: track title and play indicator now render white (`#fff`) on the green progress background instead of near-identical green, making them readable across both played and unplayed portions of the row; light-theme uses dark green (`#1a3a2a`) for the same elements

### Changed
- Mini player now shows the zoom waveform canvas above the footer controls (overview and resize handles are hidden); window height increased to 160 px to accommodate the canvas
- Mini player allows horizontal width resizing while locking vertical height via `setMaximumSize`; entering/exiting mini mode automatically triggers a waveform re-render so the canvas fills the available space correctly

## [1.10.5] - 2026-03-08

### Added
- Settings → "Rebuild Index" button: forces a fresh rebuild of the library search index (busts both the library-index and single-root index caches) and shows a status message when done; useful after adding new folders or files without restarting

### Changed
- Removed the "NOW PLAYING" label from the main pane header

## [1.10.4] - 2026-03-08

### Fixed
- Play ▶ indicator now shows for raw single-file discs (no CUE) — `.track-num` span was missing from their row so the CSS `::before` never fired
- Next/Prev now navigate across discs for single-file albums: at the last CUE track or any raw file, Next goes to the next disc; Prev at the first track goes to the previous disc; raw file Prev restarts if more than 3 s in
- Auto-advance on track end now proceeds to the next disc for raw single-file albums and at the end of a CUE disc
- Folder browser SSE now limits concurrent `hasMusic` I/O checks to 8 at a time (was unbounded); frees network-drive bandwidth so a double-click scan can complete without waiting for the full folder stream
- Library search index now rebuilds correctly after a server restart (previous session's in-memory cache is cleared on startup, picking up newly added folders and FLAC support)

## [1.10.3] - 2026-03-08

### Fixed
- Folder browser now shows FLAC, M4A, AAC, OGG, WAV, OPUS, and WMA directories (previously only MP3/CUE folders were shown, so FLAC-only folders like Roxette were invisible)
- FLAC/M4A/AAC/OGG/WAV/OPUS/WMA files now scan, appear in the disc list, and play (scanner and `/file` route previously hardcoded to MP3 only)
- Pressing "Go" no longer stops playback — it only refreshes the folder browser to the new root; the disc list and current track are undisturbed
- Double-clicking a folder now plays immediately without the single-click also firing a redundant scan first (220 ms debounce distinguishes single vs double click)
- Stale `scanDirectory` responses are now discarded when a newer scan has started, preventing old results from overwriting the disc list after rapid navigation

### Added
- Play indicator: active track row in the disc list shows a green ▶ before the track number
- Progress background: the active track row fills with a subtle green tint from left to right as the track plays, showing how far through you are

## [1.10.2] - 2026-03-08

### Changed
- Folder browser now streams results via SSE (`/api/ls-stream`): each subdirectory appears in the list the moment its music-content check resolves, inserted in sorted position — no more waiting for the full scan before anything shows; revisits are instant from the server-side cache

## [1.10.1] - 2026-03-08

### Performance
- Eliminated the fixed 300 ms startup delay in Electron — window now opens the moment the Express server fires its `listening` event instead of waiting a blind timeout
- `/api/ls` and `/api/scan` results are now cached in memory for the session; repeated navigation to the same folder is instant; pass `bust=1` to force a fresh read
- `hasMusic` checks in `/api/ls` are now batched 20 at a time instead of all-at-once, preventing network drive I/O saturation on large library roots
- `init()` now fetches `/api/config` and loads the library simultaneously, then runs `loadFolderBrowser` and `scanDirectory` in parallel — cuts startup rendering time roughly in half

### Added
- Directory input shows a dropdown of library folders on focus — click any entry to load it instantly; still accepts free-text paths as before

## [1.10.0] - 2026-03-08

### Added
- Library: add multiple music folders to a persistent library (`~/.tracklistplayer/library.json`); click the &#9783; toolbar button to open the Library modal — use "+ Add Folder" (native picker in Electron) to add folders, ✕ per row to remove
- Search now indexes and searches across all library folders simultaneously via `/api/library-index`; falls back to the current active directory if no library folders have been added
- Library index is cached server-side and invalidated automatically when folders are added or removed

## [1.9.8] - 2026-03-08

### Fixed
- Search result count was wrong when results included raw MP3 discs (no CUE) — now counts rendered rows, not just CUE track entries

### Added
- Track duration shown on the right of each search result row (computed from adjacent CUE start times; last track of each disc and raw MP3s show no duration since the total file length isn't available without scanning)

## [1.9.7] - 2026-03-08

### Changed
- Search is now a centred popup modal (680 px wide, up to 70 vh tall) with a dark backdrop instead of an inline panel that consumed sidebar space; click outside or press Escape to dismiss; input is auto-focused and auto-selected on open

## [1.9.6] - 2026-03-08

### Added
- Drag-and-drop MP3 playback: drag one or more MP3 files onto the app window; a full-screen overlay appears while dragging, then files are loaded as a playlist and the first track plays immediately; in Electron, server-side waveform and artwork work as normal; in browser mode a blob URL is used for direct playback

### Changed
- Sidebar panel splitter (between folder browser and disc list) is now 18 px tall with an accent-coloured top border and a centred grip pill — much easier to grab, matching the style of the main resize handles
- Folder browser pane uses `--bg2` background; disc list uses `--bg` — the two panes are now visually distinct

## [1.9.5] - 2026-03-08

### Fixed
- Folder browser now hides empty subdirectories (e.g. scene release-group tag folders like `[MiRAGE] - ...`) that contain no MP3 or CUE files; prevents confusing "No MP3/CUE files here" when clicking on them

## [1.9.4] - 2026-03-08

### Added
- NFO links are now clickable: http/https URLs are auto-detected and rendered as blue underlined anchors; clicking opens in the default browser (via Electron shell.openExternal, or window.open in browser mode)

## [1.9.3] - 2026-03-08

### Fixed
- Star button now appears on raw MP3 discs that have no CUE sheet; previously the no-tracks code path rendered the item without a favourite button

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
