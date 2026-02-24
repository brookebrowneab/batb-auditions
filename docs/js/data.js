/**
 * Data layer: fetches clip definitions from a published Google Sheet (CSV)
 * or falls back to the local clips.json file.
 *
 * New format (clips.json as { songs, parts, clips }) is auto-detected.
 * Legacy format (flat array) still works for backward compatibility.
 */
import { config } from './config.js';

/**
 * Fetch and parse audition clips.
 * Returns { songs, parts, clips, source }
 *   - songs: array of { id, title, file }
 *   - parts: array of { name, color }
 *   - clips: resolved clip objects ready for UI/player
 *   - source: 'live' | 'cached' | 'error'
 */
export async function fetchClips() {
  // Try JSONBin cloud first (live published data)
  if (config.jsonBinId) {
    try {
      const resp = await fetch(
        `https://api.jsonbin.io/v3/b/${config.jsonBinId}?meta=false`
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const raw = await resp.json();
      const { songs, parts, clips } = resolveClips(raw);
      return { songs, parts, clips, source: 'live' };
    } catch (err) {
      console.warn('JSONBin fetch failed, trying fallback:', err);
    }
  }

  // Try Google Sheet CSV
  if (config.sheetCsvUrl) {
    try {
      const resp = await fetch(config.sheetCsvUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const clips = parseCsv(text);
      if (clips.length > 0) {
        return { songs: [], parts: buildPartsFromClips(clips), clips, source: 'live' };
      }
    } catch (err) {
      console.warn('Google Sheet fetch failed, trying fallback:', err);
    }
  }

  // Fallback to local JSON
  try {
    const resp = await fetch('./data/clips.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const raw = await resp.json();

    // Detect format: new structured vs legacy flat array
    if (Array.isArray(raw)) {
      // Legacy flat array
      const clips = raw.map((c, i) => normalizeClip(c, i));
      return { songs: [], parts: buildPartsFromClips(clips), clips, source: 'cached' };
    }

    // New structured format
    const { songs, parts, clips } = resolveClips(raw);
    return { songs, parts, clips, source: 'cached' };
  } catch (err) {
    console.error('Fallback data also failed:', err);
    return { songs: [], parts: [], clips: [], source: 'error' };
  }
}

/* ── New Format Resolution ── */

/**
 * Resolve structured { songs, parts, clips } into fully hydrated clip objects.
 * Each resolved clip gets: fullTrackId, backingTrackId, song (title),
 * parts (array of names), colors (array), color (first color),
 * startTime, endTime, startRaw, endRaw, notes, id.
 */
function resolveClips(data) {
  const songs = data.songs || [];
  const parts = data.parts || [];
  const rawClips = data.clips || [];

  const songMap = new Map(songs.map(s => [s.id, s]));
  const partMap = new Map(parts.map(p => [p.name, p]));

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
      fullTrackId: song ? `./audio/full/${song.file}` : '',
      backingTrackId: song ? `./audio/instrumental/${song.file}` : '',
      sheetUrl: (song && song.sheet) ? `./sheet_music/${song.sheet}` : '',
      startTime,
      endTime,
      startRaw: clip.start || formatTimestamp(startTime),
      endRaw: clip.end || formatTimestamp(endTime),
      notes: clip.notes || '',
      parts: clipParts,
      colors,
      color: colors[0] || 'var(--color-rose)',
      // Legacy compat: character = first part name
      character: clipParts[0] || '',
    };
  });

  return { songs, parts, clips };
}

/** Build parts list from legacy flat clips (for CSV / old JSON). */
function buildPartsFromClips(clips) {
  const seen = new Map();
  for (const clip of clips) {
    const name = clip.character || (clip.parts && clip.parts[0]) || '';
    if (name && !seen.has(name)) {
      seen.set(name, { name, color: clip.color || 'var(--color-rose)' });
    }
  }

  // Respect config.characterOrder if present
  const ordered = [];
  for (const name of (config.characterOrder || [])) {
    if (seen.has(name)) {
      ordered.push(seen.get(name));
      seen.delete(name);
    }
  }
  // Remaining alphabetically
  const rest = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  return [...ordered, ...rest];
}

/* ── CSV Parsing ── */

function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const clips = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 6) continue;

    const startTime = parseTimestamp(fields[4]?.trim());
    const endTime = parseTimestamp(fields[5]?.trim());

    const clip = {
      id: i,
      character: fields[0]?.trim(),
      song: fields[1]?.trim(),
      fullTrackId: fields[2]?.trim(),
      backingTrackId: fields[3]?.trim(),
      startTime,
      endTime,
      startRaw: fields[4]?.trim(),
      endRaw: fields[5]?.trim(),
      notes: fields[6]?.trim() || '',
      color: fields[7]?.trim() || '',
      parts: [fields[0]?.trim()],
      colors: [fields[7]?.trim() || 'var(--color-rose)'],
    };

    if (clip.character && clip.song && startTime !== null && endTime !== null && endTime > startTime) {
      clips.push(clip);
    } else {
      console.warn(`Skipping invalid row ${i}:`, fields);
    }
  }
  return clips;
}

/** Parse a single CSV line, respecting quoted fields. */
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/* ── Timestamp Helpers ── */

/** Parse "M:SS" or "MM:SS" or "H:MM:SS" → seconds. Returns null on invalid input. */
export function parseTimestamp(str) {
  if (!str) return null;
  const parts = str.split(':').map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return null;

  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

/** Format seconds → "M:SS" */
export function formatTimestamp(seconds) {
  if (seconds == null || isNaN(seconds)) return '0:00';
  const s = Math.max(0, Math.round(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Normalize a clip object from legacy JSON fallback. */
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

/** Get parts array (from structured data). */
export function getParts(parts) {
  return parts;
}

/** Legacy: get sorted unique character list from clips. */
export function getCharacters(clips) {
  const seen = new Set();
  clips.forEach(c => seen.add(c.character));

  const ordered = [];
  for (const name of (config.characterOrder || [])) {
    if (seen.has(name)) {
      ordered.push(name);
      seen.delete(name);
    }
  }
  const rest = [...seen].sort();
  return [...ordered, ...rest];
}
