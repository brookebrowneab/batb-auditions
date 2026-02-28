/**
 * Fixed bottom audio player bar.
 * Wired to player.js API — shows play/pause, scrub bar, time, toggles.
 */
import { togglePlayPause, setFullSongMode, toggleBackingTrack, seek, getState } from '../player.js';

let playerEl = null;
let isVisible = false;

const SVG_PLAY = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
const SVG_PAUSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

export function initStickyPlayer() {
  playerEl = document.getElementById('sticky-player');
  if (!playerEl) return;

  playerEl.innerHTML = `
    <div class="sp-row">
      <button class="sp-play-btn" aria-label="Play/Pause">${SVG_PLAY}</button>
      <div class="sp-track-container">
        <div class="sp-track">
          <div class="sp-audition-region"></div>
          <div class="sp-fill"></div>
        </div>
      </div>
      <span class="sp-time">0:00 / 0:00</span>
    </div>
    <div class="sp-toggles">
      <button class="sp-toggle sp-full-song" aria-label="Toggle full song">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
        <span>Full Song</span>
      </button>
      <button class="sp-toggle sp-backing" aria-label="Toggle backing track">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        <span>Backing</span>
      </button>
    </div>
    <div class="sp-clip-info"></div>
  `;

  // Wire events
  playerEl.querySelector('.sp-play-btn').addEventListener('click', () => togglePlayPause());

  playerEl.querySelector('.sp-full-song').addEventListener('click', () => {
    const state = getState();
    setFullSongMode(!state.isFullSongMode);
  });

  playerEl.querySelector('.sp-backing').addEventListener('click', () => {
    toggleBackingTrack();
  });

  // Scrub bar seeking
  const trackContainer = playerEl.querySelector('.sp-track-container');
  let isSeeking = false;

  function doSeek(e) {
    const rect = trackContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seek(fraction);
  }

  trackContainer.addEventListener('mousedown', (e) => {
    isSeeking = true;
    doSeek(e);
  });
  trackContainer.addEventListener('touchstart', (e) => {
    isSeeking = true;
    doSeek(e);
  }, { passive: true });

  document.addEventListener('mousemove', (e) => { if (isSeeking) doSeek(e); });
  document.addEventListener('touchmove', (e) => { if (isSeeking) doSeek(e); }, { passive: true });
  document.addEventListener('mouseup', () => { isSeeking = false; });
  document.addEventListener('touchend', () => { isSeeking = false; });
}

export function updateStickyPlayer(state) {
  if (!playerEl) return;

  if (!state.clipId) {
    hide();
    return;
  }

  show();

  // Play/pause button
  const playBtn = playerEl.querySelector('.sp-play-btn');
  playBtn.innerHTML = state.isPlaying ? SVG_PAUSE : SVG_PLAY;

  // Progress fill
  const fill = playerEl.querySelector('.sp-fill');
  fill.style.width = `${(state.progress * 100).toFixed(1)}%`;

  // Audition region highlight (in full song mode)
  const region = playerEl.querySelector('.sp-audition-region');
  if (state.isFullSongMode && state.songDuration > 0) {
    region.style.display = 'block';
    region.style.left = `${(state.auditionStartFrac * 100).toFixed(1)}%`;
    region.style.width = `${((state.auditionEndFrac - state.auditionStartFrac) * 100).toFixed(1)}%`;
  } else {
    region.style.display = 'none';
  }

  // Time display
  playerEl.querySelector('.sp-time').textContent =
    `${state.currentTimeFormatted} / ${state.durationFormatted}`;

  // Toggle states
  const fullSongBtn = playerEl.querySelector('.sp-full-song');
  fullSongBtn.classList.toggle('active', state.isFullSongMode);

  const backingBtn = playerEl.querySelector('.sp-backing');
  backingBtn.classList.toggle('active', state.isBackingTrack);
  if (!state.hasBackingTrack) {
    backingBtn.classList.add('disabled');
  } else {
    backingBtn.classList.remove('disabled');
  }
}

export function setClipInfo(text) {
  if (!playerEl) return;
  const info = playerEl.querySelector('.sp-clip-info');
  if (info) info.textContent = text;
}

function show() {
  if (!isVisible && playerEl) {
    playerEl.classList.add('visible');
    document.body.classList.add('has-sticky-player');
    isVisible = true;
  }
}

function hide() {
  if (isVisible && playerEl) {
    playerEl.classList.remove('visible');
    document.body.classList.remove('has-sticky-player');
    isVisible = false;
  }
}
