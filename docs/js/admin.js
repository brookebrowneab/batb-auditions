/**
 * Admin Clip Builder: tabbed editor for clips, parts, and songs.
 * Manages in-memory state, audio scrubber, imports/exports JSON.
 */
import { formatTimestamp, parseTimestamp } from './data.js';
import { config } from './config.js';

/* ── SVG Icons ── */

const ICON_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="6,3 20,12 6,21"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>`;
const ICON_DELETE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>`;

/* ── In-Memory State ── */

let songs = [];
let parts = [];
let clips = [];
let sides = [];
let nextClipId = 1;

/* ── localStorage Auto-Save ── */

const STORAGE_KEY = 'batb-clips-draft';
const JSONBIN_KEY_STORAGE = 'batb-jsonbin-key';
const JSONBIN_API = 'https://api.jsonbin.io/v3/b';
let saveTimeout = null;

function saveToLocalStorage() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ songs, parts, clips }));
    } catch (e) {
      console.warn('localStorage save failed:', e);
    }
  }, 300);
}

const SIDES_STORAGE_KEY = 'batb-sides-draft';
let sidesSaveTimeout = null;

function saveToSidesLocalStorage() {
  clearTimeout(sidesSaveTimeout);
  sidesSaveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(SIDES_STORAGE_KEY, JSON.stringify({ sides }));
    } catch (e) {
      console.warn('localStorage sides save failed:', e);
    }
  }, 300);
}

/* ── Audio Scrubber State ── */

let audio = new Audio();
audio.preload = 'auto';
let scrubberClipId = null;  // Which clip card owns the active scrubber
let scrubberPlaying = false;
let scrubberDuration = 0;
let animFrameId = null;

/* ── Init ── */

async function init() {
  // Password gate
  if (config.adminPassword) {
    const stored = sessionStorage.getItem('batb-admin-auth');
    if (stored !== 'ok') {
      const pw = prompt('Enter admin password:');
      if (pw !== config.adminPassword) {
        document.body.innerHTML = '<p style="text-align:center;padding:3rem;color:#DC2626;font-family:sans-serif">Access denied.</p>';
        return;
      }
      sessionStorage.setItem('batb-admin-auth', 'ok');
    }
  }

  // JSONBin master key prompt (stored in localStorage, persists across sessions)
  if (config.jsonBinId && !localStorage.getItem(JSONBIN_KEY_STORAGE)) {
    const key = prompt('Enter your JSONBin.io X-Master-Key (from your dashboard):');
    if (key && key.trim()) {
      localStorage.setItem(JSONBIN_KEY_STORAGE, key.trim());
    }
  }

  // Hide Publish button if no bin ID configured
  if (!config.jsonBinId) {
    const publishBtn = document.getElementById('btn-publish');
    if (publishBtn) publishBtn.hidden = true;
  }

  // Audio events
  audio.addEventListener('loadedmetadata', () => {
    scrubberDuration = audio.duration || 0;
    updateScrubberUI();
  });
  audio.addEventListener('ended', () => {
    scrubberPlaying = false;
    updateScrubberUI();
  });
  audio.addEventListener('error', () => {
    scrubberPlaying = false;
    scrubberDuration = 0;
    updateScrubberUI();
  });

  // Load data — priority: localStorage draft > JSONBin cloud > clips.json file
  let loadedFromDraft = false;
  let loadedFromCloud = false;

  // 1. Check localStorage draft first (crash recovery / unsaved edits)
  try {
    const draft = localStorage.getItem(STORAGE_KEY);
    if (draft) {
      const data = JSON.parse(draft);
      songs = data.songs || [];
      parts = data.parts || [];
      clips = data.clips || [];
      loadedFromDraft = true;
    }
  } catch (e) { /* ignore parse errors */ }

  // 2. If no draft, try JSONBin cloud
  if (!loadedFromDraft && config.jsonBinId) {
    try {
      const headers = {};
      const masterKey = localStorage.getItem(JSONBIN_KEY_STORAGE);
      if (masterKey) headers['X-Master-Key'] = masterKey;
      const resp = await fetch(`${JSONBIN_API}/${config.jsonBinId}?meta=false`, { headers });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.json();
      songs = raw.songs || [];
      parts = raw.parts || [];
      clips = raw.clips || [];
      loadedFromCloud = true;
    } catch (err) {
      console.warn('JSONBin fetch failed, trying clips.json fallback:', err);
    }
  }

  // 3. Fallback to local clips.json file
  if (!loadedFromDraft && !loadedFromCloud) {
    try {
      const resp = await fetch('./data/clips.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.json();

      if (Array.isArray(raw)) {
        loadLegacy(raw);
      } else {
        songs = raw.songs || [];
        parts = raw.parts || [];
        clips = raw.clips || [];
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      showBanner('Failed to load clips.json');
    }
  }

  if (loadedFromDraft) {
    showDraftBanner();
  }

  nextClipId = clips.reduce((max, c) => Math.max(max, c.id || 0), 0) + 1;

  // Load sides data — priority: localStorage draft > sides.json file
  let sidesLoadedFromDraft = false;
  try {
    const sidesDraft = localStorage.getItem(SIDES_STORAGE_KEY);
    if (sidesDraft) {
      const data = JSON.parse(sidesDraft);
      sides = data.sides || [];
      sidesLoadedFromDraft = true;
    }
  } catch (e) { /* ignore parse errors */ }

  if (!sidesLoadedFromDraft) {
    try {
      const resp = await fetch('./data/sides.json');
      if (resp.ok) {
        const raw = await resp.json();
        sides = raw.sides || [];
      }
    } catch (err) {
      console.warn('Failed to load sides.json:', err);
    }
  }

  renderAll();
  setupTabs();
  setupToolbar();
}

function loadLegacy(rawClips) {
  const songMap = new Map();
  const partMap = new Map();

  for (const clip of rawClips) {
    const songKey = clip.fullTrackId || clip.song;
    if (!songMap.has(songKey)) {
      const file = clip.fullTrackId?.replace('./audio/full/', '') || '';
      const id = file.replace('.mp3', '').replace(/\s+/g, '_');
      songMap.set(songKey, { id, title: clip.song, file, sheet: '' });
    }
    const charName = clip.character;
    if (charName && !partMap.has(charName)) {
      partMap.set(charName, { name: charName, color: clip.color || '#6B7280' });
    }
  }

  songs = [...songMap.values()];
  parts = [...partMap.values()];

  clips = rawClips.map((clip, i) => {
    const songKey = clip.fullTrackId || clip.song;
    const song = songMap.get(songKey);
    return {
      id: clip.id || i + 1,
      songId: song?.id || '',
      start: clip.startRaw || clip.start || formatTimestamp(clip.startTime),
      end: clip.endRaw || clip.end || formatTimestamp(clip.endTime),
      notes: clip.notes || '',
      parts: [clip.character],
    };
  });
}

/* ── Tab System ── */

function setupTabs() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tab}`)?.classList.add('active');
    });
  });
}

/* ── Toolbar ── */

function setupToolbar() {
  document.getElementById('btn-export-json')?.addEventListener('click', exportJson);
  document.getElementById('btn-publish')?.addEventListener('click', publishToJsonBin);

  document.getElementById('btn-reset-published')?.addEventListener('click', async () => {
    if (!confirm('Discard local draft and reload from published data?')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SIDES_STORAGE_KEY);

    let loaded = false;

    // Try JSONBin first
    if (config.jsonBinId) {
      try {
        const headers = {};
        const masterKey = localStorage.getItem(JSONBIN_KEY_STORAGE);
        if (masterKey) headers['X-Master-Key'] = masterKey;
        const resp = await fetch(`${JSONBIN_API}/${config.jsonBinId}?meta=false`, { headers });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const raw = await resp.json();
        songs = raw.songs || [];
        parts = raw.parts || [];
        clips = raw.clips || [];
        loaded = true;
      } catch (err) {
        console.warn('JSONBin fetch failed, trying clips.json:', err);
      }
    }

    // Fallback to clips.json
    if (!loaded) {
      try {
        const resp = await fetch('./data/clips.json');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const raw = await resp.json();
        if (Array.isArray(raw)) {
          loadLegacy(raw);
        } else {
          songs = raw.songs || [];
          parts = raw.parts || [];
          clips = raw.clips || [];
        }
        loaded = true;
      } catch (err) {
        console.error('Failed to reload clips.json:', err);
        showToast('Failed to reload — check console');
        return;
      }
    }

    nextClipId = clips.reduce((max, c) => Math.max(max, c.id || 0), 0) + 1;
    // Also reload sides from sides.json
    try {
      const sidesResp = await fetch('./data/sides.json');
      if (sidesResp.ok) {
        const sidesRaw = await sidesResp.json();
        sides = sidesRaw.sides || [];
      }
    } catch (err) {
      console.warn('Failed to reload sides.json:', err);
    }

    stopScrubber();
    renderAll();
    const banner = document.getElementById('data-banner');
    if (banner) banner.hidden = true;
    showToast('Reset to published data');
  });

  document.getElementById('btn-load-file')?.addEventListener('click', async () => {
    try {
      const resp = await fetch('./data/clips.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.json();
      if (Array.isArray(raw)) {
        loadLegacy(raw);
      } else {
        songs = raw.songs || [];
        parts = raw.parts || [];
        clips = raw.clips || [];
      }
      nextClipId = clips.reduce((max, c) => Math.max(max, c.id || 0), 0) + 1;
      stopScrubber();
      renderAll();
      saveToLocalStorage();
      showDraftBanner();
      showToast('Loaded from clips.json — review & Publish when ready');
    } catch (err) {
      console.error('Failed to load clips.json:', err);
      showToast('Failed to load clips.json — check console');
    }
  });

  document.getElementById('btn-import-json')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data)) {
          loadLegacy(data);
        } else {
          songs = data.songs || [];
          parts = data.parts || [];
          clips = data.clips || [];
        }
        nextClipId = clips.reduce((max, c) => Math.max(max, c.id || 0), 0) + 1;
        stopScrubber();
        renderAll();
        saveToLocalStorage();
        showToast('Imported successfully');
      } catch (err) {
        showToast('Invalid JSON file');
        console.error('Import failed:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btn-new-clip')?.addEventListener('click', () => {
    const newClip = {
      id: nextClipId++,
      songId: songs[0]?.id || '',
      start: '0:00',
      end: '0:30',
      notes: '',
      parts: [],
    };
    clips.push(newClip);
    renderClips();
    saveToLocalStorage();
    const lastCard = document.querySelector(`[data-clip-id="${newClip.id}"]`);
    lastCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('New clip added');
  });

  document.getElementById('btn-new-part')?.addEventListener('click', () => {
    const name = `Part ${parts.length + 1}`;
    parts.push({ name, color: '#6B7280' });
    renderParts();
    renderClips();
    saveToLocalStorage();
    showToast('New part added');
  });

  document.getElementById('btn-new-song')?.addEventListener('click', () => {
    const id = `song_${Date.now()}`;
    songs.push({ id, title: 'New Song', file: '', sheet: '' });
    renderSongs();
    renderClips();
    saveToLocalStorage();
    showToast('New song added');
  });

  document.getElementById('btn-new-side')?.addEventListener('click', () => {
    const id = `side_${Date.now()}`;
    sides.push({ id, title: 'New Side', file: '', characters: [] });
    renderSides();
    saveToSidesLocalStorage();
    showToast('New side added');
  });

  document.getElementById('btn-export-sides')?.addEventListener('click', exportSidesJson);

  document.getElementById('btn-import-sides')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        sides = data.sides || [];
        renderSides();
        saveToSidesLocalStorage();
        showToast('Sides imported successfully');
      } catch (err) {
        showToast('Invalid JSON file');
        console.error('Sides import failed:', err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

function exportJson() {
  const data = { songs, parts, clips };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clips.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('clips.json downloaded');
}

function exportSidesJson() {
  const data = { sides };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sides.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('sides.json downloaded');
}

async function publishToJsonBin() {
  if (!config.jsonBinId) {
    showToast('No jsonBinId configured in config.js');
    return;
  }
  const masterKey = localStorage.getItem(JSONBIN_KEY_STORAGE);
  if (!masterKey) {
    const key = prompt('Enter your JSONBin.io X-Master-Key:');
    if (!key || !key.trim()) {
      showToast('Publish cancelled — no master key');
      return;
    }
    localStorage.setItem(JSONBIN_KEY_STORAGE, key.trim());
    return publishToJsonBin(); // retry with key now stored
  }

  const btn = document.getElementById('btn-publish');
  if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }

  try {
    const data = { songs, parts, clips };
    const resp = await fetch(`${JSONBIN_API}/${config.jsonBinId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': masterKey,
      },
      body: JSON.stringify(data),
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${body}`);
    }
    // Success — clear draft, hide banner
    localStorage.removeItem(STORAGE_KEY);
    const banner = document.getElementById('data-banner');
    if (banner) banner.hidden = true;
    showToast('Published! Students will see the update.');
  } catch (err) {
    console.error('Publish failed:', err);
    showToast('Publish failed — check console');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Publish'; }
  }
}

/* ── Render All ── */

function renderAll() {
  renderClips();
  renderParts();
  renderSongs();
  renderSides();
}

/* ══════════════════════════════
   CLIPS TAB
   ══════════════════════════════ */

function renderClips() {
  const list = document.getElementById('clips-list');
  if (!list) return;
  list.innerHTML = '';

  for (const clip of clips) {
    list.appendChild(createClipCard(clip));
  }
}

function createClipCard(clip) {
  const card = document.createElement('article');
  card.className = 'clip-card admin-card';
  card.dataset.clipId = clip.id;

  const startTime = parseTimestamp(clip.start);
  const endTime = parseTimestamp(clip.end);
  const clipDur = (endTime || 0) - (startTime || 0);
  const invalid = clipDur <= 0;

  const songOptions = songs.map(s =>
    `<option value="${esc(s.id)}" ${s.id === clip.songId ? 'selected' : ''}>${esc(s.title)}</option>`
  ).join('');

  const partChecks = parts.map(p => {
    const checked = clip.parts.includes(p.name) ? 'checked' : '';
    return `
      <label class="part-check" style="--part-color: ${p.color}">
        <input type="checkbox" data-part="${esc(p.name)}" ${checked}>
        <span class="part-dot"></span>
        ${esc(p.name)}
      </label>`;
  }).join('');

  card.innerHTML = `
    <div class="admin-clip-header">
      <select class="clip-song-select">${songOptions}</select>
      <button class="btn-icon btn-delete-clip" title="Delete clip">${ICON_DELETE}</button>
    </div>

    <div class="admin-scrubber">
      <div class="scrubber-row">
        <button class="scrubber-play">${ICON_PLAY}</button>
        <div class="scrubber-track-container">
          <div class="scrubber-track">
            <div class="scrubber-range"></div>
            <div class="scrubber-playhead"></div>
          </div>
        </div>
        <span class="scrubber-time">0:00 / 0:00</span>
      </div>
      <div class="scrubber-actions">
        <button class="btn-set-time btn-set-start">Set Start</button>
        <button class="btn-set-time btn-set-end">Set End</button>
      </div>
    </div>

    <div class="admin-timestamps">
      <div class="ts-group">
        <label>Start</label>
        <div class="ts-controls">
          <button class="ts-btn" data-field="start" data-delta="-1">&minus;1s</button>
          <input type="text" class="ts-input" data-field="start" value="${esc(clip.start)}" />
          <button class="ts-btn" data-field="start" data-delta="1">+1s</button>
        </div>
      </div>
      <div class="ts-group">
        <label>End</label>
        <div class="ts-controls">
          <button class="ts-btn" data-field="end" data-delta="-1">&minus;1s</button>
          <input type="text" class="ts-input" data-field="end" value="${esc(clip.end)}" />
          <button class="ts-btn" data-field="end" data-delta="1">+1s</button>
        </div>
      </div>
      <span class="ts-duration${invalid ? ' ts-invalid' : ''}">${invalid ? 'INVALID' : formatTimestamp(clipDur)}</span>
    </div>

    <textarea class="clip-notes-input" placeholder="Notes (optional)">${esc(clip.notes)}</textarea>

    <div class="admin-field-label">Parts</div>
    <div class="parts-checkboxes">${partChecks}</div>
  `;

  // ── Song selection ──
  card.querySelector('.clip-song-select').addEventListener('change', (e) => {
    clip.songId = e.target.value;
    // If this clip's scrubber is active, reload audio
    if (scrubberClipId === clip.id) {
      stopScrubber();
    }
    saveToLocalStorage();
  });

  // ── Scrubber: Play/Pause ──
  card.querySelector('.scrubber-play').addEventListener('click', () => {
    toggleScrubber(clip, card);
  });

  // ── Scrubber: Seek ──
  setupScrubberSeek(card.querySelector('.scrubber-track-container'), clip, card);

  // ── Scrubber: Set Start / Set End ──
  card.querySelector('.btn-set-start').addEventListener('click', () => {
    if (scrubberClipId !== clip.id || scrubberDuration === 0) {
      showToast('Play the song first to set timestamps');
      return;
    }
    const t = formatTimestamp(audio.currentTime);
    clip.start = t;
    const input = card.querySelector('.ts-input[data-field="start"]');
    if (input) { input.value = t; input.classList.remove('input-error'); }
    updateDuration(clip, card);
    updateScrubberRange(clip, card);
    saveToLocalStorage();
    showToast(`Start set to ${t}`);
  });

  card.querySelector('.btn-set-end').addEventListener('click', () => {
    if (scrubberClipId !== clip.id || scrubberDuration === 0) {
      showToast('Play the song first to set timestamps');
      return;
    }
    const t = formatTimestamp(audio.currentTime);
    clip.end = t;
    const input = card.querySelector('.ts-input[data-field="end"]');
    if (input) { input.value = t; input.classList.remove('input-error'); }
    updateDuration(clip, card);
    updateScrubberRange(clip, card);
    saveToLocalStorage();
    showToast(`End set to ${t}`);
  });

  // ── +/- timestamp buttons ──
  card.querySelectorAll('.ts-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field;
      const delta = parseInt(btn.dataset.delta, 10);
      adjustTimestamp(clip, card, field, delta);
    });
  });

  // ── Manual timestamp input ──
  card.querySelectorAll('.ts-input').forEach(input => {
    input.addEventListener('change', () => {
      const field = input.dataset.field;
      const seconds = parseTimestamp(input.value.trim());
      if (seconds === null) {
        input.classList.add('input-error');
        return;
      }
      input.classList.remove('input-error');
      clip[field] = input.value.trim();
      updateDuration(clip, card);
      updateScrubberRange(clip, card);
      saveToLocalStorage();
    });
  });

  // ── Notes ──
  card.querySelector('.clip-notes-input').addEventListener('input', (e) => {
    clip.notes = e.target.value;
    saveToLocalStorage();
  });

  // ── Part checkboxes ──
  card.querySelectorAll('.parts-checkboxes input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const partName = cb.dataset.part;
      if (cb.checked) {
        if (!clip.parts.includes(partName)) clip.parts.push(partName);
      } else {
        clip.parts = clip.parts.filter(p => p !== partName);
      }
      saveToLocalStorage();
    });
  });

  // ── Delete clip ──
  card.querySelector('.btn-delete-clip').addEventListener('click', () => {
    if (!confirm('Delete this clip?')) return;
    if (scrubberClipId === clip.id) stopScrubber();
    clips = clips.filter(c => c.id !== clip.id);
    renderClips();
    saveToLocalStorage();
    showToast('Clip deleted');
  });

  return card;
}

/* ── Timestamp Helpers ── */

function adjustTimestamp(clip, card, field, delta) {
  const current = parseTimestamp(clip[field]) || 0;
  const newVal = Math.max(0, current + delta);
  const formatted = formatTimestamp(newVal);
  clip[field] = formatted;

  const input = card.querySelector(`.ts-input[data-field="${field}"]`);
  if (input) { input.value = formatted; input.classList.remove('input-error'); }
  updateDuration(clip, card);
  updateScrubberRange(clip, card);
  saveToLocalStorage();
}

function updateDuration(clip, card) {
  const startTime = parseTimestamp(clip.start) || 0;
  const endTime = parseTimestamp(clip.end) || 0;
  const dur = endTime - startTime;
  const invalid = dur <= 0;
  const durEl = card.querySelector('.ts-duration');
  if (durEl) {
    durEl.textContent = invalid ? 'INVALID' : formatTimestamp(dur);
    durEl.classList.toggle('ts-invalid', invalid);
  }
}

/* ══════════════════════════════
   AUDIO SCRUBBER
   ══════════════════════════════ */

function toggleScrubber(clip, card) {
  const song = songs.find(s => s.id === clip.songId);
  if (!song || !song.file) {
    showToast('No audio file set for this song');
    return;
  }

  const url = `./audio/full/${song.file}`;

  // If this clip is already active, toggle play/pause
  if (scrubberClipId === clip.id) {
    if (scrubberPlaying) {
      audio.pause();
      scrubberPlaying = false;
      cancelAnimationFrame(animFrameId);
    } else {
      audio.play().catch(err => console.error('Playback failed:', err));
      scrubberPlaying = true;
      startScrubberLoop();
    }
    updateScrubberUI();
    return;
  }

  // Different clip — load new audio
  stopScrubber();
  scrubberClipId = clip.id;
  scrubberDuration = 0;

  audio.src = url;
  audio.load();

  const onCanPlay = () => {
    audio.removeEventListener('canplay', onCanPlay);
    scrubberDuration = audio.duration || 0;
    audio.play().catch(err => console.error('Playback failed:', err));
    scrubberPlaying = true;
    startScrubberLoop();
    updateScrubberUI();
  };
  audio.addEventListener('canplay', onCanPlay);
}

function stopScrubber() {
  audio.pause();
  scrubberPlaying = false;
  cancelAnimationFrame(animFrameId);
  scrubberClipId = null;
  scrubberDuration = 0;
  // Reset all scrubber UIs
  document.querySelectorAll('.scrubber-play').forEach(btn => btn.innerHTML = ICON_PLAY);
  document.querySelectorAll('.scrubber-playhead').forEach(el => el.style.width = '0%');
  document.querySelectorAll('.scrubber-time').forEach(el => el.textContent = '0:00 / 0:00');
  document.querySelectorAll('.scrubber-range').forEach(el => { el.style.left = '0%'; el.style.width = '0%'; });
}

function startScrubberLoop() {
  function tick() {
    if (!scrubberPlaying) return;
    updateScrubberUI();
    animFrameId = requestAnimationFrame(tick);
  }
  animFrameId = requestAnimationFrame(tick);
}

function updateScrubberUI() {
  if (scrubberClipId === null) return;
  const card = document.querySelector(`[data-clip-id="${scrubberClipId}"]`);
  if (!card) return;

  const clip = clips.find(c => c.id === scrubberClipId);

  // Play/pause button icon
  const playBtn = card.querySelector('.scrubber-play');
  if (playBtn) playBtn.innerHTML = scrubberPlaying ? ICON_PAUSE : ICON_PLAY;

  // Playhead position
  const playhead = card.querySelector('.scrubber-playhead');
  if (playhead && scrubberDuration > 0) {
    const frac = Math.min(1, audio.currentTime / scrubberDuration);
    playhead.style.width = `${frac * 100}%`;
  }

  // Time display
  const timeEl = card.querySelector('.scrubber-time');
  if (timeEl) {
    timeEl.textContent = `${formatTimestamp(audio.currentTime)} / ${formatTimestamp(scrubberDuration)}`;
  }

  // Range highlight
  if (clip) updateScrubberRange(clip, card);
}

function updateScrubberRange(clip, card) {
  const range = card.querySelector('.scrubber-range');
  if (!range) return;
  const dur = scrubberClipId === clip.id ? scrubberDuration : 0;
  if (dur <= 0) {
    range.style.left = '0%';
    range.style.width = '0%';
    return;
  }
  const startSec = parseTimestamp(clip.start) || 0;
  const endSec = parseTimestamp(clip.end) || 0;
  const startFrac = Math.min(1, startSec / dur);
  const endFrac = Math.min(1, endSec / dur);
  range.style.left = `${startFrac * 100}%`;
  range.style.width = `${Math.max(0, endFrac - startFrac) * 100}%`;
}

function setupScrubberSeek(container, clip, card) {
  if (!container) return;
  let seeking = false;

  function doSeek(e) {
    if (scrubberClipId !== clip.id || scrubberDuration <= 0) return;
    const rect = container.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = frac * scrubberDuration;
    updateScrubberUI();
  }

  container.addEventListener('pointerdown', (e) => {
    // If scrubber isn't active for this clip, start it first
    if (scrubberClipId !== clip.id) {
      toggleScrubber(clip, card);
      return;
    }
    seeking = true;
    container.setPointerCapture(e.pointerId);
    doSeek(e);
  });

  container.addEventListener('pointermove', (e) => {
    if (seeking) doSeek(e);
  });

  container.addEventListener('pointerup', () => { seeking = false; });
  container.addEventListener('pointercancel', () => { seeking = false; });
}

/* ══════════════════════════════
   PARTS TAB
   ══════════════════════════════ */

function renderParts() {
  const list = document.getElementById('parts-list');
  if (!list) return;
  list.innerHTML = '';

  for (const part of parts) {
    list.appendChild(createPartRow(part));
  }
}

function createPartRow(part) {
  const row = document.createElement('div');
  row.className = 'part-row';

  const usageCount = clips.filter(c => c.parts.includes(part.name)).length;

  row.innerHTML = `
    <input type="color" class="part-color-input" value="${part.color}">
    <input type="text" class="part-name-input" value="${esc(part.name)}">
    <span class="part-usage">${usageCount} clip${usageCount !== 1 ? 's' : ''}</span>
    <button class="btn-icon btn-delete-part" title="Delete part" ${usageCount > 0 ? 'disabled' : ''}>${ICON_DELETE}</button>
  `;

  row.querySelector('.part-color-input').addEventListener('input', (e) => {
    part.color = e.target.value;
    saveToLocalStorage();
  });

  const nameInput = row.querySelector('.part-name-input');
  let oldName = part.name;
  nameInput.addEventListener('change', () => {
    const newName = nameInput.value.trim();
    if (!newName || newName === oldName) {
      nameInput.value = oldName;
      return;
    }
    if (parts.some(p => p !== part && p.name === newName)) {
      showToast('A part with that name already exists');
      nameInput.value = oldName;
      return;
    }
    for (const clip of clips) {
      clip.parts = clip.parts.map(p => p === oldName ? newName : p);
    }
    part.name = newName;
    oldName = newName;
    renderClips();
    saveToLocalStorage();
    showToast(`Renamed to "${newName}"`);
  });

  row.querySelector('.btn-delete-part').addEventListener('click', () => {
    if (usageCount > 0) return;
    if (!confirm(`Delete part "${part.name}"?`)) return;
    parts = parts.filter(p => p !== part);
    renderParts();
    renderClips();
    saveToLocalStorage();
    showToast('Part deleted');
  });

  return row;
}

/* ══════════════════════════════
   SONGS TAB
   ══════════════════════════════ */

function renderSongs() {
  const list = document.getElementById('songs-list');
  if (!list) return;
  list.innerHTML = '';

  for (const song of songs) {
    list.appendChild(createSongRow(song));
  }
}

function createSongRow(song) {
  const row = document.createElement('div');
  row.className = 'song-row';

  const usageCount = clips.filter(c => c.songId === song.id).length;

  row.innerHTML = `
    <input type="text" class="song-title-input" value="${esc(song.title)}" placeholder="Song title">
    <span class="song-filename">${esc(song.file || '(no file)')}</span>
    <input type="text" class="song-sheet-input" value="${esc(song.sheet || '')}" placeholder="sheet.pdf">
    <span class="part-usage">${usageCount} clip${usageCount !== 1 ? 's' : ''}</span>
    <button class="btn-icon btn-delete-song" title="Delete song" ${usageCount > 0 ? 'disabled' : ''}>${ICON_DELETE}</button>
  `;

  row.querySelector('.song-title-input').addEventListener('change', (e) => {
    song.title = e.target.value.trim() || song.title;
    saveToLocalStorage();
  });

  row.querySelector('.song-sheet-input').addEventListener('change', (e) => {
    song.sheet = e.target.value.trim();
    saveToLocalStorage();
  });

  row.querySelector('.btn-delete-song').addEventListener('click', () => {
    if (usageCount > 0) return;
    if (!confirm(`Delete song "${song.title}"?`)) return;
    songs = songs.filter(s => s !== song);
    renderSongs();
    renderClips();
    saveToLocalStorage();
    showToast('Song deleted');
  });

  return row;
}

/* ══════════════════════════════
   SIDES TAB
   ══════════════════════════════ */

function renderSides() {
  const list = document.getElementById('admin-sides-list');
  if (!list) return;
  list.innerHTML = '';

  for (const side of sides) {
    list.appendChild(createSideRow(side));
  }
}

function createSideRow(side) {
  const row = document.createElement('div');
  row.className = 'side-admin-row';

  row.innerHTML = `
    <input type="text" class="side-title-input" value="${esc(side.title)}" placeholder="Side title">
    <input type="text" class="side-file-input" value="${esc(side.file || '')}" placeholder="filename.pdf">
    <input type="text" class="side-characters-input" value="${esc((side.characters || []).join(', '))}" placeholder="Character1, Character2, ...">
    <button class="btn-icon btn-delete-side" title="Delete side">${ICON_DELETE}</button>
  `;

  row.querySelector('.side-title-input').addEventListener('change', (e) => {
    side.title = e.target.value.trim() || side.title;
    saveToSidesLocalStorage();
  });

  row.querySelector('.side-file-input').addEventListener('change', (e) => {
    const val = e.target.value.trim();
    side.file = val;
    if (val) {
      side.id = val.replace(/\.pdf$/i, '').replace(/\s+/g, '-').toLowerCase();
    }
    saveToSidesLocalStorage();
  });

  row.querySelector('.side-characters-input').addEventListener('change', (e) => {
    side.characters = e.target.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    saveToSidesLocalStorage();
  });

  row.querySelector('.btn-delete-side').addEventListener('click', () => {
    if (!confirm(`Delete side "${side.title}"?`)) return;
    sides = sides.filter(s => s !== side);
    renderSides();
    saveToSidesLocalStorage();
    showToast('Side deleted');
  });

  return row;
}

/* ── Banner ── */

function showBanner(msg) {
  const banner = document.getElementById('data-banner');
  if (!banner) return;
  banner.textContent = msg;
  banner.classList.add('banner-error');
  banner.hidden = false;
}

function showDraftBanner() {
  const banner = document.getElementById('data-banner');
  if (!banner) return;
  banner.textContent = 'Loaded from local draft — click Publish to push changes live';
  banner.classList.remove('banner-error', 'banner-warn');
  banner.classList.add('banner-info');
  banner.hidden = false;
}

/* ── Toast ── */

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.hidden = false;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { toast.hidden = true; }, 300);
  }, 2500);
}

/* ── HTML Escaping ── */

function esc(str) {
  const el = document.createElement('span');
  el.textContent = str || '';
  return el.innerHTML;
}

init();
