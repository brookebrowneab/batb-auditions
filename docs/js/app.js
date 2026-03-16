/**
 * Entry point: data bootstrap, route wiring, player init.
 */
import { config } from './config.js';
import { fetchClips, fetchSides, buildCharacterIndex } from './data.js';
import { initPlayer } from './player.js';
import { route, start } from './router.js';
import { initStickyPlayer, updateStickyPlayer } from './components/stickyPlayer.js';
import { renderHome } from './views/home.js';
import { renderSideDetail } from './views/sideDetail.js';

let characterIndex = new Map();
let sidesData = [];
let clipsData = [];

async function init() {
  applyConfig();

  // Init audio player with state change callback
  initPlayer(onPlayerStateChange);
  initStickyPlayer();

  // Fetch data in parallel
  const [clipResult, sides] = await Promise.all([
    fetchClips(),
    fetchSides(),
  ]);

  const { songs, parts, clips, source } = clipResult;
  sidesData = sides;
  clipsData = clips;

  if (source === 'error' && clips.length === 0) {
    showError('Failed to load audition data. Please try refreshing.');
    return;
  }

  // Build character index
  characterIndex = buildCharacterIndex(clips, parts, songs);

  // Hide loading
  const loading = document.getElementById('loading-state');
  if (loading) loading.hidden = true;

  // Wire routes
  const appContent = document.getElementById('app-content');

  route('#/', () => {
    renderHome(appContent, characterIndex, sidesData, clipsData);
    scrollToTop();
  });

  route('#/sides/:id', ({ id }) => {
    const side = sidesData.find(s => s.id === id);
    if (!side) {
      renderHome(appContent, characterIndex, sidesData, clipsData);
      return;
    }
    renderSideDetail(appContent, side);
    scrollToTop();
  });

  // Start router
  start();
}

function onPlayerStateChange(state) {
  updateStickyPlayer(state);
}

function applyConfig() {
  const titleEl = document.querySelector('.show-title');
  if (titleEl) titleEl.textContent = config.showTitle;

  const subtitleEl = document.querySelector('.show-subtitle');
  if (subtitleEl) subtitleEl.textContent = config.showSubtitle;

  const roseEl = document.querySelector('.header-rose');
  if (roseEl && config.heroImage) roseEl.src = config.heroImage;

  const contactEl = document.getElementById('contact-link');
  if (contactEl && config.contactEmail) {
    contactEl.href = `mailto:${config.contactEmail}`;
  }

  document.title = `${config.showTitle} — Audition Practice`;
}

function showError(msg) {
  const loading = document.getElementById('loading-state');
  if (loading) {
    loading.innerHTML = `<p class="error-msg">${msg}</p>`;
    loading.hidden = false;
  }
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'instant' });
}

init();
