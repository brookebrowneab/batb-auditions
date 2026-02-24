/**
 * Entry point: wire together data, player, and UI.
 */
import { config } from './config.js';
import { fetchClips, getParts } from './data.js';
import { initPlayer, playClip, togglePlayPause, setFullSongMode, toggleBackingTrack, seek } from './player.js';
import { initUI, renderFilters, renderCards, updatePlayerUI, showBanner } from './ui.js';

async function init() {
  // Apply config to page
  applyConfig();

  // Init audio player
  initPlayer(onPlayerStateChange);

  // Fetch clip data
  const { songs, parts, clips, source } = await fetchClips();

  if (source !== 'live') {
    showBanner(source);
  }

  if (clips.length === 0 && source === 'error') {
    showBanner('error');
    return;
  }

  // Init UI
  initUI(clips, {
    onPlayClip: (clip) => playClip(clip),
    onTogglePlayPause: () => togglePlayPause(),
    onToggleFullSong: () => {
      const state = playerStateRef;
      setFullSongMode(!state.isFullSongMode);
    },
    onToggleBackingTrack: () => toggleBackingTrack(),
    onSeek: (fraction) => seek(fraction),
  });

  renderFilters(getParts(parts));
  renderCards();
}

let playerStateRef = {};

function onPlayerStateChange(state) {
  playerStateRef = state;
  updatePlayerUI(state);
}

function applyConfig() {
  // Title
  const titleEl = document.querySelector('.show-title');
  if (titleEl) titleEl.textContent = config.showTitle;

  const subtitleEl = document.querySelector('.show-subtitle');
  if (subtitleEl) subtitleEl.textContent = config.showSubtitle;

  // Hero image
  const roseEl = document.querySelector('.header-rose');
  if (roseEl && config.heroImage) roseEl.src = config.heroImage;

  // Contact email
  const contactEl = document.getElementById('contact-link');
  if (contactEl && config.contactEmail) {
    contactEl.href = `mailto:${config.contactEmail}`;
    contactEl.textContent = `Email us for help`;
  }

  // Page title
  document.title = `${config.showTitle} — Audition Practice`;
}

init();
