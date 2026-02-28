/**
 * Entry point: data bootstrap, route wiring, player init.
 */
import { config } from './config.js';
import { fetchClips, fetchSides, buildCharacterIndex } from './data.js';
import { initPlayer } from './player.js';
import { route, start } from './router.js';
import { initStickyPlayer, updateStickyPlayer } from './components/stickyPlayer.js';
import { renderHome } from './views/home.js';
import { renderSongList } from './views/songList.js';
import { renderSongDetail } from './views/songDetail.js';
import { renderSideDetail } from './views/sideDetail.js';

let characterIndex = new Map();
let sidesData = [];

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
    renderHome(appContent, characterIndex, sidesData);
    scrollToTop();
  });

  route('#/character/:name', ({ name }) => {
    const char = characterIndex.get(name);
    if (!char) {
      renderHome(appContent, characterIndex, sidesData);
      return;
    }
    renderSongList(appContent, char, sidesData);
    scrollToTop();
  });

  route('#/character/:name/song/:songId', ({ name, songId }) => {
    const char = characterIndex.get(name);
    if (!char) {
      renderHome(appContent, characterIndex, sidesData);
      return;
    }
    const song = char.songs.find(s => s.songId === songId);
    if (!song) {
      renderSongList(appContent, char, sidesData);
      return;
    }
    renderSongDetail(appContent, char, song);
    scrollToTop();
  });

  route('#/sides/:id', ({ id }) => {
    const side = sidesData.find(s => s.id === id);
    if (!side) {
      renderHome(appContent, characterIndex, sidesData);
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
