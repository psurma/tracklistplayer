"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/state.js
  var state, STORAGE;
  var init_state = __esm({
    "src/state.js"() {
      state = {
        discs: [],
        currentDiscId: null,
        currentTrackIndex: -1,
        seeking: false,
        sidebarCollapsed: false,
        browseDir: "",
        favorites: /* @__PURE__ */ new Map(),
        queue: [],
        bookmarks: {},
        collapsedDiscs: /* @__PURE__ */ new Set()
      };
      STORAGE = {
        getDir: () => localStorage.getItem("tlp_dir") || "",
        setDir: (v) => localStorage.setItem("tlp_dir", v),
        getTheme: () => localStorage.getItem("tlp_theme") || "dark",
        setTheme: (v) => localStorage.setItem("tlp_theme", v),
        getSidebarW: () => localStorage.getItem("tlp_sidebar_w") || "340",
        setSidebarW: (v) => localStorage.setItem("tlp_sidebar_w", String(v)),
        getBrowserH: () => localStorage.getItem("tlp_browser_h") || "40",
        getWaveformOn: () => localStorage.getItem("tlp_waveform") !== "off",
        setWaveformOn: (v) => localStorage.setItem("tlp_waveform", v ? "on" : "off"),
        getMainTopH: () => parseInt(localStorage.getItem("tlp_main_top_h"), 10) || 0,
        setMainTopH: (v) => localStorage.setItem("tlp_main_top_h", String(v)),
        setBrowserH: (v) => localStorage.setItem("tlp_browser_h", String(v)),
        getFavs: () => JSON.parse(localStorage.getItem("tlp_favorites") || "[]"),
        setFavs: (arr) => localStorage.setItem("tlp_favorites", JSON.stringify(arr)),
        getPlayState: () => JSON.parse(localStorage.getItem("tlp_playstate") || "null"),
        setPlayState: (v) => localStorage.setItem("tlp_playstate", JSON.stringify(v)),
        getScanDir: () => localStorage.getItem("tlp_scan_dir") || "",
        setScanDir: (v) => localStorage.setItem("tlp_scan_dir", v),
        getFilter: () => localStorage.getItem("tlp_filter") || "",
        setFilter: (v) => localStorage.setItem("tlp_filter", v),
        getVolume: () => parseFloat(localStorage.getItem("tlp_volume") ?? "1"),
        setVolume: (v) => localStorage.setItem("tlp_volume", String(v)),
        getShuffle: () => localStorage.getItem("tlp_shuffle") === "on",
        setShuffle: (v) => localStorage.setItem("tlp_shuffle", v ? "on" : "off"),
        getRepeat: () => localStorage.getItem("tlp_repeat") || "off",
        setRepeat: (v) => localStorage.setItem("tlp_repeat", v),
        getSpectrumRes: () => parseInt(localStorage.getItem("tlp_spectrum_res") || "100", 10),
        setSpectrumRes: (v) => localStorage.setItem("tlp_spectrum_res", String(v)),
        getTrackLabels: () => localStorage.getItem("tlp_track_labels") !== "off",
        setTrackLabels: (v) => localStorage.setItem("tlp_track_labels", v ? "on" : "off"),
        getStreamSession: () => JSON.parse(localStorage.getItem("tlp_stream_session") || "null"),
        setStreamSession: (v) => localStorage.setItem("tlp_stream_session", JSON.stringify(v)),
        clearStreamSession: () => localStorage.removeItem("tlp_stream_session"),
        getDiscProgress: () => JSON.parse(localStorage.getItem("tlp_disc_progress") || "{}"),
        setDiscProgress: (v) => localStorage.setItem("tlp_disc_progress", JSON.stringify(v)),
        getEqLow: () => parseFloat(localStorage.getItem("tlp_eq_low") || "0"),
        setEqLow: (v) => localStorage.setItem("tlp_eq_low", String(v)),
        getEqMid: () => parseFloat(localStorage.getItem("tlp_eq_mid") || "0"),
        setEqMid: (v) => localStorage.setItem("tlp_eq_mid", String(v)),
        getEqHigh: () => parseFloat(localStorage.getItem("tlp_eq_high") || "0"),
        setEqHigh: (v) => localStorage.setItem("tlp_eq_high", String(v)),
        getBookmarks: () => JSON.parse(localStorage.getItem("tlp_bookmarks") || "{}"),
        setBookmarks: (v) => localStorage.setItem("tlp_bookmarks", JSON.stringify(v)),
        getQueue: () => JSON.parse(localStorage.getItem("tlp_play_queue") || "[]"),
        setQueue: (v) => localStorage.setItem("tlp_play_queue", JSON.stringify(v)),
        getSpotifyTargetPlaylist: () => localStorage.getItem("tlp_spotify_target_playlist") || "",
        setSpotifyTargetPlaylist: (v) => localStorage.setItem("tlp_spotify_target_playlist", v),
        getBpmCache: () => JSON.parse(localStorage.getItem("tlp_bpm_cache") || "{}"),
        setBpmCache: (v) => localStorage.setItem("tlp_bpm_cache", JSON.stringify(v))
      };
    }
  });

  // src/helpers.js
  var helpers_exports = {};
  __export(helpers_exports, {
    currentDisc: () => currentDisc,
    escapeHtml: () => escapeHtml,
    favKey: () => favKey,
    fileUrl: () => fileUrl,
    formatDuration: () => formatDuration,
    formatDurationMs: () => formatDurationMs,
    formatTime: () => formatTime
  });
  function formatTime(secs) {
    if (!isFinite(secs) || secs < 0) return "0:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor(secs % 3600 / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }
  function formatDuration(secs) {
    if (secs == null || !isFinite(secs) || secs < 0) return "";
    return formatTime(secs);
  }
  function formatDurationMs(ms) {
    const s = Math.round(ms / 1e3);
    const h = Math.floor(s / 3600);
    const m = Math.floor(s % 3600 / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }
  function fileUrl(absPath) {
    return `/file?path=${encodeURIComponent(absPath)}`;
  }
  function currentDisc() {
    return state.discs.find((d) => d.id === state.currentDiscId) || null;
  }
  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function favKey(mp3File, trackNumber) {
    return `${mp3File}:${trackNumber}`;
  }
  var init_helpers = __esm({
    "src/helpers.js"() {
      init_state();
    }
  });

  // src/dom-refs.js
  var audio, discList, folderBrowser, panelResize, dirInput, dirLoadBtn, filterInput, filterClear, collapseBtn, resizeHandle, sidebar, btnPlay, btnPrev, btnNext, btnShuffle, btnRepeat, seekBar, timeCurrent, timeTotal, volumeBar, npDisc, npTrackNumber, npTitle, npPerformer, npSection, spotifyBtn, spotifySearchBtn, soundcloudSearchBtn, finderBtn, nfoBtn, tlBtn, themeToggle, waveformToggle, miniBtn, miniTrack, miniSub, btnSleep, sleepPopover, sleepActive, sleepRemaining, sleepCancelBtn, queuePanel, queueList, queueCount, bookmarksPanel, bookmarksList, bookmarksCount, eqPanel, eqLowSlider, eqMidSlider, eqHighSlider, exportBtn, seekTicks, nfoPane, mainResizeH, mainTop, artworkPane, artworkImg, nfoContent, localBtn, wfSection, wfStatus;
  var init_dom_refs = __esm({
    "src/dom-refs.js"() {
      audio = document.getElementById("audio");
      discList = document.getElementById("disc-list");
      folderBrowser = document.getElementById("folder-browser");
      panelResize = document.getElementById("panel-resize");
      dirInput = document.getElementById("dir-input");
      dirLoadBtn = document.getElementById("dir-load-btn");
      filterInput = document.getElementById("filter-input");
      filterClear = document.getElementById("filter-clear");
      collapseBtn = document.getElementById("collapse-btn");
      resizeHandle = document.getElementById("resize-handle");
      sidebar = document.getElementById("sidebar");
      btnPlay = document.getElementById("btn-play");
      btnPrev = document.getElementById("btn-prev");
      btnNext = document.getElementById("btn-next");
      btnShuffle = document.getElementById("btn-shuffle");
      btnRepeat = document.getElementById("btn-repeat");
      seekBar = document.getElementById("seek-bar");
      timeCurrent = document.getElementById("time-current");
      timeTotal = document.getElementById("time-total");
      volumeBar = document.getElementById("volume-bar");
      npDisc = document.getElementById("np-disc");
      npTrackNumber = document.getElementById("np-track-number");
      npTitle = document.getElementById("np-title");
      npPerformer = document.getElementById("np-performer");
      npSection = document.getElementById("now-playing");
      spotifyBtn = document.getElementById("spotify-btn");
      spotifySearchBtn = document.getElementById("spotify-search-btn");
      soundcloudSearchBtn = document.getElementById("soundcloud-search-btn");
      finderBtn = document.getElementById("finder-btn");
      nfoBtn = document.getElementById("nfo-btn");
      tlBtn = document.getElementById("tl-btn");
      themeToggle = document.getElementById("theme-toggle");
      waveformToggle = document.getElementById("waveform-toggle");
      miniBtn = document.getElementById("mini-btn");
      miniTrack = document.getElementById("mini-track");
      miniSub = document.getElementById("mini-sub");
      btnSleep = document.getElementById("btn-sleep");
      sleepPopover = document.getElementById("sleep-popover");
      sleepActive = document.getElementById("sleep-active");
      sleepRemaining = document.getElementById("sleep-remaining");
      sleepCancelBtn = document.getElementById("sleep-cancel");
      queuePanel = document.getElementById("queue-panel");
      queueList = document.getElementById("queue-list");
      queueCount = document.getElementById("queue-count");
      bookmarksPanel = document.getElementById("bookmarks-panel");
      bookmarksList = document.getElementById("bookmarks-list");
      bookmarksCount = document.getElementById("bookmarks-count");
      eqPanel = document.getElementById("eq-panel");
      eqLowSlider = document.getElementById("eq-low");
      eqMidSlider = document.getElementById("eq-mid");
      eqHighSlider = document.getElementById("eq-high");
      exportBtn = document.getElementById("export-btn");
      seekTicks = document.getElementById("seek-ticks");
      nfoPane = document.getElementById("nfo-pane");
      mainResizeH = document.getElementById("main-resize-h");
      mainTop = document.getElementById("main-top");
      artworkPane = document.getElementById("artwork-pane");
      artworkImg = document.getElementById("artwork-img");
      nfoContent = document.getElementById("nfo-content");
      localBtn = document.getElementById("local-btn");
      wfSection = document.getElementById("waveform-section");
      wfStatus = document.getElementById("wf-status");
    }
  });

  // src/spotify.js
  var spotify_exports = {};
  __export(spotify_exports, {
    closeSpotifyMode: () => closeSpotifyMode,
    connectSpotify: () => connectSpotify,
    disconnectSpotify: () => disconnectSpotify,
    getSpotifyCurrentUri: () => getSpotifyCurrentUri,
    getSpotifyPlayer: () => getSpotifyPlayer,
    getSpotifyToken: () => getSpotifyToken,
    getSpotifyTracksList: () => getSpotifyTracksList,
    initSpotify: () => initSpotify,
    isSpotifyConnected: () => isSpotifyConnected,
    isSpotifyMode: () => isSpotifyMode,
    loadSpotifyPlaylists: () => loadSpotifyPlaylists,
    loadSpotifyTracks: () => loadSpotifyTracks,
    openSpotifyMode: () => openSpotifyMode,
    playSpotifyContext: () => playSpotifyContext,
    playSpotifyTrack: () => playSpotifyTrack,
    registerDeps: () => registerDeps4,
    setCurrentWfPath: () => setCurrentWfPath,
    setPendingSpotifyRestore: () => setPendingSpotifyRestore,
    setWaveformVisible: () => setWaveformVisible,
    updateSpotifyUI: () => updateSpotifyUI
  });
  function registerDeps4(deps) {
    _enterStreamingInfoMode = deps.enterStreamingInfoMode;
    _exitStreamingInfoMode = deps.exitStreamingInfoMode;
    _showSpotifyTrackInfo = deps.showSpotifyTrackInfo;
    _showLiveSpectrum = deps.showLiveSpectrum;
    _fancyScrubber = deps.fancyScrubber;
    _liveSpectrum = deps.liveSpectrum;
    _liveSpectrumWrap = deps.liveSpectrumWrap;
    _applyFilter2 = deps.applyFilter;
    _closeSettings = deps.closeSettings;
  }
  function setWaveformVisible(v) {
    _waveformVisible = v;
  }
  function setCurrentWfPath(v) {
    _currentWfPath = v;
  }
  async function getSpotifyToken() {
    if (spotifyAccessToken && Date.now() < spotifyTokenExpiry - 6e4) return spotifyAccessToken;
    const res = await fetch("/api/spotify/refresh", { method: "POST" });
    if (!res.ok) throw new Error("Token refresh failed");
    const data = await res.json();
    spotifyAccessToken = data.access_token;
    spotifyTokenExpiry = data.expires_at || Date.now() + 36e5;
    return spotifyAccessToken;
  }
  function initSpotifySDK(token) {
    if (spotifyPlayer) {
      spotifyPlayer.disconnect();
      spotifyPlayer = null;
    }
    spotifyAccessToken = token;
    spotifyPlayer = new Spotify.Player({
      name: "Tracklist Player",
      getOAuthToken: (cb) => {
        getSpotifyToken().then(cb).catch(() => cb(token));
      },
      volume: 0.8
    });
    spotifyPlayer.addListener("ready", ({ device_id }) => {
      spotifyDeviceId = device_id;
      if (pendingSpotifyRestore) {
        const { uri, position } = pendingSpotifyRestore;
        pendingSpotifyRestore = null;
        getSpotifyToken().then((tok) => {
          fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(device_id)}`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${tok}`, "Content-Type": "application/json" },
            body: JSON.stringify({ uris: [uri], position_ms: position || 0 })
          }).catch((err) => console.warn("[spotify] restore play failed:", err?.message || err));
        }).catch((err) => console.warn("[spotify] restore token failed:", err?.message || err));
      }
    });
    spotifyPlayer.addListener("player_state_changed", (playerState) => {
      if (!playerState) return;
      const item = playerState.track_window && playerState.track_window.current_track;
      if (!item) return;
      const justEnded = spotifyWasPlaying && playerState.paused && playerState.position === 0;
      spotifyWasPlaying = !playerState.paused;
      spotifyCurrentUri = item.uri;
      spotifyTracksList.querySelectorAll(".spotify-track-item").forEach((el) => {
        el.classList.toggle("spotify-track-active", el.dataset.uri === item.uri);
      });
      btnPlay.innerHTML = playerState.paused ? "&#9654;" : "&#9646;&#9646;";
      if (!playerState.paused && _waveformVisible) {
        const spotifyAudio = [...document.querySelectorAll("audio")].find((el) => el !== audio);
        if (spotifyAudio) {
          _liveSpectrum.connectAudioElement(spotifyAudio);
          _fancyScrubber.clear();
          _currentWfPath = null;
          _showLiveSpectrum();
        }
      }
      if (_showSpotifyTrackInfo) _showSpotifyTrackInfo(item);
      if (!playerState.paused) {
        STORAGE.setStreamSession({ mode: "spotify", uri: item.uri, position: playerState.position });
      }
      if (justEnded) {
        const items = [...spotifyTracksList.querySelectorAll(".spotify-track-item")];
        const idx = items.findIndex((el) => el.dataset.uri === item.uri);
        const next = items[idx + 1];
        if (next) playSpotifyTrack(next.dataset.uri);
      }
    });
    spotifyPlayer.addListener("initialization_error", ({ message }) => {
      console.error("Spotify init error:", message);
    });
    spotifyPlayer.addListener("authentication_error", ({ message }) => {
      console.error("Spotify auth error:", message);
      spotifyAccessToken = null;
      spotifyTokenExpiry = 0;
      getSpotifyToken().then((tok) => {
        console.log("[spotify] reauthenticated; reinitializing player");
        try {
          spotifyPlayer.disconnect();
        } catch (_) {
        }
        initSpotifySDK(tok);
      }).catch((err) => console.warn("[spotify] reauth failed:", err?.message || err));
    });
    spotifyPlayer.addListener("account_error", ({ message }) => {
      console.error("Spotify account error (Premium required):", message);
    });
    spotifyPlayer.connect();
  }
  function updateSpotifyUI() {
    const connected = spotifyConnected;
    spotifyBrowserPrompt.classList.toggle("hidden", connected);
    spotifyPlaylistList.classList.toggle("hidden", !connected);
    const disconnectRow = document.getElementById("spotify-disconnect-row");
    if (disconnectRow) disconnectRow.classList.toggle("hidden", !connected);
  }
  function openSpotifyMode() {
    Promise.resolve().then(() => (init_soundcloud(), soundcloud_exports)).then((sc) => {
      if (sc.isSoundcloudMode()) sc.closeSoundcloudMode();
    });
    filterInput.value = "";
    filterClear.classList.add("hidden");
    spotifyMode = true;
    spotifyBtn.classList.add("active");
    spotifyBtn.title = "Exit Spotify mode";
    folderBrowser.classList.add("hidden");
    spotifyBrowser.classList.remove("hidden");
    discList.classList.add("hidden");
    spotifyTracksPanel.classList.remove("hidden");
    if (_enterStreamingInfoMode) _enterStreamingInfoMode();
    updateSpotifyUI();
    if (spotifyConnected) {
      loadSpotifyPlaylists();
      if (!spotifyActiveSource) {
        loadSpotifyTracks({ type: "liked" }, 0);
      }
    }
  }
  function closeSpotifyMode() {
    spotifyMode = false;
    spotifyBtn.classList.remove("active");
    spotifyBtn.title = "Spotify Liked Songs";
    spotifyBrowser.classList.add("hidden");
    folderBrowser.classList.remove("hidden");
    spotifyTracksPanel.classList.add("hidden");
    discList.classList.remove("hidden");
    if (_exitStreamingInfoMode) _exitStreamingInfoMode();
    if (_liveSpectrum) _liveSpectrum.stop();
    if (_liveSpectrumWrap) _liveSpectrumWrap.classList.add("hidden");
    STORAGE.clearStreamSession();
  }
  async function loadSpotifyPlaylists() {
    spotifyPlaylistList.innerHTML = '<div class="spotify-pl-loading">Loading playlists\u2026</div>';
    try {
      const res = await fetch("/api/spotify/playlists");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const playlists = data.items || [];
      const frag = document.createDocumentFragment();
      const liked = document.createElement("div");
      liked.className = "spotify-pl-item";
      liked.dataset.type = "liked";
      liked.innerHTML = `<span class="spotify-pl-icon">\u2665</span><span class="spotify-pl-name">Liked Songs</span>`;
      liked.addEventListener("click", () => loadSpotifyTracks({ type: "liked" }, 0));
      frag.appendChild(liked);
      for (const pl of playlists) {
        const item = document.createElement("div");
        item.className = "spotify-pl-item";
        item.dataset.id = pl.id;
        item.innerHTML = `<span class="spotify-pl-icon">\u266B</span><span class="spotify-pl-name">${escapeHtml(pl.name)}</span><span class="spotify-pl-count">${pl.tracks ? pl.tracks.total : ""}</span>`;
        item.addEventListener("click", () => loadSpotifyTracks({ type: "playlist", id: pl.id, name: pl.name }, 0));
        frag.appendChild(item);
      }
      spotifyPlaylistList.innerHTML = "";
      spotifyPlaylistList.appendChild(frag);
    } catch (err) {
      spotifyPlaylistList.innerHTML = `<div class="spotify-pl-loading">Could not load playlists.<br><small>${escapeHtml(err.message)}</small></div>`;
    }
  }
  async function loadSpotifyTracks(source, offset) {
    if (spotifyTracksLoading && offset > 0) return;
    spotifyTracksLoading = true;
    if (offset === 0) {
      spotifyActiveSource = source;
      spotifyTracksOffset = 0;
      spotifyTracksTotal = 0;
      spotifyTracksList.innerHTML = '<div class="spotify-loading">Loading\u2026</div>';
      spotifyTracksFooter.classList.add("hidden");
      spotifyPlaylistList.querySelectorAll(".spotify-pl-item").forEach((el) => {
        const isActive = source.type === "liked" ? el.dataset.type === "liked" : el.dataset.id === source.id;
        el.classList.toggle("spotify-pl-active", isActive);
      });
      spotifySourceName.textContent = source.type === "liked" ? "Liked Songs" : source.name || "Playlist";
      spotifySourceCount.textContent = "";
    }
    try {
      const url = source.type === "liked" ? `/api/spotify/liked?offset=${offset}&limit=50` : `/api/spotify/playlist-tracks?id=${encodeURIComponent(source.id)}&offset=${offset}&limit=50`;
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 403 && errData.error === "quota_exceeded") {
          throw new Error("Playlist tracks require Spotify Extended Quota access.\nRequest it at developer.spotify.com \u2192 your app \u2192 Quota Extension.");
        }
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      spotifyTracksTotal = data.total || 0;
      spotifyTracksOffset = offset + (data.items || []).length;
      spotifySourceCount.textContent = spotifyTracksTotal ? `${spotifyTracksTotal} tracks` : "";
      if (offset === 0) spotifyTracksList.innerHTML = "";
      const frag = document.createDocumentFragment();
      for (const item of data.items || []) {
        const track = item.track;
        if (!track) continue;
        const el = document.createElement("div");
        el.className = "spotify-track-item";
        el.dataset.uri = track.uri;
        const duration = formatTime(Math.floor((track.duration_ms || 0) / 1e3));
        const artists = (track.artists || []).map((a) => a.name).join(", ");
        el.innerHTML = `
        <span class="spotify-play-icon">&#9654;</span>
        <span class="spotify-track-info">
          <div class="spotify-track-title">${escapeHtml(track.name || "")}</div>
          <div class="spotify-track-artist">${escapeHtml(artists)}</div>
        </span>
        <span class="spotify-track-duration">${duration}</span>
      `;
        el.addEventListener("click", () => playSpotifyTrack(track.uri));
        frag.appendChild(el);
      }
      spotifyTracksList.appendChild(frag);
      if (_applyFilter2 && filterInput.value) _applyFilter2(filterInput.value);
      if (spotifyTracksOffset < spotifyTracksTotal) {
        spotifyTracksFooter.classList.remove("hidden");
      } else {
        spotifyTracksFooter.classList.add("hidden");
      }
    } catch (err) {
      if (offset === 0) {
        const isQuota = err.message.includes("quota_exceeded") || err.message.includes("403");
        if (isQuota && spotifyActiveSource && spotifyActiveSource.type === "playlist") {
          spotifyTracksList.innerHTML = `<div class="spotify-quota-notice">
          <p>Spotify restricts playlist track access for this app.</p>
          <p>You can still play this playlist directly:</p>
          <button id="spotify-play-playlist-btn">Play playlist</button>
        </div>`;
          document.getElementById("spotify-play-playlist-btn").addEventListener("click", () => {
            playSpotifyContext(`spotify:playlist:${spotifyActiveSource.id}`);
          });
        } else {
          spotifyTracksList.innerHTML = `<div class="spotify-loading" style="color:#c06060">Error: ${escapeHtml(err.message)}</div>`;
        }
      }
    } finally {
      spotifyTracksLoading = false;
    }
  }
  async function initSpotify() {
    try {
      const statusRes = await fetch("/api/spotify/status");
      if (!statusRes.ok) return;
      const status = await statusRes.json();
      spotifyConnected = status.connected;
      updateSpotifyUI();
      if (status.connected) {
        try {
          const token = await getSpotifyToken();
          if (spotifySDKReady) {
            initSpotifySDK(token);
          } else {
            spotifySDKPendingToken = token;
          }
        } catch (err) {
          console.warn("[spotify] init token/SDK:", err?.message || err);
        }
      }
    } catch (err) {
      console.warn("[spotify] init status:", err?.message || err);
    }
  }
  async function connectSpotify() {
    const popup = window.open("", "spotify-auth", "width=500,height=700,menubar=no,toolbar=no");
    if (!popup) {
      alert("Popup blocked. Please allow popups for this page.");
      return;
    }
    try {
      const urlRes = await fetch("/api/spotify/auth-url");
      if (!urlRes.ok) {
        popup.close();
        alert("Please configure your Spotify Client ID and Secret in Settings first.");
        return;
      }
      const { url } = await urlRes.json();
      popup.location.href = url;
    } catch (_) {
      popup.close();
      return;
    }
    if (spotifyPollTimer) clearInterval(spotifyPollTimer);
    let attempts = 0;
    spotifyPollTimer = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        clearInterval(spotifyPollTimer);
        spotifyPollTimer = null;
        return;
      }
      try {
        const statusRes = await fetch("/api/spotify/status");
        if (!statusRes.ok) return;
        const status = await statusRes.json();
        if (status.connected) {
          clearInterval(spotifyPollTimer);
          spotifyPollTimer = null;
          spotifyConnected = true;
          updateSpotifyUI();
          try {
            const token = await getSpotifyToken();
            if (spotifySDKReady) initSpotifySDK(token);
            else spotifySDKPendingToken = token;
          } catch (_) {
          }
          if (spotifyMode) {
            loadSpotifyPlaylists();
            loadSpotifyTracks({ type: "liked" }, 0);
          }
        }
      } catch (_) {
      }
    }, 2e3);
  }
  async function playSpotifyContext(contextUri) {
    let deviceId = spotifyDeviceId;
    if (!deviceId) {
      try {
        const res = await fetch("/api/spotify/devices");
        if (res.ok) {
          const data = await res.json();
          const pick = (data.devices || []).find((d) => d.is_active) || (data.devices || [])[0];
          if (pick) deviceId = pick.id;
        }
      } catch (_) {
      }
    }
    if (!deviceId) return;
    try {
      const token = await getSpotifyToken();
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ context_uri: contextUri })
      });
      if (!audio.paused) audio.pause();
    } catch (err) {
      console.error("Spotify context play error:", err);
    }
  }
  async function playSpotifyTrack(uri) {
    let deviceId = spotifyDeviceId;
    if (!deviceId) {
      try {
        const res = await fetch("/api/spotify/devices");
        if (res.ok) {
          const data = await res.json();
          const devices = data.devices || [];
          const pick = devices.find((d) => d.is_active) || devices[0];
          if (pick) deviceId = pick.id;
        }
      } catch (_) {
      }
    }
    if (!deviceId) {
      const trackId = uri.split(":").pop();
      window.open(`https://open.spotify.com/track/${trackId}`);
      return;
    }
    try {
      const token = await getSpotifyToken();
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris: [uri] })
      });
      if (!audio.paused) audio.pause();
    } catch (err) {
      console.error("Spotify play error:", err);
    }
  }
  async function disconnectSpotify() {
    await fetch("/api/spotify/disconnect", { method: "POST" }).catch(() => {
    });
    spotifyConnected = false;
    spotifyAccessToken = null;
    spotifyTokenExpiry = 0;
    if (spotifyPlayer) {
      spotifyPlayer.disconnect();
      spotifyPlayer = null;
    }
    spotifyDeviceId = null;
    spotifyCurrentUri = null;
    spotifyTracksList.innerHTML = "";
    spotifyTracksFooter.classList.add("hidden");
    spotifySourceCount.textContent = "";
    spotifyPlaylistList.innerHTML = "";
    spotifyActiveSource = null;
    closeSpotifyMode();
  }
  function isSpotifyMode() {
    return spotifyMode;
  }
  function isSpotifyConnected() {
    return spotifyConnected;
  }
  function getSpotifyPlayer() {
    return spotifyPlayer;
  }
  function getSpotifyCurrentUri() {
    return spotifyCurrentUri;
  }
  function setPendingSpotifyRestore(v) {
    pendingSpotifyRestore = v;
  }
  function getSpotifyTracksList() {
    return spotifyTracksList;
  }
  var _enterStreamingInfoMode, _exitStreamingInfoMode, _showSpotifyTrackInfo, _showLiveSpectrum, _fancyScrubber, _currentWfPath, _waveformVisible, _liveSpectrum, _liveSpectrumWrap, _applyFilter2, _closeSettings, spotifyPlayer, spotifyDeviceId, spotifyConnected, spotifyAccessToken, spotifyTokenExpiry, spotifyPollTimer, spotifyWasPlaying, spotifyCurrentUri, spotifySDKReady, spotifySDKPendingToken, pendingSpotifyRestore, spotifyMode, spotifyActiveSource, spotifyTracksOffset, spotifyTracksTotal, spotifyTracksLoading, spotifyBrowser, spotifyBrowserPrompt, spotifyBrowserConnectBtn, spotifyPlaylistList, spotifyTracksPanel, spotifySourceName, spotifySourceCount, spotifyTracksList, spotifyTracksFooter, spotifyTracksLoadMoreBtn;
  var init_spotify = __esm({
    "src/spotify.js"() {
      init_state();
      init_helpers();
      init_dom_refs();
      _enterStreamingInfoMode = null;
      _exitStreamingInfoMode = null;
      _showSpotifyTrackInfo = null;
      _showLiveSpectrum = null;
      _fancyScrubber = null;
      _currentWfPath = null;
      _waveformVisible = false;
      _liveSpectrum = null;
      _liveSpectrumWrap = null;
      _applyFilter2 = null;
      _closeSettings = null;
      spotifyPlayer = null;
      spotifyDeviceId = null;
      spotifyConnected = false;
      spotifyAccessToken = null;
      spotifyTokenExpiry = 0;
      spotifyPollTimer = null;
      spotifyWasPlaying = false;
      spotifyCurrentUri = null;
      spotifySDKReady = false;
      spotifySDKPendingToken = null;
      pendingSpotifyRestore = null;
      window.onSpotifyWebPlaybackSDKReady = () => {
        spotifySDKReady = true;
        if (spotifySDKPendingToken) {
          initSpotifySDK(spotifySDKPendingToken);
          spotifySDKPendingToken = null;
        }
      };
      spotifyMode = false;
      spotifyActiveSource = null;
      spotifyTracksOffset = 0;
      spotifyTracksTotal = 0;
      spotifyTracksLoading = false;
      spotifyBrowser = document.getElementById("spotify-browser");
      spotifyBrowserPrompt = document.getElementById("spotify-browser-prompt");
      spotifyBrowserConnectBtn = document.getElementById("spotify-browser-connect-btn");
      spotifyPlaylistList = document.getElementById("spotify-playlist-list");
      spotifyTracksPanel = document.getElementById("spotify-tracks-panel");
      spotifySourceName = document.getElementById("spotify-source-name");
      spotifySourceCount = document.getElementById("spotify-source-count");
      spotifyTracksList = document.getElementById("spotify-tracks-list");
      spotifyTracksFooter = document.getElementById("spotify-tracks-footer");
      spotifyTracksLoadMoreBtn = document.getElementById("spotify-tracks-load-more-btn");
      spotifyBtn.addEventListener("click", () => {
        if (spotifyMode) closeSpotifyMode();
        else openSpotifyMode();
      });
      spotifyBrowserConnectBtn.addEventListener("click", connectSpotify);
      spotifyTracksLoadMoreBtn.addEventListener("click", () => {
        if (spotifyActiveSource) loadSpotifyTracks(spotifyActiveSource, spotifyTracksOffset);
      });
    }
  });

  // src/soundcloud.js
  var soundcloud_exports = {};
  __export(soundcloud_exports, {
    closeSoundcloudMode: () => closeSoundcloudMode,
    connectSoundcloud: () => connectSoundcloud,
    createSoundcloudTrackEl: () => createSoundcloudTrackEl,
    disconnectSoundcloud: () => disconnectSoundcloud,
    getSoundcloudActiveIdx: () => getSoundcloudActiveIdx,
    getSoundcloudToken: () => getSoundcloudToken,
    getSoundcloudTracks: () => getSoundcloudTracks,
    getSoundcloudTracksList: () => getSoundcloudTracksList,
    initSoundcloud: () => initSoundcloud,
    isSoundcloudConnected: () => isSoundcloudConnected,
    isSoundcloudMode: () => isSoundcloudMode,
    loadSoundcloudPlaylistTracks: () => loadSoundcloudPlaylistTracks,
    loadSoundcloudPlaylists: () => loadSoundcloudPlaylists,
    loadSoundcloudTracks: () => loadSoundcloudTracks,
    openSoundcloudMode: () => openSoundcloudMode,
    playSoundcloudTrack: () => playSoundcloudTrack,
    registerDeps: () => registerDeps5,
    setArtworkRefs: () => setArtworkRefs,
    setPendingScRestore: () => setPendingScRestore,
    updateSoundcloudUI: () => updateSoundcloudUI
  });
  function registerDeps5(deps) {
    _enterStreamingInfoMode2 = deps.enterStreamingInfoMode;
    _exitStreamingInfoMode2 = deps.exitStreamingInfoMode;
    _showSoundcloudTrackInfo = deps.showSoundcloudTrackInfo;
    _showLiveSpectrum2 = deps.showLiveSpectrum;
    _fancyScrubber2 = deps.fancyScrubber;
    _liveSpectrum2 = deps.liveSpectrum;
    _liveSpectrumWrap2 = deps.liveSpectrumWrap;
    _applyFilter3 = deps.applyFilter;
    _closeSettings2 = deps.closeSettings;
  }
  function setArtworkRefs(path, url) {
    _currentArtworkPath = path;
    _currentArtworkUrl = url;
  }
  async function getSoundcloudToken() {
    if (soundcloudAccessToken && Date.now() < soundcloudTokenExpiry - 6e4) return soundcloudAccessToken;
    const res = await fetch("/api/soundcloud/refresh", { method: "POST" });
    if (!res.ok) throw new Error("SoundCloud token refresh failed");
    const data = await res.json();
    soundcloudAccessToken = data.access_token;
    soundcloudTokenExpiry = data.expires_at || Date.now() + 36e5;
    return soundcloudAccessToken;
  }
  function updateSoundcloudUI() {
    soundcloudBrowserPrompt.classList.toggle("hidden", soundcloudConnected);
    soundcloudPlaylistList.classList.toggle("hidden", !soundcloudConnected);
    const disconnectRow = document.getElementById("soundcloud-disconnect-row");
    if (disconnectRow) disconnectRow.classList.toggle("hidden", !soundcloudConnected);
  }
  async function loadSoundcloudPlaylists() {
    try {
      const res = await fetch("/api/soundcloud/playlists");
      if (!res.ok) return;
      const playlists = await res.json();
      const frag = document.createDocumentFragment();
      const liked = document.createElement("div");
      liked.className = "soundcloud-pl-item soundcloud-pl-active";
      liked.dataset.type = "liked";
      liked.innerHTML = `<span class="soundcloud-pl-icon">&#9829;</span><span class="soundcloud-pl-name">Liked Tracks</span>`;
      liked.addEventListener("click", () => {
        soundcloudPlaylistList.querySelectorAll(".soundcloud-pl-item").forEach((el) => el.classList.remove("soundcloud-pl-active"));
        liked.classList.add("soundcloud-pl-active");
        soundcloudTracks = [];
        soundcloudNextHref = null;
        soundcloudActiveSource = "liked";
        loadSoundcloudTracks(null);
      });
      frag.appendChild(liked);
      for (const pl of playlists) {
        const item = document.createElement("div");
        item.className = "soundcloud-pl-item";
        item.dataset.id = pl.id;
        const count = pl.track_count != null ? pl.track_count : pl.tracks ? pl.tracks.length : "";
        item.innerHTML = `<span class="soundcloud-pl-icon">&#9835;</span><span class="soundcloud-pl-name">${escapeHtml(pl.title || "")}</span><span class="soundcloud-pl-count">${count}</span>`;
        item.addEventListener("click", () => {
          soundcloudPlaylistList.querySelectorAll(".soundcloud-pl-item").forEach((el) => el.classList.remove("soundcloud-pl-active"));
          item.classList.add("soundcloud-pl-active");
          soundcloudActiveSource = { type: "playlist", id: pl.id, tracks: pl.tracks || [] };
          loadSoundcloudPlaylistTracks(pl);
        });
        frag.appendChild(item);
      }
      soundcloudPlaylistList.innerHTML = "";
      soundcloudPlaylistList.appendChild(frag);
    } catch (_) {
    }
  }
  function createSoundcloudTrackEl(track, idx) {
    const el = document.createElement("div");
    el.className = "soundcloud-track-item";
    el.dataset.idx = String(idx);
    const dur = track.duration ? formatDuration(Math.round(track.duration / 1e3)) : "";
    el.innerHTML = `<span class="soundcloud-play-icon">&#9654;</span><div class="soundcloud-track-info"><div class="soundcloud-track-title">${escapeHtml(track.title || "\u2014")}</div><div class="soundcloud-track-artist">${escapeHtml(track.user ? track.user.username : "")}</div></div><span class="soundcloud-track-duration">${escapeHtml(dur)}</span>`;
    el.addEventListener("click", () => playSoundcloudTrack(idx));
    return el;
  }
  function loadSoundcloudPlaylistTracks(pl) {
    soundcloudTracks = (pl.tracks || []).filter((t) => t && t.id);
    soundcloudNextHref = null;
    soundcloudTracksList.innerHTML = "";
    const frag = document.createDocumentFragment();
    soundcloudTracks.forEach((track, idx) => frag.appendChild(createSoundcloudTrackEl(track, idx)));
    soundcloudTracksList.appendChild(frag);
    soundcloudTracksFooter.classList.add("hidden");
  }
  function openSoundcloudMode() {
    Promise.resolve().then(() => (init_spotify(), spotify_exports)).then((sp) => {
      if (sp.isSpotifyMode()) sp.closeSpotifyMode();
    });
    filterInput.value = "";
    filterClear.classList.add("hidden");
    soundcloudMode = true;
    soundcloudBtn.classList.add("active");
    soundcloudBtn.title = "Exit SoundCloud mode";
    folderBrowser.classList.add("hidden");
    soundcloudBrowser.classList.remove("hidden");
    discList.classList.add("hidden");
    soundcloudTracksPanel.classList.remove("hidden");
    if (_enterStreamingInfoMode2) _enterStreamingInfoMode2();
    updateSoundcloudUI();
    if (soundcloudConnected) {
      loadSoundcloudPlaylists();
      if (soundcloudTracks.length === 0) loadSoundcloudTracks(null);
    }
  }
  function closeSoundcloudMode() {
    soundcloudMode = false;
    soundcloudBtn.classList.remove("active");
    soundcloudBtn.title = "SoundCloud Liked Tracks";
    soundcloudBrowser.classList.add("hidden");
    folderBrowser.classList.remove("hidden");
    soundcloudTracksPanel.classList.add("hidden");
    discList.classList.remove("hidden");
    if (_exitStreamingInfoMode2) _exitStreamingInfoMode2();
    if (_liveSpectrum2) _liveSpectrum2.stop();
    if (_liveSpectrumWrap2) _liveSpectrumWrap2.classList.add("hidden");
    STORAGE.clearStreamSession();
  }
  async function loadSoundcloudTracks(nextHref) {
    try {
      const url = nextHref ? `/api/soundcloud/liked?next_href=${encodeURIComponent(nextHref)}` : "/api/soundcloud/liked";
      if (!nextHref) {
        soundcloudTracksList.innerHTML = '<div class="soundcloud-loading">Loading\u2026</div>';
        soundcloudTracksFooter.classList.add("hidden");
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!nextHref) {
        soundcloudTracks = [];
        soundcloudTracksList.innerHTML = "";
      }
      const startIdx = soundcloudTracks.length;
      soundcloudTracks.push(...data.collection || []);
      soundcloudNextHref = data.next_href || null;
      const frag = document.createDocumentFragment();
      (data.collection || []).forEach((track, i) => {
        frag.appendChild(createSoundcloudTrackEl(track, startIdx + i));
      });
      soundcloudTracksList.appendChild(frag);
      soundcloudTracksFooter.classList.toggle("hidden", !soundcloudNextHref);
      if (_applyFilter3 && filterInput.value) _applyFilter3(filterInput.value);
      if (pendingScRestore && !nextHref) {
        const { trackIdx, position } = pendingScRestore;
        pendingScRestore = null;
        if (soundcloudTracks[trackIdx]) {
          playSoundcloudTrack(trackIdx);
          audio.addEventListener("canplay", function seekOnce() {
            audio.removeEventListener("canplay", seekOnce);
            audio.currentTime = position || 0;
          });
        }
      }
    } catch (err) {
      soundcloudTracksList.innerHTML = `<div class="soundcloud-loading" style="color:#c06060">Error: ${escapeHtml(err.message)}</div>`;
    }
  }
  async function playSoundcloudTrack(idx) {
    const track = soundcloudTracks[idx];
    if (!track) return;
    soundcloudActiveIdx = idx;
    Promise.resolve().then(() => (init_spotify(), spotify_exports)).then((sp) => {
      const player = sp.getSpotifyPlayer();
      if (player && sp.getSpotifyCurrentUri()) {
        player.pause().catch(() => {
        });
      }
    });
    state.currentDiscId = null;
    artworkImg.src = "";
    artworkPane.classList.add("hidden");
    npSection.classList.remove("has-artwork");
    npSection.style.removeProperty("--artwork");
    if (_fancyScrubber2) _fancyScrubber2.clear();
    if (_showLiveSpectrum2) _showLiveSpectrum2();
    audio.src = `/api/soundcloud/stream/${encodeURIComponent(track.id)}`;
    audio.play().catch(() => {
    });
    npDisc.textContent = track.user ? track.user.username : "";
    npTitle.textContent = track.title || "\u2014";
    npPerformer.textContent = "";
    npTrackNumber.textContent = "";
    btnPlay.innerHTML = "&#9646;&#9646;";
    if (_showSoundcloudTrackInfo) _showSoundcloudTrackInfo(track);
    soundcloudTracksList.querySelectorAll(".soundcloud-track-item").forEach((el) => {
      el.classList.toggle("soundcloud-track-active", Number(el.dataset.idx) === idx);
    });
  }
  async function initSoundcloud() {
    try {
      const statusRes = await fetch("/api/soundcloud/status");
      if (!statusRes.ok) return;
      const status = await statusRes.json();
      soundcloudConnected = status.connected;
      updateSoundcloudUI();
    } catch (_) {
    }
  }
  async function connectSoundcloud() {
    const popup = window.open("", "soundcloud-auth", "width=500,height=700,menubar=no,toolbar=no");
    if (!popup) {
      alert("Popup blocked. Please allow popups for this page.");
      return;
    }
    try {
      const urlRes = await fetch("/api/soundcloud/auth-url");
      if (!urlRes.ok) {
        popup.close();
        alert("Please configure your SoundCloud Client ID and Secret in Settings first.");
        return;
      }
      const { url } = await urlRes.json();
      popup.location.href = url;
    } catch (_) {
      popup.close();
      return;
    }
    soundcloudPollTimer = setInterval(async () => {
      try {
        const status = await fetch("/api/soundcloud/status").then((r) => r.json());
        if (status.connected) {
          clearInterval(soundcloudPollTimer);
          soundcloudPollTimer = null;
          soundcloudConnected = true;
          updateSoundcloudUI();
          if (soundcloudMode) {
            loadSoundcloudPlaylists();
            loadSoundcloudTracks(null);
          }
        }
      } catch (_) {
      }
    }, 2e3);
  }
  async function disconnectSoundcloud() {
    await fetch("/api/soundcloud/disconnect", { method: "POST" }).catch(() => {
    });
    soundcloudConnected = false;
    soundcloudAccessToken = null;
    soundcloudTokenExpiry = 0;
    soundcloudTracks = [];
    soundcloudNextHref = null;
    soundcloudActiveIdx = -1;
    soundcloudTracksList.innerHTML = "";
    soundcloudTracksFooter.classList.add("hidden");
    soundcloudPlaylistList.innerHTML = "";
    closeSoundcloudMode();
  }
  function isSoundcloudMode() {
    return soundcloudMode;
  }
  function isSoundcloudConnected() {
    return soundcloudConnected;
  }
  function getSoundcloudActiveIdx() {
    return soundcloudActiveIdx;
  }
  function getSoundcloudTracks() {
    return soundcloudTracks;
  }
  function getSoundcloudTracksList() {
    return soundcloudTracksList;
  }
  function setPendingScRestore(v) {
    pendingScRestore = v;
  }
  var _enterStreamingInfoMode2, _exitStreamingInfoMode2, _showSoundcloudTrackInfo, _showLiveSpectrum2, _fancyScrubber2, _liveSpectrum2, _liveSpectrumWrap2, _currentArtworkPath, _currentArtworkUrl, _applyFilter3, _closeSettings2, soundcloudConnected, soundcloudAccessToken, soundcloudTokenExpiry, soundcloudPollTimer, soundcloudMode, soundcloudTracks, soundcloudNextHref, soundcloudActiveIdx, soundcloudActiveSource, pendingScRestore, soundcloudBtn, soundcloudBrowser, soundcloudBrowserPrompt, soundcloudBrowserConnectBtn, soundcloudPlaylistList, soundcloudTracksPanel, soundcloudTracksList, soundcloudTracksFooter, soundcloudTracksLoadMoreBtn;
  var init_soundcloud = __esm({
    "src/soundcloud.js"() {
      init_state();
      init_helpers();
      init_dom_refs();
      _enterStreamingInfoMode2 = null;
      _exitStreamingInfoMode2 = null;
      _showSoundcloudTrackInfo = null;
      _showLiveSpectrum2 = null;
      _fancyScrubber2 = null;
      _liveSpectrum2 = null;
      _liveSpectrumWrap2 = null;
      _currentArtworkPath = null;
      _currentArtworkUrl = null;
      _applyFilter3 = null;
      _closeSettings2 = null;
      soundcloudConnected = false;
      soundcloudAccessToken = null;
      soundcloudTokenExpiry = 0;
      soundcloudPollTimer = null;
      soundcloudMode = false;
      soundcloudTracks = [];
      soundcloudNextHref = null;
      soundcloudActiveIdx = -1;
      soundcloudActiveSource = "liked";
      pendingScRestore = null;
      soundcloudBtn = document.getElementById("soundcloud-btn");
      soundcloudBrowser = document.getElementById("soundcloud-browser");
      soundcloudBrowserPrompt = document.getElementById("soundcloud-browser-prompt");
      soundcloudBrowserConnectBtn = document.getElementById("soundcloud-browser-connect-btn");
      soundcloudPlaylistList = document.getElementById("soundcloud-playlist-list");
      soundcloudTracksPanel = document.getElementById("soundcloud-tracks-panel");
      soundcloudTracksList = document.getElementById("soundcloud-tracks-list");
      soundcloudTracksFooter = document.getElementById("soundcloud-tracks-footer");
      soundcloudTracksLoadMoreBtn = document.getElementById("soundcloud-tracks-load-more-btn");
      soundcloudBtn.addEventListener("click", () => {
        if (soundcloudMode) closeSoundcloudMode();
        else openSoundcloudMode();
      });
      document.getElementById("local-btn").addEventListener("click", () => {
        Promise.resolve().then(() => (init_spotify(), spotify_exports)).then((sp) => {
          if (sp.isSpotifyMode()) sp.closeSpotifyMode();
          else if (soundcloudMode) closeSoundcloudMode();
        });
      });
      soundcloudBrowserConnectBtn.addEventListener("click", connectSoundcloud);
      soundcloudTracksLoadMoreBtn.addEventListener("click", () => {
        if (soundcloudNextHref) loadSoundcloudTracks(soundcloudNextHref);
      });
    }
  });

  // src/app.js
  init_state();
  init_helpers();
  init_dom_refs();

  // src/playback.js
  init_state();
  init_helpers();
  init_dom_refs();

  // src/lastfm.js
  init_state();
  var _scrobbleState = { trackKey: "", startTime: 0, scrobbled: false };
  function lastfmUpdateNowPlaying(disc, trackIdx) {
    const t = disc.tracks[trackIdx];
    if (!t) return;
    fetch("/api/lastfm/now-playing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artist: t.performer || disc.albumPerformer || "Unknown",
        track: t.title || "Unknown",
        album: disc.albumTitle || ""
      })
    }).catch(() => {
    });
  }
  function lastfmScrobble(disc, trackIdx) {
    const t = disc.tracks[trackIdx];
    if (!t) return;
    fetch("/api/lastfm/scrobble", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artist: t.performer || disc.albumPerformer || "Unknown",
        track: t.title || "Unknown",
        album: disc.albumTitle || "",
        timestamp: Math.floor(Date.now() / 1e3)
      })
    }).catch(() => {
    });
  }
  function checkScrobble(disc, trackIdx) {
    const t = disc.tracks[trackIdx];
    if (!t) return;
    const key = `${disc.mp3Path}:${trackIdx}`;
    if (_scrobbleState.trackKey !== key) {
      if (_scrobbleState.trackKey && !_scrobbleState.scrobbled) {
        const elapsed = (Date.now() - _scrobbleState.startTime) / 1e3;
        if (elapsed >= 30) {
          const [oldPath, oldIdx] = _scrobbleState.trackKey.split(":");
          const oldDisc = state.discs.find((d) => d.mp3Path === oldPath);
          if (oldDisc) lastfmScrobble(oldDisc, parseInt(oldIdx, 10));
        }
      }
      _scrobbleState = { trackKey: key, startTime: Date.now(), scrobbled: false };
      lastfmUpdateNowPlaying(disc, trackIdx);
    } else if (!_scrobbleState.scrobbled) {
      const elapsed = (Date.now() - _scrobbleState.startTime) / 1e3;
      const trackDur = t.durationSeconds || 240;
      if (elapsed >= 30 && elapsed >= trackDur * 0.5) {
        lastfmScrobble(disc, trackIdx);
        _scrobbleState.scrobbled = true;
      }
    }
  }
  var lastfmApiKeyInput = document.getElementById("lastfm-api-key-input");
  var lastfmSecretInput = document.getElementById("lastfm-shared-secret-input");
  var lastfmStatusEl = document.getElementById("lastfm-settings-status");
  var lastfmDisconnectRow = document.getElementById("lastfm-disconnect-row");
  async function initLastfmSettings() {
    try {
      const res = await fetch("/api/lastfm/config");
      if (!res.ok) return;
      const cfg = await res.json();
      if (cfg.api_key) lastfmApiKeyInput.value = cfg.api_key;
      if (cfg.connected) {
        lastfmStatusEl.textContent = `Connected as ${cfg.username}`;
        lastfmDisconnectRow.classList.remove("hidden");
      }
    } catch (_) {
    }
  }
  document.getElementById("lastfm-save-creds-btn")?.addEventListener("click", async () => {
    const apiKey = lastfmApiKeyInput.value.trim();
    const sharedSecret = lastfmSecretInput.value.trim();
    if (!apiKey || !sharedSecret) return;
    const res = await fetch("/api/lastfm/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, sharedSecret })
    });
    lastfmStatusEl.textContent = res.ok ? "Credentials saved" : "Failed to save";
  });
  document.getElementById("lastfm-connect-btn")?.addEventListener("click", async () => {
    const res = await fetch("/api/lastfm/auth-url");
    if (!res.ok) return;
    const { url } = await res.json();
    window.open(url, "_blank");
    lastfmStatusEl.textContent = "Authorize in browser, then return here...";
    const poll = setInterval(async () => {
      const r = await fetch("/api/lastfm/config");
      if (!r.ok) return;
      const cfg = await r.json();
      if (cfg.connected) {
        clearInterval(poll);
        lastfmStatusEl.textContent = `Connected as ${cfg.username}`;
        lastfmDisconnectRow.classList.remove("hidden");
      }
    }, 3e3);
    setTimeout(() => clearInterval(poll), 12e4);
  });
  document.getElementById("lastfm-disconnect-btn")?.addEventListener("click", async () => {
    await fetch("/api/lastfm/disconnect", { method: "POST" });
    lastfmStatusEl.textContent = "Disconnected";
    lastfmDisconnectRow.classList.add("hidden");
  });

  // src/discord.js
  init_dom_refs();
  function updateDiscordPresence(disc, trackIdx) {
    if (!window.electronAPI?.updateDiscordPresence) return;
    const t = disc?.tracks?.[trackIdx];
    window.electronAPI.updateDiscordPresence({
      track: t?.title || disc?.albumTitle || "",
      artist: t?.performer || disc?.albumPerformer || "",
      mix: disc?.albumTitle || "",
      playing: !audio.paused,
      elapsed: audio.currentTime
    });
  }

  // src/queue.js
  init_state();
  init_helpers();
  init_dom_refs();

  // src/export.js
  init_helpers();
  init_dom_refs();
  function showToast(msg) {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText = "position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:var(--bg2);border:1px solid var(--accent);color:var(--text);padding:6px 14px;border-radius:var(--radius);font-size:12px;z-index:9999;pointer-events:none;";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2e3);
  }
  function exportTracklistAsText() {
    const disc = currentDisc();
    if (!disc || !disc.tracks.length) return;
    const lines = disc.tracks.map((t) => {
      const num = String(t.track).padStart(2, "0");
      const time = formatTime(t.startSeconds);
      const artist = t.performer ? `${t.performer} - ` : "";
      return `${num}. ${artist}${t.title} [${time}]`;
    });
    const header = disc.albumTitle ? `${disc.albumTitle}
${"\u2500".repeat(disc.albumTitle.length)}
` : "";
    navigator.clipboard.writeText(header + lines.join("\n")).then(() => {
      showToast("Tracklist copied to clipboard");
    });
  }
  function exportTracklistAsM3U() {
    const disc = currentDisc();
    if (!disc || !disc.tracks.length) return;
    let m3u = "#EXTM3U\n";
    disc.tracks.forEach((t) => {
      const dur = Math.round(t.durationSeconds || 0);
      const artist = t.performer || disc.albumPerformer || "Unknown";
      m3u += `#EXTINF:${dur},${artist} - ${t.title}
`;
      m3u += `${disc.mp3File}
`;
    });
    const blob = new Blob([m3u], { type: "audio/x-mpegurl" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (disc.albumTitle || disc.mp3File).replace(/\.[^.]+$/, "") + ".m3u";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  var _exportDropdown = null;
  exportBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (_exportDropdown) {
      _exportDropdown.remove();
      _exportDropdown = null;
      return;
    }
    const dd = document.createElement("div");
    dd.id = "export-dropdown";
    const b1 = document.createElement("button");
    b1.textContent = "Copy as text";
    b1.addEventListener("click", () => {
      exportTracklistAsText();
      dd.remove();
      _exportDropdown = null;
    });
    const b2 = document.createElement("button");
    b2.textContent = "Download M3U";
    b2.addEventListener("click", () => {
      exportTracklistAsM3U();
      dd.remove();
      _exportDropdown = null;
    });
    dd.append(b1, b2);
    exportBtn.style.position = "relative";
    exportBtn.appendChild(dd);
    _exportDropdown = dd;
  });
  document.addEventListener("click", () => {
    if (_exportDropdown) {
      _exportDropdown.remove();
      _exportDropdown = null;
    }
  });

  // src/queue.js
  var _playDiscAtTrack = null;
  function registerPlayback(fn) {
    _playDiscAtTrack = fn;
  }
  function addToQueue(disc, trackIdx) {
    const t = disc.tracks[trackIdx];
    if (!t) return;
    state.queue.push({
      discId: disc.id,
      trackIdx,
      title: t.title || disc.albumTitle,
      performer: t.performer || disc.albumPerformer || ""
    });
    STORAGE.setQueue(state.queue);
    renderQueue();
    showToast("Added to queue");
  }
  function renderQueue() {
    queueList.innerHTML = "";
    queueCount.textContent = state.queue.length ? `(${state.queue.length})` : "";
    state.queue.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "queue-item";
      row.innerHTML = `<span class="queue-item-title">${escapeHtml(item.title)}</span>
      <span class="queue-item-artist">${escapeHtml(item.performer)}</span>
      <button class="queue-item-remove" title="Remove">&#x2715;</button>`;
      row.querySelector(".queue-item-remove").addEventListener("click", (e) => {
        e.stopPropagation();
        state.queue.splice(i, 1);
        STORAGE.setQueue(state.queue);
        renderQueue();
      });
      row.addEventListener("click", () => {
        const entry = state.queue.splice(i, 1)[0];
        STORAGE.setQueue(state.queue);
        renderQueue();
        const disc = state.discs.find((d) => d.id === entry.discId);
        if (disc && _playDiscAtTrack) _playDiscAtTrack(disc, entry.trackIdx);
      });
      queueList.appendChild(row);
    });
  }
  function playFromQueue() {
    if (!state.queue.length) return false;
    const entry = state.queue.shift();
    STORAGE.setQueue(state.queue);
    renderQueue();
    const disc = state.discs.find((d) => d.id === entry.discId);
    if (disc && _playDiscAtTrack) {
      _playDiscAtTrack(disc, entry.trackIdx);
      return true;
    }
    return false;
  }
  document.getElementById("queue-btn").addEventListener("click", () => {
    queuePanel.classList.toggle("hidden");
    bookmarksPanel.classList.add("hidden");
  });
  document.getElementById("queue-close").addEventListener("click", () => queuePanel.classList.add("hidden"));
  document.getElementById("queue-clear").addEventListener("click", () => {
    state.queue = [];
    STORAGE.setQueue([]);
    renderQueue();
  });

  // src/bookmarks.js
  init_state();
  init_helpers();
  init_dom_refs();
  var _ovScrubber = null;
  var _zmScrubber = null;
  function registerScrubbers(ov, zm) {
    _ovScrubber = ov;
    _zmScrubber = zm;
  }
  function loadBookmarks() {
    state.bookmarks = STORAGE.getBookmarks();
  }
  function saveBookmarks() {
    STORAGE.setBookmarks(state.bookmarks);
  }
  function addBookmark(label) {
    const disc = currentDisc();
    if (!disc || !disc.mp3Path) return;
    const key = disc.mp3Path;
    if (!state.bookmarks[key]) state.bookmarks[key] = [];
    state.bookmarks[key].push({ time: audio.currentTime, label: label || `Bookmark @ ${formatTime(audio.currentTime)}` });
    state.bookmarks[key].sort((a, b) => a.time - b.time);
    saveBookmarks();
    renderBookmarks();
    updateScrubberBookmarks();
    showToast("Bookmark added");
  }
  function renderBookmarks() {
    const disc = currentDisc();
    const key = disc?.mp3Path;
    const bms = key ? state.bookmarks[key] || [] : [];
    bookmarksCount.textContent = bms.length ? `(${bms.length})` : "";
    bookmarksList.innerHTML = "";
    bms.forEach((bm, i) => {
      const row = document.createElement("div");
      row.className = "bookmark-item";
      row.innerHTML = `<span class="bookmark-time">${formatTime(bm.time)}</span>
      <span class="bookmark-label">${escapeHtml(bm.label)}</span>
      <button class="bookmark-delete" title="Remove">&#x2715;</button>`;
      row.querySelector(".bookmark-delete").addEventListener("click", (e) => {
        e.stopPropagation();
        state.bookmarks[key].splice(i, 1);
        if (!state.bookmarks[key].length) delete state.bookmarks[key];
        saveBookmarks();
        renderBookmarks();
        updateScrubberBookmarks();
      });
      row.addEventListener("click", () => {
        audio.currentTime = bm.time;
        if (audio.paused) audio.play().catch(() => {
        });
      });
      bookmarksList.appendChild(row);
    });
  }
  function updateScrubberBookmarks() {
    const disc = currentDisc();
    const key = disc?.mp3Path;
    const bms = key ? state.bookmarks[key] || [] : [];
    if (_ovScrubber) _ovScrubber.setBookmarks(bms);
    if (_zmScrubber) _zmScrubber.setBookmarks(bms);
  }
  document.getElementById("bookmarks-btn").addEventListener("click", () => {
    bookmarksPanel.classList.toggle("hidden");
    queuePanel.classList.add("hidden");
    renderBookmarks();
  });
  document.getElementById("bookmarks-close").addEventListener("click", () => bookmarksPanel.classList.add("hidden"));

  // src/nfo-pane.js
  init_state();
  init_helpers();
  init_dom_refs();
  var nfoTabNfo = document.getElementById("nfo-tab-nfo");
  var nfoTabTracklist = document.getElementById("nfo-tab-tracklist");
  var tracklistContent = document.getElementById("tracklist-content");
  var nfoTabDetect = document.getElementById("nfo-tab-detect");
  var nfoDetectBtn = document.getElementById("nfo-detect-btn");
  var nfoTabDetectBtn = document.getElementById("nfo-tab-detect-btn");
  var detectStatus = document.getElementById("detect-status");
  var detectTracksList = document.getElementById("detect-tracks-list");
  var detectApplyBtn = document.getElementById("detect-apply-btn");
  var streamInfoPanel = document.getElementById("stream-info-panel");
  var streamInfoContent = document.getElementById("stream-info-content");
  var nfoPaneClose = document.getElementById("nfo-pane-close");
  var nfoPaneExpandBtn = document.getElementById("nfo-pane-expand");
  var activeInfoTab = "nfo";
  var lastNfoDir = "";
  var lastNfoText = "";
  var currentArtworkUrl = null;
  var nfoPaneIsExpanded = false;
  var savedMainTopH = null;
  var _playDiscAtTrack2 = null;
  var _isSoundcloudMode = null;
  var _isSpotifyMode = null;
  function registerDeps(deps) {
    _playDiscAtTrack2 = deps.playDiscAtTrack;
    _isSoundcloudMode = deps.isSoundcloudMode;
    _isSpotifyMode = deps.isSpotifyMode;
  }
  function setCurrentArtworkUrl(url) {
    currentArtworkUrl = url;
  }
  function getLastNfoText() {
    return lastNfoText;
  }
  function setLastNfoText(v) {
    lastNfoText = v;
  }
  function switchInfoTab(tab) {
    activeInfoTab = tab;
    document.querySelectorAll(".nfo-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    nfoTabNfo.classList.toggle("hidden", tab !== "nfo");
    nfoTabTracklist.classList.toggle("hidden", tab !== "tracklist");
    nfoTabDetect.classList.toggle("hidden", tab !== "detect");
  }
  document.getElementById("nfo-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".nfo-tab");
    if (btn) switchInfoTab(btn.dataset.tab);
  });
  function setNfoPaneVisible(visible) {
    if (_isSoundcloudMode && _isSoundcloudMode()) return;
    if (_isSpotifyMode && _isSpotifyMode()) return;
    nfoPane.classList.toggle("hidden", !visible);
    artworkPane.classList.toggle("hidden", visible || !currentArtworkUrl);
  }
  var nfoTabs = document.getElementById("nfo-tabs");
  function enterStreamingInfoMode() {
    nfoTabs.classList.add("hidden");
    nfoTabNfo.classList.add("hidden");
    if (nfoTabTracklist) nfoTabTracklist.classList.add("hidden");
    nfoTabDetect.classList.add("hidden");
    nfoDetectBtn.classList.add("hidden");
    streamInfoPanel.classList.remove("hidden");
    nfoPane.classList.remove("hidden");
    artworkPane.classList.add("hidden");
    localBtn.classList.remove("hidden");
  }
  function exitStreamingInfoMode() {
    streamInfoPanel.classList.add("hidden");
    streamInfoContent.innerHTML = "";
    nfoTabs.classList.remove("hidden");
    nfoTabNfo.classList.remove("hidden");
    nfoPane.classList.add("hidden");
    artworkPane.classList.toggle("hidden", !currentArtworkUrl);
    localBtn.classList.add("hidden");
  }
  function renderStreamInfo(rows, description, pageUrl) {
    const linkify = (text) => escapeHtml(text).replace(
      /https?:\/\/[^\s<>"]+/g,
      (url) => `<a class="nfo-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`
    );
    let html = '<table class="stream-info-table">';
    for (const [label, value] of rows) {
      if (!value) continue;
      html += `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(String(value))}</td></tr>`;
    }
    if (pageUrl && /^https?:\/\//i.test(pageUrl)) {
      const clean = pageUrl.replace(/[?&]utm_[^&]*/g, "").replace(/[?&]$/, "");
      html += `<tr><th>Link</th><td><a class="nfo-link" href="${escapeHtml(clean)}" target="_blank" rel="noopener noreferrer">${escapeHtml(clean)}</a></td></tr>`;
    }
    html += "</table>";
    if (description && description.trim()) {
      html += `<div class="stream-info-desc">${linkify(description)}</div>`;
    }
    streamInfoContent.innerHTML = html;
  }
  function showSoundcloudTrackInfo(track) {
    const tags = (track.tag_list || "").split(/\s+/).filter(Boolean).join(", ");
    const plays = track.playback_count ? track.playback_count.toLocaleString() : null;
    const favs = track.favoritings_count ? track.favoritings_count.toLocaleString() : null;
    const bpm = track.bpm || null;
    const key = track.key_signature || null;
    const date = track.created_at ? track.created_at.slice(0, 10) : null;
    renderStreamInfo([
      ["Artist", track.user && track.user.username],
      ["Genre", track.genre],
      ["Tags", tags || null],
      ["BPM", bpm],
      ["Key", key],
      ["Duration", formatDurationMs(track.duration)],
      ["Plays", plays],
      ["Likes", favs],
      ["Released", date],
      ["Label", track.label_name]
    ], track.description, track.permalink_url);
  }
  function showSpotifyTrackInfo(item) {
    const artists = (item.artists || []).map((a) => a.name).join(", ");
    const album = item.album && item.album.name;
    const release = item.album && item.album.release_date;
    const duration = item.duration_ms ? formatDurationMs(item.duration_ms) : null;
    renderStreamInfo([
      ["Artists", artists],
      ["Album", album],
      ["Released", release],
      ["Duration", duration]
    ], null);
  }
  var URL_RE = /https?:\/\/[^\s\])"'>]+/g;
  function linkifyNfo(html) {
    return html.replace(URL_RE, (url) => `<a class="nfo-link" href="${url}" title="${url}">${url}</a>`);
  }
  function highlightNfo() {
    if (!lastNfoText) return;
    const disc = currentDisc();
    const title = disc && state.currentTrackIndex >= 0 ? (disc.tracks[state.currentTrackIndex] || {}).title : null;
    const escaped = escapeHtml(lastNfoText);
    if (!title) {
      nfoContent.innerHTML = linkifyNfo(escaped);
      return;
    }
    const escapedTitle = escapeHtml(title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const highlighted = escaped.replace(
      new RegExp(escapedTitle, "gi"),
      (m) => `<mark class="nfo-hl">${m}</mark>`
    );
    nfoContent.innerHTML = linkifyNfo(highlighted);
    const first = nfoContent.querySelector(".nfo-hl");
    if (first) first.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  nfoContent.addEventListener("click", (e) => {
    const link = e.target.closest(".nfo-link");
    if (!link) return;
    e.preventDefault();
    const url = link.href;
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, "_blank", "noopener");
    }
  });
  function renderTracklist(disc) {
    if (!disc || !disc.tracks || disc.tracks.length === 0) {
      tracklistContent.innerHTML = '<div style="padding:14px;font-size:12px;color:var(--text-muted)">No tracks</div>';
      return;
    }
    tracklistContent.innerHTML = disc.tracks.map((t, i) => `
    <div class="tl-track${i === state.currentTrackIndex ? " active" : ""}" data-idx="${i}">
      <span class="tl-num">${String(t.track || i + 1).padStart(2, "0")}</span>
      <span class="tl-title">${escapeHtml(t.title || "")}</span>
      ${t.performer ? `<span class="tl-performer">${escapeHtml(t.performer)}</span>` : ""}
      <span class="tl-time">${formatTime(t.startSeconds)}</span>
    </div>`).join("");
  }
  function highlightTracklist() {
    document.querySelectorAll(".tl-track").forEach((row) => {
      const active = parseInt(row.dataset.idx, 10) === state.currentTrackIndex;
      row.classList.toggle("active", active);
      if (active) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }
  tracklistContent.addEventListener("click", (e) => {
    const row = e.target.closest(".tl-track");
    if (!row) return;
    const disc = currentDisc();
    if (!disc) return;
    const idx = parseInt(row.dataset.idx, 10);
    if (_playDiscAtTrack2) _playDiscAtTrack2(disc, idx);
  });
  function setNfoPaneExpanded(expanded) {
    if (nfoPaneIsExpanded === expanded) return;
    nfoPaneIsExpanded = expanded;
    if (expanded) {
      savedMainTopH = mainTop.style.height || null;
      mainTop.style.height = "0px";
      mainTop.style.overflow = "hidden";
      mainResizeH.style.display = "none";
      nfoPaneExpandBtn.innerHTML = "&#x2923;";
      nfoPaneExpandBtn.title = "Collapse tracklist pane";
    } else {
      mainTop.style.overflow = "";
      mainResizeH.style.display = "";
      if (savedMainTopH) {
        mainTop.style.height = savedMainTopH;
      } else {
        mainTop.style.height = "";
      }
      savedMainTopH = null;
      nfoPaneExpandBtn.innerHTML = "&#x2922;";
      nfoPaneExpandBtn.title = "Expand tracklist pane";
    }
  }
  nfoPaneExpandBtn.addEventListener("click", () => {
    setNfoPaneExpanded(!nfoPaneIsExpanded);
  });
  nfoPaneClose.addEventListener("click", () => {
    setNfoPaneExpanded(false);
    setNfoPaneVisible(false);
    const nfoBtn2 = document.getElementById("nfo-btn");
    if (lastNfoDir || currentDisc()) nfoBtn2.classList.remove("hidden");
  });
  document.getElementById("nfo-btn").addEventListener("click", () => {
    setNfoPaneVisible(true);
    document.getElementById("nfo-btn").classList.add("hidden");
  });

  // src/tracklist-finder.js
  init_state();
  init_helpers();
  init_dom_refs();
  var tlModalOverlay = document.getElementById("tl-modal-overlay");
  var tlQueryInput = document.getElementById("tl-query-input");
  var tlSearchGo = document.getElementById("tl-search-go");
  var tlResults = document.getElementById("tl-results");
  var tlTracksPane = document.getElementById("tl-tracks-pane");
  var tlTracksList = document.getElementById("tl-tracks-list");
  var tlTracksTitle = document.getElementById("tl-tracks-title");
  var tlApplyBtn = document.getElementById("tl-apply-btn");
  var tlSourceLink = document.getElementById("tl-source-link");
  var tlBackBtn = document.getElementById("tl-back-btn");
  var tlTargetDisc = null;
  var tlStagedTracks = null;
  var lastNfoParsedTracks = null;
  var detectStagedTracks = null;
  var _renderDiscList = null;
  var _loadDisc = null;
  var _isSoundcloudMode2 = null;
  var _isSpotifyMode2 = null;
  function registerDeps2(deps) {
    _renderDiscList = deps.renderDiscList;
    _loadDisc = deps.loadDisc;
    if (deps.isSoundcloudMode) _isSoundcloudMode2 = deps.isSoundcloudMode;
    if (deps.isSpotifyMode) _isSpotifyMode2 = deps.isSpotifyMode;
  }
  function getLastNfoParsedTracks() {
    return lastNfoParsedTracks;
  }
  function setLastNfoParsedTracks(v) {
    lastNfoParsedTracks = v;
  }
  function parseNfoTracklist(text, mp3Path) {
    if (!text) return null;
    let targetDisc = 1;
    if (mp3Path) {
      const fname = mp3Path.split("/").pop().toLowerCase();
      const cdMatch = fname.match(/(?:cd|dis[ck])[-_]?(\d+)/i);
      const prefixMatch = !cdMatch && fname.match(/^(\d)(?=\d{2}[-_])/);
      if (cdMatch) targetDisc = parseInt(cdMatch[1], 10);
      else if (prefixMatch) targetDisc = parseInt(prefixMatch[1], 10);
    }
    let parseText = text;
    if (/^Disc\s+\d+\/\d+/im.test(text)) {
      const positions = [];
      const sRe = /^Disc\s+(\d+)\/\d+/gim;
      let sm;
      while ((sm = sRe.exec(text)) !== null) {
        positions.push({ disc: parseInt(sm[1], 10), index: sm.index });
      }
      if (positions.length > 0) {
        const chosenIdx = positions.findIndex((p) => p.disc === targetDisc);
        const ci = chosenIdx >= 0 ? chosenIdx : 0;
        const end = ci + 1 < positions.length ? positions[ci + 1].index : text.length;
        parseText = text.slice(positions[ci].index, end);
      }
    }
    const re = /^\s*(\d{1,3})(?:[.)]\s+|\s+)([A-Za-z].+)/gm;
    const entries = [];
    let m;
    while ((m = re.exec(parseText)) !== null) {
      const raw = m[2].trim();
      const durMatch = raw.match(/\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*$/);
      const durStr = durMatch ? durMatch[1] : null;
      const line = raw.replace(/\s+\d{1,2}:\d{2}(?::\d{2})?\s*$/, "").trim();
      if (!line) continue;
      entries.push({ num: parseInt(m[1], 10), line, durStr });
    }
    if (entries.length < 3) return null;
    if (entries[0].num > 2) return null;
    const parseDur = (s) => {
      if (!s) return null;
      const parts = s.split(":").map(Number);
      return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
    };
    let cumSecs = 0;
    return entries.map((e, i) => {
      const startSeconds = cumSecs;
      const trackSecs = parseDur(e.durStr);
      if (trackSecs !== null) cumSecs += trackSecs;
      const sepMatch = e.line.match(/^(.+?)\s+(?:–|—|-)\s+(.+)$/);
      return {
        track: i + 1,
        performer: sepMatch ? sepMatch[1].trim() : "",
        title: sepMatch ? sepMatch[2].trim() : e.line,
        startSeconds
      };
    });
  }
  async function runDetectTransitions() {
    const disc = currentDisc();
    if (!disc || !disc.mp3Path || !lastNfoParsedTracks) return;
    detectStatus.textContent = "Analyzing waveform\u2026";
    detectTracksList.innerHTML = "";
    detectApplyBtn.disabled = true;
    detectStagedTracks = null;
    try {
      const count = lastNfoParsedTracks.length;
      const bucketMs = STORAGE.getSpectrumRes();
      const url = `/api/detect-transitions?path=${encodeURIComponent(disc.mp3Path)}&count=${count}&bucketMs=${bucketMs}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      const data = await res.json();
      detectStagedTracks = data.transitions.map((tr, i) => {
        const nfoTrack = lastNfoParsedTracks[i] || { track: i + 1, title: "(unknown)", performer: "" };
        return {
          track: nfoTrack.track,
          title: nfoTrack.title,
          performer: nfoTrack.performer,
          startSeconds: tr.seconds,
          _confidence: tr.confidence
        };
      });
      detectStatus.textContent = `Found ${detectStagedTracks.length} track${detectStagedTracks.length !== 1 ? "s" : ""}`;
      detectTracksList.innerHTML = detectStagedTracks.map((t) => {
        const mm = Math.floor(t.startSeconds / 60);
        const ss = String(t.startSeconds % 60).padStart(2, "0");
        const timeLabel = `${mm}:${ss}`;
        const confClass = t._confidence >= 0.6 ? "detect-conf-high" : t._confidence >= 0.3 ? "detect-conf-mid" : "detect-conf-low";
        const label = t.performer ? `${t.performer} - ${t.title}` : t.title;
        return `<div class="detect-track-item">
        <span class="detect-track-time">${timeLabel}</span>
        <span class="detect-conf-dot ${confClass}"></span>
        <span class="detect-track-name">${escapeHtml(label)}</span>
      </div>`;
      }).join("");
      detectApplyBtn.disabled = false;
    } catch (e) {
      detectStatus.textContent = `Error: ${escapeHtml(e.message)}`;
    }
  }
  function extractTlQuery(disc) {
    const folder = disc.mp3Path ? disc.mp3Path.replace(/\/[^/]+$/, "").split("/").pop() : disc.albumTitle || "";
    let q = folder.replace(/[_]/g, " ").replace(/-/g, " ");
    q = q.replace(/\b[A-Z]{2,10}\b/g, "");
    q = q.replace(/\b(?!\d{4}\b)\d{1,2}\b/g, "");
    return q.replace(/\s+/g, " ").trim();
  }
  function openTlFinder(disc) {
    tlTargetDisc = disc;
    tlStagedTracks = null;
    tlModalOverlay.classList.add("active");
    tlQueryInput.value = extractTlQuery(disc);
    tlResults.innerHTML = "";
    tlResults.classList.remove("hidden");
    tlTracksPane.classList.add("hidden");
    tlQueryInput.focus();
    tlQueryInput.select();
    if (tlQueryInput.value.length > 3) runTlSearch(tlQueryInput.value);
  }
  function closeTlFinder() {
    tlModalOverlay.classList.remove("active");
    tlTargetDisc = null;
    tlStagedTracks = null;
  }
  async function runTlSearch(query) {
    tlResults.innerHTML = '<div class="tl-msg">Searching MixesDB\u2026</div>';
    tlResults.classList.remove("hidden");
    tlTracksPane.classList.add("hidden");
    try {
      const res = await fetch(`/api/tracklist-search?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      const { results } = await res.json();
      if (!results.length) {
        tlResults.innerHTML = '<div class="tl-msg">No results \u2014 try different search terms.</div>';
        return;
      }
      tlResults.innerHTML = results.map(
        (r) => `<div class="tl-result-item" data-url="${escapeHtml(r.url)}">
        <span class="tl-result-title">${escapeHtml(r.title)}</span>
        <span class="tl-result-arrow">&#x203A;</span>
      </div>`
      ).join("");
      tlResults.querySelectorAll(".tl-result-item").forEach((el) => {
        el.addEventListener(
          "click",
          () => showTlTracks(el.dataset.url, el.querySelector(".tl-result-title").textContent)
        );
      });
    } catch (e) {
      tlResults.innerHTML = `<div class="tl-msg">Search failed: ${escapeHtml(e.message)}</div>`;
    }
  }
  async function showTlTracks(url, title) {
    tlTracksPane.classList.remove("hidden");
    tlResults.classList.add("hidden");
    tlTracksTitle.textContent = title;
    tlTracksList.innerHTML = '<div class="tl-msg">Loading\u2026</div>';
    tlSourceLink.href = url;
    tlStagedTracks = null;
    tlApplyBtn.disabled = true;
    try {
      const res = await fetch(`/api/tracklist-fetch?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || res.statusText);
      }
      const data = await res.json();
      if (!data.tracks.length) {
        tlTracksList.innerHTML = '<div class="tl-msg">No timed tracks found on this page.</div>';
        return;
      }
      tlStagedTracks = data.tracks;
      tlApplyBtn.disabled = false;
      const noTimes = !data.hasTimes;
      if (noTimes) {
        tlTracksList.innerHTML = '<div class="tl-msg" style="padding:6px 16px;font-size:11px;text-align:left;">No timecodes \u2014 track order only, no seek points.</div>';
      }
      tlTracksList.innerHTML += data.tracks.map((t, i) => {
        let timeLabel = "";
        if (t.startSeconds !== null) {
          const mm = Math.floor(t.startSeconds / 60);
          const ss = String(t.startSeconds % 60).padStart(2, "0");
          timeLabel = `${mm}:${ss}`;
        } else {
          timeLabel = String(i + 1).padStart(2, "0");
        }
        const label = t.performer ? `${t.performer} - ${t.title}` : t.title;
        return `<div class="tl-track-item">
        <span class="tl-track-time">${timeLabel}</span>
        <span class="tl-track-name">${escapeHtml(label)}</span>
      </div>`;
      }).join("");
    } catch (e) {
      tlTracksList.innerHTML = `<div class="tl-msg">Failed: ${escapeHtml(e.message)}</div>`;
    }
  }
  function applyScrapedTracklist() {
    if (!tlTargetDisc || !tlStagedTracks || !tlStagedTracks.length) return;
    const disc = tlTargetDisc;
    const hasTimes = tlStagedTracks.some((t) => t.startSeconds !== null);
    disc.tracks = tlStagedTracks.map((t, i) => ({
      ...t,
      track: i + 1,
      startSeconds: hasTimes ? t.startSeconds ?? 0 : 0
    }));
    try {
      localStorage.setItem(`tlp_tl_${disc.mp3Path}`, JSON.stringify(disc.tracks));
    } catch (_) {
    }
    if (_renderDiscList) _renderDiscList();
    if (_loadDisc) _loadDisc(disc);
    closeTlFinder();
  }
  function loadScrapedTracklist(disc) {
    if (!disc.mp3Path || disc.tracks.length) return;
    try {
      const stored = localStorage.getItem(`tlp_tl_${disc.mp3Path}`);
      if (stored) disc.tracks = JSON.parse(stored);
    } catch (_) {
    }
  }
  async function showNfo(dir) {
    if (_isSoundcloudMode2 && _isSoundcloudMode2() || _isSpotifyMode2 && _isSpotifyMode2()) return;
    try {
      const res = await fetch(`/api/nfo?dir=${encodeURIComponent(dir)}`);
      if (!res.ok) {
        lastNfoParsedTracks = null;
        nfoDetectBtn.classList.add("hidden");
        nfoTabDetectBtn.classList.add("hidden");
        const disc2 = currentDisc();
        if (disc2 && disc2.tracks && disc2.tracks.length > 0) {
          renderTracklist(disc2);
          setNfoPaneVisible(true);
          switchInfoTab("tracklist");
          nfoBtn.classList.add("hidden");
        } else {
          document.getElementById("nfo-pane").classList.add("hidden");
          nfoBtn.classList.add("hidden");
        }
        return;
      }
      const text = await res.text();
      setLastNfoText(text);
      const disc = currentDisc();
      lastNfoParsedTracks = parseNfoTracklist(text, disc?.mp3Path);
      const canDetect = lastNfoParsedTracks !== null && disc && !disc.tracks.length;
      nfoDetectBtn.classList.toggle("hidden", !canDetect);
      nfoTabDetectBtn.classList.toggle("hidden", !canDetect);
      highlightNfo();
      if (disc) renderTracklist(disc);
      setNfoPaneVisible(true);
      switchInfoTab("nfo");
      nfoBtn.classList.add("hidden");
    } catch (_) {
      lastNfoParsedTracks = null;
      nfoDetectBtn.classList.add("hidden");
      nfoTabDetectBtn.classList.add("hidden");
      setNfoPaneVisible(false);
      nfoBtn.classList.add("hidden");
    }
  }
  tlBtn.addEventListener("click", () => {
    const d = currentDisc();
    if (d) openTlFinder(d);
  });
  tlModalOverlay.addEventListener("click", (e) => {
    if (e.target === tlModalOverlay) closeTlFinder();
  });
  document.getElementById("tl-modal-close").addEventListener("click", closeTlFinder);
  tlSearchGo.addEventListener("click", () => runTlSearch(tlQueryInput.value));
  tlQueryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runTlSearch(tlQueryInput.value);
  });
  tlBackBtn.addEventListener("click", () => {
    tlTracksPane.classList.add("hidden");
    tlResults.classList.remove("hidden");
  });
  tlApplyBtn.addEventListener("click", applyScrapedTracklist);
  nfoDetectBtn.addEventListener("click", () => {
    switchInfoTab("detect");
    runDetectTransitions();
  });
  detectApplyBtn.addEventListener("click", () => {
    if (!detectStagedTracks || !detectStagedTracks.length) return;
    tlTargetDisc = currentDisc();
    tlStagedTracks = detectStagedTracks.map(({ _confidence, ...t }) => t);
    applyScrapedTracklist();
    lastNfoParsedTracks = null;
    detectStagedTracks = null;
    nfoDetectBtn.classList.add("hidden");
    nfoTabDetectBtn.classList.add("hidden");
    switchInfoTab("tracklist");
  });

  // src/disc-list.js
  init_state();
  init_helpers();
  init_dom_refs();

  // src/favorites.js
  init_state();
  init_helpers();
  init_dom_refs();
  function _mergeFavSources(...arrays) {
    const merged = /* @__PURE__ */ new Map();
    for (const arr of arrays) {
      for (const item of arr) {
        if (typeof item === "object" && item.mp3File && item.trackNumber != null) {
          merged.set(favKey(item.mp3File, item.trackNumber), item);
        }
      }
    }
    return merged;
  }
  async function loadFavorites() {
    const localMain = STORAGE.getFavs();
    const localBackup = JSON.parse(localStorage.getItem("tlp_favorites_backup") || "[]");
    let serverFavs = [];
    try {
      const res = await fetch("/api/favorites");
      if (res.ok) serverFavs = await res.json();
    } catch (_) {
    }
    state.favorites = _mergeFavSources(localMain, localBackup, serverFavs);
    const mergedArr = [...state.favorites.values()];
    if (mergedArr.length > localMain.length) {
      console.info(`loadFavorites: recovered ${mergedArr.length - localMain.length} entries from backup/server`);
      STORAGE.setFavs(mergedArr);
    }
    console.info(`loadFavorites: ${mergedArr.length} total (local=${localMain.length}, backup=${localBackup.length}, server=${serverFavs.length})`);
  }
  function saveFavorites() {
    const current = [...state.favorites.values()];
    const prev = STORAGE.getFavs();
    if (prev.length > 0 && current.length === 0) {
      console.warn("saveFavorites: refusing to wipe all favourites; existing count =", prev.length);
      return;
    }
    STORAGE.setFavs(current);
    localStorage.setItem("tlp_favorites_backup", JSON.stringify(current));
    fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(current)
    }).catch((err) => console.warn("saveFavorites: server sync failed", err));
  }
  function toggleFavorite(disc, trackIdx, starEl) {
    const track = disc.tracks[trackIdx];
    const key = favKey(disc.mp3File, track.track);
    if (state.favorites.has(key)) {
      state.favorites.delete(key);
      starEl.classList.remove("fav-active");
      starEl.title = "Add to favorites";
    } else {
      state.favorites.set(key, {
        mp3Path: disc.mp3Path,
        mp3File: disc.mp3File,
        dir: disc.mp3Path ? disc.mp3Path.slice(0, disc.mp3Path.lastIndexOf("/")) : "",
        trackNumber: track.track,
        title: track.title || "",
        performer: track.performer || disc.albumPerformer || "",
        albumTitle: disc.albumTitle || "",
        startSeconds: track.startSeconds
      });
      starEl.classList.add("fav-active");
      starEl.title = "Remove from favorites";
    }
    saveFavorites();
    const activeDisc = currentDisc();
    if (activeDisc && activeDisc.id === disc.id) {
      npTitle.classList.toggle("is-fav", state.favorites.has(key));
    }
    const favsPanel2 = document.getElementById("favs-panel");
    if (favsPanel2 && !favsPanel2.classList.contains("hidden")) renderFavsList();
  }
  var favsPanel = document.getElementById("favs-panel");
  var favsBtn = document.getElementById("favs-btn");
  var favsClose = document.getElementById("favs-close");
  var favsList = document.getElementById("favs-list");
  var favsCount = document.getElementById("favs-count");
  var _playDiscAtTrack3 = null;
  var _scanDirectory = null;
  var _loadDisc2 = null;
  function registerPlayback2(fns) {
    _playDiscAtTrack3 = fns.playDiscAtTrack;
    _scanDirectory = fns.scanDirectory;
    _loadDisc2 = fns.loadDisc;
  }
  function openFavsPanel() {
    favsPanel.classList.remove("hidden");
    favsBtn.classList.add("active");
    renderFavsList();
  }
  function closeFavsPanel() {
    favsPanel.classList.add("hidden");
    favsBtn.classList.remove("active");
  }
  function renderFavsList() {
    const items = [...state.favorites.values()];
    favsCount.textContent = `${items.length} track${items.length !== 1 ? "s" : ""}`;
    if (items.length === 0) {
      favsList.innerHTML = '<div class="search-empty">No starred tracks yet. Click \u2605 on any track.</div>';
      return;
    }
    items.sort(
      (a, b) => (a.albumTitle || "").localeCompare(b.albumTitle || "") || a.trackNumber - b.trackNumber
    );
    const frag = document.createDocumentFragment();
    let lastAlbum = null;
    for (const fav of items) {
      if (fav.albumTitle !== lastAlbum) {
        lastAlbum = fav.albumTitle;
        const header = document.createElement("div");
        header.className = "search-disc-header";
        header.innerHTML = `<span>${escapeHtml(fav.albumTitle || fav.mp3File || "\u2014")}</span>`;
        frag.appendChild(header);
      }
      const row = document.createElement("div");
      row.className = "search-result";
      row.innerHTML = `<span class="search-result-num">${String(fav.trackNumber).padStart(2, "0")}</span><span class="search-result-title">${escapeHtml(fav.title || "\u2014")}</span>` + (fav.performer ? `<span class="search-result-artist">${escapeHtml(fav.performer)}</span>` : "") + `<button class="fav-remove" title="Unstar">\u2605</button>`;
      row.addEventListener("click", (e) => {
        if (e.target.classList.contains("fav-remove")) {
          const key = favKey(fav.mp3File, fav.trackNumber);
          state.favorites.delete(key);
          saveFavorites();
          const starBtn = discList.querySelector(`.fav-btn[data-key="${CSS.escape(key)}"]`);
          if (starBtn) starBtn.classList.remove("fav-active");
          renderFavsList();
          return;
        }
        playFromFav(fav);
      });
      frag.appendChild(row);
    }
    favsList.innerHTML = "";
    favsList.appendChild(frag);
  }
  async function playFromFav(fav) {
    closeFavsPanel();
    let disc = state.discs.find((d) => d.mp3Path === fav.mp3Path);
    if (!disc && fav.dir && _scanDirectory) {
      await _scanDirectory(fav.dir);
      disc = state.discs.find((d) => d.mp3Path === fav.mp3Path);
    }
    if (!disc) return;
    const trackIdx = disc.tracks.findIndex((t) => t.track === fav.trackNumber);
    if (trackIdx >= 0 && _playDiscAtTrack3) {
      _playDiscAtTrack3(disc, trackIdx);
    } else if (_loadDisc2) {
      _loadDisc2(disc);
      const audio2 = document.getElementById("audio");
      audio2.addEventListener("canplay", function p() {
        audio2.removeEventListener("canplay", p);
        audio2.currentTime = fav.startSeconds;
        audio2.play().catch(() => {
        });
      });
    }
  }
  favsBtn.addEventListener("click", () => {
    if (favsPanel.classList.contains("hidden")) openFavsPanel();
    else closeFavsPanel();
  });
  favsClose.addEventListener("click", closeFavsPanel);

  // src/disc-list.js
  init_dom_refs();
  var _loadDisc3 = null;
  var _playDiscAtTrack4 = null;
  var _openSpotifySaveModal = null;
  var _getDiscProgress = null;
  var _showResumeBanner = null;
  var _applyFilter = null;
  var _isSoundcloudMode3 = null;
  var _isSpotifyMode3 = null;
  var _getSoundcloudTracks = null;
  var _getSoundcloudTracksList = null;
  var _getSpotifyTracksList = null;
  function registerDeps3(deps) {
    _loadDisc3 = deps.loadDisc;
    _playDiscAtTrack4 = deps.playDiscAtTrack;
    _openSpotifySaveModal = deps.openSpotifySaveModal;
    _getDiscProgress = deps.getDiscProgress;
    _showResumeBanner = deps.showResumeBanner;
    _applyFilter = deps.applyFilter;
    if (deps.isSoundcloudMode) _isSoundcloudMode3 = deps.isSoundcloudMode;
    if (deps.isSpotifyMode) _isSpotifyMode3 = deps.isSpotifyMode;
    if (deps.getSoundcloudTracks) _getSoundcloudTracks = deps.getSoundcloudTracks;
    if (deps.getSoundcloudTracksList) _getSoundcloudTracksList = deps.getSoundcloudTracksList;
    if (deps.getSpotifyTracksList) _getSpotifyTracksList = deps.getSpotifyTracksList;
  }
  function applyFilter(query) {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    filterClear.classList.toggle("hidden", words.length === 0);
    if (_isSoundcloudMode3 && _isSoundcloudMode3()) {
      const scTracksList = _getSoundcloudTracksList ? _getSoundcloudTracksList() : null;
      const scTracks = _getSoundcloudTracks ? _getSoundcloudTracks() : [];
      if (scTracksList) {
        scTracksList.querySelectorAll(".soundcloud-track-item").forEach((item) => {
          const track = scTracks[Number(item.dataset.idx)];
          if (!track) return;
          const hay = `${track.title || ""} ${track.user ? track.user.username : ""}`.toLowerCase();
          item.classList.toggle("filter-hidden", words.length > 0 && !words.every((w) => hay.includes(w)));
        });
      }
      return;
    }
    if (_isSpotifyMode3 && _isSpotifyMode3()) {
      const spTracksList = _getSpotifyTracksList ? _getSpotifyTracksList() : null;
      if (spTracksList) {
        spTracksList.querySelectorAll(".spotify-track-item").forEach((item) => {
          const title = (item.querySelector(".spotify-track-title") || {}).textContent || "";
          const artist = (item.querySelector(".spotify-track-artist") || {}).textContent || "";
          const hay = `${title} ${artist}`.toLowerCase();
          item.classList.toggle("filter-hidden", words.length > 0 && !words.every((w) => hay.includes(w)));
        });
      }
      return;
    }
    folderBrowser.querySelectorAll(".folder-item").forEach((item) => {
      const name = item.dataset.name || "";
      const nameLower = name.toLowerCase();
      const matches = words.length === 0 || words.every((w) => nameLower.includes(w));
      item.classList.toggle("filter-hidden", !matches);
      const label = item.querySelector(".folder-label");
      if (!label) return;
      if (words.length && matches) {
        label.innerHTML = escapeHtml(name).replace(
          new RegExp(
            words.map((w) => escapeHtml(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
            "gi"
          ),
          (m) => `<mark>${m}</mark>`
        );
      } else {
        label.textContent = name;
      }
    });
  }
  var SORT_KEY = "tlp_folder_sort";
  var folderSort = localStorage.getItem(SORT_KEY) || "name";
  var lastSubdirs = [];
  var lastBrowseDir = "";
  var sortToggle = document.getElementById("sort-toggle");
  function applySortLabel() {
    sortToggle.textContent = folderSort === "name" ? "A\u2013Z" : "Date";
    sortToggle.title = folderSort === "name" ? "Sorted A\u2013Z (click for date)" : "Sorted by date (click for A\u2013Z)";
  }
  applySortLabel();
  sortToggle.addEventListener("click", () => {
    folderSort = folderSort === "name" ? "date" : "name";
    localStorage.setItem(SORT_KEY, folderSort);
    applySortLabel();
    if (lastBrowseDir) renderFolderItems(lastBrowseDir, lastSubdirs);
  });
  function refreshDiscListView() {
    renderDiscList();
    highlightTrackInSidebar(state.currentDiscId, state.currentTrackIndex);
  }
  document.getElementById("expand-all-btn").addEventListener("click", () => {
    state.collapsedDiscs.clear();
    refreshDiscListView();
  });
  document.getElementById("collapse-all-btn").addEventListener("click", () => {
    for (const disc of state.discs) state.collapsedDiscs.add(disc.id);
    refreshDiscListView();
  });
  function normEntry(e) {
    return typeof e === "string" ? { name: e, mtime: 0 } : e;
  }
  function sortedSubdirs(subdirs) {
    const copy = subdirs.map(normEntry);
    if (folderSort === "date") {
      copy.sort((a, b) => b.mtime - a.mtime);
    } else {
      copy.sort((a, b) => (a.name || "").localeCompare(b.name || "", void 0, { sensitivity: "base" }));
    }
    return copy;
  }
  var _scanDirectory2 = null;
  function registerScanDirectory(fn) {
    _scanDirectory2 = fn;
  }
  function makeFolderItem(dir, name, mtime, activeNames) {
    const item = document.createElement("div");
    item.className = "folder-item";
    item.dataset.name = name;
    item.dataset.mtime = mtime || 0;
    if (activeNames && activeNames.has(name)) item.classList.add("active");
    item.innerHTML = `<span class="folder-label">${escapeHtml(name)}</span>`;
    const fullPath = `${dir}/${name}`;
    let clickTimer = null;
    item.addEventListener("click", () => {
      if (clickTimer) return;
      clickTimer = setTimeout(() => {
        clickTimer = null;
        folderBrowser.querySelectorAll(".folder-item.active").forEach((el) => el.classList.remove("active"));
        item.classList.add("active");
        STORAGE.setScanDir(fullPath);
        if (_scanDirectory2) _scanDirectory2(fullPath);
      }, 220);
    });
    item.addEventListener("dblclick", () => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      folderBrowser.querySelectorAll(".folder-item.active").forEach((el) => el.classList.remove("active"));
      item.classList.add("active");
      STORAGE.setScanDir(fullPath);
      if (_scanDirectory2) _scanDirectory2(fullPath, true);
    });
    return item;
  }
  function appendFolderItems(dir, entries, activeNames) {
    const frag = document.createDocumentFragment();
    for (const entry of entries) {
      frag.appendChild(makeFolderItem(dir, entry.name, entry.mtime, activeNames));
    }
    folderBrowser.appendChild(frag);
  }
  function sortFolderItems() {
    const items = [...folderBrowser.querySelectorAll(".folder-item")];
    if (!items.length) return;
    if (folderSort === "date") {
      items.sort((a, b) => Number(b.dataset.mtime || 0) - Number(a.dataset.mtime || 0));
    } else {
      items.sort((a, b) => (a.dataset.name || "").localeCompare(b.dataset.name || "", void 0, { sensitivity: "base" }));
    }
    const frag = document.createDocumentFragment();
    for (const item of items) frag.appendChild(item);
    folderBrowser.appendChild(frag);
  }
  function renderFolderItems(dir, subdirs) {
    const activeNames = new Set(
      [...folderBrowser.querySelectorAll(".folder-item.active")].map((el) => el.dataset.name)
    );
    folderBrowser.querySelectorAll(".folder-item").forEach((el) => el.remove());
    for (const entry of sortedSubdirs(subdirs)) {
      folderBrowser.appendChild(makeFolderItem(dir, entry.name, entry.mtime, activeNames));
    }
    applyFilter(filterInput.value);
  }
  function addUpRow(parent) {
    const up = document.createElement("div");
    up.className = "folder-up";
    up.textContent = "\u2191  ..";
    up.addEventListener("click", () => loadFolderBrowser(parent));
    folderBrowser.prepend(up);
  }
  async function loadFolderBrowser(dir, bust) {
    state.browseDir = dir;
    lastBrowseDir = dir;
    lastSubdirs = [];
    return new Promise((resolve) => {
      folderBrowser.innerHTML = '<div class="status-msg">Loading\u2026</div>';
      let metaDone = false;
      let parent = null;
      let filterTimer = null;
      const scheduleFilter = () => {
        if (!filterTimer) {
          filterTimer = setTimeout(() => {
            filterTimer = null;
            applyFilter(filterInput.value);
          }, 150);
        }
      };
      const url = `/api/ls-stream?dir=${encodeURIComponent(dir)}${bust ? "&bust=1" : ""}`;
      const source = new EventSource(url);
      const activeNames = new Set(
        [...folderBrowser.querySelectorAll(".folder-item.active")].map((el) => el.dataset.name)
      );
      source.onmessage = (e) => {
        let msg;
        try {
          msg = JSON.parse(e.data);
        } catch (_) {
          return;
        }
        if (msg.type === "batch") {
          source.close();
          parent = msg.parent;
          lastSubdirs = msg.subdirs || [];
          folderBrowser.innerHTML = "";
          if (parent) addUpRow(parent);
          if (!lastSubdirs.length && !parent) {
            folderBrowser.innerHTML = '<div class="status-msg">No subfolders.</div>';
          } else {
            renderFolderItems(dir, lastSubdirs);
          }
          clearTimeout(filterTimer);
          resolve();
          return;
        }
        if (msg.type === "meta") {
          parent = msg.parent;
          folderBrowser.innerHTML = "";
          if (parent) addUpRow(parent);
          metaDone = true;
          return;
        }
        if (msg.type === "entries") {
          if (!metaDone) {
            folderBrowser.innerHTML = "";
            metaDone = true;
          }
          for (const item of msg.items) lastSubdirs.push(item);
          appendFolderItems(dir, msg.items, activeNames);
          return;
        }
        if (msg.type === "entry") {
          if (!metaDone) {
            folderBrowser.innerHTML = "";
            metaDone = true;
          }
          const entry = { name: msg.name, mtime: msg.mtime };
          lastSubdirs.push(entry);
          appendFolderItems(dir, [entry], activeNames);
          return;
        }
        if (msg.type === "done") {
          source.close();
          clearTimeout(filterTimer);
          sortFolderItems();
          applyFilter(filterInput.value);
          if (!lastSubdirs.length && !parent) {
            folderBrowser.innerHTML = '<div class="status-msg">No subfolders.</div>';
          }
          resolve();
          return;
        }
        if (msg.type === "error") {
          source.close();
          clearTimeout(filterTimer);
          folderBrowser.innerHTML = `<div class="status-msg" style="color:#c06060">${escapeHtml(msg.message)}</div>`;
          resolve();
        }
      };
      source.onerror = () => {
        source.close();
        clearTimeout(filterTimer);
        resolve();
      };
    });
  }
  var _activeTrackEl = null;
  discList.addEventListener("click", (e) => {
    const header = e.target.closest(".disc-header");
    if (header) {
      const section = header.closest(".disc-section");
      const discId2 = parseInt(section?.dataset.discId, 10);
      if (isNaN(discId2)) return;
      const nowCollapsed = !state.collapsedDiscs.has(discId2);
      if (nowCollapsed) state.collapsedDiscs.add(discId2);
      else state.collapsedDiscs.delete(discId2);
      section.classList.toggle("disc-collapsed", nowCollapsed);
      const toggle = section.querySelector(".disc-toggle");
      if (toggle) toggle.textContent = nowCollapsed ? "\u25B6" : "\u25BC";
      return;
    }
    const item = e.target.closest(".track-item");
    if (!item) return;
    const discId = parseInt(item.dataset.disc, 10);
    const trackIdx = parseInt(item.dataset.track, 10);
    const disc = state.discs.find((d) => d.id === discId);
    if (!disc) return;
    const favBtn = e.target.closest(".fav-btn");
    if (favBtn) {
      e.stopPropagation();
      if (trackIdx === -1) {
        const rawKey = favKey(disc.mp3File, 1);
        if (state.favorites.has(rawKey)) {
          state.favorites.delete(rawKey);
          favBtn.classList.remove("fav-active");
          favBtn.title = "Add to favorites";
        } else {
          state.favorites.set(rawKey, {
            mp3File: disc.mp3File,
            mp3Path: disc.mp3Path,
            dir: disc.dir || "",
            trackNumber: 1,
            title: disc.albumTitle || disc.mp3File,
            performer: disc.albumPerformer || "",
            albumTitle: disc.albumTitle || "",
            startSeconds: 0
          });
          favBtn.classList.add("fav-active");
          favBtn.title = "Remove from favorites";
        }
        saveFavorites();
        if (currentDisc() && currentDisc().id === disc.id) {
          npTitle.classList.toggle("is-fav", state.favorites.has(rawKey));
        }
        const favsPanel2 = document.getElementById("favs-panel");
        if (favsPanel2 && !favsPanel2.classList.contains("hidden")) renderFavsList();
      } else {
        toggleFavorite(disc, trackIdx, favBtn);
      }
      return;
    }
    if (e.target.closest(".track-queue-btn")) {
      e.stopPropagation();
      addToQueue(disc, trackIdx);
      return;
    }
    if (e.target.closest(".track-spotify-btn")) {
      e.stopPropagation();
      const track = disc.tracks[trackIdx];
      if (_openSpotifySaveModal && track) _openSpotifySaveModal(track.title, track.performer || disc.albumPerformer);
      return;
    }
    if (trackIdx === -1) {
      if (_loadDisc3) _loadDisc3(disc);
      audio.play().catch(() => {
      });
    } else {
      if (_playDiscAtTrack4) _playDiscAtTrack4(disc, trackIdx);
    }
  });
  function renderDiscList() {
    _activeTrackEl = null;
    discList.innerHTML = "";
    if (!state.discs.length) {
      discList.innerHTML = '<div class="status-msg">No MP3/CUE files here.</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    for (const disc of state.discs) {
      const section = document.createElement("div");
      section.className = "disc-section";
      section.dataset.discId = disc.id;
      const isCollapsed = state.collapsedDiscs.has(disc.id);
      if (isCollapsed) section.classList.add("disc-collapsed");
      const header = document.createElement("div");
      header.className = "disc-header";
      const titleText = disc.albumTitle || disc.mp3File || `Disc ${disc.id + 1}`;
      const performer = disc.albumPerformer ? ` \u2014 <span>${escapeHtml(disc.albumPerformer)}</span>` : "";
      const arrow = `<span class="disc-toggle">${isCollapsed ? "\u25B6" : "\u25BC"}</span>`;
      header.innerHTML = `${arrow}${escapeHtml(titleText)}${performer}`;
      header.style.cursor = "pointer";
      section.appendChild(header);
      if (disc.mp3Path && _getDiscProgress) {
        const prog = _getDiscProgress(disc.mp3Path);
        if (prog && prog.duration > 0) {
          const pct = Math.min(100, prog.position / prog.duration * 100);
          const bar = document.createElement("div");
          bar.className = "disc-progress";
          bar.innerHTML = `<div class="disc-progress-fill" style="width:${pct.toFixed(1)}%"></div>`;
          section.appendChild(bar);
        }
      }
      if (!disc.mp3Path) {
        const warn = document.createElement("div");
        warn.className = "disc-no-mp3";
        warn.textContent = "No MP3 found for this CUE.";
        section.appendChild(warn);
        frag.appendChild(section);
        continue;
      }
      if (!disc.tracks.length) {
        const rawKey = favKey(disc.mp3File, 1);
        const rawIsFav = state.favorites.has(rawKey);
        section.insertAdjacentHTML("beforeend", `
        <div class="track-item" data-disc="${disc.id}" data-track="-1">
          <span class="track-num"></span>
          <span class="track-info">
            <div class="track-title" style="color:var(--text-dim)">${escapeHtml(disc.mp3File)}</div>
          </span>
          <button class="fav-btn${rawIsFav ? " fav-active" : ""}" data-key="${escapeHtml(rawKey)}" title="${rawIsFav ? "Remove from favorites" : "Add to favorites"}">&#9733;</button>
        </div>`);
        frag.appendChild(section);
        continue;
      }
      const trackHtmlParts = [];
      for (let i = 0; i < disc.tracks.length; i++) {
        const track = disc.tracks[i];
        const isFav = state.favorites.has(favKey(disc.mp3File, track.track));
        trackHtmlParts.push(`
        <div class="track-item" data-disc="${disc.id}" data-track="${i}" data-title="${escapeHtml((track.title || "").toLowerCase())}" data-performer="${escapeHtml((track.performer || disc.albumPerformer || "").toLowerCase())}">
          <span class="track-num">${String(track.track).padStart(2, "0")}</span>
          <span class="track-info">
            <div class="track-title">${escapeHtml(track.title || "(unknown)")}</div>
            ${track.performer ? `<div class="track-performer">${escapeHtml(track.performer)}</div>` : ""}
          </span>
          <span class="track-actions">
            <button class="track-action-btn track-queue-btn" title="Add to queue">+</button>
            <button class="track-action-btn track-spotify-btn" title="Save to Spotify">&#9834;</button>
          </span>
          <button class="fav-btn${isFav ? " fav-active" : ""}" data-key="${escapeHtml(favKey(disc.mp3File, track.track))}" title="${isFav ? "Remove from favorites" : "Add to favorites"}">&#9733;</button>
          <span class="track-time">${formatTime(track.startSeconds)}</span>
        </div>`);
      }
      section.insertAdjacentHTML("beforeend", trackHtmlParts.join(""));
      frag.appendChild(section);
    }
    discList.appendChild(frag);
    applyFilter(filterInput.value);
  }
  function highlightTrackInSidebar(discId, trackIdx) {
    discList.querySelectorAll(".track-item").forEach((el2) => {
      el2.classList.remove("active");
      el2.style.removeProperty("--prog");
    });
    const el = discList.querySelector(`.track-item[data-disc="${discId}"][data-track="${trackIdx}"]`);
    _activeTrackEl = el || null;
    if (el) {
      el.classList.add("active");
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
  function updateTrackProgress() {
    const el = _activeTrackEl;
    if (!el || !isFinite(audio.duration) || audio.duration <= 0) return;
    const disc = currentDisc();
    if (!disc) return;
    const ct = audio.currentTime;
    let pct;
    const track = disc.tracks[state.currentTrackIndex];
    if (track) {
      const next = disc.tracks[state.currentTrackIndex + 1];
      const trackEnd = next ? next.startSeconds : audio.duration;
      if (trackEnd <= track.startSeconds) return;
      pct = (ct - track.startSeconds) / (trackEnd - track.startSeconds) * 100;
    } else {
      pct = ct / audio.duration * 100;
    }
    el.style.setProperty("--prog", `${Math.min(100, Math.max(0, pct)).toFixed(1)}%`);
  }

  // src/equalizer.js
  init_state();
  init_dom_refs();
  var eqLowFilter = null;
  var eqMidFilter = null;
  var eqHighFilter = null;
  function initEQ(audioCtx, sourceNode, analyserNode) {
    eqLowFilter = audioCtx.createBiquadFilter();
    eqLowFilter.type = "lowshelf";
    eqLowFilter.frequency.value = 200;
    eqLowFilter.gain.value = STORAGE.getEqLow();
    eqMidFilter = audioCtx.createBiquadFilter();
    eqMidFilter.type = "peaking";
    eqMidFilter.frequency.value = 1e3;
    eqMidFilter.Q.value = 1;
    eqMidFilter.gain.value = STORAGE.getEqMid();
    eqHighFilter = audioCtx.createBiquadFilter();
    eqHighFilter.type = "highshelf";
    eqHighFilter.frequency.value = 8e3;
    eqHighFilter.gain.value = STORAGE.getEqHigh();
    sourceNode.disconnect();
    analyserNode.disconnect();
    sourceNode.connect(eqLowFilter);
    eqLowFilter.connect(eqMidFilter);
    eqMidFilter.connect(eqHighFilter);
    eqHighFilter.connect(analyserNode);
    analyserNode.connect(audioCtx.destination);
    eqLowSlider.value = STORAGE.getEqLow();
    eqMidSlider.value = STORAGE.getEqMid();
    eqHighSlider.value = STORAGE.getEqHigh();
  }
  function getEqLowFilter() {
    return eqLowFilter;
  }
  eqLowSlider.addEventListener("input", () => {
    const v = parseFloat(eqLowSlider.value);
    if (eqLowFilter) eqLowFilter.gain.value = v;
    STORAGE.setEqLow(v);
  });
  eqMidSlider.addEventListener("input", () => {
    const v = parseFloat(eqMidSlider.value);
    if (eqMidFilter) eqMidFilter.gain.value = v;
    STORAGE.setEqMid(v);
  });
  eqHighSlider.addEventListener("input", () => {
    const v = parseFloat(eqHighSlider.value);
    if (eqHighFilter) eqHighFilter.gain.value = v;
    STORAGE.setEqHigh(v);
  });
  document.getElementById("eq-btn").addEventListener("click", () => eqPanel.classList.toggle("hidden"));
  document.getElementById("eq-close").addEventListener("click", () => eqPanel.classList.add("hidden"));
  document.getElementById("eq-reset").addEventListener("click", () => {
    eqLowSlider.value = 0;
    eqMidSlider.value = 0;
    eqHighSlider.value = 0;
    if (eqLowFilter) eqLowFilter.gain.value = 0;
    if (eqMidFilter) eqMidFilter.gain.value = 0;
    if (eqHighFilter) eqHighFilter.gain.value = 0;
    STORAGE.setEqLow(0);
    STORAGE.setEqMid(0);
    STORAGE.setEqHigh(0);
  });

  // src/playback.js
  init_soundcloud();
  init_spotify();

  // src/playback-progress.js
  init_state();
  init_helpers();
  init_dom_refs();
  function saveDiscProgress() {
    const disc = currentDisc();
    if (!disc || !disc.mp3Path || !isFinite(audio.duration)) return;
    const prog = STORAGE.getDiscProgress();
    prog[disc.mp3Path] = {
      position: audio.currentTime,
      duration: audio.duration,
      trackIdx: state.currentTrackIndex,
      ts: Date.now()
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
    const existing = document.getElementById("resume-banner");
    if (existing) existing.remove();
    const banner = document.createElement("div");
    banner.id = "resume-banner";
    banner.innerHTML = `Resume from ${formatTime(progress.position)}?
    <button class="primary" id="resume-yes">Resume</button>
    <button id="resume-no">Start Over</button>`;
    document.body.appendChild(banner);
    document.getElementById("resume-yes").addEventListener("click", () => {
      audio.currentTime = progress.position;
      audio.play().catch(() => {
      });
      banner.remove();
    });
    document.getElementById("resume-no").addEventListener("click", () => {
      audio.play().catch(() => {
      });
      banner.remove();
    });
    setTimeout(() => {
      if (banner.parentNode) banner.remove();
    }, 1e4);
  }

  // src/playback.js
  var ovScrubber;
  var zmScrubber;
  var onScrubberSeek = (t) => {
    if (!isFinite(audio.duration)) return;
    audio.currentTime = t;
    ovScrubber.seekTo(t);
    zmScrubber.seekTo(t);
    seekBar.value = t / audio.duration * 100;
    timeCurrent.textContent = formatTime(t);
  };
  function initScrubbers() {
    ovScrubber = new FancyScrubber(
      document.getElementById("wf-overview"),
      onScrubberSeek,
      { showRuler: false }
    );
    zmScrubber = new FancyScrubber(
      document.getElementById("wf-zoom"),
      onScrubberSeek,
      { showRuler: true, centerPlayhead: true, panMode: true }
    );
  }
  var fancyScrubber = {
    load: (d, t) => {
      ovScrubber.load(d, t);
      zmScrubber.load(d, t);
    },
    clear: () => {
      ovScrubber.clear();
      zmScrubber.clear();
    },
    tick: (t) => {
      ovScrubber.tick(t);
      zmScrubber.tick(t);
    },
    seekTo: (t) => {
      ovScrubber.seekTo(t);
      zmScrubber.seekTo(t);
    },
    setVisibleSecs: (v) => zmScrubber.setVisibleSecs(v),
    _invalidateCache: () => {
      ovScrubber._invalidateCache();
      zmScrubber._invalidateCache();
    },
    _draw: () => {
      ovScrubber._draw();
      zmScrubber._draw();
    },
    get peaks() {
      return ovScrubber.peaks;
    },
    get duration() {
      return zmScrubber.duration;
    }
  };
  function getOvScrubber() {
    return ovScrubber;
  }
  function getZmScrubber() {
    return zmScrubber;
  }
  var liveSpectrumWrap = document.getElementById("live-spectrum-wrap");
  var liveSpectrumCanvas = document.getElementById("live-spectrum");
  var liveSpectrum;
  function initLiveSpectrum() {
    liveSpectrum = new LiveSpectrumRenderer(liveSpectrumCanvas);
  }
  function getLiveSpectrum() {
    return liveSpectrum;
  }
  function getLiveSpectrumWrap() {
    return liveSpectrumWrap;
  }
  var wfOverviewWrap = document.getElementById("wf-overview-wrap");
  var wfResizeMid = document.getElementById("wf-resize-mid");
  var wfZoomWrap = document.getElementById("wf-zoom-wrap");
  var wfResizeBot = document.getElementById("wf-resize-bot");
  function showLiveSpectrum() {
    wfSection.classList.remove("hidden");
    wfOverviewWrap.classList.add("hidden");
    wfResizeMid.classList.add("hidden");
    wfZoomWrap.classList.add("hidden");
    wfResizeBot.classList.add("hidden");
    liveSpectrumWrap.classList.remove("hidden");
    liveSpectrum.connectAudioElement(audio);
    if (audio._lsrCtx && audio._lsrSrc && !getEqLowFilter()) {
      initEQ(audio._lsrCtx, audio._lsrSrc, audio._lsrAnalyser);
    }
    liveSpectrum.start();
  }
  function hideLiveSpectrum() {
    liveSpectrum.stop();
    liveSpectrumWrap.classList.add("hidden");
    wfOverviewWrap.classList.remove("hidden");
    wfResizeMid.classList.remove("hidden");
    wfZoomWrap.classList.remove("hidden");
    wfResizeBot.classList.remove("hidden");
  }
  var currentArtworkPath = null;
  var currentArtworkUrl2 = null;
  function loadArtwork(disc) {
    if (!disc.mp3Path || disc.mp3Path === currentArtworkPath) return;
    currentArtworkPath = disc.mp3Path;
    fetch(`/api/artwork?path=${encodeURIComponent(disc.mp3Path)}`).then((r) => r.ok ? r.blob() : null).then((blob) => {
      if (currentArtworkUrl2) {
        URL.revokeObjectURL(currentArtworkUrl2);
        currentArtworkUrl2 = null;
      }
      if (!blob) {
        npSection.classList.remove("has-artwork");
        npSection.style.removeProperty("--artwork");
        artworkImg.src = "";
        artworkPane.classList.add("hidden");
        setCurrentArtworkUrl(null);
        return;
      }
      currentArtworkUrl2 = URL.createObjectURL(blob);
      npSection.style.setProperty("--artwork", `url("${currentArtworkUrl2}")`);
      npSection.classList.add("has-artwork");
      artworkImg.src = currentArtworkUrl2;
      setCurrentArtworkUrl(currentArtworkUrl2);
      if (nfoPane.classList.contains("hidden")) artworkPane.classList.remove("hidden");
    }).catch(() => {
      npSection.classList.remove("has-artwork");
      npSection.style.removeProperty("--artwork");
      artworkImg.src = "";
      artworkPane.classList.add("hidden");
      setCurrentArtworkUrl(null);
    });
  }
  var currentWfPath = null;
  var waveformVisible = true;
  function getCurrentWfPath() {
    return currentWfPath;
  }
  async function loadWaveform(disc) {
    if (!disc.mp3Path || disc.mp3Path === currentWfPath) return;
    currentWfPath = disc.mp3Path;
    const lastNfoText2 = getLastNfoText();
    if (lastNfoText2) {
      const lastNfoParsedTracks2 = parseNfoTracklist(lastNfoText2, disc.mp3Path);
      setLastNfoParsedTracks(lastNfoParsedTracks2);
      const canDetect = lastNfoParsedTracks2 !== null && !disc.tracks.length;
      nfoDetectBtn.classList.toggle("hidden", !canDetect);
      nfoTabDetectBtn.classList.toggle("hidden", !canDetect);
    }
    hideLiveSpectrum();
    if (waveformVisible) wfSection.classList.remove("hidden");
    wfStatus.classList.remove("hidden");
    fancyScrubber.clear();
    try {
      const res = await fetch(`/api/waveform?path=${encodeURIComponent(disc.mp3Path)}&bucketMs=${STORAGE.getSpectrumRes()}`);
      if (!res.ok) throw new Error("waveform failed");
      const data = await res.json();
      const d = state.discs.find((x) => x.id === disc.id);
      const lastNfoParsedTracks2 = getLastNfoParsedTracks();
      if (d && !d.tracks.length && lastNfoParsedTracks2 && lastNfoParsedTracks2.length >= 3) {
        d.tracks = lastNfoParsedTracks2.map((t, i) => ({ ...t, track: i + 1 }));
        try {
          localStorage.setItem(`tlp_tl_${d.mp3Path}`, JSON.stringify(d.tracks));
        } catch (_) {
        }
        renderDiscList();
      }
      fancyScrubber.load(data, d ? d.tracks : []);
      wfStatus.classList.add("hidden");
      zmScrubber.setVisibleSecs(30);
    } catch (_) {
      wfStatus.classList.add("hidden");
      currentWfPath = null;
    }
  }
  function detectCurrentTrack(currentTime) {
    const disc = currentDisc();
    if (!disc || !disc.tracks.length) return -1;
    let idx = 0;
    for (let i = 0; i < disc.tracks.length; i++) {
      if (disc.tracks[i].startSeconds <= currentTime) idx = i;
      else break;
    }
    return idx;
  }
  var isMini = false;
  var showRemaining = false;
  function updateMiniInfo() {
    const disc = currentDisc();
    const track = disc && state.currentTrackIndex >= 0 ? disc.tracks[state.currentTrackIndex] : null;
    miniTrack.textContent = track ? track.title || "\u2014" : disc ? disc.albumTitle || "\u2014" : "\u2014";
    miniSub.textContent = track ? track.performer || disc.albumPerformer || "" : disc ? disc.albumPerformer || "" : "";
  }
  function updateNowPlaying(trackIdx) {
    const disc = currentDisc();
    if (!disc) return;
    if (trackIdx < 0 || !disc.tracks.length) {
      npDisc.textContent = disc.albumTitle || disc.mp3File || "\u2014";
      npTrackNumber.textContent = "";
      npTitle.textContent = disc.albumTitle || "\u2014";
      npTitle.classList.remove("is-fav");
      npPerformer.textContent = disc.albumPerformer || "";
      spotifySearchBtn.classList.add("hidden");
      soundcloudSearchBtn.classList.add("hidden");
      finderBtn.classList.toggle("hidden", !disc.mp3Path);
      if (disc.mp3Path) finderBtn.dataset.path = disc.mp3Path;
      tlBtn.classList.toggle("hidden", !disc.mp3Path);
      return;
    }
    const track = disc.tracks[trackIdx];
    npDisc.textContent = disc.albumTitle || disc.mp3File || "\u2014";
    npTrackNumber.textContent = String(track.track).padStart(2, "0");
    npTitle.textContent = track.title || "(unknown title)";
    npTitle.classList.toggle("is-fav", state.favorites.has(favKey(disc.mp3File, track.track)));
    npPerformer.textContent = track.performer || disc.albumPerformer || "";
    const query = [track.performer || disc.albumPerformer, track.title].filter(Boolean).join(" ");
    if (query) {
      spotifySearchBtn.href = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
      spotifySearchBtn.classList.remove("hidden");
      soundcloudSearchBtn.href = `https://soundcloud.com/search?q=${encodeURIComponent(query)}`;
      soundcloudSearchBtn.classList.remove("hidden");
    } else {
      spotifySearchBtn.classList.add("hidden");
      soundcloudSearchBtn.classList.add("hidden");
    }
    if (disc.mp3Path) {
      finderBtn.dataset.path = disc.mp3Path;
      finderBtn.classList.remove("hidden");
      tlBtn.classList.remove("hidden");
    } else {
      finderBtn.classList.add("hidden");
      tlBtn.classList.add("hidden");
    }
    if (isMini) updateMiniInfo();
  }
  function setTrackLabelsVisible(on) {
    STORAGE.setTrackLabels(on);
    seekTicks.classList.toggle("no-labels", !on);
    if (on) updateTickLabelVisibility();
  }
  function updateSeekTicks() {
    seekTicks.innerHTML = "";
    const disc = currentDisc();
    if (!disc || !disc.tracks.length || !isFinite(audio.duration)) return;
    let labelIdx = 0;
    for (const track of disc.tracks) {
      if (track.startSeconds <= 0) continue;
      const pct = track.startSeconds / audio.duration * 100;
      const tick = document.createElement("div");
      const above = labelIdx % 2 === 0;
      tick.className = `seek-tick ${above ? "seek-tick--above" : "seek-tick--below"}`;
      tick.style.left = `${pct}%`;
      const num = String(track.track).padStart(2, "0");
      tick.dataset.startSeconds = track.startSeconds;
      const bar = document.createElement("div");
      bar.className = "seek-tick-bar";
      tick.appendChild(bar);
      const label = document.createElement("span");
      label.className = "seek-tick-label";
      label.textContent = `${num} \u2014 ${track.title || ""}`;
      tick.title = label.textContent;
      tick.appendChild(label);
      seekTicks.appendChild(tick);
      labelIdx++;
    }
    updateTickLabelVisibility();
  }
  function updateTickLabelVisibility() {
    if (seekTicks.classList.contains("no-labels")) return;
    const wrapWidth = seekBar.offsetWidth;
    if (wrapWidth === 0) return;
    const MIN_GAP = 72;
    const ticks = Array.from(seekTicks.querySelectorAll(".seek-tick"));
    let lastX = -MIN_GAP;
    ticks.forEach((tick) => {
      const x = parseFloat(tick.style.left) / 100 * wrapWidth;
      const label = tick.querySelector(".seek-tick-label");
      if (!label) return;
      if (x - lastX >= MIN_GAP) {
        label.style.display = "";
        lastX = x;
      } else {
        label.style.display = "none";
      }
    });
  }
  window.addEventListener("resize", updateTickLabelVisibility);
  seekTicks.addEventListener("click", (e) => {
    const tick = e.target.closest(".seek-tick");
    if (!tick || tick.dataset.startSeconds == null) return;
    e.stopPropagation();
    const t = parseFloat(tick.dataset.startSeconds);
    audio.currentTime = t;
    fancyScrubber.seekTo(t);
    if (audio.paused) audio.play().catch(() => {
    });
  });
  function discAudioSrc(disc) {
    return disc.blobUrl || (disc.mp3Path ? fileUrl(disc.mp3Path) : null);
  }
  function loadDisc(disc) {
    const src = discAudioSrc(disc);
    if (!src) return;
    state.currentDiscId = disc.id;
    state.currentTrackIndex = -1;
    audio.src = src;
    audio.load();
    updateNowPlaying(-1);
    highlightTrackInSidebar(disc.id, -1);
    if (disc.mp3Path) {
      loadWaveform(disc);
      loadArtwork(disc);
      exportBtn.classList.toggle("hidden", !disc.tracks.length);
      updateScrubberBookmarks();
      const prog = getDiscProgress(disc.mp3Path);
      if (prog && prog.position > 10) showResumeBanner(disc, prog);
    } else {
      fancyScrubber.clear();
      wfSection.classList.add("hidden");
      exportBtn.classList.add("hidden");
    }
  }
  function playDiscAtTrack(disc, trackIdx) {
    const src = discAudioSrc(disc);
    if (!src) return;
    const alreadyLoaded = state.currentDiscId === disc.id && audio.src;
    const srcMatch = disc.mp3Path ? audio.src.includes(encodeURIComponent(disc.mp3Path)) : audio.src === disc.blobUrl;
    if (!alreadyLoaded || !srcMatch) {
      state.currentDiscId = disc.id;
      audio.src = src;
      audio.load();
    } else {
      state.currentDiscId = disc.id;
    }
    state.currentTrackIndex = trackIdx;
    updateNowPlaying(trackIdx);
    highlightTrackInSidebar(disc.id, trackIdx);
    loadWaveform(disc);
    loadArtwork(disc);
    const startSecs = disc.tracks[trackIdx] ? disc.tracks[trackIdx].startSeconds : 0;
    function seekAndPlay() {
      audio.currentTime = startSecs;
      fancyScrubber.seekTo(startSecs);
      audio.play().catch(() => {
      });
      updateSeekTicks();
      audio.removeEventListener("loadedmetadata", seekAndPlay);
    }
    if (audio.readyState >= 1) seekAndPlay();
    else audio.addEventListener("loadedmetadata", seekAndPlay);
  }
  var shuffleOn = false;
  var repeatMode = "off";
  function getRepeatMode() {
    return repeatMode;
  }
  function getShuffleOn() {
    return shuffleOn;
  }
  function setShuffleOn(on) {
    shuffleOn = on;
    btnShuffle.classList.toggle("active", on);
    btnShuffle.title = on ? "Shuffle on" : "Shuffle";
  }
  function cycleRepeat() {
    repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
    btnRepeat.classList.toggle("active", repeatMode !== "off");
    btnRepeat.title = repeatMode === "one" ? "Repeat one" : repeatMode === "all" ? "Repeat all" : "Repeat";
    btnRepeat.innerHTML = repeatMode === "one" ? '&#x21BB;<sup style="font-size:8px">1</sup>' : "&#x21BB;";
  }
  function nextTrackIndex(disc, currentIdx) {
    if (shuffleOn && disc.tracks.length > 1) {
      let idx;
      do {
        idx = Math.floor(Math.random() * disc.tracks.length);
      } while (idx === currentIdx);
      return idx;
    }
    if (currentIdx < disc.tracks.length - 1) return currentIdx + 1;
    return repeatMode === "all" ? 0 : -1;
  }
  btnShuffle.addEventListener("click", () => setShuffleOn(!shuffleOn));
  btnRepeat.addEventListener("click", cycleRepeat);
  function getTrackBounds() {
    const disc = currentDisc();
    const dur = audio.duration;
    const fallback = { start: 0, end: isFinite(dur) ? dur : 0 };
    if (!disc || !disc.tracks || !disc.tracks.length) return fallback;
    const idx = state.currentTrackIndex >= 0 ? state.currentTrackIndex : 0;
    const track = disc.tracks[idx];
    if (!track) return fallback;
    const next = disc.tracks[idx + 1];
    return { start: track.startSeconds, end: next ? next.startSeconds : isFinite(dur) ? dur : track.startSeconds };
  }
  timeTotal.style.minWidth = "68px";
  timeTotal.addEventListener("click", () => {
    showRemaining = !showRemaining;
    timeTotal.style.color = showRemaining ? "var(--accent)" : "";
  });
  function playAdjacentDisc(direction) {
    const discs = state.discs.filter((d) => d.mp3Path || d.blobUrl);
    const idx = discs.findIndex((d) => d.id === state.currentDiscId);
    if (idx < 0) return;
    const target = discs[direction === "next" ? idx + 1 : idx - 1];
    if (!target) return;
    if (target.tracks.length > 0) {
      playDiscAtTrack(target, direction === "next" ? 0 : target.tracks.length - 1);
    } else {
      loadDisc(target);
      audio.play().catch(() => {
      });
    }
  }
  btnPlay.addEventListener("click", () => {
    const spotifyPlayer2 = getSpotifyPlayer();
    const spotifyCurrentUri2 = getSpotifyCurrentUri();
    if (spotifyPlayer2 && spotifyCurrentUri2) {
      spotifyPlayer2.togglePlay().catch(() => {
      });
      return;
    }
    if (audio.paused) audio.play().catch(() => {
    });
    else audio.pause();
  });
  btnPrev.addEventListener("click", () => {
    const disc = currentDisc();
    if (!disc) return;
    const idx = state.currentTrackIndex;
    if (disc.tracks.length > 0) {
      if (idx > 0 && audio.currentTime - disc.tracks[idx].startSeconds < 3) {
        playDiscAtTrack(disc, idx - 1);
      } else if (idx > 0) {
        const t = disc.tracks[idx].startSeconds;
        audio.currentTime = t;
        fancyScrubber.seekTo(t);
      } else {
        playAdjacentDisc("prev");
      }
    } else {
      if (audio.currentTime > 3) {
        audio.currentTime = 0;
        fancyScrubber.seekTo(0);
      } else playAdjacentDisc("prev");
    }
  });
  btnNext.addEventListener("click", () => {
    const disc = currentDisc();
    if (!disc) return;
    if (disc.tracks.length > 0) {
      const next = nextTrackIndex(disc, state.currentTrackIndex);
      if (next >= 0) playDiscAtTrack(disc, next);
      else playAdjacentDisc("next");
    } else {
      playAdjacentDisc("next");
    }
  });
  seekBar.addEventListener("mousedown", () => {
    state.seeking = true;
  });
  document.addEventListener("mouseup", () => {
    state.seeking = false;
  });
  function seekBarToAbsoluteTime() {
    if (!isFinite(audio.duration)) return null;
    if (isMini) {
      const { start, end } = getTrackBounds();
      return start + seekBar.value / 100 * (end - start);
    }
    return seekBar.value / 100 * audio.duration;
  }
  seekBar.addEventListener("input", () => {
    const t = seekBarToAbsoluteTime();
    if (t === null) return;
    if (isMini) {
      const { start } = getTrackBounds();
      timeCurrent.textContent = formatTime(Math.max(0, t - start));
    } else {
      timeCurrent.textContent = formatTime(t);
    }
    audio.currentTime = t;
    fancyScrubber.seekTo(t);
  });
  seekBar.addEventListener("change", () => {
    const t = seekBarToAbsoluteTime();
    if (t !== null) audio.currentTime = t;
    state.seeking = false;
  });
  volumeBar.addEventListener("input", () => {
    audio.volume = volumeBar.value;
  });
  finderBtn.addEventListener("click", () => {
    const p = finderBtn.dataset.path;
    if (!p) return;
    if (window.electronAPI?.revealFile) window.electronAPI.revealFile(p);
    else fetch(`/api/reveal?path=${encodeURIComponent(p)}`).catch(() => {
    });
  });
  var savePlayStateTimer = null;
  audio.addEventListener("timeupdate", () => {
    if (state.seeking) return;
    const ct = audio.currentTime;
    const dur = audio.duration;
    if (isMini && isFinite(dur)) {
      const { start, end } = getTrackBounds();
      const trackDur = end - start;
      const trackPos = ct - start;
      timeCurrent.textContent = formatTime(Math.max(0, trackPos));
      timeTotal.textContent = showRemaining ? `-${formatTime(Math.max(0, trackDur - trackPos))}` : formatTime(trackDur);
      seekBar.value = trackDur > 0 ? Math.max(0, Math.min(100, trackPos / trackDur * 100)) : 0;
    } else {
      timeCurrent.textContent = formatTime(ct);
      if (isFinite(dur)) {
        timeTotal.textContent = showRemaining ? `-${formatTime(dur - ct)}` : formatTime(dur);
        seekBar.value = ct / dur * 100;
      }
    }
    const newIdx = detectCurrentTrack(ct);
    if (newIdx !== state.currentTrackIndex) {
      state.currentTrackIndex = newIdx;
      updateNowPlaying(newIdx);
      highlightTrackInSidebar(state.currentDiscId, newIdx);
      if (!nfoPane.classList.contains("hidden")) {
        highlightNfo();
        highlightTracklist();
      }
      const _disc = currentDisc();
      if (_disc && newIdx >= 0) {
        checkScrobble(_disc, newIdx);
        updateDiscordPresence(_disc, newIdx);
      }
    }
    updateTrackProgress();
    if (!savePlayStateTimer) {
      savePlayStateTimer = setTimeout(() => {
        savePlayStateTimer = null;
        if (isSoundcloudMode() && getSoundcloudActiveIdx() >= 0) {
          STORAGE.setStreamSession({ mode: "soundcloud", trackIdx: getSoundcloudActiveIdx(), position: audio.currentTime });
          return;
        }
        const disc = currentDisc();
        if (disc && disc.mp3Path) {
          STORAGE.setPlayState({ mp3Path: disc.mp3Path, trackIdx: state.currentTrackIndex, position: audio.currentTime });
        }
      }, 1e4);
    }
  });
  audio.addEventListener("loadedmetadata", () => {
    if (isFinite(audio.duration)) {
      timeTotal.textContent = formatTime(audio.duration);
      updateSeekTicks();
    }
  });
  audio.addEventListener("play", () => {
    btnPlay.innerHTML = "&#9646;&#9646;";
    window.electronAPI?.fixAudioInput();
  });
  audio.addEventListener("pause", () => {
    btnPlay.innerHTML = "&#9654;";
    if (isSoundcloudMode() && getSoundcloudActiveIdx() >= 0) {
      STORAGE.setStreamSession({ mode: "soundcloud", trackIdx: getSoundcloudActiveIdx(), position: audio.currentTime });
      return;
    }
    const disc = currentDisc();
    if (disc && disc.mp3Path) {
      STORAGE.setPlayState({ mp3Path: disc.mp3Path, trackIdx: state.currentTrackIndex, position: audio.currentTime });
      saveDiscProgress();
    }
  });
  audio.addEventListener("play", () => {
    const spotifyPlayer2 = getSpotifyPlayer();
    if (spotifyPlayer2) {
      spotifyPlayer2.getCurrentState().then((s) => {
        if (s && !s.paused) spotifyPlayer2.pause().catch(() => {
        });
      }).catch(() => {
      });
    }
  });
  audio.addEventListener("ended", () => {
    btnPlay.innerHTML = "&#9654;";
    if (isSoundcloudMode() && getSoundcloudActiveIdx() >= 0) {
      playSoundcloudTrack(getSoundcloudActiveIdx() + 1);
      return;
    }
    const disc = currentDisc();
    if (!disc) return;
    if (repeatMode === "one") {
      const t = disc.tracks[state.currentTrackIndex];
      audio.currentTime = t ? t.startSeconds : 0;
      audio.play().catch(() => {
      });
    } else {
      if (playFromQueue()) return;
      const next = nextTrackIndex(disc, state.currentTrackIndex);
      if (next >= 0) {
        playDiscAtTrack(disc, next);
      } else {
        playAdjacentDisc("next");
      }
    }
  });
  window.addEventListener("beforeunload", () => {
    const disc = currentDisc();
    if (disc && disc.mp3Path) {
      STORAGE.setPlayState({ mp3Path: disc.mp3Path, trackIdx: state.currentTrackIndex, position: audio.currentTime });
    }
  });
  var scanToken = 0;
  async function scanDirectory(dir, autoplay = false) {
    const token = ++scanToken;
    discList.innerHTML = '<div class="status-msg">Loading...</div>';
    currentWfPath = null;
    fancyScrubber.clear();
    wfSection.classList.add("hidden");
    try {
      const res = await fetch(`/api/scan?dir=${encodeURIComponent(dir)}`);
      if (!res.ok) {
        const data2 = await res.json().catch(() => ({}));
        throw new Error(data2.error || res.statusText);
      }
      const data = await res.json();
      if (token !== scanToken) return;
      state.discs = data.discs;
      for (const disc of state.discs) loadScrapedTracklist(disc);
      renderDiscList();
      if (autoplay) {
        const first = state.discs.find((d) => d.mp3Path && d.tracks.length);
        if (first) {
          playDiscAtTrack(first, 0);
        } else {
          const disc = state.discs.find((d) => d.mp3Path);
          if (disc) {
            loadDisc(disc);
            audio.addEventListener("canplay", function p() {
              audio.removeEventListener("canplay", p);
              audio.play().catch(() => {
              });
            });
          }
        }
        showNfo(dir);
        return;
      }
      const saved = STORAGE.getPlayState();
      const savedDisc = saved && state.discs.find((d) => d.mp3Path === saved.mp3Path);
      if (savedDisc) {
        state.currentDiscId = savedDisc.id;
        state.currentTrackIndex = saved.trackIdx;
        audio.src = fileUrl(savedDisc.mp3Path);
        audio.load();
        updateNowPlaying(saved.trackIdx);
        highlightTrackInSidebar(savedDisc.id, saved.trackIdx);
        audio.addEventListener("loadedmetadata", function restorePos() {
          audio.currentTime = saved.position || 0;
          audio.removeEventListener("loadedmetadata", restorePos);
        });
        loadWaveform(savedDisc);
        loadArtwork(savedDisc);
      } else {
        const first = state.discs.find((d) => d.mp3Path);
        if (first && !currentDisc()) loadDisc(first);
      }
      showNfo(dir);
    } catch (err) {
      discList.innerHTML = `<div class="status-msg" style="color:#c06060">Error: ${escapeHtml(err.message)}</div>`;
    }
  }
  function loadRoot(dir) {
    STORAGE.setDir(dir);
    STORAGE.setScanDir("");
    STORAGE.setFilter("");
    const fi = document.getElementById("filter-input");
    if (fi) fi.value = "";
    invalidateSearchIndex();
    loadFolderBrowser(dir, true);
  }
  var invalidateSearchIndex = () => {
  };
  function setInvalidateSearchIndex(fn) {
    invalidateSearchIndex = fn;
  }
  document.getElementById("sync-test-btn").addEventListener("click", async (e) => {
    e.currentTarget.blur();
    const url = "/api/sync-test";
    audio.src = url;
    audio.load();
    const fakeTracks = Array.from({ length: 120 }, (_, i) => ({
      track: i + 1,
      title: `Second ${i + 1}`,
      startSeconds: i,
      performer: ""
    }));
    wfSection.classList.remove("hidden");
    wfStatus.classList.remove("hidden");
    fancyScrubber.clear();
    try {
      const res = await fetch(`/api/sync-test-waveform?bucketMs=${STORAGE.getSpectrumRes()}`);
      if (res.ok) {
        const data = await res.json();
        fancyScrubber.load(data, fakeTracks);
        wfStatus.classList.add("hidden");
      }
    } catch (_) {
      wfStatus.classList.add("hidden");
    }
    document.getElementById("np-disc").textContent = "Sync Test Track";
    document.getElementById("np-title").textContent = "Beep every second (1 kHz marker + pitch tone)";
    document.getElementById("np-performer").textContent = "";
    audio.addEventListener("canplay", function onCanPlay() {
      audio.removeEventListener("canplay", onCanPlay);
      audio.play().catch(() => {
      });
    });
  });
  function setWaveformVisible2(on) {
    waveformVisible = on;
    STORAGE.setWaveformOn(on);
    const waveformToggle2 = document.getElementById("waveform-toggle");
    waveformToggle2.classList.toggle("off", !on);
    if (!on) {
      liveSpectrum.stop();
      wfSection.classList.add("hidden");
      mainTop.style.height = "";
      return;
    }
    const saved = STORAGE.getMainTopH();
    if (saved) mainTop.style.height = `${saved}px`;
    if (isSoundcloudMode() && getSoundcloudActiveIdx() >= 0) {
      showLiveSpectrum();
      return;
    }
    if (isSpotifyMode() && getSpotifyCurrentUri()) {
      showLiveSpectrum();
      return;
    }
    const disc = currentDisc();
    if (!disc || !disc.mp3Path) return;
    if (currentWfPath === disc.mp3Path && fancyScrubber.peaks) {
      wfSection.classList.remove("hidden");
      fancyScrubber._invalidateCache();
      fancyScrubber._draw();
    } else {
      currentWfPath = null;
      loadWaveform(disc);
    }
  }
  document.getElementById("waveform-toggle").addEventListener("click", () => setWaveformVisible2(!waveformVisible));
  function triggerStarFirework() {
    const textNode = Array.from(npTitle.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
    if (!textNode) return;
    const range = document.createRange();
    range.selectNode(textNode);
    const textRect = range.getBoundingClientRect();
    const midY = textRect.top + textRect.height * 0.5;
    const colors = ["#ffd700", "#ffed4a", "#ff8c00", "#fffbe8", "#ffffff"];
    const origins = [
      { x: textRect.left - 22, y: midY },
      { x: textRect.right + 22, y: midY }
    ];
    for (const origin of origins) {
      const count = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const angle = Math.PI * 2 * i / count + (Math.random() - 0.5) * 0.6;
        const dist = 16 + Math.random() * 24;
        const spark = document.createElement("span");
        spark.className = "star-spark";
        spark.style.left = `${origin.x - 2}px`;
        spark.style.top = `${origin.y - 2}px`;
        spark.style.background = colors[Math.floor(Math.random() * colors.length)];
        spark.style.setProperty("--spark-dx", `${(Math.cos(angle) * dist).toFixed(1)}px`);
        spark.style.setProperty("--spark-dy", `${(Math.sin(angle) * dist).toFixed(1)}px`);
        document.body.appendChild(spark);
        setTimeout(() => spark.remove(), 700);
      }
    }
  }
  function startWaveformLoop() {
    let lastBeatMs = 0;
    (function waveformLoop() {
      requestAnimationFrame(waveformLoop);
      fancyScrubber.tick(audio.currentTime);
      if (!audio.paused && npTitle.classList.contains("is-fav") && ovScrubber.peaks) {
        const now = Date.now();
        if (now - lastBeatMs > 350) {
          const bi = Math.floor(audio.currentTime / (ovScrubber.bucketSecs || 1));
          const peak = ovScrubber.peaks[bi] || 0;
          const windowSize = 8;
          let sum = 0;
          for (let k = Math.max(0, bi - windowSize); k < bi; k++) sum += ovScrubber.peaks[k] || 0;
          const avg = sum / Math.max(1, bi - Math.max(0, bi - windowSize));
          if (peak > 180 && peak > avg * 1.3) {
            lastBeatMs = now;
            triggerStarFirework();
          }
        }
      }
    })();
  }

  // src/layout.js
  init_state();
  init_helpers();
  init_dom_refs();
  var _fancyScrubber3 = null;
  var _ovScrubber2 = null;
  var _zmScrubber2 = null;
  function registerDeps6(deps) {
    if (deps.fancyScrubber) _fancyScrubber3 = deps.fancyScrubber;
    if (deps.ovScrubber) _ovScrubber2 = deps.ovScrubber;
    if (deps.zmScrubber) _zmScrubber2 = deps.zmScrubber;
  }
  var isMini2 = false;
  var showRemaining2 = false;
  function updateMiniInfo2() {
    const disc = currentDisc();
    const track = disc && state.currentTrackIndex >= 0 ? disc.tracks[state.currentTrackIndex] : null;
    miniTrack.textContent = track ? track.title || "\u2014" : disc ? disc.albumTitle || "\u2014" : "\u2014";
    miniSub.textContent = track ? track.performer || disc.albumPerformer || "" : disc ? disc.albumPerformer || "" : "";
  }
  function setMiniPlayer(mini) {
    isMini2 = mini;
    document.body.classList.toggle("mini", mini);
    miniBtn.title = mini ? "Full player" : "Mini player";
    miniBtn.innerHTML = mini ? "&#x229E;" : "&#x2296;";
    if (mini) {
      updateMiniInfo2();
    } else {
      const ct = audio.currentTime;
      const dur = audio.duration;
      if (isFinite(dur)) {
        seekBar.value = ct / dur * 100;
        timeCurrent.textContent = formatTime(ct);
        timeTotal.textContent = showRemaining2 ? `-${formatTime(dur - ct)}` : formatTime(dur);
      }
    }
    if (window.electronAPI) window.electronAPI.setMiniPlayer(mini);
  }
  miniBtn.addEventListener("click", () => setMiniPlayer(!isMini2));
  function setSidebarCollapsed(collapsed) {
    state.sidebarCollapsed = collapsed;
    sidebar.classList.toggle("collapsed", collapsed);
    if (collapsed) {
      collapseBtn.innerHTML = "&#x25BA;";
      collapseBtn.title = "Show sidebar";
      collapseBtn.style.left = "0";
      resizeHandle.style.display = "none";
    } else {
      collapseBtn.innerHTML = "&#x25C4;";
      collapseBtn.title = "Hide sidebar";
      const w = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width"), 10);
      collapseBtn.style.left = `${w}px`;
      resizeHandle.style.display = "";
    }
  }
  collapseBtn.addEventListener("click", () => setSidebarCollapsed(!state.sidebarCollapsed));
  function initSidebarResize() {
    let startX = 0, startW = 0;
    resizeHandle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startX = e.clientX;
      startW = sidebar.offsetWidth;
      resizeHandle.classList.add("dragging");
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    });
    document.addEventListener("mousemove", (e) => {
      if (!resizeHandle.classList.contains("dragging")) return;
      const newW = Math.max(200, Math.min(600, startW + e.clientX - startX));
      document.documentElement.style.setProperty("--sidebar-width", `${newW}px`);
      sidebar.style.width = `${newW}px`;
      collapseBtn.style.left = `${newW}px`;
      STORAGE.setSidebarW(newW);
    });
    document.addEventListener("mouseup", () => {
      if (resizeHandle.classList.contains("dragging")) {
        resizeHandle.classList.remove("dragging");
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }
    });
  }
  var MIN_PANEL_H = 60;
  var DEFAULT_BROWSER_RATIO = 0.4;
  var panelResize2 = document.getElementById("panel-resize");
  var sidebarHeader = sidebar.querySelector("#sidebar-header");
  var soundcloudBrowser2 = document.getElementById("soundcloud-browser");
  var spotifyBrowser2 = document.getElementById("spotify-browser");
  function getAvailablePanelHeight() {
    return sidebar.offsetHeight - sidebarHeader.offsetHeight - panelResize2.offsetHeight;
  }
  function setBrowserPanelHeight(value, unit = "px") {
    const v = `${value}${unit}`;
    folderBrowser.style.height = v;
    soundcloudBrowser2.style.height = v;
    spotifyBrowser2.style.height = v;
    document.documentElement.style.setProperty("--browser-height", v);
  }
  function persistBrowserH() {
    const h = folderBrowser.offsetHeight;
    STORAGE.setBrowserH(Math.round(h / getAvailablePanelHeight() * 100));
  }
  function initPanelResize() {
    let startY = 0, startH = 0;
    panelResize2.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      e.preventDefault();
      startY = e.clientY;
      const isSc = !soundcloudBrowser2.classList.contains("hidden") && soundcloudBrowser2.offsetHeight > 0;
      const isSp = !spotifyBrowser2.classList.contains("hidden") && spotifyBrowser2.offsetHeight > 0;
      startH = isSc ? soundcloudBrowser2.offsetHeight : isSp ? spotifyBrowser2.offsetHeight : folderBrowser.offsetHeight;
      panelResize2.classList.add("dragging");
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
    });
    document.addEventListener("mousemove", (e) => {
      if (!panelResize2.classList.contains("dragging")) return;
      const available = getAvailablePanelHeight();
      const newH = Math.max(MIN_PANEL_H, Math.min(available - MIN_PANEL_H, startH + e.clientY - startY));
      setBrowserPanelHeight(newH);
    });
    document.addEventListener("mouseup", () => {
      if (panelResize2.classList.contains("dragging")) {
        panelResize2.classList.remove("dragging");
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        persistBrowserH();
      }
    });
  }
  document.getElementById("panel-maximize-tracks").addEventListener("click", (e) => {
    e.stopPropagation();
    setBrowserPanelHeight(MIN_PANEL_H);
    persistBrowserH();
  });
  document.getElementById("panel-maximize-browser").addEventListener("click", (e) => {
    e.stopPropagation();
    setBrowserPanelHeight(getAvailablePanelHeight() - MIN_PANEL_H);
    persistBrowserH();
  });
  panelResize2.addEventListener("dblclick", () => {
    setBrowserPanelHeight(Math.round(getAvailablePanelHeight() * DEFAULT_BROWSER_RATIO));
    persistBrowserH();
  });
  var mainResizeH2 = document.getElementById("main-resize-h");
  function initMainResize() {
    const saved = STORAGE.getMainTopH();
    if (saved) mainTop.style.height = `${saved}px`;
    let startY = 0, startH = 0;
    mainResizeH2.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startY = e.clientY;
      startH = mainTop.offsetHeight;
      mainResizeH2.classList.add("dragging");
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
    });
    document.addEventListener("mousemove", (e) => {
      if (!mainResizeH2.classList.contains("dragging")) return;
      const main = document.getElementById("main");
      const newH = Math.max(80, Math.min(main.offsetHeight - 80, startH + e.clientY - startY));
      mainTop.style.height = `${newH}px`;
      STORAGE.setMainTopH(newH);
    });
    document.addEventListener("mouseup", () => {
      if (mainResizeH2.classList.contains("dragging")) {
        mainResizeH2.classList.remove("dragging");
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      }
    });
  }
  function initNowPlayingResize() {
    const npPane = document.getElementById("now-playing");
    const handle = document.getElementById("np-resize-h");
    const saved = parseInt(localStorage.getItem("tlp_np_h"), 10);
    if (saved) npPane.style.height = `${saved}px`;
    let startY = 0, startH = 0;
    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startY = e.clientY;
      startH = npPane.offsetHeight;
      handle.classList.add("dragging");
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
    });
    document.addEventListener("mousemove", (e) => {
      if (!handle.classList.contains("dragging")) return;
      const newH = Math.max(60, Math.min(500, startH + e.clientY - startY));
      npPane.style.height = `${newH}px`;
      localStorage.setItem("tlp_np_h", newH);
    });
    document.addEventListener("mouseup", () => {
      if (!handle.classList.contains("dragging")) return;
      handle.classList.remove("dragging");
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    });
  }
  function initWaveformResize() {
    const ovWrap = document.getElementById("wf-overview-wrap");
    const zmWrap = document.getElementById("wf-zoom-wrap");
    const midHandle = document.getElementById("wf-resize-mid");
    const botHandle = document.getElementById("wf-resize-bot");
    const savedOvH = parseInt(localStorage.getItem("tlp_wf_ov_h"), 10) || 50;
    const savedZmH = parseInt(localStorage.getItem("tlp_wf_zm_h"), 10) || 110;
    ovWrap.style.height = `${savedOvH}px`;
    zmWrap.style.height = `${savedZmH}px`;
    let dragging = null, startY = 0, startH = 0;
    function beginDrag(handle, wrap, e) {
      e.preventDefault();
      dragging = { handle, wrap };
      startY = e.clientY;
      startH = wrap.offsetHeight;
      handle.classList.add("dragging");
      document.body.style.userSelect = "none";
      document.body.style.cursor = "row-resize";
    }
    midHandle.addEventListener("mousedown", (e) => beginDrag(midHandle, ovWrap, e));
    botHandle.addEventListener("mousedown", (e) => beginDrag(botHandle, zmWrap, e));
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const min = dragging.wrap === ovWrap ? 16 : 30;
      const max = dragging.wrap === ovWrap ? 200 : 400;
      const newH = Math.max(min, Math.min(max, startH + e.clientY - startY));
      dragging.wrap.style.height = `${newH}px`;
      localStorage.setItem(dragging.wrap === ovWrap ? "tlp_wf_ov_h" : "tlp_wf_zm_h", newH);
      if (_ovScrubber2 && _zmScrubber2) {
        if (dragging.wrap === ovWrap) {
          _ovScrubber2._invalidateCache();
          _ovScrubber2._draw();
        } else {
          _zmScrubber2._invalidateCache();
          _zmScrubber2._draw();
        }
      }
    });
    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging.handle.classList.remove("dragging");
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      dragging = null;
    });
  }

  // src/settings.js
  init_state();
  init_helpers();
  init_dom_refs();
  var _applyTheme = null;
  var _setWaveformVisible = null;
  var _setTrackLabelsVisible = null;
  var _setShuffleOn = null;
  var _cycleRepeat = null;
  var _getRepeatMode = null;
  var _getShuffleOn = null;
  var _fancyScrubber4 = null;
  var _getCurrentWfPath = null;
  var _loadWaveform = null;
  var _connectSpotify = null;
  var _disconnectSpotify = null;
  var _connectSoundcloud = null;
  var _disconnectSoundcloud = null;
  function registerDeps7(deps) {
    _applyTheme = deps.applyTheme;
    _setWaveformVisible = deps.setWaveformVisible;
    _setTrackLabelsVisible = deps.setTrackLabelsVisible;
    _setShuffleOn = deps.setShuffleOn;
    _cycleRepeat = deps.cycleRepeat;
    _getRepeatMode = deps.getRepeatMode;
    _getShuffleOn = deps.getShuffleOn;
    _fancyScrubber4 = deps.fancyScrubber;
    _getCurrentWfPath = deps.getCurrentWfPath;
    _loadWaveform = deps.loadWaveform;
    _connectSpotify = deps.connectSpotify;
    _disconnectSpotify = deps.disconnectSpotify;
    _connectSoundcloud = deps.connectSoundcloud;
    _disconnectSoundcloud = deps.disconnectSoundcloud;
  }
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    if (themeToggle) {
      themeToggle.textContent = theme === "dark" ? "\u2600" : "\u263E";
    }
  }
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      STORAGE.setTheme(next);
      if (_fancyScrubber4) _fancyScrubber4._invalidateCache();
    });
  }
  var settingsBtn = document.getElementById("settings-btn");
  var settingsOverlay = document.getElementById("settings-overlay");
  var settingsClose = document.getElementById("settings-close");
  var settingsVolume = document.getElementById("settings-volume");
  var settingsVolVal = document.getElementById("settings-volume-val");
  var waveformVisible2 = true;
  function openSettings() {
    syncSettingsBtns("theme", STORAGE.getTheme());
    syncSettingsBtns("spectrum", waveformVisible2 ? "on" : "off");
    syncSettingsBtns("spectrumRes", String(STORAGE.getSpectrumRes()));
    syncSettingsBtns("trackLabels", STORAGE.getTrackLabels() ? "on" : "off");
    syncSettingsBtns("repeat", _getRepeatMode ? _getRepeatMode() : STORAGE.getRepeat());
    syncSettingsBtns("shuffle", _getShuffleOn ? _getShuffleOn() ? "on" : "off" : STORAGE.getShuffle() ? "on" : "off");
    settingsVolume.value = audio.volume;
    settingsVolVal.textContent = Math.round(audio.volume * 100) + "%";
    fetch("/api/spotify/config").then((r) => r.json()).then((cfg) => {
      const cidInput = document.getElementById("spotify-client-id-input");
      if (cidInput) cidInput.value = cfg.client_id || "";
      const statusEl = document.getElementById("spotify-settings-status");
      if (statusEl) statusEl.textContent = cfg.connected ? "Status: Connected" : "";
      const disconnectRow = document.getElementById("spotify-disconnect-row");
      if (disconnectRow) disconnectRow.classList.toggle("hidden", !cfg.connected);
    }).catch(() => {
    });
    settingsOverlay.classList.remove("hidden");
  }
  function closeSettings() {
    settingsOverlay.classList.add("hidden");
  }
  function syncSettingsBtns(setting, value) {
    settingsOverlay.querySelectorAll(`.seg-btn[data-setting="${setting}"]`).forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.value === value);
    });
  }
  settingsOverlay.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) {
      closeSettings();
      return;
    }
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    const { setting, value } = btn.dataset;
    syncSettingsBtns(setting, value);
    if (setting === "theme") {
      applyTheme(value);
      STORAGE.setTheme(value);
      if (_fancyScrubber4) {
        _fancyScrubber4._invalidateCache();
        if (waveformVisible2 && _getCurrentWfPath && _getCurrentWfPath()) {
          _fancyScrubber4._draw();
        }
      }
    } else if (setting === "spectrum") {
      if (_setWaveformVisible) _setWaveformVisible(value === "on");
    } else if (setting === "spectrumRes") {
      const ms = parseInt(value, 10);
      STORAGE.setSpectrumRes(ms);
      if (_loadWaveform) {
        const disc = currentDisc();
        if (disc) _loadWaveform(disc);
      }
    } else if (setting === "repeat") {
      if (_cycleRepeat && _getRepeatMode) {
        while (_getRepeatMode() !== value) _cycleRepeat();
        STORAGE.setRepeat(_getRepeatMode());
      }
    } else if (setting === "shuffle") {
      if (_setShuffleOn) {
        _setShuffleOn(value === "on");
        STORAGE.setShuffle(value === "on");
      }
    } else if (setting === "trackLabels") {
      if (_setTrackLabelsVisible) _setTrackLabelsVisible(value === "on");
    }
  });
  settingsClose.addEventListener("click", closeSettings);
  settingsBtn.addEventListener("click", openSettings);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSettings();
  });
  settingsVolume.addEventListener("input", () => {
    const v = parseFloat(settingsVolume.value);
    audio.volume = v;
    volumeBar.value = v;
    STORAGE.setVolume(v);
    settingsVolVal.textContent = Math.round(v * 100) + "%";
  });
  var reindexBtn = document.getElementById("reindex-btn");
  var reindexStatus = document.getElementById("reindex-status");
  var _libraryFolders = [];
  var _invalidateIndex = null;
  function setLibraryFolders(v) {
    _libraryFolders = v;
  }
  function setInvalidateIndex(fn) {
    _invalidateIndex = fn;
  }
  if (reindexBtn) {
    reindexBtn.addEventListener("click", async () => {
      reindexBtn.disabled = true;
      reindexStatus.textContent = "Rebuilding\u2026";
      if (_invalidateIndex) _invalidateIndex();
      try {
        const currentRoot = STORAGE.getDir();
        const rootsToBust = [...new Set([..._libraryFolders, currentRoot].filter(Boolean))];
        await Promise.all([
          _libraryFolders.length ? fetch("/api/library-index?bust=1") : null,
          ...rootsToBust.map((r) => fetch(`/api/index?root=${encodeURIComponent(r)}&bust=1`))
        ].filter(Boolean));
        reindexStatus.textContent = "Done \u2014 open search to use new index.";
      } catch (_) {
        reindexStatus.textContent = "Failed \u2014 check console.";
      } finally {
        reindexBtn.disabled = false;
      }
    });
  }
  var spotifySaveCredsBtn = document.getElementById("spotify-save-creds-btn");
  var spotifyConnectSettingsBtn = document.getElementById("spotify-connect-settings-btn");
  var spotifyDisconnectBtn = document.getElementById("spotify-disconnect-btn");
  if (spotifySaveCredsBtn) {
    spotifySaveCredsBtn.addEventListener("click", async () => {
      const clientId = (document.getElementById("spotify-client-id-input") || {}).value || "";
      const clientSecret = (document.getElementById("spotify-client-secret-input") || {}).value || "";
      const statusEl = document.getElementById("spotify-settings-status");
      if (!clientId || !clientSecret) {
        if (statusEl) statusEl.textContent = "Both Client ID and Client Secret are required.";
        return;
      }
      try {
        const res = await fetch("/api/spotify/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
        });
        if (res.ok) {
          if (statusEl) statusEl.textContent = "Credentials saved.";
        } else {
          if (statusEl) statusEl.textContent = "Save failed.";
        }
      } catch (_) {
        if (statusEl) {
          statusEl.textContent = "Save failed.";
        }
      }
    });
  }
  if (spotifyConnectSettingsBtn) {
    spotifyConnectSettingsBtn.addEventListener("click", async () => {
      closeSettings();
      if (_connectSpotify) await _connectSpotify();
    });
  }
  if (spotifyDisconnectBtn) {
    spotifyDisconnectBtn.addEventListener("click", async () => {
      if (_disconnectSpotify) await _disconnectSpotify();
      const statusEl = document.getElementById("spotify-settings-status");
      if (statusEl) statusEl.textContent = "Disconnected.";
      const disconnectRow = document.getElementById("spotify-disconnect-row");
      if (disconnectRow) disconnectRow.classList.add("hidden");
    });
  }
  var soundcloudSaveCredsBtn = document.getElementById("soundcloud-save-creds-btn");
  var soundcloudConnectSettingsBtn = document.getElementById("soundcloud-connect-settings-btn");
  var soundcloudDisconnectBtn = document.getElementById("soundcloud-disconnect-btn");
  if (soundcloudSaveCredsBtn) {
    soundcloudSaveCredsBtn.addEventListener("click", async () => {
      const clientId = (document.getElementById("soundcloud-client-id-input") || {}).value || "";
      const clientSecret = (document.getElementById("soundcloud-client-secret-input") || {}).value || "";
      const statusEl = document.getElementById("soundcloud-settings-status");
      if (!clientId || !clientSecret) {
        if (statusEl) statusEl.textContent = "Both fields required.";
        return;
      }
      try {
        const res = await fetch("/api/soundcloud/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
        });
        if (statusEl) statusEl.textContent = res.ok ? "Credentials saved." : "Save failed.";
      } catch (_) {
        if (statusEl) statusEl.textContent = "Save failed.";
      }
    });
  }
  if (soundcloudConnectSettingsBtn) {
    soundcloudConnectSettingsBtn.addEventListener("click", async () => {
      closeSettings();
      if (_connectSoundcloud) await _connectSoundcloud();
    });
  }
  if (soundcloudDisconnectBtn) {
    soundcloudDisconnectBtn.addEventListener("click", async () => {
      if (_disconnectSoundcloud) await _disconnectSoundcloud();
      const statusEl = document.getElementById("soundcloud-settings-status");
      if (statusEl) statusEl.textContent = "Disconnected.";
      const disconnectRow = document.getElementById("soundcloud-disconnect-row");
      if (disconnectRow) disconnectRow.classList.add("hidden");
    });
  }
  async function openSpotifySaveModal(title, performer) {
    const overlay = document.getElementById("spotify-save-overlay");
    const matchEl = document.getElementById("spotify-save-match");
    const statusEl = document.getElementById("spotify-save-status");
    const playlistsEl = document.getElementById("spotify-save-playlists");
    overlay.classList.remove("hidden");
    matchEl.innerHTML = "";
    statusEl.textContent = "Searching Spotify...";
    playlistsEl.innerHTML = "";
    const { escapeHtml: escapeHtml2 } = await Promise.resolve().then(() => (init_helpers(), helpers_exports));
    const q = encodeURIComponent(`${performer ? performer + " " : ""}${title}`);
    try {
      const searchRes = await fetch(`/api/spotify/search?q=${q}&type=track`);
      if (!searchRes.ok) {
        statusEl.textContent = "Search failed";
        return;
      }
      const data = await searchRes.json();
      const tracks = data.tracks?.items || [];
      if (!tracks.length) {
        statusEl.textContent = "No matches found";
        return;
      }
      const track = tracks[0];
      matchEl.innerHTML = `<div class="spotify-save-match">
      <div class="spotify-save-match-title">${escapeHtml2(track.name)}</div>
      <div class="spotify-save-match-artist">${escapeHtml2(track.artists.map((a) => a.name).join(", "))}</div>
    </div>`;
      statusEl.textContent = "Select a playlist:";
      const plRes = await fetch("/api/spotify/playlists");
      if (!plRes.ok) {
        statusEl.textContent = "Failed to load playlists";
        return;
      }
      const plData = await plRes.json();
      const playlists = plData.items || plData || [];
      playlists.forEach((pl) => {
        const row = document.createElement("div");
        row.className = "spotify-save-playlist";
        row.textContent = pl.name;
        row.addEventListener("click", async () => {
          statusEl.textContent = "Adding...";
          const addRes = await fetch("/api/spotify/add-to-playlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playlistId: pl.id, trackUri: track.uri })
          });
          statusEl.textContent = addRes.ok ? "Added!" : "Failed to add";
          STORAGE.setSpotifyTargetPlaylist(pl.id);
          setTimeout(() => overlay.classList.add("hidden"), 1500);
        });
        playlistsEl.appendChild(row);
      });
    } catch (err) {
      statusEl.textContent = "Error: " + err.message;
    }
  }
  document.getElementById("spotify-save-close")?.addEventListener("click", () => {
    document.getElementById("spotify-save-overlay").classList.add("hidden");
  });
  document.getElementById("spotify-save-overlay")?.addEventListener("click", (e) => {
    if (e.target.id === "spotify-save-overlay") e.target.classList.add("hidden");
  });

  // src/shortcuts.js
  init_state();
  init_dom_refs();
  init_helpers();
  var _playDiscAtTrack5 = null;
  function registerPlayback3(fn) {
    _playDiscAtTrack5 = fn;
  }
  var _savedVolume = 1;
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea, select, [contenteditable]")) return;
    if (e.metaKey || e.ctrlKey) return;
    const shortcutsOverlay = document.getElementById("shortcuts-overlay");
    switch (e.key) {
      case " ":
        e.preventDefault();
        btnPlay.click();
        break;
      case "ArrowLeft":
        e.preventDefault();
        btnPrev.click();
        break;
      case "ArrowRight":
        e.preventDefault();
        btnNext.click();
        break;
      case "ArrowUp":
        if (e.shiftKey) {
          e.preventDefault();
          audio.volume = Math.min(1, audio.volume + 0.05);
          volumeBar.value = audio.volume;
        }
        break;
      case "ArrowDown":
        if (e.shiftKey) {
          e.preventDefault();
          audio.volume = Math.max(0, audio.volume - 0.05);
          volumeBar.value = audio.volume;
        }
        break;
      case "j":
      case "J":
        e.preventDefault();
        audio.currentTime = Math.max(0, audio.currentTime - 10);
        break;
      case "l":
      case "L":
        e.preventDefault();
        if (isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, audio.currentTime + 10);
        break;
      case "m":
      case "M":
        e.preventDefault();
        if (audio.volume > 0) {
          _savedVolume = audio.volume;
          audio.volume = 0;
        } else {
          audio.volume = _savedVolume || 1;
        }
        volumeBar.value = audio.volume;
        break;
      case "f":
      case "F":
        e.preventDefault();
        {
          const disc = currentDisc();
          if (disc && state.currentTrackIndex >= 0) {
            const el = document.querySelector(`.track-item[data-disc="${disc.id}"][data-track="${state.currentTrackIndex}"] .fav-btn`);
            if (el) el.click();
          }
        }
        break;
      case "b":
      case "B":
        e.preventDefault();
        {
          const label = prompt("Bookmark label:", `Bookmark @ ${formatTime(audio.currentTime)}`);
          if (label !== null) addBookmark(label);
        }
        break;
      case "q":
      case "Q":
        e.preventDefault();
        queuePanel.classList.toggle("hidden");
        bookmarksPanel.classList.add("hidden");
        break;
      case "?":
        e.preventDefault();
        shortcutsOverlay.classList.toggle("hidden");
        break;
      case "Escape":
        shortcutsOverlay.classList.add("hidden");
        eqPanel.classList.add("hidden");
        sleepPopover.classList.add("hidden");
        queuePanel.classList.add("hidden");
        bookmarksPanel.classList.add("hidden");
        break;
      default:
        if (e.key >= "1" && e.key <= "9") {
          const disc = currentDisc();
          if (disc && disc.tracks.length >= parseInt(e.key, 10) && _playDiscAtTrack5) {
            e.preventDefault();
            _playDiscAtTrack5(disc, parseInt(e.key, 10) - 1);
          }
        }
    }
  });
  document.getElementById("shortcuts-close")?.addEventListener("click", () => {
    document.getElementById("shortcuts-overlay").classList.add("hidden");
  });

  // src/app.js
  init_spotify();
  init_soundcloud();

  // src/search.js
  init_state();
  init_helpers();
  init_dom_refs();
  var searchModalOverlay = document.getElementById("search-modal-overlay");
  var searchInput = document.getElementById("search-input");
  var searchCount = document.getElementById("search-count");
  var searchResults = document.getElementById("search-results");
  var searchBtn = document.getElementById("search-btn");
  var searchClose = document.getElementById("search-close");
  var musicIndex = null;
  var indexLoading = false;
  var indexEventSources = [];
  var _loadLibrary = null;
  var _libraryFolders2 = [];
  var _scanDirectory3 = null;
  var _loadDisc4 = null;
  var _playDiscAtTrack6 = null;
  function registerDeps8(deps) {
    _loadLibrary = deps.loadLibrary;
    _scanDirectory3 = deps.scanDirectory;
    _loadDisc4 = deps.loadDisc;
    _playDiscAtTrack6 = deps.playDiscAtTrack;
  }
  function setLibraryFolders2(folders) {
    _libraryFolders2 = folders;
  }
  function invalidateIndex() {
    musicIndex = null;
  }
  function openSearchPanel() {
    searchModalOverlay.classList.add("active");
    searchBtn.classList.add("active");
    searchInput.focus();
    searchInput.select();
    if (!musicIndex && !indexLoading) fetchMusicIndex();
  }
  function closeSearchPanel() {
    searchModalOverlay.classList.remove("active");
    searchBtn.classList.remove("active");
  }
  function fetchMusicIndex() {
    for (const src of indexEventSources) src.close();
    indexEventSources = [];
    indexLoading = true;
    musicIndex = [];
    searchResults.innerHTML = '<div class="search-empty">Scanning\u2026 0 albums found</div>';
    searchCount.textContent = "";
    const doLoad = _loadLibrary ? _loadLibrary() : Promise.resolve();
    doLoad.then(() => {
      const currentRoot = STORAGE.getDir();
      const roots = [...new Set([..._libraryFolders2, currentRoot].filter(Boolean))];
      if (!roots.length) {
        searchResults.innerHTML = '<div class="search-empty">Add folders to your library or load a directory first.</div>';
        indexLoading = false;
        return;
      }
      const seen = /* @__PURE__ */ new Set();
      let pending = roots.length;
      let searchDebounce = null;
      function onEntry(entry) {
        const key = entry.mp3Path || entry.dir;
        if (seen.has(key)) return;
        seen.add(key);
        musicIndex.push(entry);
        const n = musicIndex.length;
        if (n % 25 === 0 || n <= 5) {
          searchCount.textContent = `${n}+`;
          if (searchInput.value.trim()) {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => runSearch(searchInput.value), 400);
          } else {
            searchResults.innerHTML = `<div class="search-empty">Scanning\u2026 ${n} albums found</div>`;
          }
        }
      }
      function onDone() {
        pending--;
        if (pending > 0) return;
        indexLoading = false;
        searchCount.textContent = `${musicIndex.length} albums`;
        runSearch(searchInput.value);
      }
      for (const root of roots) {
        const src = new EventSource(`/api/index-stream?root=${encodeURIComponent(root)}`);
        indexEventSources.push(src);
        src.onmessage = (e) => {
          let data;
          try {
            data = JSON.parse(e.data);
          } catch (_) {
            return;
          }
          if (data.done || data.error) {
            src.close();
            onDone();
            return;
          }
          onEntry(data);
        };
        src.onerror = () => {
          src.close();
          onDone();
        };
      }
    }).catch((e) => {
      searchResults.innerHTML = `<div class="search-empty">Index failed: ${escapeHtml(e.message)}</div>`;
      indexLoading = false;
    });
  }
  function highlight(text, words) {
    if (!words.length) return escapeHtml(text);
    let out = escapeHtml(text);
    for (const w of words) {
      const re = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
      out = out.replace(re, "<mark>$1</mark>");
    }
    return out;
  }
  function runSearch(query) {
    if (!musicIndex) return;
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) {
      searchCount.textContent = `${musicIndex.length} albums`;
      searchResults.innerHTML = '<div class="search-empty">Type to search\u2026</div>';
      return;
    }
    const groups = [];
    for (const disc of musicIndex) {
      const discText = [disc.albumTitle, disc.albumPerformer, disc.year].join(" ").toLowerCase();
      const discMatch = words.every((w) => discText.includes(w));
      const matchingTracks = disc.tracks.filter((t) => {
        const tt = [t.title, t.performer].join(" ").toLowerCase();
        return words.every((w) => tt.includes(w));
      });
      if (!discMatch && matchingTracks.length === 0) continue;
      const tracksToShow = matchingTracks.length > 0 ? matchingTracks : discMatch ? disc.tracks.slice(0, 1) : [];
      groups.push({ disc, tracksToShow, discMatch, matchingTracks });
    }
    const totalRows = groups.reduce((s, g) => s + (g.disc.tracks.length === 0 ? 1 : g.tracksToShow.length), 0);
    searchCount.textContent = `${totalRows} result${totalRows !== 1 ? "s" : ""}`;
    if (groups.length === 0) {
      searchResults.innerHTML = '<div class="search-empty">No results.</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    for (const { disc, tracksToShow, discMatch } of groups) {
      const header = document.createElement("div");
      header.className = "search-disc-header";
      header.innerHTML = `<span>${highlight(disc.albumTitle || disc.mp3File || "\u2014", words)}</span><span style="color:var(--text-dim);font-weight:400">${highlight(disc.albumPerformer || "", words)}</span>` + (disc.year ? `<span class="search-disc-year">${disc.year}</span>` : "");
      frag.appendChild(header);
      if (disc.tracks.length === 0) {
        const row = document.createElement("div");
        row.className = "search-result disc-result";
        row.innerHTML = `<span class="search-result-num">&#9654;</span><span class="search-result-title">${highlight(disc.mp3File || disc.albumTitle || "\u2014", words)}</span>`;
        row.addEventListener("click", () => playFromSearch(disc, -1));
        frag.appendChild(row);
      } else {
        for (const track of tracksToShow) {
          const trackIdx = disc.tracks.indexOf(track);
          const row = document.createElement("div");
          row.className = "search-result";
          const dur = track.durationSeconds != null ? `<span class="search-result-dur">${formatDuration(track.durationSeconds)}</span>` : "";
          row.innerHTML = `<span class="search-result-num">${String(track.track).padStart(2, "0")}</span><span class="search-result-title">${highlight(track.title || "\u2014", words)}</span>` + (track.performer ? `<span class="search-result-artist">${highlight(track.performer, words)}</span>` : "") + dur;
          row.addEventListener("click", () => playFromSearch(disc, trackIdx));
          frag.appendChild(row);
        }
      }
    }
    searchResults.innerHTML = "";
    searchResults.appendChild(frag);
  }
  async function playFromSearch(indexDisc, trackIdx) {
    closeSearchPanel();
    const targetMp3 = indexDisc.mp3Path;
    if (_scanDirectory3) await _scanDirectory3(indexDisc.dir);
    const disc = state.discs.find((d) => d.mp3Path === targetMp3);
    if (!disc) return;
    if (trackIdx >= 0 && disc.tracks.length > trackIdx && _playDiscAtTrack6) {
      _playDiscAtTrack6(disc, trackIdx);
    } else if (_loadDisc4) {
      _loadDisc4(disc);
      audio.play().catch(() => {
      });
    }
  }
  searchBtn.addEventListener("click", () => {
    if (searchModalOverlay.classList.contains("active")) closeSearchPanel();
    else openSearchPanel();
  });
  searchClose.addEventListener("click", closeSearchPanel);
  searchModalOverlay.addEventListener("click", (e) => {
    if (e.target === searchModalOverlay) closeSearchPanel();
  });
  searchInput.addEventListener("input", () => runSearch(searchInput.value));
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSearchPanel();
  });

  // src/library.js
  init_helpers();
  var libraryModalOverlay = document.getElementById("library-modal-overlay");
  var libraryFolderList = document.getElementById("library-folder-list");
  var libraryBtn = document.getElementById("library-btn");
  var libraryModalClose = document.getElementById("library-modal-close");
  var libraryAddBtn = document.getElementById("library-add-btn");
  var libraryFolders = [];
  var _invalidateIndex2 = null;
  function registerDeps9(deps) {
    if (deps.invalidateIndex) _invalidateIndex2 = deps.invalidateIndex;
  }
  function getLibraryFolders() {
    return libraryFolders;
  }
  async function loadLibrary() {
    try {
      const res = await fetch("/api/library");
      const data = await res.json();
      libraryFolders = data.folders || [];
    } catch (_) {
      libraryFolders = [];
    }
  }
  function renderLibraryList() {
    libraryFolderList.innerHTML = "";
    if (!libraryFolders.length) {
      libraryFolderList.innerHTML = '<div class="library-empty-msg">No folders in library yet.<br>Click "+ Add Folder" to get started.</div>';
      return;
    }
    for (const folder of libraryFolders) {
      const item = document.createElement("div");
      item.className = "library-folder-item";
      const name = folder.split("/").filter(Boolean).pop() || folder;
      item.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="library-folder-name">${escapeHtml(name)}</div>
        <div class="library-folder-path">${escapeHtml(folder)}</div>
      </div>
      <button class="library-folder-remove" title="Remove from library">&#x2715;</button>
    `;
      item.querySelector(".library-folder-remove").addEventListener("click", async () => {
        await fetch("/api/library", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder }) });
        libraryFolders = libraryFolders.filter((f) => f !== folder);
        if (_invalidateIndex2) _invalidateIndex2();
        renderLibraryList();
      });
      libraryFolderList.appendChild(item);
    }
  }
  async function openLibraryModal() {
    await loadLibrary();
    renderLibraryList();
    libraryModalOverlay.classList.add("active");
    libraryBtn.classList.add("active");
  }
  function closeLibraryModal() {
    libraryModalOverlay.classList.remove("active");
    libraryBtn.classList.remove("active");
  }
  libraryBtn.addEventListener("click", () => {
    if (libraryModalOverlay.classList.contains("active")) closeLibraryModal();
    else openLibraryModal();
  });
  libraryModalClose.addEventListener("click", closeLibraryModal);
  libraryModalOverlay.addEventListener("click", (e) => {
    if (e.target === libraryModalOverlay) closeLibraryModal();
  });
  libraryAddBtn.addEventListener("click", async () => {
    let folder = null;
    if (window.electronAPI?.pickDirectory) {
      folder = await window.electronAPI.pickDirectory();
    } else {
      folder = prompt("Enter folder path:");
    }
    if (!folder) return;
    const res = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder }) });
    const data = await res.json();
    libraryFolders = data.folders || [];
    if (_invalidateIndex2) _invalidateIndex2();
    renderLibraryList();
  });

  // src/dir-browser-modal.js
  init_helpers();
  init_dom_refs();
  var dirModal = document.getElementById("dir-modal-overlay");
  var dirModalEntries = document.getElementById("dir-modal-entries");
  var dirFavList = document.getElementById("dir-fav-list");
  var dirModalFavsSection = document.getElementById("dir-modal-favourites");
  var dirModalCwd = document.getElementById("dir-modal-cwd");
  var dirModalSelected = document.getElementById("dir-modal-selected");
  var dirBrowseBtn = document.getElementById("dir-browse-btn");
  var dirModalPath = "";
  var DIR_FAVS_KEY = "tlp_dir_favs";
  function getDirFavs() {
    try {
      return JSON.parse(localStorage.getItem(DIR_FAVS_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }
  function saveDirFavs(favs) {
    localStorage.setItem(DIR_FAVS_KEY, JSON.stringify(favs));
  }
  var _loadRoot = null;
  var _normEntry = null;
  function registerDeps10(deps) {
    _loadRoot = deps.loadRoot;
    _normEntry = deps.normEntry;
  }
  function normEntryFallback(e) {
    if (_normEntry) return _normEntry(e);
    return typeof e === "string" ? { name: e, mtime: 0 } : e;
  }
  function renderDirFavs() {
    const favs = getDirFavs();
    dirModalFavsSection.classList.toggle("hidden", favs.length === 0);
    dirFavList.innerHTML = favs.map((f, i) => `
    <div class="dir-fav-item${f === dirModalPath ? " selected" : ""}" data-path="${escapeHtml(f)}" data-idx="${i}">
      <span class="dir-entry-icon">&#9733;</span>
      <span>${escapeHtml(f.split("/").pop() || f)}</span>
      <button class="dir-fav-remove" data-idx="${i}" title="Remove">&#x2715;</button>
    </div>`).join("");
  }
  async function browseDir(dir) {
    dirModalCwd.textContent = dir || "(home)";
    try {
      const url = dir ? `/api/ls?dir=${encodeURIComponent(dir)}` : "/api/ls";
      const res = await fetch(url);
      if (!res.ok) throw new Error("ls failed");
      const { parent, subdirs, dir: resolvedDir } = await res.json();
      if (resolvedDir && resolvedDir !== dir) dirModalCwd.textContent = resolvedDir;
      dir = resolvedDir || dir;
      let html = "";
      if (parent) html += `<div class="dir-entry dir-entry-up" data-path="${escapeHtml(parent)}"><span class="dir-entry-icon">&#x2191;</span> ..</div>`;
      const sorted = (subdirs || []).map(normEntryFallback).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      html += sorted.map((d) => {
        const p = `${dir}/${d.name}`;
        return `<div class="dir-entry${p === dirModalPath ? " selected" : ""}" data-path="${escapeHtml(p)}"><span class="dir-entry-icon">&#128193;</span>${escapeHtml(d.name)}</div>`;
      }).join("");
      dirModalEntries.innerHTML = html || '<div style="padding:8px 16px;font-size:12px;color:var(--text-muted)">No subfolders</div>';
    } catch (_) {
      dirModalEntries.innerHTML = '<div style="padding:8px 16px;font-size:12px;color:var(--text-muted)">Cannot read directory</div>';
    }
    renderDirFavs();
  }
  function selectDirPath(p) {
    dirModalPath = p;
    dirModalSelected.textContent = p;
    dirModalEntries.querySelectorAll(".dir-entry").forEach((el) => el.classList.toggle("selected", el.dataset.path === p));
    dirFavList.querySelectorAll(".dir-fav-item").forEach((el) => el.classList.toggle("selected", el.dataset.path === p));
  }
  async function openDirModal(startDir) {
    const dir = startDir || dirInput.value.trim() || getDirFavs()[0] || "";
    dirModalPath = dir;
    dirModalSelected.textContent = dir || "(home)";
    dirModal.classList.remove("hidden");
    await browseDir(dir);
  }
  dirModal.addEventListener("click", async (e) => {
    const entry = e.target.closest(".dir-entry");
    if (entry) {
      selectDirPath(entry.dataset.path);
      await browseDir(entry.dataset.path);
      return;
    }
    const fav = e.target.closest(".dir-fav-item");
    if (fav && !e.target.closest(".dir-fav-remove")) {
      selectDirPath(fav.dataset.path);
      await browseDir(fav.dataset.path);
      return;
    }
    const rm = e.target.closest(".dir-fav-remove");
    if (rm) {
      const favs = getDirFavs();
      favs.splice(parseInt(rm.dataset.idx, 10), 1);
      saveDirFavs(favs);
      renderDirFavs();
      return;
    }
    if (e.target === dirModal) dirModal.classList.add("hidden");
  });
  document.getElementById("dir-modal-close").addEventListener("click", () => dirModal.classList.add("hidden"));
  document.getElementById("dir-modal-add-fav").addEventListener("click", () => {
    if (!dirModalPath) return;
    const favs = getDirFavs();
    if (!favs.includes(dirModalPath)) {
      favs.push(dirModalPath);
      saveDirFavs(favs);
    }
    renderDirFavs();
  });
  document.getElementById("dir-modal-go").addEventListener("click", () => {
    if (!dirModalPath) return;
    dirModal.classList.add("hidden");
    dirInput.value = dirModalPath;
    if (_loadRoot) _loadRoot(dirModalPath);
  });
  dirBrowseBtn.addEventListener("click", async () => {
    if (window.electronAPI && window.electronAPI.pickDirectory) {
      const picked = await window.electronAPI.pickDirectory();
      if (picked) {
        dirInput.value = picked;
        if (_loadRoot) _loadRoot(picked);
      }
    } else {
      openDirModal();
    }
  });
  dirInput.addEventListener("dblclick", () => openDirModal());

  // src/sleep-timer.js
  init_helpers();
  init_dom_refs();
  var _sleepInterval = null;
  var _sleepSecsLeft = 0;
  function startSleepTimer(mins) {
    clearSleepTimer();
    _sleepSecsLeft = mins * 60;
    btnSleep.classList.add("active");
    sleepActive.classList.remove("hidden");
    _sleepInterval = setInterval(() => {
      _sleepSecsLeft--;
      sleepRemaining.textContent = formatTime(_sleepSecsLeft);
      if (_sleepSecsLeft <= 0) {
        audio.pause();
        clearSleepTimer();
      }
    }, 1e3);
    sleepRemaining.textContent = formatTime(_sleepSecsLeft);
    sleepPopover.classList.add("hidden");
  }
  function clearSleepTimer() {
    if (_sleepInterval) clearInterval(_sleepInterval);
    _sleepInterval = null;
    _sleepSecsLeft = 0;
    btnSleep.classList.remove("active");
    sleepActive.classList.add("hidden");
  }
  btnSleep.addEventListener("click", () => {
    sleepPopover.classList.toggle("hidden");
  });
  sleepPopover.querySelector(".sleep-presets").addEventListener("click", (e) => {
    const mins = e.target.dataset?.mins;
    if (mins) startSleepTimer(parseInt(mins, 10));
  });
  sleepCancelBtn.addEventListener("click", () => {
    clearSleepTimer();
    sleepPopover.classList.add("hidden");
  });

  // src/drag-drop.js
  init_state();
  init_dom_refs();
  var dropOverlay = document.getElementById("drop-overlay");
  var dragEnterCount = 0;
  document.addEventListener("dragenter", (e) => {
    if (!e.dataTransfer || !e.dataTransfer.types.includes("Files")) return;
    dragEnterCount++;
    dropOverlay.classList.add("active");
  });
  document.addEventListener("dragleave", () => {
    dragEnterCount = Math.max(0, dragEnterCount - 1);
    if (dragEnterCount === 0) dropOverlay.classList.remove("active");
  });
  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  });
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    dragEnterCount = 0;
    dropOverlay.classList.remove("active");
    const mp3s = [...e.dataTransfer?.files || []].filter(
      (f) => f.name.toLowerCase().endsWith(".mp3")
    );
    if (mp3s.length) loadDroppedFiles(mp3s);
  });
  function loadDroppedFiles(files) {
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
    const DROP_ID_BASE = 9e4;
    state.discs.forEach((d) => {
      if (d.blobUrl) URL.revokeObjectURL(d.blobUrl);
    });
    const newDiscs = sorted.map((file, i) => {
      const absPath = file.path || null;
      return {
        id: DROP_ID_BASE + i,
        mp3Path: absPath,
        mp3File: file.name,
        blobUrl: absPath ? null : URL.createObjectURL(file),
        cueFile: null,
        albumTitle: file.name.replace(/\.mp3$/i, ""),
        albumPerformer: "",
        tracks: []
      };
    });
    state.discs = newDiscs;
    for (const disc of state.discs) loadScrapedTracklist(disc);
    renderDiscList();
    const first = newDiscs[0];
    if (!first) return;
    loadDisc(first);
    audio.addEventListener("canplay", function p() {
      audio.removeEventListener("canplay", p);
      audio.play().catch(() => {
      });
    });
  }

  // src/app.js
  if (navigator.userAgent.includes("Electron")) {
    document.body.classList.add("electron");
    if (window.electronAPI?.platform === "darwin") document.body.classList.add("darwin");
    window.electronAPI?.onMediaKey?.((key) => {
      if (key === "play-pause") document.getElementById("btn-play")?.click();
      else if (key === "next") document.getElementById("btn-next")?.click();
      else if (key === "prev") document.getElementById("btn-prev")?.click();
    });
  }
  initScrubbers();
  initLiveSpectrum();
  registerDeps3({
    loadDisc,
    playDiscAtTrack,
    openSpotifySaveModal,
    getDiscProgress,
    showResumeBanner,
    applyFilter,
    isSoundcloudMode,
    isSpotifyMode,
    getSoundcloudTracks,
    getSoundcloudTracksList,
    getSpotifyTracksList
  });
  registerScanDirectory(scanDirectory);
  registerPlayback2({ playDiscAtTrack, scanDirectory, loadDisc });
  registerPlayback(playDiscAtTrack);
  registerPlayback3(playDiscAtTrack);
  registerDeps8({
    loadLibrary,
    scanDirectory,
    loadDisc,
    playDiscAtTrack
  });
  registerDeps({
    playDiscAtTrack,
    isSoundcloudMode,
    isSpotifyMode
  });
  registerDeps2({
    renderDiscList,
    loadDisc,
    isSoundcloudMode,
    isSpotifyMode
  });
  registerDeps4({
    enterStreamingInfoMode,
    exitStreamingInfoMode,
    showSpotifyTrackInfo,
    showLiveSpectrum,
    fancyScrubber,
    liveSpectrum: getLiveSpectrum(),
    liveSpectrumWrap: getLiveSpectrumWrap(),
    applyFilter,
    closeSettings
  });
  registerDeps5({
    enterStreamingInfoMode,
    exitStreamingInfoMode,
    showSoundcloudTrackInfo,
    showLiveSpectrum,
    fancyScrubber,
    liveSpectrum: getLiveSpectrum(),
    liveSpectrumWrap: getLiveSpectrumWrap(),
    applyFilter,
    closeSettings
  });
  registerDeps6({
    fancyScrubber,
    ovScrubber: getOvScrubber(),
    zmScrubber: getZmScrubber()
  });
  registerDeps7({
    applyTheme,
    setWaveformVisible: setWaveformVisible2,
    setTrackLabelsVisible,
    setShuffleOn,
    cycleRepeat,
    getRepeatMode,
    getShuffleOn,
    fancyScrubber,
    getCurrentWfPath,
    loadWaveform,
    connectSpotify,
    disconnectSpotify,
    connectSoundcloud,
    disconnectSoundcloud
  });
  registerDeps9({ invalidateIndex });
  registerDeps10({ loadRoot, normEntry });
  registerScrubbers(getOvScrubber(), getZmScrubber());
  setInvalidateSearchIndex(invalidateIndex);
  var dirLoadBtn2 = document.getElementById("dir-load-btn");
  dirLoadBtn2.addEventListener("click", () => {
    const d = dirInput.value.trim();
    if (d) loadRoot(d);
  });
  dirInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const d = dirInput.value.trim();
      if (d) loadRoot(d);
    }
  });
  var dirLibDropdown = document.getElementById("dir-library-dropdown");
  function showLibraryDropdown() {
    const folders = getLibraryFolders();
    if (!folders.length) return;
    dirLibDropdown.innerHTML = "";
    for (const folder of folders) {
      const name = folder.split("/").filter(Boolean).pop() || folder;
      const item = document.createElement("div");
      item.className = "dir-lib-item";
      item.innerHTML = `<strong>${escapeHtml(name)}</strong>${escapeHtml(folder)}`;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        dirLibDropdown.classList.add("hidden");
        dirInput.value = folder;
        loadRoot(folder);
      });
      dirLibDropdown.appendChild(item);
    }
    dirLibDropdown.classList.remove("hidden");
  }
  dirInput.addEventListener("focus", async () => {
    await loadLibrary();
    showLibraryDropdown();
  });
  dirInput.addEventListener("blur", () => {
    setTimeout(() => dirLibDropdown.classList.add("hidden"), 150);
  });
  var filterClear2 = document.getElementById("filter-clear");
  var FILTER_HISTORY_KEY = "tlp_filter_history";
  var FILTER_HISTORY_MAX = 30;
  function loadFilterHistory() {
    try {
      return JSON.parse(localStorage.getItem(FILTER_HISTORY_KEY)) || [];
    } catch (_) {
      return [];
    }
  }
  function saveFilterHistory(history) {
    try {
      localStorage.setItem(FILTER_HISTORY_KEY, JSON.stringify(history));
    } catch (_) {
    }
  }
  function pushFilterHistory(value) {
    if (!value.trim()) return;
    const history = loadFilterHistory().filter((s) => s !== value);
    history.unshift(value);
    saveFilterHistory(history.slice(0, FILTER_HISTORY_MAX));
  }
  var filterHistoryIndex = -1;
  var filterLiveValue = "";
  filterInput.addEventListener("input", () => {
    filterHistoryIndex = -1;
    filterLiveValue = filterInput.value;
    applyFilter(filterInput.value);
    STORAGE.setFilter(filterInput.value);
  });
  filterInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      filterInput.value = "";
      filterHistoryIndex = -1;
      filterLiveValue = "";
      applyFilter("");
      return;
    }
    if (e.key === "Enter" && filterInput.value.trim()) {
      pushFilterHistory(filterInput.value.trim());
      filterHistoryIndex = -1;
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const history = loadFilterHistory();
      if (!history.length) return;
      if (filterHistoryIndex === -1) filterLiveValue = filterInput.value;
      if (e.key === "ArrowUp") {
        filterHistoryIndex = Math.min(filterHistoryIndex + 1, history.length - 1);
      } else {
        filterHistoryIndex = filterHistoryIndex - 1;
      }
      const val = filterHistoryIndex < 0 ? filterLiveValue : history[filterHistoryIndex];
      filterInput.value = val;
      filterInput.setSelectionRange(val.length, val.length);
      applyFilter(val);
      STORAGE.setFilter(val);
    }
  });
  filterClear2.addEventListener("click", () => {
    filterInput.value = "";
    filterHistoryIndex = -1;
    filterLiveValue = "";
    applyFilter("");
    filterInput.focus();
  });
  async function init() {
    await loadFavorites();
    applyTheme(STORAGE.getTheme());
    setWaveformVisible2(STORAGE.getWaveformOn());
    setTrackLabelsVisible(STORAGE.getTrackLabels());
    setShuffleOn(STORAGE.getShuffle());
    const savedRepeat = STORAGE.getRepeat();
    while (getRepeatMode() !== savedRepeat) cycleRepeat();
    const savedVol = STORAGE.getVolume();
    audio.volume = savedVol;
    volumeBar.value = savedVol;
    const w = Math.max(200, Math.min(600, parseInt(STORAGE.getSidebarW(), 10)));
    document.documentElement.style.setProperty("--sidebar-width", `${w}px`);
    sidebar.style.width = `${w}px`;
    const browserPct = parseInt(STORAGE.getBrowserH(), 10);
    if (browserPct) setBrowserPanelHeight(browserPct, "%");
    setSidebarCollapsed(false);
    initSidebarResize();
    initPanelResize();
    initMainResize();
    initNowPlayingResize();
    initWaveformResize();
    startWaveformLoop();
    const [,] = await Promise.all([
      initSpotify().catch(() => {
      }),
      initSoundcloud().catch(() => {
      })
    ]);
    const streamSession = STORAGE.getStreamSession();
    if (streamSession) {
      if (streamSession.mode === "soundcloud" && isSoundcloudConnected()) {
        setPendingScRestore({ trackIdx: streamSession.trackIdx, position: streamSession.position });
        openSoundcloudMode();
      } else if (streamSession.mode === "spotify" && isSpotifyConnected()) {
        setPendingSpotifyRestore({ uri: streamSession.uri, position: streamSession.position });
        openSpotifyMode();
      } else {
        STORAGE.clearStreamSession();
      }
    }
    try {
      const [configRes] = await Promise.all([
        fetch("/api/config"),
        loadLibrary()
      ]);
      const config = await configRes.json();
      const dir = config.dir || STORAGE.getDir();
      if (dir) {
        STORAGE.setDir(dir);
        dirInput.value = dir;
        setLibraryFolders2(getLibraryFolders());
        setLibraryFolders(getLibraryFolders());
        setInvalidateIndex(invalidateIndex);
        const savedFilter = STORAGE.getFilter();
        if (savedFilter) filterInput.value = savedFilter;
        const scanDir = STORAGE.getScanDir() || dir;
        await Promise.all([
          loadFolderBrowser(dir).then(() => {
            if (savedFilter) applyFilter(savedFilter);
            if (scanDir !== dir) {
              const activeItem = folderBrowser.querySelector(`.folder-item[data-name="${CSS.escape(scanDir.split("/").pop())}"]`);
              if (activeItem) activeItem.classList.add("active");
            }
          }),
          scanDirectory(scanDir)
        ]);
      }
    } catch (_) {
      const dir = STORAGE.getDir();
      if (dir) {
        dirInput.value = dir;
        loadRoot(dir);
      }
    }
  }
  init();
  loadBookmarks();
  state.queue = STORAGE.getQueue();
  renderQueue();
  initLastfmSettings();
})();
