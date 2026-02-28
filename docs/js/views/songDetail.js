/**
 * Screen 3: Song detail — embedded PDF + clip selector + audio playback
 */
import { navigate } from '../router.js';
import { renderPdfViewer } from '../components/pdfViewer.js';
import { playClip } from '../player.js';
import { setClipInfo } from '../components/stickyPlayer.js';
import { formatTimestamp } from '../data.js';

export function renderSongDetail(container, character, song) {
  container.innerHTML = '';

  // Back button + header
  const header = document.createElement('div');
  header.className = 'view-header';
  header.innerHTML = `
    <button class="back-btn" aria-label="Back to ${character.name}'s songs">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      ${character.name}
    </button>
    <h2 class="view-title">${song.title}</h2>
  `;
  header.querySelector('.back-btn').addEventListener('click', () => {
    navigate(`#/character/${encodeURIComponent(character.name)}`);
  });
  container.appendChild(header);

  // Clip selector buttons
  if (song.clips.length > 0) {
    const clipSection = document.createElement('div');
    clipSection.className = 'clip-selector';
    clipSection.innerHTML = '<h3 class="section-subtitle">Audition Clips</h3>';

    const clipBtns = document.createElement('div');
    clipBtns.className = 'clip-buttons';

    song.clips.forEach((clip, i) => {
      const btn = document.createElement('button');
      btn.className = 'clip-btn';

      const duration = clip.endTime - clip.startTime;
      const timeRange = `${clip.startRaw} – ${clip.endRaw}`;
      const label = clip.notes
        ? clip.notes.substring(0, 60) + (clip.notes.length > 60 ? '...' : '')
        : `Clip ${i + 1}`;

      btn.innerHTML = `
        <div class="clip-btn-top">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          <span class="clip-btn-label">${label}</span>
        </div>
        <span class="clip-btn-time">${timeRange} (${formatTimestamp(duration)})</span>
      `;

      // Show multi-part badges if clip has more than one part
      if (clip.parts.length > 1) {
        const badges = document.createElement('div');
        badges.className = 'clip-btn-badges';
        clip.parts.forEach((partName, pi) => {
          const badge = document.createElement('span');
          badge.className = 'mini-badge';
          badge.style.background = clip.colors[pi] || '#64748B';
          badge.textContent = partName;
          badges.appendChild(badge);
        });
        btn.appendChild(badges);
      }

      btn.addEventListener('click', () => {
        playClip(clip);
        setClipInfo(`${character.name} — ${song.title}`);
        // Highlight active clip
        clipBtns.querySelectorAll('.clip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      clipBtns.appendChild(btn);
    });

    clipSection.appendChild(clipBtns);
    container.appendChild(clipSection);
  }

  // Embedded PDF (sheet music)
  if (song.sheet) {
    const sheetMusicPath = `./sheet_music/${song.sheet}`;
    const pdfSection = document.createElement('div');
    pdfSection.className = 'pdf-section';
    pdfSection.innerHTML = '<h3 class="section-subtitle">Sheet Music</h3>';
    pdfSection.appendChild(renderPdfViewer(sheetMusicPath, `${song.title} — Sheet Music`));
    container.appendChild(pdfSection);
  }
}
