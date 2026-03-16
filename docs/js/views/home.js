/**
 * Screen 1: Single-page clip list with character filters + callback sides
 */
import { navigate } from '../router.js';
import { playClip } from '../player.js';
import { setClipInfo } from '../components/stickyPlayer.js';
import { formatTimestamp } from '../data.js';

export function renderHome(container, characterIndex, sides, clips) {
  container.innerHTML = '';

  let activeFilter = null;

  // ── Character filter bar (desktop: chips, mobile: dropdown) ──

  const filterSection = document.createElement('div');
  filterSection.className = 'filter-section';

  // Desktop chips
  const chipBar = document.createElement('div');
  chipBar.className = 'filter-chip-bar';

  const allChip = document.createElement('button');
  allChip.className = 'filter-chip active';
  allChip.textContent = 'All';
  allChip.addEventListener('click', () => setFilter(null));
  chipBar.appendChild(allChip);

  for (const [name, char] of characterIndex) {
    const chip = document.createElement('button');
    chip.className = 'filter-chip';
    chip.dataset.character = name;
    chip.innerHTML = `<span class="filter-chip-dot" style="background: ${char.color}"></span>${name}`;
    chip.addEventListener('click', () => setFilter(name));
    chipBar.appendChild(chip);
  }

  filterSection.appendChild(chipBar);

  // Mobile dropdown
  const dropdown = document.createElement('select');
  dropdown.className = 'filter-dropdown';
  dropdown.innerHTML = '<option value="">All Characters</option>';
  for (const [name] of characterIndex) {
    dropdown.innerHTML += `<option value="${name}">${name}</option>`;
  }
  dropdown.addEventListener('change', () => setFilter(dropdown.value || null));
  filterSection.appendChild(dropdown);

  container.appendChild(filterSection);

  // ── Clip list ──

  const clipList = document.createElement('div');
  clipList.className = 'clip-list';
  container.appendChild(clipList);

  // ── Sides section (built once, toggled by filter) ──

  const sidesSection = document.createElement('section');
  sidesSection.className = 'sides-section';
  container.appendChild(sidesSection);

  // ── Render functions ──

  function setFilter(characterName) {
    activeFilter = characterName;

    // Update chip active states
    chipBar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    if (characterName) {
      const match = chipBar.querySelector(`.filter-chip[data-character="${CSS.escape(characterName)}"]`);
      if (match) match.classList.add('active');
    } else {
      allChip.classList.add('active');
    }

    // Sync dropdown
    dropdown.value = characterName || '';

    renderClipList();
    renderSidesSection();
  }

  function renderClipList() {
    clipList.innerHTML = '';

    const filtered = activeFilter
      ? clips.filter(c => c.parts.includes(activeFilter))
      : clips;

    if (filtered.length === 0) {
      clipList.innerHTML = '<p class="empty-state">No clips available</p>';
      return;
    }

    for (const clip of filtered) {
      const row = document.createElement('button');
      row.className = 'clip-row';
      row.dataset.clipId = clip.id;

      const duration = clip.endTime - clip.startTime;
      const timeRange = `${clip.startRaw} – ${clip.endRaw}`;

      const badges = clip.parts.map((partName, i) => {
        const color = clip.colors[i] || '#64748B';
        return `<span class="clip-row-badge" style="background: ${color}">${partName}</span>`;
      }).join('');

      row.innerHTML = `
        <div class="clip-row-main">
          <svg class="clip-row-play" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          <div class="clip-row-info">
            <span class="clip-row-song">${clip.song || clip.songId || 'Untitled'}</span>
            <span class="clip-row-time">${timeRange} (${formatTimestamp(duration)})</span>
          </div>
        </div>
        <div class="clip-row-badges">${badges}</div>
      `;

      row.addEventListener('click', () => {
        playClip(clip);
        setClipInfo(`${clip.song}`);
        clipList.querySelectorAll('.clip-row').forEach(r => r.classList.remove('active'));
        row.classList.add('active');
      });

      clipList.appendChild(row);
    }
  }

  function renderSidesSection() {
    sidesSection.innerHTML = '';

    if (!sides || sides.length === 0) return;

    const filtered = activeFilter
      ? sides.filter(s => s.characters.length === 0 || s.characters.includes(activeFilter))
      : sides;

    if (filtered.length === 0) return;

    sidesSection.innerHTML = '<h2 class="section-title">Callback Sides</h2><p class="section-desc">Scene-reading material for callbacks</p>';

    const sidesList = document.createElement('div');
    sidesList.className = 'sides-list';

    for (const side of filtered) {
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
  }

  // Initial render
  renderClipList();
  renderSidesSection();
}
