/**
 * Data layer: fetches clip and sides data.
 * Extended from v1 with character index building and sides support.
 */
import { config } from './config.js';

// Cache the JSONBin response so we only fetch once
let _jsonBinData = null;
let _jsonBinFetched = false;

async function fetchJsonBin() {
  if (_jsonBinFetched) return _jsonBinData;
  _jsonBinFetched = true;
  if (!config.jsonBinId) return null;
  try {
    const resp = await fetch(
      `https://api.jsonbin.io/v3/b/${config.jsonBinId}?meta=false`
    );
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    _jsonBinData = await resp.json();
    return _jsonBinData;
  } catch (err) {
    console.warn('JSONBin fetch failed, trying fallback:', err);
    return null;
  }
}

/**
 * Fetch and parse audition clips.
 * Returns { songs, parts, clips, source }
 */
export async function fetchClips() {
  const raw = await fetchJsonBin();
  if (raw) {
    const { songs, parts, clips } = resolveClips(raw);
    return { songs, parts, clips, source: 'live' };
  }

  // Fallback to local JSON
  try {
    const url = config.clipsDataUrl || './data/clips.json';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const localRaw = await resp.json();

    if (Array.isArray(localRaw)) {
      const clips = localRaw.map((c, i) => normalizeClip(c, i));
      return { songs: [], parts: buildPartsFromClips(clips), clips, source: 'cached' };
    }

    const { songs, parts, clips } = resolveClips(localRaw);
    return { songs, parts, clips, source: 'cached' };
  } catch (err) {
    console.error('Fallback data also failed:', err);
    return { songs: [], parts: [], clips: [], source: 'error' };
  }
}

/**
 * Fetch callback sides data.
 * Returns array of { id, title, file, characters, url }
 */
export async function fetchSides() {
  const sidesPath = config.sidesPath || './sides/';
  const mapSides = (arr) => (arr || []).map(s => ({ ...s, url: `${sidesPath}${s.file}` }));

  const raw = await fetchJsonBin();
  if (raw && raw.sides) return mapSides(raw.sides);

  // Fallback to local JSON
  try {
    const url = config.sidesDataUrl || './data/sides.json';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return mapSides(data.sides);
  } catch (err) {
    console.error('Failed to fetch sides:', err);
    return [];
  }
}

/**
 * Build a character index from clips and parts.
 * Returns Map<characterName, { name, color, songs: [{ song, clips: [] }], clipCount }>
 */
export function buildCharacterIndex(clips, parts, songs) {
  const partMap = new Map(parts.map(p => [p.name, p]));
  const songMap = new Map(songs.map(s => [s.id, s]));
  const index = new Map();

  for (const clip of clips) {
    for (const partName of clip.parts) {
      if (!index.has(partName)) {
        const part = partMap.get(partName) || { name: partName, color: '#64748B' };
        index.set(partName, {
          name: partName,
          color: part.color,
          songMap: new Map(),
          clipCount: 0,
        });
      }
      const entry = index.get(partName);
      entry.clipCount++;

      const songId = clip.songId;
      if (!entry.songMap.has(songId)) {
        const songData = songMap.get(songId);
        entry.songMap.set(songId, {
          songId,
          title: songData ? songData.title : songId,
          sheet: songData ? songData.sheet : null,
          clips: [],
        });
      }
      entry.songMap.get(songId).clips.push(clip);
    }
  }

  // Convert songMaps to arrays
  const result = new Map();
  for (const [name, entry] of index) {
    result.set(name, {
      name: entry.name,
      color: entry.color,
      clipCount: entry.clipCount,
      songs: [...entry.songMap.values()],
    });
  }
  return result;
}

/* ── Resolution ── */

function resolveClips(data) {
  const songs = data.songs || [];
  const parts = data.parts || [];
  const rawClips = data.clips || [];

  const songMap = new Map(songs.map(s => [s.id, s]));
  const partMap = new Map(parts.map(p => [p.name, p]));

  const audioFullPath = config.audioFullPath || './audio/full/';
  const audioInstrumentalPath = config.audioInstrumentalPath || './audio/instrumental/';
  const sheetMusicPath = config.sheetMusicPath || './sheet_music/';

  const clips = rawClips.map((clip, index) => {
    const song = songMap.get(clip.songId);
    const clipParts = clip.parts || [];
    const colors = clipParts.map(name => partMap.get(name)?.color || 'var(--color-rose)');

    const startTime = parseTimestamp(clip.start);
    const endTime = parseTimestamp(clip.end);

    return {
      id: clip.id || index + 1,
      songId: clip.songId,
      song: song ? song.title : clip.songId,
      fullTrackId: song ? `${audioFullPath}${song.file}` : '',
      backingTrackId: song ? `${audioInstrumentalPath}${song.file}` : '',
      sheetUrl: (song && song.sheet) ? `${sheetMusicPath}${song.sheet}` : '',
      startTime,
      endTime,
      startRaw: clip.start || formatTimestamp(startTime),
      endRaw: clip.end || formatTimestamp(endTime),
      notes: clip.notes || '',
      parts: clipParts,
      colors,
      color: colors[0] || 'var(--color-rose)',
      character: clipParts[0] || '',
    };
  });

  return { songs, parts, clips };
}

function buildPartsFromClips(clips) {
  const seen = new Map();
  for (const clip of clips) {
    const name = clip.character || (clip.parts && clip.parts[0]) || '';
    if (name && !seen.has(name)) {
      seen.set(name, { name, color: clip.color || 'var(--color-rose)' });
    }
  }
  return [...seen.values()];
}

/* ── Timestamp Helpers ── */

export function parseTimestamp(str) {
  if (!str) return null;
  const parts = str.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export function formatTimestamp(seconds) {
  if (seconds == null || isNaN(seconds)) return '0:00';
  const s = Math.max(0, Math.round(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function normalizeClip(clip, index) {
  const startTime = typeof clip.startTime === 'number'
    ? clip.startTime
    : parseTimestamp(clip.start || clip.startRaw);
  const endTime = typeof clip.endTime === 'number'
    ? clip.endTime
    : parseTimestamp(clip.end || clip.endRaw);

  return {
    ...clip,
    id: clip.id || index + 1,
    startTime,
    endTime,
    startRaw: clip.startRaw || clip.start || formatTimestamp(startTime),
    endRaw: clip.endRaw || clip.end || formatTimestamp(endTime),
    parts: clip.parts || [clip.character],
    colors: clip.colors || [clip.color || 'var(--color-rose)'],
  };
}
