/**
 * Screen 1: Character Grid + Callback Sides
 */
import { navigate } from '../router.js';

export function renderHome(container, characterIndex, sides) {
  container.innerHTML = '';

  // Character grid section
  const gridSection = document.createElement('section');
  gridSection.className = 'character-grid-section';
  gridSection.innerHTML = '<h2 class="section-title">Choose Your Character</h2>';

  const grid = document.createElement('div');
  grid.className = 'character-grid';

  for (const [name, char] of characterIndex) {
    const card = document.createElement('button');
    card.className = 'character-card';
    card.style.setProperty('--char-color', char.color);
    card.setAttribute('aria-label', `${name} — ${char.clipCount} clip${char.clipCount !== 1 ? 's' : ''}`);

    card.innerHTML = `
      <span class="char-icon" style="background: ${char.color}">${name.charAt(0)}</span>
      <span class="char-name">${name}</span>
      <span class="char-count">${char.songs.length} song${char.songs.length !== 1 ? 's' : ''}</span>
    `;

    card.addEventListener('click', () => {
      navigate(`#/character/${encodeURIComponent(name)}`);
    });
    grid.appendChild(card);
  }

  gridSection.appendChild(grid);
  container.appendChild(gridSection);

  // Callback Sides section
  if (sides && sides.length > 0) {
    const sidesSection = document.createElement('section');
    sidesSection.className = 'sides-section';
    sidesSection.innerHTML = '<h2 class="section-title">Callback Sides</h2><p class="section-desc">Scene-reading material for callbacks</p>';

    const sidesList = document.createElement('div');
    sidesList.className = 'sides-list';

    for (const side of sides) {
      const row = document.createElement('button');
      row.className = 'side-row';
      row.setAttribute('aria-label', side.title);

      const chars = side.characters.length > 0
        ? side.characters.join(', ')
        : 'All characters';

      row.innerHTML = `
        <div class="side-info">
          <span class="side-title">${side.title}</span>
          <span class="side-characters">${chars}</span>
        </div>
        <svg class="side-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      `;

      row.addEventListener('click', () => {
        navigate(`#/sides/${side.id}`);
      });
      sidesList.appendChild(row);
    }

    sidesSection.appendChild(sidesList);
    container.appendChild(sidesSection);
  }
}
