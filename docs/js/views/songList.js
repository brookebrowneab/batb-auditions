/**
 * Screen 2: Song list for a character
 */
import { navigate } from '../router.js';

export function renderSongList(container, character, sides) {
  container.innerHTML = '';

  // Back button + header
  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `
    <button class="back-btn" aria-label="Back to characters">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Characters
    </button>
    <div class="view-title-row">
      <span class="char-badge" style="background: ${character.color}">${character.name}</span>
      <span class="char-clip-count">${character.clipCount} audition clip${character.clipCount !== 1 ? 's' : ''}</span>
    </div>
  `;
  header.querySelector('.back-btn').addEventListener('click', () => navigate('#/'));
  container.appendChild(header);

  // Song cards
  const songsList = document.createElement('div');
  songsList.className = 'songs-card-list';

  for (const song of character.songs) {
    const card = document.createElement('button');
    card.className = 'song-card';

    card.innerHTML = `
      <div class="song-card-info">
        <span class="song-card-title">${song.title}</span>
        <span class="song-card-clips">${song.clips.length} clip${song.clips.length !== 1 ? 's' : ''}</span>
      </div>
      <svg class="song-card-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    `;

    card.addEventListener('click', () => {
      navigate(`#/character/${encodeURIComponent(character.name)}/song/${encodeURIComponent(song.songId)}`);
    });
    songsList.appendChild(card);
  }

  container.appendChild(songsList);

  // Relevant callback sides
  const charSides = sides.filter(s => s.characters.includes(character.name));
  if (charSides.length > 0) {
    const sidesSection = document.createElement('section');
    sidesSection.className = 'sides-section sides-section-compact';
    sidesSection.innerHTML = '<h3 class="section-subtitle">Callback Sides</h3>';

    const sidesList = document.createElement('div');
    sidesList.className = 'sides-list';

    for (const side of charSides) {
      const row = document.createElement('button');
      row.className = 'side-row';
      row.innerHTML = `
        <div class="side-info">
          <span class="side-title">${side.title}</span>
        </div>
        <svg class="side-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      `;
      row.addEventListener('click', () => navigate(`#/sides/${side.id}`));
      sidesList.appendChild(row);
    }

    sidesSection.appendChild(sidesList);
    container.appendChild(sidesSection);
  }
}
