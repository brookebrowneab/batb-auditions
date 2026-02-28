/**
 * PDF embed with download fallback for unsupported browsers.
 */

export function renderPdfViewer(url, title) {
  const container = document.createElement('div');
  container.className = 'pdf-viewer';

  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.title = title || 'PDF Document';
  iframe.className = 'pdf-iframe';
  iframe.setAttribute('loading', 'lazy');
  container.appendChild(iframe);

  const fallback = document.createElement('div');
  fallback.className = 'pdf-fallback';
  fallback.innerHTML = `
    <a href="${url}" target="_blank" rel="noopener" class="btn btn-gold pdf-download-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download / Print PDF
    </a>
  `;
  container.appendChild(fallback);

  return container;
}
