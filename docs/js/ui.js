/**
 * UI rendering: part filter pills, clip cards, and player controls.
 * Pure DOM manipulation — no framework.
 */
import { formatTimestamp } from './data.js';

let clipsData = [];
let activeFilter = 'All';
let activeClipId = null;
let callbacks = {};

/* ── SVG Icons ── */

const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><polygon points="6,3 20,12 6,21"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>`;
const ICON_MUSIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
const ICON_MIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="9" y="1" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0014 0"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>`;
const ICON_STAR = `<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9"/></svg>`;
const ICON_SHEET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>`;

/** Initialize the UI with callbacks and data. */
export function initUI(clips, cbs) {
  clipsData = clips;
  callbacks = cbs;
}

/** Render part filter pills. */
export function renderFilters(parts) {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  bar.innerHTML = '';

  const allBtn = createFilterPill('All', clipsData.length, null);
  bar.appendChild(allBtn);

  for (const part of parts) {
    const count = clipsData.filter(c => c.parts.includes(part.name)).length;
    if (count > 0) {
      bar.appendChild(createFilterPill(part.name, count, part.color));
    }
  }

  setActiveFilter('All');
}

function createFilterPill(label, count, color) {
  const btn = document.createElement('button');
  btn.className = 'filter-pill';
  btn.dataset.part = label;
  if (color) {
    btn.style.setProperty('--pill-color', color);
    btn.classList.add('colored');
  }
  btn.textContent = label === 'All' ? `All (${count})` : label;
  btn.addEventListener('click', () => setActiveFilter(label));
  return btn;
}

function setActiveFilter(partName) {
  activeFilter = partName;
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.part === partName);
  });
  renderCards();
}

/** Render clip cards into the list. */
export function renderCards() {
  const list = document.getElementById('clips-list');
  if (!list) return;

  const filtered = activeFilter === 'All'
    ? clipsData
    : clipsData.filter(c => c.parts.includes(activeFilter));

  if (filtered.length === 0) {
    list.innerHTML = '<p class="empty-state">No clips found for this part.</p>';
    return;
  }

  list.innerHTML = '';
  for (const clip of filtered) {
    list.appendChild(createCard(clip));
  }
}

function createCard(clip) {
  const card = document.createElement('article');
  card.className = 'clip-card';
  card.dataset.clipId = clip.id;

  const clipDuration = clip.endTime - clip.startTime;
  const isActive = activeClipId === clip.id;

  // Build badge group HTML
  const badges = (clip.parts || [clip.character]).map((name, i) => {
    const badgeColor = (clip.colors && clip.colors[i]) || clip.color || 'var(--color-rose)';
    return `<span class="character-badge" style="--badge-color: ${badgeColor}">${esc(name)}</span>`;
  }).join('');

  card.innerHTML = `
    <div class="card-header">
      <div class="badge-group">${badges}</div>
      <h3 class="song-title">${esc(clip.song)}</h3>
    </div>
    ${clip.notes ? `<p class="clip-notes">${esc(clip.notes)}</p>` : ''}
    <p class="clip-time">${esc(clip.startRaw)} – ${esc(clip.endRaw)} <span class="clip-duration">(${formatTimestamp(clipDuration)})</span></p>
    ${clip.sheetUrl ? `
    <a class="sheet-music-btn" href="${clip.sheetUrl}" target="_blank" rel="noopener">
      <span class="sheet-music-icon">${ICON_SHEET}</span>
      <span>View Sheet Music / Lyrics</span>
    </a>` : ''}

    <button class="play-btn-large" aria-label="Practice ${esc(clip.song)}">
      <span class="play-btn-icon">${ICON_PLAY}</span>
      <span>Practice This Section</span>
    </button>

    <div class="player-controls${isActive ? '' : ' hidden'}">
      <div class="player-label">
        <span class="label-star">${ICON_STAR}</span>
        <span class="label-text">YOUR AUDITION SECTION</span>
      </div>

      <div class="player-row">
        <button class="play-btn-small" aria-label="Play/Pause">${ICON_PLAY}</button>
        <div class="progress-container">
          <div class="progress-track">
            <div class="progress-audition"></div>
            <div class="progress-fill"></div>
          </div>
        </div>
        <span class="time-display">0:00 / ${formatTimestamp(clipDuration)}</span>
      </div>

      <div class="player-toggles">
        <button class="toggle-btn full-song-btn" aria-pressed="false">
          <span class="toggle-icon">${ICON_MUSIC}</span>
          <span>Full song</span>
        </button>
        <button class="toggle-btn backing-btn${clip.backingTrackId ? '' : ' disabled'}" aria-pressed="false" ${clip.backingTrackId ? '' : 'disabled'}>
          <span class="toggle-icon">${ICON_MIC}</span>
          <span>Backing track</span>
        </button>
      </div>
    </div>
  `;

  // Event: big play button
  card.querySelector('.play-btn-large').addEventListener('click', () => {
    callbacks.onPlayClip?.(clip);
  });

  // Event: small play/pause
  card.querySelector('.play-btn-small').addEventListener('click', () => {
    callbacks.onTogglePlayPause?.();
  });

  // Event: full song toggle
  card.querySelector('.full-song-btn').addEventListener('click', () => {
    callbacks.onToggleFullSong?.();
  });

  // Event: backing track toggle
  const backingBtn = card.querySelector('.backing-btn');
  if (!backingBtn.disabled) {
    backingBtn.addEventListener('click', () => {
      callbacks.onToggleBackingTrack?.();
    });
  }

  // Event: progress bar seek
  const progressContainer = card.querySelector('.progress-container');
  setupProgressSeek(progressContainer);

  return card;
}

/** Set up pointer-based seeking on a progress bar. */
function setupProgressSeek(container) {
  if (!container) return;
  let seeking = false;

  function doSeek(e) {
    const rect = container.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    callbacks.onSeek?.(fraction);
  }

  container.addEventListener('pointerdown', (e) => {
    seeking = true;
    container.setPointerCapture(e.pointerId);
    doSeek(e);
  });

  container.addEventListener('pointermove', (e) => {
    if (seeking) doSeek(e);
  });

  container.addEventListener('pointerup', () => {
    seeking = false;
  });

  container.addEventListener('pointercancel', () => {
    seeking = false;
  });
}

/** Update the UI to reflect current player state. */
export function updatePlayerUI(state) {
  // Activate the correct card
  if (state.clipId !== activeClipId) {
    // Deactivate old card
    if (activeClipId !== null) {
      const oldCard = document.querySelector(`.clip-card[data-clip-id="${activeClipId}"]`);
      if (oldCard) {
        oldCard.classList.remove('active');
        oldCard.querySelector('.play-btn-large')?.classList.remove('hidden');
        oldCard.querySelector('.player-controls')?.classList.add('hidden');
      }
    }

    activeClipId = state.clipId;

    // Activate new card
    if (activeClipId !== null) {
      const newCard = document.querySelector(`.clip-card[data-clip-id="${activeClipId}"]`);
      if (newCard) {
        newCard.classList.add('active');
        newCard.querySelector('.play-btn-large')?.classList.add('hidden');
        newCard.querySelector('.player-controls')?.classList.remove('hidden');
      }
    }
  }

  if (activeClipId === null) return;

  const card = document.querySelector(`.clip-card[data-clip-id="${activeClipId}"]`);
  if (!card) return;

  // Play/pause button icon
  const smallBtn = card.querySelector('.play-btn-small');
  if (smallBtn) smallBtn.innerHTML = state.isPlaying ? ICON_PAUSE : ICON_PLAY;

  // Progress bar fill
  const fill = card.querySelector('.progress-fill');
  if (fill) fill.style.width = `${state.progress * 100}%`;

  // Audition region highlight (in full-song mode)
  const audition = card.querySelector('.progress-audition');
  if (audition) {
    if (state.isFullSongMode && state.songDuration > 0) {
      audition.style.left = `${state.auditionStartFrac * 100}%`;
      audition.style.width = `${(state.auditionEndFrac - state.auditionStartFrac) * 100}%`;
      audition.style.display = 'block';
    } else {
      audition.style.display = 'none';
    }
  }

  // Time display
  const timeEl = card.querySelector('.time-display');
  if (timeEl) timeEl.textContent = `${state.currentTimeFormatted} / ${state.durationFormatted}`;

  // Label
  const labelText = card.querySelector('.label-text');
  const labelStar = card.querySelector('.label-star');
  if (labelText) {
    if (state.isFullSongMode) {
      labelText.textContent = 'FULL SONG';
      labelText.classList.add('muted');
      labelStar?.classList.add('hidden');
    } else {
      labelText.textContent = 'YOUR AUDITION SECTION';
      labelText.classList.remove('muted');
      labelStar?.classList.remove('hidden');
    }
  }

  // Toggle button states
  const fullSongBtn = card.querySelector('.full-song-btn');
  if (fullSongBtn) {
    fullSongBtn.setAttribute('aria-pressed', state.isFullSongMode);
    fullSongBtn.classList.toggle('active', state.isFullSongMode);
  }

  const backingBtn = card.querySelector('.backing-btn');
  if (backingBtn) {
    backingBtn.setAttribute('aria-pressed', state.isBackingTrack);
    backingBtn.classList.toggle('active', state.isBackingTrack);
  }
}

/** Show a data-source banner. */
export function showBanner(source) {
  const banner = document.getElementById('data-banner');
  if (!banner) return;

  if (source === 'draft') {
    banner.textContent = 'Previewing unpublished changes from admin';
    banner.classList.add('banner-info');
    banner.hidden = false;
  } else if (source === 'cached') {
    banner.textContent = 'Using cached data — Google Sheet may be unavailable';
    banner.classList.add('banner-warn');
    banner.hidden = false;
  } else if (source === 'error') {
    banner.textContent = 'Could not load audition data. Please check your connection.';
    banner.classList.add('banner-error');
    banner.hidden = false;
  }
}

function esc(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}
