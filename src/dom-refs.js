const audio         = document.getElementById('audio');
const discList      = document.getElementById('disc-list');
const folderBrowser = document.getElementById('folder-browser');
const panelResize   = document.getElementById('panel-resize');
const dirInput      = document.getElementById('dir-input');
const dirLoadBtn    = document.getElementById('dir-load-btn');
const filterInput   = document.getElementById('filter-input');
const filterClear   = document.getElementById('filter-clear');
const collapseBtn   = document.getElementById('collapse-btn');
const resizeHandle  = document.getElementById('resize-handle');
const sidebar       = document.getElementById('sidebar');
const btnPlay       = document.getElementById('btn-play');
const btnPrev       = document.getElementById('btn-prev');
const btnNext       = document.getElementById('btn-next');
const btnShuffle    = document.getElementById('btn-shuffle');
const btnRepeat     = document.getElementById('btn-repeat');
const seekBar       = document.getElementById('seek-bar');
const timeCurrent   = document.getElementById('time-current');
const timeTotal     = document.getElementById('time-total');
const volumeBar     = document.getElementById('volume-bar');
const npDisc        = document.getElementById('np-disc');
const npTrackNumber = document.getElementById('np-track-number');
const npTitle       = document.getElementById('np-title');
const npPerformer   = document.getElementById('np-performer');
const npSection     = document.getElementById('now-playing');
const spotifyBtn          = document.getElementById('spotify-btn');
const spotifySearchBtn    = document.getElementById('spotify-search-btn');
const soundcloudSearchBtn = document.getElementById('soundcloud-search-btn');
const finderBtn       = document.getElementById('finder-btn');
const nfoBtn          = document.getElementById('nfo-btn');
const tlBtn           = document.getElementById('tl-btn');
const themeToggle      = document.getElementById('theme-toggle');
const waveformToggle   = document.getElementById('waveform-toggle');
const miniBtn       = document.getElementById('mini-btn');
const miniTrack     = document.getElementById('mini-track');
const miniSub       = document.getElementById('mini-sub');
const btnSleep        = document.getElementById('btn-sleep');
const sleepPopover    = document.getElementById('sleep-popover');
const sleepActive     = document.getElementById('sleep-active');
const sleepRemaining  = document.getElementById('sleep-remaining');
const sleepCancelBtn  = document.getElementById('sleep-cancel');
const queuePanel      = document.getElementById('queue-panel');
const queueList       = document.getElementById('queue-list');
const queueCount      = document.getElementById('queue-count');
const bookmarksPanel  = document.getElementById('bookmarks-panel');
const bookmarksList   = document.getElementById('bookmarks-list');
const bookmarksCount  = document.getElementById('bookmarks-count');
const eqPanel         = document.getElementById('eq-panel');
const eqLowSlider     = document.getElementById('eq-low');
const eqMidSlider     = document.getElementById('eq-mid');
const eqHighSlider    = document.getElementById('eq-high');
const exportBtn       = document.getElementById('export-btn');
const seekTicks       = document.getElementById('seek-ticks');
const nfoPane         = document.getElementById('nfo-pane');
const mainResizeH     = document.getElementById('main-resize-h');
const mainTop         = document.getElementById('main-top');
const artworkPane     = document.getElementById('artwork-pane');
const artworkImg      = document.getElementById('artwork-img');
const nfoContent      = document.getElementById('nfo-content');
const localBtn        = document.getElementById('local-btn');
const wfSection       = document.getElementById('waveform-section');
const wfStatus        = document.getElementById('wf-status');

export {
  audio, discList, folderBrowser, panelResize, dirInput, dirLoadBtn,
  filterInput, filterClear, collapseBtn, resizeHandle, sidebar,
  btnPlay, btnPrev, btnNext, btnShuffle, btnRepeat,
  seekBar, timeCurrent, timeTotal, volumeBar,
  npDisc, npTrackNumber, npTitle, npPerformer, npSection,
  spotifyBtn, spotifySearchBtn, soundcloudSearchBtn,
  finderBtn, nfoBtn, tlBtn, themeToggle, waveformToggle,
  miniBtn, miniTrack, miniSub,
  btnSleep, sleepPopover, sleepActive, sleepRemaining, sleepCancelBtn,
  queuePanel, queueList, queueCount,
  bookmarksPanel, bookmarksList, bookmarksCount,
  eqPanel, eqLowSlider, eqMidSlider, eqHighSlider,
  exportBtn, seekTicks,
  nfoPane, mainResizeH, mainTop, artworkPane, artworkImg,
  nfoContent, localBtn, wfSection, wfStatus,
};
