/**
 * Callback side PDF viewer — no audio, just the PDF.
 */
import { navigate } from '../router.js';
import { renderPdfViewer } from '../components/pdfViewer.js';

export function renderSideDetail(container, side) {
  container.innerHTML = '';

  // Back button + header
  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `
    <button class="back-btn" aria-label="Back to home">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Characters
    </button>
    <h2 class="view-title">Callback Side</h2>
    <p class="view-desc">${side.title}</p>
  `;
  header.querySelector('.back-btn').addEventListener('click', () => navigate('#/'));
  container.appendChild(header);

  // Character badges
  if (side.characters.length > 0) {
    const badges = document.createElement('div');
    badges.className = 'side-detail-badges';
    side.characters.forEach(name => {
      const badge = document.createElement('span');
      badge.className = 'character-badge-sm';
      badge.textContent = name;
      badges.appendChild(badge);
    });
    container.appendChild(badges);
  }

  // PDF viewer
  const pdfSection = document.createElement('div');
  pdfSection.className = 'pdf-section';
  pdfSection.appendChild(renderPdfViewer(side.url, side.title));
  container.appendChild(pdfSection);
}
